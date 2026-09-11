import { findPlace } from './campus-document.ts';
import { projectToPolyline } from './campus-editor.ts';
import { buildMapCalibration } from './map-calibration.ts';
import { campusClock } from './campus-time.ts';
import { shadowCoverageForPolyline } from './campus-sunlight.ts';
import {
  pointDistancePixels,
  pointInPolygon,
  polylineLengthPixels,
  type AccessRule,
  type CampusDiagnostic,
  type CampusMapDocument,
  type CampusRoute,
  type MapPoint,
  type RouteLocation,
  type RouteMetrics,
  type RouteEndpoint,
  type RoutePoint,
  type RouteProfile,
  type RouteRequest,
  type SunlightContext,
  type TravelEnvironment,
  type TraversalKind,
  type WalkableArea,
} from './campus-model.ts';

type CompiledNode = RoutePoint & { id: string; publicNode: boolean };

type CompiledArc = {
  id: string;
  sourceId: string;
  from: string;
  to: string;
  kind: TraversalKind | 'walkable-area';
  geometry: RoutePoint[];
  lengthPixels: number;
  lengthMeters?: number;
  environment: TravelEnvironment;
  access: AccessRule;
  costMultiplier: number;
};

type ArcSunlight = {
  outdoor: boolean;
  buildingShadowRatio: number;
  directSunRatio: number;
};

export type CampusNavigator = {
  diagnostics(): CampusDiagnostic[];
  resolvePlace(query: string): RouteLocation | null;
  resolvePlaceEndpoint(query: string): RouteEndpoint | null;
  snap(point: MapPoint, levelId?: string): RouteLocation | null;
  route(request: RouteRequest): CampusRoute | null;
};

const EPSILON = 1e-8;

