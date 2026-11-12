const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('notation displays the measure containing the cursor', () => {
  const mw = runtime(['ui-displays']);
  assert.equal(mw.notationMeasureStart(23, 4), 16);
  assert.equal(mw.notationMeasureStart(23, 3), 12);
});

test('notation presets retain visibility, ghosting and selected track independently', () => {
  const mw = runtime(['ui-displays']);
  const app = { cursor: { track: 0 } };
  mw.notationPreset(app, 0);
  assert.equal(app.notaTracks[0], true);
  app.notaTracks[3] = false;
  app.notaGhost[2] = true;
  app.notaSelectedTrack = 2;
  mw.notationPreset(app, 1);
  assert.equal(app.notaTracks[3], false);
  app.notaTracks[3] = true;
  mw.notationPreset(app, 0);
  assert.equal(app.notaTracks[3], false);
  assert.equal(app.notaGhost[2], true);
  assert.equal(app.notaSelectedTrack, 2);
});

test('score printing selects the requested inclusive block range', () => {
  const mw = runtime(['ui-displays']);
  const app = { song: { blocks: ['a','b','c','d'] }, notaPrintAll: false, notaStart: 1, notaEnd: 2 };
  assert.deepEqual(Array.from(mw.notationPrintBlocks(app), b => b.index), [1, 2]);
  app.notaPrintAll = true;
  assert.deepEqual(Array.from(mw.notationPrintBlocks(app), b => b.index), [0, 1, 2, 3]);
});

test('text score preserves held notes and includes song sequence and volume information', () => {
  const mw = runtime(['ui-displays']);
  const song = mw.createSong();
  song.name = 'Example'; song.playseq = [0, 2, 0]; song.trkvol[1] = 32;
  song.instruments[0] = mw.createInstrument(); song.instruments[0].name = 'Bass';
  const block = song.blocks[0]; block.rows[1][0].ins = 1;
  const text = mw.notationTextBlock(block, 0, false);
  assert.match(text, /001\s+-\|-\s+010000/);
  const header = mw.notationTextHeader(song);
  assert.match(header, /Example/); assert.match(header, /Bass/);
  assert.match(header, /0\s+2\s+0/); assert.match(header, /64\s+32/);
});

test('notation entry writes a note and continuation cells for its length', () => {
  const mw = runtime(['ui-displays']);
  const block = mw.createBlock(2, 8);
  mw.notationWrite(block, 0, 1, { note: 25, instrument: 3, length: 3 });
  assert.equal(block.rows[1][0].note, 25);
  assert.equal(block.rows[1][0].ins, 3);
  assert.equal(block.rows[2][0].note, 0);
  assert.equal(block.rows[2][0].ins, 3);
  assert.equal(block.rows[3][0].ins, 3);
  assert.equal(block.rows[4][0].ins, 0);
});

test('notation insertion and deletion shift only the selected track', () => {
  const mw = runtime(['ui-displays']);
  const block = mw.createBlock(2, 8);
  block.rows[1][0].note = 10; block.rows[1][1].note = 20;
  mw.notationWrite(block, 0, 1, { note: 25, instrument: 3, length: 2, insert: true });
  assert.equal(block.rows[3][0].note, 10);
  assert.equal(block.rows[1][1].note, 20);
  mw.notationWrite(block, 0, 1, { length: 2, remove: true });
  assert.equal(block.rows[1][0].note, 10);
  assert.equal(block.rows[1][1].note, 20);
});

test('key signatures affect score spelling and notes entered on the staff', () => {
  const mw = runtime(['ui-displays']);
  const gMajor = { count: 1, flat: false };
  const fMajor = { count: 1, flat: true };
  assert.equal(mw.notationNoteAtStep(3, gMajor), 7); // F-sharp 1
  assert.equal(mw.notationNoteAtStep(6, fMajor), 11); // B-flat 1
  assert.equal(mw.notationPitch(7, gMajor).accidental, '');
  assert.equal(mw.notationPitch(6, gMajor).accidental, 'natural');
  assert.equal(mw.notationPitch(11, fMajor).accidental, '');
  assert.equal(mw.notationPitch(12, fMajor).accidental, 'natural');
  assert.equal(mw.notationPitch(11, fMajor).step, 6);
});

test('six-accidental keys spell enharmonic boundary notes on the correct staff step', () => {
  const mw = runtime(['ui-displays']);
  assert.equal(mw.notationPitch(6, {count: 6, flat: false}).step, 2); // E-sharp
  assert.equal(mw.notationPitch(6, {count: 6, flat: false}).accidental, '');
  assert.equal(mw.notationPitch(12, {count: 6, flat: true}).step, 7); // C-flat
  assert.equal(mw.notationPitch(12, {count: 6, flat: true}).accidental, '');
});

