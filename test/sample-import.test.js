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

const build = (decoded, settings) => runtime(['sample-import']).sampleImport.build(decoded, settings);
const decoded = (rate, channels, extra = {}) => ({ rate, bits: 16, channels, loop: null, truncated: false, ...extra });
const C1 = 1, C2 = 13, C3 = 25;
const base = { note: C3, channel: 'mixed', stereo: false, loop: true, normalise: false };

test('plan puts a 44.1 kHz source at C-3 without upsampling', () => {
  const p = runtime(['sample-import']).sampleImport.plan({ rate: 44100 }, base);
  assert.deepEqual({ ...p }, { rate: 16726, c2rate: 8363, sourceRate: 44100 });
});

test('plan leaves a low-rate source alone but tunes it to the note', () => {
  const p = runtime(['sample-import']).sampleImport.plan({ rate: 8000 }, base);
  assert.deepEqual({ ...p }, { rate: 8000, c2rate: 4000, sourceRate: 8000 });
});

test('plan doubles c2rate for a C-1 target', () => {
  const p = runtime(['sample-import']).sampleImport.plan({ rate: 22050 }, { ...base, note: C1 });
  assert.deepEqual({ ...p }, { rate: 4182, c2rate: 8364, sourceRate: 22050 });
});

test('plan with no note keeps the source rate at C-2', () => {
  const p = runtime(['sample-import']).sampleImport.plan({ rate: 22050 }, { ...base, note: null });
  assert.deepEqual({ ...p }, { rate: 22050, c2rate: 22050, sourceRate: 22050 });
});

test('build mixes, picks and averages stereo channels', () => {
  const d = decoded(8000, [new Float32Array([1, 0]), new Float32Array([0, -1])]);
  assert.deepEqual(Array.from(build(d, base).instrument.data), [0.5, -0.5]);
  assert.deepEqual(Array.from(build(d, { ...base, channel: 'left' }).instrument.data), [1, 0]);
  assert.deepEqual(Array.from(build(d, { ...base, channel: 'right' }).instrument.data), [0, -1]);
});

test('anti-phase stereo cancels when mixed', () => {
  const d = decoded(8000, [new Float32Array([1, -1, 0.5]), new Float32Array([-1, 1, 0.5])]);
  assert.deepEqual(Array.from(build(d, base).instrument.data), [0, 0, 0.5]);
});

test('the resampler averages over the source interval and never upsamples', () => {
  const s = runtime(['sample-import']).sampleImport;
  const out = s.resample([new Float32Array([0.5, -0.5, 0.5, 0.5, 0, 0])], 16000, 8000)[0];
  assert.equal(out.length, 3);
  assert.ok(Math.abs(out[0]) < 1e-6 && Math.abs(out[1] - 0.5) < 1e-6 && Math.abs(out[2]) < 1e-6);
  const same = s.resample([new Float32Array([0, 0, 0, 0])], 8000, 16000)[0];
  assert.equal(same.length, 4);
});

test('build scales loop points and drops loops outside the kept range', () => {
  const d = decoded(16726, [new Float32Array(100).fill(0.5)], { loop: { start: 20, end: 80 } });
  const { instrument } = build(d, { ...base, note: C2 });
  assert.equal(instrument.loop, 10);
  assert.equal(instrument.looplen, 30);
  const gone = decoded(16726, [new Float32Array(100).fill(0.5)], { loop: { start: 90, end: 140 } });
  assert.equal(build(gone, { ...base, note: C2 }).instrument.looplen, 0);
});

test('build caps at 131072 frames and reports it', () => {
  const d = decoded(8000, [new Float32Array(140000).fill(0.5)]);
  const { instrument, report } = build(d, { ...base, note: null });
  assert.equal(instrument.data.length, 131072);
  assert.equal(report.truncated, true);
});

test('build sets depth flags, keeps stereo and normalises on request', () => {
  const eight = build(decoded(8000, [new Float32Array([0.5, 0, 0, 0])], { bits: 8 }), base).instrument;
  assert.equal(eight.bits16, false);
  const st = build(decoded(8000, [new Float32Array([1]), new Float32Array([-1])]), { ...base, stereo: true }).instrument;
  assert.equal(st.stereo16, true);
  assert.deepEqual(Array.from(st.data), [1]);
  assert.deepEqual(Array.from(st.dataR), [-1]);
  const quiet = build(decoded(8000, [new Float32Array([0.25, -0.5])]), { ...base, normalise: true }).instrument;
  assert.ok(Math.abs(Math.max(...quiet.data.map(Math.abs)) - 0.999) < 1e-6);
});

test('build refuses silence', () => {
  assert.throws(() => build(decoded(8000, [new Float32Array(8)]), base), /No sound in it/);
});

