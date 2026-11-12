const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('library lists playable instrument files and ignores unrelated files', async () => {
  const mw = runtime(['ui-displays']);
  const dir = { async *entries() { for (const name of ['notes.txt', 'b.8svx', 'a.msh', 'drums.raw']) yield [name, { kind: 'file', name }]; } };
  const entries = await mw.listLibraryEntries(dir);
  assert.deepEqual(Array.from(entries, e => e.name), ['a.msh', 'b.8svx', 'drums.raw']);
});
