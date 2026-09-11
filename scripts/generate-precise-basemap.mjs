#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INPUTS = {
  boundary: join(ROOT, 'data/campus-boundary.geojson'),
  buildings: join(ROOT, 'data/campus-buildings.geojson'),
  schematic: join(ROOT, 'data/campus-schematic-context.json'),
};
const OUTPUT = join(ROOT, 'public/campus-precise.svg');

const WIDTH = 2038;
const HEIGHT = 1279;
const EXTENT = Object.freeze({
  west: 120.1459,
  east: 120.16115,
  north: 31.90918,
  south: 31.90105,
});

const SNAPSHOT_DATE = '2026-08-30';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function number(value) {
  return Number(value.toFixed(2)).toString();
}

function projectWgs84([longitude, latitude]) {
  invariant(
    Number.isFinite(longitude) && Number.isFinite(latitude),
    'Invalid WGS84 coordinate',
  );
  return [
    ((longitude - EXTENT.west) / (EXTENT.east - EXTENT.west)) * WIDTH,
    ((EXTENT.north - latitude) / (EXTENT.north - EXTENT.south)) * HEIGHT,
  ];
}

function legacyToWgs84([x, y], affine) {
  invariant(
    x >= 0 && x <= 1 && y >= 0 && y <= 1,
    `Legacy point outside 0..1: ${x}, ${y}`,
  );
  const [lonX, lonY, lonOffset] = affine.longitude;
  const [latX, latY, latOffset] = affine.latitude;
  return [lonX * x + lonY * y + lonOffset, latX * x + latY * y + latOffset];
}

function ringPath(ring, projector = projectWgs84) {
  invariant(
    Array.isArray(ring) && ring.length >= 4,
    'Polygon ring must contain at least four points',
  );
  const points = ring.map(projector);
  return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${number(x)} ${number(y)}`).join(' ')} Z`;
}

function polygonPath(geometry, projector = projectWgs84) {
  invariant(
    geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type),
    `Unsupported polygon geometry: ${geometry?.type}`,
  );
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .flatMap((polygon) => polygon.map((ring) => ringPath(ring, projector)))
    .join(' ');
}

function linePath(coordinates, projector) {
  invariant(
    Array.isArray(coordinates) && coordinates.length >= 2,
    'Line needs at least two points',
  );
  return coordinates
    .map(projector)
    .map(
      ([x, y], index) => `${index === 0 ? 'M' : 'L'}${number(x)} ${number(y)}`,
    )
    .join(' ');
}

function eachCoordinate(geometry, visit) {
  const walk = (value) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      value.every(Number.isFinite)
    ) {
      visit(value);
      return;
    }
    invariant(Array.isArray(value), 'Malformed GeoJSON coordinates');
    value.forEach(walk);
  };
  walk(geometry.coordinates);
}

function validateCollection(collection, name) {
  invariant(
    collection?.type === 'FeatureCollection',
    `${name} must be a GeoJSON FeatureCollection`,
  );
  invariant(Array.isArray(collection.features), `${name} features missing`);
  for (const feature of collection.features) {
    invariant(feature?.type === 'Feature', `${name} contains a non-Feature`);
    eachCoordinate(feature.geometry, ([longitude, latitude]) => {
      invariant(
        longitude >= EXTENT.west &&
          longitude <= EXTENT.east &&
          latitude >= EXTENT.south &&
          latitude <= EXTENT.north,
        `${name} coordinate ${longitude}, ${latitude} is outside the fixed extent`,
      );
    });
  }
}

function validateFixedExtent(metadata, name) {
  const actual = metadata?.fixedExtent;
  const expected = {
    ...EXTENT,
    width: WIDTH,
    height: HEIGHT,
    crs: 'EPSG:4326',
  };
  invariant(actual, `${name} fixedExtent metadata missing`);
  for (const [key, value] of Object.entries(expected)) {
    invariant(
      actual[key] === value,
      `${name} fixedExtent.${key} must be ${value}, got ${actual[key]}`,
    );
  }
}

