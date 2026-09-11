import assert from 'node:assert/strict';
import test from 'node:test';
import { utils, write } from 'xlsx';
import rows from './fixtures/student-timetable-rows.json' with { type: 'json' };
import {
  calendarStatus,
  campusToday,
  TERMS,
  weekOf,
  PERIODS,
} from '../lib/student/calendar.ts';
import {
  courseTime,
  parseTimetableRows,
  parseWeeks,
  scheduleForDate,
  type Course,
} from '../lib/student/timetable.ts';
import { importTimetable } from '../lib/student/import.ts';
import {
  createDailyPlan,
  DEFAULT_PREFERENCES,
  resolveCoursePlace,
} from '../lib/student/planner.ts';
import { emptyStudentData, parseStudentData } from '../lib/student/storage.ts';
import { compileCampusMap } from '../lib/campus-navigator.ts';
import { createDefaultCampusMap } from '../lib/default-campus-map.ts';
import {
  createEmptyCampusMap,
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  type CampusMapDocument,
  type Place,
} from '../lib/campus-model.ts';

const table = parseTimetableRows([{ name: 'Sheet1', rows }]);
const autumn = TERMS[0];
void test('binary XLS and XLSX imports preserve the observed export layout', () => {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), 'Sheet1');
  for (const bookType of ['biff8', 'xlsx'] as const) {
    const bytes = write(workbook, { type: 'array', bookType }) as ArrayBuffer;
    const imported = importTimetable(bytes);
    assert.deepEqual(imported, table);
  }
});
function course(patch: Partial<Course> = {}): Course {
  return {
    id: 'one',
    name: '测试课程',
    teacher: '教师',
    location: '教学楼A101',
    weekday: 1,
    startPeriod: 1,
    endPeriod: 3,
    weeks: [4],
    weekText: '4[周]',
    ...patch,
  };
}
function campus(): CampusMapDocument {
  const map = createEmptyCampusMap();
  const nodes = ['home', 'class', 'dining', 'far'].map((id, i) => ({
    id,
    x: 0.1 + i * 0.02,
    y: 0.1,
    kind: 'junction' as const,
    levelId: DEFAULT_LEVEL.id,
  }));
  return {
    ...map,
    map: { ...map.map, metersPerPixel: 0.5 },
    nodes,
    places: nodes.map((node, i) => ({
      id: node.id,
      name: ['宿舍', '教学楼A', '芙蓉园', '兰苑食堂'][i],
      nodeId: node.id,
    })),
    links: nodes.slice(1).map((n, i) => ({
      id: `link-${i}`,
      from: nodes[i].id,
      to: n.id,
      kind: 'path' as const,
      direction: 'both' as const,
      geometry: [nodes[i], n],
      environment: { ...DEFAULT_ENVIRONMENT },
      access: { ...DEFAULT_ACCESS },
      costMultiplier: 1,
    })),
  };
}

