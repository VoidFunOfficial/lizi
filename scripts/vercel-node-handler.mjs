/** Adapt Node HTTP to the shared Web Request/Response route handlers. */
export function vercelNodeHandler(method, handler) {
  return async (req, res) => {
    if (req.method !== method) {
      res.writeHead(405, { Allow: method });
      res.end();
      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value))
          value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, value);
      }
      const chunks = [];
      let size = 0;
      if (method !== 'GET') {
        for await (const chunk of req) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > 24_000) {
            res.writeHead(413, { 'Cache-Control': 'no-store' });
            res.end();
            return;
          }
          chunks.push(bytes);
        }
      }
      const host = headers.get('x-forwarded-host') || headers.get('host');
      const protocol = headers.get('x-forwarded-proto') || 'https';
      const request = new Request(new URL(req.url, `${protocol}://${host}`), {
        method,
        headers,
        signal: controller.signal,
        ...(method === 'GET' ? {} : { body: Buffer.concat(chunks) }),
      });
      const response = await handler(request);
      const responseHeaders = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) responseHeaders['set-cookie'] = cookies;
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } finally {
      req.off('aborted', abort);
    }
  };
}
