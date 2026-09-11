import {
  CAMPUS_MAP_VERSION,
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  MAP_HEIGHT,
  MAP_WIDTH,
  accessForKind,
  environmentForKind,
  type AccessRule,
  type CampusMapDocument,
  type Level,
  type MapCalibration,
  type MapPoint,
  type Obstacle,
  type Place,
  type TravelEnvironment,
  type TraversalKind,
  type TraversalLink,
  type TraversalNode,
  type WalkableArea,
  type WeeklySchedule,
} from './campus-model.ts';

type UnknownRecord = Record<string, unknown>;

export type GeoTransform = {
  latitude: [number, number, number];
  longitude: [number, number, number];
};

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
  return value as UnknownRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} 必须是非空文本`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} 必须是有限数字`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} 必须是布尔值`);
  return value;
}

function positive(value: unknown, label: string, fallback = 1): number {
  if (value === undefined) return fallback;
  const parsed = finite(value, label);
  if (parsed <= 0) throw new Error(`${label} 必须大于 0`);
  return parsed;
}

function unit(value: unknown, label: string): number {
  const parsed = finite(value, label);
  if (parsed < 0 || parsed > 1) throw new Error(`${label} 必须在 0 到 1 之间`);
  return parsed;
}

function optionalFinite(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : finite(value, label);
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  return text(value, label);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} 的值无效`);
  }
  return value as T;
}

function mapPoint(value: unknown, label: string): MapPoint {
  const source = record(value, label);
  return { x: unit(source.x, `${label}.x`), y: unit(source.y, `${label}.y`) };
}

function wgs84Point(
  value: unknown,
  label: string,
): { latitude: number; longitude: number } {
  const source = record(value, label);
  const latitude = finite(source.latitude, `${label}.latitude`);
  const longitude = finite(source.longitude, `${label}.longitude`);
  if (latitude < -90 || latitude > 90)
    throw new Error(`${label}.latitude 必须在 -90 到 90 之间`);
  if (longitude < -180 || longitude > 180)
    throw new Error(`${label}.longitude 必须在 -180 到 180 之间`);
  return { latitude, longitude };
}

function mapCalibration(
  value: unknown,
  label: string,
): MapCalibration | undefined {
  if (value === undefined) return undefined;
  const source = record(value, label);
  if (source.schemaVersion !== 1)
    throw new Error(`${label}.schemaVersion 目前只支持 1`);
  const referenceSource = record(source.reference, `${label}.reference`);
  const centerSource =
    referenceSource.center === undefined
      ? undefined
      : record(referenceSource.center, `${label}.reference.center`);
  const anchors = array(source.anchors, `${label}.anchors`).map(
    (anchorValue, index) => {
      const anchorLabel = `${label}.anchors[${index}]`;
      const anchor = record(anchorValue, anchorLabel);
      const coordinate = record(anchor.source, `${anchorLabel}.source`);
      const crs = enumValue(
        coordinate.crs,
        ['BD09MC', 'BD09', 'WGS84'] as const,
        `${anchorLabel}.source.crs`,
      );
      const sourceCoordinate =
        crs === 'BD09MC'
          ? {
              crs,
              x: finite(coordinate.x, `${anchorLabel}.source.x`),
              y: finite(coordinate.y, `${anchorLabel}.source.y`),
            }
          : {
              crs,
              ...wgs84Point(coordinate, `${anchorLabel}.source`),
            };
      const accuracyMeters = optionalFinite(
        anchor.accuracyMeters,
        `${anchorLabel}.accuracyMeters`,
      );
      if (accuracyMeters !== undefined && accuracyMeters <= 0)
        throw new Error(`${anchorLabel}.accuracyMeters 必须大于 0`);
      return {
        id: text(anchor.id, `${anchorLabel}.id`),
        label: optionalText(anchor.label, `${anchorLabel}.label`),
        image: mapPoint(anchor.image, `${anchorLabel}.image`),
        source: sourceCoordinate,
        wgs84: wgs84Point(anchor.wgs84, `${anchorLabel}.wgs84`),
        accuracyMeters,
        sourceFeatureId: optionalText(
          anchor.sourceFeatureId,
          `${anchorLabel}.sourceFeatureId`,
        ),
      };
    },
  );
  if (new Set(anchors.map((anchor) => anchor.id)).size !== anchors.length)
    throw new Error(`${label}.anchors 的 id 不能重复`);
  return {
    schemaVersion: 1,
    method: enumValue(
      source.method,
      ['affine', 'thin-plate-spline'] as const,
      `${label}.method`,
    ),
    reference: {
      provider: enumValue(
        referenceSource.provider,
        ['baidu', 'openstreetmap', 'overture'] as const,
        `${label}.reference.provider`,
      ),
      sourceUrl: text(
        referenceSource.sourceUrl,
        `${label}.reference.sourceUrl`,
      ),
      sourceCrs: enumValue(
        referenceSource.sourceCrs,
        ['BD09MC', 'WGS84'] as const,
        `${label}.reference.sourceCrs`,
      ),
      mapType: optionalText(
        referenceSource.mapType,
        `${label}.reference.mapType`,
      ),
      center: centerSource
        ? {
            x: finite(centerSource.x, `${label}.reference.center.x`),
            y: finite(centerSource.y, `${label}.reference.center.y`),
            zoom: finite(centerSource.zoom, `${label}.reference.center.zoom`),
          }
        : undefined,
    },
    anchors,
    capturedAt: text(source.capturedAt, `${label}.capturedAt`),
    notes: optionalText(source.notes, `${label}.notes`),
  };
}

