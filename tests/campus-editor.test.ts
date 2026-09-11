import assert from 'node:assert/strict';
import test from 'node:test';

import {
  insertSnappedNode,
  mapPixelRadiusForScreenPixels,
} from '../lib/campus-editor.ts';
import {
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  MAP_HEIGHT,
  MAP_WIDTH,
  createEmptyCampusMap,
  type CampusMapDocument,
  type TraversalLink,
  type TraversalNode,
} from '../lib/campus-model.ts';

function node(id: string, x: number, y: number): TraversalNode {
  return { id, x, y, levelId: DEFAULT_LEVEL.id, kind: 'junction' };
}

function link(
  id: string,
  from: TraversalNode,
  to: TraversalNode,
): TraversalLink {
  return {
    id,
    from: from.id,
    to: to.id,
    kind: 'path',
    direction: 'both',
    geometry: [from, to],
    environment: { ...DEFAULT_ENVIRONMENT },
    access: { ...DEFAULT_ACCESS },
    costMultiplier: 1,
  };
}

function mapWith(
  nodes: TraversalNode[],
  links: TraversalLink[],
): CampusMapDocument {
  return { ...createEmptyCampusMap(), nodes, links };
}

void test('screen-space snapping becomes finer in map pixels as the map is enlarged', () => {
  assert.equal(mapPixelRadiusForScreenPixels(6, MAP_WIDTH, MAP_HEIGHT), 6);
  assert.equal(
    mapPixelRadiusForScreenPixels(6, MAP_WIDTH * 2, MAP_HEIGHT * 2),
    3,
  );
});

void test('a nearby road is still split at the projected automatic connection point', () => {
  const west = node('west', 0.1, 0.5);
  const east = node('east', 0.9, 0.5);
  const document = mapWith([west, east], [link('main-road', west, east)]);

  const result = insertSnappedNode(
    document,
    { x: 0.5, y: 0.503 },
    DEFAULT_LEVEL.id,
    6,
  );

  assert.equal(result.changed, true);
  assert.equal(result.node.x, 0.5);
  assert.equal(result.node.y, 0.5);
  assert.equal(result.document.nodes.length, 3);
  assert.equal(result.document.links.length, 2);
  assert.ok(result.document.links.every((item) => item.id !== 'main-road'));
});

void test('continuing from a junction can place a short spur without snapping back', () => {
  const west = node('west', 0.45, 0.5);
  const source = node('source', 0.5, 0.5);
  const east = node('east', 0.55, 0.5);
  const westLink = link('west-link', west, source);
  const eastLink = link('east-link', source, east);
  const document = mapWith([west, source, east], [westLink, eastLink]);
  const endpoint = { x: 0.5, y: 0.503 };

  const oldBehavior = insertSnappedNode(
    document,
    endpoint,
    DEFAULT_LEVEL.id,
    6,
  );
  assert.equal(oldBehavior.changed, false);
  assert.equal(oldBehavior.node.id, source.id);

  const precise = insertSnappedNode(
    document,
    endpoint,
    DEFAULT_LEVEL.id,
    6,
    'junction',
    {
      nodeIds: new Set([source.id]),
    },
  );
  assert.equal(precise.changed, true);
  assert.equal(precise.node.x, endpoint.x);
  assert.equal(precise.node.y, endpoint.y);
  assert.equal(precise.document.links.length, document.links.length);
});
