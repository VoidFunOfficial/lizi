import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Stable SemVer mapped to an increasing Android/iOS build number. */
export function parseAppVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(
      `Expected a stable major.minor.patch version, got: ${version}`,
    );
  }
  const [major, minor, patch] = version.split('.').map(Number);
  const code = major * 1_000_000 + minor * 1_000 + patch;
  if (minor > 999 || patch > 999 || code < 1 || code > 2_100_000_000) {
    throw new Error(
      `Version cannot be represented as an Android versionCode: ${version}`,
    );
  }
  return { version, code, tag: `v${version}` };
}

export function appVersion() {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  return parseAppVersion(pkg.version);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const current = appVersion();
  const expectedTag = process.argv[2];
  if (expectedTag && expectedTag !== current.tag) {
    throw new Error(
      `Tag ${expectedTag} does not match package.json (${current.tag})`,
    );
  }
  console.log(JSON.stringify(current));
}
