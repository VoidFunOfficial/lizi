#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(projectRoot, 'public/icon.png');
const resources = join(projectRoot, 'android/app/src/main/res');
const background = { r: 243, g: 242, b: 237, alpha: 1 };

if (!existsSync(source)) throw new Error(`找不到应用源文件：${source}`);
if (!existsSync(resources))
  throw new Error(`找不到 Android 资源目录：${resources}`);

async function logoBuffer(size) {
  return sharp(source).resize(size, size, { fit: 'contain' }).png().toBuffer();
}

async function renderSquare(output, size, logoScale, canvasBackground) {
  const logoSize = Math.round(size * logoScale);
  const logo = await logoBuffer(logoSize);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: canvasBackground,
    },
  })
    .composite([
      {
        input: logo,
        left: Math.round((size - logoSize) / 2),
        top: Math.round((size - logoSize) / 2),
      },
    ])
    .png()
    .toFile(output);
}

async function renderSplash(output) {
  const metadata = await sharp(output).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`无法读取启动图尺寸：${output}`);
  }
  const logoSize = Math.round(Math.min(metadata.width, metadata.height) * 0.34);
  const logo = await logoBuffer(logoSize);
  await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: logo,
        left: Math.round((metadata.width - logoSize) / 2),
        top: Math.round((metadata.height - logoSize) / 2),
      },
    ])
    .png()
    .toFile(output);
}

const densities = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

for (const [density, sizes] of Object.entries(densities)) {
  const directory = join(resources, `mipmap-${density}`);
  await Promise.all([
    renderSquare(
      join(directory, 'ic_launcher.png'),
      sizes.launcher,
      0.78,
      background,
    ),
    renderSquare(
      join(directory, 'ic_launcher_round.png'),
      sizes.launcher,
      0.78,
      background,
    ),
    renderSquare(
      join(directory, 'ic_launcher_foreground.png'),
      sizes.foreground,
      0.62,
      { r: 0, g: 0, b: 0, alpha: 0 },
    ),
  ]);
}

const splashFiles = [
  'drawable/splash.png',
  'drawable-land-mdpi/splash.png',
  'drawable-land-hdpi/splash.png',
  'drawable-land-xhdpi/splash.png',
  'drawable-land-xxhdpi/splash.png',
  'drawable-land-xxxhdpi/splash.png',
  'drawable-port-mdpi/splash.png',
  'drawable-port-hdpi/splash.png',
  'drawable-port-xhdpi/splash.png',
  'drawable-port-xxhdpi/splash.png',
  'drawable-port-xxxhdpi/splash.png',
];
await Promise.all(
  splashFiles.map((file) => renderSplash(join(resources, file))),
);

console.log('Android 应用图标与启动图已生成。');
