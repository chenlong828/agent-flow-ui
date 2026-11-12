/**
 * 运行实例详情（CMP-instances）
 *
 * 数据源：API-43 `GET /runs/{id}` + B3 工作流图（只用于画布布局与节点名）。
 * 节点执行状态来自 run.nodes（同一节点按 visit 追加，取最新一轮）。
 * 后端未提供的能力保留入口并置灰（暂停/恢复/节点重试/从节点重跑/输入输出/工作区留痕）。
 */

import { DF } from '../ui.js';
import { request } from '../shared/http.js';
import { createWorkflowData } from '../workflow/data.js';
import { toEditorGraph } from '../workflow/model.js';
import { renderMarkdown } from '../shared/markdown.js';
import {
  createRunData,
  errorText,
  durationMs,
  RUN_STATE,
  RUN_OUTCOME,
  NODE_STATE,
  ARCHIVE_STATE,
  ACTIVE_STATES
} from '../run/data.js';

const { esc, icon, tag, dot } = DF;
const runs = createRunData();
const workflows = createWorkflowData();

const NODE_W = 168;
const NODE_H = 58;
const POLL_MS = 5000;

const NODE_META = {
  start: { label: '开始节点', cls: 't-plain' },
  end: { label: '结束节点', cls: 't-plain' },
  agent: { label: '专家执行节点', cls: 't-agent' },
  split: { label: '拆分节点', cls: 't-gateway' },
  review: { label: '评审节点', cls: 't-review' },
  confirm: { label: '人工确认节点', cls: 't-confirm' },
  fanout: { label: '展开节点', cls: 't-gateway' }
};

const NODE_CLASS = {
  queued: 'st-pending',
  dispatched: 'st-run',
  waiting_confirm: 'st-wait',
  succeeded: 'st-ok',
  rejected: 'st-rollback',
  failed: 'st-fail'
};

const state = {
  runId: null,
  run: null,
  workflow: null,
  graph: null,
  experts: new Map(),
  nodesById: new Map(),
  selectedId: null,
  tab: 'summary',
  loading: true,
  error: null,
  timer: null,
  version: 0,
  pending: 0,
  md: {},
  full: null
};

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

function fmtTime(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? '—' : DF.fmtClock(new Date(ms));
}

function fmtMs(fromIso, toIso) {
  const from = fromIso ? Date.parse(fromIso) : NaN;
  if (Number.isNaN(from)) return '—';
  const to = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(to)) return '—';
  return DF.fmtDur(Math.round(Math.max(0, to - from) / 1000));
}

function syncBell() {
  const bell = document.getElementById('df-bell');
  if (!bell) return;
  const n = state.pending || 0;
  bell.innerHTML = DF.icon('bell', 18) + (n ? '<span class="badge-count">' + n + '</span>' : '');
}

/* ---------------- 载入 ---------------- */

async function load() {
  const token = ++state.version;
  try {
    const run = await runs.get(state.runId);
    if (token !== state.version) return;
    state.run = run;
    const [wf, expertPage, pendingPage] = await Promise.all([
      workflows.get(run.workflowId),
      request({ method: 'GET', path: '/api/v1/experts?limit=200' }).catch(function () { return { items: [] }; }),
      runs.list({ state: 'waiting_confirm', limit: 1 }).catch(function () { return { total: 0 }; })
    ]);
    state.pending = pendingPage.total || 0;
    if (token !== state.version) return;
    state.workflow = wf;
    state.graph = toEditorGraph(wf.graph);
    state.experts = new Map((expertPage.items || []).map(function (e) { return [e.id, e]; }));
    state.nodesById = new Map();
    (run.nodes || []).forEach(function (node) {
      const prev = state.nodesById.get(node.nodeId);
      if (!prev || node.visit >= prev.visit) state.nodesById.set(node.nodeId, node);
    });
    state.error = null;
    if (!state.selectedId || !state.graph.nodes.some(function (n) { return n.id === state.selectedId; })) {
      state.selectedId = run.currentNodeId && state.graph.nodes.some(function (n) { return n.id === run.currentNodeId; })
        ? run.currentNodeId
        : (state.graph.nodes[0] ? state.graph.nodes[0].id : null);
    }
  } catch (err) {
    if (token !== state.version) return;
    state.error = err;
  } finally {
    if (token === state.version) {
      state.loading = false;
      render();
      schedule();
    }
  }
}

