const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');
const { indexedDB } = require('fake-indexeddb');

function setup(globals) {
  const mw = runtime(['storage'], globals);
  const song = mw.createSong();
  song.name = 'sketch';
  song.channels = 8;
  song.blocks.push(mw.createBlock(8, 64));
  song.playseq = [0, 1];
  song.blocks[0].rows[0][0] = { note: 13, ins: 1, cmd: 0x0c, dat: 0x20 };
  const inst = mw.createInstrument('sample');
  inst.name = 'bass';
  inst.data = new Float32Array([0.25, -0.5, 0.75]);
  song.instruments[0] = inst;
  const app = {
    song,
    songList: [song],
    songIndex: 0,
    cursor: { block: 0, line: 3, track: 1, field: 2, seq: 0 },
    currentIns: 1,
    octave: 2,
    saveFormat: 'mmd1',
    mutedTracks: new Array(16).fill(false)
  };
  return { mw, app, song, inst };
}

test('a snapshot round-trips the song, samples and editor state', () => {
  const { mw, app } = setup();
  const snap = mw.storageSnapshot(app);
  assert.equal(snap.v, 1);
  assert.equal(snap.name, 'sketch');

  const back = mw.storageRevive(snap);
  assert.equal(back.songList[0].name, 'sketch');
  assert.equal(back.songList[0].blocks.length, 2);
  assert.deepEqual(Array.from(back.songList[0].playseq), [0, 1]);
  assert.equal(back.songList[0].blocks[0].rows[0][0].note, 13);
  assert.equal(back.songList[0].blocks[0].rows[0][0].cmd, 0x0c);
  assert.equal(back.songList[0].instruments[0].data.length, 3);
  assert.equal(back.songList[0].instruments[0].data[1], -0.5);
  assert.equal(back.cursor.line, 3);
  assert.equal(back.currentIns, 1);
  assert.equal(back.workspace.octave, 2);
  assert.equal(back.workspace.saveFormat, 'mmd1');
});

test('the snapshot is a copy, not a live view', () => {
  const { mw, app, song } = setup();
  const snap = mw.storageSnapshot(app);
  song.name = 'changed';
  song.instruments[0].data[0] = 99;
  song.blocks[0].rows[0][0].note = 40;
  assert.equal(snap.songList[0].name, 'sketch');
  assert.equal(snap.songList[0].instruments[0].data[0], 0.25);
  assert.equal(snap.songList[0].blocks[0].rows[0][0].note, 13);
});

test('engine caches are stripped before storage', () => {
  const { mw, app, inst } = setup();
  Object.assign(inst, {
    _abuf: { fake: true },
    _abufKey: 'sample',
    _synthBuf: { fake: true },
    _synthKey: 'synth',
    _view: { a: 0, b: 3 },
    _undo: { data: new Float32Array(3) },
    synth: { waveforms: [new Float32Array(2)], _undo: { waves: [] } }
  });
  const got = mw.storageSnapshot(app).songList[0].instruments[0];
  for (const key of ['_abuf', '_abufKey', '_synthBuf', '_synthKey', '_view', '_undo']) {
    assert.equal(got[key], undefined, key + ' should be stripped');
  }
  assert.equal(got.synth._undo, undefined);
  assert.deepEqual(Array.from(got.data), [0.25, -0.5, 0.75]);
});

test('multis share the root instruments and stay addressable by index', () => {
  const { mw, app, song } = setup();
  const multi = mw.createSong();
  multi.name = 'second';
  multi.instruments = song.instruments;
  song.multis = [multi];
  app.songList = [song, multi];
  app.song = multi;
  app.songIndex = 1;

  const snap = mw.storageSnapshot(app);
  assert.equal(snap.songIndex, 1);
  assert.equal(snap.songList.length, 2);
  assert.equal(snap.songList[1].instruments, snap.songList[0].instruments);
  assert.equal(snap.songList[0].multis[0], snap.songList[1]);

  const back = mw.storageRevive(snap);
  assert.equal(back.songIndex, 1);
  assert.equal(back.songList[1].instruments, back.songList[0].instruments);
  assert.equal(back.songList[0].multis[0], back.songList[1]);
});

