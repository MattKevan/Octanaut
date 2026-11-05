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

  /* Amiga period for a MED note number: C-1 = 856, C-2 = 428, C-3 = 214 */
  MW.period = function (note) {
    return Math.round(856 * Math.pow(2, -(note - 1) / 12));
  };

  MW.periodToNote = function (p) {
    if (!p) return 0;
    return 1 + Math.round(12 * Math.log2(856 / p));
  };

  /* ---------- cells ---------- */

  MW.cell = () => ({ note: 0, ins: 0, cmd: 0, dat: 0 });
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
    for (let i = 0; i < n; i++) a[i] = Math.sin((i / n) * Math.PI * 2) * 127;
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
  MW.tempoToBpm = function (tempo, tempo2) {
    if (tempo <= 10) return 125;
    return Math.max(20, Math.min(511, Math.round((125 * tempo) / 33)));
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
    return 2.5 / MW.tempoToBpm(tempo, tempo2);
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
