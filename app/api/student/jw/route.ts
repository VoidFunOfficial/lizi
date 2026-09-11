import {
  encodeBytes,
  MAX_RESPONSE,
  validateRequest,
} from '@/lib/student/jw/protocol';

const headers = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
};
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return Response.json({ error: '请求来源无效。' }, { status: 403, headers });
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 24000) throw new Error();
    input = validateRequest(JSON.parse(raw));
  } catch {
    return Response.json({ error: '教务请求无效。' }, { status: 400, headers });
  }
  try {
    const upstream = await fetch(input.url, {
      method: input.method,
      body: input.method === 'POST' ? input.body || '' : undefined,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: input.cookie || '',
        Accept: '*/*',
      },
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    });
    if (Number(upstream.headers.get('content-length')) > MAX_RESPONSE)
      throw new Error();
    const reader = upstream.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_RESPONSE) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return Response.json(
      {
        status: upstream.status,
        contentType: upstream.headers.get('content-type') || '',
        location: upstream.headers.get('location') || '',
        cookies: upstream.headers.getSetCookie(),
        data: encodeBytes(bytes),
      },
      { headers },
    );
  } catch {
    // Never log credentials, cookies, upstream URLs or bodies.
    return Response.json(
      { error: '暂时无法连接教务系统，请检查校园网或稍后重试。' },
      { status: 502, headers },
    );
  }
}
