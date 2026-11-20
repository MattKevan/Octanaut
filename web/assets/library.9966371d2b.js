// @ts-check
/* Octanaut - persistent sample library folders
 *
 * The SLIST keeps its folder list here instead of in the workspace snapshot:
 * directory handles can come back after a reload without read permission, and
 * a snapshot that restores a broken path is worse than one that restores none.
 * `restore()` drops those, keeping only folders the browser still grants.
 *
 * The backend is swappable so headless tests can run against an array.
 *
 *   MW.libraryPaths.init()
 *   const folders = await MW.libraryPaths.restore()
 *   await MW.libraryPaths.add(handle)
 */
(function (global) {
  'use strict';

  const MW = global.MW = global.MW || {};

  const DB_NAME = 'octanaut-library';
  const DB_VERSION = 1;
  const STORE = 'paths';
  const KEY = 'folders';

  /* In-memory adapter: tests and environments without IndexedDB. */
  function createMemoryAdapter() {
    const rows = [];
    return {
      rows,
      async load() { return rows.slice(); },
      async save(list) { rows.splice(0, rows.length, ...list); },
      async clear() { rows.length = 0; }
    };
  }

  /* Browser adapter: one record holding the handle array. Directory handles
     are structured-cloneable, so IndexedDB stores them as they are. */
  function createIdbAdapter() {
    const open = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('the library database is blocked'));
    });
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result = null;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
        const request = fn(store);
        if (request) request.onsuccess = () => { result = request.result; };
      });
    };
    return {
      async load() {
        const value = await run('readonly', store => store.get(KEY));
        return Array.isArray(value) ? value.slice() : [];
      },
      async save(list) { await run('readwrite', store => store.put(list.slice(), KEY)); },
      async clear() { await run('readwrite', store => store.delete(KEY)); }
    };
  }

  const libraryPaths = MW.libraryPaths = {
    adapter: null,
    rows: [],

    init() {
      if (this.adapter) return this.adapter;
      this.adapter = typeof indexedDB !== 'undefined' ? createIdbAdapter() : createMemoryAdapter();
      return this.adapter;
    },

    /* Tests swap the backend; the app calls init(). */
    use(adapter) {
      this.adapter = adapter || null;
      this.rows = [];
      return this;
    },

    list() {
      return this.rows.slice();
    },

    /* Load the stored handles and keep only the folders still readable. */
    async restore() {
      if (!this.adapter) return [];
      let stored = [];
      try { stored = await this.adapter.load(); } catch (e) { stored = []; }
      const keep = [];
      for (const handle of stored) {
        if (!handle) continue;
        try {
          const permission = typeof handle.queryPermission === 'function'
            ? await handle.queryPermission({ mode: 'read' })
            : 'granted';
          /* 'prompt' is the normal state after a reload: the folder is still
             usable once the user clicks it and grants access again. Only a
             denied or unusable handle is dropped. */
          if (permission !== 'denied') keep.push(handle);
        } catch (e) { /* a handle that will not answer is not usable */ }
      }
      this.rows = keep;
      if (keep.length !== stored.length) {
        try { await this.adapter.save(keep); } catch (e) { /* best effort */ }
      }
      return keep.slice();
    },

    async add(handle) {
      if (!handle) return;
      this.rows.push(handle);
      if (this.adapter) await this.adapter.save(this.rows);
    },

    async remove(index) {
      if (index < 0 || index >= this.rows.length) return;
      this.rows.splice(index, 1);
      if (this.adapter) await this.adapter.save(this.rows);
    },

    async clear() {
      this.rows = [];
      if (this.adapter) await this.adapter.clear();
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
