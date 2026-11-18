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
import { fmtMs } from '../run/format.js';
import { nodeModalTitle, roundsHTML, summaryTab, logTab, confirmCard } from '../run/node-view.js';
import { paintCanvas } from '../run/views/run-canvas.js';
import { mountRunFiles } from '../run/views/files.js';
import { mountRunSession } from '../run/views/session.js';
import {
  createRunData,
  errorText,
  RUN_STATE,
  RUN_OUTCOME,
  NODE_STATE,
  ARCHIVE_STATE,
  ACTIVE_STATES
} from '../run/data.js';

const { esc, icon, tag, dot } = DF;
const runs = createRunData();
const workflows = createWorkflowData();

const POLL_MS = 5000;

const state = {
  runId: null,
  run: null,
  workflow: null,
  graph: null,
  experts: new Map(),
  nodeVisits: new Map(),
  selectedId: null,
  loading: true,
  error: null,
  timer: null,
  version: 0,
  pending: 0,
  modal: null,
  filesModal: null
};

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
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
    /* 同一节点可执行多轮（重新进入 / 打回重跑）：保留每一轮，按 visit 倒序。
     * 画布着色只用最新一轮；弹层用轮次 Tab 切换，历史轮次只读。 */
    state.nodeVisits = new Map();
    (run.nodes || []).forEach(function (node) {
      const visit = Number(node.visit) || 1;
      const list = state.nodeVisits.get(node.nodeId) || [];
      const same = list.findIndex(function (item) { return (Number(item.visit) || 1) === visit; });
      if (same >= 0) list[same] = node;
      else list.push(node);
      state.nodeVisits.set(node.nodeId, list);
    });
    state.nodeVisits.forEach(function (list) {
      list.sort(function (a, b) { return (Number(b.visit) || 1) - (Number(a.visit) || 1); });
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

function renderLoading(body) {
  body.innerHTML = '<div class="loading">正在加载运行详情…</div>';
}

function renderError(body) {
  const notFound = state.error.status === 404;
  body.innerHTML = '<div class="empty"><div class="e-ic">🗂</div>' +
    (notFound ? '运行不存在或已删除' : esc(errorText(state.error))) + '<br><br>' +
    (notFound ? '' : '<button class="btn primary" id="id-retry">重试</button> ') +
    '<a class="btn" href="instances.html">← 返回运行实例</a></div>';
  const retry = document.getElementById('id-retry');
  if (retry) retry.onclick = load;
}

function headerActions(run, active) {
  return stateTag(run) +
    '<span class="sub" style="margin:0 10px">耗时 ' + esc(fmtMs(run.startedAt, run.finishedAt)) + '</span>' +
    '<button class="btn" id="id-files">' + icon('folder', 14) + '任务文件</button>' +
    '<button class="btn" id="id-pause" disabled title="后端未提供暂停能力">' + icon('pause', 14) + '暂停</button>' +
    '<button class="btn" id="id-resume" disabled title="后端未提供恢复能力">' + icon('play', 14) + '恢复</button>' +
    '<button class="btn" id="id-rerun" disabled title="后端未提供从节点重跑能力">' + icon('retry', 14) + '从节点重跑</button>' +
    (active ? '<button class="btn danger" id="id-stop">' + icon('stop', 14) + '终止</button>' : '');
}

function shellOptions(run, active) {
  const wfName = state.workflow ? state.workflow.name : shortId(run.workflowId);
  return {
    pendingCount: state.pending,
    active: 'instances',
    breadcrumb: [{ label: '运行与运营' }, { label: '运行实例', href: 'instances.html' }, { label: shortId(run.runId) }],
    title: shortId(run.runId) + ' · ' + wfName + ' r' + run.workflowRevision,
    subtitle: '执行节点 ' + (run.clientId || '—') + ' · 工作区 ' + (run.workspacePath || '—') +
      (run.archiveState && run.archiveState !== 'none' ? ' · ' + (ARCHIVE_STATE[run.archiveState] || run.archiveState) : ''),
    actions: headerActions(run, active)
  };
}

function traceHTML() {
  return '<div class="id-layout">' +
    '<div class="id-trace"><div class="cv-wrap" id="cvWrap"><div class="cv-canvas" id="cvCanvas"></div></div>' +
      '<div class="cv-legend">' +
        '<b>' + dot('green') + '成功</b><b>' + dot('blue') + '运行中</b><b>' + dot('orange') + '等待人工</b>' +
        '<b>' + dot('red') + '失败</b><b>' + dot('purple') + '已驳回</b><b>' + dot('gray') + '待执行</b>' +
        '<b>双击节点查看详情</b></div>' +
    '</div>' +
  '</div>';
}

function render() {
  let body = document.getElementById('page-body');
  if (!body) return;
  if (state.loading) { renderLoading(body); return; }
  if (state.error) { renderError(body); return; }
  const run = state.run;
  const active = ACTIVE_STATES.indexOf(run.state) >= 0;
  DF.renderShell(shellOptions(run, active));
  const stop = document.getElementById('id-stop');
  if (stop) stop.onclick = stopRun;
  const filesBtn = document.getElementById('id-files');
  if (filesBtn) filesBtn.onclick = openRunFilesModal;
  body = document.getElementById('page-body');
  body.innerHTML = traceHTML();
  paint();
  if (state.modal) syncNodeModal();
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

function visitList(nodeId) {
  return state.nodeVisits.get(nodeId) || [];
}

function latestVisit(nodeId) {
  return visitList(nodeId)[0] || null;
}

function findVisit(nodeId, visit) {
  return visitList(nodeId).find(function (item) { return (Number(item.visit) || 1) === Number(visit); }) || null;
}

function visitState(record) {
  if (!record) return { key: 'pending', label: '待执行', visit: 0, run: null };
  return {
    key: record.state,
    label: NODE_STATE[record.state] || record.state,
    visit: Number(record.visit) || 1,
    run: record
  };
}

function nodeState(nodeId) {
  return visitState(latestVisit(nodeId));
}

function paint() {
  paintCanvas({
    canvas: document.getElementById('cvCanvas'),
    graph: state.graph,
    experts: state.experts,
    selectedId: state.selectedId,
    nodeState: nodeState,
    visitCount: function (id) { return visitList(id).length; },
    onSelect: function (id) { state.selectedId = id; paint(); },
    onOpen: function (id) { state.selectedId = id; paint(); openNodeModal(id); }
  });
}

/* ---------------- 节点详情弹层 ---------------- */

function selectedNode() {
  return state.graph && state.selectedId
    ? state.graph.nodes.find(function (n) { return n.id === state.selectedId; }) || null
    : null;
}

const MODAL_TABS = [['summary', '概要'], ['files', '文件'], ['session', '执行会话'], ['log', '会话日志']];

function closeNodeModal() {
  if (!state.modal) return;
  const handle = state.modal.handle;
  handle.close();
  if (state.modal && state.modal.handle === handle) {
    unmountModalViews();
    state.modal = null;
  }
}

function modalBodyHTML() {
  return '<div id="id-modal-body">' +
    '<div id="id-rounds"></div>' +
    '<div id="id-confirm"></div>' +
    '<div class="id-tabs" id="id-tabs">' +
      MODAL_TABS.map(function (t) {
        return '<div class="tab' + (t[0] === 'summary' ? ' active' : '') + '" data-t="' + t[0] + '">' + t[1] + '</div>';
      }).join('') +
    '</div>' +
    '<div class="id-body" id="id-body">' +
      '<div class="id-panel" data-panel="summary"></div>' +
      '<div class="id-panel" data-panel="log"></div>' +
      '<div class="id-panel" data-panel="files"></div>' +
      '<div class="id-panel" data-panel="session"></div>' +
    '</div>' +
  '</div>';
}

/** 双击节点打开 90% × 90% 弹层；骨架只建一次，轮询只同步内容，不重建文件/会话面板。 */
function openNodeModal(nodeId) {
  const node = state.graph && state.graph.nodes.find(function (n) { return n.id === nodeId; });
  if (!node) return;
  if (state.modal && state.modal.nodeId === node.id) return;
  if (state.modal) {
    const old = state.modal;
    state.modal = null;
    if (old.handle) old.handle.close();
    unmountModalViews(old);
  }
  state.selectedId = node.id;
  const latest = latestVisit(node.id);
  const modal = {
    nodeId: node.id,
    visit: latest ? (Number(latest.visit) || 1) : null,
    followLatest: true,
    tab: 'summary',
    handle: null,
    filesState: { root: 'task-space', path: '', selectedPath: null },
    filesView: null,
    sessionView: null,
    sessionVisit: null,
    roundsKey: '',
    confirmKey: ''
  };
  state.modal = modal;
  modal.handle = DF.modal.open({
    title: nodeModalTitle(node, latest, true, visitList(node.id).length),
    size: 'screen',
    body: modalBodyHTML(),
    footer: '<button class="btn" id="id-modal-close">关闭</button>',
    onMount: function (body, close) {
      const btn = body.closest('.modal').querySelector('#id-modal-close');
      if (btn) btn.onclick = close;
      bindModalShell(body);
    },
    onClose: function () {
      unmountModalViews(modal);
      if (state.modal === modal) state.modal = null;
    }
  });
  syncNodeModal();
}

function bindModalShell(body) {
  body.querySelector('#id-tabs').onclick = function (e) {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    switchModalTab(tab.dataset.t);
  };
  body.querySelector('#id-rounds').onclick = function (e) {
    const btn = e.target.closest('.id-round-tab');
    const modal = state.modal;
    if (!btn || !modal) return;
    const visit = Number(btn.dataset.visit);
    const visits = visitList(modal.nodeId);
    modal.visit = visit;
    modal.followLatest = visits.length > 0 && visit === (Number(visits[0].visit) || 1);
    syncNodeModal();
  };
  body.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="open-files"]')) switchModalTab('files');
  });
}

