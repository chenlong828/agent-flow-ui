#!/usr/bin/env node
/**
 * SCN-0018 工作流列表 live 验收（Playwright WebKit + fake B3/B1）。
 * 运行：node tools/verify-workflow-list.js
 */
import assert from 'node:assert/strict';
import { startStaticServer, launchBrowser, openPage, assertNoPageErrors } from './test-harness.js';
import { fakeB3, prepareUuidExperts } from './fake-b3.js';

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    results.push({ name: name, ok: true });
    console.log('  ✓ ' + name);
  }, function (err) {
    results.push({ name: name, ok: false, err: err });
    console.log('  ✗ ' + name + ' — ' + (err && err.message || err));
    throw err;
  });
}

async function main() {
  const server = await startStaticServer();
  const browser = await launchBrowser();
  try {
    await scenarioT1(server.base, browser);
    await scenarioT2(server.base, browser);
    await scenarioT3(server.base, browser);
    await scenarioT4(server.base, browser);
  } finally {
    await browser.close();
    await server.close();
  }
  const failed = results.filter(function (r) { return !r.ok; }).length;
  console.log('\nSCN-0018 ' + (results.length - failed) + '/' + results.length + ' assertions passed');
  if (failed) process.exit(1);
}

async function workflowFixtures() {
  prepareUuidExperts();
  fakeB3.reset();
}

function recorder() {
  const calls = [];
  return {
    calls: calls,
    b3: {
      handle: async function (method, path, body, headers) {
        calls.push({ method: method, path: path, body: body, headers: headers || {} });
        return fakeB3.handle(method, path, body, headers);
      }
    }
  };
}