function longitudeGrid() {
  const lines = [];
  const start = Math.ceil(EXTENT.west * 1000);
  const end = Math.floor(EXTENT.east * 1000);
  for (let milli = start; milli <= end; milli += 1) {
    const longitude = milli / 1000;
    const [x] = projectWgs84([longitude, EXTENT.south]);
    lines.push(
      `<line x1="${number(x)}" y1="0" x2="${number(x)}" y2="${HEIGHT}"/>`,
    );
    if (milli % 2 === 0) {
      lines.push(
        `<text x="${number(x + 5)}" y="22">${longitude.toFixed(3)}°E</text>`,
      );
    }
  }
  return lines.join('\n      ');
}

function latitudeGrid() {
  const lines = [];
  const start = Math.ceil(EXTENT.south * 1000);
  const end = Math.floor(EXTENT.north * 1000);
  for (let milli = start; milli <= end; milli += 1) {
    const latitude = milli / 1000;
    const [, y] = projectWgs84([EXTENT.west, latitude]);
    lines.push(
      `<line x1="0" y1="${number(y)}" x2="${WIDTH}" y2="${number(y)}"/>`,
    );
    if (milli % 2 === 0) {
      lines.push(
        `<text x="8" y="${number(y - 6)}">${latitude.toFixed(3)}°N</text>`,
      );
    }
  }
  return lines.join('\n      ');
}

function renderSchematic(schematic) {
  const affine = schematic.legacyAffineToWgs84;
  invariant(
    Array.isArray(affine?.longitude) && affine.longitude.length === 3,
    'Legacy longitude affine missing',
  );
  invariant(
    Array.isArray(affine?.latitude) && affine.latitude.length === 3,
    'Legacy latitude affine missing',
  );
  invariant(
    schematic.source?.baiduGeometryUsed === false,
    'The schematic layer must not contain Baidu-derived geometry',
  );
  const projectLegacy = (point) => projectWgs84(legacyToWgs84(point, affine));

  const water = schematic.water.map((feature) => {
    const common = `id="${escapeXml(feature.id)}" data-source="legacy-guide" data-confidence="${escapeXml(feature.confidence)}"`;
    if (feature.kind === 'waterbody') {
      return `<path ${common} class="legacy-waterbody" d="${ringPath(feature.coordinates, projectLegacy)}"/>`;
    }
    return `<path ${common} class="legacy-waterway" d="${linePath(feature.coordinates, projectLegacy)}"/>`;
  });

  const circulation = schematic.circulation.map(
    (feature) =>
      `<path id="${escapeXml(feature.id)}" data-source="legacy-guide" data-confidence="${escapeXml(feature.confidence)}" class="legacy-circulation" d="${linePath(feature.coordinates, projectLegacy)}"/>`,
  );

  const labels = schematic.labels.map((label) => {
    const [x, y] = projectLegacy(label.coordinate);
    const isGate = label.kind === 'gate';
    const marker = isGate
      ? `<circle cx="${number(x)}" cy="${number(y)}" r="5"/>`
      : '';
    const offset = isGate ? -13 : 0;
    return `<g id="${escapeXml(label.id)}" data-source="legacy-guide" data-confidence="${escapeXml(label.confidence)}" class="legacy-label ${isGate ? 'legacy-label-gate' : 'legacy-label-building'}">${marker}<text x="${number(x)}" y="${number(y + offset)}">◇ ${escapeXml(label.text)}</text></g>`;
  });

  return { water, circulation, labels };
}

function renderBuildings(collection) {
  return [...collection.features]
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .map((feature, index) => {
      const featureId = feature.id ?? `building-${index + 1}`;
      return `<path id="building-${index + 1}" data-overture-id="${escapeXml(featureId)}" class="building" fill-rule="evenodd" d="${polygonPath(feature.geometry)}"><title>Overture building ${escapeXml(featureId)}</title></path>`;
    });
}