function cross(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: MapPoint, a: MapPoint, b: MapPoint): boolean {
  if (Math.abs(cross(a, b, point)) > EPSILON) return false;
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

function onPolygonBoundary(point: MapPoint, polygon: MapPoint[]): boolean {
  return polygon.some((vertex, index) =>
    pointOnSegment(point, vertex, polygon[(index + 1) % polygon.length]),
  );
}

function orientation(a: MapPoint, b: MapPoint, c: MapPoint): number {
  const value = cross(a, b, c);
  return Math.abs(value) < EPSILON ? 0 : value > 0 ? 1 : -1;
}

function segmentsIntersect(
  a: MapPoint,
  b: MapPoint,
  c: MapPoint,
  d: MapPoint,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (
    (abC === 0 && pointOnSegment(c, a, b)) ||
    (abD === 0 && pointOnSegment(d, a, b)) ||
    (cdA === 0 && pointOnSegment(a, c, d)) ||
    (cdB === 0 && pointOnSegment(b, c, d))
  );
}

function polygonSelfIntersects(polygon: MapPoint[]): boolean {
  for (let first = 0; first < polygon.length; first += 1) {
    const firstNext = (first + 1) % polygon.length;
    for (let second = first + 1; second < polygon.length; second += 1) {
      const secondNext = (second + 1) % polygon.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0)
      ) {
        continue;
      }
      if (
        segmentsIntersect(
          polygon[first],
          polygon[firstNext],
          polygon[second],
          polygon[secondNext],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function pointAllowedInArea(point: MapPoint, area: WalkableArea): boolean {
  const insideBoundary =
    pointInPolygon(point, area.boundary) ||
    onPolygonBoundary(point, area.boundary);
  if (!insideBoundary) return false;
  return !area.obstacles.some(
    (obstacle) =>
      pointInPolygon(point, obstacle.boundary) &&
      !onPolygonBoundary(point, obstacle.boundary),
  );
}

function segmentAllowedInArea(
  a: MapPoint,
  b: MapPoint,
  area: WalkableArea,
): boolean {
  const length = pointDistancePixels(a, b);
  const samples = Math.max(12, Math.ceil(length / 10));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    if (
      !pointAllowedInArea(
        { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
        area,
      )
    ) {
      return false;
    }
  }
  return true;
}

function scheduleAllows(access: AccessRule, departureTime: Date): boolean {
  const schedule = access.schedule;
  if (!schedule) return true;
  const { day, minutes } = campusClock(departureTime);
  const [openHour, openMinute] = schedule.opens.split(':').map(Number);
  const [closeHour, closeMinute] = schedule.closes.split(':').map(Number);
  const opens = openHour * 60 + openMinute;
  const closes = closeHour * 60 + closeMinute;
  if (opens <= closes) {
    return schedule.days.includes(day) && minutes >= opens && minutes <= closes;
  }
  if (minutes >= opens) return schedule.days.includes(day);
  const previousDay = (day + 6) % 7;
  return minutes <= closes && schedule.days.includes(previousDay);
}

function accessAllows(
  access: AccessRule,
  request: RouteRequest,
  kind: CompiledArc['kind'],
): boolean {
  if (access.temporarilyClosed || access.audience === 'restricted')
    return false;
  if (access.audience === 'campus' && request.audience !== 'campus')
    return false;
  const needsWheelchair =
    request.wheelchair || request.profile === 'accessible';
  if (needsWheelchair && (!access.wheelchair || kind === 'stairs'))
    return false;
  return scheduleAllows(access, request.departureTime);
}

function profileMultiplier(
  profile: RouteProfile,
  arc: CompiledArc,
  sunlight?: ArcSunlight,
): number {
  const { setting, shade } = arc.environment;
  const directSunRatio = sunlight?.directSunRatio ?? 1 - shade;
  if (profile === 'cool') return 0.8 + directSunRatio * 1.8;
  if (profile === 'rain') {
    if (setting === 'indoor') return 0.72;
    if (setting === 'covered') return 0.85;
    return 2.4;
  }
  if (profile === 'balanced') return 1 + directSunRatio * 0.22;
  if (profile === 'accessible') {
    if (arc.kind === 'elevator') return 0.9;
    if (arc.kind === 'ramp') return 0.96;
  }
  return 1;
}

function arcCost(
  profile: RouteProfile,
  arc: CompiledArc,
  sunlight?: ArcSunlight,
): number {
  const traversedLength = Math.max(
    arc.lengthMeters ?? arc.lengthPixels,
    arc.kind === 'elevator' ? 12 : 4,
  );
  const transitionPenalty =
    arc.geometry[0]?.levelId !== arc.geometry.at(-1)?.levelId
      ? arc.kind === 'elevator'
        ? 20
        : arc.kind === 'stairs'
          ? 28
          : 16
      : 0;
  return (
    traversedLength *
      arc.costMultiplier *
      profileMultiplier(profile, arc, sunlight) +
    transitionPenalty
  );
}

function joinGeometry(arcs: CompiledArc[]): RoutePoint[] {
  const result: RoutePoint[] = [];
  for (const arc of arcs) {
    for (const point of arc.geometry) {
      const last = result.at(-1);
      if (
        !last ||
        last.levelId !== point.levelId ||
        Math.abs(last.x - point.x) > EPSILON ||
        Math.abs(last.y - point.y) > EPSILON
      ) {
        result.push(point);
      }
    }
  }
  return result;
}

function routeMetrics(
  document: CampusMapDocument,
  arcs: CompiledArc[],
  sunlight: SunlightContext | undefined,
  arcSunlight: (arc: CompiledArc) => ArcSunlight,
): RouteMetrics {
  const metrics: RouteMetrics = {
    distancePixels: 0,
    estimatedSeconds: 0,
    indoorPixels: 0,
    coveredPixels: 0,
    shadedPixels: 0,
    exposedPixels: 0,
    stairsCount: 0,
    levelChanges: 0,
  };
  for (const arc of arcs) {
    const length = arc.lengthPixels;
    metrics.distancePixels += length;
    if (arc.environment.setting === 'indoor') metrics.indoorPixels += length;
    if (arc.environment.setting === 'covered') metrics.coveredPixels += length;
    metrics.shadedPixels += length * arc.environment.shade;
    metrics.exposedPixels += length * (1 - arc.environment.shade);
    if (arc.kind === 'stairs') metrics.stairsCount += 1;
    if (arc.geometry[0]?.levelId !== arc.geometry.at(-1)?.levelId) {
      metrics.levelChanges += 1;
    }
  }
  const calibratedLengths = arcs.map((arc) => arc.lengthMeters);
  if (
    calibratedLengths.length > 0 &&
    calibratedLengths.every((length) => length !== undefined)
  ) {
    metrics.distanceMeters = calibratedLengths.reduce(
      (sum, length) => sum + (length ?? 0),
      0,
    );
    metrics.estimatedSeconds = metrics.distanceMeters / 1.25;
  } else if (document.map.metersPerPixel) {
    metrics.distanceMeters =
      metrics.distancePixels * document.map.metersPerPixel;
    metrics.estimatedSeconds = metrics.distanceMeters / 1.25;
  } else {
    metrics.estimatedSeconds = metrics.distancePixels / 4.5;
  }
  metrics.estimatedSeconds += arcs.reduce((seconds, arc) => {
    if (arc.kind === 'elevator') return seconds + 35;
    if (arc.kind === 'stairs') return seconds + 18;
    if (
      arc.kind === 'ramp' &&
      arc.geometry[0]?.levelId !== arc.geometry.at(-1)?.levelId
    ) {
      return seconds + 10;
    }
    return seconds;
  }, 0);

  if (sunlight?.status === 'inactive') {
    metrics.sunlight = {
      status: 'inactive',
      departureTime: sunlight.departureTime,
      reason: sunlight.reason,
      weatherAt: sunlight.weatherAt,
      weatherSource: sunlight.weatherSource,
      weatherCode: sunlight.weatherCode,
    };
  } else if (sunlight?.status === 'active') {
    let outdoorPixels = 0;
    let buildingShadowPixels = 0;
    let directSunPixels = 0;
    let outdoorMeters = 0;
    let buildingShadowMeters = 0;
    let directSunMeters = 0;
    let hasCompleteMeters = true;
    for (const arc of arcs) {
      const assessment = arcSunlight(arc);
      if (!assessment.outdoor) continue;
      outdoorPixels += arc.lengthPixels;
      buildingShadowPixels += arc.lengthPixels * assessment.buildingShadowRatio;
      directSunPixels += arc.lengthPixels * assessment.directSunRatio;
      if (arc.lengthMeters === undefined) {
        hasCompleteMeters = false;
      } else {
        outdoorMeters += arc.lengthMeters;
        buildingShadowMeters +=
          arc.lengthMeters * assessment.buildingShadowRatio;
        directSunMeters += arc.lengthMeters * assessment.directSunRatio;
      }
    }
    metrics.sunlight = {
      status: 'active',
      departureTime: sunlight.departureTime,
      weatherAt: sunlight.weatherAt,
      weatherSource: sunlight.weatherSource,
      elevationDegrees: sunlight.position.elevationDegrees,
      azimuthDegrees: sunlight.position.azimuthDegrees,
      outdoorPixels,
      buildingShadowPixels,
      directSunPixels,
      ...(hasCompleteMeters
        ? { outdoorMeters, buildingShadowMeters, directSunMeters }
        : {}),
    };
  }
  return metrics;
}

function linkGeometry(
  from: CompiledNode,
  to: CompiledNode,
  points: MapPoint[],
): RoutePoint[] {
  if (from.levelId === to.levelId) {
    return points.map((point) => ({ ...point, levelId: from.levelId }));
  }
  return points.map((point, index) => ({
    ...point,
    levelId: index === points.length - 1 ? to.levelId : from.levelId,
  }));
}

function createDiagnostics(document: CampusMapDocument): CampusDiagnostic[] {
  const diagnostics: CampusDiagnostic[] = [];
  if (document.map.calibration) {
    if (document.map.calibration.anchors.length < 3) {
      diagnostics.push({
        severity: 'warning',
        message: '地图校准至少需要 3 个二维分散的控制点。',
      });
    } else {
      try {
        const calibrated = buildMapCalibration(
          document.map.calibration,
          document.map.width,
          document.map.height,
        );
        if (
          calibrated.quality.status === 'needs-review' ||
          calibrated.quality.status === 'poor-coverage'
        ) {
          diagnostics.push({
            severity: 'warning',
            message: `地图校准${calibrated.quality.status === 'poor-coverage' ? '控制点覆盖不足' : '需要独立测量点复核'}。`,
          });
        }
      } catch (error) {
        diagnostics.push({
          severity: 'error',
          message:
            error instanceof Error
              ? `地图校准无效：${error.message}`
              : '地图校准无效。',
        });
      }
    }
  }
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const placeNames = new Map<string, number>();
  for (const place of document.places) {
    const name = place.name.trim().toLocaleLowerCase('zh-CN');
    placeNames.set(name, (placeNames.get(name) ?? 0) + 1);
  }
  for (const [name, count] of placeNames) {
    if (count > 1) {
      diagnostics.push({
        severity: 'error',
        message: `地点名称“${name}”重复，导航输入会产生歧义。`,
      });
    }
  }
  for (const link of document.links) {
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    if (!from || !to) continue;
    const changesLevel = from.levelId !== to.levelId;
    const vertical =
      link.kind === 'stairs' ||
      link.kind === 'elevator' ||
      link.kind === 'ramp';
    if (changesLevel && !vertical) {
      diagnostics.push({
        severity: 'error',
        featureId: link.id,
        message: '跨层通行段必须标为楼梯、电梯或坡道。',
      });
    }
    if (!changesLevel && vertical) {
      diagnostics.push({
        severity: 'warning',
        featureId: link.id,
        message: '垂直连接的两个端点位于同一层。',
      });
    }
    if (
      link.kind === 'building-passage' &&
      (from.kind !== 'portal' || to.kind !== 'portal')
    ) {
      diagnostics.push({
        severity: 'warning',
        featureId: link.id,
        message: '教学楼穿行通道建议以门户节点作为两端。',
      });
    }
    if (polylineLengthPixels(link.geometry) < 0.5 && !changesLevel) {
      diagnostics.push({
        severity: 'warning',
        featureId: link.id,
        message: '通行段长度过短。',
      });
    }
  }
  for (const area of document.areas) {
    if (polygonSelfIntersects(area.boundary)) {
      diagnostics.push({
        severity: 'error',
        featureId: area.id,
        message: '通行面边界发生自交。',
      });
    }
    for (const obstacle of area.obstacles) {
      if (polygonSelfIntersects(obstacle.boundary)) {
        diagnostics.push({
          severity: 'error',
          featureId: obstacle.id,
          message: '障碍物边界发生自交。',
        });
      }
      if (
        !obstacle.boundary.every((point) =>
          pointAllowedInArea(point, { ...area, obstacles: [] }),
        )
      ) {
        diagnostics.push({
          severity: 'error',
          featureId: obstacle.id,
          message: '障碍物超出了通行面边界。',
        });
      }
    }
    const connectedNodes = document.nodes.filter(
      (node) => node.levelId === area.levelId && pointAllowedInArea(node, area),
    );
    if (connectedNodes.length === 0) {
      diagnostics.push({
        severity: 'warning',
        featureId: area.id,
        message: '通行面内没有通行节点，暂时无法与其他路线连接。',
      });
    }
  }
  return diagnostics;
}

export function compileCampusMap(document: CampusMapDocument): CampusNavigator {
  const nodes = new Map<string, CompiledNode>();
  const arcsFrom = new Map<string, CompiledArc[]>();
  const diagnostics = createDiagnostics(document);
  let calibration: ReturnType<typeof buildMapCalibration> | null = null;
  if (document.map.calibration?.anchors.length) {
    try {
      calibration = buildMapCalibration(
        document.map.calibration,
        document.map.width,
        document.map.height,
      );
    } catch {
      calibration = null;
    }
  }
  const levelsById = new Map(
    document.levels.map((level) => [level.id, level.elevationMeters]),
  );

  const lengthMeters = (
    geometry: MapPoint[],
    fromLevelId?: string,
    toLevelId?: string,
  ): number | undefined => {
    const horizontal = calibration?.polylineLengthMeters(geometry) ?? undefined;
    if (horizontal === undefined) return undefined;
    if (!fromLevelId || !toLevelId || fromLevelId === toLevelId)
      return horizontal;
    const vertical = Math.abs(
      (levelsById.get(toLevelId) ?? 0) - (levelsById.get(fromLevelId) ?? 0),
    );
    return Math.hypot(horizontal, vertical);
  };

  const addNode = (node: CompiledNode) => {
    nodes.set(node.id, node);
    if (!arcsFrom.has(node.id)) arcsFrom.set(node.id, []);
  };
  const addArc = (arc: CompiledArc) => {
    arcsFrom.get(arc.from)?.push(arc);
  };

  for (const node of document.nodes) addNode({ ...node, publicNode: true });

  for (const link of document.links) {
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    if (!from || !to) continue;
    if (
      from.levelId !== to.levelId &&
      !['stairs', 'elevator', 'ramp'].includes(link.kind)
    ) {
      continue;
    }
    const forwardGeometry = linkGeometry(from, to, link.geometry);
    const lengthPixels = polylineLengthPixels(link.geometry);
    const calibratedLength = lengthMeters(
      link.geometry,
      from.levelId,
      to.levelId,
    );
    addArc({
      id: `${link.id}:forward`,
      sourceId: link.id,
      from: from.id,
      to: to.id,
      kind: link.kind,
      geometry: forwardGeometry,
      lengthPixels,
      lengthMeters: calibratedLength,
      environment: link.environment,
      access: link.access,
      costMultiplier: link.costMultiplier,
    });
    if (link.direction === 'both') {
      addArc({
        id: `${link.id}:reverse`,
        sourceId: link.id,
        from: to.id,
        to: from.id,
        kind: link.kind,
        geometry: [...forwardGeometry].reverse(),
        lengthPixels,
        lengthMeters: calibratedLength,
        environment: link.environment,
        access: link.access,
        costMultiplier: link.costMultiplier,
      });
    }
  }

  for (const area of document.areas) {
    const candidates: CompiledNode[] = document.nodes
      .filter(
        (node) =>
          node.levelId === area.levelId && pointAllowedInArea(node, area),
      )
      .map((node) => nodes.get(node.id) as CompiledNode);
    area.boundary.forEach((point, index) => {
      const node = {
        id: `@area:${area.id}:boundary:${index}`,
        ...point,
        levelId: area.levelId,
        publicNode: false,
      };
      addNode(node);
      candidates.push(node);
    });
    area.obstacles.forEach((obstacle, obstacleIndex) => {
      obstacle.boundary.forEach((point, pointIndex) => {
        const node = {
          id: `@area:${area.id}:obstacle:${obstacleIndex}:${pointIndex}`,
          ...point,
          levelId: area.levelId,
          publicNode: false,
        };
        addNode(node);
        candidates.push(node);
      });
    });
    for (let fromIndex = 0; fromIndex < candidates.length; fromIndex += 1) {
      for (
        let toIndex = fromIndex + 1;
        toIndex < candidates.length;
        toIndex += 1
      ) {
        const from = candidates[fromIndex];
        const to = candidates[toIndex];
        if (!segmentAllowedInArea(from, to, area)) continue;
        const lengthPixels = pointDistancePixels(from, to);
        const calibratedLength = lengthMeters([from, to]);
        const shared = {
          sourceId: area.id,
          kind: 'walkable-area' as const,
          lengthPixels,
          lengthMeters: calibratedLength,
          environment: area.environment,
          access: area.access,
          costMultiplier: area.costMultiplier,
        };
        addArc({
          ...shared,
          id: `${area.id}:${from.id}:${to.id}`,
          from: from.id,
          to: to.id,
          geometry: [from, to],
        });
        addArc({
          ...shared,
          id: `${area.id}:${to.id}:${from.id}`,
          from: to.id,
          to: from.id,
          geometry: [to, from],
        });
      }
    }
  }

  const locationForNode = (
    node: CompiledNode,
    distancePixels = 0,
  ): RouteLocation => ({
    nodeId: node.id,
    point: { x: node.x, y: node.y },
    levelId: node.levelId,
    placeName: document.places.find((place) => place.nodeId === node.id)?.name,
    distancePixels,
  });

  const snap = (point: MapPoint, levelId?: string): RouteLocation | null => {
    let best: CompiledNode | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of nodes.values()) {
      if (levelId && node.levelId !== levelId) continue;
      const distance = pointDistancePixels(point, node);
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best ? locationForNode(best, bestDistance) : null;
  };

  const resolvePlace = (query: string): RouteLocation | null => {
    const place = findPlace(document, query);
    if (!place) return null;
    const node = nodes.get(place.nodeId);
    return node ? locationForNode(node) : null;
  };

  return {
    diagnostics: () => [...diagnostics],
    resolvePlace,
    resolvePlaceEndpoint(query) {
      const location = resolvePlace(query);
      if (!location) return null;
      const directlyConnected =
        document.links.some(
          (link) =>
            link.from === location.nodeId || link.to === location.nodeId,
        ) ||
        document.areas.some(
          (area) =>
            area.levelId === location.levelId &&
            pointAllowedInArea(location.point, area),
        );
      return directlyConnected
        ? { nodeId: location.nodeId }
        : {
            point: { ...location.point },
            levelId: location.levelId,
          };
    },
    snap,
    route(request) {
      const sunlightCache = new Map<CompiledArc, ArcSunlight>();
      const shadowPolygons =
        request.sunlight?.status === 'active'
          ? request.sunlight.shadowPolygons.map((shadow) => shadow.boundary)
          : [];
      const arcSunlight = (arc: CompiledArc): ArcSunlight => {
        const cached = sunlightCache.get(arc);
        if (cached) return cached;
        const outdoor = arc.environment.setting === 'outdoor';
        let buildingShadowRatio = 0;
        let directSunRatio = 0;
        if (outdoor && request.sunlight?.status === 'active') {
          const coverage = shadowCoverageForPolyline(
            arc.geometry,
            shadowPolygons,
            (first, second) =>
              lengthMeters([first, second]) ??
              pointDistancePixels(first, second),
          );
          buildingShadowRatio = coverage.ratio;
          directSunRatio = 1 - coverage.ratio;
        }
        const result = { outdoor, buildingShadowRatio, directSunRatio };
        sunlightCache.set(arc, result);
        return result;
      };
      const routeNodes = new Map(nodes);
      const routeArcsFrom = new Map(
        [...arcsFrom].map(([id, arcs]) => [id, [...arcs]]),
      );
      const addRouteNode = (node: CompiledNode) => {
        routeNodes.set(node.id, node);
        if (!routeArcsFrom.has(node.id)) routeArcsFrom.set(node.id, []);
      };
      const addRouteArc = (arc: CompiledArc) => {
        routeArcsFrom.get(arc.from)?.push(arc);
      };
      const resolveEndpoint = (
        endpoint: RouteRequest['origin'],
        id: string,
      ): CompiledNode | null => {
        if ('nodeId' in endpoint)
          return routeNodes.get(endpoint.nodeId) ?? null;

        const containingArea = document.areas.find(
          (area) =>
            area.levelId === endpoint.levelId &&
            pointAllowedInArea(endpoint.point, area),
        );
        if (containingArea) {
          const temporary: CompiledNode = {
            id,
            ...endpoint.point,
            levelId: endpoint.levelId,
            publicNode: false,
          };
          addRouteNode(temporary);
          let connections = 0;
          for (const candidate of routeNodes.values()) {
            if (
              candidate.id === temporary.id ||
              candidate.levelId !== temporary.levelId ||
              !pointAllowedInArea(candidate, containingArea) ||
              !segmentAllowedInArea(temporary, candidate, containingArea)
            ) {
              continue;
            }
            const geometry: RoutePoint[] = [temporary, candidate];
            const reverseGeometry = [...geometry].reverse();
            const shared = {
              sourceId: containingArea.id,
              kind: 'walkable-area' as const,
              lengthPixels: pointDistancePixels(temporary, candidate),
              lengthMeters: lengthMeters(geometry),
              environment: containingArea.environment,
              access: containingArea.access,
              costMultiplier: containingArea.costMultiplier,
            };
            addRouteArc({
              ...shared,
              id: `${id}:${candidate.id}:out`,
              from: temporary.id,
              to: candidate.id,
              geometry,
            });
            addRouteArc({
              ...shared,
              id: `${id}:${candidate.id}:in`,
              from: candidate.id,
              to: temporary.id,
              geometry: reverseGeometry,
            });
            connections += 1;
          }
          if (connections > 0) return temporary;
          routeNodes.delete(temporary.id);
          routeArcsFrom.delete(temporary.id);
        }

        let best:
          | {
              link: (typeof document.links)[number];
              point: MapPoint;
              distance: number;
              segmentIndex: number;
            }
          | undefined;
        for (const link of document.links) {
          const from = routeNodes.get(link.from);
          const to = routeNodes.get(link.to);
          if (
            !from ||
            !to ||
            from.levelId !== endpoint.levelId ||
            to.levelId !== endpoint.levelId
          ) {
            continue;
          }
          const projection = projectToPolyline(endpoint.point, link.geometry);
          if (!projection || (best && projection.distance >= best.distance))
            continue;
          best = { link, ...projection };
        }
        if (best) {
          const from = routeNodes.get(best.link.from) as CompiledNode;
          const to = routeNodes.get(best.link.to) as CompiledNode;
          const temporary: CompiledNode = {
            id,
            ...best.point,
            levelId: endpoint.levelId,
            publicNode: false,
          };
          addRouteNode(temporary);
          const before: RoutePoint[] = [
            ...best.link.geometry.slice(0, best.segmentIndex + 1),
            best.point,
          ].map((point) => ({ ...point, levelId: endpoint.levelId }));
          const after: RoutePoint[] = [
            best.point,
            ...best.link.geometry.slice(best.segmentIndex + 1),
          ].map((point) => ({ ...point, levelId: endpoint.levelId }));
          const arc = (
            arcId: string,
            arcFrom: CompiledNode,
            arcTo: CompiledNode,
            geometry: RoutePoint[],
          ): CompiledArc => ({
            id: `${id}:${arcId}`,
            sourceId: best.link.id,
            from: arcFrom.id,
            to: arcTo.id,
            kind: best.link.kind,
            geometry,
            lengthPixels: polylineLengthPixels(geometry),
            lengthMeters: lengthMeters(geometry),
            environment: best.link.environment,
            access: best.link.access,
            costMultiplier: best.link.costMultiplier,
          });
          addRouteArc(arc('forward-in', from, temporary, before));
          addRouteArc(arc('forward-out', temporary, to, after));
          if (best.link.direction === 'both') {
            addRouteArc(arc('reverse-in', to, temporary, [...after].reverse()));
            addRouteArc(
              arc('reverse-out', temporary, from, [...before].reverse()),
            );
          }
          return temporary;
        }

        const location = snap(endpoint.point, endpoint.levelId);
        return location ? (routeNodes.get(location.nodeId) ?? null) : null;
      };

      const origin = resolveEndpoint(request.origin, '@route:origin');
      const destination = resolveEndpoint(
        request.destination,
        '@route:destination',
      );
      if (!origin || !destination) return null;
      if (origin.id === destination.id) {
        return {
          profile: request.profile,
          nodeIds: [origin.id],
          geometry: [origin],
          metrics: routeMetrics(document, [], request.sunlight, arcSunlight),
        };
      }

      const distances = new Map<string, number>([[origin.id, 0]]);
      const previous = new Map<string, { nodeId: string; arc: CompiledArc }>();
      const unsettled = new Set<string>([origin.id]);
      while (unsettled.size > 0) {
        let currentId: string | null = null;
        let currentDistance = Number.POSITIVE_INFINITY;
        for (const id of unsettled) {
          const distance = distances.get(id) ?? Number.POSITIVE_INFINITY;
          if (distance < currentDistance) {
            currentDistance = distance;
            currentId = id;
          }
        }
        if (!currentId || currentId === destination.id) break;
        unsettled.delete(currentId);
        for (const arc of routeArcsFrom.get(currentId) ?? []) {
          if (!accessAllows(arc.access, request, arc.kind)) continue;
          const candidate =
            currentDistance +
            arcCost(
              request.profile,
              arc,
              request.sunlight ? arcSunlight(arc) : undefined,
            );
          if (candidate < (distances.get(arc.to) ?? Number.POSITIVE_INFINITY)) {
            distances.set(arc.to, candidate);
            previous.set(arc.to, { nodeId: currentId, arc });
            unsettled.add(arc.to);
          }
        }
      }
      if (!previous.has(destination.id)) return null;

      const routeArcs: CompiledArc[] = [];
      const nodeIds = [destination.id];
      let cursor = destination.id;
      while (cursor !== origin.id) {
        const step = previous.get(cursor);
        if (!step) return null;
        routeArcs.push(step.arc);
        cursor = step.nodeId;
        nodeIds.push(cursor);
      }
      routeArcs.reverse();
      nodeIds.reverse();
      return {
        profile: request.profile,
        nodeIds,
        geometry: joinGeometry(routeArcs),
        metrics: routeMetrics(
          document,
          routeArcs,
          request.sunlight,
          arcSunlight,
        ),
      };
    },
  };
}
