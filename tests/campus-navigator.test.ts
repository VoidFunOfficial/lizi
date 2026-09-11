import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCampusMap } from '../lib/campus-document.ts';
import { compileCampusMap } from '../lib/campus-navigator.ts';
import { JIANGYIN_CAMPUS_CALIBRATION } from '../lib/njust-jiangyin-reference.ts';
import {
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  createEmptyCampusMap,
  polylineLengthPixels,
  type CampusMapDocument,
  type MapPoint,
  type RouteProfile,
  type SunlightContext,
  type TraversalLink,
  type TraversalNode,
} from '../lib/campus-model.ts';

const departure = new Date('2026-08-31T12:00:00+08:00');

function node(
  id: string,
  x: number,
  y: number,
  levelId = DEFAULT_LEVEL.id,
): TraversalNode {
  return { id, x, y, levelId, kind: 'junction' };
}

function link(
  id: string,
  from: TraversalNode,
  to: TraversalNode,
  patch: Partial<TraversalLink> = {},
): TraversalLink {
  return {
    id,
    from: from.id,
    to: to.id,
    kind: 'path',
    direction: 'both',
    geometry: [from, to],
    environment: { ...DEFAULT_ENVIRONMENT },
    access: { ...DEFAULT_ACCESS },
    costMultiplier: 1,
    ...patch,
  };
}

function mapWith(
  nodes: TraversalNode[],
  links: TraversalLink[],
): CampusMapDocument {
  return { ...createEmptyCampusMap(), nodes, links };
}

function route(document: CampusMapDocument, profile: RouteProfile = 'fastest') {
  const result = compileCampusMap(document).route({
    origin: { nodeId: document.nodes[0].id },
    destination: { nodeId: document.nodes[1].id },
    profile,
    departureTime: departure,
    audience: 'campus',
  });
  assert.ok(result);
  return result;
}

void test('curved traversal links use their full geometry length', () => {
  const start = node('start', 0.1, 0.2);
  const end = node('end', 0.9, 0.2);
  const geometry: MapPoint[] = [start, { x: 0.5, y: 0.65 }, end];
  const document = mapWith(
    [start, end],
    [link('curve', start, end, { geometry })],
  );
  const result = route(document);

  assert.equal(result.geometry.length, 3);
  assert.equal(result.metrics.distancePixels, polylineLengthPixels(geometry));
  assert.ok(result.metrics.distancePixels > polylineLengthPixels([start, end]));
});

void test('walkable areas permit diagonal travel while routing around obstacles', () => {
  const start = node('start', 0.15, 0.5);
  const end = node('end', 0.85, 0.5);
  const obstacle = [
    { x: 0.42, y: 0.35 },
    { x: 0.58, y: 0.35 },
    { x: 0.58, y: 0.65 },
    { x: 0.42, y: 0.65 },
  ];
  const document: CampusMapDocument = {
    ...mapWith([start, end], []),
    areas: [
      {
        id: 'field',
        name: '运动场',
        levelId: DEFAULT_LEVEL.id,
        boundary: [
          { x: 0.1, y: 0.2 },
          { x: 0.9, y: 0.2 },
          { x: 0.9, y: 0.8 },
          { x: 0.1, y: 0.8 },
        ],
        obstacles: [{ id: 'stand', boundary: obstacle }],
        environment: { ...DEFAULT_ENVIRONMENT },
        access: { ...DEFAULT_ACCESS },
        costMultiplier: 1,
      },
    ],
  };
  const result = route(document);

  assert.ok(result.geometry.length >= 3);
  assert.ok(result.metrics.distancePixels > polylineLengthPixels([start, end]));
  for (let index = 0; index < result.geometry.length - 1; index += 1) {
    const a = result.geometry[index];
    const b = result.geometry[index + 1];
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const strictlyInsideObstacle =
      midpoint.x > 0.42 &&
      midpoint.x < 0.58 &&
      midpoint.y > 0.35 &&
      midpoint.y < 0.65;
    assert.equal(strictlyInsideObstacle, false);
  }
});