function schedule() {
  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  if (!state.run || ACTIVE_STATES.indexOf(state.run.state) < 0) return;
  state.timer = setTimeout(function () {
    if (document.hidden) { schedule(); return; }
    const comment = document.getElementById('cf-comment');
    if (comment && (document.activeElement === comment || comment.value.trim() !== '')) { schedule(); return; }
    load();
  }, POLL_MS);
}

/* ---------------- 渲染 ---------------- */

function render() {
  let body = document.getElementById('page-body');
  if (!body) return;
  if (state.loading) {
    body.innerHTML = '<div class="loading">正在加载运行详情…</div>';
    return;
  }
  if (state.error) {
    const notFound = state.error.status === 404;
    body.innerHTML = '<div class="empty"><div class="e-ic">🗂</div>' +
      (notFound ? '运行不存在或已删除' : esc(errorText(state.error))) + '<br><br>' +
      (notFound ? '' : '<button class="btn primary" id="id-retry">重试</button> ') +
      '<a class="btn" href="instances.html">← 返回运行实例</a></div>';
    const retry = document.getElementById('id-retry');
    if (retry) retry.onclick = load;
    return;
  }
  const run = state.run;
  const active = ACTIVE_STATES.indexOf(run.state) >= 0;
  const wfName = state.workflow ? state.workflow.name : shortId(run.workflowId);
  const title = shortId(run.runId) + ' · ' + wfName + ' r' + run.workflowRevision;

  DF.renderShell({
    pendingCount: state.pending,
    active: 'instances',
    breadcrumb: [{ label: '运行与运营' }, { label: '运行实例', href: 'instances.html' }, { label: shortId(run.runId) }],
    title: title,
    subtitle: '执行节点 ' + (run.clientId || '—') + ' · 工作区 ' + (run.workspacePath || '—') +
      (run.archiveState && run.archiveState !== 'none' ? ' · ' + (ARCHIVE_STATE[run.archiveState] || run.archiveState) : ''),
    actions:
      stateTag(run) +
      '<span class="sub" style="margin:0 10px">耗时 ' + esc(fmtMs(run.startedAt, run.finishedAt)) + '</span>' +
      '<button class="btn" id="id-pause" disabled title="后端未提供暂停能力">' + icon('pause', 14) + '暂停</button>' +
      '<button class="btn" id="id-resume" disabled title="后端未提供恢复能力">' + icon('play', 14) + '恢复</button>' +
      '<button class="btn" id="id-rerun" disabled title="后端未提供从节点重跑能力">' + icon('retry', 14) + '从节点重跑</button>' +
      (active ? '<button class="btn danger" id="id-stop">' + icon('stop', 14) + '终止</button>' : '')
  });

  const stop = document.getElementById('id-stop');
  if (stop) stop.onclick = stopRun;

  body = document.getElementById('page-body');
  body.innerHTML =
    '<div class="id-layout">' +
      '<div class="id-trace"><div class="cv-wrap" id="cvWrap"><div class="cv-canvas" id="cvCanvas"></div></div>' +
        '<div class="cv-legend">' +
          '<b>' + dot('green') + '成功</b><b>' + dot('blue') + '运行中</b><b>' + dot('orange') + '等待人工</b>' +
          '<b>' + dot('red') + '失败</b><b>' + dot('purple') + '已驳回</b><b>' + dot('gray') + '待执行</b>' +
          '<b>点击节点查看详情</b></div>' +
      '</div>' +
      '<div class="id-panel" id="id-panel"></div>' +
    '</div>';
  paint();
  renderPanel();
  syncBell();
}

function stateTag(run) {
  if (run.state === 'done') {
    const color = run.outcome === 'succeeded' ? 'green' : run.outcome === 'cancelled' ? 'gray' : 'red';
    return tag(RUN_OUTCOME[run.outcome] || '已结束', color);
  }
  return tag(RUN_STATE[run.state] || run.state, run.state === 'waiting_confirm' ? 'orange' : run.state === 'running' ? 'blue' : 'gray');
}

/* ---------------- 画布 ---------------- */

function nodePos(node) {
  return { x: Number.isFinite(node.x) ? node.x : 60, y: Number.isFinite(node.y) ? node.y : 110 };
}

function canvasSize() {
  const nodes = state.graph.nodes;
  let w = 640;
  let h = 360;
  nodes.forEach(function (n) {
    const p = nodePos(n);
    w = Math.max(w, p.x + NODE_W + 120);
    h = Math.max(h, p.y + NODE_H + 120);
  });
  state.graph.stages.forEach(function (s) {
    if (s.box) { w = Math.max(w, s.box.x + s.box.w + 60); h = Math.max(h, s.box.y + s.box.h + 60); }
  });
  return { w: w, h: h };
}

