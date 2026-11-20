// @ts-check
/* Octanaut - the Modland mount
 *
 * `DH0:` is a read-only view over https://ftp.modland.com/pub/modules/.
 * The tree comes from the OctaMED-only index built by
 * tools/build_modland_index.py (5,148 paths), so browsing needs no network
 * call. A module is fetched only when the user picks it, validated with the
 * normal loader, and then cached in IndexedDB for offline replay.
 *
 *   MW.modland.init()
 *   await MW.modland.loadIndex()
 *   MW.modland.list('')                 // the five format folders
 *   MW.modland.search('anthrium')
 *   await MW.modland.fetch({ path: 'OctaMED MMD1/Anthrium/...' })
 */
(function (global) {
  'use strict';

  const MW = global.MW = global.MW || {};

  const BASE = 'https://ftp.modland.com/pub/modules/';
  const INDEX_URL = 'data/modland-octamed.tsv';
  const DB_NAME = 'octanaut-modland';
  const DB_VERSION = 1;
  const MAX_BYTES = 8 * 1024 * 1024;
  const FETCH_TIMEOUT = 20000;

  /* ------------------------------------------------------------ index */

  function parseIndex(text) {
    const entries = [];
    let built = '';
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        const match = /Generated\s+(\S+)/.exec(line);
        if (match) built = match[1];
        continue;
      }
      /* `--with-md5` output is md5<TAB>path; the default is a bare path. */
      const path = line.includes('\t') ? line.slice(line.lastIndexOf('\t') + 1) : line;
      const parts = path.split('/').filter(Boolean);
      if (parts.length < 2) continue;
      entries.push({
        path,
        name: parts[parts.length - 1],
        format: parts[0],
        folder: parts.slice(1, -1).join('/')
      });
    }
    return { built, entries };
  }

  /**
   * @typedef {object} ModlandNode
   * @property {string} name
   * @property {string} path
   * @property {Map<string, ModlandNode>} folders
   * @property {any[]} files
   */

  function buildTree(entries) {
    /** @type {ModlandNode} */
    const root = { name: '', path: '', folders: new Map(), files: [] };
    for (const entry of entries) {
      const parts = entry.path.split('/').filter(Boolean);
      /** @type {ModlandNode} */
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const name = parts[i];
        let child = node.folders.get(name);
        if (!child) {
          child = { name, path: parts.slice(0, i + 1).join('/'), folders: new Map(), files: [] };
          node.folders.set(name, child);
        }
        node = child;
      }
      node.files.push(entry);
    }
    return root;
  }

  function nodeAt(root, path) {
    if (!path) return root;
    let node = root;
    for (const part of String(path).split('/')) {
      if (!part) continue;
      node = node.folders.get(part);
      if (!node) return null;
    }
    return node;
  }

  function urlFor(path) {
    const parts = String(path == null ? '' : path).split('/').filter(Boolean);
    if (!parts.length) throw new Error('empty module path');
    for (const part of parts) {
      if (part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part)) {
        throw new Error('invalid module path');
      }
    }
    return BASE + parts.map(encodeURIComponent).join('/');
  }

  function remoteEntry(entry, dir) {
    return {
      name: entry.name,
      dir: !!dir,
      path: entry.path,
      volume: 'DH0:',
      remote: true,
      size: null
    };
  }

  function byName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  }

  /* ------------------------------------------------------------ adapters */

  function createNoopAdapter() {
    return {
      async getIndex() { return null; },
      async putIndex() {},
      async getBytes() { return null; },
      async putBytes() {},
      async stats() { return { files: 0, bytes: 0 }; },
      async clear() {}
    };
  }

  function createMemoryAdapter() {
    const index = { text: null, built: '' };
    const bytes = new Map();
    return {
      index,
      bytes,
      async getIndex() { return index.text ? { text: index.text, built: index.built } : null; },
      async putIndex(text, built) { index.text = text; index.built = built || ''; },
      async getBytes(url) { const data = bytes.get(url); return data ? data.slice() : null; },
      async putBytes(url, path, data) { bytes.set(url, data.slice()); },
      async stats() {
        let total = 0;
        for (const data of bytes.values()) total += data.length;
        return { files: bytes.size, bytes: total };
      },
      async clear() { index.text = null; index.built = ''; bytes.clear(); }
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
            if (!database.objectStoreNames.contains('index')) database.createObjectStore('index');
            if (!database.objectStoreNames.contains('bytes')) database.createObjectStore('bytes');
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

    function get(store, key) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(store, 'readonly');
        const request = tx.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }));
    }

    function put(store, value, key) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }));
    }

    function getAll(store) {
      return db().then(database => new Promise((resolve, reject) => {
        const tx = database.transaction(store, 'readonly');
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }));
    }

    return {
      async getIndex() {
        const record = await get('index', 'octamed');
        return record ? { text: record.text, built: record.built || '' } : null;
      },
      async putIndex(text, built) {
        await put('index', { text, built: built || '', fetchedAt: Date.now() }, 'octamed');
      },
      async getBytes(url) {
        const record = await get('bytes', url);
        if (!record) return null;
        return record.bytes instanceof Uint8Array ? record.bytes.slice() : new Uint8Array(record.bytes);
      },
      async putBytes(url, path, data) {
        await put('bytes', {
          url, path, bytes: data.slice(), size: data.length, fetchedAt: Date.now()
        }, url);
      },
      async stats() {
        const records = await getAll('bytes');
        let bytes = 0;
        for (const record of records || []) bytes += record.size || (record.bytes ? record.bytes.length : 0);
        return { files: (records || []).length, bytes };
      },
      async clear() {
        const database = await db();
        await new Promise((resolve, reject) => {
          const tx = database.transaction(['index', 'bytes'], 'readwrite');
          tx.objectStore('index').clear();
          tx.objectStore('bytes').clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      }
    };
  }

  /* ---------------------------------------------------------- modland */

  const modland = MW.modland = {
    adapter: null,
    index: null,
    _loading: /** @type {Promise<any> | null} */ (null),

    init() {
      if (this.adapter) return this;
      try {
        this.adapter = typeof indexedDB !== 'undefined' ? createIdbAdapter() : createNoopAdapter();
      } catch (e) {
        this.adapter = createNoopAdapter();
      }
      return this;
    },

    use(adapter) {
      this.adapter = adapter || createNoopAdapter();
      this.index = null;
      return this;
    },

    async loadIndex(force) {
      if (this.index && !force) return this.index;
      if (this._loading) return this._loading;
      this._loading = (async () => {
        let text = '';
        let built = '';
        let fromNetwork = false;
        if (this.adapter) {
          try {
            const cached = await this.adapter.getIndex();
            if (cached && cached.text) { text = cached.text; built = cached.built || ''; }
          } catch (e) { /* fall through to the bundled file */ }
        }
        if (!text) {
          const response = await fetch(INDEX_URL, { cache: 'force-cache' });
          if (!response.ok) throw new Error('could not load the Modland index (HTTP ' + response.status + ')');
          text = await response.text();
          fromNetwork = true;
        }
        const parsed = parseIndex(text);
        if (!parsed.entries.length) throw new Error('the Modland index is empty');
        if (fromNetwork && this.adapter) {
          try { await this.adapter.putIndex(text, parsed.built || built); } catch (e) { /* cache is optional */ }
        }
        const composers = new Set(parsed.entries.map(entry => entry.folder.split('/')[0])).size;
        this.index = {
          built: parsed.built || built,
          entries: parsed.entries,
          tree: buildTree(parsed.entries),
          composers,
          count: parsed.entries.length
        };
        return this.index;
      })();
      try {
        return await this._loading;
      } finally {
        this._loading = null;
      }
    },

    describe() {
      if (!this.index) return 'Modland';
      const parts = [this.index.count.toLocaleString() + ' modules',
        this.index.composers + ' composers'];
      if (this.index.built) parts.push(this.index.built);
      return parts.join(' · ');
    },

    list(path) {
      if (!this.index) return [];
      const node = nodeAt(this.index.tree, path || '');
      if (!node) return [];
      const folders = [...node.folders.values()]
        .map(child => remoteEntry(child, true))
        .sort(byName);
      const files = node.files
        .map(entry => remoteEntry(entry, false))
        .sort(byName);
      return folders.concat(files);
    },

    search(query, limit) {
      if (!this.index) return [];
      const needle = String(query == null ? '' : query).trim().toLowerCase();
      if (!needle) return [];
      const max = Math.max(1, limit || 200);
      const out = [];
      for (const entry of this.index.entries) {
        if (!entry.path.toLowerCase().includes(needle)) continue;
        out.push(remoteEntry(entry, false));
        if (out.length >= max) break;
      }
      return out;
    },

    urlFor,

    async fetch(entry) {
      const path = typeof entry === 'string' ? entry : entry && entry.path;
      const url = urlFor(path);
      if (this.adapter) {
        try {
          const cached = await this.adapter.getBytes(url);
          if (cached) return { bytes: cached, cached: true };
        } catch (e) { /* fall through to the network */ }
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT) : 0;
      let lastError = null;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const length = Number(response.headers.get('content-length') || 0);
            if (length > MAX_BYTES) throw new Error('that module is too large to download');
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length > MAX_BYTES) throw new Error('that module is too large to download');
            const song = MW.loadModule(bytes.slice().buffer);
            if (!song) throw new Error('not a module Octanaut can read');
            if (this.adapter) {
              try { await this.adapter.putBytes(url, path, bytes); } catch (e) { /* cache is optional */ }
            }
            return { bytes, cached: false, song };
          } catch (err) {
            const error = /** @type {any} */ (err);
            lastError = error;
            /* A timeout, a 4xx, or a file the loader rejects will not
               improve on a retry. */
            if (error && (error.name === 'AbortError' ||
              /^HTTP 4/.test(error.message) ||
              /not a module|too large/.test(error.message))) break;
          }
        }
        throw lastError || new Error('download failed');
      } finally {
        if (timer) clearTimeout(timer);
      }
    },

    async cached(entry) {
      if (!this.adapter) return false;
      try {
        return !!(await this.adapter.getBytes(urlFor(typeof entry === 'string' ? entry : entry.path)));
      } catch (e) {
        return false;
      }
    },

    async cacheInfo() {
      if (!this.adapter) return { files: 0, bytes: 0 };
      try { return await this.adapter.stats(); } catch (e) { return { files: 0, bytes: 0 }; }
    },

    async clearCache() {
      if (this.adapter) await this.adapter.clear();
    }
  };

  MW.modlandParseIndex = parseIndex;
  MW.modlandBuildTree = buildTree;
  MW.modland.memoryAdapter = createMemoryAdapter;
  MW.modland.idbAdapter = createIdbAdapter;
  MW.modland.noopAdapter = createNoopAdapter;

})(typeof globalThis !== 'undefined' ? globalThis : this);
