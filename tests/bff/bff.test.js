'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createBff } from '../../bff/index.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers
  });
  res.end(payload);
}

function markdown(res, status, text, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...headers
  });
  res.end(text);
}

async function setup() {
  const upstream = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') return json(res, 200, { status: 'ok' });
    if (url.pathname === '/api/v1/slow') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return json(res, 200, { slow: true });
    }
    if (url.pathname === '/api/v1/conflict') {
      return json(res, 409, { error: { code: 'revision_conflict', message: '版本冲突' } });
    }
    if (url.pathname === '/api/v1/redirect') {
      res.writeHead(302, { Location: '/api/v1/echo' });
      return res.end();
    }
    if (url.pathname === '/api/v1/skills/s1/document') {
      const etag = '"7"';
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
        return res.end();
      }
      return markdown(res, 200, '# CRES 技能\n\n## 流程总述\n\n正文\n', { ETag: etag });
    }
    if (url.pathname === '/api/v1/skills/s1/download') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="cres-v1.0.zip"',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(Buffer.from('PK'));
    }
    if (url.pathname === '/api/v1/echo') {
      const body = await readBody(req);
      return json(res, 201, {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body
      }, { Location: '/api/v1/echo/1', 'X-Request-Id': req.headers['x-request-id'] || '' });
    }
    return json(res, 404, { error: { code: 'not_found', message: 'upstream 404' } });
  });
  const upstreamPort = await listen(upstream);

  const bff = createBff({
    apiBase: `http://127.0.0.1:${upstreamPort}`,
    timeoutMs: 80,
    maxBody: 64,
    quiet: true
  });
  const bffServer = http.createServer((req, res) => bff.handle(req, res));
  const bffPort = await listen(bffServer);

  return {
    upstream,
    upstreamPort,
    bffServer,
    base: `http://127.0.0.1:${bffPort}`
  };
}

let ctx;

test.before(async () => {
  ctx = await setup();
});

test.after(async () => {
  await close(ctx.bffServer);
  await close(ctx.upstream);
});

test('healthz 与列表路径同源透传', async () => {
  const health = await fetch(ctx.base + '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const list = await fetch(ctx.base + '/api/v1/echo?limit=2');
  assert.equal(list.status, 201);
  const body = await list.json();
  assert.equal(body.url, '/api/v1/echo?limit=2');
  assert.equal(list.headers.get('location'), '/api/v1/echo/1');
  assert.equal(list.headers.get('access-control-allow-origin'), null);
});

test('方法、请求头、请求体与 X-Request-Id 原样透传', async () => {
  const response = await fetch(ctx.base + '/api/v1/echo?x=1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': '"3"',
      'X-Actor': 'ui-test',
      'X-Request-Id': 'req-123'
    },
    body: JSON.stringify({ name: 'probe' })
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.method, 'POST');
  assert.equal(body.headers['if-match'], '"3"');
  assert.equal(body.headers['x-actor'], 'ui-test');
  assert.equal(body.headers['x-request-id'], 'req-123');
  assert.equal(body.body, '{"name":"probe"}');
  assert.equal(response.headers.get('x-request-id'), 'req-123');
});

test('后端 409 错误体原样返回', async () => {
  const response = await fetch(ctx.base + '/api/v1/conflict');
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: 'revision_conflict', message: '版本冲突' }
  });
});

test('文档端点透传 markdown、ETag 与 If-None-Match 304', async () => {
  const first = await fetch(ctx.base + '/api/v1/skills/s1/document', {
    headers: { 'Accept': 'text/markdown' }
  });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(first.headers.get('etag'), '"7"');
  assert.equal(await first.text(), '# CRES 技能\n\n## 流程总述\n\n正文\n');

  const cached = await fetch(ctx.base + '/api/v1/skills/s1/document', {
    headers: { 'Accept': 'text/markdown', 'If-None-Match': '"7"' }
  });
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get('etag'), '"7"');
  assert.equal(await cached.text(), '');
});

test('不支持的方法返回 405 且带 Allow', async () => {
  const response = await fetch(ctx.base + '/api/v1/echo', { method: 'OPTIONS' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST, PUT, PATCH, DELETE');
});

test('超出 body 上限返回 413', async () => {
  const response = await fetch(ctx.base + '/api/v1/echo', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'x'.repeat(100)
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'payload_too_large');
});

test('默认 body 上限覆盖 Skill 附件上传（>1 MiB）', async () => {
  const bff = createBff({ apiBase: `http://127.0.0.1:${ctx.upstreamPort}`, timeoutMs: 5000, quiet: true });
  const server = http.createServer((req, res) => bff.handle(req, res));
  const port = await listen(server);
  try {
    const body = 'x'.repeat(2 * 1024 * 1024);
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).body.length, body.length);
  } finally {
    await close(server);
  }
});

test('下载响应透传 Content-Disposition 与 X-Content-Type-Options', async () => {
  const response = await fetch(ctx.base + '/api/v1/skills/s1/download');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="cres-v1.0.zip"');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-type'), 'application/zip');
});

test('上游超时返回 504', async () => {
  const response = await fetch(ctx.base + '/api/v1/slow');
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'upstream_timeout');
});

test('上游不可用返回 502', async () => {
  const dead = createBff({
    apiBase: 'http://127.0.0.1:1',
    timeoutMs: 100,
    maxBody: 64,
    quiet: true
  });
  const server = http.createServer((req, res) => dead.handle(req, res));
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/skills`);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'upstream_unavailable');
  } finally {
    await close(server);
  }
});

test('非白名单路径与路径穿越不转发', async () => {
  const docs = await fetch(ctx.base + '/docs');
  assert.equal(docs.status, 404);

  const traversal = await fetch(ctx.base + '/api/v1/%2e%2e/secret');
  assert.equal(traversal.status, 404);
});

test('重定向不跟随，原样返回 Location', async () => {
  const response = await fetch(ctx.base + '/api/v1/redirect', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/api/v1/echo');
});
