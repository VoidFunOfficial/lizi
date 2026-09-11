import { formatCampusDateTime } from '../campus-time.ts';

export const PERIODS = [
  ['08:00', '08:45'],
  ['08:50', '09:35'],
  ['09:40', '10:25'],
  ['10:40', '11:25'],
  ['11:30', '12:15'],
  ['14:00', '14:45'],
  ['14:50', '15:35'],
  ['15:50', '16:35'],
  ['16:40', '17:25'],
  ['17:30', '18:15'],
  ['19:00', '19:45'],
  ['19:50', '20:35'],
  ['20:40', '21:25'],
] as const;
export const BIG_PERIODS = [
  [1, 3],
  [4, 5],
  [6, 7],
  [8, 10],
  [11, 13],
] as const;
export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
export type AcademicTerm = {
  id: string;
  label: string;
  weekOne: string;
  end: string;
  examStart: string;
};
// Transcribed from the user supplied NJUST 2026–2027 calendar. Autumn continues summer week numbering.
export const TERMS: AcademicTerm[] = [
  {
    id: '2026-2027-1',
    label: '2026–2027 夏季 / 秋季学期',
    weekOne: '2026-08-24',
    end: '2027-01-15',
    examStart: '2027-01-04',
  },
  {
    id: '2026-2027-2',
    label: '2026–2027 春季学期',
    weekOne: '2027-02-22',
    end: '2027-06-25',
    examStart: '2027-06-14',
  },
];
const HOLIDAYS = [
  ['2026-09-25', '2026-09-27', '中秋节假期'],
  ['2026-10-01', '2026-10-07', '国庆节假期'],
  ['2027-01-01', '2027-01-01', '元旦假期'],
  ['2027-04-05', '2027-04-05', '清明节假期'],
  ['2027-05-01', '2027-05-02', '劳动节假期'],
  ['2027-06-09', '2027-06-09', '端午节假期'],
] as const;
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export function weekOf(date: string, weekOne: string): number {
  return Math.floor((Date.parse(date) - Date.parse(weekOne)) / 604_800_000) + 1;
}
export function weekday(date: string): number {
  return ((new Date(date).getUTCDay() + 6) % 7) + 1;
}
export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function timeLabel(value: number): string {
  const m = Math.max(0, Math.round(value));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function campusToday(now = new Date()): string {
  return formatCampusDateTime(now).slice(0, 10);
}
export function calendarStatus(date: string): {
  label: string;
  week: number | null;
  term: AcademicTerm | null;
} {
  const term = TERMS.find((t) => date >= t.weekOne && date <= t.end) ?? null;
  if (!term)
    return {
      label:
        date >= '2027-01-16' && date <= '2027-02-21'
          ? '寒假'
          : date >= '2027-06-26' && date <= '2027-08-22'
            ? '暑假'
            : '校历范围外',
      week: null,
      term,
    };
  const week = weekOf(date, term.weekOne);
  const holiday = HOLIDAYS.find(([start, end]) => date >= start && date <= end);
  return {
    label:
      holiday?.[2] ??
      (date >= term.examStart
        ? '停课考试'
        : term.id.endsWith('-1') && date < '2026-09-14'
          ? '夏季学期'
          : term.id.endsWith('-1')
            ? '秋季学期'
            : '春季学期'),
    week,
    term,
  };
}
export function suspension(date: string): string | null {
  const status = calendarStatus(date);
  return ['秋季学期', '夏季学期', '春季学期', '校历范围外'].includes(
    status.label,
  )
    ? null
    : status.label;
}
