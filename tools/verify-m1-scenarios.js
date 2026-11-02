#!/usr/bin/env node
/**
 * M1 场景验证（Playwright WebKit + 真实 DOM/网络）
 * 用法: node tools/verify-m1-scenarios.js [SCN-xxxx]
 *
 * 页面加载真实 ESM；B1 请求由 Playwright route 交给 tools/fake-b1.js。
 * 断言优先看 DOM；仅对无 DOM 投影的夹具状态做模块级读取。
 */
import assert from 'node:assert/strict';
import { startStaticServer, launchBrowser, openPage } from './test-harness.js';
import { MOCK } from '../assets/js/mock-data.js';
import { fakeB1 } from './fake-b1.js';

let BASE = '';

const SKIP = /跳转|location|navigation/i;

function editorInit() {
  window.__AGENTFLOW_SKILL_MD__ = {
    mount: function (target, opts) {
      window.__SK_MOUNT__ = { target: target, opts: opts };
      var stub = document.createElement('div');
      stub.className = 'sk-md-stub';
      stub.textContent = String(opts.markdown == null ? '' : opts.markdown);
      target.appendChild(stub);
      return Promise.resolve({
        getMarkdown: function () { return opts.markdown; },
        setMarkdown: function (md) { opts.markdown = md; },
        destroy: function () { return Promise.resolve(); }
      });
    }
  };
}

function renderFailOnceInit() {
  var calls = 0;
  window.__AGENTFLOW_SKILL_MD__ = {
    mount: function (target, opts) {
      calls++;
      if (calls === 1) return Promise.reject(new Error('渲染器坏了'));
      window.__SK_MOUNT__ = { target: target, opts: opts };
      var stub = document.createElement('div');
      stub.className = 'sk-md-stub';
      stub.textContent = String(opts.markdown || '');
      target.appendChild(stub);
      return Promise.resolve({ getMarkdown: function () { return opts.markdown; }, destroy: function () { return Promise.resolve(); } });
    }
  };
}

async function open(browser, page, query = '', opts = {}) {
  return openPage(browser, BASE, page, query, opts);
}

async function openSkill(browser, id, mode, init = editorInit) {
  const qs = [];
  if (id) qs.push('id=' + encodeURIComponent(id));
  if (mode) qs.push('mode=' + encodeURIComponent(mode));
  return openPage(browser, BASE, 'skill-detail', qs.join('&'), { initScript: init, wait: 500 });
}

function noErrors(ctx) {
  assert.deepEqual(ctx.errors, [], '页面运行错误: ' + ctx.errors.join(' | '));
}

async function closeModal(page) {
  await page.evaluate(async () => {
    const { DF } = await import('/assets/js/ui.js');
    DF.modal.close();
  });
}

async function closeDrawer(page) {
  await page.evaluate(async () => {
    const { DF } = await import('/assets/js/ui.js');
    DF.drawer.close();
  });
}

async function clickMenu(page, label) {
  await page.locator('.menu .mi', { hasText: label }).first().click();
}

