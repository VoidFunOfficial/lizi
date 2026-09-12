import type { BuiltMapCalibration } from './map-calibration.ts';

export type HeadingStatus =
  | 'initializing'
  | 'ready'
  | 'low'
  | 'unreliable'
  | 'tilted'
  | 'paused'
  | 'unavailable'
  | 'stale';

export type HeadingReading = {
  status: HeadingStatus;
  magneticHeading?: number;
  trueHeading?: number;
  timestamp?: number;
};

export const normalizeHeading = (degrees: number) =>
  ((degrees % 360) + 360) % 360;

export function smoothHeading(previous: number | null, next: number): number {
  if (previous === null) return normalizeHeading(next);
  const delta = normalizeHeading(next - previous + 180) - 180;
  return normalizeHeading(previous + delta * 0.35);
}

export function headingLabel(degrees: number): string {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return `${directions[Math.round(normalizeHeading(degrees) / 45) % 8]} ${Math.round(normalizeHeading(degrees)) % 360}°`;
}

// Project a short true-north bearing through the map's actual calibration.
// This also handles rotated / non-uniformly scaled campus maps.
export function headingOnMap(
  calibration: BuiltMapCalibration,
  location: { latitude: number; longitude: number },
  degrees: number,
  width: number,
  height: number,
): number | null {
  if (!Number.isFinite(degrees)) return null;
  const bearing = (degrees * Math.PI) / 180;
  const latitudeRadians = (location.latitude * Math.PI) / 180;
  const start = calibration.wgs84ToImage(location);
  const end = calibration.wgs84ToImage({
    latitude: location.latitude + (Math.cos(bearing) * 20) / 111_320,
    longitude:
      location.longitude +
      (Math.sin(bearing) * 20) / (111_320 * Math.cos(latitudeRadians)),
  });
  if (!start || !end) return null;
  const dx = (end.x - start.x) * width;
  const dy = (end.y - start.y) * height;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 1e-8)
    return null;
  return normalizeHeading((Math.atan2(dx, -dy) * 180) / Math.PI);
}
