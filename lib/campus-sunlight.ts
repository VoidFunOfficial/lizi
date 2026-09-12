import { getPosition } from 'suncalc';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type MapPoint,
  type ShadowPolygon,
  type SolarPosition,
  type SunlightContext,
  type Wgs84Point,
} from './campus-model.ts';
import { buildMapCalibration } from './map-calibration.ts';
import {
  JIANGYIN_CAMPUS_CENTER,
  JIANGYIN_GUIDE_CALIBRATION,
} from './njust-jiangyin-reference.ts';
import {
  NJUST_SOLAR_BUILDINGS,
  type SolarBuilding,
} from './njust-solar-buildings.ts';
import type { WeatherAtTime } from './xiaomi-weather.ts';

const EPSILON = 1e-10;
const WGS84_SEMI_MAJOR_AXIS = 6_378_137;
const WGS84_ECCENTRICITY_SQUARED = 0.0066943799901413165;
const CAMPUS_CALIBRATION = buildMapCalibration(
  JIANGYIN_GUIDE_CALIBRATION,
  MAP_WIDTH,
  MAP_HEIGHT,
);
const CAMPUS_DIAGONAL_METERS = Math.max(
  CAMPUS_CALIBRATION.polylineLengthMeters([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]),
  CAMPUS_CALIBRATION.polylineLengthMeters([
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ]),
);

function offsetWgs84ByMeters(
  point: Wgs84Point,
  eastMeters: number,
  northMeters: number,
): Wgs84Point {
  const latitudeRadians = (point.latitude * Math.PI) / 180;
  const sine = Math.sin(latitudeRadians);
  const denominator = Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sine * sine);
  const primeVerticalRadius = WGS84_SEMI_MAJOR_AXIS / denominator;
  const meridionalRadius =
    (WGS84_SEMI_MAJOR_AXIS * (1 - WGS84_ECCENTRICITY_SQUARED)) /
    denominator ** 3;
  return {
    latitude:
      point.latitude + (northMeters * 180) / (Math.PI * meridionalRadius),
    longitude:
      point.longitude +
      (eastMeters * 180) /
        (Math.PI * primeVerticalRadius * Math.cos(latitudeRadians)),
  };
}

function offsetMapPointByMeters(
  point: MapPoint,
  eastMeters: number,
  northMeters: number,
): MapPoint | null {
  const wgs84 = CAMPUS_CALIBRATION.imageToWgs84(point);
  return wgs84
    ? CAMPUS_CALIBRATION.wgs84ToImage(
        offsetWgs84ByMeters(wgs84, eastMeters, northMeters),
      )
    : null;
}

function cross(origin: MapPoint, first: MapPoint, second: MapPoint): number {
  return (
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x)
  );
}

