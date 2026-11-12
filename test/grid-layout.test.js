const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('./helpers/runtime');

test('wide blocks fit sixteen tracks when there is enough horizontal space', () => {
  const mw = runtime(['ui-grid']);
  mw.grid.wrap = { clientWidth: 1200 };
  const width = mw.grid.trackWidth(16);
  assert.ok(width * 16 + 36 <= 1200);
  assert.ok(width >= 54);
});

test('very narrow displays retain a minimum track width for horizontal scrolling', () => {
  const mw = runtime(['ui-grid']);
  mw.grid.wrap = { clientWidth: 500 };
  assert.equal(mw.grid.trackWidth(16), 54);
});

test('cells print one command digit unless the command is extended', () => {
  const mw = runtime(['ui-grid']);
  assert.equal(mw.grid.commandText(0), '0');
  assert.equal(mw.grid.commandText(0x09), '9');
  assert.equal(mw.grid.commandText(0x0f), 'F');
  assert.equal(mw.grid.commandText(0x19), '19');
  assert.equal(mw.grid.commandText(0x2f), '2F');
});

test('track headings use hex letters past nine and stack the track count', () => {
  const mw = runtime(['ui-grid']);
  assert.equal(mw.grid.headLabels(12).join(''), '0123456789AB');
  assert.equal(mw.grid.headLabels(16).join(''), '0123456789ABCDEF');
  assert.equal(mw.grid.countStack(8).join(''), '8');
  assert.equal(mw.grid.countStack(16).join(''), '16');
});
