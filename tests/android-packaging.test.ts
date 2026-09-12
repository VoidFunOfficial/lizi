import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

void test('Android packaging exports and opens the dedicated app route', async () => {
  const [nextConfig, capacitorConfig, packageJson, script] = await Promise.all([
    readFile(new URL('next.config.ts', projectRoot), 'utf8'),
    readFile(new URL('capacitor.config.ts', projectRoot), 'utf8'),
    readFile(new URL('package.json', projectRoot), 'utf8'),
    readFile(new URL('scripts/build-android.mjs', projectRoot), 'utf8'),
  ]);

  assert.match(nextConfig, /NJUST_ANDROID_BUILD/);
  assert.match(nextConfig, /output: 'export'/);
  assert.match(nextConfig, /unoptimized: true/);
  assert.match(capacitorConfig, /webDir: 'dist\/client'/);
  assert.match(capacitorConfig, /appStartPath: '\/app\.html'/);
  assert.match(packageJson, /"android": "node scripts\/build-android\.mjs"/);
  assert.match(script, /cap', 'sync', 'android/);
  assert.match(script, /dist\/client\/app\.html/);
  assert.match(script, /assembleDebug/);
  assert.match(script, /bundleRelease/);
  assert.match(script, /cwd: androidRoot/);
});

void test('Android native project declares precise location and guarded release signing', async () => {
  const [manifest, buildConfig, packageConfig, wrapper] = await Promise.all([
    readFile(
      new URL('android/app/src/main/AndroidManifest.xml', projectRoot),
      'utf8',
    ),
    readFile(new URL('android/app/build.gradle', projectRoot), 'utf8'),
    readFile(new URL('package.json', projectRoot), 'utf8'),
    stat(new URL('android/gradlew', projectRoot)),
  ]);

  assert.match(manifest, /android\.permission\.ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /android\.permission\.ACCESS_FINE_LOCATION/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(buildConfig, /ANDROID_KEYSTORE_PATH/);
  assert.match(buildConfig, /ANDROID_VERSION_CODE/);
  assert.ok(JSON.parse(packageConfig).dependencies['@capacitor/geolocation']);
  assert.ok((wrapper.mode & 0o111) !== 0, 'Gradle wrapper must be executable');
});