class FakeContext {
  constructor(channels, length, rate) { this.rate = rate; }
  async decodeAudioData() {
    return {
      numberOfChannels: 2,
      sampleRate: this.rate,
      getChannelData: (c) => Float32Array.from([c === 0 ? 0.5 : 0.25])
    };
  }
}
class BrokenContext {
  async decodeAudioData() { throw new Error('no decoder'); }
}
function m4aBox(rate) {
  const box = (type, ...parts) => {
    const body = Buffer.concat(parts);
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length + 8, 0);
    head.write(type, 4, 'ascii');
    return Buffer.concat([head, body]);
  };
  const mdhd = Buffer.alloc(24);
  mdhd.writeUInt32BE(rate, 12);
  mdhd.writeUInt32BE(rate * 2, 16);
  const hdlr = Buffer.alloc(12);
  hdlr.write('soun', 8, 'ascii');
  const out = Buffer.concat([
    box('ftyp', Buffer.from('M4A \0\0\0\0')),
    box('moov', box('trak', box('mdia', box('hdlr', hdlr), box('mdhd', mdhd))))
  ]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x40, ...new Array(128).fill(0)]);
const adts = Buffer.from([0xff, 0xf1, 0x4c, 0x80, ...new Array(64).fill(0)]);
const flac = (() => {
  const b = Buffer.alloc(8 + 34);
  b.write('fLaC', 0);
  b[4] = 0; b[5] = 0; b[6] = 0; b[7] = 34;
  b[10] = 0x0a; b[11] = 0xc4; b[12] = 0x42; b[13] = 0xf0;
  return b;
})();

test('sniff reads MP3, ADTS AAC, FLAC and M4A rates', () => {
  const mw = runtime(['sample-import']);
  assert.deepEqual([mw.sampleImport.sniff(new Uint8Array(mp3)).format, mw.sampleImport.sniff(new Uint8Array(mp3)).rate], ['mp3', 44100]);
  assert.deepEqual([mw.sampleImport.sniff(new Uint8Array(adts)).format, mw.sampleImport.sniff(new Uint8Array(adts)).rate], ['aac', 48000]);
  const f = mw.sampleImport.sniff(new Uint8Array(flac));
  assert.deepEqual([f.format, f.rate, f.bits, f.channels], ['flac', 44100, 16, 2]);
  const m = mw.sampleImport.sniff(new Uint8Array(m4aBox(44100)));
  assert.deepEqual([m.format, m.rate], ['m4a', 44100]);
});

test('sniff prefers raw over a bare sync byte', () => {
  const mw = runtime(['sample-import']);
  assert.equal(mw.sampleImport.sniff(new Uint8Array([0xff, 0xfb, 0x9c, 0x00])).format, 'raw');
});

test('sniff reads an AIFF COMM rate', () => {
  const mw = runtime(['sample-import']);
  const comm = Buffer.alloc(18);
  comm.writeUInt16BE(1, 0);
  comm.writeUInt32BE(0, 2);
  comm.writeUInt16BE(16, 6);
  Buffer.from([0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0]).copy(comm, 8);
  const commHead = Buffer.alloc(8);
  commHead.write('COMM', 0, 'ascii');
  commHead.writeUInt32BE(comm.length, 4);
  const body = Buffer.concat([Buffer.from('AIFF'), commHead, comm]);
  const head = Buffer.alloc(8);
  head.write('FORM', 0, 'ascii');
  head.writeUInt32BE(body.length, 4);
  const m = mw.sampleImport.sniff(new Uint8Array(Buffer.concat([head, body])));
  assert.deepEqual([m.format, m.rate, m.channels, m.bits], ['aiff', 44100, 1, 16]);
});

test('decode uses the sniffed rate and copies every channel', async () => {
  const mw = runtime(['sample-import'], { OfflineAudioContext: FakeContext });
  const d = await mw.sampleImport.decode(wav({ rate: 22050 }), { rate: 22050 });
  assert.equal(d.rate, 22050);
  assert.equal(d.channels.length, 2);
  assert.equal(d.channels[1][0], 0.25);
});

test('decode refuses long or oversized compressed files before decoding', async () => {
  const mw = runtime(['sample-import'], { OfflineAudioContext: FakeContext });
  await assert.rejects(() => mw.sampleImport.decode(new ArrayBuffer(8), { format: 'mp3', rate: 44100, compressed: true, duration: 601 }), /longer than 10 minutes/);
  await assert.rejects(() => mw.sampleImport.decode(new ArrayBuffer(17 * 1024 * 1024), { format: 'mp3', rate: 44100, compressed: true }), /larger than 16 MB/);
});

test('a browser without the codec says so', async () => {
  const mw = runtime(['sample-import'], { OfflineAudioContext: BrokenContext });
  await assert.rejects(() => mw.sampleImport.decode(wav(), { format: 'mp3', rate: 44100 }), /WAV always works/);
});
