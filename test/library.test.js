const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('library lists playable instrument files and ignores unrelated files', async () => {
  const mw = runtime(['ui-displays']);
  const dir = { async *entries() { for (const name of ['notes.txt', 'b.8svx', 'a.msh', 'drums.raw']) yield [name, { kind: 'file', name }]; } };
  const entries = await mw.listLibraryEntries(dir);
  assert.deepEqual(Array.from(entries, e => e.name), ['a.msh', 'b.8svx', 'drums.raw']);
});

test('instrument file names carry the slot number and one extension', () => {
  const mw = runtime([]);
  assert.equal(mw.instFileName({ name: 'Bass Drum' }, 1), '01 Bass Drum.8svx');
  assert.equal(mw.instFileName({ name: 'Bass.8svx' }, 1), '01 Bass.8svx');
  assert.equal(mw.instFileName({ name: 'a/b:c' }, 15), '0F a_b_c.8svx');
  assert.equal(mw.instFileName({}, 31), '0V sample.8svx');
  /* two slots with the same name still get different files */
  assert.notEqual(mw.instFileName({ name: 'Bass' }, 1), mw.instFileName({ name: 'Bass' }, 2));
});

test('the save list skips empty slots and instruments without sample data', () => {
  const mw = runtime([]);
  const song = mw.createSong();
  song.instruments[0] = mw.createInstrument('sample');
  song.instruments[0].name = 'One';
  song.instruments[0].data = new Float32Array(8);
  song.instruments[2] = mw.createInstrument('synth');
  song.instruments[2].name = 'Synth';
  const list = mw.instrumentSaveList(song);
  assert.equal(list.map(e => e.index).join(','), '1');
  assert.equal(list[0].name, '01 One.8svx');
});
