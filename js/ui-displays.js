/* Octanaut - big displays: instrument list, sample editor, synth editor, notation */
(function (global) {
  'use strict';
  const MW = global.MW;

  const displays = MW.displays = {
    current: 'grid',

    show(name) {
      this.current = name;
      const host = document.getElementById('display-body');
      document.querySelectorAll('#display-tabs button').forEach(b => {
        b.classList.toggle('active', b.dataset.display === name);
      });
      document.getElementById('display-meta').textContent = '';
      if (name === 'grid') { MW.grid.mount(host); return; }
      if (name === 'list') return this.renderList(host);
      if (name === 'sample') return this.renderSample(host);
      if (name === 'synth') return this.renderSynth(host);
      if (name === 'notation') return this.renderNotation(host);
    },

    refresh() {
      if (this.current === 'grid') { MW.grid.render(); return; }
      this.show(this.current);
    },

    inst() {
      const app = MW.app;
      return app.song.instruments[app.currentIns - 1];
    },

    /* ---------------------------------------------------------- list */

    renderList(host) {
      const app = MW.app;
      const song = app.song;
      const rows = [];
      for (let i = 0; i < 63; i++) {
        const inst = song.instruments[i];
        if (!inst) continue;
        const cls = i + 1 === app.currentIns ? ' class="cur"' : '';
        rows.push(`<tr${cls} data-ins="${i + 1}">
          <td class="mono">${MW.insName(i + 1)}</td>
          <td>${escapeHtml(inst.name || 'unnamed')}</td>
          <td><span class="tag ${inst.type}">${inst.type}</span></td>
          <td class="mono">${inst.data ? (inst.bits16 ? '16' : '8') + (inst.stereo16 ? 's' : 'm') : '-'}</td>
          <td class="mono">${inst.data ? inst.data.length : (inst.synth ? inst.synth.waveforms.length + ' wf' : '-')}</td>
          <td class="mono">${inst.looplen > 2 ? inst.loop + '+' + inst.looplen : '-'}</td>
          <td class="mono">${inst.volume}</td>
          <td class="mono">${inst.hold || 0}/${inst.decay || 0}</td>
        </tr>`);
      }
      host.innerHTML = `<div class="pane">
        <h2>Instruments</h2>
        <p class="lede">${song.instruments.filter(Boolean).length} slots in use, shared by every song in the module. Click one to make it the keyboard instrument.</p>
        <table class="ins-table">
          <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Depth</th><th>Size</th><th>Loop</th><th>Vol</th><th>Hold/Dec</th></tr></thead>
          <tbody>${rows.join('') || '<tr><td colspan="8">empty</td></tr>'}</tbody>
        </table>
      </div>`;
      host.querySelectorAll('tr[data-ins]').forEach(tr => {
        tr.onclick = () => {
          MW.app.currentIns = parseInt(tr.dataset.ins, 10);
          MW.app.sampleView = null;
          MW.panels.refresh();
          this.show('list');
          MW.emit('instrument', MW.app.currentIns);
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
      if (!inst || !inst.data) {
        host.innerHTML = `<div class="empty">No sample in slot ${MW.insName(app.currentIns)}.<br>Load a raw sample or an IFF 8SVX from the Instr panel.</div>`;
        return;
      }
      const d = inst.data;
      const view = this.view(inst);
      const sel = inst._sel && inst._sel.b <= d.length ? inst._sel : null;

      host.innerHTML = `<div class="pane">
        <h2>${escapeHtml(inst.name || 'sample')} — ${d.length} bytes — showing ${view.a} to ${view.b}</h2>
        <p class="lede">Drag to select. ${sel ? `Selected ${Math.min(sel.a, sel.b)} to ${Math.max(sel.a, sel.b)}.` : 'No selection.'}</p>
        <div class="wave-wrap"><canvas id="wave"></canvas></div>
        <div class="panel-row" style="margin-top:10px">
          <div class="group"><div class="group-label">View</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-zoomin">Zoom in</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-zoomout">Zoom out</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-showrange">Show range</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-showall">Show all</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Range</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-play">Play</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-playrange">Play range</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-loop">Loop ${inst.looplen > 2 ? 'on' : 'off'}</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Edit</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-rev">Reverse</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-norm">Normalise</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-fadein">Fade in</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-fadeout">Fade out</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-crop">Crop</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-filter">Filter</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-boost">Boost</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Effects</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-echo">Echo</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-noise">Noise</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-mix">Mix</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-copyall">S&gt;Buffer</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-restore">Buffer&gt;S</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-tosynth">R&gt;SY</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Sample</div>
            <div class="group-row">
              <span class="preadout">size</span>
              <input class="pnum" id="buffsize" type="number" min="1" max="131072" value="${d.length}">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-buffsize">Set</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-rate-up">Oct +</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-rate-down">Oct −</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Input</div>
            <div class="group-row">
              <select class="pselect" id="samp-src" style="max-width:210px">
                <option value="mic">Microphone</option>
                <option value="system">System audio (share screen)</option>
                <option value="app">This app's output</option>
                ${(MW.sampler.devices || []).map((d, i) =>
                  `<option value="${d.deviceId}">${escapeHtml(d.label || 'input ' + (i + 1))}</option>`).join('')}
              </select>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-devices">Find</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-monitor">Monitor</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-record">Record</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-stop">Stop</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Loop</div>
            <div class="group-row">
              <input class="pnum" id="loop-start" type="number" min="0" value="${inst.loop || 0}">
              <input class="pnum" id="loop-len" type="number" min="0" value="${inst.looplen || 0}">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-loopset">From range</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-zleft">&lt;0</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="samp-zright">0&gt;</button>
            </div>
          </div>
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
      canvas.onmousedown = e => {
        if (e.button === 2) { inst._sel = null; this.show('sample'); return; }
        dragging = true;
        inst._sel = { a: xToSample(e.clientX), b: xToSample(e.clientX) };
        draw();
      };
      canvas.onmousemove = e => {
        if (!dragging) return;
        inst._sel.b = xToSample(e.clientX);
        draw();
      };
      canvas.oncontextmenu = e => { e.preventDefault(); inst._sel = null; this.show('sample'); };
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        if (inst._sel) this.show('sample');
      }, { once: true });

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
          if (act === 'samp-zoomin' || act === 'samp-zoomout' || act === 'samp-showall' || act === 'samp-showrange') {
            this.zoom(inst, act, range());
            return;
          }
          if (act === 'samp-playrange') { this.playRange(inst, range()); return; }
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
          const [a, b] = range();
          const result = MW.ops.sampleEdit(act, inst, a, b, { delay: 2000, count: 3, level: 24 });
          if (result !== false) this.show('sample');
        };
      });

      host.querySelector('#loop-start').onchange = e => {
        inst.loop = Math.max(0, parseInt(e.target.value, 10) || 0);
        draw();
      };
      host.querySelector('#loop-len').onchange = e => {
        inst.looplen = Math.max(0, parseInt(e.target.value, 10) || 0);
        draw();
      };
      host.querySelector('[data-act="samp-loopset"]').onclick = () => {
        const [a, b] = range();
        inst.loop = a;
        inst.looplen = b - a;
        this.show('sample');
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

    playRange(inst, range) {
      const [a, b] = range;
      MW.voicePreview(25, MW.app.currentIns);
      MW.toast(`Range ${a} to ${b}`);
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
        ctx.fillStyle = 'rgba(70,192,122,0.2)';
        const x0 = Math.max(0, toX(a)), x1 = Math.min(w, toX(b));
        ctx.fillRect(x0, 0, Math.max(0, x1 - x0), h);
      }

      const mid = h / 2;
      ctx.strokeStyle = '#1e1e1e';
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

      if (inst.looplen > 2) {
        const x0 = toX(inst.loop), x1 = toX(inst.loop + inst.looplen);
        ctx.fillStyle = 'rgba(255,204,85,0.09)';
        ctx.fillRect(x0, 0, x1 - x0, h);
        ctx.strokeStyle = '#8a6a33';
        ctx.beginPath();
        ctx.moveTo(x0, 0); ctx.lineTo(x0, h);
        ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
        ctx.stroke();
      }

      ctx.strokeStyle = '#ffcc55';
      ctx.lineWidth = 1;
      if (span <= w) {
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

      const rowsFor = (tbl, names, list) => tbl.map((b, i) => {
        const name = names[b];
        const isCmd = !!name;
        const cur = (app.synthSel && app.synthSel.list === list && app.synthSel.index === i) ? ' cur' : '';
        return `<div class="syn-row${cur}" data-list="${list}" data-idx="${i}">
          <span class="seq-ix">${MW.hex(i)}</span>
          <span class="seq-op">${isCmd ? name : ''}</span>
          <span class="seq-arg">${isCmd ? '' : MW.hex(b)}</span></div>`;
      }).join('');

      host.innerHTML = `<div class="pane">
        <h2>Synthsound — ${syn.waveforms.length} waveform${syn.waveforms.length === 1 ? '' : 's'}, editing ${side === 'bank' ? 'waveform ' + MW.hex(wfIdx) : 'the buffer'}</h2>
        <p class="lede">Two waveform displays, as on the Amiga: the bank on the left, a scratch buffer on the right. Click a display to edit it.</p>
        <div class="synth-pair">
          <div class="synth-side${side === 'bank' ? ' active' : ''}" data-side="bank">
            <div class="wave-wrap"><canvas id="wave-bank"></canvas></div>
            <div class="group-row" style="margin-top:4px">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-prev">‹</button>
              <span class="preadout">wf ${MW.hex(wfIdx)} / ${MW.hex(syn.waveforms.length - 1)} · ${wave.length} bytes</span>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-next">›</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-add">Add</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-del">Del</button>
            </div>
          </div>
          <div class="synth-side${side === 'buffer' ? ' active' : ''}" data-side="buffer">
            <div class="wave-wrap"><canvas id="wave-buffer"></canvas></div>
            <div class="group-row" style="margin-top:4px">
              <span class="preadout">buffer · ${syn.buffer.length} bytes</span>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-copy-right">→ buf</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-copy-left">← wf</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-exchange">⇄</button>
            </div>
          </div>
        </div>
        <div class="panel-row" style="margin-top:8px">
          <div class="group"><div class="group-label">Shapes (on the active display)</div>
            <div class="group-row">
              ${['sine', 'saw', 'pulse', 'triangle', 'random'].map(s => `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-shape="${s}">${s}</button>`).join('')}
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-undo">Undo</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-mix">Mix</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-addwave">Add together</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Transform</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-tstart">Start here</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-tdo">Do</button>
              <span class="preadout">${MW.app.synthTransform == null ? 'no start' : 'from wf ' + MW.hex(MW.app.synthTransform)}</span>
            </div>
          </div>
          <div class="group"><div class="group-label">Speeds</div>
            <div class="group-row">
              <span class="preadout">vol</span><input class="pnum" type="number" min="1" max="16" value="${syn.volspeed}" data-act="syn-vspd">
              <span class="preadout">wf</span><input class="pnum" type="number" min="1" max="16" value="${syn.wfspeed}" data-act="syn-wspd">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="syn-play">Play</button>
            </div>
          </div>
        </div>
        <div class="synth-lists">
          <div><h2>Volume sequence</h2><div class="seq-list">${rowsFor(syn.voltbl, MW.synthNames.vol, 'vol')}</div></div>
          <div><h2>Waveform sequence</h2><div class="seq-list">${rowsFor(syn.wftbl, MW.synthNames.wf, 'wf')}</div></div>
        </div>
        <div class="panel-row" style="margin-top:8px">
          <div class="group"><div class="group-label">Step ${MW.hex((app.synthSel && app.synthSel.index) || 0)} of the ${(app.synthSel && app.synthSel.list) === 'wf' ? 'waveform' : 'volume'} list</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-seq="dec">−1</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-seq="inc">+1</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-seq="ins">Insert</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-seq="del">Delete</button>
            </div>
          </div>
        </div>
      </div>`;

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
        if (syn.waveforms.length >= 64) return MW.toast('64 waveforms is the limit', true);
        syn.waveforms.splice(wfIdx + 1, 0, new Float32Array(wave.length));
        mark();
        app.synthWave = wfIdx + 1;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-del"]').onclick = () => {
        if (syn.waveforms.length <= 1) return MW.toast('Keep at least one waveform', true);
        syn.waveforms.splice(wfIdx, 1);
        mark();
        app.synthWave = Math.max(0, wfIdx - 1);
        this.show('synth');
      };

      const target = () => (app.synthSide === 'buffer' ? syn.buffer : syn.waveforms[wfIdx]);

      host.querySelectorAll('[data-shape]').forEach(b => {
        b.onclick = () => {
          const cur = target();
          const next = shape(b.dataset.shape, cur ? cur.length : 32);
          if (app.synthSide === 'buffer') syn.buffer = next;
          else { syn._undo = Float32Array.from(syn.waveforms[wfIdx]); syn.waveforms[wfIdx] = next; }
          mark();
          this.show('synth');
        };
      });

      host.querySelector('[data-act="syn-undo"]').onclick = () => {
        if (!syn._undo) return MW.toast('Nothing to undo', true);
        syn.waveforms[wfIdx] = syn._undo;
        syn._undo = null;
        mark();
        this.show('synth');
      };

      host.querySelector('[data-act="syn-copy-right"]').onclick = () => {
        syn.buffer = Float32Array.from(wave);
        this.show('synth');
      };
      host.querySelector('[data-act="syn-copy-left"]').onclick = () => {
        syn._undo = Float32Array.from(syn.waveforms[wfIdx]);
        syn.waveforms[wfIdx] = Float32Array.from(syn.buffer);
        mark();
        this.show('synth');
      };
      host.querySelector('[data-act="syn-exchange"]').onclick = () => {
        const tmp = Float32Array.from(syn.waveforms[wfIdx]);
        syn.waveforms[wfIdx] = Float32Array.from(syn.buffer);
        syn.buffer = tmp;
        mark();
        this.show('synth');
      };
      host.querySelector('[data-act="syn-mix"]').onclick = () => {
        const n = Math.min(wave.length, syn.buffer.length);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = (wave[i] + syn.buffer[i]) / 2;
        syn.buffer = out;
        this.show('synth');
      };
      host.querySelector('[data-act="syn-addwave"]').onclick = () => {
        const n = Math.min(wave.length, syn.buffer.length);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) out[i] = MW.clamp(wave[i] + syn.buffer[i], -128, 127);
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

      host.querySelectorAll('.syn-row').forEach(row => {
        row.onclick = () => {
          app.synthSel = { list: row.dataset.list, index: parseInt(row.dataset.idx, 10) };
          this.show('synth');
        };
      });

      host.querySelectorAll('[data-seq]').forEach(btn => {
        btn.onclick = () => {
          const s = app.synthSel || { list: 'vol', index: 0 };
          const tbl = s.list === 'vol' ? syn.voltbl : syn.wftbl;
          const at = Math.min(s.index, tbl.length - 1);
          const step = btn.dataset.seq;
          if (step === 'inc') tbl[at] = Math.min(0xff, tbl[at] + 1);
          else if (step === 'dec') tbl[at] = Math.max(0, tbl[at] - 1);
          else if (step === 'ins') { if (tbl.length < 126) tbl.splice(at + 1, 0, 0x00); }
          else if (step === 'del') { if (tbl.length > 1) tbl.splice(at, 1); }
          mark();
          this.show('synth');
        };
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
      ctx.strokeStyle = '#1e1e1e';
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      if (!wf || wf.length < 2) {
        ctx.fillStyle = '#4a4642';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('empty', 8, 14);
        return;
      }
      ctx.strokeStyle = '#46c07a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < wf.length; i++) {
        const x = (i / (wf.length - 1)) * (w - 2) + 1;
        const y = h / 2 - (wf[i] / 128) * (h / 2 - 8);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#5d564d';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(wf.length + ' bytes', 8, 14);
    },

    /* ---------------------------------------------------------- notation */

    renderNotation(host) {
      const app = MW.app;
      const block = app.song.blocks[app.cursor.block];
      const tracks = Math.min(4, block.tracks);
      host.innerHTML = `<div class="pane">
        <h2>Notation — block ${MW.hex(app.cursor.block)}</h2>
        <p class="lede">Click a staff to place a note. One text line is a sixteenth; four lines to the beat.</p>
        <div class="panel-row">
          <div class="group"><div class="group-label">Length</div>
            <div class="group-row">
              ${[1, 2, 3, 4, 6, 8, 12, 16].map(n =>
                `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${app.noteLen === n ? ' on' : ''}" data-len="${n}">${n}</button>`).join('')}
            </div>
          </div>
          <div class="group"><div class="group-label">Tracks</div>
            <div class="group-row">
              ${Array.from({ length: tracks }, (_, t) => {
                const on = app.notaTracks ? app.notaTracks[t] !== false : true;
                return `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${on ? ' on' : ''}" data-notatrack="${t}">${t.toString(16).toUpperCase()}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="group"><div class="group-label">Time</div>
            <div class="group-row">
              ${[3, 4].map(n => `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${(app.timeSig || 4) === n ? ' on' : ''}" data-time="${n}">${n}/4</button>`).join('')}
            </div>
          </div>
          <div class="group"><div class="group-label">Key</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="nota-flat">♭</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="nota-sharp">♯</button>
              <span class="preadout">${(app.keySig && app.keySig.count) || 0}</span>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="nota-keyless">None</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Presets</div>
            <div class="group-row">
              ${[0,1,2,3,4].map(n => `<button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${(app.pset || 0) === n ? ' on' : ''}" data-pset="${n}">${n + 1}</button>`).join('')}
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="pset-save">Save</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="pset-clear">Clr</button>
            </div>
          </div>
          <div class="group"><div class="group-label">Page</div>
            <div class="group-row">
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${app.notaPrintAll === false ? '' : ' on'}" data-act="nota-all">All blocks</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper${app.notaFeed ? ' on' : ''}" data-act="nota-feed">FFeed</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="nota-print">Print</button>
              <button class="flex h-[26px] items-center justify-center border border-ink bg-paper px-2 text-[14px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper" data-act="nota-clear">Clear track</button>
            </div>
          </div>
        </div>
        <div class="sheet-wrap"><canvas id="sheet"></canvas></div>
      </div>`;
      const canvas = host.querySelector('#sheet');
      this.drawSheet(canvas, block, tracks);

      host.querySelectorAll('[data-len]').forEach(b => {
        b.onclick = () => { app.noteLen = parseInt(b.dataset.len, 10); this.show('notation'); };
      });
      host.querySelectorAll('[data-notatrack]').forEach(b => {
        b.onclick = () => {
          const t = parseInt(b.dataset.notatrack, 10);
          app.notaTracks = app.notaTracks || {};
          app.notaTracks[t] = app.notaTracks[t] === false;
          this.show('notation');
        };
      });
      host.querySelectorAll('[data-time]').forEach(b => {
        b.onclick = () => { app.timeSig = parseInt(b.dataset.time, 10); this.show('notation'); };
      });
      host.querySelector('[data-act="nota-sharp"]').onclick = () => {
        const k = app.keySig = app.keySig || { count: 0, flat: false };
        k.flat = false; k.count = Math.min(6, k.count + 1);
        this.show('notation');
      };
      host.querySelector('[data-act="nota-flat"]').onclick = () => {
        const k = app.keySig = app.keySig || { count: 0, flat: false };
        k.flat = true; k.count = Math.min(6, k.count + 1);
        this.show('notation');
      };
      host.querySelector('[data-act="nota-keyless"]').onclick = () => {
        app.keySig = { count: 0, flat: false };
        this.show('notation');
      };
      host.querySelectorAll('[data-pset]').forEach(b => {
        b.onclick = () => {
          const n = parseInt(b.dataset.pset, 10);
          app.pset = n;
          const saved = app.psets && app.psets[n];
          app.notaTracks = saved ? JSON.parse(JSON.stringify(saved)) : {};
          this.show('notation');
        };
      });
      host.querySelector('[data-act="pset-save"]').onclick = () => {
        app.psets = app.psets || [null, null, null, null, null];
        app.psets[app.pset || 0] = JSON.parse(JSON.stringify(app.notaTracks || {}));
        MW.toast('Preset ' + ((app.pset || 0) + 1) + ' saved');
      };
      host.querySelector('[data-act="pset-clear"]').onclick = () => {
        app.psets = app.psets || [null, null, null, null, null];
        app.psets[app.pset || 0] = null;
        app.notaTracks = {};
        this.show('notation');
      };
      host.querySelector('[data-act="nota-all"]').onclick = () => {
        app.notaPrintAll = app.notaPrintAll === false;
        this.show('notation');
      };
      host.querySelector('[data-act="nota-feed"]').onclick = () => {
        app.notaFeed = !app.notaFeed;
        this.show('notation');
      };
      host.querySelector('[data-act="nota-print"]').onclick = () => this.printNotation();
      host.querySelector('[data-act="nota-clear"]').onclick = () => {
        const b = block;
        b.rows.forEach(r => { if (r[app.cursor.track]) MW.clearCell(r[app.cursor.track]); });
        MW.refreshAll();
      };

      canvas.onclick = e => this.sheetClick(e, block);
    },

    drawSheet(canvas, block, tracks, widthOverride) {
      const dpr = widthOverride ? 2 : (window.devicePixelRatio || 1);
      const width = widthOverride || Math.max(320, canvas.parentElement.clientWidth - 44);
      const perMeasure = (MW.app.timeSig || 4) * 4;
      const lines = block.lines;
      const measures = Math.ceil(lines / perMeasure);
      const staffGap = 92;
      const measPerRow = Math.max(1, Math.min(4, Math.floor(width / 220)));
      const measureW = (width - 40) / measPerRow;
      const rows = Math.ceil(measures / measPerRow);
      const height = rows * tracks * staffGap + 30;

      canvas.style.height = height + 'px';
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#f2ece0';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#1b1917';
      ctx.fillStyle = '#1b1917';

      const layout = { width, height, staffGap, measureW, measPerRow, tracks, rows, perMeasure };
      const steps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
      const notePos = note => {
        const idx = ((note - 1) % 12 + 12) % 12;
        const oct = Math.floor((note - 1) / 12);
        return oct * 7 + steps[idx];
      };

      for (let m = 0; m < measures; m++) {
        const row = Math.floor(m / measPerRow);
        const col = m % measPerRow;
        const x0 = 20 + col * measureW + (col ? 10 : 0);
        for (let t = 0; t < tracks; t++) {
          if (MW.app.notaTracks && MW.app.notaTracks[t] === false) continue;
          const baseY = 52 + (row * tracks + t) * staffGap;
          ctx.lineWidth = 0.7;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x0, baseY - i * 8);
            ctx.lineTo(x0 + measureW - 20, baseY - i * 8);
            ctx.stroke();
          }
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = '#6b6357';
          ctx.fillText('trk ' + t.toString(16).toUpperCase(), x0, baseY + 22);
          ctx.fillStyle = '#1b1917';

          for (let l = m * perMeasure; l < Math.min(block.lines, m * perMeasure + perMeasure); l++) {
            const cell = block.rows[l][t];
            if (!cell || !cell.note) continue;
            const x = x0 + ((l % perMeasure) / perMeasure) * (measureW - 20) + 6;
            const y = baseY - notePos(cell.note) * 4;
            ctx.beginPath();
            ctx.ellipse(x, y, 4.2, 3.2, -0.2, 0, Math.PI * 2);
            ctx.fill();
            if (cell.note % 12 === 0) {
              ctx.beginPath();
              ctx.moveTo(x + 4, y);
              ctx.lineTo(x + 4, y - 24);
              ctx.stroke();
            }
          }
        }
      }
      this._sheet = layout;
    },

    printNotation() {
      const app = MW.app;
      const blocks = app.notaPrintAll === false
        ? [app.song.blocks[app.cursor.block]]
        : app.song.blocks;

      const sheet = document.createElement('div');
      sheet.className = 'print-sheet';

      blocks.forEach((blk, i) => {
        const page = document.createElement('div');
        page.className = 'print-page' + (app.notaFeed && i < blocks.length - 1 ? ' feed' : '');
        const head = document.createElement('div');
        head.className = 'print-head';
        head.textContent = `${app.song.name || 'untitled'} — block ${MW.hex(i)}`;
        page.appendChild(head);
        const c = document.createElement('canvas');
        page.appendChild(c);
        sheet.appendChild(page);
        this.drawSheet(c, blk, Math.min(4, blk.tracks), 760);
      });

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

    sheetClick(e, block) {
      const app = MW.app;
      const layout = this._sheet;
      if (!layout) return;
      const canvas = e.currentTarget;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

      const row = Math.floor((y - 20) / (layout.tracks * layout.staffGap));
      const within = (y - 20) - row * layout.tracks * layout.staffGap;
      const t = Math.floor(within / layout.staffGap);
      if (row < 0 || t < 0 || t >= layout.tracks) return;

      const baseY = 52 + (row * layout.tracks + t) * layout.staffGap;
      const col = Math.min(layout.measPerRow - 1, Math.max(0, Math.floor((x - 20) / layout.measureW)));
      const x0 = 20 + col * layout.measureW + (col ? 10 : 0);
      const fx = (x - x0 - 6) / (layout.measureW - 20);
      if (fx < 0 || fx > 1) return;

      const per = layout.perMeasure || 16;
      const line = Math.min(block.lines - 1, Math.round(col * per + fx * per));
      const pos = Math.round((baseY - y) / 4);
      const steps = [0, 2, 4, 5, 7, 9, 11];
      const oct = Math.floor(pos / 7);
      const note = MW.clamp(oct * 12 + 1 + steps[((pos % 7) + 7) % 7], 1, 96);

      if (!app.editMode) {
        MW.voicePreview(note, app.currentIns);
        return;
      }

      block.rows[line][t].note = note;
      block.rows[line][t].ins = app.currentIns;
      MW.refreshAll();
      MW.toast(MW.noteName(note, app.hb) + ' at line ' + MW.hex(line));
    }
  };

  function shape(kind, n) {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let v = 0;
      if (kind === 'sine') v = Math.sin(t * Math.PI * 2) * 127;
      else if (kind === 'saw') v = (t * 2 - 1) * 127;
      else if (kind === 'pulse') v = t < 0.5 ? 110 : -110;
      else if (kind === 'triangle') v = (Math.abs(t * 4 - 2) - 1) * 127;
      else v = (Math.random() * 2 - 1) * 127;
      a[i] = v;
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  MW.escapeHtml = escapeHtml;

})(typeof globalThis !== 'undefined' ? globalThis : this);
