import { readFileSync, writeFileSync } from 'node:fs';
import { parseAppVersion } from './app-version.mjs';

const bump = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bump)) {
  throw new Error('Usage: pnpm release:version patch|minor|major');
}
const packageUrl = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(packageUrl, 'utf8'));
parseAppVersion(pkg.version);
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next =
  bump === 'major'
    ? `${major + 1}.0.0`
    : bump === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;
parseAppVersion(next);
pkg.version = next;
writeFileSync(packageUrl, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(
  `Version updated to ${next}. Review, commit, then push tag v${next} to release.`,
);
