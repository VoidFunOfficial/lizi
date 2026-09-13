import type { CampusNavigator } from '../campus-navigator.ts';
import type { CampusRoute, Place } from '../campus-model.ts';
import { minutes, timeLabel } from './calendar.ts';
import { allowedPersonalPlaces } from './places.ts';
import {
  courseTime,
  isOnline,
  type Course,
  type DaySchedule,
} from './timetable.ts';

export type PlannerPreferences = {
  homeId: string;
  diningIds: string[];
  locationBindings: Record<string, string>;
  meals: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  mealMinutes: number;
  arrivalBuffer: number;
};
export const DEFAULT_PREFERENCES: PlannerPreferences = {
  homeId: '',
  diningIds: [],
  locationBindings: {},
  meals: true,
  breakfast: '07:10',
  lunch: '12:15',
  dinner: '18:15',
  mealMinutes: 30,
  arrivalBuffer: 10,
};
export type PlanStop = {
  id: string;
  kind: 'course' | 'meal' | 'home';
  title: string;
  detail: string;
  start: number;
  end: number;
  place: Place | null;
  online?: boolean;
  warnings: string[];
};
export type PlanLeg = {
  id: string;
  from: string;
  to: string;
  departure: number;
  arrival: number;
  route: CampusRoute | null;
  message: string;
  destinationId: string;
};
export type DailyPlan = {
  stops: PlanStop[];
  legs: PlanLeg[];
  warnings: string[];
};

function normalizedLocation(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/江阴校区|江阴|南京理工大学|教学楼|教室|\s|[-－]/g, '')
    .toUpperCase()
    .replace(/楼(?=[A-Z]|$)/g, '');
}

// The timetable and the annotated campus map use these different venue names.
const COURSE_VENUE_ALIASES: Record<string, string> = {
  国际会议中心: '国际学术交流中心',
  运动场东跑道: '体育场',
};

export function resolveCoursePlace(
  course: Course,
  places: Place[],
  bindings: Record<string, string>,
): Place | null {
  if (!course.location || isOnline(course)) return null;
  const manuallyBound = places.find((p) => p.id === bindings[course.location]);
  if (manuallyBound) return manuallyBound;
  const room = normalizedLocation(course.location);
  const building = room.match(/^(.*?)(\d{2,4}[A-Z]?)$/)?.[1];
  // Prefer an exact room, then its A/B/C block, then an annotation for the whole building.
  // Never substitute a different block, or a similarly spelled building.
  const candidates = [room, building, building?.replace(/[A-Z]$/, '')].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of new Set(candidates)) {
    const matches = places.filter(
      (p) => normalizedLocation(p.name) === candidate,
    );
    if (matches.length) return matches.length === 1 ? matches[0] : null;
    const alias = COURSE_VENUE_ALIASES[candidate];
    if (alias) {
      const aliased = places.filter(
        (p) => normalizedLocation(p.name) === alias,
      );
      if (aliased.length) return aliased.length === 1 ? aliased[0] : null;
    }
  }
  return null;
}

