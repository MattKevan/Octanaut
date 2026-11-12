const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('an empty sample slot can allocate a bounded silent buffer', () => {
  const mw = runtime(['ui-displays']);
  const app = { song: mw.createSong(), currentIns: 1 };
  assert.equal(mw.sampleCreateBuffer(app, 8), true);
  assert.equal(app.song.instruments[0].data.length, 8);
  assert.ok(Array.from(app.song.instruments[0].data).every(v => v === 0));
  assert.equal(mw.sampleCreateBuffer(app, 200000), false);
  assert.equal(app.song.instruments[0].data.length, 8);
  app.song.instruments[1] = mw.createInstrument('synth');
  app.song.instruments[1].synth = mw.createSynth(); app.currentIns = 2;
  assert.equal(mw.sampleCreateBuffer(app, 8), false);
  assert.ok(app.song.instruments[1].synth);
});

test('sample viewport scrolling preserves its width at either edge', () => {
  const mw = runtime(['ui-displays']);
  assert.deepEqual({ ...mw.sampleScrollView({a: 200, b: 400}, 1000, -1) }, {a: 175, b: 375});
  assert.deepEqual({ ...mw.sampleScrollView({a: 5, b: 205}, 1000, -1) }, {a: 0, b: 200});
  assert.deepEqual({ ...mw.sampleScrollView({a: 790, b: 990}, 1000, 1) }, {a: 800, b: 1000});
});

test('sample pitch and destination accept tracker note keys independently', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app', 'ui-displays']);
  const inst = mw.createInstrument(); inst.c2rate = 8363;
  const c2 = mw.noteFromPianoKey('q', 0), g2 = mw.noteFromPianoKey('T', 0);
  assert.equal(c2, 13); assert.equal(g2, 20); assert.equal(mw.noteFromPianoKey('!', 0), null);
  assert.equal(mw.sampleSetNotePeriod(inst, 'pitch', c2), 428);
  assert.equal(inst.c2rate, 8363);
  assert.equal(mw.sampleSetNotePeriod(inst, 'dest', g2), mw.period(20));
  assert.equal(inst.c2rate, 8363); assert.equal(inst._sampleDestPeriod, mw.period(20));
});

test('sample note control captures a piano key without forwarding it to the tracker', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), {MW: mw, window: {devicePixelRatio: 1}});
  const inst = mw.createInstrument(); inst.data = new Float32Array(8);
  mw.app.song.instruments[0] = inst; mw.sampler = {devices: []};
  const ctx = new Proxy({}, {get(target, name) { return target[name] || (() => {}); }});
  const canvas = {clientWidth: 100, clientHeight: 100, getContext: () => ctx};
  const pitch = {value: ''}, dest = {value: ''};
  const button = {dataset: {notePeriod: 'dest'}, focus() {}};
  const nodes = {'#wave': canvas, '#sample-pitch': pitch, '#sample-dest': dest};
  const host = {innerHTML: '', querySelector: selector => nodes[selector] || (nodes[selector] = {}),
    querySelectorAll: selector => selector === '[data-note-period]' ? [button] : []};
  mw.displays.renderSample(host);
  let prevented = false, stopped = false;
  button.onkeydown({key: 't', preventDefault() {prevented = true;}, stopPropagation() {stopped = true;}});
  assert.equal(dest.value, mw.period(20)); assert.equal(button.textContent, mw.noteName(20, mw.app.hb));
  assert.ok(prevented && stopped); assert.equal(inst.c2rate, 8363);
});

test('resizing a sample preserves stereo frames and clamps loop and selection', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0, 1, 0, 1, 0, 1]); inst.dataR = Float32Array.from([1, 0, 1, 0, 1, 0]);
  inst.loop = 3; inst.looplen = 3; inst._sel = {a: 2, b: 6};
  mw.ops.sampleEdit('samp-buffsize', inst, 0, 6, {size: 4});
  assert.equal(inst.dataR.length, 4); assert.deepEqual(Array.from(inst.dataR), [1, 0, 1, 0]);
  assert.equal(inst.loop, 3); assert.equal(inst.looplen, 1);
  assert.ok(inst._sel === null || Math.max(inst._sel.a, inst._sel.b) <= 4);
});

test('sample range copy, cut and paste remove and insert the selected samples', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0.1, 0.2, 0.3, 0.4]);
  mw.ops.sampleEdit('samp-cut', inst, 1, 3);
  assert.deepEqual(Array.from(inst.data), Array.from(Float32Array.from([0.1, 0.4])));
  mw.ops.sampleEdit('samp-paste', inst, 1, 1);
  assert.deepEqual(Array.from(inst.data), Array.from(Float32Array.from([0.1, 0.2, 0.3, 0.4])));
});