test('revive rejects a missing, newer or damaged snapshot', () => {
  const { mw, app } = setup();
  const good = mw.storageSnapshot(app);
  assert.equal(mw.storageRevive(null), null);
  assert.equal(mw.storageRevive({ ...good, v: 99 }), null);
  assert.equal(mw.storageRevive({ ...good, songList: [] }), null);
  assert.equal(mw.storageRevive({ ...good, songList: [{ blocks: [] }] }), null);
  assert.equal(mw.storageRevive({ ...good, songList: [{ blocks: [{}] }] }), null);
});

test('the memory adapter writes alternating slots and falls back to the last good one', async () => {
  const { mw, app } = setup();
  mw.app = app;
  mw.storage.init();
  mw.storage.use(mw.storage.memoryAdapter());

  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);
  assert.equal(mw.storage.state, 'saved');
  const first = mw.storage.adapter.data.meta.slot;

  app.song.name = 'second version';
  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);
  const second = mw.storage.adapter.data.meta.slot;
  assert.notEqual(first, second);

  /* A crash between the slot write and the pointer flip, or a corrupt slot,
     must leave the previous snapshot reachable. */
  mw.storage.adapter.data[second] = null;
  const found = await mw.storage.adapter.load();
  assert.ok(found);
  assert.equal(found.snapshot.songList[0].name, 'sketch');
});

test('restore returns the saved snapshot and clear removes it', async () => {
  const { mw, app } = setup();
  mw.app = app;
  mw.storage.init();
  mw.storage.use(mw.storage.memoryAdapter());
  assert.equal(await mw.storage.restore(), null);

  mw.storage.schedule();
  await mw.storage.saveNow();
  const restored = await mw.storage.restore();
  assert.equal(restored.songList[0].name, 'sketch');
  assert.equal(mw.storage.state, 'saved');

  await mw.storage.clear();
  assert.equal(await mw.storage.adapter.load(), null);
  assert.equal(mw.storage.savedAt, 0);
});

test('saveNow does nothing when the song has not changed', async () => {
  const { mw, app } = setup();
  mw.app = app;
  mw.storage.init();
  mw.storage.use(mw.storage.memoryAdapter());
  assert.equal(await mw.storage.saveNow(), false);

  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);
  assert.equal(await mw.storage.saveNow(), false);
});

test('a full browser storage stops the autosave loop until it is cleared', async () => {
  const { mw, app } = setup();
  mw.app = app;
  const full = new Error('no room');
  full.name = 'QuotaExceededError';
  mw.storage.init();
  mw.storage.use({
    async load() { return null; },
    async store() { throw full; },
    async clear() {}
  });

  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), false);
  assert.equal(mw.storage.state, 'quota');
  assert.equal(mw.storage._quota, true);

  const revision = mw.storage._rev;
  mw.storage.schedule();
  assert.equal(mw.storage._rev, revision, 'schedule must stay quiet after a quota error');

  await mw.storage.clear();
  assert.equal(mw.storage._quota, false);
});

test('a tab without the save lock does not write', async () => {
  const { mw, app } = setup();
  mw.app = app;
  mw.storage.init();
  mw.storage.use(mw.storage.memoryAdapter());

  mw.storage.leader = false;
  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), false);
  assert.equal(await mw.storage.adapter.load(), null);

  mw.storage.leader = true;
  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);
});

/* The browser path: the same contract against a real IndexedDB
   implementation, including the pointer flip and the corrupt-slot fallback. */
function idbRequest(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('octanaut');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(store, mode);
      const done = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(done && done.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

test('the IndexedDB adapter saves, restores and falls back to the other slot', async () => {
  const { mw, app } = setup({ indexedDB });
  mw.app = app;
  mw.storage.init();
  assert.equal(mw.storage.available, true);
  await mw.storage.clear();

  assert.equal(await mw.storage.restore(), null);
  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);

  const first = await idbRequest('meta', 'readonly', store => store.get('current'));
  assert.equal(first.slot, 'a');
  const restored = await mw.storage.restore();
  assert.equal(restored.songList[0].name, 'sketch');

  app.song.name = 'second version';
  mw.storage.schedule();
  assert.equal(await mw.storage.saveNow(), true);
  const second = await idbRequest('meta', 'readonly', store => store.get('current'));
  assert.equal(second.slot, 'b');

  /* Lose the slot the pointer names; the previous save must still load. */
  await idbRequest('snapshots', 'readwrite', store => store.delete('b'));
  const fallback = await mw.storage.restore();
  assert.ok(fallback);
  assert.equal(fallback.songList[0].name, 'sketch');

  await mw.storage.clear();
  assert.equal(await mw.storage.restore(), null);
});