function schedule(value: unknown, label: string): WeeklySchedule | undefined {
  if (value === undefined) return undefined;
  const source = record(value, label);
  const days = array(source.days, `${label}.days`).map((day, index) => {
    const parsed = finite(day, `${label}.days[${index}]`);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
      throw new Error(`${label}.days 必须使用 0 到 6 的星期编号`);
    }
    return parsed;
  });
  const opens = text(source.opens, `${label}.opens`);
  const closes = text(source.closes, `${label}.closes`);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(opens) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(closes)
  ) {
    throw new Error(`${label} 的时间必须使用 HH:MM`);
  }
  return { days: [...new Set(days)].sort((a, b) => a - b), opens, closes };
}

function accessRule(
  value: unknown,
  label: string,
  fallback: AccessRule = DEFAULT_ACCESS,
): AccessRule {
  if (value === undefined) return { ...fallback };
  const source = record(value, label);
  return {
    audience: enumValue(
      source.audience ?? fallback.audience,
      ['public', 'campus', 'restricted'] as const,
      `${label}.audience`,
    ),
    wheelchair:
      source.wheelchair === undefined
        ? fallback.wheelchair
        : boolean(source.wheelchair, `${label}.wheelchair`),
    temporarilyClosed:
      source.temporarilyClosed === undefined
        ? fallback.temporarilyClosed
        : boolean(source.temporarilyClosed, `${label}.temporarilyClosed`),
    schedule: schedule(source.schedule, `${label}.schedule`),
  };
}

function environment(
  value: unknown,
  label: string,
  fallback: TravelEnvironment = DEFAULT_ENVIRONMENT,
): TravelEnvironment {
  if (value === undefined) return { ...fallback };
  const source = record(value, label);
  return {
    setting: enumValue(
      source.setting ?? fallback.setting,
      ['outdoor', 'covered', 'indoor'] as const,
      `${label}.setting`,
    ),
    shade: unit(source.shade ?? fallback.shade, `${label}.shade`),
  };
}

function traversalKind(value: unknown, label: string): TraversalKind {
  return enumValue(
    value,
    [
      'path',
      'building-passage',
      'arcade',
      'bridge',
      'stairs',
      'elevator',
      'ramp',
    ] as const,
    label,
  );
}

