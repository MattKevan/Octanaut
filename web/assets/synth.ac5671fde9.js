// @ts-check
/* Octanaut - synthetic instrument renderer.
 *
 * MED synthsounds are two little programs (volume and waveform/pitch) stepped
 * once per timing pulse, driving a bank of single cycle waveforms. We render
 * them offline into a buffer, then play that buffer like a sample.
 */
(function (global) {
  'use strict';
  const MW = global.MW;

  const VOL = {
    END: 0xff, JMP: 0xfe, HLT: 0xfb, JWS: 0xfa, EST: 0xf6,
    EN2: 0xf5, EN1: 0xf4, CHU: 0xf3, CHD: 0xf2, WAI: 0xf1, SPD: 0xf0
  };
  const WF = {
    END: 0xff, JMP: 0xfe, ARE: 0xfd, ARP: 0xfc, HLT: 0xfb, JVS: 0xfa,
    VWF: 0xf7, RES: 0xf6, VBS: 0xf5, VBD: 0xf4, CHU: 0xf3, CHD: 0xf2, WAI: 0xf1, SPD: 0xf0
  };

  MW.synthNames = {
    vol: { 0xff: 'END', 0xfe: 'JMP', 0xfb: 'HLT', 0xfa: 'JWS', 0xf6: 'EST',
      0xf5: 'EN2', 0xf4: 'EN1', 0xf3: 'CHU', 0xf2: 'CHD', 0xf1: 'WAI', 0xf0: 'SPD' },
    wf: { 0xff: 'END', 0xfe: 'JMP', 0xfd: 'ARE', 0xfc: 'ARP', 0xfb: 'HLT', 0xfa: 'JVS',
      0xf7: 'VWF', 0xf6: 'RES', 0xf5: 'VBS', 0xf4: 'VBD', 0xf3: 'CHU', 0xf2: 'CHD', 0xf1: 'WAI', 0xf0: 'SPD' }
  };

  const CMD_ARGS = {
    vol: new Set([0xfe, 0xfa, 0xf4, 0xf5, 0xf3, 0xf2, 0xf1, 0xf0]),
    wf: new Set([0xfe, 0xfa, 0xf7, 0xf5, 0xf4, 0xf3, 0xf2, 0xf1, 0xf0])
  };

  MW.synthArgs = CMD_ARGS;

  MW.synthCommandKey = function (list, key, shifted) {
    const common = { d: 0xf2, u: 0xf3, w: 0xf1, j: 0xfe, h: 0xfb, s: 0xf0 };
    const special = list === 'vol' ? { e: shifted ? 0xf5 : 0xf4 } : { a: 0xfc, e: 0xfd, v: shifted ? 0xf5 : 0xf4, r: 0xf6 };
    key = key.toLowerCase();
    if (shifted && key === 'j') return 0xfa;
    if (shifted && key === 'w' && list === 'wf') return 0xf7;
    return special[key] ?? common[key] ?? null;
  };
  MW.synthSequenceKinds = function (list, table) {
    const kinds = new Array(table.length).fill('value');
    let argument = false, arpeggio = false;
    for (let i = 0; i < table.length; i++) {
      const byte = table[i];
      if (argument) { argument = false; continue; }
      if (arpeggio && byte !== 0xfd && byte !== 0xff) continue;
      if (arpeggio) arpeggio = false;
      if (MW.synthNames[list][byte]) {
        kinds[i] = 'command';
        argument = CMD_ARGS[list].has(byte);
        if (list === 'wf' && byte === 0xfc) arpeggio = true;
      }
    }
    return kinds;
  };
  MW.synthSequenceEnd = function (list, table) {
    const kinds = MW.synthSequenceKinds(list, table);
    return table.findIndex((byte, i) => byte === 0xff && kinds[i] === 'command');
  };

  MW.editSynthSequence = function (syn, list, action, index) {
    const target = list === 'vol' ? syn.voltbl : syn.wftbl;
    if (!target || !Number.isInteger(index) || index < 0 || index >= target.length) return false;
    const end = MW.synthSequenceEnd(list, target);
    if (end < 0 || index > end) return false;
    if (action === 'insert' && end + 1 >= 127) return false;
    if (action === 'delete' && (end === 0 || index === end)) return false;
    if (action !== 'insert' && action !== 'delete') return false;
    const refs = [];
    for (const kind of ['vol', 'wf']) {
      const table = kind === 'vol' ? syn.voltbl : syn.wftbl;
      if (!table) continue;
      for (let i = 0; i < table.length; i++) {
        const op = table[i];
        if (op === 0xff) break;
        if (kind === 'wf' && op === 0xfc) {
          while (i + 1 < table.length && table[i + 1] !== 0xfd && table[i + 1] !== 0xff) i++;
          if (table[i + 1] === 0xfd) i++;
          continue;
        }
        if (CMD_ARGS[kind].has(op) && i + 1 < table.length) {
          if ((op === 0xfe && kind === list) || (op === 0xfa && kind !== list)) refs.push({ table, opIndex: i, argIndex: i + 1, value: table[i + 1] });
          i++;
        }
      }
    }
    target.splice(end + 1);
    if (action === 'insert') target.splice(index, 0, 0);
    else target.splice(index, 1);
    for (const ref of refs) {
      if (ref.table === target && action === 'delete' && (index === ref.opIndex || index === ref.argIndex)) continue;
      const argIndex = ref.argIndex + (ref.table === target && index <= ref.argIndex ? (action === 'insert' ? 1 : -1) : 0);
      const value = action === 'insert' && ref.value >= index ? ref.value + 1 : action === 'delete' && ref.value > index ? ref.value - 1 : ref.value;
      ref.table[argIndex] = Math.min(0xff, value);
    }
    return true;
  };

  function tableAt(tbl, i) {
    return i >= 0 && i < tbl.length ? tbl[i] : 0xff;
  }

  /**
   * Render a synthsound to PCM.
   * @param {any} inst instrument with .synth
   * @param {number} sampleRate output rate
   * @param {number} pulseHz program steps per second
   * @param {number} maxSeconds hard cap
   */
  MW.renderSynth = function (inst, sampleRate, pulseHz, maxSeconds, opts) {
    const syn = inst.synth;
    if (!syn || !syn.waveforms || !syn.waveforms.length) return null;

    sampleRate = sampleRate || 44100;
    pulseHz = pulseHz || 50;
    maxSeconds = maxSeconds || 6;
    opts = opts || {};

    const waveforms = syn.waveforms.filter(w => w && w.length > 1);
    if (!waveforms.length) return null;

    const voltbl = syn.voltbl || [0x40, 0xff];
    const wftbl = syn.wftbl || [0x00, 0xff];
    const maxLen = Math.floor(sampleRate * maxSeconds);
    const out = new Float32Array(maxLen);

    let vPc = 0, wPc = Math.max(0, Math.min(wftbl.length - 1, opts.startWf || 0));
    let vSpeed = Math.max(1, syn.volspeed || 1);
    let wSpeed = Math.max(1, syn.wfspeed || 1);
    let vCounter = 0, wCounter = 0;

    let volume = 64;
    let volRate = 0;           // per pulse, in volume units
    let pitchRate = 0;         // per pulse, multiplier delta
    let pitchMul = 1;
    let vibDepth = 0, vibSpeed = 0, vibPos = 0;
    /** @type {any} */
    let vibWave = null;
    /** @type {any} */
    let arp = null, arpPos = 0;
    let wfIndex = 0;
    let decayJump = inst.decay || 0;

    let volRunning = true;
    let wfRunning = true;
    /** @type {any} */
    let env = null, envPos = 0;

    let phase = 0;
    const samplesPerPulse = Math.max(1, sampleRate / pulseHz);
    let pulseAcc = 0;

    let loopStartSample = -1;
    const seen = new Map();
    let tickCount = 0;

    const stepVol = function () {
      if (!volRunning) return;
      let guard = 0;
      while (guard++ < 32) {
        const op = tableAt(voltbl, vPc);
        if (op < 0x80) {
          volume = Math.min(64, op);
          vPc++;
          return;
        }
        if (op === VOL.END || op === VOL.HLT) { volRunning = false; return; }
        if (op === VOL.WAI) { vPc += 2; return; }
        if (op === VOL.JMP) { vPc = tableAt(voltbl, vPc + 1); return; }
        if (op === VOL.SPD) { vSpeed = Math.max(1, tableAt(voltbl, vPc + 1) || 1); vPc += 2; return; }
        if (op === VOL.CHD) { volRate = -Math.abs(tableAt(voltbl, vPc + 1)) * 0.22; vPc += 2; return; }
        if (op === VOL.CHU) { volRate = Math.abs(tableAt(voltbl, vPc + 1)) * 0.22; vPc += 2; return; }
        if (op === VOL.JWS) { wPc = tableAt(voltbl, vPc + 1); vPc += 2; return; }
        if (op === VOL.EN1 || op === VOL.EN2) {
          const wf = waveforms[tableAt(voltbl, vPc + 1) % waveforms.length];
          env = wf; envPos = 0;
          env.loop = op === VOL.EN2;
          vPc += 2;
          return;
        }
        vPc++;
        return;
      }
    };

    const stepWf = function () {
      if (!wfRunning) return;
      let guard = 0;
      while (guard++ < 32) {
        const op = tableAt(wftbl, wPc);
        if (op < 0x80) {
          if (op < waveforms.length) wfIndex = op;
          wPc++;
          return;
        }
        if (op === WF.END || op === WF.HLT) { wfRunning = false; return; }
        if (op === WF.WAI) { wPc += 2; return; }
        if (op === WF.JMP) { wPc = tableAt(wftbl, wPc + 1); return; }
        if (op === WF.SPD) { wSpeed = Math.max(1, tableAt(wftbl, wPc + 1) || 1); wPc += 2; return; }
        if (op === WF.CHD) { pitchRate = -Math.abs(tableAt(wftbl, wPc + 1)) * 0.0012; wPc += 2; return; }
        if (op === WF.CHU) { pitchRate = Math.abs(tableAt(wftbl, wPc + 1)) * 0.0012; wPc += 2; return; }
        if (op === WF.VBD) { vibDepth = tableAt(wftbl, wPc + 1); wPc += 2; return; }
        if (op === WF.VBS) { vibSpeed = tableAt(wftbl, wPc + 1); wPc += 2; return; }
        if (op === WF.RES) { pitchMul = 1; wPc++; return; }
        if (op === WF.ARP) {
          arp = [];
          let p = wPc + 1;
          while (tableAt(wftbl, p) !== WF.ARE && tableAt(wftbl, p) !== 0xff && arp.length < 16) {
            arp.push(tableAt(wftbl, p));
            p++;
          }
          arpPos = 0;
          wPc = p + 1;
          return;
        }
        if (op === WF.JVS) { vPc = tableAt(wftbl, wPc + 1); wPc += 2; return; }
        if (op === WF.VWF) {
          const idx = tableAt(wftbl, wPc + 1);
          if (idx < waveforms.length) vibWave = waveforms[idx];
          wPc += 2;
          return;
        }
        wPc++;
        return;
      }
    };

    const runPulse = function () {
      if (vCounter-- <= 0) { vCounter = vSpeed - 1; stepVol(); }
      if (wCounter-- <= 0) { wCounter = wSpeed - 1; stepWf(); }

      volume = Math.max(0, Math.min(64, volume + volRate));
      pitchMul = Math.max(0.25, Math.min(4, pitchMul * (1 + pitchRate)));
      if (vibDepth) vibPos = (vibPos + (vibSpeed / 64)) % (Math.PI * 2);
      if (arp && arp.length) arpPos = (arpPos + 1) % arp.length;
    };

    let written = 0;
    let silentFor = 0;

    for (let i = 0; i < maxLen; i++) {
      if (pulseAcc <= 0) {
        runPulse();
        pulseAcc += samplesPerPulse;

        // detect a looping program so held notes sustain
        const key = vPc * 1000 + wPc;
        if (seen.has(key) && loopStartSample < 0 && tickCount > 8) loopStartSample = i;
        else if (!seen.has(key)) seen.set(key, i);
        tickCount++;
      }
      pulseAcc -= 1;

      const wf = waveforms[wfIndex % waveforms.length];
      if (!wf || wf.length < 2) { out[i] = 0; continue; }

      let rate = pitchMul;
      if (arp && arp.length) rate *= Math.pow(2, arp[arpPos] / 12);
      if (vibDepth) {
        let shape = Math.sin(vibPos);
        if (vibWave && vibWave.length > 1) {
          const t = ((vibPos / (Math.PI * 2)) % 1 + 1) % 1;
          shape = vibWave[Math.floor(t * vibWave.length)];
        }
        rate *= Math.pow(2, (shape * vibDepth) / 480);
      }

      // MED's synth period table is four times its PCM table (C-2: 1712
      // versus 428). Advance in waveform samples, not whole cycles: a
      // 64-byte waveform must sound an octave below a 32-byte waveform.
      phase = (phase + (8363 / 4) * rate / sampleRate) % wf.length;
      const idx = phase | 0;
      const frac = phase - idx;
      const a = wf[idx], b = wf[(idx + 1) % wf.length];
      let v = (a + (b - a) * frac);

      // 128-byte envelope waveforms
      if (env) {
        const e = env[envPos | 0];
        v *= Math.max(0, Math.min(1, 0.5 + e * 0.5));
        envPos += 1;
        if (envPos >= env.length) {
          if (env.loop) envPos = 0;
          else { env = null; envPos = 0; }
        }
      }

      const g = volume <= 0 ? 0 : volume / 64;
      if (!volRunning && volume <= 0) {
        out[i] = 0;
        if (++silentFor > sampleRate * 0.05) { written = i; break; }
      } else {
        silentFor = 0;
        out[i] = v * g;
        written = i;
      }
    }

    const end = Math.max(64, Math.min(maxLen, written + 32));
    /** @type {any} */
    const result = out.slice(0, end);
    result.loopStart = loopStartSample > 0 ? loopStartSample : 0;
    result.loopEnd = end;
    return result;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