export function createDailyPlan(
  day: DaySchedule,
  date: string,
  places: Place[],
  navigator: CampusNavigator,
  preferences: PlannerPreferences,
): DailyPlan {
  preferences = allowedPersonalPlaces(preferences, places);
  const home = places.find((p) => p.id === preferences.homeId) ?? null;
  const dining = preferences.diningIds
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is Place => Boolean(p));
  const warnings: string[] = [];
  const cache = new Map<string, CampusRoute | null>();
  const routeAt = (
    from: Place | null,
    to: Place | null,
    departure: number,
  ): CampusRoute | null => {
    if (!from || !to || departure < 0 || departure >= 1440) return null;
    const origin = navigator.resolvePlaceEndpoint(from.name);
    const destination = navigator.resolvePlaceEndpoint(to.name);
    if (!origin || !destination) return null;
    const key = `${from.id}:${to.id}:${Math.round(departure)}`;
    if (!cache.has(key))
      cache.set(
        key,
        navigator.route({
          origin,
          destination,
          profile: 'fastest',
          departureTime: new Date(`${date}T${timeLabel(departure)}:00+08:00`),
          audience: 'campus',
        }),
      );
    return cache.get(key) ?? null;
  };
  const travel = (from: Place | null, to: Place | null, departure: number) => {
    if (from && to && from.id === to.id) return 0;
    const route = routeAt(from, to, departure);
    return route ? Math.ceil(route.metrics.estimatedSeconds / 60) : null;
  };
  if (!home) warnings.push('先在「我的」设置寝室，才能安排上下学路线。');
  if (day.activities.length)
    warnings.push(
      '今天有全周安排，具体时间未提供；请以学院通知为准，餐食安排需自行核对。',
    );
  const stops: PlanStop[] = day.courses.map((course) => {
    const { start, end } = courseTime(course);
    const online = isOnline(course);
    const place = resolveCoursePlace(
      course,
      places,
      preferences.locationBindings,
    );
    return {
      id: course.id,
      kind: 'course',
      title: course.name,
      detail: course.location || '教室待公布',
      start,
      end,
      place,
      online,
      warnings:
        !online && !place
          ? [
              course.location
                ? '请在「我的」对应教室地点'
                : '上课地点待公布，暂不能规划这段路线',
            ]
          : [],
    };
  });
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].start < stops[i - 1].end) {
      stops[i].warnings.push(`与「${stops[i - 1].title}」时间重叠，请核对课表`);
      stops[i - 1].warnings.push('存在课程时间冲突');
    }
  }
  const lastPhysical = (events: PlanStop[]): Place | null => {
    const last = events
      .filter((stop) => !stop.online && !(stop.kind === 'meal' && !stop.place))
      .at(-1);
    return last ? last.place : home;
  };
  if (preferences.meals) {
    const meals = [
      {
        title: '早餐',
        preferred: minutes(preferences.breakfast),
        low: 6 * 60 + 30,
        high: 10 * 60,
      },
      {
        title: '午餐',
        preferred: minutes(preferences.lunch),
        low: 11 * 60,
        high: 14 * 60,
      },
      {
        title: '晚餐',
        preferred: minutes(preferences.dinner),
        low: 17 * 60,
        high: 21 * 60,
      },
    ];
    if (!dining.length)
      warnings.push('在「我的」选择常去的食堂，可自动比较顺路的用餐地点。');
    for (const meal of meals) {
      let best: {
        start: number;
        place: Place | null;
        score: number;
        uncertain: boolean;
        returnMinutes: number | null;
      } | null = null;
      for (let i = 0; i <= stops.length; i++) {
        const previous = stops[i - 1];
        const next = stops[i];
        const from = lastPhysical(stops.slice(0, i));
        const to = next ? (next.online ? null : next.place) : home;
        const gapStart = Math.max(previous?.end ?? 0, meal.low);
        const gapEnd = Math.min(next?.start ?? 1440, meal.high);
        if (gapEnd - gapStart < preferences.mealMinutes) continue;
        for (const place of dining.length ? dining : [null]) {
          const before = travel(from, place, gapStart);
          if (from && place && before === null) continue;
          const earliest = gapStart + (before ?? 0);
          let start = Math.max(
            earliest,
            Math.min(meal.preferred, gapEnd - preferences.mealMinutes),
          );
          const buffer =
            next?.kind === 'course' ? preferences.arrivalBuffer : 0;
          // Every meal includes a trip home before the next event. Reserve both
          // legs when choosing its time and venue, rather than adding a detour later.
          let back: number | null = null;
          let onward: number | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            back = travel(place, home, start + preferences.mealMinutes);
            onward = next
              ? travel(home, to, start + preferences.mealMinutes + (back ?? 0))
              : 0;
            const latest =
              gapEnd -
              preferences.mealMinutes -
              (back ?? 0) -
              (onward ?? 0) -
              buffer;
            if (start <= latest || latest < earliest) break;
            start = latest;
          }
          if (
            (place && home && back === null) ||
            (next && home && to && onward === null)
          )
            continue;
          if (
            start +
              preferences.mealMinutes +
              (back ?? 0) +
              (onward ?? 0) +
              buffer >
            gapEnd
          )
            continue;
          const uncertain =
            !place || !from || !home || Boolean(next && !next.online && !to);
          const score =
            (before ?? 0) +
            (back ?? 0) +
            (onward ?? 0) +
            Math.abs(start - meal.preferred) * 0.2;
          if (!best || score < best.score)
            best = { start, place, score, uncertain, returnMinutes: back };
        }
      }
      if (best) {
        stops.push({
          id: `meal-${meal.title}`,
          kind: 'meal',
          title: meal.title,
          detail: best.place?.name ?? '待选择食堂',
          start: best.start,
          end: best.start + preferences.mealMinutes,
          place: best.place,
          warnings: best.uncertain
            ? ['地点未完善，用餐时间暂未计入完整步行时间']
            : [],
        });
        const homeArrival =
          best.start + preferences.mealMinutes + (best.returnMinutes ?? 0);
        stops.push({
          id: `return-home-${meal.title}`,
          kind: 'home',
          title: `${meal.title}后回寝室`,
          detail: home?.name ?? '请设置寝室',
          start: homeArrival,
          end: homeArrival,
          place: home,
          warnings: best.returnMinutes === null ? ['返程时间待确认'] : [],
        });
        stops.sort((a, b) => a.start - b.start);
      } else
        warnings.push(
          `${meal.title}时段没有足够的空闲或可达路线，请自行调整用餐时间。`,
        );
    }
  }
  // Return home after the final event. No invented walking duration for unknown endpoints.
  if (stops.length && home && lastPhysical(stops)?.id !== home.id) {
    const last = stops.at(-1)!;
    const from = lastPhysical(stops);
    const duration = travel(from, home, last.end);
    stops.push({
      id: 'return-home',
      kind: 'home',
      title: '返回住处',
      detail: home.name,
      start: last.end + (duration ?? 0),
      end: last.end + (duration ?? 0),
      place: home,
      warnings: duration === null ? ['返程时间待确认'] : [],
    });
  }
  const legs: PlanLeg[] = [];
  let from = home;
  let available = 0;
  for (const stop of stops) {
    // Unknown meal locations cannot produce a walking route home. The explicit
    // home stop restores a known origin for the next scheduled trip.
    if (stop.online || (stop.kind === 'meal' && !stop.place)) {
      if (!stop.online) from = null;
      available = Math.max(available, stop.end);
      continue;
    }
    const target =
      stop.start - (stop.kind === 'course' ? preferences.arrivalBuffer : 0);
    let departure = Math.max(available, target);
    let route: CampusRoute | null = null;
    if (from && stop.place && from.id !== stop.place.id) {
      for (let attempt = 0; attempt < 3; attempt++) {
        route = routeAt(from, stop.place, departure);
        if (!route) break;
        const nextDeparture = Math.max(
          available,
          target - Math.ceil(route.metrics.estimatedSeconds / 60),
        );
        if (nextDeparture === departure) break;
        departure = nextDeparture;
      }
      route = routeAt(from, stop.place, departure);
    }
    const same = Boolean(from && stop.place && from.id === stop.place.id);
    const arrival =
      departure + (route ? Math.ceil(route.metrics.estimatedSeconds / 60) : 0);
    const message =
      !from || !stop.place
        ? '地点未确定，路线待完善'
        : same
          ? '同一地点，无需步行'
          : !route
            ? '该时刻没有可达的步行路线'
            : arrival > stop.start
              ? '步行时间不足，可能迟到'
              : arrival > target
                ? '可到达，但预留时间不足'
                : '';
    legs.push({
      id: `leg-${stop.id}`,
      from: from?.name ?? '待确定起点',
      to: stop.place?.name ?? stop.detail,
      departure,
      arrival,
      route,
      message,
      destinationId: stop.id,
    });
    if (message && route) stop.warnings.push(message);
    from = stop.place;
    available = Math.max(available, stop.end, route ? arrival : 0);
  }
  return { stops, legs, warnings };
}
