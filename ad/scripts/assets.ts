import { compileCampusMap } from '../../lib/campus-navigator.ts';
import document from '../../data/campus-map-default.json';
import type { CampusMapDocument } from '../../lib/campus-model.ts';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const nav = compileCampusMap(document as CampusMapDocument);
const paths = Array.from(
  (
    await Bun.file(resolve(root, '../public/campus-precise.svg')).text()
  ).matchAll(/class="building"[^>]* d="([^"]+)"/g),
  (m) => m[1],
);
const line = (pts: { x: number; y: number }[]) =>
  pts
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${(p.x * 2038).toFixed(1)} ${(p.y * 1279).toFixed(1)}`,
    )
    .join(' ');
const routes = [];
for (const [from, to] of [
  ['宿舍11B', '图书馆'],
  ['图书馆', '致远楼A'],
  ['致远楼A', '樱花苑食堂'],
  ['樱花苑食堂', '体育场'],
]) {
  const origin = nav.resolvePlaceEndpoint(from),
    destination = nav.resolvePlaceEndpoint(to);
  if (!origin || !destination) throw Error('Missing place');
  const route = nav.route({
    origin,
    destination,
    profile: 'fastest',
    departureTime: new Date('2026-09-14T08:00:00+08:00'),
    audience: 'campus',
  });
  if (!route) throw Error(`No route ${from} → ${to}`);
  routes.push({
    from,
    to,
    path: line(route.geometry),
    points: route.geometry.map((p) => [p.x * 2038, p.y * 1279]),
    meters: Math.round(route.metrics.distanceMeters ?? 0),
    minutes: Math.ceil(route.metrics.estimatedSeconds / 60),
  });
}
const places = document.places.map((p) => {
  const n = document.nodes.find((n) => n.id === p.nodeId)!;
  return { name: p.name, x: n.x * 2038, y: n.y * 1279 };
});
const rerouteOrigin = nav.resolvePlaceEndpoint('致远楼C')!;
const rerouteDestination = nav.resolvePlaceEndpoint('致远楼A')!;
const reroute = nav.route({
  origin: rerouteOrigin,
  destination: rerouteDestination,
  profile: 'fastest',
  departureTime: new Date('2026-09-14T08:00:00+08:00'),
  audience: 'campus',
})!;
routes.push({
  from: '致远楼C',
  to: '致远楼A',
  path: line(reroute.geometry),
  points: reroute.geometry.map((p) => [p.x * 2038, p.y * 1279]),
  meters: Math.round(reroute.metrics.distanceMeters ?? 0),
  minutes: Math.ceil(reroute.metrics.estimatedSeconds / 60),
});
await Bun.write(
  resolve(root, 'assets/campus.json'),
  JSON.stringify({
    buildings: paths,
    roads: document.links.map((l) => line(l.geometry)),
    places,
    routes,
  }),
);
console.log(JSON.stringify(routes.map(({ points, path, ...r }) => r)));
