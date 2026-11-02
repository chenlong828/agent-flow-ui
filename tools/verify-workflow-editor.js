#!/usr/bin/env node
/**
 * SCN-0019 工作流编辑器 live 验收（Playwright WebKit + fake B3/B1）。
 * 运行：node tools/verify-workflow-editor.js
 */
import assert from 'node:assert/strict';
import { startStaticServer, launchBrowser, openPage, assertNoPageErrors } from './test-harness.js';
import { fakeB3, prepareUuidExperts } from './fake-b3.js';

const WF = '11111111-1111-4111-8111-111111111111';
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

async function fixtures() {
  prepareUuidExperts();
  fakeB3.reset();
}

function recorder(overrides) {
  const calls = [];
  return {
    calls: calls,
    b3: {
      handle: async function (method, path, body, headers) {
        calls.push({ method: method, path: path, body: body, headers: headers || {} });
        if (overrides) {
          const result = await overrides(method, path, body, headers, calls);
          if (result) return result;
        }
        return fakeB3.handle(method, path, body, headers);
      }
    }
  };
}

async function openEditor(base, browser, b3, id) {
  return openPage(browser, base, 'workflow-editor', 'id=' + encodeURIComponent(id || WF), { b3: b3, setup: fixtures, wait: 600 });
}

async function connect(page, fromId, toId) {
  const from = await page.locator('.cv-node[data-node="' + fromId + '"] .port.out').boundingBox();
  const to = await page.locator('.cv-node[data-node="' + toId + '"] .port.in').boundingBox();
  assert.ok(from && to, '端口不可见');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
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
  console.log('\nSCN-0019 ' + (results.length - failed) + '/' + results.length + ' assertions passed');
  if (failed) process.exit(1);
}

