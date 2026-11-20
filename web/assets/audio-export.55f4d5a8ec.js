// @ts-check
/* Octanaut - audio export
 *
 * Renders the current song offline, then writes WAV, AAC (ADTS) or MP3.
 * WAV needs nothing beyond the platform. AAC and MP3 use WebCodecs, and
 * fall back with a clear error when the browser has no encoder.
 */
(function (global) {
  'use strict';
  const MW = global.MW;

  function writeAscii(view, off, text) {
    for (let i = 0; i < text.length; i++) view.setUint8(off + i, text.charCodeAt(i));
  }

  function clamp16(v) {
    if (!isFinite(v)) return 0;
    return Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }

  MW.encodeWAV = function (rendered) {
    const buffer = rendered.buffer;
    const frames = rendered.end;
    const rate = rendered.sampleRate;
    const bytes = 44 + frames * 4;
    const out = new ArrayBuffer(bytes);
    const view = new DataView(out);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, frames * 4, true);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let p = 44;
    for (let i = 0; i < frames; i++) {
      view.setInt16(p, clamp16(left[i]), true); p += 2;
      view.setInt16(p, clamp16(right[i]), true); p += 2;
    }
    return out;
  };

  const ADTS_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  function adtsHeader(length, rate, channels) {
    let rateIndex = ADTS_RATES.indexOf(rate);
    if (rateIndex < 0) rateIndex = 4;
    const h = new Uint8Array(7);
    h[0] = 0xff;
    h[1] = 0xf1;                                      // MPEG-4, layer 0, no CRC
    h[2] = (1 << 6) | (rateIndex << 2) | ((channels >> 2) & 1);
    h[3] = ((channels & 3) << 6) | ((length >> 11) & 0x03);
    h[4] = (length >> 3) & 0xff;
    h[5] = ((length & 7) << 5) | 0x1f;
    h[6] = 0xfc;                                      // fullness 0x7ff, one frame
    return h;
  }

  async function encodeWebCodecs(rendered, codec, adts) {
    const AudioEncoderCtor = global.AudioEncoder;
    const AudioDataCtor = global.AudioData;
    if (!AudioEncoderCtor || !AudioDataCtor) {
      throw new Error('This browser has no audio encoder');
    }

    const config = {
      codec,
      sampleRate: rendered.sampleRate,
      numberOfChannels: 2,
      bitrate: 192000
    };
    let supported = false;
    try {
      const check = await AudioEncoderCtor.isConfigSupported(config);
      supported = !!(check && check.supported);
    } catch (e) {
      supported = false;
    }
    if (!supported) throw new Error('This browser cannot encode ' + (adts ? 'AAC' : 'MP3'));

    const chunks = [];
    let failed = /** @type {any} */ (null);
    const encoder = new AudioEncoderCtor({
      output: chunk => {
        if (!chunk.byteLength) return;
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        chunks.push(bytes);
      },
      error: err => { failed = err; }
    });
    encoder.configure(config);

    const left = rendered.buffer.getChannelData(0);
    const right = rendered.buffer.getChannelData(1);
    const frames = rendered.end;
    const block = 1024;
    for (let offset = 0; offset < frames; offset += block) {
      const n = Math.min(block, frames - offset);
      const data = new Float32Array(n * 2);
      data.set(left.subarray(offset, offset + n), 0);
      data.set(right.subarray(offset, offset + n), n);
      const audio = new AudioDataCtor({
        format: 'f32-planar',
        sampleRate: rendered.sampleRate,
        numberOfFrames: n,
        numberOfChannels: 2,
        timestamp: Math.round((offset / rendered.sampleRate) * 1e6),
        data
      });
      encoder.encode(audio);
      audio.close();
    }
    await encoder.flush();
    encoder.close();
    if (failed) throw failed;

    if (!adts) {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let p = 0;
      for (const c of chunks) { out.set(c, p); p += c.length; }
      return out.buffer;
    }

    let total = 0;
    for (const c of chunks) total += 7 + c.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) {
      const header = adtsHeader(7 + c.length, rendered.sampleRate, 2);
      out.set(header, p); p += 7;
      out.set(c, p); p += c.length;
    }
    return out.buffer;
  }

  MW.encodeAAC = function (rendered) {
    return encodeWebCodecs(rendered, 'mp4a.40.2', true);
  };

  MW.encodeMP3 = function (rendered) {
    return encodeWebCodecs(rendered, 'mp3', false);
  };

  function download(buf, mime, name) {
    const blob = new Blob([buf], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  MW.exportAudio = async function (format) {
    if (MW.exporting) return;
    const song = MW.app && MW.app.song;
    if (!song) return MW.toast('No song to export', true);
    if (!MW.player || !MW.player.renderOffline) return MW.toast('Audio export is not available', true);

    MW.exporting = true;
    MW.toast('Rendering audio…');
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      if (MW.player.playing) MW.player.stop();
      const rendered = await MW.player.renderOffline(song, { sampleRate: 44100 });

      let buf, ext, mime;
      if (format === 'aac') {
        buf = await MW.encodeAAC(rendered);
        ext = '.aac'; mime = 'audio/aac';
      } else if (format === 'mp3') {
        buf = await MW.encodeMP3(rendered);
        ext = '.mp3'; mime = 'audio/mpeg';
      } else {
        buf = MW.encodeWAV(rendered);
        ext = '.wav'; mime = 'audio/wav';
      }

      const base = (song.name || 'untitled').replace(/[^\w.-]+/g, '_') || 'untitled';
      download(buf, mime, base + ext);
      const seconds = rendered.duration.toFixed(1);
      MW.toast(`Exported ${ext.slice(1).toUpperCase()} · ${seconds}s` + (rendered.truncated ? ' · first 5 minutes' : ''));
    } catch (err) {
      MW.toast('Export failed: ' + /** @type {any} */ (err).message, true);
    } finally {
      MW.exporting = false;
    }
  };

  MW.audioFormats = function () {
    const hasCodecs = !!(global.AudioEncoder && global.AudioData);
    return [
      { id: 'wav', label: 'WAV', available: true },
      { id: 'aac', label: 'AAC', available: hasCodecs },
      { id: 'mp3', label: 'MP3', available: hasCodecs }
    ];
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
