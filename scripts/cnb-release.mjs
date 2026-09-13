import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { appVersion } from './app-version.mjs';
import { cnbApi, publishRelease } from './cnb-api.mjs';

const { tag } = appVersion();
if (process.env.CNB_BRANCH !== tag)
  throw new Error('CNB tag and package.json must match');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const tagCommit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], {
  encoding: 'utf8',
}).trim();
if (
  commit !== tagCommit ||
  (process.env.CNB_COMMIT && commit !== process.env.CNB_COMMIT)
)
  throw new Error('Build commit does not match release tag');
const directory = 'release-assets';
for (const file of ['njustmap-web.tar.gz', 'njustmap-android.apk']) {
  if (
    !existsSync(join(directory, file)) ||
    statSync(join(directory, file)).size === 0
  )
    throw new Error(`Missing ${file}`);
}
writeFileSync(
  join(directory, 'BUILD-INFO.txt'),
  `Tag: ${tag}\nCommit: ${commit}\nAndroid: signed release APK and AAB; existing production key.\nWeb: Vercel Build Output API.\niOS: not built on CNB.\n`,
);
const files = readdirSync(directory)
  .filter((name) => name !== 'SHA256SUMS.txt')
  .sort();
const checksum = (name) =>
  createHash('sha256')
    .update(readFileSync(join(directory, name)))
    .digest('hex');
writeFileSync(
  join(directory, 'SHA256SUMS.txt'),
  files.map((name) => `${checksum(name)}  ${name}\n`).join(''),
);
const assets = [...files, 'SHA256SUMS.txt'].map((name) => ({
  name,
  size: statSync(join(directory, name)).size,
  sha256: checksum(name),
}));
const notesPath = `docs/releases/${tag}.md`;
const notes = existsSync(notesPath)
  ? readFileSync(notesPath, 'utf8')
  : `南梨有梨 ${tag}\n\n${readFileSync(join(directory, 'BUILD-INFO.txt'), 'utf8')}`;
await publishRelease({
  api: cnbApi(process.env.CNB_TOKEN),
  tag,
  commit,
  notes,
  assets,
  upload: async (url, asset) => {
    const response = await fetch(url, {
      method: 'PUT',
      body: readFileSync(join(directory, asset.name)),
      redirect: 'error',
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok)
      throw new Error(`Upload ${asset.name}: HTTP ${response.status}`);
  },
});
console.log(
  `Release ready: https://cnb.cool/voidfun/njustmap/-/releases/tag/${tag}`,
);
