import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dailyPreviewLegs,
  routePreviewPoint,
} from '../lib/student/route-preview.ts';

void test('preview follows distance along unequal edges and clamps to its endpoints', () => {
  const points = [0, 0.1, 1].map((x) => ({ x, y: 0, levelId: 'ground' }));
  assert.equal(routePreviewPoint(points, 0.5)?.x, 0.5);
  assert.deepEqual(routePreviewPoint(points, -1), points[0]);
  assert.deepEqual(routePreviewPoint(points, 2), points[2]);
  assert.equal(routePreviewPoint([], 0.5), null);
  assert.deepEqual(routePreviewPoint([points[0], points[0]], 0.5), points[0]);
});

void test('preview jumps at floor changes without inventing geometry between levels', () => {
  const points = [
    { x: 0, y: 0, levelId: 'ground' },
    { x: 1, y: 0, levelId: 'upstairs' },
  ];
  assert.deepEqual(routePreviewPoint(points, 0.5), points[0]);
  assert.deepEqual(routePreviewPoint(points, 1), points[1]);
});

void test('whole-day preview retains online and unconfigured meal stops in order', () => {
  const steps = dailyPreviewLegs({
    legs: [],
    warnings: [],
    stops: [
      {
        id: 'online',
        kind: 'course',
        title: '线上课程',
        detail: '线上',
        start: 480,
        end: 525,
        place: null,
        online: true,
        warnings: [],
      },
      {
        id: 'lunch',
        kind: 'meal',
        title: '午餐',
        detail: '待选择食堂',
        start: 735,
        end: 765,
        place: null,
        warnings: [],
      },
    ],
  });
  assert.deepEqual(
    steps.map((step) => step.stopTitle),
    ['线上课程', '午餐'],
  );
  assert.equal(steps[0].needsRoute, false);
  assert.equal(steps[1].needsRoute, true);
  assert.ok(steps.every((step) => step.route === null));
});
