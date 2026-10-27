#!/usr/bin/env node
/**
 * M1 十页场景验证（DOM / jsdom）
 * 用法: node tools/verify-m1-scenarios.js [SCN-xxxx]
 * 依赖: npm i --no-save jsdom（见 design/dev-environment.md）
 *
 * 每个场景 3 正 1 反；断言业务数据、DOM 结构或状态迁移，不断言纯存在性。
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('assert/strict');
let jsdom;
try { jsdom = require('jsdom'); } catch (e) {
  console.error('缺少 jsdom：请先执行 `npm_config_cache=/tmp/agentflow-npm-cache npm install --no-save --package-lock=false jsdom`（见 docs/design/dev-environment.md）。');
  process.exit(1);
}
const { JSDOM, VirtualConsole } = jsdom;

const ROOT = path.join(__dirname, '..');
const IGNORE = /Could not load img|not implemented|Not implemented|navigation \(except hash changes\)/i;
let BASE_URL = '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      } catch (e) {
        res.writeHead(400); res.end('bad url'); return;
      }
      const target = path.resolve(ROOT, '.' + pathname);
      if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      fs.readFile(target, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      BASE_URL = 'http://127.0.0.1:' + server.address().port;
      resolve(server);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function event(win, type, init) {
  return new win.MouseEvent(type, Object.assign({
    bubbles: true,
    cancelable: true,
    view: win,
    clientX: 10,
    clientY: 10
  }, init || {}));
}

function q(root, selector) {
  const el = root.querySelector(selector);
  assert.ok(el, '找不到元素: ' + selector);
  return el;
}

function click(el) {
  assert.ok(el, 'click 目标为空');
  el.dispatchEvent(event(el.ownerDocument.defaultView, 'click'));
}

function mouseDown(el) {
  el.dispatchEvent(event(el.ownerDocument.defaultView, 'mousedown'));
}

function setValue(el, value) {
  el.value = value;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('change', { bubbles: true }));
}

function setChecked(el, checked) {
  el.checked = checked;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('change', { bubbles: true }));
}

async function load(page, query) {
  const file = path.join(ROOT, 'pages', page);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = (e && e.message) || String(e);
    if (!IGNORE.test(msg)) errors.push(msg);
  });
  vc.on('error', (...args) => errors.push('console.error: ' + args.map(String).join(' ')));
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: BASE_URL + '/pages/' + encodeURIComponent(page) + (query ? '?' + query : ''),
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.eval(fs.readFileSync(path.join(ROOT, 'tools/fake-b1.js'), 'utf8'));
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
    }
  });
  await wait(450);
  return {
    dom,
    win: dom.window,
    doc: dom.window.document,
    errors,
    close() { dom.window.close(); }
  };
}

function assertNoPageErrors(ctx) {
  assert.deepEqual(ctx.errors, [], '页面运行错误: ' + ctx.errors.join(' | '));
}

async function openSkillDetail(id, mode) {
  const qs = [];
  if (id) qs.push('id=' + encodeURIComponent(id));
  if (mode) qs.push('mode=' + encodeURIComponent(mode));
  return load('skill-detail.html', qs.join('&'));
}

function stubMarkdownRenderer(ctx, html) {
  const calls = [];
  ctx.win.SKILL_MD.render = function (target, text) {
    calls.push({ target, text });
    target.innerHTML = html || '<div class="sk-md-stub">rendered</div>';
    return Promise.resolve();
  };
  return calls;
}

async function openDocumentTab(ctx) {
  click(q(ctx.doc, '[data-tab="document"]'));
  await wait(80);
}

/* ------------------------------------------------------------------ */
/* SCN-0002 工作流列表浏览与生命周期入口                              */
/* ------------------------------------------------------------------ */
async function scn0002T1() {
  const ctx = await load('workflow-list.html');
  try {
    const n = ctx.win.MOCK.workflows.length;
    assert.equal(ctx.doc.querySelectorAll('#wl-list .wl-card').length, n);
    assert.match(ctx.doc.querySelector('.stat-row').textContent, new RegExp('共\\s*' + n));
    assert.ok(q(ctx.doc, '[data-view="card"]').classList.contains('on'), '默认视图不是卡片');
    assert.ok(ctx.doc.querySelectorAll('#wl-list table tbody tr').length === 0);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0002T2() {
  const ctx = await load('workflow-list.html');
  try {
    const target = ctx.win.MOCK.workflows.filter((w) => w.type === '专项子流程').length;
    click([...ctx.doc.querySelectorAll('.tab[data-tab]')].find((x) => x.dataset.tab === '专项子流程'));
    assert.equal(ctx.doc.querySelectorAll('#wl-list .wl-card').length, target);

    setValue(q(ctx.doc, '#wl-search'), '不存在的流程名');
    assert.equal(ctx.doc.querySelectorAll('#wl-list .wl-card').length, 0);
    assert.match(q(ctx.doc, '#wl-list').textContent, /未找到名称包含/);
    setValue(q(ctx.doc, '#wl-search'), '需求');
    assert.equal(ctx.doc.querySelectorAll('#wl-list .wl-card').length, 1);
    assert.match(q(ctx.doc, '#wl-list').textContent, /需求分析子流程/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0002T3() {
  const ctx = await load('workflow-list.html');
  try {
    const before = ctx.win.MOCK.workflows.length;
    click(q(ctx.doc, '#btn-new'));
    await wait(30);
    setValue(q(ctx.doc, '#wl-nf-name'), '自动化回归流程');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(50);
    assert.equal(ctx.win.MOCK.workflows.length, before + 1);
    const created = ctx.win.MOCK.workflows.find((w) => w.name === '自动化回归流程');
    assert.ok(created, '未写入新建工作流');
    assert.equal(created.published, false);

    const wf = ctx.win.MOCK.workflows.find((w) => w.id === 'w1');
    click(q(ctx.doc, '[data-act="more"][data-id="' + wf.id + '"]'));
    await wait(20);
    click([...ctx.doc.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('复制')));
    await wait(30);
    assert.equal(ctx.win.MOCK.workflows.length, before + 2);
    assert.ok(ctx.win.MOCK.workflows.some((w) => w.name === wf.name + ' 副本' && w.published === false));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0002T4() {
  const ctx = await load('workflow-list.html');
  try {
    const before = ctx.win.MOCK.workflows.length;
    const wf = ctx.win.MOCK.workflows.find((w) => w.id === 'w1');
    const refs = ctx.win.MOCK.instances.filter((i) => i.wfId === 'w1').length;
    click(q(ctx.doc, '[data-act="more"][data-id="' + wf.id + '"]'));
    await wait(20);
    const del = [...ctx.doc.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('删除'));
    assert.ok(del, '更多菜单缺删除');
    click(del);
    await wait(20);
    assert.match(q(ctx.doc, '.modal').textContent, new RegExp(refs + '\\s*个实例引用'));
    click(q(ctx.doc, '#mc-no'));
    await wait(20);
    assert.equal(ctx.win.MOCK.workflows.length, before);
    assert.ok(ctx.win.MOCK.workflows.some((w) => w.id === 'w1'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0003 工作流画布编辑与校验                                      */
/* ------------------------------------------------------------------ */
async function scn0003T1() {
  const ctx = await load('workflow-editor.html', 'id=missing-workflow');
  try {
    const wf = ctx.win.MOCK.workflows[0];
    assert.equal(q(ctx.doc, '#we-name').value, wf.name, '未知 id 未回落首条');
    assert.equal(ctx.doc.querySelectorAll('.cv-node').length, wf.graph.nodes.length);
    assert.equal(ctx.doc.querySelectorAll('#cvCanvas svg.cv-edges path.hit').length, wf.graph.edges.length);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0003T2() {
  const ctx = await load('workflow-editor.html', 'id=w1');
  try {
    const wf = ctx.win.MOCK.workflows.find((w) => w.id === 'w1');
    const node = wf.graph.nodes.find((n) => n.id === 'n2');
    const el = ctx.doc.querySelector('.cv-node[data-node="n2"]');
    assert.ok(el, '缺 n2 节点');
    mouseDown(el);
    await wait(30);
    assert.equal(q(ctx.doc, '#if-name').value, node.name);
    assert.equal(q(ctx.doc, '#if-expert').value, node.expertId);
    const ex = ctx.win.MOCK.experts.find((x) => x.id === node.expertId);
    assert.ok(q(ctx.doc, '#we-inspector').textContent.includes(ex.role), '缺专家角色提示');
    setValue(q(ctx.doc, '#if-name'), '需求获取-回归');
    await wait(30);
    assert.match(q(ctx.doc, '.cv-node[data-node="n2"] .n-head').textContent, /需求获取-回归/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0003T3() {
  const ctx = await load('workflow-editor.html', 'id=w1');
  try {
    const wf = ctx.win.MOCK.workflows.find((w) => w.id === 'w1');
    click(q(ctx.doc, '#we-validate'));
    await wait(30);
    assert.match(q(ctx.doc, '.modal').textContent, /校验通过|可以发布/);
    click(q(ctx.doc, '#we-tab button[data-t="dsl"]'));
    await wait(20);
    const code = q(ctx.doc, '.code-block').textContent;
    assert.match(code, /"id": "w1"/);
    assert.match(code, /"nodes"/);
    assert.match(code, /"edges"/);
    assert.match(code, new RegExp(wf.name));
    assert.equal((code.match(/"from":/g) || []).length, wf.graph.edges.length);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0003T4() {
  const ctx = await load('workflow-editor.html', 'id=w1');
  try {
    const wf = ctx.win.MOCK.workflows.find((w) => w.id === 'w1');
    const beforeVer = wf.ver;
    mouseDown(ctx.doc.querySelector('.cv-node[data-node="n4"]'));
    await wait(30);
    setValue(q(ctx.doc, '#if-rb'), '');
    await wait(20);
    click(q(ctx.doc, '#we-validate'));
    await wait(30);
    assert.match(q(ctx.doc, '.modal').textContent, /未设置回退目标/);
    assert.ok(ctx.doc.querySelector('.modal .pitfall'));

    ctx.win.DF.modal.close();
    await wait(20);
    mouseDown(ctx.doc.querySelector('.cv-node[data-node="n2"]'));
    await wait(30);
    setValue(q(ctx.doc, '#if-expert'), '');
    await wait(20);
    click(q(ctx.doc, '#we-validate'));
    await wait(30);
    assert.match(q(ctx.doc, '.modal').textContent, /未绑定专家/);

    ctx.win.DF.modal.close();
    await wait(20);
    click(q(ctx.doc, '#we-publish'));
    await wait(30);
    assert.match(ctx.doc.body.textContent, /校验错误，无法发布/);
    assert.equal(wf.ver, beforeVer);
    assert.equal(wf.published, true);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0004 实例监控与运行控制                                        */
/* ------------------------------------------------------------------ */
async function scn0004T1() {
  const ctx = await load('instances.html');
  try {
    const M = ctx.win.MOCK.instances;
    const ended = M.filter((i) => ['成功', '失败', '已终止'].includes(i.status)).length;
    const counts = {
      '全部': M.length,
      '运行中': M.filter((i) => i.status === '运行中').length,
      '等待人工确认': M.filter((i) => i.status === '等待人工确认').length,
      '回退重跑中': M.filter((i) => i.status === '回退重跑中').length,
      '已暂停': M.filter((i) => i.status === '已暂停').length,
      '已结束': ended
    };
    assert.equal(ctx.doc.querySelectorAll('#page-body tbody tr').length, M.length);
    assert.equal(ctx.doc.querySelectorAll('#in-tabs .tab').length, 6);
    for (const tab of ctx.doc.querySelectorAll('#in-tabs .tab')) {
      const label = tab.textContent.trim();
      assert.equal(label, tab.dataset.t === '全部' ? '全部' : tab.dataset.t + counts[tab.dataset.t], 'Tab 计数不符: ' + tab.dataset.t);
    }
    assert.equal(ended, M.filter((i) => i.status === '成功').length + M.filter((i) => i.status === '失败').length + M.filter((i) => i.status === '已终止').length);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0004T2() {
  const ctx = await load('instance-detail.html', 'id=INS-2041');
  try {
    assert.match(ctx.doc.body.textContent, /INS-2041/);
    const inst = ctx.win.MOCK.instances.find((i) => i.id === 'INS-2041');
    const wf = ctx.win.MOCK.workflows.find((w) => w.id === inst.wfId);
    assert.equal(ctx.doc.querySelectorAll('.cv-node').length, wf.graph.nodes.length);
    assert.equal(ctx.doc.querySelectorAll('.cv-node.st-ok').length, Object.values(inst.nodes).filter((n) => n.status === 'ok').length);
    assert.equal(ctx.doc.querySelectorAll('.cv-node.st-run').length, Object.values(inst.nodes).filter((n) => n.status === 'running').length);
    assert.ok(ctx.doc.querySelector('#id-pause'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0004T3() {
  const ctx = await load('instance-detail.html', 'id=INS-2041');
  let c2;
  try {
    const inst = ctx.win.MOCK.instances.find((i) => i.id === 'INS-2041');
    assert.equal(inst.status, '运行中');
    click(q(ctx.doc, '#id-pause'));
    await wait(20);
    click(q(ctx.doc, '#mc-ok'));
    await wait(80);
    assert.equal(inst.status, '已暂停');
    assert.ok(ctx.doc.querySelector('#id-resume'));
    click(q(ctx.doc, '#id-resume'));
    await wait(40);
    assert.equal(inst.status, '运行中');
    assertNoPageErrors(ctx);

    c2 = await load('instance-detail.html', 'id=INS-2038');
    const waiting = c2.win.MOCK.instances.find((i) => i.id === 'INS-2038');
    assert.equal(waiting.status, '等待人工确认');
    const waitNodeId = Object.keys(waiting.nodes).find((k) => waiting.nodes[k].status === 'wait');
    assert.ok(waitNodeId, '夹具缺等待节点');
    click(q(c2.doc, '#cf-ok'));
    await wait(50);
    assert.equal(waiting.status, '运行中');
    assert.equal(waiting.nodes[waitNodeId].status, 'ok');
    assertNoPageErrors(c2);
  } finally {
    if (c2) c2.close();
    ctx.close();
  }
}

async function scn0004T4() {
  const ctx = await load('instance-detail.html', 'id=INS-2041');
  let c2, c3;
  try {
    const running = ctx.win.MOCK.instances.find((i) => i.id === 'INS-2041');
    assert.equal(running.status, '运行中');
    click(q(ctx.doc, '#id-stop'));
    await wait(20);
    click(q(ctx.doc, '#mc-no'));
    await wait(30);
    assert.equal(running.status, '运行中', '取消终止不应改状态');
    assertNoPageErrors(ctx);

    c2 = await load('instance-detail.html', 'id=INS-2038');
    const waiting = c2.win.MOCK.instances.find((i) => i.id === 'INS-2038');
    click(q(c2.doc, '#cf-no'));
    await wait(30);
    assert.match(c2.doc.body.textContent, /驳回必须填写意见/);
    assert.equal(waiting.status, '等待人工确认');
    assertNoPageErrors(c2);

    c3 = await load('instance-detail.html', 'id=INS-2019');
    const term = c3.win.MOCK.instances.find((i) => i.id === 'INS-2019');
    assert.equal(term.status, '已终止');
    assert.equal(c3.doc.querySelector('#id-resume'), null);
    assert.equal(c3.doc.querySelector('#id-pause'), null);
    assert.equal(c3.doc.querySelector('#id-stop'), null);
    assertNoPageErrors(c3);
  } finally {
    if (c3) c3.close();
    if (c2) c2.close();
    ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* SCN-0005 Skill 维护与渐进披露                                      */
/* ------------------------------------------------------------------ */
async function scn0005T1() {
  const ctx = await load('skills.html');
  try {
    assert.equal(ctx.doc.querySelectorAll('#sk-tblbox tbody tr').length, ctx.win.MOCK.skills.length);
    assert.match(q(ctx.doc, '#sk-count').textContent, new RegExp('共\\s*' + ctx.win.MOCK.skills.length));
    const cat = 'retrieval';
    const target = ctx.win.MOCK.skills.filter((x) => x.category === '检索').length;
    click(q(ctx.doc, '[data-cat="' + cat + '"]'));
    assert.equal(ctx.doc.querySelectorAll('#sk-tblbox tbody tr').length, target);
    assert.match(q(ctx.doc, '#sk-count').textContent, new RegExp('共\\s*' + target));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0005T2() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    const details = ctx.doc.querySelectorAll('#sk-viewbox details');
    assert.equal(details.length, 5);
    assert.equal(details[0].open, true);
    assert.equal(details[1].open, false);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0005T3() {
  const ctx = await openSkillDetail('sk-cres', 'edit');
  try {
    const target = ctx.win.MOCK.skills.find((x) => x.id === 'sk-cres');
    const beforeVer = target.version;
    setValue(q(ctx.doc, '#sk-desc'), '更新后的 Skill 描述');
    click(q(ctx.doc, '#sk-save'));
    await wait(60);
    assert.notEqual(target.version, beforeVer, '保存未递增版本');
    assert.equal(target.description, '更新后的 Skill 描述');
    assert.equal(target.summary, undefined, '仍写入旧字段 summary');
    assert.equal(target.triggers, undefined, '仍写入旧字段 triggers');
    assert.ok(q(ctx.doc, '[data-tab="structured"]'), '保存后未回到查看态');
    assert.equal(ctx.doc.querySelector('#sk-save'), null, '保存后仍显示保存按钮');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0005T4() {
  const ctx = await load('skills.html');
  try {
    const before = ctx.win.MOCK.skills.length;
    const id = ctx.win.MOCK.skills.find((s) => s.usedBy > 0).id;
    click(q(ctx.doc, '[data-more="' + id + '"]'));
    await wait(20);
    const del = [...ctx.doc.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('删除'));
    assert.ok(del, '菜单缺删除');
    click(del);
    await wait(30);
    click(q(ctx.doc, '#mc-ok'));
    await wait(60);
    assert.equal(ctx.win.MOCK.skills.length, before);
    assert.match(ctx.doc.body.textContent, /禁止删除/);
    assert.match(ctx.doc.body.textContent, new RegExp('被\\s*' + ctx.win.MOCK.skills.find((s) => s.id === id).usedBy + '\\s*位专家引用'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0013 Skill 契约 v2 展示端适配（description + API-31 全文）      */
/* ------------------------------------------------------------------ */
function spyTransport(ctx) {
  const calls = [];
  const orig = ctx.win.__AGENTFLOW_TRANSPORT__;
  ctx.win.__AGENTFLOW_TRANSPORT__ = function (method, path, body, headers) {
    if (String(path).indexOf('/document') >= 0) {
      calls.push({ method, path, headers: headers || {} });
    }
    return orig(method, path, body, headers);
  };
  return calls;
}

async function openDocument(ctx, id) {
  click(q(ctx.doc, '[data-view="' + id + '"]'));
  await wait(50);
  click(q(ctx.doc, '[data-skview="document"]'));
  await wait(80);
}

async function scn0013T1() {
  const ctx = await load('skills.html');
  try {
    const head = q(ctx.doc, '#sk-tblbox thead').textContent;
    assert.ok(head.includes('描述'), '列表缺描述列');
    assert.ok(!head.includes('常驻摘要') && !head.includes('触发'), '列表仍显示旧列');
    const first = ctx.win.MOCK.skills.find((s) => s.id === 'sk-cres');
    assert.ok(q(ctx.doc, '#sk-tblbox tbody').textContent.includes(first.description), '列表未读 description');
    setValue(q(ctx.doc, '#sk-q'), '方案');
    await wait(20);
    const rows = ctx.doc.querySelectorAll('#sk-tblbox tbody tr');
    assert.equal(rows.length, 1, '描述检索未命中唯一 Skill');
    assert.match(rows[0].textContent, /CRES 技能/);
    assert.match(q(ctx.doc, '#sk-count').textContent, /共\s*1/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0013T2() {
  const ctx = await openSkillDetail(null, 'new');
  try {
    const before = ctx.win.MOCK.skills.length;
    setValue(q(ctx.doc, '#sk-name'), '边界 Skill');
    setValue(q(ctx.doc, '#sk-cat'), 'coding');
    click(q(ctx.doc, '#sk-save'));
    await wait(30);
    assert.match(ctx.doc.querySelector('#toast-box').textContent, /请填写 Skill 描述/);
    setValue(q(ctx.doc, '#sk-desc'), '字'.repeat(401));
    click(q(ctx.doc, '#sk-save'));
    await wait(30);
    assert.match(ctx.doc.querySelector('#toast-box').textContent, /1–400/);
    assert.equal(ctx.win.MOCK.skills.length, before, '非法描述写入了 Skill');

    setValue(q(ctx.doc, '#sk-desc'), '适用：边界描述场景；触发：边界；不适用：无。');
    click(q(ctx.doc, '#sk-save'));
    await wait(80);
    const created = ctx.win.MOCK.skills.find((s) => s.name === '边界 Skill');
    assert.ok(created, '合法描述未创建');
    assert.equal(created.description, '适用：边界描述场景；触发：边界；不适用：无。');
    assert.equal(created.summary, undefined);
    assert.equal(created.triggers, undefined);
    assert.equal(created.version, 'v1.0');
    assert.ok(q(ctx.doc, '#sk-save'), '创建成功后未进入编辑态');

    setValue(q(ctx.doc, '#sk-desc'), '更新后的 description');
    click(q(ctx.doc, '#sk-save'));
    await wait(60);
    assert.equal(created.description, '更新后的 description');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0013T3() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    const calls = stubMarkdownRenderer(ctx);
    await openDocumentTab(ctx);
    assert.equal(calls.length, 1, '首次全文请求次数不为 1');
    assert.equal(calls[0].text.startsWith('---\nname: "CRES 技能"'), true, '全文缺 frontmatter');
    assert.equal(ctx.doc.querySelector('#sk-doc-text'), null, '文档仍走 <pre> 原文视图');
    assert.ok(ctx.doc.querySelector('.sk-md-stub'), '渲染器未写入文档容器');
    assert.match(q(ctx.doc, '.skd-docmeta').textContent, /200/);

    click(q(ctx.doc, '[data-tab="structured"]'));
    await wait(20);
    await openDocumentTab(ctx);
    assert.equal(calls.length, 2, '二次全文请求未发出');
    assert.equal(ctx.doc.querySelector('#sk-doc-text'), null, '304 后文档仍走 <pre> 原文视图');
    assert.ok(ctx.doc.querySelector('.sk-md-stub'), '304 后渲染器未写入文档容器');
    assert.match(q(ctx.doc, '.skd-docmeta').textContent, /304/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0013T4() {
  const ctx1 = await openSkillDetail('sk-replay');
  try {
    const calls1 = stubMarkdownRenderer(ctx1);
    await openDocumentTab(ctx1);
    assert.ok(calls1[0].text.includes('## 参考资料'), '有引用时缺参考资料节');
    assert.ok(!calls1[0].text.includes('## 常见踩坑'), '空踩坑仍输出章节');
    assert.ok(calls1[0].text.includes('回放数据清洗'), '停用技能文档未渲染');
    assertNoPageErrors(ctx1);
  } finally { ctx1.close(); }

  const ctx2 = await openSkillDetail('sk-dsl');
  try {
    const calls2 = stubMarkdownRenderer(ctx2);
    await openDocumentTab(ctx2);
    assert.ok(calls2[0].text.includes('## 常见踩坑'), '有踩坑时缺常见踩坑节');
    assert.ok(!calls2[0].text.includes('## 参考资料'), '空引用仍输出章节');
    assertNoPageErrors(ctx2);
  } finally { ctx2.close(); }
}

async function scn0013T5() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    stubMarkdownRenderer(ctx);
    const orig = ctx.win.__AGENTFLOW_TRANSPORT__;
    ctx.win.__AGENTFLOW_TRANSPORT__ = function (method, path, body, headers) {
      if (method === 'GET' && String(path) === '/skills/sk-cres/document') {
        return Promise.resolve({ status: 404, body: { error: { code: 'not_found', message: '目标不存在' } } });
      }
      return orig(method, path, body, headers);
    };
    await openDocumentTab(ctx);
    assert.equal(ctx.doc.querySelector('#sk-doc-text'), null, '404 仍显示全文');
    assert.match(q(ctx.doc, '#sk-viewbox').textContent, /目标不存在或已被删除/);
    assert.ok(ctx.doc.querySelector('#sk-doc-retry'), '404 缺重试入口');
    ctx.win.__AGENTFLOW_TRANSPORT__ = orig;
    click(q(ctx.doc, '#sk-doc-retry'));
    await wait(80);
    assert.ok(q(ctx.doc, '.sk-md-stub'), '重试未取到全文');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0013T6() {
  const ctx = await openSkillDetail('sk-cres', 'edit');
  try {
    const orig = ctx.win.__AGENTFLOW_TRANSPORT__;
    ctx.win.__AGENTFLOW_TRANSPORT__ = function (method, path, body, headers) {
      if (method === 'PUT' && String(path) === '/skills/sk-cres') {
        return Promise.resolve({ status: 400, body: { error: { code: 'validation_error', message: '请求体包含未知字段', details: { field: 'body' } } } });
      }
      return orig(method, path, body, headers);
    };
    setValue(q(ctx.doc, '#sk-desc'), '旧契约提交');
    click(q(ctx.doc, '#sk-save'));
    await wait(40);
    assert.match(ctx.doc.querySelector('#toast-box').textContent, /契约已升级，请刷新页面/);
    assert.ok(q(ctx.doc, '#sk-save').disabled === false, '失败后保存按钮未恢复');
    ctx.win.__AGENTFLOW_TRANSPORT__ = orig;
    click(q(ctx.doc, '#sk-save'));
    await wait(50);
    assert.equal(ctx.win.MOCK.skills.find((s) => s.id === 'sk-cres').description, '旧契约提交');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0014 Skill 专门页面查看与编辑                                  */
/* ------------------------------------------------------------------ */
async function scn0014T1() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    assert.ok(q(ctx.doc, '#sk-tab'), '专门页面缺结构化/文档 Tab');
    assert.equal(ctx.doc.querySelectorAll('#sk-viewbox details').length, 5, '结构化五章缺失');
    assert.equal(ctx.doc.querySelector('.drawer'), null, '不应再出现详情抽屉');
    assert.match(q(ctx.doc, '#sk-viewbox').textContent, /CRES 技能/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0014T2() {
  const ctx = await openSkillDetail('sk-cres', 'edit');
  try {
    const target = ctx.win.MOCK.skills.find((s) => s.id === 'sk-cres');
    const beforeVer = target.version;
    setValue(q(ctx.doc, '#sk-desc'), '专门页编辑后的描述');
    click(q(ctx.doc, '#sk-save'));
    await wait(60);
    assert.notEqual(target.version, beforeVer, '保存未递增版本');
    assert.equal(target.description, '专门页编辑后的描述');
    assert.ok(q(ctx.doc, '[data-tab="structured"]'), '保存后未回到查看态');
    assert.equal(ctx.doc.querySelector('#sk-save'), null, '保存后仍显示保存按钮');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0014T3() {
  const ctx = await openSkillDetail(null, 'new');
  try {
    setValue(q(ctx.doc, '#sk-name'), '专门页新建 Skill');
    setValue(q(ctx.doc, '#sk-cat'), 'coding');
    setValue(q(ctx.doc, '#sk-desc'), '适用：专门页新建场景；触发：专门页；不适用：无。');
    click(q(ctx.doc, '#sk-save'));
    await wait(80);
    const created = ctx.win.MOCK.skills.find((s) => s.name === '专门页新建 Skill');
    assert.ok(created, '未写入新 Skill');
    assert.equal(created.version, 'v1.0');
    assert.ok(q(ctx.doc, '#sk-save'), '创建成功后未进入编辑态');
    assert.match(q(ctx.doc, '.page-header').textContent, /专门页新建 Skill/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0014T4() {
  const ctx1 = await openSkillDetail(null);
  try {
    assert.match(q(ctx1.doc, '#page-body').textContent, /缺少 Skill id/);
    assertNoPageErrors(ctx1);
  } finally { ctx1.close(); }

  const ctx2 = await openSkillDetail('sk-not-exist');
  try {
    assert.match(q(ctx2.doc, '#page-body').textContent, /目标不存在或已被删除/);
    assertNoPageErrors(ctx2);
  } finally { ctx2.close(); }
}

async function scn0014T5() {
  const ctx = await openSkillDetail('sk-cres', 'edit');
  try {
    const calls = stubMarkdownRenderer(ctx);
    setValue(q(ctx.doc, '#sk-desc'), '预览草稿描述');
    click(q(ctx.doc, '[data-tab="preview"]'));
    await wait(20);
    assert.ok(ctx.doc.querySelector('.sk-md-stub'), '预览未渲染 Markdown');
    assert.ok(calls[0].text.includes('预览草稿描述'), '预览未使用最新草稿');
    assert.match(q(ctx.doc, '.skd-docmeta').textContent, /草稿预览/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0015 Milkdown 渲染 Skill 文档                                  */
/* ------------------------------------------------------------------ */
async function scn0015T1() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    const calls = stubMarkdownRenderer(ctx, '<div class="sk-md-body"><h2>流程总述</h2></div>');
    await openDocumentTab(ctx);
    assert.equal(ctx.doc.querySelector('#sk-doc-text'), null, '文档仍走 <pre> 原文视图');
    assert.ok(ctx.doc.querySelector('.sk-md-body'), '渲染器未写入文档容器');
    assert.ok(calls[0].text.includes('## 流程总述'), '渲染器未收到 Markdown 原文');
    assert.match(q(ctx.doc, '.skd-docmeta').textContent, /200/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0015T2() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    const calls = stubMarkdownRenderer(ctx);
    const api = spyTransport(ctx);
    await openDocumentTab(ctx);
    const firstText = calls[0].text;
    click(q(ctx.doc, '[data-tab="structured"]'));
    await wait(20);
    await openDocumentTab(ctx);
    assert.equal(api.length, 2, '二次进入文档 Tab 未重新请求');
    assert.match(api[1].headers['If-None-Match'], /^"\d+"$/, '二次请求未带 If-None-Match');
    assert.equal(calls[1].text, firstText, '304 后渲染文本与首次不一致');
    assert.match(q(ctx.doc, '.skd-docmeta').textContent, /304/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0015T3() {
  const ctx = await openSkillDetail('sk-replay');
  try {
    const calls = stubMarkdownRenderer(ctx);
    await openDocumentTab(ctx);
    assert.ok(calls[0].text.includes('回放数据清洗'), '停用 Skill 文档未渲染');
    assert.ok(ctx.doc.querySelector('.sk-md-stub'), '停用 Skill 渲染器未写入容器');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0015T4() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    stubMarkdownRenderer(ctx);
    const orig = ctx.win.__AGENTFLOW_TRANSPORT__;
    ctx.win.__AGENTFLOW_TRANSPORT__ = function (method, path, body, headers) {
      if (method === 'GET' && String(path) === '/skills/sk-cres/document') {
        return Promise.resolve({ status: 404, body: { error: { code: 'not_found', message: '目标不存在' } } });
      }
      return orig(method, path, body, headers);
    };
    await openDocumentTab(ctx);
    assert.equal(ctx.doc.querySelector('#sk-doc-text'), null, '404 仍显示全文');
    assert.match(q(ctx.doc, '#sk-viewbox').textContent, /目标不存在或已被删除/);
    assert.ok(ctx.doc.querySelector('#sk-doc-retry'), '404 缺重试入口');
    ctx.win.__AGENTFLOW_TRANSPORT__ = orig;
    click(q(ctx.doc, '#sk-doc-retry'));
    await wait(80);
    assert.ok(q(ctx.doc, '.sk-md-stub'), '重试后渲染器未写入容器');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0015T5() {
  const ctx = await openSkillDetail('sk-cres');
  try {
    const calls = stubMarkdownRenderer(ctx, '<div class="sk-md-body"><p>ok</p></div>');
    await openDocumentTab(ctx);
    assert.ok(calls[0].text.startsWith('---\n'), '渲染器未收到完整 Markdown 原文');
    assert.equal(ctx.doc.querySelectorAll('#sk-viewbox script').length, 0, '页面自行注入了脚本');
    assert.equal(ctx.doc.querySelector('#sk-doc-root[contenteditable="true"]'), null, '渲染容器不应可编辑');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0006 专家注册与组合配置                                        */
/* ------------------------------------------------------------------ */
async function scn0006T1() {
  const ctx = await load('experts.html');
  try {
    assert.equal(ctx.doc.querySelectorAll('#ex-grid .item-card').length, ctx.win.MOCK.experts.length);
    setValue(q(ctx.doc, '#ex-q'), '评审');
    assert.equal(ctx.doc.querySelectorAll('#ex-grid .item-card').length, 1);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0006T2() {
  const ctx = await load('experts.html');
  try {
    click(q(ctx.doc, '#ex-grid [data-act="detail"]'));
    await wait(30);
    for (const id of ['ex-sec-role', 'ex-sec-skill', 'ex-sec-tools', 'ex-sec-work', 'ex-sec-refs']) {
      assert.ok(ctx.doc.querySelector('#' + id), '缺详情区 ' + id);
    }
    const ex = ctx.win.MOCK.experts[0];
    const text = q(ctx.doc, '.modal').textContent;
    assert.ok(text.includes(ex.role), '缺角色定位');
    for (const sid of (ex.skills || [])) {
      const sk = ctx.win.MOCK.skills.find((x) => x.id === sid);
      if (sk) {
        assert.ok(text.includes(sk.name), '缺 Skill ' + sk.name);
        assert.ok(text.includes(sk.description), '缺 Skill 描述 ' + sk.name);
      }
    }
    assert.ok(!text.includes('undefined'), '专家详情出现 undefined');
    for (const tid of (ex.tools || [])) {
      const tl = ctx.win.MOCK.tools.find((x) => x.id === tid);
      if (tl) assert.ok(text.includes(tl.name), '缺工具 ' + tl.name);
    }
    for (const r of (ex.refs || [])) assert.ok(text.includes(r.label), '缺参考知识 ' + r.label);
    let refN = 0;
    for (const wf of ctx.win.MOCK.workflows) for (const nd of (wf.graph.nodes || [])) if (nd.expertId === ex.id) refN++;
    assert.match(text, new RegExp('被引用\\s*' + refN + '\\s*处'));
    assert.match(text, /B1 未提供引用方明细/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0006T3() {
  const ctx = await load('experts.html');
  try {
    const before = ctx.win.MOCK.experts.length;
    click(q(ctx.doc, '#ex-new'));
    await wait(30);
    setValue(q(ctx.doc, '#ex-n-name'), '回归迁移专家');
    setValue(q(ctx.doc, '#ex-n-role'), '完成存量数据迁移与一致性校验');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(50);
    assert.equal(ctx.win.MOCK.experts.length, before + 1);
    const created = ctx.win.MOCK.experts.find((x) => x.name === '回归迁移专家');
    assert.ok(created, '未创建专家');
    setValue(q(ctx.doc, '#ex-duty'), '负责回归迁移与校验');
    click(q(ctx.doc, '#ex-save'));
    await wait(40);
    assert.equal(created.duty, '负责回归迁移与校验');
    ctx.win.DF.modal.close();
    await wait(20);

    const ex = ctx.win.MOCK.experts[0];
    setChecked(ctx.doc.querySelector('[data-act="toggle"]'), false);
    await wait(20);
    click(q(ctx.doc, '#mc-ok'));
    await wait(50);
    assert.equal(ex.enabled, false);
    assert.ok(ctx.doc.querySelector('#ex-grid .item-card .switch input:not(:checked)'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0006T4() {
  const ctx = await load('experts.html');
  try {
    const ex = ctx.win.MOCK.experts[1];
    const cb = ctx.doc.querySelectorAll('[data-act="toggle"]')[1];
    setChecked(cb, false);
    await wait(20);
    click(q(ctx.doc, '#mc-no'));
    await wait(30);
    assert.equal(ex.enabled, true);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0007 Harness 注册与健康治理                                    */
/* ------------------------------------------------------------------ */
async function scn0007T1() {
  const ctx = await load('harnesses.html');
  try {
    const H = ctx.win.MOCK.harnesses;
    const offline = H.filter((h) => h.health === '离线').length;
    const online = H.filter((h) => h.health === '在线' && !h._disabled).length;
    const disabled = H.filter((h) => h._disabled).length;
    assert.equal(ctx.doc.querySelectorAll('#page-body tbody tr').length, H.length);
    const cards = [...ctx.doc.querySelectorAll('.stat-row .stat-card')].map((x) => x.textContent.replace(/\s+/g, ''));
    assert.ok(cards.includes('总数' + H.length), '总数卡不符');
    assert.ok(cards.includes('在线' + online), '在线卡不符');
    assert.ok(cards.includes('离线' + offline), '离线卡不符');
    assert.ok(cards.includes('停用' + disabled), '停用卡不符');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0007T2() {
  const ctx = await load('harnesses.html');
  try {
    const before = ctx.win.MOCK.harnesses.length;
    click(q(ctx.doc, '#ha-reg-btn'));
    await wait(30);
    setValue(q(ctx.doc, '[data-m="name"]'), 'build-99');
    setValue(q(ctx.doc, '[data-m="address"]'), '10.0.4.99:7801');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(60);
    assert.equal(ctx.win.MOCK.harnesses.length, before + 1);
    assert.ok(ctx.win.MOCK.harnesses.some((x) => x.name === 'build-99' && x.health === '在线'));

    click(q(ctx.doc, '#ha-reg-btn'));
    await wait(30);
    setValue(q(ctx.doc, '[data-m="name"]'), 'build-99');
    setValue(q(ctx.doc, '[data-m="address"]'), '10.0.4.98:7801');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(30);
    assert.equal(ctx.win.MOCK.harnesses.length, before + 1);
    assert.match(ctx.doc.body.textContent, /名称已存在/);

    setValue(q(ctx.doc, '[data-m="name"]'), 'build-100');
    setValue(q(ctx.doc, '[data-m="concurrencyMax"]'), '0');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(30);
    assert.equal(ctx.win.MOCK.harnesses.length, before + 1);
    assert.match(ctx.doc.body.textContent, /并发上限需 ≥ 1/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0007T3() {
  const ctx = await load('harnesses.html');
  try {
    const h = ctx.win.MOCK.harnesses.find((x) => x.id === 'h-build01');
    assert.equal(!!h._disabled, false);
    click(q(ctx.doc, '[data-act="toggle"][data-id="h-build01"]'));
    await wait(20);
    click(q(ctx.doc, '#mc-ok'));
    await wait(50);
    assert.equal(h._disabled, true);
    assert.match(q(ctx.doc, '#page-body').textContent, /已停用/);

    const before = ctx.win.MOCK.harnesses.length;
    click(q(ctx.doc, '[data-act="del"][data-id="h-devlap"]'));
    await wait(20);
    click(q(ctx.doc, '#mc-ok'));
    await wait(40);
    assert.equal(ctx.win.MOCK.harnesses.length, before - 1);
    assert.equal(ctx.win.MOCK.harnesses.some((x) => x.id === 'h-devlap'), false);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0007T4() {
  const ctx = await load('harnesses.html');
  try {
    const row = [...ctx.doc.querySelectorAll('#page-body tbody tr')].find((tr) => tr.textContent.includes('build-01'));
    assert.ok(row);
    assert.ok(row.querySelector('[data-act="del"]'), '缺少删除入口');
    const h2 = ctx.win.MOCK.harnesses.find((x) => x.id === 'h-build02');
    click(q(ctx.doc, '[data-act="toggle"][data-id="h-build02"]'));
    await wait(20);
    click(q(ctx.doc, '#mc-no'));
    await wait(30);
    assert.equal(!!h2._disabled, false);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0008 工具注册、调试与引用治理                                  */
/* ------------------------------------------------------------------ */
async function scn0008T1() {
  const ctx = await load('tools.html');
  try {
    const T = ctx.win.MOCK.tools;
    assert.equal(ctx.doc.querySelectorAll('#tl-table tbody tr').length, T.length);
    setValue(q(ctx.doc, '#tl-ft-type'), 'cli');
    assert.equal(ctx.doc.querySelectorAll('#tl-table tbody tr').length, T.filter((t) => t.type === 'CLI').length);
    setValue(q(ctx.doc, '#tl-ft-type'), '');
    setValue(q(ctx.doc, '#tl-ft-status'), 'unverified');
    assert.equal(ctx.doc.querySelectorAll('#tl-table tbody tr').length, T.filter((t) => t.status === '未验证').length);
    setValue(q(ctx.doc, '#tl-ft-status'), '');
    setValue(q(ctx.doc, '#tl-ft-kw'), 'trace');
    assert.equal(ctx.doc.querySelectorAll('#tl-table tbody tr').length, 1);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0008T2() {
  const ctx = await load('tools.html');
  try {
    const before = ctx.win.MOCK.tools.length;
    click(q(ctx.doc, '#tl-add'));
    await wait(30);
    setValue(q(ctx.doc, '#tl-f-name'), 'regression_tool');
    setValue(q(ctx.doc, '#tl-f-inv'), 'regression --symbol {symbol}');
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(50);
    assert.equal(ctx.win.MOCK.tools.length, before + 1);
    const created = ctx.win.MOCK.tools.find((t) => t.name === 'regression_tool');
    assert.ok(created);
    assert.equal(created.status, '未验证');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0008T3() {
  const ctx = await load('tools.html');
  try {
    const tool = ctx.win.MOCK.tools.find((t) => t.id === 't-trace');
    click(q(ctx.doc, '[data-act="refs"][data-id="t-trace"]'));
    await wait(30);
    const text = q(ctx.doc, '.modal').textContent;
    assert.match(text, /引用该工具的专家数/);
    assert.match(text, new RegExp(String(tool.refCount)));
    assert.match(text, /B1 未提供引用方明细/);
    assert.equal(ctx.doc.querySelectorAll('.tl-ref-item').length, 0);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0008T4() {
  const ctx = await load('tools.html');
  try {
    const tool = ctx.win.MOCK.tools.find((t) => t.id === 't-trace');
    const before = ctx.win.MOCK.tools.length;
    click(q(ctx.doc, '[data-act="del"][data-id="t-trace"]'));
    await wait(30);
    click(q(ctx.doc, '#mc-ok'));
    await wait(60);
    assert.equal(ctx.win.MOCK.tools.length, before);
    assert.match(ctx.doc.body.textContent, /禁止删除|后端会拒绝/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0009 效能看板只读回看                                          */
/* ------------------------------------------------------------------ */
async function scn0009T1() {
  const ctx = await load('analytics.html');
  try {
    const A = ctx.win.MOCK.analytics;
    assert.equal(ctx.doc.querySelectorAll('.stat-card').length, 5);
    assert.match(ctx.doc.querySelector('#page-body').textContent, new RegExp(String(A.throughput[A.throughput.length - 1])));
    assert.match(ctx.doc.querySelector('#page-body').textContent, new RegExp(A.successRate + '%'));
    assert.equal(ctx.doc.querySelectorAll('.an-stage-row').length, A.stagePass.length);
    assert.equal(ctx.doc.querySelectorAll('.an-audit-item').length, A.skillAudit.length);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0009T2() {
  const ctx = await load('analytics.html');
  try {
    const sel = q(ctx.doc, '#an-range');
    sel.value = '4';
    sel.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    await wait(30);
    assert.match(ctx.doc.querySelector('#page-body').textContent, /近 4 周/);
    assert.equal(ctx.doc.querySelectorAll('svg[aria-label="吞吐率与缺陷率趋势"] circle').length, 8);
    sel.value = '8';
    sel.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    await wait(30);
    assert.match(ctx.doc.querySelector('#page-body').textContent, /近 8 周/);
    assert.equal(ctx.doc.querySelectorAll('svg[aria-label="吞吐率与缺陷率趋势"] circle').length, 16);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0009T3() {
  const ctx = await load('analytics.html');
  try {
    assert.equal(ctx.doc.querySelectorAll('#an-review-wrap tbody tr').length, 5);
    assert.match(q(ctx.doc, '#an-review-wrap').textContent, /INS-2041/);
    click(q(ctx.doc, '#an-next'));
    await wait(20);
    assert.equal(ctx.doc.querySelectorAll('#an-review-wrap tbody tr').length, 5);
    assert.match(q(ctx.doc, '#an-review-wrap').textContent, /INS-2027/);
    assert.match(q(ctx.doc, '#an-review-wrap .an-pager').textContent, /第 2 \/ 2 页/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0009T4() {
  const ctx = await load('analytics.html');
  try {
    assert.equal(q(ctx.doc, '#an-range option[value="12"]').disabled, true);
    const labels = [...ctx.doc.querySelectorAll('#page-body button')].map((b) => b.textContent.trim());
    assert.ok(!labels.some((x) => x.includes('编辑') || x.includes('删除')));
    const before = JSON.stringify(ctx.win.MOCK.analytics);
    const sel = q(ctx.doc, '#an-range');
    sel.value = '4';
    sel.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    await wait(30);
    assert.equal(JSON.stringify(ctx.win.MOCK.analytics), before, '切换范围不应写 MOCK');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
/* SCN-0010 工作区创建、配置与归档                                    */
/* ------------------------------------------------------------------ */
async function scn0010T1() {
  const ctx = await load('workspaces.html');
  try {
    assert.equal(ctx.doc.querySelectorAll('#ws-table tbody tr').length, ctx.win.MOCK.workspaces.length);
    assert.equal(ctx.doc.querySelectorAll('.ws-dis').length, 3);
    assert.match(q(ctx.doc, '#ws-count').textContent, new RegExp('共\\s*' + ctx.win.MOCK.workspaces.length));
    const ws1 = ctx.win.MOCK.workspaces.find((w) => w.id === 'ws1');
    const k1 = ctx.win.MOCK.keys.find((k) => k.id === ws1.credId);
    const row1 = [...ctx.doc.querySelectorAll('#ws-table tbody tr')].find((tr) => tr.textContent.includes(ws1.name));
    assert.ok(row1.textContent.includes(k1.name), '未展示关联 Key');
    const row4 = [...ctx.doc.querySelectorAll('#ws-table tbody tr')].find((tr) => tr.textContent.includes('pb2-service'));
    assert.match(row4.textContent, /未关联/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0010T2() {
  const ctx = await load('workspaces.html');
  try {
    click(q(ctx.doc, '#ws-btn-new'));
    await wait(30);
    click(q(ctx.doc, '#wz-next'));
    await wait(30);
    assert.notEqual(q(ctx.doc, '#wz-name-err').style.display, 'none');
    assert.ok(q(ctx.doc, '#wz-name'));
    setValue(q(ctx.doc, '#wz-name'), 'regression-ws');
    setValue(q(ctx.doc, '#wz-repo'), 'ftp://igit/org/regression.git');
    setValue(q(ctx.doc, '#wz-branch'), 'main');
    click(q(ctx.doc, '#wz-next'));
    await wait(30);
    assert.notEqual(q(ctx.doc, '#wz-repo-err').style.display, 'none');
    assert.ok(q(ctx.doc, '#wz-name'), '非法 URL 不应前进');
    setValue(q(ctx.doc, '#wz-repo'), 'git@igit:org/regression.git');
    click(q(ctx.doc, '#wz-next'));
    await wait(30);
    assert.ok(q(ctx.doc, '#wz-cred'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0010T3() {
  const ctx = await load('workspaces.html');
  try {
    const before = ctx.win.WSC.allWorkspaces().length;
    click(q(ctx.doc, '#ws-btn-new'));
    await wait(30);
    setValue(q(ctx.doc, '#wz-name'), 'regression-ws');
    setValue(q(ctx.doc, '#wz-repo'), 'git@igit:org/regression.git');
    setValue(q(ctx.doc, '#wz-branch'), 'main');
    click(q(ctx.doc, '#wz-next'));
    await wait(20);
    click(q(ctx.doc, '#wz-next'));
    await wait(20);
    assert.match(q(ctx.doc, '#wz-next').textContent, /完成并初始化/);
    click(q(ctx.doc, '#wz-next'));
    await wait(1400);
    const nw = ctx.win.WSC.readNewWs();
    assert.ok(nw, '未写入 df-new-workspace');
    assert.equal(nw.name, 'regression-ws');
    assert.equal(nw.status, '已初始化');
    assert.equal(nw.branch, 'main');
    assert.equal(ctx.win.WSC.allWorkspaces().length, before + 1);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0010T4() {
  const ctx = await load('workspaces.html');
  let c2;
  try {
    assert.equal(ctx.doc.querySelectorAll('.ws-dis').length, 3);
    assert.equal(ctx.doc.querySelector('[data-act="del"][data-id="ws1"]'), null);
    const before = ctx.win.MOCK.workspaces.length;
    click(q(ctx.doc, '[data-act="del"][data-id="ws4"]'));
    await wait(20);
    click(q(ctx.doc, '#mc-no'));
    await wait(30);
    assert.equal(ctx.win.MOCK.workspaces.length, before);
    assertNoPageErrors(ctx);

    c2 = await load('workspace-detail.html', 'id=ws1');
    const ws = c2.win.MOCK.workspaces.find((w) => w.id === 'ws1');
    const archBefore = (ws.archives || []).length;
    click(q(c2.doc, '#wd-clean2'));
    await wait(20);
    click(q(c2.doc, '#mc-ok'));
    await wait(60);
    assert.equal((ws.archives || []).length, archBefore + 1);
    assert.match(q(c2.doc, '#page-body').textContent, /INS-2042/);
    assertNoPageErrors(c2);
  } finally {
    if (c2) c2.close();
    ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* SCN-0011 个人 Key 登记、校验与绑定                                 */
/* ------------------------------------------------------------------ */
async function scn0011T1() {
  const ctx = await load('keys.html');
  try {
    assert.equal(ctx.doc.querySelectorAll('#ky-list tbody tr').length, ctx.win.MOCK.keys.length);
    for (const k of ctx.win.MOCK.keys) {
      assert.ok(k.mask.includes('****') || k.mask.includes('…'), k.id + ' 掩码未脱敏');
      assert.match(k.mask, /[a-z0-9]{4}$/i, k.id + ' 未保留末 4 位');
      assert.ok(ctx.doc.body.textContent.includes(k.mask), k.id + ' 掩码未展示');
    }
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0011T2() {
  const ctx = await load('keys.html');
  try {
    const before = ctx.win.MOCK.keys.length;
    click(q(ctx.doc, '#ky-add'));
    await wait(30);
    const radio = q(ctx.doc, 'input[name="ky-type"][value="git ssh-key"]');
    setChecked(radio, true);
    assert.notEqual(q(ctx.doc, '#ky-form-ssh').style.display, 'none');
    assert.equal(q(ctx.doc, '#ky-form-llm').style.display, 'none');
    setValue(q(ctx.doc, '#ky-ssh-name'), 'regression-key');
    setValue(q(ctx.doc, '#ky-ssh-pub'), 'ssh-ed25519 AAAAC3NzaRegression');
    await wait(20);
    click(q(ctx.doc, '.modal .d-foot .btn.primary'));
    await wait(60);
    assert.equal(ctx.win.MOCK.keys.length, before + 1);
    const k = ctx.win.MOCK.keys.find((x) => x.name === 'regression-key');
    assert.ok(k);
    assert.equal(k.type, 'git ssh-key');
    assert.equal(k.status, '未校验');
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0011T3() {
  const ctx = await load('keys.html');
  try {
    const k = ctx.win.MOCK.keys.find((x) => x.id === 'k3');
    assert.equal(k.status, '失效');
    click(q(ctx.doc, '.ky-verify[data-id="k3"]'));
    await wait(900);
    assert.equal(k.status, '有效');

    const k1 = ctx.win.MOCK.keys.find((x) => x.id === 'k1');
    click(q(ctx.doc, '.ky-more[data-id="k1"]'));
    await wait(20);
    click([...ctx.doc.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('绑定用途')));
    await wait(30);
    const cb = [...ctx.doc.querySelectorAll('.drawer input[data-g="workspaces"]')].find((x) => !x.checked);
    assert.ok(cb, '没有可新增的绑定项');
    setChecked(cb, true);
    click(q(ctx.doc, '#ky-b-save'));
    await wait(40);
    assert.ok((k1.bindings.workspaces || []).includes(cb.value), '绑定未写回');
    assert.match(q(ctx.doc, '#ky-list').textContent, /工作区×3/);
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

async function scn0011T4() {
  const ctx = await load('keys.html');
  try {
    const before = ctx.win.MOCK.keys.length;
    click(q(ctx.doc, '#ky-add'));
    await wait(30);
    setChecked(q(ctx.doc, 'input[name="ky-type"][value="git ssh-key"]'), true);
    setValue(q(ctx.doc, '#ky-ssh-name'), 'missing-pub');
    assert.equal(q(ctx.doc, '.modal .d-foot .btn.primary').disabled, true);
    ctx.win.DF.modal.close();
    await wait(30);
    assert.equal(ctx.win.MOCK.keys.length, before);

    click(q(ctx.doc, '.ky-more[data-id="k1"]'));
    await wait(20);
    const del = [...ctx.doc.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('删除'));
    assert.ok(del, '菜单缺删除');
    click(del);
    await wait(20);
    click(q(ctx.doc, '#mc-no'));
    await wait(30);
    assert.equal(ctx.win.MOCK.keys.length, before);
    assert.ok(ctx.win.MOCK.keys.some((x) => x.id === 'k1'));
    assertNoPageErrors(ctx);
  } finally { ctx.close(); }
}

/* ------------------------------------------------------------------ */
const SCENARIOS = [
  {
    id: 'SCN-0002',
    title: '工作流列表浏览与生命周期入口',
    tests: [
      ['SCN-0002-T1', '正', '列表条目与统计同源', scn0002T1],
      ['SCN-0002-T2', '正', '类型筛选与名称搜索', scn0002T2],
      ['SCN-0002-T3', '正', '新建写入 MOCK.workflows', scn0002T3],
      ['SCN-0002-T4', '反', '删除取消保留记录与引用', scn0002T4]
    ]
  },
  {
    id: 'SCN-0003',
    title: '工作流画布编辑与校验',
    tests: [
      ['SCN-0003-T1', '正', '画布节点与夹具一致', scn0003T1],
      ['SCN-0003-T2', '正', '节点选中打开属性抽屉', scn0003T2],
      ['SCN-0003-T3', '正', '合法图校验通过且 DSL 可导出', scn0003T3],
      ['SCN-0003-T4', '反', '评审缺回退目标触发 err', scn0003T4]
    ]
  },
  {
    id: 'SCN-0004',
    title: '实例监控与运行控制',
    tests: [
      ['SCN-0004-T1', '正', '列表与已结束口径同源', scn0004T1],
      ['SCN-0004-T2', '正', '详情轨迹与实例一致', scn0004T2],
      ['SCN-0004-T3', '正', '暂停后状态迁移', scn0004T3],
      ['SCN-0004-T4', '反', '终止取消不改状态', scn0004T4]
    ]
  },
  {
    id: 'SCN-0005',
    title: 'Skill 维护与渐进披露',
    tests: [
      ['SCN-0005-T1', '正', '列表计数同源', scn0005T1],
      ['SCN-0005-T2', '正', '五章渐进披露', scn0005T2],
      ['SCN-0005-T3', '正', 'description 写入与版本递增', scn0005T3],
      ['SCN-0005-T4', '反', '被引用 Skill 禁止删除', scn0005T4]
    ]
  },
  {
    id: 'SCN-0006',
    title: '专家注册与组合配置',
    tests: [
      ['SCN-0006-T1', '正', '卡片计数与搜索', scn0006T1],
      ['SCN-0006-T2', '正', '五区详情齐全', scn0006T2],
      ['SCN-0006-T3', '正', '停用写回 enabled=false', scn0006T3],
      ['SCN-0006-T4', '反', '取消停用保持启用', scn0006T4]
    ]
  },
  {
    id: 'SCN-0014',
    title: 'Skill 专门页面查看与编辑',
    tests: [
      ['SCN-0014-T1', '正', '专门页面默认结构化五章且无抽屉', scn0014T1],
      ['SCN-0014-T2', '正', '专门页编辑保存版本递增并回到查看态', scn0014T2],
      ['SCN-0014-T3', '正', '专门页新建成功进入编辑态', scn0014T3],
      ['SCN-0014-T4', '反', '缺 id/无效 id 显式报错', scn0014T4],
      ['SCN-0014-T5', '正', '编辑态预览 Tab 渲染最新草稿 Markdown', scn0014T5]
    ]
  },
  {
    id: 'SCN-0015',
    title: 'Milkdown 渲染 Skill 文档',
    tests: [
      ['SCN-0015-T1', '正', '文档 Tab 用渲染器而非 <pre>', scn0015T1],
      ['SCN-0015-T2', '正', '304 复用上次文本且仍走渲染器', scn0015T2],
      ['SCN-0015-T3', '正', '停用 Skill 仍可渲染文档', scn0015T3],
      ['SCN-0015-T4', '反', '文档 404 显式报错并可重试', scn0015T4],
      ['SCN-0015-T5', '反', '渲染容器只读且不注入脚本', scn0015T5]
    ]
  },
  {
    id: 'SCN-0013',
    title: 'Skill 契约 v2 展示端适配',
    tests: [
      ['SCN-0013-T1', '正', '列表读 description 且描述可检索', scn0013T1],
      ['SCN-0013-T2', '正', '新建/编辑 description 1–400 校验与写回', scn0013T2],
      ['SCN-0013-T3', '正', '全文 200/304 原样展示', scn0013T3],
      ['SCN-0013-T4', '正', '空踩坑/空引用整节省略，停用技能可读', scn0013T4],
      ['SCN-0013-T5', '反', '全文 404 显示错误并可重试', scn0013T5],
      ['SCN-0013-T6', '反', '旧字段 400 提示契约升级且保存可重试', scn0013T6]
    ]
  },
  {
    id: 'SCN-0007',
    title: 'Harness 注册与健康治理',
    tests: [
      ['SCN-0007-T1', '正', '表格与在线计数同源', scn0007T1],
      ['SCN-0007-T2', '正', '注册合法 Harness', scn0007T2],
      ['SCN-0007-T3', '正', '停用写回页面标记', scn0007T3],
      ['SCN-0007-T4', '反', '删除入口存在、停用可取消', scn0007T4]
    ]
  },
  {
    id: 'SCN-0008',
    title: '工具注册、调试与引用治理',
    tests: [
      ['SCN-0008-T1', '正', '注册表与关键词筛选', scn0008T1],
      ['SCN-0008-T2', '正', '注册新增未验证工具', scn0008T2],
      ['SCN-0008-T3', '正', '引用计数与 B1 明细说明', scn0008T3],
      ['SCN-0008-T4', '反', '被引用工具删除由后端拒绝', scn0008T4]
    ]
  },
  {
    id: 'SCN-0009',
    title: '效能看板只读回看',
    tests: [
      ['SCN-0009-T1', '正', 'KPI/阶段/审计同源', scn0009T1],
      ['SCN-0009-T2', '正', '4↔8 周数据点', scn0009T2],
      ['SCN-0009-T3', '正', '评审记录分页', scn0009T3],
      ['SCN-0009-T4', '反', '12 周禁用且无写入口', scn0009T4]
    ]
  },
  {
    id: 'SCN-0010',
    title: '工作区创建、配置与归档',
    tests: [
      ['SCN-0010-T1', '正', '列表与引用删除保护', scn0010T1],
      ['SCN-0010-T2', '正', '向导步① 必填校验', scn0010T2],
      ['SCN-0010-T3', '正', '三步完成写入新工作区', scn0010T3],
      ['SCN-0010-T4', '反', '被引用工作区禁止删除、取消不写、归档只追加', scn0010T4]
    ]
  },
  {
    id: 'SCN-0011',
    title: '个人 Key 登记、校验与绑定',
    tests: [
      ['SCN-0011-T1', '正', '列表掩码脱敏', scn0011T1],
      ['SCN-0011-T2', '正', 'git Key 表单登记', scn0011T2],
      ['SCN-0011-T3', '正', '校验后状态转有效', scn0011T3],
      ['SCN-0011-T4', '反', '必填阻断、删除取消保留 Key', scn0011T4]
    ]
  }
];

(async () => {
  const only = process.argv[2];
  if (only && !SCENARIOS.some((s) => s.id === only)) {
    console.error('未知场景：' + only + '（可用：' + SCENARIOS.map((s) => s.id).join(', ') + '）');
    process.exitCode = 1;
    return;
  }
  const server = await startServer();
  let pass = 0;
  let fail = 0;
  for (const scenario of SCENARIOS) {
    if (only && scenario.id !== only) continue;
    console.log('\n' + scenario.id + ' ' + scenario.title);
    for (const [id, type, title, fn] of scenario.tests) {
      try {
        await fn();
        console.log('  ✓ ' + id + ' [' + type + '] ' + title);
        pass++;
      } catch (e) {
        console.log('  ✕ ' + id + ' [' + type + '] ' + title);
        console.log('    ' + String(e && e.message || e).split('\n').join('\n    '));
        fail++;
      }
    }
  }
  server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