async function scenarioT1(base, browser) {
  console.log('SCN-0018-T1 列表/筛选/搜索/排序/空态');
  fakeB3.reset();
  const rec = recorder();
  const ctx = await openPage(browser, base, 'workflow-list', '', { b3: rec.b3, setup: workflowFixtures });
  const page = ctx.page;
  await check('按 updatedAt:desc 拉取第一页并渲染 3 条', async function () {
    assert.equal(await page.locator('.wl-card').count(), 3);
    assert.match(await page.locator('#wl-count').textContent(), /共 3 个/);
    const first = rec.calls.find(function (c) { return c.method === 'GET' && /^\/workflows\?/.test(c.path); });
    assert.ok(first, '缺少列表请求');
    assert.match(first.path, /sort=updatedAt%3Adesc/);
    assert.match(first.path, /limit=20/);
    assert.match(first.path, /offset=0/);
  });
  await check('类型筛选请求 type 参数并只显示该类型', async function () {
    await page.locator('#wl-tabs [data-tab="专项子流程"]').click();
    await page.waitForTimeout(220);
    assert.equal(await page.locator('.wl-card').count(), 1);
    const last = rec.calls.filter(function (c) { return c.method === 'GET' && /^\/workflows\?/.test(c.path); }).at(-1);
    assert.match(last.path, /type=%E4%B8%93%E9%A1%B9%E5%AD%90%E6%B5%81%E7%A8%8B/);
  });
  await check('搜索命中与空态可清除恢复', async function () {
    await page.locator('#wl-tabs [data-tab=""]').click();
    await page.waitForTimeout(180);
    await page.locator('#wl-search').fill('批量');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.wl-card').count(), 1);
    await page.locator('#wl-search').fill('不存在');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.wl-card').count(), 0);
    assert.ok(await page.locator('#wl-clear').count());
    await page.locator('#wl-clear').click();
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.wl-card').count(), 3);
  });
  await check('排序切换发送 name:asc', async function () {
    await page.locator('#wl-sort').selectOption('name:asc');
    await page.waitForTimeout(220);
    const last = rec.calls.filter(function (c) { return c.method === 'GET' && /^\/workflows\?/.test(c.path); }).at(-1);
    assert.match(last.path, /sort=name%3Aasc/);
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT2(base, browser) {
  console.log('SCN-0018-T2 新建向导/模板复制');
  fakeB3.reset();
  const rec = recorder();
  const ctx = await openPage(browser, base, 'workflow-list', '', { b3: rec.b3, setup: workflowFixtures });
  const page = ctx.page;
  await check('向导提交 start→end 合法图并 GET 后进入编辑器', async function () {
    await page.locator('#btn-new').click();
    await page.locator('#wl-nf-name').fill('新建验收流程');
    await page.locator('#wl-nf-type').fill('研发主流程');
    const start = await page.locator('#wl-nf-start option').first().getAttribute('value');
    await page.locator('#wl-nf-start').selectOption(start);
    await page.locator('#wl-nf-end').selectOption(start);
    const nav = page.waitForURL('**/workflow-editor.html?id=*', { timeout: 5000 });
    await page.getByRole('button', { name: '创建并进入编辑器' }).click();
    await nav;
    const create = rec.calls.find(function (c) { return c.method === 'POST' && c.path === '/workflows'; });
    assert.ok(create, '缺少 POST /workflows');
    assert.equal(create.body.graph.nodes.length, 2);
    assert.equal(create.body.graph.nodes[0].type, 'start');
    assert.equal(create.body.graph.nodes[1].type, 'end');
    assert.equal(create.body.graph.nodes[0].expertId, start);
    assert.equal(create.body.graph.edges[0].kind, 'seq');
    assert.ok(rec.calls.some(function (c) { return c.method === 'GET' && /^\/workflows\/[^/]+$/.test(c.path); }), '创建后未 GET 详情');
    assert.match(await page.locator('#we-name').inputValue(), /新建验收流程/);
  });
  await check('模板复制走 POST copy 并 GET 后进入编辑器', async function () {
    await page.goto(base + '/pages/workflow-list.html', { waitUntil: 'networkidle' });
    await page.locator('#btn-new').click();
    await page.locator('#wl-nf-name').fill('复制验收流程');
    await page.locator('#wl-nf-template').selectOption({ index: 1 });
    const nav = page.waitForURL('**/workflow-editor.html?id=*', { timeout: 5000 });
    await page.getByRole('button', { name: '创建并进入编辑器' }).click();
    await nav;
    const copy = rec.calls.find(function (c) { return c.method === 'POST' && /\/copy$/.test(c.path); });
    assert.ok(copy, '缺少 POST copy');
    assert.equal(copy.body.name, '复制验收流程');
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT3(base, browser) {
  console.log('SCN-0018-T3 改名/删除/导入/导出');
  fakeB3.reset();
  const rec = recorder();
  const ctx = await openPage(browser, base, 'workflow-list', '', { b3: rec.b3, setup: workflowFixtures });
  const page = ctx.page;
  await check('改名/改类型带 If-Match 生效', async function () {
    await page.locator('.wl-card').first().locator('[data-act="more"]').click();
    await page.getByText('编辑信息', { exact: true }).click();
    await page.locator('#wl-ef-name').fill('改后的名称');
    await page.locator('#wl-ef-type').fill('专项子流程');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(300);
    const put = rec.calls.find(function (c) { return c.method === 'PUT' && /^\/workflows\/[^/]+$/.test(c.path); });
    assert.ok(put, '缺少 PUT 元数据');
    assert.equal(put.headers['If-Match'] || put.headers['if-match'], '"3"');
    assert.equal(put.body.name, '改后的名称');
    assert.equal(await page.locator('.wl-card').first().locator('.ic-title').textContent(), '改后的名称');
  });
  await check('删除二次确认并带 If-Match', async function () {
    const before = await page.locator('.wl-card').count();
    await page.locator('.wl-card').first().locator('[data-act="more"]').click();
    await page.getByText('删除', { exact: true }).click();
    await page.locator('#mc-ok').click();
    await page.waitForTimeout(300);
    const del = rec.calls.find(function (c) { return c.method === 'DELETE'; });
    assert.ok(del, '缺少 DELETE');
    assert.ok(del.headers['If-Match'] || del.headers['if-match']);
    assert.equal(await page.locator('.wl-card').count(), before - 1);
  });
  await check('导入显示 idMap 与未绑定 warning', async function () {
    const dsl = {
      dslVersion: 1,
      metadata: { name: '导入验收', type: '专项子流程', description: '' },
      stages: [],
      nodes: [
        { id: 'n1', type: 'start', name: '开始', stageId: null, expertId: null },
        { id: 'n2', type: 'end', name: '结束', stageId: null, expertId: null }
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' }]
    };
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#btn-import').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'workflow.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(dsl)) });
    await page.waitForTimeout(300);
    assert.ok(await page.locator('#wl-import-result').count());
    const text = await page.locator('#wl-import-result').textContent();
    assert.match(text, /导入验收/);
    assert.match(text, /expert_unbound|未绑定|警告/);
    assert.match(text, /n1 → n1/);
  });
  await check('导出 JSON/YAML 下载文件名正确', async function () {
    await page.locator('#wl-import-close').click();
    const downloads = [];
    page.on('download', function (d) { downloads.push(d.suggestedFilename()); });
    await page.locator('.wl-card').first().locator('[data-act="more"]').click();
    await page.getByText('导出 JSON', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('.wl-card').first().locator('[data-act="more"]').click();
    await page.getByText('导出 YAML', { exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(downloads.length, 2);
    assert.match(downloads[0], /\.json$/);
    assert.match(downloads[1], /\.yaml$/);
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT4(base, browser) {
  console.log('SCN-0018-T4 失败路径与不回落');
  fakeB3.reset();
  const rec = recorder();
  let rejectCreate = true;
  const b3 = {
    handle: async function (method, path, body, headers) {
      rec.calls.push({ method: method, path: path, body: body, headers: headers || {} });
      if (rejectCreate && method === 'POST' && path === '/workflows') {
        rejectCreate = false;
        return { status: 400, body: { error: { code: 'validation_error', message: '工作流定义不合法', details: { issues: [{ code: 'missing_start', path: 'graph.nodes', message: '缺少开始节点' }] } } } };
      }
      return fakeB3.handle(method, path, body, headers);
    }
  };
  const ctx = await openPage(browser, base, 'workflow-list', '', { b3: b3, setup: workflowFixtures });
  const page = ctx.page;
  await check('服务端 400 issues 显示且不进入编辑器', async function () {
    await page.locator('#btn-new').click();
    await page.locator('#wl-nf-name').fill('无效创建');
    await page.getByRole('button', { name: '创建并进入编辑器' }).click();
    await page.waitForTimeout(300);
    assert.ok(await page.locator('.modal').count(), '失败时不应关闭向导');
    assert.match(await page.locator('.toast').textContent(), /graph\.nodes|缺少开始节点/);
    assert.equal(page.url().includes('workflow-editor'), false);
  });
  await check('名称冲突 409 显式提示', async function () {
    await page.locator('#wl-nf-name').fill('研发四阶段主流程');
    await page.getByRole('button', { name: '创建并进入编辑器' }).click();
    await page.waitForTimeout(300);
    assert.match(await page.locator('.toast').last().textContent(), /名称已存在/);
  });
  await check('元数据 PUT 收到 428 显式提示刷新', async function () {
    const stale = {
      handle: async function (method, path, body, headers) {
        if (method === 'PUT' && /^\/workflows\/[^/]+$/.test(path)) {
          return { status: 428, body: { error: { code: 'precondition_required', message: '缺少 If-Match' } } };
        }
        return fakeB3.handle(method, path, body, headers);
      }
    };
    const ctx3 = await openPage(browser, base, 'workflow-list', '', { b3: stale, setup: workflowFixtures });
    await ctx3.page.locator('.wl-card').first().locator('[data-act="more"]').click();
    await ctx3.page.getByText('编辑信息', { exact: true }).click();
    await ctx3.page.locator('#wl-ef-name').fill('428 名称');
    await ctx3.page.getByRole('button', { name: '保存' }).click();
    await ctx3.page.waitForTimeout(250);
    assert.match(await ctx3.page.locator('.toast').last().textContent(), /刷新|版本/);
    await ctx3.page.close();
  });
  await check('后端不可用显示错误且不出现夹具', async function () {
    const bad = { handle: async function () { throw new Error('offline'); } };
    const ctx2 = await openPage(browser, base, 'workflow-list', '', { b3: bad });
    assert.ok(await ctx2.page.locator('#wl-error').count());
    assert.equal(await ctx2.page.locator('.wl-card').count(), 0);
    assertNoPageErrors(ctx2.errors);
    await ctx2.page.close();
  });
  assertNoPageErrors(ctx.errors);
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
