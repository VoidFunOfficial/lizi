import { DEFAULT_PREFERENCES, type PlannerPreferences } from './planner.ts';
import { TERMS, validDate, weekday, type AcademicTerm } from './calendar.ts';
import type { Timetable } from './timetable.ts';

export const STUDENT_STORAGE_KEY = 'njust-student-profile-v1';
export type StudentData = {
  version: 1;
  timetable: Timetable | null;
  term: AcademicTerm;
  preferences: PlannerPreferences;
  overrides: Record<string, string | null>;
  importedAt: string;
  fileName: string;
};
export function emptyStudentData(): StudentData {
  return {
    version: 1,
    timetable: null,
    term: { ...TERMS[0] },
    preferences: {
      ...DEFAULT_PREFERENCES,
      diningIds: [],
      locationBindings: {},
    },
    overrides: {},
    importedAt: '',
    fileName: '',
  };
}
export function validateTerm(term: AcademicTerm): boolean {
  return (
    typeof term.id === 'string' &&
    typeof term.label === 'string' &&
    validDate(term.weekOne) &&
    weekday(term.weekOne) === 1 &&
    validDate(term.end) &&
    term.end >= term.weekOne &&
    Date.parse(term.end) - Date.parse(term.weekOne) <= 366 * 86_400_000 &&
    validDate(term.examStart)
  );
}
export function parseStudentData(raw: string): StudentData {
  if (raw.length > 2_000_000) throw new Error('本地课表过大');
  const value = JSON.parse(raw) as StudentData;
  if (
    !value ||
    value.version !== 1 ||
    typeof value.fileName !== 'string' ||
    typeof value.importedAt !== 'string' ||
    !value.term ||
    !validateTerm(value.term) ||
    !value.preferences ||
    !value.overrides
  )
    throw new Error('本地课表格式无效');
  const p = value.preferences;
  if (
    typeof p.homeId !== 'string' ||
    !Array.isArray(p.diningIds) ||
    !p.diningIds.every((id) => typeof id === 'string') ||
    typeof p.meals !== 'boolean' ||
    !p.locationBindings ||
    !Object.values(p.locationBindings).every((id) => typeof id === 'string')
  )
    throw new Error('本地地点设置无效');
  if (
    ![p.breakfast, p.lunch, p.dinner].every(
      (t) => typeof t === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t),
    ) ||
    !Number.isFinite(p.mealMinutes) ||
    p.mealMinutes < 10 ||
    p.mealMinutes > 90 ||
    !Number.isFinite(p.arrivalBuffer) ||
    p.arrivalBuffer < 0 ||
    p.arrivalBuffer > 60
  )
    throw new Error('本地用餐设置无效');
  if (
    !Object.entries(value.overrides).every(
      ([date, target]) =>
        validDate(date) && (target === null || validDate(target)),
    )
  )
    throw new Error('本地调课设置无效');
  const t = value.timetable;
  if (
    t &&
    (!Array.isArray(t.courses) ||
      t.courses.length > 1000 ||
      !Array.isArray(t.activities) ||
      !Array.isArray(t.warnings) ||
      !t.warnings.every((warning) => typeof warning === 'string') ||
      ![t.student, t.className, t.college, t.termId].every(
        (s) => typeof s === 'string',
      ) ||
      !t.courses.every(
        (c) =>
          [c.id, c.name, c.teacher, c.location, c.weekText].every(
            (s) => typeof s === 'string',
          ) &&
          Number.isInteger(c.weekday) &&
          c.weekday >= 1 &&
          c.weekday <= 7 &&
          Number.isInteger(c.startPeriod) &&
          Number.isInteger(c.endPeriod) &&
          c.startPeriod >= 1 &&
          c.endPeriod <= 13 &&
          c.endPeriod >= c.startPeriod &&
          Array.isArray(c.weeks) &&
          c.weeks.every((w) => Number.isInteger(w) && w >= 1 && w <= 53),
      ) ||
      !t.activities.every(
        (a) =>
          typeof a.name === 'string' &&
          typeof a.detail === 'string' &&
          Array.isArray(a.weeks) &&
          a.weeks.every((w) => Number.isInteger(w) && w >= 1 && w <= 53),
      ))
  )
    throw new Error('本地课程记录无效');
  return value;
}