test('score accidentals persist for the same pitch within a measure and reset afterwards', () => {
  const mw = runtime(['ui-displays']); const key = {count: 0, flat: false}; const state = {};
  const fSharp = mw.notationPitch(7, key), fNatural = mw.notationPitch(6, key);
  assert.equal(mw.notationAccidental(7, fSharp, key, state), 'sharp');
  assert.equal(mw.notationAccidental(7, fSharp, key, state), '');
  assert.equal(mw.notationAccidental(6, fNatural, key, state), 'natural');
  assert.equal(mw.notationAccidental(6, fNatural, key, state), '');
  assert.equal(mw.notationAccidental(7, fSharp, key, {}), 'sharp');
  const gMajor = {count: 1, flat: false}; const inKey = {};
  assert.equal(mw.notationAccidental(6, mw.notationPitch(6, gMajor), gMajor, inKey), 'natural');
  assert.equal(mw.notationAccidental(7, mw.notationPitch(7, gMajor), gMajor, inKey), 'sharp');
});

test('notation selection is independent of the tracker cursor and may be unset', () => {
  const mw = runtime(['ui-displays']);
  const app = { cursor: { track: 2 } };
  mw.notationPreset(app, 0);
  assert.equal(app.notaSelectedTrack, null);
  mw.notationSelectTrack(app, 7);
  assert.equal(app.notaSelectedTrack, 7);
  assert.equal(app.cursor.track, 2);
  assert.equal(app.notaGhost[7], false);
  assert.equal(app.notaGhost[2], true);
  mw.notationPreset(app, 1);
  assert.equal(app.notaSelectedTrack, null);
  mw.notationPreset(app, 0);
  assert.equal(app.notaSelectedTrack, 7);
  assert.equal(app.cursor.track, 2);
});

test('score pointer mapping uses the visible measure and selected key', () => {
  const mw = runtime(['ui-displays']);
  const layout = { left: 100, right: 260, start: 16, per: 16, middle: 100, step: 8 };
  const hit = mw.notationHit(layout, 125, 116, {count: 1, flat: false}, 64);
  assert.equal(hit.line, 18);
  assert.equal(hit.note, 19); // F-sharp in the second octave
  assert.equal(mw.notationHit(layout, 99, 100, {}, 64), null);
});

test('score duration follows continuation cells without consuming effects or new notes', () => {
  const mw = runtime(['ui-displays']); const b = mw.createBlock(1, 8);
  b.rows[0][0].note = 25; b.rows[0][0].ins = 3;
  b.rows[1][0].ins = 3; b.rows[2][0].ins = 3;
  b.rows[3][0].ins = 3; b.rows[3][0].cmd = 12;
  assert.equal(mw.notationDuration(b, 0, 0), 3);
  b.rows[2][0].note = 28;
  assert.equal(mw.notationDuration(b, 0, 0), 2);
});

test('blank tracker rows are pauses, while instrument-only rows hold notes with implicit instruments', () => {
  const mw = runtime(['ui-displays']); const b = mw.createBlock(1, 8);
  b.rows[0][0].note = 25; // instrument reused from an earlier note
  assert.equal(mw.notationDuration(b, 0, 0), 1);
  b.rows[1][0].ins = 3; b.rows[2][0].ins = 3;
  assert.equal(mw.notationDuration(b, 0, 0), 3);
  assert.equal(mw.notationDuration(b, 0, 3), 0);
});

test('score durations are split into representable tied notes at measure boundaries', () => {
  const mw = runtime(['ui-displays']);
  assert.deepEqual(Array.from(mw.notationDurationParts(5, 0, 16), x => [x.offset, x.length, x.dotted]), [[0, 4, false], [4, 1, false]]);
  assert.deepEqual(Array.from(mw.notationDurationParts(6, 0, 16), x => [x.offset, x.length, x.dotted]), [[0, 4, true]]);
  assert.deepEqual(Array.from(mw.notationDurationParts(6, 12, 16), x => [x.offset, x.length, x.dotted]), [[0, 4, false], [4, 2, false]]);
});

test('score renders a held note continued from the preceding measure', () => {
  const mw = runtime(['ui-displays']);
  const block = mw.createBlock(1, 32);
  mw.notationWrite(block, 0, 14, { note: 25, instrument: 3, length: 4 });
  mw.app = { cursor: { line: 16 }, timeSig: 4, notaTracks: {0: true}, keySig: {count: 0} };
  const calls = [];
  const ctx = new Proxy({}, { get(target, name) {
    if (!(name in target)) target[name] = (...args) => calls.push([name, ...args]);
    return target[name];
  }});
  const canvas = { style: {}, getContext: () => ctx };
  mw.displays.drawSheet(canvas, block, 1, 760, 16);
  assert.equal(calls.filter(c => c[0] === 'ellipse').length, 1);
  assert.ok(calls.some((c, i) => c[0] === 'moveTo' && c[1] === 760 * .16 && calls[i + 1]?.[0] === 'quadraticCurveTo'), 'tie starts at the measure edge');
});