function unmountModalViews(modal) {
  modal = modal || state.modal;
  if (!modal) return;
  if (modal.filesView) { modal.filesView.unmount(); modal.filesView = null; }
  if (modal.sessionView) { modal.sessionView.unmount(); modal.sessionView = null; modal.sessionVisit = null; }
}

function switchModalTab(tab) {
  const modal = state.modal;
  if (!modal || modal.tab === tab) return;
  if (modal.tab === 'files' && modal.filesView) {
    modal.filesState = modal.filesView.getState();
    modal.filesView.unmount();
    modal.filesView = null;
  }
  if (modal.tab === 'session' && modal.sessionView) {
    modal.sessionView.unmount();
    modal.sessionView = null;
    modal.sessionVisit = null;
  }
  modal.tab = tab;
  syncNodeModal();
}

function resolveModal(modal) {
  const node = selectedNode();
  if (!node) return null;
  const visits = visitList(node.id);
  if (modal.followLatest && visits.length) {
    modal.visit = Number(visits[0].visit) || 1;
  }
  let runNode = visits.length ? findVisit(node.id, modal.visit) : null;
  if (visits.length && !runNode) {
    runNode = visits[0];
    modal.visit = Number(runNode.visit) || 1;
    modal.followLatest = true;
  }
  const st = visitState(runNode);
  const isLatest = !runNode || (Number(runNode.visit) || 1) === (Number(visits[0].visit) || 1);
  return {
    node: node,
    visits: visits,
    runNode: runNode,
    st: st,
    isLatest: isLatest,
    confirmable: !!runNode && isLatest && runNode.state === 'waiting_confirm',
    title: nodeModalTitle(node, runNode, isLatest, visits.length)
  };
}