function convexHull(points: MapPoint[]): MapPoint[] {
  const sorted = [...points].sort((left, right) =>
    left.x === right.x ? left.y - right.y : left.x - right.x,
  );
  const half = (source: MapPoint[]) => {
    const result: MapPoint[] = [];
    for (const point of source) {
      while (
        result.length >= 2 &&
        cross(result.at(-2)!, result.at(-1)!, point) <= EPSILON
      ) {
        result.pop();
      }
      result.push(point);
    }
    return result;
  };
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function interpolateAtAxis(
  first: MapPoint,
  second: MapPoint,
  axis: 'x' | 'y',
  value: number,
): MapPoint {
  const ratio = (value - first[axis]) / (second[axis] - first[axis]);
  return {
    x: first.x + (second.x - first.x) * ratio,
    y: first.y + (second.y - first.y) * ratio,
  };
}

function clipPolygon(
  polygon: MapPoint[],
  inside: (point: MapPoint) => boolean,
  intersect: (first: MapPoint, second: MapPoint) => MapPoint,
): MapPoint[] {
  if (polygon.length === 0) return [];
  const result: MapPoint[] = [];
  let first = polygon.at(-1)!;
  let firstInside = inside(first);
  for (const second of polygon) {
    const secondInside = inside(second);
    if (secondInside !== firstInside) result.push(intersect(first, second));
    if (secondInside) result.push(second);
    first = second;
    firstInside = secondInside;
  }
  return result;
}

function clipToCampus(polygon: MapPoint[]): MapPoint[] {
  let result = polygon;
  result = clipPolygon(
    result,
    (point) => point.x >= 0,
    (first, second) => interpolateAtAxis(first, second, 'x', 0),
  );
  result = clipPolygon(
    result,
    (point) => point.x <= 1,
    (first, second) => interpolateAtAxis(first, second, 'x', 1),
  );
  result = clipPolygon(
    result,
    (point) => point.y >= 0,
    (first, second) => interpolateAtAxis(first, second, 'y', 0),
  );
  return clipPolygon(
    result,
    (point) => point.y <= 1,
    (first, second) => interpolateAtAxis(first, second, 'y', 1),
  );
}

export function solarPositionAt(date: Date): SolarPosition {
  if (Number.isNaN(date.getTime())) throw new RangeError('太阳计算时间无效');
  const position = getPosition(
    date,
    JIANGYIN_CAMPUS_CENTER.latitude,
    JIANGYIN_CAMPUS_CENTER.longitude,
  );
  return {
    elevationDegrees: position.altitude,
    azimuthDegrees: position.azimuth,
  };
}

export function createBuildingShadowPolygons(
  position: SolarPosition,
  buildings: readonly SolarBuilding[] = NJUST_SOLAR_BUILDINGS,
): ShadowPolygon[] {
  if (position.elevationDegrees <= 0) return [];
  const elevationRadians = (position.elevationDegrees * Math.PI) / 180;
  const azimuthRadians = (position.azimuthDegrees * Math.PI) / 180;
  return buildings.flatMap((building) => {
    const physicalLength = building.heightMeters / Math.tan(elevationRadians);
    const shadowLength = Math.min(
      Number.isFinite(physicalLength)
        ? physicalLength
        : CAMPUS_DIAGONAL_METERS * 2,
      CAMPUS_DIAGONAL_METERS * 2,
    );
    const eastMeters = -Math.sin(azimuthRadians) * shadowLength;
    const northMeters = -Math.cos(azimuthRadians) * shadowLength;
    // The guide is an affine-georectified raster and the UI may scale it again.
    // Project both ends through the guide calibration so a metre on the ground
    // never gets confused with a source-image or rendered CSS pixel.
    const translated = building.footprint.flatMap((point) => {
      const translatedPoint = offsetMapPointByMeters(
        point,
        eastMeters,
        northMeters,
      );
      return translatedPoint ? [translatedPoint] : [];
    });
    if (translated.length !== building.footprint.length) return [];
    const boundary = clipToCampus(
      convexHull([...building.footprint, ...translated]),
    );
    return boundary.length >= 3 ? [{ buildingId: building.id, boundary }] : [];
  });
}

export function createCampusSunlightContext(options: {
  departureTime: Date;
  weather: WeatherAtTime | null;
  basemapSupported: boolean;
  buildings?: readonly SolarBuilding[];
}): SunlightContext {
  const departureTime = options.departureTime.toISOString();
  if (!options.basemapSupported) {
    return {
      status: 'inactive',
      departureTime,
      reason: 'unsupported-basemap',
    };
  }
  if (!options.weather) {
    return {
      status: 'inactive',
      departureTime,
      reason: 'weather-unavailable',
    };
  }
  if (options.weather.status === 'unavailable') {
    return {
      status: 'inactive',
      departureTime,
      reason: options.weather.reason,
    };
  }
  if (options.weather.weatherCode !== 0) {
    return {
      status: 'inactive',
      departureTime,
      reason: 'not-sunny',
      weatherAt: options.weather.at,
      weatherSource: options.weather.source,
      weatherCode: options.weather.weatherCode,
    };
  }
  const position = solarPositionAt(options.departureTime);
  if (position.elevationDegrees <= 0) {
    return {
      status: 'inactive',
      departureTime,
      reason: 'sun-below-horizon',
      weatherAt: options.weather.at,
      weatherSource: options.weather.source,
      weatherCode: options.weather.weatherCode,
    };
  }
  return {
    status: 'active',
    departureTime,
    weatherAt: options.weather.at,
    weatherSource: options.weather.source,
    weatherCode: 0,
    position,
    shadowPolygons: createBuildingShadowPolygons(position, options.buildings),
  };
}

function onPolygonBoundary(point: MapPoint, polygon: readonly MapPoint[]) {
  return polygon.some((first, index) => {
    const second = polygon[(index + 1) % polygon.length];
    const area = Math.abs(cross(first, second, point));
    if (area > EPSILON) return false;
    return (
      point.x >= Math.min(first.x, second.x) - EPSILON &&
      point.x <= Math.max(first.x, second.x) + EPSILON &&
      point.y >= Math.min(first.y, second.y) - EPSILON &&
      point.y <= Math.max(first.y, second.y) + EPSILON
    );
  });
}

function contains(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  if (onPolygonBoundary(point, polygon)) return true;
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const first = polygon[current];
    const second = polygon[previous];
    if (
      first.y > point.y !== second.y > point.y &&
      point.x <
        ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) +
          first.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentIntersectionParameter(
  first: MapPoint,
  second: MapPoint,
  edgeFirst: MapPoint,
  edgeSecond: MapPoint,
): number | null {
  const segment = { x: second.x - first.x, y: second.y - first.y };
  const edge = {
    x: edgeSecond.x - edgeFirst.x,
    y: edgeSecond.y - edgeFirst.y,
  };
  const denominator = segment.x * edge.y - segment.y * edge.x;
  if (Math.abs(denominator) <= EPSILON) return null;
  const offset = { x: edgeFirst.x - first.x, y: edgeFirst.y - first.y };
  const ratio = (offset.x * edge.y - offset.y * edge.x) / denominator;
  const edgeRatio = (offset.x * segment.y - offset.y * segment.x) / denominator;
  return ratio >= -EPSILON &&
    ratio <= 1 + EPSILON &&
    edgeRatio >= -EPSILON &&
    edgeRatio <= 1 + EPSILON
    ? Math.max(0, Math.min(1, ratio))
    : null;
}

export type ShadowCoverage = {
  totalLength: number;
  shadowedLength: number;
  ratio: number;
};

export function shadowCoverageForPolyline(
  points: readonly MapPoint[],
  polygons: readonly (readonly MapPoint[])[],
  measureSegment: (first: MapPoint, second: MapPoint) => number = (
    first,
    second,
  ) => Math.hypot(second.x - first.x, second.y - first.y),
): ShadowCoverage {
  let totalLength = 0;
  let shadowedLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1];
    const second = points[index];
    const length = measureSegment(first, second);
    if (!Number.isFinite(length) || length <= EPSILON) continue;
    totalLength += length;
    const ratios = [0, 1];
    for (const polygon of polygons) {
      polygon.forEach((edgeFirst, edgeIndex) => {
        const ratio = segmentIntersectionParameter(
          first,
          second,
          edgeFirst,
          polygon[(edgeIndex + 1) % polygon.length],
        );
        if (ratio !== null) ratios.push(ratio);
      });
    }
    ratios.sort((left, right) => left - right);
    const unique = ratios.filter(
      (ratio, ratioIndex) =>
        ratioIndex === 0 || Math.abs(ratio - ratios[ratioIndex - 1]) > EPSILON,
    );
    for (let ratioIndex = 1; ratioIndex < unique.length; ratioIndex += 1) {
      const start = unique[ratioIndex - 1];
      const end = unique[ratioIndex];
      const midpoint = (start + end) / 2;
      const point = {
        x: first.x + (second.x - first.x) * midpoint,
        y: first.y + (second.y - first.y) * midpoint,
      };
      if (polygons.some((polygon) => contains(point, polygon))) {
        shadowedLength += length * (end - start);
      }
    }
  }
  return {
    totalLength,
    shadowedLength,
    ratio: totalLength > 0 ? shadowedLength / totalLength : 0,
  };
}
