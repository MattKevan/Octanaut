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
