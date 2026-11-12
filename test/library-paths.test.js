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