function nodeState(nodeId) {
  const node = state.nodesById.get(nodeId);
  if (!node) return { key: 'pending', label: '待执行', visit: 0, run: null };
  return {
    key: node.state,
    label: NODE_STATE[node.state] || node.state,
    visit: node.visit || 1,
    run: node
  };
}

function paint() {
  const canvas = document.getElementById('cvCanvas');
  const size = canvasSize();
  canvas.style.width = size.w + 'px';
  canvas.style.height = size.h + 'px';
  canvas.innerHTML = stagesHTML() + edgesHTML() + nodesHTML();
  canvas.onclick = function (e) {
    const el = e.target.closest('.cv-node');
    if (!el) return;
    state.selectedId = el.dataset.node;
    paint();
    renderPanel();
  };
}

function stagesHTML() {
  return state.graph.stages.map(function (stage) {
    if (!stage.box) return '';
    const b = stage.box;
    return '<div class="cv-stage" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px">' +
      '<span class="stage-label">' + esc(stage.name) + '</span></div>';
  }).join('');
}

function nodesHTML() {
  return state.graph.nodes.map(function (n) {
    const p = nodePos(n);
    const st = nodeState(n.id);
    const meta = NODE_META[n.type] || { label: n.type, cls: 't-plain' };
    const expert = n.expertId ? state.experts.get(n.expertId) : null;
    const sub = st.label + (st.visit > 1 ? ' · 第 ' + st.visit + ' 轮' : '');
    return '<div class="cv-node ' + meta.cls + ' ' + (NODE_CLASS[st.key] || 'st-pending') +
      (state.selectedId === n.id ? ' sel' : '') + '" data-node="' + esc(n.id) + '"' +
      ' style="left:' + p.x + 'px;top:' + p.y + 'px;cursor:pointer">' +
      '<div class="n-head"><span class="e-dot" style="background:' + (expert ? esc(expert.color) : '#94a3b8') + '"></span>' + esc(n.name) + '</div>' +
      '<div class="n-sub">' + esc(sub) + '</div>' +
      (expert ? '<div class="n-expert">' + icon('user', 10) + esc(expert.name) + '</div>' : '') +
      '</div>';
  }).join('');
}

function edgesHTML() {
  let out = '';
  state.graph.edges.forEach(function (e) {
    const a = state.graph.nodes.find(function (n) { return n.id === e.from; });
    const b = state.graph.nodes.find(function (n) { return n.id === e.to; });
    if (!a || !b) return;
    const pa = nodePos(a);
    const pb = nodePos(b);
    if (e.kind === 'rollback') {
      const s = { x: pa.x + NODE_W - 22, y: pa.y + NODE_H };
      const t = { x: pb.x + NODE_W / 2, y: pb.y + NODE_H };
      const sag = Math.max(70, Math.abs(s.y - t.y) * 0.2 + 60);
      out += '<path class="e-rb" d="M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + sag) + ', ' + (t.x - 40) + ' ' + (t.y + sag) + ', ' + t.x + ' ' + t.y + '"/>';
      return;
    }
    const s = { x: pa.x + NODE_W, y: pa.y + 29 };
    const t = { x: pb.x, y: pb.y + 29 };
    const dx = Math.max(40, Math.abs(t.x - s.x) / 2);
    out += '<path class="e-seq" d="M ' + s.x + ' ' + s.y + ' C ' + (s.x + dx) + ' ' + s.y + ', ' + (t.x - dx) + ' ' + t.y + ', ' + t.x + ' ' + t.y + '"/>';
  });
  const size = canvasSize();
  return '<svg class="cv-edges" width="' + size.w + '" height="' + size.h + '">' + out + '</svg>';
}

/* ---------------- 右侧面板 ---------------- */

function selectedNode() {
  return state.graph && state.selectedId
    ? state.graph.nodes.find(function (n) { return n.id === state.selectedId; }) || null
    : null;
}

