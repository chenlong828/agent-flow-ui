#!/usr/bin/env node
/**
 * SCN-0021 运行节点文件与执行会话审查（Playwright WebKit）
 * 用法: node tools/verify-node-observability.js
 *
 * 页面加载真实 ESM；B1 请求交给 tools/fake-b1.js，工作流图来自 tools/fake-b3.js。
 * SSE 用 window.EventSource 替身，便于断言建流/关流与事件注入。
 */
import assert from 'node:assert/strict';
import { startStaticServer, launchBrowser, openPage } from './test-harness.js';
import { MOCK } from '../assets/js/mock-data.js';
import { fakeB3, prepareUuidExperts } from './fake-b3.js';
import { addRunFixture } from './fake-b1.js';

let BASE = '';

const RUN_WAIT = 'aaaaaaaa-0000-4000-8000-000000000002';
const RUN_RUNNING = 'aaaaaaaa-0000-4000-8000-000000000003';
const RUN_ERROR = 'aaaaaaaa-0000-4000-8000-0000000000f1';
const RUN_HISTORY = 'aaaaaaaa-0000-4000-8000-000000000005';
const RUN_MANY = 'aaaaaaaa-0000-4000-8000-000000000007';
const WF = '11111111-1111-4111-8111-111111111111';
const HISTORY_WF = '99999999-9999-4999-8999-999999999999';

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

function historyB3() {
  return {
    handle: async function (method, path, body, headers) {
      if (method === 'GET' && path === '/workflows/' + HISTORY_WF) return { status: 200, body: historyWorkflow() };
      return fakeB3.handle(method, path, body, headers);
    }
  };
}

function iso(min) {
  return new Date(Date.now() - min * 60000).toISOString();
}

function eventSourceStub() {
  window.__ES__ = { instances: [] };
  window.EventSource = function (url) {
    const inst = {
      url: url,
      closed: false,
      listeners: {},
      addEventListener: function (name, fn) {
        (inst.listeners[name] = inst.listeners[name] || []).push(fn);
      },
      emit: function (name, payload) {
        (inst.listeners[name] || []).forEach(function (fn) {
          fn({ data: JSON.stringify(payload) });
        });
      },
      close: function () { inst.closed = true; }
    };
    window.__ES__.instances.push(inst);
    return inst;
  };
}

function fixtures() {
  prepareUuidExperts();
  fakeB3.reset();
  MOCK.harnesses[0].clientId = 'client-stub-01';
}

function errorRun() {
  return {
    runId: RUN_ERROR,
    workflowId: WF,
    workflowRevision: 1,
    harnessId: 'h-1',
    clientId: 'client-stub-01',
    instanceId: 'bbbbbbbb-0000-4000-8000-0000000000f1',
    state: 'waiting_confirm',
    outcome: null,
    currentNodeId: 'n2',
    archiveState: 'none',
    createdAt: iso(5), startedAt: iso(5), finishedAt: null,
    workspacePath: '/tmp/fake/ws-error',
    taskSpacePath: '/tmp/fake/ws-error/.agent-flow/task/' + RUN_ERROR,
    autoConfirm: false, finalMessage: null, error: null,
    filesError: { status: 503, code: 'client_observability_unavailable' },
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-e1', verdict: null, message: '开始', error: null, dispatchedAt: iso(5), finishedAt: iso(4) },
      { nodeId: 'n2', nodeType: 'confirm', visit: 1, state: 'waiting_confirm', taskId: null, verdict: null, message: '请确认方案', error: null, dispatchedAt: null, finishedAt: null }
    ]
  };
}

