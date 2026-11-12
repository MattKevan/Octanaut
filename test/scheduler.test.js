const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

function setup(lines) {
  const mw = runtime(['engine']); const s = mw.createSong();
  s.blocks = [mw.createBlock(1, lines)]; s.tempo2 = 1;
  mw.player.setSong(s); mw.player.offline = true; mw.player.playing = true;
  const rows = [], notes = [];
  mw.player.onRow = row => rows.push(row.line);
  mw.player.trigger = (ch, note) => notes.push(note);
  return { mw, s, p: mw.player, rows, notes };
}

test('1602 repeats the marked section twice, then reaches the following row', () => {
  const { s, p, rows } = setup(4);
  Object.assign(s.blocks[0].rows[0][0], { cmd: 0x16, dat: 0 });
  Object.assign(s.blocks[0].rows[2][0], { cmd: 0x16, dat: 2 });
  for (let n = 0; n < 20 && !p.offlineDone; n++) p.step(n * 0.02);
  assert.deepEqual(rows, [0, 1, 2, 0, 1, 2, 0, 1, 2, 3]);
  assert.equal(p.offlineDone, true);
});

test('consecutive loops start with fresh repeat counts', () => {
  const { s, p, rows } = setup(5);
  for (const [row, dat] of [[0, 0], [1, 1], [2, 0], [3, 1]]) {
    Object.assign(s.blocks[0].rows[row][0], { cmd: 0x16, dat });
  }
  for (let n = 0; n < 20 && !p.offlineDone; n++) p.step(n * 0.02);
  assert.deepEqual(rows, [0, 1, 0, 1, 2, 3, 2, 3, 4]);
});

for (const row of [0, 2]) {
  test(`1E02 holds row ${row} and triggers every note once, including at block end`, () => {
    const { s, p, rows, notes } = setup(3);
    s.blocks[0].rows.forEach((r, n) => { r[0].note = n + 13; });
    Object.assign(s.blocks[0].rows[row][0], { cmd: 0x1e, dat: 2 });
    for (let n = 0; n < 12 && !p.offlineDone; n++) p.step(n * 0.02);
    assert.deepEqual(rows, row === 0 ? [0, 0, 0, 1, 2] : [0, 1, 2, 2, 2]);
    assert.deepEqual(notes, [13, 14, 15]);
    assert.equal(p.offlineDone, true);
  });
}

test('stop and song replacement clear pending loop and delay state', () => {
  const { mw, p } = setup(3);
  for (const reset of [() => p.stop(), () => p.setSong(mw.createSong())]) {
    Object.assign(p, { loopStart: 2, loopCount: 3, loopLine: 2, lineDelay: 2, delayLine: true });
    reset();
    assert.equal(p.loopStart, -1); assert.equal(p.loopCount, 0);
    assert.equal(p.loopLine, null); assert.equal(p.lineDelay, 0); assert.equal(p.delayLine, false);
  }
});
