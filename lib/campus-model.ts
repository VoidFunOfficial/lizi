export const MAP_WIDTH = 2038;
export const MAP_HEIGHT = 1279;
export const CAMPUS_MAP_VERSION = 2 as const;

export type MapPoint = { x: number; y: number };

export type Wgs84Point = {
  latitude: number;
  longitude: number;
};

export type CalibrationSourceCoordinate =
  | { crs: 'BD09MC'; x: number; y: number }
  | { crs: 'BD09'; latitude: number; longitude: number }
  | { crs: 'WGS84'; latitude: number; longitude: number };

export type CalibrationAnchor = {
  id: string;
  label?: string;
  image: MapPoint;
  source: CalibrationSourceCoordinate;
  wgs84: Wgs84Point;
  accuracyMeters?: number;
  sourceFeatureId?: string;
};

export type MapCalibration = {
  schemaVersion: 1;
  method: 'affine' | 'thin-plate-spline';
  reference: {
    provider: 'baidu' | 'openstreetmap' | 'overture';
    sourceUrl: string;
    sourceCrs: 'BD09MC' | 'WGS84';
    mapType?: string;
    center?: { x: number; y: number; zoom: number };
  };
  anchors: CalibrationAnchor[];
  capturedAt: string;
  notes?: string;
};

export type Level = {
  id: string;
  name: string;
  elevationMeters: number;
};

export type TraversalNode = MapPoint & {
  id: string;
  levelId: string;
  kind: 'junction' | 'portal';
  latitude?: number;
  longitude?: number;
};

export type Place = {
  id: string;
  name: string;
  nodeId: string;
};

export type TravelEnvironment = {
  setting: 'outdoor' | 'covered' | 'indoor';
  shade: number;
};

export type SolarPosition = {
  elevationDegrees: number;
  azimuthDegrees: number;
};

export type SunlightInactiveReason =
  | 'not-sunny'
  | 'weather-unavailable'
  | 'outside-forecast'
  | 'sun-below-horizon'
  | 'unsupported-basemap';

export type ShadowPolygon = {
  buildingId: string;
  boundary: MapPoint[];
};

export type SunlightContext =
  | {
      status: 'active';
      departureTime: string;
      weatherAt: string;
      weatherSource: 'current' | 'hourly';
      weatherCode: 0;
      position: SolarPosition;
      shadowPolygons: ShadowPolygon[];
    }
  | {
      status: 'inactive';
      departureTime: string;
      reason: SunlightInactiveReason;
      weatherAt?: string;
      weatherSource?: 'current' | 'hourly';
      weatherCode?: number;
    };

export type RouteSunlightMetrics =
  | {
      status: 'active';
      departureTime: string;
      weatherAt: string;
      weatherSource: 'current' | 'hourly';
      elevationDegrees: number;
      azimuthDegrees: number;
      outdoorPixels: number;
      buildingShadowPixels: number;
      directSunPixels: number;
      outdoorMeters?: number;
      buildingShadowMeters?: number;
      directSunMeters?: number;
    }
  | {
      status: 'inactive';
      departureTime: string;
      reason: SunlightInactiveReason;
      weatherAt?: string;
      weatherSource?: 'current' | 'hourly';
      weatherCode?: number;
    };

export type WeeklySchedule = {
  days: number[];
  opens: string;
  closes: string;
};

export type AccessRule = {
  audience: 'public' | 'campus' | 'restricted';
  wheelchair: boolean;
  temporarilyClosed: boolean;
  schedule?: WeeklySchedule;
};

export type TraversalKind =
  | 'path'
  | 'building-passage'
  | 'arcade'
  | 'bridge'
  | 'stairs'
  | 'elevator'
  | 'ramp';

export type TraversalLink = {
  id: string;
  from: string;
  to: string;
  name?: string;
  kind: TraversalKind;
  direction: 'both' | 'forward';
  geometry: MapPoint[];
  environment: TravelEnvironment;
  access: AccessRule;
  costMultiplier: number;
};

