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

/* ---- extended command audit (OctaMED v4 manual, commands chapter) ---- */

function tickChannel(overrides) {
  const calls = [];
  return {
    calls,
    ch: {
      idx: 0, cmd: 0, dat: 0, period: 428, target: 0, portaSpeed: 0, volume: 64,
      vibPos: 0, vibSpeed: 0, vibDepth: 0, tremPos: 0, tremSpeed: 0, tremDepth: 0,
      src: { playbackRate: { setValueAtTime: (v) => calls.push(v) } },
      gain: { gain: { setValueAtTime() {} } }, rate: 1, inst: null, ...overrides
    }
  };
}

test('05 slides pitch toward the porta target and fades by the low nibble', () => {
  player.song = song();
  const { ch } = tickChannel({ cmd: 0x05, dat: 0x02, period: 400, target: 300, portaSpeed: 4, volume: 40 });
  player.channelTick(ch, 0);
  assert.equal(ch.period, 396);
  assert.equal(ch.volume, 38);
});

test('06 fades by its argument and keeps the vibrato running', () => {
  player.song = song();
  const { ch } = tickChannel({ cmd: 0x06, dat: 0x21, volume: 40, vibPos: 0, vibSpeed: 3, vibDepth: 6 });
  player.channelTick(ch, 0);
  assert.equal(ch.volume, 42);
  assert.ok(ch.vibPos > 0);
  assert.equal(ch.vibDepth, 6, '06 does not reset the vibrato parameters');
});

test('07 moves the volume offset by the tremolo depth', () => {
  player.song = song();
  const { ch } = tickChannel({ cmd: 0x07, dat: 0x4a, tremPos: 0 });
  player.channelTick(ch, 0);
  assert.notEqual(ch.volOffset || 0, 0);
});

test('09 sets the secondary tempo and 0b queues a sequence jump', () => {
  player.song = song();
  const { ch } = tickChannel({});
  ch.cmd = 0x09; ch.dat = 4; player.startEffect(ch, 0, null);
  assert.equal(player.tempo2, 4);
  ch.cmd = 0x0b; ch.dat = 7; player.startEffect(ch, 0, null);
  assert.equal(player.pendingSeq, 7);
});

test('16 loops back to the marked line for the given count', () => {
  player.song = song();
  const { ch } = tickChannel({});
  player.line = 12; player.loopStart = -1; player.loopCount = 0;
  ch.cmd = 0x16; ch.dat = 0; player.startEffect(ch, 0, null);
  assert.equal(player.loopStart, 12);
  ch.dat = 2; player.startEffect(ch, 0, null);
  assert.equal(player.loopCount, 2);
  assert.equal(player.loopLine, 12);
});

test('1e delays the next line and 1c sends a MIDI preset', () => {
  player.song = song();
  const sent = [];
  global.MW.midi = { send: (bytes) => sent.push(bytes) };
  const { ch } = tickChannel({ inst: { midiChannel: 3 } });
  ch.cmd = 0x1e; ch.dat = 3; player.startEffect(ch, 0, null);
  assert.equal(player.lineDelay, 3);
  ch.cmd = 0x1c; ch.dat = 0x12; player.startEffect(ch, 0, null);
  assert.deepEqual(sent[0], [0xc2, 0x12]);
  delete global.MW.midi;
});

/* ---- hold and decay rules (manual + OctaMEDIC's libxmp-derived notes) ---- */

test('a hold symbol stops the hold counting down while it continues', () => {
  player.song = song({ blocks: [{ lines: 4, tracks: 1, rows: [
    [{ note: 25, ins: 1, cmd: 0, dat: 0 }],
    [{ note: 0, ins: 1, cmd: 0, dat: 0 }],
    [{ note: 0, ins: 1, cmd: 0, dat: 0 }],
    [{ note: 0, ins: 0, cmd: 0, dat: 0 }]
  ] }] });
  const { ch } = tickChannel({ note: 25, holdLeft: 2, decayRate: 0, volume: 64 });
  player.channels = [ch];
  player.blockIdx = 0; player.line = 0;
  ch.holdLeft = 2;
  player.channelTick(ch, 0);
  assert.equal(ch.holdLeft, 2, 'held while the next line holds');
  player.line = 2;
  player.channelTick(ch, 0);
  assert.equal(ch.holdLeft, 1, 'counts down once the hold chain ends');
});

test('an instrument with hold 0 ignores hold and decay', () => {
  player.song = song({
    instruments: [{ volume: 50, hold: 0, decay: 5, data: new Float32Array(4) }],
    blocks: [{ lines: 2, tracks: 1, rows: [
      [{ note: 25, ins: 1, cmd: 0, dat: 0 }],
      [{ note: 0, ins: 0, cmd: 0, dat: 0 }]
    ] }]
  });
  const { ch } = tickChannel({ volume: 50 });
  player.channels = [ch];
  player.line = 0; player.blockIdx = 0;
  player.readLine(player.song.blocks[0], 0, false);
  assert.equal(ch.holdLeft, -1);
  assert.equal(ch.decayLeft, -1);
});

test('0C does nothing once the track has run out of hold', () => {
  player.song = song({ flags: { volhex: 1 } });
  const { ch } = tickChannel({ over: true, volume: 0 });
  ch.cmd = 0x0c; ch.dat = 0x40;
  player.startEffect(ch, 0, null);
  assert.equal(ch.volume, 0, 'over tracks ignore volume commands until restarted');
});

test('a hold symbol restores the instrument volume', () => {
  player.song = song({
    instruments: [{ volume: 50, hold: 3, decay: 1, data: new Float32Array(4) }],
    blocks: [{ lines: 2, tracks: 1, rows: [
      [{ note: 0, ins: 1, cmd: 0, dat: 0 }],
      [{ note: 0, ins: 0, cmd: 0, dat: 0 }]
    ] }]
  });
  const { ch } = tickChannel({ volume: 10 });
  player.channels = [ch];
  player.line = 0; player.blockIdx = 0;
  player.readLine(player.song.blocks[0], 0, true);
  assert.equal(ch.volume, 50);
});
