import type { Wgs84Point } from './campus-model.ts';

export type GeographicPoint = {
  latitude: number;
  longitude: number;
};

export type Bd09McPoint = { x: number; y: number };

export type ParsedBaiduMapUrl = {
  sourceUrl: string;
  sourceCrs: 'BD09MC';
  center: Bd09McPoint & { zoom: number };
  mapType?: string;
};

const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;
const GCJ_SEMI_MAJOR_AXIS = 6_378_245;
const GCJ_ECCENTRICITY_SQUARED = 0.006693421622965943;
const BAIDU_X_PI = (Math.PI * 3000) / 180;

// These bands and polynomial coefficients are the values used by Baidu's
// public Web map projection code for converting BD09MC to BD09 latitude and
// longitude. Keep them as data so the selected latitude band is auditable.
const BAIDU_MC_BANDS = [
  12_890_594.86, 8_362_377.87, 5_591_021, 3_481_989.83, 1_678_043.12, 0,
] as const;

const BAIDU_MC_TO_LL = [
  [
    1.410526172116255e-8, 0.00000898305509648872, -1.9939833816331,
    200.9824383106796, -187.2403703815547, 91.6087516669843, -23.38765649603339,
    2.57121317296198, -0.03801003308653, 17_337_981.2,
  ],
  [
    -7.435856389565537e-9, 0.000008983055097726239, -0.78625201886289,
    96.32687599759846, -1.85204757529826, -59.36935905485877, 47.40033549296737,
    -16.50741931063887, 2.28786674699375, 10_260_144.86,
  ],
  [
    -3.030883460898826e-8, 0.00000898305509983578, 0.30071316287616,
    59.74293618442277, 7.357984074871, -25.38371002664745, 13.45380521110908,
    -3.29883767235584, 0.32710905363475, 6_856_817.37,
  ],
  [
    -1.981981304930552e-8, 0.000008983055099779535, 0.03278182852591,
    40.31678527705744, 0.65659298677277, -4.44255534477492, 0.85341911805263,
    0.12923347998204, -0.04625736007561, 4_482_777.06,
  ],
  [
    3.09191371068437e-9, 0.000008983055096812155, 0.00006995724062,
    23.10934304144901, -0.00023663490511, -0.6321817810242, -0.00663494467273,
    0.03430082397953, -0.00466043876332, 2_555_164.4,
  ],
  [
    2.890871144776878e-9, 0.000008983055095805407, -3.068298e-8,
    7.47137025468032, -0.00000353937994, -0.02145144861037, -0.00001234426596,
    0.00010322952773, -0.00000323890364, 826_088.5,
  ],
] as const;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
}

function assertGeographicPoint(point: GeographicPoint, label: string): void {
  assertFinite(point.latitude, `${label}.latitude`);
  assertFinite(point.longitude, `${label}.longitude`);
  if (point.latitude < -90 || point.latitude > 90) {
    throw new RangeError(`${label}.latitude must be between -90 and 90`);
  }
  if (point.longitude < -180 || point.longitude > 180) {
    throw new RangeError(`${label}.longitude must be between -180 and 180`);
  }
}

export function parseBaiduMapUrl(rawUrl: string): ParsedBaiduMapUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('百度地图链接无效');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('百度地图链接必须使用 HTTP 或 HTTPS');
  }
  const hostname = url.hostname.toLocaleLowerCase('en-US');
  if (hostname !== 'map.baidu.com' && !hostname.endsWith('.map.baidu.com')) {
    throw new Error('链接不是百度地图地址');
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    throw new Error('百度地图链接包含无效转义字符');
  }
  const centerMatch = decoded.match(
    /@(-?(?:\d+(?:\.\d+)?|\.\d+)),(-?(?:\d+(?:\.\d+)?|\.\d+)),((?:\d+(?:\.\d+)?|\.\d+))z(?:\/|$|[?#])/,
  );
  if (!centerMatch) throw new Error('百度地图链接缺少 @x,y,zoomz 视图参数');
  const x = Number(centerMatch[1]);
  const y = Number(centerMatch[2]);
  const zoom = Number(centerMatch[3]);
  assertFinite(x, '百度地图中心 x');
  assertFinite(y, '百度地图中心 y');
  assertFinite(zoom, '百度地图缩放级别');
  if (zoom <= 0 || zoom > 30) throw new RangeError('百度地图缩放级别无效');

  const mapTypeMatch = decoded.match(/(?:^|[/?&#])maptype=([^/?&#]+)/i);
  return {
    sourceUrl: url.toString(),
    sourceCrs: 'BD09MC',
    center: { x, y, zoom },
    mapType: mapTypeMatch?.[1],
  };
}

export function bd09McToBd09(point: Bd09McPoint): GeographicPoint {
  assertFinite(point.x, 'BD09MC.x');
  assertFinite(point.y, 'BD09MC.y');
  const absoluteY = Math.abs(point.y);
  let coefficients = BAIDU_MC_TO_LL.at(-1) as (typeof BAIDU_MC_TO_LL)[number];
  for (let index = 0; index < BAIDU_MC_BANDS.length; index += 1) {
    if (absoluteY >= BAIDU_MC_BANDS[index]) {
      coefficients = BAIDU_MC_TO_LL[index];
      break;
    }
  }

  const longitudeMagnitude =
    coefficients[0] + coefficients[1] * Math.abs(point.x);
  const ratio = absoluteY / coefficients[9];
  let latitudeMagnitude = coefficients[2] + coefficients[3] * ratio;
  let power = ratio * ratio;
  for (let index = 4; index <= 8; index += 1) {
    latitudeMagnitude += coefficients[index] * power;
    power *= ratio;
  }
  return {
    longitude: Math.sign(point.x || 1) * longitudeMagnitude,
    latitude: Math.sign(point.y || 1) * latitudeMagnitude,
  };
}

// Alias with the provider's all-caps CRS spelling for callers that prefer it.
export const bd09mcToBd09 = bd09McToBd09;

export function bd09ToGcj02(point: GeographicPoint): GeographicPoint {
  assertGeographicPoint(point, 'BD09');
  const x = point.longitude - 0.0065;
  const y = point.latitude - 0.006;
  const radius = Math.hypot(x, y) - 0.00002 * Math.sin(y * BAIDU_X_PI);
  const angle = Math.atan2(y, x) - 0.000003 * Math.cos(x * BAIDU_X_PI);
  return {
    longitude: radius * Math.cos(angle),
    latitude: radius * Math.sin(angle),
  };
}

function outsideMainlandChina(point: GeographicPoint): boolean {
  return (
    point.longitude < 72.004 ||
    point.longitude > 137.8347 ||
    point.latitude < 0.8293 ||
    point.latitude > 55.8271
  );
}

function latitudeOffset(x: number, y: number): number {
  let result =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  result +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result +=
    ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  result +=
    ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) *
      2) /
    3;
  return result;
}

function longitudeOffset(x: number, y: number): number {
  let result =
    300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result +=
    ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result +=
    ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  result +=
    ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) *
      2) /
    3;
  return result;
}

