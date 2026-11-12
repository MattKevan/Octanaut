/* Octanaut - big displays: instrument list, sample editor, synth editor, notation */
(function (global) {
  'use strict';
  const MW = global.MW;
  const library = { directory: -1, entries: [], selected: -1 };

  /* Write one instrument into a File System Access directory as 8SVX.
     The helper only uses getFileHandle/createWritable, so tests can pass a
     fake directory. */
  MW.writeInstrumentFile = async function (dir, name, inst) {
    const bytes = MW.write8SVX(inst);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (err) {
      try { if (writable.abort) await writable.abort(); } catch (e) { /* already gone */ }
      throw err;
    }
    return bytes.byteLength || bytes.length || 0;
  };

  /* SAVE ALL: keep going when one file fails and report both counts. */
  MW.saveAllInstruments = async function (dir, song) {
    let saved = 0, failed = 0;
    for (const entry of MW.instrumentSaveList(song)) {
      try {
        await MW.writeInstrumentFile(dir, entry.name, entry.inst);
        saved++;
      } catch (err) {
        failed++;
      }
    }
    return { saved, failed };
  };
  /* DELETE: true when the entry was removed, false when it was already
     gone or the directory refused. */
  MW.removeLibraryFile = async function (dir, name) {
    if (!dir || !name) return false;
    try {
      await dir.removeEntry(name);
      return true;
    } catch (err) {
      return false;
    }
  };

  MW.listLibraryEntries = async function (dir) {
    const files = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && (/\.(msh|8svx|iff|wav|wave|aif|aiff|mp3|m4a|aac|flac|ogg|opus|raw|ins)$/i.test(name) || !name.includes('.'))) files.push({ name, handle });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  };

  const synthTarget = (syn, side, index) => side === 'buffer' ? syn.buffer : syn.waveforms[index];
  const synthSaveUndo = (syn, side, index) => {
    syn._undo = { side, index, data: Float32Array.from(synthTarget(syn, side, index)) };
  };
  MW.synthUndo = function (syn) {
    if (!syn._undo) return false;
    if (syn._undo.waves) {
      syn.waveforms = syn._undo.waves;
      if (syn._undo.buffer) syn.buffer = syn._undo.buffer;
      syn._undo = null;
      return true;
    }
    const { side, index, data } = syn._undo;
    if (side === 'buffer') syn.buffer = data;
    else if (index < syn.waveforms.length) syn.waveforms[index] = data;
    syn._undo = null;
    return true;
  };
  MW.synthInsertWave = function (syn, index, atEnd) {
    if (syn.waveforms.length >= 64) return -1;
    syn._undo = { waves: syn.waveforms.map(w => Float32Array.from(w)) };
    const at = atEnd ? syn.waveforms.length : index;
    syn.waveforms.splice(at, 0, new Float32Array(syn.waveforms[index].length));
    return at;
  };
  MW.synthSetSelection = function (app, side, instrument, wave, first, last) {
    app.synthCursor = { side, instrument, wave, position: last };
    app.synthRange = first === last ? null : { side, instrument, wave, start: Math.min(first, last), end: Math.max(first, last) + 1 };
  };
  MW.synthAdjustRange = function (range, boundary, delta, length) {
    const next = { ...range };
    if (boundary === 'start') next.start = Math.max(0, Math.min(range.end - 1, range.start + delta));
    else next.end = Math.max(range.start + 1, Math.min(length, range.end + delta));
    return next;
  };
  MW.synthCopyRange = function (syn, side, index, start, end) {
    const wave = synthTarget(syn, side, index);
    start = Math.max(0, Math.min(wave.length, start));
    end = Math.max(start, Math.min(wave.length, end));
    if (start === end) return false;
    const copy = wave.slice(start, end);
    synthSaveUndo(syn, 'buffer', index);
    syn.buffer = copy;
    return true;
  };
  /* the original's CUT copies the range to the right-hand display and
     leaves a gap where it was, on the left waveform only */
  MW.synthCutRange = function (syn, side, index, start, end) {
    if (side !== 'bank') return false;
    const wave = synthTarget(syn, side, index);
    start = Math.max(0, Math.min(wave.length, start));
    end = Math.max(start, Math.min(wave.length, end));
    if (start === end) return false;
    synthSaveUndo(syn, 'bank', index);
    syn.buffer = wave.slice(start, end);
    for (let i = start; i < end; i++) wave[i] = 0;
    return true;
  };
  /* STRETCH moves the point under the cursor by `amount` samples, easing
     the samples either side so the waveform keeps its length */
  MW.synthStretch = function (syn, side, index, position, amount) {
    const wave = synthTarget(syn, side, index);
    const n = wave.length;
    if (n < 3) return false;
    const p = Math.max(1, Math.min(n - 2, Math.round(position)));
    const to = Math.max(1, Math.min(n - 2, p + Math.round(amount)));
    if (to === p) return false;
    synthSaveUndo(syn, side, index);
    const src = Float32Array.from(wave);
    for (let i = 0; i < n; i++) {
      const at = i <= to ? i * p / to : p + (i - to) * (n - 1 - p) / (n - 1 - to);
      const lo = Math.max(0, Math.min(n - 1, Math.floor(at)));
      const hi = Math.min(n - 1, lo + 1);
      const t = at - lo;
      wave[i] = src[lo] + (src[hi] - src[lo]) * t;
    }
    return true;
  };
  MW.synthPasteRange = function (syn, index, cursor) {
    const wave = syn.waveforms[index];
    cursor = Math.max(0, Math.min(wave.length, cursor));
    if (!syn.buffer || !syn.buffer.length || cursor === wave.length) return false;
    synthSaveUndo(syn, 'bank', index);
    wave.set(syn.buffer.subarray(0, wave.length - cursor), cursor);
    return true;
  };
  MW.synthEditRange = function (syn, side, index, start, end, operation, amount) {
    const wave = synthTarget(syn, side, index);
    start = Math.max(0, Math.min(wave.length, start));
    end = Math.max(start, Math.min(wave.length, end));
    if (start === end) return;
    synthSaveUndo(syn, side, index);
    const original = wave.slice(start, end);
    for (let i = 0; i < original.length; i++) {
      if (operation === 'clear') wave[start + i] = 0;
      else if (operation === 'reverse') wave[start + i] = original[original.length - 1 - i];
      else if (operation === 'double') wave[start + i] = original[(i * 2) % original.length];
      else if (operation === 'volume') wave[start + i] = Math.max(-1, Math.min(1, original[i] * amount / 100));
      else if (operation === 'left') wave[start + i] = original[(i + 1) % original.length];
      else if (operation === 'right') wave[start + i] = original[(i + original.length - 1) % original.length];
    }
  };
  /* CLR empties the current waveform; ALL empties every waveform and
     resets the two program lists, as the original's CLR/ALL gadgets do */
  MW.synthClearWave = function (syn, side, index) {
    const wave = synthTarget(syn, side, index);
    if (!wave || !wave.length) return false;
    synthSaveUndo(syn, side, index);
    wave.fill(0);
    return true;
  };
  MW.synthClearAll = function (syn) {
    if (!syn || !syn.waveforms || !syn.waveforms.length) return false;
    syn._undo = { waves: syn.waveforms.map(w => Float32Array.from(w)), buffer: syn.buffer ? Float32Array.from(syn.buffer) : null };
    syn.waveforms.forEach(w => w.fill(0));
    syn.voltbl = [0x00, 0xff];
    syn.wftbl = [0x00, 0xff];
    return true;
  };
  MW.synthDraw = function (syn, side, index, from, fromValue, to, toValue, save = true, mix = false) {
    const wave = synthTarget(syn, side, index);
    if (save) synthSaveUndo(syn, side, index);
    const low = Math.max(0, Math.min(from, to)), high = Math.min(wave.length - 1, Math.max(from, to));
    for (let i = low; i <= high; i++) {
      const fraction = from === to ? 1 : (i - from) / (to - from);
      const value = Math.max(-1, Math.min(1, fromValue + fraction * (toValue - fromValue)));
      wave[i] = mix ? ((mix === true ? wave[i] : mix[i]) + value) / 2 : value;
    }
  };
  MW.sampleDrawLine = function (data, from, fromValue, to, toValue) {
    const low = Math.max(0, Math.min(from, to)), high = Math.min(data.length - 1, Math.max(from, to));
    for (let i = low; i <= high; i++) {
      const t = from === to ? 1 : (i - from) / (to - from);
      data[i] = Math.max(-1, Math.min(1, fromValue + t * (toValue - fromValue)));
    }
  };

  MW.sampleCreateBuffer = function (app, size) {
    if (!Number.isInteger(size) || size < 1 || size > 131072) return false;
    const index = app.currentIns - 1;
    const inst = app.song.instruments[index];
    if (inst && ((inst.data && inst.data.length) || inst.synth || inst.type !== 'sample')) return false;
    const sample = inst || MW.createInstrument('sample');
    sample.data = new Float32Array(size);
    app.song.instruments[index] = sample;
    return true;
  };
  MW.sampleSetNotePeriod = function (inst, target, note) {
    const period = Math.max(1, MW.period(note));
    if (target === 'pitch') {
      inst.c2rate = Math.round((8363 * 428) / period);
      inst._abuf = null;
    } else inst._sampleDestPeriod = period;
    return period;
  };
  MW.sampleScrollView = function (view, length, direction) {
    const width = Math.min(length, view.b - view.a);
    const step = Math.max(1, Math.round(width / 8));
    const a = Math.max(0, Math.min(length - width, view.a + direction * step));
    return { a, b: a + width };
  };

  MW.notationMeasureStart = (line, time) => Math.floor(Math.max(0, line) / ((time || 4) * 4)) * ((time || 4) * 4);
  MW.notationPreset = function (app, index) {
    if (!app.notaPresets) app.notaPresets = [];
    if (app.notaPresetReady) {
      app.notaPresets[app.pset || 0] = { tracks: { ...app.notaTracks }, ghost: { ...app.notaGhost }, track: app.notaSelectedTrack ?? null };
    }
    if (!app.notaPresets[index]) {
      app.notaPresets[index] = { tracks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, index === 0])), ghost: {}, track: null };
    }
    const preset = app.notaPresets[index];
    app.pset = index;
    app.notaTracks = { ...preset.tracks };
    app.notaGhost = { ...preset.ghost };
    app.notaSelectedTrack = preset.track;
    app.notaPresetReady = true;
  };

  MW.initNotation = function (app) {
    const saved = app.song.notation;
    app.notaPresetReady = false;
    app.notaPresets = saved && saved.presets ? JSON.parse(JSON.stringify(saved.presets)) : [];
    app.notaInstruments = saved && saved.instruments ? JSON.parse(JSON.stringify(saved.instruments)) : {};
    if (saved) { app.keySig = { ...saved.keySig }; app.timeSig = saved.timeSig; }
    app.notaSave = !!saved;
    MW.notationPreset(app, 0);
  };
  MW.captureNotation = function (app) {
    MW.notationPreset(app, app.pset || 0);
    return {
      keySig: { ...(app.keySig || { count: 0, flat: false }) },
      timeSig: app.timeSig || 4,
      presets: JSON.parse(JSON.stringify(app.notaPresets)),
      instruments: JSON.parse(JSON.stringify(app.notaInstruments || {}))
    };
  };

  MW.notationSelectTrack = function (app, track) {
    app.notaSelectedTrack = track;
    app.notaGhost = app.notaGhost || {};
    for (let i = 0; i < 16; i++) app.notaGhost[i] = i !== track;
  };

  const scoreNatural = [0, 2, 4, 5, 7, 9, 11];
  const scoreSharpOrder = [3, 0, 4, 1, 5, 2]; // F C G D A E
  const scoreFlatOrder = [6, 2, 5, 1, 4, 0]; // B E A D G C
  function scoreKeyAlteration(step, key) {
    const order = key && key.flat ? scoreFlatOrder : scoreSharpOrder;
    return order.slice(0, key ? Math.max(0, Math.min(6, key.count || 0)) : 0).includes(step) ? (key.flat ? -1 : 1) : 0;
  }
  MW.notationNoteAtStep = function (step, key) {
    const octave = Math.floor(step / 7), letter = ((step % 7) + 7) % 7;
    return MW.clamp(octave * 12 + 1 + scoreNatural[letter] + scoreKeyAlteration(letter, key), 1, 120);
  };
  MW.notationPitch = function (note, key) {
    const pitch = ((note - 1) % 12 + 12) % 12;
    const octave = Math.floor((note - 1) / 12);
    // Prefer a pitch that is already present in the key, including E-sharp
    // and C-flat at octave boundaries.
    for (let oct = octave - 1; oct <= octave + 1; oct++) for (let letter = 0; letter < 7; letter++) {
      const alter = scoreKeyAlteration(letter, key);
      if (alter && oct * 12 + 1 + scoreNatural[letter] + alter === note) return { step: oct * 7 + letter, accidental: '' };
    }
    const sharpLetters = [0,0,1,1,2,3,3,4,4,5,5,6];
    const flatLetters = [0,1,1,2,2,3,4,4,5,5,6,6];
    const letter = (key && key.flat ? flatLetters : sharpLetters)[pitch];
    const alteration = pitch - scoreNatural[letter];
    const expected = scoreKeyAlteration(letter, key);
    const accidental = alteration === expected ? '' : alteration === 0 ? 'natural' : alteration < 0 ? 'flat' : 'sharp';
    return { step: octave * 7 + letter, accidental };
  };

  MW.notationAccidental = function (note, pitch, key, state) {
    const letter = ((pitch.step % 7) + 7) % 7;
    const octave = Math.floor(pitch.step / 7);
    const alteration = note - (octave * 12 + 1 + scoreNatural[letter]);
    const previous = Object.prototype.hasOwnProperty.call(state, pitch.step) ? state[pitch.step] : scoreKeyAlteration(letter, key);
    state[pitch.step] = alteration;
    if (alteration === previous) return '';
    return alteration === 0 ? 'natural' : alteration < 0 ? 'flat' : 'sharp';
  };

  MW.notationHit = function (layout, x, y, key, lines) {
    if (x < layout.left || x >= layout.right) return null;
    const line = Math.min(lines - 1, layout.start + Math.floor((x - layout.left) / (layout.right - layout.left) * layout.per));
    const pos = 14 + Math.round((layout.middle - y) / (layout.step / 2));
    return { line, note: MW.notationNoteAtStep(pos, key) };
  };

  MW.notationPrintBlocks = function (app) {
    const blocks = app.song.blocks;
    const first = app.notaPrintAll === false ? Math.min(blocks.length - 1, Math.max(0, app.notaStart || 0)) : 0;
    const last = app.notaPrintAll === false ? Math.min(blocks.length - 1, Math.max(first, app.notaEnd || 0)) : blocks.length - 1;
    return blocks.slice(first, last + 1).map((block, i) => ({ block, index: first + i }));
  };
  MW.notationTextBlock = function (block, index, hb) {
    const rows = block.rows.map((row, line) => String(line).padStart(3, '0') + ' ' + row.map(cell => {
      const note = cell.note ? MW.noteName(cell.note, hb) : cell.ins ? '-|-' : '---';
      return `${note} ${MW.insName(cell.ins)}${MW.hex(cell.cmd)}${MW.hex(cell.dat)}`;
    }).join('  '));
    return `BLOCK ${index}\n` + rows.join('\n');
  };
  MW.notationTextHeader = function (song) {
    const instruments = (song.instruments || []).map((ins, i) => ins ? `${MW.insName(i + 1)} ${ins.name || ''}` : '').filter(Boolean);
    return [song.name || 'untitled', `SEQUENCE: ${(song.playseq || []).join(' ')}`,
      `TEMPO: ${song.deftempo} / ${song.tempo2}`, `MASTER VOLUME: ${song.mastervol}`,
      `TRACK VOLUMES: ${(song.trkvol || []).join(' ')}`, 'INSTRUMENTS:', ...instruments].join('\n');
  };

  MW.notationDuration = function (block, track, line) {
    const initial = block.rows[line] && block.rows[line][track];
    if (!initial || !initial.note) return 0;
    let duration = 1;
    while (line + duration < block.lines) {
      const cell = block.rows[line + duration][track];
      if (!cell || cell.note || !cell.ins || cell.cmd || cell.dat) break;
      duration++;
    }
    return duration;
  };

  MW.notationDurationParts = function (duration, line, measure) {
    const choices = [[16, false, 16], [8, true, 12], [8, false, 8], [4, true, 6], [4, false, 4], [2, true, 3], [2, false, 2], [1, false, 1]];
    const parts = [];
    let offset = 0;
    while (offset < duration) {
      const available = Math.min(duration - offset, measure - ((line + offset) % measure));
      const [length, dotted, consumed] = choices.find(choice => choice[2] <= available);
      parts.push({ offset, length, dotted });
      offset += consumed;
    }
    return parts;
  };

  MW.notationWrite = function (block, track, line, options) {
    const length = Math.max(1, Math.min(options.length || 1, block.lines - line));
    if (options.insert) for (let i = block.lines - 1; i >= line + length; i--) Object.assign(block.rows[i][track], block.rows[i - length][track]);
    if (options.remove) {
      for (let i = line; i < block.lines - length; i++) Object.assign(block.rows[i][track], block.rows[i + length][track]);
      for (let i = Math.max(line, block.lines - length); i < block.lines; i++) MW.clearCell(block.rows[i][track]);
      return;
    }
    for (let i = 0; i < length; i++) {
      const cell = block.rows[line + i][track];
      MW.clearCell(cell);
      if (!options.rest) { cell.note = i ? 0 : options.note; cell.ins = options.instrument; }
    }
  };

  function scoreSymbol(index) {
    const heads = ['<path d="M3 20h2v-2h7v2h2v3h-2v2H5v-2H3zm3 0v3h5v-3z"/>', '<path d="M3 20h2v-2h7v2h2v3h-2v2H5v-2H3zm3 0v3h5v-3z"/><path d="M12 3h2v17h-2z"/>', '<path d="M3 20h2v-2h8v5h-2v2H4v-2H3zM12 3h2v17h-2z"/>', '<path d="M3 20h2v-2h8v5h-2v2H4v-2H3zM12 3h2v17h-2zM14 4h2v3h2v4h-2V9h-2z"/>', '<path d="M3 20h2v-2h8v5h-2v2H4v-2H3zM12 3h2v17h-2zM14 4h2v3h2v4h-2V9h-2zM14 10h2v3h2v4h-2v-2h-2z"/>', '<path d="M3 13h12v4H3z"/>', '<path d="M3 12h12v4H3z"/>', '<path d="M8 3h3v3h2v3h-2v3H8v3H6v3h3v3H7v4H4v-4h2v-3H4v-3h2v-3h3V9H7V6h1z"/>', '<path d="M10 4h4v4h-3v3H8v12H5V10h3V7h2z"/>'];
    return `<svg aria-hidden="true" viewBox="0 0 20 28" shape-rendering="crispEdges" class="score-symbol">${heads[index]}</svg>`;
  }

  const displays = MW.displays = {
    current: 'grid',

    show(name) {
      const host = document.getElementById('display-body');
      if (this.current === 'midi' && name !== 'midi') MW.panels.unmountMidi(host);
      if (name === 'midi' && this.current !== 'midi') host.innerHTML = '';
      this.current = name;
      document.querySelectorAll('.deck-side [data-display]').forEach(b => {
        b.classList.toggle('active', b.dataset.display === name);
      });
      document.getElementById('display-meta').textContent = '';
      if (name === 'midi') return MW.panels.mountMidi(host);
      if (name === 'grid') { MW.grid.mount(host); return; }
      if (name === 'files') return this.renderFiles(host);
      if (name === 'list') return this.renderList(host);
      if (name === 'sample') return this.renderSample(host);
      if (name === 'synth') return this.renderSynth(host);
      if (name === 'notation') return this.renderNotation(host);
    },

    refresh() {
      if (this.current === 'grid') { MW.grid.render(); return; }
      this.show(this.current);
    },

    refreshNotation() {
      if (this.current !== 'notation') return;
      const canvas = document.getElementById('sheet');
      const block = MW.app.song.blocks[MW.app.cursor.block];
      if (canvas && block) this.drawSheet(canvas, block);
    },

    inst() {
      const app = MW.app;
      return app.song.instruments[app.currentIns - 1];
    },

    /* ---------------------------------------------------------- files */

    renderFiles(host) {
      const req = MW.requester;
      if (!req) return;
      const focused = document.activeElement;
      const restoreSearch = !!(focused && focused.id === 'files-search');
      const caret = restoreSearch ? focused.selectionStart : 0;
      const draw = () => { if (MW.displays.current === 'files') this.renderFiles(host); };
      req._onChange = draw;
      if (req.volume === 'DF0:' && !req._diskLoaded) {
        req._diskLoaded = true;
        req.listDisk();
      }
      if (req.volume === 'DH0:' && !req._modlandLoaded) {
        req._modlandLoaded = true;
        req.listModland(req.modlandPath || '');
      }
      const path = req.volume === 'DF0:'
        ? 'DF0: Work' + (req.diskUsage
          ? ` · ${req.diskUsage.files} files · ${MW.formatBytes(req.diskUsage.bytes)}`
          : '')
        : req.volume === 'DH0:'
          ? 'DH0: Modland' + (req.modlandPath ? ' / ' + req.modlandPath : '')
          : (req.dir ? req.dir.name : (req.title || 'no folder chosen'));
      const entries = req.entries || [];
      const sizeOf = e => e.dir ? '<dir>'
        : (e.remote ? 'modland'
          : e.size != null ? e.size : e.data ? e.data.length : e.file ? e.file.size : '');
      const rowsFor = (directories) => entries.map((e, i) => {
        if (!!e.dir !== directories) return '';
        return `<button class="req-row${e.dir ? ' dir' : ''}" data-file="${i}">
          <span>${escapeHtml(e.name)}</span><span class="float-right opacity-60">${sizeOf(e)}</span>
        </button>`;
      }).join('');
      const files = rowsFor(false);
      const folders = rowsFor(true);
      const volumeBtn = (act, label, on) =>
        `<button class="flex h-[24px] items-center border border-ink px-2 text-[11px] ${on ? 'bg-ink text-paper' : 'bg-paper text-ink'}" data-files="${act}">${label}</button>`;
      host.innerHTML = `<div class="pane files-pane flex h-full flex-col gap-1">
        <div class="flex items-stretch gap-2">
          <span class="flex h-[24px] min-w-0 flex-1 items-center border border-ink bg-black px-2 text-[11px] text-white">DIR: ${escapeHtml(path)}</span>
          ${volumeBtn('df0', 'DF0:', req.volume === 'DF0:')}
          ${volumeBtn('os', 'OS:', req.volume === 'OS')}
          ${volumeBtn('dh0', 'DH0:', req.volume === 'DH0:')}
          <button class="flex h-[24px] items-center border border-ink bg-paper px-2 text-[11px] text-ink" data-files="folder">FOLDER</button>
          <button class="flex h-[24px] items-center border border-ink bg-paper px-2 text-[11px] text-ink" data-files="browse">BROWSE</button>
          <button class="flex h-[24px] items-center border border-ink bg-paper px-2 text-[11px] text-ink" data-files="up">UP</button>
          <button class="flex h-[24px] items-center border border-ink bg-paper px-2 text-[11px] text-ink" data-files="refresh">REFRESH</button>
        </div>
        ${req.volume === 'DH0:' ? `<div class="flex items-stretch gap-2">
          <input id="files-search" class="h-[24px] min-w-0 flex-1 border border-ink bg-paper px-2 text-[11px] text-ink outline-none" value="${escapeHtml(req.modlandQuery || '')}" placeholder="Search Modland…" autocomplete="off" spellcheck="false">
          <span class="flex h-[24px] max-w-[40vw] min-w-0 items-center truncate border border-ink bg-black px-2 text-[10px] text-white">${escapeHtml(req.note || '')}</span>
        </div>` : ''}
        <div class="files-lists min-h-0 flex-1">
          <div class="req-list min-h-0" aria-label="Files">${files || '<div class="req-empty">No files</div>'}</div>
          <div class="req-list min-h-0" aria-label="Folders">${folders || `<div class="req-empty">${req.volume === 'DF0:' ? 'Work disk' : 'No folders'}</div>`}</div>
        </div>
      </div>`;
      const filesSearch = host.querySelector('#files-search');
      if (filesSearch) {
        filesSearch.oninput = () => {
          req.modlandQuery = filesSearch.value;
          req.searchModland(filesSearch.value);
        };
        if (restoreSearch) {
          filesSearch.focus();
          filesSearch.setSelectionRange(caret, caret);
        }
      }
      host.querySelectorAll('[data-files]').forEach(b => {
        b.onclick = async () => {
          const act = b.dataset.files;
          try {
            if (act === 'df0') { req._diskLoaded = true; await req.setVolume('DF0:'); }
            else if (act === 'os') await req.setVolume('OS');
            else if (act === 'dh0') { req._modlandLoaded = true; await req.setVolume('DH0:'); }
            else if (act === 'folder') await req.pickDir();
            else if (act === 'browse') req.browse();
            else if (act === 'up') await req.up();
            else if (act === 'refresh') {
              if (req.volume === 'DF0:') await req.listDisk();
              else if (req.volume === 'DH0:') await req.listModland(req.modlandPath || '');
              else await req.listDir();
            }
          } catch (e) { /* requester reports its own errors */ }
          draw();
        };
      });
      host.querySelectorAll('[data-file]').forEach(b => {
        b.onclick = async () => {
          const i = parseInt(b.dataset.file, 10);
          req.selected = i;
          const e = req.entries[i];
          if (!e) return;
          if (e.dir) { await req.enter(e); draw(); }
          else req.choose();
        };
      });
    },

    /* ---------------------------------------------------------- list */

    renderList(host) {
      const app = MW.app;
      const paths = app.paths || [];
      if (library.directory >= paths.length) { library.directory = -1; library.entries = []; library.selected = -1; }
      const path = library.directory < 0 ? 'SONG INSTRUMENTS' : paths[library.directory].name;
      const sounds = library.directory < 0
        ? app.song.instruments.map((inst, i) => inst ? `<button type="button" class="library-item${i + 1 === app.currentIns ? ' active' : ''}" data-ins="${i + 1}">${MW.insName(i + 1)} ${escapeHtml(inst.name || 'unnamed')}</button>` : '').join('')
        : library.entries.map((entry, i) => `<button type="button" class="library-item${i === library.selected ? ' active' : ''}" data-library-file="${i}">${escapeHtml(entry.name)}</button>`).join('');
      const folders = paths.map((dir, i) => `<button type="button" class="library-item${i === library.directory ? ' active' : ''}" data-library-dir="${i}">${escapeHtml(dir.name)}</button>`).join('');
      host.innerHTML = `<div class="library-view">
        <div class="library-header">DIR: ${escapeHtml(path)} <span>${library.directory < 0 ? app.song.instruments.filter(Boolean).length : library.entries.length} SOUNDS</span></div>
        <div class="library-columns">
          <div class="library-list" aria-label="Sounds">${sounds || '<div class="library-empty">No sounds</div>'}</div>
          <div class="library-actions">
            <button data-library-action="song">SONG</button>
            <button data-library-action="add">ADD DIR</button>
            <button data-library-action="remove" ${library.directory < 0 ? 'disabled' : ''}>REM DIR</button>
            <button data-library-action="load" ${library.directory < 0 || library.selected < 0 ? 'disabled' : ''}>LOAD</button>
            <button data-library-action="save">SAVE IFF</button>
            <button data-library-action="save-inst" ${library.directory < 0 ? 'disabled' : ''}>SAVE INST</button>
            <button data-library-action="save-all" ${library.directory < 0 ? 'disabled' : ''}>SAVE ALL</button>
            <button data-library-action="delete" ${library.directory < 0 || library.selected < 0 ? 'disabled' : ''}>DELETE</button>
            <button data-library-action="browse">BROWSE</button>
          </div>
          <div class="library-list" aria-label="Directories"><button type="button" class="library-item${library.directory < 0 ? ' active' : ''}" data-library-dir="-1">SONG INSTRUMENTS</button>${folders}</div>
        </div>
      </div>`;
      const show = () => { if (this.current === 'list') this.renderList(host); };
      host.querySelectorAll('[data-ins]').forEach(button => {
        button.onclick = () => { MW.setInstrument(parseInt(button.dataset.ins, 10)); };
      });
      host.querySelectorAll('[data-library-file]').forEach(button => {
        button.onclick = () => { library.selected = parseInt(button.dataset.libraryFile, 10); show(); };
      });
      host.querySelectorAll('[data-library-dir]').forEach(button => {
        button.onclick = async () => {
          const index = parseInt(button.dataset.libraryDir, 10);
          library.directory = index; library.selected = -1; library.entries = [];
          if (index >= 0) {
            const dir = paths[index];
            try {
              /* after a reload the handle is usually 'prompt'; ask while the
                 click still counts as a user gesture */
              if (dir && dir.queryPermission && dir.requestPermission) {
                const state = await dir.queryPermission({ mode: 'readwrite' });
                if (state !== 'granted') {
                  const granted = await dir.requestPermission({ mode: 'readwrite' });
                  if (granted !== 'granted') throw new Error('permission');
                }
              }
              library.entries = await MW.listLibraryEntries(dir);
            } catch (e) { MW.toast('Click the folder again to grant access', true); }
          }
          show();
        };
      });
      host.querySelectorAll('[data-library-action]').forEach(button => {
        button.onclick = async () => {
          const action = button.dataset.libraryAction;
          if (action === 'song') { library.directory = -1; library.entries = []; library.selected = -1; show(); }
          else if (action === 'add') {
            if (!window.showDirectoryPicker) return MW.toast('This browser cannot list folders', true);
            try {
              const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
              paths.push(dir);
              if (MW.libraryPaths) await MW.libraryPaths.add(dir);
              library.directory = paths.length - 1; library.selected = -1;
              library.entries = await MW.listLibraryEntries(dir); show();
            } catch (e) { if (e && e.name !== 'AbortError') MW.toast('Could not read folder', true); }
          } else if (action === 'remove') {
            const index = library.directory;
            paths.splice(index, 1);
            if (MW.libraryPaths) await MW.libraryPaths.remove(index);
            library.directory = -1; library.entries = []; library.selected = -1; show();
          }
          else if (action === 'load') {
            const entry = library.entries[library.selected];
            if (!entry) return;
            try {
              const file = await entry.handle.getFile();
              const inst = MW.loadInstrument(await file.arrayBuffer());
              if (!inst) return MW.toast('Could not read that instrument', true);
              inst.name = inst.name || file.name.replace(/\.[^.]+$/, '');
              app.song.instruments[app.currentIns - 1] = inst;
              MW.touchStatus('instrument', ['song', 'currentIns']);
              MW.toast('Loaded ' + file.name + ' into ' + MW.insName(app.currentIns));
            } catch (e) { MW.toast('Could not read that instrument', true); }
          } else if (action === 'save') MW.runAction('file-save-iff');
          else if (action === 'save-inst') {
            const inst = app.song.instruments[app.currentIns - 1];
            if (!inst || !inst.data) return MW.toast('This slot has no sample to save', true);
            const name = MW.instFileName(inst, app.currentIns);
            try {
              await MW.writeInstrumentFile(paths[library.directory], name, inst);
              MW.toast('Saved ' + name);
            } catch (e) { MW.toast('Could not save that instrument', true); }
          } else if (action === 'save-all') {
            try {
              const r = await MW.saveAllInstruments(paths[library.directory], app.song);
              if (!r.saved && !r.failed) MW.toast('No samples to save');
              else MW.toast(`Saved ${r.saved} instrument${r.saved === 1 ? '' : 's'}` + (r.failed ? `, ${r.failed} failed` : ''));
            } catch (e) { MW.toast('Could not save the instruments', true); }
          } else if (action === 'delete') {
            const entry = library.entries[library.selected];
            if (!entry) return;
            const ok = await MW.removeLibraryFile(paths[library.directory], entry.name);
            if (!ok) {
              /* the entry may already be gone: re-list so the row disappears */
              try { library.entries = await MW.listLibraryEntries(paths[library.directory]); } catch (e) { /* keep */ }
              library.selected = -1;
              show();
              return MW.toast('Could not delete ' + entry.name, true);
            }
            library.entries.splice(library.selected, 1);
            library.selected = -1;
            show();
            MW.toast('Deleted ' + entry.name);
          } else if (action === 'browse') MW.runAction('ins-open');
        };
      });
    },

    /* ---------------------------------------------------------- sample */

    view(inst) {
      const len = inst && inst.data ? inst.data.length : 1;
      const v = inst && inst._view;
      if (!v || v.a < 0 || v.b > len || v.b - v.a < 1) return { a: 0, b: len };
      return v;
    },

    renderSample(host) {
      const app = MW.app;
      const inst = this.inst();
      if (!inst || !inst.data || !inst.data.length) {
        const canCreate = !inst || (inst.type === 'sample' && !inst.synth);
        host.innerHTML = `<div class="empty">No sample in slot ${MW.insName(app.currentIns)}.<br>Load a raw sample or an IFF 8SVX from the Instr panel.${canCreate ? '<div class="sample-create"><label>BUFFSIZE: <input id="sample-create-size" class="sample-field" type="number" min="1" max="131072" value="1024" aria-label="New sample buffer size"></label><button type="button" class="sample-btn" data-create-sample>CREATE</button></div>' : ''}</div>`;
        if (canCreate) host.querySelector('[data-create-sample]').onclick = () => {
          const size = Number(host.querySelector('#sample-create-size').value);
          if (!MW.sampleCreateBuffer(app, size)) return MW.toast('Enter a buffer size from 1 to 131072', true);
          MW.touchStatus('instrument', ['song', 'currentIns']);
          this.show('sample');
        };
        return;
      }
      const d = inst.data;
      const view = this.view(inst);
      const sel = inst._sel && inst._sel.b <= d.length ? inst._sel : null;
      const periodClock = 8363 * 428;
      const pitch = Math.max(1, Math.round(periodClock / (inst.c2rate || 8363)));
      const dest = inst._sampleDestPeriod || pitch;
      const periodNote = period => MW.noteName(MW.clamp(Math.round(13 + 12 * Math.log2(428 / period)), 1, 120), app.hb);

      const btn = (label, action, extra = '') => `<button type="button" class="sample-btn" data-act="${action}" ${extra}>${label}</button>`;
      const field = (id, value, title) => `<input class="sample-field" id="${id}" type="number" min="0" value="${value}" aria-label="${title}">`;
      const start = sel ? Math.min(sel.a, sel.b) : 0;
      const end = sel ? Math.max(sel.a, sel.b) : d.length;
      host.innerHTML = `<div class="sample-editor">
        <div class="wave-wrap sample-wave"><canvas id="wave" aria-label="Sample waveform"></canvas></div>
        <div class="sample-view-overview" role="img" aria-label="Showing samples ${view.a} to ${view.b} of ${d.length}"><span style="left:${view.a / d.length * 100}%;width:${(view.b - view.a) / d.length * 100}%"></span></div>
        <div class="sample-controls">
          <div class="sample-control-row">
            <label class="sample-number">BUFFSIZE: ${field('buffsize', d.length, 'Buffer size')}</label>
            ${btn('PLAY DISPLAY', 'samp-playdisplay')}${btn('PLAY RANGE', 'samp-playrange')}${btn('S▶CBUFF', 'samp-copyall')}${btn('MONITOR', 'samp-monitor')}${btn('RECORD', 'samp-record')}
            <label class="sample-number">PITCH: ${field('sample-pitch', pitch, 'Sample pitch period')}<button type="button" class="sample-note" data-note-period="pitch" aria-label="Set pitch with note key" title="Hold or focus and press a note key">${periodNote(pitch)}</button></label>
          </div>
          <div class="sample-control-row">
            <label class="sample-number">RNGSTART: ${field('range-start', start, 'Range start')}</label>
            ${btn('SHOW RANGE', 'samp-showrange')}${btn('SHOW ALL', 'samp-showall')}${btn('CBUFF▶S', 'samp-restore')}${btn('R▶SY', 'samp-tosynth')}${btn('DEL CB', 'samp-clearbuffer')}${btn('REV', 'samp-rev')}${btn('MIX', 'samp-mix')}<label class="sample-number">DEST: ${field('sample-dest', dest, 'Destination period')}<button type="button" class="sample-note" data-note-period="dest" aria-label="Set destination with note key" title="Hold or focus and press a note key">${periodNote(dest)}</button></label>
          </div>
          <div class="sample-control-row">
            <label class="sample-number">RNGEND: ${field('range-end', end, 'Range end')}</label>
            ${btn('ZOOM IN', 'samp-zoomin')}${btn('ZOOM OUT', 'samp-zoomout')}<button type="button" class="sample-btn ${app.sampleFreehand ? 'active' : ''}" data-act="samp-freehand">FREEHAND</button>${btn('CHG.VOL.', 'samp-volume')}<label class="sample-number">${field('vol-start', app.sampleVolStart ?? 100, 'Start volume percent')}%</label><label class="sample-number">${field('vol-end', app.sampleVolEnd ?? 100, 'End volume percent')}%</label>${btn('CHANGE RATE', 'samp-change-rate')}
          </div>
          <div class="sample-control-row">
            ${btn('CLEAR', 'samp-clear')}${btn('DEL', 'samp-delete')}${btn('RANGE ALL', 'samp-rangeall')}${btn('FILT', 'samp-filter')}${btn('BOOST', 'samp-boost')}<label class="sample-effect-number">${field('filter-avg', app.sampleFilterAvg ?? 16, 'Averaging strength 1-128')}</label><label class="sample-effect-number">${field('filter-dist', app.sampleFilterDist ?? 1, 'Distance between averaged values')}</label>${btn(inst.looplen > 2 ? 'LOOP ON' : 'LOOP OFF', 'samp-loop')}<button type="button" class="sample-btn ${(app.sampleLoopMarker || 'start') === 'start' ? 'active' : ''}" data-loop-marker="start">S</button><button type="button" class="sample-btn ${app.sampleLoopMarker === 'end' ? 'active' : ''}" data-loop-marker="end">E</button><button type="button" class="sample-btn" data-loop-move="left">◀</button><button type="button" class="sample-btn" data-loop-move="right">▶</button><button type="button" class="sample-btn" data-loop-move="zero-left">◀0</button><button type="button" class="sample-btn" data-loop-move="zero-right">0▶</button>${btn('OCT ▲', 'samp-rate-up')}${btn('OCT ▼', 'samp-rate-down')}
          </div>
          <div class="sample-control-row">
            ${btn('CUT', 'samp-cut')}${btn('COPY', 'samp-copy')}${btn('PASTE', 'samp-paste')}${btn('NOISE', 'samp-noise')}<label class="sample-effect-number">${field('noise-level', app.sampleNoiseLevel ?? 20, 'Noise level')}</label>${btn('ECHO', 'samp-echo')}<label class="sample-effect-number">RATE: ${field('echo-rate', app.sampleEchoRate ?? 400, 'Echo delay in bytes')}</label><label class="sample-effect-number">DECR: ${field('echo-decr', app.sampleEchoDecr ?? 0, 'Echo decay percent per repeat')}</label><label class="sample-effect-number">N: ${field('echo-count', app.sampleEchoCount ?? 2, 'Number of echoes')}</label>${btn('SAVE IFF', 'samp-save')}<button type="button" class="sample-btn ${app.sampleDPixels ? 'active' : ''}" data-act="samp-dpixels">D.PIXELS</button>
          </div>
          <details class="sample-extras"><summary>MORE CONTROLS</summary><div class="sample-extra-row">
            <label>INPUT <select id="samp-src"><option value="mic">Microphone</option><option value="system">System audio (share screen)</option><option value="app">This app's output</option>${(MW.sampler.devices || []).map((device, i) => `<option value="${device.deviceId}">${escapeHtml(device.label || 'input ' + (i + 1))}</option>`).join('')}</select></label>
            ${btn('FIND', 'samp-devices')}${btn('STOP', 'samp-stop')}${btn('NORMALISE', 'samp-norm')}${btn('FADE IN', 'samp-fadein')}${btn('FADE OUT', 'samp-fadeout')}${btn('CROP', 'samp-crop')}
            <label>LOOP START ${field('loop-start', inst.loop || 0, 'Loop start')}</label><label>LENGTH ${field('loop-len', inst.looplen || 0, 'Loop length')}</label>
          </div></details>
        </div>
      </div>`;

      const canvas = host.querySelector('#wave');
      const draw = () => this.drawWave(canvas, d, inst, inst._sel, view);
      draw();

      const xToSample = x => {
        const r = canvas.getBoundingClientRect();
        const t = MW.clamp((x - r.left) / r.width, 0, 1);
        return Math.round(view.a + t * (view.b - view.a));
      };
      let dragging = false;
      let lastDraw = null;
      const drawPoint = e => {
        const rect = canvas.getBoundingClientRect();
        return { x: Math.min(d.length - 1, xToSample(e.clientX)), y: MW.clamp((rect.height / 2 - (e.clientY - rect.top)) / Math.max(1, rect.height / 2 - 6), -1, 1) };
      };
      canvas.onpointerdown = e => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const position = xToSample(e.clientX);
        if (e.button === 0 && app.sampleFreehand) {
          dragging = 'draw'; lastDraw = drawPoint(e);
          MW.sampleDrawLine(d, lastDraw.x, lastDraw.y, lastDraw.x, lastDraw.y);
          inst._abuf = null; draw(); return;
        }
        if (e.button === 0 && inst.looplen > 2) {
          const tolerance = Math.max(1, (view.b - view.a) * 6 / canvas.getBoundingClientRect().width);
          const startDistance = Math.abs(position - inst.loop), endDistance = Math.abs(position - (inst.loop + inst.looplen));
          if (Math.min(startDistance, endDistance) <= tolerance) {
            dragging = startDistance <= endDistance ? 'start' : 'end';
            app.sampleLoopMarker = dragging;
            return;
          }
        }
        dragging = 'selection';
        if (e.shiftKey && inst._sel) {
          const fixed = Math.abs(position - inst._sel.a) < Math.abs(position - inst._sel.b) ? inst._sel.b : inst._sel.a;
          inst._sel = { a: fixed, b: position };
        } else inst._sel = { a: position, b: position };
        draw();
      };
      canvas.onpointermove = e => {
        if (!dragging) return;
        if (dragging === 'draw') {
          const next = drawPoint(e);
          MW.sampleDrawLine(d, lastDraw.x, lastDraw.y, next.x, next.y);
          lastDraw = next; inst._abuf = null; draw(); return;
        }
        if (dragging !== 'selection') {
          const position = xToSample(e.clientX);
          const end = inst.loop + inst.looplen;
          if (dragging === 'start') { inst.loop = MW.clamp(position, 0, end - 1); inst.looplen = end - inst.loop; }
          else inst.looplen = MW.clamp(position, inst.loop + 1, d.length) - inst.loop;
          draw(); return;
        }
        inst._sel.b = xToSample(e.clientX);
        draw();
      };
      canvas.oncontextmenu = e => e.preventDefault();
      canvas.onpointerup = () => {
        if (!dragging) return;
        if (dragging === 'draw') MW.touchStatus('instrument', ['song', 'currentIns']);
        dragging = false;
        this.show('sample');
      };

      const range = () => {
        const s = inst._sel;
        if (!s) return [0, d.length];
        const a = Math.max(0, Math.min(s.a, s.b));
        const b = Math.min(d.length, Math.max(s.a, s.b));
        return b - a > 1 ? [a, b] : [0, d.length];
      };

      host.querySelectorAll('[data-act]').forEach(btn => {
        btn.onclick = () => {
          const act = btn.dataset.act;
          if (act === 'samp-freehand') { app.sampleFreehand = !app.sampleFreehand; this.show('sample'); return; }
          if (act === 'samp-zoomin' || act === 'samp-zoomout' || act === 'samp-showall' || act === 'samp-showrange') {
            this.zoom(inst, act, range());
            return;
          }
          if (act === 'samp-playrange') { this.playRange(inst, range()); return; }
          if (act === 'samp-playdisplay') { this.playRange(inst, [view.a, view.b]); return; }
          if (act === 'samp-rangeall') { inst._sel = { a: view.a, b: view.b }; this.show('sample'); return; }
          if (act === 'samp-clearbuffer') { MW.sampleClip.data = null; MW.toast('Buffer cleared'); return; }
          if (act === 'samp-save') { MW.runAction('file-save-iff'); return; }
          if (act === 'samp-monitor' || act === 'samp-record' || act === 'samp-stop' || act === 'samp-devices') {
            MW.runAction(act);
            return;
          }
          if (act === 'samp-buffsize') {
            const el = document.getElementById('buffsize');
            const size = parseInt(el && el.value, 10) || d.length;
            MW.ops.sampleEdit('samp-buffsize', inst, 0, d.length, { size });
            this.show('sample');
            return;
          }
          if (act === 'samp-dpixels') { app.sampleDPixels = !app.sampleDPixels; this.show('sample'); return; }
          let [a, b] = range();
          const ranged = !!(inst._sel && Math.abs(inst._sel.a - inst._sel.b) > 1);
          if ((act === 'samp-paste' || (act === 'samp-mix' && !ranged)) && inst._sel) a = Math.min(inst._sel.a, inst._sel.b);
          app.sampleVolStart = Number(host.querySelector('#vol-start').value);
          app.sampleVolEnd = Number(host.querySelector('#vol-end').value);
          app.sampleNoiseLevel = MW.clamp(Number(host.querySelector('#noise-level').value) || 0, 0, 127);
          app.sampleFilterAvg = MW.clamp(Math.round(Number(host.querySelector('#filter-avg').value) || 16), 1, 128);
          app.sampleFilterDist = MW.clamp(Math.round(Number(host.querySelector('#filter-dist').value) || 1), 1, 128);
          app.sampleEchoRate = Math.max(1, Math.round(Number(host.querySelector('#echo-rate').value) || 1));
          app.sampleEchoDecr = MW.clamp(Math.round(Number(host.querySelector('#echo-decr').value) || 0), 0, 100);
          app.sampleEchoCount = MW.clamp(Math.round(Number(host.querySelector('#echo-count').value) || 1), 1, 16);
          const result = MW.ops.sampleEdit(act, inst, a, b, { delay: app.sampleEchoRate, decr: app.sampleEchoDecr, count: app.sampleEchoCount, level: app.sampleNoiseLevel, ranged, startVolume: app.sampleVolStart, endVolume: app.sampleVolEnd, avg: app.sampleFilterAvg, dist: app.sampleFilterDist, sourcePeriod: Number(host.querySelector('#sample-pitch').value), destPeriod: Number(host.querySelector('#sample-dest').value) });
          if (result !== false) this.show('sample');
        };
      });

      const setRange = () => {
        const a = MW.clamp(parseInt(host.querySelector('#range-start').value, 10) || 0, 0, d.length);
        const b = MW.clamp(parseInt(host.querySelector('#range-end').value, 10) || 0, 0, d.length);
        inst._sel = { a, b };
        draw();
      };
      host.querySelector('#range-start').oninput = setRange;
      host.querySelector('#range-end').oninput = setRange;
      host.querySelector('#buffsize').onchange = e => {
        MW.ops.sampleEdit('samp-buffsize', inst, 0, d.length, { size: parseInt(e.target.value, 10) || d.length });
        this.show('sample');
      };
      host.querySelector('#sample-pitch').onchange = e => {
        const value = Number(e.target.value);
        if (Number.isFinite(value) && value >= 1) { inst.c2rate = Math.round(periodClock / value); inst._abuf = null; e.target.parentElement.querySelector('.sample-note').textContent = periodNote(value); }
      };
      host.querySelector('#sample-dest').onchange = e => {
        const value = Number(e.target.value);
        if (Number.isFinite(value) && value >= 1) { inst._sampleDestPeriod = Math.round(value); e.target.parentElement.querySelector('.sample-note').textContent = periodNote(value); }
      };
      host.querySelectorAll('[data-note-period]').forEach(button => {
        button.onpointerdown = e => { e.preventDefault(); button.focus(); };
        button.onkeydown = e => {
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          const note = MW.noteFromPianoKey(e.key, app.octave);
          if (note == null) return;
          e.preventDefault(); e.stopPropagation();
          const target = button.dataset.notePeriod;
          const period = MW.sampleSetNotePeriod(inst, target, note);
          host.querySelector('#sample-' + target).value = period;
          button.textContent = MW.noteName(note, app.hb);
          if (target === 'pitch') MW.touchStatus('instrument', ['song', 'currentIns']);
        };
      });
      host.querySelectorAll('[data-loop-marker]').forEach(button => {
        button.onclick = () => { app.sampleLoopMarker = button.dataset.loopMarker; this.show('sample'); };
      });
      host.querySelectorAll('[data-loop-move]').forEach(button => {
        button.onclick = () => { MW.sampleMoveLoop(inst, app.sampleLoopMarker || 'start', button.dataset.loopMove); MW.touchStatus('instrument', ['song', 'currentIns']); this.show('sample'); };
      });
      host.querySelector('#loop-start').onchange = e => {
        inst.loop = Math.max(0, parseInt(e.target.value, 10) || 0);
        draw();
      };
      host.querySelector('#loop-len').onchange = e => {
        inst.looplen = Math.max(0, parseInt(e.target.value, 10) || 0);
        draw();
      };
    },

    zoom(inst, act, range) {
      const len = inst.data.length;
      const v = this.view(inst);
      let a = v.a, b = v.b;
      const span = b - a;
      if (act === 'samp-showall') { a = 0; b = len; }
      else if (act === 'samp-showrange') {
        const [ra, rb] = range;
        if (rb - ra > 1) { a = ra; b = rb; }
      } else {
        const centre = inst._sel
          ? Math.round((Math.min(inst._sel.a, inst._sel.b) + Math.max(inst._sel.a, inst._sel.b)) / 2)
          : Math.round((a + b) / 2);
        const half = act === 'samp-zoomin' ? Math.max(16, Math.round(span / 4)) : Math.round(span);
        a = centre - half;
        b = centre + half;
      }
      a = MW.clamp(a, 0, len - 2);
      b = MW.clamp(b, a + 2, len);
      inst._view = { a, b };
      this.show('sample');
    },

    scrollSample(direction) {
      const inst = this.inst();
      if (!inst || !inst.data || !inst.data.length) return;
      inst._view = MW.sampleScrollView(this.view(inst), inst.data.length, direction);
      this.show('sample');
    },

    playRange(inst, range) {
      const [a, b] = range;
      if (!inst.data || b <= a) return;
      const ctx = MW.audio.init();
      if (!ctx) return;
      MW.audio.unlock();
      const channels = inst.dataR ? 2 : 1;
      const buffer = ctx.createBuffer(channels, b - a, ctx.sampleRate);
      buffer.copyToChannel(inst.data.slice(a, b), 0);
      if (channels === 2) buffer.copyToChannel(inst.dataR.slice(a, b), 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = (inst.c2rate || 8363) / ctx.sampleRate;
      source.connect(ctx.destination);
      source.start();
    },

    drawWave(canvas, data, inst, sel, view) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 190;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      const va = view.a, vb = view.b, span = Math.max(2, vb - va);
      const toX = i => ((i - va) / span) * w;

      if (sel) {
        const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        const x0 = Math.max(0, toX(a)), x1 = Math.min(w, toX(b));
        ctx.fillRect(x0, 0, Math.max(0, x1 - x0), h);
      }

      const mid = h / 2;
      ctx.strokeStyle = '#1e1e1e';
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

      if (inst.looplen > 2) {
        const x0 = toX(inst.loop), x1 = toX(inst.loop + inst.looplen);
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fillRect(x0, 0, x1 - x0, h);
        ctx.strokeStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(x0, 0); ctx.lineTo(x0, h);
        ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      if (span <= w && !MW.app.sampleDPixels) {
        ctx.beginPath();
        for (let i = va; i < vb; i++) {
          const x = toX(i);
          const y = mid - data[i] * (mid - 6);
          i === va ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const s0 = Math.floor(va + (x / w) * span);
          const s1 = Math.min(data.length, Math.floor(va + ((x + 1) / w) * span));
          let min = 0, max = 0;
          for (let i = s0; i < s1; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          ctx.moveTo(x + 0.5, mid - max * (mid - 6));
          ctx.lineTo(x + 0.5, mid - min * (mid - 6));
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#5d564d';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`${va} — ${vb}  (${span} samples)`, 8, 14);
    },

    /* ---------------------------------------------------------- synth */

    renderSynth(host) {
      const app = MW.app;
      const inst = this.inst();
      if (!inst || !inst.synth) {
        host.innerHTML = `<div class="empty">Slot ${MW.insName(app.currentIns)} is not a synthsound.<br>Create one from the Instr panel.</div>`;
        return;
      }
      const syn = inst.synth;
      if (!syn.buffer) syn.buffer = new Float32Array(32);
      const wfIdx = MW.clamp(app.synthWave || 0, 0, syn.waveforms.length - 1);
      const wave = syn.waveforms[wfIdx] || new Float32Array(32);
      const side = app.synthSide || 'bank';
      const selectedWave = synthTarget(syn, side, wfIdx);
      if (app.synthRange && (app.synthRange.instrument !== app.currentIns || app.synthRange.wave !== wfIdx)) app.synthRange = null;
      if (app.synthCursor && (app.synthCursor.instrument !== app.currentIns || app.synthCursor.wave !== wfIdx)) app.synthCursor = null;
      const range = app.synthRange && app.synthRange.side === side ? app.synthRange : null;
      const cursor = app.synthCursor && app.synthCursor.side === side ? Math.min(selectedWave.length - 1, app.synthCursor.position) : 0;

      const sequenceLength = (list, tbl) => { const end = MW.synthSequenceEnd(list, tbl); return end < 0 ? tbl.length : end + 1; };
      const rowsFor = (tbl, names, list) => { const kinds = MW.synthSequenceKinds(list, tbl); return tbl.slice(0, sequenceLength(list, tbl)).map((b, i) => {
        const isCmd = kinds[i] === 'command';
        const name = isCmd ? names[b] : '';
        const cur = (app.synthSel && app.synthSel.list === list && app.synthSel.index === i) ? ' cur' : '';
        const field = cur && app.synthSel ? app.synthSel.field ?? 1 : -1;
        const digits = MW.hex(b);
        return `<div class="syn-row${cur}" data-list="${list}" data-idx="${i}" role="button" tabindex="0" aria-label="${list === 'vol' ? 'Volume' : 'Waveform'} step ${i}: ${isCmd ? name : MW.hex(b)}">
          <span class="seq-ix">${MW.hex(i)}</span>
          <span class="seq-op${field === 0 ? ' keyfocus' : ''}" data-field="0">${isCmd ? name : ''}</span>
          <span class="seq-arg"><span data-field="1" class="${field === 1 ? 'keyfocus' : ''}">${isCmd ? '' : digits[0]}</span><span data-field="2" class="${field === 2 ? 'keyfocus' : ''}">${isCmd ? '' : digits[1]}</span></span></div>`;
      }).join(''); };

      const btn = (label, act, disabled = false) => `<button type="button" class="synth-btn" data-act="${act}" ${disabled ? 'disabled title="Not yet implemented"' : ''}>${label}</button>`;
      host.innerHTML = `<div class="synth-editor">
        <div class="synth-workspace">
          <div class="synth-wave ${side === 'bank' ? 'active' : ''}" data-side="bank"><canvas id="wave-bank" aria-label="Waveform"></canvas></div>
          <div class="synth-center">
            <div class="synth-row">${btn('◀ COPY','syn-copy-left')}${btn('COPY ▶','syn-copy-right')}</div>
            ${btn('◀ EXCHANGE ▶','syn-exchange')}
            <div class="synth-row">${btn('◀ MIX','syn-mix')}${btn('◀ ADD','syn-addwave')}</div>
            <div class="synth-row"><button type="button" class="synth-btn ${side === 'bank' ? 'active' : ''}" data-side="bank">◀ EDIT</button><button type="button" class="synth-btn ${side === 'buffer' ? 'active' : ''}" data-side="buffer">EDIT ▶</button></div>
            ${btn('UNDO','syn-undo')}${btn('RANGE ALL','syn-range-all')}
            <div class="synth-row"><button type="button" class="synth-btn ${app.synthDrawMode !== 'line' ? 'active' : ''}" data-draw="pixel">PIXEL</button><button type="button" class="synth-btn ${app.synthDrawMode === 'line' ? 'active' : ''}" data-draw="line">LINE</button><button type="button" class="synth-btn ${app.synthDrawMix ? 'active' : ''}" data-act="syn-draw-mix">MIX</button></div>
          </div>
          <div class="synth-wave ${side === 'buffer' ? 'active' : ''}" data-side="buffer"><canvas id="wave-buffer" aria-label="Waveform buffer"></canvas></div>
        </div>
        <div class="synth-lower">
          <div class="synth-tools">
            <div class="synth-row"><span>WF: ${MW.hex(wfIdx)} / ${MW.hex(syn.waveforms.length - 1)}</span>${btn('−','syn-prev')}${btn('+','syn-next')}<span>LEN:</span><input class="synth-number" type="number" min="2" max="128" step="2" value="${wave.length}" data-act="syn-length"></div>
            <div class="synth-row"><span>ADD:</span>${btn('HERE','syn-add')}${btn('LAST','syn-add-last')}<span>DEL:</span>${btn('HERE','syn-del')}${btn('LAST','syn-del-last')}${btn('PLAY','syn-play')}</div>
            <div class="synth-row"><span>RNG:</span>${btn('CUT','syn-range-cut')}${btn('COPY','syn-range-copy')}${btn('PASTE','syn-range-paste')}${btn('CLR','syn-range-clear')}${btn('DBL','syn-range-double')}${btn('REV','syn-range-reverse')}${btn('‹','syn-range-left')}${btn('›','syn-range-right')}</div>
            <div class="synth-row"><span>STRETCH:</span><input class="synth-number" type="number" min="-64" max="64" value="0" data-act="syn-stretch" title="Move the cursor point this many samples; negative stretches left"><button type="button" class="synth-btn" data-stretch="-1" aria-label="Stretch left">−</button><button type="button" class="synth-btn" data-stretch="1" aria-label="Stretch right">+</button></div>
            <div class="synth-row"><span>TRANSFORM:</span>${btn('START','syn-tstart')}${btn('DO','syn-tdo')}<span>SPEED VOL</span><input class="synth-number" type="number" min="1" max="16" value="${syn.volspeed}" data-act="syn-vspd"><span>WF</span><input class="synth-number" type="number" min="1" max="16" value="${syn.wfspeed}" data-act="syn-wspd"></div>
            <div class="synth-row"><span>CURSOR:</span><button type="button" class="synth-btn" data-cursor="start">‹</button><button type="button" class="synth-btn" data-cursor="middle">+</button><button type="button" class="synth-btn" data-cursor="end">›</button><span>VOL%:</span><input class="synth-number" type="number" value="100" min="0" max="800" data-act="syn-range-volume" title="Change selected range volume">${['sine','saw','pulse','triangle','random'].map(s => `<button type="button" class="synth-btn" data-shape="${s}">${s.toUpperCase()}</button>`).join('')}<span>CLR:</span>${btn('WF','syn-clear')}${btn('ALL','syn-clear-all')}</div>
          </div>
          <div class="synth-program-area">
          <div class="synth-programs">
            <div class="synth-program"><span>VOLUME</span><div class="synth-sequence">${rowsFor(syn.voltbl, MW.synthNames.vol, 'vol')}</div></div>
            <div class="synth-program"><span>WAVEFORM</span><div class="synth-sequence">${rowsFor(syn.wftbl, MW.synthNames.wf, 'wf')}</div></div>
            <div class="synth-program-actions"><span>STEP ${MW.hex((app.synthSel && app.synthSel.index) || 0)}</span><button class="synth-btn" data-seq="dec">−</button><button class="synth-btn" data-seq="inc">+</button><button class="synth-btn" data-seq="ins">INS</button><button class="synth-btn" data-seq="del">DEL</button></div>
          </div>
          <div class="synth-range-bounds"><span>START</span><input class="synth-number" type="number" min="0" max="${selectedWave.length - 1}" value="${range ? range.start : cursor}" data-range="start" aria-label="Range start"><button type="button" class="synth-btn" data-boundary="start" data-delta="-1" aria-label="Decrease range start">−</button><button type="button" class="synth-btn" data-boundary="start" data-delta="1" aria-label="Increase range start">+</button><span>END</span><input class="synth-number" type="number" min="0" max="${selectedWave.length}" value="${range ? range.end : cursor}" data-range="end" aria-label="Range end"><button type="button" class="synth-btn" data-boundary="end" data-delta="-1" aria-label="Decrease range end">−</button><button type="button" class="synth-btn" data-boundary="end" data-delta="1" aria-label="Increase range end">+</button></div>
          </div>
        </div>
      </div>`;

      host.querySelectorAll('[data-act="missing"]').forEach(b => {
        b.onclick = () => MW.missing('Synth range editing');
      });

      this.drawSynthWave(host.querySelector('#wave-bank'), wave);
      this.drawSynthWave(host.querySelector('#wave-buffer'), syn.buffer);

      host.querySelectorAll('[data-side]').forEach(el => {
        el.onclick = e => {
          if (e.target.closest('[data-act]')) return;
          app.synthSide = el.dataset.side;
          this.show('synth');
        };
      });

      const mark = () => { inst._synthKey = null; };

      host.querySelectorAll('[data-draw]').forEach(button => { button.onclick = () => { app.synthDrawMode = button.dataset.draw; this.show('synth'); }; });
      host.querySelector('[data-act="syn-draw-mix"]').onclick = () => { app.synthDrawMix = !app.synthDrawMix; this.show('synth'); };
      host.querySelector('[data-act="syn-range-all"]').onclick = () => { app.synthRange = { side, start: 0, end: selectedWave.length, instrument: app.currentIns, wave: wfIdx }; this.show('synth'); };
      host.querySelectorAll('[data-cursor]').forEach(button => { button.onclick = () => {
        const pos = button.dataset.cursor === 'start' ? 0 : button.dataset.cursor === 'end' ? selectedWave.length - 1 : Math.floor(selectedWave.length / 2);
        MW.synthSetSelection(app, side, app.currentIns, wfIdx, pos, pos); this.show('synth');
      }; });
      host.querySelectorAll('[data-range]').forEach(input => { input.onchange = () => {
        const start = MW.clamp(Number(host.querySelector('[data-range="start"]').value) || 0, 0, selectedWave.length - 1);
        const end = MW.clamp(Number(host.querySelector('[data-range="end"]').value) || 0, 0, selectedWave.length);
        app.synthRange = end > start ? { side, instrument: app.currentIns, wave: wfIdx, start, end } : null;
        app.synthCursor = { side, instrument: app.currentIns, wave: wfIdx, position: start };
        this.show('synth');
      }; });
      host.querySelectorAll('[data-boundary]').forEach(button => { button.onclick = () => {
        if (!range) return MW.toast('Select a waveform range first', true);
        app.synthRange = MW.synthAdjustRange(range, button.dataset.boundary, Number(button.dataset.delta), selectedWave.length);
        this.show('synth');
      }; });
      host.querySelector('[data-act="syn-range-cut"]').onclick = () => {
        if (!range) return MW.toast('Select a waveform range first', true);
        if (!MW.synthCutRange(syn, side, wfIdx, range.start, range.end)) return MW.toast('Select the left waveform to cut', true);
        mark(); this.show('synth');
      };
      host.querySelector('[data-act="syn-range-copy"]').onclick = () => {
        if (!range) return MW.toast('Select a waveform range first', true);
        MW.synthCopyRange(syn, side, wfIdx, range.start, range.end);
        this.show('synth');
      };
      host.querySelector('[data-act="syn-range-paste"]').onclick = () => {
        if (side !== 'bank') return MW.toast('Select the left waveform to paste', true);
        if (!MW.synthPasteRange(syn, wfIdx, cursor)) return MW.toast('Nothing to paste', true);
        mark(); this.show('synth');
      };
      for (const operation of ['clear', 'double', 'reverse', 'left', 'right']) {
        host.querySelector(`[data-act="syn-range-${operation}"]`).onclick = () => {
          if (!range) return MW.toast('Select a waveform range first', true);
          MW.synthEditRange(syn, side, wfIdx, range.start, range.end, operation);
          mark(); this.show('synth');
        };
      }
      host.querySelector('[data-act="syn-range-volume"]').onchange = e => {
        const amount = Number(e.currentTarget.value);
        if (!range) return MW.toast('Select a waveform range first', true);
        if (Number.isFinite(amount) && amount >= 0) MW.synthEditRange(syn, side, wfIdx, range.start, range.end, 'volume', amount);
        mark(); this.show('synth');
      };
      const stretch = host.querySelector('[data-act="syn-stretch"]');
      if (stretch) {
        host.querySelectorAll('[data-stretch]').forEach(b => {
          b.onclick = () => {
            stretch.value = String((Number(stretch.value) || 0) + Number(b.dataset.stretch));
          };
        });
        stretch.onchange = () => {
          if (!MW.synthStretch(syn, side, wfIdx, cursor, Number(stretch.value) || 0)) return;
          mark(); this.show('synth');
        };
      }
      host.querySelector('[data-act="syn-clear"]').onclick = () => {
        MW.synthClearWave(syn, side, wfIdx);
        mark(); this.show('synth');
      };
      host.querySelector('[data-act="syn-clear-all"]').onclick = () => {
        MW.synthClearAll(syn);
        app.synthRange = null;
        mark(); this.show('synth');
      };
      host.querySelector('[data-act="syn-length"]').onchange = e => {
        let length = Math.max(2, Math.min(128, Number(e.currentTarget.value) || 2));
        length = Math.round(length / 2) * 2;
        synthSaveUndo(syn, 'bank', wfIdx);
        const resized = new Float32Array(length);
        resized.set(wave.subarray(0, length));
        syn.waveforms[wfIdx] = resized;
        app.synthRange = null; mark(); this.show('synth');
      };

      host.querySelectorAll('.synth-wave canvas').forEach(canvas => {
        let gesture = null;
        const canvasSide = canvas.parentElement.dataset.side;
        const point = e => {
          const rect = canvas.getBoundingClientRect();
          const data = synthTarget(syn, canvasSide, wfIdx);
          return { x: Math.max(0, Math.min(data.length - 1, Math.round((e.clientX - rect.left) / rect.width * (data.length - 1)))),
            y: Math.max(-1, Math.min(1, (rect.height / 2 - (e.clientY - rect.top)) / (rect.height / 2 - 8))) };
        };
        canvas.oncontextmenu = e => e.preventDefault();
        canvas.onpointerdown = e => {
          if (e.button !== 0 && e.button !== 2) return;
          e.preventDefault(); e.stopPropagation();
          app.synthSide = canvasSide;
          const p = point(e);
          gesture = { button: e.button, start: p, last: p, original: Float32Array.from(synthTarget(syn, canvasSide, wfIdx)) };
          canvas.setPointerCapture(e.pointerId);
          if (e.button === 0) { MW.synthDraw(syn, canvasSide, wfIdx, p.x, p.y, p.x, p.y, true, app.synthDrawMix && gesture.original); mark(); this.drawSynthWave(canvas, synthTarget(syn, canvasSide, wfIdx)); }
        };
        canvas.onpointermove = e => {
          if (!gesture) return;
          const p = point(e);
          if (gesture.button === 0) {
            if (app.synthDrawMode === 'line') synthTarget(syn, canvasSide, wfIdx).set(gesture.original);
            const from = app.synthDrawMode === 'line' ? gesture.start : gesture.last;
            MW.synthDraw(syn, canvasSide, wfIdx, from.x, from.y, p.x, p.y, false, app.synthDrawMix && gesture.original);
            mark(); this.drawSynthWave(canvas, synthTarget(syn, canvasSide, wfIdx));
          }
          gesture.last = p;
        };
        canvas.onpointerup = e => {
          if (!gesture) return;
          if (gesture.button === 2) { const p = point(e); MW.synthSetSelection(app, canvasSide, app.currentIns, wfIdx, gesture.start.x, p.x); }
          gesture = null; this.show('synth');
        };
      });

      host.querySelector('[data-act="syn-prev"]').onclick = () => {
        app.synthWave = (wfIdx - 1 + syn.waveforms.length) % syn.waveforms.length;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-next"]').onclick = () => {
        app.synthWave = (wfIdx + 1) % syn.waveforms.length;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-play"]').onclick = () => MW.voicePreview(25, app.currentIns);
      host.querySelector('[data-act="syn-add"]').onclick = () => {
        const index = MW.synthInsertWave(syn, wfIdx, false);
        if (index < 0) return MW.toast('64 waveforms is the limit', true);
        mark();
        app.synthWave = index;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-add-last"]').onclick = () => {
        if (MW.synthInsertWave(syn, wfIdx, true) < 0) return MW.toast('64 waveforms is the limit', true);
        mark(); this.show('synth');
      };
      host.querySelector('[data-act="syn-del"]').onclick = () => {
        if (syn.waveforms.length <= 1) return MW.toast('Keep at least one waveform', true);
        syn._undo = { waves: syn.waveforms.map(w => Float32Array.from(w)) };
        syn.waveforms.splice(wfIdx, 1);
        mark();
        app.synthWave = Math.max(0, wfIdx - 1);
        this.show('synth');
      };
      host.querySelector('[data-act="syn-del-last"]').onclick = () => {
        if (syn.waveforms.length <= 1) return MW.toast('Keep at least one waveform', true);
        syn._undo = { waves: syn.waveforms.map(w => Float32Array.from(w)) };
        syn.waveforms.pop(); app.synthWave = Math.min(wfIdx, syn.waveforms.length - 1);
        mark(); this.show('synth');
      };

      const target = () => (app.synthSide === 'buffer' ? syn.buffer : syn.waveforms[wfIdx]);

      host.querySelectorAll('[data-shape]').forEach(b => {
        b.onclick = () => {
          const cur = target();
          const next = shape(b.dataset.shape, cur ? cur.length : 32);
          synthSaveUndo(syn, side, wfIdx);
          if (app.synthSide === 'buffer') syn.buffer = next;
          else syn.waveforms[wfIdx] = next;
          mark();
          this.show('synth');
        };
      });

      host.querySelector('[data-act="syn-undo"]').onclick = () => {
        if (!MW.synthUndo(syn)) return MW.toast('Nothing to undo', true);
        app.synthWave = Math.min(app.synthWave || 0, syn.waveforms.length - 1);
        mark();
        this.show('synth');
      };

      host.querySelector('[data-act="syn-copy-right"]').onclick = () => {
        synthSaveUndo(syn, 'buffer', wfIdx);
        syn.buffer = Float32Array.from(wave);
        this.show('synth');
      };
      host.querySelector('[data-act="syn-copy-left"]').onclick = () => {
        synthSaveUndo(syn, 'bank', wfIdx);
        syn.waveforms[wfIdx] = Float32Array.from(syn.buffer);
        mark();
        this.show('synth');
      };
      host.querySelector('[data-act="syn-exchange"]').onclick = () => {
        syn._undo = { waves: syn.waveforms.map(w => Float32Array.from(w)), buffer: Float32Array.from(syn.buffer) };
        const tmp = Float32Array.from(syn.waveforms[wfIdx]);
        syn.waveforms[wfIdx] = Float32Array.from(syn.buffer);
        syn.buffer = tmp;
        mark();
        this.show('synth');
      };
      host.querySelector('[data-act="syn-mix"]').onclick = () => {
        synthSaveUndo(syn, 'buffer', wfIdx);
        const n = Math.min(wave.length, syn.buffer.length);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = (wave[i] + syn.buffer[i]) / 2;
        syn.buffer = out;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-addwave"]').onclick = () => {
        synthSaveUndo(syn, 'buffer', wfIdx);
        const n = Math.min(wave.length, syn.buffer.length);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = MW.clamp(wave[i] + syn.buffer[i], -1, 1);
        syn.buffer = out;
        this.show('synth');
      };

      host.querySelector('[data-act="syn-tstart"]').onclick = () => {
        app.synthTransform = wfIdx;
        MW.toast('Transform starts at waveform ' + MW.hex(wfIdx));
        this.show('synth');
      };
      host.querySelector('[data-act="syn-tdo"]').onclick = () => {
        const a = app.synthTransform;
        if (a == null) return MW.toast('Set a start waveform first', true);
        const b = wfIdx;
        if (a === b) return MW.toast('Start and end are the same', true);
        const first = syn.waveforms[a], last = syn.waveforms[b];
        const n = Math.min(first.length, last.length);
        const steps = Math.abs(b - a);
        for (let k = 1; k < steps; k++) {
          const t = k / steps;
          const idx = a < b ? a + k : a - k;
          const out = new Float32Array(n);
          for (let i = 0; i < n; i++) out[i] = first[i] * (1 - t) + last[i] * t;
          syn.waveforms[idx] = out;
        }
        mark();
        MW.toast('Morphed ' + steps + ' waveforms');
        this.show('synth');
      };

      const vspd = host.querySelector('[data-act="syn-vspd"]');
      if (vspd) vspd.onchange = () => { syn.volspeed = MW.clamp(parseInt(vspd.value, 10) || 1, 1, 16); mark(); };
      const wspd = host.querySelector('[data-act="syn-wspd"]');
      if (wspd) wspd.onchange = () => { syn.wfspeed = MW.clamp(parseInt(wspd.value, 10) || 1, 1, 16); mark(); };

      const refreshSequence = focus => {
        this.show('synth');
        if (focus && app.synthSel) host.querySelector(`.syn-row[data-list="${app.synthSel.list}"][data-idx="${app.synthSel.index}"]`)?.focus();
      };
      const editSequence = (action, focus = false) => {
        const s = app.synthSel || (app.synthSel = { list: 'vol', index: 0, field: 1 });
        const tbl = s.list === 'vol' ? syn.voltbl : syn.wftbl;
        const at = Math.min(s.index, tbl.length - 1);
        const terminal = at === MW.synthSequenceEnd(s.list, tbl);
        let changed = false;
        if ((action === 'inc' || action === 'dec') && !terminal) { tbl[at] = MW.clamp(tbl[at] + (action === 'inc' ? 1 : -1), 0, 255); changed = true; }
        else if (action === 'ins' || action === 'del') {
          changed = MW.editSynthSequence(syn, s.list, action === 'ins' ? 'insert' : 'delete', at);
          s.index = Math.min(at, sequenceLength(s.list, tbl) - 1);
        }
        if (changed) mark();
        refreshSequence(focus);
      };
      host.querySelectorAll('.syn-row').forEach(row => {
        row.onclick = e => {
          const part = e.target.closest('[data-field]');
          app.synthSel = { list: row.dataset.list, index: parseInt(row.dataset.idx, 10), field: part ? Number(part.dataset.field) : 1 };
          refreshSequence(true);
        };
        row.onkeydown = e => {
          e.stopPropagation();
          const s = app.synthSel || (app.synthSel = { list: row.dataset.list, index: Number(row.dataset.idx), field: 1 });
          const tbl = s.list === 'vol' ? syn.voltbl : syn.wftbl;
          if (e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); e.stopPropagation(); editSequence(e.key === 'Enter' ? 'ins' : 'del', true); return;
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') s.index = MW.clamp(s.index + (e.key === 'ArrowUp' ? -1 : 1), 0, sequenceLength(s.list, tbl) - 1);
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const dir = e.key === 'ArrowLeft' ? -1 : 1;
            s.field = (s.field ?? 1) + dir;
            if (s.field < 0 || s.field > 2) { s.list = s.list === 'vol' ? 'wf' : 'vol'; s.field = dir < 0 ? 2 : 0; s.index = Math.min(s.index, sequenceLength(s.list, s.list === 'vol' ? syn.voltbl : syn.wftbl) - 1); }
          } else {
            const terminal = s.index === MW.synthSequenceEnd(s.list, tbl);
            if (terminal) { e.preventDefault(); return; }
            const command = s.field === 0 ? MW.synthCommandKey(s.list, e.key, e.shiftKey) : null;
            if (command != null) tbl[s.index] = command;
            else if ((s.field ?? 1) > 0 && /^[0-9a-f]$/i.test(e.key)) {
              const nibble = parseInt(e.key, 16);
              tbl[s.index] = s.field === 2 ? (tbl[s.index] & 0xf0) | nibble : (tbl[s.index] & 0x0f) | (nibble << 4);
              s.field = s.field === 1 ? 2 : 1;
            } else return;
            mark();
          }
          e.preventDefault(); e.stopPropagation(); refreshSequence(true);
        };
      });

      host.querySelectorAll('[data-seq]').forEach(btn => {
        btn.onclick = () => editSequence(btn.dataset.seq);
      });
    },

    drawSynthWave(canvas, wf) {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || 170;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      const range = MW.app && MW.app.synthRange;
      if (range && canvas.parentElement && range.side === canvas.parentElement.dataset.side && wf && wf.length) {
        ctx.fillStyle = '#555555';
        ctx.fillRect(range.start / wf.length * w, 0, (range.end - range.start) / wf.length * w, h);
      }
      const cursor = MW.app && MW.app.synthCursor;
      if (!range && cursor && canvas.parentElement && cursor.side === canvas.parentElement.dataset.side && wf && wf.length) {
        ctx.fillStyle = '#aaa';
        ctx.fillRect(cursor.position / Math.max(1, wf.length - 1) * (w - 1), 0, 1, h);
      }
      // Reference editor uses a dotted measurement grid and ticks at the zero line.
      ctx.fillStyle = '#444';
      for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#999';
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, Math.floor(h / 2), 1, x % 32 === 0 ? 6 : 3);
      for (let y = 0; y < h; y += 8) {
        const tick = y % 32 === 0 ? 5 : 3;
        ctx.fillRect(0, y, tick, 1); ctx.fillRect(w - tick, y, tick, 1);
      }
      ctx.strokeStyle = '#1e1e1e';
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      if (!wf || wf.length < 2) {
        ctx.fillStyle = '#4a4642';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('empty', 8, 14);
        return;
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < wf.length; i++) {
        const x = (i / (wf.length - 1)) * (w - 2) + 1;
        const y = h / 2 - wf[i] * (h / 2 - 8);
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
      ctx.fillStyle = '#5d564d';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(wf.length + ' bytes', 8, 14);
    },

    /* ---------------------------------------------------------- notation */

    renderNotation(host) {
      const app = MW.app;
      const block = app.song.blocks[app.cursor.block];
      if (!app.notaPresetReady) MW.initNotation(app);
      app.notaInstruments = app.notaInstruments || {};
      const instrument = app.notaInstruments[app.currentIns] || (app.notaInstruments[app.currentIns] = { hide: false, transpose: 0 });
      const btn = (label, attrs, on) => `<button type="button" class="score-button${on ? ' on' : ''}" ${attrs}>${label}</button>`;
      const trackRow = (label, attr) => `<div class="score-track-row"><span>${label}</span>` + Array.from({ length: 16 }, (_, t) => btn(t.toString(16).toUpperCase(), `${attr}="${t}"`, attr === 'data-notatrack' ? !!app.notaTracks[t] : attr === 'data-ghost' ? !!app.notaGhost[t] : app.notaSelectedTrack === t)).join('') + '</div>';
      const val = (value, attrs) => `<input class="score-number" type="number" value="${value}" ${attrs}>`;
      host.innerHTML = `<div class="pane notation-pane">
        <div class="sheet-wrap"><canvas id="sheet" aria-label="Score for the current measure"></canvas></div>
        <div class="score-controls">
          <div class="score-print">
            ${btn('PRINT','data-act="nota-print"')}${btn('HEADER','data-opt="notaHeader"',app.notaHeader)}
            ${btn('NOTES','data-opt="notaPrintNotes"',app.notaPrintNotes !== false)}${btn('TEXT','data-opt="notaText"',app.notaText)}
            ${btn('→FILE','data-opt="notaFile"',app.notaFile)}${btn('FFEED','data-opt="notaFeed"',app.notaFeed)}
            <div class="score-block-range">BLKS: ${val(app.notaStart || 0,'data-number="notaStart" min="0"')} → ${val(app.notaEnd || 0,'data-number="notaEnd" min="0"')} ${btn('ALL','data-opt="notaPrintAll"',app.notaPrintAll !== false)}</div>
          </div>
          <div class="score-edit">
            <div class="score-lengths">${[[16,'𝅝'],[8,'𝅗𝅥'],[4,'♩'],[2,'♪'],[1,'𝅘𝅥𝅯'],[16,'𝄻'],[8,'𝄼'],[4,'𝄽'],[2,'𝄾']].map(([n,g],i) => btn(scoreSymbol(i), `data-len="${n}" data-rest="${i >= 5}" aria-label="${n} line ${i >= 5 ? 'rest' : 'note'}" title="${n} lines"`, app.noteLen === n && !!app.notaRest === (i >= 5))).join('')}</div>
            <div class="score-edit-row">${btn('INS','data-opt="notaInsert"',app.notaInsert)}${btn('DEL','data-opt="notaDelete"',app.notaDelete)} NT: <span data-score-note>${MW.noteName(app.notaNote || 0,app.hb)}</span> L: <span>${String(app.noteLen || 2).padStart(2,'0')}</span></div>
            <div class="score-instrument">INS: ${btn('HIDE','data-act="nota-hide"',instrument.hide)} T: ${val(instrument.transpose,'data-number="transpose" min="-24" max="24"')} ${btn('NUM','data-opt="notaNumbers"',app.notaNumbers)}</div>
          </div>
          <div class="score-tracks">${trackRow('SHOW TRACKS:', 'data-notatrack')}${trackRow('GHOST TRACKS:', 'data-ghost')}${trackRow('SEL.TRACK:', 'data-seltrack')}
            <div class="score-options">PSET: ${[0,1,2,3,4].map(n => btn(String(n+1),`data-pset="${n}"`,app.pset === n)).join('')}${btn('CLR','data-act="pset-clear"')}${btn('SAVE','data-opt="notaSave"',app.notaSave)} SIG: <span>${(app.keySig && app.keySig.count) || 0}</span>${btn('−','data-act="sig-minus"')}${btn('+','data-act="sig-plus"')}${btn('#','data-act="sig-sharp"',!(app.keySig && app.keySig.flat))}${btn('♭','data-act="sig-flat"',!!(app.keySig && app.keySig.flat))} TS: ${[3,4].map(n => btn(n+'/4',`data-time="${n}"`,(app.timeSig || 4) === n)).join('')}</div>
          </div>
        </div>
      </div>`;
      const canvas = host.querySelector('#sheet');
      this.drawSheet(canvas, block);
      const redraw = () => this.show('notation');
      host.querySelectorAll('[data-opt]').forEach(b => { b.onclick = () => { const key=b.dataset.opt; app[key] = key === 'notaPrintNotes' || key === 'notaPrintAll' ? app[key] === false : !app[key]; redraw(); }; });
      host.querySelectorAll('[data-number]').forEach(input => { input.onchange = () => { const v = Number(input.value) || 0; if (input.dataset.number === 'transpose') instrument.transpose = MW.clamp(v,-24,24); else app[input.dataset.number] = MW.clamp(v,0,app.song.blocks.length-1); redraw(); }; });
      host.querySelectorAll('[data-len]').forEach(b => { b.onclick = e => { const n=+b.dataset.len; app.noteLen = e.shiftKey ? Math.min(64,(app.noteLen || 0)+n) : n; app.notaRest = b.dataset.rest === 'true'; redraw(); }; });
      host.querySelectorAll('[data-notatrack]').forEach(b => { b.onclick = () => { const t=+b.dataset.notatrack; app.notaTracks[t] = !app.notaTracks[t]; redraw(); }; });
      host.querySelectorAll('[data-ghost]').forEach(b => { b.onclick = () => { const t=+b.dataset.ghost; app.notaGhost[t] = !app.notaGhost[t]; redraw(); }; });
      host.querySelectorAll('[data-seltrack]').forEach(b => { b.onclick = () => { const t=+b.dataset.seltrack; MW.notationSelectTrack(app, t); redraw(); }; });
      host.querySelectorAll('[data-time]').forEach(b => { b.onclick = () => { app.timeSig=+b.dataset.time; redraw(); }; });
      host.querySelectorAll('[data-pset]').forEach(b => { b.onclick = () => { MW.notationPreset(app,+b.dataset.pset); redraw(); }; });
      host.querySelector('[data-act="pset-clear"]').onclick = () => { app.notaTracks = {}; app.notaGhost = {}; redraw(); };
      host.querySelector('[data-act="nota-hide"]').onclick = () => { instrument.hide = !instrument.hide; redraw(); };
      const key = app.keySig || (app.keySig = { count: 0, flat: false });
      host.querySelector('[data-act="sig-minus"]').onclick = () => { key.count=Math.max(0,key.count-1); redraw(); };
      host.querySelector('[data-act="sig-plus"]').onclick = () => { key.count=Math.min(6,key.count+1); redraw(); };
      host.querySelector('[data-act="sig-sharp"]').onclick = () => { key.flat=false; redraw(); };
      host.querySelector('[data-act="sig-flat"]').onclick = () => { key.flat=true; redraw(); };
      host.querySelector('[data-act="nota-print"]').onclick = () => this.printNotation();
      let gesture = null;
      const updateGesture = e => {
        if (!gesture) return;
        const currentBlock = app.song.blocks[app.cursor.block];
        const hit = this.sheetHit(e, currentBlock);
        if (!hit) return;
        gesture.hit = hit;
        gesture.block = currentBlock;
        if (gesture.preview !== hit.note) {
          gesture.preview = hit.note;
          app.notaNote = hit.note;
          host.querySelector('[data-score-note]').textContent = MW.noteName(hit.note, app.hb);
          if (!app.notaRest && !app.notaDelete) MW.voicePreview(hit.note, app.currentIns);
        }
      };
      canvas.onpointerdown = e => {
        if (e.button !== 0) return;
        if (app.notaSelectedTrack == null) { MW.toast('No track selected', true); return; }
        if (app.notaSelectedTrack >= app.song.blocks[app.cursor.block].tracks) { MW.toast('Selected track does not exist', true); return; }
        gesture = { hit: null, preview: null };
        canvas.setPointerCapture(e.pointerId);
        updateGesture(e);
        e.preventDefault();
      };
      canvas.onpointermove = updateGesture;
      canvas.onpointerup = e => {
        if (!gesture) return;
        updateGesture(e);
        const hit = gesture.hit;
        const currentBlock = gesture.block;
        gesture = null;
        if (hit && app.editMode) this.sheetClick(hit, currentBlock);
      };
      canvas.onpointercancel = () => { gesture = null; };
    },

    drawSheet(canvas, block, tracks, widthOverride, startOverride) {
      const app = MW.app;
      const width = widthOverride || Math.max(320, canvas.parentElement.clientWidth);
      const height = widthOverride ? 200 : Math.max(180, canvas.parentElement.clientHeight);
      const dpr = widthOverride ? 2 : (window.devicePixelRatio || 1);
      canvas.style.height=height+'px'; canvas.width=Math.floor(width*dpr); canvas.height=Math.floor(height*dpr);
      const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
      const start=MW.notationMeasureStart(widthOverride ? (startOverride || 0) : app.cursor.line,app.timeSig);
      const per=(app.timeSig || 4)*4;
      const left=Math.max(72,width*.16), right=width-14, step=Math.max(5,Math.min(10,(height-70)/12));
      const middle=height/2, trebleBottom=middle-step*2, bassTop=middle+step*2;
      const xForLine = line => left+(line-start+0.5)*(right-left)/per;
      ctx.fillStyle='#000'; ctx.font='bold 14px monospace'; ctx.fillText(String(start).padStart(3,'0'),12,20);
      if (!widthOverride) { const x=xForLine(app.cursor.line); ctx.fillRect(x-(right-left)/per/2,0,(right-left)/per,height); }
      ctx.strokeStyle='#000'; ctx.lineWidth=1.2;
      for (let staff=0;staff<2;staff++) for(let i=0;i<5;i++) { const y=staff===0 ? trebleBottom-i*step : bassTop+i*step; ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(right,y);ctx.stroke(); if(!widthOverride) { const x=xForLine(app.cursor.line), half=(right-left)/per/2; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(x-half,y); ctx.lineTo(x+half,y); ctx.stroke(); ctx.strokeStyle='#000'; } }
      ctx.beginPath(); ctx.moveTo(12,trebleBottom-4*step);ctx.lineTo(12,bassTop+4*step);ctx.moveTo(right,trebleBottom-4*step);ctx.lineTo(right,bassTop+4*step);ctx.stroke();
      ctx.font=`${step*7}px serif`;ctx.fillText('𝄞',17,trebleBottom+step*.8);ctx.fillText('𝄢',19,bassTop+step*3.3);
      const signature = app.keySig || { count: 0, flat: false };
      ctx.font=`bold ${step*1.6}px serif`;
      for (let i=0;i<signature.count;i++) {
        const offsets = signature.flat ? [3, 0, 4, 1, 5, 2] : [0, 3, -1, 2, 5, 1];
        const x=48+i*step*.9, shift=offsets[i]*step/2;
        ctx.fillText(signature.flat ? '♭' : '♯',x,trebleBottom-3*step+shift);
        ctx.fillText(signature.flat ? '♭' : '♯',x,bassTop+step+shift);
      }
      const sigX=48+signature.count*step*.9;
      ctx.font=`bold ${step*2}px serif`;ctx.fillText(String(app.timeSig || 4),sigX,trebleBottom-2*step);ctx.fillText('4',sigX,trebleBottom);ctx.fillText(String(app.timeSig || 4),sigX,bassTop+2*step);ctx.fillText('4',sigX,bassTop+4*step);
      const middleC=middle; // C-3 lies between the two staves.
      const accidentals = {};
      for(let line=0;line<Math.min(block.lines,start+per);line++) for(let t=0;t<block.tracks;t++) {
        if (app.notaTracks && !app.notaTracks[t]) continue;
        const cell=block.rows[line][t]; if(!cell || !cell.note) continue;
        const opt=app.notaInstruments && app.notaInstruments[cell.ins]; if(opt && opt.hide) continue;
        const note=MW.clamp(cell.note+(opt ? opt.transpose : 0),1,120);
        const pitch=MW.notationPitch(note, signature);
        const duration = MW.notationDuration(block,t,line);
        if (line + duration <= start) continue;
        const accidental = line >= start ? MW.notationAccidental(note, pitch, signature, accidentals) : '';
        const parts = MW.notationDurationParts(duration, line, per);
        const y=middleC-(pitch.step-14)*step/2;
        for (let partIndex=0; partIndex<parts.length; partIndex++) {
        const part = parts[partIndex], partLine = line + part.offset;
        if (partLine < start || partLine >= start + per) continue;
        const x=xForLine(partLine);
        const selected=!widthOverride && partLine===app.cursor.line;
        ctx.fillStyle=selected?'#fff':'#000'; ctx.strokeStyle=ctx.fillStyle; ctx.globalAlpha=app.notaGhost && app.notaGhost[t] ? .3 : 1;
        // Add ledger lines in the gap and beyond the visible staves.
        const ledger = yy => { ctx.beginPath(); ctx.moveTo(x-step,yy); ctx.lineTo(x+step,yy); ctx.stroke(); };
        if (Math.abs(y-middle)<step*.3) ledger(middle);
        for (let yy=trebleBottom-5*step; yy>=y-step*.2; yy-=step) ledger(yy);
        for (let yy=bassTop+5*step; yy<=y+step*.2; yy+=step) ledger(yy);
        const base = part.length;
        ctx.beginPath();ctx.ellipse(x,y,step*.55,step*.38,-.3,0,Math.PI*2);
        if (base >= 8) { ctx.save(); ctx.fillStyle = selected ? '#000' : '#fff'; ctx.fill(); ctx.restore(); ctx.stroke(); } else ctx.fill();
        if (base < 16) {
          ctx.beginPath();ctx.moveTo(x+step*.5,y);ctx.lineTo(x+step*.5,y-step*3);ctx.stroke();
          if (base <= 2) { ctx.beginPath(); ctx.moveTo(x+step*.5,y-step*3); ctx.quadraticCurveTo(x+step*2,y-step*2.2,x+step*1.1,y-step*1.3); ctx.stroke(); }
          if (base === 1) { ctx.beginPath(); ctx.moveTo(x+step*.5,y-step*2.3); ctx.quadraticCurveTo(x+step*2,y-step*1.5,x+step*1.1,y-step*.6); ctx.stroke(); }
        }
        if (part.dotted) { ctx.beginPath(); ctx.arc(x+step*.95,y,step*.12,0,Math.PI*2); ctx.fill(); }
        if (partIndex === 0 && accidental) {ctx.font=`${step*1.5}px serif`;ctx.fillText({ sharp:'♯', flat:'♭', natural:'♮' }[accidental],x-step*1.7,y+step*.4);}
        if (partIndex === 0 && app.notaNumbers && t===app.notaSelectedTrack) {ctx.font='10px monospace';ctx.fillText(MW.insName(cell.ins),x-5,trebleBottom-5*step);}
        if (partIndex > 0) {
          const previous = line + parts[partIndex - 1].offset;
          const from = previous < start ? left : xForLine(previous) + step*.6;
          ctx.beginPath(); ctx.moveTo(from, y + step*.75); ctx.quadraticCurveTo((from+x)/2, y + step*1.6, x-step*.4, y+step*.75); ctx.stroke();
        }
        ctx.globalAlpha=1;
        }
      }
      this._sheet={width,height,left,right,step,middle,start,per};
    },

    printNotation() {
      const app = MW.app;
      const blocks = MW.notationPrintBlocks(app);
      const textBlock = ({ block, index }) => MW.notationTextBlock(block, index, app.hb);
      const header = MW.notationTextHeader(app.song);
      const contents = [app.notaHeader ? header : '', app.notaText ? blocks.map(textBlock).join(app.notaFeed ? '\f\n' : '\n\n') : ''].filter(Boolean).join('\n\n');
      if (app.notaFile) {
        if (!contents) { MW.toast('Select HEADER or TEXT for file output', true); return; }
        const link = document.createElement('a');
        const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain' }));
        link.href=url; link.download=(app.song.name || 'untitled')+'-score.txt'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); return;
      }
      if (!contents && app.notaPrintNotes === false) { MW.toast('Select something to print', true); return; }
      const sheet = document.createElement('div'); sheet.className = 'print-sheet';
      if (app.notaHeader) { const pre=document.createElement('pre'); pre.textContent=header; sheet.appendChild(pre); }
      const activeSheet = this._sheet;
      blocks.forEach(({block, index}, i) => {
        const page=document.createElement('div'); page.className='print-page'+(app.notaFeed && i < blocks.length-1 ? ' feed' : '');
        const head=document.createElement('div'); head.className='print-head'; head.textContent=`${app.song.name || 'untitled'} — block ${index}`; page.appendChild(head);
        if (app.notaText) { const pre=document.createElement('pre'); pre.textContent=textBlock({block,index}); page.appendChild(pre); }
        if (app.notaPrintNotes !== false) for(let line=0;line<block.lines;line+=(app.timeSig || 4)*4) {
          const c=document.createElement('canvas'); page.appendChild(c); this.drawSheet(c,block,block.tracks,760,line);
        }
        sheet.appendChild(page);
      });

      this._sheet = activeSheet;
      document.body.appendChild(sheet);
      document.body.classList.add('printing');

      let cleaned = false;
      const clean = () => {
        if (cleaned) return;
        cleaned = true;
        document.body.classList.remove('printing');
        sheet.remove();
        window.removeEventListener('afterprint', clean);
      };
      window.addEventListener('afterprint', clean);

      window.print();
      setTimeout(clean, 8000);
    },

    sheetHit(e, block) {
      const layout=this._sheet; if (!layout) return null;
      const rect=e.currentTarget.getBoundingClientRect();
      const x=(e.clientX-rect.left)*layout.width/rect.width, y=(e.clientY-rect.top)*layout.height/rect.height;
      return MW.notationHit(layout,x,y,MW.app.keySig,block.lines);
    },

    sheetClick(hit, block) {
      const app=MW.app, track=app.notaSelectedTrack;
      if (track == null || track >= block.tracks || !app.editMode) return;
      const len=app.noteLen || 2;
      MW.notationWrite(block, track, hit.line, { length: len, note: hit.note, instrument: app.currentIns, rest: app.notaRest, insert: app.notaInsert && !app.notaDelete, remove: app.notaDelete });
      app.cursor.line=Math.min(block.lines-1,hit.line+len); MW.refreshAll();
    }
  };

  function shape(kind, n) {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let v = 0;
      if (kind === 'sine') v = Math.sin(t * Math.PI * 2);
      else if (kind === 'saw') v = (t * 2 - 1);
      else if (kind === 'pulse') v = t < 0.5 ? 0.86 : -0.86;
      else if (kind === 'triangle') v = (Math.abs(t * 4 - 2) - 1);
      else v = (Math.random() * 2 - 1);
      a[i] = v;
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  MW.escapeHtml = escapeHtml;

})(typeof globalThis !== 'undefined' ? globalThis : this);
