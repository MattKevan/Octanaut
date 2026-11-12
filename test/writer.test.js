const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

for (const version of [0, 1]) for (const rate of [4000, 8363, 22050, 44100, 48000]) {
  test(`MMD${version} retains sample duration and loop timing from ${rate} Hz`, () => {
    const mw = runtime(['loaders', 'writer']); const s = mw.createSong();
    const i = s.instruments[0] = mw.createInstrument();
    i.c2rate = rate; i.data = Float32Array.from({ length: rate }, (_, n) => Math.sin(n * 2 * Math.PI * 100 / rate));
    i.loop = Math.round(rate / 4); i.looplen = Math.round(rate / 2);
    const before = i.data.slice(); const start = i.loop; const length = i.looplen;
    const out = mw.loadModule(mw['writeMMD' + version](s)).instruments[0];
    assert.ok(Math.abs(out.data.length / out.c2rate - 1) < 0.001);
    assert.ok(Math.abs(out.loop / out.c2rate - 0.25) < 0.001);
    assert.ok(Math.abs(out.looplen / out.c2rate - 0.5) < 0.001);
    let crossings = 0;
    for (let n = 1; n < out.data.length; n++) if (out.data[n - 1] < 0 && out.data[n] >= 0) crossings++;
    assert.ok(crossings >= 99 && crossings <= 100, `100 Hz tone has ${crossings} crossings`);
    assert.deepEqual(i.data, before); assert.equal(i.c2rate, rate);
    assert.equal(i.loop, start); assert.equal(i.looplen, length);
  });
}

test('native export rejects resampled loops that exceed its 16-bit word fields', () => {
  const mw = runtime(['writer']); const s = mw.createSong();
  const i = s.instruments[0] = mw.createInstrument();
  Object.assign(i, { c2rate: 4000, data: new Float32Array(100000), loop: 70000, looplen: 10000 });
  for (const write of [mw.writeMMD0, mw.writeMMD1]) {
    assert.throws(() => write(s), /loop.*too large/i);
  }
});

test('MMD1 round-trips a 16-bit stereo sample', () => {
  const mw = runtime(['loaders', 'writer']);
  const s = mw.createSong();
  const i = s.instruments[0] = mw.createInstrument();
  Object.assign(i, { data: new Float32Array([1, 0.5, -1]), dataR: new Float32Array([-1, 0.5, 1]), bits16: true, stereo16: true });
  const out = mw.loadModule(mw.writeMMD1(s));
  assert.equal(out.instruments[0].bits16, true);
  assert.equal(out.instruments[0].stereo16, true);
  assert.ok(Math.abs(out.instruments[0].data[0] - 1) < 1e-4);
  assert.ok(Math.abs(out.instruments[0].dataR[0] + 1) < 1e-4);
});

test('MMD0 still writes 8-bit mono', () => {
  const mw = runtime(['loaders', 'writer']);
  const s = mw.createSong();
  const i = s.instruments[0] = mw.createInstrument();
  Object.assign(i, { data: new Float32Array([0.5]), dataR: new Float32Array([-0.5]), bits16: true, stereo16: true });
  const out = mw.loadModule(mw.writeMMD0(s));
  assert.equal(out.instruments[0].bits16, false);
  assert.equal(out.instruments[0].stereo16, false);
});

test('MMD1 keeps 16-bit loop points in frames', () => {
  const mw = runtime(['loaders', 'writer']);
  const s = mw.createSong();
  const i = s.instruments[0] = mw.createInstrument();
  Object.assign(i, { data: new Float32Array(16), loop: 8, looplen: 4, bits16: true });
  const out = mw.loadModule(mw.writeMMD1(s));
  assert.equal(out.instruments[0].loop, 8);
  assert.equal(out.instruments[0].looplen, 4);
});

test('WAV export keeps the sample rate, 16-bit depth and stereo', () => {
  const mw = runtime(['writer']);
  const i = mw.createInstrument();
  Object.assign(i, { c2rate: 22050, data: new Float32Array([0, 0.5, -1]), dataR: new Float32Array([0, -0.5, 1]) });
  const b = Buffer.from(mw.writeWav(i));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WAVE');
  assert.equal(b.readUInt16LE(22), 2);
  assert.equal(b.readUInt32LE(24), 22050);
  assert.equal(b.readUInt16LE(34), 16);
  assert.equal(b.readUInt32LE(40), 12);
  assert.equal(b.readInt16LE(44), 0);
  assert.equal(b.readInt16LE(46), 0);
  assert.equal(b.readInt16LE(48), 16384);
  assert.equal(b.readInt16LE(50), -16383);
});
