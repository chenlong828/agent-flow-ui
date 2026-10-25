#!/usr/bin/env node
/**
 * B1 四页真实写入冒烟（jsdom + 真实 BFF）
 * 用法: BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js
 * 每个页面通过 UI 新建一条唯一数据，确认后端已落库，然后清理。
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
const stamp = Date.now().toString(36);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ev(win, type) {
  return new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win, clientX: 10, clientY: 10 });
}
function click(el) { assert.ok(el, 'click 目标为空'); el.dispatchEvent(ev(el.ownerDocument.defaultView, 'click')); }
function setValue(el, value) {
  assert.ok(el, '输入框为空');
  el.value = value;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('change', { bubbles: true }));
}
async function api(pathname, opts) {
  const res = await fetch(BASE + '/api/v1' + pathname, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
  return { status: res.status, data: data };
}
async function list(kind) {
  const r = await api('/' + kind + '?limit=200');
  assert.equal(r.status, 200, 'GET ' + kind + ' -> ' + r.status);
  return r.data.items;
}
async function removeByName(kind, name) {
  const items = await list(kind);
  const item = items.filter((x) => x.name === name)[0];
  if (!item) return;
  const r = await api('/' + kind + '/' + encodeURIComponent(item.id), {
    method: 'DELETE', headers: { 'If-Match': '"' + item.revision + '"' }
  });
  if (r.status >= 400) throw new Error('清理 ' + kind + '/' + name + ' 失败: HTTP ' + r.status);
}
async function exists(kind, name) {
  return (await list(kind)).some((x) => x.name === name);
}

async function detail(kind, id) {
  const r = await api('/' + kind + '/' + encodeURIComponent(id));
  assert.equal(r.status, 200, 'GET ' + kind + '/' + id + ' -> ' + r.status);
  return r.data;
}
async function write(method, pathname, body, revision) {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (revision != null) headers['If-Match'] = '"' + revision + '"';
  const r = await api(pathname, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(r.status >= 200 && r.status < 300, method + ' ' + pathname + ' -> ' + r.status + ' ' + JSON.stringify(r.data));
  return r.data;
}
async function fullCrud(kind, name) {
  const item = (await list(kind)).filter((x) => x.name === name)[0];
  assert.ok(item, '缺少待更新资产 ' + name);
  const d = await detail(kind, item.id);
  if (kind === 'harnesses') {
    await write('PUT', '/harnesses/' + d.id, {
      name: d.name, kind: d.kind, address: d.address, accessMode: d.accessMode,
      description: 'B1 update smoke', concurrencyMax: d.concurrencyMax,
      queuePolicy: d.queuePolicy, tags: d.tags || []
    }, d.revision);
    await write('PATCH', '/harnesses/' + d.id + '/enabled', { enabled: false }, d.revision + 1);
  } else if (kind === 'tools') {
    await write('PUT', '/tools/' + d.id, {
      name: d.name, kind: d.kind, invocation: d.invocation + ' --smoke', description: 'B1 update smoke',
      harnessId: d.harnessId, timeoutMs: d.timeoutMs, params: d.params || []
    }, d.revision);
  } else if (kind === 'skills') {
    await write('PUT', '/skills/' + d.id, {
      name: d.name, categoryCode: d.categoryCode, summary: 'B1 update smoke',
      tags: d.tags || [], triggers: d.triggers || [], sections: d.sections || {},
      pitfalls: d.pitfalls || [], refs: (d.refs || []).map((r) => ({ label: r.label, refType: r.refType, path: r.path }))
    }, d.revision);
    await write('PATCH', '/skills/' + d.id + '/enabled', { enabled: false }, d.revision + 1);
  } else if (kind === 'experts') {
    await write('PATCH', '/experts/' + d.id, { duty: 'B1 update smoke' }, d.revision);
    await write('PATCH', '/experts/' + d.id + '/enabled', { enabled: false }, d.revision + 1);
  }
  const after = await detail(kind, item.id);
  assert.ok(after.revision > d.revision, kind + ' revision 未递增');
  await write('DELETE', '/' + kind + '/' + item.id, undefined, after.revision);
  assert.equal(await exists(kind, name), false, kind + ' 删除后仍存在');
}

async function waitName(kind, name, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (await exists(kind, name)) return;
    await wait(150);
  }
  throw new Error('等待 ' + label + ' 落库超时');
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
        const target = /^https?:/.test(String(url)) ? String(url) : BASE + String(url);
        return fetch(target, opts);
      };
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
    }
  });
  return { dom, win: dom.window, doc: dom.window.document, errors, close() { dom.window.close(); } };
}

async function waitFor(fn, label, timeout) {
  const end = Date.now() + (timeout || 8000);
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(100);
  }
  throw new Error('等待超时: ' + label);
}

async function pageHarness() {
  const name = 'AF-harness-' + stamp;
  const ctx = await load('harnesses.html');
  try {
    await waitFor(() => ctx.doc.querySelectorAll('#page-body tbody tr').length, 'harness list');
    click(ctx.doc.querySelector('#ha-reg-btn'));
    await wait(100);
    setValue(ctx.doc.querySelector('[data-m="name"]'), name);
    setValue(ctx.doc.querySelector('[data-m="address"]'), '127.0.0.1:19999');
    setValue(ctx.doc.querySelector('[data-m="concurrencyMax"]'), '2');
    click(ctx.doc.querySelector('.modal .d-foot .btn.primary'));
    await waitName('harnesses', name, 'Harness');
    await fullCrud('harnesses', name);
    assert.deepEqual(ctx.errors, [], 'Harness 页面错误: ' + ctx.errors.join(' | '));
    console.log('✓ harnesses.html 创建 ' + name);
  } finally {
    ctx.close();
    await removeByName('harnesses', name);
  }
}

async function pageTool() {
  const name = 'af_tool_' + stamp;
  const harnesses = await list('harnesses');
  assert.ok(harnesses.length > 0, '缺少 Harness，无法创建 Tool');
  const ctx = await load('tools.html');
  try {
    await waitFor(() => ctx.doc.querySelectorAll('#tl-table tbody tr').length, 'tool list');
    click(ctx.doc.querySelector('#tl-add'));
    await wait(100);
    setValue(ctx.doc.querySelector('#tl-f-name'), name);
    setValue(ctx.doc.querySelector('#tl-f-inv'), 'echo ' + name);
    const select = ctx.doc.querySelector('#tl-f-harness');
    select.value = harnesses[0].id;
    select.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    click(ctx.doc.querySelector('.modal .d-foot .btn.primary'));
    await waitName('tools', name, 'Tool');
    await fullCrud('tools', name);
    assert.deepEqual(ctx.errors, [], 'Tool 页面错误: ' + ctx.errors.join(' | '));
    console.log('✓ tools.html 创建 ' + name);
  } finally {
    ctx.close();
    await removeByName('tools', name);
  }
}

async function pageSkill() {
  const name = 'AF Skill ' + stamp;
  const ctx = await load('skills.html');
  try {
    await waitFor(() => ctx.doc.querySelectorAll('#sk-tblbox tbody tr').length, 'skill list');
    click(ctx.doc.querySelector('#sk-new'));
    await wait(150);
    setValue(ctx.doc.querySelector('#sk-nk-name'), name);
    setValue(ctx.doc.querySelector('#sk-nk-sum'), 'B1 写入验证用 Skill');
    click(ctx.doc.querySelector('.modal .d-foot .btn.primary'));
    await waitName('skills', name, 'Skill');
    await fullCrud('skills', name);
    assert.deepEqual(ctx.errors, [], 'Skill 页面错误: ' + ctx.errors.join(' | '));
    console.log('✓ skills.html 创建 ' + name);
  } finally {
    ctx.close();
    await removeByName('skills', name);
  }
}

async function pageExpert() {
  const name = 'AF Expert ' + stamp;
  const ctx = await load('experts.html');
  try {
    await waitFor(() => ctx.doc.querySelectorAll('#ex-grid .item-card').length, 'expert list');
    click(ctx.doc.querySelector('#ex-new'));
    await wait(100);
    setValue(ctx.doc.querySelector('#ex-n-name'), name);
    setValue(ctx.doc.querySelector('#ex-n-role'), '验证 B1 专家写入');
    click(ctx.doc.querySelector('.modal .d-foot .btn.primary'));
    await waitName('experts', name, 'Expert');
    await fullCrud('experts', name);
    assert.deepEqual(ctx.errors, [], 'Expert 页面错误: ' + ctx.errors.join(' | '));
    console.log('✓ experts.html 创建 ' + name);
  } finally {
    ctx.close();
    await removeByName('experts', name);
  }
}

(async () => {
  await pageHarness();
  await pageTool();
  await pageSkill();
  await pageExpert();
  console.log('B1 四页真实写入验证通过');
})().catch((e) => {
  console.error('B1 四页真实写入验证失败:', e && e.stack ? e.stack : e);
  process.exit(1);
});
