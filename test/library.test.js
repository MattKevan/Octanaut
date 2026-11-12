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

function fakeDir() {
  const files = new Map();
  return {
    files,
    async getFileHandle(name) {
      return { async createWritable() {
        return {
          async write(bytes) { files.set(name, Uint8Array.from(new Uint8Array(bytes))); },
          async close() {}
        };
      } };
    }
  };
}

test('an instrument is written as an IFF 8SVX file', async () => {
  const mw = runtime(['writer', 'ui-displays']);
  const dir = fakeDir();
  const inst = { name: 'Snare', type: 'sample', data: Float32Array.from([0, 0.5]), c2rate: 8363 };
  const bytes = await mw.writeInstrumentFile(dir, '02 Snare.8svx', inst);
  assert.ok(bytes > 0);
  const head = new TextDecoder().decode(dir.files.get('02 Snare.8svx').slice(0, 4));
  assert.equal(head, 'FORM');
});

test('SAVE ALL skips empty slots and continues after a failure', async () => {
  const mw = runtime(['writer', 'ui-displays']);
  const dir = fakeDir();
  let calls = 0;
  const real = dir.getFileHandle;
  dir.getFileHandle = async (name, opts) => {
    calls++;
    if (calls === 1) throw new Error('disk full');
    return real(name, opts);
  };
  const song = mw.createSong();
  song.instruments[0] = { name: 'A', type: 'sample', data: new Float32Array(4), c2rate: 8363 };
  song.instruments[1] = { name: 'B', type: 'sample', data: new Float32Array(4), c2rate: 8363 };
  const result = await mw.saveAllInstruments(dir, song);
  assert.equal(result.failed, 1);
  assert.equal(result.saved, 1);
});

test('deleting a library file removes it and reports a missing one', async () => {
  const mw = runtime(['ui-displays']);
  const removed = [];
  const dir = { async removeEntry(name) { removed.push(name); } };
  assert.equal(await mw.removeLibraryFile(dir, 'a.msh'), true);
  assert.equal(removed.join(','), 'a.msh');
  const missing = { async removeEntry() { throw new Error('not found'); } };
  assert.equal(await mw.removeLibraryFile(missing, 'gone.msh'), false);
});
