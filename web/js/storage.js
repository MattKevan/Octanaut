// @ts-check
/* Octanaut - local persistence
 *
 * The working song and the editor state are kept in IndexedDB so a reload
 * does not throw away an unsaved composition. Two alternating slots plus a
 * small pointer record make a save crash-safe: the previous snapshot stays
 * intact until the new one is complete.
 *
 * The module is deliberately storage-agnostic. `MW.storage.use(adapter)`
 * accepts anything with load/store/clear, which is how the headless tests run
 * without a browser.
 *
 *   MW.storage.init()            // pick the browser adapter and hook edits
 *   const snap = await MW.storage.restore()
 *   MW.storage.schedule()        // debounced autosave
 *   await MW.storage.saveNow()   // force one
 */
(function (global) {
  'use strict';

  const MW = global.MW = global.MW || {};

  const DB_NAME = 'octanaut';
  const DB_VERSION = 1;
  const SNAPSHOT_VERSION = 1;
  const SAVE_DELAY = 1200;

  /* Editor state worth restoring. Derived state (songList, song, cursor),
     audio nodes, timers and transient input state are handled separately or
     left out entirely. `paths` is skipped: directory handles may come back
     without permission, and a failed restore is worse than re-picking one. */
  const WORKSPACE_KEYS = [
    'editMode', 'octave', 'step', 'advance', 'spaceAsDel', 'autoSpace',
    'chordMode', 'follow', 'hb', 'mutedTracks', 'selectedTracks',
    'transposeScope', 'padMode', 'playOnNote', 'progTarget', 'progAlt',
    'paletteIndex', 'paletteRGB', 'confirmOn', 'depth', 'dep2', 'no16',
    'ptkey', 'saveFormat', 'saveInfo', 'diskVolume', 'padMap2', 'midiAllOff',
    'midiMessages', 'midiMsgIndex', 'midiMsgAuto', 'midiMapActive',
    'midiKeyUp', 'midiMapIndex', 'midiMap', 'midiInput', 'midiSendOut',
    'midiInChannel', 'extSync', 'eq', 'pset', 'psets', 'notaPresets',
    'notaTracks', 'notaGhost', 'notaInstruments', 'notaSave', 'notaFeed',
    'notaPrintAll', 'keySig', 'timeSig'
  ];

  /* Instruments cache AudioBuffers and view state for the engine. None of it
     is model data, and AudioBuffer is not structured-cloneable. */
  function stripInstrument(inst) {
    if (!inst || typeof inst !== 'object') return;
    delete inst._abuf;
    delete inst._abufKey;
    delete inst._synthBuf;
    delete inst._synthKey;
    delete inst._view;
    delete inst._undo;
    if (inst.synth && typeof inst.synth === 'object') delete inst.synth._undo;
  }

  /* A snapshot is a deep copy of the root song, with its multis rebuilt from
     the song list so the shared instruments array survives every adapter. */
  MW.storageSnapshot = function (app) {
    if (!app) return null;
    const root = (app.songList && app.songList[0]) || app.song;
    if (!root || !Array.isArray(root.blocks) || !root.blocks.length) return null;

    const song = MW.cloneSong(root);
    const list = [song].concat(song.multis || []);
    const shared = Array.isArray(song.instruments) ? song.instruments : new Array(63).fill(null);
    list.forEach(part => {
      (part.instruments || []).forEach(stripInstrument);
      part.instruments = shared;
    });
    song.multis = list.slice(1);

    const workspace = {};
    WORKSPACE_KEYS.forEach(key => {
      if (app[key] !== undefined) workspace[key] = MW.deepClone(app[key]);
    });

    const index = app.songList ? app.songList.indexOf(app.song) : 0;
    return {
      v: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      name: song.name || 'untitled',
      songList: list,
      songIndex: index >= 0 ? index : 0,
      cursor: { ...(app.cursor || {}) },
      currentIns: app.currentIns || 1,
      workspace
    };
  };

  /* Validate and normalise a stored snapshot. Returns null when the record is
     the wrong version or too damaged to trust, so the caller can fall back. */
  MW.storageRevive = function (snap) {
    if (!snap || snap.v !== SNAPSHOT_VERSION) return null;
    if (!Array.isArray(snap.songList) || !snap.songList.length) return null;

    const list = snap.songList.filter(part =>
      part && Array.isArray(part.blocks) && part.blocks.length &&
      part.blocks.every(block => block && Array.isArray(block.rows) && block.rows.length &&
        Array.isArray(block.rows[0])));
    if (!list.length) return null;

    const root = list[0];
    const shared = Array.isArray(root.instruments) ? root.instruments : new Array(63).fill(null);
    list.forEach(part => {
      part.instruments = shared;
      if (!Array.isArray(part.playseq) || !part.playseq.length) part.playseq = [0];
      if (!Array.isArray(part.trkvol)) part.trkvol = new Array(16).fill(64);
      if (!part.flags) part.flags = {};
    });
    root.multis = list.slice(1);

    return {
      ...snap,
      songList: list,
      songIndex: Math.max(0, Math.min(snap.songIndex || 0, list.length - 1)),
      cursor: snap.cursor || {},
      currentIns: snap.currentIns || 1,
      workspace: snap.workspace || {}
    };
  };

  /* ------------------------------------------------------------ adapters */

  /* In-memory adapter for tests and for environments without IndexedDB. */
  function createMemoryAdapter() {
    /** @type {{ a: any, b: any, meta: any }} */
    const data = { a: null, b: null, meta: null };
    const copy = value => typeof structuredClone === 'function'
      ? structuredClone(value)
      : MW.deepClone(value);
    return {
      data,
      async load() {
        const order = data.meta
          ? [data.meta.slot, data.meta.slot === 'a' ? 'b' : 'a']
          : ['a', 'b'];
        for (const slot of order) {
          const record = data[slot];
          if (!record) continue;
          const snapshot = MW.storageRevive(record.snapshot);
          if (snapshot) return { snapshot, savedAt: record.savedAt };
        }
        return null;
      },
      async store(snapshot, savedAt) {
        const slot = data.meta && data.meta.slot === 'a' ? 'b' : 'a';
        data[slot] = { snapshot: copy(snapshot), savedAt };
        data.meta = { slot, savedAt };
      },
      async clear() {
        data.a = data.b = data.meta = null;
      }
    };
  }

  /* Browser adapter: snapshots and the pointer live in two object stores.
     Writing the inactive slot before the pointer means a crash leaves the
     previous good snapshot reachable. */
  function createIdbAdapter() {
    /** @type {Promise<IDBDatabase> | null} */
    let opening = null;

    function db() {
      if (!opening) {
        const promise = new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains('snapshots')) database.createObjectStore('snapshots');
            if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
        });
        opening = promise;
        promise.catch(() => { opening = null; });
      }
      return opening;
    }

    /**
     * @param {string} store
     * @param {IDBValidKey} key
     */
    function get(store, key) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(store, 'readonly');
        const request = tx.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }));
    }

    /**
     * @param {string} store
     * @param {any} value
     * @param {IDBValidKey} key
     */
    function put(store, value, key) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }));
    }

    return {
      async load() {
        const meta = await get('meta', 'current');
        const order = meta
          ? [meta.slot, meta.slot === 'a' ? 'b' : 'a']
          : ['a', 'b'];
        for (const slot of order) {
          const record = await get('snapshots', slot);
          if (!record) continue;
          const snapshot = MW.storageRevive(record.snapshot);
          if (snapshot) return { snapshot, savedAt: record.savedAt };
        }
        return null;
      },
      async store(snapshot, savedAt) {
        const meta = await get('meta', 'current');
        const slot = meta && meta.slot === 'a' ? 'b' : 'a';
        await put('snapshots', { snapshot, savedAt }, slot);
        await put('meta', { slot, savedAt }, 'current');
      },
      async clear() {
        const database = await db();
        await new Promise((resolve, reject) => {
          const tx = database.transaction(['snapshots', 'meta'], 'readwrite');
          tx.objectStore('snapshots').clear();
          tx.objectStore('meta').clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      }
    };
  }

  /* ------------------------------------------------------------- storage */

  const storage = MW.storage = {
    adapter: null,
    available: false,
    state: 'idle',
    savedAt: 0,
    _timer: 0,
    _dirty: false,
    _rev: 0,
    _written: 0,
    _inited: false,
    _restoring: false,
    _persisted: false,
    _quota: false,
    /* Held true while boot restores, so mounting panels does not immediately
       write a snapshot back over the one being restored. */
    paused: false,

    init() {
      if (this._inited) return this;
      this._inited = true;
      try {
        if (typeof indexedDB !== 'undefined') {
          this.adapter = createIdbAdapter();
          this.available = true;
        }
      } catch (e) {
        this.adapter = null;
        this.available = false;
        this.state = 'off';
      }

      MW.on('edit', () => this.schedule());
      MW.on('song', () => this.schedule());
      /* Sample and synth edits report through the store rather than
         refreshAll, so listen for the song slice too. The memory readout
         commits 'song' just to repaint; that is not an edit. */
      if (MW.store && MW.store.subscribe) {
        MW.store.subscribe('song', ev => {
          if (ev && ev.reason === 'memory') return;
          this.schedule();
        });
      }
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.flush();
        });
      }
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', () => this.flush());
      }
      return this;
    },

    /* Swap the backend. Tests pass a memory adapter; the app uses IndexedDB. */
    use(adapter) {
      this.adapter = adapter || null;
      this.available = !!adapter;
      this.state = adapter ? 'idle' : 'off';
      this._dirty = false;
      this._rev = 0;
      this._written = 0;
      this._quota = false;
      return this;
    },

    async restore() {
      this._quota = false;
      if (!this.adapter) {
        this.state = 'off';
        return null;
      }
      this._restoring = true;
      try {
        const found = await this.adapter.load();
        if (found) {
          this.savedAt = found.savedAt || 0;
          this.state = 'saved';
        }
        return found ? found.snapshot : null;
      } catch (err) {
        /* A blocked or disabled IndexedDB should not keep retrying. */
        const error = /** @type {any} */ (err);
        if (error && (error.name === 'SecurityError' || error.name === 'InvalidStateError')) {
          this.adapter = null;
          this.available = false;
          this.state = 'off';
        } else {
          this.state = 'error';
        }
        return null;
      } finally {
        this._restoring = false;
        this._dirty = false;
        this._rev = 0;
        this._written = 0;
      }
    },

    schedule() {
      if (!this.adapter || this._restoring || this.paused || this._quota) return;
      this._dirty = true;
      this._rev++;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.saveNow('auto'), SAVE_DELAY);
    },

    async saveNow(reason) {
      if (!this.adapter) return false;
      clearTimeout(this._timer);
      if (!this._dirty && this._written === this._rev) return false;

      const snapshot = MW.storageSnapshot(MW.app);
      if (!snapshot) return false;

      const revision = this._rev;
      this.state = 'saving';
      MW.emit('save', { state: this.state, savedAt: this.savedAt, reason });
      try {
        await this.adapter.store(snapshot, snapshot.savedAt);
        this.savedAt = snapshot.savedAt;
        this._written = revision;
        this._dirty = this._rev !== revision;
        this.state = 'saved';
        if (!this._persisted && typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
          this._persisted = true;
          navigator.storage.persist().catch(() => {});
        }
      } catch (err) {
        const error = /** @type {any} */ (err);
        if (error && error.name === 'QuotaExceededError') {
          this.state = 'quota';
          this._quota = true;
        } else {
          this.state = 'error';
        }
      }
      MW.emit('save', { state: this.state, savedAt: this.savedAt, reason });
      return this.state === 'saved';
    },

    flush() {
      if (!this.adapter || !this._dirty) return;
      clearTimeout(this._timer);
      this.saveNow('flush');
    },

    async clear() {
      clearTimeout(this._timer);
      this._dirty = false;
      this._quota = false;
      this.savedAt = 0;
      if (this.adapter) {
        try { await this.adapter.clear(); } catch (e) { /* already unusable */ }
      }
      this.state = this.adapter ? 'idle' : 'off';
      MW.emit('save', { state: this.state, savedAt: 0 });
    }
  };

  MW.storage.memoryAdapter = createMemoryAdapter;
  MW.storage.idbAdapter = createIdbAdapter;

})(typeof globalThis !== 'undefined' ? globalThis : this);
