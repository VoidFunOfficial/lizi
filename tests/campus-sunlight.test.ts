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
import { JIANGYIN_GUIDE_CALIBRATION } from '../lib/njust-jiangyin-reference.ts';
import {
  NJUST_SOLAR_BUILDINGS,
  rectangleFootprint,
  type SolarBuilding,
} from '../lib/njust-solar-buildings.ts';

void test('legacy preset is empty and no implicit buildings produce shadows', () => {
  assert.deepEqual(NJUST_SOLAR_BUILDINGS, []);
  assert.deepEqual(
    createBuildingShadowPolygons({ elevationDegrees: 45, azimuthDegrees: 90 }),
    [],
  );
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
    buildings: [
      {
        id: 'custom',
        name: '自定义建筑',
        heightMeters: 18.5,
        footprint: rectangleFootprint({ x: 0.4, y: 0.4 }, { x: 0.5, y: 0.5 }),
      },
    ],
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
    buildings: [
      {
        id: 'custom',
        name: '自定义建筑',
        heightMeters: 18.5,
        footprint: rectangleFootprint({ x: 0.4, y: 0.4 }, { x: 0.5, y: 0.5 }),
      },
    ],
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
    assert.equal(sunny.shadowPolygons.length, 1);
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