void test('NJUST export recognizes multiple courses per cell, missing locations and full-week activity', () => {
  assert.equal(table.courses.length, 28);
  assert.equal(new Set(table.courses.map((c) => c.name)).size, 14);
  assert.equal(table.termId, '2026-2027-1');
  assert.equal(table.warnings.length, 0);
  const mondayMorning = table.courses.filter(
    (c) => c.weekday === 1 && c.startPeriod === 4,
  );
  assert.deepEqual(
    mondayMorning.map((c) => c.name),
    ['形势与政策（Ⅰ）', '人工智能导论'],
  );
  assert.equal(mondayMorning[1].location, '江阴致道A310');
  assert.ok(
    table.courses
      .filter((c) => c.name === '电子工程实践（Ⅰ）')
      .every((c) => c.location === ''),
  );
  assert.deepEqual(table.activities[0].weeks, [1, 2, 3]);
  assert.equal(table.activities[0].name, '军事训练');
});
void test('week expressions preserve gaps, singles, lists and odd/even filtering', () => {
  assert.deepEqual(parseWeeks('4-6,8-10[周]'), [4, 5, 6, 8, 9, 10]);
  assert.deepEqual(parseWeeks('1-8周(单)'), [1, 3, 5, 7]);
  assert.deepEqual(parseWeeks('2～8【周】（双）'), [2, 4, 6, 8]);
  assert.deepEqual(parseWeeks('10[周]'), [10]);
  assert.throws(() => parseWeeks('18-4周'));
  assert.throws(() => parseWeeks('0-9999周'));
  assert.throws(() => parseWeeks('待定'));
});
void test('repeated sheets deduplicate records and malformed cells surface warnings', () => {
  assert.equal(
    parseTimetableRows([
      { name: 'one', rows },
      { name: 'two', rows },
    ]).courses.length,
    28,
  );
  const changed = structuredClone(rows);
  changed[3][1] = '格式不明的课程';
  assert.equal(
    parseTimetableRows([{ name: 'one', rows: changed }]).warnings.length,
    1,
  );
  assert.throws(() =>
    parseTimetableRows([{ name: 'one', rows: [['invalid']] }]),
  );
  assert.throws(() => importTimetable(new ArrayBuffer(0)));
  assert.throws(() => importTimetable(new ArrayBuffer(6 * 1024 * 1024)));
});
void test('campus date and calendar week boundaries are independent of device timezone', () => {
  assert.equal(campusToday(new Date('2026-09-13T16:00:00Z')), '2026-09-14');
  assert.equal(weekOf('2026-09-13', autumn.weekOne), 3);
  assert.equal(calendarStatus('2026-09-14').week, 4);
  assert.equal(calendarStatus('2026-09-09').label, '夏季学期');
  assert.equal(calendarStatus('2027-01-15').week, 21);
  assert.equal(calendarStatus('2027-01-16').label, '寒假');
  assert.equal(calendarStatus('2027-02-22').week, 1);
  assert.equal(calendarStatus('2027-06-25').week, 18);
  assert.equal(calendarStatus('2027-06-26').label, '暑假');
});
void test('provided example yields the exact Monday week 4 schedule and summer military training', () => {
  const day = scheduleForDate(table, autumn, '2026-09-14');
  assert.deepEqual(
    day.courses.map((c) => c.name),
    ['高等数学（Ⅰ）', '军事理论', '大学生心理健康教育指导'],
  );
  assert.deepEqual(courseTime(day.courses[0]), { start: 840, end: 935 });
  assert.deepEqual(courseTime(day.courses[2]), { start: 1140, end: 1285 });
  assert.equal(PERIODS.length, 13);
  const summer = scheduleForDate(table, autumn, '2026-09-09');
  assert.equal(summer.courses.length, 0);
  assert.equal(summer.activities[0].name, '军事训练');
});
void test('holidays, exam weeks and vacations suspend regular courses; explicit makeup overrides work', () => {
  for (const date of [
    '2026-09-25',
    '2026-10-01',
    '2027-01-01',
    '2027-01-04',
    '2027-01-16',
  ]) {
    const day = scheduleForDate(table, autumn, date);
    assert.equal(day.courses.length, 0);
    assert.ok(day.reason);
  }
  const makeup = scheduleForDate(table, autumn, '2026-10-01', {
    '2026-10-01': '2026-09-14',
  });
  assert.equal(makeup.courses.length, 3);
  assert.equal(makeup.week, 4);
  assert.equal(makeup.reason, null);
  assert.equal(
    scheduleForDate(table, autumn, '2026-09-14', { '2026-09-14': null }).reason,
    '当天停课',
  );
  assert.equal(scheduleForDate(table, autumn, '2027-02-22').courses.length, 0);
});
void test('location matching never confuses similarly named buildings and honors manual mapping', () => {
  const places = [
    { id: 'a', name: '致新B', nodeId: 'a' },
    { id: 'b', name: '致远楼A', nodeId: 'b' },
  ] satisfies Place[];
  assert.equal(
    resolveCoursePlace(course({ location: '江阴致新B114' }), places, {})?.id,
    'a',
  );
  assert.equal(
    resolveCoursePlace(course({ location: '江阴致源B104' }), places, {}),
    null,
  );
  assert.equal(
    resolveCoursePlace(course({ location: '线上' }), places, {}),
    null,
  );
  assert.equal(resolveCoursePlace(course({ location: '' }), places, {}), null);
  assert.equal(
    resolveCoursePlace(course({ location: '江阴致源B104' }), places, {
      江阴致源B104: 'b',
    })?.id,
    'b',
  );
  assert.equal(
    resolveCoursePlace(course({ location: '江阴致新B114' }), places, {
      江阴致新B114: '',
    })?.id,
    'a',
  );
});

