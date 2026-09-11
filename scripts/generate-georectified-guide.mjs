#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const metadataPath = join(root, 'data/campus-guide-georectification.json');
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  invariant(value && !value.startsWith('--'), `${name} 需要一个路径`);
  return isAbsolute(value) ? value : resolve(root, value);
}

function approximatelyEqual(actual, expected, tolerance = 1e-12) {
  return Math.abs(actual - expected) <= tolerance;
}

function formatNumber(value) {
  return Number(value.toFixed(12)).toString();
}

const source = option('--source', join(root, metadata.source.image));
const output = option('--output', join(root, metadata.target.image));
const context = JSON.parse(
  readFileSync(join(root, 'data/campus-schematic-context.json'), 'utf8'),
);

invariant(metadata.schemaVersion === 1, '不支持的纠偏元数据版本');
invariant(metadata.method === 'global-affine', '底图必须使用全局仿射纠偏');
invariant(
  context.fixedExtent.width === metadata.logicalCanvas.width &&
    context.fixedExtent.height === metadata.logicalCanvas.height,
  '逻辑画布尺寸与校准元数据不一致',
);
invariant(
  metadata.source.width === metadata.target.width &&
    metadata.source.height === metadata.target.height,
  '高清纠偏流程要求源图与输出栅格尺寸一致',
);

const extent = context.fixedExtent;
const affine = context.legacyAffineToWgs84;
const longitudeRange = extent.east - extent.west;
const latitudeRange = extent.north - extent.south;
const normalizedForward = {
  x: [
    affine.longitude[0] / longitudeRange,
    affine.longitude[1] / longitudeRange,
    (affine.longitude[2] - extent.west) / longitudeRange,
  ],
  y: [
    -affine.latitude[0] / latitudeRange,
    -affine.latitude[1] / latitudeRange,
    (extent.north - affine.latitude[2]) / latitudeRange,
  ],
};

for (const axis of ['x', 'y']) {
  normalizedForward[axis].forEach((value, index) => {
    invariant(
      approximatelyEqual(value, metadata.normalizedForward[axis][index]),
      `纠偏矩阵 ${axis}[${index}] 与校准来源不一致`,
    );
  });
}

const sourceWidth = metadata.source.width;
const sourceHeight = metadata.source.height;
const width = metadata.target.width;
const height = metadata.target.height;
const pixelForward = {
  x: [
    (normalizedForward.x[0] * width) / sourceWidth,
    (normalizedForward.x[1] * width) / sourceHeight,
    normalizedForward.x[2] * width,
  ],
  y: [
    (normalizedForward.y[0] * height) / sourceWidth,
    (normalizedForward.y[1] * height) / sourceHeight,
    normalizedForward.y[2] * height,
  ],
};
for (const axis of ['x', 'y']) {
  pixelForward[axis].forEach((value, index) => {
    invariant(
      approximatelyEqual(value, metadata.pixelForward[axis][index], 1e-9),
      `像素纠偏矩阵 ${axis}[${index}] 与归一化矩阵不一致`,
    );
  });
}
const filters = metadata.visualFilters;
const padding = filters.paddingPixels;
invariant(Number.isInteger(padding) && padding > 0, '纠偏补边必须是正整数');
const paddedWidth = sourceWidth + padding * 2;
const paddedHeight = sourceHeight + padding * 2;
const projectPadded = (x, y) => {
  const sourceX = x - padding;
  const sourceY = y - padding;
  return {
    x:
      pixelForward.x[0] * sourceX +
      pixelForward.x[1] * sourceY +
      pixelForward.x[2],
    y:
      pixelForward.y[0] * sourceX +
      pixelForward.y[1] * sourceY +
      pixelForward.y[2],
  };
};
const topLeft = projectPadded(0, 0);
const topRight = projectPadded(paddedWidth, 0);
const bottomLeft = projectPadded(0, paddedHeight);
const bottomRight = projectPadded(paddedWidth, paddedHeight);
const videoFilter = [
  'format=rgb24',
  `eq=contrast=${filters.contrast}:brightness=${filters.brightness}:saturation=${filters.saturation}`,
  `pad=${paddedWidth}:${paddedHeight}:${padding}:${padding}:color=${filters.paddingColor}`,
  `perspective=x0=${formatNumber(topLeft.x)}:y0=${formatNumber(topLeft.y)}` +
    `:x1=${formatNumber(topRight.x)}:y1=${formatNumber(topRight.y)}` +
    `:x2=${formatNumber(bottomLeft.x)}:y2=${formatNumber(bottomLeft.y)}` +
    `:x3=${formatNumber(bottomRight.x)}:y3=${formatNumber(bottomRight.y)}` +
    ':sense=destination:interpolation=cubic',
  `crop=${width}:${height}:0:0`,
  `unsharp=${filters.unsharp}`,
].join(',');

const result = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-fflags',
    '+bitexact',
    '-i',
    source,
    '-map_metadata',
    '-1',
    '-vf',
    videoFilter,
    '-frames:v',
    '1',
    '-threads',
    '1',
    '-compression_level',
    '9',
    '-pred',
    'mixed',
    output,
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  throw new Error(`无法启动 ffmpeg：${result.error.message}`);
}
if (result.status !== 0) {
  throw new Error(`ffmpeg 生成纠偏底图失败，退出码 ${String(result.status)}`);
}

console.log(`Generated ${output}`);
console.log(
  `Padded affine corners: TL(${formatNumber(topLeft.x)}, ${formatNumber(topLeft.y)}) ` +
    `TR(${formatNumber(topRight.x)}, ${formatNumber(topRight.y)}) ` +
    `BL(${formatNumber(bottomLeft.x)}, ${formatNumber(bottomLeft.y)}) ` +
    `BR(${formatNumber(bottomRight.x)}, ${formatNumber(bottomRight.y)})`,
);
