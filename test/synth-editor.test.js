const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('synth editor displays normalised waveforms at full height', () => {
  const context = vm.createContext({ MW: {}, window: { devicePixelRatio: 1 } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const mw = context.MW;
  const points = [];
  const ctx = { setTransform() {}, fillRect(x,y) { if (this.fillStyle === '#ffffff') points.push([x,y]); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {} };
  const canvas = { clientWidth: 100, clientHeight: 100, getContext: () => ctx };
  mw.displays.drawSynthWave(canvas, Float32Array.from([-1, 1]));
  assert.ok(points.some(([,y]) => y < 15));
  assert.ok(points.some(([,y]) => y > 85));
});

test('synth waveform highlights the selected range on its own side', () => {
  const context = vm.createContext({ MW: { app: { synthRange: { side: 'bank', start: 1, end: 3 } } }, window: { devicePixelRatio: 1 } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const rects = [];
  const ctx = { setTransform() {}, fillRect(...r) { rects.push(r); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {} };
  const canvas = { clientWidth: 100, clientHeight: 100, parentElement: { dataset: { side: 'bank' } }, getContext: () => ctx };
  context.MW.displays.drawSynthWave(canvas, Float32Array.from([0, 0, 0, 0]));
  assert.deepEqual(rects[1], [25, 0, 50, 100]);
});

test('synth waveform includes the reference grid and centre scale', () => {
  const context = vm.createContext({ MW: {}, window: { devicePixelRatio: 1 } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const marks = [];
  const ctx = { setTransform() {}, fillRect(...r) { marks.push([this.fillStyle, ...r]); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {} };
  context.MW.displays.drawSynthWave({ clientWidth: 128, clientHeight: 100, getContext: () => ctx }, new Float32Array(32));
  assert.ok(marks.some(([color, x, y, w, h]) => color === '#444' && x > 0 && y > 0 && w === 1 && h === 1), 'dotted grid');
  assert.ok(marks.some(([color, , y, w, h]) => color === '#999' && y === 50 && w === 1 && h > 1), 'centre scale ticks');
});

test('a fixture synth waveform renders each sample as a point', () => {
  const mw = require('./helpers/runtime')(['loaders', 'ui-displays'], { window: {devicePixelRatio: 1} });
  const bytes = fs.readFileSync(path.join(__dirname, '../web/fixtures/maniac-beat.mmd1'));
  const song = mw.loadModule(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const waveform = song.instruments[1].synth.waveforms[0];
  const points = [];
  const ctx = { setTransform() {}, fillRect(...r) { if (this.fillStyle === '#ffffff') points.push(r); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {} };
  mw.displays.drawSynthWave({ clientWidth: 400, clientHeight: 160, getContext: () => ctx }, waveform);
  assert.equal(points.length, waveform.length);
  assert.ok(new Set(points.map(p => p[1])).size > 1, 'fixture has a changing waveform');
});

test('synth range edits affect only the selected waveform and can be undone', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([0, 0.25, 0.5, 0.75])], buffer: Float32Array.from([1, 1, 1, 1]) };
  context.MW.synthEditRange(syn, 'bank', 0, 1, 4, 'reverse');
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0.75, 0.5, 0.25]);
  assert.deepEqual(Array.from(syn.buffer), [1, 1, 1, 1]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0.25, 0.5, 0.75]);
});

test('synth drawing interpolates a line and undo restores the buffer', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [new Float32Array(4)], buffer: new Float32Array(4) };
  context.MW.synthDraw(syn, 'buffer', 0, 0, -1, 2, 1);
  assert.deepEqual(Array.from(syn.buffer), [-1, 0, 1, 0]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.buffer), [0, 0, 0, 0]);
});

test('synth drawing mix mode averages drawn values with existing samples', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([0.5, 0.5, 0.5, 0.5])], buffer: new Float32Array(4) };
  context.MW.synthDraw(syn, 'bank', 0, 0, -0.5, 2, 0.5, true, true);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0.25, 0.5, 0.5]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0.5, 0.5, 0.5, 0.5]);
});

test('a synth right-click positions the cursor while a drag selects a range', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const app = {};
  context.MW.synthSetSelection(app, 'bank', 2, 0, 4, 4);
  assert.equal(app.synthRange, null); assert.equal(app.synthCursor.position, 4);
  context.MW.synthSetSelection(app, 'bank', 2, 0, 7, 3);
  assert.equal(app.synthRange.start, 3); assert.equal(app.synthRange.end, 8);
});