function scaleBar() {
  const centerLatitudeRadians =
    ((EXTENT.north + EXTENT.south) / 2) * (Math.PI / 180);
  const metersPerLongitudeDegree = 111_320 * Math.cos(centerLatitudeRadians);
  const metersPerPixel =
    ((EXTENT.east - EXTENT.west) * metersPerLongitudeDegree) / WIDTH;
  const lengthMeters = 200;
  const lengthPixels = lengthMeters / metersPerPixel;
  const x = WIDTH - lengthPixels - 48;
  const y = HEIGHT - 64;
  return `<g id="scale-bar" aria-label="200 metre scale bar">
    <line x1="${number(x)}" y1="${y}" x2="${number(x + lengthPixels)}" y2="${y}"/>
    <line x1="${number(x)}" y1="${y - 7}" x2="${number(x)}" y2="${y + 7}"/>
    <line x1="${number(x + lengthPixels)}" y1="${y - 7}" x2="${number(x + lengthPixels)}" y2="${y + 7}"/>
    <text x="${number(x + lengthPixels / 2)}" y="${y - 12}">200 m</text>
  </g>`;
}

const boundaryCollection = readJson(INPUTS.boundary);
const buildingCollection = readJson(INPUTS.buildings);
const schematic = readJson(INPUTS.schematic);

validateCollection(boundaryCollection, 'campus boundary');
validateCollection(buildingCollection, 'campus buildings');
validateFixedExtent(boundaryCollection.metadata, 'campus boundary');
validateFixedExtent(buildingCollection.metadata, 'campus buildings');
validateFixedExtent({ fixedExtent: schematic.fixedExtent }, 'campus schematic');
invariant(
  boundaryCollection.features.length === 1,
  'Expected one campus boundary feature',
);
invariant(
  buildingCollection.features.length === 85,
  `Expected 85 campus buildings, got ${buildingCollection.features.length}`,
);
invariant(
  boundaryCollection.features[0].properties?.osmId === 1314812014,
  'Campus boundary must be OSM way 1314812014',
);

const boundaryPath = polygonPath(boundaryCollection.features[0].geometry);
const buildingPaths = renderBuildings(buildingCollection);
const schematicLayers = renderSchematic(schematic);

