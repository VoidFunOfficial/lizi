import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCurrentBasemap,
  migrateToCurrentBasemap,
} from '../lib/campus-basemap-migration.ts';
import {
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  createEmptyCampusMap,
  type CampusMapDocument,
  type MapPoint,
} from '../lib/campus-model.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import {
  JIANGYIN_GUIDE_CALIBRATION,
  JIANGYIN_VECTOR_CALIBRATION,
  LEGACY_GEORECTIFIED_GUIDE_IMAGE,
  LEGACY_GEORECTIFIED_GUIDE_REVISION,
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  LEGACY_REFINED_GUIDE_IMAGE,
  LEGACY_REFINED_GUIDE_REVISION,
  PRECISION_BASEMAP_IMAGE,
  PRECISION_BASEMAP_REVISION,
  REFINED_GUIDE_IMAGE,
  REFINED_GUIDE_REVISION,
  cloneReferenceCalibration,
} from '../lib/njust-jiangyin-reference.ts';

function guideDocument(): CampusMapDocument {
  const start = {
    id: 'node-start',
    x: 0.2,
    y: 0.3,
    levelId: DEFAULT_LEVEL.id,
    kind: 'portal' as const,
  };
  const end = {
    id: 'node-end',
    x: 0.75,
    y: 0.65,
    levelId: DEFAULT_LEVEL.id,
    kind: 'junction' as const,
  };

  return {
    ...createEmptyCampusMap(),
    map: {
      image: 'map.jpg',
      width: 2038,
      height: 1279,
      metersPerPixel: 0.5,
      calibration: LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    },
    nodes: [start, end],
    places: [{ id: 'place-start', name: '测试入口', nodeId: start.id }],
    links: [
      {
        id: 'link-main',
        from: start.id,
        to: end.id,
        name: '测试弯路',
        kind: 'path',
        direction: 'both',
        geometry: [
          { x: start.x, y: start.y },
          { x: 0.35, y: 0.55 },
          { x: end.x, y: end.y },
        ],
        environment: { ...DEFAULT_ENVIRONMENT, shade: 0.45 },
        access: { ...DEFAULT_ACCESS, audience: 'campus' },
        costMultiplier: 1.25,
      },
    ],
    areas: [
      {
        id: 'area-court',
        name: '测试通行面',
        levelId: DEFAULT_LEVEL.id,
        boundary: [
          { x: 0.25, y: 0.4 },
          { x: 0.55, y: 0.4 },
          { x: 0.55, y: 0.72 },
          { x: 0.25, y: 0.72 },
        ],
        obstacles: [
          {
            id: 'obstacle-planter',
            boundary: [
              { x: 0.32, y: 0.48 },
              { x: 0.4, y: 0.48 },
              { x: 0.4, y: 0.6 },
              { x: 0.32, y: 0.6 },
            ],
          },
        ],
        environment: { ...DEFAULT_ENVIRONMENT, shade: 0.7 },
        access: { ...DEFAULT_ACCESS },
        costMultiplier: 0.9,
      },
    ],
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
}

function assertSamePoint(actual: MapPoint, expected: MapPoint): void {
  assert.ok(
    Math.abs(actual.x - expected.x) < 1e-10,
    `x moved from ${expected.x} to ${actual.x}`,
  );
  assert.ok(
    Math.abs(actual.y - expected.y) < 1e-10,
    `y moved from ${expected.y} to ${actual.y}`,
  );
}

void test('map.jpg annotations follow the same WGS84 affine transform as the rectified raster', () => {
  const source = guideDocument();
  source.map.calibration = {
    ...LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    notes: '现场补充校准，换图时必须原样保留。',
  };
  const sourceCalibration = buildMapCalibration(
    source.map.calibration,
    source.map.width,
    source.map.height,
  );
  const targetCalibration = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const expectedPoint = (point: MapPoint): MapPoint => {
    const wgs84 = sourceCalibration.imageToWgs84(point);
    assert.ok(wgs84);
    const projected = targetCalibration.wgs84ToImage(wgs84);
    assert.ok(projected);
    return projected;
  };
  const expectedNodes = source.nodes.map(expectedPoint);
  const expectedLink = source.links[0].geometry.map(expectedPoint);
  const expectedArea = source.areas[0].boundary.map(expectedPoint);
  const expectedObstacle =
    source.areas[0].obstacles[0].boundary.map(expectedPoint);
  const migrated = migrateToCurrentBasemap(source);

  assert.equal(isCurrentBasemap(source), false);
  assert.equal(isCurrentBasemap(migrated), true);
  assert.equal(migrated.map.image, REFINED_GUIDE_IMAGE);
  assert.equal(migrated.map.basemapRevision, REFINED_GUIDE_REVISION);
  assert.equal(migrated.map.calibration?.reference.provider, 'openstreetmap');
  assert.equal(migrated.map.calibration?.reference.sourceCrs, 'WGS84');
  assert.deepEqual(
    migrated.map.calibration,
    cloneReferenceCalibration(JIANGYIN_GUIDE_CALIBRATION),
  );

  assert.deepEqual(
    migrated.nodes.map(({ id, levelId, kind }) => ({ id, levelId, kind })),
    source.nodes.map(({ id, levelId, kind }) => ({ id, levelId, kind })),
  );
  assert.deepEqual(migrated.places, source.places);
  assert.deepEqual(
    migrated.links.map(({ id, from, to, name, kind, direction }) => ({
      id,
      from,
      to,
      name,
      kind,
      direction,
    })),
    source.links.map(({ id, from, to, name, kind, direction }) => ({
      id,
      from,
      to,
      name,
      kind,
      direction,
    })),
  );

  expectedNodes.forEach((point, index) =>
    assertSamePoint(migrated.nodes[index], point),
  );
  expectedLink.forEach((point, index) =>
    assertSamePoint(migrated.links[0].geometry[index], point),
  );
  expectedArea.forEach((point, index) =>
    assertSamePoint(migrated.areas[0].boundary[index], point),
  );
  expectedObstacle.forEach((point, index) =>
    assertSamePoint(migrated.areas[0].obstacles[0].boundary[index], point),
  );
  assert.ok(Math.abs(migrated.nodes[0].x - source.nodes[0].x) > 0.005);

  const migratedNodes = new Map(migrated.nodes.map((node) => [node.id, node]));
  assert.deepEqual(migrated.links[0].geometry[0], {
    x: migratedNodes.get(migrated.links[0].from)?.x,
    y: migratedNodes.get(migrated.links[0].from)?.y,
  });
  assert.deepEqual(migrated.links[0].geometry.at(-1), {
    x: migratedNodes.get(migrated.links[0].to)?.x,
    y: migratedNodes.get(migrated.links[0].to)?.y,
  });
});

void test('explicit WGS84 is canonical when map.jpg annotations are rectified', () => {
  const source = guideDocument();
  const canonical = { latitude: 31.907, longitude: 120.158 };
  source.nodes[0] = { ...source.nodes[0], ...canonical };
  const target = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const expected = target.wgs84ToImage(canonical);
  assert.ok(expected);

  const migrated = migrateToCurrentBasemap(source);
  const migratedNode = migrated.nodes[0];

  assert.equal(migratedNode.latitude, canonical.latitude);
  assert.equal(migratedNode.longitude, canonical.longitude);
  assertSamePoint(migratedNode, expected);
  assert.deepEqual(migrated.links[0].geometry[0], {
    x: migratedNode.x,
    y: migratedNode.y,
  });
});

void test('the former vector basemap keeps coordinates because it shares the target WGS84 grid', () => {
  const source: CampusMapDocument = {
    ...guideDocument(),
    map: {
      image: PRECISION_BASEMAP_IMAGE,
      width: 2038,
      height: 1279,
      basemapRevision: PRECISION_BASEMAP_REVISION,
      calibration: JIANGYIN_VECTOR_CALIBRATION,
    },
  };
  const vector = buildMapCalibration(
    JIANGYIN_VECTOR_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const guide = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const expectedWgs84 = vector.imageToWgs84(source.nodes[0]);
  assert.ok(expectedWgs84);

  const migrated = migrateToCurrentBasemap(source);
  const actualWgs84 = guide.imageToWgs84(migrated.nodes[0]);
  assert.ok(actualWgs84);

  assert.equal(isCurrentBasemap(migrated), true);
  assert.equal(migrated.map.image, REFINED_GUIDE_IMAGE);
  assert.equal(migrated.map.basemapRevision, REFINED_GUIDE_REVISION);
  assertSamePoint(migrated.nodes[0], source.nodes[0]);
  assert.ok(Math.abs(actualWgs84.latitude - expectedWgs84.latitude) < 1e-8);
  assert.ok(Math.abs(actualWgs84.longitude - expectedWgs84.longitude) < 1e-8);
});

void test('the former visual-only refined JPEG migrates as the legacy pixel grid', () => {
  const source = guideDocument();
  source.map = {
    image: LEGACY_REFINED_GUIDE_IMAGE,
    width: 2038,
    height: 1279,
    basemapRevision: LEGACY_REFINED_GUIDE_REVISION,
  };
  const legacy = buildMapCalibration(
    LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const target = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const wgs84 = legacy.imageToWgs84(source.nodes[0]);
  assert.ok(wgs84);
  const expected = target.wgs84ToImage(wgs84);
  assert.ok(expected);

  const migrated = migrateToCurrentBasemap(source);

  assert.equal(isCurrentBasemap(migrated), true);
  assertSamePoint(migrated.nodes[0], expected);
  assert.ok(Math.abs(migrated.nodes[0].x - source.nodes[0].x) > 0.005);
});

void test('the previous georectified raster migrates to the high-resolution asset without coordinate drift', () => {
  const source = guideDocument();
  source.map = {
    image: LEGACY_GEORECTIFIED_GUIDE_IMAGE,
    width: 2038,
    height: 1279,
    basemapRevision: LEGACY_GEORECTIFIED_GUIDE_REVISION,
  };

  const migrated = migrateToCurrentBasemap(source);

  assert.equal(isCurrentBasemap(migrated), true);
  assert.equal(migrated.map.image, REFINED_GUIDE_IMAGE);
  assert.equal(migrated.map.basemapRevision, REFINED_GUIDE_REVISION);
  source.nodes.forEach((point, index) =>
    assertSamePoint(migrated.nodes[index], point),
  );
  source.links[0].geometry.forEach((point, index) =>
    assertSamePoint(migrated.links[0].geometry[index], point),
  );
  source.areas[0].boundary.forEach((point, index) =>
    assertSamePoint(migrated.areas[0].boundary[index], point),
  );
  source.areas[0].obstacles[0].boundary.forEach((point, index) =>
    assertSamePoint(migrated.areas[0].obstacles[0].boundary[index], point),
  );
});

void test('explicit WGS84 is canonical when migrating from a genuinely different grid', () => {
  const source: CampusMapDocument = {
    ...guideDocument(),
    map: {
      image: PRECISION_BASEMAP_IMAGE,
      width: 2038,
      height: 1279,
      basemapRevision: PRECISION_BASEMAP_REVISION,
      calibration: JIANGYIN_VECTOR_CALIBRATION,
    },
  };
  const canonical = { latitude: 31.907, longitude: 120.158 };
  source.nodes[0] = { ...source.nodes[0], ...canonical };
  const guide = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    source.map.width,
    source.map.height,
  );
  const expectedImage = guide.wgs84ToImage(canonical);
  assert.ok(expectedImage);

  const migrated = migrateToCurrentBasemap(source);

  assert.equal(migrated.nodes[0].latitude, canonical.latitude);
  assert.equal(migrated.nodes[0].longitude, canonical.longitude);
  assertSamePoint(migrated.nodes[0], expectedImage);
  assert.deepEqual(migrated.links[0].geometry[0], {
    x: migrated.nodes[0].x,
    y: migrated.nodes[0].y,
  });
});

void test('an unknown uncalibrated image fails closed instead of moving annotations', () => {
  const source = guideDocument();
  const unknown: CampusMapDocument = {
    ...source,
    map: {
      image: 'unknown-custom-basemap.png',
      width: source.map.width,
      height: source.map.height,
    },
  };

  assert.throws(
    () => migrateToCurrentBasemap(unknown),
    /(?:unknown|未知|校准|迁移|底图)/i,
  );
});

void test('a refined guide without the exact revision and calibration fails closed', () => {
  for (const basemapRevision of [undefined, 'njust-jiangyin-stale']) {
    const document: CampusMapDocument = {
      ...createEmptyCampusMap(),
      map: {
        image: REFINED_GUIDE_IMAGE,
        width: 2038,
        height: 1279,
        basemapRevision,
      },
    };

    assert.equal(isCurrentBasemap(document), false);
    assert.throws(
      () => migrateToCurrentBasemap(document),
      /(?:unknown|未知|校准|迁移|底图)/i,
    );
  }
});