void test('the supplied timetable automatically resolves every named in-person venue against the latest annotations', () => {
  const map = createDefaultCampusMap();
  const expected: Record<string, string> = {
    江阴致新B114: '致新楼',
    江阴致知B106: '致知楼',
    江阴格物C104: '格物楼C',
    江阴国际会议中心230: '国际学术交流中心',
    江阴致道A310: '致道楼',
    江阴运动场东跑道: '体育场',
    江阴致源B104: '致源楼',
    江阴致道A106: '致道楼',
    江阴致真A216: '致真楼',
  };
  for (const c of table.courses.filter(
    (item) => item.location && item.location !== '线上',
  )) {
    assert.equal(
      resolveCoursePlace(c, map.places, {})?.name,
      expected[c.location],
      c.location,
    );
  }
  for (const [location, name] of Object.entries(expected)) {
    assert.equal(
      resolveCoursePlace(course({ location }), map.places, {
        [location]: 'removed-place',
      })?.name,
      name,
    );
  }
  const preferences = {
    ...DEFAULT_PREFERENCES,
    homeId: map.places.find((p) => p.name === '宿舍11B')!.id,
    diningIds: map.places.filter((p) => /食堂/.test(p.name)).map((p) => p.id),
    locationBindings: {},
  };
  const day = scheduleForDate(table, autumn, '2026-09-14');
  const plan = createDailyPlan(
    day,
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    preferences,
  );
  assert.equal(plan.stops.filter((s) => s.kind === 'course').length, 3);
  assert.ok(
    plan.stops.filter((s) => s.kind === 'course').every((s) => s.place),
  );
  assert.ok(
    plan.legs.every((leg) => leg.route || leg.message === '同一地点，无需步行'),
  );
});

void test('exact rooms and building blocks outrank whole buildings without crossing A/B/C blocks', () => {
  const places = [
    { id: 'whole', name: '致新楼', nodeId: 'whole' },
    { id: 'b', name: '致新楼B', nodeId: 'b' },
    { id: 'room', name: '致新楼B114', nodeId: 'room' },
  ];
  const c = course({ location: '江阴校区 致新楼 Ｂ－１１４' });
  assert.equal(resolveCoursePlace(c, places, {})?.id, 'room');
  assert.equal(resolveCoursePlace(c, places.slice(0, 2), {})?.id, 'b');
  assert.equal(resolveCoursePlace(c, places.slice(0, 1), {})?.id, 'whole');
  assert.equal(
    resolveCoursePlace(
      course({ location: '江阴格物C104' }),
      [{ id: 'a', name: '格物楼A', nodeId: 'a' }],
      {},
    ),
    null,
  );
  assert.equal(
    resolveCoursePlace(
      c,
      [places[0], { id: 'other', name: '致新', nodeId: 'other' }],
      {},
    ),
    null,
  );
});

