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
import { fakeB1, addRunFixture } from './fake-b1.js';
import { addWorkflow, fakeB3, prepareUuidExperts } from './fake-b3.js';

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

/* MOCK 页默认关闭（REQ-0018 / SCN-0020）：场景验证统一加 ?demo=1，业务断言不变。 */
const MOCK_PAGES = new Set(['analytics', 'workspaces', 'workspace-detail', 'keys']);
async function open(browser, page, query = '', opts = {}) {
  if (MOCK_PAGES.has(page)) {
    const q = new URLSearchParams(query);
    q.set('demo', '1');
    query = q.toString();
  }
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
const RUN_WAIT = 'aaaaaaaa-0000-4000-8000-000000000002';
const RUN_RUNNING = 'aaaaaaaa-0000-4000-8000-000000000003';
const RUN_HISTORY = 'aaaaaaaa-0000-4000-8000-000000000005';
const RUN_RESUME = 'aaaaaaaa-0000-4000-8000-000000000006';
const RUN_RESUME_CONFLICT = 'aaaaaaaa-0000-4000-8000-000000000007';
const RUN_RESUME_503 = 'aaaaaaaa-0000-4000-8000-000000000008';
const HISTORY_WF = '99999999-9999-4999-8999-999999999999';

/** 超时等待态的可注入夹具：常见于续跑前的 run，带 taskId 与 timeout error。 */
function resumeRunFixture(runId, extra) {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  return Object.assign({
    runId: runId,
    workflowId: '11111111-1111-4111-8111-111111111111',
    workflowRevision: 3,
    harnessId: 'h-1',
    clientId: 'client-stub-01',
    instanceId: runId.replace('aaaaaaaa', 'bbbbbbbb'),
    state: 'waiting_resume',
    outcome: null,
    currentNodeId: 'n2',
    archiveState: 'none',
    createdAt: iso(24), startedAt: iso(24), finishedAt: null,
    workspacePath: '/tmp/fake/ws-resume',
    taskSpacePath: '/tmp/fake/ws-resume/.agent-flow/task/' + runId,
    autoConfirm: false,
    finalMessage: null,
    error: null,
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-r1', verdict: null, message: '开始', error: null, dispatchedAt: iso(24), finishedAt: iso(23) },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'waiting_resume', taskId: 't-r2', verdict: null, message: '## 超时前输出\n\n- 等待继续', error: { code: 'timeout', message: 'prompt 超时（1800000ms）' }, dispatchedAt: iso(23), finishedAt: null }
    ]
  }, extra);
}


const RUN_SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000013';
const RUN_SNAPSHOT_LIST = 'aaaaaaaa-0000-4000-8000-000000000014';
const RUN_DELETE_HISTORY = 'aaaaaaaa-0000-4000-8000-000000000015';
const RUN_NO_GRAPH = 'aaaaaaaa-0000-4000-8000-000000000016';
const DELETED_WF = '77777777-7777-4777-8777-777777777777';
const WORKFLOW_IN_RUNS = '11111111-1111-4111-8111-111111111111';

const SNAPSHOT_GRAPH = {
  stages: [{ id: 's1', name: '快照阶段', description: '运行冻结图', layout: { x: 40, y: 40, width: 700, height: 240 } }],
  nodes: [
    { id: 'n1', type: 'start', name: '启动', stageId: 's1', expertId: null, layout: { x: 60, y: 120 } },
    { id: 'n2', type: 'agent', name: '开发', stageId: 's1', expertId: '00000000-0000-4000-8000-00000000dead', layout: { x: 300, y: 120 } },
    { id: 'n3', type: 'end', name: '收尾', stageId: null, expertId: null, layout: { x: 540, y: 120 } }
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' }
  ],
  viewport: { x: 16, y: 12, zoom: 1 }
};

/** 已删除工作流/专家的运行快照：RunDetail.graph + workflowName + 节点 expertName。 */
function snapshotRun(runId, extra) {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  return Object.assign({
    runId: runId,
    workflowId: DELETED_WF,
    workflowName: '已删除工作流快照',
    workflowRevision: 7,
    harnessId: 'h-1',
    harnessName: '本机研发 Harness',
    clientId: 'client-stub-01',
    instanceId: runId.replace('aaaaaaaa', 'bbbbbbbb'),
    state: 'done',
    outcome: 'succeeded',
    currentNodeId: 'n3',
    archiveState: 'stored',
    createdAt: iso(40), startedAt: iso(40), finishedAt: iso(35),
    workspacePath: '/tmp/fake/ws-snapshot',
    taskSpacePath: '/tmp/fake/ws-snapshot/.agent-flow/task/' + runId,
    autoConfirm: false,
    finalMessage: '完成',
    error: null,
    graph: SNAPSHOT_GRAPH,
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-s1', verdict: null, message: '开始', error: null, expertName: null, dispatchedAt: iso(40), finishedAt: iso(39) },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-s2', verdict: null, message: '完成', error: null, expertName: '已删除的专家', dispatchedAt: iso(39), finishedAt: iso(36) },
      { nodeId: 'n3', nodeType: 'end', visit: 1, state: 'succeeded', taskId: 't-s3', verdict: null, message: '完成', error: null, expertName: null, dispatchedAt: iso(36), finishedAt: iso(35) }
    ]
  }, extra);
}

function conflictB3() {
  return {
    handle: async function (method, path, body, headers) {
      if (method === 'DELETE' && path === '/workflows/' + WORKFLOW_IN_RUNS) {
        return { status: 409, body: { error: { code: 'referenced', message: '资产仍被引用，不能删除', details: { references: [{ type: 'run', id: 'run-conflict', name: 'run-conflict' }] } } } };
      }
      return fakeB3.handle(method, path, body, headers);
    }
  };
}

const HISTORY_GRAPH = {
  stages: [{ id: 's1', name: '多轮回退阶段', description: '演示重新进入与打回', layout: { x: 40, y: 40, width: 820, height: 260 } }],
  nodes: [
    { id: 'n1', type: 'start', name: '启动', stageId: 's1', expertId: null, layout: { x: 60, y: 120 } },
    { id: 'n2', type: 'agent', name: '开发实现', stageId: 's1', expertId: null, layout: { x: 280, y: 120 } },
    { id: 'n3', type: 'review', name: '代码评审', stageId: 's1', expertId: null, layout: { x: 500, y: 120 } },
    { id: 'n4', type: 'end', name: '收尾', stageId: null, expertId: null, layout: { x: 720, y: 120 } }
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' },
    { id: 'e3', from: 'n3', to: 'n4', kind: 'seq' },
    { id: 'e4', from: 'n3', to: 'n2', kind: 'rollback' }
  ],
  viewport: { x: 16, y: 12, zoom: 0.8 }
};

function historyWorkflow() {
  return { id: HISTORY_WF, name: '多轮回退演示', type: '研发主流程', revision: 2, graph: HISTORY_GRAPH };
}

function historyRun() {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  return {
    runId: RUN_HISTORY,
    workflowId: HISTORY_WF,
    workflowRevision: 2,
    harnessId: 'h-1',
    clientId: 'client-stub-01',
    instanceId: 'bbbbbbbb-0000-4000-8000-000000000005',
    state: 'running',
    outcome: null,
    currentNodeId: 'n2',
    archiveState: 'none',
    createdAt: iso(20), startedAt: iso(20), finishedAt: null,
    workspacePath: '/tmp/fake/ws-history',
    taskSpacePath: '/tmp/fake/ws-history/.agent-flow/task/' + RUN_HISTORY,
    autoConfirm: false,
    finalMessage: null,
    error: null,
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-h1', verdict: null, message: '流程启动', error: null, dispatchedAt: iso(20), finishedAt: iso(19) },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-h2', verdict: null, message: '## 初版实现\n\n- 增加接口\n- 缺少幂等', error: null, dispatchedAt: iso(19), finishedAt: iso(17) },
      { nodeId: 'n3', nodeType: 'review', visit: 1, state: 'rejected', taskId: 't-h3', verdict: { decision: 'reject', reason: '缺少幂等处理' }, message: '## 评审不通过\n\n- 缺少幂等处理', error: null, dispatchedAt: iso(17), finishedAt: iso(16) },
      { nodeId: 'n2', nodeType: 'agent', visit: 2, state: 'dispatched', taskId: 't-h4', verdict: null, message: '## 第二轮修订\n\n- 已补充幂等键\n- 等待复审', error: null, dispatchedAt: iso(2), finishedAt: null }
    ]
  };
}

function historyB3() {
  return {
    handle: async function (method, path, body, headers) {
      if (method === 'GET' && path === '/workflows/' + HISTORY_WF) return { status: 200, body: historyWorkflow() };
      return fakeB3.handle(method, path, body, headers);
    }
  };
}

function openRunHistory(browser) {
  return open(browser, 'instance-detail', 'id=' + RUN_HISTORY, {
    b3: historyB3(),
    setup: function () { runFixtures(); addRunFixture(historyRun()); },
    wait: 900
  });
}

