#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin')
  throw new Error('iOS 原生服务测试需要 macOS / Xcode。');
const output = resolve(root, 'outputs/ios/service-tests');
mkdirSync(output, { recursive: true });
const run = (command, args) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`${command} exited ${code}`)),
    );
  });
await run('xcrun', [
  'swiftc',
  '-swift-version',
  '5',
  '-module-cache-path',
  resolve(output, 'modules'),
  'ios/App/App/JwHTTPTransport.swift',
  'ios/App/App/JwPasswordCipher.swift',
  'ios/Tests/ServiceTransport/main.swift',
  '-o',
  resolve(output, 'transport-tests'),
]);
if (process.argv.includes('--live')) {
  await run(resolve(output, 'transport-tests'), ['--live']);
} else {
  let followed = false;
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res
        .writeHead(302, {
          Location: `http://${req.headers.host}/must-not-follow`,
        })
        .end();
    } else if (req.url === '/must-not-follow') {
      followed = true;
      res.end('should never happen');
    } else if (req.url === '/set-cookie') {
      res.setHeader('Set-Cookie', [
        'SID=one; Path=/',
        'SID=two; Path=/authserver; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
      ]);
      res.end('ok');
    } else if (req.url === '/echo-cookie') {
      res.end(req.headers.cookie ?? '');
    } else if (req.url === '/large-length') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': 6 * 1024 * 1024,
      });
      res.end(Buffer.alloc(6 * 1024 * 1024));
    } else if (req.url === '/large-chunked') {
      res.writeHead(200);
      res.write(Buffer.alloc(3 * 1024 * 1024));
      res.end(Buffer.alloc(3 * 1024 * 1024));
    } else if (req.url === '/cancel') {
      res.writeHead(200);
      res.flushHeaders();
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  try {
    await run(resolve(output, 'transport-tests'), [
      `http://127.0.0.1:${server.address().port}`,
    ]);
    assert.equal(
      followed,
      false,
      'URLSession must never follow a redirect automatically',
    );
  } finally {
    server.closeAllConnections();
    server.close();
  }
}
