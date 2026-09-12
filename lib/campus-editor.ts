import {
  MAP_HEIGHT,
  MAP_WIDTH,
  pointDistancePixels,
  type CampusMapDocument,
  type MapPoint,
  type TraversalLink,
  type TraversalNode,
} from './campus-model.ts';

const ENDPOINT_EPSILON_PIXELS = 0.25;

export type FeatureSelection =
  | { type: 'node'; id: string }
  | { type: 'link'; id: string }
  | { type: 'area'; id: string }
  | { type: 'shadow'; id: string }
  | null;

export type InsertNodeResult = {
  document: CampusMapDocument;
  node: TraversalNode;
  changed: boolean;
};

export type SnapExclusions = {
  nodeIds?: ReadonlySet<string>;
  linkIds?: ReadonlySet<string>;
};

export function createFeatureId(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function clampPoint(point: MapPoint): MapPoint {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  };
}

export function mapPixelRadiusForScreenPixels(
  screenPixels: number,
  renderedWidth: number,
  renderedHeight: number,
): number {
  if (
    !Number.isFinite(screenPixels) ||
    !Number.isFinite(renderedWidth) ||
    !Number.isFinite(renderedHeight) ||
    screenPixels < 0 ||
    renderedWidth <= 0 ||
    renderedHeight <= 0
  ) {
    throw new Error(
      'Screen and rendered map dimensions must be finite and positive',
    );
  }
  return (
    screenPixels *
    Math.max(MAP_WIDTH / renderedWidth, MAP_HEIGHT / renderedHeight)
  );
}

function projectToSegment(
  point: MapPoint,
  start: MapPoint,
  end: MapPoint,
): { point: MapPoint; distance: number; ratio: number } {
  const px = point.x * MAP_WIDTH;
  const py = point.y * MAP_HEIGHT;
  const ax = start.x * MAP_WIDTH;
  const ay = start.y * MAP_HEIGHT;
  const bx = end.x * MAP_WIDTH;
  const by = end.y * MAP_HEIGHT;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio =
    denominator === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator),
        );
  const projected = {
    x: (ax + ratio * dx) / MAP_WIDTH,
    y: (ay + ratio * dy) / MAP_HEIGHT,
  };
  return {
    point: projected,
    distance: pointDistancePixels(point, projected),
    ratio,
  };
}

export function projectToPolyline(
  point: MapPoint,
  geometry: MapPoint[],
): {
  point: MapPoint;
  distance: number;
  segmentIndex: number;
  ratio: number;
} | null {
  let best:
    | (ReturnType<typeof projectToSegment> & { segmentIndex: number })
    | null = null;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const projected = projectToSegment(
      point,
      geometry[index],
      geometry[index + 1],
    );
    if (!best || projected.distance < best.distance)
      best = { ...projected, segmentIndex: index };
  }
  return best;
}

export function nearestNode(
  document: CampusMapDocument,
  point: MapPoint,
  levelId: string,
  thresholdPixels = Number.POSITIVE_INFINITY,
  excludedNodeIds?: ReadonlySet<string>,
): TraversalNode | null {
  let result: TraversalNode | null = null;
  let distance = thresholdPixels;
  for (const node of document.nodes) {
    if (node.levelId !== levelId || excludedNodeIds?.has(node.id)) continue;
    const nextDistance = pointDistancePixels(point, node);
    if (nextDistance <= distance) {
      result = node;
      distance = nextDistance;
    }
  }
  return result;
}