async function scenarioT1(base, browser) {
  console.log('SCN-0019-T1 加载详情/layout/viewport/未知 id');
  fakeB3.reset();
  const rec = recorder();
  const ctx = await openEditor(base, browser, rec.b3);
  const page = ctx.page;
  await check('节点/边/阶段与 DTO 一致', async function () {
    assert.equal(await page.locator('.cv-node').count(), 3);
    assert.equal(await page.locator('path.hit').count(), 2);
    assert.equal(await page.locator('.cv-stage').count(), 1);
    assert.match(await page.locator('.cv-stage .stage-label').textContent(), /阶段一/);
    assert.match(await page.locator('#z-val').textContent(), /80%/);
    assert.equal(await page.locator('.cv-node[data-node="n1"]').evaluate((el) => el.style.left), '80px');
    assert.equal(await page.locator('.cv-node[data-node="n1"]').evaluate((el) => el.style.top), '120px');
  });
  await check('未知 id 显式报错，不回落第一条', async function () {
    const ctx2 = await openPage(browser, base, 'workflow-editor', 'id=not-a-workflow', { b3: rec.b3, setup: fixtures, wait: 400 });
    assert.ok(await ctx2.page.locator('#we-fatal').count());
    assert.equal(await ctx2.page.locator('.cv-node').count(), 0);
    assert.match(await ctx2.page.locator('#we-fatal').textContent(), /不存在|无法连接|失败/);
    await ctx2.page.close();
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT2(base, browser) {
  console.log('SCN-0019-T2 编辑后保存/元数据/If-Match/布局');
  fakeB3.reset();
  const rec = recorder();
  const ctx = await openEditor(base, browser, rec.b3);
  const page = ctx.page;
  await check('改名/改专家/新增阶段与节点边后保存完整 graph', async function () {
    await page.locator('.cv-node[data-node="n2"]').click();
    await page.waitForTimeout(200);
    await page.locator('#if-name').fill('需求澄清');
    const expertValue = await page.locator('#if-expert option').nth(1).getAttribute('value');
    await page.locator('#if-expert').selectOption(expertValue);
    await page.locator('#if-stage').selectOption('s1');
    await page.locator('#we-name').fill('编辑器改名验收');
    // 新增阶段
    await page.locator('.we-pitem[data-type="stage"]').click();
    await page.waitForTimeout(150);
    // 新增 agent 并用真实端口连线接入主链：n2 → 新节点 → n3
    await page.locator('.we-pitem[data-type="agent"]').click();
    await page.waitForTimeout(200);
    const newNode = await page.locator('.cv-node').last().getAttribute('data-node');
    await page.locator('#we-drawer-close').click();
    await page.waitForTimeout(150);
    await connect(page, 'n2', newNode);
    await connect(page, newNode, 'n3');
    await page.locator('#we-save').click();
    await page.waitForTimeout(800);
    const update = rec.calls.find(function (c) { return c.method === 'PUT' && /^\/workflows\/[^/]+$/.test(c.path); });
    const save = rec.calls.find(function (c) { return c.method === 'PUT' && /\/definition$/.test(c.path); });
    assert.ok(update, '缺少元数据 PUT');
    assert.ok(save, '缺少 definition PUT');
    assert.equal(update.headers['If-Match'] || update.headers['if-match'], '"3"');
    assert.equal(save.headers['If-Match'] || save.headers['if-match'], '"4"');
    const graph = save.body.graph;
    assert.equal(graph.nodes.length, 4);
    assert.equal(graph.stages.length, 2);
    assert.equal(graph.nodes.find((n) => n.id === 'n2').name, '需求澄清');
    assert.equal(graph.nodes.find((n) => n.id === 'n2').expertId, expertValue);
    assert.ok(graph.nodes.every((n) => n.layout && typeof n.layout.x === 'number' && typeof n.layout.y === 'number'));
    assert.ok(graph.viewport && typeof graph.viewport.zoom === 'number');
    assert.match(await page.locator('#we-state').textContent(), /已保存 · r5/);
    assert.equal(await page.locator('#we-save').isDisabled(), false);
  });
  await check('DSL 只读预览与导出请求 JSON', async function () {
    await page.locator('#we-tab [data-t="dsl"]').click();
    await page.waitForTimeout(150);
    assert.match(await page.locator('.code-block').textContent(), /"dslVersion": 1/);
    const req = page.waitForRequest(function (r) { return /\/dsl\?format=json/.test(r.url()); });
    await page.locator('#dsl-json').click();
    await req;
    await page.waitForTimeout(250);
    assert.match(await page.locator('.toast').last().textContent(), /已导出/);
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT3(base, browser) {
  console.log('SCN-0019-T3 非法图阻断/红框/校验面板/服务端 400 回填');
  fakeB3.reset();
  let rejectDefinition = true;
  const rec = recorder(async function (method, path) {
    if (rejectDefinition && method === 'PUT' && /\/definition$/.test(path)) {
      rejectDefinition = false;
      return { status: 400, body: { error: { code: 'validation_error', message: '工作流定义不合法', details: { issues: [{ code: 'expert_required', path: 'graph.nodes[0].expertId', message: 'start 节点必须绑定专家' }] } } } };
    }
    return null;
  });
  const ctx = await openEditor(base, browser, rec.b3);
  const page = ctx.page;
  await check('非法图保存置灰、节点红框、图级阻断与面板定位', async function () {
    await page.locator('.cv-node[data-node="n1"]').click();
    await page.waitForTimeout(150);
    await page.locator('#if-type').selectOption('confirm');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#we-save').isDisabled(), true);
    assert.ok(await page.locator('#we-blocker').isVisible());
    assert.match(await page.locator('#we-blocker').textContent(), /缺少开始节点/);
    // 增加一个孤立节点，触发节点级错误与红框
    await page.locator('.we-pitem[data-type="agent"]').click();
    await page.waitForTimeout(200);
    const badNode = await page.locator('.cv-node').last().getAttribute('data-node');
    await page.locator('#we-drawer-close').click();
    await page.waitForTimeout(120);
    assert.ok(await page.locator('.cv-node[data-node="' + badNode + '"].has-error').count() >= 1);
    const issues = await page.locator('#we-issues').textContent();
    assert.match(issues, /不可达|seq|入边|出边/);
    assert.match(issues, /graph\.nodes\[/);
    // 删除孤立节点，恢复开始节点
    await page.locator('.cv-node[data-node="' + badNode + '"]').click();
    await page.waitForTimeout(120);
    await page.locator('#if-del').click();
    await page.locator('#mc-ok').click();
    await page.waitForTimeout(250);
  });
  await check('修正后恢复可保存', async function () {
    await page.locator('.cv-node[data-node="n1"]').click();
    await page.waitForTimeout(120);
    await page.locator('#if-type').selectOption('start');
    const expertValue = await page.locator('#if-expert option').first().getAttribute('value');
    await page.locator('#if-expert').selectOption(expertValue);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#we-save').isDisabled(), false);
    assert.equal(await page.locator('.cv-node.has-error').count(), 0);
  });
  await check('服务端 400 issues 回填定位并保留编辑态', async function () {
    await page.locator('#we-drawer-save').click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('.cv-node[data-node="n1"].has-error').count() || await page.locator('#we-issues .we-issue').count());
    assert.match(await page.locator('#we-issues').textContent(), /start 节点必须绑定专家/);
    assert.equal(await page.locator('#we-save').isDisabled(), true);
    // 本地修正一次以清除服务端 issue，再保存成功
    await page.locator('.cv-node[data-node="n2"]').click();
    await page.waitForTimeout(150);
    await page.locator('#if-name').fill('已修正');
    await page.locator('#we-drawer-save').click();
    await page.waitForTimeout(600);
    assert.match(await page.locator('#we-state').textContent(), /已保存/);
  });
  assertNoPageErrors(ctx.errors);
}

async function scenarioT4(base, browser) {
  console.log('SCN-0019-T4 409/428/离开警告/无发布版本运行');
  fakeB3.reset();
  let failMeta = 409;
  const rec = recorder(async function (method, path) {
    if (failMeta && method === 'PUT' && /^\/workflows\/[^/]+$/.test(path)) {
      const status = failMeta;
      failMeta = status === 409 ? 428 : 0;
      return { status: status, body: { error: { code: status === 428 ? 'precondition_required' : 'revision_conflict', message: '版本冲突' } } };
    }
    return null;
  });
  const ctx = await openEditor(base, browser, rec.b3);
  const page = ctx.page;
  await check('409 不覆盖并提示刷新', async function () {
    await page.locator('.cv-node[data-node="n2"]').click();
    await page.waitForTimeout(150);
    await page.locator('#if-name').fill('冲突修改');
    await page.locator('#we-name').fill('冲突名称');
    await page.locator('#we-drawer-save').click();
    await page.waitForTimeout(400);
    assert.match(await page.locator('.toast').last().textContent(), /刷新|冲突/);
    assert.ok(!rec.calls.some(function (c) { return c.method === 'PUT' && /\/definition$/.test(c.path); }), '409 后不得继续保存图');
  });
  await check('428 提示刷新且不覆盖', async function () {
    await page.locator('#if-name').fill('再次修改');
    await page.locator('#we-drawer-save').click();
    await page.waitForTimeout(400);
    assert.match(await page.locator('.toast').last().textContent(), /缺少版本条件|刷新/);
  });
  await check('离开有未保存修改弹确认', async function () {
    const dialogs = [];
    page.on('dialog', async function (dialog) {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.locator('a[href="workflow-list.html"]').first().click();
    await page.waitForTimeout(250);
    assert.ok(dialogs.length >= 1);
    assert.match(dialogs[0], /未保存/);
    assert.match(page.url(), /workflow-editor\.html/);
  });
  await check('没有发布/版本/运行入口', async function () {
    assert.equal(await page.locator('#we-publish').count(), 0);
    assert.equal(await page.locator('#we-run').count(), 0);
    const text = await page.locator('#page-body').textContent();
    assert.doesNotMatch(text, /发布|运行/);
  });
  assertNoPageErrors(ctx.errors);
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
