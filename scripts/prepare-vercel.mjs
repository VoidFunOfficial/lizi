#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'outputs/vercel/njustmap');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!process.argv.includes('--skip-build')) {
  run('pnpm', ['build'], { env: { ...process.env, NJUST_VERCEL_BUILD: '1' } });
}
for (const page of ['index.html', 'app.html', 'editor.html']) {
  if (!existsSync(join(root, 'dist/client', page)))
    throw new Error(`Missing export: ${page}`);
}
// A dedicated, reproducible upload directory. Never include the workspace itself.
rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'api/student'), { recursive: true });
cpSync(join(root, 'dist/client'), join(output, 'public'), { recursive: true });
for (const file of [
  '.vite',
  '.assetsignore',
  '_headers',
  'vinext-client-entry-manifest.json',
]) {
  rmSync(join(output, 'public', file), { recursive: true, force: true });
}
for (const route of ['weather', 'updates', 'student/jw']) {
  run(join(root, 'node_modules/.bin/esbuild'), [
    `app/api/${route}/route.ts`,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    `--outfile=${join(output, 'api', `${route}.js`)}`,
  ]);
}
writeFileSync(
  join(output, 'package.json'),
  JSON.stringify(
    {
      name: 'njustmap',
      version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
        .version,
      private: true,
      type: 'module',
      engines: { node: '22.x' },
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  join(output, 'vercel.json'),
  JSON.stringify(
    {
      $schema: 'https://openapi.vercel.sh/vercel.json',
      framework: null,
      buildCommand: '',
      installCommand: '',
      outputDirectory: 'public',
      cleanUrls: true,
      functions: { 'api/**/*.js': { maxDuration: 30 } },
      headers: [
        {
          source: '/(.*).rsc',
          headers: [{ key: 'Content-Type', value: 'text/x-component' }],
        },
        {
          source: '/downloads/(.*)',
          headers: [
            {
              key: 'Content-Type',
              value: 'application/vnd.android.package-archive',
            },
            {
              key: 'Content-Disposition',
              value: 'attachment; filename="NanliYouli-Android.apk"',
            },
          ],
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(`Vercel browser upload directory: ${output}`);