function parseLegacy(value: UnknownRecord): CampusMapDocument {
  const map = record(value.map, 'map');
  if (map.width !== MAP_WIDTH || map.height !== MAP_HEIGHT) {
    throw new Error('路网文件与当前 2038×1279 地图不匹配');
  }

  const legacyNodes = array(value.nodes, 'nodes').map((item, index) => {
    const source = record(item, `nodes[${index}]`);
    return {
      id: text(source.id, `nodes[${index}].id`),
      x: unit(source.x, `nodes[${index}].x`),
      y: unit(source.y, `nodes[${index}].y`),
      label: optionalText(source.label, `nodes[${index}].label`),
      latitude: optionalFinite(source.latitude, `nodes[${index}].latitude`),
      longitude: optionalFinite(source.longitude, `nodes[${index}].longitude`),
    };
  });
  const nodeIds = new Set(legacyNodes.map((node) => node.id));
  if (nodeIds.size !== legacyNodes.length) throw new Error('v1 节点 id 重复');

  const nodes: TraversalNode[] = legacyNodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    levelId: DEFAULT_LEVEL.id,
    kind: 'junction',
    latitude: node.latitude,
    longitude: node.longitude,
  }));
  const places: Place[] = legacyNodes
    .filter((node) => node.label)
    .map((node) => ({
      id: `place-${node.id}`,
      name: node.label as string,
      nodeId: node.id,
    }));
  const links: TraversalLink[] = array(value.edges, 'edges').map(
    (item, index) => {
      const source = record(item, `edges[${index}]`);
      const from = text(source.from, `edges[${index}].from`);
      const to = text(source.to, `edges[${index}].to`);
      const fromNode = nodes.find((node) => node.id === from);
      const toNode = nodes.find((node) => node.id === to);
      if (!fromNode || !toNode || from === to)
        throw new Error(`v1 路段 ${index + 1} 引用了无效节点`);
      return {
        id: text(source.id, `edges[${index}].id`),
        from,
        to,
        kind: 'path',
        direction: 'both',
        geometry: [
          { x: fromNode.x, y: fromNode.y },
          { x: toNode.x, y: toNode.y },
        ],
        environment: { ...DEFAULT_ENVIRONMENT },
        access: { ...DEFAULT_ACCESS },
        costMultiplier: 1,
      };
    },
  );

  return {
    version: CAMPUS_MAP_VERSION,
    map: {
      image: typeof map.image === 'string' ? map.image : 'map.jpg',
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      metersPerPixel: optionalFinite(map.metersPerPixel, 'map.metersPerPixel'),
    },
    levels: [{ ...DEFAULT_LEVEL }],
    nodes,
    places,
    links,
    areas: [],
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
  };
}

