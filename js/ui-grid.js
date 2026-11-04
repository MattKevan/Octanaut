/* Octanaut - note grid display */
(function (global) {
  'use strict';
  const MW = global.MW;

  const trackColour = t => {
    const pal = MW.palettes[(MW.app && MW.app.paletteIndex) || 0] || MW.palettes[0];
    return pal.tracks[t % pal.tracks.length];
  };

  const grid = MW.grid = {
    el: null,
    rows: [],
    dirty: true,

    mount(host) {
      host.innerHTML = '<div class="grid-wrap" id="grid-wrap" tabindex="0"><div class="notegrid" id="grid"></div></div>'
        + '<div class="grid-lines" id="grid-lines"></div>'
        + '<canvas class="ch-waves" id="ch-waves"></canvas>'
        + '<div class="ch-meters" id="ch-meters"></div>';
      this.el = host.querySelector('#grid');
      this.wrap = host.querySelector('#grid-wrap');
      this.wrap.addEventListener('mousedown', e => this.onMouseDown(e));
      this.wrap.addEventListener('contextmenu', e => e.preventDefault());
      this.wrap.addEventListener('scroll', () => { this.onScroll(); this.placeMeters(); this.placeLines(); }, { passive: true });
      window.addEventListener('mousemove', e => this.onMouseMove(e));
      window.addEventListener('mouseup', () => { this.dragging = false; });
      window.addEventListener('resize', () => { this.updatePadding(); this.placeMeters(); this.placeLines(); });
      this.render();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this.centerLine(MW.app.cursor.line));
      }
    },

    block() {
      const app = MW.app;
      return app.song.blocks[app.cursor.block] || app.song.blocks[0];
    },

    render() {
      const app = MW.app;
      if (!this.el) return;
      const block = this.block();
      const cur = app.cursor;

      const shown = MW.app.no16 && block.tracks > 8 ? 8 : block.tracks;
      this.el.classList.toggle('many', shown > 4);
      const tw = this.trackWidth(shown);
      let html = '';
      for (let l = 0; l < block.lines; l++) {
        const isCur = l === cur.line;
        const isBeat = l % 4 === 0;
        const sel = app.selection && l >= Math.min(app.selection.l0, app.selection.l1) && l <= Math.max(app.selection.l0, app.selection.l1);
        let cls = 'grid-row';
        if (isBeat) cls += ' beat';
        if (block.highlight && block.highlight[l]) cls += ' hl';
        if (isCur) cls += ' cur';
        if (sel) cls += ' sel';
        html += `<div class="${cls}" data-line="${l}"><div class="grid-num">${String(l).padStart(3, '0')}</div>`;

        for (let t = 0; t < shown; t++) {
          const c = block.rows[l][t];
          const muted = app.mutedTracks && app.mutedTracks[t] ? ' muted' : '';
          const focused = isCur && t === cur.track;

          const caret = f => (focused && cur.field === f ? '<span class="caret"></span>' : '');
          const noteTxt = c.note ? MW.noteName(c.note, MW.app.hb) : (c.ins ? '-|-' : '---');
          const insTxt = c.ins ? MW.insName(c.ins) : '00';

          /* OctaMED v4 and later show every command as two hex digits,
             so a cell is always instrument + command + data: six digits */
          const cmdTxt = c.cmd.toString(16).toUpperCase().padStart(2, '0');

          html += `<div class="track${muted}" data-track="${t}" style="width:${tw}px">`
            + `<span class="cell note" data-f="0">${noteTxt}${caret(0)}</span>`
            + '<span class="data-fields">'
            + `<span class="cell ins" data-f="1">${insTxt}${caret(1)}</span>`
            + `<span class="cell cmd" data-f="2">${cmdTxt}${caret(2)}</span>`
            + `<span class="cell dat" data-f="3">${MW.hex(c.dat)}${caret(3)}</span>`
            + '</span>'
            + '</div>';
        }
        html += '</div>';
      }

      this.el.innerHTML = html;
      this.rows = Array.from(this.el.querySelectorAll('.grid-row'));
      this.lastPlayLine = -1;
      this.updatePadding();
      this.centerLine(cur.line);
      this.placeMeters(shown);
      this.placeLines();
    },

    /* full-height column rules, through the blank space above and below */
    placeLines() {
      const overlay = document.getElementById('grid-lines');
      if (!overlay || !this.el) return;
      const row = this.el.querySelector('.grid-row');
      if (!row) return;
      const tracks = row.querySelectorAll('.track');
      if (overlay.children.length !== tracks.length) {
        overlay.innerHTML = Array.from({ length: tracks.length }, () => '<i></i>').join('');
      }
      const base = overlay.getBoundingClientRect();
      tracks.forEach((tr, i) => {
        const r = tr.getBoundingClientRect();
        overlay.children[i].style.left = (r.left - base.left) + 'px';
      });
    },

    /* level bars live in an overlay so they stay put while the grid scrolls */
    placeMeters(n) {
      const overlay = document.getElementById('ch-meters');
      if (!overlay || !this.el) return;
      const count = n || this.block().tracks;
      if (overlay.children.length !== count) {
        overlay.innerHTML = Array.from({ length: count }, (_, i) =>
          `<div class="ch-meter" data-track="${i}"></div>`).join('');
      }
      const row = this.el.querySelector('.grid-row');
      if (!row || !this.wrap) return;
      const wrapLeft = this.wrap.getBoundingClientRect().left - this.wrap.scrollLeft;
      row.querySelectorAll('.track').forEach((tr, i) => {
        const m = overlay.children[i];
        if (!m) return;
        const r = tr.getBoundingClientRect();
        m.style.left = Math.max(0, (r.right - wrapLeft - 36)) + 'px';
      });
    },

    /* enough blank space above and below that any line can sit in the
       middle of the display, the way the tracker shows the play head */
    updatePadding() {
      if (!this.el || !this.wrap) return;
      const pad = Math.max(0, Math.round(this.wrap.clientHeight / 2) - 12);
      this.el.style.paddingTop = pad + 'px';
      this.el.style.paddingBottom = pad + 'px';
    },

    /* Up/Down and the wheel/scrollbar move the tracker under the fixed
       centre line; the play head and cell box stay where they are */
    scrollRows(dy) {
      if (!this.wrap) return;
      const rh = this.rows[0] ? this.rows[0].offsetHeight : 25;
      this.wrap.scrollTop += dy * rh;
    },

    onScroll() {
      if (!this.rows.length || !this.wrap) return;
      const rh = this.rows[0].offsetHeight || 25;
      const pad = parseFloat(this.el.style.paddingTop) || 0;
      const raw = (this.wrap.scrollTop + this.wrap.clientHeight / 2 - pad - rh / 2) / rh;
      const line = MW.clamp(Math.round(raw), 0, this.rows.length - 1);
      if (line !== MW.app.cursor.line) {
        MW.app.cursor.line = line;
        this.refreshLine(line);
      } else {
        this.centerLine(line);
      }
    },

    centerLine(line) {
      const row = this.rows[line];
      if (!row || !this.wrap) return;
      this.updatePadding();
      const target = row.offsetTop + row.offsetHeight / 2 - this.wrap.clientHeight / 2;
      const max = Math.max(0, this.wrap.scrollHeight - this.wrap.clientHeight);
      this.wrap.scrollTop = MW.clamp(Math.round(target), 0, max);
      /* integer scroll can leave a few pixels; measure and remove them */
      for (let k = 0; k < 3; k++) {
        const r = row.getBoundingClientRect();
        const centre = this.wrap.getBoundingClientRect().top + this.wrap.clientHeight / 2;
        const delta = (r.top + r.height / 2) - centre;
        if (Math.abs(delta) < 0.5) break;
        const before = this.wrap.scrollTop;
        this.wrap.scrollTop = MW.clamp(Math.round(before + delta), 0, max);
        if (this.wrap.scrollTop === before) break;
      }
    },

    syncMeters(levels) {
      const meters = document.querySelectorAll('#ch-meters .ch-meter');
      if (!meters.length) return;
      const loop = levels || [];
      meters.forEach((m, i) => {
        const v = loop[i] || 0;
        m.style.height = Math.round(v * 100) + '%';
      });
    },

    trackWidth(tracks) {
      const avail = (this.wrap ? this.wrap.clientWidth : 900) - 84;
      const n = tracks || (this.block().tracks);
      /* the narrow cut carries more columns, so it can be squeezed further */
      return MW.clamp(Math.floor(avail / n), n > 4 ? 130 : 180, 300);
    },

    refreshLine(line) {
      if (!this.rows.length) return;
      if (this.lastPlayLine >= 0 && this.rows[this.lastPlayLine] && this.lastPlayLine !== line) {
        this.rows[this.lastPlayLine].classList.remove('playing');
      }
      if (line < 0) { this.lastPlayLine = -1; return; }
      const row = this.rows[line];
      if (!row) return;
      /* the play head line moves as one bar: clear the old one */
      this.el.querySelectorAll('.grid-row.cur').forEach(r => { if (r !== row) r.classList.remove('cur'); });
      row.classList.add('playing', 'cur');
      /* the box rides the play head line, at the current column */
      const caret = this.el.querySelector('.caret');
      const track = row.querySelector(`.track[data-track="${MW.app.cursor.track}"]`);
      let cell = track && track.querySelector(`.cell[data-f="${MW.app.cursor.field}"]`);
      if (!cell && track) cell = track.querySelector('.cell');
      if (cell) {
        if (caret) cell.appendChild(caret);
        else cell.insertAdjacentHTML('beforeend', '<span class="caret"></span>');
      }
      this.updatePadding();
      this.centerLine(line);
      this.lastPlayLine = line;
    },

    ensureVisible() {
      if (!this.wrap || !this.rows.length) return;
      const line = MW.app.cursor.line;
      const row = this.rows[line];
      if (!row) return;
      const top = row.offsetTop;
      const h = row.offsetHeight;
      const viewTop = this.wrap.scrollTop;
      const viewH = this.wrap.clientHeight;
      if (top < viewTop) this.wrap.scrollTop = top;
      else if (top + h > viewTop + viewH - 4) this.wrap.scrollTop = top + h - viewH + 4;
      /* keep whole rows on screen, the way a tracker scrolls */
      const rh = this.rows[0] ? this.rows[0].offsetHeight : 25;
      if (rh > 0) this.wrap.scrollTop = Math.round(this.wrap.scrollTop / rh) * rh;
    },

    cellAt(e) {
      const rowEl = e.target.closest('.grid-row');
      if (!rowEl) return null;
      const trackEl = e.target.closest('.track');
      return {
        line: parseInt(rowEl.dataset.line, 10),
        track: trackEl ? parseInt(trackEl.dataset.track, 10) : null,
        field: e.target.closest('.cell') ? parseInt(e.target.closest('.cell').dataset.f, 10) : 0
      };
    },

    onMouseDown(e) {
      const at = this.cellAt(e);
      if (!at) return;
      const app = MW.app;

      if (e.button === 2) {
        e.preventDefault();
        app.selection = { l0: at.line, l1: at.line, t0: at.track == null ? 0 : at.track, t1: at.track == null ? 0 : at.track };
        this.dragging = true;
        this.render();
        return;
      }
      if (e.button !== 0) return;

      /* the play head line stays put; clicking chooses the column */
      if (at.track != null) {
        app.cursor.track = at.track;
        app.cursor.field = at.field;
      }
      app.selection = null;
      this.refreshLine(app.cursor.line);
      MW.touchStatus('cursor');
    },

    onMouseMove(e) {
      if (!this.dragging || !MW.app.selection) return;
      const at = this.cellAt(e);
      if (!at) return;
      const s = MW.app.selection;
      s.l1 = at.line;
      if (at.track != null) s.t1 = at.track;
      this.render();
    }
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
