// @ts-check
/* Octanaut - LHA archive reader.
 *
 * Enough of LHA/LZH to open the archives Amiga software ships in:
 * levels 0, 1 and 2 headers, and the -lh0-, -lh1-, -lh4- to -lh7- methods.
 * The decompressors follow the algorithm documented in lhasa (Simon Howard).
 */
(function (global) {
  'use strict';
  const MW = global.MW = global.MW || {};

  /* ---------------------------------------------------------------- bits */

  function BitReader(data, pos) {
    this.d = data;
    this.p = pos || 0;
    this.buf = 0;
    this.bits = 0;
  }

  BitReader.prototype.peek = function (n) {
    if (n === 0) return 0;
    while (this.bits < n) {
      if (this.bits > 24) return -1;          // a byte would not fit
      if (this.p >= this.d.length) return -1;
      this.buf = (this.buf | (this.d[this.p++] << (24 - this.bits))) >>> 0;
      this.bits += 8;
    }
    return (this.buf >>> (32 - n)) >>> 0;
  };

  BitReader.prototype.read = function (n) {
    const v = this.peek(n);
    if (v >= 0) {
      this.buf = (this.buf << n) >>> 0;
      this.bits -= n;
    }
    return v;
  };

  /* --------------------------------------------------------------- trees */

  const LEAF = 0x8000;

  function buildTree(tree, lens, n) {
    tree.fill(LEAF);
    let nextEntry = 0;
    let allocated = 1;
    const size = tree.length;

    const expand = () => {
      const newNodes = (allocated - nextEntry) * 2;
      if (allocated + newNodes > size) return;
      const end = allocated;
      while (nextEntry < end) {
        tree[nextEntry] = allocated;
        allocated += 2;
        nextEntry++;
      }
    };

    const take = () => {
      const r = nextEntry;
      nextEntry++;
      return r;
    };

    const addCodes = codeLen => {
      let more = 0;
      for (let i = 0; i < n; i++) {
        if (lens[i] === codeLen) {
          tree[take()] = i | LEAF;
        } else if (lens[i] > codeLen) {
          more = 1;
        }
      }
      return more;
    };

    let codeLen = 0;
    do {
      expand();
      codeLen++;
    } while (addCodes(codeLen));
  }

  function readTree(br, tree) {
    let code = tree[0];
    let guard = 0;
    while ((code & LEAF) === 0) {
      const bit = br.read(1);
      if (bit < 0) return -1;
      code = tree[code + bit];
      if (guard++ > 64) return -1;
    }
    return code & 0x7fff;
  }

  /* ----------------------------------------------------- new style (lh4-7) */

  function decodeNew(data, pos, origSize, historyBits, offsetBits, numCodes) {
    const br = new BitReader(data, pos);
    const ringSize = 1 << historyBits;
    const ring = new Uint8Array(ringSize).fill(32);
    let ringPos = 0;
    let blockRemaining = 0;

    const maxTemp = 31;                        // (1 << 5) - 1
    const maxOffsets = (1 << offsetBits) - 1;
    const tempTree = new Uint16Array(maxTemp * 2);
    const codeTree = new Uint16Array(numCodes * 2);
    const offsetTree = new Uint16Array(maxOffsets * 2);

    const out = new Uint8Array(origSize);
    let outLen = 0;

    const readLength = () => {
      let n = br.read(3);
      if (n < 0) return -1;
      if (n === 7) {
        for (;;) {
          const b = br.read(1);
          if (b < 0) return -1;
          if (b === 0) break;
          n++;
        }
      }
      return n;
    };

    const readTempTable = () => {
      const n = br.read(5);
      if (n < 0) return false;
      if (n === 0) {
        const code = br.read(5);
        if (code < 0) return false;
        tempTree[0] = code | LEAF;
        return true;
      }
      const count = Math.min(n, maxTemp);
      const lens = new Uint8Array(maxTemp);
      for (let i = 0; i < count; i++) {
        const len = readLength();
        if (len < 0) return false;
        lens[i] = len;
        if (i === 2) {
          const skip = br.read(2);
          if (skip < 0) return false;
          for (let j = 0; j < skip && i + 1 < maxTemp; j++) {
            i++;
            lens[i] = 0;
          }
        }
      }
      buildTree(tempTree, lens, count);
      return true;
    };

    const readCodeTable = () => {
      const n = br.read(9);
      if (n < 0) return false;
      if (n === 0) {
        const code = br.read(9);
        if (code < 0) return false;
        codeTree[0] = code | LEAF;
        return true;
      }
      const count = Math.min(n, numCodes);
      const lens = new Uint8Array(numCodes);
      let i = 0;
      while (i < count) {
        const code = readTree(br, tempTree);
        if (code < 0) return false;
        if (code <= 2) {
          let skip;
          if (code === 0) {
            skip = 1;
          } else if (code === 1) {
            skip = br.read(4);
            if (skip < 0) return false;
            skip += 3;
          } else {
            skip = br.read(9);
            if (skip < 0) return false;
            skip += 20;
          }
          for (let j = 0; j < skip && i < count; j++) {
            lens[i] = 0;
            i++;
          }
        } else {
          lens[i] = code - 2;
          i++;
        }
      }
      buildTree(codeTree, lens, count);
      return true;
    };

    const readOffsetTable = () => {
      const n = br.read(offsetBits);
      if (n < 0) return false;
      if (n === 0) {
        const code = br.read(offsetBits);
        if (code < 0) return false;
        offsetTree[0] = code | LEAF;
        return true;
      }
      const count = Math.min(n, maxOffsets);
      const lens = new Uint8Array(maxOffsets);
      for (let i = 0; i < count; i++) {
        const len = readLength();
        if (len < 0) return false;
        lens[i] = len;
      }
      buildTree(offsetTree, lens, count);
      return true;
    };

    const startBlock = () => {
      const len = br.read(16);
      if (len < 0) return false;
      blockRemaining = len;
      return readTempTable() && readCodeTable() && readOffsetTable();
    };

    while (outLen < origSize) {
      if (blockRemaining === 0 && !startBlock()) break;
      blockRemaining--;

      const code = readTree(br, codeTree);
      if (code < 0) break;

      if (code < 256) {
        out[outLen++] = code;
        ring[ringPos] = code;
        ringPos = (ringPos + 1) % ringSize;
        continue;
      }

      const bits = readTree(br, offsetTree);
      if (bits < 0) break;
      let offset;
      if (bits === 0) {
        offset = 0;
      } else if (bits === 1) {
        offset = 1;
      } else {
        const r = br.read(bits - 1);
        if (r < 0) break;
        offset = r + (1 << (bits - 1));
      }

      const count = code - 256 + 3;
      const start = ringPos + ringSize - offset - 1;
      for (let i = 0; i < count && outLen < origSize; i++) {
        const b = ring[(start + i) % ringSize];
        out[outLen++] = b;
        ring[ringPos] = b;
        ringPos = (ringPos + 1) % ringSize;
      }
    }

    return out.subarray(0, outLen);
  }

  /* -------------------------------------------------------- old style (lh1) */

  function decodeLh1(data, pos, origSize) {
    const br = new BitReader(data, pos);
    const NUM_CODES = 314;
    const NUM_NODES = NUM_CODES * 2 - 1;
    const RING = 4096;
    const REORDER_LIMIT = 32 * 1024;
    const NUM_OFFSETS = 64;
    const MIN_OFFSET_BITS = 3;

    const leaf = new Uint8Array(NUM_NODES);
    const child = new Uint16Array(NUM_NODES);
    const parent = new Uint16Array(NUM_NODES);
    const freq = new Uint32Array(NUM_NODES);
    const group = new Uint16Array(NUM_NODES);
    const leafNodes = new Uint16Array(NUM_CODES);
    const groups = new Uint16Array(NUM_NODES);
    const groupLeader = new Uint16Array(NUM_NODES);
    let numGroups = 0;

    const ring = new Uint8Array(RING).fill(32);
    let ringPos = 0;

    const offsetLookup = new Uint8Array(256);
    const offsetLengths = new Uint8Array(NUM_OFFSETS);

    const allocGroup = () => groups[numGroups++];
    const freeGroup = g => { groups[--numGroups] = g; };

    for (let i = 0; i < NUM_NODES; i++) groups[i] = i;

    // initial tree: all leaves at the end, branches built back to the root
    let nodeIndex = NUM_NODES - 1;
    const leafGroup = allocGroup();
    for (let i = 0; i < NUM_CODES; i++) {
      leaf[nodeIndex] = 1;
      child[nodeIndex] = i;
      freq[nodeIndex] = 1;
      group[nodeIndex] = leafGroup;
      groupLeader[leafGroup] = nodeIndex;
      leafNodes[i] = nodeIndex;
      nodeIndex--;
    }
    let ch = NUM_NODES - 1;
    while (nodeIndex >= 0) {
      leaf[nodeIndex] = 0;
      child[nodeIndex] = ch;
      parent[ch] = nodeIndex;
      parent[ch - 1] = nodeIndex;
      freq[nodeIndex] = freq[ch] + freq[ch - 1];
      if (freq[nodeIndex] === freq[nodeIndex + 1]) group[nodeIndex] = group[nodeIndex + 1];
      else group[nodeIndex] = allocGroup();
      groupLeader[group[nodeIndex]] = nodeIndex;
      nodeIndex--;
      ch -= 2;
    }

    // offset lookup table
    const fdist = [1, 3, 8, 12, 24, 16];
    let code = 0;
    let offset = 0;
    for (let i = 0; i < fdist.length; i++) {
      const len = i + MIN_OFFSET_BITS;
      const iterbit = 1 << (8 - len);
      for (let j = 0; j < fdist[i]; j++) {
        const mask = iterbit - 1;
        for (let k = 0; (k & ~mask) === 0; k++) offsetLookup[code | k] = offset;
        offsetLengths[offset] = len;
        code = (code + iterbit) & 0xff;
        offset++;
      }
    }

    const makeLeader = nodeIdx => {
      const g = group[nodeIdx];
      const li = groupLeader[g];
      if (li === nodeIdx) return nodeIdx;
      let t = leaf[li]; leaf[li] = leaf[nodeIdx]; leaf[nodeIdx] = t;
      t = child[li]; child[li] = child[nodeIdx]; child[nodeIdx] = t;
      if (leaf[nodeIdx]) leafNodes[child[nodeIdx]] = nodeIdx;
      else { parent[child[nodeIdx]] = nodeIdx; parent[child[nodeIdx] - 1] = nodeIdx; }
      if (leaf[li]) leafNodes[child[li]] = li;
      else { parent[child[li]] = li; parent[child[li] - 1] = li; }
      return li;
    };

    const incrementFreq = nodeIdx => {
      freq[nodeIdx]++;
      const other = nodeIdx - 1;
      if (nodeIdx < NUM_NODES - 1 && group[nodeIdx] === group[nodeIdx + 1]) {
        groupLeader[group[nodeIdx]]++;
        if (freq[nodeIdx] === freq[other]) group[nodeIdx] = group[other];
        else { group[nodeIdx] = allocGroup(); groupLeader[group[nodeIdx]] = nodeIdx; }
      } else if (freq[nodeIdx] === freq[other]) {
        freeGroup(group[nodeIdx]);
        group[nodeIdx] = group[other];
      }
    };

    const reconstruct = () => {
      // gather leaves at the front
      let lf = 0;
      for (let i = 0; i < NUM_NODES; i++) {
        if (leaf[i]) {
          leaf[lf] = 1;
          child[lf] = child[i];
          freq[lf] = ((freq[i] + 1) / 2) | 0;
          lf++;
        }
      }
      let leafPtr = NUM_CODES - 1;
      ch = NUM_NODES - 1;
      let i = NUM_NODES - 1;
      while (i >= 0) {
        while (ch - i < 2) {
          leaf[i] = leaf[leafPtr];
          child[i] = child[leafPtr];
          freq[i] = freq[leafPtr];
          parent[i] = parent[leafPtr];
          group[i] = group[leafPtr];
          leafNodes[child[leafPtr]] = i;
          i--; leafPtr--;
        }
        const f = freq[ch] + freq[ch - 1];
        while (leafPtr >= 0 && f >= freq[leafPtr]) {
          leaf[i] = leaf[leafPtr];
          child[i] = child[leafPtr];
          freq[i] = freq[leafPtr];
          parent[i] = parent[leafPtr];
          group[i] = group[leafPtr];
          leafNodes[child[leafPtr]] = i;
          i--; leafPtr--;
        }
        leaf[i] = 0;
        freq[i] = f;
        child[i] = ch;
        parent[ch] = i;
        parent[ch - 1] = i;
        i--;
        ch -= 2;
      }
      // rebuild groups
      numGroups = 0;
      for (let g = 0; g < NUM_NODES; g++) groups[g] = g;
      let g = allocGroup();
      group[0] = g;
      groupLeader[g] = 0;
      for (let k = 1; k < NUM_NODES; k++) {
        if (freq[k] === freq[k - 1]) group[k] = group[k - 1];
        else { g = allocGroup(); group[k] = g; groupLeader[g] = k; }
      }
    };

    const incrementForCode = c => {
      if (freq[0] >= REORDER_LIMIT) reconstruct();
      freq[0]++;
      let ni = leafNodes[c];
      let guard = 0;
      while (ni !== 0 && guard++ < 128) {
        ni = makeLeader(ni);
        incrementFreq(ni);
        ni = parent[ni];
      }
    };

    const readCode = () => {
      let ni = 0;
      let guard = 0;
      while (!leaf[ni]) {
        const bit = br.read(1);
        if (bit < 0) return -1;
        ni = child[ni] - bit;
        if (guard++ > 64) return -1;
      }
      const result = child[ni];
      incrementForCode(result);
      return result;
    };

    const readOffset = () => {
      const future = br.peek(8);
      if (future < 0) return -1;
      const off = offsetLookup[future];
      br.read(offsetLengths[off]);
      const low = br.read(6);
      if (low < 0) return -1;
      return (off << 6) | low;
    };

    const out = new Uint8Array(origSize);
    let outLen = 0;

    while (outLen < origSize) {
      const c = readCode();
      if (c < 0) break;
      if (c < 0x100) {
        out[outLen++] = c;
        ring[ringPos] = c;
        ringPos = (ringPos + 1) % RING;
      } else {
        const off = readOffset();
        if (off < 0) break;
        const count = c - 0x100 + 3;
        const start = ringPos - off + RING - 1;
        for (let i = 0; i < count && outLen < origSize; i++) {
          const b = ring[(start + i) % RING];
          out[outLen++] = b;
          ring[ringPos] = b;
          ringPos = (ringPos + 1) % RING;
        }
      }
    }

    return out.subarray(0, outLen);
  }

  /* ------------------------------------------------------------- headers */

  /* LHA's CRC-16: the IBM/ARC polynomial 0x8005, reflected, init 0. */
  function crc16(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let b = 0; b < 8; b++) {
        crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
      }
    }
    return crc & 0xffff;
  }
  MW.lhaCrc16 = crc16;

  const u16 = (d, o) => d[o] | (d[o + 1] << 8);
  const u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;

  function text(d, off, len) {
    let s = '';
    for (let i = 0; i < len; i++) {
      const c = d[off + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function methodParams(method) {
    switch (method) {
      case '-lh4-':
      case '-lh5-': return { kind: 'new', historyBits: 14, offsetBits: 4, numCodes: 510 };
      case '-lh6-': return { kind: 'new', historyBits: 15, offsetBits: 5, numCodes: 510 };
      case '-lh7-': return { kind: 'new', historyBits: 16, offsetBits: 5, numCodes: 510 };
      case '-lh1-': return { kind: 'lh1' };
      case '-lh0-':
      case '-lz4-': return { kind: 'stored' };
      default: return null;
    }
  }

  MW.isLHA = function (data) {
    const d = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (d.length < 24) return false;
    const m = String.fromCharCode(d[2], d[3], d[4]);
    return (m === '-lh' || m === '-lz' || m === '-pm') && d[2] === 0x2d;
  };

  /* Returns { entries: [{ name, size, method, data }], skipped: [names] } */
  MW.readLHA = function (buffer) {
    const d = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const entries = [];
    const skipped = [];
    let pos = 0;
    let guard = 0;
    let budget = 96 * 1024 * 1024;

    const decodeAt = (method, start, origSize) => {
      const params = methodParams(method);
      if (!params || start < 0 || start >= d.length) return null;
      try {
        if (params.kind === 'stored') {
          return d.subarray(start, Math.min(d.length, start + origSize));
        }
        if (params.kind === 'lh1') return decodeLh1(d, start, origSize);
        return decodeNew(d, start, origSize, params.historyBits, params.offsetBits, params.numCodes);
      } catch (e) {
        return null;
      }
    };

    while (pos + 22 < d.length && guard++ < 8192) {
      if (d[pos] === 0 && d[pos + 1] === 0) break;
      if (d[pos] === 0 && d[pos + 1] === 0x2d) break;      // stray terminator

      const method = text(d, pos + 2, 5);
      const params = methodParams(method);
      if (!params) break;

      const level = d[pos + 20];
      let size, compSize, origSize, name, crc, crcAt;

      if (level === 2) {
        size = u16(d, pos);
        compSize = u32(d, pos + 7);
        origSize = u32(d, pos + 11);
        crc = u16(d, pos + 21);
        crcAt = pos + 21;
        name = text(d, pos + 22, d[pos + 21 + 2] || 0);
        // level 2 keeps the name in an extended header
        name = '';
        let p = pos + 24;                       // past level byte, crc and OS id
        while (p + 3 <= d.length) {
          const es = u16(d, p);
          if (es < 3) break;
          const type = d[p + 2];
          if (type === 0x01 || type === 0x6e) name = text(d, p + 3, es - 3);
          p += es;
        }
      } else {
        size = d[pos];
        compSize = u32(d, pos + 7);
        origSize = u32(d, pos + 11);
        const nameLen = d[pos + 21];
        name = text(d, pos + 22, nameLen);
        crcAt = pos + 22 + nameLen;
        crc = u16(d, crcAt);
      }

      if (compSize <= 0 || origSize <= 0 || origSize > budget) break;

      /* The header size field is not reliable across the levels and the
         tools that wrote them, so try the likely starts and let the file's
         own CRC pick the right one. */
      const base = pos + size;
      const starts = [];
      if (level === 2) {
        starts.push(base, base + 2);
      } else if (level === 1) {
        starts.push(base + 2, base, base + 4);
        for (let k = 2; k <= 96; k++) starts.push(base + k);
      } else {
        starts.push(base + 2, base);
      }

      /** @type {Uint8Array | null} */
      let out = null;
      let usedStart = -1;
      for (const st of starts) {
        if (st + 1 >= d.length) continue;
        const cand = decodeAt(method, st, origSize);
        if (!cand || cand.length !== origSize) continue;
        if (crc16(cand) === crc) { out = cand; usedStart = st; break; }
        if (!out) { out = cand; usedStart = st; }      // best effort
      }

      if (out && out.length) {
        budget -= out.length;
        const clean = name.replace(/\\/g, '/').replace(/^\.\//, '').trim() || 'unnamed';
        entries.push({ name: clean, size: out.length, method: method, data: out });
      } else {
        skipped.push((name || 'unnamed') + ' (' + method + ')');
      }

      pos = (usedStart > 0 ? usedStart : base) + compSize;
      if (pos <= 0 || pos > d.length) break;
    }

    return { entries: entries, skipped: skipped };
  };

  /* exposed for tests */
  MW._lhaDecode = { decodeNew: decodeNew, decodeLh1: decodeLh1 };

  /* Entries that look like something Octanaut can open. */
  MW.lhaModules = function (result) {
    const known = /\.(mmd0|mmd1|mmd2|mmd3|mmd4|mmdc|mmd|med|med4|mod)$/i;
    return result.entries.filter(e => known.test(e.name));
  };

  MW.lhaInstruments = function (result) {
    const known = /\.(msh|8svx|iff|wav|wave|aif|aiff|raw|ins|mp3|m4a|aac|flac|ogg|opus)$/i;
    return result.entries.filter(e => known.test(e.name));
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
