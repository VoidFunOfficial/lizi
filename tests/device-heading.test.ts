import assert from 'node:assert/strict';
import test from 'node:test';
import {
  headingLabel,
  headingOnMap,
  smoothHeading,
} from '../lib/device-heading.ts';
import { buildMapCalibration } from '../lib/map-calibration.ts';
import { createDefaultCampusMap } from '../lib/default-campus-map.ts';

void test('compass smoothing crosses north by the short arc in both directions', () => {
  const clockwise = smoothHeading(359, 1);
  const counterclockwise = smoothHeading(1, 359);
  assert.ok(clockwise > 359 && clockwise < 360);
  assert.ok(counterclockwise > 0 && counterclockwise < 1);
  assert.equal(smoothHeading(null, -90), 270);
  assert.equal(headingLabel(359.9), '北 0°');
  assert.equal(headingLabel(90), '东 90°');
  assert.equal(headingLabel(225), '西南 225°');
});

void test('true compass bearings align with campus north, east, south and west', () => {
  const map = createDefaultCampusMap();
  const calibration = buildMapCalibration(map.map.calibration!, 2038, 1279);
  const location = calibration.imageToWgs84({ x: 0.5, y: 0.5 })!;
  for (const bearing of [0, 90, 180, 270]) {
    const angle = headingOnMap(calibration, location, bearing, 2038, 1279)!;
    const difference = ((angle - bearing + 540) % 360) - 180;
    assert.ok(
      Math.abs(difference) < 1,
      `bearing ${bearing} mapped to ${angle}`,
    );
  }
  assert.equal(headingOnMap(calibration, location, NaN, 2038, 1279), null);
});

void test('direction projection follows calibration on a rotated map', () => {
  const map = createDefaultCampusMap();
  const rotated = {
    ...map.map.calibration!,
    anchors: map.map.calibration!.anchors.map((anchor) => ({
      ...anchor,
      image: { x: 1 - anchor.image.y, y: anchor.image.x },
    })),
  };
  const calibration = buildMapCalibration(rotated, 1279, 2038);
  const location = calibration.imageToWgs84({ x: 0.5, y: 0.5 })!;
  assert.ok(
    Math.abs(headingOnMap(calibration, location, 0, 1279, 2038)! - 90) < 1,
  );
});
