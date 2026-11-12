const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

function chunk(id, data) {
  const head = Buffer.alloc(8);
  head.write(id, 0, 'ascii');
  head.writeUInt32LE(data.length, 4);
  const pad = data.length & 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([head, data, pad]);
}

function wav({ format = 1, channels = 1, bits = 16, rate = 44100, data = Buffer.alloc(4), subFormat, extra = [] } = {}) {
  const block = channels * bits / 8;
  const fmt = Buffer.alloc(format === 0xfffe ? 40 : 16);
  fmt.writeUInt16LE(format, 0); fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4); fmt.writeUInt32LE(rate * block, 8);
  fmt.writeUInt16LE(block, 12); fmt.writeUInt16LE(bits, 14);
  if (format === 0xfffe) {
    fmt.writeUInt16LE(22, 16); fmt.writeUInt16LE(bits, 18);
    fmt.writeUInt32LE(0, 20); fmt.writeUInt16LE(subFormat || 1, 24);
  }
  const body = Buffer.concat([Buffer.from('WAVE'), chunk('fmt ', fmt), ...extra, chunk('data', data)]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  const out = Buffer.concat([head, body]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

test('sniff reads a WAV by its header, not its name', () => {
  const mw = runtime(['sample-import']);
  const meta = mw.sampleImport.sniff(new Uint8Array(wav({ rate: 22050, channels: 2 })));
  assert.equal(meta.format, 'wav');
  assert.equal(meta.rate, 22050);
  assert.equal(meta.channels, 2);
  assert.equal(meta.bits, 16);
  assert.equal(meta.asks, true);
  assert.equal(meta.compressed, false);
});

test('sniff keeps 8SVX and MSH out of the dialog', () => {
  const mw = runtime(['sample-import']);
  const iff = Buffer.from('FORM\0\0\0\x04' + '8SVX');
  assert.equal(mw.sampleImport.sniff(new Uint8Array(iff)).asks, false);
  const msh = Buffer.from('MSH\0');
  assert.equal(mw.sampleImport.sniff(new Uint8Array(msh)).asks, false);
});

test('sniff falls back to raw signed 8-bit at 8363', () => {
  const mw = runtime(['sample-import']);
  const meta = mw.sampleImport.sniff(new Uint8Array([1, 2, 3]));
  assert.equal(meta.format, 'raw');
  assert.equal(meta.rate, 8363);
  assert.equal(meta.bits, 8);
  assert.equal(meta.asks, false);
});

test('detectFile separates a song, an instrument and an archive', () => {
  const mw = runtime(['sample-import', 'loaders', 'lha', 'writer']);
  const song = mw.writeMMD1(mw.createSong());
  assert.equal(mw.detectFile(song), 'song');
  assert.equal(mw.detectFile(wav()), 'instrument');
  const archive = Buffer.alloc(24);
  archive.write('-lh0-', 2);
  assert.equal(mw.detectFile(archive.buffer), 'archive');
});

test('the archive lists modules and samples apart', () => {
  const mw = runtime(['lha']);
  const entries = [{ name: 'song.mmd0' }, { name: 'kick.wav' }, { name: 'pad.8svx' }, { name: 'notes.txt' }];
  assert.deepEqual(mw.lhaModules({ entries }).map(e => e.name), ['song.mmd0']);
  assert.deepEqual(mw.lhaInstruments({ entries }).map(e => e.name), ['kick.wav', 'pad.8svx']);
});

const read = (buffer, max) => runtime(['sample-import']).sampleImport.readWav(buffer, max);
const pcm16 = (...v) => Buffer.from(new Int16Array(v).buffer);
const f32 = (...v) => Buffer.from(new Float32Array(v).buffer);

test('WAV decodes 16-bit mono and normalises by 32768', () => {
  const d = read(wav({ data: pcm16(0, 32767, -32768) }));
  assert.equal(d.rate, 44100);
  assert.equal(d.bits, 16);
  assert.equal(d.channels.length, 1);
  assert.deepEqual(Array.from(d.channels[0]), [0, 32767 / 32768, -1]);
});

test('WAV decodes 8-bit unsigned with 128 as silence', () => {
  const d = read(wav({ bits: 8, data: Buffer.from([64, 128, 192]) }));
  assert.deepEqual(Array.from(d.channels[0]), [-0.5, 0, 0.5]);
  assert.equal(d.bits, 8);
});

test('WAV decodes 24-bit, 32-bit, float 32 and float 64', () => {
  const b24 = Buffer.from([0x00, 0x00, 0x80, 0xff, 0xff, 0x7f]);
  assert.deepEqual(Array.from(read(wav({ bits: 24, data: b24 })).channels[0]), [-1, 8388607 / 8388608]);
  const b32 = Buffer.from(new Int32Array([-2147483648]).buffer);
  assert.deepEqual(Array.from(read(wav({ bits: 32, data: b32 })).channels[0]), [-1]);
  const d = read(wav({ format: 3, bits: 32, data: f32(0.5, -0.25) }));
  assert.deepEqual(Array.from(d.channels[0]), [0.5, -0.25]);
  const d64 = read(wav({ format: 3, bits: 64, data: Buffer.from(new Float64Array([0.5]).buffer) }));
  assert.deepEqual(Array.from(d64.channels[0]), [0.5]);
});

test('WAV de-interleaves stereo', () => {
  const inter = Buffer.from(new Int16Array([1, -1, 0, 0]).buffer);
  const d = read(wav({ channels: 2, data: inter }));
  assert.equal(d.channels.length, 2);
  assert.deepEqual(Array.from(d.channels[0]), [1 / 32768, 0]);
  assert.deepEqual(Array.from(d.channels[1]), [-1 / 32768, 0]);
});

test('WAV accepts WAVE_FORMAT_EXTENSIBLE PCM', () => {
  const d = read(wav({ format: 0xfffe, subFormat: 1, data: pcm16(1000) }));
  assert.ok(Math.abs(d.channels[0][0] - 1000 / 32768) < 1e-6);
});

test('WAV skips odd and unknown chunks before data', () => {
  const junk = chunk('JUNK', Buffer.from([1, 2, 3]));
  const d = read(wav({ data: pcm16(1234), extra: [chunk('LIST', Buffer.from('INFO')), junk] }));
  assert.equal(d.channels[0][0], 1234 / 32768);
});

test('WAV reads the first forward smpl loop', () => {
  const smpl = Buffer.alloc(36 + 24);
  smpl.writeUInt32LE(1, 28);
  smpl.writeUInt32LE(0, 36);
  smpl.writeUInt32LE(1, 44);
  smpl.writeUInt32LE(4, 48);
  const d = read(wav({ data: pcm16(0, 0, 0, 0, 0), extra: [chunk('smpl', smpl)] }));
  assert.equal(d.loop.start, 1);
  assert.equal(d.loop.end, 5);
});

test('WAV caps at the frame limit and reports truncation', () => {
  const d = read(wav({ data: pcm16(...new Array(10).fill(0)) }), 4);
  assert.equal(d.channels[0].length, 4);
  assert.equal(d.truncated, true);
});

test('damaged WAV fails with a readable message', () => {
  assert.throws(() => read(wav({ data: pcm16(0) }).slice(0, 14)), /WAV file is damaged/);
  assert.throws(() => read(wav({ format: 2, data: pcm16(0) })), /compressed WAV/i);
});
