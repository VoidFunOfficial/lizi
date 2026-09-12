import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
// Vinext declares its optional 'sharp' import as unknown; use Sharp's typed entry.
import sharp from 'sharp/lib/index.js';

import { MAP_HEIGHT, MAP_WIDTH } from '../lib/campus-model.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import {
  JIANGYIN_CAMPUS_BOUNDS,
  JIANGYIN_GUIDE_CALIBRATION,
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  REFINED_GUIDE_IMAGE,
} from '../lib/njust-jiangyin-reference.ts';

const vectorBasemapUrl = new URL(
  '../public/campus-precise.svg',
  import.meta.url,
);
const refinedGuideUrl = new URL(
  `../public/${REFINED_GUIDE_IMAGE}`,
  import.meta.url,
);
const highResolutionSourceUrl = new URL('../map-high.jpg', import.meta.url);
const georectificationMetadataUrl = new URL(
  '../data/campus-guide-georectification.json',
  import.meta.url,
);
const REFINED_GUIDE_SHA256 =
  'd7ee892f3d74471b01527f4fe62b17d22afca3509e7de5da5d7f35f8ac009c14';
const HIGH_RESOLUTION_SOURCE_SHA256 =
  'd43f22bbb45d2c5b4d2d2fd7b93a2cb9724296d2e20649800234ec2fc6a3c2d6';
const HIGH_RESOLUTION_WIDTH = 7500;
const HIGH_RESOLUTION_HEIGHT = 4710;

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'asset must be a JPEG');

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const length = bytes.readUInt16BE(offset);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    assert.ok(length >= 2, `invalid JPEG segment length at byte ${offset}`);
    offset += length;
  }

  assert.fail('JPEG is missing a start-of-frame segment');
}

function rasterDimensions(bytes: Buffer): { width: number; height: number } {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  return jpegDimensions(bytes);
}

function attribute(openingTag: string, name: string): string {
  const value = openingTag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  assert.ok(value, `campus-precise.svg is missing ${name}`);
  return value;
}

