// @ts-check
/* Octanaut - module loaders: MMD0-3/MMDC, MED2/3/4 song files, ProTracker MOD, MSH, 8SVX */
(function (global) {
  'use strict';
  const MW = global.MW;

  /* ---------------------------------------------------------------- utils */

  const u16 = (dv, o) => dv.getUint16(o, false);
  const i16 = (dv, o) => dv.getInt16(o, false);
  const u32 = (dv, o) => dv.getUint32(o, false);
  const u8 = (dv, o) => dv.getUint8(o);
  const i8 = (dv, o) => dv.getInt8(o);

  function hasBytes(dv, offset, size) {
    return offset >= 0 && size >= 0 && offset <= dv.byteLength && size <= dv.byteLength - offset;
  }

  function requireBytes(dv, offset, size, description) {
    if (!hasBytes(dv, offset, size)) throw new Error('Truncated ' + description);
  }

  // Names and annotations are optional. Invalid spans must not prevent the
  // musical data from loading, nor let one string spill into another table.
  function optionalText(dv, offset, size, limit) {
    if (!offset || !hasBytes(dv, offset, size)) return '';
    let value = '';
    for (let i = 0; i < Math.min(size, limit); i++) {
      const c = u8(dv, offset + i);
      if (!c) break;
      value += String.fromCharCode(c);
    }
    return value.trim();
  }

  function tag(dv, o) {
    return String.fromCharCode(u8(dv, o), u8(dv, o + 1), u8(dv, o + 2), u8(dv, o + 3));
  }

  /* OctaMED Pro instrument type bits: 0x10 = 16 bit, 0x20 = stereo.
     Stereo data is not interleaved: one whole channel follows the other, and
     the length field covers a single channel. */
  function mmdPcm(dv, off, length, type) {
    const is16 = !!(type & 0x10);
    const stereo = !!(type & 0x20);
    const frameBytes = is16 ? 2 : 1;
    const chBytes = Math.max(0, length);
    const frames = Math.floor(chBytes / frameBytes);
    const base = off + 6;
    const rightOff = stereo ? chBytes : 0;
    const limit = dv.byteLength;
    const left = new Float32Array(frames);
    const right = stereo ? new Float32Array(frames) : null;

    for (let i = 0; i < frames; i++) {
      const p = base + i * frameBytes;
      if (p + frameBytes > limit) break;
      left[i] = is16 ? dv.getInt16(p, false) / 32768 : dv.getInt8(p) / 128;
      if (right) {
        const q = base + rightOff + i * frameBytes;
        right[i] = (q + frameBytes <= limit)
          ? (is16 ? dv.getInt16(q, false) / 32768 : dv.getInt8(q) / 128)
          : left[i];
      }
    }
    return { left, right };
  }

  function pcm8(dv, off, len) {
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = dv.getInt8(off + i) / 128;
    return out;
  }

  /* ------------------------------------------------------------- MMD read */

  function readSynth(dv, base, type) {
    /** @type {any} */
    const synth = { voltbllen: 0, wftbllen: 0, volspeed: 1, wfspeed: 1, waveforms: [] };
    const voltbllen = u16(dv, base + 14);
    const wftbllen = u16(dv, base + 16);
    const wforms = u16(dv, base + 20);
    synth.volspeed = u8(dv, base + 18) || 1;
    synth.wfspeed = u8(dv, base + 19) || 1;
    synth.voltbllen = voltbllen;
    synth.wftbllen = wftbllen;
    synth.voltbl = [];
    synth.wftbl = [];
    for (let i = 0; i < Math.min(voltbllen, 128); i++) synth.voltbl.push(u8(dv, base + 22 + i));
    for (let i = 0; i < Math.min(wftbllen, 128); i++) synth.wftbl.push(u8(dv, base + 150 + i));

    const wfBase = base + 278;
    for (let i = 0; i < Math.min(wforms, 64); i++) {
      const off = u32(dv, wfBase + i * 4);
      if (!off) { synth.waveforms.push(new Float32Array(2)); continue; }
      const p = base + off;
      if (type === -2 && i === 0) {
        // hybrid: wf[0] is a sample header
        const len = u32(dv, p);
        synth.hybridLength = len;
        synth.hybridData = pcm8(dv, p + 6, Math.min(len, dv.byteLength - p - 6));
        synth.waveforms.push(synth.hybridData);
      } else {
        const words = u16(dv, p);
        const len = words * 2;
        synth.waveforms.push(pcm8(dv, p + 2, Math.min(len, dv.byteLength - p - 2)));
      }
    }
    return synth;
  }

  function mmdBlock(dv, off, id, packed) {
    requireBytes(dv, off, id === 0 ? 2 : 8, 'MMD block header');
    let tracks, lines, p;
    if (id === 0) {
      tracks = u8(dv, off);
      lines = u8(dv, off + 1) + 1;
      p = off + 2;
    } else {
      tracks = u16(dv, off);
      lines = u16(dv, off + 2) + 1;
      p = off + 8;
    }
    if (tracks < 1 || tracks > 16 || lines > (id >= 1 ? 3200 : 256)) {
      throw new Error('Invalid MMD block dimensions');
    }
    const block = MW.createBlock(tracks, lines);

    /* MMD1 and later carry a BlockInfo struct after the header */
    if (id >= 1) {
      const info = u32(dv, off + 4);
      if (info && hasBytes(dv, info, 12)) {
        const namePtr = u32(dv, info + 4);
        const nameLen = u32(dv, info + 8);
        block.name = optionalText(dv, namePtr, nameLen, 256);
        const hlPtr = u32(dv, info);
        if (hlPtr && hasBytes(dv, hlPtr, Math.ceil(lines / 32) * 4)) {
          for (let l = 0; l < lines; l++) {
            const word = u32(dv, hlPtr + (l >> 5) * 4);
            block.highlight[l] = (word >>> (l & 31)) & 1;
          }
        }
      }
    }

    const size = tracks * lines * (id === 0 ? 3 : 4);
    let cells = dv;
    if (packed) {
      // MMDC keeps the MMD0 header and sample layout. Only pattern bytes
      // are packed: 0..127 introduce 1..128 literals; 128..255 skip zeros.
      const bytes = new Uint8Array(size);
      let written = 0;
      while (written < size) {
        requireBytes(dv, p, 1, 'MMDC pattern');
        const control = u8(dv, p++);
        const count = Math.min(control < 128 ? control + 1 : 256 - control, size - written);
        if (control < 128) {
          requireBytes(dv, p, count, 'MMDC literal run');
          bytes.set(new Uint8Array(dv.buffer, dv.byteOffset + p, count), written);
          p += count;
        }
        written += count;
      }
      cells = new DataView(bytes.buffer);
      p = 0;
    } else {
      requireBytes(dv, p, size, 'MMD pattern');
    }
    for (let l = 0; l < lines; l++) {
      for (let t = 0; t < tracks; t++) {
        const c = block.rows[l][t];
        if (id === 0) {
          const b0 = u8(cells, p), b1 = u8(cells, p + 1), b2 = u8(cells, p + 2);
          p += 3;
          c.note = b0 & 0x3f;
          c.ins = (b1 >> 4) | ((b0 & 0x80) >> 3) | ((b0 & 0x40) >> 1);
          c.cmd = b1 & 0x0f;
          c.dat = b2;
        } else {
          const n = u8(dv, p), i = u8(dv, p + 1), cm = u8(dv, p + 2), d = u8(dv, p + 3);
          p += 4;
          c.note = n & 0x7f;
          c.ins = i & 0x3f;
          /* MMD1 and later use the whole byte: 0x10-0x2F are their own
             commands (0x19 is sample offset). Masking the nibble turns
             those into 0x09, i.e. secondary tempo. */
          c.cmd = cm;
          c.dat = d;
        }
      }
    }
    return block;
  }

  function mmdSong(dv, base, id, packed) {
    /* the header lives at base, but every pointer it holds is an absolute
       offset from the start of the file, second song onward included */
    requireBytes(dv, base, 52, 'MMD header');
    const songPtr = u32(dv, base + 8);
    const blockArr = u32(dv, base + 16);
    const smplArr = u32(dv, base + 24);
    const expPtr = u32(dv, base + 32);

    const s = MW.createSong();
    s.channels = 4;

    let numblocks = 0, songlen = 0, numsamples = 0;
    if (songPtr) {
      requireBytes(dv, songPtr, 788, 'MMD song');
      numblocks = u16(dv, songPtr + 504);
      songlen = u16(dv, songPtr + 506);
      s.deftempo = u16(dv, songPtr + 764) || 33;
      s.playtransp = i8(dv, songPtr + 766);
      const flags = u8(dv, songPtr + 767);
      s.flags.filteron = flags & 0x01;
      s.flags.jumping = flags & 0x02;
      s.flags.jump8th = flags & 0x04;
      s.flags.volhex = flags & 0x10;
      s.flags.stslide = flags & 0x20;
      s.flags.eightchannel = flags & 0x40;
      s.tempo2 = u8(dv, songPtr + 769) || 6;
      for (let i = 0; i < 16; i++) s.trkvol[i] = u8(dv, songPtr + 770 + i) || 64;
      s.mastervol = u8(dv, songPtr + 786) || 64;
      numsamples = u8(dv, songPtr + 787);

      /* flags2 lives at the same offset in every song struct */
      const flags2 = u8(dv, songPtr + 768);
      s.bpmMode = !!(flags2 & 0x20);
      s.linesPerBeat = (flags2 & 0x1f) + 1;
      s.mixing = !!(flags2 & 0x80);

      if (id >= 2) {
        /* MMD2/MMD3 replace the inline playseq with a section table and a
           table of PlaySeq structs; flatten them into one block list */
        const pseqtab = u32(dv, songPtr + 508);
        const sectab = u32(dv, songPtr + 512);
        const trkvols = u32(dv, songPtr + 516);
        const numtracks = u16(dv, songPtr + 520);
        const trackpans = u32(dv, songPtr + 524);
        const flags3 = u32(dv, songPtr + 528);

        s.numtracks = numtracks;
        s.stereo = !!(flags3 & 0x01);
        s.pans = new Array(16).fill(0);

        s.playseq = [];
        for (let i = 0; i < songlen && i < 256; i++) {
          const sec = u16(dv, sectab + i * 2);
          const ps = u32(dv, pseqtab + sec * 4);
          if (!ps) continue;
          const len = Math.min(u16(dv, ps + 40), 256);
          for (let k = 0; k < len; k++) s.playseq.push(u16(dv, ps + 42 + k * 2));
        }

        if (trkvols) {
          for (let i = 0; i < 16; i++) s.trkvol[i] = u8(dv, trkvols + i) || 64;
        }
        if (trackpans) {
          for (let i = 0; i < 16; i++) s.pans[i] = i8(dv, trackpans + i);
        }
      } else {
        songlen = Math.min(songlen, 256);
        s.playseq = [];
        for (let i = 0; i < songlen; i++) s.playseq.push(u8(dv, songPtr + 508 + i));
      }

      if (!s.playseq.length) s.playseq = [0];

      // per instrument song fields
      s.instrumentSong = [];
      for (let i = 0; i < 63; i++) {
        const o = songPtr + i * 8;
        s.instrumentSong.push({
          rep: u16(dv, o),
          replen: u16(dv, o + 2),
          midich: u8(dv, o + 4),
          midipreset: u8(dv, o + 5),
          svol: u8(dv, o + 6) || 64,
          strans: i8(dv, o + 7)
        });
      }
    }

    // blocks
    s.blocks = [];
    requireBytes(dv, blockArr, numblocks * 4, 'MMD block table');
    for (let i = 0; i < numblocks; i++) {
      const p = u32(dv, blockArr + i * 4);
      s.blocks.push(p ? mmdBlock(dv, p, id, packed) : MW.createBlock(4, 64));
    }
    if (!s.blocks.length) s.blocks = [MW.createBlock(4, 64)];

    // instruments
    const instruments = new Array(63).fill(null);
    requireBytes(dv, smplArr, Math.min(numsamples, 63) * 4, 'MMD sample table');
    for (let i = 0; i < Math.min(numsamples, 63); i++) {
      const p = u32(dv, smplArr + i * 4);
      if (!p) continue;
      const at = p;
      requireBytes(dv, at, 6, 'MMD sample header');
      const length = u32(dv, at);
      const type = i16(dv, at + 4);
      const inst = MW.createInstrument(type >= 0 ? 'sample' : type === -2 ? 'hybrid' : 'synth');
      inst.volume = 64;
      if (type >= 0) {
        const pcm = mmdPcm(dv, at, length, type);
        inst.data = pcm.left;
        if (pcm.right) inst.dataR = pcm.right;
        inst.c2rate = 8363;
        inst.loop = 0;
        inst.looplen = 0;
        inst.bits16 = !!(type & 0x10);
        inst.stereo16 = (type & 0x30) === 0x30;
      } else {
        inst.synth = readSynth(dv, at, type);
        inst.data = inst.synth.hybridData || null;
        if (inst.synth.voltbl) {
          const tbl = inst.synth.voltbl;
          // volume table byte 0 is the initial volume
          if (tbl.length && tbl[0] < 0x80) inst.volume = Math.min(64, tbl[0]);
        }
      }
      instruments[i] = inst;
    }

    // expansion block
    let annotxt = '';
    let songName = '';
    if (expPtr && hasBytes(dv, expPtr, 28)) {
      const e = expPtr;
      const expSmp = u32(dv, e + 4);
      const sExtEntries = u16(dv, e + 8);
      const sExtEntrsz = u16(dv, e + 10) || 4;
      const iExtEntries = u16(dv, e + 24);
      const iExtEntrsz = u16(dv, e + 26) || 40;
      const namesPtr = u32(dv, e + 20);

      for (let i = 0; i < Math.min(sExtEntries, 63); i++) {
        const oe = expSmp + i * sExtEntrsz;
        const inst = instruments[i];
        if (!inst || !expSmp || !hasBytes(dv, oe, sExtEntrsz)) continue;
        if (sExtEntrsz >= 2) { inst.hold = u8(dv, oe); inst.decay = u8(dv, oe + 1); }
        if (sExtEntrsz >= 3) inst.suppressOff = !!u8(dv, oe + 2);
        if (sExtEntrsz >= 4) inst.finetune = i8(dv, oe + 3);
      }
      for (let i = 0; i < Math.min(iExtEntries, 63); i++) {
        const oi = namesPtr + i * iExtEntrsz;
        if (!namesPtr || !hasBytes(dv, oi, iExtEntrsz)) continue;
        const nm = optionalText(dv, oi, Math.min(iExtEntrsz, 40), 40);
        let inst = instruments[i];
        if (!inst && nm) {
          inst = MW.createInstrument('sample');
          inst.missing = true;
          instruments[i] = inst;
        }
        if (inst) inst.name = nm;
      }
      const aPtr = u32(dv, e + 12);
      const aLen = u32(dv, e + 16);
      annotxt = optionalText(dv, aPtr, aLen, 4000);
      if (hasBytes(dv, e, 44)) s.notation = MW.readNotationInfo(dv, u32(dv, e + 40));
      if (hasBytes(dv, e, 52)) {
        songName = optionalText(dv, u32(dv, e + 44), u32(dv, e + 48), 256);
      }
    }

    // merge song-level instrument data
    if (s.instrumentSong) {
      for (let i = 0; i < 63; i++) {
        const is = s.instrumentSong[i];
        const inst = instruments[i];
        if (!inst) continue;
        inst.volume = inst.type === 'sample' ? (is.svol || 64) : inst.volume;
        inst.transpose = is.strans;
        inst.midiChannel = is.midich;
        inst.midiPreset = is.midipreset;
        if (is.replen > 1) {
          const frameBytes = inst.bits16 ? 2 : 1;
          inst.loop = Math.round((is.rep * 2) / frameBytes);
          inst.looplen = Math.round((is.replen * 2) / frameBytes);
        }
      }
    }

    // name from the first instrument-independent source
    if (annotxt && !songName) songName = annotxt.split('\n')[0].slice(0, 40);
    s.annotation = annotxt;
    s.instruments = instruments;
    s.name = songName || 'module';
    s.channels = Math.max(4, s.numtracks || 0, ...s.blocks.map(b => b.tracks));
    s.numblocks = s.blocks.length;

    // multi-module chain
    s.multiNext = 0;
    if (expPtr && hasBytes(dv, expPtr, 4)) s.multiNext = u32(dv, expPtr);
    return s;
  }

  function loadMMD(buffer) {
    const dv = new DataView(buffer);
    if (buffer.byteLength < 64) return null;
    const idTag = tag(dv, 0);
    if (!/^MMD[0-3C]$/.test(idTag)) return null;
    const packed = idTag === 'MMDC';
    const id = packed ? 0 : parseInt(idTag[3], 10);

    const first = mmdSong(dv, 0, id, packed);
    // follow nextmod chain for multi-modules
    const seen = new Set([0]);
    let next = first.multiNext;
    let guard = 0;
    while (next && !seen.has(next) && guard++ < 32) {
      if (!hasBytes(dv, next, 52)) break;
      const nextTag = tag(dv, next);
      if (!/^M(?:MD|CN)[0-3C]$/.test(nextTag)) break;
      seen.add(next);
      const nextPacked = nextTag[3] === 'C';
      const s = mmdSong(dv, next, nextPacked ? 0 : parseInt(nextTag[3], 10), nextPacked);
      first.multis.push(s);
      next = s.multiNext;
    }
    first.format = idTag;
    return first;
  }

  /* ------------------------------------------------------------- MED4 read */

  function BitStream(dv, start) {
    let ptr = start, nibbleHi = true, value = 0;
    this.read4 = function () {
      if (nibbleHi) {
        value = dv.getUint8(ptr++);
        nibbleHi = false;
        return value >> 4;
      }
      nibbleHi = true;
      return value & 0x0f;
    };
    this.read8 = () => (this.read4() << 4) | this.read4();
    this.read12 = () => (this.read4() << 8) | (this.read4() << 4) | this.read4();
    this.read16 = () => (this.read4() << 12) | (this.read4() << 8) | (this.read4() << 4) | this.read4();
    this.aligned16 = function (bits) {
      if (bits <= 4) return this.read4() << 12;
      if (bits <= 8) return this.read8() << 8;
      if (bits <= 12) return this.read12() << 4;
      return this.read16();
    };
  }

  function loadMED(buffer) {
    const dv = new DataView(buffer);
    const ver = u8(dv, 3);
    if (tag(dv, 0).slice(0, 3) !== 'MED') return null;
    if (ver === 2) return loadMED2(dv);
    if (ver !== 4) {
      if (ver === 3) {
        const err = new Error('MED 2.00 song files use a format this build cannot read yet. Open the file in OctaMED and save it as a module (MMD0).');
        /** @type {any} */ (err).friendly = true;
        throw err;
      }
      return null;
    }

    let pos = 4;
    let m0 = u8(dv, pos++);
    let mask = 0n, masksz = 0;
    for (let i = 0; m0 !== 0 && i < 8; i++, m0 = (m0 << 1) & 0xff) {
      if (m0 & 0x80) {
        mask = (mask << 8n) | BigInt(u8(dv, pos++));
        masksz++;
      }
    }
    if (masksz > 0) mask <<= BigInt(8 * (8 - masksz));

    const temp = [];
    for (let i = 0; i < 64; i++) temp.push({ name: '', loopStart: 0, loopEnd: 0, volume: 64, transpose: 0 });

    let numIns = 0;
    let mm = mask;
    for (let i = 0; mm !== 0n && i < 64; i++, mm = (mm << 1n) & 0xffffffffffffffffn) {
      if ((mm & 0x8000000000000000n) === 0n) continue;
      numIns = i + 1;
      const c = u8(dv, pos++);
      const size = u8(dv, pos++);
      let nm = '';
      for (let j = 0; j < size; j++) nm += String.fromCharCode(u8(dv, pos++));
      let loopStart = 0, loopLen = 0;
      if ((c & 0x01) === 0) loopStart = u16(dv, pos) << 1, pos += 2;
      if ((c & 0x02) === 0) loopLen = u16(dv, pos) << 1, pos += 2;
      if ((c & 0x04) === 0) pos += 1;
      if ((c & 0x08) === 0) pos += 1;
      if ((c & 0x30) === 0) temp[i].volume = u8(dv, pos), pos += 1;
      if ((c & 0x40) === 0) temp[i].transpose = i8(dv, pos), pos += 1;
      temp[i].name = nm.trim();
      temp[i].loopStart = loopStart;
      temp[i].loopEnd = loopStart + loopLen;
    }

    const numPat = u16(dv, pos); pos += 2;
    const songLen = u16(dv, pos); pos += 2;
    const playseq = [];
    for (let i = 0; i < songLen; i++) playseq.push(u8(dv, pos++));

    const tempo = u16(dv, pos); pos += 2;
    const transp = i8(dv, pos); pos += 1;
    const flags = u8(dv, pos); pos += 1;
    let spd = u16(dv, pos); pos += 2;
    pos += 20;
    const trkvol = [];
    for (let i = 0; i < 16; i++) trkvol.push(u8(dv, pos++));
    const mastervol = u8(dv, pos++);

    // patterns: first pass measures each pattern to find the widest one
    const pats = [];
    let channels = 4;
    const patPos = pos;
    for (let i = 0; i < numPat; i++) {
      const size = u8(dv, pos);
      const chn = u8(dv, pos + 1);
      const plen = u16(dv, pos + 3);
      channels = Math.max(channels, chn);
      pos += 1 + size + plen;
      if (pos <= 0 || pos > dv.byteLength) break;
    }
    pos = patPos;

    for (let i = 0; i < numPat; i++) {
      const start = pos;
      const size = u8(dv, pos);
      const chn = Math.max(1, Math.min(16, u8(dv, pos + 1)));
      const rows = u8(dv, pos + 2) + 1;
      const plen = u16(dv, pos + 3);
      pos += 5;

      const ctl = [];
      for (let j = 0; j < 4 && rows > j * 64; j++) ctl.push(u8(dv, pos++));

      const lineMask = new Array(8).fill(0);
      const fxMask = new Array(8).fill(0);
      let numMasks = 0;
      for (let y = 0; y < 8 && rows > y * 32; y++) {
        const c = ctl[Math.floor(y / 2)] || 0;
        const s = 4 * (y % 2);
        const lmFull = (c & (0x80 >> s)) ? true : (c & (0x40 >> s)) ? false : null;
        const lm = lmFull === true ? 0xffffffff : lmFull === false ? 0 : u32(dv, pos);
        if (lmFull === null) pos += 4;
        const fmFull = (c & (0x20 >> s)) ? true : (c & (0x10 >> s)) ? false : null;
        const fm = fmFull === true ? 0xffffffff : fmFull === false ? 0 : u32(dv, pos);
        if (fmFull === null) pos += 4;
        lineMask[y] = lm >>> 0;
        fxMask[y] = fm >>> 0;
        numMasks++;
      }

      const block = MW.createBlock(chn, rows);
      const bs = new BitStream(dv, start + 1 + size);
      for (let y = 0; y < numMasks; y++) {
        for (let j = 0; j < 32; j++) {
          const line = y * 32 + j;
          if (line >= rows) break;

          if (lineMask[y] & 0x80000000) {
            let chmsk = bs.aligned16(chn);
            for (let k = 0; k < chn; k++, chmsk = (chmsk << 1) & 0xffff) {
              if (chmsk & 0x8000) {
                const x = bs.read12();
                const cell = block.rows[line][k];
                cell.note = x >> 4;
                cell.ins = x & 0x0f;
              }
            }
          }
          if (fxMask[y] & 0x80000000) {
            let chmsk = bs.aligned16(chn);
            for (let k = 0; k < chn; k++, chmsk = (chmsk << 1) & 0xffff) {
              if (chmsk & 0x8000) {
                const x = bs.read12();
                const cell = block.rows[line][k];
                cell.cmd = x >> 8;
                cell.dat = x & 0xff;
              }
            }
          }
          lineMask[y] = (lineMask[y] << 1) >>> 0;
          fxMask[y] = (fxMask[y] << 1) >>> 0;
        }
      }
      pats.push(block);
      pos = start + 1 + size + plen;
    }

    const s = MW.createSong();
    s.name = 'song';
    s.blocks = pats.length ? pats : [MW.createBlock(4, 64)];
    s.playseq = playseq.length ? playseq : [0];
    s.channels = channels;
    s.deftempo = tempo || 33;
    s.playtransp = transp;
    s.tempo2 = spd || 6;
    if (spd === 0) s.tempo2 = (flags & 0x20) ? 5 : 6;
    s.flags.eightchannel = flags & 0x40;
    s.flags.filteron = flags & 0x01;
    s.flags.stslide = flags & 0x20;
    s.trkvol = trkvol.map(v => v || 64);
    s.mastervol = mastervol || 64;
    s.instruments = new Array(63).fill(null);

    // instruments / samples
    const hasSamples = (flags & 0x08) !== 0;
    if (!hasSamples) {
      // song file: instruments live on disk, nothing to load
      for (let i = 0; i < numIns; i++) {
        const inst = MW.createInstrument('sample');
        inst.name = temp[i].name;
        inst.volume = temp[i].volume;
        inst.transpose = temp[i].transpose;
        inst.missing = true;
        s.instruments[i] = inst;
      }
      s.format = 'MED4 (song)';
      return s;
    }

    const M64 = 0xffffffffffffffffn;
    let mask2 = (BigInt(u32(dv, pos)) << 32n) | BigInt(u32(dv, pos + 4));
    pos += 8;
    mask2 = (mask2 << 1n) & M64;   // instrument 0 is never stored

    for (let i = 0; mask2 !== 0n && i < numIns; i++, mask2 = (mask2 << 1n) & M64) {
      if ((mask2 & 0x8000000000000000n) === 0n) continue;
      const length = u32(dv, pos); pos += 4;
      const type = i16(dv, pos); pos += 2;
      if (type >= 0) {
        const inst = MW.createInstrument('sample');
        inst.name = (temp[i] && temp[i].name) || '';
        inst.volume = (temp[i] && temp[i].volume) || 64;
        inst.transpose = (temp[i] && temp[i].transpose) || 0;
        inst.data = pcm8(dv, pos, Math.min(length, dv.byteLength - pos));
        pos += length;
        if (temp[i] && temp[i].loopEnd > 2) {
          inst.loop = temp[i].loopStart;
          inst.looplen = temp[i].loopEnd - temp[i].loopStart;
        }
        s.instruments[i] = inst;
      } else {
        const synth = readSynth(dv, pos - 6, type);
        const inst = MW.createInstrument(type === -2 ? 'hybrid' : 'synth');
        inst.name = (temp[i] && temp[i].name) || '';
        inst.volume = (temp[i] && temp[i].volume) || 64;
        inst.transpose = (temp[i] && temp[i].transpose) || 0;
        inst.synth = synth;
        inst.data = synth.hybridData || null;
        if (temp[i] && temp[i].loopEnd > 2) {
          inst.loop = temp[i].loopStart;
          inst.looplen = temp[i].loopEnd - temp[i].loopStart;
        }
        s.instruments[i] = inst;
        pos += length;
      }
    }

    // trailing chunks: MEDV / ANNO
    while (pos + 8 <= dv.byteLength) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4);
      pos += 8;
      if (size <= 0 || pos + size > dv.byteLength) break;
      if (id === 'ANNO') {
        let out = '';
        for (let i = 0; i < Math.min(size, 1024); i++) {
          const ch = u8(dv, pos + i);
          if (!ch) break;
          out += String.fromCharCode(ch);
        }
        s.annotation = out.trim();
      }
      pos += size;
    }

    s.format = 'MED4';
    s.name = (s.annotation && s.annotation.split('\n')[0].slice(0, 40)) || 'song';
    return s;
  }

  /* MED 1.12 fixed-layout songs */
  function loadMED2(dv) {
    let pos = 4;
    pos += 40; // unused first name
    const names = [];
    for (let i = 0; i < 31; i++) {
      let nm = '';
      for (let k = 0; k < 40; k++) {
        const ch = u8(dv, pos++);
        if (!ch) { pos += 39 - k; break; }
        nm += String.fromCharCode(ch);
      }
      names.push(nm.trim());
    }
    const vols = [];
    pos += 1;
    for (let i = 0; i < 31; i++) vols.push(u8(dv, pos++));
    pos += 2;
    const loops = [];
    for (let i = 0; i < 31; i++) loops.push(u16(dv, pos)), pos += 2;
    pos += 2;
    const loopLens = [];
    for (let i = 0; i < 31; i++) loopLens.push(u16(dv, pos)), pos += 2;

    const numPat = u16(dv, pos); pos += 2;
    const playseq = [];
    for (let i = 0; i < 100; i++) playseq.push(u8(dv, pos++));
    const songLen = u16(dv, pos); pos += 2;
    const bpm = u16(dv, pos); pos += 2;
    pos += 2; // flags
    pos += 2; // sliding
    pos += 4; // jump mask
    pos += 16; // rgb

    const s = MW.createSong();
    s.blocks = [];
    for (let i = 0; i < numPat; i++) {
      pos += 4;
      const block = MW.createBlock(4, 64);
      for (let l = 0; l < 64; l++) {
        for (let t = 0; t < 4; t++) {
          const per = u16(dv, pos);
          const x = u8(dv, pos + 2);
          const dat = u8(dv, pos + 3);
          pos += 4;
          const cell = block.rows[l][t];
          cell.note = per ? MW.periodToNote(per) : 0;
          cell.ins = x >> 4;
          cell.cmd = x & 0x0f;
          cell.dat = dat;
        }
      }
      s.blocks.push(block);
    }
    s.playseq = playseq.slice(0, Math.max(1, songLen));
    s.channels = 4;
    s.tempo2 = 6;
    s.deftempo = bpm || 125;
    s.instruments = new Array(63).fill(null);
    for (let i = 0; i < 31; i++) {
      const inst = MW.createInstrument('sample');
      inst.name = names[i];
      inst.volume = vols[i] || 64;
      inst.loop = loops[i];
      inst.looplen = loopLens[i];
      s.instruments[i] = inst;
    }
    s.format = 'MED2';
    return s;
  }

  /* -------------------------------------------------------------- MOD read */

  const MOD_PERIODS = (() => {
    // ProTracker period table, octaves 1-3
    const t = [];
    const base = [856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
      428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
      214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113];
    return base;
  })();

  function modNoteFromPeriod(p) {
    if (!p) return 0;
    let best = 0, bestd = 1e9;
    for (let i = 0; i < MOD_PERIODS.length; i++) {
      const d = Math.abs(MOD_PERIODS[i] - p);
      if (d < bestd) { bestd = d; best = i + 1; }
    }
    return best;
  }

  function loadMOD(buffer) {
    const dv = new DataView(buffer);
    if (buffer.byteLength < 1084) return null;
    const id = String.fromCharCode(u8(dv, 1080), u8(dv, 1081), u8(dv, 1082), u8(dv, 1083));
    const known = ['M.K.', 'M!K!', 'M&K!', 'N.T.', 'FLT4', 'FLT8', 'CD81', '4CHN', '6CHN', '8CHN'];
    const isMod = known.includes(id) || /^[1-9]CHN$/.test(id);
    if (!isMod) return null;

    let channels = 4;
    if (/^[1-9]CHN$/.test(id)) channels = parseInt(id[0], 10);
    if (id === 'FLT8' || id === '8CHN') channels = 8;
    if (id === '6CHN') channels = 6;

    let name = '';
    for (let i = 0; i < 20; i++) {
      const ch = u8(dv, i);
      if (!ch) break;
      name += String.fromCharCode(ch);
    }

    const s = MW.createSong();
    s.instruments = new Array(63).fill(null);
    const smpInfo = [];
    let pos = 20;
    for (let i = 0; i < 31; i++) {
      let nm = '';
      for (let k = 0; k < 22; k++) {
        const ch = u8(dv, pos + k);
        if (!ch) break;
        nm += String.fromCharCode(ch);
      }
      const len = u16(dv, pos + 22) * 2;
      const fin = i8(dv, pos + 24);
      const vol = u8(dv, pos + 25);
      const rep = u16(dv, pos + 26) * 2;
      const replen = u16(dv, pos + 28) * 2;
      smpInfo.push({ name: nm.trim(), len, fin, vol, rep, replen });
      pos += 30;
    }
    const songLen = MW.clamp(u8(dv, pos++), 1, 128);
    pos++; // restart
    const order = [];
    for (let i = 0; i < 128; i++) order.push(u8(dv, pos++));
    pos += 4;                       // the 4 byte format signature, M.K. and friends
    let maxOrd = 0;
    for (let i = 0; i < songLen; i++) if (order[i] < 128) maxOrd = Math.max(maxOrd, order[i]);
    const numPat = Math.min(128, maxOrd + 1);

    // patterns
    const blocks = [];
    for (let p = 0; p < numPat; p++) {
      const block = MW.createBlock(channels, 64);
      for (let l = 0; l < 64; l++) {
        for (let c = 0; c < channels; c++) {
          const b0 = u8(dv, pos), b1 = u8(dv, pos + 1), b2 = u8(dv, pos + 2), b3 = u8(dv, pos + 3);
          pos += 4;
          const cell = block.rows[l][c];
          const period = ((b0 & 0x0f) << 8) | b1;
          cell.note = modNoteFromPeriod(period);
          cell.ins = (b0 & 0xf0) | (b2 >> 4);
          let fx = b2 & 0x0f, par = b3;
          switch (fx) {
            case 0x0: case 0x1: case 0x2: case 0x3: case 0x4: case 0xc:
              break;
            case 0x5: fx = 0x3; break;                    // porta + volslide -> porta
            case 0x6: fx = 0x4; break;                    // vibrato + volslide -> vibrato
            case 0x8: fx = 0; par = 0; break;             // no MED equivalent
            case 0x9: fx = 0; par = 0; break;             // sample offset
            case 0xa: fx = 0xd; break;                    // volume slide
            case 0xb: fx = 0xb; break;                    // position jump
            case 0xd: fx = 0xf; par = 0x00; break;        // pattern break -> next block
            case 0xe: fx = 0; par = 0; break;             // extended
            case 0xf:
              if (par < 0x20) { fx = 0x9; } else { fx = 0xf; par = Math.round(par * 33 / 125); }
              break;
            default: break;
          }
          cell.cmd = fx;
          cell.dat = par;
        }
      }
      blocks.push(block);
    }
    s.blocks = blocks;
    s.playseq = order.slice(0, songLen).filter((v, i, a) => v < blocks.length);
    if (!s.playseq.length) s.playseq = [0];
    s.channels = channels;
    s.deftempo = 33;
    s.tempo2 = 6;
    s.name = name.trim() || 'module';

    // sample data
    for (let i = 0; i < 31; i++) {
      const info = smpInfo[i];
      const inst = MW.createInstrument('sample');
      inst.name = info.name;
      inst.volume = Math.min(64, info.vol);
      inst.transpose = 0;
      inst.data = info.len ? pcm8(dv, pos, Math.min(info.len, dv.byteLength - pos)) : null;
      pos += info.len;
      if (info.replen > 1) { inst.loop = info.rep; inst.looplen = info.replen; }
      s.instruments[i] = inst;
    }
    s.format = 'ProTracker';
    return s;
  }

  /* -------------------------------------------------------- MSH synth file */

  function loadMSH(buffer) {
    const dv = new DataView(buffer);
    if (buffer.byteLength < 26 || tag(dv, 0) !== 'MSH\0') return null;
    const type = i16(dv, 4);
    const rep = u16(dv, 10);
    const replen = u16(dv, 12);
    const voltbllen = u16(dv, 14);
    const wftbllen = u16(dv, 16);
    const volspeed = u8(dv, 18) || 1;
    const wfspeed = u8(dv, 19) || 1;
    const wforms = u16(dv, 20);
    if (voltbllen > 128 || wftbllen > 128 || wforms > 64) return null;

    let pos = 22;
    const voltbl = [];
    for (let i = 0; i < voltbllen; i++) voltbl.push(u8(dv, pos++));
    const wftbl = [];
    for (let i = 0; i < wftbllen; i++) wftbl.push(u8(dv, pos++));
    const ptrs = [];
    for (let i = 0; i < wforms; i++) ptrs.push(u32(dv, pos)), pos += 4;

    const waveforms = [];
    for (const p of ptrs) {
      if (!p || p + 2 > dv.byteLength) { waveforms.push(new Float32Array(2)); continue; }
      const words = u16(dv, p);
      waveforms.push(pcm8(dv, p + 2, Math.min(words * 2, dv.byteLength - p - 2)));
    }

    const inst = MW.createInstrument(type === -2 ? 'hybrid' : 'synth');
    inst.synth = { voltbl, wftbl, volspeed, wfspeed, waveforms };
    inst.loop = rep;
    inst.looplen = replen;
    inst.volume = voltbl.length && voltbl[0] < 0x80 ? Math.min(64, voltbl[0]) : 64;
    inst.name = '';
    return inst;
  }

  /* --------------------------------------------------------- IFF 8SVX read */

  function load8SVX(buffer) {
    const dv = new DataView(buffer);
    if (buffer.byteLength < 12 || tag(dv, 0) !== 'FORM' || tag(dv, 8) !== '8SVX') return null;
    const end = u32(dv, 4) + 8;
    if (end > dv.byteLength || end < 12) throw new Error('Truncated or invalid 8SVX FORM');
    let pos = 12;
    /** @type {any} */
    let inst = null;
    let name = '';
    while (pos + 8 <= end) {
      const id = tag(dv, pos);
      const size = u32(dv, pos + 4);
      const body = pos + 8;
      if (body + size + (size & 1) > end) throw new Error('Truncated 8SVX chunk');
      if (id === 'NAME') {
        let nm = '';
        for (let i = 0; i < size; i++) nm += String.fromCharCode(u8(dv, body + i));
        name = nm.replace(/\0.*$/, '').trim();
      } else if (id === 'VHDR') {
        if (size < 20) throw new Error('Invalid 8SVX voice header');
        if (u8(dv, body + 15) !== 0) throw new Error('Compressed 8SVX is not supported');
        const oneShot = u32(dv, body);
        const repeat = u32(dv, body + 4);
        const rate = u16(dv, body + 12);
        const octaves = u8(dv, body + 14);
        const vol = u32(dv, body + 16);
        inst = MW.createInstrument('sample');
        inst.loop = oneShot;
        inst.looplen = repeat;
        inst.volume = Math.min(64, Math.round((vol / 65536) * 64));
        inst.octaves = octaves || 1;
        inst.c2rate = rate || 8363;
      } else if (id === 'BODY') {
        if (!inst) inst = MW.createInstrument('sample');
        inst.data = pcm8(dv, body, size);
      }
      pos = body + size + (size & 1);
    }
    if (!inst || !inst.data) return null;
    inst.name = name || inst.name;
    return inst;
  }

  /* ------------------------------------------------------------ dispatch */

  MW.loadModule = function (buffer) {
    let song = loadMMD(buffer);
    if (song) return song;
    song = loadMED(buffer);
    if (song) return song;
    song = loadMOD(buffer);
    if (song) return song;
    return null;
  };

  MW.loadInstrument = function (buffer) {
    const meta = MW.sampleImport ? MW.sampleImport.sniff(new Uint8Array(buffer)) : null;
    if (meta) {
      if (meta.format === 'msh') return loadMSH(buffer);
      if (meta.format === '8svx') return load8SVX(buffer);
      if (meta.format === 'wav') {
        try {
          return MW.sampleImport.build(MW.sampleImport.readWav(buffer), MW.sampleImport.defaults()).instrument;
        } catch (e) {
          return null;
        }
      }
      if (meta.format !== 'raw') return null;
    } else {
      const dv = new DataView(buffer);
      if (buffer.byteLength >= 4 && tag(dv, 0) === 'MSH\0') return loadMSH(buffer);
      if (buffer.byteLength >= 4 && tag(dv, 0) === 'FORM') return load8SVX(buffer);
    }
    // bare raw sample
    const inst = MW.createInstrument('sample');
    inst.data = pcm8(new DataView(buffer), 0, buffer.byteLength);
    return inst;
  };

  /* Which of the three things a dropped file is. Samples are the fallback,
     as they are in OctaMED: anything the module loaders refuse is a sample. */
  MW.detectFile = function (buffer) {
    if (MW.isLHA && MW.isLHA(new Uint8Array(buffer))) return 'archive';
    let song = null;
    try { song = MW.loadModule(buffer); } catch (e) { /* not a module */ }
    return song ? 'song' : 'instrument';
  };

  MW.formats = { loadMMD, loadMED, loadMOD, loadMSH, load8SVX };

})(typeof globalThis !== 'undefined' ? globalThis : this);
