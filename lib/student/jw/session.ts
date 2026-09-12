import {
  allowedUrl,
  decodeBytes,
  JwCookies,
  LOGIN_URL,
  MAIN_URL,
  SSO_URL,
  encodeBytes,
  responseText,
  TABLE_URL,
  type JwResponse,
  type Transport,
} from './protocol.ts';

function unescapeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
export function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
  ))
    attrs[match[1].toLowerCase()] = unescapeHtml(
      match[2] ?? match[3] ?? match[4],
    );
  return attrs;
}
function isLogin(html: string) {
  return /<input\b[^>]*\b(?:name|id)\s*=\s*["']?(?:PASSWORD|passwordText|userPassword|pwd)[\s"'>]/i.test(
    html,
  );
}
function loginError(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  if (/验证码.*(?:错误|不正确|失效|过期)/.test(text))
    return '验证码错误或已过期，请输入新验证码。';
  if (/(?:用户名|密码|帐号|账号).*(?:错误|不正确|不存在)/.test(text))
    return '用户名或密码不正确，请检查后重试。';
  return '登录未成功，请检查用户名、密码和验证码后重试。';
}
// Read only the password form: the page also contains QR, SMS and passkey forms.
export function idsLoginForm(html: string, base: string) {
  const form = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].find(
    (m) => attributes(m[1]).id === 'pwdFromId',
  );
  if (!form) throw new Error('统一身份认证登录页面已变化，请稍后重试。');
  const fields = new URLSearchParams();
  let salt = '';
  for (const field of form[2].matchAll(/<input\b[^>]*>/gi)) {
    const input = attributes(field[0]);
    if (input.id === 'pwdEncryptSalt') salt = input.value || '';
    if (
      input.type?.toLowerCase() === 'hidden' &&
      input.name &&
      !['password', 'passwordText', 'rememberMe'].includes(input.name)
    )
      fields.set(input.name, input.value || '');
  }
  const url = new URL(attributes(form[1]).action || base, base);
  const service = new URL(base).searchParams.get('service');
  if (service) url.searchParams.set('service', service);
  if (
    url.origin !== 'https://ids.njust.edu.cn' ||
    url.pathname !== '/authserver/login' ||
    !fields.get('execution') ||
    fields.get('cllt') !== 'userNameLogin' ||
    ![16, 24, 32].includes(new TextEncoder().encode(salt.trim()).length)
  )
    throw new Error('统一身份认证登录参数已变化，请刷新后重试。');
  if (/captchaSwitch\s*=\s*["']2["']/.test(html))
    throw new Error('学校已启用滑块验证，当前自动导入暂不支持。');
  return { url: allowedUrl(url.href).href, fields, salt: salt.trim() };
}

export async function encryptIdsPassword(password: string, salt: string) {
  // Matches the school's encryptPassword: AES-CBC/PKCS7 with a 64-character
  // random prefix and 16-character IV. The server discards the prefix.
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  const random = (length: number) =>
    Array.from(
      crypto.getRandomValues(new Uint8Array(length)),
      (n) => chars[n % chars.length],
    ).join('');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    'AES-CBC',
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: encoder.encode(random(16)) },
    key,
    encoder.encode(random(64) + password),
  );
  return encodeBytes(new Uint8Array(encrypted));
}

