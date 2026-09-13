import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCampusMap } from '../lib/default-campus-map.ts';
import {
  allowedPersonalPlaces,
  diningLabel,
  isDormitory,
} from '../lib/student/places.ts';
import {
  createDailyPlan,
  DEFAULT_PREFERENCES,
} from '../lib/student/planner.ts';
import { compileCampusMap } from '../lib/campus-navigator.ts';
import {
  rubberbandSheet,
  sheetReleaseTarget,
  stepSheetSpring,
} from '../lib/sheet-motion.ts';

void test('latest annotations expose only dormitories and the three requested dining halls', () => {
  const { places } = createDefaultCampusMap();
  const dorms = places.filter(isDormitory);
  assert.equal(dorms.length, 20);
  assert.ok(dorms.some((p) => p.name === '宿舍11B'));
  assert.deepEqual(
    new Set(places.filter((p) => diningLabel(p)).map((p) => diningLabel(p))),
    new Set(['兰苑', '樱花', '芙蓉']),
  );
  for (const name of [
    '宿舍管理员办公室',
    '图书馆',
    '兰苑超市',
    '芙蓉园停车场',
    'constructor',
  ]) {
    const place = { id: 'invalid', nodeId: 'invalid', name };
    assert.equal(isDormitory(place), false);
    assert.equal(diningLabel(place), null);
  }
});

void test('legacy invalid selections cannot become a home or meal destination', () => {
  const map = createDefaultCampusMap();
  const library = map.places.find((p) => p.name === '图书馆')!;
  const dorm = map.places.find((p) => p.name === '宿舍11B')!;
  const dining = map.places.find((p) => p.name === '芙蓉园')!;
  const preferences = {
    ...DEFAULT_PREFERENCES,
    homeId: library.id,
    diningIds: [dining.id, library.id, 'deleted', dining.id],
  };
  const filtered = allowedPersonalPlaces(preferences, map.places);
  assert.equal(filtered.homeId, '');
  assert.deepEqual(filtered.diningIds, [dining.id]);
  assert.equal(
    preferences.homeId,
    library.id,
    'validation never mutates saved input',
  );
  assert.equal(
    allowedPersonalPlaces({ ...preferences, homeId: dorm.id }, map.places)
      .homeId,
    dorm.id,
  );
  const plan = createDailyPlan(
    {
      courses: [],
      activities: [],
      week: 4,
      reason: null,
      referenceDate: '2026-09-14',
    },
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    { ...preferences, diningIds: [library.id] },
  );
  const returns = plan.stops.filter((s) => s.kind === 'home');
  assert.equal(returns.length, 3);
  assert.ok(returns.every((s) => !s.place && s.detail === '请设置寝室'));
  assert.ok(plan.legs.every((leg) => !leg.route));
  assert.ok(plan.stops.filter((s) => s.kind === 'meal').every((s) => !s.place));
  assert.ok(plan.warnings.some((s) => s.includes('设置寝室')));
});

void test('sheet distinguishes a tap, a pull, a flick and an upward reversal', () => {
  assert.equal(sheetReleaseTarget(8, 0, 400), false);
  assert.equal(sheetReleaseTarget(160, 0, 400), true);
  assert.equal(sheetReleaseTarget(30, 700, 400), true);
  assert.equal(sheetReleaseTarget(190, -350, 400), false);
  assert.equal(rubberbandSheet(80, 400), 80);
  assert.ok(rubberbandSheet(-100, 400) > -100);
  assert.ok(rubberbandSheet(600, 400) < 600);
});

void test('sheet spring carries release velocity and can reverse before finishing', () => {
  let state = stepSheetSpring(80, 600, 400, 1 / 60);
  assert.ok(state.position > 80);
  state = stepSheetSpring(state.position, state.velocity, 0, 1 / 60);
  for (let i = 0; i < 120; i++)
    state = stepSheetSpring(state.position, state.velocity, 0, 1 / 60);
  assert.ok(Math.abs(state.position) < 0.01);
  assert.ok(Math.abs(state.velocity) < 0.01);
  const delayed = stepSheetSpring(150, 900, 400, 0.064);
  assert.ok(
    Number.isFinite(delayed.position) && Number.isFinite(delayed.velocity),
  );
});
