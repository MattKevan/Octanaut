const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runtime = require('./helpers/runtime');

const INDEX = `# Modland OctaMED index for Octanaut.
# Generated 2026-11-12 from https://ftp.modland.com/pub/documents/allmods_md5.zip
# 3 modules by 2 composers, formats: OctaMED MMD0, OctaMED MMD1
# Paths are relative to /pub/modules/. Metadata only: no module bytes.
OctaMED MMD0/Alpha/one.mmd0
OctaMED MMD1/Alpha/two.mmd1
OctaMED MMD1/Beta (UK)/nested/three.mmd1
`;

const MANIAC = fs.readFileSync(path.join(__dirname, '../web/fixtures/maniac-beat.mmd1'));

function response(bytes, status) {
  return {
    ok: status == null || status < 400,
    status: status || 200,
    headers: { get: name => name === 'content-length' ? String(bytes.length) : null },
    async text() {
      return Buffer.from(bytes).toString('utf8');
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

function setup(fetchImpl) {
  const mw = runtime(['loaders', 'modland'], { fetch: fetchImpl });
  mw.modland.use(mw.modland.memoryAdapter());
  return mw;
}

test('the index parser skips headers and understands md5 columns', () => {
  const mw = setup();
  const parsed = mw.modlandParseIndex(INDEX);
  assert.equal(parsed.built, '2026-11-12');
  assert.equal(parsed.entries.length, 3);
  assert.equal(parsed.entries[1].name, 'two.mmd1');
  assert.equal(parsed.entries[1].format, 'OctaMED MMD1');
  assert.equal(parsed.entries[1].folder, 'Alpha');

  const withMd5 = '0123456789abcdef0123456789abcdef\tOctaMED MMD1/Alpha/two.mmd1\n';
  const second = mw.modlandParseIndex(withMd5);
  assert.equal(second.entries[0].path, 'OctaMED MMD1/Alpha/two.mmd1');
});

test('the tree lists formats, folders and files', async () => {
  const mw = setup(async () => response(Buffer.from(INDEX)));
  await mw.modland.loadIndex();

  const root = Array.from(mw.modland.list(''), entry => entry.name);
  assert.deepEqual(root, ['OctaMED MMD0', 'OctaMED MMD1']);

  const formats = mw.modland.list('OctaMED MMD1');
  assert.deepEqual(Array.from(formats, entry => entry.name), ['Alpha', 'Beta (UK)']);
  assert.ok(formats.every(entry => entry.dir && entry.volume === 'DH0:' && entry.remote));

  const nested = mw.modland.list('OctaMED MMD1/Beta (UK)');
  assert.deepEqual(Array.from(nested, entry => entry.name), ['nested']);

  const files = mw.modland.list('OctaMED MMD1/Beta (UK)/nested');
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'three.mmd1');
  assert.equal(files[0].dir, false);
  assert.equal(files[0].path, 'OctaMED MMD1/Beta (UK)/nested/three.mmd1');

  assert.equal(mw.modland.list('OctaMED MMD1/nope').length, 0);
});

test('search matches titles and composers', async () => {
  const mw = setup(async () => response(Buffer.from(INDEX)));
  await mw.modland.loadIndex();
  assert.deepEqual(Array.from(mw.modland.search('alpha'), entry => entry.name), ['one.mmd0', 'two.mmd1']);
  assert.deepEqual(Array.from(mw.modland.search('nested'), entry => entry.name), ['three.mmd1']);
  assert.equal(mw.modland.search('').length, 0);
});

test('URLs are encoded per segment and reject traversal', () => {
  const mw = setup();
  assert.equal(
    mw.modland.urlFor('OctaMED MMD1/Alpha/two.mmd1'),
    'https://ftp.modland.com/pub/modules/OctaMED%20MMD1/Alpha/two.mmd1');
  assert.equal(
    mw.modland.urlFor('OctaMED MMD1/Beta (UK)/nested/three.mmd1'),
    'https://ftp.modland.com/pub/modules/OctaMED%20MMD1/Beta%20(UK)/nested/three.mmd1');
  assert.throws(() => mw.modland.urlFor('../etc/passwd'));
  assert.throws(() => mw.modland.urlFor('OctaMED MMD1/..\\evil'));
  assert.throws(() => mw.modland.urlFor(''));
});

test('the index is fetched once and then comes from the cache', async () => {
  let calls = 0;
  const mw = setup(async () => { calls++; return response(Buffer.from(INDEX)); });
  await mw.modland.loadIndex();
  assert.equal(calls, 1);
  assert.equal(mw.modland.index.count, 3);
  assert.equal(mw.modland.index.composers, 2);

  mw.modland.index = null;
  await mw.modland.loadIndex();
  assert.equal(calls, 1, 'the cached index should be used');
});

test('a module is validated, cached and served from the cache next time', async () => {
  let calls = 0;
  const mw = setup(async url => {
    calls++;
    if (String(url).includes('modland-octamed.tsv')) return response(Buffer.from(INDEX));
    return response(MANIAC);
  });
  await mw.modland.loadIndex();
  calls = 0;

  const first = await mw.modland.fetch({ path: 'OctaMED MMD1/Alpha/two.mmd1' });
  assert.equal(first.cached, false);
  assert.ok(first.song);
  assert.equal(first.bytes.length, MANIAC.length);
  assert.equal(calls, 1);

  const second = await mw.modland.fetch('OctaMED MMD1/Alpha/two.mmd1');
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  assert.deepEqual({ ...(await mw.modland.cacheInfo()) }, { files: 1, bytes: MANIAC.length });

  await mw.modland.clearCache();
  assert.deepEqual({ ...(await mw.modland.cacheInfo()) }, { files: 0, bytes: 0 });
});

test('a bad download is rejected before it reaches the cache', async () => {
  let calls = 0;
  const mw = setup(async url => {
    calls++;
    if (String(url).includes('modland-octamed.tsv')) return response(Buffer.from(INDEX));
    return response(Buffer.from('not a module'));
  });
  await mw.modland.loadIndex();
  calls = 0;
  await assert.rejects(() => mw.modland.fetch({ path: 'OctaMED MMD1/Alpha/two.mmd1' }), /Octanaut can read/);
  assert.deepEqual({ ...(await mw.modland.cacheInfo()) }, { files: 0, bytes: 0 });

  calls = 0;
  const missing = setup(async url => {
    calls++;
    if (String(url).includes('modland-octamed.tsv')) return response(Buffer.from(INDEX));
    return response(Buffer.alloc(0), 404);
  });
  await missing.modland.loadIndex();
  calls = 0;
  await assert.rejects(() => missing.modland.fetch({ path: 'OctaMED MMD1/Alpha/two.mmd1' }), /HTTP 404/);
  assert.equal(calls, 1, 'a 404 should not be retried');
});
