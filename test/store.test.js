/* Tests for the Octanaut state store.
 *
 *   node --test test/store.test.js
 *
 * The store is the notification layer between the app's state and the
 * panels that display it. These tests cover the contract the panels rely
 * on: patches, change reporting, subscriptions and explicit commits for
 * in-place edits.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore } = require('../web/js/store.js');

test('get returns the whole state or one key', () => {
  const store = createStore({ a: 1, b: 2 });
  assert.equal(store.get('a'), 1);
  assert.deepEqual(store.get(), { a: 1, b: 2 });
});

test('set merges a patch and reports the changed keys', () => {
  const store = createStore({ a: 1, b: 2 });
  const changed = store.set({ a: 10, c: 3 }, 'edit');
  assert.deepEqual(changed, ['a', 'c']);
  assert.deepEqual(store.get(), { a: 10, b: 2, c: 3 });
});

test('set does not notify when every value is unchanged', () => {
  const store = createStore({ a: 1, b: 2 });
  let calls = 0;
  store.subscribe('a', () => { calls += 1; });
  const changed = store.set({ a: 1 }, 'noop');
  assert.deepEqual(changed, []);
  assert.equal(calls, 0);
});

test('set notifies a keyed subscriber with the key, reason and state', () => {
  const store = createStore({ a: 1, b: 2 });
  const seen = [];
  store.subscribe('a', e => seen.push(e));
  store.set({ a: 7 }, 'tempo');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].key, 'a');
  assert.equal(seen[0].reason, 'tempo');
  assert.equal(seen[0].state.a, 7);
  assert.deepEqual(seen[0].changed, ['a']);
});

test('a subscriber can listen to several keys', () => {
  const store = createStore({ a: 1, b: 2, c: 3 });
  const seen = [];
  store.subscribe(['a', 'b'], e => seen.push(e.key));
  store.set({ a: 10, b: 20, c: 30 }, 'edit');
  assert.deepEqual(seen, ['a', 'b']);
});

test('the wildcard subscriber sees every changed key', () => {
  const store = createStore({ a: 1, b: 2 });
  const seen = [];
  store.subscribe('*', e => seen.push(e.key));
  store.set({ a: 10, b: 20 }, 'edit');
  assert.deepEqual(seen, ['a', 'b']);
});

test('unsubscribe stops notifications', () => {
  const store = createStore({ a: 1 });
  let calls = 0;
  const off = store.subscribe('a', () => { calls += 1; });
  store.set({ a: 2 }, 'edit');
  off();
  store.set({ a: 3 }, 'edit');
  assert.equal(calls, 1);
});

test('one key removal does not disturb another subscription', () => {
  const store = createStore({ a: 1 });
  let first = 0, second = 0;
  const offFirst = store.subscribe('a', () => { first += 1; });
  store.subscribe('a', () => { second += 1; });
  offFirst();
  store.set({ a: 2 }, 'edit');
  assert.equal(first, 0);
  assert.equal(second, 1);
});

test('commit notifies after an in-place edit', () => {
  const store = createStore({ cursor: { line: 0 } });
  const seen = [];
  store.subscribe('cursor', e => seen.push(e.state.cursor.line));
  store.get('cursor').line = 12;
  assert.equal(seen.length, 0);
  store.commit('cursor', 'cursor');
  assert.deepEqual(seen, [12]);
});

test('commit with no keys notifies every key in the state', () => {
  const store = createStore({ a: 1, b: 2 });
  const seen = [];
  store.subscribe('*', e => seen.push(e.key));
  store.commit(undefined, 'refresh');
  assert.deepEqual(seen, ['a', 'b']);
});

test('a listener may unsubscribe during notification', () => {
  const store = createStore({ a: 1 });
  const seen = [];
  const off = store.subscribe('a', () => {
    seen.push('first');
    off();
  });
  store.subscribe('a', () => seen.push('second'));
  store.set({ a: 2 }, 'edit');
  store.set({ a: 3 }, 'edit');
  assert.deepEqual(seen, ['first', 'second', 'second']);
});
