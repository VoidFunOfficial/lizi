import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { utils, write } from 'xlsx';
import {
  allowedUrl,
  decodeBytes,
  encodeBytes,
  JwCookies,
  LOGIN_URL,
  TABLE_URL,
  validateRequest,
  type JwRequest,
  type JwResponse,
  type Transport,
} from '../lib/student/jw/protocol.ts';
import {
  exportRequest,
  JwSession,
  nextLoginStep,
} from '../lib/student/jw/session.ts';
import { importTimetable } from '../lib/student/import.ts';

const loginHtml = '<form><input name="PASSWORD" type="password"></form>';
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
  cookies: ['JSESSIONID=captcha; Path=/'],
});

void test('only school login and read/export endpoints are permitted', () => {
  for (const url of [
    'https://evil.example/',
    'http://127.0.0.1:8080/Logon.do',
    'http://202.119.81.112:8080@evil.example/Logon.do',
    'http://202.119.81.112:9080/njlgdx/xk/Delete',
    'http://202.119.81.112:9080/njlgdx/xk/LoginToXk?method=exit',
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
void test('cookies isolate users and hosts, retain duplicate names by path and cross ports', () => {
  const a = new JwCookies();
  const b = new JwCookies();
  a.update(LOGIN_URL, ['JSESSIONID=login; Path=/']);
  a.update(TABLE_URL, ['JSESSIONID=table; Path=/njlgdx']);
  assert.equal(a.header(TABLE_URL), 'JSESSIONID=table; JSESSIONID=login');
  assert.equal(a.header(LOGIN_URL), 'JSESSIONID=login');
  assert.equal(a.header(TABLE_URL.replace('.112', '.113')), '');
  assert.equal(
    a.header(TABLE_URL.replace('/njlgdx/', '/njlgdxother/')),
    'JSESSIONID=login',
  );
  assert.equal(b.header(TABLE_URL), '');
  a.clear();
  assert.equal(a.header(TABLE_URL), '');
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
      '<form action="http://202.119.81.112:9080/njlgdx/xk/LoginToXk" method="post"><input name="ticket" type="hidden" value="a&amp;b"></form>',
      LOGIN_URL,
    ),
    {
      url: 'http://202.119.81.112:9080/njlgdx/xk/LoginToXk',
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
void test('complete import preserves captcha cookie, follows login redirect, posts print and parses XLS', async () => {
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
  const transport: Transport = async (req) => {
    calls.push(req);
    if (req.url.includes('verifycode')) return picture;
    if (req.url === LOGIN_URL && req.method === 'GET')
      return page(loginHtml, { cookies: ['JSESSIONID=initial; Path=/'] });
    if (req.url === LOGIN_URL) {
      assert.equal(req.cookie, 'JSESSIONID=captcha');
      const body = new URLSearchParams(req.body);
      assert.equal(body.get('PASSWORD'), 'p&+=');
      assert.equal(body.get('RANDOMCODE'), 'AB12');
      return page('', { status: 302, location: '/framework/main.jsp' });
    }
    if (req.url.endsWith('/framework/main.jsp')) return page('welcome');
    if (req.url === TABLE_URL)
      return page(tableHtml, { cookies: ['JSESSIONID=table; Path=/njlgdx'] });
    assert.equal(req.method, 'POST');
    assert.match(req.cookie!, /^JSESSIONID=table;/);
    return page('', {
      contentType: 'application/vnd.ms-excel',
      data: encodeBytes(new Uint8Array(xls)),
    });
  };
  const session = new JwSession(transport);
  assert.match(await session.captcha(), /^data:image\/jpeg;base64,/);
  const buffer = await session.import('student', 'p&+=', 'AB12', () => {});
  assert.ok(importTimetable(buffer).courses.length > 0);
  assert.equal(
    calls.filter((c) => c.url === LOGIN_URL && c.method === 'POST').length,
    1,
  );
  session.close();
});
void test('captcha failure is reported without retrying credentials or exporting', async () => {
  let posts = 0;
  const session = new JwSession(async (req) => {
    if (req.url.includes('verifycode')) return picture;
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
    if (req.url.includes('verifycode')) return picture;
    if (req.method === 'POST')
      return page('', { status: 307, location: 'http://evil.example/' });
    return page(loginHtml);
  });
  await session.captcha();
  await assert.rejects(
    session.import('student', 'secret', 'AB12', () => {}),
    /不支持的跳转/,
  );
  assert.ok(calls.every((c) => new URL(c.url).hostname === '202.119.81.112'));
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
