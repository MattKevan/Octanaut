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

  MW.sampleImport = {
    MAX_FRAMES,
    DEFAULT_RATE,
    sniff
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
