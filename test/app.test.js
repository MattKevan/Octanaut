const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');
const setup = () => runtime(['sample-import', 'store', 'engine', 'synth', 'writer', 'app']);

test('join remaps removed and subsequent block references', () => {
  const mw = setup(); const s = mw.app.song;
  s.blocks = [mw.createBlock(4, 2), mw.createBlock(4, 3), mw.createBlock(4, 2)];
  s.playseq = [0, 1, 2, 1];
  s.blocks[1].rows[2][0].note = 25;
  mw.ops.joinBlock();
  assert.deepEqual(Array.from(s.playseq), [0, 0, 1, 0]);
  assert.equal(s.blocks[0].rows[4][0].note, 25);
  mw.app.cursor.block = 0; mw.ops.joinBlock();
  assert.ok(s.playseq.every(n => s.blocks[n]));
});

for (const action of ['file-new', 'misc-clear-all']) {
  test(`${action} replaces all songs and clears selection`, () => {
    const mw = setup(); const a = mw.app;
    a.songList = [a.song, mw.createSong()]; a.songIndex = 1;
    a.song = a.songList[1]; a.selection = { l0: 1, l1: 9, t0: 0, t1: 2 };
    a.mutedTracks[0] = true; a.selectedTracks[0] = true;
    mw.runAction(action);
    assert.equal(a.songList.length, 1);
    assert.equal(a.songList[0], a.song);
    assert.equal(a.songIndex, 0);
    assert.equal(a.selection, null);
    assert.ok(a.mutedTracks.every(v => !v));
    assert.equal(mw.player.song, a.song);
  });
}

for (const rate of [44100, 48000]) {
  test(`recording preserves capture rate ${rate} and clears old stereo/loop state`, async () => {
    const mw = setup();
    const i = mw.app.song.instruments[0] = mw.createInstrument();
    Object.assign(i, { data: new Float32Array(100), dataR: new Float32Array(100), loop: 50, looplen: 40 });
    const node = () => ({ connect() {}, disconnect() {}, gain: {} });
    const stream = { getTracks: () => [{ stop() {} }] };
    const ctx = { sampleRate: rate, destination: {}, createMediaStreamDestination: () => ({ stream }),
      createMediaStreamSource: node, createScriptProcessor: node, createGain: node };
    mw.audio.init = () => ctx; mw.audio.unlock = () => {}; mw.audio.limiter = node();
    mw.sampler.refreshDevices = async () => [];
    await mw.sampler.start('record', rate, 'app');
    mw.sampler.node.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(rate).fill(0.25) } });
    assert.equal(i.c2rate, rate);
    assert.equal(i.data.length / i.c2rate, 1);
    assert.equal(i.dataR, null);
    assert.equal(i.looplen, 0);
  });
}

test('instrument navigation clamps at the first and last slots', () => {
  const mw = setup();
  mw.setInstrument(0);
  assert.equal(mw.app.currentIns, 1);
  mw.setInstrument(2);
  assert.equal(mw.app.currentIns, 2);
  assert.equal(mw.app.lastIns, 1);
  mw.setInstrument(64);
  assert.equal(mw.app.currentIns, 63);
});

test('range paste uses cursor tracks unless selected-track paste is requested', () => {
  const mw = setup(); const app = mw.app; const b = app.song.blocks[0];
  b.rows[0][0].note = 25;
  app.selection = { l0: 0, l1: 0, t0: 0, t1: 0 };
  mw.ops.copyRange(false);
  app.cursor.line = 1; app.cursor.track = 1; app.selectedTracks[3] = true;
  mw.ops.pasteRange(false);
  assert.equal(b.rows[1][1].note, 25);
  assert.equal(b.rows[1][3].note, 0);
  app.cursor.line = 2;
  mw.ops.pasteRange(true);
  assert.equal(b.rows[2][3].note, 25);
});


test('loading a module replaces old sounds even when a merge confirmation would be accepted', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app'], { confirm: () => true });
  const old = mw.createInstrument(); old.name = 'old sound'; mw.app.song.instruments[0] = old;
  const incoming = mw.createSong(); const sound = mw.createInstrument(); sound.name = 'new sound'; incoming.instruments[0] = sound;
  mw.loadModule = () => incoming; mw.toast = () => {}; mw.emit = () => {};
  mw.openBuffer(new ArrayBuffer(1), 'new.mmd0');
  assert.equal(mw.app.song.instruments[0].name, 'new sound');
});

