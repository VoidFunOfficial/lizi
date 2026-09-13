import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cnbApi, publishRelease } from '../scripts/cnb-api.mjs';
import { GET } from '../app/api/updates/route.ts';
import { RELEASE_ROOT } from '../lib/updates/release.ts';

void test('CNB publishes only after every upload is confirmed and checked', async () => {
  for (const failure of ['none', 'upload', 'verify', 'missing']) {
    const calls: string[] = [];
    const assets = [{ name: 'njustmap-android.apk', size: 3, sha256: 'abc' }];
    const run = publishRelease({
      tag: 'v1.2.0',
      commit: 'commit',
      notes: 'notes',
      assets,
      api: async (
        path: string,
        options: { method?: string; body?: Record<string, unknown> } = {},
      ) => {
        calls.push(`${options.method ?? 'GET'} ${path}`);
        if (path.includes('/tags/') || path.endsWith('/latest')) return null;
        if (options.method === 'POST' && path.endsWith('/releases')) {
          assert.equal(options.body?.draft, true);
          return { id: 'id' };
        }
        if (path.endsWith('/asset-upload-url'))
          return {
            upload_url: 'https://storage.example/upload',
            verify_url: '/verify',
          };
        if (path === '/verify') {
          if (failure === 'verify') throw new Error('verify');
          return {};
        }
        if (options.method === 'PATCH') {
          assert.equal(options.body?.draft, false);
          return {};
        }
        return { assets: failure === 'missing' ? [] : assets };
      },
      upload: async () => {
        if (failure === 'upload') throw new Error('upload');
      },
    });
    if (failure === 'none') await run;
    else await assert.rejects(run);
    assert.equal(
      calls.some((call) => call.startsWith('PATCH')),
      failure === 'none',
    );
  }
});

void test('CNB authorization never follows an upload URL or a redirect', async () => {
  const api = cnbApi('test-token', async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    return new Response('{}');
  });
  await api('/voidfun/njustmap/-/releases');
  await assert.rejects(api('https://storage.example/token-leak'));
});

void test('Web update proxy forwards CNB JSON and redirects only to validated APKs', async (t) => {
  const release = {
    tag_name: 'v1.2.0',
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'njustmap-android.apk',
        size: 3,
        browser_download_url: `${RELEASE_ROOT}/download/v1.2.0/njustmap-android.apk`,
      },
    ],
  };
  let status = 200;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(release, { status }),
  );
  const response = await GET(new Request('https://map.example/api/updates'));
  assert.deepEqual(await response.json(), release);
  const download = await GET(
    new Request('https://map.example/api/updates?download=android'),
  );
  assert.equal(download.status, 302);
  assert.equal(
    download.headers.get('location'),
    release.assets[0].browser_download_url,
  );
  release.assets[0].browser_download_url = 'https://evil.example/app.apk';
  assert.equal(
    (await GET(new Request('https://map.example/api/updates?download=android')))
      .status,
    502,
  );
  status = 404;
  assert.equal(
    (await GET(new Request('https://map.example/api/updates'))).status,
    404,
  );
  status = 401;
  assert.equal(
    (await GET(new Request('https://map.example/api/updates'))).status,
    502,
  );
});
