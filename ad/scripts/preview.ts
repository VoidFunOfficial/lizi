import { openArtifact } from '@fourier-video/sdk/testing';
import { resolve } from 'node:path';
import { SHOTS, sceneDirectory } from '../shots.ts';
const root = resolve(import.meta.dir, '..');
for (const s of SHOTS.filter(
  (s) => !process.argv[2] || s.id.startsWith(process.argv[2]),
)) {
  const f = await openArtifact(
    resolve(root, sceneDirectory(s.id), 'Visual.tsx'),
    {
      sourceRoot: root,
      resourceRoots: [root],
    },
  );
  try {
    for (const [name, frame] of [
      ['start', 0],
      ['hero', 125],
      ['end', 239],
    ] as const) {
      const r = await f.renderFrame({ frame });
      await Bun.write(resolve(root, 'review', `${s.id}-${name}.png`), r.png);
    }
    const a = await f.renderFrame({ frame: 125 });
    await f.renderFrame({ frame: 27 });
    await f.renderFrame({ frame: 221 });
    const b = await f.renderFrame({ frame: 125 });
    if (a.sha256 !== b.sha256) throw Error(`Non-deterministic seek: ${s.id}`);
    console.log(
      JSON.stringify({ scene: s.id, deterministic: true, sha256: a.sha256 }),
    );
  } finally {
    await f.close();
  }
}