test('synth range boundary buttons adjust one endpoint and preserve a nonempty range', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const range = { start: 2, end: 5 };
  assert.deepEqual({ ...context.MW.synthAdjustRange(range, 'start', 1, 8) }, { start: 3, end: 5 });
  assert.deepEqual({ ...context.MW.synthAdjustRange(range, 'end', -10, 8) }, { start: 2, end: 3 });
  assert.deepEqual({ ...context.MW.synthAdjustRange(range, 'end', 10, 8) }, { start: 2, end: 8 });
});

test('synth range copy and paste use the buffer at the cursor and support undo', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([0, 0.25, 0.5, 0.75, 1, -1])], buffer: new Float32Array(4) };
  context.MW.synthCopyRange(syn, 'bank', 0, 1, 3);
  assert.deepEqual(Array.from(syn.buffer), [0.25, 0.5]);
  context.MW.synthPasteRange(syn, 0, 4);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0.25, 0.5, 0.75, 0.25, 0.5]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0.25, 0.5, 0.75, 1, -1]);
});

test('cutting a range moves it to the buffer and clears the waveform', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([1, 0.5, 0.25, -1])], buffer: new Float32Array(2) };
  assert.equal(context.MW.synthCutRange(syn, 'bank', 0, 1, 3), true);
  assert.deepEqual(Array.from(syn.buffer), [0.5, 0.25]);
  assert.deepEqual(Array.from(syn.waveforms[0]), [1, 0, 0, -1]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[0]), [1, 0.5, 0.25, -1]);
  assert.equal(context.MW.synthCutRange(syn, 'buffer', 0, 0, 1), false);
});

test('stretching moves the cursor point and keeps the waveform length', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([0, 1, 0, -1, 0])], buffer: new Float32Array(0) };
  assert.equal(context.MW.synthStretch(syn, 'bank', 0, 2, 1), true);
  const out = Array.from(syn.waveforms[0]);
  assert.equal(out.length, 5);
  assert.equal(out[3], 0, 'the cursor point moves one sample right');
  assert.equal(out[0], 0);
  assert.equal(out[4], 0);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 1, 0, -1, 0]);
});

test('clearing a waveform keeps its length and full clear resets the programs', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = {
    waveforms: [Float32Array.from([1, 0.5, -1]), Float32Array.from([0.5, 0.5, 0.5])],
    buffer: new Float32Array(2),
    voltbl: [0x10, 0x20, 0xff],
    wftbl: [0x01, 0x02, 0xff]
  };
  context.MW.synthClearWave(syn, 'bank', 0);
  assert.deepEqual(Array.from(syn.waveforms[0]), [0, 0, 0]);
  assert.deepEqual(Array.from(syn.waveforms[1]), [0.5, 0.5, 0.5]);
  context.MW.synthClearAll(syn);
  assert.deepEqual(Array.from(syn.waveforms[1]), [0, 0, 0]);
  assert.deepEqual(Array.from(syn.voltbl), [0x00, 0xff]);
  assert.deepEqual(Array.from(syn.wftbl), [0x00, 0xff]);
  context.MW.synthUndo(syn);
  assert.deepEqual(Array.from(syn.waveforms[1]), [0.5, 0.5, 0.5]);
});

test('doubling a selected range repeats it twice without changing surrounding samples', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([1, 0, 0.25, 0.5, 0.75, -1])], buffer: new Float32Array(2) };
  context.MW.synthEditRange(syn, 'bank', 0, 1, 5, 'double');
  assert.deepEqual(Array.from(syn.waveforms[0]), [1, 0, 0.5, 0, 0.5, -1]);
});

test('inserting a waveform here places it before the current waveform', () => {
  const context = vm.createContext({ MW: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/js/ui-displays.js'), 'utf8'), context);
  const syn = { waveforms: [Float32Array.from([1, 1]), Float32Array.from([0.5, 0.5])] };
  const selected = context.MW.synthInsertWave(syn, 1, false);
  assert.equal(selected, 1);
  assert.deepEqual(syn.waveforms.map(w => Array.from(w)), [[1, 1], [0, 0], [0.5, 0.5]]);
});
