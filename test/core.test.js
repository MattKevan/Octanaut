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
