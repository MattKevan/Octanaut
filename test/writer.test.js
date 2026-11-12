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
