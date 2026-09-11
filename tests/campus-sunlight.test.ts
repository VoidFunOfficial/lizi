import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBuildingShadowPolygons,
  createCampusSunlightContext,
  shadowCoverageForPolyline,
  solarPositionAt,
} from '../lib/campus-sunlight.ts';
import type { MapPoint } from '../lib/campus-model.ts';
import { MAP_HEIGHT, MAP_WIDTH } from '../lib/campus-model.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import {
  JIANGYIN_GUIDE_CALIBRATION,
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
} from '../lib/njust-jiangyin-reference.ts';
import {
  NJUST_SOLAR_BUILDINGS,
  NJUST_SOLAR_BUILDING_MODEL,
  type SolarBuilding,
} from '../lib/njust-solar-buildings.ts';

void test('the image-traced solar model contains only 20 dormitories and 7 Zhi buildings', () => {
  assert.equal(NJUST_SOLAR_BUILDINGS.length, 27);
  assert.equal(
    new Set(NJUST_SOLAR_BUILDINGS.map((building) => building.id)).size,
    27,
  );
  assert.equal(
    NJUST_SOLAR_BUILDINGS.filter((building) => building.kind === 'dormitory')
      .length,
    20,
  );
  assert.equal(
    NJUST_SOLAR_BUILDINGS.filter((building) => building.kind === 'zhi-building')
      .length,
    7,
  );

  for (const building of NJUST_SOLAR_BUILDINGS) {
    assert.equal(
      building.heightMeters,
      building.kind === 'dormitory' ? 35 : 30,
    );
    assert.equal(building.footprint.length, 4);
    for (const point of building.footprint) {
      assert.ok(point.x >= 0 && point.x <= 1);
      assert.ok(point.y >= 0 && point.y <= 1);
    }
  }
});

void test('source-guide building pixels are reprojected into the active georectified map layer', () => {
  assert.equal(NJUST_SOLAR_BUILDING_MODEL.schemaVersion, 2);
  assert.equal(NJUST_SOLAR_BUILDING_MODEL.sourceImage, 'map-high.jpg');

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
  const wgs84 = source.imageToWgs84({
    x: 292 / MAP_WIDTH,
    y: 928 / MAP_HEIGHT,
  });
  assert.ok(wgs84);
  const expected = target.wgs84ToImage(wgs84);
  assert.ok(expected);

  const firstDormitoryCenter = NJUST_SOLAR_BUILDINGS[0].footprint.reduce(
    (center, point) => ({
      x: center.x + point.x / 4,
      y: center.y + point.y / 4,
    }),
    { x: 0, y: 0 },
  );
  assert.ok(Math.abs(firstDormitoryCenter.x - expected.x) < 1e-10);
  assert.ok(Math.abs(firstDormitoryCenter.y - expected.y) < 1e-10);
  assert.ok(Math.abs(firstDormitoryCenter.x - 292 / MAP_WIDTH) > 0.01);
});

void test('a 45 degree sun from the east casts a westward height-scaled shadow', () => {
  const footprint: [MapPoint, MapPoint, MapPoint, MapPoint] = [
    { x: 0.49, y: 0.49 },
    { x: 0.51, y: 0.49 },
    { x: 0.51, y: 0.51 },
    { x: 0.49, y: 0.51 },
  ];
  const building = (id: string, heightMeters: 30 | 35): SolarBuilding => ({
    id,
    name: id,
    kind: heightMeters === 35 ? 'dormitory' : 'zhi-building',
    heightMeters,
    footprint,
  });
  const shadows = createBuildingShadowPolygons(
    { elevationDegrees: 45, azimuthDegrees: 90 },
    [building('thirty', 30), building('thirty-five', 35)],
  );
  const westernExtent = (index: number) =>
    0.49 - Math.min(...shadows[index].boundary.map((point) => point.x));

  assert.equal(shadows.length, 2);
  assert.ok(westernExtent(0) > 0);
  assert.ok(Math.abs(westernExtent(1) / westernExtent(0) - 35 / 30) < 1e-8);
  assert.ok(
    Math.max(...shadows[0].boundary.map((point) => point.x)) <= 0.51 + 1e-10,
  );

  const calibration = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    MAP_WIDTH,
    MAP_HEIGHT,
  );
  const westEdge = shadows[0].boundary.reduce((west, point) =>
    point.x < west.x ? point : west,
  );
  const physicalShadowLength = calibration.polylineLengthMeters([
    { x: 0.49, y: westEdge.y },
    westEdge,
  ]);
  assert.ok(Math.abs(physicalShadowLength - 30) < 0.05);
});

void test('solar position and shadow model stop below the horizon', () => {
  const noon = solarPositionAt(new Date('2026-06-21T04:00:00Z'));
  const midnight = solarPositionAt(new Date('2026-06-21T16:00:00Z'));

  assert.ok(noon.elevationDegrees > 60);
  assert.ok(midnight.elevationDegrees < 0);
  assert.deepEqual(createBuildingShadowPolygons(midnight), []);
});

void test('only a sunny matched weather hour activates physical shadows', () => {
  const departureTime = new Date('2026-09-03T04:00:00Z');
  const sunny = createCampusSunlightContext({
    departureTime,
    basemapSupported: true,
    weather: {
      status: 'matched',
      source: 'hourly',
      at: '2026-09-03T04:00:00.000Z',
      weatherCode: 0,
      weatherLabel: '晴',
    },
  });
  const cloudy = createCampusSunlightContext({
    departureTime,
    basemapSupported: true,
    weather: {
      status: 'matched',
      source: 'hourly',
      at: '2026-09-03T04:00:00.000Z',
      weatherCode: 1,
      weatherLabel: '多云',
    },
  });

  assert.equal(sunny.status, 'active');
  if (sunny.status === 'active') {
    assert.equal(sunny.shadowPolygons.length, 27);
  }
  assert.deepEqual(cloudy, {
    status: 'inactive',
    departureTime: departureTime.toISOString(),
    reason: 'not-sunny',
    weatherAt: '2026-09-03T04:00:00.000Z',
    weatherSource: 'hourly',
    weatherCode: 1,
  });
});

void test('overlapping shadow polygons are counted once along a route', () => {
  const rectangle = (left: number, right: number): MapPoint[] => [
    { x: left, y: 0.4 },
    { x: right, y: 0.4 },
    { x: right, y: 0.6 },
    { x: left, y: 0.6 },
  ];
  const coverage = shadowCoverageForPolyline(
    [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
    [rectangle(0.1, 0.6), rectangle(0.4, 0.9)],
  );

  assert.equal(coverage.totalLength, 1);
  assert.ok(Math.abs(coverage.shadowedLength - 0.8) < 1e-10);
  assert.ok(Math.abs(coverage.ratio - 0.8) < 1e-10);
});