test('rendered score marks changes in accidental state rather than every repeated note', () => {
  const mw = runtime(['ui-displays']); const block = mw.createBlock(1, 16);
  for (const [line, note] of [[0, 7], [2, 7], [4, 6]]) block.rows[line][0] = { note, ins: 1, cmd: 0, dat: 0 };
  mw.app = { cursor: { line: 0 }, timeSig: 4, notaTracks: {0: true}, keySig: {count: 0} };
  const labels = [];
  const ctx = new Proxy({}, { get(target, name) {
    if (!(name in target)) target[name] = (...args) => { if (name === 'fillText') labels.push(args[0]); };
    return target[name];
  }});
  mw.displays.drawSheet({ style: {}, getContext: () => ctx }, block, 1, 760, 0);
  assert.deepEqual(labels.filter(x => x === '♯' || x === '♮'), ['♯', '♮']);
});

test('notation data round-trips signatures, presets and signed hidden transpositions in MMD0 and MMD1', () => {
  const mw = runtime(['loaders','writer']);
  for (const write of [mw.writeMMD0, mw.writeMMD1]) {
    const s = mw.createSong();
    s.notation = { keySig: {count: 3, flat: true}, timeSig: 3,
      presets: Array.from({length: 5}, (_, i) => ({ track: i === 0 ? 2 : null, tracks: {0: i === 0, 2: true}, ghost: {2: i === 0} })),
      instruments: {1:{transpose:-12,hide:false}, 2:{transpose:12,hide:true}, 3:{transpose:-5,hide:true}} };
    const loaded = mw.loadModule(write(s));
    assert.equal(loaded.notation.keySig.count, 3); assert.equal(loaded.notation.keySig.flat, true);
    assert.equal(loaded.notation.timeSig, 3);
    assert.equal(loaded.notation.presets[0].track, 2);
    assert.equal(loaded.notation.presets[1].track, null);
    assert.equal(loaded.notation.presets[0].tracks[0], true);
    assert.equal(loaded.notation.presets[1].tracks[0], false);
    assert.equal(loaded.notation.presets[0].ghost[2], true);
    assert.equal(loaded.notation.instruments[1].transpose, -12);
    assert.equal(loaded.notation.instruments[1].hide, false);
    assert.equal(loaded.notation.instruments[2].transpose, 12);
    assert.equal(loaded.notation.instruments[2].hide, true);
    assert.equal(loaded.notation.instruments[3].transpose, -5);
    assert.equal(loaded.notation.instruments[3].hide, true);
  }
});

test('loaded score settings initialize the editor and include unswitched preset edits on save', () => {
  const mw = runtime(['ui-displays']);
  const app = { cursor: {track: 0}, song: { notation: { keySig: { count: 2, flat: true }, timeSig: 3,
    presets: [{track: 1, tracks: {1:true}, ghost: {0:true}}], instruments: {1:{hide:true,transpose:12}} } } };
  mw.initNotation(app);
  assert.equal(app.notaSelectedTrack, 1);
  assert.equal(app.notaTracks[1], true);
  assert.equal(app.notaInstruments[1].hide, true);
  assert.equal(app.timeSig, 3);
  app.notaTracks[1] = false;
  const saved = mw.captureNotation(app);
  assert.equal(saved.presets[0].tracks[1], false);
  assert.equal(saved.keySig.flat, true);
});

test('module without saved score settings has no NotationInfo pointer', () => {
  const mw = runtime(['loaders','writer']);
  for (const write of [mw.writeMMD0,mw.writeMMD1]) {
    const buffer = write(mw.createSong()); const dv = new DataView(buffer);
    const exp = dv.getUint32(32, false);
    assert.equal(dv.getUint32(exp + 40, false), 0);
    assert.equal(mw.loadModule(buffer).notation, null);
  }
});

test('notation reader interprets a hand-authored OctaMED structure', () => {
  const mw = runtime(); const dv = new DataView(new ArrayBuffer(110)); const o = 2;
  dv.setUint8(o, 2); dv.setUint8(o + 1, 3);
  for(let p = 0; p < 5; p++) dv.setInt16(o + 2 + p * 2, -1, false);
  dv.setInt16(o + 2, 3, false); dv.setUint8(o + 12, 0x05); dv.setUint8(o + 28, 0x02);
  dv.setUint8(o + 44, 0xf4); // -12, visible
  dv.setUint8(o + 45, 0xb4); // -12, bit 6 inverted: hidden
  const n = mw.readNotationInfo(dv, o);
  assert.equal(n.keySig.count, 2); assert.equal(n.keySig.flat, true); assert.equal(n.timeSig, 3);
  assert.equal(n.presets[0].track, 3); assert.equal(n.presets[2].tracks[0], true); assert.equal(n.presets[1].ghost[0], true);
  assert.equal(n.instruments[1].transpose, -12); assert.equal(n.instruments[1].hide, false);
  assert.equal(n.instruments[2].transpose, -12); assert.equal(n.instruments[2].hide, true);
});
