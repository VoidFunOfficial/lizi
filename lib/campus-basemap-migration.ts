import { buildMapCalibration } from './map-calibration.ts';
import type {
  CampusMapDocument,
  MapCalibration,
  MapPoint,
  Wgs84Point,
} from './campus-model.ts';
import {
  JIANGYIN_GUIDE_CALIBRATION,
  JIANGYIN_VECTOR_CALIBRATION,
  LEGACY_GEORECTIFIED_GUIDE_IMAGE,
  LEGACY_GEORECTIFIED_GUIDE_REVISION,
  LEGACY_REFINED_GUIDE_IMAGE,
  LEGACY_REFINED_GUIDE_REVISION,
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  PRECISION_BASEMAP_IMAGE,
  PRECISION_BASEMAP_REVISION,
  REFINED_GUIDE_IMAGE,
  REFINED_GUIDE_REVISION,
  cloneReferenceCalibration,
} from './njust-jiangyin-reference.ts';

const LEGACY_BASEMAP_IMAGE = 'map.jpg';
const RANGE_EPSILON = 1e-7;
const TPS_SEGMENT_SUBDIVISIONS = 4;

export function isCurrentBasemap(document: CampusMapDocument): boolean {
  return (
    document.map.image === REFINED_GUIDE_IMAGE &&
    document.map.basemapRevision === REFINED_GUIDE_REVISION
  );
}

function applyRefinedGuideMetadata(
  document: CampusMapDocument,
): CampusMapDocument {
  const calibration =
    document.map.calibration ??
    cloneReferenceCalibration(JIANGYIN_GUIDE_CALIBRATION);
  return {
    ...document,
    map: {
      ...document.map,
      image: REFINED_GUIDE_IMAGE,
      basemapRevision: REFINED_GUIDE_REVISION,
      metersPerPixel:
        calibration.anchors.length >= 3
          ? undefined
          : document.map.metersPerPixel,
      calibration,
    },
  };
}

function sourceCalibration(document: CampusMapDocument): MapCalibration {
  const calibration = document.map.calibration;
  if (calibration && calibration.anchors.length >= 3) {
    return calibration;
  }
  if (document.map.image === LEGACY_BASEMAP_IMAGE) {
    return cloneReferenceCalibration(LEGACY_JIANGYIN_CAMPUS_CALIBRATION);
  }
  if (
    document.map.image === LEGACY_REFINED_GUIDE_IMAGE &&
    document.map.basemapRevision === LEGACY_REFINED_GUIDE_REVISION
  ) {
    return cloneReferenceCalibration(LEGACY_JIANGYIN_CAMPUS_CALIBRATION);
  }
  if (
    document.map.image === LEGACY_GEORECTIFIED_GUIDE_IMAGE &&
    document.map.basemapRevision === LEGACY_GEORECTIFIED_GUIDE_REVISION
  ) {
    return cloneReferenceCalibration(JIANGYIN_GUIDE_CALIBRATION);
  }
  if (
    document.map.image === REFINED_GUIDE_IMAGE &&
    document.map.basemapRevision === REFINED_GUIDE_REVISION
  ) {
    return cloneReferenceCalibration(JIANGYIN_GUIDE_CALIBRATION);
  }
  if (
    document.map.image === PRECISION_BASEMAP_IMAGE &&
    document.map.basemapRevision === PRECISION_BASEMAP_REVISION
  ) {
    return cloneReferenceCalibration(JIANGYIN_VECTOR_CALIBRATION);
  }
  throw new Error(
    `无法迁移未知底图“${document.map.image}”：文件没有至少 3 个地理控制点。原文件未被覆盖。`,
  );
}

function inUnitRange(value: number): boolean {
  return value >= -RANGE_EPSILON && value <= 1 + RANGE_EPSILON;
}

