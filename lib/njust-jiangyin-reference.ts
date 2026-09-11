import { buildMapCalibration } from './map-calibration.ts';
import {
  DEFAULT_LEVEL,
  type CampusMapDocument,
  type MapCalibration,
  type Wgs84Point,
} from './campus-model.ts';

export const PRECISION_BASEMAP_IMAGE = 'campus-precise.svg';
export const PRECISION_BASEMAP_REVISION = 'njust-jiangyin-2026-08-30';
export const LEGACY_REFINED_GUIDE_IMAGE = 'campus-guide-refined.jpg';
export const LEGACY_REFINED_GUIDE_REVISION =
  'njust-jiangyin-guide-refined-2026-08-30';
export const LEGACY_GEORECTIFIED_GUIDE_IMAGE = 'campus-guide-georectified.png';
export const LEGACY_GEORECTIFIED_GUIDE_REVISION =
  'njust-jiangyin-guide-georectified-2026-08-30';
export const REFINED_GUIDE_IMAGE = 'campus-guide-georectified-high.png';
export const REFINED_GUIDE_REVISION =
  'njust-jiangyin-guide-georectified-high-2026-08-30';

export const JIANGYIN_CAMPUS_BOUNDS = {
  west: 120.1459,
  east: 120.16115,
  north: 31.90918,
  south: 31.90105,
} as const;

export const JIANGYIN_CAMPUS_CENTER = {
  latitude: (JIANGYIN_CAMPUS_BOUNDS.north + JIANGYIN_CAMPUS_BOUNDS.south) / 2,
  longitude: (JIANGYIN_CAMPUS_BOUNDS.east + JIANGYIN_CAMPUS_BOUNDS.west) / 2,
} as const;

export const JIANGYIN_BAIDU_REFERENCE_URL =
  'https://map.baidu.com/@13377094.41932182,3728558.053357122,16.52z/maptype%3DB_EARTH_MAP';

export const JIANGYIN_BAIDU_VISUAL_REFERENCE_URL =
  'https://map.baidu.com/@13376826.784635235,3728596.452133226,17.75z/maptype%3DB_EARTH_MAP';

