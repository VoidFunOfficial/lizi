#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'ios/App/App/Assets.xcassets');
const source = join(root, 'public/icon.png');
const background = { r: 243, g: 242, b: 237, alpha: 1 };

// Respect the sizes and filenames declared by the native asset catalogs.
for (const [catalog, scale] of [
  ['AppIcon.appiconset', 0.78],
  ['Splash.imageset', 0.34],
]) {
  const folder = join(assets, catalog);
  const contents = JSON.parse(
    readFileSync(join(folder, 'Contents.json'), 'utf8'),
  );
  for (const entry of contents.images) {
    if (!entry.filename) continue;
    const output = join(folder, entry.filename);
    const metadata = await sharp(output).metadata();
    const width = entry.size
      ? Math.round(
          Number(entry.size.split('x')[0]) *
            Number(entry.scale?.replace('x', '') ?? 1),
        )
      : metadata.width;
    const height = entry.size
      ? Math.round(
          Number(entry.size.split('x')[1]) *
            Number(entry.scale?.replace('x', '') ?? 1),
        )
      : metadata.height;
    if (!width || !height) throw new Error(`无法确定资源尺寸：${output}`);
    const size = Math.round(Math.min(width, height) * scale);
    const logo = await sharp(source)
      .resize(size, size, { fit: 'contain' })
      .png()
      .toBuffer();
    await sharp({ create: { width, height, channels: 4, background } })
      .composite([{ input: logo, gravity: 'centre' }])
      .flatten({ background })
      .removeAlpha()
      .png()
      .toFile(output);
  }
}
console.log('iOS 应用图标与启动图已生成。');
