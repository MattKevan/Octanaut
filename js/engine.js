/* Octanaut - audio engine.
 *
 * A tracker tick scheduler driving Web Audio voices. Each tick schedules
 * volume and playback-rate values at an absolute time, the way the Amiga
 * wrote volume and period registers from its timer interrupt.
 */
(function (global) {
  'use strict';
  const MW = global.MW;

  const SINE = new Float32Array(64);
  for (let i = 0; i < 64; i++) SINE[i] = Math.sin((i / 64) * Math.PI * 2);

  const audio = MW.audio = {
    ctx: null,
    master: null,
    limiter: null,
    filter: null,
    buses: null,
    ready: false,

    init() {
      if (this.ctx) return this.ctx;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) {
        MW.toast('This browser has no Web Audio support', true);
        return null;
      }
      let ctx;
      try {
        ctx = new Ctx({ latencyHint: 'interactive' });
      } catch (e) {
        try {
          ctx = new Ctx();
        } catch (e2) {
          MW.toast('Audio could not start: ' + e2.message, true);
          return null;
        }
      }
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 16000;
      this.filter.Q.value = 0.4;
      this.limiter = ctx.createWaveShaper();
      const curve = new Float32Array(4096);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.35) * 0.96;
      }
      this.limiter.curve = curve;
      this.limiter.oversample = '2x';
      this.filter.connect(this.master);
      this.master.connect(this.limiter);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.limiter.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.ready = true;
      return ctx;
    },

    level() {
      const buf = this.waveform();
      if (!buf) return 0;
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      return Math.sqrt(sum / buf.length);
    },

    /* Safari will not start a context that was not created inside a gesture,
       and it stays suspended without complaint. Create and resume it on the
       first touch of the page, then again whenever it falls back to sleep. */
    unlock() {
      const ctx = this.init();
      if (!ctx) return false;
      if (ctx.state === 'running') { this.unlocked = true; return true; }
      const p = ctx.resume();
      if (p && p.then) {
        p.then(() => {
          this.unlocked = ctx.state === 'running';
          if (this.unlocked && MW.player.playing) {
            MW.player.nextTime = ctx.currentTime + 0.05;
          }
        }).catch(() => {});
      }
      return ctx.state === 'running';
    },

    resume() {
      if (this.unlock()) return;
      if (this._gestureHooked) return;
      this._gestureHooked = true;
      const retry = () => {
        if (this.unlock() && MW.player.playing) {
          MW.player.nextTime = this.ctx.currentTime + 0.05;
        }
      };
      document.addEventListener('pointerdown', retry, true);
      document.addEventListener('keydown', retry, true);
      document.addEventListener('touchstart', retry, true);
    },

    /* one waveform frame, or null. Safari before 14.1 has no float variant. */
    waveform() {
      const a = this.analyser;
      if (!a) return null;
      const n = a.fftSize;
      if (typeof a.getFloatTimeDomainData === 'function') {
        if (!this._waveF || this._waveF.length !== n) this._waveF = new Float32Array(n);
        a.getFloatTimeDomainData(this._waveF);
        return this._waveF;
      }
      if (typeof a.getByteTimeDomainData === 'function') {
        if (!this._waveB || this._waveB.length !== n) this._waveB = new Uint8Array(n);
        a.getByteTimeDomainData(this._waveB);
        if (!this._waveF || this._waveF.length !== n) this._waveF = new Float32Array(n);
        for (let i = 0; i < n; i++) this._waveF[i] = (this._waveB[i] - 128) / 128;
        return this._waveF;
      }
      return null;
    },

    /* One analyser + panner per track, so the scopes and meters can read
       the real signal of that channel instead of guessing from volume. */
    channelBus(i) {
      const ctx = this.init();
      if (!ctx) return null;
      if (!this.buses) this.buses = [];
      if (!this.buses[i]) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.08;
        let pan = null;
        if (ctx.createStereoPanner) {
          pan = ctx.createStereoPanner();
          analyser.connect(pan);
          pan.connect(this.filter);
        } else {
          analyser.connect(this.filter);
        }
        this.buses[i] = { analyser, pan, data: new Float32Array(analyser.fftSize) };
      }
      return this.buses[i];
    },

    channelWave(i) {
      const bus = this.buses && this.buses[i];
      if (!bus) return null;
      const a = bus.analyser;
      if (typeof a.getFloatTimeDomainData === 'function') {
        a.getFloatTimeDomainData(bus.data);
        return bus.data;
      }
      if (typeof a.getByteTimeDomainData === 'function') {
        a.getByteTimeDomainData(bus.bytes || (bus.bytes = new Uint8Array(a.fftSize)));
        for (let k = 0; k < bus.bytes.length; k++) bus.data[k] = (bus.bytes[k] - 128) / 128;
        return bus.data;
      }
      return null;
    },

    channelRms(i) {
      const wave = this.channelWave(i);
      if (!wave) return 0;
      let sum = 0;
      for (let k = 0; k < wave.length; k++) sum += wave[k] * wave[k];
      return Math.sqrt(sum / wave.length);
    },

    testTone() {
      const ctx = this.init();
      if (!ctx) return;
      this.unlock();
      const t = ctx.currentTime + 0.02;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.setValueAtTime(0.18, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
      MW.toast(`Test tone: ${ctx.state}, ${ctx.sampleRate} Hz, ${this.analyser ? 'analyser ok' : 'no analyser'}`);
    },

    describe() {
      const ctx = this.ctx;
      if (!ctx) return 'not started';
      return `${ctx.state} · ${ctx.sampleRate} Hz · ${ctx.baseLatency ? ctx.baseLatency.toFixed(3) + ' s' : ''}`;
    },

    setFilter(on) {
      if (!this.filter) return;
      this.filter.frequency.setTargetAtTime(on ? 2400 : 16000, this.ctx.currentTime, 0.03);
    }
  };

  const player = MW.player = {
    song: null,
    playing: false,
    blockOnly: false,

    seqPos: 0,
    blockIdx: 0,
    line: 0,
    tick: 0,

    tempo: 33,
    tempo2: 6,
    pulse: 0.02,

    nextTime: 0,
    timer: null,
    channels: [],
    hwVol: [64, 64, 64, 64],

    jumpNext: false,
    pendingSeq: null,
    pendingLine: null,

    authentic: false,
    follow: false,
    onRow: null,
    onStop: null,

    /* ---------------------------------------------------------- setup */

    setSong(song) {
      this.stop();
      this.song = song;
      this.seqPos = 0;
      this.blockIdx = song.playseq[0] || 0;
      this.line = 0;
      this.tick = 0;
      this.tempo = song.deftempo || 33;
      this.tempo2 = song.tempo2 || 6;
      this.hwVol = [64, 64, 64, 64];
      this.channels = [];
      for (let i = 0; i < 16; i++) this.channels.push(this.newChannel(i));
    },

    newChannel(i) {
      return {
        idx: i,
        inst: null,
        note: 0,
        period: 0,
        target: 0,
        volume: 64,
        cmd: 0,
        dat: 0,
        src: null,
        gain: null,
        rate: 1,
        vibPos: 0,
        vibSpeed: 0,
        vibDepth: 0,
        portaSpeed: 0,
        noteOn: false,
        muted: false,
        holdLeft: -1,
        decayLeft: -1,
        decayRate: 0
      };
    },

    /* ---------------------------------------------------------- transport */

    play(fromStart, blockIdx) {
      const ctx = audio.init();
      if (!ctx || !this.song) return;
      audio.unlock();
      this.errors = 0;
      this.blockOnly = typeof blockIdx === 'number';
      if (typeof blockIdx === 'number') {
        this.blockIdx = blockIdx;
        this.line = 0;
        this.tick = 0;
        this.channels.forEach(c => this.silence(c, ctx.currentTime));
      } else if (fromStart !== false) {
        this.seqPos = 0;
        this.blockIdx = this.song.playseq[0] || 0;
        this.line = 0;
        this.tick = 0;
        this.tempo = this.song.deftempo || 33;
        this.tempo2 = this.song.tempo2 || 6;
        this.channels.forEach(c => { c.volume = 64; c.noteOn = false; this.silence(c, ctx.currentTime); });
      }
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
        setTimeout(() => {
          if (ctx.state !== 'running' && this.playing) {
            MW.toast('Audio is held back until you click the page once', true);
          }
        }, 200);
      }
      this.playing = true;
      this.jumpNext = false;
      this.pendingSeq = null;
      this.pendingLine = null;
      this.nextTime = ctx.currentTime + 0.06;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.schedule(), 20);
      this.schedule();
      MW.emit('transport', { playing: true });
    },

    playBlock(blockIdx) {
      this.play(true, typeof blockIdx === 'number' ? blockIdx : 0);
    },

    stop() {
      clearInterval(this.timer);
      this.timer = null;
      const wasPlaying = this.playing;
      this.playing = false;
      this.blockOnly = false;
      const ctx = audio.ctx;
      if (ctx) this.channels.forEach(c => this.silence(c, ctx.currentTime + 0.01));
      if (wasPlaying) MW.emit('transport', { playing: false });
      if (this.onStop) this.onStop();
    },

    /* ---------------------------------------------------------- scheduling */

    schedule() {
      const ctx = audio.ctx;
      if (!ctx || !this.playing) return;
      const horizon = ctx.currentTime + 0.14;
      let guard = 0;
      while (this.nextTime < horizon && this.playing && guard++ < 600) {
        try {
          this.step(this.nextTime);
        } catch (err) {
          this.errors = (this.errors || 0) + 1;
          if (this.errors === 1 && MW.toast) MW.toast('Playback error: ' + err.message, true);
          if (this.errors > 40) { this.stop(); return; }
        }
        this.nextTime += this.pulse;
      }
    },

    step(time) {
      const song = this.song;
      if (!song) return;
      this.pulse = MW.pulseSeconds(this.tempo, this.tempo2, this.song.bpmMode, this.song.linesPerBeat);

      const block = song.blocks[this.blockIdx];
      if (!block) { this.stop(); return; }

      if (this.tick === 0) {
        this.readLine(block, time);
        if (this.onRow) this.onRow({ block: this.blockIdx, line: this.line, seq: this.seqPos });
      }

      if (this.sync && MW.midi && MW.midi.enabled) {
        const interval = (this.pulse * Math.max(1, this.tempo2)) / 6;
        this.syncAcc = (this.syncAcc || 0) + this.pulse;
        let guard = 0;
        while (this.syncAcc >= interval && guard++ < 48) {
          MW.midi.send([0xf8]);
          this.syncAcc -= interval;
        }
      }

      const nch = Math.min(16, block.tracks);
      for (let i = 0; i < nch; i++) this.channelTick(this.channels[i], time);

      this.tick++;

      if (this.jumpNext) {
        this.jumpNext = false;
        const ln = this.pendingLine || 0;
        this.pendingLine = null;
        this.tick = 0;
        this.line = 0;
        this.advanceSeq();
        const nb = this.song.blocks[this.blockIdx];
        if (nb && ln > 0 && ln < nb.lines) this.line = ln;
        return;
      }

      if (this.tick >= Math.max(1, this.tempo2)) {
        this.tick = 0;
        this.line++;

        if (this.pendingSeq != null) {
          this.jumpSeq(this.pendingSeq);
          this.pendingSeq = null;
          return;
        }

        if (this.line >= block.lines) {
          this.line = 0;
          if (!this.blockOnly) this.advanceSeq();
        }
      }
    },

    advanceSeq() {
      this.seqPos++;
      if (this.seqPos >= this.song.playseq.length) this.seqPos = 0;
      const b = this.song.playseq[this.seqPos];
      this.blockIdx = b < this.song.blocks.length ? b : 0;
      this.line = 0;
    },

    jumpSeq(n) {
      this.seqPos = MW.clamp(n, 0, this.song.playseq.length - 1);
      const b = this.song.playseq[this.seqPos];
      this.blockIdx = b < this.song.blocks.length ? b : 0;
      this.line = 0;
      this.tick = 0;
      this.jumpNext = false;
      this.pendingSeq = null;
      this.pendingLine = null;
    },

    /* ---------------------------------------------------------- line decode */

    readLine(block, time) {
      const nch = Math.min(16, block.tracks);
      for (let i = 0; i < nch; i++) {
        const ch = this.channels[i];
        const row = block.rows[this.line];
        const cell = row ? row[i] : null;
        if (!cell) continue;
        ch.cmd = cell.cmd;
        ch.dat = cell.dat;

        if (cell.ins) ch.inst = this.song.instruments[cell.ins - 1] || ch.inst;

        if (cell.note) {
          if (cell.cmd === 0x03) {
            ch.pendingTarget = cell.note;
          } else if (cell.cmd === 0x0f && cell.dat === 0xf2) {
            const step = this.pulse * Math.max(1, Math.round(this.tempo2 / 2));
            this.trigger(ch, cell.note, time + step, cell);
          } else if (cell.cmd === 0x1f && (cell.dat >> 4)) {
            /* EDx in extended form: note delayed by the high nibble */
            const step = this.pulse * (cell.dat >> 4);
            this.trigger(ch, cell.note, time + step, cell);
          } else {
            this.trigger(ch, cell.note, time, cell);
          }
        } else if (cell.ins && !cell.cmd && !cell.dat) {
          ch.noteOn = true;
        }

        this.startEffect(ch, time, cell);
      }
    },

    /* ---------------------------------------------------------- voice */

    bufferFor(inst, ch) {
      const ctx = audio.ctx;
      if (!inst) return null;
      if ((inst.type === 'synth' || inst.type === 'hybrid') && inst.synth) {
        const pulseHz = 1 / Math.max(0.004, this.pulse);
        const start = ch && ch.synthStart ? ch.synthStart : 0;
        const key = Math.round(pulseHz) + ':' + start;
        if (inst._synthKey !== key) {
          const data = MW.renderSynth(inst, ctx.sampleRate, pulseHz, 6, { startWf: start });
          inst._synthKey = key;
          inst._synthBuf = data ? this.makeBuffer(data, ctx.sampleRate, data.loopStart, data.loopEnd) : null;
        }
        if (inst._synthBuf) return inst._synthBuf;
      }
      return this.pcmBuffer(inst);
    },

    /* Resample once to the context rate so playbackRate stays near 1.
       Safari is unhappy with very low playback rates, and this is better
       quality anyway: one proper interpolation instead of a per-voice one.

       Two rendering depths:
         enhanced - native depth, stereo kept (OctaMED Soundstudio and later)
         classic  - what a stock Amiga would do: 8 bit, mono            */
    pcmBuffer(inst) {
      if (!inst.data) return null;
      const sr = audio.ctx.sampleRate;
      const c2 = inst.c2rate || 8363;
      const classic = (MW.app && MW.app.depth) === 'classic';
      const key = sr + ':' + c2 + ':' + inst.data.length + ':' + (classic ? 'c' : 'e');
      if (inst._abuf && inst._abufKey === key) return inst._abuf;

      const n = Math.max(2, Math.round(inst.data.length * sr / c2));
      const ratio = c2 / sr;
      const resample = src => {
        if (Math.abs(c2 - sr) <= 1) return Float32Array.from(src);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const p = i * ratio;
          const a = Math.floor(p);
          const f = p - a;
          out[i] = (src[a] || 0) * (1 - f) + (src[a + 1] || 0) * f;
        }
        return out;
      };

      const left = resample(inst.data);
      let right = (!classic && inst.dataR) ? resample(inst.dataR) : null;

      if (classic) {
        if (inst.dataR) {
          const r = resample(inst.dataR);
          for (let i = 0; i < n; i++) left[i] = (left[i] + r[i]) * 0.5;
        }
        if (inst.bits16) {
          for (let i = 0; i < n; i++) left[i] = Math.round(left[i] * 127) / 127;
        }
      } else if (right && inst.bits16) {
        for (let i = 0; i < n; i++) right[i] = Math.round(right[i] * 32767) / 32767;
      }

      const buf = audio.ctx.createBuffer(right ? 2 : 1, n, sr);
      buf.getChannelData(0).set(left);
      if (right) buf.getChannelData(1).set(right);
      inst._abuf = buf;
      inst._abufKey = key;
      return buf;
    },

    /* after changing depth every cached buffer is stale */
    invalidateBuffers() {
      const song = this.song;
      if (!song) return;
      song.instruments.forEach(i => { if (i) { i._abuf = null; i._abufKey = null; } });
    },

    makeBuffer(data, rate, loopStart, loopEnd) {
      const ctx = audio.ctx;
      const buf = ctx.createBuffer(1, Math.max(2, data.length), rate);
      buf.getChannelData(0).set(data);
      buf._loopStart = loopStart || 0;
      buf._loopEnd = loopEnd || data.length;
      return buf;
    },

    trigger(ch, note, time, cell) {
      const ctx = audio.ctx;
      const inst = ch.inst;
      if (!inst) return;

      const eff = MW.clamp(note + (this.song.playtransp || 0) + (inst.transpose || 0), 1, 96);
      if (!ch._keepStart) ch.synthStart = 0;
      ch._keepStart = false;
      ch.note = note;
      ch.period = MW.period(eff);
      ch.target = 0;
      ch.noteOn = true;
      ch.vibPos = 0;
      ch.decayLeft = -1;
      ch.volume = inst.volume == null ? 64 : inst.volume;

      const hold = cell && cell.cmd === 8 ? (cell.dat & 0x0f) : (inst.hold || 0);
      const decay = cell && cell.cmd === 8 ? (cell.dat >> 4) : (inst.decay || 0);
      ch.holdLeft = hold > 0 ? hold : -1;
      ch.decayRate = decay;

      const buf = this.bufferFor(inst, ch);
      if (!buf) return;

      this.silence(ch, time);

      /* 0x19 is sample offset, in 256 byte units, measured against the
         sample's own clock (c2rate), not the context rate. */
      let startAt = 0;
      if (cell && cell.cmd === 0x19 && cell.dat) {
        startAt = (cell.dat * 256) / (inst.c2rate || 8363);
        if (!(startAt > 0) || startAt >= buf.duration) startAt = 0;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const loopLen = inst.looplen || 0;
      if (inst.type === 'sample' && loopLen > 2 && inst.data) {
        const c2 = inst.c2rate || 8363;
        src.loop = true;
        src.loopStart = (inst.loop || 0) / c2;
        src.loopEnd = ((inst.loop || 0) + loopLen) / c2;
      } else if (buf._loopStart > 0 && buf._loopEnd > buf._loopStart) {
        src.loop = true;
        src.loopStart = buf._loopStart / ctx.sampleRate;
        src.loopEnd = buf._loopEnd / ctx.sampleRate;
      }

      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);

      /* every voice goes through its track's bus, which carries the
         analyser used by the meters and oscilloscopes */
      const bus = audio.channelBus(ch.idx);
      if (bus) {
        if (bus.pan) bus.pan.pan.setValueAtTime(this.panOf(ch.idx), time);
        gain.connect(bus.analyser);
        ch.pan = bus.pan;
      } else {
        gain.connect(audio.filter);
        ch.pan = null;
      }

      ch.src = src;
      ch.gain = gain;
      ch.rate = this.rateFor(ch);

      src.playbackRate.setValueAtTime(ch.rate, time);
      const v = this.gainFor(ch, inst);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(v, time + 0.002);

      src.onended = () => { if (ch.src === src) { ch.src = null; ch.gain = null; ch.pan = null; } };
      try { src.start(time, startAt); } catch (e) { /* ignore */ }
    },

    /* OctaMED pans the four Amiga channels hard left/right unless the song
       carries free panning (MMD2/3 free-pan flag). Tracks 0 and 3 are left,
       1 and 2 right; split tracks follow their hardware channel. */
    panOf(i) {
      if (this.song && this.song.stereo) {
        return MW.clamp(((this.song.pans && this.song.pans[i]) || 0) / 16, -1, 1);
      }
      return [-0.7, 0.7, 0.7, -0.7][i % 4];
    },

    rateFor(ch) {
      const ft = ch.inst && ch.inst.finetune ? ch.inst.finetune : 0;
      return (428 / Math.max(1, ch.period)) * (ft ? Math.pow(2, ft / 96) : 1);
    },

    gainFor(ch, inst) {
      const trackVol = (this.song.trkvol[ch.idx] || 64) / 64;
      const master = (this.song.mastervol || 64) / 64;
      const instVol = (inst ? inst.volume : 64) / 64;
      const hw = this.authentic && this.song.channels > 4 ? this.hwVol[ch.idx % 4] / 64 : 1;
      const halve = this.authentic && this.song.channels > 4 ? 0.5 : 1;
      const mute = ch.muted ? 0 : 1;
      const v = (ch.volume / 64) * instVol * trackVol * master * hw * halve * mute;
      return Math.min(1, Math.max(0, v)) * 0.26;
    },

    silence(ch, time) {
      if (ch.src) {
        try {
          if (ch.gain) {
            if (ch.gain.gain.cancelAndHoldAtTime) {
              ch.gain.gain.cancelAndHoldAtTime(time);
            } else {
              ch.gain.gain.cancelScheduledValues(time);
              ch.gain.gain.setValueAtTime(ch.gain.gain.value, time);
            }
            ch.gain.gain.linearRampToValueAtTime(0, time + 0.004);
          }
          ch.src.stop(time + 0.008);
        } catch (e) { /* ignore */ }
        ch.src = null;
        ch.gain = null;
        ch.pan = null;
      }
      ch.noteOn = false;
    },

    /* ---------------------------------------------------------- effects */

    startEffect(ch, time, cell) {
      const inst = ch.inst;
      switch (ch.cmd) {
        case 0x03:
          if (cell && cell.note) {
            const inst2 = ch.inst;
            ch.target = MW.period(MW.clamp(cell.note + (this.song.playtransp || 0) + (inst2 ? inst2.transpose || 0 : 0), 1, 96));
            if (ch.dat) ch.portaSpeed = ch.dat;
          }
          break;
        case 0x09:
          if (ch.dat >= 1 && ch.dat <= 32) this.tempo2 = ch.dat;
          break;
        case 0x0b:
          this.pendingSeq = ch.dat;
          break;
        case 0x0c:
          if (ch.dat >= 0x80 && inst) {
            inst.volume = MW.clamp(ch.dat - 0x80, 0, 64);
          } else {
            ch.volume = MW.clamp(this.decodeVolume(ch.dat), 0, 64);
            if (this.authentic && this.song.channels > 4) this.hwVol[ch.idx % 4] = ch.volume;
          }
          break;
        case 0x0e:
          if (inst && (inst.type === 'synth' || inst.type === 'hybrid') && ch.note) {
            ch.synthStart = ch.dat;
            ch._keepStart = true;
            this.trigger(ch, ch.note, time, null);
          } else if (inst && inst.midiChannel) {
            this.midiCC(inst, 10, ch.dat);
          }
          break;
        case 0x0f:
          if (ch.dat === 0xfa) { if (inst) this.midiCC(inst, 64, 127); }
          else if (ch.dat === 0xfb) { if (inst) this.midiCC(inst, 64, 0); }
          else if (ch.dat === 0) {
            this.jumpNext = true;
          } else if (ch.dat < 0xf1) {
            this.tempo = MW.clamp(ch.dat, 1, 240);
          } else if (ch.dat === 0xfe) {
            this.stop();
          } else if (ch.dat === 0xff) {
            this.silence(ch, time);
            ch.noteOn = false;
          } else if (ch.dat === 0xf1) {
            const step = this.pulse * Math.max(1, Math.round(this.tempo2 / 2));
            if (ch.note) this.trigger(ch, ch.note, time + step, null);
          } else if (ch.dat === 0xf3) {
            const step = this.pulse * Math.max(1, Math.round(this.tempo2 / 3));
            if (ch.note) {
              this.trigger(ch, ch.note, time + step, null);
              this.trigger(ch, ch.note, time + step * 2, null);
            }
          } else if (ch.dat === 0xfd) {
            ch.period = MW.period(MW.clamp((cell && cell.note ? cell.note : ch.note) + (this.song.playtransp || 0) + (inst ? inst.transpose || 0 : 0), 1, 96));
            if (ch.src) ch.src.playbackRate.setValueAtTime(this.rateFor(ch), time);
          }
          break;

        /* ---- Med's extended commands (0x10 and up, MMD1 and later) ---- */

        case 0x11:          // slide pitch up once
          ch.period = Math.max(28, ch.period - ch.dat);
          if (ch.src) ch.src.playbackRate.setValueAtTime(this.rateFor(ch), time);
          break;
        case 0x12:          // slide pitch down once
          ch.period = Math.min(4000, ch.period + ch.dat);
          if (ch.src) ch.src.playbackRate.setValueAtTime(this.rateFor(ch), time);
          break;
        case 0x14:          // vibrato, ProTracker depth
          if (ch.dat) { ch.vibSpeed = ch.dat >> 4; ch.vibDepth = (ch.dat & 0x0f) * 2; }
          break;
        case 0x15:          // set finetune
          if (inst) inst.finetune = (ch.dat & 0x0f) - 8;
          break;
        case 0x18:          // stop the note after x ticks
          if (ch.dat) { ch.holdLeft = ch.dat; ch.decayRate = 0; }
          break;
        case 0x1a:          // slide volume up once
          ch.volume = Math.min(64, ch.volume + (ch.dat & 0x0f));
          break;
        case 0x1b:          // slide volume down once
          ch.volume = Math.max(0, ch.volume - (ch.dat & 0x0f));
          break;
        case 0x1d:          // pattern break, line given in hex
          this.jumpNext = true;
          this.pendingLine = ch.dat;
          break;
        default:
          break;
      }
    },

    midiCC(inst, controller, value) {
      if (!MW.midi || !MW.midi.enabled || !inst || !inst.midiChannel) return;
      MW.midi.send([0xb0 | (inst.midiChannel - 1), controller & 0x7f, value & 0x7f]);
    },

    decodeVolume(dat) {
      if (this.song.flags.volhex) return dat;
      const d = Math.floor(dat / 16);
      return d * 10 + (dat % 16);
    },

    channelTick(ch, time) {
      if (!ch.src || !ch.gain) return;
      let rate = ch.rate;
      const sts = this.song.flags.stslide && this.tick === 0;

      switch (sts ? -1 : ch.cmd) {
        case 0x00:
          if (ch.dat) {
            const step = [0, ch.dat >> 4, ch.dat & 0x0f][this.tick % 3];
            rate = this.rateFor(ch) * Math.pow(2, step / 12);
          }
          break;
        case 0x01:
          ch.period = Math.max(28, ch.period - ch.dat);
          rate = this.rateFor(ch);
          break;
        case 0x02:
          ch.period = Math.min(4000, ch.period + ch.dat);
          rate = this.rateFor(ch);
          break;
        case 0x03:
          if (ch.target) {
            const sp = ch.portaSpeed || ch.dat;
            if (ch.period < ch.target) ch.period = Math.min(ch.target, ch.period + sp);
            else if (ch.period > ch.target) ch.period = Math.max(ch.target, ch.period - sp);
            rate = this.rateFor(ch);
          }
          break;
        case 0x04:
          if (ch.dat) { ch.vibSpeed = ch.dat >> 4; ch.vibDepth = ch.dat & 0x0f; }
          ch.vibPos = (ch.vibPos + (ch.vibSpeed || 1)) % 64;
          rate = this.rateFor(ch) * (1 + (SINE[ch.vibPos | 0] * (ch.vibDepth || 0) * 3) / 1200);
          break;
        case 0x05:
          if (ch.dat) ch.vibDepth = ch.dat;
          ch.vibPos = (ch.vibPos + 2) % 64;
          rate = this.rateFor(ch) * (1 + (SINE[ch.vibPos | 0] * (ch.vibDepth || 0)) / 1400);
          break;
        case 0x14:              // vibrato, ProTracker depth
          if (ch.dat) { ch.vibSpeed = ch.dat >> 4; ch.vibDepth = (ch.dat & 0x0f) * 2; }
          ch.vibPos = (ch.vibPos + (ch.vibSpeed || 1)) % 64;
          rate = this.rateFor(ch) * (1 + (SINE[ch.vibPos | 0] * (ch.vibDepth || 0) * 3) / 1200);
          break;
        case 0x1f: {            // retrigger every x ticks
          const every = ch.dat & 0x0f;
          if (every && this.tick > 0 && this.tick % every === 0 && ch.note) {
            this.trigger(ch, ch.note, time, null);
            return;
          }
          break;
        }
        case 0x0a:
        case 0x0d: {
          const up = ch.dat >> 4, dn = ch.dat & 0x0f;
          if (up) ch.volume = Math.min(64, ch.volume + up);
          else if (dn) ch.volume = Math.max(0, ch.volume - dn);
          break;
        }
        default:
          break;
      }

      if (ch.holdLeft > 0) {
        ch.holdLeft--;
        if (ch.holdLeft === 0) {
          if (ch.decayRate > 0) ch.decayLeft = ch.decayRate * 8;
          else ch.volume = 0;
        }
      } else if (ch.decayLeft >= 0) {
        ch.decayLeft--;
        ch.volume = Math.max(0, ch.volume - 52 / Math.max(1, ch.decayRate * 8));
        if (ch.decayLeft <= 0) ch.decayLeft = -1;
      }

      ch.rate = rate;
      ch.src.playbackRate.setValueAtTime(rate, time);
      ch.gain.gain.setValueAtTime(this.gainFor(ch, ch.inst), time);
    }
  };

  MW.voicePreview = function (note, insIdx) {
    const ctx = audio.init();
    if (!ctx) return;
    audio.unlock();
    const song = MW.app && MW.app.song;
    if (!song) return;
    const inst = song.instruments[insIdx - 1];
    if (!inst) return;
    if (player.song !== song) player.setSong(song);
    const ch = player.channels[15];
    ch.inst = inst;
    ch.volume = inst.volume || 64;
    ch.cmd = 0;
    ch.dat = 0;
    player.trigger(ch, note, ctx.currentTime + 0.01, null);
    clearTimeout(MW._prevT);
    MW._prevT = setTimeout(() => player.silence(ch, ctx.currentTime), 900);
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