void test('cool routes prefer an open indoor passage, but schedules and audience can close it', () => {
  const start = node('start', 0.1, 0.4);
  const end = node('end', 0.9, 0.4);
  const outdoor = link('outdoor', start, end);
  const indoor = link('indoor', start, end, {
    kind: 'building-passage',
    geometry: [start, { x: 0.5, y: 0.7 }, end],
    environment: { setting: 'indoor', shade: 1 },
    access: {
      audience: 'campus',
      wheelchair: true,
      temporarilyClosed: false,
      schedule: {
        days: [0, 1, 2, 3, 4, 5, 6],
        opens: '07:00',
        closes: '22:00',
      },
    },
  });
  const document = mapWith([start, end], [outdoor, indoor]);
  const navigator = compileCampusMap(document);
  const request = {
    origin: { nodeId: start.id } as const,
    destination: { nodeId: end.id } as const,
    departureTime: departure,
    audience: 'campus' as const,
  };

  const fastest = navigator.route({ ...request, profile: 'fastest' });
  const cool = navigator.route({ ...request, profile: 'cool' });
  const closedAtNight = navigator.route({
    ...request,
    profile: 'cool',
    departureTime: new Date('2026-08-31T23:00:00+08:00'),
  });
  const visitor = navigator.route({
    ...request,
    profile: 'cool',
    audience: 'public',
  });

  assert.ok(fastest && cool && closedAtNight && visitor);
  assert.equal(fastest.metrics.indoorPixels, 0);
  assert.ok(cool.metrics.indoorPixels > 0);
  assert.equal(closedAtNight.metrics.indoorPixels, 0);
  assert.equal(visitor.metrics.indoorPixels, 0);
});

void test('accessible routing rejects stairs and uses an elevator across levels', () => {
  const ground = node('ground', 0.4, 0.4, 'ground');
  const upper = node('upper', 0.4, 0.4, 'upper');
  const stairs = link('stairs', ground, upper, {
    kind: 'stairs',
    environment: { setting: 'indoor', shade: 1 },
    access: { ...DEFAULT_ACCESS, wheelchair: false },
  });
  const elevator = link('elevator', ground, upper, {
    kind: 'elevator',
    environment: { setting: 'indoor', shade: 1 },
    access: { ...DEFAULT_ACCESS, wheelchair: true },
    costMultiplier: 3,
  });
  const document: CampusMapDocument = {
    ...mapWith([ground, upper], [stairs, elevator]),
    levels: [
      { id: 'ground', name: '一层', elevationMeters: 0 },
      { id: 'upper', name: '二层', elevationMeters: 3.6 },
    ],
  };

  const fastest = route(document, 'fastest');
  const accessible = route(document, 'accessible');
  assert.equal(fastest.metrics.stairsCount, 1);
  assert.equal(accessible.metrics.stairsCount, 0);
  assert.equal(accessible.metrics.levelChanges, 1);
});

void test('v1 straight-road exports migrate into the v2 domain model', () => {
  const migrated = parseCampusMap(
    JSON.stringify({
      version: 1,
      map: { image: 'map.jpg', width: 2038, height: 1279 },
      nodes: [
        { id: 'a', x: 0.1, y: 0.1, label: '东门' },
        { id: 'b', x: 0.2, y: 0.2, label: '图书馆' },
      ],
      edges: [{ id: 'ab', from: 'a', to: 'b' }],
    }),
  );

  assert.equal(migrated.version, 2);
  assert.equal(migrated.links[0].kind, 'path');
  assert.deepEqual(
    migrated.places.map((place) => place.name),
    ['东门', '图书馆'],
  );
});

