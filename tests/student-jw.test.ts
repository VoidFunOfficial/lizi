import assert from 'node:assert/strict';
import test from 'node:test';
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { utils, write } from 'xlsx';
import {
  allowedUrl,
  decodeBytes,
  encodeBytes,
  JwCookies,
  LOGIN_URL,
  MAIN_URL,
  SSO_URL,
  TABLE_URL,
  validateRequest,
  type JwRequest,
  type JwResponse,
  type Transport,
} from '../lib/student/jw/protocol.ts';
import {
  exportRequest,
  encryptIdsPassword,
  idsLoginForm,
  JwSession,
  nextLoginStep,
} from '../lib/student/jw/session.ts';
import { importTimetable } from '../lib/student/import.ts';

const salt = '0123456789abcdef';
// Minimal, anonymous fixture of the publicly inspected password form (2026-09-12).
const loginHtml = `<form id="phoneFromId"><input name="execution" value="wrong"></form>
<form id="pwdFromId" action="/authserver/login" method="post">
<input name="username"><input name="passwordText" id="password" type="password">
<input name="password" type="hidden"><input name="captcha">
<input type="hidden" name="_eventId" value="submit"><input type="hidden" name="cllt" value="userNameLogin">
<input type="hidden" name="dllt" value="generalLogin"><input type="hidden" name="lt" value="">
<input type="hidden" id="pwdEncryptSalt" value="${salt}"><input type="hidden" name="execution" value="e1s1">
</form>`;
const tableHtml =
  '<select name="xnxq01id"><option value="2025-2026-2">old</option><option selected="selected" value="2026-2027-1">current</option></select><script>FormPrint.action="/njlgdx/xskb/xskb_print.do";</script>';
const page = (text: string, extra: Partial<JwResponse> = {}): JwResponse => ({
  status: 200,
  contentType: 'text/html',
  location: '',
  cookies: [],
  data: encodeBytes(new TextEncoder().encode(text)),
  ...extra,
});
const picture = page('image', {
  contentType: 'image/jpeg',
  cookies: ['JSESSIONID=captcha; Path=/authserver; Secure'],
});

void test('native password encryption is used without changing captcha-session cookies', async () => {
  let encrypted = false;
  const session = new JwSession(
    async (request) => {
      if (request.url.includes('getCaptcha.htl')) return picture;
      if (request.method === 'GET') return page(loginHtml);
      assert.equal(request.cookie, 'JSESSIONID=captcha');
      assert.equal(
        new URLSearchParams(request.body).get('password'),
        'native-ciphertext',
      );
      assert.ok(encrypted);
      return page('<input name="passwordText" type="password">验证码错误');
    },
    async (password, receivedSalt) => {
      assert.equal(password, 'fixture-password');
      assert.equal(receivedSalt, salt);
      encrypted = true;
      return 'native-ciphertext';
    },
  );
  await session.captcha();
  await assert.rejects(
    session.import('student', 'fixture-password', 'AB12', () => {}),
    /验证码错误/,
  );
  session.close();
});

void test('closing during native encryption prevents the credential POST', async () => {
  let finishEncryption!: (ciphertext: string) => void;
  const pending = new Promise<string>((resolve) => {
    finishEncryption = resolve;
  });
  const session = new JwSession(
    async (request) => {
      assert.equal(request.method, 'GET');
      return request.url.includes('getCaptcha.htl') ? picture : page(loginHtml);
    },
    () => pending,
  );
  await session.captcha();
  const importing = session.import(
    'student',
    'fixture-password',
    'AB12',
    () => {},
  );
  session.close();
  finishEncryption('native-ciphertext');
  await assert.rejects(importing, { name: 'AbortError' });
});

