import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAppVersion } from '../scripts/app-version.mjs';

void test('native build numbers increase across patch, minor and major releases', () => {
  const versions = ['0.1.0', '0.1.1', '0.1.999', '0.2.0', '0.999.999', '1.0.0'];
  const codes = versions.map((version) => parseAppVersion(version).code);
  assert.deepEqual(codes, [1000, 1001, 1999, 2000, 999999, 1000000]);
  for (let i = 1; i < codes.length; i++) assert.ok(codes[i] > codes[i - 1]);
  assert.equal(parseAppVersion('1.2.3').tag, 'v1.2.3');
});

void test('reject versions that collide, overflow, or cannot be installed', () => {
  for (const version of [
    '0.0.0',
    '01.2.3',
    '1.2',
    'v1.2.3',
    '1.0.0-beta.1',
    '1.1000.0',
    '1.0.1000',
    '2100.0.1',
  ]) {
    assert.throws(() => parseAppVersion(version));
  }
});