function renderPanel() {
  const panel = document.getElementById('id-panel');
  if (!panel) return;
  const node = selectedNode();
  if (!node) {
    panel.innerHTML = '<div class="card" style="padding:16px;color:var(--t-3);flex:1">' + icon('panel') + ' 在左侧轨迹图中点击节点，查看执行状态、结论与会话日志。</div>';
    return;
  }
  const st = nodeState(node.id);
  const runNode = st.run;
  const confirmable = runNode && runNode.state === 'waiting_confirm';
  state.md = {};
  panel.innerHTML =
    (confirmable ? confirmCard(node, runNode) : '') +
    '<div class="id-tabs">' +
      [['summary', '概要'], ['log', '会话日志']].map(function (t) {
        return '<div class="tab' + (state.tab === t[0] ? ' active' : '') + '" data-t="' + t[0] + '">' + t[1] + '</div>';
      }).join('') +
    '</div>' +
    '<div class="id-body" id="id-body"></div>';
  panel.querySelector('.id-tabs').onclick = function (e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.tab = t.dataset.t;
    renderPanel();
  };
  const bodyEl = panel.querySelector('#id-body');
  if (state.tab === 'log') bodyEl.innerHTML = logTab(node, runNode);
  else bodyEl.innerHTML = summaryTab(node, st, runNode);
  if (confirmable) bindConfirm(node, runNode);
  panel.querySelectorAll('[data-md]').forEach(function (btn) {
    btn.onclick = function () { openMarkdownFull(btn.dataset.md); };
  });
}

/** 登记一段 Markdown 并渲染；「全屏」按钮按 key 取回原文。 */
function mdBlock(key, title, text) {
  state.md[key] = { title: title || '节点消息', text: String(text == null ? '' : text) };
  return '<div class="section-title">' + esc(title) + ' <span class="line"></span>' +
    '<button class="btn sm" data-md="' + key + '" title="在整屏中查看">' + icon('panel', 12) + '全屏</button></div>' +
    '<div class="md-body">' + renderMarkdown(text) + '</div>';
}

function closeMarkdownFull() {
  if (!state.full) return;
  state.full.close();
  state.full = null;
}

function openMarkdownFull(key) {
  const entry = state.md[key];
  if (!entry) return;
  closeMarkdownFull();
  const overlay = document.createElement('div');
  overlay.className = 'id-full';
  overlay.innerHTML = '<div class="id-full-head"><b>' + esc(entry.title) + '</b>' +
    '<button class="icon-btn" data-close title="关闭（Esc）">' + icon('x', 18) + '</button></div>' +
    '<div class="id-full-body"><div class="md-body">' + renderMarkdown(entry.text) + '</div></div>';
  document.body.appendChild(overlay);
  const onKey = function (e) { if (e.key === 'Escape') close(); };
  const close = function () {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    if (state.full && state.full.overlay === overlay) state.full = null;
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-close]').onclick = close;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  state.full = { overlay: overlay, close: close };
}

function summaryTab(node, st, runNode) {
  const meta = NODE_META[node.type] || { label: node.type };
  const expert = node.expertId ? state.experts.get(node.expertId) : null;
  const verdict = runNode && runNode.verdict;
  const rows = [
    ['状态', tag(st.label, st.key === 'succeeded' ? 'green' : st.key === 'failed' ? 'red' : st.key === 'rejected' ? 'purple' : st.key === 'waiting_confirm' ? 'orange' : st.key === 'dispatched' ? 'blue' : 'gray')],
    ['节点类型', esc(meta.label)],
    ['专家', expert ? '<span class="expert-dot" style="background:' + esc(expert.color) + ';width:16px;height:16px;font-size:9px;border-radius:4px">' + esc(String(expert.name).slice(0, 1)) + '</span> ' + esc(expert.name) : (node.expertId ? '<span class="mono">' + esc(node.expertId) + '</span>' : '—')],
    ['访问轮次', runNode ? '第 ' + esc(runNode.visit) + ' 轮' : '—'],
    ['任务 ID', runNode && runNode.taskId ? '<span class="mono">' + esc(runNode.taskId) + '</span>' : '—'],
    ['下发时间', esc(fmtTime(runNode && runNode.dispatchedAt))],
    ['完成时间', esc(fmtTime(runNode && runNode.finishedAt))],
    ['节点耗时', runNode && runNode.dispatchedAt ? esc(fmtMs(runNode.dispatchedAt, runNode.finishedAt)) : '—']
  ];
  let html = '<div class="id-node-h"><b>' + esc(node.name) + '</b>' + tag(meta.label, 'gray') + tag(st.label, 'gray') + '</div>' + DF.kv(rows);
  if (verdict) {
    html += '<div class="section-title">判定结论 <span class="line"></span></div>' +
      '<pre class="id-pre">' + esc(typeof verdict === 'string' ? verdict : JSON.stringify(verdict, null, 2)) + '</pre>';
  }
  if (runNode && runNode.message) html += mdBlock('node', '节点消息', runNode.message);
  if (runNode && runNode.error) {
    html += '<div class="section-title">错误 <span class="line"></span></div>' +
      '<pre class="id-pre id-pre-err">' + esc((runNode.error.code || '') + '：' + (runNode.error.message || '')) + '</pre>';
  }
  html += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn sm" disabled title="后端未提供节点重试能力">' + icon('retry', 12) + '重试节点</button>' +
    '<button class="btn sm" disabled title="后端未提供从节点重跑能力">' + icon('retry', 12) + '从此节点重跑</button>' +
    '</div>' +
    '<div class="sub" style="margin-top:10px">输入与输出、工作区文件留痕：当前执行面未提供对应端点。</div>';
  return html;
}

