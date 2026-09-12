import { SHOTS, sceneDirectory } from '../shots.ts';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
if (SHOTS.length !== 20 || SHOTS.reduce((s, x) => s + x.seconds, 0) !== 80)
  throw Error('Invalid film duration');
for (const s of SHOTS) {
  if (s.seconds < 2 || s.seconds > 9) throw Error('Shot out of range');
  for (const name of ['main.tsx', 'Visual.tsx'])
    if (!(await Bun.file(resolve(root, sceneDirectory(s.id), name)).exists()))
      throw Error(`Missing ${s.id}/${name}`);
  const src = await Bun.file(
    resolve(root, sceneDirectory(s.id), 'Visual.tsx'),
  ).text();
  if (/Math.random|requestAnimationFrame|setInterval|fetch\(/.test(src))
    throw Error(`Uncontrolled time/network in ${s.id}`);
}
console.log(
  '20 independent scenes; 80 seconds; 4800 frames; deterministic authoring checks passed.',
);
