// The same bounded transport is used by the Worker, Android and iOS bridges.
export const LOGIN_URL =
  'https://ids.njust.edu.cn/authserver/login?service=https%3A%2F%2Fehall2.njust.edu.cn%2Flogin';
// Official hall teaching-service entry; issues a separate CAS ticket for bkjw.
export const SSO_URL = 'http://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';
export const MAIN_URL = 'http://bkjw.njust.edu.cn/njlgdx/framework/main.jsp';
export const TABLE_URL = 'http://bkjw.njust.edu.cn/njlgdx/xskb/xskb_list.do';
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
  const ids = url.origin === 'https://ids.njust.edu.cn';
  const hall = url.origin === 'https://ehall2.njust.edu.cn';
  const timetable = [
    'http://bkjw.njust.edu.cn',
    'https://bkjw.njust.edu.cn',
  ].includes(url.origin);
  const path = url.pathname;
  const allowed = ids
    ? ['/authserver/login', '/authserver/getCaptcha.htl'].includes(path)
    : hall
      ? ['/login', '/', '/index.html', '/new/index.html'].includes(path)
      : timetable &&
        [
          '/njlgdx/indexsso.jsp',
          '/njlgdx/xk/LoginToXk',
          '/njlgdx/framework/main.jsp',
          '/njlgdx/xskb/xskb_list.do',
          '/njlgdx/xskb/xskb_print.do',
        ].includes(path);
  // CAS may return to the hall or the teaching system, never an arbitrary service.
  for (const service of url.searchParams.getAll('service')) {
    const target = new URL(service);
    if (
      ![
        'https://ehall2.njust.edu.cn/login',
        SSO_URL,
        SSO_URL.replace('http:', 'https:'),
        MAIN_URL,
        MAIN_URL.replace('http:', 'https:'),
        'http://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk',
        'https://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk',
      ].includes(target.href)
    )
      throw new Error('教务系统返回了不支持的跳转，请重试。');
  }
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
      '/authserver/login',
      '/njlgdx/xk/LoginToXk',
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
    domain: string;
    hostOnly: boolean;
    path: string;
    name: string;
    value: string;
    secure: boolean;
    expires: number;
  }[] = [];
  update(raw: string, headers: string[]) {
    const url = new URL(raw);
    const host = url.hostname;
    for (const header of headers) {
      const [pair, ...attributes] = header.split(';');
      const i = pair.indexOf('=');
      if (i < 1) continue;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const attr = (key: string) =>
        attributes
          .find((a) =>
            a
              .trim()
              .toLowerCase()
              .startsWith(key + '='),
          )
          ?.trim()
          .slice(key.length + 1);
      const declared = attr('domain')?.toLowerCase().replace(/^\./, '');
      const domain = declared || host;
      if (
        domain !== host &&
        (domain !== 'njust.edu.cn' || !host.endsWith('.' + domain))
      )
        continue;
      const defaultPath =
        url.pathname.slice(0, url.pathname.lastIndexOf('/')) || '/';
      const path = attr('path')?.startsWith('/') ? attr('path')! : defaultPath;
      const secure = attributes.some(
        (a) => a.trim().toLowerCase() === 'secure',
      );
      if (secure && url.protocol !== 'https:') continue;
      if (!/^[\w.-]+$/.test(name) || /[\r\n;]/.test(value)) continue;
      const maxAge = attr('max-age');
      const date = Date.parse(attr('expires') || '');
      const expires =
        maxAge !== undefined && /^-?\d+$/.test(maxAge)
          ? Date.now() + Number(maxAge) * 1000
          : Number.isNaN(date)
            ? Infinity
            : date;
      this.values = this.values.filter(
        (c) => !(c.domain === domain && c.path === path && c.name === name),
      );
      if (expires > Date.now())
        this.values.push({
          domain,
          hostOnly: !declared,
          path,
          name,
          value,
          secure,
          expires,
        });
    }
  }
  header(raw: string) {
    const u = new URL(raw);
    return this.values
      .filter(
        (c) =>
          c.expires > Date.now() &&
          (c.domain === u.hostname ||
            (!c.hostOnly && u.hostname.endsWith('.' + c.domain))) &&
          (!c.secure || u.protocol === 'https:') &&
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
