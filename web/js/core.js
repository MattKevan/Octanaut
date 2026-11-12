// @ts-check
/* Octanaut - core model and helpers */
(function (global) {
  'use strict';

  const MW = global.MW = global.MW || {};

  /* ---------- names ---------- */

  const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* note 1 = C-1, 13 = C-2 ... 0 = no note */
  MW.noteName = function (n, hb) {
    if (!n) return '---';
    const i = (n - 1) % 12;
    const o = (Math.floor((n - 1) / 12) + 1).toString(36).toUpperCase();
    if (hb) {
      if (i === 10) return 'B-' + o;
      if (i === 11) return 'H-' + o;
    }
    return NOTE_NAMES[i] + o;
  };

  MW.noteIndex = function (name) {
    const m = /^([A-G])(#|-)?([0-9A])$/.exec(name);
    if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    const sharp = m[2] === '#' ? 1 : 0;
    return 1 + (parseInt(m[3], 36) - 1) * 12 + base + sharp;
  };

  /* instrument numbers display in base 32: 1..63 -> 01..1V */
  MW.insName = function (n) {
    if (!n) return '..';
    return DIGITS[Math.floor(n / 32) % 32] + DIGITS[n % 32];
  };

  MW.hex = (v, w) => v.toString(16).toUpperCase().padStart(w || 2, '0');

  /* A volume command's argument: two decimal digits, or hex when VOL is on
     HEX. A hex digit in a decimal argument still counts as its value, as in
     OctaMED, and the result is capped at 64. */
  MW.volumeFromArg = function (dat, hex) {
    const v = hex ? dat : Math.floor(dat / 16) * 10 + (dat % 16);
    return MW.clamp(v, 0, 64);
  };
  MW.volumeArg = function (volume, hex) {
    const v = MW.clamp(volume, 0, 64);
    return hex ? v : Math.floor(v / 10) * 16 + (v % 10);
  };
  /* Rewrite every 0C so it still sounds the same after a HEX/DEC switch.
     0x80 and up set the instrument's volume, not the track's, so they stay. */
  MW.rewriteVolumeCommands = function (song, hex) {
    let changed = 0;
    (song.blocks || []).forEach(block => block.rows.forEach(row => row.forEach(c => {
      if (!c || c.cmd !== 0x0c || c.dat >= 0x80) return;
      const next = MW.volumeArg(MW.volumeFromArg(c.dat, !hex), hex);
      if (next !== c.dat) { c.dat = next; changed++; }
    })));
    return changed;
  };

  /* Amiga period for a MED note number: C-1 = 856, C-2 = 428, C-3 = 214 */
  MW.period = function (note) {
    return Math.round(856 * Math.pow(2, -(note - 1) / 12));
  };

  MW.periodToNote = function (p) {
    if (!p) return 0;
    return 1 + Math.round(12 * Math.log2(856 / p));
  };

  // OctaMED's 108-byte NotationInfo (Programmers/MODPlayer/modplayer.h).
  MW.readNotationInfo = function (view, offset) {
    if (!offset || offset < 0 || offset + 108 > view.byteLength) return null;
    const flags = view.getUint8(offset + 1);
    const presets = Array.from({ length: 5 }, (_, p) => {
      const selected = view.getInt16(offset + 2 + p * 2, false);
      const tracks = {}, ghost = {};
      for (let t = 0; t < 16; t++) {
        tracks[t] = !!(view.getUint8(offset + 12 + t) & (1 << p));
        ghost[t] = !!(view.getUint8(offset + 28 + t) & (1 << p));
      }
      return { track: selected >= 0 && selected < 16 ? selected : null, tracks, ghost };
    });
    const instruments = {};
    for (let i = 0; i < 63; i++) {
      const raw = view.getUint8(offset + 44 + i);
      const hide = !!((raw ^ (raw << 1)) & 0x80);
      const value = (raw & 0x3f) | ((raw & 0x80) ? 0xc0 : 0);
      const transpose = value & 0x80 ? value - 256 : value;
      if (hide || transpose) instruments[i + 1] = { hide, transpose };
    }
    return { keySig: { count: Math.min(6, view.getUint8(offset)), flat: !!(flags & 1) }, timeSig: flags & 2 ? 3 : 4, presets, instruments };
  };
  MW.writeNotationInfo = function (view, offset, notation) {
    const n = notation || {};
    const key = n.keySig || {};
    view.setUint8(offset, MW.clamp(key.count || 0, 0, 6));
    view.setUint8(offset + 1, (key.flat ? 1 : 0) | (n.timeSig === 3 ? 2 : 0));
    for (let p = 0; p < 5; p++) {
      const preset = n.presets && n.presets[p];
      view.setInt16(offset + 2 + p * 2, preset && preset.track != null ? MW.clamp(preset.track, 0, 15) : -1, false);
    }
    for (let t = 0; t < 16; t++) {
      let show = 0, ghost = 0;
      for (let p = 0; p < 5; p++) {
        const preset = n.presets && n.presets[p];
        if (preset ? !!preset.tracks[t] : !n.presets) show |= 1 << p;
        if (preset && preset.ghost[t]) ghost |= 1 << p;
      }
      view.setUint8(offset + 12 + t, show); view.setUint8(offset + 28 + t, ghost);
    }
    for (let i = 0; i < 63; i++) {
      const instrument = n.instruments && n.instruments[i + 1];
      const trans = MW.clamp(instrument ? instrument.transpose || 0 : 0, -24, 24);
      view.setUint8(offset + 44 + i, (trans & 0xff) ^ (instrument && instrument.hide ? 0x40 : 0));
    }
  };

  MW.parseMidiHex = function (text) {
    const value = String(text).trim();
    if (!value) return [];
    if (!/^(?:[0-9a-f]{2})(?:\s+[0-9a-f]{2})*$/i.test(value)) return null;
    return value.split(/\s+/).map(byte => parseInt(byte, 16));
  };

  /* ---------- cells ---------- */

  MW.cell = () => ({ note: 0, ins: 0, cmd: 0, dat: 0 });

  /* Programmable keys: a definition can be a single cell, or a group of
     cells picked from a range. */
  MW.progGroupFromRange = function (block, range, track, limit) {
    if (!block || !range) return [];
    const max = Math.max(1, limit || 16);
    const l0 = Math.min(range.l0, range.l1), l1 = Math.max(range.l0, range.l1);
    const out = [];
    for (let l = l0; l <= l1 && out.length < max; l++) {
      const cell = block.rows[l] && block.rows[l][track];
      out.push(cell
        ? { note: cell.note || 0, ins: cell.ins || 0, cmd: cell.cmd || 0, dat: cell.dat || 0 }
        : { note: 0, ins: 0, cmd: 0, dat: 0 });
    }
    return out;
  };

  MW.insertProgGroup = function (block, track, line, cells) {
    if (!block || !cells) return;
    for (let i = 0; i < cells.length; i++) {
      const row = block.rows[line + i];
      if (!row) break;
      row[track] = { ...cells[i] };
    }
  };

  /* Apply a definition at the cursor; null fields are wildcards. Returns
     how many lines it consumed. */
  MW.applyProgDefinition = function (block, track, line, def) {
    if (!block || !def) return 0;
    if (def.cells && def.cells.length) {
      MW.insertProgGroup(block, track, line, def.cells);
      return def.cells.length;
    }
    const row = block.rows[line];
    if (!row) return 0;
    const c = row[track] || (row[track] = MW.cell());
    if (def.note != null) c.note = def.note;
    if (def.ins != null) c.ins = def.ins;
    if (def.cmd != null) { c.cmd = def.cmd; c.dat = def.dat == null ? 0 : def.dat; }
    else if (def.dat != null) c.dat = def.dat;
    return 1;
  };
  MW.blankCell = c => !c.note && !c.ins && !c.cmd && !c.dat;
  MW.clearCell = c => { c.note = 0; c.ins = 0; c.cmd = 0; c.dat = 0; };

  /* ---------- blocks ---------- */

  MW.createBlock = function (tracks, lines) {
    tracks = tracks || 4;
    lines = lines || 64;
    const rows = new Array(lines);
    for (let i = 0; i < lines; i++) {
      const r = new Array(tracks);
      for (let t = 0; t < tracks; t++) r[t] = MW.cell();
      rows[i] = r;
    }
    return { tracks, lines, rows, name: '', highlight: new Uint8Array(lines) };
  };

  MW.resizeBlock = function (block, tracks, lines) {
    const rows = new Array(lines);
    for (let i = 0; i < lines; i++) {
      const old = block.rows[i];
      const r = new Array(tracks);
      for (let t = 0; t < tracks; t++) r[t] = old && old[t] ? old[t] : MW.cell();
      rows[i] = r;
    }
    block.tracks = tracks;
    block.lines = lines;
    block.rows = rows;
    const hl = new Uint8Array(lines);
    hl.set(block.highlight.subarray(0, Math.min(lines, block.highlight.length)));
    block.highlight = hl;
  };

  /* ---------- instruments ---------- */

  MW.createInstrument = function (type) {
    return {
      name: '',
      type: type || 'sample',
      volume: 64,
      transpose: 0,
      loop: 0,
      looplen: 0,
      c2rate: 8363,
      data: null,
      hold: 0,
      decay: 0,
      midiChannel: 0,
      midiPreset: 0,
      suppressOff: false,
      synth: null
    };
  };

  MW.createSynth = function () {
    return {
      voltbl: [0x40, 0xff],
      wftbl: [0x00, 0xff],
      volspeed: 1,
      wfspeed: 1,
      waveforms: [MW.sineTable(32)]
    };
  };

  MW.sineTable = function (n) {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.sin((i / n) * Math.PI * 2);
    return a;
  };

  /* ---------- song ---------- */

  MW.createSong = function () {
    const song = {
      name: 'untitled',
      annotation: '',
      channels: 4,
      blocks: [MW.createBlock(4, 64)],
      playseq: [0],
      deftempo: 33,
      tempo2: 6,
      playtransp: 0,
      flags: { filteron: 0, jumping: 0, jump8th: 0, volhex: 1, stslide: 0, eightchannel: 0 },
      trkvol: new Array(16).fill(64),
      mastervol: 64,
      instruments: new Array(63).fill(null),
      multis: []
    };
    return song;
  };

  function deepClone(v) {
    if (v == null || typeof v !== 'object') return v;
    if (v instanceof Float32Array) return new Float32Array(v);
    if (v instanceof Uint8Array) return new Uint8Array(v);
    if (Array.isArray(v)) return v.map(deepClone);
    const out = {};
    for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = deepClone(v[k]);
    return out;
  }

  MW.deepClone = deepClone;
  MW.cloneSong = song => deepClone(song);

  /* ---------- screen colours ----------
   * Four sets, in the spirit of the Misc panel's colour gadgets. */

  MW.palettes = [
    {
      name: 'OctaMED',
      tracks: ['#d24b3f', '#3f7fd2', '#d24b3f', '#3f7fd2', '#d24b3f', '#3f7fd2', '#d24b3f', '#3f7fd2',
        '#8a5cc4', '#46c07a', '#8a5cc4', '#46c07a', '#c49a3f', '#c49a3f', '#c49a3f', '#c49a3f']
    },
    {
      name: 'Cool',
      tracks: ['#4fa3a5', '#5b7fd0', '#4fa3a5', '#5b7fd0', '#4fa3a5', '#5b7fd0', '#4fa3a5', '#5b7fd0',
        '#7a6ad0', '#3fb08a', '#7a6ad0', '#3fb08a', '#6f9ac0', '#6f9ac0', '#6f9ac0', '#6f9ac0']
    },
    {
      name: 'Warm',
      tracks: ['#d2703f', '#c9a03f', '#d2703f', '#c9a03f', '#d2703f', '#c9a03f', '#d2703f', '#c9a03f',
        '#c95f5f', '#b08a3f', '#c95f5f', '#b08a3f', '#a06a4a', '#a06a4a', '#a06a4a', '#a06a4a']
    },
    {
      name: 'Mono',
      tracks: new Array(16).fill('#b8b8b8')
    },
    {
      name: 'Custom',
      tracks: new Array(16).fill('#888888')
    }
  ];

  /* ---------- tuning ---------- */

  /* MED primary tempo -> BPM. 33 with pulse 6 is the 125 BPM reference. */
  /* Tempos 1-10 play as SoundTracker speeds: the player's own timer counts,
     including the dip at 9. Tempo 11 and up is 470000 / tempo at the PAL
     E-clock (709379 Hz), so one tick is count / E-clock seconds. */
  MW.TEMPO_COUNTS = [2417, 4833, 7250, 9666, 12083, 14500, 16916, 19332, 21436, 24163];
  MW.E_CLOCK = 709379;
  MW.tempoCount = function (tempo) {
    const t = Math.max(1, Math.round(tempo || 0));
    if (t <= MW.TEMPO_COUNTS.length) return MW.TEMPO_COUNTS[t - 1];
    return Math.floor(470000 / t);
  };

  /* seconds per pulse (one "tick").
     Modules saved by OctaMED Pro can carry a real BPM and a lines-per-beat
     value instead of the MED primary tempo; both live in flags2. */
  MW.pulseSeconds = function (tempo, tempo2, bpmMode, linesPerBeat) {
    if (bpmMode) {
      const bpm = Math.max(1, tempo);
      const lines = Math.max(1, linesPerBeat || 4);
      return 60 / (bpm * lines * Math.max(1, tempo2));
    }
    return MW.tempoCount(tempo) / MW.E_CLOCK;
  };

  MW.tempoToBpm = function (tempo, tempo2, linesPerBeat) {
    const pulse = MW.pulseSeconds(tempo, tempo2, false, linesPerBeat);
    const lines = Math.max(1, linesPerBeat || 4);
    return Math.round((1 / pulse) / Math.max(1, tempo2) * 60 / lines);
  };

  MW.bpmOf = function (tempo, song) {
    if (song && song.bpmMode) return Math.max(1, tempo);
    return MW.tempoToBpm(tempo, song ? song.tempo2 : 6);
  };

  MW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  MW.toast = function (msg, isError) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.classList.add('show');
    clearTimeout(MW._toastT);
    MW._toastT = setTimeout(() => el.classList.remove('show'), 2600);
  };

  /* minimal event bus so panels and displays can react to edits */
  const listeners = {};
  MW.on = function (evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  };
  MW.emit = function (evt, data) {
    (listeners[evt] || []).forEach(fn => fn(data));
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
