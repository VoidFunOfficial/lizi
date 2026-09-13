import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const key of [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]) {
  if (!process.env[key])
    throw new Error(
      `Missing ${key} in CNB Android secret file. Refusing to publish a differently signed debug APK.`,
    );
}
const directory = mkdtempSync(join(tmpdir(), 'njustmap-sign-'));
try {
  const keyPath = join(directory, 'release.jks');
  writeFileSync(
    keyPath,
    Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'),
    { mode: 0o600 },
  );
  for (const task of ['android:release', 'android:bundle']) {
    const result = spawnSync('pnpm', [task, '--skip-checks'], {
      stdio: 'inherit',
      env: { ...process.env, ANDROID_KEYSTORE_PATH: keyPath },
    });
    if (result.status !== 0) throw new Error(`${task} failed`);
  }
  const files = readdirSync('outputs/android');
  const { appVersion } = await import('./app-version.mjs');
  const { version } = appVersion();
  const apk = files.find(
    (name) => name === `njust-campus-map-${version}-release.apk`,
  );
  const aab = files.find(
    (name) => name === `njust-campus-map-${version}-bundle.aab`,
  );
  if (!apk || !aab) throw new Error('Signed APK/AAB missing');
  copyFileSync(
    join('outputs/android', apk),
    'release-assets/njustmap-android.apk',
  );
  copyFileSync(join('outputs/android', aab), join('release-assets', aab));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