export function nearestLink(
  document: CampusMapDocument,
  point: MapPoint,
  levelId: string,
  thresholdPixels = Number.POSITIVE_INFINITY,
  excludedLinkIds?: ReadonlySet<string>,
  excludedNodeIds?: ReadonlySet<string>,
): {
  link: TraversalLink;
  point: MapPoint;
  distance: number;
  segmentIndex: number;
  ratio: number;
} | null {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  let best: ReturnType<typeof nearestLink> = null;
  for (const link of document.links) {
    if (excludedLinkIds?.has(link.id)) continue;
    const from = nodes.get(link.from);
    const to = nodes.get(link.to);
    if (!from || !to || from.levelId !== levelId || to.levelId !== levelId)
      continue;
    const projected = projectToPolyline(point, link.geometry);
    if (
      projected &&
      ((excludedNodeIds?.has(from.id) &&
        pointDistancePixels(projected.point, from) < ENDPOINT_EPSILON_PIXELS) ||
        (excludedNodeIds?.has(to.id) &&
          pointDistancePixels(projected.point, to) < ENDPOINT_EPSILON_PIXELS))
    ) {
      continue;
    }
    if (
      projected &&
      projected.distance <= thresholdPixels &&
      (!best || projected.distance < best.distance)
    ) {
      best = { link, ...projected };
    }
  }
  return best;
}

export function insertSnappedNode(
  document: CampusMapDocument,
  point: MapPoint,
  levelId: string,
  thresholdPixels = 18,
  kind: TraversalNode['kind'] = 'junction',
  exclusions: SnapExclusions = {},
): InsertNodeResult {
  const existing = nearestNode(
    document,
    point,
    levelId,
    thresholdPixels,
    exclusions.nodeIds,
  );
  if (existing) return { document, node: existing, changed: false };

  const projection = nearestLink(
    document,
    point,
    levelId,
    thresholdPixels,
    exclusions.linkIds,
    exclusions.nodeIds,
  );
  const node: TraversalNode = {
    id: createFeatureId('node'),
    ...clampPoint(projection?.point ?? point),
    levelId,
    kind,
  };
  if (!projection) {
    return {
      document: { ...document, nodes: [...document.nodes, node] },
      node,
      changed: true,
    };
  }

  const geometryBefore = [
    ...projection.link.geometry.slice(0, projection.segmentIndex + 1),
    node,
  ];
  const geometryAfter = [
    node,
    ...projection.link.geometry.slice(projection.segmentIndex + 1),
  ];
  const inherit = (
    link: TraversalLink,
  ): Omit<TraversalLink, 'id' | 'from' | 'to' | 'geometry'> => ({
    name: link.name,
    kind: link.kind,
    direction: link.direction,
    environment: { ...link.environment },
    access: {
      ...link.access,
      schedule: link.access.schedule
        ? { ...link.access.schedule, days: [...link.access.schedule.days] }
        : undefined,
    },
    costMultiplier: link.costMultiplier,
  });
  const first: TraversalLink = {
    ...inherit(projection.link),
    id: createFeatureId('link'),
    from: projection.link.from,
    to: node.id,
    geometry: geometryBefore,
  };
  const second: TraversalLink = {
    ...inherit(projection.link),
    id: createFeatureId('link'),
    from: node.id,
    to: projection.link.to,
    geometry: geometryAfter,
  };
  return {
    document: {
      ...document,
      nodes: [...document.nodes, node],
      links: [
        ...document.links.filter((link) => link.id !== projection.link.id),
        first,
        second,
      ],
    },
    node,
    changed: true,
  };
}

export function deleteFeature(
  document: CampusMapDocument,
  selection: Exclude<FeatureSelection, null>,
): CampusMapDocument {
  if (selection.type === 'shadow') {
    return {
      ...document,
      solarBuildings: (document.solarBuildings ?? []).filter(
        (building) => building.id !== selection.id,
      ),
    };
  }
  if (selection.type === 'node') {
    return {
      ...document,
      nodes: document.nodes.filter((node) => node.id !== selection.id),
      places: document.places.filter((place) => place.nodeId !== selection.id),
      links: document.links.filter(
        (link) => link.from !== selection.id && link.to !== selection.id,
      ),
    };
  }
  if (selection.type === 'link') {
    return {
      ...document,
      links: document.links.filter((link) => link.id !== selection.id),
    };
  }
  return {
    ...document,
    areas: document.areas.filter((area) => area.id !== selection.id),
  };
}