test('sample volume change interpolates between start and end percentages in the range', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0.5, 0.5, 0.5, 0.5, 0.5]);
  mw.ops.sampleEdit('samp-volume', inst, 1, 4, { startVolume: 0, endVolume: 100 });
  assert.deepEqual(Array.from(inst.data), [0.5, 0, 0.25, 0.5, 0.5]);
});

test('sample cut and paste preserve loop positions when edits precede the loop', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0, 0.25, 0.5, 0.75]);
  inst.loop = 2; inst.looplen = 2;
  mw.ops.sampleEdit('samp-cut', inst, 0, 1);
  assert.equal(inst.loop, 1); assert.equal(inst.looplen, 2);
  mw.ops.sampleEdit('samp-paste', inst, 0, 0);
  assert.equal(inst.loop, 2); assert.equal(inst.looplen, 2);
});

test('sample rate conversion transposes audio and rescales the loop', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25]);
  inst.loop = 2; inst.looplen = 4;
  mw.ops.sampleEdit('samp-change-rate', inst, 0, 8, { sourcePeriod: 428, destPeriod: 214 });
  assert.deepEqual(Array.from(inst.data), [0, 0.5, 1, 0.5]);
  assert.equal(inst.loop, 1); assert.equal(inst.looplen, 2);
});

test('rate conversion rejects output larger than the sample buffer limit', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = new Float32Array(65537);
  assert.equal(mw.ops.sampleEdit('samp-change-rate', inst, 0, inst.data.length, { sourcePeriod: 428, destPeriod: 856 }), false);
  assert.equal(inst.data.length, 65537);
});

test('sample loop marker controls move the chosen endpoint and seek zero crossings', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([0, 0.25, 0.5, 0.25, 0, -0.5, -0.25, 0]);
  inst.loop = 0; inst.looplen = 6;
  mw.sampleMoveLoop(inst, 'start', 'right');
  assert.equal(inst.loop, 2); assert.equal(inst.looplen, 4);
  mw.sampleMoveLoop(inst, 'end', 'zero-right');
  assert.equal(inst.loop, 2); assert.equal(inst.looplen, 5);
  mw.sampleMoveLoop(inst, 'start', 'zero-right');
  assert.equal(inst.loop, 4); assert.equal(inst.looplen, 3);
});

test('mixing a sample range leaves audio outside that range unchanged', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = new Float32Array(6);
  mw.sampleClip.data = Float32Array.from([1, 1, 1, 1]);
  mw.ops.sampleEdit('samp-mix', inst, 1, 3, { ranged: true });
  assert.equal(inst.data[0], 0); assert.ok(inst.data[1] > 0); assert.ok(inst.data[2] > 0); assert.equal(inst.data[3], 0);
});

test('echo uses the supplied delay and repeat count', () => {
  const mw = runtime(['store', 'engine', 'synth', 'writer', 'app']);
  const inst = mw.createInstrument();
  inst.data = Float32Array.from([1, 0, 0, 0, 0, 0]);
  mw.ops.sampleEdit('samp-echo', inst, 0, 1, { delay: 2, count: 2 });
  assert.ok(inst.data[2] > 0); assert.ok(inst.data[4] > 0);
  assert.equal(inst.data[1], 0); assert.equal(inst.data[3], 0); assert.equal(inst.data[5], 0);
});

test('freehand drawing interpolates samples between pointer positions', () => {
  const mw = runtime(['ui-displays']);
  const sample = Float32Array.from([0, 0, 0, 0, 0]);
  mw.sampleDrawLine(sample, 1, -1, 3, 1);
  assert.deepEqual(Array.from(sample), [0, -1, 0, 1, 0]);
});

test('range preview plays only the selected sample frames', () => {
  const mw = runtime(['ui-displays']);
  const calls = [];
  const buffer = { copyToChannel(data) { calls.push(Array.from(data)); } };
  const source = { playbackRate: {}, connect() {}, start() { calls.push('started'); } };
  const ctx = { sampleRate: 8000, destination: {}, createBuffer: () => buffer, createBufferSource: () => source };
  mw.app = { currentIns: 1 };
  mw.voicePreview = () => calls.push('whole instrument');
  mw.toast = () => {};
  mw.audio = { init: () => ctx, unlock() {} };
  mw.displays.playRange({ data: Float32Array.from([0, 0.25, 0.5, 0.75]), c2rate: 8000 }, [1, 3]);
  assert.deepEqual(calls, [[0.25, 0.5], 'started']);
});