test('the bundled startup song contains both real synth and sample instruments', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const mw = runtime(['loaders']);
  const data = fs.readFileSync(path.join(__dirname, '../web/fixtures/maniac-beat.mmd1'));
  const song = mw.loadModule(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  assert.ok(song.blocks.length > 1);
  assert.ok(song.instruments.some(i => i && i.type === 'synth' && i.synth.waveforms.length));
  assert.ok(song.instruments.some(i => i && i.type === 'sample' && i.data && i.data.length));
});


test('example loading does not replace a song opened while the fixture is fetching', async () => {
  let respond;
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app'], { fetch: () => new Promise(resolve => { respond = resolve; }) });
  const incoming = mw.createSong(); const userSong = mw.createSong();
  mw.loadModule = () => incoming; mw.toast = () => {}; mw.emit = () => {};
  const pending = mw.loadExample(true);
  mw.app.song = userSong;
  respond({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  await pending;
  assert.equal(mw.app.song, userSong);
});

test('module loading does not warn about unused credit-only instrument slots', () => {
  const mw = setup(); const song = mw.createSong(); song.format = 'MMD1';
  const credit = mw.createInstrument(); credit.name = 'Copyright'; credit.missing = true;
  song.instruments[3] = credit;
  const messages = []; mw.loadModule = () => song; mw.toast = message => messages.push(message); mw.emit = () => {};
  mw.openBuffer(new ArrayBuffer(1), 'song.mmd1');
  assert.match(messages.at(-1), /^Loaded MMD/);
  assert.doesNotMatch(messages.at(-1), /external samples/);
});

test('loading a different song clears song-specific score settings', () => {
  const mw = setup(); const app = mw.app;
  app.notaPresets = [{ tracks: { 0: false }, ghost: { 1: true }, track: 1 }];
  app.notaPresetReady = true; app.notaSelectedTrack = 1;
  app.notaInstruments = { 1: { hide: true, transpose: 12 } };
  mw.runAction('file-new');
  assert.ok(!app.notaPresetReady);
  assert.equal(app.notaSelectedTrack, null);
  assert.deepEqual(Object.keys(app.notaInstruments || {}), []);
});

test('playback following redraws the notation measure and block', () => {
  const mw = setup();
  const draws = [];
  mw.app.song.blocks.push(mw.createBlock(4, 64));
  mw.app.follow = true;
  mw.displays.current = 'notation';
  mw.displays.refreshNotation = () => draws.push([mw.app.cursor.block, mw.app.cursor.line]);
  mw.followPlaybackRow({ block: 0, line: 17, seq: 0 });
  mw.followPlaybackRow({ block: 1, line: 3, seq: 1 });
  assert.deepEqual(draws, [[0, 17], [1, 3]]);
  mw.app.follow = false;
  mw.followPlaybackRow({ block: 0, line: 0, seq: 0 });
  assert.equal(draws.length, 2);
});

test('inserting a MIDI message selects the newly inserted message', () => {
  const mw = setup(); const a = mw.app;
  a.midiMessages = [{name:'first', data:[0xf0]}, {name:'second', data:[0xf7]}]; a.midiMsgIndex = 1;
  mw.runAction('midi-msg-insert');
  assert.equal(a.midiMsgIndex, 1);
  assert.equal(a.midiMessages[1].name, '');
  assert.equal(a.midiMessages[2].name, 'second');
});

test('module size grows with a second block', () => {
  const mw = setup();
  const before = mw.moduleBytes(mw.app.song);
  mw.app.song.blocks.push(mw.createBlock(4, 64));
  assert.ok(mw.moduleBytes(mw.app.song) > before);
});

test('the module size is reused until the song changes', () => {
  const mw = setup();
  mw.app._moduleBytes = 123;
  mw.refreshAll();
  assert.equal(mw.app._moduleBytes, null, 'a refresh invalidates the cached size');
});

test('Ctrl+Shift+digit picks into that key', () => {
  const mw = setup();
  const a = mw.app;
  a.cursor = { block: 0, line: 0, track: 0, field: 0 };
  a.song.blocks[0].rows[0][0] = { note: 30, ins: 2, cmd: 0, dat: 0 };
  mw.pickProgKey(5);
  assert.equal(a.progTarget, 5);
  assert.equal(a.prog[5].note, 30);
  assert.equal(a.prog[5].ins, 2);
});

test('an unset programmable key leaves the cell alone', () => {
  const mw = setup();
  const a = mw.app;
  a.cursor = { block: 0, line: 0, track: 0, field: 0 };
  a.song.blocks[0].rows[0][0] = { note: 30, ins: 2, cmd: 0x0c, dat: 0x40 };
  assert.equal(a.prog[0].note, null, 'definitions start transparent');
  mw.applyProgKey(0);
  assert.equal(a.song.blocks[0].rows[0][0].note, 30);
  assert.equal(a.song.blocks[0].rows[0][0].dat, 0x40);
});

test('shift-clicking the active volume base does not rewrite anything', () => {
  const mw = setup();
  const a = mw.app;
  a.song.flags.volhex = 1;
  a.song.blocks[0].rows[0][0] = { note: 1, ins: 1, cmd: 0x0c, dat: 0x28 };
  mw.setVolumeBase(1, true);
  assert.equal(a.song.blocks[0].rows[0][0].dat, 0x28);
});

test('the module size is encoded once after a change, not on every status update', () => {
  /* immediate timers so the deferred encode can be observed */
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app'], {
    setTimeout: (fn) => fn(),
    clearTimeout() {}
  });
  const a = mw.app;
  let calls = 0;
  const real = mw.moduleBytes;
  mw.moduleBytes = (...args) => { calls++; return real(...args); };
  a._moduleBytes = 99;
  a._modulePending = false;
  mw.touchStatus('play', ['song']);
  assert.equal(calls, 0, 'no encode while the cached size is valid');
  assert.equal(a._moduleBytes, 99);
  mw.refreshAll();
  assert.equal(calls, 1, 'the invalidated size is encoded once');
  assert.ok(a._moduleBytes > 0 && a._moduleBytes !== 99, 'the cache is replaced by the real size');
  mw.touchStatus('play', ['song']);
  assert.equal(calls, 1, 'playing does not re-encode it');
});