void test('a calibrated GPS point starts at the nearest position on a link and reports metres', () => {
  const start = node('start', 0.2, 0.5);
  const end = node('end', 0.8, 0.5);
  const document: CampusMapDocument = {
    ...mapWith([start, end], [link('main', start, end)]),
    map: {
      ...createEmptyCampusMap().map,
      calibration: JIANGYIN_CAMPUS_CALIBRATION,
    },
  };
  const result = compileCampusMap(document).route({
    origin: { point: { x: 0.5, y: 0.5 }, levelId: DEFAULT_LEVEL.id },
    destination: { nodeId: end.id },
    profile: 'fastest',
    departureTime: departure,
    audience: 'campus',
  });

  assert.ok(result);
  assert.ok(Math.abs(result.geometry[0].x - 0.5) < 1e-8);
  assert.ok(result.metrics.distanceMeters);
  assert.ok(result.metrics.distanceMeters > 300);
  assert.ok(result.metrics.distanceMeters < 500);
  assert.ok(result.metrics.distancePixels < polylineLengthPixels([start, end]));
});

void test('sunny cool routing uses computed building shadows instead of legacy shade fields', () => {
  const start = node('start', 0.1, 0.4);
  const end = node('end', 0.9, 0.4);
  const direct = link('direct', start, end, {
    environment: { setting: 'outdoor', shade: 1 },
  });
  const detour = link('shadow-detour', start, end, {
    geometry: [start, { x: 0.5, y: 0.65 }, end],
    environment: { setting: 'outdoor', shade: 0 },
  });
  const document = mapWith([start, end], [direct, detour]);
  const sunlight: SunlightContext = {
    status: 'active',
    departureTime: departure.toISOString(),
    weatherAt: departure.toISOString(),
    weatherSource: 'hourly',
    weatherCode: 0,
    position: { elevationDegrees: 45, azimuthDegrees: 180 },
    shadowPolygons: [
      {
        buildingId: 'test-shadow',
        boundary: [
          { x: 0.05, y: 0.45 },
          { x: 0.95, y: 0.45 },
          { x: 0.95, y: 0.7 },
          { x: 0.05, y: 0.7 },
        ],
      },
    ],
  };
  const navigator = compileCampusMap(document);
  const request = {
    origin: { nodeId: start.id } as const,
    destination: { nodeId: end.id } as const,
    departureTime: departure,
    audience: 'campus' as const,
    sunlight,
  };

  const fastest = navigator.route({ ...request, profile: 'fastest' });
  const cool = navigator.route({ ...request, profile: 'cool' });

  assert.ok(fastest && cool);
  assert.equal(fastest.geometry.length, 2);
  assert.equal(cool.geometry.length, 3);
  assert.equal(cool.geometry[1].y, 0.65);
  assert.equal(cool.metrics.sunlight?.status, 'active');
  if (cool.metrics.sunlight?.status === 'active') {
    assert.ok(cool.metrics.sunlight.buildingShadowPixels > 0);
    assert.ok(cool.metrics.sunlight.directSunPixels > 0);
    assert.ok(
      cool.metrics.sunlight.buildingShadowPixels >
        cool.metrics.sunlight.directSunPixels,
    );
  }
});

void test('non-sunny routing disables sunlight weighting and ignores legacy outdoor shade', () => {
  const start = node('start', 0.1, 0.4);
  const end = node('end', 0.9, 0.4);
  const direct = link('direct', start, end, {
    environment: { setting: 'outdoor', shade: 0 },
  });
  const legacyShadedDetour = link('legacy-shadow', start, end, {
    geometry: [start, { x: 0.5, y: 0.7 }, end],
    environment: { setting: 'outdoor', shade: 1 },
  });
  const sunlight: SunlightContext = {
    status: 'inactive',
    departureTime: departure.toISOString(),
    reason: 'not-sunny',
    weatherAt: departure.toISOString(),
    weatherSource: 'current',
    weatherCode: 1,
  };
  const result = compileCampusMap(
    mapWith([start, end], [direct, legacyShadedDetour]),
  ).route({
    origin: { nodeId: start.id },
    destination: { nodeId: end.id },
    profile: 'cool',
    departureTime: departure,
    audience: 'campus',
    sunlight,
  });

  assert.ok(result);
  assert.equal(result.geometry.length, 2);
  assert.deepEqual(result.metrics.sunlight, {
    status: 'inactive',
    departureTime: departure.toISOString(),
    reason: 'not-sunny',
    weatherAt: departure.toISOString(),
    weatherSource: 'current',
    weatherCode: 1,
  });
});
