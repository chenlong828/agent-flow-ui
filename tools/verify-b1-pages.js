#!/usr/bin/env node
/**
 * B1 四页真实读取验证（jsdom + 真实 BFF）
 * 用法: BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js
 * 前提: BFF 与 B1 后端已启动；本脚本只读，不写业务数据。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
let jsdom;
try { jsdom = require('jsdom'); } catch (e) {
  console.error('缺少 jsdom：见 docs/design/dev-environment.md');
  process.exit(1);
}
const { JSDOM, VirtualConsole } = jsdom;
const ROOT = path.join(__dirname, '..');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const IGNORE = /Could not load img|not implemented|Not implemented|navigation \(except hash changes\)/i;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function apiGet(p) {
  const res = await fetch(BASE + p);
  assert.equal(res.status, 200, 'GET ' + p + ' -> ' + res.status);
  return res.json();
}

async function apiText(p, headers) {
  const res = await fetch(BASE + p, { headers: Object.assign({ Accept: 'text/markdown' }, headers || {}) });
  return { res, text: await res.text() };
}

async function load(page) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = (e && e.message) || String(e);
    if (!IGNORE.test(msg)) errors.push(msg);
  });
  vc.on('error', (...args) => errors.push('console.error: ' + args.map(String).join(' ')));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'pages', page), 'utf8'), {
    url: BASE + '/pages/' + page,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = function (url, opts) {
        var target = /^https?:/.test(String(url)) ? String(url) : BASE + String(url);
        return fetch(target, opts);
      };
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
    }
  });
  return { dom, win: dom.window, doc: dom.window.document, errors, close() { dom.window.close(); } };
}

async function waitFor(fn, label, timeout) {
  const end = Date.now() + (timeout || 6000);
  while (Date.now() < end) {
    try { const v = fn(); if (v) return v; } catch (e) { /* 继续等 */ }
    await wait(100);
  }
  throw new Error('等待超时: ' + label);
}

async function harness() {
  const total = (await apiGet('/api/v1/harnesses?limit=200')).total;
  const ctx = await load('harnesses.html');
  try {
    const rows = await waitFor(() => {
      const n = ctx.doc.querySelectorAll('#page-body tbody tr').length;
      return n ? n : null;
    }, 'harness rows');
    assert.equal(rows, total, 'Harness 行数与 B1 总数不一致');
    assert.match(ctx.doc.querySelector('#page-body').textContent, /总数/);
    assert.deepEqual(ctx.errors, [], 'Harness 页面错误: ' + ctx.errors.join(' | '));
  } finally { ctx.close(); }
  console.log('✓ harnesses.html live rows=' + total);
}

async function tools() {
  const total = (await apiGet('/api/v1/tools?limit=200')).total;
  const ctx = await load('tools.html');
  try {
    const rows = await waitFor(() => {
      const n = ctx.doc.querySelectorAll('#tl-table tbody tr').length;
      return n ? n : null;
    }, 'tool rows');
    assert.equal(rows, total, 'Tool 行数与 B1 总数不一致');
    assert.equal(ctx.doc.querySelectorAll('[data-act="debug"]').length, 0, 'B1 无调试端点，不应出现调试入口');
    assert.deepEqual(ctx.errors, [], 'Tool 页面错误: ' + ctx.errors.join(' | '));
  } finally { ctx.close(); }
  console.log('✓ tools.html live rows=' + total);
}

async function skills() {
  const page = await apiGet('/api/v1/skills?limit=200');
  const total = page.total;
  const first = page.items[0];
  assert.ok(first && first.description, 'Skill 列表缺 description');
  assert.equal(first.summary, undefined, 'Skill 列表仍返回 summary');
  assert.equal(first.triggers, undefined, 'Skill 列表仍返回 triggers');

  const direct = await apiText('/api/v1/skills/' + encodeURIComponent(first.id) + '/document');
  assert.equal(direct.res.status, 200, '文档端点非 200');
  assert.equal(direct.res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  const etag = direct.res.headers.get('etag');
  assert.match(etag || '', /^"\d+"$/, '文档缺 ETag');
  assert.ok(direct.text.startsWith('---\n'), '文档缺 frontmatter');
  const cached = await apiText('/api/v1/skills/' + encodeURIComponent(first.id) + '/document', {
    'If-None-Match': etag
  });
  assert.equal(cached.res.status, 304, 'If-None-Match 未返回 304');
  assert.equal(cached.text, '', '304 不应有响应体');

  const ctx = await load('skills.html');
  try {
    const rows = await waitFor(() => {
      const n = ctx.doc.querySelectorAll('#sk-tblbox tbody tr').length;
      return n ? n : null;
    }, 'skill rows');
    assert.equal(rows, total, 'Skill 行数与 B1 总数不一致');
    assert.match(ctx.doc.querySelector('#sk-count').textContent, new RegExp('共\\s*' + total));
    assert.equal(ctx.doc.querySelectorAll('[data-cat]').length >= 4, true, '缺少分类入口');
    const head = ctx.doc.querySelector('#sk-tblbox thead').textContent;
    assert.ok(head.includes('描述') && !head.includes('触发'), 'Skill 列表列头仍是旧契约');

    const row = ctx.doc.querySelector('#sk-tblbox [data-view="' + first.id + '"]');
    assert.ok(row, '找不到首个 Skill 行');
    row.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, view: ctx.win }));
    await waitFor(() => ctx.doc.querySelector('[data-skview="document"]'), '全文 tab');
    ctx.doc.querySelector('[data-skview="document"]').dispatchEvent(new ctx.win.MouseEvent('click', {
      bubbles: true, cancelable: true, view: ctx.win
    }));
    const shown = await waitFor(() => {
      const el = ctx.doc.querySelector('#sk-doc-text');
      return el && el.textContent ? el.textContent : null;
    }, '全文内容');
    assert.equal(shown, direct.text, '全文视图与 GET /document 响应不一致');
    assert.deepEqual(ctx.errors, [], 'Skill 页面错误: ' + ctx.errors.join(' | '));
  } finally { ctx.close(); }
  console.log('✓ skills.html live rows=' + total + ' · document 200/304');
}

async function experts() {
  const total = (await apiGet('/api/v1/experts?limit=200')).total;
  const ctx = await load('experts.html');
  try {
    const cards = await waitFor(() => {
      const n = ctx.doc.querySelectorAll('#ex-grid .item-card').length;
      return n ? n : null;
    }, 'expert cards');
    assert.equal(cards, total, 'Expert 卡片数与 B1 总数不一致');
    assert.match(ctx.doc.querySelector('#page-body').textContent, /引用/);
    assert.deepEqual(ctx.errors, [], 'Expert 页面错误: ' + ctx.errors.join(' | '));
  } finally { ctx.close(); }
  console.log('✓ experts.html live cards=' + total);
}

(async () => {
  await harness();
  await tools();
  await skills();
  await experts();
  console.log('B1 四页真实读取验证通过');
})().catch((e) => {
  console.error('B1 四页真实读取验证失败:', e && e.stack ? e.stack : e);
  process.exit(1);
});
