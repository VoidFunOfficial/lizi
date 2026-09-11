import { MAP_HEIGHT, MAP_WIDTH, type MapPoint } from './campus-model.ts';
import { buildMapCalibration } from './map-calibration.ts';
import {
  JIANGYIN_GUIDE_CALIBRATION,
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  REFINED_GUIDE_IMAGE,
  REFINED_GUIDE_REVISION,
} from './njust-jiangyin-reference.ts';

export type SolarBuildingKind = 'dormitory' | 'zhi-building';

export type SolarBuilding = {
  id: string;
  name: string;
  kind: SolarBuildingKind;
  heightMeters: 30 | 35;
  footprint: [MapPoint, MapPoint, MapPoint, MapPoint];
};

const SOURCE_GUIDE_CALIBRATION = buildMapCalibration(
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  MAP_WIDTH,
  MAP_HEIGHT,
);
const TARGET_GUIDE_CALIBRATION = buildMapCalibration(
  JIANGYIN_GUIDE_CALIBRATION,
  MAP_WIDTH,
  MAP_HEIGHT,
);

function projectSourcePixelToActiveMap(x: number, y: number): MapPoint {
  const wgs84 = SOURCE_GUIDE_CALIBRATION.imageToWgs84({
    x: x / MAP_WIDTH,
    y: y / MAP_HEIGHT,
  });
  const target = wgs84 ? TARGET_GUIDE_CALIBRATION.wgs84ToImage(wgs84) : null;
  if (!target) throw new Error('建筑轮廓无法投影到当前纠偏底图');
  return target;
}

function rectangularPrism(
  id: string,
  name: string,
  kind: SolarBuildingKind,
  heightMeters: 30 | 35,
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  clockwiseDegrees = 0,
): SolarBuilding {
  const radians = (clockwiseDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const point = (localX: number, localY: number): MapPoint =>
    projectSourcePixelToActiveMap(
      centerX + localX * cosine - localY * sine,
      centerY + localX * sine + localY * cosine,
    );
  return {
    id,
    name,
    kind,
    heightMeters,
    footprint: [
      point(-width / 2, -depth / 2),
      point(width / 2, -depth / 2),
      point(width / 2, depth / 2),
      point(-width / 2, depth / 2),
    ],
  };
}

const dormitory = (
  name: string,
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  clockwiseDegrees = 0,
) =>
  rectangularPrism(
    `dormitory-${name.toLocaleLowerCase('en-US')}`,
    `学生宿舍${name}`,
    'dormitory',
    35,
    centerX,
    centerY,
    width,
    depth,
    clockwiseDegrees,
  );

const zhiBuilding = (
  name: string,
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  clockwiseDegrees = 0,
) =>
  rectangularPrism(
    `zhi-${name}`,
    `致${name}楼`,
    'zhi-building',
    30,
    centerX,
    centerY,
    width,
    depth,
    clockwiseDegrees,
  );

export const NJUST_SOLAR_BUILDING_MODEL = {
  schemaVersion: 2,
  basemapRevision: REFINED_GUIDE_REVISION,
  basemapSha256:
    'd7ee892f3d74471b01527f4fe62b17d22afca3509e7de5da5d7f35f8ac009c14',
  sourceImage: 'map-high.jpg',
  targetImage: `public/${REFINED_GUIDE_IMAGE}`,
  coordinateTransform: 'legacy-guide -> WGS84 -> georectified-guide',
  sourceStatement:
    'Footprints are oriented rectangles traced in the user-supplied source guide coordinate layer, then projected through its WGS84 calibration into the active georectified guide. They are reference-grade rather than surveyed geometry.',
  buildings: [
    dormitory('1A', 292, 928, 140, 43, -1),
    dormitory('1B', 293, 986, 140, 43, -1),
    dormitory('2A', 430, 925, 132, 43, -1),
    dormitory('2B', 431, 982, 132, 43, -1),
    dormitory('3A', 292, 1043, 142, 43, -1),
    dormitory('3B', 294, 1099, 144, 43, -1),
    dormitory('4A', 433, 1036, 136, 43, -1),
    dormitory('4B', 435, 1092, 138, 43, -1),
    dormitory('5A', 646, 334, 145, 46, -2),
    dormitory('5B', 647, 392, 145, 46, -2),
    dormitory('6A', 646, 440, 148, 46, -2),
    dormitory('6B', 648, 497, 148, 46, -2),
    dormitory('7', 1474, 460, 118, 45, -1),
    dormitory('8', 1570, 458, 106, 45, -1),
    dormitory('9A', 1677, 409, 138, 45, -1),
    dormitory('9B', 1679, 461, 138, 45, -1),
    dormitory('10A', 1528, 571, 132, 45, -1),
    dormitory('10B', 1531, 624, 132, 45, -1),
    dormitory('11A', 1650, 553, 136, 45, -1),
    dormitory('11B', 1653, 607, 136, 45, -1),
    zhiBuilding('理', 900, 407, 142, 108, -1),
    zhiBuilding('新', 899, 505, 140, 103, -1),
    zhiBuilding('知', 660, 568, 170, 70, -1),
    zhiBuilding('真', 638, 620, 122, 66, -1),
    zhiBuilding('道', 650, 787, 142, 72, -1),
    zhiBuilding('源', 667, 852, 172, 76, -1),
    zhiBuilding('远', 884, 1001, 182, 186, -1),
  ],
} as const satisfies {
  schemaVersion: 2;
  basemapRevision: string;
  basemapSha256: string;
  sourceImage: string;
  targetImage: string;
  coordinateTransform: string;
  sourceStatement: string;
  buildings: readonly SolarBuilding[];
};

export const NJUST_SOLAR_BUILDINGS: readonly SolarBuilding[] =
  NJUST_SOLAR_BUILDING_MODEL.buildings;
