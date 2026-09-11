import assert from 'node:assert/strict';
import test from 'node:test';

import { haversineDistanceMeters } from '../lib/coordinate-systems.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import type {
  MapCalibration,
  MapPoint,
  Wgs84Point,
} from '../lib/campus-model.ts';

const ORIGIN = { latitude: 31.9045, longitude: 120.1555 };
const EARTH_SEMI_MAJOR = 6_378_137;
const EARTH_ECCENTRICITY_SQUARED = 0.0066943799901413165;
const originRadians = (ORIGIN.latitude * Math.PI) / 180;
const originSine = Math.sin(originRadians);
const originDenominator = Math.sqrt(
  1 - EARTH_ECCENTRICITY_SQUARED * originSine * originSine,
);
const originPrimeVertical = EARTH_SEMI_MAJOR / originDenominator;
const originMeridional =
  (EARTH_SEMI_MAJOR * (1 - EARTH_ECCENTRICITY_SQUARED)) /
  originDenominator ** 3;

function worldPoint(eastMeters: number, northMeters: number): Wgs84Point {
  return {
    latitude:
      ORIGIN.latitude + (northMeters * 180) / (Math.PI * originMeridional),
    longitude:
      ORIGIN.longitude +
      (eastMeters * 180) /
        (Math.PI * originPrimeVertical * Math.cos(originRadians)),
  };
}

function calibrationFrom(
  method: MapCalibration['method'],
  points: MapPoint[],
  metric: (point: MapPoint) => { x: number; y: number },
): MapCalibration {
  return {
    schemaVersion: 1,
    method,
    reference: {
      provider: 'baidu',
      sourceUrl:
        'https://map.baidu.com/@13377094.41932182,3728558.053357122,16.52z',
      sourceCrs: 'BD09MC',
      center: {
        x: 13_377_094.41932182,
        y: 3_728_558.053357122,
        zoom: 16.52,
      },
    },
    anchors: points.map((image, index) => {
      const local = metric(image);
      const wgs84 = worldPoint(local.x, local.y);
      return {
        id: `anchor-${index}`,
        image,
        source: { crs: 'WGS84' as const, ...wgs84 },
        wgs84,
      };
    }),
    capturedAt: '2026-08-30T00:00:00.000Z',
  };
}

const corners: MapPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

void test('affine calibration handles rotation and non-uniform scale in both directions', () => {
  const metric = (point: MapPoint) => ({
    x: 140 * point.x + 25 * point.y,
    y: -15 * point.x + 90 * point.y,
  });
  const model = buildMapCalibration(
    calibrationFrom('affine', corners, metric),
    1_000,
    500,
  );
  const image = { x: 0.37, y: 0.68 };
  const geographic = model.imageToWgs84(image);
  assert.ok(geographic);
  const roundTrip = model.wgs84ToImage(geographic);
  assert.ok(roundTrip);

  assert.ok(Math.abs(roundTrip.x - image.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - image.y) < 1e-9);
  assert.ok(model.quality.fitRmsMeters < 0.001);
  assert.ok(model.quality.affineRmsMeters < 0.001);
  assert.equal(model.quality.coverage, 1);
  assert.equal(model.quality.status, 'good');

  const scale = model.localScale({ x: 0.5, y: 0.5 });
  assert.ok(scale);
  assert.ok(
    Math.abs(scale.xMetersPerPixel - Math.hypot(140, -15) / 1_000) < 0.00001,
  );
  assert.ok(
    Math.abs(scale.yMetersPerPixel - Math.hypot(25, 90) / 500) < 0.00001,
  );
  assert.ok(scale.anisotropy > 1.3);
});

void test('polyline length is computed in local metric space rather than image pixels', () => {
  const model = buildMapCalibration(
    calibrationFrom('affine', corners, (point) => ({
      x: point.x * 100,
      y: point.y * 100,
    })),
    2_000,
    400,
  );

  assert.ok(
    Math.abs(
      model.polylineLengthMeters([
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ]) - 100,
    ) < 0.01,
  );
  const scale = model.localScale({ x: 0.5, y: 0.5 });
  assert.ok(scale);
  assert.ok(Math.abs(scale.xMetersPerPixel - 0.05) < 0.00001);
  assert.ok(Math.abs(scale.yMetersPerPixel - 0.25) < 0.00001);
});

void test('thin-plate spline fits distributed local distortion and reports training residual honestly', () => {
  const grid: MapPoint[] = [];
  for (const y of [0, 0.5, 1]) {
    for (const x of [0, 0.5, 1]) grid.push({ x, y });
  }
  const metric = (point: MapPoint) => ({
    x:
      point.x * 120 +
      18 * Math.sin(Math.PI * point.x) * Math.sin(Math.PI * point.y),
    y: point.y * 95 + 14 * point.x * point.y,
  });
  const model = buildMapCalibration(
    calibrationFrom('thin-plate-spline', grid, metric),
    1_200,
    800,
  );

  assert.ok(model.quality.fitRmsMeters < 0.00001);
  assert.ok(model.quality.maxErrorMeters < 0.00001);
  assert.ok(model.quality.affineRmsMeters > 2);
  assert.equal(model.quality.coverage, 1);
  assert.match(
    model.quality.accuracyStatement,
    /训练点残差.*不代表实测定位精度/,
  );

  const image = { x: 0.38, y: 0.63 };
  const geographic = model.imageToWgs84(image);
  assert.ok(geographic);
  const roundTrip = model.wgs84ToImage(geographic);
  assert.ok(roundTrip);
  assert.ok(Math.abs(roundTrip.x - image.x) < 0.00001);
  assert.ok(Math.abs(roundTrip.y - image.y) < 0.00001);

  const expected = metric(image);
  assert.ok(
    haversineDistanceMeters(geographic, worldPoint(expected.x, expected.y)) < 3,
  );
});

void test('rejects collinear or insufficient calibration controls', () => {
  const collinear = calibrationFrom(
    'affine',
    [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ],
    (point) => ({ x: point.x * 100, y: point.y * 100 }),
  );
  assert.throws(
    () => buildMapCalibration(collinear, 1_000, 1_000),
    /二维分散|退化/,
  );

  const insufficient = { ...collinear, anchors: collinear.anchors.slice(0, 2) };
  assert.throws(
    () => buildMapCalibration(insufficient, 1_000, 1_000),
    /至少需要 3 个控制点/,
  );
});