/* ---------------------------------------------------------- sample import */

function audioChunk(id, data) {
  const head = Buffer.alloc(8);
  head.write(id, 0, 'ascii');
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, data.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)]);
}

function audioWav(data, { channels = 1, bits = 16, rate = 44100 } = {}) {
  const block = channels * bits / 8;
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4); fmt.writeUInt32LE(rate * block, 8);
  fmt.writeUInt16LE(block, 12); fmt.writeUInt16LE(bits, 14);
  const body = Buffer.concat([Buffer.from('WAVE'), audioChunk('fmt ', fmt), audioChunk('data', data)]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  const out = Buffer.concat([head, body]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

const audio16 = (...v) => Buffer.from(new Int16Array(v).buffer);
const setupImport = () => runtime(['sample-import', 'loaders', 'store', 'engine', 'synth', 'writer', 'app']);

test('importInstrumentBuffer places a WAV in the current slot', async () => {
  const mw = setupImport();
  mw.app.currentIns = 3;
  const settings = { note: null, channel: 'mixed', stereo: false, loop: false, normalise: false };
  const result = await mw.importInstrumentBuffer(audioWav(audio16(0, 1000)), 'kick.wav', settings);
  const inst = mw.app.song.instruments[2];
  assert.equal(inst.name, 'kick');
  assert.equal(inst.c2rate, 44100);
  assert.equal(inst.data.length, 2);
  assert.equal(result.report.frames, 2);
});

test('importInstrumentBuffer trims and reports a long sample', async () => {
  const mw = setupImport();
  const data = Buffer.from(new Int16Array(140000).map((_, i) => i % 100).buffer);
  const result = await mw.importInstrumentBuffer(audioWav(data), 'long.wav', { note: null, loop: false });
  assert.equal(result.instrument.data.length, 131072);
  assert.equal(result.report.truncated, true);
});

test('a failed import leaves the old instrument alone', async () => {
  const mw = setupImport();
  const old = mw.app.song.instruments[0] = mw.createInstrument();
  old.data = new Float32Array([0.5]);
  const broken = audioWav(audio16(0)).slice(0, 14);
  const result = await mw.importInstrumentBuffer(broken, 'bad.wav', { note: null });
  assert.equal(result, null);
  assert.equal(mw.app.song.instruments[0], old);
});

test('recording is built through the sample converter', () => {
  const mw = setupImport();
  const i = mw.app.song.instruments[0] = mw.createInstrument();
  i.name = 'take 1';
  i.volume = 32;
  mw.sampler.buffer = new Float32Array(64).fill(1.5);
  mw.sampler.pos = 64;
  mw.sampler.sampleRate = 48000;
  mw.sampler.mode = 'record';
  mw.sampler.writing = true;
  mw.sampler.stop();
  assert.equal(i.name, 'take 1');
  assert.equal(i.volume, 32);
  assert.equal(i.c2rate, 48000);
  assert.equal(i.data.length, 64);
  assert.equal(i.data[0], 1);
  assert.equal(i.bits16, true);
});
