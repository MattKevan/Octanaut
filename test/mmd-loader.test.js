const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

// A hand-authored MMDC, independent of the app's writer. Pattern packets
// below deliberately cross both cell and row boundaries.
function packedModule(packets, tracks = 2, lines = 2) {
  const block = 844;
  const b = Buffer.alloc(block + 2 + packets.length);
  b.write('MMDC'); b.writeUInt32BE(b.length, 4);
  b.writeUInt32BE(52, 8); b.writeUInt32BE(840, 16);
  b.writeUInt16BE(1, 52 + 504); b.writeUInt16BE(1, 52 + 506);
  b.writeUInt16BE(33, 52 + 764); b[52 + 769] = 6;
  b.fill(64, 52 + 770, 52 + 787);
  b.writeUInt32BE(block, 840); b[block] = tracks; b[block + 1] = lines - 1;
  b.set(packets, block + 2);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test('MMDC decodes mixed zero and literal runs across cells', () => {
  const mw = runtime(['loaders']);
  const s = mw.loadModule(packedModule([0, 13, 1, 0x1c, 0x40, 0xfd, 5, 25, 0x20, 0, 0, 0x0f, 6]));
  assert.ok(s, 'MMDC is recognized');
  assert.equal(s.format, 'MMDC');
  assert.equal(s.blocks[0].tracks, 2); assert.equal(s.blocks[0].lines, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(s.blocks[0].rows)), [
    [{ note: 13, ins: 1, cmd: 12, dat: 64 }, { note: 0, ins: 0, cmd: 0, dat: 0 }],
    [{ note: 25, ins: 2, cmd: 0, dat: 0 }, { note: 0, ins: 0, cmd: 15, dat: 6 }]
  ]);
});

test('MMDC supports 128-byte runs and zero padding at the pattern end', () => {
  const mw = runtime(['loaders']);
  const literals = new Array(128).fill(0); literals[0] = 13; literals[1] = 0x10;
  const s = mw.loadModule(packedModule([127, ...literals, 128, 128], 1, 128));
  assert.ok(s); assert.equal(s.blocks[0].rows[0][0].note, 13);
  assert.equal(s.blocks[0].rows[127][0].note, 0);
  assert.ok(mw.loadModule(packedModule([128], 1, 1)));
});

for (const packets of [[], [2, 13], [255]]) {
  test(`MMDC rejects truncated packed data ${JSON.stringify(packets)}`, () => {
    const mw = runtime(['loaders']);
    assert.throws(() => mw.loadModule(packedModule(packets)), /truncated.*MMDC/i);
  });
}

test('MMDC files are offered by the archive module picker', () => {
  const mw = runtime(['lha']);
  const entries = [{ name: 'song.mmdc', data: new Uint8Array(packedModule([128], 1, 1)) }];
  assert.equal(mw.lhaModules({ entries }).length, 1);
});

function editableModule(version = 0) {
  const mw = runtime(['loaders', 'writer']); const s = mw.createSong();
  s.name = 'test song'; s.annotation = 'test annotation';
  s.blocks[0].name = 'test block'; s.blocks[0].highlight[3] = 1;
  s.blocks[0].rows[2][0] = { note: 13, ins: 1, cmd: 12, dat: 32 };
  const inst = s.instruments[0] = mw.createInstrument();
  Object.assign(inst, { name: 'test sample', data: new Float32Array([0, 0.5, -0.5, 0]), hold: 4 });
  const buf = mw['writeMMD' + version](s);
  return { mw, buf, dv: new DataView(buf) };
}

for (const [name, change] of [
  ['instrument name pointer', (dv, e) => dv.setUint32(e + 20, 0x6831ee22)],
  ['instrument name entry crossing EOF', (dv, e) => { dv.setUint32(e + 20, dv.byteLength - 2); dv.setUint16(e + 26, 40); }],
  ['sample extension pointer', (dv, e) => dv.setUint32(e + 4, 0xfffffffe)],
  ['annotation pointer', (dv, e) => dv.setUint32(e + 12, 0xfffffffe)],
  ['song name pointer', (dv, e) => dv.setUint32(e + 44, 0xfffffffe)],
  ['expansion pointer', dv => dv.setUint32(32, 0xfffffffe)],
  ['truncated expansion', dv => dv.setUint32(32, dv.byteLength - 8)],
  ['invalid next-song pointer', (dv, e) => dv.setUint32(e, 0xfffffffe)]
]) {
  test(`MMD skips invalid optional ${name} and keeps notes and PCM`, () => {
    const { mw, buf, dv } = editableModule(1); change(dv, dv.getUint32(32));
    const s = mw.loadModule(buf);
    assert.equal(s.blocks[0].rows[2][0].note, 13);
    assert.equal(s.instruments[0].data.length, 4);
    assert.ok(s.instruments[0].data[1] > 0.49);
  });
}

test('MMD honors short name entry strides rather than reading into the next entry', () => {
  const { mw, buf, dv } = editableModule(); const e = dv.getUint32(32), ptr = dv.getUint32(e + 20);
  dv.setUint16(e + 24, 2); dv.setUint16(e + 26, 3);
  new Uint8Array(buf, ptr, 6).set([65, 66, 67, 68, 69, 70]);
  const s = mw.loadModule(buf);
  assert.equal(s.instruments[0].name, 'ABC'); assert.equal(s.instruments[1].name, 'DEF');
});

for (const field of [0, 4]) {
  test(`MMD1 skips invalid BlockInfo pointer field ${field}`, () => {
    const { mw, buf, dv } = editableModule(1);
    const block = dv.getUint32(dv.getUint32(16)), info = dv.getUint32(block + 4);
    dv.setUint32(info + field, 0xfffffffe);
    const s = mw.loadModule(buf);
    assert.equal(s.blocks[0].rows[2][0].note, 13);
    assert.equal(field === 0 ? s.blocks[0].name : s.blocks[0].highlight[3], field === 0 ? 'test block' : 1);
  });
}

test('MMD still rejects missing essential pattern bytes', () => {
  const { mw, buf, dv } = editableModule();
  dv.setUint32(dv.getUint32(16), dv.byteLength - 1);
  assert.throws(() => mw.loadModule(buf), /truncated.*MMD/i);
});

for (const [byte, ins] of [[0x80, 17], [0x40, 33]]) {
  test(`MMD0 and MMDC decode instrument ${ins} using the native bit order`, () => {
    const mw = runtime(['loaders']);
    const packed = packedModule([2, byte | 13, 0x10, 0], 1, 1);
    assert.equal(mw.loadModule(packed)?.blocks[0].rows[0][0].ins, ins);
    const plain = Buffer.from(packedModule([byte | 13, 0x10, 0], 1, 1)); plain.write('MMD0');
    assert.equal(mw.loadModule(plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.length)).blocks[0].rows[0][0].ins, ins);
  });
  test(`MMD0 exports instrument ${ins} with native bit order`, () => {
    const mw = runtime(['writer']); const s = mw.createSong();
    Object.assign(s.blocks[0].rows[0][0], { note: 13, ins });
    const dv = new DataView(mw.writeMMD0(s)); const block = dv.getUint32(dv.getUint32(16));
    assert.equal(dv.getUint8(block + 2), byte | 13);
  });
}
