import type { DailyPlan, PlanLeg } from './planner.ts';
import { pointDistancePixels, type RoutePoint } from '../campus-model.ts';

// Interpolate by map distance so short edges do not consume as much time as long ones.
export function routePreviewPoint(
  points: RoutePoint[],
  progress: number,
): RoutePoint | null {
  if (!points.length) return null;
  const lengths = points
    .slice(1)
    .map((point, index) => pointDistancePixels(points[index], point));
  let remaining =
    lengths.reduce((sum, length) => sum + length, 0) *
    Math.max(0, Math.min(1, progress));
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (remaining <= length && length > 0) {
      const from = points[index];
      const to = points[index + 1];
      const fraction = remaining / length;
      // A floor transition is a jump, never an invented line across floors.
      if (from.levelId !== to.levelId) return fraction < 1 ? from : to;
      return {
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        levelId: from.levelId,
      };
    }
    remaining -= length;
  }
  return points.at(-1)!;
}

// Keep non-walking events in the tour so meals, online classes and unknown
// venues remain visible instead of silently disappearing from the day.
export type PreviewLeg = PlanLeg & { stopTitle?: string; needsRoute?: boolean };
export function dailyPreviewLegs(plan: DailyPlan): PreviewLeg[] {
  return plan.stops.map((stop) => {
    const leg = plan.legs.find((item) => item.destinationId === stop.id);
    if (leg)
      return {
        ...leg,
        stopTitle: stop.title,
        needsRoute: leg.message !== '同一地点，无需步行',
      };
    return {
      id: `preview-${stop.id}`,
      destinationId: stop.id,
      from: stop.title,
      to: stop.detail,
      stopTitle: stop.title,
      departure: stop.start,
      arrival: stop.end,
      route: null,
      message: stop.online ? '线上安排，无需步行' : '地点待确定',
      needsRoute: !stop.online,
    };
  });
}
