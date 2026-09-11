// The same bounded transport is used by the Worker and the Android bridge.
export const LOGIN_URL = 'http://202.119.81.112:8080/Logon.do?method=logon';
export const TABLE_URL =
  'http://202.119.81.112:9080/njlgdx/xskb/xskb_list.do?Ves632DSdyV=NEW_XSD_PYGL';
export const MAX_RESPONSE = 5 * 1024 * 1024;
export type JwRequest = {
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  cookie?: string;
};
export type JwResponse = {
  status: number;
  contentType: string;
  location: string;
  cookies: string[];
  data: string;
};
export type Transport = (
  request: JwRequest,
  signal: AbortSignal,
) => Promise<JwResponse>;

export function allowedUrl(raw: string): URL {
  const url = new URL(raw);
  const login = url.origin === 'http://202.119.81.112:8080';
  const timetable = [
    'http://202.119.81.112:9080',
    'http://202.119.81.113:9080',
  ].includes(url.origin);
  const path = url.pathname;
  const allowed = login
    ? [
        '/Logon.do',
        '/verifycode.servlet',
        '/framework/main.jsp',
        '/framework/Main.jsp',
      ].includes(path)
    : timetable &&
      [
        '/njlgdx/xk/LoginToXk',
        '/njlgdx/xk/Verifyservlet',
        '/njlgdx/verifycode.servlet',
        '/njlgdx/framework/main.jsp',
        '/njlgdx/xskb/xskb_list.do',
        '/njlgdx/xskb/xskb_print.do',
      ].includes(path);
  if (
    !allowed ||
    url.username ||
    url.password ||
    url.hash ||
    raw.length > 4096 ||
    /(?:exit|logout|delete)/i.test(url.search)
  )
    throw new Error('教务系统返回了不支持的跳转，请重试。');
  return url;
}
export function validateRequest(value: unknown): JwRequest {
  if (!value || typeof value !== 'object') throw new Error('无效请求');
  const r = value as JwRequest;
  if (
    typeof r.url !== 'string' ||
    !['GET', 'POST'].includes(r.method) ||
    (r.body !== undefined &&
      (typeof r.body !== 'string' || r.body.length > 8192)) ||
    (r.cookie !== undefined &&
      (typeof r.cookie !== 'string' ||
        r.cookie.length > 8192 ||
        /[\r\n]/.test(r.cookie)))
  )
    throw new Error('无效请求');
  const u = allowedUrl(r.url);
  if (
    r.method === 'POST' &&
    ![
      '/Logon.do',
      '/njlgdx/xk/LoginToXk',
      '/njlgdx/xk/Verifyservlet',
      '/njlgdx/xskb/xskb_list.do',
      '/njlgdx/xskb/xskb_print.do',
    ].includes(u.pathname)
  )
    throw new Error('无效请求');
  if (r.method === 'GET' && r.body) throw new Error('无效请求');
  return r;
}
export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (base64.length > Math.ceil(MAX_RESPONSE / 3) * 4)
    throw new Error('课表文件超过 5 MB。');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
export function responseText(response: JwResponse): string {
  const bytes = decodeBytes(response.data);
  // The old 9080 login declares UTF-8 but sometimes sends GBK.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

export class JwCookies {
  private values: {
    host: string;
    path: string;
    name: string;
    value: string;
  }[] = [];
  update(url: string, headers: string[]) {
    const host = new URL(url).hostname;
    for (const header of headers) {
      const [pair, ...attributes] = header.split(';');
      const i = pair.indexOf('=');
      if (i < 1) continue;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const path =
        attributes
          .find((a) => /^\s*path=/i.test(a))
          ?.split('=')
          .slice(1)
          .join('=')
          .trim() || '/';
      if (!/^[\w.-]+$/.test(name) || /[\r\n;]/.test(value)) continue;
      this.values = this.values.filter(
        (c) => !(c.host === host && c.path === path && c.name === name),
      );
      if (!attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)))
        this.values.push({ host, path, name, value });
    }
  }
  header(raw: string) {
    const u = new URL(raw);
    return this.values
      .filter(
        (c) =>
          c.host === u.hostname &&
          (u.pathname === c.path ||
            u.pathname.startsWith(
              c.path.endsWith('/') ? c.path : c.path + '/',
            )),
      )
      .sort((a, b) => b.path.length - a.path.length)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }
  clear() {
    this.values = [];
  }
}
