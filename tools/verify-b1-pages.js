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
  const total = (await apiGet('/api/v1/skills?limit=200')).total;
  const ctx = await load('skills.html');
  try {
    const rows = await waitFor(() => {
      const n = ctx.doc.querySelectorAll('#sk-tblbox tbody tr').length;
      return n ? n : null;
    }, 'skill rows');
    assert.equal(rows, total, 'Skill 行数与 B1 总数不一致');
    assert.match(ctx.doc.querySelector('#sk-count').textContent, new RegExp('共\\s*' + total));
    assert.equal(ctx.doc.querySelectorAll('[data-cat]').length >= 4, true, '缺少分类入口');
    assert.deepEqual(ctx.errors, [], 'Skill 页面错误: ' + ctx.errors.join(' | '));
  } finally { ctx.close(); }
  console.log('✓ skills.html live rows=' + total);
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