export function wgs84ToGcj02(point: GeographicPoint): GeographicPoint {
  assertGeographicPoint(point, 'WGS84');
  if (outsideMainlandChina(point)) return { ...point };

  let deltaLatitude = latitudeOffset(
    point.longitude - 105,
    point.latitude - 35,
  );
  let deltaLongitude = longitudeOffset(
    point.longitude - 105,
    point.latitude - 35,
  );
  const latitudeRadians = (point.latitude / 180) * Math.PI;
  let magic = Math.sin(latitudeRadians);
  magic = 1 - GCJ_ECCENTRICITY_SQUARED * magic * magic;
  const squareRootMagic = Math.sqrt(magic);
  deltaLatitude =
    (deltaLatitude * 180) /
    (((GCJ_SEMI_MAJOR_AXIS * (1 - GCJ_ECCENTRICITY_SQUARED)) /
      (magic * squareRootMagic)) *
      Math.PI);
  deltaLongitude =
    (deltaLongitude * 180) /
    ((GCJ_SEMI_MAJOR_AXIS / squareRootMagic) *
      Math.cos(latitudeRadians) *
      Math.PI);
  return {
    latitude: point.latitude + deltaLatitude,
    longitude: point.longitude + deltaLongitude,
  };
}

/**
 * Common one-step inverse approximation for GCJ-02. This is not an official
 * surveyed WGS-84 transformation.
 */
export function gcj02ToWgs84(point: GeographicPoint): Wgs84Point {
  assertGeographicPoint(point, 'GCJ02');
  if (outsideMainlandChina(point)) return { ...point };
  const projected = wgs84ToGcj02(point);
  return {
    latitude: point.latitude * 2 - projected.latitude,
    longitude: point.longitude * 2 - projected.longitude,
  };
}

/**
 * Iteratively inverts the public GCJ approximation. The small numerical
 * residual does not turn the result into an official or surveyed coordinate.
 */
export function gcj02ToWgs84Exact(point: GeographicPoint): Wgs84Point {
  assertGeographicPoint(point, 'GCJ02');
  if (outsideMainlandChina(point)) return { ...point };
  const minimum = {
    latitude: point.latitude - 0.01,
    longitude: point.longitude - 0.01,
  };
  const maximum = {
    latitude: point.latitude + 0.01,
    longitude: point.longitude + 0.01,
  };
  let candidate = { ...point };
  for (let iteration = 0; iteration < 64; iteration += 1) {
    candidate = {
      latitude: (minimum.latitude + maximum.latitude) / 2,
      longitude: (minimum.longitude + maximum.longitude) / 2,
    };
    const projected = wgs84ToGcj02(candidate);
    const latitudeError = projected.latitude - point.latitude;
    const longitudeError = projected.longitude - point.longitude;
    if (Math.abs(latitudeError) < 1e-9 && Math.abs(longitudeError) < 1e-9) {
      return candidate;
    }
    if (latitudeError > 0) maximum.latitude = candidate.latitude;
    else minimum.latitude = candidate.latitude;
    if (longitudeError > 0) maximum.longitude = candidate.longitude;
    else minimum.longitude = candidate.longitude;
  }
  return candidate;
}

export function bd09McToWgs84(point: Bd09McPoint): Wgs84Point {
  return gcj02ToWgs84Exact(bd09ToGcj02(bd09McToBd09(point)));
}

export function haversineDistanceMeters(
  first: GeographicPoint,
  second: GeographicPoint,
): number {
  assertGeographicPoint(first, 'first point');
  assertGeographicPoint(second, 'second point');
  const latitude1 = (first.latitude * Math.PI) / 180;
  const latitude2 = (second.latitude * Math.PI) / 180;
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = ((second.longitude - first.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;
  return (
    2 * EARTH_MEAN_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)))
  );
}

export const haversineMeters = haversineDistanceMeters;