function historyRun() {
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
    autoConfirm: false, finalMessage: null, error: null,
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-h1', verdict: null, message: '流程启动', error: null, dispatchedAt: iso(20), finishedAt: iso(19) },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-h2', verdict: null, message: '## 初版实现\n\n- 增加接口\n- 缺少幂等', error: null, dispatchedAt: iso(19), finishedAt: iso(17) },
      { nodeId: 'n3', nodeType: 'review', visit: 1, state: 'rejected', taskId: 't-h3', verdict: { decision: 'reject', reason: '缺少幂等处理' }, message: '## 评审不通过\n\n- 缺少幂等处理', error: null, dispatchedAt: iso(17), finishedAt: iso(16) },
      { nodeId: 'n2', nodeType: 'agent', visit: 2, state: 'dispatched', taskId: 't-h4', verdict: null, message: '## 第二轮修订\n\n- 已补充幂等键\n- 等待复审', error: null, dispatchedAt: iso(2), finishedAt: null }
    ]
  };
}

function manyRun() {
  const start = new Date(Date.now() - 217000).toISOString();
  const end = new Date().toISOString();
  return {
    runId: RUN_MANY,
    workflowId: WF,
    workflowRevision: 1,
    harnessId: 'h-1',
    clientId: 'client-stub-01',
    instanceId: 'bbbbbbbb-0000-4000-8000-000000000007',
    state: 'done',
    outcome: 'succeeded',
    currentNodeId: 'n2',
    archiveState: 'stored',
    createdAt: start, startedAt: start, finishedAt: end,
    workspacePath: '/tmp/fake/ws-many',
    taskSpacePath: '/tmp/fake/ws-many/.agent-flow/task/' + RUN_MANY,
    autoConfirm: false, finalMessage: '完成', error: null,
    eventProfile: 'many',
    nodes: [
      { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-m1', verdict: null, message: '开始', error: null, dispatchedAt: start, finishedAt: start },
      { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-m2', verdict: null, message: '完成', error: null, dispatchedAt: start, finishedAt: end },
      { nodeId: 'n3', nodeType: 'end', visit: 1, state: 'queued', taskId: null, verdict: null, message: '', error: null, dispatchedAt: null, finishedAt: null }
    ]
  };
}

function openRun(browser, runId, opts = {}) {
  return openPage(browser, BASE, 'instance-detail', 'id=' + runId, {
    b3: opts.b3 || fakeB3,
    setup: function () {
      fixtures();
      if (opts.fixture) addRunFixture(opts.fixture);
    },
    initScript: eventSourceStub,
    wait: 900
  });
}

function noErrors(ctx) {
  assert.deepEqual(ctx.errors, [], '页面运行错误: ' + ctx.errors.join(' | '));
}

async function openNode(page, nodeId) {
  await page.locator('.cv-node[data-node="' + nodeId + '"]').dblclick();
  await page.waitForSelector('.modal-screen #id-modal-body');
  await page.waitForTimeout(120);
}

async function clickTab(page, tab) {
  await page.locator('.modal-screen #id-tabs .tab[data-t="' + tab + '"]').click();
  await page.waitForTimeout(120);
}

/* T1：页头任务文件 + 节点四 Tab + 文件根切换/Markdown */
async function scn0021T1(browser) {
  const ctx = await openRun(browser, RUN_WAIT);
  const page = ctx.page;
  try {
    await page.locator('#id-files').click();
    await page.waitForSelector('.modal-screen .rf');
    assert.match(await page.locator('.modal-screen .rf-list').innerText(), /intent\.md/);
    await page.locator('#id-files-close').click();
    assert.equal(await page.locator('.modal-screen').count(), 0);

    await openNode(page, 'n1');
    const tabs = await page.locator('.modal-screen #id-tabs .tab').allTextContents();
    assert.deepEqual(tabs, ['概要', '文件', '执行会话', '会话日志']);

    await clickTab(page, 'files');
    await page.waitForSelector('.modal-screen .rf-item');
    await page.locator('.modal-screen .rf-item', { hasText: 'intent.md' }).click();
    await page.waitForSelector('.modal-screen .md-body');
    assert.match(await page.locator('.modal-screen .md-body').innerText(), /启动意图/);

    await page.locator('.modal-screen .rf-root[data-root="workspace"]').click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("README.md")');
    assert.match(await page.locator('.modal-screen .rf-list').innerText(), /README\.md/);
    await page.locator('.modal-screen .rf-root[data-root="task-space"]').click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("intent.md")');
    await page.locator('.modal-screen .rf-item', { hasText: 'src' }).click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("index.ts")');
    await page.locator('.modal-screen .rf-crumb', { hasText: '任务空间' }).click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("intent.md")');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T2：代码/二进制/截断 + 目录懒加载 + 选中文件跨 Tab 保持 */
async function scn0021T2(browser) {
  const ctx = await openRun(browser, RUN_WAIT);
  const page = ctx.page;
  try {
    await openNode(page, 'n1');
    await clickTab(page, 'files');
    await page.waitForSelector('.modal-screen .rf-item');

    await page.locator('.modal-screen .rf-item', { hasText: 'main.ts' }).click();
    await page.waitForSelector('.modal-screen .rf-pre');
    assert.equal((await page.locator('.modal-screen .rf-lang').innerText()).trim(), 'typescript');
    assert.match(await page.locator('.modal-screen .rf-pre').innerText(), /export function hello/);

    await page.locator('.modal-screen .rf-item', { hasText: 'logo.png' }).click();
    await page.waitForSelector('.modal-screen .rf-preview .rf-empty');
    assert.match(await page.locator('.modal-screen .rf-preview').innerText(), /二进制文件/);

    await page.locator('.modal-screen .rf-item', { hasText: 'big.log' }).click();
    await page.waitForSelector('.modal-screen .rf-note');
    assert.match(await page.locator('.modal-screen .rf-preview').innerText(), /已截断/);

    await page.locator('.modal-screen .rf-item', { hasText: 'src' }).click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("index.ts")');
    assert.match(await page.locator('.modal-screen .rf-crumbs').innerText(), /src/);

    await clickTab(page, 'summary');
    await clickTab(page, 'files');
    await page.waitForSelector('.modal-screen .rf-item');
    await page.waitForTimeout(250);
    assert.match(await page.locator('.modal-screen .rf-crumbs').innerText(), /src/, '目录应恢复到 src');
    assert.equal(await page.locator('.modal-screen .rf-item.on').count(), 0, 'src 目录下无选中文件');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T3：会话详情、事件、SSE、raw、无 sessionId */
async function scn0021T3(browser) {
  const ctx = await openRun(browser, RUN_RUNNING);
  const page = ctx.page;
  const requests = [];
  page.on('request', function (req) { requests.push(req.url()); });
  try {
    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs');
    await page.waitForSelector('.modal-screen .rs-ev');

    assert.match(await page.locator('.modal-screen .rs-head').innerText(), /\/tmp\/fake\/ws-history/);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 3);
    assert.match(await page.locator('.modal-screen .rs-live').innerText(), /实时/);

    const streams = await page.evaluate(function () {
      return window.__ES__.instances.map(function (i) { return { url: i.url, closed: i.closed }; });
    });
    assert.equal(streams.length, 1);
    assert.match(streams[0].url, /\/runs\/[^/]+\/nodes\/n2\/session\/events\/stream\?visit=1/);

    /* rich 形状：没有 event/message/data.tool，必须经 normalizeEvent 后进入统计、筛选与合并。 */
    await page.evaluate(function () {
      const now = new Date().toISOString();
      window.__ES__.instances[0].emit('snapshot', {
        events: [
          { seq: 5, ts: now, kind: 'tool_call', toolCallId: 'c1', tool: { name: 'bash', status: 'in_progress', input: { command: 'ls' } } },
          { seq: 6, ts: now, kind: 'tool_result', toolCallId: 'c1', tool: { name: 'bash', status: 'completed', durationMs: 7, output: 'ok' } },
          { seq: 7, ts: now, kind: 'thought', messageId: 'm1', text: 'rich thought' },
          { seq: 8, ts: now, kind: 'usage', usage: { used: 9000, size: 1000000 } }
        ]
      });
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 4, 'rich 工具 start/result 合并后应为 4 行');
    assert.equal(await page.locator('.modal-screen .rs-ev-tool').count(), 1);
    const toolText = await page.locator('.modal-screen .rs-ev-tool').innerText();
    assert.match(toolText, /bash/);
    assert.match(toolText, /completed/);
    assert.match(toolText, /7ms/, '应使用 rich 的 tool.durationMs');
    assert.match(await page.locator('.modal-screen .rs-stats').innerText(), /9,000/, 'rich usage 应进入 Token 统计');

    await page.locator('.modal-screen .rs-filter[data-filter="thought"]').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 5, '活动 + 思考 = 5 行');
    assert.match(await page.locator('.modal-screen .rs-events').innerText(), /rich thought/);

    await page.locator('.modal-screen .rs-filter[data-filter="usage"]').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 6, '再加用量 = 6 行');
    assert.match(await page.locator('.modal-screen .rs-events').innerText(), /9,000 \/ 1,000,000/);

    await page.locator('.modal-screen .rs-filter[data-preset="activity"]').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 4, '回到活动预设');

    await page.evaluate(function () {
      window.__ES__.instances[0].emit('end', { status: 'completed' });
    });
    await page.waitForTimeout(120);
    assert.match(await page.locator('.modal-screen .rs-live').innerText(), /已结束/);
    const closed = await page.evaluate(function () { return window.__ES__.instances[0].closed; });
    assert.equal(closed, true);

    const href = await page.locator('.modal-screen .rs-raw a').getAttribute('href');
    assert.match(href, /\/runs\/[^/]+\/nodes\/n2\/session\/raw\?visit=1/);

    const html = await page.content();
    assert.ok(!/sessionId/.test(html), 'DOM 不应出现 sessionId');
    assert.ok(!/attemptId/.test(html), 'DOM 不应出现 attemptId');
    assert.ok(!requests.some(function (u) { return /sessionId|3100/.test(u); }), '请求不应出现 sessionId 或直连 3100');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T4：轮询/切 Tab/关闭的生命周期；文件状态不被轮询重置 */
async function scn0021T4(browser) {
  const ctx = await openRun(browser, RUN_RUNNING);
  const page = ctx.page;
  try {
    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs-ev');
    assert.equal((await page.evaluate(function () { return window.__ES__.instances.length; })), 1);

    await page.waitForTimeout(5600);
    assert.equal((await page.evaluate(function () { return window.__ES__.instances.length; })), 1, '轮询不应重建 EventSource');

    await clickTab(page, 'summary');
    const closedAfterSwitch = await page.evaluate(function () { return window.__ES__.instances[0].closed; });
    assert.equal(closedAfterSwitch, true, '切走执行会话应关闭 EventSource');

    await clickTab(page, 'files');
    await page.waitForSelector('.modal-screen .rf-item');
    await page.locator('.modal-screen .rf-item', { hasText: 'src' }).click();
    await page.waitForSelector('.modal-screen .rf-item:has-text("index.ts")');
    await page.waitForTimeout(5600);
    assert.match(await page.locator('.modal-screen .rf-crumbs').innerText(), /src/, '轮询不应重置目录');
    assert.equal(await page.locator('.modal-screen .rf-item:has-text("index.ts")').count(), 1);

    await clickTab(page, 'session');
    await page.waitForTimeout(250);
    assert.equal((await page.evaluate(function () { return window.__ES__.instances.length; })), 2, '重新进入应新建 EventSource');

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal-screen').count(), 0);
    const closedAfterClose = await page.evaluate(function () { return window.__ES__.instances[1].closed; });
    assert.equal(closedAfterClose, true, '关闭弹层应关闭 EventSource');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T5：错误路径与隐私 */
async function scn0021T5(browser) {
  const ctx = await openRun(browser, RUN_ERROR, { fixture: errorRun() });
  const page = ctx.page;
  const requests = [];
  page.on('request', function (req) { requests.push(req.url()); });
  try {
    await page.locator('#id-files').click();
    await page.waitForSelector('.modal-screen .rf');
    await page.waitForSelector('.modal-screen .rf-list .rf-empty');
    assert.match(await page.locator('.modal-screen .rf-list .rf-empty').innerText(), /执行节点观测面不可用/);
    assert.equal(await page.locator('.modal-screen .rf-list .rf-empty [data-act="retry"]').count(), 1);
    await page.locator('#id-files-close').click();

    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs');
    assert.match(await page.locator('.modal-screen .rs-empty').innerText(), /未关联会话/);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 0);

    const html = await page.content();
    assert.ok(!/sessionId/.test(html), 'DOM 不应出现 sessionId');
    assert.ok(!requests.some(function (u) { return /sessionId|3100/.test(u); }), '请求不应出现 sessionId 或直连 3100');
    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T7：217 条事件的概览统计、分页、筛选与工具合并 */
async function scn0021T7(browser) {
  const ctx = await openRun(browser, RUN_MANY, { fixture: manyRun() });
  const page = ctx.page;
  try {
    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs-stats');
    await page.waitForSelector('.modal-screen .rs-ev');
    const stats = await page.locator('.modal-screen .rs-stats').innerText();
    assert.match(stats, /217/);
    assert.match(stats, /66/);
    assert.match(stats, /116,257/);
    assert.equal(await page.locator('.modal-screen .rs-ev-tool').count(), 66, '默认活动视图应合并 66 次工具调用');
    assert.match(await page.locator('.modal-screen [data-role="count"]').innerText(), /217/, '应分页载入 217 条事件');

    /* 多选：在活动基础上加「用量」，再叠加「思考」，选中项按时间线合并输出。 */
    await page.locator('.modal-screen .rs-filter[data-filter="usage"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 114, '活动 + 用量：180 条事件、工具合并后 114 行');
    assert.equal(await page.locator('.modal-screen .rs-filter[data-filter="usage"].on').count(), 1);
    assert.equal(await page.locator('.modal-screen .rs-ev-tool').count(), 66, '工具仍合并');

    await page.locator('.modal-screen .rs-filter[data-filter="thought"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 151, '六类全选：217 条事件、工具合并后 151 行');
    assert.equal(await page.locator('.modal-screen .rs-filter[data-preset="all"].on').count(), 1, '六类全选时「全部」应高亮');

    await page.locator('.modal-screen .rs-filter[data-preset="activity"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 72, '回到活动预设');
    assert.equal(await page.locator('.modal-screen .rs-ev-tool').count(), 66);
    assert.equal(await page.locator('.modal-screen .rs-filter[data-filter="usage"].on').count(), 0);

    await page.locator('.modal-screen .rs-filter[data-filter="tool"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 6, '关掉工具后只剩消息/阶段/其他');
    assert.equal(await page.locator('.modal-screen .rs-ev-tool').count(), 0);

    await page.locator('.modal-screen .rs-filter[data-filter="tool"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 72, '重新打开工具回到活动视图');

    await page.locator('.modal-screen .rs-search').fill('bash');
    await page.waitForTimeout(150);
    const rows = await page.locator('.modal-screen .rs-ev').allInnerTexts();
    assert.ok(rows.length > 0, '搜索 bash 应命中工具行');
    assert.ok(rows.every(function (t) { return /bash/.test(t); }), '搜索后所有行都应包含 bash');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T6：轮次切换按 visit 重载执行会话 */
async function scn0021T6(browser) {
  const ctx = await openRun(browser, RUN_HISTORY, { fixture: historyRun(), b3: historyB3() });
  const page = ctx.page;
  try {
    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs-ev');
    assert.match(await page.locator('.modal-screen .rs-title').innerText(), /第 2 轮/);
    let streams = await page.evaluate(function () { return window.__ES__.instances.map(function (i) { return i.url; }); });
    assert.equal(streams.length, 1);
    assert.match(streams[0], /visit=2/);

    await page.locator('.modal-screen .id-round-tab[data-visit="1"]').click();
    await page.waitForTimeout(300);
    assert.match(await page.locator('.modal-screen .rs-title').innerText(), /第 1 轮/);
    const firstClosed = await page.evaluate(function () { return window.__ES__.instances[0].closed; });
    assert.equal(firstClosed, true, '切轮次应关闭旧 EventSource');
    assert.equal((await page.evaluate(function () { return window.__ES__.instances.length; })), 1, '历史轮已结束，不应新建流');
    assert.match(await page.locator('.modal-screen .rs-head').innerText(), /已完成/);

    await page.locator('.modal-screen .id-round-tab[data-visit="2"]').click();
    await page.waitForTimeout(300);
    streams = await page.evaluate(function () { return window.__ES__.instances.map(function (i) { return i.url; }); });
    assert.equal(streams.length, 2);
    assert.match(streams[1], /visit=2/);

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

/* T8：过滤器类别写入 localStorage；刷新保留，非法值回落活动 */
async function scn0021T8(browser) {
  const ctx = await openRun(browser, RUN_MANY, { fixture: manyRun() });
  const page = ctx.page;
  async function openSession() {
    await openNode(page, 'n2');
    await clickTab(page, 'session');
    await page.waitForSelector('.modal-screen .rs-ev');
    await page.waitForTimeout(150);
  }
  try {
    await openSession();
    await page.locator('.modal-screen .rs-filter[data-filter="usage"]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 114);
    const saved = await page.evaluate(function () { return localStorage.getItem('df-run-session-filter'); });
    assert.match(saved, /usage/, '类别集合应写入 localStorage');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cv-node');
    await openSession();
    assert.equal(await page.locator('.modal-screen .rs-filter[data-filter="usage"].on').count(), 1);
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 114, '刷新后保留上次选择');

    await page.evaluate(function () { localStorage.setItem('df-run-session-filter', 'not-json'); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cv-node');
    await openSession();
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 72, '非法 JSON 回落活动');
    assert.equal(await page.locator('.modal-screen .rs-filter[data-preset="activity"].on').count(), 1);

    await page.evaluate(function () {
      localStorage.setItem('df-run-session-filter', JSON.stringify({ v: 1, categories: ['bogus'] }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.cv-node');
    await openSession();
    assert.equal(await page.locator('.modal-screen .rs-ev').count(), 72, '未知类别回落活动');

    noErrors(ctx);
  } finally {
    await page.close();
  }
}

const TESTS = [
  ['SCN-0021-T1', '正', '页头任务文件与节点四 Tab、文件根切换与 Markdown', scn0021T1],
  ['SCN-0021-T2', '正', '代码/二进制/截断、目录懒加载与跨 Tab 保持', scn0021T2],
  ['SCN-0021-T3', '正', '会话详情、事件、SSE 追加/关闭与 raw 链接', scn0021T3],
  ['SCN-0021-T4', '正', '轮询不重置面板；切 Tab/关闭弹层关闭 EventSource', scn0021T4],
  ['SCN-0021-T5', '反', '会话未关联与观测面不可用的错误路径、无 sessionId', scn0021T5],
  ['SCN-0021-T6', '正', '轮次切换按 visit 重载执行会话与流', scn0021T6],
  ['SCN-0021-T7', '正', '217 条事件的多选筛选、概览统计、分页与工具合并', scn0021T7],
  ['SCN-0021-T8', '正', '过滤器偏好 localStorage 持久化与非法值回落', scn0021T8]
];

(async () => {
  const staticServer = await startStaticServer();
  BASE = staticServer.base;
  const browser = await launchBrowser();
  let pass = 0;
  let fail = 0;
  console.log('\nSCN-0021 运行节点文件与执行会话审查');
  for (const [id, kind, label, fn] of TESTS) {
    try {
      await fn(browser);
      pass++;
      console.log(`  ✓ ${id} [${kind}] ${label}`);
    } catch (err) {
      fail++;
      console.log(`  ✗ ${id} [${kind}] ${label}`);
      console.log('    ' + String(err && err.stack || err).split('\n').slice(0, 6).join('\n    '));
    }
  }
  await browser.close();
  await staticServer.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