function parseV2(value: UnknownRecord): CampusMapDocument {
  const map = record(value.map, 'map');
  if (map.width !== MAP_WIDTH || map.height !== MAP_HEIGHT) {
    throw new Error('通行网络与当前 2038×1279 地图不匹配');
  }

  const levels: Level[] = array(value.levels, 'levels').map((item, index) => {
    const source = record(item, `levels[${index}]`);
    return {
      id: text(source.id, `levels[${index}].id`),
      name: text(source.name, `levels[${index}].name`),
      elevationMeters: finite(
        source.elevationMeters,
        `levels[${index}].elevationMeters`,
      ),
    };
  });
  if (levels.length === 0) throw new Error('至少需要一个层级');
  const levelIds = new Set(levels.map((level) => level.id));
  if (levelIds.size !== levels.length) throw new Error('层级 id 重复');

  const nodes: TraversalNode[] = array(value.nodes, 'nodes').map(
    (item, index) => {
      const source = record(item, `nodes[${index}]`);
      const levelId = text(source.levelId, `nodes[${index}].levelId`);
      if (!levelIds.has(levelId))
        throw new Error(`节点 ${index + 1} 引用了不存在的层级`);
      const latitude = optionalFinite(
        source.latitude,
        `nodes[${index}].latitude`,
      );
      const longitude = optionalFinite(
        source.longitude,
        `nodes[${index}].longitude`,
      );
      if ((latitude === undefined) !== (longitude === undefined)) {
        throw new Error(`节点 ${index + 1} 的经纬度必须同时存在`);
      }
      if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
        throw new Error(`节点 ${index + 1} 的纬度必须在 -90 到 90 之间`);
      }
      if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
        throw new Error(`节点 ${index + 1} 的经度必须在 -180 到 180 之间`);
      }
      return {
        id: text(source.id, `nodes[${index}].id`),
        x: unit(source.x, `nodes[${index}].x`),
        y: unit(source.y, `nodes[${index}].y`),
        levelId,
        kind: enumValue(
          source.kind,
          ['junction', 'portal'] as const,
          `nodes[${index}].kind`,
        ),
        latitude,
        longitude,
      };
    },
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error('节点 id 重复');
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  const places: Place[] = array(value.places, 'places').map((item, index) => {
    const source = record(item, `places[${index}]`);
    const nodeId = text(source.nodeId, `places[${index}].nodeId`);
    if (!nodeIds.has(nodeId))
      throw new Error(`地点 ${index + 1} 引用了不存在的节点`);
    return {
      id: text(source.id, `places[${index}].id`),
      name: text(source.name, `places[${index}].name`),
      nodeId,
    };
  });
  const normalizedNames = places.map((place) =>
    place.name.trim().toLocaleLowerCase('zh-CN'),
  );
  if (new Set(places.map((place) => place.id)).size !== places.length) {
    throw new Error('地点 id 重复');
  }
  if (new Set(normalizedNames).size !== normalizedNames.length)
    throw new Error('地点名称不能重复');
  if (new Set(places.map((place) => place.nodeId)).size !== places.length) {
    throw new Error('一个节点只能关联一个地点');
  }

  const links: TraversalLink[] = array(value.links, 'links').map(
    (item, index) => {
      const source = record(item, `links[${index}]`);
      const id = text(source.id, `links[${index}].id`);
      const from = text(source.from, `links[${index}].from`);
      const to = text(source.to, `links[${index}].to`);
      const fromNode = nodesById.get(from);
      const toNode = nodesById.get(to);
      if (!fromNode || !toNode || from === to)
        throw new Error(`通行段 ${id} 引用了无效节点`);
      const kind = traversalKind(source.kind, `links[${index}].kind`);
      const geometry = array(source.geometry, `links[${index}].geometry`).map(
        (point, pointIndex) =>
          mapPoint(point, `links[${index}].geometry[${pointIndex}]`),
      );
      if (geometry.length < 2)
        throw new Error(`通行段 ${id} 至少需要两个几何点`);
      geometry[0] = { x: fromNode.x, y: fromNode.y };
      geometry[geometry.length - 1] = { x: toNode.x, y: toNode.y };
      return {
        id,
        from,
        to,
        name: optionalText(source.name, `links[${index}].name`),
        kind,
        direction: enumValue(
          source.direction,
          ['both', 'forward'] as const,
          `links[${index}].direction`,
        ),
        geometry,
        environment: environment(
          source.environment,
          `links[${index}].environment`,
          environmentForKind(kind),
        ),
        access: accessRule(
          source.access,
          `links[${index}].access`,
          accessForKind(kind),
        ),
        costMultiplier: positive(
          source.costMultiplier,
          `links[${index}].costMultiplier`,
        ),
      };
    },
  );
  if (new Set(links.map((link) => link.id)).size !== links.length)
    throw new Error('通行段 id 重复');

  const areas: WalkableArea[] = array(value.areas, 'areas').map(
    (item, index) => {
      const source = record(item, `areas[${index}]`);
      const id = text(source.id, `areas[${index}].id`);
      const levelId = text(source.levelId, `areas[${index}].levelId`);
      if (!levelIds.has(levelId))
        throw new Error(`通行面 ${id} 引用了不存在的层级`);
      const boundary = array(source.boundary, `areas[${index}].boundary`).map(
        (point, pointIndex) =>
          mapPoint(point, `areas[${index}].boundary[${pointIndex}]`),
      );
      if (boundary.length < 3)
        throw new Error(`通行面 ${id} 至少需要三个边界点`);
      const obstacles: Obstacle[] = array(
        source.obstacles ?? [],
        `areas[${index}].obstacles`,
      ).map((itemObstacle, obstacleIndex) => {
        const obstacle = record(
          itemObstacle,
          `areas[${index}].obstacles[${obstacleIndex}]`,
        );
        const obstacleBoundary = array(
          obstacle.boundary,
          `areas[${index}].obstacles[${obstacleIndex}].boundary`,
        ).map((point, pointIndex) =>
          mapPoint(
            point,
            `areas[${index}].obstacles[${obstacleIndex}].boundary[${pointIndex}]`,
          ),
        );
        if (obstacleBoundary.length < 3)
          throw new Error(`障碍物 ${obstacleIndex + 1} 至少需要三个边界点`);
        return {
          id: text(
            obstacle.id,
            `areas[${index}].obstacles[${obstacleIndex}].id`,
          ),
          boundary: obstacleBoundary,
        };
      });
      return {
        id,
        name: optionalText(source.name, `areas[${index}].name`),
        levelId,
        boundary,
        obstacles,
        environment: environment(
          source.environment,
          `areas[${index}].environment`,
        ),
        access: accessRule(source.access, `areas[${index}].access`),
        costMultiplier: positive(
          source.costMultiplier,
          `areas[${index}].costMultiplier`,
        ),
      };
    },
  );
  if (new Set(areas.map((area) => area.id)).size !== areas.length)
    throw new Error('通行面 id 重复');

  const metersPerPixel = optionalFinite(
    map.metersPerPixel,
    'map.metersPerPixel',
  );
  if (metersPerPixel !== undefined && metersPerPixel <= 0)
    throw new Error('米/像素比例必须大于 0');

  return {
    version: CAMPUS_MAP_VERSION,
    map: {
      image: typeof map.image === 'string' ? map.image : 'map.jpg',
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      metersPerPixel,
      calibration: mapCalibration(map.calibration, 'map.calibration'),
      basemapRevision: optionalText(map.basemapRevision, 'map.basemapRevision'),
    },
    levels,
    nodes,
    places,
    links,
    areas,
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
  };
}

