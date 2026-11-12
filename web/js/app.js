/* Octanaut - application shell, editing operations, keyboard */
(function (global) {
  'use strict';
  const MW = global.MW;

  const app = MW.app = {
    song: null,
    cursor: { block: 0, line: 0, track: 0, field: 0, seq: 0 },
    currentIns: 1,
    editMode: false,
    octave: 0,
    step: 1,
    advance: 'down',
    spaceAsDel: false,
    autoSpace: false,
    chordMode: false,
    follow: true,
    hb: false,
    mutedTracks: new Array(16).fill(false),
    selectedTracks: new Array(16).fill(false),
    selection: null,
    transposeScope: 'block',
    synthWave: 0,
    typePending: 0,
    typeTimer: 0,
    lastIns: 1,
    altL: { note: null, ins: null, cmd: null, dat: null },
    altR: { note: null, ins: null, cmd: null, dat: null },
    altHeld: null,
    padMode: 'track',
    playOnNote: false,
    progTarget: 0,
    progAlt: 'C',
    transposeInstrScope: 'all',
    paletteIndex: 0,
    paletteRGB: { r: 136, g: 136, b: 136 },
    paletteUndo: null,
    paths: [],
    confirmOn: true,
    depth: 'enhanced',
    pset: 0,
    psets: [null, null, null, null, null],
    notaTracks: {},
    notaFeed: false,
    notaPrintAll: true,
    dep2: false,
    no16: false,
    ptkey: false,
    clipRange: null,
    saveFormat: 'mmd1',
    saveInfo: true,
    volTrack: 0,
    padMap2: false,
    midiAllOff: 'cc',
    midiMessages: [{ name: '', data: [] }],
    midiMsgIndex: 0,
    midiMsgAuto: true,
    midiCapture: false,
    extSync: false,
    midiMapActive: false,
    midiKeyUp: false,
    midiMapIndex: 60,
    midiMap: null,
    midiInput: true,
    midiSendOut: false,
    midiInChannel: 0,
    seq: 0,
    transport: { playing: false }
  };

  /* One state object, one notification path. The store wraps the app
     object itself, so direct reads keep working; a commit tells the
     panels that a slice changed. */
  const store = MW.store = MW.createStore(app);
  const STATUS_KEYS = ['song', 'cursor', 'currentIns', 'editMode', 'spaceAsDel', 'autoSpace',
    'chordMode', 'octave', 'advance', 'mutedTracks', 'songIndex', 'songList', 'seq'];
  MW.statusKeys = STATUS_KEYS;
  /* commit the given slices; with none, repaint the whole status strip */
  MW.touchStatus = (reason, keys) => store.commit(keys || STATUS_KEYS, reason || 'status');
  store.subscribe(STATUS_KEYS, updateStatus);

  const clipboard = { tracks: [], lines: 0, tracksCount: 0, kind: null };
  const sampleClip = MW.sampleClip = { data: null };

  /* ------------------------------------------------------------ refresh */

  let prefTimer = 0;
  function touchPrefs() {
    clearTimeout(prefTimer);
    prefTimer = setTimeout(() => prefs.save(), 600);
  }
  MW.touchPrefs = touchPrefs;

  function refreshAll(keepPanel) {
    if (MW.touchPrefs) MW.touchPrefs();
    MW.panels.refresh();
    MW.displays.refresh();
    if (MW.renderSeqBox) MW.renderSeqBox();
    MW.touchStatus('refresh');
  }
  MW.refreshAll = refreshAll;

  function updateStatus() {
    const s = app.song;
    if (!s) return;
    const el = id => document.getElementById(id);
    const b = s.blocks[app.cursor.block] || s.blocks[0];
    const seqLen = Math.max(1, s.playseq.length);

    const seqAt = MW.player.playing ? Math.min(MW.player.seqPos + 1, seqLen) : Math.min(app.cursor.seq + 1, seqLen);
    el('st-seq').textContent = `${String(seqAt).padStart(4, '0')}/${String(seqLen).padStart(4, '0')}`;
    el('st-block').textContent = `${String(app.cursor.block).padStart(4, '0')}/${String(Math.max(0, s.blocks.length - 1)).padStart(4, '0')}`;
    el('st-oct').textContent = (app.octave + 1).toString(36).toUpperCase() + '+' + (app.octave + 2).toString(36).toUpperCase();
    el('st-edit').classList.toggle('on', app.editMode);
    el('st-space').classList.toggle('on', app.autoSpace);
    el('st-chord').classList.toggle('on', app.chordMode);
    el('st-ins').textContent = MW.insName(app.currentIns);

    const inst = s.instruments[app.currentIns - 1];
    el('st-insname').textContent = inst ? (inst.name || 'unnamed') : 'slot empty';
    const total = (app.songList && app.songList.length) || 1;
    el('st-song').textContent = `${MW.hex((app.songIndex || 0) + 1)}/${MW.hex(total)}`;

    const meta = el('display-meta');
    if (meta) meta.textContent = `${s.blocks.length} blocks · ${b.tracks} tracks · ${b.lines} lines`;

    const blockName = el('st-blockname');
    if (blockName && document.activeElement !== blockName) blockName.value = b.name || '';
    const songName = el('st-songname');
    if (songName && document.activeElement !== songName) songName.value = s.name || '';

    /* memory readout: sample data against the classic 2 MB machine */
    let used = 0;
    s.instruments.forEach(i => { if (i && i.data) used += i.data.length; });
    const cap = 2 * 1024 * 1024;
    const usedEl = el('mem-used');
    if (usedEl) usedEl.textContent = String(used).padStart(6, '0');
    const totEl = el('mem-total');
    if (totEl) totEl.textContent = String(cap).padStart(6, '0');
    const frac = MW.clamp(used / cap, 0, 1);
    const barA = el('mem-bar-a');
    if (barA) barA.style.width = Math.max(1, frac * 48) + '%';
    const barB = el('mem-bar-b');
    if (barB) barB.style.width = Math.max(1, (1 - frac) * 48) + '%';

    const leds = el('st-tracks');
    if (leds && leds.children.length !== 16) {
      leds.innerHTML = Array.from({ length: 16 }, (_, i) =>
        `<span class="dot size-2 shrink-0 border border-ink bg-paper on:bg-ink" data-mute="${i}" title="Track ${i.toString(16).toUpperCase()}"></span>`).join('');
    }
    if (leds) {
      for (let i = 0; i < 16; i++) {
        const d = leds.children[i];
        if (d) d.classList.toggle('on', !app.mutedTracks[i] && i < b.tracks);
      }
    }
  }
  MW.updateStatus = updateStatus;

  /* ------------------------------------------------------------ helpers */

  function block() {
    return app.song.blocks[app.cursor.block] || app.song.blocks[0];
  }

  function curCell() {
    const b = block();
    return b.rows[app.cursor.line] ? b.rows[app.cursor.line][app.cursor.track] : null;
  }

  function afterEdit() {
    MW.grid.render();
    MW.touchStatus('edit');
    MW.emit('edit', null);
  }

  /* ------------------------------------------------------------ operations */

  MW.sampleMoveLoop = function (inst, endpoint, direction) {
    if (!inst || !inst.data || !inst.looplen) return;
    const data = inst.data;
    let start = inst.loop || 0, end = start + inst.looplen;
    let pos = endpoint === 'end' ? end : start;
    const delta = direction.endsWith('left') ? -1 : 1;
    const min = endpoint === 'end' ? start + 1 : 0;
    const max = endpoint === 'end' ? data.length : end - 1;
    if (direction.startsWith('zero')) {
      pos = MW.clamp(pos + delta, min, max);
      while (pos > min && pos < max && Math.abs(data[Math.min(pos, data.length - 1)]) > 0.02) pos += delta;
    } else pos = MW.clamp(pos + delta * 2, min, max);
    if (endpoint === 'end') end = pos; else start = pos;
    inst.loop = start; inst.looplen = end - start;
  };

  const ops = MW.ops = {

    setLines(n) {
      const b = block();
      n = MW.clamp(n || 64, 1, 3200);
      MW.resizeBlock(b, b.tracks, n);
      app.cursor.line = Math.min(app.cursor.line, n - 1);
      refreshAll();
    },

    setTracks(n) {
      const b = block();
      MW.resizeBlock(b, n, b.lines);
      app.cursor.track = Math.min(app.cursor.track, n - 1);
      if (app.song.channels < n) app.song.channels = n;
      refreshAll();
    },

    copyTrack() {
      const b = block();
      clipboard.kind = 'track';
      clipboard.tracks = b.rows.map(r => ({ ...r[app.cursor.track] }));
      clipboard.lines = b.lines;
      MW.toast('Track copied');
    },

    cutTrack() {
      this.copyTrack();
      const b = block();
      b.rows.forEach(r => MW.clearCell(r[app.cursor.track]));
      afterEdit();
    },

    pasteTrack() {
      if (clipboard.kind !== 'track') return MW.toast('Nothing copied', true);
      const b = block();
      for (let l = 0; l < b.lines && l < clipboard.tracks.length; l++) {
        Object.assign(b.rows[l][app.cursor.track], clipboard.tracks[l]);
      }
      afterEdit();
    },

    swapTrack() {
      if (clipboard.kind !== 'track') return MW.toast('Nothing copied', true);
      const b = block();
      for (let l = 0; l < b.lines && l < clipboard.tracks.length; l++) {
        const cur = b.rows[l][app.cursor.track];
        const tmp = { ...cur };
        Object.assign(cur, clipboard.tracks[l]);
        clipboard.tracks[l] = tmp;
      }
      afterEdit();
    },

    copyBlock() {
      const b = block();
      clipboard.kind = 'block';
      clipboard.lines = b.lines;
      clipboard.tracksCount = b.tracks;
      clipboard.tracks = b.rows.map(r => r.map(c => ({ ...c })));
      MW.toast('Block copied');
    },

    cutBlock() {
      this.copyBlock();
      const b = block();
      b.rows.forEach(r => r.forEach(c => MW.clearCell(c)));
      afterEdit();
    },

    pasteBlock() {
      if (clipboard.kind !== 'block') return MW.toast('Nothing copied', true);
      const b = block();
      for (let l = 0; l < b.lines && l < clipboard.tracks.length; l++) {
        for (let t = 0; t < b.tracks && t < clipboard.tracks[l].length; t++) {
          Object.assign(b.rows[l][t], clipboard.tracks[l][t]);
        }
      }
      afterEdit();
    },

    swapBlock() {
      if (clipboard.kind !== 'block') return MW.toast('Nothing copied', true);
      const b = block();
      for (let l = 0; l < b.lines && l < clipboard.tracks.length; l++) {
        for (let t = 0; t < b.tracks && t < clipboard.tracks[l].length; t++) {
          const cur = b.rows[l][t];
          const tmp = { ...cur };
          Object.assign(cur, clipboard.tracks[l][t]);
          clipboard.tracks[l][t] = tmp;
        }
      }
      afterEdit();
    },

    insertLine() {
      const b = block();
      if (b.lines >= 3200) return MW.toast('Block is already 3200 lines', true);
      const line = app.cursor.line;
      b.rows.splice(line, 0, new Array(b.tracks).fill(0).map(() => MW.cell()));
      b.lines++;
      b.rows.length = b.lines;
      const hl = new Uint8Array(b.lines);
      hl.set(b.highlight.subarray(0, b.lines - 1));
      b.highlight = hl;
      afterEdit();
    },

    deleteLine() {
      const b = block();
      if (b.lines <= 1) return;
      b.rows.splice(app.cursor.line, 1);
      b.rows.push(new Array(b.tracks).fill(0).map(() => MW.cell()));
      b.lines--;
      b.rows.length = b.lines;
      app.cursor.line = Math.min(app.cursor.line, b.lines - 1);
      afterEdit();
    },

    insertTrack() {
      const b = block();
      if (b.tracks >= 16) return MW.toast('16 tracks is the limit', true);
      b.rows.forEach(r => r.splice(app.cursor.track, 0, MW.cell()));
      b.tracks++;
      afterEdit();
    },

    deleteTrack() {
      const b = block();
      if (b.tracks <= 1) return;
      b.rows.forEach(r => r.splice(app.cursor.track, 1));
      b.tracks--;
      app.cursor.track = Math.min(app.cursor.track, b.tracks - 1);
      afterEdit();
    },

    expand(factor) {
      const b = block();
      if (b.lines * factor > 3200) return MW.toast('Expanded block would exceed 3200 lines', true);
      const rows = [];
      for (let l = 0; l < b.lines; l++) {
        rows.push(b.rows[l]);
        for (let k = 1; k < factor; k++) rows.push(new Array(b.tracks).fill(0).map(() => MW.cell()));
      }
      b.rows = rows;
      b.lines = rows.length;
      b.highlight = new Uint8Array(b.lines);
      afterEdit();
    },

    shrink(factor) {
      const b = block();
      const rows = b.rows.filter((_, i) => i % factor === 0);
      b.rows = rows;
      b.lines = rows.length;
      b.highlight = new Uint8Array(b.lines);
      app.cursor.line = Math.min(app.cursor.line, b.lines - 1);
      afterEdit();
    },

    newBlock(here, useDefault) {
      const b = block();
      const nb = useDefault
        ? MW.createBlock(app.song.channels > 4 ? 8 : 4, 64)
        : MW.createBlock(b.tracks, b.lines);
      const at = here ? app.cursor.block + 1 : app.song.blocks.length;
      app.song.blocks.splice(at, 0, nb);
      if (here) {
        app.song.playseq = app.song.playseq.map(v => (v >= at ? v + 1 : v));
      }
      app.cursor.block = at;
      refreshAll();
    },

    highlightEvery(n) {
      const b = block();
      b.highlight = new Uint8Array(b.lines);
      for (let l = 0; l < b.lines; l += n) b.highlight[l] = 1;
      afterEdit();
    },

    clearHighlight() {
      const b = block();
      b.highlight = new Uint8Array(b.lines);
      afterEdit();
    },

    deleteLastBlock() {
      if (app.song.blocks.length <= 1) return MW.toast('Cannot delete the only block', true);
      const at = app.song.blocks.length - 1;
      app.song.blocks.pop();
      app.song.playseq = app.song.playseq.map(v => (v > at ? v - 1 : v === at ? 0 : v));
      app.cursor.block = Math.min(app.cursor.block, at - 1);
      refreshAll();
    },

    applyHighlight() {
      const b = block();
      const rows = document.querySelectorAll('#grid .grid-row');
      rows.forEach((r, i) => r.classList.toggle('hl', !!b.highlight[i]));
    },

    deleteBlock() {
      if (app.song.blocks.length <= 1) return MW.toast('Cannot delete the only block', true);
      const at = app.cursor.block;
      app.song.blocks.splice(at, 1);
      app.song.playseq = app.song.playseq.map(v => (v > at ? v - 1 : v === at ? 0 : v));
      app.cursor.block = Math.min(at, app.song.blocks.length - 1);
      refreshAll();
    },

    splitBlock() {
      const b = block();
      const at = app.cursor.line;
      if (at <= 0 || at >= b.lines) return MW.toast('Put the cursor inside the block first', true);
      const head = MW.createBlock(b.tracks, at);
      const tail = MW.createBlock(b.tracks, b.lines - at);
      for (let l = 0; l < at; l++) head.rows[l] = b.rows[l];
      for (let l = at; l < b.lines; l++) tail.rows[l - at] = b.rows[l];
      const idx = app.cursor.block;
      app.song.blocks.splice(idx, 1, head, tail);
      app.song.playseq = app.song.playseq.map(v => (v > idx ? v + 1 : v));
      app.cursor.block = idx + 1;
      app.cursor.line = 0;
      refreshAll();
    },

    joinBlock() {
      const idx = app.cursor.block;
      const a = app.song.blocks[idx], b = app.song.blocks[idx + 1];
      if (!b) return MW.toast('No following block', true);
      const merged = MW.createBlock(Math.max(a.tracks, b.tracks), a.lines + b.lines);
      for (let l = 0; l < a.lines; l++) for (let t = 0; t < merged.tracks; t++) merged.rows[l][t] = a.rows[l][t] || MW.cell();
      for (let l = 0; l < b.lines; l++) for (let t = 0; t < merged.tracks; t++) merged.rows[a.lines + l][t] = b.rows[l][t] || MW.cell();
      app.song.blocks.splice(idx, 2, merged);
      app.song.playseq = app.song.playseq.map(v => (v === idx + 1 ? idx : v > idx + 1 ? v - 1 : v));
      refreshAll();
    },

    transpose(semis) {
      const scope = app.transposeScope;
      const instScope = app.transposeInstrScope || 'all';
      const cur = app.currentIns;
      const apply = c => {
        if (!c.note) return;
        if (instScope === 'curr' && c.ins !== cur) return;
        c.note = MW.clamp(c.note + semis, 1, 120);
      };
      if (scope === 'song') {
        app.song.blocks.forEach(b => b.rows.forEach(r => r.forEach(apply)));
      } else if (scope === 'block') {
        block().rows.forEach(r => r.forEach(apply));
      } else if (scope === 'track') {
        block().rows.forEach(r => { if (r[app.cursor.track]) apply(r[app.cursor.track]); });
      } else if (scope === 'sel') {
        const b = block();
        b.rows.forEach(r => r.forEach((c, t) => { if (app.selectedTracks[t] && c) apply(c); }));
      } else if (scope === 'range' && app.selection) {
        const s = app.selection;
        const l0 = Math.min(s.l0, s.l1), l1 = Math.max(s.l0, s.l1);
        const t0 = Math.min(s.t0, s.t1), t1 = Math.max(s.t0, s.t1);
        const b = block();
        for (let l = l0; l <= l1 && l < b.lines; l++) {
          for (let t = t0; t <= t1 && t < b.tracks; t++) apply(b.rows[l][t]);
        }
      }
      afterEdit();
    },

    noteChange(exchange) {
      const readNote = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const value = String(el.value || '').trim();
        return MW.noteIndex(value.toUpperCase()) || parseInt(value, 10) || 0;
      };
      const from = readNote('tr-from');
      const to = readNote('tr-to');
      if (!from || !to) return;
      const b = block();
      b.rows.forEach(r => r.forEach(c => {
        if (c.note === from) c.note = to;
        else if (exchange && c.note === to) c.note = from;
      }));
      afterEdit();
    },

    instrumentChange(exchange) {
      const readIns = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const value = String(el.value || '').trim().toUpperCase();
        const base32 = parseInt(value, 32);
        return Number.isFinite(base32) ? base32 : parseInt(value, 10) || 0;
      };
      const from = readIns('tr-ins-from');
      const to = readIns('tr-ins-to');
      if (!from || !to) return;
      const b = block();
      b.rows.forEach(r => r.forEach(c => {
        if (c.ins === from) c.ins = to;
        else if (exchange && c.ins === to) c.ins = from;
      }));
      afterEdit();
    },

    instrumentDelete() {
      const el = document.getElementById('tr-ins-from');
      const value = el ? String(el.value || '').trim().toUpperCase() : '';
      const from = parseInt(value, 32) || parseInt(value, 10) || 0;
      if (!from) return;
      const b = block();
      b.rows.forEach(r => r.forEach(c => {
        if (c.ins === from) { c.note = 0; c.ins = 0; }
      }));
      afterEdit();
    },

    clearRange() {
      const s = app.selection;
      if (!s) return;
      const b = block();
      const l0 = Math.min(s.l0, s.l1), l1 = Math.max(s.l0, s.l1);
      const t0 = Math.min(s.t0, s.t1), t1 = Math.max(s.t0, s.t1);
      for (let l = l0; l <= l1 && l < b.lines; l++)
        for (let t = t0; t <= t1 && t < b.tracks; t++) MW.clearCell(b.rows[l][t]);
      afterEdit();
    },

    copyRange(cut) {
      const s = app.selection;
      if (!s) return MW.toast('Select a range first', true);
      const b = block();
      const l0 = Math.min(s.l0, s.l1), l1 = Math.max(s.l0, s.l1);
      const t0 = Math.min(s.t0, s.t1), t1 = Math.max(s.t0, s.t1);
      clipboard.kind = 'range';
      clipboard.tracksCount = t1 - t0 + 1;
      clipboard.lines = l1 - l0 + 1;
      clipboard.tracks = [];
      for (let l = l0; l <= l1 && l < b.lines; l++) {
        const row = [];
        for (let t = t0; t <= t1 && t < b.tracks; t++) {
          row.push({ ...b.rows[l][t] });
          if (cut) MW.clearCell(b.rows[l][t]);
        }
        clipboard.tracks.push(row);
      }
      afterEdit();
    },

    noteEcho(dist, min) {
      const s = app.selection;
      if (!s) return MW.toast('Select a range first', true);
      const b = block();
      const l0 = Math.min(s.l0, s.l1), l1 = Math.max(s.l0, s.l1);
      const t0 = Math.min(s.t0, s.t1), t1 = Math.max(s.t0, s.t1);
      const hex = !!app.song.flags.volhex;
      const enc = v => hex ? v : Math.floor(v / 10) * 16 + (v % 10);
      let made = 0;
      for (let l = l0; l <= l1; l++) {
        for (let t = t0; t <= t1; t++) {
          const src = b.rows[l][t];
          if (!src || !src.note) continue;
          let vol = src.ins && app.song.instruments[src.ins - 1]
            ? app.song.instruments[src.ins - 1].volume ?? 64
            : 64;
          for (let k = 1; k < 64; k++) {
            const line = l + k * dist;
            if (line > l1) break;
            vol = Math.floor(vol / 2);
            if (vol < min) break;
            const dst = b.rows[line][t];
            if (!dst || dst.note || dst.ins) continue;
            dst.note = src.note;
            dst.ins = src.ins;
            dst.cmd = 0x0c;
            dst.dat = enc(vol);
            made++;
          }
        }
      }
      afterEdit();
      MW.toast(made ? 'Note echo: ' + made + ' notes' : 'No empty lines for the echo', !made);
    },

    pasteRange(selectedOnly = false) {
      if (clipboard.kind !== 'range') return MW.toast('Nothing copied', true);
      const b = block();
      const sel = selectedOnly
        ? app.selectedTracks.map((v, i) => (v ? i : -1)).filter(i => i >= 0 && i < b.tracks)
        : Array.from({ length: clipboard.tracksCount }, (_, i) => app.cursor.track + i).filter(i => i < b.tracks);
      for (let l = 0; l < clipboard.lines; l++) {
        const target = app.cursor.line + l;
        if (target >= b.lines) break;
        for (let k = 0; k < sel.length && k < clipboard.tracks[l].length; k++) {
          Object.assign(b.rows[target][sel[k]], clipboard.tracks[l][k]);
        }
      }
      afterEdit();
    },

    spread(n) {
      const b = block();
      const src = b.rows.map(r => ({ ...r[app.cursor.track] }));
      for (let k = 1; k < n; k++) {
        const t = app.cursor.track + k;
        if (t >= b.tracks) break;
        for (let l = 0; l < b.lines; l++) {
          if (src[l] && src[l].note) Object.assign(b.rows[l][t], { ...src[l] });
        }
      }
      afterEdit();
    },

    makeSlide(mode) {
      const b = block();
      const t = app.cursor.track;
      const start = app.cursor.line;
      let next = -1;
      for (let l = start + 1; l < b.lines; l++) {
        if (b.rows[l][t].note) { next = l; break; }
      }
      if (next < 0) return MW.toast('No note after the cursor to slide to', true);
      const from = b.rows[start][t].note;
      const to = b.rows[next][t].note;
      if (!to) return;
      const span = next - start;
      if (span < 2) return MW.toast('Not enough room for a slide', true);

      if (mode === 's1') {
        const src = { ...b.rows[start][t] };
        for (let l = start; l < next; l++) MW.clearCell(b.rows[l][t]);
        const target = Math.min(next, start + 1);
        Object.assign(b.rows[target][t], { ...src, note: to, cmd: 3, dat: Math.max(1, Math.round(Math.abs(to - (from || to)) / span) || 1) });
      } else {
        const up = to > (from || to);
        for (let l = start + 1; l < next; l++) {
          b.rows[l][t].cmd = up ? 1 : 2;
          b.rows[l][t].dat = Math.max(1, Math.round(8 / span) || 1);
        }
      }
      afterEdit();
    },

    makeVolumeSlide() {
      const b = block();
      const t = app.cursor.track;
      const start = app.cursor.line;
      let next = -1;
      for (let l = start + 1; l < b.lines; l++) {
        if (b.rows[l][t].cmd === 0x0c) { next = l; break; }
      }
      if (next < 0) return MW.toast('No C command below the cursor', true);
      const from = b.rows[start][t].dat;
      const to = b.rows[next][t].dat;
      const span = next - start;
      const diff = to - from;
      for (let l = start + 1; l < next; l++) {
        const step = Math.round((Math.abs(diff) / span) * (l - start) / 1);
        const val = MW.clamp(from + Math.sign(diff) * step, 0, 64);
        b.rows[l][t].cmd = 0x0c;
        b.rows[l][t].dat = val;
      }
      afterEdit();
    },

    sampleEdit(act, inst, a, b, arg) {
      if (!inst || !inst.data) return;
      const d = inst.data;
      if (a > b) { const t = a; a = b; b = t; }
      switch (act) {
        case 'samp-copy':
          sampleClip.data = d.slice(a, b);
          MW.toast('Range copied to the buffer');
          return;
        case 'samp-clear':
          d.fill(0, a, b);
          break;
        case 'samp-cut':
          if (b - a >= d.length) { MW.toast('Cannot cut the entire sample', true); return false; }
          sampleClip.data = d.slice(a, b);
          // Cutting removes the same frames as delete, after copying them.
          // falls through
        case 'samp-delete': {
          if (b - a >= d.length) { MW.toast('Cannot delete the entire sample', true); return false; }
          const next = new Float32Array(d.length - (b - a));
          next.set(d.subarray(0, a));
          next.set(d.subarray(b), a);
          inst.data = next;
          inst._sel = null;
          inst._view = null;
          const map = p => p <= a ? p : p >= b ? p - (b - a) : a;
          const loopEnd = map((inst.loop || 0) + (inst.looplen || 0));
          inst.loop = map(inst.loop || 0);
          inst.looplen = Math.max(0, loopEnd - inst.loop);
          break;
        }
        case 'samp-paste': {
          if (!sampleClip.data) return MW.toast('Buffer is empty', true);
          const next = new Float32Array(d.length + sampleClip.data.length);
          next.set(d.subarray(0, a));
          next.set(sampleClip.data, a);
          next.set(d.subarray(a), a + sampleClip.data.length);
          inst.data = next;
          inst._sel = null;
          inst._view = null;
          if (inst.looplen) {
            if (a <= inst.loop) inst.loop += sampleClip.data.length;
            else if (a < inst.loop + inst.looplen) inst.looplen += sampleClip.data.length;
          }
          break;
        }
        case 'samp-volume': {
          const start = Number(arg && arg.startVolume) / 100;
          const end = Number(arg && arg.endVolume) / 100;
          if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
          for (let i = a; i < b; i++) {
            const fraction = (i - a) / Math.max(1, b - a - 1);
            d[i] = MW.clamp(d[i] * (start + (end - start) * fraction), -1, 1);
          }
          break;
        }
        case 'samp-copyall':
          sampleClip.data = d.slice();
          MW.toast('Sample copied to the buffer');
          return;
        case 'samp-restore':
          if (!sampleClip.data) return MW.toast('Buffer is empty', true);
          inst.data = sampleClip.data.slice();
          inst._abuf = null;
          return;
        case 'samp-mix': {
          if (!sampleClip.data) return MW.toast('Buffer is empty', true);
          const src = sampleClip.data;
          const limit = arg && arg.ranged ? Math.min(b, d.length) : d.length;
          for (let i = 0; i < src.length && a + i < limit; i++) {
            d[a + i] = MW.clamp(d[a + i] + src[i] * 0.7, -1, 1);
          }
          break;
        }
        case 'samp-echo': {
          const delay = Math.max(1, Math.round((arg && arg.delay) || 400));
          const decr = MW.clamp(Math.round((arg && arg.decr) || 0), 0, 100);
          const echoes = Math.max(1, Math.min(16, (arg && arg.count) || 3));
          const seg = d.slice(a, b);
          const fade = 1 - decr / 100;
          for (let e = 1; e <= echoes; e++) {
            const off = delay * e;
            const gain = Math.pow(fade, e);
            if (gain <= 0) break;
            for (let i = 0; i < seg.length; i++) {
              const j = a + off + i;
              if (j >= d.length) break;
              d[j] = MW.clamp(d[j] + seg[i] * gain, -1, 1);
            }
          }
          break;
        }
        case 'samp-filter': {
          const avg = MW.clamp(Math.round((arg && arg.avg) || 16), 1, 128);
          const dist = MW.clamp(Math.round((arg && arg.dist) || 1), 1, 128);
          const seg = d.slice();
          const at = j => seg[Math.max(0, Math.min(seg.length - 1, j))];
          for (let i = a; i < b; i++) {
            d[i] = MW.clamp((at(i - dist) * avg + at(i) + at(i + dist) * avg) / (2 * avg + 1), -1, 1);
          }
          break;
        }
        case 'samp-boost': {
          const avg = MW.clamp(Math.round((arg && arg.avg) || 16), 1, 128);
          const dist = MW.clamp(Math.round((arg && arg.dist) || 1), 1, 128);
          const seg = d.slice();
          const at = j => seg[Math.max(0, Math.min(seg.length - 1, j))];
          for (let i = a; i < b; i++) {
            const smoothed = (at(i - dist) * avg + at(i) + at(i + dist) * avg) / (2 * avg + 1);
            d[i] = MW.clamp(at(i) + (at(i) - smoothed), -1, 1);
          }
          break;
        }
        case 'samp-noise': {
          const level = (arg && arg.level != null ? arg.level : 24) / 128;
          for (let i = a; i < b; i++) d[i] = MW.clamp(d[i] + (Math.random() * 2 - 1) * level, -1, 1);
          break;
        }
        case 'samp-tosynth': {
          const seg = d.slice(a, b);
          if (seg.length < 2 || seg.length > 128) {
            MW.toast('Select 2 to 128 bytes to use as a waveform', true);
            return;
          }
          const here = MW.app.song.instruments[MW.app.currentIns - 1];
          if (here && here.synth) {
            here.synth.waveforms.push(Float32Array.from(seg));
            here._synthKey = null;
            MW.app.synthWave = here.synth.waveforms.length - 1;
          } else {
            let free = MW.app.song.instruments.findIndex(v => !v);
            if (free < 0) free = MW.app.currentIns - 1;
            const syn = MW.createInstrument('synth');
            syn.synth = MW.createSynth();
            syn.synth.waveforms = [Float32Array.from(seg)];
            syn.name = ((here && here.name) || 'wave') + ' syn';
            MW.app.song.instruments[free] = syn;
            MW.app.currentIns = free + 1;
            MW.app.synthWave = 0;
          }
          MW.refreshAll();
          MW.displays.show('synth');
          MW.toast('Range copied into a synthsound');
          return false;
        }
        case 'samp-buffsize': {
          const want = MW.clamp((arg && arg.size) || d.length, 1, 131072);
          if (want === d.length) return;
          const next = new Float32Array(want);
          next.set(d.subarray(0, Math.min(want, d.length)));
          inst.data = next;
          if (inst.dataR) {
            const right = new Float32Array(want);
            right.set(inst.dataR.subarray(0, Math.min(want, inst.dataR.length)));
            inst.dataR = right;
          }
          inst.loop = Math.min(inst.loop || 0, want - 1);
          inst.looplen = Math.min(inst.looplen || 0, want - inst.loop);
          inst._sel = null;
          inst._view = { a: 0, b: want };
          inst._abuf = null;
          break;
        }
        case 'samp-rate-up':
        case 'samp-rate-down':
        case 'samp-change-rate': {
          const f = act === 'samp-rate-up' ? 2 : act === 'samp-rate-down' ? 0.5 : Number(arg && arg.sourcePeriod) / Number(arg && arg.destPeriod);
          if (!Number.isFinite(f) || f <= 0) { MW.toast('Enter valid source and destination periods', true); return false; }
          const n = Math.max(2, Math.round(d.length / f));
          if (n > 131072) { MW.toast('Converted sample exceeds buffer size', true); return false; }
          const out = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const src = i * f;
            const a0 = Math.floor(src), fr = src - a0;
            out[i] = d[Math.min(a0, d.length - 1)] * (1 - fr) + d[Math.min(a0 + 1, d.length - 1)] * fr;
          }
          inst.data = out;
          inst._view = { a: 0, b: n };
          inst._sel = null;
          inst.loop = Math.round((inst.loop || 0) / f);
          inst.looplen = Math.round((inst.looplen || 0) / f);
          inst._abuf = null;
          break;
        }
        case 'samp-zleft':
          while (inst.loop > 0 && Math.abs(d[inst.loop]) > 0.02) inst.loop--;
          return afterEdit();
        case 'samp-zright':
          while (inst.loop < d.length - 1 && Math.abs(d[inst.loop]) > 0.02) inst.loop++;
          return afterEdit();
        case 'samp-play':
          MW.voicePreview(25, app.currentIns);
          return;
        case 'samp-loop':
          if (inst.looplen > 2) { inst._loopSaved = { start: inst.loop, length: inst.looplen }; inst.looplen = 0; }
          else { const saved = inst._loopSaved; inst.loop = saved ? Math.min(saved.start, d.length - 1) : 0; inst.looplen = saved ? Math.min(saved.length, d.length - inst.loop) : d.length; }
          return;
        case 'samp-rev': {
          const seg = d.slice(a, b).reverse();
          d.set(seg, a);
          break;
        }
        case 'samp-norm': {
          let peak = 0;
          for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(d[i]));
          if (peak > 0.01) {
            const k = 0.98 / peak;
            for (let i = a; i < b; i++) d[i] *= k;
          }
          break;
        }
        case 'samp-fadein':
          for (let i = a; i < b; i++) d[i] *= (i - a) / Math.max(1, b - a);
          break;
        case 'samp-fadeout':
          for (let i = a; i < b; i++) d[i] *= 1 - (i - a) / Math.max(1, b - a);
          break;
        case 'samp-crop': {
          inst.data = d.slice(a, b);
          inst._abuf = null;
          return;
        }
        default: return;
      }
      inst._abuf = null;
      afterEdit();
    }
  };

  /* ------------------------------------------------------------ keyboard */

  const NOTE_KEYS = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
    ',': 12, l: 13, '.': 14, ';': 15, '/': 16,
    q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20,
    y: 21, '7': 22, u: 23, i: 24, '9': 25, o: 26, '0': 27, p: 28, '[': 29, '=': 30
  };

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  /* move the active cell sideways along the play head line */
  function moveHoriz(d) {
    const b = block();
    let t = app.cursor.track;
    let f = app.cursor.field + d;
    while (f < 0) {
      if (t > 0) { t--; f += 4; } else { f = 0; break; }
    }
    while (f > 3) {
      if (t < b.tracks - 1) { t++; f -= 4; } else { f = 3; break; }
    }
    app.cursor.track = t;
    app.cursor.field = f;
    MW.grid.refreshLine(app.cursor.line);
    MW.touchStatus('cursor', ['cursor']);
  }

  function moveCursor(dLine, dTrack, dField) {
    const b = block();
    if (dTrack) {
      app.cursor.track = MW.clamp(app.cursor.track + dTrack, 0, b.tracks - 1);
    }
    if (dField) {
      let f = app.cursor.field + dField;
      let t = app.cursor.track;
      while (f < 0) { f += 4; t--; }
      while (f > 3) { f -= 4; t++; }
      if (t < 0) { t = 0; f = 0; }
      if (t >= b.tracks) { t = b.tracks - 1; f = 3; }
      app.cursor.track = t;
      app.cursor.field = f;
    }
    if (dLine) {
      let l = app.cursor.line + dLine * app.step;
      if (l < 0) {
        if (app.cursor.block > 0) { app.cursor.block--; l = block().lines - 1; }
        else l = 0;
      } else if (l >= b.lines) {
        if (app.cursor.block < app.song.blocks.length - 1) { app.cursor.block++; l = 0; }
        else l = b.lines - 1;
      }
      app.cursor.line = l;
      app.cursor.seq = app.song.playseq.indexOf(app.cursor.block) >= 0 ? app.song.playseq.indexOf(app.cursor.block) : app.cursor.seq;
    }
    app.typePending = 0;
    MW.grid.render();
    MW.touchStatus('cursor', ['cursor']);
  }

  function insertNote(note) {
    const c = curCell();
    if (!c) return;
    c.note = note;
    c.ins = app.currentIns;
    MW.voicePreview(note, app.currentIns);
    advanceCursor();
    afterEdit();
  }

  /* SP on the status bar makes the cursor move by the line add (SPC) */
  function advanceCursor(spaced) {
    const b = block();
    const step = spaced ? Math.max(1, app.step) : 1;
    switch (app.advance) {
      case 'up': app.cursor.line = Math.max(0, app.cursor.line - step); break;
      case 'right': app.cursor.field = Math.min(3, app.cursor.field + 1); break;
      case 'left': app.cursor.field = Math.max(0, app.cursor.field - 1); break;
      case 'nexttrk': app.cursor.track = Math.min(b.tracks - 1, app.cursor.track + 1); break;
      case 'prevtrk': app.cursor.track = Math.max(0, app.cursor.track - 1); break;
      default:
        if (app.cursor.line + step < b.lines) app.cursor.line += step;
        else if (app.cursor.block < app.song.blocks.length - 1) { app.cursor.block++; app.cursor.line = 0; }
        break;
    }
  }

  MW.advanceCursorPublic = () => advanceCursor();

  /* ------------------------------------------------------------ keyboard */

  /* OctaMED's two-row piano, semitone offsets from the base octave. */
  const PIANO = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
    ',': 12, l: 13, '.': 14, ';': 15, '/': 16,
    q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20,
    y: 21, '7': 22, u: 23, i: 24, '9': 25, o: 26, '0': 27, p: 28, '[': 29, '=': 30
  };
  MW.noteFromPianoKey = function (key, octave) {
    const offset = PIANO[String(key).toLowerCase()];
    return offset === undefined ? null : MW.clamp(octave * 12 + 1 + offset, 1, 120);
  };

  const PANEL_ORDER = ['play', 'instr', 'block', 'edit', 'range', 'transp', 'vol', 'midi', 'files', 'misc'];
  const ADVANCE_ORDER = ['down', 'up', 'right', 'left', 'nexttrk', 'prevtrk'];

  /* programmable keys: Shift 0-9 insert a stored note or command */
  app.prog = app.prog || Array.from({ length: 10 }, () => ({ note: 0, ins: 0, cmd: 0, dat: 0 }));
  let chordNotes = [];
  app.chordStartTrack = 0;
  let chordTimer = 0;

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  }

  function resetTimer() { if (MW.scope) MW.scope.elapsed = 0; }

  function visibleTracks() {
    const wrap = document.getElementById('grid-wrap');
    if (!wrap) return 8;
    return Math.max(1, Math.floor((wrap.clientWidth - 52) / MW.grid.trackWidth(block().tracks)));
  }

  function setInstrument(n) {
    const next = MW.clamp(n || 1, 1, 63);
    if (next !== app.currentIns) app.lastIns = app.currentIns;
    app.currentIns = next;
    if (MW.displays && MW.displays.refresh) MW.displays.refresh();
    MW.touchStatus('instrument', ['currentIns']);
  }
  MW.setInstrument = setInstrument;

  function selectIns(delta) {
    setInstrument(app.currentIns + delta);
  }

  function selectBlock(dir) {
    app.cursor.block = MW.clamp(app.cursor.block + dir, 0, app.song.blocks.length - 1);
    app.cursor.line = 0;
    syncSeq();
    refreshAll();
  }

  function syncSeq() {
    const at = app.song.playseq.indexOf(app.cursor.block);
    if (at >= 0) app.cursor.seq = at;
  }

  function applyProgKey(i) {
    const b = block();
    const t = app.prog[i];
    if (!b || !t) return;
    const n = MW.applyProgDefinition(b, app.cursor.track, app.cursor.line, t);
    if (!n) return;
    for (let k = 0; k < n; k++) advanceCursor(app.autoSpace);
    afterEdit();
  }

  /* the panel edits one of twelve definitions: the ten Shift keys or
     one of the two Alt templates */
  function currentDef() {
    if (app.progAlt === 'L') return app.altL;
    if (app.progAlt === 'R') return app.altR;
    return app.prog[app.progTarget];
  }

  function setCurrentDef(def) {
    if (app.progAlt === 'L') app.altL = def;
    else if (app.progAlt === 'R') app.altR = def;
    else app.prog[app.progTarget] = def;
  }

  function defName() {
    return app.progAlt === 'L' ? 'L.Alt' : app.progAlt === 'R' ? 'R.Alt' : 'Shift-' + app.progTarget;
  }

  function pickProgKey() {
    const c = curCell();
    if (!c) return;
    /* the note characters of the Alt definitions are always wildcards */
    const note = app.progAlt === 'C' ? c.note : null;
    setCurrentDef({ note, ins: c.ins, cmd: c.cmd, dat: c.dat, cells: null });
    MW.toast(defName() + ' set to ' + MW.noteName(c.note, app.hb) + ' ' + MW.insName(c.ins));
    MW.panels.refresh();
  }

  function pickProgRange() {
    const s = app.selection;
    if (!s) return MW.toast('Select a range first', true);
    const b = block();
    const l0 = Math.min(s.l0, s.l1);
    const t0 = Math.min(s.t0, s.t1);
    const first = b.rows[l0] && b.rows[l0][t0];
    if (!first) return;
    const note = app.progAlt === 'C' ? first.note : null;
    const cells = MW.progGroupFromRange(b, s, Math.min(s.t0, s.t1));
    setCurrentDef({ note, ins: first.ins, cmd: first.cmd, dat: first.dat, cells });
    MW.toast(defName() + ' picked ' + cells.length + ' lines from the range');
    MW.panels.refresh();
  }

  function pickProgBuffer() {
    if (clipboard.kind !== 'range' || !clipboard.tracks.length) return MW.toast('Copy a range first', true);
    const first = clipboard.tracks[0][0];
    const note = app.progAlt === 'C' ? first.note : null;
    setCurrentDef({ note, ins: first.ins, cmd: first.cmd, dat: first.dat });
    MW.toast(defName() + ' picked from the buffer');
    MW.panels.refresh();
  }

  function nextTrackFrom(t, tracks) {
    const sel = app.selectedTracks.some(Boolean);
    for (let i = t + 1; i < tracks; i++) if (!sel || app.selectedTracks[i]) return i;
    return -1;
  }

  function chordPress(note) {
    if (!chordNotes.length) app.chordStartTrack = app.cursor.track;
    chordNotes.push(note);
    clearTimeout(chordTimer);
    chordTimer = setTimeout(flushChord, 380);
    MW.voicePreview(note, app.currentIns);
  }

  function flushChord() {
    const notes = chordNotes.slice();
    chordNotes = [];
    if (!notes.length) return;
    const b = block();
    let t = app.chordStartTrack;
    if (t == null || t < 0 || t >= b.tracks) t = app.cursor.track;
    for (const n of notes) {
      if (t < 0 || t >= b.tracks) break;
      const c = b.rows[app.cursor.line][t];
      if (c) { c.note = n; c.ins = app.currentIns; }
      t = nextTrackFrom(t, b.tracks);
    }
    app.cursor.track = app.chordStartTrack;
    advanceCursor(app.autoSpace);
    afterEdit();
  }

  function enterNote(offset, altSide) {
    const n = MW.clamp(app.octave * 12 + 1 + offset, 1, 120);
    if (app.chordMode) { chordPress(n); return; }
    const c = curCell();
    if (!c) return;
    c.note = n;
    c.ins = app.currentIns;
    const t = altSide === 'right' ? app.altR : altSide === 'left' ? app.altL : null;
    if (t) {
      if (t.ins != null) c.ins = t.ins;
      if (t.cmd != null) { c.cmd = t.cmd; c.dat = t.dat == null ? 0 : t.dat; }
      else if (t.dat != null) c.dat = t.dat;
    }
    MW.voicePreview(n, app.currentIns);
    if (app.playOnNote && !MW.player.playing) {
      MW.player.playBlock(app.cursor.block);
    }
    advanceCursor(app.autoSpace);
    afterEdit();
  }

  MW.advanceCursorPublic = () => advanceCursor();

  function typeIntoField(ch) {
    const c = curCell();
    if (!c) return;
    const digit = /^[0-9a-v]$/i.test(ch) ? parseInt(ch, 36) : -1;
    if (digit < 0) return;
    const hex = /^[0-9a-f]$/i.test(ch) ? parseInt(ch, 16) : -1;

    /* don't let digits typed in one column merge with another */
    if (app.typeField !== app.cursor.field) { app.typePending = 0; app.typeField = app.cursor.field; }

    if (app.cursor.field === 1) {
      /* instruments are base 32: 01 - 1V */
      app.typePending = app.typePending * 32 + digit;
      if (app.typePending > 63) app.typePending = digit;
      c.ins = MW.clamp(app.typePending, 0, 63);
      if (c.ins) app.currentIns = c.ins;
      clearTimeout(app.typeTimer);
      app.typeTimer = setTimeout(() => { app.typePending = 0; }, 900);
    } else if (app.cursor.field === 2) {
      if (hex < 0) return;
      /* low commands are one digit, but 0x10 and up need two. Accept a
         second digit only when together they form a real extended
         command, so typing "9" then "3" still means 9, then 3. */
      const two = app.typePending * 16 + hex;
      clearTimeout(app.typeTimer);
      if (two >= 0x10 && two <= 0x2f) {
        c.cmd = two;
        app.typePending = 0;
      } else {
        c.cmd = hex;
        app.typePending = hex;
        app.typeTimer = setTimeout(() => { app.typePending = 0; }, 900);
      }
    } else if (app.cursor.field === 3) {
      if (hex < 0) return;
      app.typePending = (app.typePending * 16 + hex) & 0xff;
      c.dat = app.typePending;
      clearTimeout(app.typeTimer);
      app.typeTimer = setTimeout(() => { app.typePending = 0; }, 900);
    }
    afterEdit();
  }

  function onKeyDown(e) {
    /* Esc is the Edit Mode switch, even while a field has focus */
    if (e.key === 'Escape') {
      app.editMode = !app.editMode;
      MW.touchStatus('edit', ['editMode']);
      return;
    }
    if (isTypingTarget(e)) return;

    const key = e.key;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const ctrl = e.ctrlKey;
    const meta = e.metaKey;
    const lower = key.length === 1 ? key.toLowerCase() : key;

    /* remember which Alt is down: the note event itself cannot tell us */
    if (key === 'Alt') { app.altHeld = e.code === 'AltRight' ? 'right' : 'left'; return; }

    /* the Amiga key. Meta is the honest mapping; Ctrl is accepted for the
       file and clipboard shortcuts a browser leaves alone. */
    const amiga = meta || (ctrl && !shift && !alt && !/^[0-9]$/.test(key)
      && key !== ' ' && !/^(a|z)$/i.test(key));

    const b = block();

    if (MW.displays.current === 'sample' && !ctrl && !alt && !meta && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      MW.displays.scrollSample(key === 'ArrowLeft' ? -1 : 1);
      e.preventDefault();
      return;
    }

    // In notation view the horizontal cursor follows pattern lines, not tracks.
    if (MW.displays.current === 'notation' && !ctrl && !alt && !meta && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      app.cursor.line = MW.clamp(app.cursor.line + (key === 'ArrowLeft' ? -1 : 1), 0, b.lines - 1);
      MW.displays.refresh();
      MW.touchStatus('cursor', ['cursor']);
      e.preventDefault();
      return;
    }

    /* ---------------- panels ---------------- */
    if (ctrl && /^F([1-9]|10)$/.test(key)) {
      MW.panels.show(PANEL_ORDER[parseInt(key.slice(1), 10) - 1]);
      e.preventDefault();
      return;
    }
    if (ctrl && !shift && !alt && /^[0-9]$/.test(key)) {
      const order = ['files', 'play', 'instr', 'block', 'edit', 'range', 'transp', 'vol', 'midi', 'misc'];
      MW.panels.show(order[parseInt(key, 10)]);
      e.preventDefault();
      return;
    }

    /* ---------------- transport ---------------- */
    if (key === ' ') {
      e.preventDefault();
      if (app.ptkey) {
        if (MW.player.playing) { MW.player.stop(); return; }
        app.editMode = !app.editMode;
        MW.touchStatus('edit', ['editMode']);
        return;
      }
      if (app.spaceAsDel && app.editMode && !shift && !alt) {
        const c = curCell();
        if (c) { c.note = 0; c.ins = 0; }
        advanceCursor();
        afterEdit();
        return;
      }
      if (shift && alt) { resetTimer(); MW.player.play(true); }
      else if (shift) { resetTimer(); MW.player.play(false); }
      else if (alt) { resetTimer(); MW.player.playBlock(app.cursor.block); }
      else if (MW.player.playing) MW.player.stop();
      else { resetTimer(); MW.player.play(true); }
      return;
    }
    if (ctrl && key === ' ') { e.preventDefault(); MW.midiPanic(); MW.toast('MIDI reset'); return; }

    /* ---------------- Amiga key ---------------- */
    if (amiga) {
      switch (lower) {
        case 'x': e.preventDefault(); shift ? ops.cutBlock() : ops.cutTrack(); return;
        case 'c': e.preventDefault(); shift ? ops.copyBlock() : ops.copyTrack(); return;
        case 'v': e.preventDefault(); shift ? ops.pasteBlock() : ops.pasteTrack(); return;
        case 't': e.preventDefault(); ops.makeSlide(shift ? 's2' : 's1'); return;
        case 'l': e.preventDefault(); document.getElementById('file-input').click(); return;
        case 'p': e.preventDefault(); resetTimer(); MW.player.play(true); return;
        case 'f':
          e.preventDefault();
          app.song.flags.filteron = app.song.flags.filteron ? 0 : 1;
          MW.audio.setFilter(!!app.song.flags.filteron);
          MW.panels.refresh();
          return;
        case 'i': {
          e.preventDefault();
          MW.panels.show('instr');
          const el = document.querySelector('#ins-name');
          if (el) { if (shift) el.value = ''; el.focus(); el.select(); }
          return;
        }
        case 'r': {
          e.preventDefault();
          MW.panels.show('instr');
          const el = document.querySelector('[data-act="ins-loop"]');
          if (el) { el.focus(); el.select(); }
          return;
        }
        case 'j': e.preventDefault(); MW.toast('Pointer jumping has no meaning here'); return;
        default: break;
      }
    }

    /* ---------------- cursor keys ---------------- */
    if (key.startsWith('Arrow')) {
      e.preventDefault();
      const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
      const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;

      if (shift && alt && dx) { selectIns(dx * 16); return; }
      if (ctrl && dx) { moveCursor(0, dx * visibleTracks(), 0); return; }
      if (shift && dy) { selectBlock(dy); return; }
      if (shift && dx) { selectIns(dx); return; }
      if (alt && !shift && dy) {
        app.cursor.block = dy < 0 ? 0 : app.song.blocks.length - 1;
        app.cursor.line = 0;
        syncSeq();
        refreshAll();
        return;
      }
      if (alt && !shift && dx) { moveCursor(0, dx, 0); return; }
      if (dy) MW.grid.scrollRows(dy * (app.autoSpace ? Math.max(1, app.step) : 1)); else moveHoriz(dx);
      return;
    }

    /* ---------------- definition keys ---------------- */
    if (key === 'Delete') {
      e.preventDefault();
      if (!app.editMode) return;
      const c = curCell();
      if (!c) return;
      if (shift) MW.clearCell(c);
      else if (alt) { c.cmd = 0; c.dat = 0; }
      else if (app.cursor.field === 0) { c.note = 0; c.ins = 0; }
      else if (app.cursor.field === 1) c.ins = 0;
      else if (app.cursor.field === 2) c.cmd = 0;
      else c.dat = 0;
      afterEdit();
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      if (!app.editMode) return;
      if (shift && alt) ops.insertTrack();
      else if (alt) ops.deleteTrack();
      else if (shift) ops.insertLine();
      else ops.deleteLine();
      return;
    }

    if (key === 'Tab') {
      e.preventDefault();
      moveHoriz(shift ? -1 : 1);
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      if (!app.editMode) return;
      const c = curCell();
      if (c) { c.note = 0; c.ins = app.currentIns; }
      advanceCursor(app.autoSpace);
      afterEdit();
      return;
    }

    if (key === '~' || key === '`') {
      app.autoSpace = !app.autoSpace;
      MW.touchStatus('space', ['autoSpace']);
      return;
    }

    /* ---------------- numeric keypad ---------------- */
    if (/^Numpad[0-9]$/.test(e.code) || /^Numpad(Enter|Decimal|Add|Subtract|Divide|Multiply)$/.test(e.code)) {
      e.preventDefault();
      const d = /^Numpad[0-9]$/.test(e.code) ? parseInt(e.code.slice(6), 10) : -1;
      if (app.padMode === 'instr') {
        if (app.padMap2) {
          if (e.code === 'NumpadAdd') setInstrument(app.currentIns + 1);
          else if (e.code === 'NumpadSubtract') setInstrument(app.currentIns - 1);
          else if (e.code === 'NumpadDivide') setInstrument(app.lastIns);
          else if (e.code === 'NumpadMultiply') setInstrument(app.lastOccupiedIns || app.currentIns);
          else if (d >= 0) setInstrument(d + 1);
        } else {
          const map = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5];
          if (d >= 0) setInstrument(map[d] + 1);
        }
      } else if (app.padMap2) {
        const map = {
          Numpad7: 0, Numpad8: 1, Numpad9: 2, NumpadSubtract: 3,
          Numpad4: 4, Numpad5: 5, Numpad6: 6, NumpadAdd: 7,
          Numpad1: 8, Numpad2: 9, Numpad3: 10,
          Numpad0: 12, NumpadDecimal: 13, NumpadEnter: 15
        };
        if (e.code === 'NumpadDecimal') {
          for (let t = 0; t < 16; t++) { app.mutedTracks[t] = true; MW.player.channels[t].muted = true; }
        } else if (e.code === 'NumpadEnter') {
          for (let t = 0; t < 16; t++) { app.mutedTracks[t] = false; MW.player.channels[t].muted = false; }
        } else if (map[e.code] != null) {
          const t = map[e.code];
          app.mutedTracks[t] = !app.mutedTracks[t];
          MW.player.channels[t].muted = app.mutedTracks[t];
        }
        MW.grid.render();
        MW.touchStatus('mute', ['mutedTracks']);
      } else if (d >= 0) {
        app.mutedTracks[d] = !app.mutedTracks[d];
        MW.player.channels[d].muted = app.mutedTracks[d];
        MW.grid.render();
        MW.touchStatus('mute', ['mutedTracks']);
      }
      return;
    }

    /* ---------------- function keys ---------------- */
    if (/^F([1-9]|1[0-2])$/.test(key)) {
      e.preventDefault();
      const n = parseInt(key.slice(1), 10);
      if (n >= 1 && n <= 5) {
        app.octave = n - 1;
        MW.touchStatus('octave', ['octave']);
      } else if (app.ptkey && n >= 3 && n <= 5 && (shift || alt)) {
        const op = n === 3 ? 'cut' : n === 4 ? 'copy' : 'paste';
        if (alt) ops[op + 'Block'](); else ops[op + 'Track']();
      } else if (n >= 6 && n <= 10) {
        app.cursor.line = Math.min(b.lines - 1, Math.round(((n - 6) / 4) * b.lines));
        MW.grid.render();
        MW.touchStatus('cursor', ['cursor']);
      }
      return;
    }

    if (ctrl && lower === 'a') {
      e.preventDefault();
      const i = ADVANCE_ORDER.indexOf(app.advance);
      app.advance = ADVANCE_ORDER[(i + 1) % ADVANCE_ORDER.length];
      MW.toast('Cursor advance: ' + app.advance);
      MW.panels.refresh();
      return;
    }

    if (ctrl && lower === 'f') {
      e.preventDefault();
      let bytes = 0;
      app.song.instruments.forEach(i => { if (i && i.data) bytes += i.data.length; });
      MW.toast(`Samples ${(bytes / 1024).toFixed(0)} KB in ${app.song.instruments.filter(i => i && i.data).length} slots`);
      return;
    }

    /* ---------------- programmable keys ---------------- */
    /* Shift + a number row key produces a symbol as e.key on most layouts,
       so read the digit from the physical key */
    const shiftDigit = /^Digit[0-9]$/.test(e.code || '') ? e.code.slice(5)
      : /^[0-9]$/.test(key) ? key : null;
    if (ctrl && shift && shiftDigit != null) { e.preventDefault(); pickProgKey(parseInt(shiftDigit, 10)); return; }
    if (shift && shiftDigit != null) { e.preventDefault(); applyProgKey(parseInt(shiftDigit, 10)); return; }

    /* ---------------- notes and numbers ---------------- */
    /* Option changes e.key on macOS, so hold Alt reads the physical key */
    const physical = /^Key([A-Z])$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : null;
    const pianoKey = alt && physical ? physical : lower;
    const off = PIANO[pianoKey];
    /* in the note column every piano key is a note; in the numeric
       columns the digits must win, or 0/2/3/5/7/9 can't be typed */
    if (off !== undefined && !(app.editMode && app.cursor.field > 0)) {
      e.preventDefault();
      if (app.editMode && app.cursor.field === 0) enterNote(off, alt ? (app.altHeld || 'left') : null);
      else if (!app.editMode) MW.voicePreview(MW.clamp(app.octave * 12 + 1 + off, 1, 120), app.currentIns);
      return;
    }

    if (app.editMode && app.cursor.field > 0 && /^[0-9a-v]$/i.test(key)) {
      e.preventDefault();
      /* Alt plus a digit sets the high command nibble: Alt-9 is command 19 */
      const altDigit = alt && /^Digit[0-9]$/.test(e.code || '') ? e.code.slice(5) : null;
      if (altDigit != null && app.cursor.field === 2) {
        const c = curCell();
        if (c) { c.cmd = 0x10 + parseInt(altDigit, 16); afterEdit(); }
        return;
      }
      typeIntoField(lower);
      return;
    }

    if (app.editMode && app.cursor.field === 0 && (key === '-' || key === '_')) {
      e.preventDefault();
      const c = curCell();
      if (c) { c.note = 0; c.ins = 0; }
      advanceCursor();
      afterEdit();
    }
  }

  function extendSelection(dLine, dTrack, dLine2) {
    if (!app.selection) {
      app.selection = { l0: app.cursor.line, l1: app.cursor.line, t0: app.cursor.track, t1: app.cursor.track };
    }
    if (dLine || dLine2) app.selection.l1 = MW.clamp(app.selection.l1 + (dLine || dLine2), 0, block().lines - 1);
    if (dTrack) app.selection.t1 = MW.clamp(app.selection.t1 + dTrack, 0, block().tracks - 1);
    MW.grid.render();
    MW.touchStatus('selection', ['selection']);
  }

  function toggleHighlight() {
    const b = block();
    b.highlight[app.cursor.line] = b.highlight[app.cursor.line] ? 0 : 1;
    MW.grid.render();
  }

  /* ------------------------------------------------------------ file io */

  function handleFileBuffer(buffer, name) {
    let bytes;
    try {
      bytes = new Uint8Array(buffer);
    } catch (e) {
      return MW.toast('Could not read that file', true);
    }

    if (MW.isLHA(bytes)) {
      let archive;
      try {
        archive = MW.readLHA(bytes);
      } catch (e) {
        return MW.toast('That archive could not be read: ' + e.message, true);
      }
      const mods = MW.lhaModules(archive);
      if (!mods.length) {
        const what = archive.entries.length
          ? archive.entries.map(e => e.name).slice(0, 3).join(', ')
          : (archive.skipped.slice(0, 3).join(', ') || 'nothing');
        return MW.toast('No modules inside ' + (name || 'that archive') + ' — found ' + what, true);
      }
      if (mods.length === 1) {
        MW.toast('Extracted ' + mods[0].name + ' from ' + (name || 'the archive'));
        return openBuffer(mods[0].data.slice().buffer, mods[0].name.split('/').pop());
      }
      return MW.requester.openEntries(mods, name || 'Archive');
    }

    openBuffer(buffer, name);
  }
  MW.handleFileBuffer = handleFileBuffer;

  function replaceModule(song) {
    app.notaPresets = [];
    app.notaPresetReady = false;
    app.notaSelectedTrack = null;
    app.notaTracks = {};
    app.notaGhost = {};
    app.notaInstruments = {};
    app.notaSave = false;
    app.song = song;
    app.cursor = { block: song.playseq[0] || 0, line: 0, track: 0, field: 0, seq: 0 };
    app.currentIns = 1;
    app.selection = null;
    app.mutedTracks = new Array(16).fill(false);
    app.selectedTracks = new Array(16).fill(false);
    const shared = song.instruments;
    (song.multis || []).forEach(m => { m.instruments = shared; });
    app.songList = [song].concat(song.multis || []);
    app.songIndex = 0;
    app.seq = 0;
    MW.lastSeq = -1;
    MW.player.setSong(song);
    MW.grid.lastPlayLine = -1;
    refreshAll();
  }

  function openBuffer(buffer, name) {
    let song;
    try {
      song = MW.loadModule(buffer);
    } catch (err) {
      MW.toast(err.friendly ? err.message : 'Could not read this file: ' + err.message, true);
      return;
    }
    if (!song) { MW.toast('Not a module Octanaut recognises', true); return; }

    if (song.channels > 16) song.channels = 16;
    song.name = name ? name.replace(/\.[^.]+$/, '') : song.name;
    replaceModule(song);
    MW.panels.show('play');

    const usedInstruments = new Set();
    [song, ...(song.multis || [])].forEach(part => part.blocks.forEach(block => block.rows.forEach(row => row.forEach(cell => { if (cell.ins) usedInstruments.add(cell.ins); }))));
    const missing = song.instruments.filter((i, index) => i && i.missing && usedInstruments.has(index + 1)).length;
    if (missing) MW.toast(`Loaded ${song.format}. ${missing} instrument slots reference external samples.`);
    else MW.toast(`Loaded ${song.format}: ${song.blocks.length} blocks, ${song.channels} tracks`);
    MW.emit('song', song);
  }
  MW.missing = function (name) {
    MW.toast((name || 'That feature') + ' is not implemented yet', true);
  };

  MW.openBuffer = openBuffer;

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => handleFileBuffer(reader.result, file.name);
    reader.readAsArrayBuffer(file);
  }

  function downloadJSON(name, data, mime) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function saveMidiJson(kind) {
    const base = (app.song.name || 'octanaut').replace(/[^\w.-]+/g, '_');
    if (kind === 'msg') downloadJSON(base + '-messages.json', { messages: app.midiMessages, index: app.midiMsgIndex });
    else if (kind === 'map') downloadJSON(base + '-map.json', { map: app.midiMap });
    else downloadJSON(base + '-midi.json', { messages: app.midiMessages, index: app.midiMsgIndex, map: app.midiMap });
    MW.toast('Saved MIDI ' + (kind === 'msg' ? 'messages' : 'map'));
  }

  function loadMidiJson(kind) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (kind === 'msg' && Array.isArray(data.messages)) {
            app.midiMessages = data.messages;
            app.midiMsgIndex = MW.clamp(data.index || 0, 0, app.midiMessages.length - 1);
          } else if (kind === 'map' && Array.isArray(data.map)) {
            app.midiMap = data.map;
            app.midiMapActive = true;
          } else if (kind === 'dump' && (Array.isArray(data.messages) || Array.isArray(data.map))) {
            if (Array.isArray(data.messages)) {
              app.midiMessages = data.messages;
              app.midiMsgIndex = MW.clamp(data.index || 0, 0, app.midiMessages.length - 1);
            }
            if (Array.isArray(data.map)) { app.midiMap = data.map; app.midiMapActive = true; }
          } else {
            throw new Error('not a MIDI ' + kind + ' file');
          }
          MW.panels.refresh();
          MW.toast('Loaded MIDI ' + (kind === 'msg' ? 'messages' : 'map'));
        } catch (err) {
          MW.toast('Load failed: ' + err.message, true);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async function deleteFile() {
    const req = MW.requester;
    const entry = req && req.entries && req.entries[req.selected];
    if (!req || !req.dir || !entry || entry.dir) return MW.toast('Pick a file in a folder first', true);
    try {
      await req.dir.removeEntry(entry.name);
      await req.listDir();
      MW.toast('Deleted ' + entry.name);
    } catch (err) {
      MW.toast('Delete failed: ' + err.message, true);
    }
  }

  function saveModule(format) {
    try {
      if (app.notaPresetReady && MW.captureNotation) app.song.notation = app.notaSave ? MW.captureNotation(app) : null;
      const chosen = format === 0 ? 'mmd0' : format === 1 ? 'mmd1' : (app.saveFormat || 'mmd1');
      if (chosen === 'st') { saveST(); return; }
      const noInstr = chosen === 'mmd1n';
      const mmd1 = chosen !== 'mmd0';
      const list = (app.songList && app.songList.length > 1)
        ? app.songList
        : [app.song];
      let others = [];
      if (list.length > 1) {
        const all = typeof confirm === 'function'
          ? confirm(`This module holds ${list.length} songs. Save all of them? Cancel saves only the current song.`)
          : true;
        others = all ? list.filter(s => s !== app.song) : [];
      }
      const buf = mmd1
        ? MW.writeMMD1(app.song, others, { instruments: !noInstr })
        : MW.writeMMD0(app.song, others);
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (app.song.name || 'untitled') + (mmd1 ? '.med' : '.mmd0');
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      MW.toast('Saved ' + (mmd1 ? (noInstr ? 'MMD1 (.med, no instruments)' : 'MMD1 (.med)') : 'MMD0') + (others.length ? ` with ${others.length + 1} songs` : ''));
    } catch (err) {
      MW.toast('Save failed: ' + err.message, true);
    }
  }
  MW.saveModule = () => saveModule(1);
  MW.saveMMD0 = () => saveModule(0);


  function saveST() {
    try {
      const buf = MW.writeMOD(app.song);
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (app.song.name || 'untitled') + '.mod';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      MW.toast('Saved ProTracker module: 4 tracks, 31 instruments, effects converted');
    } catch (err) {
      MW.toast('Export failed: ' + err.message, true);
    }
  }

  /* ------------------------------------------------------------ sampling */

  const sampler = MW.sampler = {
    stream: null,
    node: null,
    source: null,
    sink: null,
    buffer: null,
    writing: false,
    level: 0,
    devices: [],
    appDest: null,

    async refreshDevices(withPrompt) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      if (withPrompt) {
        /* labels are hidden until the page has held a stream at least once */
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach(t => t.stop());
        } catch (e) { /* refused, carry on unlabelled */ }
      }
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        this.devices = all.filter(d => d.kind === 'audioinput');
      } catch (e) {
        this.devices = [];
      }
      return this.devices;
    },

    /* kind: 'mic' | 'system' | 'app' | a deviceId */
    async start(mode, size, kind) {
      if (this.node) this.stop();
      const ctx = MW.audio.init();
      MW.audio.unlock();
      if (!ctx) return;

      kind = kind || 'mic';
      let stream = null;

      try {
        if (kind === 'app') {
          /* capture what Octanaut itself is playing */
          this.appDest = ctx.createMediaStreamDestination();
          MW.audio.limiter.connect(this.appDest);
          stream = this.appDest.stream;
          if (!MW.player.playing) MW.toast('Recording this app: start the song to capture it');
        } else if (kind === 'system') {
          if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error('this browser cannot capture system audio');
          }
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
          const audio = stream.getAudioTracks();
          if (!audio.length) {
            stream.getTracks().forEach(t => t.stop());
            throw new Error('no audio came with the screen share — on macOS install a loopback device such as BlackHole and pick it from the list instead');
          }
          stream.getVideoTracks().forEach(t => t.stop());
        } else {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('this browser cannot open an audio input');
          }
          const constraints = {
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          };
          if (kind !== 'mic') constraints.audio.deviceId = { exact: kind };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      } catch (e) {
        if (this.appDest) { try { MW.audio.limiter.disconnect(this.appDest); } catch (x) {} this.appDest = null; }
        MW.toast(e.message || 'Could not open that source', true);
        return;
      }

      this.stream = stream;
      this.sampleRate = ctx.sampleRate;
      this.source = ctx.createMediaStreamSource(stream);
      this.node = ctx.createScriptProcessor(2048, 1, 1);
      this.buffer = mode === 'record' ? new Float32Array(Math.max(1024, size || 65536)) : null;
      this.writing = mode === 'record';
      this.pos = 0;
      this.mode = mode;

      /* a silent sink keeps the graph pulling without monitoring the input
         back through the speakers */
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.sink.connect(ctx.destination);

      this.node.onaudioprocess = ev => {
        const input = ev.inputBuffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs(input[i]));
        this.level = peak;
        if (this.writing && this.buffer) {
          const room = this.buffer.length - this.pos;
          if (room > 0) {
            this.buffer.set(input.subarray(0, Math.min(room, input.length)), this.pos);
            this.pos += Math.min(room, input.length);
          }
          if (this.pos >= this.buffer.length) this.stop();
        }
      };
      this.source.connect(this.node);
      this.node.connect(this.sink);

      await this.refreshDevices();
      MW.panels.refresh();
      MW.toast(mode === 'record' ? 'Recording' : 'Monitoring');
    },

    stop() {
      const wasWriting = this.writing && this.mode === 'record';
      this.writing = false;
      if (this.node) { try { this.node.disconnect(); } catch (e) {} }
      if (this.source) { try { this.source.disconnect(); } catch (e) {} }
      if (this.sink) { try { this.sink.disconnect(); } catch (e) {} }
      if (this.stream) { try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) {} }
      if (this.appDest) { try { MW.audio.limiter.disconnect(this.appDest); } catch (e) {} this.appDest = null; }
      this.node = this.source = this.sink = this.stream = null;

      if (wasWriting && this.buffer && this.pos > 32) {
        const data = this.buffer.slice(0, this.pos);
        const inst = MW.app.song.instruments[MW.app.currentIns - 1];
        if (inst) {
          inst.data = data;
          inst.c2rate = this.sampleRate;
          inst.dataR = null;
          inst.bits16 = true;
          inst.stereo16 = false;
          inst.loop = 0;
          inst.looplen = 0;
          inst._abuf = null;
          inst._view = { a: 0, b: data.length };
          MW.refreshAll();
          MW.toast('Recorded ' + data.length + ' samples');
        }
      }
      this.buffer = null;
      this.mode = null;
      return true;
    }
  };

  /* ------------------------------------------------------------ preferences */

  const PREF_KEY = 'octanaut.prefs.v1';
  const PREF_KEY_OLD = 'hexline.prefs.v1';   // carried over from the old name
  const prefs = MW.prefs = {
    save() {
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify({
          octave: app.octave,
          advance: app.advance,
          step: app.step,
          spaceAsDel: app.spaceAsDel,
          follow: app.follow,
          eq: app.eq,
          authentic: MW.player.authentic,
          hb: app.hb,
          prog: app.prog,
          paletteIndex: app.paletteIndex,
          depth: app.depth,
          dep2: app.dep2,
          no16: app.no16,
          ptkey: app.ptkey,
          timeSig: app.timeSig
        }));
      } catch (e) { /* private mode, ignore */ }
    },
    load() {
      try {
        const raw = localStorage.getItem(PREF_KEY) || localStorage.getItem(PREF_KEY_OLD);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (typeof p.octave === 'number') app.octave = MW.clamp(p.octave, 0, 8);
        if (p.advance) app.advance = p.advance;
        if (p.step) app.step = MW.clamp(p.step, 1, 16);
        app.spaceAsDel = !!p.spaceAsDel;
        app.follow = p.follow !== false;
        if (Array.isArray(p.eq)) app.eq = p.eq;
        MW.player.authentic = !!p.authentic;
        app.hb = !!p.hb;
        if (Array.isArray(p.prog)) app.prog = p.prog;
        this.save();
        if (typeof p.paletteIndex === 'number') app.paletteIndex = p.paletteIndex % MW.palettes.length;
        if (p.depth === 'classic' || p.depth === 'enhanced') app.depth = p.depth;
        app.dep2 = !!p.dep2;
        app.no16 = !!p.no16;
        app.ptkey = !!p.ptkey;
        if (p.timeSig) app.timeSig = p.timeSig;
      } catch (e) { /* ignore */ }
    },
    reset() {
      try { localStorage.removeItem(PREF_KEY); } catch (e) { /* ignore */ }
    }
  };

  /* ------------------------------------------------------------ demo song */

  function buildDemo() {
    const song = MW.createSong();
    song.name = 'octanaut demo';
    song.channels = 8;
    song.deftempo = 33;
    song.tempo2 = 6;
    song.annotation = 'Octanaut built-in demo. Eight tracks, synth bass and noise drums.';

    const mk = (name, fn) => {
      const inst = MW.createInstrument('sample');
      inst.name = name;
      inst.data = fn();
      inst.volume = 50;
      return inst;
    };

    const kick = mk('kick', () => {
      const n = 2400, a = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / 22050;
        const env = Math.exp(-t * 18);
        a[i] = Math.sin(2 * Math.PI * (52 + 90 * Math.exp(-t * 30)) * t) * env * 0.9;
      }
      return a;
    });
    const snare = mk('snare', () => {
      const n = 3000, a = new Float32Array(n);
      let r = 1234;
      for (let i = 0; i < n; i++) {
        const t = i / 22050;
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        const noise = (r / 0x3fffffff) - 1;
        a[i] = (noise * 0.7 + Math.sin(2 * Math.PI * 180 * t) * 0.3) * Math.exp(-t * 22) * 0.8;
      }
      return a;
    });
    const hat = mk('hat', () => {
      const n = 900, a = new Float32Array(n);
      let r = 99;
      for (let i = 0; i < n; i++) {
        const t = i / 22050;
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        a[i] = ((r / 0x3fffffff) - 1) * Math.exp(-t * 90) * 0.5;
      }
      return a;
    });
    song.instruments[0] = kick;
    song.instruments[1] = snare;
    song.instruments[2] = hat;

    const bass = MW.createInstrument('synth');
    bass.name = 'bass pulse';
    const wf = new Float32Array(16);
    for (let i = 0; i < 16; i++) wf[i] = i < 8 ? 100 : -100;
    bass.synth = {
      voltbl: [0x40, 0xf2, 0x06, 0xff],
      wftbl: [0x00, 0xff],
      volspeed: 1, wfspeed: 1,
      waveforms: [wf]
    };
    song.instruments[3] = bass;

    const lead = MW.createInstrument('synth');
    lead.name = 'bell';
    lead.synth = {
      voltbl: [0x40, 0xf2, 0x04, 0xff],
      wftbl: [0xf4, 0x08, 0xf5, 0x40, 0x00, 0xff],
      volspeed: 1, wfspeed: 1,
      waveforms: [MW.sineTable(32)]
    };
    song.instruments[4] = lead;

    const b0 = MW.createBlock(8, 64);
    song.blocks = [b0];
    song.playseq = [0];

    const set = (t, l, note, ins, cmd, dat) => {
      Object.assign(b0.rows[l][t], { note: note || 0, ins: ins || 0, cmd: cmd || 0, dat: dat || 0 });
    };

    const bassline = [13, 13, 20, 13, 15, 15, 22, 15];
    for (let l = 0; l < 64; l += 8) {
      const n = bassline[(l / 8) % bassline.length];
      set(4, l, n, 4);
      set(4, l + 4, n, 4, 0x0c, 0x30);
    }
    for (let l = 0; l < 64; l += 16) {
      set(0, l, 13, 1);
      set(0, l + 4, 0, 2);
      set(0, l + 8, 13, 1);
    }
    for (let l = 2; l < 64; l += 4) set(1, l, 13, 3, 0x0c, 0x18);
    for (let l = 0; l < 64; l += 8) {
      set(2, l + 6, 49, 5);
    }
    song.blocks = [b0, MW.createBlock(8, 64)];
    song.playseq = [0, 0, 0, 1];
    const b1 = song.blocks[1];
    for (let l = 0; l < 64; l += 16) {
      const n = bassline[(l / 16) % bassline.length] + 12;
      set(0, l, n, 5);
      set(1, l, n + 7, 5);
      set(2, l + 8, n + 12, 5);
    }
    for (let l = 0; l < 64; l += 4) set(7, l, 0, 2, 0x0c, 0x20);

    return song;
  }

  /* ------------------------------------------------------------ panel actions */

  function onPanelClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const a = lastActionFor(btn.dataset.act);
    if (a) a(btn.dataset.name, e);
  }

  /* Shift-clicking HEX/DEC rewrites every volume command so the song keeps
     the volumes it had. */
  function setVolumeBase(hex, rewrite) {
    app.song.flags.volhex = hex;
    if (rewrite) {
      const n = MW.rewriteVolumeCommands(app.song, !!hex);
      MW.toast(`${hex ? 'HEX' : 'DEC'}: rewrote ${n} volume command${n === 1 ? '' : 's'}`);
    }
    MW.panels.refresh();
  }

  function lastActionFor(act) {
    const map = {
      'edit-toggle': () => { app.editMode = !app.editMode; MW.touchStatus('edit', ['editMode']); },
      'edit-space': () => { app.spaceAsDel = !app.spaceAsDel; MW.touchStatus('space', ['spaceAsDel']); },
      'edit-chord': () => { app.chordMode = !app.chordMode; MW.panels.refresh(); MW.touchStatus('chord', ['chordMode']); },
      'chord-toggle': () => { app.chordMode = !app.chordMode; MW.panels.refresh(); MW.touchStatus('chord', ['chordMode']); },
      'file-open': () => MW.requester.open(),
      'file-info': () => { app.saveInfo = !app.saveInfo; MW.panels.refresh(); },
      'fmt-mmd1': () => { app.saveFormat = 'mmd1'; MW.panels.refresh(); },
      'fmt-mmd1n': () => { app.saveFormat = 'mmd1n'; MW.panels.refresh(); },
      'fmt-mmd0': () => { app.saveFormat = 'mmd0'; MW.panels.refresh(); },
      'fmt-st': () => { app.saveFormat = 'st'; MW.panels.refresh(); },
      'file-save-song': () => saveModule(),
      'file-del': () => deleteFile(),
      'file-icon': () => MW.missing('Amiga icon files'),
      'file-load-msg': () => loadMidiJson('msg'),
      'file-save-msg': () => saveMidiJson('msg'),
      'file-load-map': () => loadMidiJson('map'),
      'file-save-map': () => saveMidiJson('map'),
      'missing': name => MW.missing(name || 'That control'),
      'file-save': () => saveModule(1),
      'file-save-mmd0': () => saveModule(0),
      'audio-wav': () => MW.exportAudio('wav'),
      'audio-aac': () => MW.exportAudio('aac'),
      'audio-mp3': () => MW.exportAudio('mp3'),
      'file-save-mod': saveST,
      'file-new': () => replaceModule(MW.createSong()),
      'file-demo': () => loadExample(false),
      'ins-open': () => document.getElementById('ins-file-input').click(),
      'ins-new': () => {
        const inst = MW.createInstrument('synth');
        inst.synth = MW.createSynth();
        inst.name = 'synth';
        app.song.instruments[app.currentIns - 1] = inst;
        refreshAll();
      },
      'ins-kill': () => { app.song.instruments[app.currentIns - 1] = null; refreshAll(); },
      'ins-first': () => setInstrument(1),
      'ins-last': () => setInstrument(63),
      'ins-prev': () => setInstrument(app.currentIns - 1),
      'ins-next': () => setInstrument(app.currentIns + 1),
      'seq-inc': () => { const s = app.song; s.playseq[app.cursor.seq] = Math.min(s.blocks.length - 1, (s.playseq[app.cursor.seq] || 0) + 1); refreshAll(); },
      'seq-dec': () => { const s = app.song; s.playseq[app.cursor.seq] = Math.max(0, (s.playseq[app.cursor.seq] || 0) - 1); refreshAll(); },
      'seq-ins': () => { app.song.playseq.splice(app.cursor.seq, 0, 0); refreshAll(); },
      'seq-del': () => { if (app.song.playseq.length > 1) app.song.playseq.splice(app.cursor.seq, 1); refreshAll(); },
      'seq-ins-block': () => { app.song.playseq.splice(app.cursor.seq, 0, app.cursor.block); refreshAll(); },
      'seq-add': () => { app.song.playseq.push(0); app.cursor.seq = app.song.playseq.length - 1; refreshAll(); },
      'seq-sub': () => { if (app.song.playseq.length > 1) { app.song.playseq.pop(); app.cursor.seq = Math.min(app.cursor.seq, app.song.playseq.length - 1); } refreshAll(); },
      'eq-1': () => { app.eq[0] = !app.eq[0]; MW.panels.refresh(); },
      'eq-2': () => { app.eq[1] = !app.eq[1]; MW.panels.refresh(); MW.grid.render(); },
      'eq-3': () => { app.eq[2] = !app.eq[2]; MW.panels.refresh(); },
      'auth-toggle': () => { MW.player.authentic = !MW.player.authentic; MW.panels.refresh(); },
      'depth-classic': () => { app.depth = 'classic'; MW.player.invalidateBuffers(); refreshAll(); MW.toast('8 bit mono, as an Amiga would play it'); },
      'depth-enhanced': () => { app.depth = 'enhanced'; MW.player.invalidateBuffers(); refreshAll(); MW.toast('Native depth and stereo'); },
      'stslide': () => { app.song.flags.stslide = app.song.flags.stslide ? 0 : 1; MW.panels.refresh(); },
      'trk-cut': () => ops.cutTrack(), 'trk-copy': () => ops.copyTrack(),
      'trk-paste': () => ops.pasteTrack(), 'trk-swap': () => ops.swapTrack(),
      'blk-cut': () => ops.cutBlock(), 'blk-copy': () => ops.copyBlock(),
      'blk-paste': () => ops.pasteBlock(), 'blk-swap': () => ops.swapBlock(),
      'line-ins': () => ops.insertLine(), 'line-del': () => ops.deleteLine(),
      'track-ins': () => ops.insertTrack(), 'track-del': () => ops.deleteTrack(),
      'blk-expand': () => ops.expand(parseInt((document.getElementById('blk-factor') || {}).value, 10) || 2),
      'blk-shrink': () => ops.shrink(parseInt((document.getElementById('blk-factor') || {}).value, 10) || 2),
      'blk-new': () => ops.newBlock(false), 'blk-new-here': () => ops.newBlock(true),
      'blk-new-def': () => ops.newBlock(false, true), 'blk-new-here-def': () => ops.newBlock(true, true),
      'del-buffer': () => { clipboard.tracks = []; clipboard.lines = 0; clipboard.kind = null; MW.toast('Copy buffer freed'); },
      'blk-del': () => ops.deleteBlock(), 'blk-split': () => ops.splitBlock(), 'blk-join': () => ops.joinBlock(),
      'blk-del-last': () => ops.deleteLastBlock(),
      'hl-1': () => ops.highlightEvery(1), 'hl-2': () => ops.highlightEvery(2),
      'hl-3': () => ops.highlightEvery(3), 'hl-4': () => ops.highlightEvery(4),
      'hl-8': () => ops.highlightEvery(8), 'hl-16': () => ops.highlightEvery(16),
      'hl-clear': () => ops.clearHighlight(),
      'sel-all': () => { app.selection = { l0: 0, l1: block().lines - 1, t0: 0, t1: block().tracks - 1 }; MW.grid.render(); MW.touchStatus('selection', ['selection']); },
      'sel-cancel': () => { app.selection = null; MW.grid.render(); MW.touchStatus('selection', ['selection']); },
      'rng-clear': () => ops.clearRange(),
      'rng-cut': () => ops.copyRange(true),
      'rng-copy': () => ops.copyRange(false),
      'rng-paste': () => ops.pasteRange(false),
      'rng-paste-selected': () => ops.pasteRange(true),
      'spread-2': () => ops.spread(2), 'spread-3': () => ops.spread(3), 'spread-4': () => ops.spread(4),
      'mk-slide1': () => ops.makeSlide('s1'), 'mk-slide2': () => ops.makeSlide('s2'),
      'mk-volslide': () => ops.makeVolumeSlide(),
      'tr-up': () => ops.transpose(1), 'tr-down': () => ops.transpose(-1),
      'tr-up12': () => ops.transpose(12), 'tr-down12': () => ops.transpose(-12),
      'note-change': () => ops.noteChange(false), 'note-exchange': () => ops.noteChange(true),
      'ins-change': () => ops.instrumentChange(false), 'ins-exchange': () => ops.instrumentChange(true),
      'ins-delete': () => ops.instrumentDelete(),
      'misc-follow': () => { app.follow = !app.follow; MW.panels.refresh(); },
      'misc-filter': () => { app.song.flags.filteron = app.song.flags.filteron ? 0 : 1; MW.audio.setFilter(app.song.flags.filteron); MW.panels.refresh(); },
      'vol-hex': (name, e) => setVolumeBase(1, e && e.shiftKey),
      'vol-dec': (name, e) => setVolumeBase(0, e && e.shiftKey),
      'name-sharp': () => { app.hb = false; prefs.save(); MW.panels.refresh(); },
      'name-flat': () => { app.hb = true; prefs.save(); MW.panels.refresh(); },
      'prefs-reset': () => { prefs.reset(); MW.toast('Saved preferences cleared'); },
      'audio-test': () => MW.audio.testTone(),
      'audio-unlock': () => { MW.audio.unlock(); MW.toast('Audio: ' + MW.audio.describe()); },
      'pal-cycle': () => { app.paletteIndex = (app.paletteIndex + 1) % MW.palettes.length; MW.grid.render(); MW.panels.refresh(); },
      'pal-set': () => {
        const { r, g, b } = app.paletteRGB;
        app.paletteUndo = MW.palettes[4].tracks.slice();
        const hex = '#' + [r, g, b].map(v => MW.clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
        MW.palettes[4].tracks = new Array(16).fill(hex);
        app.paletteIndex = 4;
        MW.grid.render();
        MW.panels.refresh();
      },
      'pal-reset': () => { app.paletteRGB = { r: 136, g: 136, b: 136 }; app.paletteIndex = 4; MW.palettes[4].tracks = new Array(16).fill('#888888'); MW.grid.render(); MW.panels.refresh(); },
      'pal-undo': () => { if (app.paletteUndo) { MW.palettes[4].tracks = app.paletteUndo; app.paletteIndex = 4; MW.grid.render(); MW.panels.refresh(); } else MW.toast('Nothing to undo', true); },
      'paths-info': () => MW.toast(app.paths.length + ' path(s) added'),
      'paths-add': async () => {
        if (!window.showDirectoryPicker) return MW.toast('This browser cannot list folders', true);
        try {
          const handle = await window.showDirectoryPicker({ mode: 'read' });
          app.paths.push(handle);
          MW.toast('Path added: ' + handle.name);
        } catch (err) { if (!err || err.name !== 'AbortError') MW.toast('Path refused', true); }
      },
      'paths-rem': () => { app.paths = []; MW.toast('Paths cleared'); },
      'quit-app': () => { window.close(); setTimeout(() => MW.toast('Close the tab to quit', true), 100); },
      'confirm-toggle': () => { app.confirmOn = !app.confirmOn; MW.panels.refresh(); },
      'dep2': () => { app.dep2 = !app.dep2; document.body.classList.toggle('dep2', app.dep2); MW.panels.refresh(); },
      'no16': () => { app.no16 = !app.no16; MW.grid.render(); MW.panels.refresh(); },
      'ptkey': () => { app.ptkey = !app.ptkey; MW.panels.refresh(); },
      'pad-mode': () => { app.padMode = app.padMode === 'track' ? 'instr' : 'track'; MW.panels.refresh(); },
      'pad-map2': () => { app.padMap2 = !app.padMap2; MW.panels.refresh(); },
      'alt-pick-l': () => { const c = curCell(); if (c) { app.altL = { note: null, ins: c.ins, cmd: c.cmd, dat: c.dat }; MW.toast('Left Alt template set'); MW.panels.refresh(); } },
      'alt-pick-r': () => { const c = curCell(); if (c) { app.altR = { note: null, ins: c.ins, cmd: c.cmd, dat: c.dat }; MW.toast('Right Alt template set'); MW.panels.refresh(); } },
      'alt-clear': () => { app.altL = { note: null, ins: null, cmd: null, dat: null }; app.altR = { note: null, ins: null, cmd: null, dat: null }; MW.panels.refresh(); },
      'pick-range': () => pickProgRange(),
      'pick-buffer': () => pickProgBuffer(),
      'play-on-note': () => { app.playOnNote = !app.playOnNote; MW.panels.refresh(); },
      'ins-lastused': () => setInstrument(app.lastIns),
      'ins-lastoccupied': () => {
        const list = app.song.instruments;
        for (let i = list.length - 1; i >= 0; i--) if (list[i]) {
          app.lastOccupiedIns = i + 1;
          return setInstrument(i + 1);
        }
        setInstrument(1);
      },
      'ins-jump': () => { const i = app.song.instruments[app.currentIns - 1]; if (i) { i.jump = !i.jump; MW.panels.refresh(); } },
      'pick-note': () => pickProgKey(app.progTarget),
      'prog-prev': () => { app.progAlt = 'C'; app.progTarget = (app.progTarget + 9) % 10; MW.panels.refresh(); },
      'prog-next': () => { app.progAlt = 'C'; app.progTarget = (app.progTarget + 1) % 10; MW.panels.refresh(); },
      'midi-extsync': () => { app.extSync = !app.extSync; if (!app.extSync) MW.player.extPulse = null; MW.panels.refresh(); },
      'midi-map-active': () => {
        if (!app.midiMap) app.midiMap = Array.from({ length: 128 }, () => ({ kind: 'note' }));
        app.midiMapActive = !app.midiMapActive;
        MW.panels.refresh();
      },
      'midi-map-new': () => {
        app.midiMap = Array.from({ length: 128 }, () => ({ kind: 'note' }));
        app.midiMapActive = true;
        MW.toast('MIDI input map created');
        MW.panels.refresh();
      },
      'midi-map-del': () => { app.midiMap = null; app.midiMapActive = false; MW.toast('MIDI input map deleted'); MW.panels.refresh(); },
      'midi-map-reset': () => {
        if (!app.midiMap) app.midiMap = Array.from({ length: 128 }, () => ({ kind: 'note' }));
        app.midiMap[app.midiMapIndex] = { kind: 'note' };
        MW.panels.refresh();
      },
      'midi-map-next': () => {
        if (!app.midiMap) app.midiMap = Array.from({ length: 128 }, () => ({ kind: 'note' }));
        const fns = MIDI_MAP_FUNCTIONS;
        const cur = app.midiMap[app.midiMapIndex];
        if (!cur || cur.kind !== 'fn') {
          app.midiMap[app.midiMapIndex] = { kind: 'fn', fn: fns[0] };
          MW.panels.refresh();
          return;
        }
        const i = fns.indexOf(cur.fn);
        const next = (i + 1) % fns.length;
        app.midiMap[app.midiMapIndex] = { kind: 'fn', fn: fns[next] };
        MW.panels.refresh();
      },
      'midi-keyup': () => { app.midiKeyUp = !app.midiKeyUp; MW.panels.refresh(); },
      'midi-dump-save': () => saveMidiJson('dump'),
      'midi-dump-load': () => loadMidiJson('dump'),
      'midi-map-up': () => { app.midiMapIndex = Math.max(0, app.midiMapIndex - 1); MW.panels.refresh(); },
      'midi-map-down': () => { app.midiMapIndex = Math.min(127, app.midiMapIndex + 1); MW.panels.refresh(); },
      'midi-map-prev': () => {
        if (!app.midiMap) app.midiMap = Array.from({ length: 128 }, () => ({ kind: 'note' }));
        const fns = MIDI_MAP_FUNCTIONS;
        const cur = app.midiMap[app.midiMapIndex];
        if (!cur || cur.kind !== 'fn') {
          app.midiMap[app.midiMapIndex] = { kind: 'fn', fn: fns[fns.length - 1] };
          MW.panels.refresh();
          return;
        }
        const i = fns.indexOf(cur.fn);
        const next = (i - 1 + fns.length) % fns.length;
        app.midiMap[app.midiMapIndex] = { kind: 'fn', fn: fns[next] };
        MW.panels.refresh();
      },
      'chord-rst': () => { chordNotes = []; app.chordStartTrack = app.cursor.track; MW.toast('Chord reset'); },
      'note-echo': () => ops.noteEcho(
        parseInt((document.getElementById('echo-dist') || {}).value, 10) || 2,
        parseInt((document.getElementById('echo-min') || {}).value, 10) || 1
      ),
      'prefs-save': () => { prefs.save(); MW.toast('Preferences saved'); },
      'midi-input': () => { app.midiInput = !app.midiInput; MW.panels.refresh(); },
      'midi-sendout': () => { app.midiSendOut = !app.midiSendOut; MW.panels.refresh(); },
      'midi-suppress': () => { const i = app.song.instruments[app.currentIns - 1]; if (i) i.suppressOff = !i.suppressOff; MW.panels.refresh(); },
      'midi-reset-pb': () => { for (let c = 0; c < 16; c++) { midi.send([0xe0 | c, 0, 64]); midi.send([0xb0 | c, 1, 0]); } MW.toast('Pitch bend and modulation reset'); },
      'midi-reset-ff': () => { midi.send([0xff]); MW.toast('MIDI system reset sent'); },
      'midi-sensing': () => { midi.sensingOn = midi.sensingOn === false; MW.panels.refresh(); },
      'midi-msg-prev': () => { app.midiMsgIndex = Math.max(0, app.midiMsgIndex - 1); MW.panels.refresh(); },
      'midi-msg-next': () => { app.midiMsgIndex = Math.min(app.midiMessages.length - 1, app.midiMsgIndex + 1); MW.panels.refresh(); },
      'midi-msg-new': () => { app.midiMessages.push({ name: '', data: [] }); app.midiMsgIndex = app.midiMessages.length - 1; MW.panels.refresh(); },
      'midi-msg-insert': () => { app.midiMessages.splice(app.midiMsgIndex, 0, { name: '', data: [] }); MW.panels.refresh(); },
      'midi-msg-del': () => { if (app.midiMessages.length > 1) app.midiMessages.splice(app.midiMsgIndex, 1); app.midiMsgIndex = Math.min(app.midiMsgIndex, app.midiMessages.length - 1); MW.panels.refresh(); },
      'midi-msg-clear': () => { const m = app.midiMessages[app.midiMsgIndex]; if (m) m.data = []; MW.panels.refresh(); },
      'midi-msg-inc': () => { const m = app.midiMessages[app.midiMsgIndex]; if (m) m.data.push(0); MW.panels.refresh(); },
      'midi-msg-dec': () => { const m = app.midiMessages[app.midiMsgIndex]; if (m && m.data.length) m.data.pop(); MW.panels.refresh(); },
      'midi-msg-send': () => { const m = app.midiMessages[app.midiMsgIndex]; if (m && m.data.length) midi.send(m.data); },
      'midi-msg-capture': () => {
        app.midiCapture = !app.midiCapture;
        if (app.midiCapture) {
          const m = app.midiMessages[app.midiMsgIndex] || { name: '', data: [] };
          m.data = [];
          app.midiMessages[app.midiMsgIndex] = m;
          MW.toast('Waiting for SysEx');
        }
        MW.panels.refresh();
      },
      'midi-msg-auto': () => { app.midiMsgAuto = !app.midiMsgAuto; MW.panels.refresh(); },
      'midi-alloff-cc': () => { app.midiAllOff = 'cc'; MW.panels.refresh(); },
      'midi-alloff-note': () => { app.midiAllOff = 'note'; MW.panels.refresh(); },
      'file-save-iff': () => MW.saveIFF(),
      'samp-record': () => {
        const len = parseInt((document.getElementById('buffsize') || {}).value, 10) || 65536;
        sampler.start('record', MW.clamp(len, 1024, 131072), sourceValue());
      },
      'samp-monitor': () => sampler.start('monitor', 0, sourceValue()),
      'samp-stop': () => sampler.stop(),
      'samp-devices': async () => {
        await sampler.refreshDevices(true);
        MW.panels.refresh();
        MW.toast(sampler.devices.length + ' input(s) found');
        if (MW.displays.current === 'sample') MW.displays.show('sample');
      },
      'misc-clear': () => {
        app.song.blocks = [MW.createBlock(app.song.channels, 64)];
        app.song.playseq = [0];
        app.cursor = { block: 0, line: 0, track: 0, field: 0, seq: 0 };
        refreshAll();
      },
      'misc-clear-all': () => replaceModule(MW.createSong()),
      'midi-enable': () => MW.enableMidi(),
      'midi-panic': () => MW.midiPanic(),
      'midi-vel': () => { app.readVelocity = !app.readVelocity; MW.panels.refresh(); },
      'midi-lc-on': () => { for (let c = 0; c < 16; c++) midi.send([0xb0 | c, 122, 127]); MW.toast('Local control on'); },
      'midi-lc-off': () => { for (let c = 0; c < 16; c++) midi.send([0xb0 | c, 122, 0]); MW.toast('Local control off'); },
      'midi-sync': () => {
        MW.player.sync = !MW.player.sync;
        MW.player.syncAcc = 0;
        MW.panels.refresh();
        MW.toast('MIDI clock ' + (MW.player.sync ? 'on' : 'off'));
      },
      'ins-wav': () => MW.exportWav()
    };
    if (map[act]) return map[act];

    if (act.startsWith('scope-')) return () => { app.transposeScope = act.slice(6); MW.panels.refresh(); };
    if (act.startsWith('oct-')) return () => { app.octave = parseInt(act.slice(4), 10); MW.touchStatus('octave', ['octave']); };
    if (act.startsWith('adv-')) return () => { app.advance = act.slice(4); MW.touchStatus('advance', ['advance']); };
    if (act.startsWith('blk-tracks-')) return () => ops.setTracks(parseInt(act.slice(11), 10));
    if (act.startsWith('instscope-')) return () => { app.transposeInstrScope = act.slice(10); MW.panels.refresh(); };
    if (act.startsWith('chmode-')) return () => {
      const n = parseInt(act.slice(7), 10);
      app.song.channels = n;
      MW.player.setSong(app.song);
      refreshAll();
    };
    return null;
  }

  function sourceValue() {
    const el = document.getElementById('samp-src');
    return el ? el.value : 'mic';
  }

  MW.runAction = function (act) {
    const a = lastActionFor(act);
    if (a) a();
  };

  /* ------------------------------------------------------------ requester
   *
   * OctaMED drew its own file requester. A browser cannot enumerate a disk,
   * so this draws the same furniture and fills it from the File System Access
   * API where that exists, or from whatever the native picker returns.
   */

  const requester = MW.requester = {
    el: null,
    entries: [],
    dir: null,
    selected: null,
    note: '',

    open() {
      this.entries = [];
      this.dir = null;
      this.title = '';
      this.selected = null;
      this.note = '';
      this.build();
      this.render();
      if (window.showDirectoryPicker) {
        this.pickDir();
      } else {
        this.note = 'This browser does not let a page list folders. Use Browse to pick files.';
        this.render();
      }
    },

    /* entries lifted out of an archive */
    openEntries(list, title) {
      this.entries = list;
      this.dir = null;
      this.title = title || '';
      this.selected = 0;
      this.build(title || 'Choose a module');
      this.note = list.length + ' module' + (list.length === 1 ? '' : 's') + ' in the archive';
      this.render();
    },

    build(title) {
      if (this.el) this.el.remove();
      const el = document.createElement('div');
      el.className = 'requester';
      el.innerHTML = `
        <div class="req-frame">
          <div class="req-title">${escapeHtml(title || 'Load a module')}</div>
          <div class="req-path" id="req-path">no folder chosen</div>
          <div class="req-list" id="req-list"></div>
          <div class="req-note" id="req-note"></div>
          <div class="req-buttons">
            <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" id="req-up">Parent</button>
            <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" id="req-browse">Browse…</button>
            <span class="spacer"></span>
            <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" id="req-cancel">Cancel</button>
            <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" id="req-ok">Load</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      this.el = el;

      el.querySelector('#req-cancel').onclick = () => this.close();
      el.querySelector('#req-ok').onclick = () => this.choose();
      el.querySelector('#req-browse').onclick = () => this.browse();
      el.querySelector('#req-up').onclick = () => this.up();
      el.addEventListener('mousedown', e => { if (e.target === el) this.close(); });
      document.addEventListener('keydown', this.esc = e => {
        if (e.key === 'Escape' && this.el) { e.stopPropagation(); this.close(); }
      }, true);
    },

    close() {
      if (this.el) this.el.remove();
      this.el = null;
      if (this.esc) document.removeEventListener('keydown', this.esc, true);
    },

    render() {
      if (!this.el) return;
      const path = this.el.querySelector('#req-path');
      const list = this.el.querySelector('#req-list');
      const note = this.el.querySelector('#req-note');

      path.textContent = this.dir
        ? this.dir.name
        : (this.title || (this.entries.length ? 'selected files' : 'no folder chosen'));
      note.textContent = this.note;

      if (!this.entries.length) {
        list.innerHTML = '<div class="req-empty">Nothing here yet.</div>';
        return;
      }
      list.innerHTML = this.entries.map((e, i) => {
        const cls = [
          'req-row',
          e.dir ? 'dir' : 'file',
          this.selected === i ? 'sel' : ''
        ].join(' ');
        return `<div class="${cls}" data-i="${i}">${escapeHtml(e.name)}</div>`;
      }).join('');

      list.querySelectorAll('.req-row').forEach(row => {
        const i = parseInt(row.dataset.i, 10);
        row.onclick = () => {
          const e = this.entries[i];
          if (e.dir) { this.enter(e); return; }
          this.selected = i;
          this.render();
        };
        row.ondblclick = () => {
          const e = this.entries[i];
          if (!e.dir) { this.selected = i; this.choose(); }
        };
      });
    },

    async pickDir() {
      try {
        this.dir = await window.showDirectoryPicker({ mode: 'readwrite' });
        await this.listDir();
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        this.note = 'Folder access refused: ' + e.message;
        this.render();
      }
    },

    async listDir() {
      if (!this.dir) return;
      const out = [];
      try {
        for await (const [name, handle] of this.dir.entries()) {
          if (name.startsWith('.')) continue;
          out.push({ name, handle, dir: handle.kind === 'directory' });
        }
      } catch (e) {
        this.note = 'Could not list this folder: ' + e.message;
      }
      out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
      this.entries = out;
      this.selected = null;
      this.note = `${out.length} entries`;
      this.render();
      if (this._onChange) this._onChange();
    },

    async enter(entry) {
      this.dir = entry.handle;
      await this.listDir();
    },

    async up() {
      if (!this.dir || !this.dir.parent) return;
      try {
        const parent = await this.dir.parent();
        if (!parent) return;
        this.dir = parent;
        await this.listDir();
      } catch (e) { /* sandboxed root */ }
    },

    browse() {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.mmd0,.mmd1,.mmd2,.mmd3,.mmdc,.med,.mod,.mmd,.msh,.8svx';
      input.onchange = () => {
        this.entries = Array.from(input.files).map(f => ({ name: f.name, file: f, dir: false }));
        this.selected = this.entries.length ? 0 : null;
        this.note = this.entries.length + ' file(s) ready';
        this.render();
        if (this._onChange) this._onChange();
      };
      input.click();
    },

    async choose() {
      if (this.selected == null) return MW.toast('Pick a file first', true);
      const e = this.entries[this.selected];
      if (!e) return;
      try {
        if (e.dir) { this.enter(e); return; }
        let buffer, name = e.name;
        if (e.data) {
          buffer = e.data.slice().buffer;
        } else {
          const file = e.file || (e.handle ? await e.handle.getFile() : null);
          if (!file) return;
          buffer = await file.arrayBuffer();
          name = file.name;
        }
        this.close();
        handleFileBuffer(buffer, name.split('/').pop());
      } catch (err) {
        this.note = 'Could not read that file: ' + err.message;
        this.render();
      }
    }
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------ midi */

  const MIDI_MAP_FUNCTIONS = [
    'Play song', 'Play blk', 'Cont song', 'Cont blk', 'Stop play',
    'Curs up', 'Curs down', 'Curs left', 'Curs right',
    'Prev trk', 'Next trk', 'Prev blk', 'Next blk',
    'Edit', 'Spc', 'DEL', '-|-', 'Prev inst', 'Next inst', 'Chord', '1st', 'Last'
  ];

  function runMidiMapFunction(name) {
    const a = MW.app;
    const b = a.song.blocks[a.cursor.block];
    switch (name) {
      case 'Play song': MW.player.play(true); break;
      case 'Play blk': MW.player.playBlock(a.cursor.block); break;
      case 'Cont song': MW.player.play(false); break;
      case 'Cont blk': MW.player.playBlock(a.cursor.block); break;
      case 'Stop play': MW.player.stop(); break;
      case 'Curs up': a.cursor.line = Math.max(0, a.cursor.line - 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Curs down': a.cursor.line = Math.min(b.lines - 1, a.cursor.line + 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Curs left': a.cursor.track = Math.max(0, a.cursor.track - 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Curs right': a.cursor.track = Math.min(b.tracks - 1, a.cursor.track + 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Prev trk': a.cursor.track = Math.max(0, a.cursor.track - 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Next trk': a.cursor.track = Math.min(b.tracks - 1, a.cursor.track + 1); MW.grid.refreshLine(a.cursor.line); break;
      case 'Prev blk': a.cursor.block = Math.max(0, a.cursor.block - 1); MW.grid.render(); break;
      case 'Next blk': a.cursor.block = Math.min(a.song.blocks.length - 1, a.cursor.block + 1); MW.grid.render(); break;
      case 'Edit': a.editMode = !a.editMode; MW.touchStatus('edit', ['editMode']); break;
      case 'Spc': a.spaceAsDel = !a.spaceAsDel; MW.touchStatus('space', ['spaceAsDel']); break;
      case 'Chord': a.chordMode = !a.chordMode; MW.touchStatus('chord', ['chordMode']); break;
      case 'DEL': { const c = b.rows[a.cursor.line] && b.rows[a.cursor.line][a.cursor.track]; if (c) MW.clearCell(c); MW.grid.render(); break; }
      case '-|-': { const c = b.rows[a.cursor.line] && b.rows[a.cursor.line][a.cursor.track]; if (c) { c.note = 0; c.ins = a.currentIns; } MW.grid.render(); break; }
      case 'Prev inst': MW.setInstrument(a.currentIns - 1); break;
      case 'Next inst': MW.setInstrument(a.currentIns + 1); break;
      case '1st': a.cursor.line = 0; MW.grid.render(); break;
      case 'Last': a.cursor.line = b.lines - 1; MW.grid.render(); break;
      default: break;
    }
    MW.panels.refresh();
  }

  const midi = MW.midi = {
    supported: !!(navigator.requestMIDIAccess),
    enabled: false,
    outputs: [],
    access: null,
    port: null,

    async enable() {
      if (!this.supported) return MW.toast('Web MIDI is not available in this browser', true);
      try {
        let access;
        try {
          access = await navigator.requestMIDIAccess({ sysex: true });
          this.sysex = true;
        } catch (sysexErr) {
          access = await navigator.requestMIDIAccess();
          this.sysex = false;
        }
        this.access = access;
        this.outputs = Array.from(access.outputs.values());
        this.inputs = Array.from(access.inputs.values());
        this.port = this.outputs[0] || null;
        this.enabled = true;
        this.inputs.forEach(input => { input.onmidimessage = e => this.onMessage(e); });
        if (this.sensing) clearInterval(this.sensing);
        this.sensing = setInterval(() => {
          if (!this.enabled || this.sensingOn === false) return;
          for (let c = 0; c < 16; c++) this.send([0xfe]);
        }, 280);
        access.onstatechange = () => {
          this.outputs = Array.from(access.outputs.values());
          this.inputs = Array.from(access.inputs.values());
          this.inputs.forEach(i => { i.onmidimessage = e => this.onMessage(e); });
          MW.panels.refresh();
        };
        const bits = [];
        if (this.outputs.length) bits.push(this.outputs.length + ' out');
        if (this.inputs.length) bits.push(this.inputs.length + ' in');
        MW.toast(bits.length ? 'MIDI: ' + bits.join(', ') : 'MIDI: no ports found');
        MW.panels.refresh();
      } catch (err) {
        MW.toast('MIDI permission refused', true);
      }
    },

    onMessage(e) {
      const d = e.data;
      if (!d || !d.length) return;
      const app = MW.app;
      if (d[0] === 0xf0) {
        if (app.midiCapture) {
          const m = app.midiMessages[app.midiMsgIndex];
          if (m) {
            m.data = Array.from(d);
            if (app.midiMsgAuto && m.data[m.data.length - 1] === 0xf7) app.midiCapture = false;
            MW.panels.refresh();
          }
        }
        return;
      }
      if (d.length < 3) return;
      if (!app.midiInput) return;
      const incoming = d[0] & 0x0f;
      if (app.midiInChannel && incoming !== app.midiInChannel - 1) return;
      if (app.midiSendOut) this.send(Array.from(d));
      const type = d[0] & 0xf0;
      const note = d[1];
      const vel = d[2];

      if (type === 0x90 && vel > 0) {
        if (app.midiMapActive && app.midiMap) {
          const entry = app.midiMap[note];
          if (entry && entry.kind === 'fn') { runMidiMapFunction(entry.fn); return; }
          if (entry && entry.kind === 'note') { MW.midiNoteIn(MW.clamp(note - 23, 1, 120), vel); return; }
        }
        const med = MW.clamp(note - 23, 1, 120);
        MW.midiNoteIn(med, vel);
      } else if (type === 0x80 || (type === 0x90 && vel === 0)) {
        if (app.midiSendOut) this.send([0x80 | incoming, note, 0]);
      }
    },

    send(bytes) {
      if (!this.enabled || !this.port) return;
      try { this.port.send(bytes); } catch (e) { /* ignore */ }
    }
  };

  MW.enableMidi = () => midi.enable();

  /* a note arriving from a MIDI keyboard: enter it when editing, otherwise
     play it on the current instrument, as OctaMED does */
  MW.midiNoteIn = function (note, velocity) {
    const app = MW.app;
    if (!app || !app.song) return;
    if (app.editMode && MW.displays.current === 'grid') {
      const b = app.song.blocks[app.cursor.block];
      const row = b && b.rows[app.cursor.line];
      const cell = row && row[app.cursor.track];
      if (cell) {
        cell.note = note;
        cell.ins = app.currentIns;
        if (velocity && app.readVelocity) cell.dat = Math.round((velocity / 127) * 64);
        MW.voicePreview(note, app.currentIns);
        if (typeof MW.advanceCursorPublic === 'function') MW.advanceCursorPublic();
        else {
          app.cursor.line = Math.min(b.lines - 1, app.cursor.line + app.step);
          MW.grid.render();
        }
        MW.touchStatus('cursor', ['cursor']);
        return;
      }
    }
    MW.voicePreview(note, app.currentIns);
  };
  MW.midiPanic = () => {
    if (MW.app && MW.app.midiAllOff === 'note') {
      for (let c = 0; c < 16; c++) {
        for (let n = 0; n < 128; n++) midi.send([0x80 | c, n, 0]);
      }
    } else {
      for (let c = 0; c < 16; c++) midi.send([0xb0 | c, 123, 0]);
    }
  };

  let lastMidiNote = new Array(16).fill(-1);
  const midiChannelOf = inst => (inst && inst.midiChannel ? inst.midiChannel : 0);

  function midiTrigger(inst, note, chIdx) {
    const c = midiChannelOf(inst);
    if (!c) return;
    if (lastMidiNote[chIdx] >= 0 && !inst.suppressOff) {
      midi.send([0x80 | (c - 1), lastMidiNote[chIdx], 0]);
    }
    const n = MW.clamp(note + 11, 0, 127);
    if (inst.midiPreset) midi.send([0xc0 | (c - 1), MW.clamp(inst.midiPreset - 1, 0, 127)]);
    midi.send([0x90 | (c - 1), n, 100]);
    lastMidiNote[chIdx] = n;
  }

  /* ------------------------------------------------------------ IFF 8SVX */

  MW.saveIFF = function () {
    const inst = app.song.instruments[app.currentIns - 1];
    if (!inst || !inst.data) return MW.toast('No sample loaded', true);
    let buf;
    try { buf = MW.write8SVX(inst); }
    catch (err) { return MW.toast('Save failed: ' + err.message, true); }

    const blob = new Blob([buf], { type: 'audio/x-8svx' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (inst.name || 'sample') + '.8svx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    MW.toast('Saved IFF 8SVX');
  };

  /* ------------------------------------------------------------ wav export */

  MW.exportWav = function () {
    const inst = app.song.instruments[app.currentIns - 1];
    if (!inst || !inst.data) return MW.toast('No sample loaded', true);
    const rate = 22050;
    const src = inst.data;
    const srcRate = inst.c2rate || 8363;
    const n = Math.floor(src.length * rate / srcRate);
    const out = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * srcRate / rate;
      const a = Math.floor(p), f = p - a;
      const v = (src[a] || 0) * (1 - f) + (src[a + 1] || 0) * f;
      out[i] = MW.clamp(Math.round(v * 32767), -32768, 32767);
    }
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(out);
    const blob = new Blob([buf], { type: 'audio/wav' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = (inst.name || 'sample') + '.wav';
    aEl.click();
    setTimeout(() => URL.revokeObjectURL(aEl.href), 2000);
  };

  // Follow playback without mounting or updating the hidden tracker grid.
  MW.followPlaybackRow = function (row) {
    if (!app.follow) return;
    const blockChanged = row.block !== app.cursor.block;
    app.cursor.block = row.block;
    app.cursor.line = row.line;
    app.cursor.seq = row.seq;
    if (MW.displays.current === 'notation') MW.displays.refreshNotation();
    else if (MW.displays.current === 'grid') {
      if (blockChanged) MW.grid.render();
      else MW.grid.refreshLine(row.line);
    }
    if (blockChanged) MW.renderSeqBox();
  };

  /* ------------------------------------------------------------ boot */

  /* ------------------------------------------------------------ sequence box */

  MW.renderSeqBox = function () {
    const host = document.getElementById('seqbox');
    const arrowsHost = document.getElementById('seqarrows');
    if (!host) return;
    const s = app.song;
    const total = s.playseq.length;
    const cur = MW.clamp(app.cursor.seq, 0, total - 1);
    const start = MW.clamp(cur - 2, 0, Math.max(0, total - 5));

    let rows = '';
    let arrows = '';
    for (let i = 0; i < 5; i++) {
      const idx = start + i;
      const up = i < 2;
      if (idx >= total) { rows += '<div class="flex min-w-0 items-center justify-center gap-1 overflow-hidden text-[16px] leading-none whitespace-nowrap"></div>'; continue; }
      const cls = 'flex min-w-0 items-center justify-center gap-1 overflow-hidden text-[16px] leading-none whitespace-nowrap'
        + (idx === cur || (MW.player.playing && idx === MW.player.seqPos) ? ' bg-ink text-paper' : '');
      /* the sequence list shows block numbers, as OctaMED does */
      rows += `<div class="${cls}" data-seq="${idx}" title="Sequence ${idx + 1}">${MW.hex(s.playseq[idx])}</div>`;
      arrows += `<button class="flex items-center justify-center border-b border-ink bg-paper text-[15px] leading-none active:bg-ink active:text-paper" data-seqmove="${idx}" data-dir="${up ? -1 : 1}" title="${up ? 'Move this entry up' : 'Move this entry down'}">${up ? '↑' : '↓'}</button>`;
    }
    host.innerHTML = `<div class="grid h-full grid-rows-5">${rows}</div>`;
    if (arrowsHost) arrowsHost.innerHTML = arrows;
  };

  /* ------------------------------------------------------------ scope */

  const scope = MW.scope = {
    raf: 0,
    last: 0,
    started: 0,
    elapsed: 0,

    start() {
      if (this.raf) return;
      const loop = () => {
        this.raf = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - this.last < 33) return;
        const dt = (now - (this.prev || now)) / 1000;
        this.prev = now;
        this.last = now;
        if (MW.player.playing) this.elapsed += Math.min(0.2, dt);
        this.draw();
      };
      this.raf = requestAnimationFrame(loop);
    },

    draw() {
      const canvas = document.getElementById('meters');
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 100;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const eq = app.eq || [true, true, true];
      const levels = this.channelLevels();
      /* the manual: split channel modes (5-8) turn every graphic V.U. meter off */
      const split = !!((app.song && app.song.channels) > 4) || !!app.displaysOff;

      /* E1: the bar graph under the info line, per instrument and per note
         E2: the V.U. meter at each track's edge
         E3: the oscilloscope at each track's top, hanging off the play line */
      const bars = eq[0] !== false && !split;
      const vu = eq[1] !== false && !split;
      const scopes = eq[2] !== false && !split;
      this.updateFooterMeters();
      this.drawFooter(ctx, w, h, bars);
      this.drawTrackScopes(scopes);

      if (MW.grid && MW.grid.syncMeters) {
        MW.grid.syncMeters(vu ? levels : []);
      }

      const t = document.getElementById('timer');
      if (t) {
        const total = Math.floor(this.elapsed);
        const mm = Math.floor(total / 60);
        const ss = total % 60;
        t.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      }
    },

    /* E1: the bar graph under the info line. Bar slots are instruments
       01-31 on the left and notes C-1 upward on the right, 8 Amiga pixels
       apart, raised by note triggers and falling like the other meters.
       Geometry measured off OctaMED Pro 4 (via OctaMEDIC). */
    updateFooterMeters() {
      const app = MW.app;
      const e1 = app.e1 || (app.e1 = {
        instruments: new Array(31).fill(0),
        notes: new Array(43).fill(0),
        seen: new Array(16).fill(0)
      });
      const trig = MW.player.triggers || {};
      const raise = (arr, n, level) => {
        const i = (n | 0) - 1;
        if (i >= 0 && i < arr.length) arr[i] = Math.max(arr[i], level);
      };
      for (let t = 0; t < 16; t++) {
        const e = trig[t];
        if (!e || e.count === e1.seen[t]) continue;
        e1.seen[t] = e.count;
        const level = Math.round((e.volume || 0) * 128 / 64);
        raise(e1.instruments, e.ins, level);
        raise(e1.notes, e.note, level);
      }
      /* a full meter empties in about 2/3 s at 50Hz */
      const fall = 6;
      for (const arr of [e1.instruments, e1.notes]) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - fall);
      }
    },

    drawFooter(ctx, w, h, bars) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, Math.max(1, w - 1), Math.max(1, h - 1));

      const sx = w / 640;
      const sy = h / 49;
      const top = 9 * sy;
      const graphH = 32 * sy;
      const axis = top + graphH;
      const fill = (x, y, fw, fh) => ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(fw)), Math.max(1, Math.round(fh)));
      ctx.fillStyle = '#000';

      /* side rulers, either side of the gap */
      for (const x of [14, 264, 278, 624]) fill(x * sx, top, 2, graphH);
      /* marks every 4 lines on them, right across the gap */
      for (let i = 0; i < 8; i++) {
        const y = top + i * 4 * sy;
        fill(8 * sx, y, 8 * sx, 1);
        fill(264 * sx, y, 16 * sx, 1);
        fill(624 * sx, y, 8 * sx, 1);
      }
      /* the two axes along the bottom */
      fill(14 * sx, axis, 252 * sx, 1);
      fill(278 * sx, axis, 348 * sx, 1);
      /* a tick at both edges of every slot, longer at every C */
      for (let i = 0; i < 31; i++) {
        const x = 16 + i * 8;
        fill(x * sx, axis + 1, 1, 3);
        fill((x + 7) * sx, axis + 1, 1, 3);
      }
      for (let i = 0; i < 43; i++) {
        const x = 280 + i * 8;
        fill(x * sx, axis + 1, 1, 3);
        fill((x + 7) * sx, axis + 1, 1, 3);
      }
      for (let i = 0; i < 4; i++) fill((280 + i * 96) * sx, axis + 1, 1, 5);

      if (!bars) return;
      const e1 = MW.app.e1;
      if (!e1) return;
      const pens = ['#ff0000', '#ff8888', '#ffaaaa', '#ffcccc', '#ffcccc', '#ffaaaa', '#ff8888', '#ff0000'];
      const drawGroup = (x0, slots) => {
        slots.forEach((level, slot) => {
          if (!level) return;
          const steps = Math.min(4, Math.ceil(level * 4 / 128));
          const bh = steps * 7 * sy;
          if (bh < 1) return;
          const left = (x0 + slot * 8) * sx;
          for (let c = 0; c < 8; c++) {
            ctx.fillStyle = pens[c];
            ctx.fillRect(Math.round(left + c * sx), Math.round(axis - bh), Math.max(1, Math.ceil(sx)), Math.ceil(bh));
          }
        });
      };
      drawGroup(16, e1.instruments);
      drawGroup(280, e1.notes);
    },

    /* E3: a per-track oscilloscope 42 samples wide, 2 font pixels in from
       the track edge, hanging off the highlighted line to the bottom */
    drawTrackScopes(on) {
      const canvas = document.getElementById('ch-waves');
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 300;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!on || !MW.player.playing || !MW.grid || !MW.grid.el) return;
      const row = MW.grid.el.querySelector('.grid-row.cur') || MW.grid.el.querySelector('.grid-row');
      if (!row) return;
      const base = canvas.getBoundingClientRect();
      const top = row.getBoundingClientRect().top - base.top;
      const height = h - top - 8;
      if (height < 8) return;
      const tracks = Array.from(row.querySelectorAll('.track')).slice(0, 4);
      const samples = 42;
      tracks.forEach((tr, i) => {
        const wave = MW.audio.channelWave(i);
        if (!wave) return;
        const r = tr.getBoundingClientRect();
        const x0 = r.left - base.left + 2;
        const width = Math.min(samples * 1.5, r.width - 4);
        if (width < 8 || x0 > w) return;
        ctx.fillStyle = '#ffaaaa';
        let start = 0;
        const rowOf = k => {
          const idx = Math.min(wave.length - 1, Math.floor((k / samples) * wave.length));
          const v = MW.clamp(wave[idx], -1, 1);
          return Math.round(top + height / 2 - v * (height / 2));
        };
        for (let k = 1; k <= samples; k++) {
          if (k < samples && rowOf(k) === rowOf(start)) continue;
          const x = x0 + (start / samples) * width;
          const fw = Math.max(1, ((k - start) / samples) * width);
          ctx.fillRect(Math.round(x), rowOf(start), Math.ceil(fw), 1);
          start = k;
        }
      });
    },

    channelLevels() {
      const p = MW.player;
      const n = MW.clamp((p.song && p.song.channels) || 4, 4, 16);
      const out = [];
      for (let i = 0; i < n; i++) {
        const rms = MW.audio.channelRms(i);
        const target = MW.clamp(rms * 4.2, 0, 1);
        const ch = p.channels[i];
        const prev = ch ? (ch._meter || 0) : 0;
        const v = Math.max(target, prev * 0.84);
        if (ch) ch._meter = v;
        out.push(v);
      }
      return out;
    },

  };

  /* ------------------------------------------------------------ boot */

  async function loadExample(onlyIfUnchanged) {
    const initialSong = app.song;
    try {
      const response = await fetch('fixtures/maniac-beat.mmd1');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = await response.arrayBuffer();
      if (onlyIfUnchanged && app.song !== initialSong) return;
      openBuffer(buffer, 'Maniac Beat.mmd1');
    } catch (err) {
      MW.toast('Could not load the example song: ' + err.message, true);
    }
  }
  MW.loadExample = loadExample;

  function boot() {
    app.song = MW.createSong();
    app.eq = [true, true, true];
    prefs.load();
    MW.player.setSong(app.song);

    MW.panels.mount(document.getElementById('panel'));
    MW.displays.show('grid');
    MW.renderSeqBox();
    scope.start();

    document.querySelector('.deck-side').addEventListener('click', e => {
      const p = e.target.closest('button[data-panel]');
      if (p) return MW.panels.show(p.dataset.panel);
      const d = e.target.closest('button[data-display]');
      if (d) MW.displays.show(d.dataset.display);
    });

    document.getElementById('panel').addEventListener('click', onPanelClick);
    document.getElementById('display-body').addEventListener('click', e => {
      if (MW.displays.current === 'midi') onPanelClick(e);
    });

    const blockNameBox = document.getElementById('st-blockname');
    if (blockNameBox) blockNameBox.addEventListener('input', () => {
      const b = app.song.blocks[app.cursor.block];
      if (b) b.name = blockNameBox.value;
    });
    const songNameBox = document.getElementById('st-songname');
    if (songNameBox) songNameBox.addEventListener('input', () => { app.song.name = songNameBox.value; });

    const nrm = document.getElementById('btn-nrm');
    if (nrm) {
      const modes = [['NRM', 1], ['2/3', 2 / 3], ['1/2', 1 / 2]];
      app.nrmMode = app.nrmMode || 0;
      const showNrm = () => {
        const [label, rate] = modes[app.nrmMode];
        nrm.textContent = label;
        nrm.classList.toggle('on', app.nrmMode !== 0);
        MW.player.rate = rate;
      };
      showNrm();
      nrm.onclick = () => {
        app.nrmMode = (app.nrmMode + 1) % modes.length;
        showNrm();
        MW.toast('Playback speed ' + nrm.textContent);
      };
    }

    document.getElementById('seqbox').addEventListener('click', e => {
      const row = e.target.closest('[data-seq]');
      if (row) { app.cursor.seq = parseInt(row.dataset.seq, 10); jumpToSeq(); }
    });

    /* the arrows beside each play-sequence row move that entry up or down */
    function moveSeqEntry(idx, dir) {
      const seq = app.song.playseq;
      const to = idx + dir;
      if (idx < 0 || to < 0 || idx >= seq.length || to >= seq.length) return;
      const t = seq[idx]; seq[idx] = seq[to]; seq[to] = t;
      app.cursor.seq = to;
      jumpToSeq();
    }
    document.getElementById('seqarrows').addEventListener('click', e => {
      const b = e.target.closest('[data-seqmove]');
      if (!b) return;
      moveSeqEntry(parseInt(b.dataset.seqmove, 10), parseInt(b.dataset.dir, 10));
    });

    function showSong(dir) {
      const list = app.songList || [];
      if (list.length < 2) return MW.toast('This module holds one song');
      app.songIndex = (app.songIndex + dir + list.length) % list.length;
      app.song = list[app.songIndex];
      app.cursor = { block: app.song.playseq[0] || 0, line: 0, track: 0, field: 0, seq: 0 };
      MW.player.setSong(app.song);
      refreshAll();
      MW.toast('Song ' + (app.songIndex + 1) + ' of ' + list.length);
    }
    const instrumentControl = document.getElementById('st-ins-control');
    instrumentControl.addEventListener('click', () => selectIns(1));
    instrumentControl.addEventListener('contextmenu', e => { e.preventDefault(); selectIns(-1); });

    document.getElementById('st-song-control').onclick = () => showSong(1);
    document.getElementById('st-song-control').oncontextmenu = e => { e.preventDefault(); showSong(-1); };
    document.getElementById('st-song-next').onclick = () => showSong(1);
    document.getElementById('st-song-prev').onclick = () => showSong(-1);

    document.getElementById('st-tracks').addEventListener('click', e => {
      const d = e.target.closest('[data-mute]');
      if (!d) return;
      const t = parseInt(d.dataset.mute, 10);
      app.mutedTracks[t] = !app.mutedTracks[t];
      MW.player.channels[t].muted = app.mutedTracks[t];
      MW.touchStatus('mute', ['mutedTracks']);
      MW.grid.render();
    });

    /* The status bar digits follow the manual: the digit clicked decides
       the step (rightmost 1, then 10, 100, 1000). */
    const digitStep = (el, clientX, digits) => {
      const text = (el.textContent || '').trim();
      const len = Math.max(digits, text.length);
      const r = el.getBoundingClientRect();
      const charW = r.width / len;
      const start = (r.width - charW * len) / 2;
      const index = Math.min(digits - 1, Math.max(0, Math.floor((clientX - r.left - start) / charW)));
      return Math.pow(10, digits - 1 - index);
    };
    const stepSeq = (el, e, dir) => {
      e.preventDefault();
      const step = digitStep(el, e.clientX, 4);
      const last = Math.max(0, app.song.playseq.length - 1);
      app.cursor.seq = MW.clamp(app.cursor.seq + step * dir, 0, last);
      MW.renderSeqBox();
      MW.touchStatus('seq', ['seq']);
    };
    const seqIndex = document.getElementById('st-seq');
    seqIndex.addEventListener('click', e => stepSeq(seqIndex, e, 1));
    seqIndex.addEventListener('contextmenu', e => stepSeq(seqIndex, e, -1));

    const blockIndex = document.getElementById('st-block');
    const stepBlock = (e, dir) => {
      e.preventDefault();
      const step = digitStep(blockIndex, e.clientX, 4);
      const last = Math.max(0, app.song.blocks.length - 1);
      const next = MW.clamp(app.cursor.block + step * dir, 0, last);
      if (next !== app.cursor.block) selectBlock(next - app.cursor.block);
      else MW.touchStatus('block', ['cursor']);
    };
    blockIndex.addEventListener('click', e => stepBlock(e, 1));
    blockIndex.addEventListener('contextmenu', e => stepBlock(e, -1));

    const octaveBox = document.getElementById('st-oct');
    const stepOctave = dir => {
      app.octave = MW.clamp(((app.octave + dir) % 9 + 9) % 9, 0, 8);
      MW.touchStatus('octave', ['octave']);
      MW.panels.refresh();
    };
    octaveBox.addEventListener('click', () => stepOctave(1));
    octaveBox.addEventListener('contextmenu', e => { e.preventDefault(); stepOctave(-1); });

    document.getElementById('st-edit').addEventListener('click', () => {
      app.editMode = !app.editMode;
      MW.touchStatus('edit', ['editMode']);
    });
    document.getElementById('st-space').addEventListener('click', () => {
      app.autoSpace = !app.autoSpace;
      MW.touchStatus('space', ['autoSpace']);
    });
    document.getElementById('st-chord').addEventListener('click', () => {
      app.chordMode = !app.chordMode;
      MW.touchStatus('chord', ['chordMode']);
    });

    document.getElementById('file-input').onchange = e => {
      const f = e.target.files[0];
      if (f) readFile(f);
      e.target.value = '';
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', e => { if (e.key === 'Alt') app.altHeld = null; });

    let panicTimer = 0;
    document.addEventListener('mousedown', e => {
      if (e.buttons !== 3) return;
      clearTimeout(panicTimer);
      panicTimer = setTimeout(() => {
        if (MW.player.playing) {
          MW.player.stop();
          MW.toast('Panic stop');
        }
      }, 1500);
    });
    document.addEventListener('mouseup', () => clearTimeout(panicTimer));

    /* the manual: a right click switches the graphic V.U. meters and
       scrolling off; the block editor keeps the right button for ranges */
    document.addEventListener('contextmenu', e => {
      if (e.target.closest && e.target.closest('#grid-wrap')) return;
      e.preventDefault();
      app.displaysOff = !app.displaysOff;
      MW.touchStatus('meters', ['eq']);
    });

    document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
    document.addEventListener('drop', e => {
      e.preventDefault();
      document.body.classList.remove('dragging');
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result;
        if (MW.isLHA(new Uint8Array(buf))) return handleFileBuffer(buf, f.name);
        const song = (() => { try { return MW.loadModule(buf); } catch (err) { return null; } })();
        if (song) openBuffer(buf, f.name);
        else {
          const inst = MW.loadInstrument(buf);
          if (inst) {
            app.song.instruments[app.currentIns - 1] = inst;
            refreshAll();
            MW.toast('Instrument loaded into ' + MW.insName(app.currentIns));
          } else MW.toast('Unrecognised file', true);
        }
      };
      reader.readAsArrayBuffer(f);
    });

    const insInput = document.createElement('input');
    insInput.type = 'file';
    insInput.id = 'ins-file-input';
    insInput.hidden = true;
    insInput.accept = '.wav,.8svx,.iff,.msh,.raw,.ins,.lha,.lzh';
    insInput.onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const inst = MW.loadInstrument(reader.result);
        if (!inst) { MW.toast('Could not read that instrument', true); return; }
        inst.name = inst.name || f.name.replace(/\.[^.]+$/, '');
        app.song.instruments[app.currentIns - 1] = inst;
        refreshAll();
        MW.toast('Loaded ' + f.name + ' into ' + MW.insName(app.currentIns));
      };
      reader.readAsArrayBuffer(f);
      e.target.value = '';
    };
    document.body.appendChild(insInput);
    app.loadInstrumentFile = () => insInput.click();

    MW.player.onRow = row => {
      if (row.seq !== MW.lastSeq) {
        MW.lastSeq = row.seq;
        MW.renderSeqBox();
      }
      MW.followPlaybackRow(row);
      store.set({ seq: MW.player.seqPos }, 'play');
      MW.touchStatus('play', ['cursor']);
    };

    MW.player.onStop = () => {
      MW.grid.refreshLine(-1);
      MW.grid.updatePadding();
      MW.grid.centerLine(app.cursor.line);
      MW.touchStatus('stop', ['cursor']);
    };

    MW.on('transport', t => {
      store.set({ transport: { ...app.transport, ...t } }, 'transport');
      MW.grid.updatePadding();
      if (t.playing && MW.app.follow) MW.grid.centerLine(MW.player.line);
      MW.renderSeqBox();
    });

    const origTrigger = MW.player.trigger;
    MW.player.trigger = function (ch, note, time, cell) {
      if (ch.inst && ch.inst.midiChannel) {
        /* offline export has no MIDI hardware to talk to */
        if (!this.offline) midiTrigger(ch.inst, note, ch.idx);
        return;
      }
      return origTrigger.call(this, ch, note, time, cell);
    };

    app.songList = [app.song];
    app.songIndex = 0;
    document.body.classList.toggle('dep2', !!app.dep2);
    MW.audio.setFilter(!!app.song.flags.filteron);

    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, () => MW.audio.unlock(), { capture: true, passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && MW.player.playing) MW.audio.unlock();
    });

    refreshAll();
    MW.toast('Loading example song…');
    loadExample(true);
  }

  function jumpToSeq() {
    const s = app.song;
    const idx = MW.clamp(app.cursor.seq, 0, s.playseq.length - 1);
    app.cursor.block = s.playseq[idx] || 0;
    app.cursor.line = 0;
    if (MW.player.playing) MW.player.jumpSeq(idx);
    refreshAll();
  }

  MW.boot = boot;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof globalThis !== 'undefined' ? globalThis : this);
