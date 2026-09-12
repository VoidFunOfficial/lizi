import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

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
