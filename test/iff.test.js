const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

function fixture({ octaves = 1, compression = 0, oneShot = 4, repeat = 0, volume = 32768, rate = 8363, body = [0, 64, 128, 255] } = {}) {
  const data = Buffer.from(body.map(v => v & 0xff));
  const total = 12 + 28 + 8 + data.length + (data.length & 1);
  const b = Buffer.alloc(total);
  b.write('FORM', 0); b.writeUInt32BE(total - 8, 4); b.write('8SVX', 8);
  b.write('VHDR', 12); b.writeUInt32BE(20, 16);
  b.writeUInt32BE(oneShot, 20); b.writeUInt32BE(repeat, 24);
  b.writeUInt32BE(0, 28);
  b.writeUInt16BE(rate, 32); b[34] = octaves; b[35] = compression;
  b.writeUInt32BE(volume, 36);
  b.write('BODY', 40); b.writeUInt32BE(data.length, 44);
  data.copy(b, 48);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test('8SVX reads standard rate, octave count, volume and PCM', () => {
  const mw = runtime(['loaders']);
  const i = mw.loadInstrument(fixture());
  assert.equal(i.c2rate, 8363);
  assert.equal(i.octaves, 1);
  assert.equal(i.volume, 32);
  assert.deepEqual(Array.from(i.data), [0, 0.5, -1, -1 / 128]);
});

for (const name of ['ab', 'abc']) for (const length of [3, 4]) {
  test(`8SVX writes correctly padded chunks: name ${name}, PCM ${length}`, () => {
    const mw = runtime(['loaders', 'writer']);
    const i = mw.createInstrument();
    Object.assign(i, { name, c2rate: 22050, volume: 32, loop: 0, looplen: 0,
      data: new Float32Array(length).fill(0.5) });
    const b = Buffer.from(mw.write8SVX(i));
    assert.equal(b.toString('ascii', 0, 4), 'FORM');
    assert.equal(b.readUInt32BE(4), b.length - 8);
    assert.equal(b.readUInt32BE(16), 20);
    assert.equal(b.readUInt16BE(32), 22050);
    assert.equal(b.readUInt32BE(36), 32768);
    let p = 12; const chunks = [];
    while (p < b.length) {
      const size = b.readUInt32BE(p + 4);
      chunks.push([b.toString('ascii', p, p + 4), size]);
      p += 8 + size + (size & 1);
    }
    assert.equal(p, b.length);
    assert.deepEqual(chunks, [['VHDR', 20], ['NAME', name.length + 1], ['BODY', length]]);
    const loaded = mw.loadInstrument(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
    assert.equal(loaded.name, name);
    assert.equal(loaded.data.length, length);
    assert.equal(loaded.c2rate, 22050);
    assert.equal(loaded.volume, 32);
  });
}

test('8SVX unpacks Fibonacci delta', () => {
  const mw = runtime(['loaders']);
  const i = mw.loadInstrument(fixture({ compression: 1, body: [0, 10, 0x97, 0xf0] }));
  assert.deepEqual(Array.from(i.data).map(v => Math.round(v * 128)), [11, 10, 31, -3]);
});

test('8SVX keeps the longest copy of a multi-octave sample', () => {
  const mw = runtime(['loaders']);
  const body = Array.from({ length: 14 }, (_, i) => i);
  const i = mw.loadInstrument(fixture({ octaves: 3, oneShot: 2, repeat: 0, body }));
  assert.equal(i.data.length, 8);
  assert.deepEqual(Array.from(i.data).map(v => Math.round(v * 128)), [6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(i.importWarning, '8SVX with 3 octaves kept as one');
  assert.equal(i.octaves, 1);
});

test('8SVX rejects truncated headers and unsupported compression', () => {
  const mw = runtime(['loaders']);
  assert.throws(() => mw.loadInstrument(fixture().slice(0, 37)), /truncat|invalid/i);
  assert.throws(() => mw.loadInstrument(fixture({ compression: 2 })), /packing/i);
});
