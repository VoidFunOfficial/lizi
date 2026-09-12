import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const output = new URL('../outputs/vercel/njustmap/', import.meta.url);
for (const file of [
  'public/index.html',
  'public/app.html',
  'public/editor.html',
  'api/weather.js',
  'api/student/jw.js',
]) {
  await access(new URL(file, output));
}
const config = JSON.parse(
  await readFile(new URL('vercel.json', output), 'utf8'),
);
assert.equal(config.outputDirectory, 'public');
assert.equal(config.cleanUrls, true);
const { POST } = await import(new URL('api/student/jw.js', output).href);
const invalid = await POST(
  new Request('https://example.vercel.app/api/student/jw', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }),
);
assert.equal(invalid.status, 400);
assert.match(invalid.headers.get('cache-control'), /no-store/);
const crossOrigin = await POST(
  new Request('https://example.vercel.app/api/student/jw', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://other.example',
    },
    body: '{}',
  }),
);
assert.equal(crossOrigin.status, 403);
const { GET } = await import(new URL('api/weather.js', output).href);
assert.equal(typeof GET, 'function');
console.log(
  'PASS Vercel static pages, bundled API entrypoints, JW validation and origin protection',
);

const { default: nodeHandler } = await import(
  new URL(
    '../.vercel/output/functions/api/student/jw.func/index.cjs',
    import.meta.url,
  ).href
);
const server = createServer(nodeHandler);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
try {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/api/student/jw`;
  for (const [method, body, origin, status] of [
    ['POST', '{}', undefined, 400],
    ['POST', '{}', 'https://other.example', 403],
    ['POST', 'x'.repeat(24001), undefined, 413],
    ['GET', undefined, undefined, 405],
  ]) {
    const response = await fetch(url, {
      method,
      body,
      headers: {
        'content-type': 'application/json',
        ...(origin ? { origin } : {}),
      },
    });
    assert.equal(response.status, status);
    await response.arrayBuffer();
  }
  console.log('PASS deployed Node function HTTP adapter: 400/403/413/405');
} finally {
  server.closeAllConnections();
  server.close();
}
