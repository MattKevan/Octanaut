#!/usr/bin/env node
/* Content-hash the scripts and stylesheets index.html loads.
 *
 * The sources keep their names in web/js and web/css, so the tests can load
 * js/core.js directly and opening web/index.html from disk still works with no
 * build. Each run copies every referenced file to web/assets with a hash of its
 * contents in the name, rewrites index.html to point at those copies, and
 * deletes the copies nothing refers to any more.
 *
 *   node scripts/hash-assets.js           one pass, used by npm run build
 *   node scripts/hash-assets.js --watch   rebuild when js/ or css/ changes
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WEB = path.join(__dirname, '..', 'web');
const INDEX = path.join(WEB, 'index.html');
const OUT = path.join(WEB, 'assets');
const HASH_LENGTH = 10;

/* The two ways a reference can look: the source name, as written by hand, and
   the hashed name, as rewritten by a previous run. */
const SOURCE_REF = /(\b(?:src|href))="((?:js|css)\/[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g;
const HASHED_REF = /(\b(?:src|href))="assets\/([^"?]+)\.([0-9a-f]{8,64})\.(js|css)"/g;

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, HASH_LENGTH);
}

function sourceFor(name, ext) {
  return (ext === 'js' ? 'js/' : 'css/') + name + '.' + ext;
}

/* Every js/css reference in the page, in the order it appears, as source
   names ('js/app.js') rather than what the tag currently says. */
function references(html) {
  const found = [];
  html.replace(SOURCE_REF, (match, attr, source) => {
    found.push(source);
    return match;
  });
  html.replace(HASHED_REF, (match, attr, name, hash, ext) => {
    found.push(sourceFor(name, ext));
    return match;
  });
  return found;
}

function build() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const sources = references(html);
  if (!sources.length) throw new Error('index.html references no scripts or stylesheets');

  fs.mkdirSync(OUT, { recursive: true });
  const target = new Map();
  const keep = new Set();

  for (const source of sources) {
    const file = path.join(WEB, source);
    if (!fs.existsSync(file)) throw new Error('index.html references a missing file: ' + source);
    const ext = path.extname(source);
    const name = path.basename(source, ext);
    const hashed = name + '.' + digest(file) + ext;
    target.set(source, 'assets/' + hashed);
    keep.add(hashed);
    const copy = path.join(OUT, hashed);
    if (!fs.existsSync(copy)) fs.copyFileSync(file, copy);
  }

  /* Rewrite whatever the tags say now to the current hashed name. */
  let out = html.replace(SOURCE_REF, (match, attr, source) => {
    return attr + '="' + target.get(source) + '"';
  });
  out = out.replace(HASHED_REF, (match, attr, name, hash, ext) => {
    const source = sourceFor(name, ext);
    const hashed = target.get(source);
    return hashed ? attr + '="' + hashed + '"' : match;
  });

  const changed = out !== html;
  if (changed) fs.writeFileSync(INDEX, out);

  let removed = 0;
  for (const name of fs.readdirSync(OUT)) {
    if (keep.has(name)) continue;
    fs.unlinkSync(path.join(OUT, name));
    removed++;
  }

  const summary = `${sources.length} assets, ${keep.size} hashed`;
  console.log(changed || removed ? `assets: ${summary}, ${removed} removed` : `assets: ${summary}, unchanged`);
}

function watch() {
  build();
  let timer = 0;
  const kick = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { build(); } catch (err) { console.error('assets: ' + err.message); }
    }, 120);
  };
  fs.watch(path.join(WEB, 'js'), kick);
  fs.watch(path.join(WEB, 'css'), kick);
  console.log('assets: watching web/js and web/css');
}

if (process.argv.includes('--watch')) watch();
else {
  try { build(); } catch (err) { console.error('assets: ' + err.message); process.exit(1); }
}
