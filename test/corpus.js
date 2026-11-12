// Optional local fixtures: music stays outside the source repository.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const mw = require('./helpers/runtime')(['loaders']);

const root = path.resolve(process.argv[2] || path.join(__dirname, '../../fixtures/modland'));
const manifest = fs.readFileSync(path.join(root, 'manifest.tsv'), 'utf8');
const entries = manifest.trim().split(/\r?\n/).slice(1);
const formats = {};
let failures = 0;
for (const entry of entries) {
  const [name, md5, size] = entry.split('\t');
  try {
    const bytes = fs.readFileSync(path.join(root, name));
    assert.equal(bytes.length, Number(size), 'fixture size changed');
    assert.equal(crypto.createHash('md5').update(bytes).digest('hex'), md5, 'fixture checksum changed');
    const song = mw.loadModule(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
    assert.ok(song && song.blocks.length && song.playseq.length, 'missing song data');
    for (const block of song.playseq) assert.ok(song.blocks[block], 'invalid play sequence reference');
    formats[song.format] = (formats[song.format] || 0) + 1;
  } catch (error) {
    failures++;
    console.error(`${name}: ${error.message}`);
  }
}
console.log(`${entries.length - failures}/${entries.length} fixtures loaded; ${failures} failures`);
console.log(formats);
process.exitCode = failures ? 1 : 0;
