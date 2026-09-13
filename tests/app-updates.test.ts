import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchRelease,
  isNewerVersion,
  parseRelease,
  RELEASE_ROOT,
} from '../lib/updates/release.ts';

function release(version = '1.2.0') {
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    body: '改进导航与课表',
    assets: [
      {
        name: 'njustmap-android.apk',
        size: 1024,
        browser_download_url: `${RELEASE_ROOT}/download/v${version}/njustmap-android.apk`,
      },
    ],
  };
}

void test('compare numeric semantic versions without downgrade or repeat prompts', () => {
  assert.equal(isNewerVersion('1.10.0', '1.9.9'), true);
  assert.equal(isNewerVersion('2.0.0', '1.999.999'), true);
  assert.equal(isNewerVersion('1.0.1', '1.0.0'), true);
  assert.equal(isNewerVersion('1.0.0', '1.0.0'), false);
  assert.equal(isNewerVersion('0.9.9', '1.0.0'), false);
  for (const invalid of [
    '1.0',
    '01.0.0',
    '1.0.0-beta.1',
    '1.0.0<script>',
    '9007199254740992.0.0',
  ])
    assert.throws(() => isNewerVersion(invalid, '1.0.0'));
});

void test('only offer published stable versions with an uploaded repository APK', () => {
  assert.equal(parseRelease(release())?.version, '1.2.0');
  assert.equal(parseRelease({ ...release(), draft: true }), null);
  assert.equal(parseRelease({ ...release(), prerelease: true }), null);
  assert.throws(() => parseRelease({ ...release(), assets: [] }));
  assert.equal(parseRelease(release())?.url, `${RELEASE_ROOT}/tag/v1.2.0`);
  for (const patch of [
    { size: 1.5 },
    { size: 0 },
    { browser_download_url: 'javascript:alert(1)' },
    { name: 'njustmap-ios-simulator.zip' },
  ]) {
    const data = release();
    Object.assign(data.assets[0], patch);
    assert.throws(() => parseRelease(data));
  }
  for (const malformed of [
    null,
    {},
    { message: 'rate limited' },
    { ...release(), tag_name: 'v1.2.0-rc.1' },
  ])
    assert.throws(() => parseRelease(malformed));
});

void test('no releases is distinct from offline, rate limits, server errors and malformed JSON', async () => {
  assert.equal(
    await fetchRelease(async () => ({ status: 404, data: null })),
    null,
  );
  assert.equal(
    (await fetchRelease(async () => ({ status: 200, data: release() })))
      ?.version,
    '1.2.0',
  );
  for (const status of [403, 429, 500])
    await assert.rejects(fetchRelease(async () => ({ status, data: null })));
  await assert.rejects(
    fetchRelease(async () => {
      throw new Error('offline');
    }),
  );
  await assert.rejects(
    fetchRelease(async () => ({ status: 200, data: '<html>' })),
  );
});
