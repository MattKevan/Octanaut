// @ts-check
/* Octanaut - small state store
 *
 * Keeps the shared application state in one object and notifies the panels
 * that display a given key. It is deliberately tiny: no proxies, no
 * framework, and no opinion about what the values mean.
 *
 *   const store = MW.createStore(state)
 *   store.set({ tempo: 33 }, 'tempo')    // patch + notify changed keys
 *   store.commit('cursor', 'cursor')     // notify after an in-place edit
 *   const off = store.subscribe(['cursor', 'song'], handler)
 *
 * A subscriber receives { key, state, reason, changed } and is called once
 * per changed key. Pass '*' to hear every key.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    const host = /** @type {any} */ (root);
    host.MW = host.MW || {};
    Object.assign(host.MW, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WILDCARD = '*';

  /**
   * @typedef {object} StoreEvent
   * @property {string} key
   * @property {Record<string, any>} state
   * @property {string} [reason]
   * @property {string[]} changed
   */

  /**
   * @param {Record<string, any>} [initial]
   */
  function createStore(initial) {
    const state = initial && typeof initial === 'object' ? initial : {};
    /** @type {Map<string, Set<(event: StoreEvent) => void>>} */
    const subs = new Map();

    /**
     * @param {string} key
     * @param {string | undefined} reason
     * @param {string[]} changed
     */
    function emit(key, reason, changed) {
      const event = { key, state, reason, changed };
      const direct = subs.get(key);
      if (direct) Array.from(direct).forEach(fn => fn(event));
      const all = key === WILDCARD ? null : subs.get(WILDCARD);
      if (all) Array.from(all).forEach(fn => fn(event));
    }

    return {
      state,

      /**
       * @param {string} [key]
       * @returns {any}
       */
      get(key) {
        return key == null ? state : state[key];
      },

      /* Shallow-merge a patch, assign only the values that actually
         differ, and notify once per changed key. Returns the keys. */
      /**
       * @param {Record<string, any>} patch
       * @param {string} [reason]
       * @returns {string[]}
       */
      set(patch, reason) {
        if (!patch || typeof patch !== 'object') return [];
        /** @type {string[]} */
        const changed = [];
        Object.keys(patch).forEach(key => {
          if (Object.is(state[key], patch[key])) return;
          state[key] = patch[key];
          changed.push(key);
        });
        changed.forEach(key => emit(key, reason, changed));
        return changed;
      },

      /* Notify without assigning. Use this after mutating a nested object
         in place, or to force a repaint. */
      /**
       * @param {string | string[]} [keys]
       * @param {string} [reason]
       * @returns {string[]}
       */
      commit(keys, reason) {
        const list = keys == null
          ? Object.keys(state)
          : (Array.isArray(keys) ? keys : [keys]);
        const changed = Array.from(new Set(list));
        changed.forEach(key => emit(key, reason, changed));
        return changed;
      },

      /**
       * @param {string | string[]} keys
       * @param {(event: StoreEvent) => void} fn
       * @returns {() => void}
       */
      subscribe(keys, fn) {
        if (typeof fn !== 'function') {
          throw new TypeError('store.subscribe needs a function');
        }
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach(key => {
          let set = subs.get(key);
          if (!set) {
            set = new Set();
            subs.set(key, set);
          }
          set.add(fn);
        });
        return function off() {
          list.forEach(key => {
            const set = subs.get(key);
            if (!set) return;
            set.delete(fn);
            if (!set.size) subs.delete(key);
          });
        };
      }
    };
  }

  return { createStore };
});
