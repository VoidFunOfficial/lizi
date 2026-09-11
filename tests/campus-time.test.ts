import assert from 'node:assert/strict';
import test from 'node:test';

import {
  campusClock,
  formatCampusDateTime,
  parseCampusDateTime,
  startOfCampusHour,
} from '../lib/campus-time.ts';

void test('campus date-time values always use Asia/Shanghai wall time', () => {
  const instant = new Date('2026-08-31T15:42:00Z');

  assert.equal(formatCampusDateTime(instant), '2026-08-31T23:42');
  assert.equal(
    parseCampusDateTime('2026-08-31T23:42')?.toISOString(),
    instant.toISOString(),
  );
  assert.deepEqual(campusClock(instant), { day: 1, minutes: 23 * 60 + 42 });
  assert.equal(
    new Date(startOfCampusHour(instant)).toISOString(),
    '2026-08-31T15:00:00.000Z',
  );
});

void test('invalid campus wall-clock values fail closed', () => {
  assert.equal(parseCampusDateTime('2026-02-30T12:00'), null);
  assert.equal(parseCampusDateTime('2026-09-01 12:00'), null);
  assert.equal(parseCampusDateTime(''), null);
});
