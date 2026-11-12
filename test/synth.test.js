const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');
const fs = require('node:fs');
const path = require('node:path');

for (const sr of [44100, 48000]) for (const length of [32, 64]) {
  test(`synth reference pitch follows MED period and waveform length (${sr}/${length})`, () => {
    const mw = runtime(['synth', 'engine']);
    const i = mw.createInstrument('synth'); i.synth = mw.createSynth();
    i.synth.waveforms = [mw.sineTable(length)];
    const pcm = mw.renderSynth(i, sr, 50, 2);
    const crossings = [];
    for (let n = 1; n < pcm.length; n++) if (pcm[n - 1] < 0 && pcm[n] >= 0) crossings.push(n);
    const hz = (crossings.length - 1) * sr / (crossings.at(-1) - crossings[0]);
    // Original MED synth periods are 4x PCM periods: C-2 clock 8363 / 4.
    assert.ok(Math.abs(hz - (length === 32 ? 65.3359375 : 32.66796875)) < 0.1, `frequency ${hz}`);
    for (const [note, multiplier] of [[1, 0.5], [13, 1], [25, 2]]) {
      assert.equal(mw.player.rateFor({ period: mw.period(note), inst: i }), multiplier);
    }
  });
}

test('normalised synth waveforms render at their intended amplitude', () => {
  const mw = runtime(['synth']);
  const inst = mw.createInstrument('synth');
  inst.synth = mw.createSynth();
  inst.synth.waveforms = [Float32Array.from({length: 32}, (_, i) => Math.sin(i * Math.PI / 16))];
  const pcm = mw.renderSynth(inst, 44100, 50, 1);
  assert.ok(Math.max(...pcm.slice(0, 4000).map(Math.abs)) > 0.2);
});

test('sequence insertion and deletion preserve END and retarget jumps in both programs', () => {
  const mw = runtime(['synth']);
  const syn = { voltbl: [0x40, 0xfe, 0x01, 0xff], wftbl: [0xfa, 0x01, 0xff] };
  assert.equal(mw.editSynthSequence(syn, 'vol', 'insert', 1), true);
  assert.deepEqual(Array.from(syn.voltbl), [0x40, 0, 0xfe, 0x02, 0xff]);
  assert.deepEqual(Array.from(syn.wftbl), [0xfa, 0x02, 0xff]);
  assert.equal(mw.editSynthSequence(syn, 'vol', 'delete', 1), true);
  assert.deepEqual(Array.from(syn.voltbl), [0x40, 0xfe, 0x01, 0xff]);
  assert.deepEqual(Array.from(syn.wftbl), [0xfa, 0x01, 0xff]);
  assert.equal(mw.editSynthSequence(syn, 'vol', 'delete', 3), false);
  assert.equal(syn.voltbl.at(-1), 0xff);
});

test('synth command keys follow the original volume and waveform mappings', () => {
  const mw = runtime(['synth']);
  assert.equal(mw.synthCommandKey('vol', 'j', false), 0xfe);
  assert.equal(mw.synthCommandKey('vol', 'j', true), 0xfa);
  assert.equal(mw.synthCommandKey('wf', 'w', true), 0xf7);
  assert.equal(mw.synthCommandKey('vol', 'e', true), 0xf5);
  assert.equal(mw.synthCommandKey('wf', 'v', true), 0xf5);
  assert.equal(mw.synthCommandKey('vol', 'a', false), null);
});

test('sequence values following commands are not mistaken for command bytes', () => {
  const mw = runtime(['synth']);
  assert.deepEqual(Array.from(mw.synthSequenceKinds('vol', [0xf1, 0xff, 0xfe, 0xf3, 0xff])), ['command', 'value', 'command', 'value', 'command']);
});

test('padded fixture sequences can insert before their actual END', () => {
  const mw = runtime(['synth']);
  const syn = { voltbl: [0xf1, 0xff, 0x40, 0xff, ...new Array(124).fill(0)], wftbl: [0, 0xff] };
  assert.equal(mw.synthSequenceEnd('vol', syn.voltbl), 3);
  assert.equal(mw.editSynthSequence(syn, 'vol', 'insert', 2), true);
  assert.deepEqual(Array.from(syn.voltbl), [0xf1, 0xff, 0, 0x40, 0xff]);
});

test('edited fixture synth sequence survives an MMD1 save and reload', () => {
  const mw = runtime(['loaders', 'writer', 'synth']);
  const bytes = fs.readFileSync(path.join(__dirname, '../web/fixtures/maniac-beat.mmd1'));
  const song = mw.loadModule(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const syn = song.instruments[1].synth;
  assert.equal(mw.editSynthSequence(syn, 'vol', 'insert', 0), true);
  const expected = Array.from(syn.voltbl);
  const loaded = mw.loadModule(mw.writeMMD1(song));
  assert.deepEqual(Array.from(loaded.instruments[1].synth.voltbl), expected);
});

test('generated synth waveform retains its amplitude through MMD1 export', () => {
  const mw = runtime(['loaders', 'writer', 'synth']);
  const song = mw.createSong();
  const inst = mw.createInstrument('synth');
  inst.synth = mw.createSynth();
  song.instruments[0] = inst;
  const saved = mw.writeMMD1(song);
  const loaded = mw.loadModule(saved);
  const before = inst.synth.waveforms[0];
  const after = loaded.instruments[0].synth.waveforms[0];
  assert.equal(after.length, before.length);
  assert.ok(Math.max(...after) > 0.9);
  for (let i = 0; i < before.length; i++) assert.ok(Math.abs(before[i] - after[i]) < 0.02);
});
