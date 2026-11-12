const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

function fixture() {
  // Independent IFF fixture: 20-byte VHDR followed by four signed PCM bytes.
  const b = Buffer.alloc(52);
  b.write('FORM'); b.writeUInt32BE(44, 4); b.write('8SVXVHDR', 8);
  b.writeUInt32BE(20, 16); b.writeUInt32BE(4, 20);
  b.writeUInt16BE(8363, 32); b[34] = 1; b.writeUInt32BE(32768, 36);
  b.write('BODY', 40); b.writeUInt32BE(4, 44);
  b.set([0, 64, 128, 255], 48);
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

test('8SVX rejects truncated headers and unsupported compression', () => {
  const mw = runtime(['loaders']);
  assert.throws(() => mw.loadInstrument(fixture().slice(0, 37)), /truncat|invalid/i);
  const b = fixture(); new Uint8Array(b)[35] = 1;
  assert.throws(() => mw.loadInstrument(b), /compress/i);
});
