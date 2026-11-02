#!/usr/bin/env node
/**
 * B1 四页真实读取验证（Playwright WebKit + 真实 BFF）
 * 用法: BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js
 * 前提: BFF 与 B1 后端已启动；本脚本只读，不写业务数据。
 */
import assert from 'node:assert/strict';
import { launchBrowser, openPage, assertNoPageErrors } from './test-harness.js';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function apiGet(p) {
  const res = await fetch(BASE + p);
  assert.equal(res.status, 200, 'GET ' + p + ' -> ' + res.status);
  return res.json();
}
async function apiText(p, headers) {
  const res = await fetch(BASE + p, { headers: Object.assign({ Accept: 'text/markdown' }, headers || {}) });
  return { res, text: await res.text() };
}
async function rows(page, selector) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 8000 });
  return page.locator(selector).count();
}
async function open(browser, pageName, query = '') {
  return openPage(browser, BASE, pageName, query, { routeB1: false, wait: 900 });
}

(async () => {
  const browser = await launchBrowser();
  try {
    const harnessTotal = (await apiGet('/api/v1/harnesses?limit=200')).total;
    const h = await open(browser, 'harnesses');
    try {
      assert.equal(await rows(h.page, '#page-body tbody tr'), harnessTotal);
      assert.match(await h.page.locator('#page-body').textContent(), /总数/);
      assertNoPageErrors(h.errors);
    } finally { await h.page.close(); }
    console.log('✓ harnesses.html live rows=' + harnessTotal);

    const toolTotal = (await apiGet('/api/v1/tools?limit=200')).total;
    const t = await open(browser, 'tools');
    try {
      assert.equal(await rows(t.page, '#tl-table tbody tr'), toolTotal);
      assert.equal(await t.page.locator('[data-act="debug"]').count(), 0);
      assertNoPageErrors(t.errors);
    } finally { await t.page.close(); }
    console.log('✓ tools.html live rows=' + toolTotal);

    const skillPage = await apiGet('/api/v1/skills?limit=200');
    const total = skillPage.total;
    const first = skillPage.items[0];
    assert.ok(first && first.description, 'Skill 列表缺 description');
    assert.equal(first.summary, undefined, 'Skill 列表仍返回 summary');
    assert.equal(first.triggers, undefined, 'Skill 列表仍返回 triggers');

    const direct = await apiText('/api/v1/skills/' + encodeURIComponent(first.id) + '/document');
    assert.equal(direct.res.status, 200);
    assert.equal(direct.res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    const etag = direct.res.headers.get('etag');
    assert.match(etag || '', /^"\d+"$/);
    assert.ok(direct.text.startsWith('---\n'));
    const cached = await apiText('/api/v1/skills/' + encodeURIComponent(first.id) + '/document', { 'If-None-Match': etag });
    assert.equal(cached.res.status, 304);
    assert.equal(cached.text, '');

    const list = await open(browser, 'skills');
    try {
      assert.equal(await rows(list.page, '#sk-tblbox tbody tr'), total);
      assert.match(await list.page.locator('#sk-count').textContent(), new RegExp('共\\s*' + total));
      assert.ok(await list.page.locator('[data-cat]').count() >= 4);
      const head = await list.page.locator('#sk-tblbox thead').textContent();
      assert.ok(head.includes('描述') && !head.includes('触发'));
      assert.equal(await list.page.locator('.drawer').count(), 0);
      assert.equal(await list.page.locator('#sk-tblbox [data-view="' + first.id + '"]').count(), 1);
      assertNoPageErrors(list.errors);
    } finally { await list.page.close(); }

    const detail = await open(browser, 'skill-detail', 'id=' + encodeURIComponent(first.id));
    try {
      await detail.page.locator('#sk-body').waitFor({ state: 'visible', timeout: 8000 });
      assert.match(await detail.page.locator('#sk-files').textContent(), /SKILL\.md/);
      assert.equal(await detail.page.locator('[data-tab]').count(), 0);
      assert.equal(await detail.page.locator('#sk-download').count(), 1);
      assert.match(await detail.page.locator('#page-body').textContent(), new RegExp(first.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assertNoPageErrors(detail.errors);
    } finally { await detail.page.close(); }
    console.log('✓ skills.html live rows=' + total + ' · document 200/304');

    const expertTotal = (await apiGet('/api/v1/experts?limit=200')).total;
    const e = await open(browser, 'experts');
    try {
      assert.equal(await rows(e.page, '#ex-grid .item-card'), expertTotal);
      assert.match(await e.page.locator('#page-body').textContent(), /引用/);
      assertNoPageErrors(e.errors);
    } finally { await e.page.close(); }
    console.log('✓ experts.html live cards=' + expertTotal);

    console.log('B1 四页真实读取验证通过');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('B1 四页真实读取验证失败:', e && e.stack ? e.stack : e);
  process.exit(1);
});
