/* Octanaut regression checks.
 *
 *   node test/run.js
 *
 * Runs the loaders headlessly (they only need a stubbed document) and
 * checks the things that are easy to break without noticing: the LHA
 * decoders against the reference archives, and the Med command byte
 * staying whole for MMD1 and later.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

require('../web/js/core.js');
require('../web/js/lha.js');
require('../web/js/loaders.js');
require('../web/js/writer.js');

const MD5 = data => crypto.createHash('md5').update(Buffer.from(data)).digest('hex');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
}

/* ------------------------------------------------------------ LHA methods */

const REFERENCE = {
  'h0_lh0.lzh': '696e2453',
  'h0_lh5.lzh': 'b234ee4d',
  'h0_lh6.lzh': 'b234ee4d',
  'h0_lh7.lzh': 'b234ee4d',
  'h1_lh5.lzh': 'b234ee4d',
  'h2_lh5.lzh': 'b234ee4d',
  'level0.lzh': '6f5902ac',
  'level1.lzh': '6f5902ac',
  'level2.lzh': '6f5902ac',
  'lh1.lzh': 'b234ee4d',
  'lh6.lzh': 'b234ee4d'
};

const lhaDir = path.join(__dirname, 'lha');
for (const file of Object.keys(REFERENCE).sort()) {
  const full = path.join(lhaDir, file);
  if (!fs.existsSync(full)) { console.log('SKIP ' + file + ' (not present)'); continue; }
  const buf = fs.readFileSync(full);
  const result = MW.readLHA(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const got = result.entries.length ? MD5(result.entries[0].data).slice(0, 8) : '(none)';
  check('lha ' + file, got === REFERENCE[file], got + ' want ' + REFERENCE[file]);
}

/* --------------------------------------------------- Med command decoding */

function loadArchive(file) {
  const buf = fs.readFileSync(path.join(lhaDir, file));
  const result = MW.readLHA(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return result.entries.map(e => {
    let song = null;
    try { song = MW.loadModule(e.data.slice().buffer); } catch (err) { song = null; }
    return { name: e.name, data: e.data, song };
  });
}

function countCommands(song) {
  const counts = {};
  for (const block of song.blocks) {
    for (const row of block.rows) {
      for (const cell of row) {
        if (cell.cmd) counts[cell.cmd] = (counts[cell.cmd] || 0) + 1;
      }
    }
  }
  return counts;
}

const ruff = loadArchive('RuffCut.lha').find(e => e.song);
if (!ruff) {
  console.log('SKIP MMD1 command test (RuffCut.lha not present)');
} else {
  const song = ruff.song;
  const counts = countCommands(song);
  check('MMD1 detected', song.format === 'MMD1', song.format);
  check('0x19 kept whole', (counts[0x19] || 0) > 0, '0x19 x' + (counts[0x19] || 0));
  check('no masked 0x09 storm', (counts[0x09] || 0) < 100, '0x09 x' + (counts[0x09] || 0));
  check('song tempo intact', song.deftempo === 44 && song.tempo2 === 6,
    song.deftempo + '/' + song.tempo2);

  const cells = song.blocks[0].rows[0];
  const hat = cells[3];
  check('block 07 hi-hat uses sample offset', hat.cmd === 0x19 && hat.dat > 0,
    'cmd 0x' + hat.cmd.toString(16) + ' dat ' + hat.dat);

  /* saving to MMD0 must drop the extended command, not turn it into tempo */
  const saved = MW.loadModule(MW.writeMMD0(song));
  const back = countCommands(saved);
  check('MMD0 save drops 0x19', !back[0x19]);
  check('MMD0 save keeps real tempo change', (back[0x09] || 0) > 0, 'x' + (back[0x09] || 0));
  check('MMD0 save keeps block count', saved.blocks.length === song.blocks.length,
    saved.blocks.length + '/' + song.blocks.length);
}

/* --------------------------------------------------- MMD1 round trip */

const v4 = MW.createSong();
v4.name = 'v4 test';
v4.channels = 8;
v4.bpmMode = true;
v4.linesPerBeat = 4;
MW.resizeBlock(v4.blocks[0], 16, 300);
v4.blocks[0].name = 'Long block';
v4.blocks[0].highlight[299] = 1;
const lastCell = v4.blocks[0].rows[299][15];
lastCell.note = 60;
lastCell.ins = 3;
lastCell.cmd = 0x19;
lastCell.dat = 7;
const testInst = MW.createInstrument('sample');
testInst.name = 'Test sample';
testInst.data = new Float32Array(128).fill(0.25);
testInst.finetune = -3;
testInst.hold = 5;
testInst.decay = 2;
v4.instruments[2] = testInst;

let mmd0Refused = false;
try { MW.writeMMD0(v4); } catch (e) { mmd0Refused = /256/.test(String(e && e.message)); }
check('MMD0 refuses blocks over 256 lines', mmd0Refused);

const v4back = MW.loadModule(MW.writeMMD1(v4));
check('MMD1 detected', v4back.format === 'MMD1', v4back.format);
check('MMD1 300 lines', v4back.blocks[0].lines === 300, String(v4back.blocks[0].lines));
check('MMD1 16 tracks', v4back.blocks[0].tracks === 16, String(v4back.blocks[0].tracks));
check('MMD1 extended command', v4back.blocks[0].rows[299][15].cmd === 0x19,
  '0x' + v4back.blocks[0].rows[299][15].cmd.toString(16));
check('MMD1 block name', v4back.blocks[0].name === 'Long block', v4back.blocks[0].name);
check('MMD1 highlight', v4back.blocks[0].highlight[299] === 1, String(v4back.blocks[0].highlight[299]));
check('MMD1 finetune', v4back.instruments[2].finetune === -3, String(v4back.instruments[2].finetune));
check('MMD1 hold/decay', v4back.instruments[2].hold === 5 && v4back.instruments[2].decay === 2,
  v4back.instruments[2].hold + '/' + v4back.instruments[2].decay);
check('MMD1 BPM mode', v4back.bpmMode === true && v4back.linesPerBeat === 4,
  v4back.bpmMode + '/' + v4back.linesPerBeat);

const noInstr = MW.loadModule(MW.writeMMD1(v4, [], { instruments: false }));
check('MMD1 no instruments keeps names', !!(noInstr.instruments[2] && noInstr.instruments[2].missing && noInstr.instruments[2].name === 'Test sample'),
  noInstr.instruments[2] ? noInstr.instruments[2].name : 'none');

const second = MW.createSong();
second.name = 'second song';
second.playseq = [0];
const multi = MW.loadModule(MW.writeMMD1(v4, [second]));
check('MMD1 multi-module chain', multi.multis && multi.multis.length === 1,
  String(multi.multis ? multi.multis.length : 0));
check('MMD1 second song name', multi.multis && multi.multis[0].name === 'second song',
  multi.multis ? multi.multis[0].name : '');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
