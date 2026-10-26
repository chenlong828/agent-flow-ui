'use strict';

/**
 * CMP-bff：同源 API 透明转发。
 *
 * 只转发 /api/v1/* 与 /healthz；不改写路径、字段、状态码或错误体。
 * 不做 DTO 映射、revision 缓存、重试、聚合或模拟数据。
 * 文档端点（text/markdown + ETag）依赖 If-None-Match 与 ETag 透传。
 */

const crypto = require('crypto');

const DEFAULT_API_BASE = 'http://127.0.0.1:3100';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BODY = 1024 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_HEADERS = ['accept', 'content-type', 'if-match', 'if-none-match', 'x-actor', 'x-request-id'];
const RESPONSE_HEADERS = ['content-type', 'location', 'x-request-id', 'cache-control', 'etag'];

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
    let pathname;

    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return sendError(res, 400, requestId, 'bad_request', '请求 URL 不合法');
    }

    if (!isAllowedPath(pathname) || hasTraversal(pathname)) {
      return sendError(res, 404, requestId, 'not_found', '路径不在 BFF 白名单内');
    }
    if (!ALLOWED_METHODS.has(req.method)) {
      return sendError(res, 405, requestId, 'method_not_allowed', 'BFF 不支持该请求方法', {
        Allow: 'GET, POST, PUT, PATCH, DELETE'
      });
    }

    let body;
    try {
      body = await readBody(req, maxBody);
    } catch (error) {
      const code = error && error.code;
      const status = code === 'payload_too_large' ? 413 : 400;
      const text = code === 'payload_too_large' ? '请求体超过上限' : '读取请求体失败';
      return sendError(res, status, requestId, code || 'bad_request', text);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstreamUrl = new URL(req.url, apiBase);
      if (!isAllowedPath(upstreamUrl.pathname) || hasTraversal(upstreamUrl.pathname)) {
        return sendError(res, 404, requestId, 'not_found', '路径不在 BFF 白名单内');
      }

      const headers = {};
      for (const name of REQUEST_HEADERS) {
        const value = firstHeader(req.headers[name]);
        if (value !== undefined) headers[name] = value;
      }
      headers['x-request-id'] = requestId;
      if (body.length > 0) headers['content-length'] = String(body.length);

      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
        redirect: 'manual',
        signal: controller.signal
      });
      const payload = Buffer.from(await upstream.arrayBuffer());

      const responseHeaders = {};
      for (const name of RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value !== null) responseHeaders[name] = value;
      }
      responseHeaders['x-request-id'] = upstream.headers.get('x-request-id') || requestId;
      responseHeaders['cache-control'] = responseHeaders['cache-control'] || 'no-store';
      if (!responseHeaders['content-type'] && payload.length > 0) {
        responseHeaders['content-type'] = 'application/json; charset=utf-8';
      }

      res.writeHead(upstream.status, responseHeaders);
      res.end(payload);
      log(quiet, req.method, pathname, upstream.status, Date.now() - startedAt, requestId);
    } catch (error) {
      if (controller.signal.aborted) {
        sendError(res, 504, requestId, 'upstream_timeout', 'B1 后端超时');
        log(quiet, req.method, pathname, 504, Date.now() - startedAt, requestId);
      } else {
        sendError(res, 502, requestId, 'upstream_unavailable', 'B1 后端不可用');
        log(quiet, req.method, pathname, 502, Date.now() - startedAt, requestId);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { handle, config: { apiBase: apiBase.origin, timeoutMs, maxBody } };
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

module.exports = { createBff, DEFAULT_API_BASE, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BODY };
