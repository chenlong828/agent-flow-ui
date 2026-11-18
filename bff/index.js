'use strict';

/**
 * CMP-bff：同源 API 透明转发。
 *
 * 只转发 /api/v1/* 与 /healthz；不改写路径、字段、状态码或错误体。
 * 不做 DTO 映射、revision 缓存、重试、聚合或模拟数据。
 * 文档端点（text/markdown + ETag）依赖 If-None-Match 与 ETag 透传。
 */

import crypto from 'node:crypto';
import { Readable } from 'node:stream';

const DEFAULT_API_BASE = 'http://127.0.0.1:3100';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BODY = 25 * 1024 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_HEADERS = ['accept', 'content-type', 'if-match', 'if-none-match', 'x-actor', 'x-request-id', 'last-event-id'];
const RESPONSE_HEADERS = ['content-type', 'location', 'x-request-id', 'cache-control', 'etag', 'content-disposition', 'x-content-type-options'];
const STREAM_RESPONSE_HEADERS = [
  'content-type', 'cache-control', 'x-request-id', 'etag', 'content-disposition',
  'content-length', 'x-checksum-sha256', 'accept-ranges', 'x-accel-buffering', 'x-content-type-options'
];
/* 只有 client 观测面的实时流与 raw 下载走流式；其余 JSON 仍完整转发。 */
const STREAM_PATH = /^\/api\/v1\/runs\/[^/]+\/nodes\/[^/]+\/session\/(?:events\/stream|raw)$/;

function createBff(options = {}) {
  const apiBase = new URL(options.apiBase || process.env.API_BASE || DEFAULT_API_BASE);
  const timeoutMs = Number(options.timeoutMs ?? process.env.BFF_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxBody = Number(options.maxBody ?? process.env.BFF_MAX_BODY ?? DEFAULT_MAX_BODY);
  const quiet = Boolean(options.quiet);

  if (apiBase.protocol !== 'http:' && apiBase.protocol !== 'https:') {
    throw new Error('API_BASE 必须是 http/https');
  }
  if (apiBase.pathname !== '/' && apiBase.pathname !== '') {
    throw new Error('API_BASE 只接受 origin，不接受路径');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('BFF_TIMEOUT_MS 必须是正数');
  }
  if (!Number.isInteger(maxBody) || maxBody <= 0) {
    throw new Error('BFF_MAX_BODY 必须是正整数');
  }

  async function handle(req, res) {
    const startedAt = Date.now();
    const requestId = firstHeader(req.headers['x-request-id']) || crypto.randomUUID();
    const pathname = requestPath(req);
    if (!pathname) return sendError(res, 400, requestId, 'bad_request', '请求 URL 不合法');
    const rejection = rejectRequest(req, pathname);
    if (rejection) {
      return sendError(res, rejection.status, requestId, rejection.code, rejection.message, rejection.headers);
    }

    let body;
    try {
      body = await readBody(req, maxBody);
    } catch (error) {
      return sendBodyError(res, requestId, error);
    }

    const stream = STREAM_PATH.test(pathname);
    const controller = new AbortController();
    const isUpload = String(req.headers['content-type'] || '').startsWith('multipart/form-data');
    const effectiveTimeout = isUpload ? Math.max(timeoutMs, 120000) : timeoutMs;
    const timer = stream ? null : setTimeout(() => controller.abort(), effectiveTimeout);
    const ctx = { requestId, method: req.method, pathname, startedAt, quiet };
    try {
      const upstreamUrl = new URL(req.url, apiBase);
      if (!isAllowedPath(upstreamUrl.pathname) || hasTraversal(upstreamUrl.pathname)) {
        return sendError(res, 404, requestId, 'not_found', '路径不在 BFF 白名单内');
      }
      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers: upstreamHeaders(req, body, requestId),
        body: body.length > 0 ? body : undefined,
        redirect: 'manual',
        signal: controller.signal
      });
      if (stream) {
        pipeStream(upstream, res, Object.assign({ controller: controller }, ctx));
        return;
      }
      await forwardJson(upstream, res, ctx);
    } catch {
      upstreamFailure(res, controller, ctx);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { handle, config: { apiBase: apiBase.origin, timeoutMs, maxBody } };
}

/**
 * SSE/raw 流式转发：不缓冲上游 body，头先发出，逐块 pipe 给客户端。
 * headers 已发后上游出错只能 destroy；客户端断开时 abort 上游，避免悬挂。
 */
function pipeStream(upstream, res, ctx) {
  const headers = {};
  for (const name of STREAM_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  headers['x-request-id'] = upstream.headers.get('x-request-id') || ctx.requestId;
  headers['cache-control'] = headers['cache-control'] || 'no-store';
  /* SSE 由上游定义帧边界，不能带 content-length（已结束会话上游会带，需剥掉）。 */
  if (/text\/event-stream/i.test(headers['content-type'] || '')) delete headers['content-length'];

  res.writeHead(upstream.status, headers);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  if (!upstream.body) {
    res.end();
    return;
  }

  const source = Readable.fromWeb(upstream.body);
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    ctx.controller.abort();
    source.destroy();
    if (!res.writableEnded) res.destroy();
  };
  res.on('close', () => {
    if (!res.writableEnded) stop();
  });
  source.on('error', () => {
    if (!res.writableEnded) res.destroy();
  });
  res.on('finish', () => {
    if (done) return;
    done = true;
    log(ctx.quiet, ctx.method, ctx.pathname, upstream.status, Date.now() - ctx.startedAt, ctx.requestId);
  });
  source.pipe(res);
}

function requestPath(req) {
  try { return new URL(req.url, 'http://localhost').pathname; } catch { return null; }
}

function rejectRequest(req, pathname) {
  if (!isAllowedPath(pathname) || hasTraversal(pathname)) {
    return { status: 404, code: 'not_found', message: '路径不在 BFF 白名单内' };
  }
  if (!ALLOWED_METHODS.has(req.method)) {
    return {
      status: 405,
      code: 'method_not_allowed',
      message: 'BFF 不支持该请求方法',
      headers: { Allow: 'GET, POST, PUT, PATCH, DELETE' }
    };
  }
  return null;
}

function sendBodyError(res, requestId, error) {
  const code = error && error.code;
  const status = code === 'payload_too_large' ? 413 : 400;
  const text = code === 'payload_too_large' ? '请求体超过上限' : '读取请求体失败';
  return sendError(res, status, requestId, code || 'bad_request', text);
}

function upstreamHeaders(req, body, requestId) {
  const headers = {};
  for (const name of REQUEST_HEADERS) {
    const value = firstHeader(req.headers[name]);
    if (value !== undefined) headers[name] = value;
  }
  headers['x-request-id'] = requestId;
  if (body.length > 0) headers['content-length'] = String(body.length);
  return headers;
}

async function forwardJson(upstream, res, ctx) {
  const payload = Buffer.from(await upstream.arrayBuffer());
  const headers = {};
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers[name] = value;
  }
  headers['x-request-id'] = upstream.headers.get('x-request-id') || ctx.requestId;
  headers['cache-control'] = headers['cache-control'] || 'no-store';
  if (!headers['content-type'] && payload.length > 0) {
    headers['content-type'] = 'application/json; charset=utf-8';
  }
  res.writeHead(upstream.status, headers);
  res.end(payload);
  log(ctx.quiet, ctx.method, ctx.pathname, upstream.status, Date.now() - ctx.startedAt, ctx.requestId);
}