void test('only school login and read/export endpoints are permitted', () => {
  for (const url of [
    'https://evil.example/',
    'http://127.0.0.1:8080/Logon.do',
    'http://202.119.81.112:8080@evil.example/Logon.do',
    'http://202.119.81.112:9080/njlgdx/xk/Delete',
    'http://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk?method=exit',
    'http://ids.njust.edu.cn/authserver/login',
    'http://ehall2.njust.edu.cn/login',
    'https://ids.njust.edu.cn/authserver/login?service=https%3A%2F%2Fevil.example%2F',
    'https://bkjw.njust.edu.cn/njlgdx/framework/main.jsp?service=https://evil.example/',
  ])
    assert.throws(() => allowedUrl(url));
  assert.equal(allowedUrl(LOGIN_URL).href, LOGIN_URL);
  assert.throws(() =>
    validateRequest({
      url: LOGIN_URL,
      method: 'POST',
      cookie: 'a=1\r\nInjected: yes',
    }),
  );
  assert.throws(() => validateRequest({ url: LOGIN_URL, method: 'DELETE' }));
});
void test('cookies preserve host, domain, path, secure, expiry and session isolation', () => {
  const a = new JwCookies();
  const b = new JwCookies();
  a.update(LOGIN_URL, [
    'JSESSIONID=ids; Path=/authserver; Secure',
    'SSO=shared; Domain=.njust.edu.cn; Path=/; Secure',
    'bad=x; Domain=edu.cn; Path=/',
    'bad2=x; Domain=evil.example; Path=/',
  ]);
  a.update(MAIN_URL, [
    'JSESSIONID=root; Path=/',
    'JSESSIONID=table; Path=/njlgdx',
  ]);
  assert.equal(a.header(TABLE_URL), 'JSESSIONID=table; JSESSIONID=root');
  assert.equal(a.header(LOGIN_URL), 'JSESSIONID=ids; SSO=shared');
  assert.equal(a.header('https://ehall2.njust.edu.cn/login'), 'SSO=shared');
  assert.equal(
    a.header(TABLE_URL.replace('http:', 'https:')),
    'JSESSIONID=table; SSO=shared; JSESSIONID=root',
  );
  assert.equal(a.header('https://evil.example/'), '');
  assert.equal(
    a.header(TABLE_URL.replace('/njlgdx/', '/njlgdxother/')),
    'JSESSIONID=root',
  );
  assert.equal(b.header(TABLE_URL), '');
  a.update(MAIN_URL, ['JSESSIONID=gone; Path=/njlgdx; Max-Age=-1']);
  assert.equal(a.header(TABLE_URL), 'JSESSIONID=root');
  a.update(MAIN_URL, ['old=x; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
  a.update(LOGIN_URL, ['default=x']);
  assert.match(a.header(LOGIN_URL), /default=x/);
  assert.doesNotMatch(a.header('https://ids.njust.edu.cn/'), /default=/);
  a.clear();
  assert.equal(a.header(LOGIN_URL), '');
});
void test('IDS form preserves execution and service and excludes other login methods', () => {
  const form = idsLoginForm(loginHtml, LOGIN_URL);
  assert.equal(form.url, LOGIN_URL);
  assert.equal(form.salt, salt);
  assert.equal(form.fields.get('execution'), 'e1s1');
  assert.equal(form.fields.get('cllt'), 'userNameLogin');
  assert.equal(form.fields.has('passwordText'), false);
  assert.equal(form.fields.has('rememberMe'), false);
  assert.throws(() =>
    idsLoginForm(loginHtml.replace('pwdEncryptSalt', 'changed'), LOGIN_URL),
  );
  assert.throws(() =>
    idsLoginForm(
      loginHtml.replace('/authserver/login', 'https://evil.example/'),
      LOGIN_URL,
    ),
  );
  assert.throws(
    () =>
      idsLoginForm(
        loginHtml + '<script>var captchaSwitch="2"</script>',
        LOGIN_URL,
      ),
    /滑块/,
  );
});
void test('IDS AES ciphertext decrypts to 64 random characters plus the exact password', async () => {
  const password = 'p&+=密码';
  const encrypted = await encryptIdsPassword(password, salt);
  const decipher = createDecipheriv(
    'aes-128-cbc',
    Buffer.from(salt),
    Buffer.alloc(16),
  );
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);
  // The IV is intentionally not transmitted by the school: only the discarded
  // first block changes when decrypting with another IV.
  assert.equal(plain.subarray(64).toString('utf8'), password);
  assert.match(plain.subarray(16, 64).toString('utf8'), /^[A-Za-z2-8]{48}$/);
  assert.notEqual(await encryptIdsPassword(password, salt), encrypted);
});
void test('print uses selected school term and all weeks, hidden SSO form values are decoded', () => {
  const result = exportRequest(tableHtml, TABLE_URL);
  const url = new URL(result.url);
  assert.equal(url.pathname, '/njlgdx/xskb/xskb_print.do');
  assert.equal(url.searchParams.get('xnxq01id'), '2026-2027-1');
  assert.equal(url.searchParams.get('zc'), '');
  assert.throws(() => exportRequest(loginHtml, TABLE_URL));
  assert.deepEqual(
    nextLoginStep(
      '<form action="http://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk" method="post"><input name="ticket" type="hidden" value="a&amp;b"></form>',
      LOGIN_URL,
    ),
    {
      url: 'http://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk',
      body: 'ticket=a%26b',
    },
  );
  assert.equal(
    nextLoginStep(
      '<script>window.location="http://evil.example/"</script>',
      LOGIN_URL,
    ),
    null,
  );
});
void test('complete import requires teaching CAS ticket and LoginToXk before homepage and XLS export', async () => {
  const rows = JSON.parse(
    readFileSync(
      new URL('./fixtures/student-timetable-rows.json', import.meta.url),
      'utf8',
    ),
  );
  const workbook = utils.book_new();
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet(rows.rows ?? rows[0]?.rows ?? rows),
    '课表',
  );
  const xls = write(workbook, {
    type: 'array',
    bookType: 'xls',
  }) as ArrayBuffer;
  const calls: JwRequest[] = [];
  let teachingTicket = false;
  const casUrl =
    'https://ids.njust.edu.cn/authserver/login?service=' +
    encodeURIComponent(SSO_URL.replace('http:', 'https:'));
  const transport: Transport = async (req) => {
    calls.push(req);
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.url === LOGIN_URL && req.method === 'GET')
      return page(loginHtml, {
        cookies: ['JSESSIONID=initial; Path=/authserver; Secure'],
      });
    if (req.url === LOGIN_URL) {
      assert.equal(req.cookie, 'JSESSIONID=captcha');
      const body = new URLSearchParams(req.body);
      assert.equal(body.get('username'), 'student');
      assert.notEqual(body.get('password'), 'p&+=');
      assert.equal(body.has('passwordText'), false);
      assert.equal(body.get('execution'), 'e1s1');
      assert.equal(body.get('captcha'), 'AB12');
      return page('', {
        status: 302,
        location: 'https://ehall2.njust.edu.cn/login?ticket=ST-fixture',
        cookies: ['TGC=sso; Path=/authserver; Secure'],
      });
    }
    if (req.url.startsWith('https://ehall2.njust.edu.cn/login')) {
      assert.equal(req.method, 'GET');
      assert.equal(req.body, undefined);
      assert.equal(req.cookie, '');
      return page('', {
        status: 302,
        location: '/new/index.html',
        cookies: ['HALL=ok; Path=/; Secure'],
      });
    }
    if (req.url === 'https://ehall2.njust.edu.cn/new/index.html') {
      assert.equal(req.cookie, 'HALL=ok');
      return page('hall');
    }
    if (req.url === SSO_URL) {
      if (!req.cookie?.includes('MOD_AUTH_CAS=teaching'))
        return page('', { status: 302, location: casUrl });
      assert.ok(teachingTicket);
      return page('', {
        status: 302,
        location: '/njlgdx/xk/LoginToXk?method=logon&token=fixture',
      });
    }
    if (req.url === casUrl) {
      assert.equal(req.method, 'GET');
      assert.equal(req.body, undefined);
      assert.match(req.cookie!, /TGC=sso/);
      teachingTicket = true;
      return page('', {
        status: 302,
        location: SSO_URL.replace('http:', 'https:') + '?ticket=ST-teaching',
      });
    }
    if (
      req.url ===
      SSO_URL.replace('http:', 'https:') + '?ticket=ST-teaching'
    ) {
      assert.equal(req.cookie, '');
      return page('', {
        status: 302,
        location: SSO_URL,
        cookies: ['MOD_AUTH_CAS=teaching; Path=/njlgdx'],
      });
    }
    if (req.url.includes('/njlgdx/xk/LoginToXk?')) {
      assert.match(req.cookie!, /MOD_AUTH_CAS=teaching/);
      return page('', {
        status: 302,
        location: MAIN_URL,
        cookies: ['JSESSIONID=main; Path=/njlgdx'],
      });
    }
    if (req.url === MAIN_URL) {
      // Reproduces the real failure: the homepage alone cannot start SSO.
      if (!req.cookie?.includes('JSESSIONID=main'))
        return page('<input name="PASSWORD" type="password">');
      return page('welcome');
    }
    if (req.url === TABLE_URL) {
      assert.match(req.cookie!, /JSESSIONID=main/);
      return page(tableHtml, { cookies: ['JSESSIONID=table; Path=/njlgdx'] });
    }
    assert.equal(req.method, 'POST');
    assert.match(req.cookie!, /JSESSIONID=table/);
    return page('', {
      contentType: 'application/vnd.ms-excel',
      data: encodeBytes(new Uint8Array(xls)),
    });
  };
  const session = new JwSession(transport);
  assert.match(await session.captcha(), /^data:image\/jpeg;base64,/);
  const buffer = await session.import('student', 'p&+=', 'AB12', () => {});
  assert.ok(importTimetable(buffer).courses.length > 0);
  assert.ok(
    calls.findIndex((c) => c.url === SSO_URL) <
      calls.findIndex((c) => c.url === MAIN_URL),
  );
  assert.ok(
    calls.findIndex((c) => c.url === MAIN_URL) <
      calls.findIndex((c) => c.url === TABLE_URL),
  );
  assert.equal(
    calls.filter((c) => c.url === LOGIN_URL && c.method === 'POST').length,
    1,
  );
  session.close();
});
void test('captcha failure is reported without retrying credentials or exporting', async () => {
  let posts = 0;
  const session = new JwSession(async (req) => {
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.method === 'POST') {
      posts++;
      return page(loginHtml + '验证码错误');
    }
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'BAD', () => {}),
    /验证码错误/,
  );
  assert.equal(posts, 1);
});
void test('malicious redirects are rejected before sending cookies or credentials', async () => {
  const calls: JwRequest[] = [];
  const session = new JwSession(async (req) => {
    calls.push(req);
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.method === 'POST')
      return page('', { status: 307, location: 'http://evil.example/' });
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /不支持的跳转/,
  );
  assert.ok(calls.every((c) => new URL(c.url).hostname === 'ids.njust.edu.cn'));
});
void test('closing cancels import and drops a delayed response', async () => {
  let release!: (r: JwResponse) => void;
  const session = new JwSession(
    async () =>
      new Promise<JwResponse>((resolve) => {
        release = resolve;
      }),
  );
  const result = session.captcha();
  session.close();
  release(page(loginHtml));
  await assert.rejects(result, { name: 'AbortError' });
});
void test('binary transport round trips without altering bytes', () => {
  const data = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(decodeBytes(encodeBytes(data)), data);
});