export function parseCampusMap(raw: string): CampusMapDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  const source = record(value, '通行网络');
  if (source.version === 1) return parseLegacy(source);
  if (source.version === CAMPUS_MAP_VERSION) return parseV2(source);
  throw new Error(`不支持的通行网络版本：${String(source.version)}`);
}

export function serializeCampusMap(document: CampusMapDocument): string {
  return JSON.stringify(
    { ...document, updatedAt: new Date().toISOString() },
    null,
    2,
  );
}

export function findPlace(
  document: CampusMapDocument,
  query: string,
): Place | null {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return null;
  return (
    document.places.find(
      (place) => place.name.trim().toLocaleLowerCase('zh-CN') === normalized,
    ) ??
    document.places.find((place) =>
      place.name.trim().toLocaleLowerCase('zh-CN').includes(normalized),
    ) ??
    null
  );
}

function invert3x3(matrix: number[][]): number[][] | null {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const [g, h, i] = matrix[2];
  const determinant =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-14) return null;
  return [
    [e * i - f * h, c * h - b * i, b * f - c * e],
    [f * g - d * i, a * i - c * g, c * d - a * f],
    [d * h - e * g, b * g - a * h, a * e - b * d],
  ].map((row) => row.map((number) => number / determinant));
}

function multiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

export function buildGeoTransform(
  document: CampusMapDocument,
): GeoTransform | null {
  const anchors = document.nodes.filter(
    (node) => Number.isFinite(node.latitude) && Number.isFinite(node.longitude),
  );
  if (anchors.length < 3) return null;
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const latitudeVector = [0, 0, 0];
  const longitudeVector = [0, 0, 0];
  for (const anchor of anchors) {
    const basis = [anchor.x, anchor.y, 1];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        normal[row][column] += basis[row] * basis[column];
      }
      latitudeVector[row] += basis[row] * (anchor.latitude as number);
      longitudeVector[row] += basis[row] * (anchor.longitude as number);
    }
  }
  const inverse = invert3x3(normal);
  if (!inverse) return null;
  return {
    latitude: multiply(inverse, latitudeVector) as [number, number, number],
    longitude: multiply(inverse, longitudeVector) as [number, number, number],
  };
}

export function geoToMapPoint(
  transform: GeoTransform,
  latitude: number,
  longitude: number,
): MapPoint | null {
  const [latX, latY, latOffset] = transform.latitude;
  const [lngX, lngY, lngOffset] = transform.longitude;
  const determinant = latX * lngY - latY * lngX;
  if (Math.abs(determinant) < 1e-14) return null;
  const adjustedLatitude = latitude - latOffset;
  const adjustedLongitude = longitude - lngOffset;
  return {
    x: (adjustedLatitude * lngY - latY * adjustedLongitude) / determinant,
    y: (latX * adjustedLongitude - adjustedLatitude * lngX) / determinant,
  };
}
