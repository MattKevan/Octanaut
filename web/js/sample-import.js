// @ts-check
/* Octanaut - sample import: sniffing, WAV reading and conversion.
 *
 * Everything here works on bytes and plain arrays so the model can be tested
 * without a browser. Decoding compressed audio is the one exception and lives
 * behind `decode`, which needs an AudioContext.
 */
(function (global) {
  'use strict';
  const MW = global.MW = global.MW || {};

  const MAX_FRAMES = 131072;
  const MAX_SOURCE_FRAMES = 2000000;
  const DEFAULT_RATE = 48000;
  const MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
  const MAX_SECONDS = 600;

  function tag(dv, off) {
    return String.fromCharCode(
      dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
  }

  function tagN(dv, off, n) {
    let out = '';
    for (let i = 0; i < n; i++) out += String.fromCharCode(dv.getUint8(off + i));
    return out;
  }

  function u16(dv, off, little) { return dv.getUint16(off, !!little); }
  function u32(dv, off, little) { return dv.getUint32(off, !!little); }

  function view(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return { bytes: b, dv: new DataView(b.buffer, b.byteOffset, b.byteLength) };
  }

  /* --------------------------------------------------------------- sniff */

  /** @returns {any} */
  function base(format, extra) {
    return Object.assign({
      format,
      rate: null,
      bits: null,
      channels: null,
      frames: null,
      duration: null,
      durationExact: false,
      loop: null,
      asks: true,
      compressed: false
    }, extra || {});
  }

  function sniffWav(dv) {
    /** @type {number|null} */ let rate = null;
    /** @type {number|null} */ let channels = null;
    /** @type {number|null} */ let bits = null;
    /** @type {number|null} */ let frames = null;
    /** @type {{start:number,end:number}|null} */ let loop = null;
    const declared = u32(dv, 4, true);
    const end = Math.min(dv.byteLength, declared > 0 ? declared + 8 : dv.byteLength);
    let pos = 12;
    while (pos + 8 <= end) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4, true);
      const body = pos + 8;
      if (body + size > dv.byteLength) break;
      if (id === 'fmt ' && size >= 16) {
        channels = u16(dv, body + 2, true);
        rate = u32(dv, body + 4, true);
        bits = u16(dv, body + 14, true);
      } else if (id === 'data') {
        const bytes = Math.ceil(bits || 8) / 8;
        const block = Math.max(1, (channels || 1) * bytes);
        frames = Math.floor(Math.min(size, dv.byteLength - body) / block);
      } else if (id === 'smpl' && size >= 36) {
        const loops = u32(dv, body + 28, true);
        for (let i = 0; i < loops && body + 36 + i * 24 + 24 <= body + size; i++) {
          const at = body + 36 + i * 24;
          if (u32(dv, at, true) === 0) {
            loop = { start: u32(dv, at + 8, true), end: u32(dv, at + 12, true) + 1 };
            break;
          }
        }
      }
      pos = body + size + (size & 1);
    }
    return base('wav', {
      rate, bits, channels, frames, loop,
      duration: rate && frames ? frames / rate : null,
      durationExact: !!(rate && frames)
    });
  }

  function sniffIff(dv, form) {
    if (form === '8SVX') {
      let rate = null;
      let pos = 12;
      while (pos + 8 <= dv.byteLength) {
        const id = tag(dv, pos);
        const size = u32(dv, pos + 4, false);
        const body = pos + 8;
        if (body + size > dv.byteLength) break;
        if (id === 'VHDR' && size >= 20) rate = u16(dv, body + 12, false);
        pos = body + size + (size & 1);
      }
      return base('8svx', { rate, bits: 8, channels: 1, asks: false });
    }
    /** @type {number|null} */ let rate = null;
    /** @type {number|null} */ let bits = null;
    /** @type {number|null} */ let channels = null;
    /** @type {number|null} */ let frames = null;
    let pos = 12;
    while (pos + 8 <= dv.byteLength) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4, false);
      const body = pos + 8;
      if (body + size > dv.byteLength) break;
      if (id === 'COMM' && size >= 18) {
        channels = u16(dv, body, false);
        frames = u32(dv, body + 2, false);
        bits = u16(dv, body + 6, false);
        rate = Math.round(extended80(dv, body + 8));
      }
      pos = body + size + (size & 1);
    }
    return base('aiff', { rate, bits, channels, frames, duration: rate && frames ? frames / rate : null, durationExact: !!(rate && frames) });
  }

  function extended80(dv, off) {
    const negative = (dv.getUint8(off) & 0x80) !== 0;
    const exponent = ((dv.getUint8(off) & 0x7f) << 8) | dv.getUint8(off + 1);
    let mantissa = 0;
    for (let i = 0; i < 8; i++) mantissa = mantissa * 256 + dv.getUint8(off + 2 + i);
    if (exponent === 0 && mantissa === 0) return 0;
    const value = mantissa * Math.pow(2, exponent - 16383 - 63);
    return negative ? -value : value;
  }

  const MP3_RATES = [[11025, 12000, 8000], [0, 0, 0], [22050, 24000, 16000], [44100, 48000, 32000]];
  const MP3_BITRATES = {
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  };
  const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  function sniffMp3(dv) {
    let pos = 0;
    if (dv.byteLength >= 10 && tagN(dv, 0, 3) === 'ID3') {
      const size = ((dv.getUint8(6) & 0x7f) << 21) | ((dv.getUint8(7) & 0x7f) << 14) |
        ((dv.getUint8(8) & 0x7f) << 7) | (dv.getUint8(9) & 0x7f);
      pos = 10 + size + ((dv.getUint8(5) & 0x10) ? 10 : 0);
    }
    const end = Math.min(dv.byteLength - 4, pos + 65536);
    for (let p = Math.max(0, pos); p <= end; p++) {
      if (dv.getUint8(p) !== 0xff) continue;
      const b1 = dv.getUint8(p + 1);
      const b2 = dv.getUint8(p + 2);
      const b3 = dv.getUint8(p + 3);
      if ((b1 & 0xe0) !== 0xe0) continue;
      const version = (b1 >> 3) & 3;
      const layer = (b1 >> 1) & 3;
      const rateIndex = (b2 >> 2) & 3;
      const bitrateIndex = (b2 >> 4) & 0xf;
      if (version === 1 || layer !== 1 || rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) continue;
      const rate = MP3_RATES[version][rateIndex];
      const bitrate = (MP3_BITRATES[version === 3 ? 3 : 2][bitrateIndex] || 0) * 1000;
      if (!rate || !bitrate) continue;
      const mono = ((b3 >> 6) & 3) === 3;
      const samples = version === 3 ? 1152 : 576;
      const frameLen = Math.floor((version === 3 ? 144 : 72) * bitrate / rate) + ((b2 >> 1) & 1);

      /* A sync word in the middle of raw data is not a frame. Accept the
         first frame after any ID3 tag, or a frame followed by another. */
      let valid = p === pos;
      const next = p + frameLen;
      if (!valid && next + 4 <= dv.byteLength) {
        const n1 = dv.getUint8(next);
        const n2 = dv.getUint8(next + 1);
        valid = n1 === 0xff && (n2 & 0xe0) === 0xe0 &&
          ((n2 >> 3) & 3) === version && ((n2 >> 1) & 3) === layer;
      }
      if (!valid) continue;

      const side = version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
      const xing = p + 4 + side;
      let duration = (dv.byteLength - pos) * 8 / bitrate;
      let exact = false;
      if (xing + 12 <= dv.byteLength) {
        const id = tag(dv, xing);
        if (id === 'Xing' || id === 'Info') {
          const flags = u32(dv, xing + 4, false);
          if (flags & 1) {
            const frames = u32(dv, xing + 8, false);
            if (frames > 0) {
              duration = frames * samples / rate;
              exact = true;
            }
          }
        }
      }
      return base('mp3', {
        rate,
        bits: null,
        channels: mono ? 1 : 2,
        duration,
        durationExact: exact,
        compressed: true
      });
    }
    return null;
  }

  function sniffAdts(dv) {
    if (dv.byteLength < 7) return null;
    if (dv.getUint8(0) !== 0xff || (dv.getUint8(1) & 0xf6) !== 0xf0) return null;
    const index = (dv.getUint8(2) >> 2) & 0xf;
    if (index > 12) return null;
    const rate = AAC_RATES[index];
    const channels = ((dv.getUint8(2) & 1) << 2) | (dv.getUint8(3) >> 6);
    let p = 0, frames = 0;
    while (p + 7 <= dv.byteLength && frames < 1000000) {
      if (dv.getUint8(p) !== 0xff || (dv.getUint8(p + 1) & 0xf6) !== 0xf0) break;
      const length = ((dv.getUint8(p + 3) & 3) << 11) | (dv.getUint8(p + 4) << 3) | (dv.getUint8(p + 5) >> 5);
      if (length < 7) break;
      p += length;
      frames++;
    }
    const duration = frames > 1 ? frames * 1024 / rate : null;
    return base('aac', {
      rate,
      bits: null,
      channels: channels || 2,
      duration,
      durationExact: duration != null,
      compressed: true
    });
  }

  function boxAt(dv, pos, end) {
    if (pos + 8 > end) return null;
    let size = u32(dv, pos, false);
    const type = tag(dv, pos + 4);
    let body = pos + 8;
    if (size === 1) {
      if (pos + 16 > end) return null;
      size = Number(dv.getBigUint64(pos + 8, false));
      body = pos + 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < 8 || pos + size > end) return null;
    return { type, body, end: pos + size };
  }

  function findBox(dv, start, end, type) {
    let pos = start;
    while (pos < end) {
      const box = boxAt(dv, pos, end);
      if (!box) break;
      if (box.type === type) return box;
      pos = box.end;
    }
    return null;
  }

  function childBoxes(dv, start, end, type) {
    const out = [];
    let pos = start;
    while (pos < end) {
      const box = boxAt(dv, pos, end);
      if (!box) break;
      if (box.type === type) out.push(box);
      pos = box.end;
    }
    return out;
  }

  function sniffM4a(dv) {
    if (dv.byteLength < 12 || tag(dv, 4) !== 'ftyp') return null;
    const moov = findBox(dv, 0, dv.byteLength, 'moov');
    if (!moov) return null;
    for (const trak of childBoxes(dv, moov.body, moov.end, 'trak')) {
      const mdia = findBox(dv, trak.body, trak.end, 'mdia');
      if (!mdia) continue;
      const hdlr = findBox(dv, mdia.body, mdia.end, 'hdlr');
      if (!hdlr || hdlr.body + 12 > hdlr.end || tag(dv, hdlr.body + 8) !== 'soun') continue;
      const mdhd = findBox(dv, mdia.body, mdia.end, 'mdhd');
      if (!mdhd || mdhd.body + 4 > mdhd.end) continue;
      const version = dv.getUint8(mdhd.body);
      const rate = version === 1 ? u32(dv, mdhd.body + 20, false) : u32(dv, mdhd.body + 12, false);
      if (!rate) continue;
      let channels = 2, bits = null;
      const minf = findBox(dv, mdia.body, mdia.end, 'minf');
      const stbl = minf && findBox(dv, minf.body, minf.end, 'stbl');
      const stsd = stbl && findBox(dv, stbl.body, stbl.end, 'stsd');
      if (stsd && stsd.body + 44 <= stsd.end) {
        const entry = stsd.body + 8;
        channels = u16(dv, entry + 24, false) || channels;
        bits = u16(dv, entry + 26, false) || null;
      }
      /** @type {number|null} */ let duration = null;
      if (version === 1 && mdhd.body + 32 <= mdhd.end) {
        duration = Number(dv.getBigUint64(mdhd.body + 24, false)) / rate;
      } else if (version === 0 && mdhd.body + 20 <= mdhd.end) {
        duration = u32(dv, mdhd.body + 16, false) / rate;
      }
      return base('m4a', { rate, bits, channels, duration, durationExact: duration != null, compressed: true });
    }
    return null;
  }

  function sniffFlac(dv) {
    if (dv.byteLength < 42) return base('flac', { compressed: true });
    const rate = (dv.getUint8(18) << 12) | (dv.getUint8(19) << 4) | (dv.getUint8(20) >> 4);
    const channels = ((dv.getUint8(20) >> 1) & 7) + 1;
    const bits = (((dv.getUint8(20) & 1) << 4) | (dv.getUint8(21) >> 4)) + 1;
    const total = (dv.getUint8(21) & 0x0f) * 4294967296 +
      u32(dv, 22, false);
    return base('flac', {
      rate: rate || null,
      bits,
      channels,
      frames: total || null,
      duration: rate && total ? total / rate : null,
      durationExact: !!(rate && total),
      compressed: true
    });
  }

  function sniffOgg(dv) {
    if (dv.byteLength < 28 || tag(dv, 0) !== 'OggS') return base('ogg', { compressed: true });
    const segments = dv.getUint8(26);
    const packet = 27 + segments;
    /** @type {number|null} */ let rate = null;
    /** @type {number|null} */ let channels = null;
    if (packet + 16 <= dv.byteLength) {
      if (dv.getUint8(packet) === 1 && tagN(dv, packet + 1, 6) === 'vorbis') {
        channels = dv.getUint8(packet + 11);
        rate = u32(dv, packet + 12, true) || null;
      } else if (tag(dv, packet) === 'Opus') {
        rate = 48000;
        channels = dv.getUint8(packet + 9) || 2;
      }
    }
    /** @type {number|null} */ let duration = null;
    const floor = Math.max(0, dv.byteLength - 65536);
    for (let p = dv.byteLength - 27; p >= floor; p--) {
      if (tag(dv, p) === 'OggS' && p + 14 <= dv.byteLength) {
        const granule = Number(dv.getBigUint64(p + 6, true));
        if (rate && granule > 0) duration = granule / rate;
        break;
      }
    }
    return base('ogg', {
      rate,
      bits: null,
      channels,
      duration,
      durationExact: duration != null,
      compressed: true
    });
  }

  function sniff(bytes) {
    const { dv } = view(bytes);
    if (dv.byteLength >= 12 && tag(dv, 0) === 'RIFF' && tag(dv, 8) === 'WAVE') return sniffWav(dv);
    if (dv.byteLength >= 12 && tag(dv, 0) === 'FORM') return sniffIff(dv, tag(dv, 8));
    if (dv.byteLength >= 4 && tag(dv, 0) === 'fLaC') return sniffFlac(dv);
    if (dv.byteLength >= 4 && tag(dv, 0) === 'OggS') return sniffOgg(dv);
    if (dv.byteLength >= 4 && tag(dv, 0) === 'MSH\0') return base('msh', { bits: 8, channels: 1, asks: false });
    const m4a = sniffM4a(dv);
    if (m4a) return m4a;
    const mp3 = sniffMp3(dv);
    if (mp3) return mp3;
    const aac = sniffAdts(dv);
    if (aac) return aac;
    return base('raw', { rate: 8363, bits: 8, channels: 1, frames: dv.byteLength, asks: false });
  }

  /* --------------------------------------------------------------- WAV */

  function readWav(buffer, maxFrames) {
    /** @type {any} */
    const dv = new DataView(buffer);
    const byteLength = buffer.byteLength;
    if (byteLength < 12 || tag(dv, 0) !== 'RIFF' || tag(dv, 8) !== 'WAVE') {
      throw new Error('WAV file is damaged');
    }
    const max = maxFrames == null ? MAX_SOURCE_FRAMES : Math.max(0, maxFrames | 0);
    /** @type {any} */
    let fmt = null;
    let dataOff = -1;
    let dataSize = 0;
    /** @type {{start:number,end:number}|null} */
    let loop = null;
    const declared = u32(dv, 4, true);
    const end = Math.min(byteLength, declared > 0 ? declared + 8 : byteLength);
    let pos = 12;

    while (pos + 8 <= end) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4, true);
      const body = pos + 8;
      if (body + size > byteLength) {
        if (id === 'data') { dataOff = body; dataSize = byteLength - body; }
        break;
      }
      if (id === 'fmt ') {
        if (size < 16) throw new Error('WAV file is damaged');
        fmt = {
          tag: u16(dv, body, true),
          channels: u16(dv, body + 2, true),
          rate: u32(dv, body + 4, true),
          block: u16(dv, body + 12, true),
          bits: u16(dv, body + 14, true)
        };
        if (fmt.tag === 0xfffe && size >= 40) fmt.tag = u16(dv, body + 24, true);
      } else if (id === 'data') {
        dataOff = body;
        dataSize = size;
      } else if (id === 'smpl' && size >= 36) {
        const loops = u32(dv, body + 28, true);
        for (let i = 0; i < loops && 36 + i * 24 + 24 <= size; i++) {
          const at = body + 36 + i * 24;
          if (u32(dv, at, true) === 0) {
            loop = { start: u32(dv, at + 8, true), end: u32(dv, at + 12, true) + 1 };
            break;
          }
        }
      }
      pos = body + size + (size & 1);
    }

    if (!fmt || dataOff < 0) throw new Error('WAV file is damaged');
    if (fmt.tag !== 1 && fmt.tag !== 3) {
      throw new Error('Compressed WAV is not supported. Save it as PCM first.');
    }
    if (fmt.channels < 1 || fmt.rate < 1) throw new Error('WAV file is damaged');
    if (fmt.tag === 1 && ![8, 16, 24, 32].includes(fmt.bits)) throw new Error('Unsupported WAV depth');
    if (fmt.tag === 3 && ![32, 64].includes(fmt.bits)) throw new Error('Unsupported WAV depth');

    const sampleBytes = fmt.bits / 8;
    const block = Math.max(1, fmt.block || fmt.channels * sampleBytes);
    const available = Math.floor(dataSize / block);
    const frames = Math.min(available, max);
    const truncated = available > max;
    /** @type {Float32Array[]} */
    const channels = [];
    for (let c = 0; c < fmt.channels; c++) channels.push(new Float32Array(frames));

    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < fmt.channels; c++) {
        const p = dataOff + i * block + c * sampleBytes;
        let value;
        if (fmt.tag === 3) {
          value = fmt.bits === 32 ? dv.getFloat32(p, true) : dv.getFloat64(p, true);
        } else if (fmt.bits === 8) {
          value = (dv.getUint8(p) - 128) / 128;
        } else if (fmt.bits === 16) {
          value = dv.getInt16(p, true) / 32768;
        } else if (fmt.bits === 24) {
          let n = dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getUint8(p + 2) << 16);
          if (n & 0x800000) n -= 0x1000000;
          value = n / 8388608;
        } else {
          value = dv.getInt32(p, true) / 2147483648;
        }
        channels[c][i] = value;
      }
    }

    if (loop) {
      const start = Math.max(0, Math.min(frames, loop.start));
      const stop = Math.max(start, Math.min(frames, loop.end));
      loop = stop > start ? { start, end: stop } : null;
    }

    return { rate: fmt.rate, bits: fmt.bits, channels, loop, truncated };
  }

  /* --------------------------------------------------------------- AIFF */

  function readAiff(buffer, maxFrames) {
    const dv = new DataView(buffer);
    const byteLength = buffer.byteLength;
    if (byteLength < 12 || tag(dv, 0) !== 'FORM' ||
      (tag(dv, 8) !== 'AIFF' && tag(dv, 8) !== 'AIFC')) {
      throw new Error('AIFF file is damaged');
    }
    const max = maxFrames == null ? MAX_SOURCE_FRAMES : Math.max(0, maxFrames | 0);
    let channels = 0, frames = 0, bits = 0, rate = 0;
    let compression = 'NONE';
    let soundOff = -1, soundSize = 0;
    let pos = 12;
    while (pos + 8 <= byteLength) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4, false);
      const body = pos + 8;
      if (body + size > byteLength) {
        if (id === 'SSND' && size >= 8) {
          const offset = u32(dv, body, false);
          soundOff = body + 8 + offset;
          soundSize = Math.max(0, byteLength - body - 8 - offset);
        }
        break;
      }
      if (id === 'COMM' && size >= 18) {
        channels = u16(dv, body, false);
        frames = u32(dv, body + 2, false);
        bits = u16(dv, body + 6, false);
        rate = Math.round(extended80(dv, body + 8));
        if (size >= 22) compression = tag(dv, body + 18);
      } else if (id === 'SSND' && size >= 8) {
        const offset = u32(dv, body, false);
        soundOff = body + 8 + offset;
        soundSize = Math.max(0, size - 8 - offset);
      }
      pos = body + size + (size & 1);
    }
    if (!channels || !bits || soundOff < 0) throw new Error('AIFF file is damaged');
    const float = compression === 'fl32' || compression === 'FL32' ||
      compression === 'fl64' || compression === 'FL64';
    if (!float && compression !== 'NONE' && compression !== 'twos' && compression !== 'sowt') {
      throw new Error('Compressed AIFF is not supported. Save it as PCM first.');
    }
    if (![8, 16, 24, 32, 64].includes(bits) || (float && bits !== 32 && bits !== 64)) {
      throw new Error('Unsupported AIFF depth');
    }
    const little = compression === 'sowt';
    const bytesPer = bits / 8;
    const block = Math.max(1, channels * bytesPer);
    const available = Math.min(frames > 0 ? frames : Infinity, Math.floor(soundSize / block));
    const count = Math.min(available, max);
    /** @type {Float32Array[]} */
    const out = [];
    for (let c = 0; c < channels; c++) out.push(new Float32Array(count));
    const read24 = p => {
      let n = little
        ? dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getUint8(p + 2) << 16)
        : (dv.getUint8(p) << 16) | (dv.getUint8(p + 1) << 8) | dv.getUint8(p + 2);
      if (n & 0x800000) n -= 0x1000000;
      return n / 8388608;
    };
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < channels; c++) {
        const p = soundOff + i * block + c * bytesPer;
        let value;
        if (float) value = bits === 32 ? dv.getFloat32(p, false) : dv.getFloat64(p, false);
        else if (bits === 8) value = dv.getInt8(p) / 128;
        else if (bits === 16) value = (little ? dv.getInt16(p, true) : dv.getInt16(p, false)) / 32768;
        else if (bits === 24) value = read24(p);
        else value = (little ? dv.getInt32(p, true) : dv.getInt32(p, false)) / 2147483648;
        out[c][i] = value;
      }
    }
    return { rate: rate || DEFAULT_RATE, bits, channels: out, loop: null, truncated: available > max };
  }

  /* ---------------------------------------------------------- conversion */

  function defaults() {
    return { note: 25, channel: 'mixed', stereo: false, loop: true, normalise: false };
  }

  /** @returns {any} */
  function plan(source, settings) {
    const s = settings || defaults();
    const sourceRate = Math.max(1, Math.round((source && source.rate) || DEFAULT_RATE));
    const note = s.note;
    if (!note) return { rate: sourceRate, c2rate: sourceRate, sourceRate };
    const period = MW.period(note);
    const noteRate = 8363 * 428 / period;
    const rate = Math.max(1, Math.round(Math.min(sourceRate, noteRate)));
    return { rate, c2rate: Math.max(1, Math.round(rate * period / 428)), sourceRate };
  }

  function describeTarget(decoded, settings) {
    const p = plan(decoded, settings);
    const frames = decoded.channels && decoded.channels[0] ? decoded.channels[0].length : 0;
    const sourceRate = decoded.rate || p.rate;
    const outputFrames = sourceRate > 0 ? Math.floor(frames * p.rate / sourceRate) : 0;
    return { ...p, outputFrames, trimmed: outputFrames > MAX_FRAMES };
  }

  function resample(channels, from, to, allowAliasing) {
    if (!channels || !channels.length) return [];
    if (!(from > 0) || !(to > 0) || to >= from) return channels.map(c => Float32Array.from(c));
    const step = from / to;
    const length = Math.max(1, Math.floor(channels[0].length / step));
    return channels.map(src => {
      const out = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        const start = i * step;
        const end = Math.min(src.length, start + step);
        if (allowAliasing) { out[i] = src[Math.floor(start)] || 0; continue; }
        let sum = 0;
        let at = start;
        while (at < end) {
          const index = Math.floor(at);
          const next = Math.min(index + 1, end);
          sum += (src[index] || 0) * (next - at);
          at = next;
        }
        out[i] = end > start ? sum / (end - start) : 0;
      }
      return out;
    });
  }

  /** @returns {any} */
  function build(decoded, settings) {
    const s = { ...defaults(), ...(settings || {}) };
    const p = plan(decoded, s);
    const resampled = resample(decoded.channels, decoded.rate, p.rate, s.allowAliasing);
    if (!resampled.length || !resampled[0].length) throw new Error('No sound in it');

    const stereo = !!s.stereo && resampled.length > 1;
    /** @type {any} */
    let left;
    /** @type {any} */
    let right = null;
    if (stereo) {
      left = Float32Array.from(resampled[0]);
      right = Float32Array.from(resampled[1]);
    } else if (s.channel === 'right' && resampled.length > 1) {
      left = Float32Array.from(resampled[1]);
    } else if (s.channel === 'left' || resampled.length === 1) {
      left = Float32Array.from(resampled[0]);
    } else {
      left = new Float32Array(resampled[0].length);
      for (let c = 0; c < resampled.length; c++) {
        const channel = resampled[c];
        for (let i = 0; i < left.length; i++) left[i] += channel[i] / resampled.length;
      }
    }

    const available = left.length;
    const max = Math.max(1, s.maxFrames || MAX_FRAMES);
    const frames = Math.min(available, max);
    if (frames < left.length) {
      left = left.slice(0, frames);
      if (right) right = right.slice(0, frames);
    }

    /** @type {{start:number,end:number}|null} */
    let loop = null;
    if (s.loop && decoded.loop) {
      const scale = p.rate / (decoded.rate || p.rate);
      const start = Math.round(decoded.loop.start * scale);
      const end = Math.round(decoded.loop.end * scale);
      if (start >= 0 && end <= frames && end - start > 2) loop = { start, end };
    }

    let peak = 0;
    for (let i = 0; i < frames; i++) {
      peak = Math.max(peak, Math.abs(left[i]));
      if (right) peak = Math.max(peak, Math.abs(right[i]));
    }
    if (peak === 0) throw new Error('No sound in it');

    if (s.normalise) {
      const gain = 0.999 / peak;
      for (let i = 0; i < frames; i++) {
        left[i] *= gain;
        if (right) right[i] *= gain;
      }
    }

    let clipped = false;
    const clamp = ch => {
      for (let i = 0; i < ch.length; i++) {
        if (ch[i] > 1) { ch[i] = 1; clipped = true; }
        else if (ch[i] < -1) { ch[i] = -1; clipped = true; }
      }
    };
    clamp(left);
    if (right) clamp(right);

    const inst = MW.createInstrument('sample');
    inst.data = left;
    inst.dataR = right;
    inst.c2rate = p.c2rate;
    inst.samplerate = p.rate;
    inst.bits16 = decoded.bits == null ? true : decoded.bits > 8;
    inst.stereo16 = stereo;
    inst.loop = loop ? loop.start : 0;
    inst.looplen = loop ? loop.end - loop.start : 0;

    return {
      instrument: inst,
      report: {
        sourceRate: p.sourceRate,
        rate: p.rate,
        c2rate: p.c2rate,
        frames,
        truncated: !!decoded.truncated || available > frames,
        stereo,
        clipped
      }
    };
  }

  function makeContext(rate) {
    const sampleRate = Math.max(8000, Math.min(96000, Math.round(rate || DEFAULT_RATE)));
    const Offline = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (Offline) {
      try { return new Offline(1, 1, sampleRate); } catch (e) { /* try the usual rate */ }
      try { return new Offline(1, 1, DEFAULT_RATE); } catch (e) { /* try a live context */ }
    }
    const Live = global.AudioContext || global.webkitAudioContext;
    if (Live) {
      try { return new Live(); } catch (e) { /* reported below */ }
    }
    return null;
  }

  async function decode(buffer, meta) {
    if (meta && meta.format === 'wav') return readWav(buffer);
    if (meta && meta.format === 'aiff') return readAiff(buffer);
    if (meta && meta.compressed) {
      if (meta.durationExact !== false && meta.duration != null && meta.duration > MAX_SECONDS) {
        throw new Error('That file is longer than 10 minutes. Import a shorter sample.');
      }
      if (buffer.byteLength > MAX_COMPRESSED_BYTES) {
        throw new Error('That file is larger than 16 MB. Import a shorter sample.');
      }
    }
    const ctx = makeContext(meta && meta.rate);
    if (!ctx) throw new Error('This browser cannot decode that file. WAV always works.');
    let decoded;
    try {
      decoded = await ctx.decodeAudioData(buffer.slice(0));
    } catch (e) {
      throw new Error('This browser cannot decode that file. WAV always works.');
    }
    /** @type {Float32Array[]} */
    const channels = [];
    const count = Math.max(1, decoded.numberOfChannels || 1);
    for (let c = 0; c < count; c++) channels.push(Float32Array.from(decoded.getChannelData(c)));
    return {
      rate: decoded.sampleRate || ctx.sampleRate,
      bits: null,
      channels,
      loop: null,
      truncated: false
    };
  }

  async function load(buffer, settings) {
    const meta = sniff(new Uint8Array(buffer));
    if (meta.format === 'msh' || meta.format === '8svx' || meta.format === 'raw') {
      const instrument = MW.loadInstrument ? MW.loadInstrument(buffer) : null;
      return instrument ? { instrument, report: null, meta, decoded: null } : null;
    }
    const decoded = await decode(buffer, meta);
    return { ...build(decoded, settings || defaults()), meta, decoded };
  }

  MW.sampleImport = {
    MAX_FRAMES,
    DEFAULT_RATE,
    MAX_COMPRESSED_BYTES,
    MAX_SECONDS,
    sniff,
    readWav,
    readAiff,
    plan,
    describeTarget,
    resample,
    build,
    defaults,
    decode,
    load
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
