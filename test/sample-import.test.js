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
    box('free', Buffer.from([0xff, 0xfb, 0x90, 0x40])),
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
  b[18] = 0x0a; b[19] = 0xc4; b[20] = 0x42; b[21] = 0xf0;
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

function beChunk(id, data) {
  const head = Buffer.alloc(8);
  head.write(id, 0, 'ascii');
  head.writeUInt32BE(data.length, 4);
  return Buffer.concat([head, data, data.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)]);
}
function aiff({ channels = 1, bits = 16, data = Buffer.alloc(2), compression } = {}) {
  const frames = Math.floor(data.length / (channels * bits / 8));
  const comm = Buffer.alloc(compression ? 24 : 18);
  comm.writeUInt16BE(channels, 0);
  comm.writeUInt32BE(frames, 2);
  comm.writeUInt16BE(bits, 6);
  Buffer.from([0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0]).copy(comm, 8);
  if (compression) { comm.write(compression, 18, 'ascii'); comm.writeUInt16BE(0, 22); }
  const ssnd = Buffer.concat([Buffer.alloc(8), data]);
  const body = Buffer.concat([
    Buffer.from(compression ? 'AIFC' : 'AIFF'),
    beChunk('COMM', comm),
    beChunk('SSND', ssnd)
  ]);
  const head = Buffer.alloc(8);
  head.write('FORM', 0, 'ascii');
  head.writeUInt32BE(body.length, 4);
  const out = Buffer.concat([head, body]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

test('AIFF decodes big-endian PCM and stereo', () => {
  const s = runtime(['sample-import']).sampleImport;
  const mono = s.readAiff(aiff({ data: Buffer.from([0x00, 0x00, 0x40, 0x00, 0x80, 0x00]) }));
  assert.deepEqual(Array.from(mono.channels[0]), [0, 0.5, -1]);
  const st = s.readAiff(aiff({
    channels: 2,
    data: Buffer.from([0x00, 0x00, 0x40, 0x00, 0x80, 0x00, 0x00, 0x00])
  }));
  assert.deepEqual(Array.from(st.channels[0]), [0, -1]);
  assert.deepEqual(Array.from(st.channels[1]), [0.5, 0]);
});

test('AIFF decodes sowt little-endian PCM', () => {
  const s = runtime(['sample-import']).sampleImport;
  const d = s.readAiff(aiff({ compression: 'sowt', data: Buffer.from([0x00, 0x00, 0x00, 0x40]) }));
  assert.deepEqual(Array.from(d.channels[0]), [0, 0.5]);
});

test('damaged AIFF fails with a readable message', () => {
  const s = runtime(['sample-import']).sampleImport;
  assert.throws(() => s.readAiff(aiff({ data: Buffer.alloc(2) }).slice(0, 12)), /AIFF file is damaged/);
});

function oggPage(packet, granule = 0, type = 0) {
  const head = Buffer.alloc(27);
  head.write('OggS', 0, 'ascii');
  head[4] = 0; head[5] = type;
  head.writeBigUInt64LE(BigInt(granule), 6);
  head[26] = 1;
  return Buffer.concat([head, Buffer.from([packet.length]), packet]);
}
function vorbisId(rate = 44100, channels = 2) {
  const p = Buffer.alloc(30);
  p.write('\x01vorbis', 0, 'latin1');
  p.writeUInt32LE(0, 7);
  p[11] = channels;
  p.writeUInt32LE(rate, 12);
  return p;
}
function adtsFrames(count, rateIndex = 3, channels = 2, len = 64) {
  const out = Buffer.alloc(count * len);
  for (let i = 0; i < count; i++) {
    const p = i * len;
    out[p] = 0xff; out[p + 1] = 0xf1;
    out[p + 2] = (1 << 6) | (rateIndex << 2) | ((channels >> 2) & 1);
    out[p + 3] = ((channels & 3) << 6) | ((len >> 11) & 3);
    out[p + 4] = (len >> 3) & 0xff;
    out[p + 5] = ((len & 7) << 5) | 0x1f;
  }
  return out;
}
function xingMp3({ frames = 1000, withXing = true } = {}) {
  const side = 32;
  const b = Buffer.alloc(withXing ? 4 + side + 12 : 48);
  b[0] = 0xff; b[1] = 0xfb; b[2] = 0x10; b[3] = 0x40; // MPEG1 L3, 32 kbps, 44100, stereo
  if (withXing) {
    b.write('Xing', 4 + side, 'ascii');
    b.writeUInt32BE(1, 4 + side + 4);
    b.writeUInt32BE(frames, 4 + side + 8);
  }
  return b;
}

test('sniff reads a Vorbis identification page and its duration', () => {
  const mw = runtime(['sample-import']);
  const bytes = Buffer.concat([oggPage(vorbisId(44100, 2)), oggPage(Buffer.from([4, 0]), 441000)]);
  const meta = mw.sampleImport.sniff(new Uint8Array(bytes));
  assert.deepEqual([meta.format, meta.rate, meta.channels], ['ogg', 44100, 2]);
  assert.ok(Math.abs(meta.duration - 10) < 1e-6);
  assert.equal(meta.durationExact, true);
});

test('sniff does not mistake a raw sample for an MP3', () => {
  const mw = runtime(['sample-import']);
  const raw = Buffer.alloc(5000);
  Buffer.from([0xff, 0xfb, 0x90, 0x40]).copy(raw, 64);
  assert.equal(mw.sampleImport.sniff(new Uint8Array(raw)).format, 'raw');
});

test('sniff finds an MP3 after an ID3 tag', () => {
  const mw = runtime(['sample-import']);
  const id3 = Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x0a'), Buffer.alloc(10)]);
  const meta = mw.sampleImport.sniff(new Uint8Array(Buffer.concat([id3, mp3])));
  assert.deepEqual([meta.format, meta.rate], ['mp3', 44100]);
});

test('MP3 duration uses a Xing frame count and only refuses exact overruns', () => {
  const mw = runtime(['sample-import']);
  const exact = mw.sampleImport.sniff(new Uint8Array(xingMp3({ frames: 1000 })));
  assert.equal(exact.durationExact, true);
  assert.ok(Math.abs(exact.duration - 1000 * 1152 / 44100) < 1e-6);
  const estimate = mw.sampleImport.sniff(new Uint8Array(xingMp3({ withXing: false })));
  assert.equal(estimate.durationExact, false);
});

test('ADTS duration counts frames', () => {
  const mw = runtime(['sample-import']);
  const meta = mw.sampleImport.sniff(new Uint8Array(adtsFrames(3, 3, 2, 64)));
  assert.equal(meta.format, 'aac');
  assert.ok(Math.abs(meta.duration - 3 * 1024 / 48000) < 1e-6);
  assert.equal(meta.durationExact, true);
});

test('the native reader keeps enough source audio for the 131072 output cap', () => {
  const s = runtime(['sample-import']).sampleImport;
  const decoded = s.readWav(wav({ data: Buffer.alloc(600000, 0x40) }));
  assert.equal(decoded.channels[0].length, 300000);
  const built = s.build(decoded, { note: C3, channel: 'mixed', stereo: false, loop: false, normalise: false });
  assert.ok(built.instrument.data.length > 100000, built.instrument.data.length);
});

test('build records the data rate separately from c2rate', () => {
  const s = runtime(['sample-import']).sampleImport;
  const d = { rate: 44100, bits: 16, channels: [new Float32Array(100).fill(0.5)], loop: null, truncated: false };
  const built = s.build(d, { note: C3, channel: 'mixed', stereo: false, loop: false, normalise: false });
  assert.equal(built.instrument.c2rate, 8363);
  assert.equal(built.instrument.samplerate, 16726);
});

test('right and stereo use the front channels of a multi-channel source', () => {
  const d = decoded(8000, [
    new Float32Array([0.1]), new Float32Array([0.2]), new Float32Array([0.3]), new Float32Array([0.4])
  ]);
  assert.ok(Math.abs(build(d, { ...base, channel: 'right' }).instrument.data[0] - 0.2) < 1e-6);
  const st = build(d, { ...base, stereo: true }).instrument;
  assert.ok(Math.abs(st.data[0] - 0.1) < 1e-6);
  assert.ok(Math.abs(st.dataR[0] - 0.2) < 1e-6);
});
