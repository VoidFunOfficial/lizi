import { spawnSync } from 'node:child_process';
for (const key of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) {
  if (!process.env[key])
    throw new Error(`Missing ${key} in CNB Vercel secret file`);
}
// Use the already-tested Build Output API directory. Token is never printed.
const result = spawnSync(
  'pnpm',
  [
    'dlx',
    'vercel@59.16.0',
    'deploy',
    '--prebuilt',
    '--prod',
    '--yes',
    '--token',
    process.env.VERCEL_TOKEN,
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
