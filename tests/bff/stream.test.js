'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createBff } from '../../bff/index.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close(resolve);
  });
}

async function setup() {
  const state = { lastEventId: null, upstreamClosed: false, endedAt: 0 };
  const snapshot = 'event: snapshot\nid: 0\ndata: {"events":[]}\n\n';
  const event = 'event: event\nid: 1\ndata: {"seq":1}\n\n';
  const end = 'event: end\nid: 1\ndata: {"status":"completed"}\n\n';
  const sseBody = snapshot + event + end;
  const upstream = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.endsWith('/session/events/stream')) {
      if (url.searchParams.get('fail') === '1') {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{"error":{"code":"client_observability_unavailable","message":"client 观测面不可达"}}');
        return;
      }
      state.lastEventId = req.headers['last-event-id'] || null;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
        /* 已结束会话上游会带 content-length；BFF 必须对 SSE 剥掉。 */
        'Content-Length': String(Buffer.byteLength(sseBody))
      });
      res.write(snapshot);
      setTimeout(() => {
        if (res.destroyed) return;
        res.write(event);
      }, 150);
      setTimeout(() => {
        if (res.destroyed) return;
        state.endedAt = Date.now();
        res.end(end);
      }, 300);
      res.on('close', () => { state.upstreamClosed = true; });
      return;
    }
    if (url.pathname.endsWith('/session/raw')) {
      const body = Buffer.from('raw!!');
      res.writeHead(200, {
        'Content-Type': 'application/zstd',
        'Content-Length': String(body.length),
        ETag: '"sha256-abc"',
        'X-Checksum-Sha256': 'abc',
        'Content-Disposition': 'attachment; filename="s.zst"',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store'
      });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":{"code":"not_found","message":"upstream 404"}}');
  });
  const upstreamPort = await listen(upstream);
  const bff = createBff({ apiBase: `http://127.0.0.1:${upstreamPort}`, timeoutMs: 10000, quiet: true });
  const bffServer = http.createServer((req, res) => bff.handle(req, res));
  const bffPort = await listen(bffServer);
  return { upstream, bffServer, state, base: `http://127.0.0.1:${bffPort}` };
}

function get(base, path, headers = {}) {
  const url = new URL(base + path);
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers }, (res) => resolve({ req, res }));
    req.on('error', reject);
  });
}

function readChunks(res) {
  return new Promise((resolve) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

test('SSE 首帧即时到达且不转发 content-length；Last-Event-ID 透传', async () => {
  const ctx = await setup();
  try {
    const { res } = await get(ctx.base, '/api/v1/runs/r1/nodes/n1/session/events/stream', { 'Last-Event-ID': '7' });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /text\/event-stream/);
    assert.equal(res.headers['x-accel-buffering'], 'no');
    assert.equal(res.headers['content-length'], undefined, 'SSE 不应转发 content-length');

    const firstAt = Date.now();
    let firstChunk = '';
    const rest = [];
    await new Promise((resolve) => {
      res.on('data', (chunk) => {
        if (!firstChunk) firstChunk = chunk.toString('utf8');
        else rest.push(chunk);
      });
      res.on('end', resolve);
    });
    const finishedAt = Date.now();
    assert.match(firstChunk, /event: snapshot/);
    assert.ok(ctx.state.lastEventId === '7', 'Last-Event-ID 应透传上游，实际 ' + ctx.state.lastEventId);
    assert.ok(finishedAt - firstAt >= 200, '首帧不应等到流结束才到达，实际间隔 ' + (finishedAt - firstAt) + 'ms');
    assert.ok(ctx.state.endedAt - firstAt >= 200, '上游应分段时间有间隔');
  } finally {
    await close(ctx.bffServer);
    await close(ctx.upstream);
  }
});

test('raw 流式透传 content-length / etag / x-checksum-sha256 / content-disposition', async () => {
  const ctx = await setup();
  try {
    const { res } = await get(ctx.base, '/api/v1/runs/r1/nodes/n1/session/raw');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/zstd');
    assert.equal(res.headers['content-length'], '5');
    assert.equal(res.headers.etag, '"sha256-abc"');
    assert.equal(res.headers['x-checksum-sha256'], 'abc');
    assert.equal(res.headers['content-disposition'], 'attachment; filename="s.zst"');
    assert.equal(await readChunks(res), 'raw!!');
  } finally {
    await close(ctx.bffServer);
    await close(ctx.upstream);
  }
});

test('客户端断开后 BFF abort 上游，不悬挂', async () => {
  const ctx = await setup();
  try {
    const { req, res } = await get(ctx.base, '/api/v1/runs/r1/nodes/n1/session/events/stream');
    await new Promise((resolve) => res.once('data', resolve));
    req.destroy();
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(ctx.state.upstreamClosed, true, '客户端断开后上游连接应关闭');
  } finally {
    await close(ctx.bffServer);
    await close(ctx.upstream);
  }
});

test('流式路径的上游错误体原样返回，不吞成 502', async () => {
  const ctx = await setup();
  try {
    const { res } = await get(ctx.base, '/api/v1/runs/r1/nodes/n1/session/events/stream?fail=1');
    assert.equal(res.statusCode, 503);
    assert.match(await readChunks(res), /client_observability_unavailable/);
  } finally {
    await close(ctx.bffServer);
    await close(ctx.upstream);
  }
});