void test('unconfigured meals do not break automatic classroom navigation from the configured home', () => {
  const map = createDefaultCampusMap();
  const day = scheduleForDate(table, autumn, '2026-09-14');
  const plan = createDailyPlan(
    day,
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    {
      ...DEFAULT_PREFERENCES,
      homeId: map.places.find((p) => p.name === '宿舍11B')!.id,
    },
  );
  const firstClass = plan.legs.find(
    (leg) => leg.destinationId === day.courses[0].id,
  )!;
  assert.equal(firstClass.from, '宿舍11B');
  assert.equal(firstClass.to, '致新楼');
  assert.ok(firstClass.route);
  assert.ok(
    plan.legs
      .filter((leg) => day.courses.some((c) => c.id === leg.destinationId))
      .every((leg) => leg.route),
  );
  assert.ok(
    plan.stops
      .filter((stop) => stop.kind === 'meal')
      .every((stop) => stop.place === null && stop.warnings.length > 0),
  );
});
void test('daily plan uses actual network routes, avoids course times and returns home', () => {
  const map = campus();
  const day = {
    courses: [
      course({ startPeriod: 4, endPeriod: 5 }),
      course({ id: 'two', startPeriod: 6, endPeriod: 7 }),
    ],
    activities: [],
    week: 4,
    reason: null,
    referenceDate: '2026-09-14',
  };
  const preferences = {
    ...DEFAULT_PREFERENCES,
    homeId: 'home',
    diningIds: ['dining', 'far'],
    locationBindings: { 教学楼A101: 'class' },
  };
  const plan = createDailyPlan(
    day,
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    preferences,
  );
  assert.equal(plan.stops.filter((s) => s.kind === 'meal').length, 3);
  for (const meal of plan.stops.filter((s) => s.kind === 'meal')) {
    assert.equal(meal.place?.id, 'dining');
    assert.ok(
      day.courses.every(
        (c) =>
          meal.end <= courseTime(c).start || meal.start >= courseTime(c).end,
      ),
    );
  }
  assert.equal(plan.stops.at(-1)?.kind, 'home');
  assert.ok(plan.legs.filter((leg) => leg.route).length >= 4);
  const lunch = plan.stops.find((s) => s.title === '午餐')!;
  assert.ok(
    lunch.start > 12 * 60 + 15,
    'walking from the 12:15 class must delay lunch',
  );
  for (const stop of plan.stops.filter((s) => s.kind === 'course')) {
    const leg = plan.legs.find((l) => l.destinationId === stop.id)!;
    assert.ok(leg.arrival <= stop.start - 10);
    assert.ok(leg.route?.geometry.length);
  }
});
void test('unknown and unreachable endpoints remain explicit, online classes do not generate walking', () => {
  const map = campus();
  const day = {
    courses: [
      course({ location: '' }),
      course({ id: 'online', startPeriod: 6, endPeriod: 7, location: '线上' }),
    ],
    activities: [],
    week: 4,
    reason: null,
    referenceDate: '2026-09-14',
  };
  const plan = createDailyPlan(
    day,
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    { ...DEFAULT_PREFERENCES, meals: false },
  );
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0].route, null);
  assert.match(plan.legs[0].message, /地点未确定/);
  const disconnected = { ...map, links: [] };
  const blocked = createDailyPlan(
    { ...day, courses: [course()] },
    '2026-09-14',
    map.places,
    compileCampusMap(disconnected),
    {
      ...DEFAULT_PREFERENCES,
      meals: false,
      homeId: 'home',
      locationBindings: { 教学楼A101: 'class' },
    },
  );
  assert.equal(blocked.legs[0].route, null);
  assert.match(blocked.legs[0].message, /没有可达/);
});
void test('overlapping courses and too short transfers are flagged', () => {
  const map = campus();
  const plan = createDailyPlan(
    {
      courses: [course(), course({ id: 'overlap' })],
      activities: [],
      week: 4,
      reason: null,
      referenceDate: '2026-09-14',
    },
    '2026-09-14',
    map.places,
    compileCampusMap(map),
    { ...DEFAULT_PREFERENCES, meals: false },
  );
  assert.ok(plan.stops[0].warnings.some((s) => /冲突/.test(s)));
  assert.ok(plan.stops[1].warnings.some((s) => /重叠/.test(s)));
});
void test('persisted timetable roundtrips and corrupt data is rejected', () => {
  const data = { ...emptyStudentData(), timetable: table };
  assert.deepEqual(parseStudentData(JSON.stringify(data)), data);
  assert.throws(() => parseStudentData('{bad'));
  assert.throws(() =>
    parseStudentData(JSON.stringify({ ...data, version: 99 })),
  );
  assert.throws(() =>
    parseStudentData(
      JSON.stringify({
        ...data,
        preferences: { ...data.preferences, breakfast: '88:88' },
      }),
    ),
  );
  assert.throws(() =>
    parseStudentData(
      JSON.stringify({
        ...data,
        term: { ...data.term, weekOne: '2026-09-15' },
      }),
    ),
  );
});