function renderModalChrome(modal, host, resolved) {
  const root = host.closest('.modal');
  const head = root ? root.querySelector('.d-head') : null;
  if (head && head.firstChild) head.firstChild.textContent = resolved.title;
  const roundsKey = resolved.visits.map(function (v) {
    return (Number(v.visit) || 1) + ':' + v.state;
  }).join('|') + '@' + modal.visit;
  if (roundsKey !== modal.roundsKey) {
    modal.roundsKey = roundsKey;
    host.querySelector('#id-rounds').innerHTML = roundsHTML(resolved.visits, modal.visit);
  }
  const confirmKey = resolved.confirmable
    ? resolved.runNode.state + '|' + (resolved.runNode.message || '') + '|' + (Number(resolved.runNode.visit) || 1)
    : 'none';
  if (confirmKey !== modal.confirmKey) {
    modal.confirmKey = confirmKey;
    const slot = host.querySelector('#id-confirm');
    slot.innerHTML = resolved.confirmable ? confirmCard(resolved.node, resolved.runNode) : '';
    if (resolved.confirmable) bindConfirm(resolved.node);
  }
  host.querySelectorAll('#id-tabs .tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.t === modal.tab);
  });
  host.querySelectorAll('.id-panel').forEach(function (panel) {
    panel.classList.toggle('on', panel.dataset.panel === modal.tab);
  });
}

