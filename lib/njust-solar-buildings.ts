import type { MapPoint, SolarBuilding } from './campus-model.ts';
export type { SolarBuilding } from './campus-model.ts';

// Buildings are authored in the active map and saved with the campus document.
// The former 27-building preset has been removed.
export const NJUST_SOLAR_BUILDINGS: readonly SolarBuilding[] = [];

export function rectangleFootprint(
  first: MapPoint,
  second: MapPoint,
): MapPoint[] {
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}