function upstreamFailure(res, controller, ctx) {
  const timeout = controller.signal.aborted;
  sendError(res, timeout ? 504 : 502, ctx.requestId,
    timeout ? 'upstream_timeout' : 'upstream_unavailable',
    timeout ? 'B1 后端超时' : 'B1 后端不可用');
  log(ctx.quiet, ctx.method, ctx.pathname, timeout ? 504 : 502, Date.now() - ctx.startedAt, ctx.requestId);
}

function isAllowedPath(pathname) {
  return pathname === '/healthz' || pathname.startsWith('/api/v1/');
}

function hasTraversal(pathname) {
  if (pathname.includes('\0')) return true;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return decoded.split('/').some((segment) => segment === '..');
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readBody(req, maxBody) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBody) {
        tooLarge = true;
        chunks.length = 0;
        req.resume();
        const error = new Error('payload too large');
        error.code = 'payload_too_large';
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    req.on('error', (error) => {
      if (!tooLarge) reject(error);
    });
  });
}

function sendError(res, status, requestId, code, message, extraHeaders = {}) {
  if (res.headersSent || res.writableEnded || res.destroyed) {
    if (!res.writableEnded && !res.destroyed) res.end();
    return;
  }
  const payload = JSON.stringify({ error: { code, message } });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
    ...extraHeaders
  });
  res.end(payload);
}

function log(quiet, method, pathname, status, elapsedMs, requestId) {
  if (quiet) return;
  console.log(`[bff] ${method} ${pathname} ${status} ${elapsedMs}ms ${requestId}`);
}

export { createBff, DEFAULT_API_BASE, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BODY };
