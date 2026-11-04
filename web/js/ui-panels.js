/* Octanaut - panel strip */
(function (global) {
  'use strict';
  const MW = global.MW;

  /* each panel repaints only for the slices it displays */
  const PANEL_KEYS = {
    play: ['transport'],
    instr: ['currentIns'],
    midi: ['currentIns'],
    edit: ['editMode', 'spaceAsDel', 'chordMode', 'octave', 'advance']
  };

  const panels = MW.panels = {
    current: 'play',

    mount(host) {
      this.host = host;
      if (MW.store && !this.wiredStore) {
        this.wiredStore = true;
        MW.store.subscribe('*', e => {
          const keys = PANEL_KEYS[this.current];
          if (keys && keys.indexOf(e.key) !== -1) this.show(this.current);
        });
      }
      this.show('play');
    },

    show(name) {
      this.current = name;
      const app = MW.app;
      const fn = this['render_' + name] || this.render_play;
      this.host.innerHTML = fn.call(this, app);
      document.querySelectorAll('#rail button').forEach(b => {
        b.classList.toggle('active', b.dataset.panel === name);
      });
      const wire = this['wire_' + name];
      if (wire) wire.call(this);
    },

    refresh() { this.show(this.current); },

    /* ---------------------------------------------------------- helpers */

    title(text, right) {
      return `<div class="panel-title"><span>${text}</span><em>${right || ''}</em></div>`;
    },

    group(label, inner) {
      return `<div class="group"><div class="group-label">${label}</div><div class="group-row">${inner}</div></div>`;
    },

    btn(label, act, cls) {
      return `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper ${cls || ''}" data-act="${act}">${label}</button>`;
    },

    /* ---------------------------------------------------------- Play */

    render_play(app) {
      const song = app.song;
      const eq = app.eq || [true, true, true];
      const tempo = song.deftempo || 33;
      const tempo2 = song.tempo2 || 6;
      const pct = (v, max) => MW.clamp((v - 1) / (max - 1), 0, 1) * 100;

      const slider = (kind, value, max, cls) => `
        <div class="tslider ${cls || ''}" data-tempo-slider="${kind}" data-max="${max}">
          <div class="knob" data-knob="${kind}" style="left:calc(${pct(value, max).toFixed(2)}% - 5px)"></div>
        </div>`;

      return `<div class="playpanel">
        <div class="flex h-[46px] shrink-0 items-stretch">
          ${slider('tempo', tempo, 240, 'flex-[1.68]')}
          <button class="flex h-full w-[24px] shrink-0 items-center justify-center border border-ink bg-paper text-[16px] leading-none active:bg-ink active:text-paper" data-tempo-step="tempo:-1" title="Slower">‹</button>
          <button class="flex h-full w-[24px] shrink-0 items-center justify-center border border-ink bg-paper text-[16px] leading-none active:bg-ink active:text-paper" data-tempo-step="tempo:1" title="Faster">›</button>
          ${slider('tempo2', tempo2, 32, 'flex-1')}
          <button class="flex h-full w-[24px] shrink-0 items-center justify-center border border-ink bg-paper text-[16px] leading-none active:bg-ink active:text-paper" data-tempo-step="tempo2:-1" title="Fewer pulses per line">‹</button>
          <button class="flex h-full w-[24px] shrink-0 items-center justify-center border border-ink bg-paper text-[16px] leading-none active:bg-ink active:text-paper" data-tempo-step="tempo2:1" title="More pulses per line">›</button>
        </div>

        <div class="flex h-[33px] shrink-0 items-stretch">
          <span class="flex w-[45px] shrink-0 items-center pl-1 text-[16px] leading-none">VOL:</span>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[43px] ${song.flags.volhex ? 'on' : ''}" data-act="vol-hex">HEX</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[46px] ${song.flags.volhex ? '' : 'on'}" data-act="vol-dec">DEC</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[78px] ${song.flags.filteron ? 'on' : ''}" data-act="misc-filter">FILTER</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1 ${eq[0] ? 'on' : ''}" data-act="eq-1" title="Red level bars">E1</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1 ${eq[1] ? 'on' : ''}" data-act="eq-2" title="Channel sprites">E2</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1 ${eq[2] ? 'on' : ''}" data-act="eq-3" title="Oscilloscopes">E3</button>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[55px] ${song.flags.stslide ? 'on' : ''}" data-act="stslide">STS</button>
          <span class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[58px]">SPD</span>
          <span class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[100px]"><b id="spd-readout" class="font-normal tabular-nums">${String(tempo).padStart(3, '0')}/${String(tempo2).padStart(2, '0')}</b></span>
        </div>

        <div class="grid h-[55px] shrink-0 grid-cols-[130px_72px_minmax(0,1fr)]">
          <div class="grid grid-rows-2">
            <div class="flex items-stretch">
              <span class="flex min-w-0 flex-1 items-center justify-end pr-2 text-[16px] leading-none">CH.MODE:</span>
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[34px] ${app.depth === 'enhanced' ? 'on' : ''}" data-act="${app.depth === 'enhanced' ? 'depth-classic' : 'depth-enhanced'}" title="High quality output">HQ</button>
            </div>
            <div class="flex items-stretch">
              ${[4, 5, 6, 7, 8].map(n =>
                `<button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1 ${song.channels === n ? 'on' : ''}" data-act="chmode-${n}">${n}</button>`).join('')}
            </div>
          </div>
          <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper border-l-0" id="btn-stop" title="Stop (Space)">STOP</button>
          <div class="grid grid-rows-2 border-l border-ink">
            <div class="flex items-stretch">
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6] ${MW.player.playing ? 'playing' : ''}" id="btn-play" title="Play song">PLAY SONG</button>
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1" id="btn-cont" title="Continue from here">CONT. SONG</button>
            </div>
            <div class="flex items-stretch">
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6]" id="btn-play-block" title="Play the current block">PLAY BLOCK</button>
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper w-[38px] ${app.playOnNote ? 'on' : ''}" data-act="play-on-note" title="Play a note as you enter it">D</button>
              <button class="flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1" id="btn-cont-block" title="Continue the block from the cursor">CONT. BLOCK</button>
            </div>
          </div>
        </div>
      </div>`;
    },

    wire_play() {
      const app = MW.app;
      const song = app.song;

      const apply = (kind, value) => {
        const max = kind === 'tempo' ? 240 : 32;
        const v = MW.clamp(Math.round(value), 1, max);
        if (kind === 'tempo') {
          song.deftempo = v;
          if (!MW.player.playing) MW.player.tempo = v;
        } else {
          song.tempo2 = v;
          if (!MW.player.playing) MW.player.tempo2 = v;
        }
        const knob = this.host.querySelector(`[data-knob="${kind}"]`);
        if (knob) knob.style.left = `calc(${((v - 1) / (max - 1)) * 100}% - 5px)`;
        const readout = this.host.querySelector('#spd-readout');
        if (readout) {
          readout.textContent = `${String(song.deftempo).padStart(3, '0')}/${String(song.tempo2).padStart(2, '0')}`;
        }
      };

      this.host.querySelectorAll('[data-tempo-slider]').forEach(track => {
        const kind = track.dataset.tempoSlider;
        const max = parseInt(track.dataset.max, 10) || 240;
        let dragging = false;
        const setFrom = e => {
          const r = track.getBoundingClientRect();
          const f = MW.clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
          apply(kind, 1 + f * (max - 1));
        };
        track.addEventListener('pointerdown', e => {
          dragging = true;
          try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          setFrom(e);
        });
        track.addEventListener('pointermove', e => { if (dragging) setFrom(e); });
        track.addEventListener('pointerup', () => { dragging = false; });
        track.addEventListener('pointercancel', () => { dragging = false; });
      });

      this.host.querySelectorAll('[data-tempo-step]').forEach(btn => {
        btn.onclick = () => {
          const [kind, d] = btn.dataset.tempoStep.split(':');
          const cur = kind === 'tempo' ? song.deftempo : song.tempo2;
          apply(kind, cur + parseInt(d, 10));
        };
      });

      const title = this.host.querySelector('#song-title');
      if (title) title.oninput = () => { song.name = title.value; };

      /* the panel is rebuilt on every refresh, so transport bindings have
         to be re-attached here rather than once at boot */
      const bind = (id, fn) => {
        const el = this.host.querySelector('#' + id);
        if (el) el.onclick = fn;
      };
      bind('btn-play', () => { if (MW.scope) MW.scope.elapsed = 0; MW.player.play(true); });
      bind('btn-stop', () => MW.player.stop());
      bind('btn-play-block', () => { if (MW.scope) MW.scope.elapsed = 0; MW.player.playBlock(app.cursor.block); });
      bind('btn-cont', () => MW.player.play(false));
      bind('btn-cont-block', () => MW.player.playBlock(MW.app.cursor.block));
      bind('btn-open', () => MW.requester.open());
      bind('btn-save', () => { if (MW.saveModule) MW.saveModule(); });
    },

    /* ---------------------------------------------------------- Instr */

    render_instr(app) {
      const song = app.song;
      const cur = app.currentIns;
      const inst = song.instruments[cur - 1];
      const name = inst ? (inst.name || 'unnamed') : 'empty';
      const len = inst && inst.data ? inst.data.length : 0;
      const type = inst ? inst.type : 'none';

      return this.title('Instrument', `slot ${MW.insName(cur)} of ${MW.insName(song.instruments.filter(Boolean).length || 1)}`)
        + '<div class="panel-row">'
        + this.group('Slot', `
            ${this.btn('<<', 'ins-first')}${this.btn('<', 'ins-prev')}
            <span class="preadout" style="min-width:3ch;text-align:center">${MW.insName(cur)}</span>
            ${this.btn('>', 'ins-next')}${this.btn('>>', 'ins-last')}
            ${this.btn('>|<', 'ins-lastoccupied')}
            ${this.btn('L.U.', 'ins-lastused')}${this.btn('New', 'ins-new')}${this.btn('Kill', 'ins-kill')}
            ${this.btn('Jump ' + (inst && inst.jump ? 'on' : 'off'), 'ins-jump', inst && inst.jump ? 'on' : '')}`)
        + this.group('Name', `<input class="ptext" id="ins-name" value="${escapeAttr(name)}" maxlength="39">`)
        + this.group('Sample', `<input class="ptext" id="ins-file" placeholder="file name" style="min-width:150px">${this.btn('Load', 'ins-load')}`)
        + this.group('Volume', `<input class="pslider" type="range" min="0" max="64" value="${inst ? inst.volume : 64}" data-act="ins-vol">
            <span class="preadout" id="ins-vol-val">${inst ? inst.volume : 64}</span>`)
        + this.group('Hold / Decay', `
            <input class="pnum" type="number" min="0" max="255" value="${inst ? inst.hold || 0 : 0}" data-act="ins-hold" title="hold">
            <input class="pnum" type="number" min="0" max="255" value="${inst ? inst.decay || 0 : 0}" data-act="ins-decay" title="decay">`)
        + this.group('Loop', `
            <input class="pnum" type="number" min="0" value="${inst ? inst.loop || 0 : 0}" data-act="ins-loop" title="repeat start">
            <input class="pnum" type="number" min="0" value="${inst ? inst.looplen || 0 : 0}" data-act="ins-looplen" title="repeat length">`)
        + this.group('Transpose', `<input class="pnum" type="number" min="-48" max="48" value="${inst ? inst.transpose || 0 : 0}" data-act="ins-transp">`)
        + this.group('Finetune', `<input class="pnum" type="number" min="-8" max="7" value="${inst ? inst.finetune || 0 : 0}" data-act="ins-finetune" title="finetune -8 to +7">`)
        + '</div>'
        + `<div class="panel-row" style="margin-top:8px">
             <span class="preadout">${type} · ${len} frames · ${inst ? (inst.bits16 ? '16 bit' : '8 bit') + (inst.stereo16 ? ' stereo' : ' mono') : ''} · ${inst && inst.missing ? 'samples not in this file' : ''}</span>
           </div>`;
    },

    wire_instr() {
      const app = MW.app;
      const inst = () => app.song.instruments[app.currentIns - 1];
      const nameEl = this.host.querySelector('#ins-name');
      if (nameEl) nameEl.oninput = () => { const i = inst(); if (i) { i.name = nameEl.value; MW.grid.render(); } };

      this.host.querySelectorAll('[data-act="ins-vol"]').forEach(el => {
        el.oninput = () => {
          const i = inst(); if (!i) return;
          i.volume = parseInt(el.value, 10);
          const out = this.host.querySelector('#ins-vol-val');
          if (out) out.textContent = el.value;
        };
      });
      const bind = (act, key, num) => {
        this.host.querySelectorAll(`[data-act="${act}"]`).forEach(el => {
          el.onchange = () => {
            const i = inst(); if (!i) return;
            i[key] = parseInt(el.value, 10) || 0;
          };
        });
      };
      bind('ins-hold', 'hold');
      bind('ins-decay', 'decay');
      bind('ins-loop', 'loop');
      bind('ins-looplen', 'looplen');
      bind('ins-transp', 'transpose');
      this.host.querySelectorAll('[data-act="ins-finetune"]').forEach(el => {
        el.onchange = () => {
          const i = inst(); if (!i) return;
          i.finetune = MW.clamp(parseInt(el.value, 10) || 0, -8, 7);
          el.value = i.finetune;
        };
      });

      const fileEl = this.host.querySelector('#ins-file');
      if (fileEl) fileEl.onkeydown = e => { if (e.key === 'Enter') MW.app.loadInstrumentFile(); };
    },

    /* ---------------------------------------------------------- Block */

    render_block(app) {
      const b = app.song.blocks[app.cursor.block];
      return this.title('Block', `block ${MW.hex(app.cursor.block)} · ${b.tracks} tracks · ${b.lines} lines`)
        + '<div class="panel-row">'
        + this.group('Tracks', `${[4, 8, 12, 16].map(n => this.btn(String(n), 'blk-tracks-' + n, b.tracks === n ? 'on' : '')).join('')}`)
        + this.group('Lines', `
            <input class="pnum" id="blk-lines" type="number" min="1" max="256" value="${b.lines}">
            ${this.btn('Set', 'blk-lines-set')}`)
        + this.group('Track', `${this.btn('Cut', 'trk-cut')}${this.btn('Copy', 'trk-copy')}${this.btn('Paste', 'trk-paste')}${this.btn('Swap', 'trk-swap')}`)
        + this.group('Block', `${this.btn('Cut', 'blk-cut')}${this.btn('Copy', 'blk-copy')}${this.btn('Paste', 'blk-paste')}${this.btn('Swap', 'blk-swap')}`)
        + this.group('Lines', `${this.btn('Ins', 'line-ins')}${this.btn('Del', 'line-del')}${this.btn('Ins trk', 'track-ins')}${this.btn('Del trk', 'track-del')}`)
        + this.group('Whole block', `${this.btn('Expand', 'blk-expand')}${this.btn('Shrink', 'blk-shrink')}
             <input class="pnum" id="blk-factor" type="number" min="2" max="9" value="2" style="width:44px">`)
        + this.group('Structure', `${this.btn('New', 'blk-new')}${this.btn('DEF', 'blk-new-def')}
             ${this.btn('New here', 'blk-new-here')}${this.btn('DEF', 'blk-new-here-def')}
             ${this.btn('Del this', 'blk-del')}${this.btn('Del last', 'blk-del-last')}
             ${this.btn('Split', 'blk-split')}${this.btn('Join', 'blk-join')}${this.btn('Del buff', 'del-buffer')}`)
        + this.group('Highlight', `${[1, 2, 3, 4, 8, 16].map(n => this.btn(String(n), 'hl-' + n)).join('')}${this.btn('C', 'hl-clear')}`)
        + '</div>';
    },

    wire_block() {
      const el = this.host.querySelector('#blk-lines');
      if (el) el.onchange = () => MW.ops.setLines(parseInt(el.value, 10) || 64);
    },

    /* ---------------------------------------------------------- Edit */

    render_edit(app) {
      const adv = app.advance || 'down';
      const modes = [['down', '↓'], ['up', '↑'], ['right', '→'], ['left', '←'], ['nexttrk', '»'], ['prevtrk', '«']];
      return this.title('Edit', 'editing is ' + (app.editMode ? 'on' : 'off'))
        + '<div class="panel-row">'
        + this.group('Editing', `${this.btn(app.editMode ? 'On' : 'Off', 'edit-toggle', app.editMode ? 'on' : '')}
             ${this.btn('Space ' + (app.spaceAsDel ? 'as Del' : 'plays'), 'edit-space')}
             ${this.btn('Chord ' + (app.chordMode ? 'on' : 'off'), 'edit-chord', app.chordMode ? 'on' : '')}`)
        + this.group('Octaves', `${[0, 1, 2, 3].map(i => this.btn((i + 1) + '+' + (i + 2), 'oct-' + i, app.octave === i ? 'on' : '')).join('')}`)
        + this.group('Cursor advance', modes.map(([k, l]) => this.btn(l, 'adv-' + k, adv === k ? 'on' : '')).join(''))
        + this.group('SPC', `<input class="pnum" type="number" min="1" max="16" value="${app.step}" data-act="edit-step">`)
        + this.group('Tracks on', `<div class="leds">${Array.from({ length: 16 }, (_, t) =>
            `<button class="led track ${app.mutedTracks[t] ? '' : 'on'}" data-editmute="${t}">${t.toString(16).toUpperCase()}</button>`).join('')}</div>`)
        + this.group('Alt keys', `${this.btn('Pick L', 'alt-pick-l')}${this.btn('Pick R', 'alt-pick-r')}${this.btn('Clr', 'alt-clear')}`)
        + this.group('Programmable key ' + app.progTarget, `${this.btn('Pick range', 'pick-range')}${this.btn('Pick buffer', 'pick-buffer')}`)
        + this.group('Keypad', `${this.btn(app.padMode === 'track' ? 'Track on/off' : 'Select instr', 'pad-mode', 'on')}`)
        + '</div>';
    },

    wire_edit() {
      const el = this.host.querySelector('[data-act="edit-step"]');
      if (el) el.onchange = () => { MW.app.step = MW.clamp(parseInt(el.value, 10) || 1, 1, 16); };
      this.host.querySelectorAll('[data-editmute]').forEach(b => {
        b.onclick = () => {
          const t = parseInt(b.dataset.editmute, 10);
          MW.app.mutedTracks[t] = !MW.app.mutedTracks[t];
          MW.player.channels[t].muted = MW.app.mutedTracks[t];
          this.refresh();
          MW.grid.render();
          MW.touchStatus('mute', ['mutedTracks']);
        };
      });
    },

    /* ---------------------------------------------------------- Range */

    render_range(app) {
      const sel = app.selection;
      const info = sel ? `${Math.min(sel.l0, sel.l1)}-${Math.max(sel.l0, sel.l1)} on tracks ${Math.min(sel.t0, sel.t1)}-${Math.max(sel.t0, sel.t1)}` : 'no range selected';
      const trackLeds = [];
      for (let t = 0; t < 16; t++) {
        const on = app.selectedTracks && app.selectedTracks[t];
        trackLeds.push(`<button class="led ${on ? 'on' : ''}" data-sel-track="${t}">${t.toString(16).toUpperCase()}</button>`);
      }
      return this.title('Range', info)
        + '<div class="panel-row">'
        + this.group('Selected tracks', `<div class="leds">${trackLeds.join('')}</div>`)
        + this.group('Range', `${this.btn('All', 'sel-all')}${this.btn('Clear', 'rng-clear')}${this.btn('Cut', 'rng-cut')}${this.btn('Copy', 'rng-copy')}${this.btn('Paste', 'rng-paste')}${this.btn('Cancel', 'sel-cancel')}`)
        + this.group('Spread', `${this.btn('2', 'spread-2')}${this.btn('3', 'spread-3')}${this.btn('4', 'spread-4')}`)
        + this.group('Tools', `${this.btn('Slide S1', 'mk-slide1')}${this.btn('Slide S2', 'mk-slide2')}${this.btn('Volume', 'mk-volslide')}`)
        + this.group('Chord', `${this.btn('Enter chords', 'chord-toggle', app.chordMode ? 'on' : '')}`)
        + '</div>';
    },

    wire_range() {
      const app = MW.app;
      this.host.querySelectorAll('[data-sel-track]').forEach(el => {
        el.onclick = () => {
          const t = parseInt(el.dataset.selTrack, 10);
          app.selectedTracks[t] = !app.selectedTracks[t];
          this.refresh();
        };
      });
    },

    /* ---------------------------------------------------------- Transp */

    render_transp(app) {
      const scope = app.transposeScope || 'block';
      return this.title('Transpose', 'scope: ' + scope)
        + '<div class="panel-row">'
        + this.group('Affect', ['song', 'block', 'track', 'sel', 'range'].map(s => this.btn(s, 'scope-' + s, scope === s ? 'on' : '')).join(''))
        + this.group('Instrument', `${this.btn('All', 'instscope-all', (app.transposeInstrScope || 'all') === 'all' ? 'on' : '')}${this.btn('Current', 'instscope-curr', app.transposeInstrScope === 'curr' ? 'on' : '')}`)
        + this.group('Semitone', `${this.btn('-1', 'tr-down')}${this.btn('+1', 'tr-up')}`)
        + this.group('Octave', `${this.btn('-12', 'tr-down12')}${this.btn('+12', 'tr-up12')}`)
        + this.group('Play transpose', `<input class="pnum" type="number" min="-24" max="24" value="${app.song.playtransp}" data-act="play-transp">`)
        + '</div>'
        + '<div class="panel-row" style="margin-top:8px">'
        + this.group('Note change', `
            <input class="pnum" id="tr-from" type="number" min="1" max="96" value="1" title="from note">
            ${this.btn('→', 'note-change')}
            <input class="pnum" id="tr-to" type="number" min="1" max="96" value="1" title="to note">
            ${this.btn('⇄', 'note-exchange')}`)
        + this.group('Instrument', `
            <input class="pnum" id="tr-ins-from" type="number" min="1" max="63" value="${app.currentIns}" title="from">
            ${this.btn('→', 'ins-change')}
            <input class="pnum" id="tr-ins-to" type="number" min="1" max="63" value="1" title="to">
            ${this.btn('⇄', 'ins-exchange')}
            ${this.btn('Del', 'ins-delete')}`)
        + this.group('Annotation', `<input class="ptext" id="anno" value="${escapeAttr(app.song.annotation || '')}" placeholder="song note, saved in the module">`)
        + '</div>';
    },

    wire_transp() {
      const a = this.host.querySelector('#anno');
      if (a) a.oninput = () => { MW.app.song.annotation = a.value; };
      const pt = this.host.querySelector('[data-act="play-transp"]');
      if (pt) pt.onchange = () => { MW.app.song.playtransp = MW.clamp(parseInt(pt.value, 10) || 0, -24, 24); };
    },

    /* ---------------------------------------------------------- Vol */

    render_vol(app) {
      const bars = [];
      for (let t = 0; t < 16; t++) {
        bars.push(`<div style="display:flex;align-items:center;gap:6px">
          <span class="preadout" style="width:1.5ch">${t.toString(16).toUpperCase()}</span>
          <input class="pslider" type="range" min="0" max="64" value="${app.song.trkvol[t] || 64}" data-vol="${t}" style="width:110px">
          <span class="preadout" style="width:2ch">${app.song.trkvol[t] || 64}</span>
        </div>`);
      }
      return this.title('Track volumes', 'relative level for each track')
        + '<div class="panel-row">'
        + `<div class="group"><div class="group-label">Tracks</div><div style="display:grid;grid-template-columns:repeat(4,auto);gap:4px 18px">${bars.join('')}</div></div>`
        + this.group('Master', `<input class="pslider" type="range" min="0" max="64" value="${app.song.mastervol}" data-act="master" style="width:160px">
             <span class="preadout" id="master-val">${app.song.mastervol}</span>`)
        + '</div>';
    },

    wire_vol() {
      this.host.querySelectorAll('[data-vol]').forEach(el => {
        el.oninput = () => {
          const t = parseInt(el.dataset.vol, 10);
          MW.app.song.trkvol[t] = parseInt(el.value, 10);
          el.nextElementSibling.textContent = el.value;
        };
      });
      const m = this.host.querySelector('[data-act="master"]');
      if (m) m.oninput = () => {
        MW.app.song.mastervol = parseInt(m.value, 10);
        this.host.querySelector('#master-val').textContent = m.value;
      };
    },

    /* ---------------------------------------------------------- MIDI */

    render_midi(app) {
      const inst = app.song.instruments[app.currentIns - 1];
      const midi = MW.midi || { supported: !!navigator.requestMIDIAccess, enabled: false, outputs: [], inputs: [] };
      const outList = midi.outputs.map((o, i) => `<option value="${i}">${o.name}</option>`).join('');
      return this.title('MIDI', midi.supported ? (midi.enabled ? 'connected' : 'available, not started') : 'not available in this browser')
        + '<div class="panel-row">'
        + this.group('Output', `${this.btn(midi.enabled ? 'Enable' : 'Enable MIDI', 'midi-enable', midi.enabled ? 'on' : '')}
             <select class="pselect" id="midi-out">${outList || '<option>no outputs</option>'}</select>`)
        + this.group('This instrument', `
             <span class="preadout">ch</span><input class="pnum" type="number" min="0" max="16" value="${inst ? inst.midiChannel || 0 : 0}" data-act="midi-ch">
             <span class="preadout">preset</span><input class="pnum" type="number" min="0" max="128" value="${inst ? inst.midiPreset || 0 : 0}" data-act="midi-preset">`)
        + this.group('Input', `<span class="preadout">${midi.inputs && midi.inputs.length ? midi.inputs.length + ' port(s)' : 'no input'}</span>
             ${this.btn('Read velocity', 'midi-vel', app.readVelocity ? 'on' : '')}`)
        + this.group('Control', `${this.btn('L.Ctrl on', 'midi-lc-on')}${this.btn('L.Ctrl off', 'midi-lc-off')}
             ${this.btn('Send sync', 'midi-sync', MW.player.sync ? 'on' : '')}`)
        + this.group('Notes', `${this.btn('Panic', 'midi-panic')}`)
        + '</div>'
        + '<p class="preadout" style="margin-top:10px;max-width:70ch">Instruments with a MIDI channel play out of the selected port instead of the mixer, the way OctaMED sends them down the serial port. Channel 0 means the instrument is audio only.</p>';
    },

    wire_midi() {
      const inst = () => MW.app.song.instruments[MW.app.currentIns - 1];
      const ch = this.host.querySelector('[data-act="midi-ch"]');
      if (ch) ch.onchange = () => { const i = inst(); if (i) i.midiChannel = MW.clamp(parseInt(ch.value, 10) || 0, 0, 16); };
      const pr = this.host.querySelector('[data-act="midi-preset"]');
      if (pr) pr.onchange = () => { const i = inst(); if (i) i.midiPreset = MW.clamp(parseInt(pr.value, 10) || 0, 0, 128); };
    },

    /* ---------------------------------------------------------- Files */

    render_files(app) {
      const f = app.song.format || 'new';
      return this.title('Files', f)
        + '<div class="panel-row">'
        + this.group('Module', `${this.btn('Open…', 'file-open')}${this.btn('Save MMD0', 'file-save')}${this.btn('Save MOD', 'file-save-mod')}${this.btn('New song', 'file-new')}`)
        + this.group('Instrument', `${this.btn('Load sample…', 'ins-open')}${this.btn('Export WAV', 'ins-wav')}${this.btn('Export IFF', 'file-save-iff')}`)
        + this.group('Name', `<input class="ptext" id="song-title" value="${escapeAttr(app.song.name || '')}" maxlength="40" style="min-width:180px">`)
        + this.group('Library', `${this.btn('Load demo', 'file-demo')}`)
        + '</div>'
        + `<p class="preadout" style="margin-top:10px;max-width:80ch">Reads MMD0, MMD1, MMD2 and MMD3 modules, MED 2.10 song files and ProTracker modules. Writes MMD0. Instrument files: raw samples, IFF 8SVX and MED synth patches (.msh).</p>`;
    },

    wire_files() {
      const title = this.host.querySelector('#song-title');
      if (title) title.oninput = () => { MW.app.song.name = title.value; MW.touchStatus('song', ['song']); };
    },

    /* ---------------------------------------------------------- Misc */

    render_misc(app) {
      return this.title('Misc', '')
        + '<div class="panel-row">'
        + this.group('Note naming', `${this.btn('A# / C', 'name-sharp', app.hb ? '' : 'on')}${this.btn('H / C', 'name-flat', app.hb ? 'on' : '')}`)
        + this.group('Filter', `${this.btn('LPF ' + (app.song.flags.filteron ? 'on' : 'off'), 'misc-filter', app.song.flags.filteron ? 'on' : '')}`)
        + this.group('Volume base', `${this.btn('Hex', 'vol-hex', app.song.flags.volhex ? 'on' : '')}${this.btn('Dec', 'vol-dec', app.song.flags.volhex ? '' : 'on')}`)
        + this.group('Follow', `${this.btn('Follow ' + (app.follow ? 'on' : 'off'), 'misc-follow', app.follow ? 'on' : '')}`)
        + this.group('Depth', `${this.btn('8-bit', 'depth-classic', app.depth === 'classic' ? 'on' : '')}${this.btn('16-bit', 'depth-enhanced', app.depth === 'enhanced' ? 'on' : '')}`)
        + this.group('Amiga', `${this.btn(MW.player.authentic ? '8ch hw' : 'clean', 'auth-toggle', MW.player.authentic ? 'on' : '')}`)
        + this.group('Song', `${this.btn('Clear song', 'misc-clear')}${this.btn('Clear all', 'misc-clear-all')}`)
        + this.group('Colours', `${this.btn('Set ' + (((app.paletteIndex || 0) + 1)), 'pal-cycle')}
             ${this.btn('Dep2', 'dep2', app.dep2 ? 'on' : '')}
             ${this.btn('NO16', 'no16', app.no16 ? 'on' : '')}
             ${this.btn('PTKEY', 'ptkey', app.ptkey ? 'on' : '')}`)
        + this.group('Audio', `<span class="preadout">${MW.audio.describe()}</span>${this.btn('Test tone', 'audio-test')}${this.btn('Unlock', 'audio-unlock')}`)
        + this.group('Prefs', `${this.btn('Forget saved', 'prefs-reset')}`)
        + '</div>'
        + `<div class="keys">
            <div><kbd>Esc</kbd> edit</div><div><kbd>Space</kbd> play / stop</div>
            <div><kbd>F1</kbd>-<kbd>F4</kbd> octave</div><div><kbd>F6</kbd>-<kbd>F10</kbd> jump in block</div>
            <div><kbd>Ctrl</kbd>+<kbd>1</kbd>-<kbd>9</kbd> panel</div><div><kbd>Tab</kbd> mark line</div>
            <div><kbd>Del</kbd> clear</div><div><kbd>Shift</kbd>+<kbd>Del</kbd> clear cell</div>
            <div><kbd>Return</kbd> hold marker</div><div><kbd>Backspace</kbd> delete line</div>
            <div><kbd>Shift</kbd>+<kbd>Backspace</kbd> insert line</div><div><kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> track</div>
            <div><kbd>Shift</kbd>+arrows range</div><div><kbd>~</kbd> space clears notes</div>
          </div>`
        + `<p class="preadout" style="margin-top:12px;max-width:80ch">Octanaut plays every track at full quality. Switch on "8ch hardware" in the top bar to hear modules the way an Amiga did: paired tracks sharing a volume register, split channels at half gain, and the low pass filter in circuit.</p>`;
    },

    wire_misc() {}
  };

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  MW.escapeAttr = escapeAttr;

})(typeof globalThis !== 'undefined' ? globalThis : this);