void test('307 cannot forward encrypted credentials to another allowed school host', async () => {
  const calls: JwRequest[] = [];
  const session = new JwSession(async (req) => {
    calls.push(req);
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.method === 'POST')
      return page('', { status: 307, location: MAIN_URL });
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /不支持的跳转/,
  );
  assert.ok(
    calls.every((c) => new URL(c.url).origin === 'https://ids.njust.edu.cn'),
  );
});
void test('a failed teaching homepage session stops before timetable or export', async () => {
  const calls: JwRequest[] = [];
  const session = new JwSession(async (req) => {
    calls.push(req);
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.url === SSO_URL) return page('SSO callback');
    if (req.url === MAIN_URL)
      return page('<input name="PASSWORD" type="password">');
    if (req.method === 'POST') return page('hall');
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /尚未建立登录会话/,
  );
  assert.equal(
    calls.some((c) => c.url === TABLE_URL),
    false,
  );
});
void test('an authentication execution is never retried after a failed password', async () => {
  let posts = 0;
  const session = new JwSession(async (req) => {
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.method === 'POST') {
      posts++;
      return page(loginHtml + '用户名或密码错误');
    }
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /密码不正确/,
  );
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /登录已过期/,
  );
  assert.equal(posts, 1);
});

void test('teaching CAS service is allowed only for the exact official callback', () => {
  for (const url of [
    SSO_URL,
    SSO_URL.replace('http:', 'https:'),
    'https://ids.njust.edu.cn/authserver/login?service=' +
      encodeURIComponent(SSO_URL.replace('http:', 'https:')),
  ])
    assert.equal(allowedUrl(url).href, url);
  assert.throws(() =>
    allowedUrl(
      'https://ids.njust.edu.cn/authserver/login?service=' +
        encodeURIComponent(
          'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp.evil',
        ),
    ),
  );
  assert.throws(() =>
    validateRequest({ url: SSO_URL, method: 'POST', body: 'password=fixture' }),
  );
});
void test('failed teaching CAS stops without resubmitting credentials or exporting', async () => {
  const calls: JwRequest[] = [];
  const session = new JwSession(async (req) => {
    calls.push(req);
    if (req.url.includes('getCaptcha.htl')) return picture;
    if (req.method === 'POST') return page('hall');
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /教务单点登录未完成/,
  );
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
  assert.ok(!calls.some((c) => c.url === MAIN_URL || c.url === TABLE_URL));
});
