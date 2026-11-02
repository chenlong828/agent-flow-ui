/**
 * Playwright 测试公共层：静态服务、真实浏览器页面、B1 路由注入。
 *
 * 页面通过同源 /api/v1/* 发请求；测试用 Playwright route 把请求交给
 * tools/fake-b1.js 的内存实现，不向页面暴露 MOCK/API/DF 等全局。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, resetFakeB1 } from './fake-b1.js';
import { loadPlaywright } from './playwright.js';

const { webkit } = loadPlaywright();

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8'
};

export function startStaticServer() {
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    } catch {
      res.writeHead(400); res.end('bad url'); return;
    }
    if (pathname === '/') { res.writeHead(302, { Location: '/pages/workflow-list.html' }); res.end(); return; }
    if (!pathname.startsWith('/pages/') && !pathname.startsWith('/assets/')) {
      res.writeHead(404); res.end('not found'); return;
    }
    const target = path.resolve(ROOT, '.' + pathname);
    const rel = path.relative(ROOT, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.readFile(target, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        base: 'http://127.0.0.1:' + server.address().port,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

export async function launchBrowser() {
  return webkit.launch({ headless: true });
}

async function requestBody(request) {
  const headers = request.headers();
  const ct = String(headers['content-type'] || '');
  const raw = request.postDataBuffer();
  if (!raw) return undefined;
  if (ct.includes('multipart/form-data')) {
    const formRequest = new Request('http://local/upload', {
      method: request.method(),
      headers: { 'content-type': ct },
      body: raw
    });
    return formRequest.formData();
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(raw.toString());
  }
  if (ct.includes('application/json')) {
    return JSON.parse(raw.toString());
  }
  return raw.toString();
}

async function fulfill(route, result) {
  const body = result.body;
  const headers = { ...(result.headers || {}) };
  let payload;
  if (body == null) payload = '';
  else if (typeof body === 'string') payload = body;
  else payload = JSON.stringify(body);
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';
  }
  await route.fulfill({ status: result.status || 200, headers, body: payload });
}

export async function openPage(browser, base, pageName, query = '', opts = {}) {
  if (!opts.preserveFake) resetFakeB1();
  if (opts.setup) await opts.setup();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (opts.initScript) await page.addInitScript(opts.initScript);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location();
    if (loc && /\/favicon\.ico$/.test(loc.url || '')) return;
    // 4xx/5xx 是场景刻意覆盖的错误路径；页面已显式渲染错误态，不作为运行时崩溃。
    if (/Failed to load resource: the server responded with a status of/.test(msg.text())) return;
    errors.push('console.error: ' + msg.text());
  });

  if (opts.routeB1 !== false) await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const apiPath = url.pathname.replace(/^\/api\/v1/, '') + url.search;
    try {
      const body = await requestBody(req);
      const result = (opts.b3 && /^\/workflows(?:\/|\?|$)/.test(apiPath))
        ? await opts.b3.handle(req.method(), apiPath, body, req.headers())
        : await handle(req.method(), apiPath, body, req.headers());
      await fulfill(route, result);
    } catch (err) {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: { code: 'test_harness_error', message: String(err && err.message || err) } })
      });
    }
  });

  await page.goto(base + '/pages/' + pageName + '.html' + (query ? '?' + query : ''), { waitUntil: 'networkidle' });
  await page.waitForTimeout(opts.wait ?? 350);
  return { page, errors };
}

export function assertNoPageErrors(errors) {
  if (errors.length) throw new Error('页面运行错误: ' + errors.join(' | '));
}

export const q = (page, sel) => page.locator(sel).first();
export const count = (page, sel) => page.locator(sel).count();
export const text = (page, sel) => page.locator(sel).first().textContent();
export async function click(page, sel) {
  await page.locator(sel).first().click();
}
export async function fill(page, sel, value) {
  await page.locator(sel).first().fill(String(value));
}
export async function mouseDown(page, sel) {
  await page.locator(sel).first().dispatchEvent('mousedown');
}
export async function waitFor(page, sel, opts = {}) {
  await page.locator(sel).first().waitFor({ state: 'visible', timeout: opts.timeout ?? 3000 });
}
