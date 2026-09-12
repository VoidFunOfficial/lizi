import bundledCampusMap from '../data/campus-map-default.json' with { type: 'json' };
import previousBundledCampusMap from '../data/campus-map-2026-09-04.json' with { type: 'json' };

import { parseCampusMap } from './campus-document.ts';
import {
  createEmptyCampusMap,
  type CampusMapDocument,
} from './campus-model.ts';
import { applyJiangyinReference } from './njust-jiangyin-reference.ts';

const BUNDLED_CAMPUS_MAP_JSON = JSON.stringify(bundledCampusMap);
const documentContent = (document: CampusMapDocument) =>
  JSON.stringify({
    map: document.map,
    levels: document.levels,
    nodes: document.nodes,
    places: document.places,
    links: document.links,
    areas: document.areas,
    solarBuildings: document.solarBuildings ?? [],
  });
const REFERENCE_ONLY_PLACEHOLDER_CONTENT = documentContent(
  parseCampusMap(
    JSON.stringify(applyJiangyinReference(createEmptyCampusMap(), true)),
  ),
);
const PREVIOUS_BUNDLED_CONTENT = documentContent(
  parseCampusMap(JSON.stringify(previousBundledCampusMap)),
);

export function sameCampusMapContent(
  a: CampusMapDocument,
  b: CampusMapDocument,
): boolean {
  return documentContent(a) === documentContent(b);
}

export function isPreviousBundledCampusMap(
  document: CampusMapDocument,
): boolean {
  return (
    documentContent(parseCampusMap(JSON.stringify(document))) ===
    PREVIOUS_BUNDLED_CONTENT
  );
}

export function createDefaultCampusMap(): CampusMapDocument {
  return parseCampusMap(BUNDLED_CAMPUS_MAP_JSON);
}

export function isReferenceOnlyPlaceholder(
  document: CampusMapDocument,
): boolean {
  return (
    documentContent(parseCampusMap(JSON.stringify(document))) ===
    REFERENCE_ONLY_PLACEHOLDER_CONTENT
  );
}