export const LEGACY_JIANGYIN_CAMPUS_CALIBRATION = {
  schemaVersion: 1,
  method: 'affine',
  reference: {
    provider: 'baidu',
    sourceUrl: JIANGYIN_BAIDU_REFERENCE_URL,
    sourceCrs: 'BD09MC',
    mapType: 'B_EARTH_MAP',
    center: {
      x: 13377094.41932182,
      y: 3728558.053357122,
      zoom: 16.52,
    },
  },
  anchors: [
    {
      id: 'boundary-northwest',
      label: '西北边界',
      image: { x: 0.06476938, y: 0.21422987 },
      source: {
        crs: 'WGS84',
        latitude: 31.9073008,
        longitude: 120.1470269,
      },
      wgs84: { latitude: 31.9073008, longitude: 120.1470269 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630888',
    },
    {
      id: 'boundary-west-upper',
      label: '西侧上段',
      image: { x: 0.06476938, y: 0.37372948 },
      source: {
        crs: 'WGS84',
        latitude: 31.9059289,
        longitude: 120.1470172,
      },
      wgs84: { latitude: 31.9059289, longitude: 120.1470172 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630889',
    },
    {
      id: 'boundary-west-gate',
      label: '西门边界',
      image: { x: 0.07114818, y: 0.53948397 },
      source: {
        crs: 'WGS84',
        latitude: 31.9047912,
        longitude: 120.1472266,
      },
      wgs84: { latitude: 31.9047912, longitude: 120.1472266 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630891',
    },
    {
      id: 'boundary-southwest',
      label: '西南角',
      image: { x: 0.06673209, y: 0.91321345 },
      source: {
        crs: 'WGS84',
        latitude: 31.9018262,
        longitude: 120.1475568,
      },
      wgs84: { latitude: 31.9018262, longitude: 120.1475568 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630894',
    },
    {
      id: 'boundary-south-west',
      label: '南侧西段',
      image: { x: 0.36555447, y: 0.91243159 },
      source: {
        crs: 'WGS84',
        latitude: 31.9019374,
        longitude: 120.1517195,
      },
      wgs84: { latitude: 31.9019374, longitude: 120.1517195 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630897',
    },
    {
      id: 'boundary-southeast',
      label: '东南角',
      image: { x: 0.90677134, y: 0.89992181 },
      source: {
        crs: 'WGS84',
        latitude: 31.9021816,
        longitude: 120.1594788,
      },
      wgs84: { latitude: 31.9021816, longitude: 120.1594788 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630878',
    },
    {
      id: 'boundary-east-middle',
      label: '东侧中段',
      image: { x: 0.91756624, y: 0.59265051 },
      source: {
        crs: 'WGS84',
        latitude: 31.9044557,
        longitude: 120.159747,
      },
      wgs84: { latitude: 31.9044557, longitude: 120.159747 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630879',
    },
    {
      id: 'boundary-northeast',
      label: '东北角',
      image: { x: 0.9357213, y: 0.24237686 },
      source: {
        crs: 'WGS84',
        latitude: 31.9072744,
        longitude: 120.1597787,
      },
      wgs84: { latitude: 31.9072744, longitude: 120.1597787 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630880',
    },
    {
      id: 'boundary-north-east',
      label: '北侧东段',
      image: { x: 0.70314033, y: 0.24003127 },
      source: {
        crs: 'WGS84',
        latitude: 31.9071704,
        longitude: 120.1563404,
      },
      wgs84: { latitude: 31.9071704, longitude: 120.1563404 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630881',
    },
    {
      id: 'boundary-north-gate-east',
      label: '北门东侧',
      image: { x: 0.60598626, y: 0.2236122 },
      source: {
        crs: 'WGS84',
        latitude: 31.9072062,
        longitude: 120.1548971,
      },
      wgs84: { latitude: 31.9072062, longitude: 120.1548971 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630882',
    },
    {
      id: 'boundary-north-middle',
      label: '北侧中段',
      image: { x: 0.44259078, y: 0.19311962 },
      source: {
        crs: 'WGS84',
        latitude: 31.907391,
        longitude: 120.1525343,
      },
      wgs84: { latitude: 31.907391, longitude: 120.1525343 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630883',
    },
    {
      id: 'boundary-north-west',
      label: '北侧西段',
      image: { x: 0.25368008, y: 0.13604378 },
      source: {
        crs: 'WGS84',
        latitude: 31.9078228,
        longitude: 120.1499887,
      },
      wgs84: { latitude: 31.9078228, longitude: 120.1499887 },
      accuracyMeters: 10,
      sourceFeatureId: 'openstreetmap:node/12169630884',
    },
  ],
  capturedAt: '2026-08-30T00:00:00.000Z',
  notes:
    '以百度卫星图核对同一校园轮廓，WGS-84 控制坐标来自 OpenStreetMap way 1314812014。预置全局仿射的留一验证约 16 米；它可校正旋转和横纵比例，但正式使用前仍应以现场 GNSS 点复核校门和建筑入口，再视控制点密度切换 TPS。',
} satisfies MapCalibration;

const precisionAnchor = (
  id: string,
  label: string,
  image: { x: number; y: number },
  wgs84: Wgs84Point,
  accuracyMeters = 10,
) => ({
  id,
  label,
  image,
  source: { crs: 'WGS84' as const, ...wgs84 },
  wgs84,
  accuracyMeters,
});

/**
 * The SVG generator uses this exact north-up WGS-84 extent. The four corner
 * anchors therefore describe the projection, rather than an imagery fit.
 * Building and boundary source accuracy is tracked separately in the notes.
 */
export const JIANGYIN_VECTOR_CALIBRATION = {
  schemaVersion: 1,
  method: 'affine',
  reference: {
    provider: 'overture',
    sourceUrl: 'https://docs.overturemaps.org/guides/buildings/',
    sourceCrs: 'WGS84',
    mapType: 'local-vector-svg',
  },
  anchors: [
    precisionAnchor(
      'precision-northwest',
      '底图西北角',
      { x: 0, y: 0 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.north,
        longitude: JIANGYIN_CAMPUS_BOUNDS.west,
      },
    ),
    precisionAnchor(
      'precision-northeast',
      '底图东北角',
      { x: 1, y: 0 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.north,
        longitude: JIANGYIN_CAMPUS_BOUNDS.east,
      },
    ),
    precisionAnchor(
      'precision-southeast',
      '底图东南角',
      { x: 1, y: 1 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.south,
        longitude: JIANGYIN_CAMPUS_BOUNDS.east,
      },
    ),
    precisionAnchor(
      'precision-southwest',
      '底图西南角',
      { x: 0, y: 1 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.south,
        longitude: JIANGYIN_CAMPUS_BOUNDS.west,
      },
    ),
  ],
  capturedAt: '2026-08-19T00:00:00.000Z',
  notes:
    '坐标网格由固定 WGS-84 范围确定，可稳定往返换算；校界来自 OpenStreetMap way 1314812014，建筑轮廓来自 Overture Maps 2026-08-19.0 Buildings。开放数据为影像提取的参考级几何，不是测绘或现场 GNSS 真值。',
} satisfies MapCalibration;

/**
 * The active raster is physically resampled into the same fixed, north-up
 * WGS-84 grid as the vector reference layer. Its corner mapping is exact, but
 * the artwork inside the frame still inherits the legacy guide's independently
 * validated ~16 metre uncertainty, so the declared accuracy stays conservative.
 */
export const JIANGYIN_GEORECTIFIED_CALIBRATION = {
  schemaVersion: 1,
  method: 'affine',
  reference: {
    provider: 'openstreetmap',
    sourceUrl: 'https://www.openstreetmap.org/way/1314812014',
    sourceCrs: 'WGS84',
    mapType: 'georectified-raster-guide',
  },
  anchors: [
    precisionAnchor(
      'guide-northwest',
      '纠偏底图西北角',
      { x: 0, y: 0 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.north,
        longitude: JIANGYIN_CAMPUS_BOUNDS.west,
      },
      16,
    ),
    precisionAnchor(
      'guide-northeast',
      '纠偏底图东北角',
      { x: 1, y: 0 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.north,
        longitude: JIANGYIN_CAMPUS_BOUNDS.east,
      },
      16,
    ),
    precisionAnchor(
      'guide-southeast',
      '纠偏底图东南角',
      { x: 1, y: 1 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.south,
        longitude: JIANGYIN_CAMPUS_BOUNDS.east,
      },
      16,
    ),
    precisionAnchor(
      'guide-southwest',
      '纠偏底图西南角',
      { x: 0, y: 1 },
      {
        latitude: JIANGYIN_CAMPUS_BOUNDS.south,
        longitude: JIANGYIN_CAMPUS_BOUNDS.west,
      },
      16,
    ),
  ],
  capturedAt: '2026-08-30T00:00:00.000Z',
  notes:
    '高清导览图与已校准原图保持同一归一化构图，40 个特征块全部匹配，因此沿用由 12 个 OpenStreetMap 校界控制点拟合的全局仿射，并以 7500×4710 像素重采样到固定 WGS-84 网格；百度卫星页仅用于人工视觉核对。源模型拟合 RMS 约 11.38 米、留一 RMS 约 15.85 米。角点投影可逆不代表图内地物达到测绘精度。',
} satisfies MapCalibration;

export const JIANGYIN_GUIDE_CALIBRATION = JIANGYIN_GEORECTIFIED_CALIBRATION;

// Compatibility export for callers that refer to the active campus guide.
export const JIANGYIN_CAMPUS_CALIBRATION = JIANGYIN_GUIDE_CALIBRATION;

export const JIANGYIN_REFERENCE_PLACES: Array<{
  name: string;
  category: 'gate' | 'building' | 'service';
  wgs84: Wgs84Point;
}> = [
  {
    name: '北门',
    category: 'gate',
    wgs84: { latitude: 31.906898216191735, longitude: 120.15351399972751 },
  },
  {
    name: '南门',
    category: 'gate',
    wgs84: { latitude: 31.902152268930013, longitude: 120.15376959201558 },
  },
  {
    name: '西门',
    category: 'gate',
    wgs84: { latitude: 31.90461801435657, longitude: 120.14741093767962 },
  },
  {
    name: '西南门',
    category: 'gate',
    wgs84: { latitude: 31.901818237243784, longitude: 120.1496127625781 },
  },
  {
    name: '东北门',
    category: 'gate',
    wgs84: { latitude: 31.90582494482832, longitude: 120.15975402335918 },
  },
  {
    name: '图书馆',
    category: 'building',
    wgs84: { latitude: 31.904740036396873, longitude: 120.15365932099425 },
  },
  {
    name: '李良宝体育馆',
    category: 'building',
    wgs84: { latitude: 31.90558545544128, longitude: 120.14802797098189 },
  },
  {
    name: '工程训练中心',
    category: 'building',
    wgs84: { latitude: 31.905583224203927, longitude: 120.14933726772955 },
  },
  {
    name: '国际学术交流中心',
    category: 'building',
    wgs84: { latitude: 31.903903252574164, longitude: 120.14823493702056 },
  },
  {
    name: '钟楼',
    category: 'building',
    wgs84: { latitude: 31.90401806080775, longitude: 120.15257812958262 },
  },
  {
    name: '鼎新大厦',
    category: 'building',
    wgs84: { latitude: 31.906401243015406, longitude: 120.1545444661927 },
  },
  {
    name: '医务室',
    category: 'service',
    wgs84: { latitude: 31.903585853596468, longitude: 120.15527794483346 },
  },
];

export function cloneReferenceCalibration(
  source: MapCalibration = JIANGYIN_GUIDE_CALIBRATION,
): MapCalibration {
  return {
    ...source,
    reference: {
      ...source.reference,
      center: source.reference.center
        ? { ...source.reference.center }
        : undefined,
    },
    anchors: source.anchors.map((anchor) => ({
      ...anchor,
      image: { ...anchor.image },
      source: { ...anchor.source },
      wgs84: { ...anchor.wgs84 },
    })),
  };
}

export function applyJiangyinReference(
  document: CampusMapDocument,
  includePlaces = true,
): CampusMapDocument {
  const calibration = cloneReferenceCalibration();
  const nextMap = {
    ...document.map,
    image: REFINED_GUIDE_IMAGE,
    basemapRevision: REFINED_GUIDE_REVISION,
    metersPerPixel: undefined,
    calibration,
  };
  if (!includePlaces) {
    return { ...document, map: nextMap };
  }
  const built = buildMapCalibration(
    calibration,
    document.map.width,
    document.map.height,
  );
  const nodes = [...document.nodes];
  const places = [...document.places];
  const existingNames = new Set(
    places.map((place) => place.name.trim().toLocaleLowerCase('zh-CN')),
  );
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const existingPlaceIds = new Set(places.map((place) => place.id));
  for (const [index, place] of JIANGYIN_REFERENCE_PLACES.entries()) {
    const normalizedName = place.name.trim().toLocaleLowerCase('zh-CN');
    if (existingNames.has(normalizedName)) continue;
    const nodeIdBase = `node-reference-${index + 1}`;
    const placeIdBase = `place-reference-${index + 1}`;
    let nodeId = nodeIdBase;
    let placeId = placeIdBase;
    let nodeSuffix = 2;
    let placeSuffix = 2;
    while (existingNodeIds.has(nodeId)) {
      nodeId = `${nodeIdBase}-${nodeSuffix}`;
      nodeSuffix += 1;
    }
    while (existingPlaceIds.has(placeId)) {
      placeId = `${placeIdBase}-${placeSuffix}`;
      placeSuffix += 1;
    }
    const image = built.wgs84ToImage(place.wgs84);
    if (!image) continue;
    nodes.push({
      id: nodeId,
      ...image,
      levelId: document.levels[0]?.id ?? DEFAULT_LEVEL.id,
      kind: place.category === 'gate' ? 'portal' : 'junction',
      latitude: place.wgs84.latitude,
      longitude: place.wgs84.longitude,
    });
    places.push({ id: placeId, name: place.name, nodeId });
    existingNames.add(normalizedName);
    existingNodeIds.add(nodeId);
    existingPlaceIds.add(placeId);
  }
  return {
    ...document,
    map: nextMap,
    nodes,
    places,
  };
}
