// @ts-check
/* Octanaut - virtual disks
 *
 * `DF0:` is a small writable volume kept in IndexedDB. It holds real module
 * bytes written by the existing encoders, so a file saved here is a normal
 * .med/.mmd0/.mod that can be loaded again or exported to the Mac.
 *
 * Like MW.storage, the backend is swappable so the headless tests can run
 * against an in-memory volume.
 *
 *   MW.disk.init()
 *   await MW.disk.list('DF0:')
 *   await MW.disk.write('DF0:', 'song.med', bytes, '.med')
 */
(function (global) {
  'use strict';

  const MW = global.MW = global.MW || {};

  const DB_NAME = 'octanaut-disk';
  const DB_VERSION = 1;
  const STORE = 'files';
  const VOLUMES = ['DF0:'];
  const DEFAULT_VOLUME = 'DF0:';

  /* Names are flat: no folders, no separators, no control characters. The
     extension is supplied by the caller and added once. */
  function safeName(name) {
    let out = String(name == null ? '' : name).trim()
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^\.+/, '');
    if (!out) out = 'untitled';
    if (out.length > 64) out = out.slice(0, 64);
    return out;
  }

  /* "My Song" + ".med" -> "My Song.med"; "My Song.med" + ".med" stays put. */
  function fileName(songName, ext) {
    const suffix = ext ? (ext.startsWith('.') ? ext : '.' + ext) : '';
    const base = safeName(songName || 'untitled').replace(/\.(med|mmd[0-9]|mod)$/i, '');
    return base + suffix;
  }

  function fileId(volume, name) {
    return volume + safeName(name);
  }

  function meta(record) {
    return {
      name: record.name,
      path: record.name,
      dir: false,
      volume: record.volume,
      size: record.size,
      mtime: record.mtime,
      type: record.type || ''
    };
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }

  function asBytes(bytes) {
    if (bytes instanceof Uint8Array) return bytes.slice();
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes.slice(0));
    if (bytes && bytes.buffer instanceof ArrayBuffer) {
      return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    }
    throw new TypeError('disk.write needs bytes');
  }

  /* ------------------------------------------------------------ adapters */

  function createMemoryAdapter() {
    const rows = new Map();
    return {
      rows,
      async list(volume) {
        return [...rows.values()]
          .filter(record => record.volume === volume)
          .map(meta)
          .sort(byName);
      },
      async read(volume, name) {
        const record = rows.get(fileId(volume, name));
        return record ? record.bytes.slice() : null;
      },
      async write(volume, name, bytes, type) {
        const record = {
          id: fileId(volume, name),
          volume,
          name: safeName(name),
          bytes: asBytes(bytes),
          size: 0,
          mtime: Date.now(),
          type: type || ''
        };
        record.size = record.bytes.length;
        rows.set(record.id, record);
        return meta(record);
      },
      async remove(volume, name) {
        return rows.delete(fileId(volume, name));
      },
      async clear(volume) {
        if (!volume) { rows.clear(); return; }
        for (const [id, record] of rows) if (record.volume === volume) rows.delete(id);
      }
    };
  }

  function createIdbAdapter() {
    /** @type {Promise<IDBDatabase> | null} */
    let opening = null;

    function db() {
      if (!opening) {
        const promise = new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE)) {
              const store = database.createObjectStore(STORE, { keyPath: 'id' });
              store.createIndex('volume', 'volume', { unique: false });
            }
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

    function run(mode, fn) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = fn(store);
        tx.oncomplete = () => resolve(request && 'result' in request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }));
    }

    return {
      async list(volume) {
        const records = await run('readonly', store => store.index('volume').getAll(volume));
        return (records || []).map(meta).sort(byName);
      },
      async read(volume, name) {
        const record = await run('readonly', store => store.get(fileId(volume, name)));
        if (!record) return null;
        return record.bytes instanceof Uint8Array
          ? record.bytes.slice()
          : new Uint8Array(record.bytes);
      },
      async write(volume, name, bytes, type) {
        const data = asBytes(bytes);
        const record = {
          id: fileId(volume, name),
          volume,
          name: safeName(name),
          bytes: data,
          size: data.length,
          mtime: Date.now(),
          type: type || ''
        };
        await run('readwrite', store => store.put(record));
        return meta(record);
      },
      async remove(volume, name) {
        await run('readwrite', store => store.delete(fileId(volume, name)));
        return true;
      },
      async clear(volume) {
        if (!volume) return run('readwrite', store => store.clear());
        const records = await run('readonly', store => store.index('volume').getAllKeys(volume));
        for (const key of records || []) await run('readwrite', store => store.delete(key));
      }
    };
  }

  /* ---------------------------------------------------------------- disk */

  const disk = MW.disk = {
    adapter: null,
    available: false,
    volumes: VOLUMES,
    defaultVolume: DEFAULT_VOLUME,

    init() {
      if (this.adapter) return this;
      try {
        if (typeof indexedDB !== 'undefined') {
          this.adapter = createIdbAdapter();
          this.available = true;
        }
      } catch (e) {
        this.adapter = null;
        this.available = false;
      }
      return this;
    },

    use(adapter) {
      this.adapter = adapter || null;
      this.available = !!adapter;
      return this;
    },

    async list(volume) {
      if (!this.adapter) return [];
      return this.adapter.list(volume || this.defaultVolume);
    },

    async read(volume, name) {
      if (!this.adapter) return null;
      return this.adapter.read(volume || this.defaultVolume, name);
    },

    async write(volume, name, bytes, type) {
      if (!this.adapter) throw new Error('DF0: is not available in this browser');
      return this.adapter.write(volume || this.defaultVolume, safeName(name), bytes, type);
    },

    async remove(volume, name) {
      if (!this.adapter) return false;
      return this.adapter.remove(volume || this.defaultVolume, name);
    },

    async clear(volume) {
      if (!this.adapter) return;
      await this.adapter.clear(volume);
    },

    async usage() {
      if (!this.adapter) return { files: 0, bytes: 0 };
      const all = await this.list(this.defaultVolume);
      return { files: all.length, bytes: all.reduce((sum, file) => sum + (file.size || 0), 0) };
    }
  };

  MW.diskSafeName = safeName;
  MW.diskFileName = fileName;
  MW.disk.memoryAdapter = createMemoryAdapter;
  MW.disk.idbAdapter = createIdbAdapter;

})(typeof globalThis !== 'undefined' ? globalThis : this);
