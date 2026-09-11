export const CAMPUS_TIME_ZONE = 'Asia/Shanghai';

const CAMPUS_UTC_OFFSET_HOURS = 8;
const HOUR_MILLISECONDS = 60 * 60 * 1_000;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type CampusClock = {
  day: number;
  minutes: number;
};

export function formatCampusDateTime(date = new Date()): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('时间无效');
  return new Date(date.getTime() + CAMPUS_UTC_OFFSET_HOURS * HOUR_MILLISECONDS)
    .toISOString()
    .slice(0, 16);
}

export function parseCampusDateTime(value: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  const instant = new Date(`${value}:00+08:00`);
  if (Number.isNaN(instant.getTime())) return null;
  return formatCampusDateTime(instant) === value ? instant : null;
}

export function campusClock(date: Date): CampusClock {
  if (Number.isNaN(date.getTime())) throw new RangeError('时间无效');
  const shifted = new Date(
    date.getTime() + CAMPUS_UTC_OFFSET_HOURS * HOUR_MILLISECONDS,
  );
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function startOfCampusHour(date: Date): number {
  if (Number.isNaN(date.getTime())) throw new RangeError('时间无效');
  const shifted = date.getTime() + CAMPUS_UTC_OFFSET_HOURS * HOUR_MILLISECONDS;
  return (
    Math.floor(shifted / HOUR_MILLISECONDS) * HOUR_MILLISECONDS -
    CAMPUS_UTC_OFFSET_HOURS * HOUR_MILLISECONDS
  );
}

export { HOUR_MILLISECONDS };
