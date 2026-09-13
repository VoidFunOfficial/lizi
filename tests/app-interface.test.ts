import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

void test('/app uses the brand icon and navigation-only app view', async () => {
  const [routeSource, routeClientSource, homeSource, styles] =
    await Promise.all([
      readFile(new URL('app/app/page.tsx', projectRoot), 'utf8'),
      readFile(new URL('app/app/app-page.tsx', projectRoot), 'utf8'),
      readFile(new URL('app/map-workspace.tsx', projectRoot), 'utf8'),
      readFile(new URL('app/globals.css', projectRoot), 'utf8'),
    ]);

  assert.match(routeSource, /dynamic = 'force-static'/);
  assert.match(routeClientSource, /src="\/icon\.png"/);
  assert.match(routeClientSource, /initialMode="navigate" appView/);
  assert.match(routeClientSource, /app-loading-fill/);
  assert.match(homeSource, /appView \? 'is-app-view'/);
  assert.match(homeSource, /APP_NAVIGATION_ZOOM = 4/);
  assert.match(
    homeSource,
    /useState<CampusMapDocument>\(\s*createDefaultCampusMap,?\s*\)/,
  );
  assert.match(homeSource, /resolvePlaceEndpoint/);
  assert.match(homeSource, /Geolocation\.watchPosition/);
  assert.match(homeSource, /navigator\.geolocation\.watchPosition/);
  assert.match(homeSource, /Geolocation\.clearWatch/);
  assert.match(homeSource, /navigator\.geolocation\?\.clearWatch/);
  assert.doesNotMatch(homeSource, /getCurrentPosition/);
  assert.match(homeSource, /data-navigation-active=\{Boolean\(activeRoute\)\}/);
  assert.match(homeSource, /data-place-selected=\{Boolean\(selectedPlace\)\}/);
  assert.match(
    homeSource,
    /\{!appView && \(\s*<g\s*className=\{`traversal-links/,
  );
  assert.match(homeSource, /\{appView \? '开始导航' : '计算全部路线方案'\}/);
  assert.match(homeSource, /'正在持续定位'/);
  assert.match(homeSource, /className="place-action-sheet"/);
  assert.match(homeSource, /navigateToSelectedPlace/);
  assert.match(homeSource, />\s*去这里\s*</);
  assert.match(homeSource, /selectAppPlace\(place\.id\)/);
  assert.match(styles, /\.app-shell\.is-app-view \.left-panel/);
  assert.match(styles, /prefers-reduced-transparency: reduce/);
  assert.match(styles, /\.app-go-button:active/);

  const locateSource = homeSource.slice(
    homeSource.indexOf('const locate ='),
    homeSource.indexOf('const calculateRoutes ='),
  );
  assert.doesNotMatch(locateSource, /setAlternatives/);
  assert.match(locateSource, /geolocationPermissionDenied/);
  assert.doesNotMatch(
    homeSource,
    /setTimeout\(\(\) => setAlternatives\(\[\]\), 0\)/,
  );
});

void test('loading icon is a square RGBA PNG', async () => {
  const image = await readFile(new URL('public/icon.png', projectRoot));

  assert.equal(image.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
  assert.equal(image[25], 6, 'PNG color type must be RGBA');
});

void test('/debug_sunshine reuses the physical shadow model with a full-day time slider', async () => {
  const source = await readFile(
    new URL('app/debug_sunshine/page.tsx', projectRoot),
    'utf8',
  );

  assert.match(source, /createBuildingShadowPolygons/);
  assert.match(source, /solarPositionAt/);
  assert.match(source, /CAMPUS_MAP_STORAGE_KEY/);
  assert.match(source, /type="range"/);
  assert.match(source, /max="1439"/);
  assert.match(source, /强制晴天/);
  assert.doesNotMatch(source, /xiaomi-weather|api\/weather/);
});