/* ----------------------------- SCN-0004 ----------------------------- */
async function scn0004T1(browser) {
  const ctx = await open(browser, 'instances');
  try {
    const M = MOCK.instances;
    const ended = M.filter((i) => ['成功', '失败', '已终止'].includes(i.status)).length;
    assert.equal(await ctx.page.locator('#page-body tbody tr').count(), M.length);
    assert.equal(await ctx.page.locator('#in-tabs .tab').count(), 6);
    const labels = await ctx.page.locator('#in-tabs .tab').allTextContents();
    assert.ok(labels.some((x) => x.includes('已结束') && x.includes(String(ended))));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T2(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=INS-2041', { wait: 400 });
  try {
    const inst = MOCK.instances.find((i) => i.id === 'INS-2041');
    const wf = MOCK.workflows.find((w) => w.id === inst.wfId);
    assert.match(await ctx.page.locator('body').textContent(), /INS-2041/);
    assert.equal(await ctx.page.locator('.cv-node').count(), wf.graph.nodes.length);
    assert.equal(await ctx.page.locator('.cv-node.st-ok').count(), Object.values(inst.nodes).filter((n) => n.status === 'ok').length);
    assert.equal(await ctx.page.locator('.cv-node.st-run').count(), Object.values(inst.nodes).filter((n) => n.status === 'running').length);
    assert.equal(await ctx.page.locator('#id-pause').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T3(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=INS-2041', { wait: 400 });
  let c2;
  try {
    await ctx.page.locator('#id-pause').click();
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(100);
    assert.equal(await ctx.page.locator('#id-resume').count(), 1);
    await ctx.page.locator('#id-resume').click();
    await ctx.page.waitForTimeout(100);
    assert.equal(await ctx.page.locator('#id-pause').count(), 1);

    c2 = await open(browser, 'instance-detail', 'id=INS-2038', { wait: 400 });
    assert.match(await c2.page.locator('body').textContent(), /等待人工确认/);
    await c2.page.locator('#cf-ok').click();
    await c2.page.waitForTimeout(100);
    const status = await c2.page.evaluate(async () => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      return MOCK.instances.find((i) => i.id === 'INS-2038').status;
    });
    assert.equal(status, '运行中');
    noErrors(ctx); noErrors(c2);
  } finally {
    if (c2) await c2.page.close();
    await ctx.page.close();
  }
}

async function scn0004T4(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=INS-2041', { wait: 400 });
  let c2, c3;
  try {
    await ctx.page.locator('#id-stop').click();
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#id-pause').count(), 1);

    c2 = await open(browser, 'instance-detail', 'id=INS-2038', { wait: 400 });
    await c2.page.locator('#cf-no').click();
    await c2.page.waitForTimeout(80);
    assert.match(await c2.page.locator('body').textContent(), /驳回必须填写意见/);
    assert.match(await c2.page.locator('body').textContent(), /等待人工确认/);

    c3 = await open(browser, 'instance-detail', 'id=INS-2019', { wait: 400 });
    assert.match(await c3.page.locator('body').textContent(), /已终止/);
    assert.equal(await c3.page.locator('#id-resume').count(), 0);
    assert.equal(await c3.page.locator('#id-pause').count(), 0);
    assert.equal(await c3.page.locator('#id-stop').count(), 0);
    noErrors(ctx); noErrors(c2); noErrors(c3);
  } finally {
    if (c3) await c3.page.close();
    if (c2) await c2.page.close();
    await ctx.page.close();
  }
}

/* ----------------------------- SCN-0005 ----------------------------- */
async function scn0005T1(browser) {
  const ctx = await open(browser, 'skills', '', { wait: 600 });
  try {
    assert.equal(await ctx.page.locator('#sk-tblbox tbody tr').count(), MOCK.skills.length);
    assert.match(await ctx.page.locator('#sk-count').textContent(), new RegExp('共\\s*' + MOCK.skills.length));
    const target = MOCK.skills.filter((x) => x.category === '检索').length;
    await ctx.page.locator('[data-cat="retrieval"]').click();
    await ctx.page.waitForTimeout(100);
    assert.equal(await ctx.page.locator('#sk-tblbox tbody tr').count(), target);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0005T2(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    assert.equal(await ctx.page.locator('#sk-body .sk-md-stub').count(), 1);
    assert.match(await ctx.page.locator('#sk-body').textContent(), /流程总述/);
    assert.equal(await ctx.page.locator('[data-tab]').count(), 0);
    const files = await ctx.page.locator('#sk-files').textContent();
    assert.match(files, /SKILL\.md/);
    assert.match(files, /只读/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0005T3(browser) {
  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    const target = MOCK.skills.find((x) => x.id === 'sk-cres');
    const beforeVer = target.version;
    await ctx.page.locator('#sk-desc').fill('更新后的 Skill 描述');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(300);
    assert.notEqual(target.version, beforeVer);
    assert.equal(target.description, '更新后的 Skill 描述');
    assert.equal(target.summary, undefined);
    assert.equal(await ctx.page.locator('#sk-edit').count(), 1);
    assert.equal(await ctx.page.locator('#sk-save').count(), 0);
    assert.equal(fakeB1.draftCount(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0005T4(browser) {
  const ctx = await open(browser, 'skills', '', { wait: 600 });
  try {
    const before = MOCK.skills.length;
    const skill = MOCK.skills.find((s) => s.usedBy > 0);
    await ctx.page.locator('[data-more="' + skill.id + '"]').click();
    await clickMenu(ctx.page, '删除');
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(200);
    assert.equal(MOCK.skills.length, before);
    const body = await ctx.page.locator('body').textContent();
    assert.match(body, /禁止删除/);
    assert.match(body, new RegExp('被\\s*' + skill.usedBy + '\\s*位专家引用'));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0014 ----------------------------- */
async function scn0014T1(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    assert.equal(await ctx.page.locator('#sk-body .sk-md-stub').count(), 1);
    assert.equal(await ctx.page.locator('.drawer').count(), 0);
    assert.match(await ctx.page.locator('.page-header').textContent(), /CRES 技能/);
    assert.equal(await ctx.page.locator('#sk-download').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0014T2(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    await ctx.page.locator('#sk-edit').click();
    await ctx.page.waitForTimeout(250);
    const cat = ctx.page.locator('#sk-cat');
    assert.ok(await cat.count());
    assert.ok(await cat.locator('option').count() >= 4);
    assert.equal(await cat.inputValue(), 'coding');
    const target = MOCK.skills.find((s) => s.id === 'sk-cres');
    const beforeVer = target.version;
    await ctx.page.locator('#sk-desc').fill('专门页编辑后的描述');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(300);
    assert.notEqual(target.version, beforeVer);
    assert.equal(target.description, '专门页编辑后的描述');
    assert.match(await ctx.page.locator('.page-header').textContent(), new RegExp(target.version));
    assert.equal(await ctx.page.locator('#sk-save').count(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0014T3(browser) {
  const ctx = await openSkill(browser, null, 'new');
  try {
    await ctx.page.locator('#sk-name').fill('专门页新建 Skill');
    await ctx.page.locator('#sk-cat').selectOption('coding');
    await ctx.page.locator('#sk-desc').fill('适用：专门页新建场景；触发：专门页；不适用：无。');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(350);
    const created = MOCK.skills.find((s) => s.name === '专门页新建 Skill');
    assert.ok(created);
    assert.equal(created.version, 'v1.0');
    assert.match(await ctx.page.locator('.page-header').textContent(), /专门页新建 Skill/);
    assert.equal(await ctx.page.locator('#sk-save').count(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0014T4(browser) {
  const ctx1 = await openSkill(browser, null);
  try {
    assert.match(await ctx1.page.locator('#page-body').textContent(), /缺少 Skill id/);
    noErrors(ctx1);
  } finally { await ctx1.page.close(); }
  const ctx2 = await openSkill(browser, 'sk-not-exist');
  try {
    assert.match(await ctx2.page.locator('#page-body').textContent(), /目标不存在或已被删除/);
    assert.equal(await ctx2.page.locator('#sk-retry').count(), 1);
    noErrors(ctx2);
  } finally { await ctx2.page.close(); }
}

async function captureDownload(page) {
  await page.evaluate(() => {
    window.__DL_HREF__ = null;
    HTMLAnchorElement.prototype.click = function () { window.__DL_HREF__ = this.getAttribute('href'); };
  });
  await page.locator('#sk-download').click();
  return page.evaluate(() => window.__DL_HREF__);
}

async function scn0014T5(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    assert.match(await captureDownload(ctx.page), /\/api\/v1\/skills\/sk-cres\/download$/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0015 ----------------------------- */
async function scn0015T1(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    const mount = await ctx.page.evaluate(() => window.__SK_MOUNT__);
    assert.ok(mount);
    assert.equal(mount.opts.editable, false);
    assert.match(String(mount.opts.markdown), /## /);
    assert.ok(!String(mount.opts.markdown).startsWith('---'));
    assert.equal(await ctx.page.locator('.sk-md-stub').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0015T2(browser) {
  const ctx = await openSkill(browser, 'sk-replay');
  try {
    assert.equal(await ctx.page.locator('#sk-body .sk-md-stub').count(), 1);
    assert.match(await ctx.page.locator('#sk-body').textContent(), /回放数据清洗/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0015T3(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    const body = await ctx.page.locator('#sk-body').textContent();
    assert.ok(body.trim().length > 0);
    assert.ok(!body.includes('```'));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0015T4(browser) {
  const ctx = await openSkill(browser, 'sk-cres', null, renderFailOnceInit);
  try {
    assert.match(await ctx.page.locator('#sk-body-msg').textContent(), /正文渲染失败/);
    await ctx.page.locator('#sk-body-retry').click();
    await ctx.page.waitForTimeout(120);
    assert.equal((await ctx.page.locator('#sk-body-msg').textContent()).trim(), '');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0016 ----------------------------- */
async function scn0016T1(browser) {
  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    assert.equal((await ctx.page.evaluate(() => window.__SK_MOUNT__.opts)).editable, true);
    const files = await ctx.page.locator('#sk-files').textContent();
    assert.match(files, /SKILL\.md/);
    assert.match(files, /只读/);
    assert.equal(fakeB1.draftCount(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0016T2(browser) {
  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    await ctx.page.locator('#sk-upload').setInputFiles({ name: 'run.sh', mimeType: 'text/plain', buffer: Buffer.from('#!/bin/sh\necho hi\n') });
    await ctx.page.waitForTimeout(250);
    assert.match(await ctx.page.locator('#sk-files').textContent(), /scripts\/run\.sh/);
    await ctx.page.locator('#sk-desc').fill('带脚本的 Skill');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(350);
    const target = MOCK.skills.find((s) => s.id === 'sk-cres');
    assert.ok((target._pkg.files || []).some((f) => f.path === 'scripts/run.sh'));
    assert.match(await ctx.page.locator('#sk-files').textContent(), /scripts\/run\.sh/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0016T3(browser) {
  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    await ctx.page.locator('#sk-upload').setInputFiles({ name: 'tmp.sh', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await ctx.page.waitForTimeout(250);
    await ctx.page.locator('.sk-rename[data-path="scripts/tmp.sh"]').click();
    await ctx.page.locator('#sk-rename-in').fill('references/tmp.sh');
    await ctx.page.locator('#sk-rename-ok').click();
    await ctx.page.waitForTimeout(120);
    assert.match(await ctx.page.locator('#sk-files').textContent(), /references\/tmp\.sh/);

    await ctx.page.locator('.sk-del[data-path="references/tmp.sh"]').click();
    await ctx.page.waitForTimeout(120);
    assert.ok(!(await ctx.page.locator('#sk-files').textContent()).includes('references/tmp.sh'));

    await ctx.page.locator('#sk-cancel').click();
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#mc-ok').count(), 1);
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(200);
    assert.equal(fakeB1.draftCount(), 0);
    assert.equal(await ctx.page.locator('#sk-edit').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0016T4(browser) {
  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    const target = MOCK.skills.find((s) => s.id === 'sk-cres');
    const beforeVer = target.version;
    await ctx.page.evaluate(() => window.__SK_MOUNT__.opts.onChange('x'.repeat(17000)));
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#sk-save').isDisabled(), true);
    await ctx.page.locator('#sk-save').click({ force: true }).catch(() => {});
    await ctx.page.waitForTimeout(100);
    assert.equal(target.version, beforeVer);
    assert.match(await ctx.page.locator('#sk-bytes-hint').textContent(), /16 KiB/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0017 ----------------------------- */
async function scn0017T1(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    assert.match(await captureDownload(ctx.page), /\/api\/v1\/skills\/sk-cres\/download$/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0017T2(browser) {
  const ctx = await openSkill(browser, 'sk-cres');
  try {
    const url = await ctx.page.evaluate(async () => {
      const { API } = await import('/assets/js/api.js');
      return API.downloadUrl('skill', 'sk-cres');
    });
    assert.equal(url, '/api/v1/skills/sk-cres/download');
    assert.match(await captureDownload(ctx.page), /\/api\/v1\/skills\/sk-cres\/download$/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0017T3(browser) {
  const ctx = await openSkill(browser, 'sk-replay');
  try {
    assert.equal(await ctx.page.locator('#sk-download').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0017T4(browser) {
  const ctx = await openSkill(browser, 'sk-not-exist');
  try {
    assert.equal(await ctx.page.locator('#sk-download').count(), 0);
    assert.match(await ctx.page.locator('#page-body').textContent(), /目标不存在或已被删除/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0006 ----------------------------- */
async function scn0006T1(browser) {
  const ctx = await open(browser, 'experts', '', { wait: 600 });
  try {
    assert.equal(await ctx.page.locator('#ex-grid .item-card').count(), MOCK.experts.length);
    await ctx.page.locator('#ex-q').fill('评审');
    await ctx.page.waitForTimeout(100);
    assert.equal(await ctx.page.locator('#ex-grid .item-card').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0006T2(browser) {
  const ctx = await open(browser, 'experts', '', { wait: 600 });
  try {
    await ctx.page.locator('#ex-grid [data-act="detail"]').first().click();
    await ctx.page.waitForTimeout(150);
    for (const id of ['ex-sec-role', 'ex-sec-skill', 'ex-sec-tools', 'ex-sec-work', 'ex-sec-refs']) {
      assert.equal(await ctx.page.locator('#' + id).count(), 1, '缺详情区 ' + id);
    }
    const ex = MOCK.experts[0];
    const text = await ctx.page.locator('.modal').textContent();
    assert.ok(text.includes(ex.role));
    for (const sid of (ex.skills || [])) {
      const sk = MOCK.skills.find((x) => x.id === sid);
      if (sk) { assert.ok(text.includes(sk.name)); assert.ok(text.includes(sk.description)); }
    }
    assert.ok(!text.includes('undefined'));
    for (const tid of (ex.tools || [])) {
      const tl = MOCK.tools.find((x) => x.id === tid);
      if (tl) assert.ok(text.includes(tl.name));
    }
    for (const r of (ex.refs || [])) assert.ok(text.includes(r.label));
    let refN = 0;
    for (const wf of MOCK.workflows) for (const nd of (wf.graph.nodes || [])) if (nd.expertId === ex.id) refN++;
    assert.match(text, new RegExp('被引用\\s*' + refN + '\\s*处'));
    assert.match(text, /B1 未提供引用方明细/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0006T3(browser) {
  const ctx = await open(browser, 'experts', '', { wait: 600 });
  try {
    const before = MOCK.experts.length;
    await ctx.page.locator('#ex-new').click();
    await ctx.page.waitForTimeout(100);
    await ctx.page.locator('#ex-n-name').fill('回归迁移专家');
    await ctx.page.locator('#ex-n-role').fill('完成存量数据迁移与一致性校验');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(200);
    assert.equal(MOCK.experts.length, before + 1);
    const created = MOCK.experts.find((x) => x.name === '回归迁移专家');
    assert.ok(created);
    await ctx.page.locator('#ex-duty').fill('负责回归迁移与校验');
    await ctx.page.locator('#ex-save').click();
    await ctx.page.waitForTimeout(200);
    assert.equal(created.duty, '负责回归迁移与校验');
    await closeModal(ctx.page);

    const ex = MOCK.experts[0];
    await ctx.page.locator('[data-act="toggle"]').first().evaluate((el) => {
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(180);
    assert.equal(ex.enabled, false);
    assert.ok(await ctx.page.locator('#ex-grid .item-card .switch input:not(:checked)').count());
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0006T4(browser) {
  const ctx = await open(browser, 'experts', '', { wait: 600 });
  try {
    const ex = MOCK.experts[1];
    await ctx.page.locator('[data-act="toggle"]').nth(1).evaluate((el) => {
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(ex.enabled, true);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0007 ----------------------------- */
async function scn0007T1(browser) {
  const ctx = await open(browser, 'harnesses', '', { wait: 600 });
  try {
    const H = MOCK.harnesses;
    const offline = H.filter((h) => h.health === '离线').length;
    const online = H.filter((h) => h.health === '在线' && !h._disabled).length;
    const disabled = H.filter((h) => h._disabled).length;
    assert.equal(await ctx.page.locator('#page-body tbody tr').count(), H.length);
    const cards = (await ctx.page.locator('.stat-row .stat-card').allTextContents()).map((x) => x.replace(/\s+/g, ''));
    assert.ok(cards.includes('总数' + H.length));
    assert.ok(cards.includes('在线' + online));
    assert.ok(cards.includes('离线' + offline));
    assert.ok(cards.includes('停用' + disabled));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0007T2(browser) {
  const ctx = await open(browser, 'harnesses', '', { wait: 600 });
  try {
    const before = MOCK.harnesses.length;
    await ctx.page.locator('#ha-reg-btn').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('[data-m="name"]').fill('build-99');
    await ctx.page.locator('[data-m="address"]').fill('10.0.4.99:7801');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(220);
    assert.equal(MOCK.harnesses.length, before + 1);
    assert.ok(MOCK.harnesses.some((x) => x.name === 'build-99' && x.health === '在线'));

    await ctx.page.locator('#ha-reg-btn').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('[data-m="name"]').fill('build-99');
    await ctx.page.locator('[data-m="address"]').fill('10.0.4.98:7801');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(MOCK.harnesses.length, before + 1);
    assert.match(await ctx.page.locator('body').textContent(), /名称已存在/);

    await ctx.page.locator('[data-m="name"]').fill('build-100');
    await ctx.page.locator('[data-m="concurrencyMax"]').fill('0');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(MOCK.harnesses.length, before + 1);
    assert.match(await ctx.page.locator('body').textContent(), /并发上限需 ≥ 1/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0007T3(browser) {
  const ctx = await open(browser, 'harnesses', '', { wait: 600 });
  try {
    const h = MOCK.harnesses.find((x) => x.id === 'h-build01');
    assert.equal(!!h._disabled, false);
    await ctx.page.locator('[data-act="toggle"][data-id="h-build01"]').click();
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(180);
    assert.equal(h._disabled, true);
    assert.match(await ctx.page.locator('#page-body').textContent(), /已停用/);

    const before = MOCK.harnesses.length;
    await ctx.page.locator('[data-act="del"][data-id="h-devlap"]').click();
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(180);
    assert.equal(MOCK.harnesses.length, before - 1);
    assert.equal(MOCK.harnesses.some((x) => x.id === 'h-devlap'), false);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0007T4(browser) {
  const ctx = await open(browser, 'harnesses', '', { wait: 600 });
  try {
    const row = ctx.page.locator('#page-body tbody tr', { hasText: 'build-01' }).first();
    assert.equal(await row.count(), 1);
    assert.equal(await row.locator('[data-act="del"]').count(), 1);
    const h2 = MOCK.harnesses.find((x) => x.id === 'h-build02');
    await ctx.page.locator('[data-act="toggle"][data-id="h-build02"]').click();
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(!!h2._disabled, false);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0008 ----------------------------- */
async function scn0008T1(browser) {
  const ctx = await open(browser, 'tools', '', { wait: 600 });
  try {
    const T = MOCK.tools;
    assert.equal(await ctx.page.locator('#tl-table tbody tr').count(), T.length);
    await ctx.page.locator('#tl-ft-type').selectOption('cli');
    assert.equal(await ctx.page.locator('#tl-table tbody tr').count(), T.filter((t) => t.type === 'CLI').length);
    await ctx.page.locator('#tl-ft-type').selectOption('');
    await ctx.page.locator('#tl-ft-status').selectOption('unverified');
    assert.equal(await ctx.page.locator('#tl-table tbody tr').count(), T.filter((t) => t.status === '未验证').length);
    await ctx.page.locator('#tl-ft-status').selectOption('');
    await ctx.page.locator('#tl-ft-kw').fill('trace');
    assert.equal(await ctx.page.locator('#tl-table tbody tr').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0008T2(browser) {
  const ctx = await open(browser, 'tools', '', { wait: 600 });
  try {
    const before = MOCK.tools.length;
    await ctx.page.locator('#tl-add').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#tl-f-name').fill('regression_tool');
    await ctx.page.locator('#tl-f-inv').fill('regression --symbol {symbol}');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(220);
    assert.equal(MOCK.tools.length, before + 1);
    const created = MOCK.tools.find((t) => t.name === 'regression_tool');
    assert.ok(created);
    assert.equal(created.status, '未验证');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0008T3(browser) {
  const ctx = await open(browser, 'tools', '', { wait: 600 });
  try {
    const tool = MOCK.tools.find((t) => t.id === 't-trace');
    await ctx.page.locator('[data-act="refs"][data-id="t-trace"]').click();
    await ctx.page.waitForTimeout(120);
    const text = await ctx.page.locator('.modal').textContent();
    assert.match(text, /引用该工具的专家数/);
    assert.match(text, new RegExp(String(tool.refCount)));
    assert.match(text, /B1 未提供引用方明细/);
    assert.equal(await ctx.page.locator('.tl-ref-item').count(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0008T4(browser) {
  const ctx = await open(browser, 'tools', '', { wait: 600 });
  try {
    const before = MOCK.tools.length;
    await ctx.page.locator('[data-act="del"][data-id="t-trace"]').click();
    await ctx.page.waitForTimeout(120);
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(200);
    assert.equal(MOCK.tools.length, before);
    assert.match(await ctx.page.locator('body').textContent(), /禁止删除|后端会拒绝/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0009 ----------------------------- */
async function scn0009T1(browser) {
  const ctx = await open(browser, 'analytics', '', { wait: 450 });
  try {
    const A = MOCK.analytics;
    assert.equal(await ctx.page.locator('.stat-card').count(), 5);
    const body = await ctx.page.locator('#page-body').textContent();
    assert.match(body, new RegExp(String(A.throughput[A.throughput.length - 1])));
    assert.match(body, new RegExp(A.successRate + '%'));
    assert.equal(await ctx.page.locator('.an-stage-row').count(), A.stagePass.length);
    assert.equal(await ctx.page.locator('.an-audit-item').count(), A.skillAudit.length);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0009T2(browser) {
  const ctx = await open(browser, 'analytics', '', { wait: 450 });
  try {
    await ctx.page.locator('#an-range').selectOption('4');
    await ctx.page.waitForTimeout(80);
    assert.match(await ctx.page.locator('#page-body').textContent(), /近 4 周/);
    assert.equal(await ctx.page.locator('svg[aria-label="吞吐率与缺陷率趋势"] circle').count(), 8);
    await ctx.page.locator('#an-range').selectOption('8');
    await ctx.page.waitForTimeout(80);
    assert.match(await ctx.page.locator('#page-body').textContent(), /近 8 周/);
    assert.equal(await ctx.page.locator('svg[aria-label="吞吐率与缺陷率趋势"] circle').count(), 16);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0009T3(browser) {
  const ctx = await open(browser, 'analytics', '', { wait: 450 });
  try {
    assert.equal(await ctx.page.locator('#an-review-wrap tbody tr').count(), 5);
    assert.match(await ctx.page.locator('#an-review-wrap').textContent(), /INS-2041/);
    await ctx.page.locator('#an-next').click();
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#an-review-wrap tbody tr').count(), 5);
    assert.match(await ctx.page.locator('#an-review-wrap').textContent(), /INS-2027/);
    assert.match(await ctx.page.locator('#an-review-wrap .an-pager').textContent(), /第 2 \/ 2 页/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0009T4(browser) {
  const ctx = await open(browser, 'analytics', '', { wait: 450 });
  try {
    assert.equal(await ctx.page.locator('#an-range option[value="12"]').isDisabled(), true);
    const labels = await ctx.page.locator('#page-body button').allTextContents();
    assert.ok(!labels.some((x) => x.includes('编辑') || x.includes('删除')));
    const before = await ctx.page.evaluate(async () => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      return JSON.stringify(MOCK.analytics);
    });
    await ctx.page.locator('#an-range').selectOption('4');
    await ctx.page.waitForTimeout(80);
    const after = await ctx.page.evaluate(async () => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      return JSON.stringify(MOCK.analytics);
    });
    assert.equal(after, before);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0010 ----------------------------- */
async function scn0010T1(browser) {
  const ctx = await open(browser, 'workspaces', '', { wait: 450 });
  try {
    assert.equal(await ctx.page.locator('#ws-table tbody tr').count(), MOCK.workspaces.length);
    assert.equal(await ctx.page.locator('.ws-dis').count(), 3);
    assert.match(await ctx.page.locator('#ws-count').textContent(), new RegExp('共\\s*' + MOCK.workspaces.length));
    const ws1 = MOCK.workspaces.find((w) => w.id === 'ws1');
    const k1 = MOCK.keys.find((k) => k.id === ws1.credId);
    const row1 = ctx.page.locator('#ws-table tbody tr', { hasText: ws1.name }).first();
    assert.match(await row1.textContent(), new RegExp(k1.name));
    const row4 = ctx.page.locator('#ws-table tbody tr', { hasText: 'pb2-service' }).first();
    assert.match(await row4.textContent(), /未关联/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0010T2(browser) {
  const ctx = await open(browser, 'workspaces', '', { wait: 450 });
  try {
    await ctx.page.locator('#ws-btn-new').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(80);
    assert.notEqual(await ctx.page.locator('#wz-name-err').evaluate((el) => el.style.display), 'none');
    assert.equal(await ctx.page.locator('#wz-name').count(), 1);
    await ctx.page.locator('#wz-name').fill('regression-ws');
    await ctx.page.locator('#wz-repo').fill('ftp://igit/org/regression.git');
    await ctx.page.locator('#wz-branch').fill('main');
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(80);
    assert.notEqual(await ctx.page.locator('#wz-repo-err').evaluate((el) => el.style.display), 'none');
    assert.equal(await ctx.page.locator('#wz-name').count(), 1);
    await ctx.page.locator('#wz-repo').fill('git@igit:org/regression.git');
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#wz-cred').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0010T3(browser) {
  const ctx = await open(browser, 'workspaces', '', { wait: 450 });
  try {
    const before = await ctx.page.locator('#ws-table tbody tr').count();
    await ctx.page.locator('#ws-btn-new').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#wz-name').fill('regression-ws');
    await ctx.page.locator('#wz-repo').fill('git@igit:org/regression.git');
    await ctx.page.locator('#wz-branch').fill('main');
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(80);
    assert.match(await ctx.page.locator('#wz-next').textContent(), /完成并初始化/);
    await ctx.page.locator('#wz-next').click();
    await ctx.page.waitForTimeout(1600);
    const nw = await ctx.page.evaluate(() => JSON.parse(sessionStorage.getItem('df-new-workspace') || 'null'));
    assert.ok(nw);
    assert.equal(nw.name, 'regression-ws');
    assert.equal(nw.status, '已初始化');
    assert.equal(nw.branch, 'main');
    await ctx.page.reload({ waitUntil: 'networkidle' });
    await ctx.page.waitForTimeout(400);
    assert.equal(await ctx.page.locator('#ws-table tbody tr').count(), before + 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0010T4(browser) {
  const ctx = await open(browser, 'workspaces', '', { wait: 450 });
  let c2;
  try {
    assert.equal(await ctx.page.locator('.ws-dis').count(), 3);
    assert.equal(await ctx.page.locator('[data-act="del"][data-id="ws1"]').count(), 0);
    const before = await ctx.page.locator('#ws-table tbody tr').count();
    await ctx.page.locator('[data-act="del"][data-id="ws4"]').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(await ctx.page.locator('#ws-table tbody tr').count(), before);
    noErrors(ctx);

    c2 = await open(browser, 'workspace-detail', 'id=ws1', { wait: 450 });
    await c2.page.locator('#wd-clean2').click();
    await c2.page.waitForTimeout(80);
    await c2.page.locator('#mc-ok').click();
    await c2.page.waitForTimeout(150);
    assert.match(await c2.page.locator('#page-body').textContent(), /INS-2042/);
    noErrors(c2);
  } finally {
    if (c2) await c2.page.close();
    await ctx.page.close();
  }
}

/* ----------------------------- SCN-0011 ----------------------------- */
async function scn0011T1(browser) {
  const ctx = await open(browser, 'keys', '', { wait: 450 });
  try {
    assert.equal(await ctx.page.locator('#ky-list tbody tr').count(), MOCK.keys.length);
    const body = await ctx.page.locator('body').textContent();
    for (const k of MOCK.keys) {
      assert.ok(k.mask.includes('****') || k.mask.includes('…'));
      assert.match(k.mask, /[a-z0-9]{4}$/i);
      assert.ok(body.includes(k.mask));
    }
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0011T2(browser) {
  const ctx = await open(browser, 'keys', '', { wait: 450 });
  try {
    const before = await ctx.page.evaluate(async () => (await import('/assets/js/mock-data.js')).MOCK.keys.length);
    await ctx.page.locator('#ky-add').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('input[name="ky-type"][value="git ssh-key"]').check();
    assert.notEqual(await ctx.page.locator('#ky-form-ssh').evaluate((el) => el.style.display), 'none');
    assert.equal(await ctx.page.locator('#ky-form-llm').evaluate((el) => el.style.display), 'none');
    await ctx.page.locator('#ky-ssh-name').fill('regression-key');
    await ctx.page.locator('#ky-ssh-pub').fill('ssh-ed25519 AAAAC3NzaRegression');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForTimeout(220);
    const state = await ctx.page.evaluate(async () => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      const k = MOCK.keys.find((x) => x.name === 'regression-key');
      return { len: MOCK.keys.length, type: k && k.type, status: k && k.status };
    });
    assert.equal(state.len, before + 1);
    assert.equal(state.type, 'git ssh-key');
    assert.equal(state.status, '未校验');
    assert.match(await ctx.page.locator('#ky-list').textContent(), /regression-key/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0011T3(browser) {
  const ctx = await open(browser, 'keys', '', { wait: 450 });
  try {
    const statusOf = (id) => ctx.page.evaluate(async (keyId) => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      return MOCK.keys.find((x) => x.id === keyId).status;
    }, id);
    assert.equal(await statusOf('k3'), '失效');
    await ctx.page.locator('.ky-verify[data-id="k3"]').click();
    await ctx.page.waitForTimeout(1000);
    assert.equal(await statusOf('k3'), '有效');

    await ctx.page.locator('.ky-more[data-id="k1"]').click();
    await ctx.page.waitForTimeout(80);
    await clickMenu(ctx.page, '绑定用途');
    await ctx.page.waitForTimeout(120);
    const cb = ctx.page.locator('.drawer input[data-g="workspaces"]:not(:checked)').first();
    assert.equal(await cb.count(), 1);
    const value = await cb.getAttribute('value');
    await cb.check();
    await ctx.page.locator('#ky-b-save').click();
    await ctx.page.waitForTimeout(180);
    const bound = await ctx.page.evaluate(async (v) => {
      const { MOCK } = await import('/assets/js/mock-data.js');
      const k1 = MOCK.keys.find((x) => x.id === 'k1');
      return (k1.bindings.workspaces || []).includes(v);
    }, value);
    assert.ok(bound);
    assert.match(await ctx.page.locator('#ky-list').textContent(), /工作区×3/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0011T4(browser) {
  const ctx = await open(browser, 'keys', '', { wait: 450 });
  try {
    const countKeys = () => ctx.page.evaluate(async () => (await import('/assets/js/mock-data.js')).MOCK.keys.length);
    const before = await countKeys();
    await ctx.page.locator('#ky-add').click();
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('input[name="ky-type"][value="git ssh-key"]').check();
    await ctx.page.locator('#ky-ssh-name').fill('missing-pub');
    assert.equal(await ctx.page.locator('.modal .d-foot .btn.primary').isDisabled(), true);
    await closeModal(ctx.page);
    await ctx.page.waitForTimeout(80);
    assert.equal(await countKeys(), before);

    await ctx.page.locator('.ky-more[data-id="k1"]').click();
    await ctx.page.waitForTimeout(80);
    await clickMenu(ctx.page, '删除');
    await ctx.page.waitForTimeout(80);
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(await countKeys(), before);
    assert.match(await ctx.page.locator('#ky-list').textContent(), new RegExp(MOCK.keys.find((k) => k.id === 'k1').name));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- registry ----------------------------- */
const SCENARIOS = [
  ['SCN-0004', '实例监控与运行控制', [
    ['SCN-0004-T1', '正', '列表与已结束口径同源', scn0004T1],
    ['SCN-0004-T2', '正', '详情轨迹与实例一致', scn0004T2],
    ['SCN-0004-T3', '正', '暂停后状态迁移', scn0004T3],
    ['SCN-0004-T4', '反', '终止取消不改状态', scn0004T4]
  ]],
  ['SCN-0005', 'Skill 维护与渐进披露', [
    ['SCN-0005-T1', '正', '列表计数同源', scn0005T1],
    ['SCN-0005-T2', '正', '查看态渲染正文且无结构化 Tab', scn0005T2],
    ['SCN-0005-T3', '正', '保存走草稿且版本递增', scn0005T3],
    ['SCN-0005-T4', '反', '被引用 Skill 禁止删除', scn0005T4]
  ]],
  ['SCN-0006', '专家注册与组合配置', [
    ['SCN-0006-T1', '正', '卡片计数与搜索', scn0006T1],
    ['SCN-0006-T2', '正', '五区详情齐全', scn0006T2],
    ['SCN-0006-T3', '正', '停用写回 enabled=false', scn0006T3],
    ['SCN-0006-T4', '反', '取消停用保持启用', scn0006T4]
  ]],
  ['SCN-0014', 'Skill 专门页面查看、编辑与下载', [
    ['SCN-0014-T1', '正', '查看态正文与文件清单', scn0014T1],
    ['SCN-0014-T2', '正', '从查看态编辑保存后版本更新', scn0014T2],
    ['SCN-0014-T3', '正', '新建走草稿并进入查看态', scn0014T3],
    ['SCN-0014-T4', '反', '缺 id/404 显式报错', scn0014T4],
    ['SCN-0014-T5', '正', '下载入口指向 /download', scn0014T5]
  ]],
  ['SCN-0015', '正文渲染（Milkdown 适配层）', [
    ['SCN-0015-T1', '正', '只读渲染且不混入 frontmatter', scn0015T1],
    ['SCN-0015-T2', '正', '停用 Skill 仍渲染', scn0015T2],
    ['SCN-0015-T3', '正', '渲染结果不是 Markdown 源码', scn0015T3],
    ['SCN-0015-T4', '反', '渲染失败显式报错并可重试', scn0015T4]
  ]],
  ['SCN-0013', 'Skill 契约 v2 展示端适配（已废弃）', [
    ['SCN-0013-T1', '正', 'v2 契约已废弃，仅保留历史断言', null],
    ['SCN-0013-T2', '正', 'v2 契约已废弃，仅保留历史断言', null],
    ['SCN-0013-T3', '正', 'v2 契约已废弃，仅保留历史断言', null],
    ['SCN-0013-T4', '正', 'v2 契约已废弃，仅保留历史断言', null],
    ['SCN-0013-T5', '反', 'v2 契约已废弃，仅保留历史断言', null],
    ['SCN-0013-T6', '反', 'v2 契约已废弃，仅保留历史断言', null]
  ]],
  ['SCN-0016', '草稿编辑与保存 Skill 包', [
    ['SCN-0016-T1', '正', '编辑建草稿且 SKILL.md 只读', scn0016T1],
    ['SCN-0016-T2', '正', '上传脚本后保存进包', scn0016T2],
    ['SCN-0016-T3', '正', '改名删除只作用于草稿', scn0016T3],
    ['SCN-0016-T4', '反', '正文超 16 KiB 阻断保存', scn0016T4]
  ]],
  ['SCN-0017', '整包下载', [
    ['SCN-0017-T1', '正', '下载入口指向 /download', scn0017T1],
    ['SCN-0017-T2', '正', '下载 URL 形状正确', scn0017T2],
    ['SCN-0017-T3', '正', '停用 Skill 仍可下载', scn0017T3],
    ['SCN-0017-T4', '反', '404 页面不显示下载', scn0017T4]
  ]],
  ['SCN-0007', 'Harness 注册与健康治理', [
    ['SCN-0007-T1', '正', '表格与在线计数同源', scn0007T1],
    ['SCN-0007-T2', '正', '注册合法 Harness', scn0007T2],
    ['SCN-0007-T3', '正', '停用写回页面标记', scn0007T3],
    ['SCN-0007-T4', '反', '删除入口存在、停用可取消', scn0007T4]
  ]],
  ['SCN-0008', '工具注册、调试与引用治理', [
    ['SCN-0008-T1', '正', '注册表与关键词筛选', scn0008T1],
    ['SCN-0008-T2', '正', '注册新增未验证工具', scn0008T2],
    ['SCN-0008-T3', '正', '引用计数与 B1 明细说明', scn0008T3],
    ['SCN-0008-T4', '反', '被引用工具删除由后端拒绝', scn0008T4]
  ]],
  ['SCN-0009', '效能看板只读回看', [
    ['SCN-0009-T1', '正', 'KPI/阶段/审计同源', scn0009T1],
    ['SCN-0009-T2', '正', '4↔8 周数据点', scn0009T2],
    ['SCN-0009-T3', '正', '评审记录分页', scn0009T3],
    ['SCN-0009-T4', '反', '12 周禁用且无写入口', scn0009T4]
  ]],
  ['SCN-0010', '工作区创建、配置与归档', [
    ['SCN-0010-T1', '正', '列表与引用删除保护', scn0010T1],
    ['SCN-0010-T2', '正', '向导步① 必填校验', scn0010T2],
    ['SCN-0010-T3', '正', '三步完成写入新工作区', scn0010T3],
    ['SCN-0010-T4', '反', '被引用工作区禁止删除、取消不写、归档只追加', scn0010T4]
  ]],
  ['SCN-0011', '个人 Key 登记、校验与绑定', [
    ['SCN-0011-T1', '正', '列表掩码脱敏', scn0011T1],
    ['SCN-0011-T2', '正', 'git Key 表单登记', scn0011T2],
    ['SCN-0011-T3', '正', '校验后状态转有效', scn0011T3],
    ['SCN-0011-T4', '反', '必填阻断、删除取消保留 Key', scn0011T4]
  ]]
];

(async () => {
  const staticServer = await startStaticServer();
  BASE = staticServer.base;
  const browser = await launchBrowser();
  const only = process.argv[2];
  let pass = 0, fail = 0;

  for (const [sid, title, tests] of SCENARIOS) {
    if (only && only !== sid) continue;
    console.log(`\n${sid} ${title}`);
    for (const [id, kind, label, fn] of tests) {
      if (!fn) { console.log(`  ○ ${id} [挂起] ${label}`); continue; }
      try {
        await fn(browser);
        pass++;
        console.log(`  ✓ ${id} [${kind}] ${label}`);
      } catch (err) {
        fail++;
        console.log(`  ✗ ${id} [${kind}] ${label}`);
        console.log('    ' + String(err && err.stack || err).split('\n').slice(0, 5).join('\n    '));
      }
    }
  }

  await browser.close();
  await staticServer.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
