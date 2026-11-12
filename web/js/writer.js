// @ts-check
/* Octanaut - MMD0 and MMD1 writers */
(function (global) {
  'use strict';
  const MW = global.MW;

  const SYNTH_HDR = 278;

  /* Native MMD0/1 PCM has no sample-rate field. Export a temporary copy at
     the reference clock, including word-aligned loop positions. */
  function nativeInstrument(inst) {
    if (!inst || inst.type !== 'sample' || !inst.data || (inst.c2rate || 8363) === 8363) return inst;
    const ratio = (inst.c2rate || 8363) / 8363;
    const src = inst.data;
    const data = new Float32Array(Math.max(src.length ? 1 : 0, Math.round(src.length / ratio)));
    for (let i = 0; i < data.length; i++) {
      if (ratio > 1) {
        // Average each source interval to reduce aliasing on downsampling.
        const start = i * ratio, end = Math.min(src.length, (i + 1) * ratio);
        let sum = 0;
        for (let k = Math.floor(start); k < end; k++) {
          sum += src[k] * (Math.min(k + 1, end) - Math.max(k, start));
        }
        data[i] = end > start ? sum / (end - start) : 0;
      } else {
        const pos = i * ratio, at = Math.floor(pos), frac = pos - at;
        data[i] = src[at] * (1 - frac) + src[Math.min(at + 1, src.length - 1)] * frac;
      }
    }
    const limit = data.length & ~1;
    const loop = Math.min(limit, Math.max(0, Math.round((inst.loop || 0) / ratio / 2) * 2));
    const end = Math.min(limit, Math.max(loop, Math.round(((inst.loop || 0) + (inst.looplen || 0)) / ratio / 2) * 2));
    const looplen = inst.looplen > 2 ? end - loop : 0;
    if (looplen && (loop > 131070 || looplen > 131070)) {
      throw new Error('Resampled loop is too large for MMD0/MMD1');
    }
    return { ...inst, data, c2rate: 8363, loop: looplen ? loop : 0, looplen };
  }

  MW.write8SVX = function (inst) {
    const data = inst.data || new Float32Array(0);
    const name = (inst.name || 'sample').slice(0, 30) + '\0';
    const rate = Math.round(inst.c2rate || 8363);
    if (rate < 1 || rate > 65535) throw new Error('8SVX sample rate must fit in 16 bits');
    const size = 12 + 28 + 8 + name.length + (name.length & 1) + 8 + data.length + (data.length & 1);
    const buffer = new ArrayBuffer(size);
    const dv = new DataView(buffer);
    let p = 0;
    const str = s => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i) & 255); };
    const u32 = n => { dv.setUint32(p, n, false); p += 4; };
    str('FORM'); u32(size - 8); str('8SVX');
    str('VHDR'); u32(20);
    u32(inst.looplen > 2 ? inst.loop : data.length);
    u32(inst.looplen > 2 ? inst.looplen : 0); u32(0);
    dv.setUint16(p, rate, false); p += 2;
    dv.setUint8(p++, 1); dv.setUint8(p++, 0);
    u32(Math.round(MW.clamp(inst.volume == null ? 64 : inst.volume, 0, 64) * 1024));
    str('NAME'); u32(name.length); str(name); p += name.length & 1;
    str('BODY'); u32(data.length);
    for (let i = 0; i < data.length; i++) dv.setInt8(p++, Math.max(-128, Math.min(127, Math.round(data[i] * 128))));
    return buffer;
  };

  function synthSize(inst) {
    const syn = inst.synth;
    if (!syn) return 6;
    let size = SYNTH_HDR + 64 * 4;
    for (const wf of syn.waveforms) size += 2 + (wf.length & ~1);
    return size;
  }

  function writeSynth(dv, off, inst) {
    const syn = inst.synth;
    const waves = syn.waveforms.length ? syn.waveforms : [MW.sineTable(32)];
    const start = off;
    dv.setUint32(off, synthSize(inst), false); off += 4;
    dv.setInt16(off, inst.type === 'hybrid' ? -2 : -1, false); off += 2;
    dv.setUint8(off, 0); off += 1;
    off += 3;
    dv.setUint16(off, inst.loop || 0, false); off += 2;
    dv.setUint16(off, inst.looplen || 0, false); off += 2;
    dv.setUint16(off, syn.voltbl.length, false); off += 2;
    dv.setUint16(off, syn.wftbl.length, false); off += 2;
    dv.setUint8(off, syn.volspeed || 1); off += 1;
    dv.setUint8(off, syn.wfspeed || 1); off += 1;
    dv.setUint16(off, waves.length, false); off += 2;

    const vBase = off;
    for (let i = 0; i < 128; i++) dv.setUint8(vBase + i, i < syn.voltbl.length ? syn.voltbl[i] : 0xff);
    const wBase = vBase + 128;
    for (let i = 0; i < 128; i++) dv.setUint8(wBase + i, i < syn.wftbl.length ? syn.wftbl[i] : 0xff);

    const ptrBase = wBase + 128;
    let dataOff = start + SYNTH_HDR + 64 * 4;
    for (let i = 0; i < 64; i++) {
      if (i >= waves.length) { dv.setUint32(ptrBase + i * 4, 0, false); continue; }
      dv.setUint32(ptrBase + i * 4, dataOff - start, false);
      const wf = waves[i];
      dv.setUint16(dataOff, (wf.length / 2) | 0, false);
      for (let k = 0; k < wf.length; k++) {
        dv.setInt8(dataOff + 2 + k, Math.max(-128, Math.min(127, Math.round(wf[k] * 127))));
      }
      dataOff += 2 + (wf.length & ~1);
    }
  }

  MW.writeMMD0 = function (song, others) {
    const withInstr = true;
    const songs = [song].concat(others || []);
    for (const s of songs) {
      for (const b of s.blocks) {
        if (b.lines > 256) throw new Error('MMD0 blocks stop at 256 lines; save as .med instead');
      }
    }
    const n = songs.length;
    const elements = song.instruments.map(nativeInstrument);

    /* ---- first pass: measure ---- */
    let cursor = n * 52;
    const songOff = [], blockarrOff = [], blockOffsets = [], expOff = [];

    for (let i = 0; i < n; i++) {
      const s = songs[i];
      songOff[i] = cursor; cursor += 788;
      blockarrOff[i] = cursor; cursor += s.blocks.length * 4;
      const offs = [];
      for (const b of s.blocks) {
        offs.push(cursor);
        cursor += 2 + b.tracks * b.lines * 3;
        cursor += cursor & 1;
      }
      blockOffsets[i] = offs;
    }

    const smplarrOff = cursor;
    cursor += 63 * 4;

    const sampleOffsets = [];
    for (let i = 0; i < 63; i++) {
      const inst = elements[i];
      if (!inst) { sampleOffsets.push(0); continue; }
      sampleOffsets.push(cursor);
      cursor += (inst.type === 'synth' || inst.type === 'hybrid')
        ? synthSize(inst)
        : 6 + (inst.data ? inst.data.length : 0);
      cursor += cursor & 1;
      if (cursor > 8_000_000) throw new Error('module too large to save as MMD0');
    }

    const aux = [];
    for (let i = 0; i < n; i++) {
      const s = songs[i];
      const e = { exp: cursor };
      e.expSmp = e.exp + 84;
      e.iinfo = e.expSmp + 63 * 4;
      e.anno = e.iinfo + 63 * 40;
      const anno = (s.annotation || s.name || '') + '\0';
      e.annoLen = anno.length;
      e.rgb = e.anno + anno.length + (anno.length & 1);
      e.ninfo = e.rgb + 16;
      cursor = e.ninfo + 108;
      aux.push({ e, anno, s });
    }

    const total = cursor + 2;
    const buf = new Uint8Array(total);
    const dv = new DataView(buf.buffer);

    /* ---- headers, one per song, chained through nextmod ---- */
    for (let i = 0; i < n; i++) {
      const h = i * 52;
      const s = songs[i];
      dv.setUint32(h + 0, 0x4d4d4430, false);
      dv.setUint32(h + 4, total, false);
      dv.setUint32(h + 8, songOff[i], false);
      dv.setUint32(h + 12, 0, false);
      dv.setUint32(h + 16, blockarrOff[i], false);
      dv.setUint8(h + 20, 0);
      dv.setUint32(h + 24, smplarrOff, false);
      dv.setUint32(h + 28, 0, false);
      dv.setUint32(h + 32, aux[i].e.exp, false);
      dv.setUint32(h + 36, 0, false);
      dv.setUint16(h + 48, 0xffff, false);
      dv.setUint8(h + 50, 0);
      dv.setUint8(h + 51, n - 1);
    }

    /* ---- per song: song struct, block table, blocks ---- */
    for (let i = 0; i < n; i++) {
      const s = songs[i];
      let p = songOff[i];
      for (let k = 0; k < 63; k++) {
        const inst = elements[k];
        dv.setUint16(p, inst ? Math.round((inst.loop || 0) / 2) : 0, false);
        dv.setUint16(p + 2, inst ? Math.round((inst.looplen || 0) / 2) : 0, false);
        dv.setUint8(p + 4, inst ? inst.midiChannel || 0 : 0);
        dv.setUint8(p + 5, inst ? inst.midiPreset || 0 : 0);
        dv.setUint8(p + 6, inst ? (inst.volume == null ? 64 : inst.volume) : 64);
        dv.setInt8(p + 7, inst ? inst.transpose || 0 : 0);
        p += 8;
      }
      dv.setUint16(p, s.blocks.length, false); p += 2;
      const seq = s.playseq.slice(0, 256);
      dv.setUint16(p, seq.length, false); p += 2;
      for (let k = 0; k < 256; k++) dv.setUint8(p + k, k < seq.length ? seq[k] : 0);
      p += 256;
      dv.setUint16(p, s.deftempo || 33, false); p += 2;
      dv.setInt8(p, s.playtransp || 0); p += 1;
      let flags = 0;
      if (s.flags.filteron) flags |= 0x01;
      if (s.flags.jumping) flags |= 0x02;
      if (s.flags.jump8th) flags |= 0x04;
      if (s.flags.volhex) flags |= 0x10;
      if (s.flags.stslide) flags |= 0x20;
      if ((s.channels || 4) > 4) flags |= 0x40;
      dv.setUint8(p, flags); p += 1;
      let flags2 = (Math.max(1, s.linesPerBeat || 1) - 1) & 0x1f;
      if (s.bpmMode) flags2 |= 0x20;
      if (s.mixing) flags2 |= 0x80;
      dv.setUint8(p, flags2); p += 1;
      dv.setUint8(p, s.tempo2 || 6); p += 1;
      for (let k = 0; k < 16; k++) dv.setUint8(p + k, s.trkvol[k] || 64);
      p += 16;
      dv.setUint8(p, s.mastervol || 64); p += 1;
      dv.setUint8(p, 63); p += 1;

      for (let b = 0; b < s.blocks.length; b++) {
        dv.setUint32(blockarrOff[i] + b * 4, blockOffsets[i][b], false);
        const blk = s.blocks[b];
        let q = blockOffsets[i][b];
        dv.setUint8(q, blk.tracks);
        dv.setUint8(q + 1, (blk.lines - 1) & 0xff);
        q += 2;
        for (let l = 0; l < blk.lines; l++) {
          for (let t = 0; t < blk.tracks; t++) {
            const c = blk.rows[l][t];
            const ins = c.ins & 0x3f;
            /* MMD0 only has one-digit commands. Extended commands have no
               equivalent, so drop them rather than let the nibble mask
               turn 0x19 into a bogus secondary tempo. */
            let cmd = c.cmd, dat = c.dat;
            if (cmd >= 0x10) {
              if (cmd === 0x1d) { cmd = 0x0f; dat = 0x00; }
              else if (cmd === 0x18) { cmd = 0x0f; dat = 0xff; }
              else { cmd = 0; dat = 0; }
            }
            dv.setUint8(q, (c.note & 0x3f) | ((ins & 0x10) << 3) | ((ins & 0x20) << 1));
            dv.setUint8(q + 1, ((ins & 0x0f) << 4) | (cmd & 0x0f));
            dv.setUint8(q + 2, dat & 0xff);
            q += 3;
          }
        }
      }
    }

    /* ---- instrument table and payloads, shared by every song ---- */
    let jumpmask = 0;
    for (let i = 0; i < 32; i++) if (elements[i] && elements[i].jump) jumpmask |= (1 << i);

    if (withInstr) {
      for (let i = 0; i < 63; i++) dv.setUint32(smplarrOff + i * 4, sampleOffsets[i] || 0, false);
      for (let i = 0; i < 63; i++) {
        const inst = elements[i];
        if (!inst) continue;
        const at = sampleOffsets[i];
        if (inst.type === 'synth' || inst.type === 'hybrid') {
          writeSynth(dv, at, inst);
        } else {
          const data = inst.data || new Float32Array(0);
          dv.setUint32(at, data.length, false);
          dv.setInt16(at + 4, 0, false);
          for (let k = 0; k < data.length; k++) {
            dv.setInt8(at + 6 + k, Math.max(-128, Math.min(127, Math.round(data[k] * 127))));
          }
        }
      }
    }

    /* ---- expansion block per song, chained with nextmod ---- */
    for (let i = 0; i < n; i++) {
      const { e, anno, s } = aux[i];
      dv.setUint32(e.exp + 0, i + 1 < n ? (i + 1) * 52 : 0, false);
      dv.setUint32(e.exp + 4, e.expSmp, false);
      dv.setUint16(e.exp + 8, 63, false);
      dv.setUint16(e.exp + 10, 4, false);
      dv.setUint32(e.exp + 12, e.anno, false);
      dv.setUint32(e.exp + 16, e.annoLen, false);
      dv.setUint32(e.exp + 20, e.iinfo, false);
      dv.setUint16(e.exp + 24, 63, false);
      dv.setUint16(e.exp + 26, 40, false);
      dv.setUint32(e.exp + 28, jumpmask, false);
      dv.setUint32(e.exp + 32, e.rgb, false);
      const ch = s.channels || 4;
      const split = ch >= 8 ? 0 : ch === 7 ? 0xff : ch === 6 ? 0xffff : ch === 5 ? 0xffffff : 0;
      dv.setUint32(e.exp + 36, split, false);
      dv.setUint32(e.exp + 40, s.notation ? e.ninfo : 0, false);

      for (let k = 0; k < 63; k++) {
        const inst = elements[k];
        const o = e.expSmp + k * 4;
        dv.setUint8(o, inst ? inst.hold || 0 : 0);
        dv.setUint8(o + 1, inst ? inst.decay || 0 : 0);
        dv.setUint8(o + 2, inst && inst.suppressOff ? 1 : 0);
        dv.setUint8(o + 3, 0);
        const oi = e.iinfo + k * 40;
        const name = (inst && inst.name ? inst.name : '').slice(0, 39);
        for (let c = 0; c < 40; c++) dv.setUint8(oi + c, c < name.length ? name.charCodeAt(c) : 0);
      }

      for (let k = 0; k < anno.length; k++) dv.setUint8(e.anno + k, anno.charCodeAt(k) & 0xff);

      const rgb = [0x000, 0xeee, 0x48c, 0x4c4, 0xc44, 0xcc4, 0x46c, 0xccc];
      for (let k = 0; k < 8; k++) dv.setUint16(e.rgb + k * 2, rgb[k], false);

      MW.writeNotationInfo(dv, e.ninfo, s.notation);
    }

    return buf.buffer;
  };



  /* ------------------------------------------------------------ MMD1 writer
   *
   * MMD1 is OctaMED Professional's native format. It keeps the MMD0 song
   * structure, instrument table and expansion block, but gives every block
   * a 16-bit track/line count, 4-byte cells with a full command byte, and
   * a BlockInfo struct for the line highlights and block name.
   */
  MW.writeMMD1 = function (song, others, options) {
    const withInstr = !options || options.instruments !== false;
    const songs = [song].concat(others || []);
    const n = songs.length;
    const elements = withInstr ? song.instruments.map(nativeInstrument) : song.instruments;

    /* ---- first pass: measure ---- */
    let cursor = n * 52;
    const songOff = [], blockarrOff = [], blockOffsets = [], blockInfo = [];

    for (let i = 0; i < n; i++) {
      const s = songs[i];
      songOff[i] = cursor; cursor += 788;
      blockarrOff[i] = cursor; cursor += s.blocks.length * 4;
      const offs = [], infos = [];
      for (const b of s.blocks) {
        offs.push(cursor);
        cursor += 8 + b.tracks * b.lines * 4;
        cursor += cursor & 1;

        const name = (b.name || '') + '\0';
        const hlBytes = Math.ceil(b.lines / 32) * 4;
        const info = {
          info: cursor,
          hl: cursor + 36,
          name: cursor + 36 + hlBytes,
          nameLen: name.length
        };
        cursor = info.name + name.length;
        cursor += cursor & 1;
        infos.push(info);
      }
      blockOffsets[i] = offs;
      blockInfo[i] = infos;
    }

    const smplarrOff = withInstr ? cursor : 0;
    if (withInstr) cursor += 63 * 4;

    const sampleOffsets = [];
    for (let i = 0; i < 63; i++) {
      const inst = elements[i];
      if (!withInstr || !inst) { sampleOffsets.push(0); continue; }
      sampleOffsets.push(cursor);
      cursor += (inst.type === 'synth' || inst.type === 'hybrid')
        ? synthSize(inst)
        : 6 + (inst.data ? inst.data.length : 0);
      cursor += cursor & 1;
      if (cursor > 16_000_000) throw new Error('module too large to save as MMD1');
    }

    const aux = [];
    for (let i = 0; i < n; i++) {
      const s = songs[i];
      const e = { exp: cursor };
      e.expSmp = e.exp + 84;
      e.iinfo = e.expSmp + 63 * 4;
      e.anno = e.iinfo + 63 * 40;
      const anno = (s.annotation || s.name || '') + '\0';
      e.annoLen = anno.length;
      e.rgb = e.anno + anno.length + (anno.length & 1);
      e.ninfo = e.rgb + 16;
      e.songname = e.ninfo + 108;
      const songname = (s.name || '') + '\0';
      e.songnameLen = songname.length;
      cursor = e.songname + songname.length;
      cursor += cursor & 1;
      aux.push({ e, anno, songname, s });
    }

    const total = cursor + 2;
    const buf = new Uint8Array(total);
    const dv = new DataView(buf.buffer);

    /* ---- headers, one per song, chained through nextmod ---- */
    for (let i = 0; i < n; i++) {
      const h = i * 52;
      dv.setUint32(h + 0, 0x4d4d4431, false);
      dv.setUint32(h + 4, total, false);
      dv.setUint32(h + 8, songOff[i], false);
      dv.setUint32(h + 12, 0, false);
      dv.setUint32(h + 16, blockarrOff[i], false);
      dv.setUint8(h + 20, 0);
      dv.setUint32(h + 24, smplarrOff, false);
      dv.setUint32(h + 28, 0, false);
      dv.setUint32(h + 32, aux[i].e.exp, false);
      dv.setUint32(h + 36, 0, false);
      dv.setUint16(h + 48, 0xffff, false);
      dv.setUint8(h + 50, 0);
      dv.setUint8(h + 51, n - 1);
    }

    /* ---- per song: song struct, block table, blocks ---- */
    for (let i = 0; i < n; i++) {
      const s = songs[i];
      let p = songOff[i];
      for (let k = 0; k < 63; k++) {
        const inst = elements[k];
        dv.setUint16(p, inst ? Math.round((inst.loop || 0) / 2) : 0, false);
        dv.setUint16(p + 2, inst ? Math.round((inst.looplen || 0) / 2) : 0, false);
        dv.setUint8(p + 4, inst ? inst.midiChannel || 0 : 0);
        dv.setUint8(p + 5, inst ? inst.midiPreset || 0 : 0);
        dv.setUint8(p + 6, inst ? (inst.volume == null ? 64 : inst.volume) : 64);
        dv.setInt8(p + 7, inst ? inst.transpose || 0 : 0);
        p += 8;
      }
      dv.setUint16(p, s.blocks.length, false); p += 2;
      const seq = s.playseq.slice(0, 256);
      dv.setUint16(p, seq.length, false); p += 2;
      for (let k = 0; k < 256; k++) dv.setUint8(p + k, k < seq.length ? seq[k] : 0);
      p += 256;
      dv.setUint16(p, s.deftempo || 33, false); p += 2;
      dv.setInt8(p, s.playtransp || 0); p += 1;

      let flags = 0;
      if (s.flags.filteron) flags |= 0x01;
      if (s.flags.jumping) flags |= 0x02;
      if (s.flags.jump8th) flags |= 0x04;
      if (s.flags.volhex) flags |= 0x10;
      if (s.flags.stslide) flags |= 0x20;
      if ((s.channels || 4) > 4) flags |= 0x40;
      dv.setUint8(p, flags); p += 1;

      let flags2 = (Math.max(1, s.linesPerBeat || 1) - 1) & 0x1f;
      if (s.bpmMode) flags2 |= 0x20;
      if (s.mixing) flags2 |= 0x80;
      dv.setUint8(p, flags2); p += 1;

      dv.setUint8(p, s.tempo2 || 6); p += 1;
      for (let k = 0; k < 16; k++) dv.setUint8(p + k, s.trkvol[k] || 64);
      p += 16;
      dv.setUint8(p, s.mastervol || 64); p += 1;
      dv.setUint8(p, withInstr ? 63 : 0); p += 1;

      for (let b = 0; b < s.blocks.length; b++) {
        const blk = s.blocks[b];
        const info = blockInfo[i][b];
        const q0 = blockOffsets[i][b];
        dv.setUint32(blockarrOff[i] + b * 4, q0, false);

        dv.setUint16(q0, blk.tracks, false);
        dv.setUint16(q0 + 2, blk.lines - 1, false);
        dv.setUint32(q0 + 4, info.info, false);
        let q = q0 + 8;
        for (let l = 0; l < blk.lines; l++) {
          for (let t = 0; t < blk.tracks; t++) {
            const c = blk.rows[l][t];
            dv.setUint8(q, c.note & 0x7f);
            dv.setUint8(q + 1, c.ins & 0x3f);
            dv.setUint8(q + 2, c.cmd & 0xff);
            dv.setUint8(q + 3, c.dat & 0xff);
            q += 4;
          }
        }

        dv.setUint32(info.info + 0, info.hl, false);
        dv.setUint32(info.info + 4, info.name, false);
        dv.setUint32(info.info + 8, info.nameLen, false);
        dv.setUint32(info.info + 12, 0, false);

        const words = Math.ceil(blk.lines / 32);
        for (let w = 0; w < words; w++) {
          let value = 0;
          for (let bit = 0; bit < 32; bit++) {
            const line = w * 32 + bit;
            if (line < blk.lines && blk.highlight && blk.highlight[line]) value |= (1 << bit);
          }
          dv.setUint32(info.hl + w * 4, value >>> 0, false);
        }

        const name = (blk.name || '') + '\0';
        for (let k = 0; k < name.length; k++) dv.setUint8(info.name + k, name.charCodeAt(k) & 0xff);
      }
    }

    /* ---- instrument table and payloads, shared by every song ---- */
    let jumpmask = 0;
    for (let i = 0; i < 32; i++) if (elements[i] && elements[i].jump) jumpmask |= (1 << i);

    if (withInstr) {
      for (let i = 0; i < 63; i++) dv.setUint32(smplarrOff + i * 4, sampleOffsets[i] || 0, false);
      for (let i = 0; i < 63; i++) {
        const inst = elements[i];
        if (!inst) continue;
        const at = sampleOffsets[i];
        if (inst.type === 'synth' || inst.type === 'hybrid') {
          writeSynth(dv, at, inst);
        } else {
          const data = inst.data || new Float32Array(0);
          dv.setUint32(at, data.length, false);
          dv.setInt16(at + 4, 0, false);
          for (let k = 0; k < data.length; k++) {
            dv.setInt8(at + 6 + k, Math.max(-128, Math.min(127, Math.round(data[k] * 127))));
          }
        }
      }
    }

    /* ---- expansion block per song, chained with nextmod ---- */
    for (let i = 0; i < n; i++) {
      const { e, anno, songname, s } = aux[i];
      dv.setUint32(e.exp + 0, i + 1 < n ? (i + 1) * 52 : 0, false);
      dv.setUint32(e.exp + 4, e.expSmp, false);
      dv.setUint16(e.exp + 8, 63, false);
      dv.setUint16(e.exp + 10, 4, false);
      dv.setUint32(e.exp + 12, e.anno, false);
      dv.setUint32(e.exp + 16, e.annoLen, false);
      dv.setUint32(e.exp + 20, e.iinfo, false);
      dv.setUint16(e.exp + 24, 63, false);
      dv.setUint16(e.exp + 26, 40, false);
      dv.setUint32(e.exp + 28, jumpmask, false);
      dv.setUint32(e.exp + 32, e.rgb, false);
      const ch = s.channels || 4;
      const split = ch >= 8 ? 0 : ch === 7 ? 0xff : ch === 6 ? 0xffff : ch === 5 ? 0xffffff : 0;
      dv.setUint32(e.exp + 36, split, false);
      dv.setUint32(e.exp + 40, s.notation ? e.ninfo : 0, false);
      dv.setUint32(e.exp + 44, e.songname, false);
      dv.setUint32(e.exp + 48, e.songnameLen, false);

      for (let k = 0; k < 63; k++) {
        const inst = elements[k];
        const o = e.expSmp + k * 4;
        dv.setUint8(o, inst ? inst.hold || 0 : 0);
        dv.setUint8(o + 1, inst ? inst.decay || 0 : 0);
        dv.setUint8(o + 2, inst && inst.suppressOff ? 1 : 0);
        dv.setInt8(o + 3, inst ? MW.clamp(inst.finetune || 0, -8, 7) : 0);
        const oi = e.iinfo + k * 40;
        const name = (inst && inst.name ? inst.name : '').slice(0, 39);
        for (let c = 0; c < 40; c++) dv.setUint8(oi + c, c < name.length ? name.charCodeAt(c) : 0);
      }

      for (let k = 0; k < anno.length; k++) dv.setUint8(e.anno + k, anno.charCodeAt(k) & 0xff);

      const rgb = [0x000, 0xeee, 0x48c, 0x4c4, 0xc44, 0xcc4, 0x46c, 0xccc];
      for (let k = 0; k < 8; k++) dv.setUint16(e.rgb + k * 2, rgb[k], false);

      MW.writeNotationInfo(dv, e.ninfo, s.notation);
      for (let k = 0; k < songname.length; k++) dv.setUint8(e.songname + k, songname.charCodeAt(k) & 0xff);
    }

    return buf.buffer;
  };

  /* ------------------------------------------------------------ MOD writer
   *
   * Export the first four tracks as a 31 instrument ProTracker module. MED
   * effects are translated back to their MOD equivalents; anything MOD has no
   * way to express (hold/decay, synthsounds, tracks 5-16, blocks over 64
   * lines) is dropped, which is what OctaMED itself did.
   */

  const MOD_PERIODS = [
    856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
    428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
    214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113
  ];

  function medToModEffect(cmd, dat, song) {
    switch (cmd) {
      case 0x0: return [0x0, dat];
      case 0x1: return [0x1, dat];
      case 0x2: return [0x2, dat];
      case 0x3: return [0x3, dat];
      case 0x4: return [0x4, dat];
      case 0x5: return [0x4, dat];
      case 0x8: return [0x0, 0x00];
      case 0x9: return [0xf, Math.min(0x1f, dat)];
      case 0x19: return [0x9, dat];          // sample offset, same idea
      case 0xa: return [0xa, dat];
      case 0xb: return [0xb, dat];
      case 0xc: return [0xc, Math.min(64, dat)];
      case 0xd: return [0xa, dat];
      case 0xe: return [0x0, 0x00];
      case 0xf:
        if (dat === 0) return [0xd, 0x00];
        if (dat >= 0xf1) return [0x0, 0x00];
        if (dat <= 0x20) return [0xf, dat];
        return [0xf, MW.clamp(Math.round(125 * dat / 33), 0x20, 0xff)];
      default: return [0x0, 0x00];
    }
  }

  function resampleTo(data, from, to) {
    if (!data || !from || Math.abs(from - to) < 1) return data;
    const n = Math.max(1, Math.round(data.length * to / from));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * from / to;
      const a = Math.floor(p);
      const f = p - a;
      out[i] = (data[a] || 0) * (1 - f) + (data[a + 1] || 0) * f;
    }
    return out;
  }

  MW.writeMOD = function (song) {
    const patterns = [];
    const order = [];
    const map = new Map();

    const seq = song.playseq.slice(0, 128);
    for (const b of seq) {
      if (b >= song.blocks.length) { order.push(0); continue; }
      if (!map.has(b)) {
        if (patterns.length >= 128) { order.push(0); continue; }
        map.set(b, patterns.length);
        patterns.push(song.blocks[b]);
      }
      order.push(map.get(b));
    }
    if (!patterns.length) patterns.push(song.blocks[0]);

    const samples = [];
    for (let i = 0; i < 31; i++) {
      const inst = song.instruments[i];
      if (!inst || !inst.data || inst.synth) { samples.push(null); continue; }
      samples.push({
        name: (inst.name || '').slice(0, 22),
        data: resampleTo(inst.data, inst.c2rate || 8363, 8363),
        volume: MW.clamp(inst.volume == null ? 64 : inst.volume, 0, 64),
        loop: inst.loop || 0,
        looplen: inst.looplen || 0
      });
    }

    let size = 1084 + patterns.length * 64 * 4 * 4;
    for (const s of samples) if (s) size += Math.ceil(s.data.length / 2) * 2;

    const buf = new Uint8Array(size);
    const dv = new DataView(buf.buffer);
    let p = 0;

    const title = (song.name || '').slice(0, 20);
    for (let i = 0; i < 20; i++) buf[i] = i < title.length ? title.charCodeAt(i) & 0xff : 0;
    p = 20;

    let sampleDataAt = 1084 + patterns.length * 64 * 4 * 4;
    let dataCursor = sampleDataAt;

    for (let i = 0; i < 31; i++) {
      const s = samples[i];
      for (let k = 0; k < 22; k++) buf[p + k] = s && k < s.name.length ? s.name.charCodeAt(k) & 0xff : 0;
      if (s) {
        const lenWords = Math.ceil(s.data.length / 2);
        dv.setUint16(p + 22, lenWords, false);
        buf[p + 24] = 0;                                   // finetune
        buf[p + 25] = s.volume;
        dv.setUint16(p + 26, s.looplen > 2 ? Math.floor(s.loop / 2) : 0, false);
        dv.setUint16(p + 28, s.looplen > 2 ? Math.floor(s.looplen / 2) : 1, false);
        for (let k = 0; k < lenWords * 2; k++) {
          const v = s.data[k] || 0;
          buf[dataCursor + k] = Math.max(-128, Math.min(127, Math.round(v * 127))) & 0xff;
        }
        dataCursor += lenWords * 2;
      } else {
        dv.setUint16(p + 28, 1, false);
      }
      p += 30;
    }

    buf[p] = order.length;
    buf[p + 1] = 127;
    p += 2;
    for (let i = 0; i < 128; i++) buf[p + i] = i < order.length ? order[i] : 0;
    p += 128;

    buf[p] = 0x4d; buf[p + 1] = 0x2e; buf[p + 2] = 0x4b; buf[p + 3] = 0x2e;   // M.K.
    p += 4;

    for (const block of patterns) {
      const tracks = Math.min(4, block.tracks);
      for (let line = 0; line < 64; line++) {
        for (let t = 0; t < 4; t++) {
          let note = 0, ins = 0, fx = 0, par = 0;
          if (line < block.lines && t < tracks) {
            const c = block.rows[line][t];
            note = c.note;
            ins = c.ins;
            [fx, par] = medToModEffect(c.cmd, c.dat, song);
          }
          let period = 0;
          if (note > 0 && note <= MOD_PERIODS.length) period = MOD_PERIODS[note - 1];
          if (ins > 31) ins = 0;
          buf[p] = ((ins & 0xf0)) | ((period >> 8) & 0x0f);
          buf[p + 1] = period & 0xff;
          buf[p + 2] = (((ins & 0x0f) << 4) | (fx & 0x0f)) & 0xff;
          buf[p + 3] = par & 0xff;
          p += 4;
        }
      }
    }

    return buf.buffer;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
