const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('library paths survive a round trip and drop unreadable folders', async () => {
  const mw = runtime(['library']);
  const rows = [];
  mw.libraryPaths.use({
    async load() { return rows.slice(); },
    async save(list) { rows.splice(0, rows.length, ...list); },
    async clear() { rows.length = 0; }
  });
  const good = { name: 'Samples', async queryPermission() { return 'granted'; } };
  const bad = { name: 'Old', async queryPermission() { return 'denied'; } };
  await mw.libraryPaths.add(good);
  await mw.libraryPaths.add(bad);
  assert.equal(mw.libraryPaths.list().length, 2);
  const restored = await mw.libraryPaths.restore();
  assert.equal(restored.map(d => d.name).join(','), 'Samples');
  assert.equal(rows.length, 1, 'the unreadable handle is dropped from storage');
});

test('removing a path updates both the list and the adapter', async () => {
  const mw = runtime(['library']);
  const rows = [];
  mw.libraryPaths.use({
    async load() { return rows.slice(); },
    async save(list) { rows.splice(0, rows.length, ...list); },
    async clear() { rows.length = 0; }
  });
  await mw.libraryPaths.add({ name: 'A' });
  await mw.libraryPaths.add({ name: 'B' });
  await mw.libraryPaths.remove(0);
  assert.equal(mw.libraryPaths.list().map(d => d.name).join(','), 'B');
  assert.equal(rows.map(d => d.name).join(','), 'B');
});

test('a folder that needs permission again is kept; a denied one is dropped', async () => {
  const mw = runtime(['library']);
  const rows = [];
  mw.libraryPaths.use({
    async load() { return rows.slice(); },
    async save(list) { rows.splice(0, rows.length, ...list); },
    async clear() { rows.length = 0; }
  });
  await mw.libraryPaths.add({ name: 'Needs grant', async queryPermission() { return 'prompt'; } });
  await mw.libraryPaths.add({ name: 'Denied', async queryPermission() { return 'denied'; } });
  const restored = await mw.libraryPaths.restore();
  assert.equal(restored.map(d => d.name).join(','), 'Needs grant');
  assert.equal(rows.length, 1, 'only the denied handle leaves storage');
});

test('clearing the library empties the adapter too', async () => {
  const mw = runtime(['library']);
  const rows = [];
  mw.libraryPaths.use({
    async load() { return rows.slice(); },
    async save(list) { rows.splice(0, rows.length, ...list); },
    async clear() { rows.length = 0; }
  });
  await mw.libraryPaths.add({ name: 'A' });
  await mw.libraryPaths.clear();
  assert.equal(mw.libraryPaths.list().length, 0);
  assert.equal(rows.length, 0);
});
