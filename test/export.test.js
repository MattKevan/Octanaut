/* Tests for the audio export encoders that work without a browser. */
const test = require('node:test');
const assert = require('node:assert/strict');

global.MW = {};
require('../web/js/audio-export.js');

test('WAV output has a RIFF header and interleaved 16-bit samples', () => {
  const left = new Float32Array([0.5, -0.5, 0, 0.25]);
  const right = new Float32Array([-0.5, 0.5, 0, -0.25]);
  const rendered = {
    buffer: { getChannelData: i => (i ? right : left) },
    end: 4,
    sampleRate: 44100
  };
  const wav = MW.encodeWAV(rendered);
  const view = new DataView(wav);

  assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), 'RIFF');
  assert.equal(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)), 'WAVE');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(wav.byteLength, 44 + 16);

  assert.equal(view.getInt16(44, true), 16384);
  assert.equal(view.getInt16(46, true), -16383);
  assert.equal(view.getInt16(48, true), -16383);
  assert.equal(view.getInt16(50, true), 16384);
});

test('WAV clips values outside the 16-bit range', () => {
  const left = new Float32Array([2, -2]);
  const right = new Float32Array([0, 0]);
  const wav = MW.encodeWAV({
    buffer: { getChannelData: i => (i ? right : left) },
    end: 2,
    sampleRate: 44100
  });
  const view = new DataView(wav);
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(48, true), -32768);
});
