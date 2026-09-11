import {
  BIG_PERIODS,
  PERIODS,
  minutes,
  suspension,
  weekOf,
  weekday,
  type AcademicTerm,
} from './calendar.ts';

export type Course = {
  id: string;
  name: string;
  teacher: string;
  location: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  weeks: number[];
  weekText: string;
};
export type Timetable = {
  student: string;
  className: string;
  college: string;
  termId: string;
  courses: Course[];
  activities: { name: string; weeks: number[]; detail: string }[];
  warnings: string[];
};
export type DaySchedule = {
  courses: Course[];
  activities: Timetable['activities'];
  week: number;
  reason: string | null;
  referenceDate: string;
};

export function parseWeeks(raw: string): number[] {
  const parity = /单/.test(raw) ? 1 : /双/.test(raw) ? 0 : null;
  const normalized = raw
    .replace(/[[\]【】()（）周单双\s]/g, '')
    .replace(/[，、；;]/g, ',')
    .replace(/[~～—–至]/g, '-');
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(normalized))
    throw new Error(`无法识别周次：${raw}`);
  const result = new Set<number>();
  for (const part of normalized.split(',')) {
    const [start, last] = part.split('-').map(Number);
    const end = last ?? start;
    if (start < 1 || end > 53 || end < start)
      throw new Error(`周次超出范围：${raw}`);
    for (let week = start; week <= end; week++)
      if (parity === null || week % 2 === parity) result.add(week);
  }
  if (!result.size) throw new Error(`周次为空：${raw}`);
  return [...result].sort((a, b) => a - b);
}

export function parseTimetableRows(
  sheets: { name: string; rows: unknown[][] }[],
): Timetable {
  const result: Timetable = {
    student: '',
    className: '',
    college: '',
    termId: '',
    courses: [],
    activities: [],
    warnings: [],
  };
  const seen = new Set<string>();
  for (const sheet of sheets) {
    const rows = sheet.rows.map((row) =>
      row.map((cell) =>
        typeof cell === 'string' || typeof cell === 'number'
          ? String(cell).trim()
          : '',
      ),
    );
    const all = rows.flat().join('\n');
    result.student ||=
      all.match(/南京理工大学\s*(.*?)\s*学生个人课表/)?.[1] ?? '';
    result.termId ||= all.match(/学年学期[：:]\s*(\d{4}-\d{4}-\d)/)?.[1] ?? '';
    result.className ||= all.match(/(?:^|\s)班级[：:]\s*(\S+)/)?.[1] ?? '';
    result.college ||= all.match(/学院[：:]\s*(\S+)/)?.[1] ?? '';
    const header = rows.findIndex((row) =>
      row.some((cell) => /^(星期|周)一$/.test(cell)),
    );
    if (header < 0) continue;
    const columns = rows[header].map((cell) =>
      /^(星期|周)[一二三四五六日天]$/.test(cell)
        ? '一二三四五六日'.indexOf(
            cell.replace(/^(星期|周)/, '').replace('天', '日'),
          ) + 1
        : 0,
    );
    for (let r = header + 1; r < rows.length; r++) {
      const row = rows[r];
      const block = row[0]?.match(/第([一二三四五])大节/);
      if (!block) {
        if (row.includes('全周')) {
          const index = row.indexOf('全周');
          const expression = row[index + 1]?.match(
            /[\d,，、\-~～]+周(?:[（(][单双][）)])?/,
          );
          if (expression) {
            try {
              result.activities.push({
                name: row[index - 1] || '全周安排',
                weeks: parseWeeks(expression[0]),
                detail: row
                  .slice(index + 1)
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(' · '),
              });
            } catch {
              result.warnings.push(
                `第 ${r + 1} 行全周安排的周次未识别，请核对原表。`,
              );
            }
          }
        }
        continue;
      }
      const [startPeriod, endPeriod] =
        BIG_PERIODS['一二三四五'.indexOf(block[1])];
      for (let c = 1; c < row.length; c++) {
        if (!columns[c] || !row[c]) continue;
        const lines = row[c]
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        const weekIndices = lines.flatMap((line, i) =>
          /\d.*(?:\[周\]|【周】|周)/.test(line) ? [i] : [],
        );
        if (!weekIndices.length) {
          result.warnings.push(
            `${sheet.name} 第 ${r + 1} 行第 ${c + 1} 列未识别，请核对原表。`,
          );
          continue;
        }
        weekIndices.forEach((i, index) => {
          const name = lines[i - 2];
          const teacher = lines[i - 1];
          const next = weekIndices[index + 1];
          const tail = next === undefined ? lines.length : next - 2;
          const location = lines.slice(i + 1, tail).join(' ');
          try {
            if (!name || !teacher) throw new Error('课程名称或教师字段不完整');
            const weeks = parseWeeks(lines[i]);
            const key = JSON.stringify([
              name,
              teacher,
              location,
              columns[c],
              startPeriod,
              endPeriod,
              weeks,
            ]);
            if (seen.has(key)) return;
            seen.add(key);
            result.courses.push({
              id: `course-${result.courses.length + 1}`,
              name,
              teacher,
              location,
              weekday: columns[c],
              startPeriod,
              endPeriod,
              weeks,
              weekText: lines[i],
            });
          } catch (error) {
            result.warnings.push(
              `${name || '课程'}：${error instanceof Error ? error.message : '解析失败'}`,
            );
          }
        });
      }
    }
  }
  if (!result.courses.length)
    throw new Error(
      '没有识别到课程。请上传教务系统导出的学生个人课表（星期一至日 × 第一至第五大节）。',
    );
  return result;
}

export function courseTime(course: Course): { start: number; end: number } {
  return {
    start: minutes(PERIODS[course.startPeriod - 1][0]),
    end: minutes(PERIODS[course.endPeriod - 1][1]),
  };
}
export function isOnline(course: Course): boolean {
  return /线上|在线|网络|网课/.test(course.location);
}

// An override maps the actual date to the teaching date it follows; null explicitly suspends that day.
export function scheduleForDate(
  table: Timetable,
  term: AcademicTerm,
  date: string,
  overrides: Record<string, string | null> = {},
): DaySchedule {
  const hasOverride = Object.hasOwn(overrides, date);
  const referenceDate = hasOverride ? (overrides[date] ?? date) : date;
  const week = weekOf(referenceDate, term.weekOne);
  const reason =
    hasOverride && overrides[date] === null
      ? '当天停课'
      : date < term.weekOne ||
          date > term.end ||
          referenceDate < term.weekOne ||
          referenceDate > term.end
        ? '不在已导入课表的学期内'
        : !hasOverride
          ? suspension(date)
          : null;
  return {
    week,
    reason,
    referenceDate,
    courses: reason
      ? []
      : table.courses
          .filter(
            (course) =>
              course.weekday === weekday(referenceDate) &&
              course.weeks.includes(week),
          )
          .sort((a, b) => a.startPeriod - b.startPeriod),
    activities: reason
      ? []
      : table.activities.filter((activity) => activity.weeks.includes(week)),
  };
}