function runFixtures() {
  prepareUuidExperts();
  fakeB3.reset();
  MOCK.harnesses[0].clientId = 'client-stub-01';
}
/* 发起运行弹窗里的 Milkdown 用替身，避免测试依赖 vendor 包的真实编辑行为。 */
function launchEditorInit() {
  window.__AGENTFLOW_SKILL_MD__ = {
    mount: function (target, opts) {
      var ta = document.createElement('textarea');
      ta.id = 'stub-intent';
      ta.value = opts.markdown || '';
      ta.addEventListener('input', function () { if (opts.onChange) opts.onChange(ta.value); });
      target.appendChild(ta);
      return Promise.resolve({ getMarkdown: function () { return ta.value; }, setMarkdown: function (v) { ta.value = v; }, destroy: function () { return Promise.resolve(); } });
    }
  };
}
function openRunPage(browser, page, query) {
  return open(browser, page, query || '', { b3: fakeB3, setup: runFixtures, wait: 900 });
}

async function scn0004T1(browser) {
  const ctx = await openRunPage(browser, 'instances');
  try {
    assert.equal(await ctx.page.locator('#page-body tbody tr').count(), 5);
    const labels = await ctx.page.locator('#in-tabs .tab').allTextContents();
    assert.ok(labels.some((x) => x.includes('全部') && x.includes('5')), '全部计数: ' + labels.join('|'));
    assert.ok(labels.some((x) => x.includes('进行中') && x.includes('1')), '进行中计数: ' + labels.join('|'));
    assert.ok(labels.some((x) => x.includes('等待人工确认') && x.includes('1')), '等待确认计数: ' + labels.join('|'));
    assert.ok(labels.some((x) => x.includes('等待继续') && x.includes('1')), '等待继续计数: ' + labels.join('|'));
    assert.ok(labels.some((x) => x.includes('已结束') && x.includes('2')), '已结束计数: ' + labels.join('|'));
    assert.match(await ctx.page.locator('#page-body').textContent(), /client-stub-01/);
    assert.match(await ctx.page.locator('#page-body').textContent(), /执行超时，等待继续/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T2(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_WAIT);
  try {
    assert.equal(await ctx.page.locator('.cv-node').count(), 3);
    assert.equal(await ctx.page.locator('.cv-node.st-ok').count(), 1);
    assert.equal(await ctx.page.locator('.cv-node.st-wait').count(), 1);
    assert.equal(await ctx.page.locator('#id-panel').count(), 0, '详情不再使用右侧面板');
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 0, '未双击前不打开节点详情');

    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(250);
    const modal = ctx.page.locator('.modal-screen');
    assert.equal(await modal.count(), 1);
    const box = await modal.boundingBox();
    const vp = ctx.page.viewportSize();
    assert.ok(Math.abs(box.width - vp.width * 0.9) <= 2, '弹层宽度应为视口 90%，实际 ' + box.width);
    assert.ok(Math.abs(box.height - vp.height * 0.9) <= 2, '弹层高度应为视口 90%，实际 ' + box.height);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1);
    assert.match(await modal.innerText(), /请确认方案/);
    assert.equal(await ctx.page.locator('.id-confirm-card .md-body').count(), 1);
    assert.equal(await ctx.page.locator('[data-md], .id-full').count(), 0, '90% 弹层内不再提供二次全屏');

    await ctx.page.locator('.modal-screen .id-tabs .tab[data-t="log"]').click();
    await ctx.page.waitForTimeout(120);
    assert.match(await modal.innerText(), /会话日志/);

    // 视口压到 500px 后，90% 弹层内容超出，滚动条落在弹层主体内部
    await ctx.page.setViewportSize({ width: 1440, height: 500 });
    await ctx.page.waitForTimeout(150);
    await ctx.page.locator('.modal-screen .id-tabs .tab[data-t="summary"]').click();
    await ctx.page.waitForTimeout(120);
    const scroll = await ctx.page.locator('.modal-screen .d-body').evaluate(function (el) {
      return { sh: el.scrollHeight, ch: el.clientHeight, overflow: getComputedStyle(el).overflowY };
    });
    assert.ok(scroll.sh > scroll.ch, '内容超高时应由弹层主体滚动');
    assert.equal(scroll.overflow, 'auto');

    await ctx.page.keyboard.press('Escape');
    assert.equal(await ctx.page.locator('.modal-screen').count(), 0);
    assert.equal(await ctx.page.locator('#id-pause').isDisabled(), true);
    assert.equal(await ctx.page.locator('#id-stop').count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T3(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_WAIT);
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(200);
    await ctx.page.locator('#cf-no').click();
    await ctx.page.waitForTimeout(120);
    assert.match(await ctx.page.locator('body').textContent(), /驳回必须填写意见/);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1);

    await ctx.page.locator('#cf-comment').fill('联调通过');
    await ctx.page.locator('#cf-ok').click();
    await ctx.page.locator('.id-confirm-card').waitFor({ state: 'detached', timeout: 5000 });
    await ctx.page.waitForTimeout(200);
    assert.equal(await ctx.page.locator('.cv-node.st-ok').count(), 2);
    assert.equal(await ctx.page.locator('.cv-node.st-run').count(), 1);
    assert.match(await ctx.page.locator('body').textContent(), /运行中/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T5(browser) {
  const ctx = await open(browser, 'instances', '', {
    b3: fakeB3, setup: runFixtures, initScript: launchEditorInit, wait: 900
  });
  let sent = null;
  try {
    ctx.page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      if (!/\/api\/v1\/workflows\/[^/]+\/runs$/.test(new URL(req.url()).pathname)) return;
      try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = null; }
    });
    await ctx.page.locator('#in-launch').click();
    await ctx.page.locator('#stub-intent').waitFor({ timeout: 5000 });
    const harnessId = await ctx.page.locator('#rn-harness').inputValue();
    await ctx.page.fill('#rn-path', '/tmp/scn0004/ws-launch');
    await ctx.page.fill('#stub-intent', '## 联调目标\n\n- 验证发起运行');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForURL(/instance-detail\.html\?id=/, { timeout: 8000 });
    await ctx.page.waitForTimeout(500);
    assert.ok(sent, '未捕获 start 请求');
    assert.equal(sent.harnessId, harnessId);
    assert.equal(sent.workspacePath, '/tmp/scn0004/ws-launch');
    assert.match(sent.intentMarkdown, /验证发起运行/);
    assert.equal(sent.autoConfirm, false);
    assert.match(ctx.page.url(), new RegExp('instance-detail\\.html\\?id='));
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T4(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_RUNNING);
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(250);
    assert.equal(await ctx.page.locator('.modal-screen .md-body h2').innerText(), '执行中');
    assert.equal(await ctx.page.locator('.modal-screen .md-body li').count(), 2);
    await ctx.page.locator('.modal-screen [id="id-modal-close"]').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(await ctx.page.locator('.modal-screen').count(), 0);
    await ctx.page.locator('#id-stop').click();
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);
    assert.equal(await ctx.page.locator('#id-stop').count(), 1);
    assert.match(await ctx.page.locator('body').textContent(), /运行中/);

    await ctx.page.locator('#id-stop').click();
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(500);
    assert.equal(await ctx.page.locator('#id-stop').count(), 0);
    assert.match(await ctx.page.locator('body').textContent(), /已终止/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T6(browser) {
  const ctx = await openRunHistory(browser);
  try {
    const page = ctx.page;
    assert.equal(await page.locator('.cv-node').count(), 4);
    assert.match(await page.locator('.cv-node[data-node="n2"] .n-sub').textContent(), /第 2 轮/);
    assert.match(await page.locator('.cv-node[data-node="n3"]').getAttribute('class'), /st-rollback/);

    await page.locator('.cv-node[data-node="n2"]').dblclick();
    await page.waitForTimeout(250);
    const modal = page.locator('.modal-screen');
    assert.equal(await modal.count(), 1);
    assert.equal(await page.locator('.id-round-tab').count(), 2, '重新进入的节点应出现最新轮与历史轮 Tab');
    assert.match(await page.locator('.id-round-tab').first().textContent(), /最新 · 第 2 轮/);
    assert.match(await page.locator('.id-round-tab[data-visit="1"]').textContent(), /第 1 轮/);
    assert.match(await page.locator('#id-body').innerText(), /第二轮修订/);
    assert.match(await page.locator('#id-body').innerText(), /第 2 轮（最新）/);

    await page.locator('.id-round-tab[data-visit="1"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.id-round-tab.on').getAttribute('data-visit'), '1');
    assert.match(await page.locator('#id-body').innerText(), /初版实现/);
    assert.match(await page.locator('#id-body').innerText(), /第 1 轮（历史）/);
    assert.match(await page.locator('.id-history-note').innerText(), /历史轮次/);
    assert.equal(await page.locator('.id-confirm-card').count(), 0, '历史轮次不得出现确认入口');

    await page.locator('.id-tabs .tab[data-t="log"]').click();
    await page.waitForTimeout(120);
    const log = page.locator('#id-body a.btn.primary');
    assert.match(await log.getAttribute('href'), /\/runs\/[^/]+\/nodes\/n2\/session-log\?visit=1/);
    assert.equal(await log.getAttribute('download'), 'session-n2-v1.ndjson.gz');

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal-screen').count(), 0);
    // 被打回的评审节点仍保留此前一轮的结论与内容
    await page.locator('.cv-node[data-node="n3"]').dblclick();
    await page.waitForTimeout(200);
    assert.match(await page.locator('.modal-screen').innerText(), /评审不通过/);
    assert.match(await page.locator('.modal-screen').innerText(), /缺少幂等处理/);
    assert.match(await page.locator('.modal-screen .id-node-h').innerText(), /已驳回/);
    assert.equal(await page.locator('.id-round-tab').count(), 0, '单轮节点不显示轮次 Tab');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T7(browser) {
  const ctx = await open(browser, 'instances', '', {
    b3: fakeB3, setup: runFixtures, initScript: launchEditorInit, wait: 900
  });
  try {
    const paths = [];
    for (let i = 0; i < 10; i++) paths.push('/tmp/scn0004/recent-' + i);
    await ctx.page.evaluate(function (seed) {
      localStorage.setItem('df-launch-workspace-paths', JSON.stringify({
        v: 1,
        byClient: { 'client-stub-01': seed, 'client-other': ['/tmp/scn0004/other-client'] }
      }));
    }, paths);

    await ctx.page.locator('#in-launch').click();
    await ctx.page.locator('#stub-intent').waitFor({ timeout: 5000 });
    assert.equal(await ctx.page.locator('#rn-path').inputValue(), '/Users/chenlong/hundsun/af-workspace-demo');

    await ctx.page.locator('#rn-path-toggle').click();
    await ctx.page.locator('.ws-path-item').first().waitFor({ timeout: 3000 });
    assert.equal(await ctx.page.locator('.ws-path-item').count(), 10);
    assert.equal(await ctx.page.locator('.ws-path-item').first().locator('.ws-path-text').textContent(), paths[0]);
    assert.equal(await ctx.page.locator('.ws-path-pop').textContent().then(function (t) { return t.includes('/tmp/scn0004/other-client'); }), false);
    const inputBox = await ctx.page.locator('#rn-path').boundingBox();
    const popBox = await ctx.page.locator('#rn-path-pop').boundingBox();
    assert.ok(inputBox && popBox && popBox.y >= inputBox.y + inputBox.height, '下拉应位于输入框下方');
    assert.ok(popBox && popBox.x >= 0 && popBox.x + popBox.width <= 1441, '下拉不得越出视口');
    const bodyBox = await ctx.page.locator('.modal .d-body').boundingBox();
    assert.ok(bodyBox && popBox && popBox.y + popBox.height <= bodyBox.y + bodyBox.height + 1, '下拉不得被弹层主体裁切');

    await ctx.page.setViewportSize({ width: 900, height: 640 });
    await ctx.page.waitForTimeout(100);
    const smallBody = await ctx.page.locator('.modal .d-body').boundingBox();
    const smallPop = await ctx.page.locator('#rn-path-pop').boundingBox();
    assert.ok(smallBody && smallPop && smallPop.y >= smallBody.y && smallPop.y + smallPop.height <= smallBody.y + smallBody.height + 1, '小视口下拉不得被弹层主体裁切');
    await ctx.page.setViewportSize({ width: 1440, height: 900 });
    await ctx.page.waitForTimeout(100);

    await ctx.page.locator('.ws-path-item').nth(1).click();
    assert.equal(await ctx.page.locator('#rn-path').inputValue(), paths[1]);
    assert.equal(await ctx.page.locator('#rn-path-pop').isHidden(), true);

    await ctx.page.locator('#rn-path-toggle').click();
    await ctx.page.locator('.ws-path-item').nth(2).locator('.ws-path-del').click();
    assert.equal(await ctx.page.locator('.ws-path-item').count(), 9);
    const stored = await ctx.page.evaluate(function () { return JSON.parse(localStorage.getItem('df-launch-workspace-paths')); });
    assert.equal(stored.byClient['client-stub-01'].length, 9);
    assert.equal(stored.byClient['client-stub-01'].includes('/tmp/scn0004/recent-2'), false);
    assert.equal(await ctx.page.locator('#rn-path').inputValue(), paths[1], '删除历史不得改动当前输入');

    const fresh = '/tmp/scn0004/ws-history-new';
    await ctx.page.fill('#rn-path', fresh);
    await ctx.page.fill('#stub-intent', '## 历史路径\n\n- 启动成功后写入');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForURL(/instance-detail\.html\?id=/, { timeout: 8000 });
    await ctx.page.waitForTimeout(200);
    const after = await ctx.page.evaluate(function () { return JSON.parse(localStorage.getItem('df-launch-workspace-paths')); });
    assert.deepEqual(after.byClient['client-stub-01'].slice(0, 3), [fresh, paths[0], paths[1]]);
    assert.equal(after.byClient['client-stub-01'].length, 10);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T8(browser) {
  const ctx = await open(browser, 'instances', '', {
    b3: fakeB3, setup: runFixtures, initScript: launchEditorInit, wait: 900
  });
  try {
    await ctx.page.evaluate(function () {
      localStorage.setItem('df-launch-workspace-paths', 'not-json');
    });
    await ctx.page.locator('#in-launch').click();
    await ctx.page.locator('#stub-intent').waitFor({ timeout: 5000 });
    await ctx.page.locator('#rn-path-toggle').click();
    assert.equal(await ctx.page.locator('.ws-path-item').count(), 0);
    assert.match(await ctx.page.locator('.ws-path-pop').textContent(), /该执行节点暂无历史路径/);
    assert.equal(await ctx.page.locator('#rn-path').inputValue(), '/Users/chenlong/hundsun/af-workspace-demo');
    await closeModal(ctx.page);
    await ctx.page.waitForTimeout(120);

    await ctx.page.evaluate(function () {
      localStorage.setItem('df-launch-workspace-paths', JSON.stringify({
        v: 1,
        byClient: { 'client-other': ['/tmp/scn0004/other-only'] }
      }));
    });
    await ctx.page.locator('#in-launch').click();
    await ctx.page.locator('#stub-intent').waitFor({ timeout: 5000 });
    await ctx.page.locator('#rn-path-toggle').click();
    assert.equal(await ctx.page.locator('.ws-path-item').count(), 0, '其他执行节点的历史不得串入');
    assert.equal(await ctx.page.locator('.ws-path-pop').textContent().then(function (t) { return t.includes('/tmp/scn0004/other-only'); }), false);
    await ctx.page.fill('#rn-path', '/tmp/scn0004/manual-path');
    assert.equal(await ctx.page.locator('#rn-path').inputValue(), '/tmp/scn0004/manual-path', '无历史时仍可手输绝对路径');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T9(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_RESUME);
  try {
    const page = ctx.page;
    const resumes = [];
    page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      if (/\/runs\/[^/]+\/nodes\/n2\/resume$/.test(new URL(req.url()).pathname)) resumes.push(new URL(req.url()).pathname);
    });
    assert.equal(await page.locator('.cv-node.st-timeout').count(), 1);
    assert.match(await page.locator('.cv-node[data-node="n2"] .n-sub').textContent(), /超时，等待继续/);
    const banner = page.locator('#id-wait-banner');
    assert.equal(await banner.count(), 1);
    const bannerText = await banner.innerText();
    assert.match(bannerText, /执行超时，等待继续/);
    assert.match(bannerText, /prompt 超时（1800000ms）/);
    assert.match(bannerText, /使用原任务、原会话继续；不会新建运行/);
    assert.match(bannerText, /等待期间该工作区不能启动新的运行/);
    assert.match(bannerText, /t-10/);
    assert.equal(await page.locator('#id-wait-resume').isDisabled(), false);
    assert.equal(await page.locator('#id-wait-stop').count(), 1);

    // 继续入口只出现在等待继续的节点上
    await page.locator('.cv-node[data-node="n1"]').dblclick();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#id-node-wait').count(), 0, '非等待节点不得出现继续入口');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    await page.locator('.cv-node[data-node="n2"]').dblclick();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#id-node-wait').count(), 1);
    assert.equal(await page.locator('#id-node-wait [data-resume-node="n2"]').count(), 1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    await page.locator('#id-wait-resume').click();
    assert.equal(await page.locator('#id-wait-resume').isDisabled(), true, '请求期间必须禁用按钮');
    assert.match(await page.locator('#id-wait-resume').textContent(), /正在继续…/);
    await banner.waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(resumes.length, 1, '一次点击只发一次续跑请求');
    assert.match(resumes[0], /\/runs\/aaaaaaaa-0000-4000-8000-000000000006\/nodes\/n2\/resume$/);
    assert.match(await page.locator('body').textContent(), /已提交，等待客户端执行/);
    assert.equal(await page.locator('.cv-node.st-run').count(), 1);
    assert.match(await page.locator('.page-header').textContent(), /运行中/);
    assert.equal(await page.locator('.cv-node.st-timeout').count(), 0);

    // 同一 taskId 保留：续跑不新建 run/task
    await page.locator('.cv-node[data-node="n2"]').dblclick();
    await page.waitForTimeout(250);
    assert.match(await page.locator('.modal-screen').innerText(), /t-10/);
    assert.equal(await page.locator('#id-node-wait').count(), 0, '续跑后节点弹层不再显示等待卡');
    assert.equal(await page.locator('.modal-screen .id-confirm-card').count(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T10(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=' + RUN_RESUME_CONFLICT, {
    b3: fakeB3,
    setup: function () {
      runFixtures();
      addRunFixture(resumeRunFixture(RUN_RESUME_CONFLICT, {
        resumeError: {
          status: 409,
          body: { error: { code: 'invalid_state', message: '当前状态不允许该操作：node_not_waiting_resume', details: { reason: 'node_not_waiting_resume' } } }
        }
      }));
    },
    wait: 900
  });
  try {
    await ctx.page.locator('#id-wait-resume').click();
    await ctx.page.waitForTimeout(500);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /继续失败：节点已不在等待继续状态，请刷新后重试/);
    assert.equal(await ctx.page.locator('#id-wait-banner').count(), 1, '409 后保留等待态，不伪造成功');
    assert.equal(await ctx.page.locator('#id-wait-resume').isDisabled(), false);
    assert.equal(await ctx.page.locator('.toast', { hasText: '已提交，等待客户端执行' }).count(), 0);
    assert.match(await ctx.page.locator('.page-header').textContent(), /执行超时，等待继续/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T11(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=' + RUN_RESUME_503, {
    b3: fakeB3,
    setup: function () {
      runFixtures();
      addRunFixture(resumeRunFixture(RUN_RESUME_503, {
        resumeError: { status: 503, body: { error: { code: 'service_unavailable', message: '数据库暂不可用' } } }
      }));
    },
    wait: 900
  });
  try {
    await ctx.page.locator('#id-wait-resume').click();
    await ctx.page.waitForTimeout(500);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /继续失败：后端服务不可用，请检查运行服务/);
    assert.equal(await ctx.page.locator('#id-wait-banner').count(), 1);
    assert.equal(await ctx.page.locator('#id-wait-resume').isDisabled(), false, '503 后保留按钮供重试');
    assert.match(await ctx.page.locator('.page-header').textContent(), /执行超时，等待继续/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}


async function scn0004T12(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=' + RUN_SNAPSHOT, {
    b3: fakeB3,
    setup: function () { runFixtures(); addRunFixture(snapshotRun(RUN_SNAPSHOT)); },
    wait: 900
  });
  try {
    const wfRequests = [];
    ctx.page.on('request', function (req) {
      const p = new URL(req.url()).pathname;
      if (p.includes('/api/v1/workflows/')) wfRequests.push(p);
    });
    assert.equal(await ctx.page.locator('.cv-node').count(), 3, '应使用 RunDetail.graph 渲染画布');
    assert.match(await ctx.page.locator('.page-header h1').textContent(), /已删除工作流快照/);
    assert.match(await ctx.page.locator('.page-header h1').textContent(), /r7/);
    assert.equal(await ctx.page.locator('#page-body .empty').count(), 0, '有 graph 时不显示无图占位');
    assert.equal(wfRequests.length, 0, '有 run.graph 时不得再请求 GET /workflows/{id}');
    noErrors(ctx);
  } finally { await ctx.page.close(); }

  const noGraph = await open(browser, 'instance-detail', 'id=' + RUN_NO_GRAPH, {
    b3: fakeB3,
    setup: function () {
      runFixtures();
      addRunFixture(snapshotRun(RUN_NO_GRAPH, { graph: null, workflowName: '无图快照运行' }));
    },
    wait: 900
  });
  try {
    assert.match(await noGraph.page.locator('.page-header h1').textContent(), /无图快照运行/);
    assert.match(await noGraph.page.locator('#page-body').innerText(), /该运行没有可用的图快照/);
    assert.doesNotMatch(await noGraph.page.locator('#page-body').innerText(), /运行不存在或已删除/);
    noErrors(noGraph);
  } finally { await noGraph.page.close(); }
}

async function scn0004T13(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=' + RUN_SNAPSHOT, {
    b3: fakeB3,
    setup: function () { runFixtures(); addRunFixture(snapshotRun(RUN_SNAPSHOT)); },
    wait: 900
  });
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(250);
    const text = await ctx.page.locator('.modal-screen').innerText();
    assert.match(text, /已删除的专家/);
    assert.equal(text.includes('00000000-0000-4000-8000-00000000dead'), false, '专家已删时不得显示裸 UUID');
    assert.match(text, /开发/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T14(browser) {
  const ctx = await open(browser, 'instances', '', {
    b3: fakeB3,
    setup: function () { runFixtures(); addRunFixture(snapshotRun(RUN_SNAPSHOT_LIST)); },
    wait: 900
  });
  try {
    assert.match(await ctx.page.locator('#page-body').innerText(), /已删除工作流快照/);
    await ctx.page.goto(BASE + '/pages/instances.html?wfId=' + encodeURIComponent(DELETED_WF), { waitUntil: 'networkidle' });
    await ctx.page.waitForTimeout(700);
    assert.match(await ctx.page.locator('.notice').innerText(), /已删除工作流快照/);
    assert.equal(await ctx.page.locator('#page-body tbody tr').count(), 1, '按历史 workflowId 过滤仍能命中');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0004T15(browser) {
  const ctx = await open(browser, 'workflow-list', '', {
    b3: fakeB3,
    setup: function () {
      runFixtures();
      addRunFixture(snapshotRun(RUN_DELETE_HISTORY, {
        workflowId: WORKFLOW_IN_RUNS,
        workflowName: '研发四阶段主流程',
        workflowRevision: 3
      }));
    },
    wait: 800
  });
  try {
    const card = ctx.page.locator('.wl-card', { hasText: '研发四阶段主流程' }).first();
    await card.locator('[data-act="more"]').click();
    await clickMenu(ctx.page, '删除');
    assert.match(await ctx.page.locator('.modal').innerText(), /未结束的运行/);
    await ctx.page.locator('#mc-no').click();
    await ctx.page.waitForTimeout(120);

    await card.locator('[data-act="more"]').click();
    await clickMenu(ctx.page, '删除');
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(600);
    assert.match(await ctx.page.locator('body').innerText(), /已删除/);
    assert.equal(await ctx.page.locator('.wl-card', { hasText: '研发四阶段主流程' }).count(), 0);

    await ctx.page.goto(BASE + '/pages/instance-detail.html?id=' + RUN_DELETE_HISTORY, { waitUntil: 'networkidle' });
    await ctx.page.waitForTimeout(800);
    assert.match(await ctx.page.locator('.page-header h1').textContent(), /研发四阶段主流程/);
    assert.equal(await ctx.page.locator('.cv-node').count(), 3, '工作流删除后历史运行仍用快照渲染');
    assert.equal(await ctx.page.locator('#page-body .empty').count(), 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }

  const ex = await open(browser, 'experts', '', { setup: runFixtures, wait: 600 });
  try {
    await ex.page.locator('[data-act="detail"]').first().click();
    await ex.page.waitForTimeout(250);
    await ex.page.locator('#ex-delete').click();
    assert.match(await ex.page.locator('.modal').innerText(), /未结束的运行/);
    await ex.page.locator('#mc-no').click();
    noErrors(ex);
  } finally { await ex.page.close(); }

  const ha = await open(browser, 'harnesses', '', { setup: runFixtures, wait: 600 });
  try {
    await ha.page.locator('[data-act="del"]').first().click();
    assert.match(await ha.page.locator('.modal').innerText(), /未结束的运行/);
    await ha.page.locator('#mc-no').click();
    noErrors(ha);
  } finally { await ha.page.close(); }
}

async function scn0004T16(browser) {
  const ctx = await open(browser, 'workflow-list', '', { b3: conflictB3(), setup: runFixtures, wait: 800 });
  try {
    const card = ctx.page.locator('.wl-card', { hasText: '研发四阶段主流程' }).first();
    await card.locator('[data-act="more"]').click();
    await clickMenu(ctx.page, '删除');
    await ctx.page.locator('#mc-ok').click();
    await ctx.page.waitForTimeout(500);
    assert.match(await ctx.page.locator('.toast').last().innerText(), /有未结束的运行/);
    assert.equal(await ctx.page.locator('.wl-card', { hasText: '研发四阶段主流程' }).count(), 1, '409 后列表保留');
    noErrors(ctx);
  } finally { await ctx.page.close(); }

  const ex = await open(browser, 'experts', '', {
    setup: function () {
      runFixtures();
      MOCK.experts[0]._runRefs = [{ type: 'run', id: 'run-expert', name: 'run-expert' }];
    },
    wait: 600
  });
  try {
    await ex.page.locator('[data-act="detail"]').first().click();
    await ex.page.waitForTimeout(250);
    await ex.page.locator('#ex-delete').click();
    await ex.page.locator('#mc-ok').click();
    await ex.page.waitForTimeout(500);
    assert.match(await ex.page.locator('.toast').last().innerText(), /有未结束的运行/);
    noErrors(ex);
  } finally { await ex.page.close(); }
}

/* ----------------------------- SCN-0024 ----------------------------- */
const SCN0024_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openLaunchWithImages(browser) {
  const ctx = await open(browser, 'instances', '', {
    b3: fakeB3, setup: runFixtures, initScript: launchEditorInit, wait: 900
  });
  await ctx.page.locator('#in-launch').click();
  await ctx.page.locator('#stub-intent').waitFor({ timeout: 5000 });
  return ctx;
}

async function addImages(page, names) {
  await page.setInputFiles('#rn-inputs-file', names.map(function (name) {
    return { name: name, mimeType: 'image/png', buffer: SCN0024_PNG };
  }));
  await page.waitForTimeout(150);
}

async function dispatchImageTransfer(page, type, name) {
  await page.evaluate(function (args) {
    const bytes = Uint8Array.from(atob(args.base64), function (c) { return c.charCodeAt(0); });
    const file = new File([bytes], args.name, { type: 'image/png' });
    /* 合成 DataTransfer 载荷：只实现页面读取的 types/files 契约，避免真实拖放在无头引擎里依赖操作系统手势。 */
    const transfer = { types: ['Files'], files: [file], dropEffect: '' };
    const event = new Event(args.type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    document.querySelector('.modal .d-body').dispatchEvent(event);
  }, { type: type, name: name, base64: SCN0024_PNG.toString('base64') });
  await page.waitForTimeout(150);
}

async function pasteImage(page, name) {
  await page.evaluate(function (args) {
    const bytes = Uint8Array.from(atob(args.base64), function (c) { return c.charCodeAt(0); });
    const file = new File([bytes], args.name, { type: 'image/png' });
    /* 合成 clipboardData：只实现页面读取的 items[].kind/type/getAsFile 契约。 */
    const clipboard = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: function () { return file; } }]
    };
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: clipboard });
    document.querySelector('.modal .d-body').dispatchEvent(event);
  }, { name: name, base64: SCN0024_PNG.toString('base64') });
  await page.waitForTimeout(150);
}

async function scn0024T1(browser) {
  const ctx = await openLaunchWithImages(browser);
  try {
    await pasteImage(ctx.page, 'pasted.png');
    await dispatchImageTransfer(ctx.page, 'drop', 'dropped.png');
    await addImages(ctx.page, ['picked.png']);
    assert.equal(await ctx.page.locator('.rn-thumb').count(), 3, '粘贴/拖放/选择都应入栏');
    assert.match(await ctx.page.locator('#rn-inputs-count').textContent(), /已选 3\/8/);
    assert.equal(fakeB1.runInputStats().uploaded, 0, '提交前不得上传');
    const prevented = await ctx.page.evaluate(function () {
      const clipboard = { items: [{ kind: 'string', type: 'text/plain', getAsFile: function () { return null; } }] };
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: clipboard });
      document.querySelector('.modal .d-body').dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(prevented, false, '纯文本粘贴不应被图片逻辑拦截');
    await ctx.page.locator('.rn-thumb-del').first().click({ force: true });
    await ctx.page.waitForTimeout(100);
    assert.equal(await ctx.page.locator('.rn-thumb').count(), 2);
    assert.equal(fakeB1.runInputStats().uploaded, 0);
    assert.deepEqual(fakeB1.runInputStats().deleted, [], '删除本地暂存不得发 DELETE');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0024T2(browser) {
  const ctx = await openLaunchWithImages(browser);
  try {
    await addImages(ctx.page, ['a.png', 'b.png', 'c.png']);
    await ctx.page.locator('.rn-thumb-del').nth(1).click({ force: true });
    await ctx.page.waitForTimeout(100);
    await ctx.page.fill('#stub-intent', '## 带图启动\n\n- 两张初始资料');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForURL(/instance-detail\.html\?id=/, { timeout: 10000 });
    await ctx.page.waitForTimeout(400);
    const start = fakeB1.lastStartRequest();
    assert.ok(start, '未捕获 start 请求');
    assert.ok(Array.isArray(start.body.inputs), 'start 必须带 inputs');
    assert.equal(start.body.inputs.length, 2);
    const stats = fakeB1.runInputStats();
    assert.equal(stats.uploaded, 2);
    assert.deepEqual(stats.bound.map(function (item) { return item.name; }), ['a.png', 'c.png']);
    assert.deepEqual(start.body.inputs.map(function (ref) { return ref.inputId; }),
      stats.bound.map(function (item) { return item.inputId; }), 'inputs 顺序必须与列表一致');
    assert.deepEqual(stats.deleted, []);
    await ctx.page.locator('#id-inputs').waitFor({ timeout: 4000 });
    assert.equal(await ctx.page.locator('#id-inputs .id-input').count(), 2);
    const href = await ctx.page.locator('#id-inputs .id-input').first().getAttribute('href');
    assert.match(href, /^\/api\/v1\/runs\/[^/]+\/inputs\/[^/]+\/content$/);
    assert.match(await ctx.page.locator('#id-inputs').textContent(), /初始资料（2）/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0024T3(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_RUNNING);
  try {
    assert.equal(await ctx.page.locator('#id-inputs').count(), 0, '无初始资料时不得渲染区块');
    assert.equal(await ctx.page.locator('.id-trace .cv-node').count() > 0, true);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0024T4(browser) {
  const ctx = await openLaunchWithImages(browser);
  try {
    const names = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png'];
    await addImages(ctx.page, names);
    assert.equal(await ctx.page.locator('.rn-thumb').count(), 8, '最多保留 8 张');
    await ctx.page.locator('.toast').last().waitFor({ timeout: 3000 });
    assert.match(await ctx.page.locator('.toast').last().innerText(), /最多 8 张图片/);
    assert.equal(fakeB1.runInputStats().uploaded, 0);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0024T5(browser) {
  const ctx = await openLaunchWithImages(browser);
  try {
    fakeB1.failNextInputUpload(500, 'internal_error', '上传失败');
    await addImages(ctx.page, ['a.png']);
    await ctx.page.fill('#stub-intent', '上传失败后重试');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.locator('.toast.err').last().waitFor({ timeout: 5000 });
    assert.match(await ctx.page.locator('.toast.err').last().innerText(), /上传失败/);
    const failed = fakeB1.runInputStats();
    assert.equal(failed.staged.length, 0, '上传失败不得留下暂存项');
    assert.equal(failed.bound.length, 0);
    assert.equal(await ctx.page.locator('.modal').count(), 1, '失败后弹窗保留');
    assert.equal(await ctx.page.locator('.rn-thumb').count(), 1, '本地图片保留供重试');
    const retry = ctx.page.locator('.modal .d-foot .btn.primary');
    assert.equal(await retry.isDisabled(), false);
    assert.equal(await retry.textContent(), '发起运行');
    await retry.click();
    await ctx.page.waitForURL(/instance-detail\.html\?id=/, { timeout: 10000 });
    await ctx.page.waitForTimeout(300);
    assert.equal(fakeB1.runInputStats().bound.length, 1, '重试应重新上传并绑定');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0024T6(browser) {
  const ctx = await openLaunchWithImages(browser);
  try {
    fakeB1.failNextStart(409, 'client_unsupported', { capability: 'run-inputs', reason: 'capability_missing' });
    await addImages(ctx.page, ['only.png']);
    await ctx.page.fill('#stub-intent', '启动失败后重试');
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.locator('.toast.err').last().waitFor({ timeout: 5000 });
    assert.match(await ctx.page.locator('.toast.err').last().innerText(), /暂不支持图片/);
    const failed = fakeB1.runInputStats();
    assert.equal(failed.uploaded, 1);
    assert.equal(failed.deleted.length, 1, '启动失败必须回滚已上传暂存');
    assert.equal(failed.bound.length, 0);
    assert.equal(await ctx.page.locator('.modal').count(), 1);
    assert.equal(await ctx.page.locator('.rn-thumb').count(), 1);
    await ctx.page.locator('.modal .d-foot .btn.primary').click();
    await ctx.page.waitForURL(/instance-detail\.html\?id=/, { timeout: 10000 });
    await ctx.page.waitForTimeout(300);
    assert.equal(fakeB1.runInputStats().bound.length, 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

/* ----------------------------- SCN-0022 ----------------------------- */
const RUN_CONFIRM = 'aaaaaaaa-0000-4000-8000-000000000009';
const RUN_CONFIRM_HISTORY = 'aaaaaaaa-0000-4000-8000-000000000010';
const RUN_CONFIRM_BAD = 'aaaaaaaa-0000-4000-8000-000000000011';
const RUN_CONFIRM_TEXT = 'aaaaaaaa-0000-4000-8000-000000000012';

/** 执行中确认点夹具：默认 n2 为 agent，verdict 由页面按 kind 识别。 */
function confirmRunFixture(runId, opts) {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  opts = opts || {};
  const verdict = opts.verdict !== undefined ? opts.verdict : {
    kind: 'confirmation_request',
    question: '是否允许修改契约？',
    context: 'A 方案改动小，B 方案可扩展；需要人拍板。',
    options: ['允许', '拒绝'],
    allowFreeText: true
  };
  const nodes = opts.nodes || [
    { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-c1', verdict: null, message: '开始', error: null, dispatchedAt: iso(8), finishedAt: iso(7) },
    { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'waiting_confirm', taskId: 't-c2', verdict: verdict, message: opts.message !== undefined ? opts.message : '## 执行到一半\n\n- 已完成接口梳理\n- 等待人工拍板', error: null, dispatchedAt: iso(7), finishedAt: null }
  ];
  return {
    runId: runId,
    workflowId: '11111111-1111-4111-8111-111111111111',
    workflowRevision: 3,
    harnessId: 'h-1',
    clientId: 'client-stub-01',
    instanceId: runId.replace('aaaaaaaa', 'bbbbbbbb'),
    state: 'waiting_confirm',
    outcome: null,
    currentNodeId: 'n2',
    archiveState: 'none',
    createdAt: iso(8), startedAt: iso(8), finishedAt: null,
    workspacePath: '/tmp/fake/ws-confirm',
    taskSpacePath: '/tmp/fake/ws-confirm/.agent-flow/task/' + runId,
    autoConfirm: false,
    finalMessage: null,
    error: null,
    nodes: nodes
  };
}

function confirmationHistoryRun() {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  return confirmRunFixture(RUN_CONFIRM_HISTORY, {
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-ch1', verdict: null, message: '开始', error: null, dispatchedAt: iso(12), finishedAt: iso(11) },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-ch2', verdict: { decision: 'pass', reason: '先做第一版' }, message: '## 第一版\n\n- 已按 A 方案实现', error: null, dispatchedAt: iso(11), finishedAt: iso(10) },
      { nodeId: 'n2', nodeType: 'agent', visit: 2, state: 'waiting_confirm', taskId: 't-ch3', verdict: { kind: 'confirmation_request', question: '是否允许修改契约？', options: ['允许', '拒绝'], allowFreeText: true }, message: '## 第二轮\n\n- 需要人工拍板', error: null, dispatchedAt: iso(5), finishedAt: null }
    ]
  });
}

function openConfirmRun(browser, run) {
  return open(browser, 'instance-detail', 'id=' + run.runId, {
    b3: fakeB3,
    setup: function () { runFixtures(); addRunFixture(run); },
    wait: 900
  });
}

async function scn0022T1(browser) {
  const ctx = await openConfirmRun(browser, confirmRunFixture(RUN_CONFIRM));
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    const card = ctx.page.locator('.id-confirm-card');
    assert.equal(await card.count(), 1);
    const text = await card.innerText();
    assert.match(text, /执行中确认 · 需求分析/);
    assert.match(text, /是否允许修改契约？/);
    assert.match(text, /A 方案改动小，B 方案可扩展/);
    assert.equal(await ctx.page.locator('.id-cf-opt').count(), 2);
    assert.match(await ctx.page.locator('#cf-ok').innerText(), /确认并继续/);
    assert.match(await ctx.page.locator('#cf-no').innerText(), /拒绝并反馈/);
    assert.equal(text.includes('批准，继续执行'), false, '执行中确认点不得复用 confirm 节点按钮文案');
    assert.equal(text.includes('驳回'), false, '执行中确认点不得复用 confirm 节点驳回文案');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T2(browser) {
  const ctx = await openConfirmRun(browser, confirmRunFixture(RUN_CONFIRM));
  let sent = null;
  try {
    ctx.page.on('request', function (req) {
      if (req.method() !== 'POST' || !new URL(req.url()).pathname.endsWith('/nodes/n2/decision')) return;
      try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = null; }
    });
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    await ctx.page.locator('input[name="cf-option"][value="允许"]').check();
    await ctx.page.locator('#cf-comment').fill('按 B 做');
    await ctx.page.locator('#cf-ok').click();
    await ctx.page.locator('.id-confirm-card').waitFor({ state: 'detached', timeout: 5000 });
    assert.deepEqual(sent, { decision: 'pass', comment: '允许\n按 B 做' });
    assert.match(await ctx.page.locator('.toast').last().textContent(), /已确认，继续执行/);
    assert.match(await ctx.page.locator('#id-body').innerText(), /第 1 轮/);
    assert.match(await ctx.page.locator('#id-body').innerText(), /t-resume-n2-/);
    assert.match(await ctx.page.locator('#id-body').innerText(), /确认请求/);
    assert.match(await ctx.page.locator('.cv-node[data-node="n2"]').getAttribute('class'), /st-run/);
    assert.match(await ctx.page.locator('.page-header').innerText(), /运行中/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T3(browser) {
  const ctx = await openConfirmRun(browser, confirmRunFixture(RUN_CONFIRM));
  let sent = null;
  try {
    ctx.page.on('request', function (req) {
      if (req.method() !== 'POST' || !new URL(req.url()).pathname.endsWith('/nodes/n2/decision')) return;
      try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = null; }
    });
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    await ctx.page.locator('#cf-no').click();
    await ctx.page.waitForTimeout(120);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /拒绝必须选择选项或填写说明/);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1);

    await ctx.page.locator('input[name="cf-option"][value="拒绝"]').check();
    await ctx.page.locator('#cf-comment').fill('改为软删除');
    await ctx.page.locator('#cf-no').click();
    await ctx.page.locator('.id-confirm-card').waitFor({ state: 'detached', timeout: 5000 });
    assert.deepEqual(sent, { decision: 'reject', comment: '拒绝\n改为软删除' });
    assert.match(await ctx.page.locator('.toast').last().textContent(), /已拒绝，意见已反馈/);
    const body = await ctx.page.locator('body').innerText();
    assert.equal(body.includes('流程回退'), false, '执行中确认的 reject 不触发回退');
    assert.match(await ctx.page.locator('.cv-node[data-node="n2"]').getAttribute('class'), /st-run/);
    assert.match(await ctx.page.locator('.page-header').innerText(), /运行中/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T4(browser) {
  const run = confirmRunFixture(RUN_CONFIRM_TEXT, {
    verdict: { kind: 'confirmation_request', question: '本次改动目标环境？', allowFreeText: true },
    message: ''
  });
  const ctx = await openConfirmRun(browser, run);
  let sent = null;
  try {
    ctx.page.on('request', function (req) {
      if (req.method() !== 'POST' || !new URL(req.url()).pathname.endsWith('/nodes/n2/decision')) return;
      try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = null; }
    });
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    assert.equal(await ctx.page.locator('.id-cf-opt').count(), 0, '无 options 时不渲染单选');
    assert.equal(await ctx.page.locator('#cf-comment').count(), 1);
    await ctx.page.locator('#cf-comment').fill('使用测试环境');
    await ctx.page.locator('#cf-ok').click();
    await ctx.page.locator('.id-confirm-card').waitFor({ state: 'detached', timeout: 5000 });
    assert.deepEqual(sent, { decision: 'pass', comment: '使用测试环境' });
    assert.equal(Object.prototype.hasOwnProperty.call(sent, 'answer'), false, '不得新增 answer 字段');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T5(browser) {
  const ctx = await openRunPage(browser, 'instance-detail', 'id=' + RUN_WAIT);
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    const card = ctx.page.locator('.id-confirm-card');
    const text = await card.innerText();
    assert.match(text, /待人工确认 · 需求分析/);
    assert.match(text, /请确认方案/);
    assert.match(await ctx.page.locator('#cf-ok').innerText(), /批准，继续执行/);
    assert.match(await ctx.page.locator('#cf-no').innerText(), /驳回/);
    await ctx.page.locator('#cf-no').click();
    await ctx.page.waitForTimeout(120);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /驳回必须填写意见/);
    assert.equal(await card.count(), 1);

    await ctx.page.locator('#cf-comment').fill('联调意见');
    await ctx.page.locator('#cf-no').click();
    await ctx.page.waitForTimeout(400);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /已驳回，流程回退/);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 0);
    assert.match(await ctx.page.locator('body').innerText(), /已驳回，流程回退/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T6(browser) {
  const run = confirmRunFixture(RUN_CONFIRM_BAD, {
    verdict: { kind: 'needs_human', reason: '旧数据没有确认问题' },
    message: '旧版确认说明'
  });
  const ctx = await openConfirmRun(browser, run);
  let decisions = 0;
  try {
    ctx.page.on('request', function (req) {
      if (req.method() === 'POST' && new URL(req.url()).pathname.endsWith('/decision')) decisions++;
    });
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    const card = ctx.page.locator('.id-confirm-card');
    assert.equal(await card.count(), 1);
    assert.match(await card.innerText(), /缺少可识别的确认信息/);
    assert.equal(await ctx.page.locator('#cf-ok').count(), 0);
    assert.equal(await ctx.page.locator('#cf-no').count(), 0);
    assert.equal(await ctx.page.locator('#cf-refresh').count(), 1);
    await ctx.page.locator('#cf-refresh').click();
    await ctx.page.waitForTimeout(500);
    assert.equal(decisions, 0, '异常 verdict 不得提交决策');
    assert.equal(await card.count(), 1);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T7(browser) {
  const ctx = await openConfirmRun(browser, confirmRunFixture(RUN_CONFIRM));
  let posts = 0;
  try {
    await ctx.page.route('**/api/v1/runs/*/nodes/*/decision', async function (route) {
      posts++;
      await new Promise(function (resolve) { setTimeout(resolve, 300); });
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'invalid_state', message: '当前状态不允许该操作' } })
      });
    });
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    await ctx.page.locator('#cf-ok').click();
    await ctx.page.waitForTimeout(80);
    assert.equal(await ctx.page.locator('#cf-ok').isDisabled(), true, '提交中按钮应禁用');
    assert.equal(await ctx.page.locator('#cf-no').isDisabled(), true);
    await ctx.page.waitForTimeout(600);
    assert.equal(posts, 1, '409 后不得自动重复提交');
    assert.match(await ctx.page.locator('.toast').last().textContent(), /该确认已被处理或状态已变化，已刷新/);
    assert.equal(await ctx.page.locator('#cf-ok').isDisabled(), false, '失败后恢复按钮供人工重试');
    assert.equal(await ctx.page.locator('#cf-no').isDisabled(), false);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1, '仍在等待时保留确认卡');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0022T8(browser) {
  const ctx = await openConfirmRun(browser, confirmationHistoryRun());
  try {
    await ctx.page.locator('.cv-node[data-node="n2"]').dblclick();
    await ctx.page.waitForTimeout(220);
    assert.equal(await ctx.page.locator('.id-round-tab').count(), 2);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1, '最新轮显示确认卡');
    assert.match(await ctx.page.locator('.id-confirm-card').innerText(), /是否允许修改契约？/);

    await ctx.page.locator('.id-round-tab[data-visit="1"]').click();
    await ctx.page.waitForTimeout(150);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 0, '历史轮不得出现确认入口');
    assert.match(await ctx.page.locator('.id-history-note').innerText(), /历史轮次/);

    await ctx.page.locator('.id-round-tab[data-visit="2"]').click();
    await ctx.page.waitForTimeout(150);
    assert.equal(await ctx.page.locator('.id-confirm-card').count(), 1, '回到最新轮恢复确认卡');
    assert.match(await ctx.page.locator('.id-confirm-card').innerText(), /是否允许修改契约？/);
    noErrors(ctx);
  } finally { await ctx.page.close(); }
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

async function scn0005T6(browser) {
  const list = await open(browser, 'skills', '', { wait: 600 });
  try {
    const first = MOCK.skills[0];
    const slug = first.slug || first.id;
    assert.match(await list.page.locator('#sk-tblbox tbody tr').first().textContent(), new RegExp(slug));
    await list.page.locator('#sk-q').fill('sk-callchain');
    await list.page.waitForTimeout(120);
    assert.equal(await list.page.locator('#sk-tblbox tbody tr').count(), 1, '英文名应参与列表搜索');
  } finally { await list.page.close(); }

  const ctx = await openSkill(browser, 'sk-cres', 'edit');
  try {
    assert.equal(await ctx.page.locator('#sk-slug').inputValue(), 'sk-cres');
    await ctx.page.locator('#sk-slug').fill('CRES Skill');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(150);
    assert.match(await ctx.page.locator('.toast').last().textContent(), /kebab-case/);
    const target = MOCK.skills.find((x) => x.id === 'sk-cres');
    assert.equal(target.slug, undefined);

    await ctx.page.locator('#sk-slug').fill('cres-skill');
    await ctx.page.locator('#sk-save').click();
    await ctx.page.waitForTimeout(300);
    assert.equal(target.slug, 'cres-skill');
    assert.match(await ctx.page.locator('#page-body').textContent(), /cres-skill/);
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

async function scn0005T5(browser) {
  const ctx = await open(browser, 'skills', '', { wait: 600 });
  try {
    const page = ctx.page;
    const more = page.locator('[data-more]');
    assert.ok(await more.count() >= 2, '列表至少两行');
    const firstBtn = await more.nth(0).boundingBox();
    await more.nth(0).click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.menu').count(), 1, '首次点击应弹出菜单');

    // 重复点击同一触发按钮：上一次的 document 关闭监听器不得吃掉新菜单
    await more.nth(0).click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.menu').count(), 1, '再次点击应仍能弹出菜单');
    assert.equal(await page.locator('.menu').isVisible(), true, '菜单应可见');

    // 右侧行菜单右对齐到触发按钮，整体留在内容区
    const menuBox = await page.locator('.menu').boundingBox();
    assert.ok(Math.abs((menuBox.x + menuBox.width) - (firstBtn.x + firstBtn.width)) <= 2,
      '菜单应右对齐触发按钮，实际 ' + Math.round(menuBox.x + menuBox.width) + ' vs ' + Math.round(firstBtn.x + firstBtn.width));

    // 最后一行：菜单向下展开时不得落到视口外
    await more.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
    await more.last().click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.menu').count(), 1, '最后一行应弹出菜单');
    const box = await page.locator('.menu').boundingBox();
    const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    assert.ok(box.x >= 8 && box.y >= 8, '菜单位置越出视口左上（' + box.x + ',' + box.y + '）');
    assert.ok(box.x + box.width <= vp.w - 8, '菜单越出视口右侧（' + (box.x + box.width) + ' > ' + (vp.w - 8) + '）');
    assert.ok(box.y + box.height <= vp.h - 8, '菜单越出视口底部（' + (box.y + box.height) + ' > ' + (vp.h - 8) + '）');
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
    const ex0 = MOCK.experts[0];
    const skillN = ex0.skillCount || (ex0.skills || []).length;
    const cardText = await ctx.page.locator('#ex-grid .item-card').first().textContent();
    assert.match(cardText, new RegExp('Skill ×' + skillN + ' · 引用 \\d+ 处'), '卡片应显示绑定 Skill 数而非工具数');
    assert.ok(!cardText.includes('工具 ×'), '卡片不应再显示工具数');
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
    const row4 = ctx.page.locator('#ws-table tbody tr', { hasText: 'settle-service' }).first();
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


/* SCN-0023：同一份图（保存锚点 + 回退边 + viewport）供编辑器与运行详情跨页对照。 */
const TRACE_WF = '88888888-8888-4888-8888-888888888888';
const TRACE_RUN = 'aaaaaaaa-0000-4000-8000-000000000023';
const TRACE_GRAPH = {
  stages: [{ id: 's1', name: '同源阶段', layout: { x: 20, y: 60, width: 700, height: 460 } }],
  nodes: [
    { id: 'n1', type: 'start', name: '启动', stageId: 's1', expertId: null, layout: { x: 60, y: 120, outSide: 'right' } },
    { id: 'n2', type: 'agent', name: '需求', stageId: 's1', expertId: null, layout: { x: 260, y: 120, inSide: 'left', outSide: 'bottom' } },
    { id: 'n3', type: 'review', name: '方案评审', stageId: 's1', expertId: null, layout: { x: 260, y: 420, inSide: 'top', outSide: 'right' } },
    { id: 'n4', type: 'agent', name: '实现', stageId: 's1', expertId: null, layout: { x: 520, y: 420 } },
    { id: 'n5', type: 'end', name: '收尾', stageId: null, expertId: null, layout: { x: 760, y: 120, inSide: 'left' } }
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' },
    { id: 'e3', from: 'n3', to: 'n4', kind: 'seq' },
    { id: 'e4', from: 'n4', to: 'n5', kind: 'seq' },
    { id: 'r1', from: 'n3', to: 'n2', kind: 'rollback' }
  ],
  viewport: { x: 16, y: 12, zoom: 0.8 }
};
/* 抽出共享几何前的编辑器输出，作为两个画布的基准。 */
const TRACE_GOLDEN = [
  'M 228 149 C 264 149, 224 149, 260 149',
  'M 344 178 C 344 286.9, 344 311.1, 344 420',
  'M 428 449 C 469.4 449, 478.6 449, 520 449',
  'M 604 420 C 604 279.2880868582905, 619.2880868582905 149, 760 149',
  'M 406 478 C 446 598, 304 298, 344 178'
];

function traceSetup() {
  runFixtures();
  addWorkflow({
    id: TRACE_WF,
    name: '轨迹同源夹具',
    type: '研发主流程',
    description: 'SCN-0023 跨页连线对照',
    revision: 3,
    createdAt: new Date(Date.now() - 3000000).toISOString(),
    updatedAt: new Date(Date.now() - 60000).toISOString(),
    graph: structuredClone(TRACE_GRAPH)
  });
}

function traceRun(extra) {
  const iso = (min) => new Date(Date.now() - min * 60000).toISOString();
  return Object.assign({
    runId: TRACE_RUN,
    workflowId: TRACE_WF,
    workflowName: '轨迹同源夹具',
    workflowRevision: 3,
    harnessId: 'h-1',
    harnessName: '本机研发 Harness',
    clientId: 'client-stub-01',
    instanceId: 'bbbbbbbb-0000-4000-8000-000000000023',
    state: 'done',
    outcome: 'succeeded',
    currentNodeId: 'n5',
    archiveState: 'stored',
    createdAt: iso(20), startedAt: iso(20), finishedAt: iso(10),
    workspacePath: '/tmp/fake/ws-trace',
    taskSpacePath: '/tmp/fake/ws-trace/.agent-flow/task/' + TRACE_RUN,
    autoConfirm: false,
    finalMessage: '完成',
    error: null,
    graph: structuredClone(TRACE_GRAPH),
    nodes: TRACE_GRAPH.nodes.map(function (n) {
      return {
        nodeId: n.id, nodeType: n.type, visit: 1, state: 'succeeded', taskId: 't-' + n.id,
        verdict: null, message: '完成', error: null, expertName: null,
        dispatchedAt: iso(20), finishedAt: iso(10)
      };
    })
  }, extra || {});
}

async function tracePaths(page) {
  return page.locator('svg.cv-edges path.e-seq, svg.cv-edges path.e-rb').evaluateAll(function (els) {
    return els.map(function (el) { return el.getAttribute('d'); });
  });
}

async function scn0023T1(browser) {
  const editor = await open(browser, 'workflow-editor', 'id=' + TRACE_WF, {
    b3: fakeB3, setup: traceSetup, wait: 900
  });
  let editorPaths;
  try {
    assert.equal(await editor.page.locator('.cv-node').count(), 5);
    editorPaths = await tracePaths(editor.page);
    assert.equal(editorPaths.length, 5, '编辑器应画出 5 条边');
    noErrors(editor);
  } finally { await editor.page.close(); }

  const ctx = await open(browser, 'instance-detail', 'id=' + TRACE_RUN, {
    b3: fakeB3, setup: function () { runFixtures(); addRunFixture(traceRun()); }, wait: 900
  });
  try {
    const runPaths = await tracePaths(ctx.page);
    assert.deepEqual(runPaths, editorPaths, '运行页与编辑器连线必须逐字一致');
    assert.deepEqual(runPaths, TRACE_GOLDEN, '连线必须等于抽出共享几何前的基准');
    noErrors(ctx);
  } finally { await ctx.page.close(); }
}

async function scn0023T2(browser) {
  const ctx = await open(browser, 'instance-detail', 'id=' + TRACE_RUN, {
    b3: fakeB3, setup: function () { runFixtures(); addRunFixture(traceRun()); }, wait: 900
  });
  const page = ctx.page;
  try {
    assert.equal(await page.locator('path.e-seq[marker-end="url(#arw)"]').count(), 4, '4 条 seq 边带灰箭头');
    assert.equal(await page.locator('path.e-rb[marker-end="url(#arw-rb)"]').count(), 1, '回退边带紫箭头');
    assert.equal(await page.locator('svg.cv-edges marker#arw').count(), 1);
    assert.equal(await page.locator('svg.cv-edges marker#arw-rb').count(), 1);
    assert.equal((await page.locator('text.edge-label').textContent()).trim(), '↺ 回退');
    const dash = await page.locator('path.e-rb').evaluate(function (el) { return getComputedStyle(el).strokeDasharray; });
    assert.match(dash, /6/, '回退边必须是虚线，实际 ' + dash);
    noErrors(ctx);
  } finally { await page.close(); }
}

async function scn0023T3(browser) {
  const editor = await open(browser, 'workflow-editor', 'id=' + TRACE_WF, {
    b3: fakeB3, setup: traceSetup, wait: 900
  });
  let editorWidth = 0;
  try {
    editorWidth = await editor.page.locator('.cv-node[data-node="n1"]').evaluate(function (el) {
      return el.getBoundingClientRect().width;
    });
    assert.ok(Math.abs(editorWidth - 168 * 0.8) <= 1, '编辑器节点宽度应为 168×0.8');
    noErrors(editor);
  } finally { await editor.page.close(); }

  const ctx = await open(browser, 'instance-detail', 'id=' + TRACE_RUN, {
    b3: fakeB3, setup: function () { runFixtures(); addRunFixture(traceRun()); }, wait: 900
  });
  const page = ctx.page;
  try {
    const matrix = await page.locator('#cvScaler').evaluate(function (el) { return getComputedStyle(el).transform; });
    assert.match(matrix, /matrix\(0\.8,\s*0,\s*0,\s*0\.8,\s*16,\s*12\)/, '视口 transform 应为 0.8 + (16,12)，实际 ' + matrix);
    const width = await page.locator('.cv-node[data-node="n1"]').evaluate(function (el) {
      return el.getBoundingClientRect().width;
    });
    assert.ok(Math.abs(width - editorWidth) <= 1, '运行页与编辑器同视口节点宽度一致');
    const gap = await page.evaluate(function () {
      const a = document.querySelector('.cv-node[data-node="n1"]').getBoundingClientRect();
      const b = document.querySelector('.cv-node[data-node="n4"]').getBoundingClientRect();
      return b.left - a.left;
    });
    assert.ok(Math.abs(gap - (520 - 60) * 0.8) <= 1, '节点屏幕距离应按 0.8 缩放，实际 ' + gap);
    noErrors(ctx);
  } finally { await page.close(); }
}

async function scn0023T4(browser) {
  const broken = structuredClone(TRACE_GRAPH);
  broken.viewport = { x: 'bad', y: null, zoom: -1 };
  broken.nodes.forEach(function (n) {
    if (n.id === 'n2') n.layout.inSide = 'sideways';
  });
  const ctx = await open(browser, 'instance-detail', 'id=' + TRACE_RUN, {
    b3: fakeB3,
    setup: function () { runFixtures(); addRunFixture(traceRun({ graph: broken })); },
    wait: 900
  });
  const page = ctx.page;
  try {
    const matrix = await page.locator('#cvScaler').evaluate(function (el) { return getComputedStyle(el).transform; });
    assert.match(matrix, /matrix\(0\.85,\s*0,\s*0,\s*0\.85,\s*0,\s*0\)/, '非法视口应回落 0.85 + (0,0)，实际 ' + matrix);
    const paths = await tracePaths(page);
    assert.equal(paths.length, 5);
    assert.equal(paths.some(function (d) { return d.indexOf('NaN') >= 0; }), false, '非法锚点不得产生 NaN');
    assert.equal(await page.locator('path.e-seq[marker-end="url(#arw)"]').count(), 4);
    assert.equal(await page.locator('text.edge-label').count(), 1);
    assert.equal(await page.locator('.cv-node').count(), 5);
    assert.equal(await page.locator('#page-body .empty').count(), 0, '有图时不得显示无图占位');
    noErrors(ctx);
  } finally { await page.close(); }
}

/* ----------------------------- registry ----------------------------- */
const SCENARIOS = [
  ['SCN-0004', '实例监控与运行控制', [
    ['SCN-0004-T1', '正', '运行列表计数与状态分组一致', scn0004T1],
    ['SCN-0004-T2', '正', '详情节点状态来自 run.nodes', scn0004T2],
    ['SCN-0004-T3', '正', '人工确认后节点推进', scn0004T3],
    ['SCN-0004-T4', '反', '取消终止不改状态', scn0004T4],
    ['SCN-0004-T5', '正', '发起运行按 harness/路径/意图提交', scn0004T5],
    ['SCN-0004-T6', '正', '多轮节点可切最新/历史并保留打回前内容', scn0004T6],
    ['SCN-0004-T7', '正', '工作区路径历史按执行节点保存、可选择与删除，启动成功后置顶并封顶 10 条', scn0004T7],
    ['SCN-0004-T8', '反', '损坏或他节点历史不进入下拉与表单，仍可手输路径', scn0004T8],
    ['SCN-0004-T9', '正', '超时等待运行显示等待态与超时码，续跑后同一 task 回到已派发', scn0004T9],
    ['SCN-0004-T10', '反', '续跑 409 按 reason 提示并保留等待态', scn0004T10],
    ['SCN-0004-T11', '反', '续跑 503 保留按钮且不伪造成功', scn0004T11],
    ['SCN-0004-T12', '正', 'RunDetail.graph 渲染详情且不再回查已删除工作流', scn0004T12],
    ['SCN-0004-T13', '正', '节点专家名优先 expertName，已删除专家不显示裸 UUID', scn0004T13],
    ['SCN-0004-T14', '正', '运行列表与筛选横幅优先 workflowName', scn0004T14],
    ['SCN-0004-T15', '正', '删除弹窗提示未结束运行；删除后历史运行仍可读', scn0004T15],
    ['SCN-0004-T16', '反', '409 references 含 run 时提示有未结束的运行且不删除', scn0004T16]
  ]],
  ['SCN-0022', '执行中确认点（MCP confirmation_request）', [
    ['SCN-0022-T1', '正', '按 verdict.kind 识别执行中确认点并渲染问题/上下文/选项', scn0022T1],
    ['SCN-0022-T2', '正', '确认并继续：comment=选项+补充，visit 不变、taskId 替换', scn0022T2],
    ['SCN-0022-T3', '正', '拒绝并反馈：comment 必填，不回退、不写流程回退', scn0022T3],
    ['SCN-0022-T4', '正', '无选项时只提交自由文本，不生成 answer 字段', scn0022T4],
    ['SCN-0022-T5', '反', 'confirm 节点批准/驳回文案与回退行为不回归', scn0022T5],
    ['SCN-0022-T6', '反', '异常 verdict 只读且不提交', scn0022T6],
    ['SCN-0022-T7', '反', '提交中禁用按钮，409 只提交一次并刷新', scn0022T7],
    ['SCN-0022-T8', '反', '历史轮不出现确认卡，最新轮恢复', scn0022T8]
  ]],
  ['SCN-0023', '运行轨迹图与编辑器画布同源', [
    ['SCN-0023-T1', '正', '同一份图在编辑器与运行详情画出的边路径逐字一致', scn0023T1],
    ['SCN-0023-T2', '正', '运行页 seq 边带箭头、回退边为紫色虚线并带「↺ 回退」标签', scn0023T2],
    ['SCN-0023-T3', '正', '运行页按保存视口缩放/平移，节点宽度与编辑器一致', scn0023T3],
    ['SCN-0023-T4', '反', '视口非法与非法锚点时回落默认视口/自动选边，无 NaN', scn0023T4]
  ]],
  ['SCN-0024', '发起运行的图片初始资料（提交时上传）', [
    ['SCN-0024-T1', '正', '粘贴/拖放/选择入栏，提交前零上传，删除只改本地', scn0024T1],
    ['SCN-0024-T2', '正', '提交时按列表顺序上传并绑定，详情显示缩略图', scn0024T2],
    ['SCN-0024-T3', '正', '无初始资料的运行详情不渲染区块', scn0024T3],
    ['SCN-0024-T4', '反', '第 9 张图片被本地拒绝且已有 8 张不变', scn0024T4],
    ['SCN-0024-T5', '反', '上传失败保留本地图片、重试时重新上传', scn0024T5],
    ['SCN-0024-T6', '反', '启动失败回滚暂存、保留弹窗并可重试', scn0024T6]
  ]],
  ['SCN-0005', 'Skill 维护与渐进披露', [
    ['SCN-0005-T1', '正', '列表计数同源', scn0005T1],
    ['SCN-0005-T2', '正', '查看态渲染正文且无结构化 Tab', scn0005T2],
    ['SCN-0005-T3', '正', '保存走草稿且版本递增', scn0005T3],
    ['SCN-0005-T4', '反', '被引用 Skill 禁止删除', scn0005T4],
    ['SCN-0005-T5', '正', '行菜单可重复打开且不越出视口', scn0005T5],
    ['SCN-0005-T6', '正', 'Skill 英文名展示、搜索与编辑保存', scn0005T6]
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