// Read literal navigation only. Never execute scripts or render remote HTML.
export function nextLoginStep(
  html: string,
  base: string,
): { url: string; body?: string } | null {
  for (const form of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const a = attributes(form[1]);
    if (!a.action || !/LoginToXk/.test(a.action)) continue;
    const values = new URLSearchParams();
    for (const field of form[2].matchAll(/<input\b[^>]*>/gi)) {
      const input = attributes(field[0]);
      if (input.name && input.type?.toLowerCase() === 'hidden')
        values.set(input.name, input.value || '');
    }
    const url = allowedUrl(new URL(a.action, base).href).href;
    return a.method?.toLowerCase() === 'post'
      ? { url, body: values.toString() }
      : { url: url + (url.includes('?') ? '&' : '?') + values.toString() };
  }
  const literal =
    html.match(
      /(?:window\.|top\.|parent\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/,
    )?.[1] ??
    html.match(/location\.replace\(\s*["']([^"']+)["']/)?.[1] ??
    html.match(
      /(?:href|src)\s*=\s*["']([^"']*\/xk\/LoginToXk[^"']*)["']/i,
    )?.[1] ??
    html.match(/<frame\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!literal) return null;
  try {
    return { url: allowedUrl(new URL(unescapeHtml(literal), base).href).href };
  } catch {
    return null;
  }
}
export function exportRequest(html: string, base: string) {
  const select = [
    ...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi),
  ].find((m) => attributes(m[1]).name === 'xnxq01id');
  const options = [...(select?.[2] || '').matchAll(/<option\b([^>]*)>/gi)];
  const selected =
    options.find((m) => /\bselected\b/i.test(m[1])) ?? options[0];
  const term = selected && attributes(selected[1]).value;
  if (
    !term ||
    !/^\d{4}-\d{4}-[123]$/.test(term) ||
    !/xskb_print\.do/.test(html)
  )
    throw new Error('未找到当前学期的课表导出入口，请稍后重试。');
  const url = new URL('/njlgdx/xskb/xskb_print.do', base);
  url.search = new URLSearchParams({ xnxq01id: term, zc: '' }).toString();
  return { url: allowedUrl(url.href).href, term };
}
export class JwSession {
  private cookies = new JwCookies();
  private transport: Transport;
  private encryptPassword: typeof encryptIdsPassword;
  private controller = new AbortController();
  private createdAt = Date.now();
  private login: ReturnType<typeof idsLoginForm> | null = null;
  constructor(transport: Transport, encryptPassword = encryptIdsPassword) {
    this.transport = transport;
    this.encryptPassword = encryptPassword;
  }
  close() {
    this.controller.abort();
    this.cookies.clear();
    this.login = null;
  }
  private async request(
    url: string,
    body?: string,
  ): Promise<JwResponse & { url: string }> {
    for (let hop = 0; hop < 8; hop++) {
      this.controller.signal.throwIfAborted();
      allowedUrl(url);
      const r = await this.transport(
        {
          url,
          method: body === undefined ? 'GET' : 'POST',
          body,
          cookie: this.cookies.header(url),
        },
        this.controller.signal,
      );
      this.controller.signal.throwIfAborted();
      this.cookies.update(url, r.cookies);
      if ([301, 302, 303, 307, 308].includes(r.status) && r.location) {
        const next = allowedUrl(new URL(r.location, url).href).href;
        if (
          body !== undefined &&
          [307, 308].includes(r.status) &&
          new URL(next).origin !== new URL(url).origin
        )
          throw new Error('教务系统返回了不支持的跳转，请重试。');
        url = next;
        if (![307, 308].includes(r.status)) body = undefined;
        continue;
      }
      if (r.status < 200 || r.status >= 300)
        throw new Error('教务系统暂时不可用，请稍后重试。');
      return { ...r, url };
    }
    throw new Error('教务登录跳转次数过多，请稍后重试。');
  }
  private async landing(page: JwResponse & { url: string }, failure?: string) {
    for (let i = 0; i < 6; i++) {
      const html = responseText(page);
      if (isLogin(html)) throw new Error(failure || loginError(html));
      const next = nextLoginStep(html, page.url);
      if (!next || next.url === page.url) return;
      page = await this.request(next.url, next.body);
    }
    throw new Error('教务登录跳转次数过多，请稍后重试。');
  }
  async captcha(): Promise<string> {
    if (!this.login) {
      const login = await this.request(LOGIN_URL);
      this.login = idsLoginForm(responseText(login), login.url);
      this.createdAt = Date.now();
    }
    const r = await this.request(
      new URL('/authserver/getCaptcha.htl?t=' + Date.now(), LOGIN_URL).href,
    );
    const mime = r.contentType.split(';')[0].toLowerCase();
    if (
      !['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(mime) ||
      r.data.length > 256000
    )
      throw new Error('验证码加载失败，请点击刷新。');
    return `data:${mime};base64,${r.data}`;
  }
  async import(
    username: string,
    password: string,
    captcha: string,
    progress: (message: string) => void,
  ): Promise<ArrayBuffer> {
    if (!this.login || Date.now() - this.createdAt > 5 * 60_000)
      throw new Error('登录已过期，请关闭后重新打开自动导入。');
    if (
      !username.trim() ||
      username.length > 32 ||
      !password ||
      password.length > 32 ||
      !/^[a-z\d]{1,10}$/i.test(captcha.trim())
    )
      throw new Error('请填写用户名、密码和验证码。');
    progress('正在登录统一身份认证…');
    const login = this.login;
    // Each execution/challenge is used once, including unsuccessful attempts.
    this.login = null;
    const fields = new URLSearchParams(login.fields);
    fields.set('username', username.trim());
    fields.set('password', await this.encryptPassword(password, login.salt));
    this.controller.signal.throwIfAborted();
    fields.set('captcha', captcha.trim());
    try {
      await this.landing(await this.request(login.url, fields.toString()));
    } finally {
      fields.delete('password');
    }
    // Hall authentication alone does not create a teaching-system session.
    // Its official indexsso entry obtains a bkjw CAS ticket, then LoginToXk
    // establishes JSESSIONID before we visit the teaching homepage.
    progress('正在进入教务系统…');
    await this.landing(
      await this.request(SSO_URL),
      '教务单点登录未完成，请重新登录后重试。',
    );
    await this.landing(
      await this.request(MAIN_URL),
      '统一认证已完成，但教务系统尚未建立登录会话，请稍后重试。',
    );
    progress('正在获取本学期课表…');
    const table = await this.request(TABLE_URL);
    const tableHtml = responseText(table);
    if (isLogin(tableHtml))
      throw new Error('教务登录成功，但课表系统未建立登录会话，请稍后重试。');
    const target = exportRequest(tableHtml, table.url);
    progress('正在导出并读取课表…');
    const exported = await this.request(target.url, '');
    const bytes = decodeBytes(exported.data);
    // School print exports OLE XLS; accept ZIP XLSX too, never a login/error page.
    const ole = [0xd0, 0xcf, 0x11, 0xe0].every((b, i) => bytes[i] === b);
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!ole && !zip)
      throw new Error('教务系统未返回 Excel 课表，请稍后重试。');
    return bytes.buffer;
  }
}
