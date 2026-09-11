import assert from 'node:assert/strict';
import test from 'node:test';

import { compileCampusMap } from '../lib/campus-navigator.ts';
import {
  createDefaultCampusMap,
  isReferenceOnlyPlaceholder,
  isPreviousBundledCampusMap,
  sameCampusMapContent,
} from '../lib/default-campus-map.ts';
import previousBundledCampusMap from '../data/campus-map-2026-09-04.json' with { type: 'json' };
import { parseCampusMap } from '../lib/campus-document.ts';
import { createEmptyCampusMap } from '../lib/campus-model.ts';
import { applyJiangyinReference } from '../lib/njust-jiangyin-reference.ts';

const departureTime = new Date('2026-09-04T12:00:00+08:00');

void test('bundled campus map keeps the recovered navigation network routable', () => {
  const document = createDefaultCampusMap();
  const navigator = compileCampusMap(document);
  // These three places exist in the supplied annotations but their local road
  // components have no connection to the main network. Preserve that limitation.
  const disconnected = new Set(['致理楼', '辨理堂', '至善楼A']);

  assert.equal(document.nodes.length, 329);
  assert.equal(document.links.length, 358);
  assert.equal(document.places.length, 62);
  assert.equal(document.areas.length, 6);
  assert.equal(isReferenceOnlyPlaceholder(document), false);

  for (
    let originIndex = 0;
    originIndex < document.places.length;
    originIndex += 1
  ) {
    for (
      let destinationIndex = originIndex + 1;
      destinationIndex < document.places.length;
      destinationIndex += 1
    ) {
      const originName = document.places[originIndex].name;
      const destinationName = document.places[destinationIndex].name;
      if (disconnected.has(originName) || disconnected.has(destinationName))
        continue;
      const origin = navigator.resolvePlaceEndpoint(originName);
      const destination = navigator.resolvePlaceEndpoint(destinationName);
      assert.ok(origin, `找不到起点：${originName}`);
      assert.ok(destination, `找不到终点：${destinationName}`);
      assert.ok(
        navigator.route({
          origin,
          destination,
          profile: 'fastest',
          departureTime,
          audience: 'campus',
        }),
        `${originName} 到 ${destinationName} 应可生成路线`,
      );
    }
  }

  for (const name of disconnected) {
    assert.equal(
      navigator.route({
        origin: navigator.resolvePlaceEndpoint('宿舍11B')!,
        destination: navigator.resolvePlaceEndpoint(name)!,
        profile: 'fastest',
        departureTime,
        audience: 'campus',
      }),
      null,
      `${name} 的标注路网尚未接通`,
    );
  }

  const connectedPlace = navigator.resolvePlaceEndpoint('11B');
  const detachedReferencePlace = navigator.resolvePlaceEndpoint('北门');
  assert.ok(connectedPlace && 'nodeId' in connectedPlace);
  assert.ok(detachedReferencePlace && 'point' in detachedReferencePlace);
});

void test('only an unchanged previous bundled map upgrades; save timestamps do not change map content', () => {
  const old = parseCampusMap(JSON.stringify(previousBundledCampusMap));
  assert.equal(isPreviousBundledCampusMap(old), true);
  assert.equal(
    isPreviousBundledCampusMap({ ...old, updatedAt: new Date().toISOString() }),
    true,
  );
  const edited = structuredClone(old);
  edited.places[0].name = '用户已改名的宿舍';
  assert.equal(isPreviousBundledCampusMap(edited), false);
  const latest = createDefaultCampusMap();
  assert.equal(isPreviousBundledCampusMap(latest), false);
  assert.equal(
    sameCampusMapContent(latest, {
      ...latest,
      updatedAt: '2027-01-01T00:00:00Z',
    }),
    true,
  );
  assert.equal(sameCampusMapContent(latest, edited), false);
});

void test('only the untouched reference-only placeholder is upgraded', () => {
  const placeholder = applyJiangyinReference(createEmptyCampusMap(), true);
  assert.equal(isReferenceOnlyPlaceholder(placeholder), true);

  const edited = {
    ...placeholder,
    nodes: [
      ...placeholder.nodes,
      {
        id: 'node-user-added',
        x: 0.5,
        y: 0.5,
        levelId: placeholder.levels[0].id,
        kind: 'junction' as const,
      },
    ],
  };
  assert.equal(isReferenceOnlyPlaceholder(edited), false);

  const movedReferencePoint = {
    ...placeholder,
    nodes: placeholder.nodes.map((node, index) =>
      index === 0 ? { ...node, x: node.x + 0.001 } : node,
    ),
  };
  assert.equal(isReferenceOnlyPlaceholder(movedReferencePoint), false);
});