function renderModalPanels(modal, host, resolved) {
  const historyNote = resolved.runNode && resolved.visits.length > 1 && !resolved.isLatest
    ? '<div class="id-history-note">历史轮次 · 第 ' + (Number(resolved.runNode.visit) || 1) + ' 轮（仅查看）；人工确认与操作入口在「最新」轮次。</div>'
    : '';
  const summaryPanel = host.querySelector('[data-panel="summary"]');
  const logPanel = host.querySelector('[data-panel="log"]');
  summaryPanel.innerHTML = modal.tab === 'summary'
    ? historyNote + summaryTab(resolved.node, resolved.st, resolved.runNode, { isLatest: resolved.isLatest, count: resolved.visits.length }, state.experts)
    : '';
  logPanel.innerHTML = modal.tab === 'log'
    ? historyNote + logTab(resolved.node, resolved.runNode, state.run.runId, runs.sessionLogUrl)
    : '';

  if (modal.tab === 'files') {
    if (!modal.filesView) {
      modal.filesView = mountRunFiles(host.querySelector('[data-panel="files"]'), {
        runId: state.run.runId,
        root: modal.filesState.root,
        path: modal.filesState.path,
        selectedPath: modal.filesState.selectedPath
      });
    }
  } else if (modal.filesView) {
    modal.filesState = modal.filesView.getState();
    modal.filesView.unmount();
    modal.filesView = null;
  }

  if (modal.tab === 'session') {
    if (!modal.sessionView || modal.sessionVisit !== modal.visit) {
      if (modal.sessionView) modal.sessionView.unmount();
      modal.sessionView = mountRunSession(host.querySelector('[data-panel="session"]'), {
        runId: state.run.runId,
        nodeId: resolved.node.id,
        visit: modal.visit
      });
      modal.sessionVisit = modal.visit;
    }
  } else if (modal.sessionView) {
    modal.sessionView.unmount();
    modal.sessionView = null;
    modal.sessionVisit = null;
  }
}

function syncNodeModal() {
  const modal = state.modal;
  const host = document.getElementById('id-modal-body');
  if (!modal || !host) return;
  const resolved = resolveModal(modal);
  if (!resolved) { closeNodeModal(); return; }
  renderModalChrome(modal, host, resolved);
  renderModalPanels(modal, host, resolved);
}

/** 页头「任务文件」：独立 90% 弹层，只挂文件视图；与节点弹层共用同一个只读组件。 */
function openRunFilesModal() {
  if (!state.run || state.filesModal) return;
  const box = { handle: null, view: null };
  state.filesModal = box;
  box.handle = DF.modal.open({
    title: '任务文件 · ' + shortId(state.run.runId),
    size: 'screen',
    body: '<div id="id-run-files"></div>',
    footer: '<button class="btn" id="id-files-close">关闭</button>',
    onMount: function (body, close) {
      const btn = body.closest('.modal').querySelector('#id-files-close');
      if (btn) btn.onclick = close;
      box.view = mountRunFiles(body.querySelector('#id-run-files'), { runId: state.run.runId });
    },
    onClose: function () {
      if (state.filesModal !== box) return;
      if (box.view) box.view.unmount();
      box.view = null;
      state.filesModal = null;
    }
  });
}

function bindConfirm(node) {
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
