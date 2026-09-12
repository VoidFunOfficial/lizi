import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.vercel/output');
if (!process.argv.includes('--skip-build')) {
  const result = spawnSync('pnpm', ['exec', 'vinext', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NJUST_VERCEL_BUILD: '1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(root, 'dist/client'), join(output, 'static'), { recursive: true });
for (const file of [
  '.vite',
  '.assetsignore',
  '_headers',
  'vinext-client-entry-manifest.json',
]) {
  rmSync(join(output, 'static', file), { recursive: true, force: true });
}
for (const [route, method] of [
  ['weather', 'GET'],
  ['student/jw', 'POST'],
]) {
  const target = join(output, 'functions/api', `${route}.func`);
  mkdirSync(target, { recursive: true });
  await build({
    stdin: {
      contents: `import { ${method} } from './app/api/${route}/route.ts';\nimport { vercelNodeHandler } from './scripts/vercel-node-handler.mjs';\nmodule.exports = vercelNodeHandler('${method}', ${method});`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: join(target, 'index.cjs'),
    tsconfig: join(root, 'tsconfig.json'),
  });
  writeFileSync(
    join(target, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.cjs',
        launcherType: 'Nodejs',
        maxDuration: 30,
      },
      null,
      2,
    ) + '\n',
  );
}
writeFileSync(
  join(output, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '/(.*)\\.rsc',
          headers: { 'Content-Type': 'text/x-component' },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '/', dest: '/index.html' },
        ...['app', 'editor', 'debug_sunshine'].map((page) => ({
          src: `/${page}/?`,
          dest: `/${page}.html`,
        })),
        { src: '/.*', dest: '/404.html', status: 404 },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Vercel Build Output API package ready: .vercel/output');
