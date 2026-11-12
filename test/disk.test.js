const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');
const { indexedDB } = require('fake-indexeddb');

function setup(globals) {
  const mw = runtime(['disk'], globals);
  mw.disk.use(mw.disk.memoryAdapter());
  return mw;
}

test('file names are flat and keep exactly one extension', () => {
  const mw = setup();
  assert.equal(mw.diskFileName('My Song', '.med'), 'My Song.med');
  assert.equal(mw.diskFileName('My Song.med', '.med'), 'My Song.med');
  assert.equal(mw.diskFileName('a/b', '.mmd0'), 'a_b.mmd0');
  assert.equal(mw.diskFileName('', '.mod'), 'untitled.mod');
  assert.equal(mw.diskSafeName('../evil/song'), '_evil_song');
  assert.equal(mw.diskSafeName('   '), 'untitled');
  assert.equal(mw.diskSafeName('x'.repeat(80)).length, 64);
});

test('DF0 stores, lists, reads and removes real bytes', async () => {
  const mw = setup();
  await mw.disk.write('DF0:', 'Song.med', new Uint8Array([1, 2, 3]), '.med');
  await mw.disk.write('DF0:', 'Other.mod', new Uint8Array([4]), '.mod');

  const list = await mw.disk.list('DF0:');
  assert.deepEqual(Array.from(list, file => file.name), ['Other.mod', 'Song.med']);
  assert.equal(list[1].size, 3);
  assert.equal(list[1].dir, false);
  assert.equal(list[1].volume, 'DF0:');

  assert.deepEqual(Array.from(await mw.disk.read('DF0:', 'Song.med')), [1, 2, 3]);
  assert.equal(await mw.disk.read('DF0:', 'missing.med'), null);

  assert.equal(await mw.disk.remove('DF0:', 'Other.mod'), true);
  assert.deepEqual(Array.from(await mw.disk.list('DF0:'), file => file.name), ['Song.med']);
});

test('writing the same name overwrites instead of duplicating', async () => {
  const mw = setup();
  await mw.disk.write('DF0:', 'song.med', new Uint8Array([1]), '.med');
  await mw.disk.write('DF0:', 'song.med', new Uint8Array([9, 8]), '.med');
  const list = await mw.disk.list('DF0:');
  assert.equal(list.length, 1);
  assert.deepEqual(Array.from(await mw.disk.read('DF0:', 'song.med')), [9, 8]);
});

test('clear empties the volume and usage reports the totals', async () => {
  const mw = setup();
  await mw.disk.write('DF0:', 'a.med', new Uint8Array(10), '.med');
  await mw.disk.write('DF0:', 'b.med', new Uint8Array(5), '.med');
  assert.deepEqual({ ...(await mw.disk.usage()) }, { files: 2, bytes: 15 });
  await mw.disk.clear('DF0:');
  assert.deepEqual({ ...(await mw.disk.usage()) }, { files: 0, bytes: 0 });
});

test('the IndexedDB adapter round-trips through a real database', async () => {
  const mw = runtime(['disk'], { indexedDB });
  mw.disk.init();
  assert.equal(mw.disk.available, true);
  await mw.disk.clear();

  await mw.disk.write('DF0:', 'song.med', new Uint8Array([7, 6, 5]), '.med');
  const list = await mw.disk.list('DF0:');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'song.med');
  assert.deepEqual(Array.from(await mw.disk.read('DF0:', 'song.med')), [7, 6, 5]);

  await mw.disk.write('DF0:', 'song.med', new Uint8Array([1]), '.med');
  assert.equal((await mw.disk.list('DF0:')).length, 1);
  assert.deepEqual(Array.from(await mw.disk.read('DF0:', 'song.med')), [1]);

  await mw.disk.remove('DF0:', 'song.med');
  assert.equal((await mw.disk.list('DF0:')).length, 0);
});
