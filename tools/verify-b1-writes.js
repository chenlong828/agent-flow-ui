#!/usr/bin/env node
/**
 * B1 四页真实写入冒烟（Playwright WebKit + 真实 BFF）
 * 用法: BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js
 * 每个页面通过 UI 新建一条唯一数据，确认后端已落库，然后清理。
 * 注意：会写并删除真实 B1 测试数据，运行前确认目标环境。
 */
import assert from 'node:assert/strict';
import { launchBrowser, openPage, assertNoPageErrors } from './test-harness.js';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const stamp = Date.now().toString(36);

async function api(pathname, opts) {
  const res = await fetch(BASE + '/api/v1' + pathname, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
  return { status: res.status, data };
}
async function list(kind) {
  const r = await api('/' + kind + '?limit=200');
  assert.equal(r.status, 200, 'GET ' + kind + ' -> ' + r.status);
  return r.data.items;
}
async function removeByName(kind, name) {
  const item = (await list(kind)).filter((x) => x.name === name)[0];
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
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (revision != null) headers['If-Match'] = '"' + revision + '"';
  const r = await api(pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
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
    const draft = await write('POST', '/skill-drafts', { skillId: d.id });
    const saved = await write('POST', '/skill-drafts/' + draft.id + '/save', {
      name: d.name, categoryCode: d.categoryCode, description: 'B1 update smoke',
      tags: d.tags || [], body: d.body
    }, d.revision);
    assert.match(saved.version, /^v\d+\.\d+$/);
    await write('PATCH', '/skills/' + d.id + '/enabled', { enabled: false }, saved.revision);
  } else if (kind === 'experts') {
    await write('PATCH', '/experts/' + d.id, { duty: 'B1 update smoke' }, d.revision);
    await write('PATCH', '/experts/' + d.id + '/enabled', { enabled: false }, d.revision + 1);
  }
  const after = await detail(kind, item.id);
  assert.ok(after.revision > d.revision, kind + ' revision 未递增');
  if (kind === 'skills') {
    assert.equal(after.description, 'B1 update smoke');
    assert.equal(after.summary, undefined);
    assert.equal(after.triggers, undefined);
    const docRes = await fetch(BASE + '/api/v1/skills/' + encodeURIComponent(item.id) + '/document', { headers: { Accept: 'text/markdown' } });
    const docText = await docRes.text();
    assert.equal(docRes.status, 200);
    assert.equal(docRes.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.ok(docText.includes('description: "B1 update smoke"'));
    const etag = docRes.headers.get('etag');
    assert.match(etag || '', /^"\d+"$/);
    const cached = await fetch(BASE + '/api/v1/skills/' + encodeURIComponent(item.id) + '/document', { headers: { Accept: 'text/markdown', 'If-None-Match': etag } });
    assert.equal(cached.status, 304);
    const legacy = await api('/skills/' + encodeURIComponent(item.id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': '"' + after.revision + '"' },
      body: JSON.stringify({ name: after.name, description: after.description })
    });
    assert.equal(legacy.status, 404);
    assert.equal(legacy.data.error.code, 'not_found');
    const stale = await api('/skill-drafts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skillId: item.id })
    });
    assert.equal(stale.status, 201);
    const noMatch = await api('/skill-drafts/' + stale.data.id + '/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: after.name, categoryCode: after.categoryCode, description: after.description, tags: after.tags || [], body: after.body })
    });
    assert.equal(noMatch.status, 428);
    await api('/skill-drafts/' + stale.data.id, { method: 'DELETE' });
  }
  await write('DELETE', '/' + kind + '/' + item.id, undefined, after.revision);
  assert.equal(await exists(kind, name), false, kind + ' 删除后仍存在');
}
async function waitName(kind, name, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (await exists(kind, name)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('等待 ' + label + ' 落库超时');
}
async function open(browser, pageName, query = '') {
  return openPage(browser, BASE, pageName, query, { routeB1: false, wait: 900 });
}

async function pageHarness(browser) {
  const name = 'AF-harness-' + stamp;
  const ctx = await open(browser, 'harnesses');
  try {
    await ctx.page.locator('#page-body tbody tr').first().waitFor({ state: 'visible' });
    await ctx.page.locator('#ha-reg-btn').click();
    await ctx.page.locator('[data-m="name"]').fill(name);
    await ctx.page.locator('[data-m="address"]').fill('127.0.0.1:19999');
    await ctx.page.locator('[data-m="concurrencyMax"]').fill('2');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await waitName('harnesses', name, 'Harness');
    await fullCrud('harnesses', name);
    assertNoPageErrors(ctx.errors);
    console.log('✓ harnesses.html 创建 ' + name);
  } finally {
    await ctx.page.close();
    await removeByName('harnesses', name);
  }
}

async function pageTool(browser) {
  const name = 'af_tool_' + stamp;
  const harnesses = await list('harnesses');
  assert.ok(harnesses.length > 0, '缺少 Harness，无法创建 Tool');
  const ctx = await open(browser, 'tools');
  try {
    await ctx.page.locator('#tl-table tbody tr').first().waitFor({ state: 'visible' });
    await ctx.page.locator('#tl-add').click();
    await ctx.page.locator('#tl-f-name').fill(name);
    await ctx.page.locator('#tl-f-inv').fill('echo ' + name);
    await ctx.page.locator('#tl-f-harness').selectOption(harnesses[0].id);
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await waitName('tools', name, 'Tool');
    await fullCrud('tools', name);
    assertNoPageErrors(ctx.errors);
    console.log('✓ tools.html 创建 ' + name);
  } finally {
    await ctx.page.close();
    await removeByName('tools', name);
  }
}

async function pageSkill(browser) {
  const name = 'AF Skill ' + stamp;
  const ctx = await open(browser, 'skill-detail', 'mode=new');
  try {
    await ctx.page.locator('#sk-name').waitFor({ state: 'visible' });
    await ctx.page.locator('#sk-cat option').first().waitFor({ state: 'attached' });
    const cat = await ctx.page.locator('#sk-cat option').first().getAttribute('value');
    await ctx.page.locator('#sk-name').fill(name);
    await ctx.page.locator('#sk-cat').selectOption(cat);
    await ctx.page.locator('#sk-desc').fill('适用：B1 写入验证；触发：冒烟；不适用：生产。');
    await ctx.page.locator('#sk-save').click();
    await waitName('skills', name, 'Skill');
    await ctx.page.locator('#sk-edit').waitFor({ state: 'visible' });
    await fullCrud('skills', name);
    assertNoPageErrors(ctx.errors);
    console.log('✓ skill-detail.html 创建 ' + name);
  } finally {
    await ctx.page.close();
    await removeByName('skills', name);
  }
}

async function pageExpert(browser) {
  const name = 'AF Expert ' + stamp;
  const ctx = await open(browser, 'experts');
  try {
    await ctx.page.locator('#ex-grid .item-card').first().waitFor({ state: 'visible' });
    await ctx.page.locator('#ex-new').click();
    await ctx.page.locator('#ex-n-name').fill(name);
    await ctx.page.locator('#ex-n-role').fill('验证 B1 专家写入');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await waitName('experts', name, 'Expert');
    await fullCrud('experts', name);
    assertNoPageErrors(ctx.errors);
    console.log('✓ experts.html 创建 ' + name);
  } finally {
    await ctx.page.close();
    await removeByName('experts', name);
  }
}

(async () => {
  const browser = await launchBrowser();
  try {
    await pageHarness(browser);
    await pageTool(browser);
    await pageSkill(browser);
    await pageExpert(browser);
    console.log('B1 四页真实写入验证通过');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('B1 四页真实写入验证失败:', e && e.stack ? e.stack : e);
  process.exit(1);
});