const metadata = {
  schemaVersion: 1,
  generatedBy: 'scripts/generate-precise-basemap.mjs',
  sourceSnapshotDate: SNAPSHOT_DATE,
  width: WIDTH,
  height: HEIGHT,
  crs: 'EPSG:4326',
  projection: 'linear longitude/latitude to fixed SVG viewport',
  extent: EXTENT,
  authoritativeLayers: {
    boundary: 'OpenStreetMap way 1314812014, ODbL-1.0',
    buildings: 'Overture Maps buildings theme; East Asian Buildings upstream',
  },
  schematicLayer: {
    source: 'user-supplied legacy campus guide map',
    confidence: 'low',
    measured: false,
    baiduGeometryUsed: false,
  },
};

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated file. Run: node scripts/generate-precise-basemap.mjs -->
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-description" data-crs="EPSG:4326" data-west="${EXTENT.west}" data-east="${EXTENT.east}" data-north="${EXTENT.north}" data-south="${EXTENT.south}">
  <title id="map-title">南京理工大学江阴校区地理参考标注底图</title>
  <desc id="map-description">固定 WGS84 范围中的 OpenStreetMap 校界和 85 个 Overture 建筑轮廓。水体、道路与地名仅为旧导览图低置信度示意。</desc>
  <metadata>${escapeXml(JSON.stringify(metadata))}</metadata>
  <defs>
    <clipPath id="campus-clip"><path d="${boundaryPath}"/></clipPath>
    <style>
      .wgs-grid line { stroke: #dedfdc; stroke-width: 1; }
      .wgs-grid text { fill: #8a8c89; font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .campus-ground { fill: #f0f1ed; }
      .legacy-waterbody { fill: #dce3e3; stroke: #aebabb; stroke-width: 2; stroke-dasharray: 8 7; }
      .legacy-waterway { fill: none; stroke: #c6d0d0; stroke-width: 19; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 11 8; opacity: .72; }
      .legacy-circulation { fill: none; stroke: #c8c9c5; stroke-width: 13; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 13 9; opacity: .58; }
      .building { fill: #d4d5d1; stroke: #969995; stroke-width: 2.2; vector-effect: non-scaling-stroke; }
      .campus-boundary { fill: none; stroke: #616460; stroke-width: 4; vector-effect: non-scaling-stroke; }
      .legacy-label circle { fill: #f7f7f4; stroke: #696c68; stroke-width: 2; }
      .legacy-label text { fill: #50534f; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: #f7f7f4; stroke-width: 7; stroke-linejoin: round; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
      .legacy-label-building text { font-size: 23px; font-weight: 620; }
      .legacy-label-gate text { font-size: 21px; font-weight: 650; }
      .map-note { fill: #656864; font: 15px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
      #scale-bar line { stroke: #555854; stroke-width: 3; }
      #scale-bar text { fill: #555854; text-anchor: middle; font: 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      #north-arrow path { fill: #555854; }
      #north-arrow text { fill: #555854; text-anchor: middle; font: 700 18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f7f4"/>
  <g id="wgs84-grid" class="wgs-grid" aria-label="WGS84 coordinate grid">
      ${longitudeGrid()}
      ${latitudeGrid()}
  </g>
  <path id="campus-ground" class="campus-ground" d="${boundaryPath}"/>
  <g id="legacy-schematic-layer" clip-path="url(#campus-clip)" data-source="legacy-guide" data-confidence="low" data-measured="false" aria-label="旧导览图低置信度示意层">
    <g id="legacy-water">${schematicLayers.water.join('\n      ')}</g>
    <g id="legacy-primary-circulation">${schematicLayers.circulation.join('\n      ')}</g>
  </g>
  <g id="overture-buildings" clip-path="url(#campus-clip)" aria-label="Overture building footprints">
    ${buildingPaths.join('\n    ')}
  </g>
  <path id="osm-campus-boundary" data-osm-id="way/1314812014" class="campus-boundary" d="${boundaryPath}"/>
  <g id="legacy-reference-labels" data-source="legacy-guide" data-confidence="low" aria-label="旧导览图低置信度地名">
    ${schematicLayers.labels.join('\n    ')}
  </g>
  <g id="north-arrow" transform="translate(${WIDTH - 55} 56)" aria-label="North arrow">
    <text x="0" y="-17">N</text>
    <path d="M0 -8 L-10 18 L0 13 L10 18 Z"/>
  </g>
  ${scaleBar()}
  <text class="map-note" x="34" y="${HEIGHT - 47}">◇ / 虚线：旧导览图低置信度示意，非测绘；路线与入口请现场复核</text>
  <text class="map-note" x="34" y="${HEIGHT - 23}">© OpenStreetMap contributors · Overture Maps Foundation · East Asian Buildings contributors (CC BY 4.0) · ${SNAPSHOT_DATE}</text>
</svg>
`;

writeFileSync(OUTPUT, svg, 'utf8');

const stats = {
  output: OUTPUT,
  size: `${WIDTH}x${HEIGHT}`,
  extent: EXTENT,
  boundaryFeatures: boundaryCollection.features.length,
  buildings: buildingPaths.length,
  schematicWaterFeatures: schematicLayers.water.length,
  schematicCirculationFeatures: schematicLayers.circulation.length,
  schematicLabels: schematicLayers.labels.length,
};
console.log(JSON.stringify(stats, null, 2));
