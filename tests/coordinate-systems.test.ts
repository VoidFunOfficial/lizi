import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bd09McToBd09,
  bd09McToWgs84,
  haversineDistanceMeters,
  parseBaiduMapUrl,
} from '../lib/coordinate-systems.ts';

const REFERENCE_URL =
  'https://map.baidu.com/@13377094.41932182,3728558.053357122,16.52z/maptype%3DB_EARTH_MAP';

void test('parses the supplied Baidu Earth map URL without treating BD09MC as longitude and latitude', () => {
  const result = parseBaiduMapUrl(REFERENCE_URL);

  assert.equal(result.sourceCrs, 'BD09MC');
  assert.equal(result.center.x, 13_377_094.41932182);
  assert.equal(result.center.y, 3_728_558.053357122);
  assert.equal(result.center.zoom, 16.52);
  assert.equal(result.mapType, 'B_EARTH_MAP');
  assert.ok(Math.abs(result.center.x) > 180);
  assert.ok(Math.abs(result.center.y) > 90);
});

void test('converts the supplied Baidu projected center through BD09 to approximate WGS84', () => {
  const center = parseBaiduMapUrl(REFERENCE_URL).center;
  const bd09 = bd09McToBd09(center);
  const wgs84 = bd09McToWgs84(center);

  assert.ok(Math.abs(bd09.longitude - 120.16717622390142) < 1e-9);
  assert.ok(Math.abs(bd09.latitude - 31.908844411884335) < 1e-9);
  assert.ok(Math.abs(wgs84.longitude - 120.15580670335365) < 1e-8);
  assert.ok(Math.abs(wgs84.latitude - 31.904895891194847) < 1e-8);
  assert.ok(
    haversineDistanceMeters(bd09, wgs84) > 1_000,
    'the provider offset must not be silently treated as WGS84',
  );
});

void test('haversine uses real metres and coordinate functions validate their inputs', () => {
  const oneDegreeAtEquator = haversineDistanceMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
  );
  assert.ok(Math.abs(oneDegreeAtEquator - 111_195.08) < 0.1);
  assert.throws(
    () => parseBaiduMapUrl('https://example.com/@1,2,16z'),
    /不是百度地图/,
  );
  assert.throws(() => bd09McToBd09({ x: Number.NaN, y: 0 }), /must be finite/);
});
