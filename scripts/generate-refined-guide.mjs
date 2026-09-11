#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'map.jpg');
const output = join(root, 'public/campus-guide-refined.jpg');

// Keep the original 2038×1279 pixel grid intact so existing annotations remain
// aligned. These filters only calm the saturated guide-map artwork and restore
// mild edge definition; they do not crop, warp, redraw, or relabel anything.
const videoFilter =
  'eq=contrast=0.94:brightness=0.035:saturation=0.78,unsharp=5:5:0.45:5:5:0';

const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-vf',
    videoFilter,
    '-q:v',
    '2',
    output,
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  throw new Error(`无法启动 ffmpeg：${result.error.message}`);
}
if (result.status !== 0) {
  throw new Error(`ffmpeg 生成底图失败，退出码 ${String(result.status)}`);
}

console.log(`Generated ${output}`);
