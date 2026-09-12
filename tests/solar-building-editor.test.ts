import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultCampusMap,
  sameCampusMapContent,
  isPreviousBundledCampusMap,
} from '../lib/default-campus-map.ts';
import { parseCampusMap, serializeCampusMap } from '../lib/campus-document.ts';
import { deleteFeature } from '../lib/campus-editor.ts';
import { rectangleFootprint } from '../lib/njust-solar-buildings.ts';
import { migrateToCurrentBasemap } from '../lib/campus-basemap-migration.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import {
  LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
  JIANGYIN_GUIDE_CALIBRATION,
} from '../lib/njust-jiangyin-reference.ts';
import { MAP_WIDTH, MAP_HEIGHT } from '../lib/campus-model.ts';

const building = {
  id: 'custom-shadow',
  name: '测试矩形',
  heightMeters: 18.5,
  footprint: rectangleFootprint({ x: 0.55, y: 0.6 }, { x: 0.4, y: 0.45 }),
};

void test('a drawn rectangle and custom height survive document roundtrip without replacing the network', () => {
  const original = createDefaultCampusMap();
  assert.deepEqual(original.solarBuildings, []);
  const edited = { ...original, solarBuildings: [building] };
  const parsed = parseCampusMap(serializeCampusMap(edited));
  assert.deepEqual(parsed.solarBuildings, [building]);
  assert.deepEqual(parsed.links, original.links);
  assert.deepEqual(parsed.nodes, original.nodes);
  assert.equal(sameCampusMapContent(original, parsed), false);
  assert.equal(isPreviousBundledCampusMap(parsed), false);
  assert.equal(sameCampusMapContent(edited, parsed), true);
  assert.deepEqual(
    deleteFeature(parsed, { type: 'shadow', id: building.id }).solarBuildings,
    [],
  );
  assert.deepEqual(parsed.solarBuildings, [building]);
});

void test('old documents do not resurrect presets and invalid shadow geometry or heights fail import', () => {
  const original = createDefaultCampusMap();
  delete original.solarBuildings;
  assert.deepEqual(parseCampusMap(JSON.stringify(original)).solarBuildings, []);
  for (const heightMeters of [0, -1, null, '30', undefined]) {
    assert.throws(
      () =>
        parseCampusMap(
          JSON.stringify({
            ...original,
            solarBuildings: [{ ...building, heightMeters }],
          }),
        ),
      /heightMeters/,
    );
  }
  for (const footprint of [
    [],
    rectangleFootprint({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.6 }),
    rectangleFootprint({ x: -0.1, y: 0.3 }, { x: 0.3, y: 0.6 }),
  ]) {
    assert.throws(
      () =>
        parseCampusMap(
          JSON.stringify({
            ...original,
            solarBuildings: [{ ...building, footprint }],
          }),
        ),
      /footprint/,
    );
  }
  assert.throws(
    () =>
      parseCampusMap(
        JSON.stringify({ ...original, solarBuildings: [building, building] }),
      ),
    /id 重复/,
  );
});

void test('custom buildings migrate with the basemap through WGS84 and preserve their heights', () => {
  const original = createDefaultCampusMap();
  const legacy = {
    ...original,
    nodes: [],
    places: [],
    links: [],
    areas: [],
    solarBuildings: [building],
    map: {
      ...original.map,
      image: 'map.jpg',
      basemapRevision: undefined,
      calibration: LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    },
  };
  const migrated = migrateToCurrentBasemap(legacy);
  const source = buildMapCalibration(
    LEGACY_JIANGYIN_CAMPUS_CALIBRATION,
    MAP_WIDTH,
    MAP_HEIGHT,
  );
  const target = buildMapCalibration(
    JIANGYIN_GUIDE_CALIBRATION,
    MAP_WIDTH,
    MAP_HEIGHT,
  );
  assert.equal(migrated.solarBuildings?.[0].heightMeters, 18.5);
  const expected = target.wgs84ToImage(
    source.imageToWgs84(building.footprint[0])!,
  );
  assert.ok(expected);
  assert.deepEqual(migrated.solarBuildings?.[0].footprint[0], expected);
  assert.deepEqual(
    parseCampusMap(serializeCampusMap(migrated)).solarBuildings,
    migrated.solarBuildings,
  );
});
