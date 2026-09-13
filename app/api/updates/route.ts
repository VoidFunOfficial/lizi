import {
  RELEASE_ACCEPT,
  RELEASE_API,
  RELEASE_ROOT,
  parseRelease,
} from '../../../lib/updates/release.ts';

export async function GET(request: Request): Promise<Response> {
  const download =
    new URL(request.url).searchParams.get('download') === 'android';
  try {
    const upstream = await fetch(RELEASE_API, {
      headers: { Accept: RELEASE_ACCEPT },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.status === 404) {
      if (download) return Response.redirect(RELEASE_ROOT, 302);
      return Response.json(null, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (!upstream.ok) throw new Error('CNB release unavailable');
    const data: unknown = await upstream.json();
    const release = parseRelease(data);
    if (download)
      return Response.redirect(release?.androidUrl ?? RELEASE_ROOT, 302);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { error: '暂时无法检查更新，请稍后重试' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
