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
  const DEFAULT_RATE = 48000;

  function tag(dv, off) {
    return String.fromCharCode(
      dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
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
      duration: rate && frames ? frames / rate : null
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
    return base('aiff');
  }

  function sniff(bytes) {
    const { dv } = view(bytes);
    if (dv.byteLength >= 12 && tag(dv, 0) === 'RIFF' && tag(dv, 8) === 'WAVE') return sniffWav(dv);
    if (dv.byteLength >= 12 && tag(dv, 0) === 'FORM') return sniffIff(dv, tag(dv, 8));
    if (dv.byteLength >= 4 && tag(dv, 0) === 'fLaC') return base('flac', { compressed: false });
    if (dv.byteLength >= 4 && tag(dv, 0) === 'OggS') return base('ogg', { compressed: true });
    if (dv.byteLength >= 4 && tag(dv, 0) === 'MSH\0') return base('msh', { bits: 8, channels: 1, asks: false });
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
    const max = maxFrames == null ? MAX_FRAMES : Math.max(0, maxFrames | 0);
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
      right = Float32Array.from(resampled[resampled.length - 1]);
    } else if (s.channel === 'right' && resampled.length > 1) {
      left = Float32Array.from(resampled[resampled.length - 1]);
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

  async function decode(buffer, meta) {
    if (meta && (meta.format === 'wav' || meta.format === 'aiff')) return readWav(buffer);
    throw new Error('This browser cannot decode that file. WAV always works.');
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
    sniff,
    readWav,
    plan,
    resample,
    build,
    defaults,
    decode,
    load
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
