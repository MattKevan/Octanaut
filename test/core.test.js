const test = require('node:test');
const assert = require('node:assert/strict');

global.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} };
require('../web/js/core.js');

test('note names reach octave 9 and A', () => {
  assert.equal(MW.noteName(1), 'C-1');
  assert.equal(MW.noteName(97), 'C-9');
  assert.equal(MW.noteName(109), 'C-A');
  assert.equal(MW.noteName(120), 'B-A');
});

test('note parsing accepts octave A', () => {
  assert.equal(MW.noteIndex('C-1'), 1);
  assert.equal(MW.noteIndex('C-9'), 97);
  assert.equal(MW.noteIndex('C-A'), 109);
  assert.equal(MW.noteIndex('C#A'), 110);
});

test('note names round-trip through parsing', () => {
  for (const n of [1, 12, 97, 109, 110, 120]) {
    assert.equal(MW.noteIndex(MW.noteName(n)), n);
  }
});

test('MIDI hexadecimal input accepts complete bytes and rejects incomplete or invalid input', () => {
  const mw = MW;
  assert.deepEqual(Array.from(mw.parseMidiHex('F0 01 aB F7')), [240, 1, 171, 247]);
  assert.deepEqual(Array.from(mw.parseMidiHex('')), []);
  assert.equal(mw.parseMidiHex('F0 A'), null);
  assert.equal(mw.parseMidiHex('F0 ZZ'), null);
});

test('tempo 1-10 uses the SoundTracker counts and 11+ the 470000/tempo count', () => {
  assert.equal(MW.tempoCount(1), 2417);
  assert.equal(MW.tempoCount(9), 21436);
  assert.equal(MW.tempoCount(10), 24163);
  assert.equal(MW.tempoCount(33), Math.floor(470000 / 33));
  /* a tick at tempo 33 is about 20 ms, the classic 50 Hz line rate */
  assert.ok(Math.abs(MW.pulseSeconds(33, 6, false, 4) - 0.020077) < 0.0001);
  assert.equal(MW.tempoToBpm(33, 6, 4), 125);
  /* BPM mode is independent of the table */
  assert.ok(Math.abs(MW.pulseSeconds(120, 6, true, 4) - 0.020833) < 0.0001);
});

test('volume arguments convert between decimal digits and hex', () => {
  assert.equal(MW.volumeFromArg(0x40, false), 40);
  assert.equal(MW.volumeFromArg(0x40, true), 64);
  assert.equal(MW.volumeFromArg(0x99, false), 64);   // capped
  assert.equal(MW.volumeArg(40, false), 0x40);
  assert.equal(MW.volumeArg(64, true), 0x40);
  for (let v = 0; v <= 64; v++) {
    for (const hex of [false, true]) {
      assert.equal(MW.volumeFromArg(MW.volumeArg(v, hex), hex), v);
    }
  }
});

test('rewriting volumes keeps the sounding volume and skips instrument volumes', () => {
  const song = MW.createSong();
  song.flags.volhex = 0;
  song.blocks[0].rows[0][0] = { note: 1, ins: 1, cmd: 0x0c, dat: MW.volumeArg(40, false) };
  song.blocks[0].rows[1][0] = { note: 0, ins: 0, cmd: 0x0c, dat: 0x90 };
  const changed = MW.rewriteVolumeCommands(song, true);
  assert.equal(changed, 1);
  assert.equal(song.blocks[0].rows[0][0].dat, 40);   // hex 28 = 40 decimal
  assert.equal(song.blocks[0].rows[1][0].dat, 0x90); // instrument volume untouched
  assert.equal(MW.volumeFromArg(song.blocks[0].rows[0][0].dat, true), 40);
});
