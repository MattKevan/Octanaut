/* Tests for the audio engine's pure mixing rules.
 *
 *   node --test test/engine.test.js
 *
 * These cover the values the scheduler writes into AudioParams: pan,
 * gain and playback rate. They need no AudioContext.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

require('../web/js/core.js');
require('../web/js/engine.js');

const player = global.MW.player;

function song(overrides) {
  return {
    stereo: false,
    channels: 4,
    trkvol: [64, 64, 64, 64, 64, 64, 64, 64],
    mastervol: 64,
    pans: [0, 0, 0, 0, 0, 0, 0, 0],
    flags: { filteron: 0, volhex: 1 },
    ...overrides
  };
}

test('four-channel songs use Amiga hard panning', () => {
  player.song = song({ stereo: false });
  assert.equal(player.panOf(0), -0.7);
  assert.equal(player.panOf(1), 0.7);
  assert.equal(player.panOf(2), 0.7);
  assert.equal(player.panOf(3), -0.7);
  assert.equal(player.panOf(4), -0.7);
});

test('free-pan songs map pan bytes from -16..16 to -1..1', () => {
  player.song = song({ stereo: true, pans: [0, 16, -16, 8] });
  assert.equal(player.panOf(0), 0);
  assert.equal(player.panOf(1), 1);
  assert.equal(player.panOf(2), -1);
  assert.equal(player.panOf(3), 0.5);
});

test('gain combines track, master and instrument volume', () => {
  player.song = song();
  player.authentic = false;
  const ch = { idx: 0, volume: 64, muted: false };
  assert.equal(player.gainFor(ch, { volume: 64 }), 0.26);
  assert.equal(player.gainFor({ idx: 0, volume: 32, muted: false }, { volume: 64 }), 0.13);
  assert.equal(player.gainFor({ idx: 0, volume: 64, muted: true }, { volume: 64 }), 0);
});

test('gain follows track and master volume', () => {
  player.song = song({ trkvol: [32, 64, 64, 64], mastervol: 32 });
  player.authentic = false;
  assert.equal(player.gainFor({ idx: 0, volume: 64, muted: false }, { volume: 64 }), 0.065);
});

test('authentic eight-channel mode halves split channels', () => {
  player.song = song({ channels: 8 });
  player.authentic = true;
  player.hwVol = [64, 64, 64, 64];
  assert.equal(player.gainFor({ idx: 0, volume: 64, muted: false }, { volume: 64 }), 0.13);
  player.authentic = false;
  assert.equal(player.gainFor({ idx: 0, volume: 64, muted: false }, { volume: 64 }), 0.26);
});

test('gain never exceeds the base gain', () => {
  player.song = song();
  player.authentic = false;
  assert.equal(player.gainFor({ idx: 0, volume: 128, muted: false }, { volume: 128 }), 0.26);
});

test('playback rate follows the period and finetune', () => {
  assert.equal(player.rateFor({ period: 428, inst: { finetune: 0 } }), 1);
  assert.equal(player.rateFor({ period: 214, inst: { finetune: 0 } }), 2);
  assert.equal(player.rateFor({ period: 428, inst: { finetune: 96 } }), 2);
});

test('FF8 and FF9 switch the low-pass filter flag', () => {
  player.song = song({ flags: { filteron: 1, volhex: 1 } });
  const ch = { cmd: 0x0f, dat: 0xf8, idx: 0 };
  player.startEffect(ch, 0, null);
  assert.equal(player.song.flags.filteron, 0);
  ch.dat = 0xf9;
  player.startEffect(ch, 0, null);
  assert.equal(player.song.flags.filteron, 1);
});

test('MIDI program change, aftertouch and channel pressure are sent', () => {
  const calls = [];
  global.MW.midi = { enabled: true, send: bytes => calls.push(bytes) };
  player.song = song();
  const ch = { cmd: 0x1c, dat: 5, note: 60, inst: { midiChannel: 2, midiPreset: 0 } };
  player.startEffect(ch, 0, null);
  ch.cmd = 0x0a; ch.dat = 40;
  player.startEffect(ch, 0, null);
  ch.cmd = 0x0d; ch.dat = 12;
  player.startEffect(ch, 0, null);
  assert.deepEqual(calls, [
    [0xc1, 5],
    [0xa1, 60, 40],
    [0xd1, 12]
  ]);
});

test('command 10 sends the stored MIDI message', () => {
  const calls = [];
  global.MW.midi = { enabled: true, send: bytes => calls.push(bytes) };
  global.MW.app = { midiMessages: [{ data: [0xf0, 0x7e, 0xf7] }] };
  player.startEffect({ cmd: 0x10, dat: 0 }, 0, null);
  assert.deepEqual(calls, [[0xf0, 0x7e, 0xf7]]);
});

test('command 16 loops back to the marked line', () => {
  player.song = song();
  player.line = 4;
  player.loopStart = -1;
  player.loopLine = null;
  player.startEffect({ cmd: 0x16, dat: 0 }, 0, null);
  player.line = 6;
  player.startEffect({ cmd: 0x16, dat: 2 }, 0, null);
  assert.equal(player.loopStart, 4);
  assert.equal(player.loopLine, 4);
});

test('command 1E delays the current line', () => {
  player.startEffect({ cmd: 0x1e, dat: 3 }, 0, null);
  assert.equal(player.lineDelay, 3);
});
