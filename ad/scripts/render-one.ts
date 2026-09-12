import { sceneDirectory } from '../shots.ts';
import { createArtifactHost } from '@fourier-video/core';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const id = process.argv[2];
if (!id) throw Error('Pass a scene id');
const host = createArtifactHost({
  resolveAuthorImport: (s) =>
    Bun.resolveSync(s, resolve(root, 'node_modules/@fourier-video/sdk/src')),
});
const result = await host.renderVisualArtifactVideo(
  {
    entryPath: resolve(root, sceneDirectory(id), 'Visual.tsx'),
    sourceRoot: root,
    resourceRoots: [root],
    mode: 'design-preview',
  },
  {
    output: resolve(root, 'review', `${id}.mp4`),
    overwrite: true,
    crf: 17,
    preset: 'medium',
    domPages: 1,
    background: '#f5f5f7',
    onProgress: (p) => {
      if (p.frame % 60 === 0) console.log(JSON.stringify({ scene: id, ...p }));
    },
  },
);
await Bun.write(
  resolve(root, 'review', `${id}.render.json`),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