void test('precision basemap asset matches the viewport and WGS84 calibration contract', async () => {
  const svg = await readFile(vectorBasemapUrl, 'utf8');
  const openingTag = svg.match(/<svg\b[^>]*>/)?.[0];
  assert.ok(openingTag, 'campus-precise.svg must contain an SVG root');

  assert.equal(attribute(openingTag, 'width'), String(MAP_WIDTH));
  assert.equal(attribute(openingTag, 'height'), String(MAP_HEIGHT));
  assert.equal(
    attribute(openingTag, 'viewBox'),
    `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
  );
  assert.equal(
    attribute(openingTag, 'data-west'),
    String(JIANGYIN_CAMPUS_BOUNDS.west),
  );
  assert.equal(
    attribute(openingTag, 'data-east'),
    String(JIANGYIN_CAMPUS_BOUNDS.east),
  );
  assert.equal(
    attribute(openingTag, 'data-north'),
    String(JIANGYIN_CAMPUS_BOUNDS.north),
  );
  assert.equal(
    attribute(openingTag, 'data-south'),
    String(JIANGYIN_CAMPUS_BOUNDS.south),
  );
  assert.equal(attribute(openingTag, 'data-crs'), 'EPSG:4326');

  const buildingMarkers = [
    ...svg.matchAll(/<path\b[^>]*\bdata-overture-id="([^"]+)"/g),
  ];
  const overtureIds = buildingMarkers.map((match) => match[1]);
  assert.equal(buildingMarkers.length, 85);
  assert.equal(
    new Set(overtureIds).size,
    85,
    'Overture building IDs must be unique',
  );

  const visibleNotes = [
    ...svg.matchAll(/<text\b[^>]*class="map-note"[^>]*>([^<]*)<\/text>/g),
  ]
    .map((match) => match[1])
    .join('\n');
  assert.match(visibleNotes, /© OpenStreetMap contributors/);
  assert.match(visibleNotes, /Overture Maps Foundation/);
  assert.match(
    visibleNotes,
    /East Asian Buildings contributors \(CC BY 4\.0\)/,
  );
  assert.match(visibleNotes, /低置信度示意，非测绘/);
  assert.match(visibleNotes, /路线与入口请现场复核/);
});

void test('the georectified guide keeps the supplied high-resolution pixels on the fixed WGS84 grid', async () => {
  const [bytes, sourceBytes] = await Promise.all([
    readFile(refinedGuideUrl),
    readFile(highResolutionSourceUrl),
  ]);

  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  assert.equal(bytes[24], 8, 'PNG must use 8-bit channels');
  assert.equal(bytes[25], 2, 'PNG must be lossless true-colour RGB');
  assert.deepEqual(rasterDimensions(bytes), {
    width: HIGH_RESOLUTION_WIDTH,
    height: HIGH_RESOLUTION_HEIGHT,
  });
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    REFINED_GUIDE_SHA256,
  );
  assert.deepEqual(rasterDimensions(sourceBytes), {
    width: HIGH_RESOLUTION_WIDTH,
    height: HIGH_RESOLUTION_HEIGHT,
  });
  assert.equal(
    createHash('sha256').update(sourceBytes).digest('hex'),
    HIGH_RESOLUTION_SOURCE_SHA256,
  );
});

void test('the stored affine is the same legacy-to-WGS84 transform used by runtime migration', async () => {
  const metadata = JSON.parse(
    await readFile(georectificationMetadataUrl, 'utf8'),
  ) as {
    method: string;
    source: {
      image: string;
      width: number;
      height: number;
      sha256: string;
      alignmentToLegacy: {
        featurePatchCount: number;
        featurePatchMatchCount: number;
        rmsResidualLegacyPixels: number;
        maxResidualLegacyPixels: number;
      };
    };
    logicalCanvas: { width: number; height: number };
    normalizedForward: { x: number[]; y: number[] };
    sourceModelQuality: {
      fitRmsMeters: number;
      maxErrorMeters: number;
      leaveOneOutRmsMeters: number;
      anchorCoverage: number;
    };
    target: typeof JIANGYIN_CAMPUS_BOUNDS & {
      width: number;
      height: number;
      sha256: string;
      crs: string;
    };
  };
  assert.equal(metadata.method, 'global-affine');
  assert.equal(metadata.source.image, 'map-high.jpg');
  assert.equal(metadata.source.width, HIGH_RESOLUTION_WIDTH);
  assert.equal(metadata.source.height, HIGH_RESOLUTION_HEIGHT);
  assert.equal(metadata.source.sha256, HIGH_RESOLUTION_SOURCE_SHA256);
  assert.equal(metadata.source.alignmentToLegacy.featurePatchCount, 40);
  assert.equal(metadata.source.alignmentToLegacy.featurePatchMatchCount, 40);
  assert.ok(metadata.source.alignmentToLegacy.rmsResidualLegacyPixels < 0.02);
  assert.ok(metadata.source.alignmentToLegacy.maxResidualLegacyPixels < 0.07);
  assert.equal(metadata.logicalCanvas.width, MAP_WIDTH);
  assert.equal(metadata.logicalCanvas.height, MAP_HEIGHT);
  assert.equal(metadata.target.width, HIGH_RESOLUTION_WIDTH);
  assert.equal(metadata.target.height, HIGH_RESOLUTION_HEIGHT);
  assert.equal(metadata.target.sha256, REFINED_GUIDE_SHA256);
  assert.equal(metadata.target.crs, 'EPSG:4326');
  for (const edge of ['west', 'east', 'north', 'south'] as const) {
    assert.equal(metadata.target[edge], JIANGYIN_CAMPUS_BOUNDS[edge]);
  }

  const [xx, xy, x0] = metadata.normalizedForward.x;
  const [yx, yy, y0] = metadata.normalizedForward.y;
  const determinant = xx * yy - xy * yx;
  assert.ok(determinant > 0.89, 'affine must preserve orientation and area');
  const source = buildMapCalibration(
    LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    MAP_WIDTH,
    MAP_HEIGHT,
  );
  const target = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    MAP_WIDTH,
    MAP_HEIGHT,
  );
  for (const point of [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0.2, y: 0.3 },
    { x: 0.75, y: 0.65 },
  ]) {
    const wgs84 = source.imageToWgs84(point);
    assert.ok(wgs84);
    const expected = target.wgs84ToImage(wgs84);
    assert.ok(expected);
    const actual = {
      x: xx * point.x + xy * point.y + x0,
      y: yx * point.x + yy * point.y + y0,
    };
    assert.ok(Math.abs(actual.x - expected.x) < 1e-10);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-10);
  }

  assert.ok(
    Math.abs(
      source.quality.fitRmsMeters - metadata.sourceModelQuality.fitRmsMeters,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      source.quality.maxErrorMeters -
        metadata.sourceModelQuality.maxErrorMeters,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      (source.quality.leaveOneOutRmsMeters ?? 0) -
        metadata.sourceModelQuality.leaveOneOutRmsMeters,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      source.quality.coverage - metadata.sourceModelQuality.anchorCoverage,
    ) < 1e-12,
  );
  assert.equal(target.quality.status, 'needs-review');
  assert.equal(target.quality.declaredAccuracyRmsMeters, 16);
});

void test('the georectification generator reproduces the committed raster pixels', async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'njust-georectified-guide-'),
  );
  const generated = join(temporaryDirectory, 'campus-guide-georectified.png');
  try {
    const root = dirname(fileURLToPath(import.meta.url));
    const script = join(
      root,
      '..',
      'scripts',
      'generate-georectified-guide.mjs',
    );
    const result = spawnSync(
      process.execPath,
      [script, '--output', generated],
      {
        cwd: join(root, '..'),
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    // PNG compression and metadata vary across FFmpeg/zlib builds. Compare
    // decoded pixels; the committed asset's SHA-256 is checked separately above.
    const [actual, expected] = await Promise.all([
      sharp(generated)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      sharp(fileURLToPath(refinedGuideUrl))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    assert.deepEqual(actual.info, expected.info);
    let differingChannels = 0;
    let totalDifference = 0;
    let maxDifference = 0;
    for (let i = 0; i < actual.data.length; i++) {
      const difference = Math.abs(actual.data[i] - expected.data[i]);
      if (difference) differingChannels++;
      totalDifference += difference;
      maxDifference = Math.max(maxDifference, difference);
    }
    // FFmpeg 6 (Ubuntu) and 8 (macOS) use different color conversion rounding:
    // observed mean 1.30/255, maximum 21/255. Keep a tight color-only tolerance;
    // dimensions, geometry metadata and committed source hashes remain exact.
    const meanDifference = totalDifference / actual.data.length;
    assert.ok(
      meanDifference <= 1.5 && maxDifference <= 24,
      `Raster mismatch: ${differingChannels} channels differ; mean=${meanDifference}, max=${maxDifference}`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