export type Obstacle = {
  id: string;
  boundary: MapPoint[];
};

export type WalkableArea = {
  id: string;
  name?: string;
  levelId: string;
  boundary: MapPoint[];
  obstacles: Obstacle[];
  environment: TravelEnvironment;
  access: AccessRule;
  costMultiplier: number;
};

export type CampusMapDocument = {
  version: typeof CAMPUS_MAP_VERSION;
  map: {
    image: string;
    width: number;
    height: number;
    metersPerPixel?: number;
    calibration?: MapCalibration;
    basemapRevision?: string;
  };
  levels: Level[];
  nodes: TraversalNode[];
  places: Place[];
  links: TraversalLink[];
  areas: WalkableArea[];
  updatedAt: string;
};

export type RouteProfile =
  | 'fastest'
  | 'balanced'
  | 'cool'
  | 'rain'
  | 'accessible';

export type RouteEndpoint =
  | { nodeId: string }
  | { point: MapPoint; levelId: string };

export type RouteRequest = {
  origin: RouteEndpoint;
  destination: RouteEndpoint;
  profile: RouteProfile;
  departureTime: Date;
  audience: 'public' | 'campus';
  wheelchair?: boolean;
  sunlight?: SunlightContext;
};

export type RouteMetrics = {
  distancePixels: number;
  distanceMeters?: number;
  estimatedSeconds: number;
  indoorPixels: number;
  coveredPixels: number;
  shadedPixels: number;
  exposedPixels: number;
  stairsCount: number;
  levelChanges: number;
  sunlight?: RouteSunlightMetrics;
};

export type RoutePoint = MapPoint & { levelId: string };

export type CampusRoute = {
  profile: RouteProfile;
  nodeIds: string[];
  geometry: RoutePoint[];
  metrics: RouteMetrics;
};

export type RouteLocation = {
  nodeId: string;
  point: MapPoint;
  levelId: string;
  placeName?: string;
  distancePixels: number;
};

export type CampusDiagnostic = {
  severity: 'error' | 'warning';
  featureId?: string;
  message: string;
};

export const DEFAULT_LEVEL: Level = {
  id: 'level-ground',
  name: '地面层',
  elevationMeters: 0,
};

export const DEFAULT_ENVIRONMENT: TravelEnvironment = {
  setting: 'outdoor',
  shade: 0.2,
};

export const DEFAULT_ACCESS: AccessRule = {
  audience: 'public',
  wheelchair: true,
  temporarilyClosed: false,
};

export const createEmptyCampusMap = (): CampusMapDocument => ({
  version: CAMPUS_MAP_VERSION,
  map: {
    image: 'map.jpg',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  levels: [{ ...DEFAULT_LEVEL }],
  nodes: [],
  places: [],
  links: [],
  areas: [],
  updatedAt: new Date().toISOString(),
});

export function pointDistancePixels(a: MapPoint, b: MapPoint): number {
  return Math.hypot((a.x - b.x) * MAP_WIDTH, (a.y - b.y) * MAP_HEIGHT);
}

export function polylineLengthPixels(points: MapPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += pointDistancePixels(points[index - 1], points[index]);
  }
  return length;
}

export function pointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function placeForNode(
  document: CampusMapDocument,
  nodeId: string,
): Place | undefined {
  return document.places.find((place) => place.nodeId === nodeId);
}

export function environmentForKind(kind: TraversalKind): TravelEnvironment {
  if (kind === 'building-passage' || kind === 'elevator' || kind === 'stairs') {
    return { setting: 'indoor', shade: 1 };
  }
  if (kind === 'arcade' || kind === 'bridge') {
    return { setting: 'covered', shade: 0.95 };
  }
  return { ...DEFAULT_ENVIRONMENT };
}

export function accessForKind(kind: TraversalKind): AccessRule {
  return {
    audience: kind === 'building-passage' ? 'campus' : 'public',
    wheelchair: kind !== 'stairs',
    temporarilyClosed: false,
  };
}
