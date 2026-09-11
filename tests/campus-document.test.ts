import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCampusMap, serializeCampusMap } from '../lib/campus-document.ts';
import {
  DEFAULT_LEVEL,
  createEmptyCampusMap,
  type CampusMapDocument,
} from '../lib/campus-model.ts';
import {
  JIANGYIN_CAMPUS_CALIBRATION,
  REFINED_GUIDE_IMAGE,
  REFINED_GUIDE_REVISION,
  applyJiangyinReference,
} from '../lib/njust-jiangyin-reference.ts';

void test('the georectified guide and fixed WGS84 calibration survive serialization', () => {
  const document = applyJiangyinReference(createEmptyCampusMap());
  const parsed = parseCampusMap(serializeCampusMap(document));

  assert.equal(parsed.map.image, REFINED_GUIDE_IMAGE);
  assert.equal(parsed.map.basemapRevision, REFINED_GUIDE_REVISION);
  assert.equal(parsed.map.calibration?.reference.provider, 'openstreetmap');
  assert.equal(parsed.map.calibration?.reference.sourceCrs, 'WGS84');
  assert.ok(parsed.map.calibration?.reference.sourceUrl);
  assert.equal(parsed.map.calibration?.anchors.length, 4);
  assert.equal(parsed.map.calibration?.reference.center, undefined);
  assert.equal(parsed.places.length, 12);
  assert.equal(parsed.places[0].name, '北门');
});

void test('invalid calibration CRS is rejected instead of being guessed', () => {
  const document = {
    ...createEmptyCampusMap(),
    map: {
      ...createEmptyCampusMap().map,
      calibration: {
        ...JIANGYIN_CAMPUS_CALIBRATION,
        reference: {
          ...JIANGYIN_CAMPUS_CALIBRATION.reference,
          sourceCrs: 'EPSG:3857',
        },
      },
    },
  };

  assert.throws(() => parseCampusMap(JSON.stringify(document)), /sourceCrs/);
});

void test('reference places allocate collision-free IDs and remain serializable', () => {
  const occupied: CampusMapDocument = {
    ...createEmptyCampusMap(),
    nodes: [
      {
        id: 'node-reference-1',
        x: 0.5,
        y: 0.5,
        levelId: DEFAULT_LEVEL.id,
        kind: 'junction',
      },
    ],
    places: [
      {
        id: 'place-reference-1',
        name: '用户已有地点',
        nodeId: 'node-reference-1',
      },
    ],
  };

  const applied = applyJiangyinReference(occupied);
  const nodeIds = applied.nodes.map((node) => node.id);
  const placeIds = applied.places.map((place) => place.id);
  const northGate = applied.places.find((place) => place.name === '北门');

  assert.equal(new Set(nodeIds).size, nodeIds.length);
  assert.equal(new Set(placeIds).size, placeIds.length);
  assert.ok(northGate);
  assert.notEqual(northGate.id, 'place-reference-1');
  assert.notEqual(northGate.nodeId, 'node-reference-1');
  assert.ok(applied.nodes.some((node) => node.id === northGate.nodeId));
  assert.deepEqual(applied.places[0], occupied.places[0]);
  assert.deepEqual(applied.nodes[0], occupied.nodes[0]);

  const parsed = parseCampusMap(serializeCampusMap(applied));
  assert.deepEqual(
    parsed.nodes.map((node) => node.id),
    nodeIds,
  );
  assert.deepEqual(
    parsed.places.map((place) => ({
      id: place.id,
      name: place.name,
      nodeId: place.nodeId,
    })),
    applied.places,
  );
});