function logTab(node, runNode) {
  if (!runNode) return '<div class="sub" style="color:var(--t-3)">该节点尚未下发执行，暂无会话日志。</div>';
  if (!runNode.taskId) {
    return '<div class="sub" style="color:var(--t-3)">该节点没有执行会话（人工确认节点不产生会话日志）。</div>';
  }
  return '<div class="section-title">会话日志 <span class="line"></span></div>' +
    '<div class="sub" style="margin-bottom:10px">由执行节点上传的 gzip JSONL（<span class="mono">' + esc(runNode.taskId) + '</span>）。</div>' +
    '<a class="btn primary" href="' + esc(runs.sessionLogUrl(state.run.runId, node.id)) + '" download="session-' + esc(node.id) + '.ndjson.gz">' +
      icon('download', 14) + '下载会话日志</a>' +
    '<div class="sub" style="margin-top:8px">首次点击若提示 404，表示执行节点尚未上传该轮日志。</div>';
}

/* ---------------- 人工确认 ---------------- */

function confirmCard(node, runNode) {
  return '<div class="id-confirm-card">' +
    '<h4>' + icon('warn', 14) + ' 待人工确认 · ' + esc(node.name) + '</h4>' +
    (runNode.message ? mdBlock('confirm', '确认说明', runNode.message) : '<div class="sub">执行节点正在等待确认决策。</div>') +
    '<input class="inp" id="cf-comment" placeholder="审批意见（批准选填 / 驳回必填）" style="margin:8px 0">' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn primary" id="cf-ok">' + icon('check', 12) + '批准，继续执行</button>' +
      '<button class="btn danger" id="cf-no">' + icon('x', 12) + '驳回</button>' +
    '</div></div>';
}

function bindConfirm(node, runNode) {
  const ok = document.getElementById('cf-ok');
  const no = document.getElementById('cf-no');
  if (!ok || !no) return;
  const send = function (decision) {
    const comment = (document.getElementById('cf-comment').value || '').trim();
    if (decision === 'reject' && !comment) { DF.toast('驳回必须填写意见', 'err'); return; }
    ok.disabled = true; no.disabled = true;
    runs.decide(state.run.runId, node.id, { decision: decision, comment: comment || undefined }).then(function () {
      DF.toast(decision === 'pass' ? '已批准，流程继续' : '已驳回，流程回退', decision === 'pass' ? 'ok' : 'warn');
      load();
    }).catch(function (err) {
      ok.disabled = false; no.disabled = false;
      DF.toast(errorText(err), 'err');
    });
  };
  ok.onclick = function () { send('pass'); };
  no.onclick = function () { send('reject'); };
}

/* ---------------- 终止 ---------------- */

function stopRun() {
  DF.modal.confirm({
    title: '终止运行',
    html: '终止后<b>正在执行的节点将被取消</b>，运行进入「已终止」终态，不可恢复。',
    danger: true,
    okText: '终止'
  }).then(function (ok) {
    if (!ok) return;
    runs.cancel(state.run.runId).then(function () {
      DF.toast('运行已终止', 'warn');
      load();
    }).catch(function (err) {
      DF.toast(errorText(err), 'err');
    });
  });
}

/* ---------------- 启动 ---------------- */

function init() {
  state.runId = DF.qs('id');
  DF.renderShell({
    pendingCount: 0,
    active: 'instances',
    breadcrumb: [{ label: '运行与运营' }, { label: '运行实例', href: 'instances.html' }, { label: '运行详情' }],
    title: '运行详情',
    subtitle: '',
    actions: '<a class="btn" href="instances.html">' + icon('back', 14) + '返回列表</a>'
  });
  const body = document.getElementById('page-body');
  if (!state.runId) {
    body.innerHTML = '<div class="empty"><div class="e-ic">🗂</div>缺少运行 id<br><br><a class="btn" href="instances.html">← 返回运行实例</a></div>';
    return;
  }
  if (state.timer) clearTimeout(state.timer);
  window.addEventListener('beforeunload', function () { if (state.timer) clearTimeout(state.timer); });
  load();
}

init();