function checkedPoint(point: MapPoint | null, label: string): MapPoint {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !inUnitRange(point.x) ||
    !inUnitRange(point.y)
  ) {
    throw new Error(
      `${label} 在换算后超出新版底图范围；为避免静默扭曲，迁移已停止，原文件未被覆盖。`,
    );
  }
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function interpolate(
  first: MapPoint,
  second: MapPoint,
  ratio: number,
): MapPoint {
  return {
    x: first.x + (second.x - first.x) * ratio,
    y: first.y + (second.y - first.y) * ratio,
  };
}

function densify(
  points: MapPoint[],
  closed: boolean,
  subdivisions: number,
): MapPoint[] {
  if (points.length < 2 || subdivisions <= 1)
    return points.map((point) => ({ ...point }));
  const result: MapPoint[] = [];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    result.push({ ...first });
    for (let step = 1; step < subdivisions; step += 1) {
      result.push(interpolate(first, second, step / subdivisions));
    }
  }
  if (!closed) result.push({ ...points.at(-1)! });
  return result;
}

/**
 * Reprojects every editable feature through WGS-84. IDs and graph topology are
 * preserved; only normalized image coordinates and basemap metadata change.
 */
export function migrateToCurrentBasemap(
  document: CampusMapDocument,
): CampusMapDocument {
  if (isCurrentBasemap(document)) {
    return document.map.calibration
      ? document
      : applyRefinedGuideMetadata(document);
  }

  const sourceDefinition = sourceCalibration(document);
  const source = buildMapCalibration(
    sourceDefinition,
    document.map.width,
    document.map.height,
  );
  const targetDefinition = cloneReferenceCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
  );
  const target = buildMapCalibration(
    targetDefinition,
    document.map.width,
    document.map.height,
  );

  const projectWgs84 = (coordinate: Wgs84Point, label: string): MapPoint =>
    checkedPoint(target.wgs84ToImage(coordinate), label);
  const projectPoint = (point: MapPoint, label: string): MapPoint => {
    const coordinate = source.imageToWgs84(point);
    if (!coordinate) {
      throw new Error(`${label} 无法从旧底图换算为 WGS-84 坐标。`);
    }
    return projectWgs84(coordinate, label);
  };
  const projectGeometry = (
    points: MapPoint[],
    label: string,
    closed = false,
  ): MapPoint[] => {
    const subdivisions =
      sourceDefinition.method === 'thin-plate-spline'
        ? TPS_SEGMENT_SUBDIVISIONS
        : 1;
    return densify(points, closed, subdivisions).map((point, index) =>
      projectPoint(point, `${label} 第 ${index + 1} 个点`),
    );
  };

  const nodes = document.nodes.map((node) => {
    const coordinate =
      Number.isFinite(node.latitude) && Number.isFinite(node.longitude)
        ? {
            latitude: node.latitude as number,
            longitude: node.longitude as number,
          }
        : source.imageToWgs84(node);
    if (!coordinate)
      throw new Error(`节点 ${node.id} 无法换算为 WGS-84 坐标。`);
    return {
      ...node,
      ...projectWgs84(coordinate, `节点 ${node.id}`),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  const links = document.links.map((link) => {
    const from = nodesById.get(link.from);
    const to = nodesById.get(link.to);
    if (!from || !to) throw new Error(`通行段 ${link.id} 引用了不存在的节点。`);
    const geometry = projectGeometry(link.geometry, `通行段 ${link.id}`);
    geometry[0] = { x: from.x, y: from.y };
    geometry[geometry.length - 1] = { x: to.x, y: to.y };
    return { ...link, geometry };
  });

  const areas = document.areas.map((area) => ({
    ...area,
    boundary: projectGeometry(area.boundary, `通行面 ${area.id}`, true),
    obstacles: area.obstacles.map((obstacle) => ({
      ...obstacle,
      boundary: projectGeometry(
        obstacle.boundary,
        `障碍物 ${obstacle.id}`,
        true,
      ),
    })),
  }));

  return {
    ...document,
    map: {
      ...document.map,
      image: REFINED_GUIDE_IMAGE,
      basemapRevision: REFINED_GUIDE_REVISION,
      metersPerPixel: undefined,
      calibration: targetDefinition,
    },
    nodes,
    links,
    areas,
  };
}
