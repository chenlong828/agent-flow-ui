/**
 * 工作流编辑器（B3 live）
 *
 * 领域分层：model（图/ID/DSL）、validate（本地规则）、data（B3 读写）；
 * 本文件只做页面状态、画布/属性/DSL 三个视图与交互编排。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { createWorkflowData, errorText } from '../workflow/data.js';
import {
  NODE_META,
  deepClone,
  newId,
  toB3Graph,
  toDsl,
  toEditorGraph
} from '../workflow/model.js';
import { NODE_W, NODE_H, canvasSize, edgeSvg, nodeHtml, stageHtml } from '../workflow/views/canvas.js';
import { edgeInspector, nodeInspector, stageInspector } from '../workflow/views/inspector.js';
import { dslHtml } from '../workflow/views/dsl.js';
import {
  hasErrors,
  issueTarget,
  normalizeIssues,
  validateEditorGraph
} from '../workflow/validate.js';

const { esc, icon, toast } = DF;
const data = createWorkflowData();

const PALETTE = [
  { group: '基础', types: ['start', 'end', 'stage'] },
  { group: '执行', types: ['agent'] },
  { group: '控制', types: ['review', 'confirm'] },
  { group: '并行', types: ['fanout', 'fanin'] }
];

const state = {
  detail: null,
  graph: null,
  experts: [],
  expertError: '',
  sel: null,
  tab: 'canvas',
  dirty: false,
  saving: false,
  loading: true,
  fatal: '',
  originalName: '',
  errors: [],
  warnings: [],
  serverIssues: [],
  drag: null,
  seq: 0
};

let body = null;

function id() { return DF.qs('id'); }

function meta() {
  const nameInput = document.getElementById('we-name');
  return {
    name: nameInput ? nameInput.value.trim() : (state.detail ? state.detail.name : ''),
    type: state.detail ? state.detail.type : '',
    description: state.detail ? state.detail.description : ''
  };
}

function graphHasStart() { return state.graph.nodes.some(function (n) { return n.type === 'start'; }); }
function graphHasEnd() { return state.graph.nodes.some(function (n) { return n.type === 'end'; }); }

function expertOf(expertId) {
  return state.experts.find(function (e) { return e.id === expertId; }) || null;
}

function expertLabel(expertId) {
  if (!expertId) return '未绑定';
  const expert = expertOf(expertId);
  return expert ? expert.name + (expert.enabled === false ? '（停用）' : '') : expertId;
}

function refreshValidation() {
  if (!state.graph) return;
  const report = validateEditorGraph(state.graph, state.experts);
  state.errors = normalizeIssues(report.errors);
  state.warnings = normalizeIssues(report.warnings);
}

function hasServerIssues() { return state.serverIssues.length > 0; }

function allErrors() {
  return state.errors.concat(state.serverIssues);
}

function markDirty() {
  state.dirty = true;
  state.serverIssues = [];
  refreshValidation();
  renderHeader();
  renderIssues();
  paint();
}

function marked(type, value) {
  return allErrors().some(function (issue) {
    const target = issueTarget(issue.path, state.graph);
    return target && target.type === type && target.id === value;
  });
}

function graphLevelErrors() {
  return allErrors().filter(function (issue) {
    return issueTarget(issue.path, state.graph).type === 'graph';
  });
}

/* ---------------- 启动与载入 ---------------- */
async function init() {
  const workflowId = id();
  if (!workflowId) {
    state.loading = false;
    state.fatal = '缺少工作流 id。请从工作流列表进入编辑器，不会静默打开第一条。';
    renderFatal();
    return;
  }
  renderLoading();
  const seq = ++state.seq;
  try {
    const detail = await data.get(workflowId);
    if (seq !== state.seq) return;
    state.detail = detail;
    state.originalName = detail.name;
    state.graph = toEditorGraph(detail.graph);
    state.loading = false;
    state.fatal = '';
    renderShell();
    renderAll();
  } catch (err) {
    if (seq !== state.seq) return;
    state.loading = false;
    state.fatal = errorText(err);
    renderFatal();
    return;
  }
  try {
    const page = await API.list('expert', { limit: 200, offset: 0 });
    state.experts = (page.items || []).slice();
  } catch (err) {
    state.expertError = '专家列表加载失败，绑定存在性将由服务端校验';
    state.experts = [];
  }
  refreshValidation();
  renderAll();
}

function renderLoading() {
  DF.renderShell({
    pendingCount: 0,
    active: 'workflows',
    breadcrumb: [{ label: '流程研发' }, { label: '工作流', href: 'workflow-list.html' }, { label: '编辑器' }],
    title: '工作流编辑器',
    subtitle: '加载 B3 定义…'
  });
  body = document.getElementById('page-body');
  body.innerHTML = '<div class="loading" id="we-loading">正在加载工作流…</div>';
}

function renderFatal() {
  DF.renderShell({
    pendingCount: 0,
    active: 'workflows',
    breadcrumb: [{ label: '流程研发' }, { label: '工作流', href: 'workflow-list.html' }, { label: '编辑器' }],
    title: '工作流编辑器',
    subtitle: '无法加载'
  });
  body = document.getElementById('page-body');
  body.innerHTML = '<div class="empty" id="we-fatal"><div class="e-ic">' + icon('warn', 30) + '</div>' +
    '<div>' + esc(state.fatal) + '</div>' +
    '<div style="margin-top:12px"><a class="btn" href="workflow-list.html">返回工作流列表</a></div></div>';
}

function renderShell() {
  const name = state.detail ? state.detail.name : '';
  DF.renderShell({
    pendingCount: 0,
    active: 'workflows',
    breadcrumb: [{ label: '流程研发' }, { label: '工作流', href: 'workflow-list.html' }, { label: '编辑器' }],
    title: '工作流编辑器',
    subtitle: '编辑阶段、节点、边与专家绑定；只有合法图可保存',
    actions:
      '<input id="we-name" class="inp we-name" maxlength="80" value="' + esc(name) + '" title="工作流名称">' +
      '<span class="we-rev" id="we-state"></span>' +
      '<div class="seg" id="we-tab"><button data-t="canvas" class="on">画布</button><button data-t="dsl">DSL</button></div>' +
      '<button class="btn" id="we-validate">' + icon('check', 14) + '校验</button>' +
      '<button class="btn primary" id="we-save">' + icon('edit', 14) + '保存</button>'
  });
  body = document.getElementById('page-body');
  const nameInput = document.getElementById('we-name');
  nameInput.addEventListener('input', function () {
    state.dirty = true;
    renderHeader();
  });
  document.getElementById('we-tab').addEventListener('click', function (event) {
    const btn = event.target.closest('button[data-t]');
    if (!btn) return;
    state.tab = btn.getAttribute('data-t');
    document.querySelectorAll('#we-tab button').forEach(function (x) { x.classList.toggle('on', x === btn); });
    renderMain();
  });
  document.getElementById('we-validate').addEventListener('click', runValidate);
  document.getElementById('we-save').addEventListener('click', save);
  renderHeader();
}

function renderHeader() {
  const stateEl = document.getElementById('we-state');
  const saveBtn = document.getElementById('we-save');
  if (!stateEl || !saveBtn) return;
  const rev = state.detail ? state.detail.revision : '—';
  stateEl.textContent = (state.dirty ? '未保存 · ' : '已保存 · ') + 'r' + rev;
  stateEl.className = 'we-rev' + (state.dirty ? ' dirty' : '');
  saveBtn.disabled = state.saving || hasErrors({ errors: allErrors() });
}

function renderAll() {
  if (!state.graph) return;
  renderHeader();
  renderMain();
  renderIssues();
  renderInspector();
}

function renderMain() {
  if (state.tab === 'dsl') renderDsl();
  else renderCanvas();
}

function renderLayout() {
  body.innerHTML =
    '<div class="we-layout">' +
      '<div class="we-palette card" id="we-palette">' +
        PALETTE.map(function (group) {
          return '<div class="pg">' + group.group + '</div>' + group.types.map(function (type) {
            return '<div class="we-pitem" draggable="true" data-type="' + type + '">' +
              icon(type === 'stage' ? 'folder' : (NODE_META[type] || {}).icon || 'flow', 14) +
              (type === 'stage' ? '阶段分组' : NODE_META[type].label) + '</div>';
          }).join('');
        }).join('') +
      '</div>' +
      '<div class="we-canvas-col">' +
        '<div id="we-blocker" class="banner banner-fail" style="display:none"></div>' +
        '<div class="cv-wrap" id="cvWrap">' +
          '<div id="cvScaler"><div class="cv-canvas" id="cvCanvas"></div></div>' +
          '<div class="cv-toolbar">' +
            '<button id="z-out" title="缩小">−</button><span class="zoom-val" id="z-val"></span>' +
            '<button id="z-in" title="放大">+</button><button id="z-fit" title="适应画布">⤢</button>' +
          '</div>' +
        '</div>' +
        '<div class="we-issues card" id="we-issues"></div>' +
        '<div class="cv-legend">' +
          '<b>' + icon('user', 12) + ' 专家节点</b><b>' + icon('check', 12) + ' 评审节点</b><b>' + icon('warn', 12) + ' 人工确认</b>' +
          '<b>' + icon('flow', 12) + ' 并行网关</b><b>拖拽端口连线 · 拖动节点调整位置 · 点击节点在右侧编辑</b>' +
        '</div>' +
      '</div>' +
    '</div>';
  bindPalette();
  bindZoom();
  renderCanvas();
}

function renderCanvas() {
  const main = document.querySelector('.we-canvas-col');
  if (!main) { renderLayout(); return; }
  const wrap = document.getElementById('cvWrap');
  if (!wrap) { renderLayout(); return; }
  paint();
  bindCanvas();
}

/* ---------------- 画布绘制 ---------------- */
function paint() {
  const canvas = document.getElementById('cvCanvas');
  if (!canvas) return;
  const size = canvasSize(state.graph);
  const vp = state.graph.viewport;
  document.getElementById('z-val').textContent = Math.round(vp.zoom * 100) + '%';
  canvas.style.width = size.w + 'px';
  canvas.style.height = size.h + 'px';
  document.getElementById('cvScaler').style.transform = 'translate(' + vp.x + 'px,' + vp.y + 'px) scale(' + vp.zoom + ')';
  canvas.innerHTML = stageHtml(state.graph, state.sel, marked) + edgeSvg(state.graph, state.sel, marked) +
    nodeHtml(state.graph, state.sel, marked, expertOf);
  renderBlocker();
}

/* ---------------- 画布交互 ---------------- */
function toGraph(clientX, clientY) {
  const wrap = document.getElementById('cvWrap');
  const rect = wrap.getBoundingClientRect();
  const vp = state.graph.viewport;
  return { x: (clientX - rect.left - vp.x) / vp.zoom, y: (clientY - rect.top - vp.y) / vp.zoom };
}

function bindPalette() {
  const palette = document.getElementById('we-palette');
  if (!palette) return;
  palette.addEventListener('dragstart', function (event) {
    const item = event.target.closest('.we-pitem');
    if (item) event.dataTransfer.setData('text/plain', item.getAttribute('data-type'));
  });
  palette.addEventListener('click', function (event) {
    const item = event.target.closest('.we-pitem');
    if (!item) return;
    const wrap = document.getElementById('cvWrap');
    const rect = wrap.getBoundingClientRect();
    const p = toGraph(rect.left + rect.width / 2, rect.top + Math.min(220, rect.height / 2));
    addType(item.getAttribute('data-type'), p.x - NODE_W / 2, p.y - 20);
  });
}

function bindZoom() {
  document.getElementById('z-in').addEventListener('click', function () { zoomAt(1.1); });
  document.getElementById('z-out').addEventListener('click', function () { zoomAt(1 / 1.1); });
  document.getElementById('z-fit').addEventListener('click', fitCanvas);
  const wrap = document.getElementById('cvWrap');
  wrap.addEventListener('wheel', function (event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.08 : 1 / 1.08, event.clientX, event.clientY);
  }, { passive: false });
}

function zoomAt(factor, clientX, clientY) {
  const wrap = document.getElementById('cvWrap');
  const rect = wrap.getBoundingClientRect();
  const vp = state.graph.viewport;
  const oldZoom = vp.zoom;
  const newZoom = Math.max(0.35, Math.min(1.6, oldZoom * factor));
  if (clientX === undefined) { clientX = rect.left + rect.width / 2; clientY = rect.top + rect.height / 2; }
  const gx = (clientX - rect.left - vp.x) / oldZoom;
  const gy = (clientY - rect.top - vp.y) / oldZoom;
  vp.zoom = newZoom;
  vp.x = clientX - rect.left - gx * newZoom;
  vp.y = clientY - rect.top - gy * newZoom;
  paint();
}

function fitCanvas() {
  const wrap = document.getElementById('cvWrap');
  const size = canvasSize();
  const zoom = Math.max(0.35, Math.min(1.2, Math.min(wrap.clientWidth / (size.w + 80), wrap.clientHeight / (size.h + 80))));
  state.graph.viewport = { x: 20, y: 20, zoom: zoom };
  paint();
}

function bindCanvas() {
  const wrap = document.getElementById('cvWrap');
  if (!wrap || wrap.dataset.bound === '1') return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('dragover', function (event) { event.preventDefault(); });
  wrap.addEventListener('drop', function (event) {
    event.preventDefault();
    const type = event.dataTransfer.getData('text/plain');
    if (!type) return;
    const p = toGraph(event.clientX, event.clientY);
    addType(type, p.x - NODE_W / 2, p.y - 20);
  });
  wrap.addEventListener('mousedown', function (event) {
    const port = event.target.closest('.port');
    const stageLabel = event.target.closest('.stage-label');
    const nodeEl = event.target.closest('.cv-node');
    const stageEl = event.target.closest('.cv-stage');
    if (port) {
      const nid = port.getAttribute('data-node');
      state.drag = {
        mode: port.classList.contains('rb') ? 'rblink' : 'link',
        from: nid,
        temp: tempPath()
      };
      event.preventDefault();
    } else if (stageLabel) {
      const sid = stageLabel.getAttribute('data-stage');
      select({ type: 'stage', id: sid });
      const stage = state.graph.stages.find(function (s) { return s.id === sid; });
      state.drag = { mode: 'stage', id: sid, ox: event.clientX, oy: event.clientY, box: deepClone(stage.box) };
      event.preventDefault();
    } else if (nodeEl) {
      const nid = nodeEl.getAttribute('data-node');
      select({ type: 'node', id: nid });
      const node = state.graph.nodes.find(function (n) { return n.id === nid; });
      state.drag = { mode: 'node', id: nid, ox: event.clientX, oy: event.clientY, nx: node.x, ny: node.y, moved: false };
      event.preventDefault();
    } else if (stageEl) {
      select({ type: 'stage', id: stageEl.getAttribute('data-stage') });
    } else if (event.target.id === 'cvCanvas' || event.target.id === 'cvScaler' || event.target.id === 'cvWrap') {
      select(null);
      state.drag = { mode: 'pan', ox: event.clientX, oy: event.clientY, vx: state.graph.viewport.x, vy: state.graph.viewport.y };
    }
  });
  wrap.addEventListener('click', function (event) {
    const hit = event.target.closest('path.hit');
    if (hit) select({ type: 'edge', id: hit.getAttribute('data-edge') });
  });
  wrap.addEventListener('dblclick', function (event) {
    const hit = event.target.closest('path.hit');
    if (hit) select({ type: 'edge', id: hit.getAttribute('data-edge') });
  });
}

function tempPath() {
  const svg = document.querySelector('#cvCanvas svg.cv-edges');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('stroke', '#2563eb'); p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-dasharray', '5 3'); p.setAttribute('fill', 'none');
  svg.appendChild(p);
  return p;
}

document.addEventListener('mousemove', function (event) {
  const drag = state.drag;
  if (!drag) return;
  if (drag.mode === 'node') {
    const p0 = toGraph(drag.ox, drag.oy);
    const p1 = toGraph(event.clientX, event.clientY);
    const node = state.graph.nodes.find(function (n) { return n.id === drag.id; });
    node.x = Math.max(0, Math.round(drag.nx + p1.x - p0.x));
    node.y = Math.max(0, Math.round(drag.ny + p1.y - p0.y));
    drag.moved = true;
    paint();
  } else if (drag.mode === 'stage') {
    const p0 = toGraph(drag.ox, drag.oy);
    const p1 = toGraph(event.clientX, event.clientY);
    const stage = state.graph.stages.find(function (s) { return s.id === drag.id; });
    stage.box.x = Math.max(0, Math.round(drag.box.x + p1.x - p0.x));
    stage.box.y = Math.max(0, Math.round(drag.box.y + p1.y - p0.y));
    paint();
  } else if (drag.mode === 'pan') {
    const vp = state.graph.viewport;
    vp.x = drag.vx + event.clientX - drag.ox;
    vp.y = drag.vy + event.clientY - drag.oy;
    paint();
  } else if (drag.mode === 'link' || drag.mode === 'rblink') {
    const p = toGraph(event.clientX, event.clientY);
    drag.temp.setAttribute('d', 'M ' + p.x + ' ' + p.y + ' L ' + p.x + ' ' + p.y);
  }
});

document.addEventListener('mouseup', function (event) {
  const drag = state.drag;
  if (!drag) return;
  state.drag = null;
  if (drag.temp) drag.temp.remove();
  if (drag.mode === 'link' || drag.mode === 'rblink') {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const nodeEl = el && el.closest ? el.closest('.cv-node') : null;
    if (!nodeEl) return;
    const to = nodeEl.getAttribute('data-node');
    if (to === drag.from) return;
    createEdge(drag.from, to, drag.mode === 'rblink' ? 'rollback' : 'seq');
  } else if ((drag.mode === 'node' && drag.moved) || drag.mode === 'stage') {
    markDirty();
  }
});

document.addEventListener('keydown', function (event) {
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.sel &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    event.preventDefault();
    deleteSelected();
  }
});

window.addEventListener('beforeunload', function (event) {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '有未保存修改，确定离开？';
  return event.returnValue;
});

document.addEventListener('click', function (event) {
  const link = event.target.closest('a[href]');
  if (!link || !state.dirty || link.target === '_blank') return;
  if (!window.confirm('有未保存修改，确定离开当前编辑器？')) event.preventDefault();
});

function select(sel) {
  state.sel = sel;
  paint();
  renderInspector();
}

function addType(type, x, y) {
  if (type === 'stage') { addStage(x, y); return; }
  if (type === 'start' && graphHasStart()) { toast('只能有一个开始节点', 'warn'); return; }
  if (type === 'end' && graphHasEnd()) { toast('只能有一个结束节点', 'warn'); return; }
  const firstExpert = state.experts[0];
  const node = {
    id: newId('n'),
    type: type,
    name: (NODE_META[type] || {}).label || type,
    stageId: null,
    expertId: type === 'confirm' ? null : (firstExpert ? firstExpert.id : null),
    x: Math.max(0, Math.round(x || 80)),
    y: Math.max(0, Math.round(y || 80))
  };
  state.graph.nodes.push(node);
  state.sel = { type: 'node', id: node.id };
  markDirty();
  renderInspector();
  toast('已添加 ' + ((NODE_META[type] || {}).label || type), 'ok');
}

function addStage(x, y) {
  const stage = {
    id: newId('s'),
    name: '新阶段',
    description: '',
    box: { x: Math.max(0, Math.round(x || 60)), y: Math.max(0, Math.round(y || 60)), w: 460, h: 200 }
  };
  state.graph.stages.push(stage);
  state.sel = { type: 'stage', id: stage.id };
  markDirty();
  renderInspector();
}

function createEdge(from, to, kind) {
  if (from === to) return;
  const source = state.graph.nodes.find(function (n) { return n.id === from; });
  const target = state.graph.nodes.find(function (n) { return n.id === to; });
  if (!source || !target) return;
  if (kind === 'rollback') {
    if (source.type !== 'review' && source.type !== 'confirm') {
      toast('只有评审/人工确认节点可以发起回退', 'err');
      return;
    }
    state.graph.edges = state.graph.edges.filter(function (e) { return !(e.kind === 'rollback' && e.from === from); });
  } else {
    state.graph.edges = state.graph.edges.filter(function (e) {
      return !(e.kind === 'seq' && (e.from === from || e.to === to));
    });
  }
  const edge = { id: newId('e'), from: from, to: to, kind: kind };
  state.graph.edges.push(edge);
  state.sel = { type: 'edge', id: edge.id };
  markDirty();
}

function deleteSelected() {
  const sel = state.sel;
  if (!sel) return;
  if (sel.type === 'edge') {
    state.graph.edges = state.graph.edges.filter(function (e) { return e.id !== sel.id; });
    state.sel = null;
    markDirty();
    renderInspector();
  } else if (sel.type === 'node') {
    const node = state.graph.nodes.find(function (n) { return n.id === sel.id; });
    if (!node) return;
    DF.modal.confirm({
      title: '删除节点', danger: true, okText: '删除',
      html: '删除节点「' + esc(node.name) + '」及其所有连线？'
    }).then(function (ok) {
      if (!ok) return;
      state.graph.nodes = state.graph.nodes.filter(function (n) { return n.id !== node.id; });
      state.graph.edges = state.graph.edges.filter(function (e) { return e.from !== node.id && e.to !== node.id; });
      state.sel = null;
      markDirty();
      renderInspector();
    });
  } else if (sel.type === 'stage') {
    const stage = state.graph.stages.find(function (s) { return s.id === sel.id; });
    if (!stage) return;
    DF.modal.confirm({
      title: '删除阶段', danger: true, okText: '删除',
      html: '删除阶段「' + esc(stage.name) + '」？组内节点不会删除，只移出阶段。'
    }).then(function (ok) {
      if (!ok) return;
      state.graph.stages = state.graph.stages.filter(function (s) { return s.id !== stage.id; });
      state.graph.nodes.forEach(function (n) { if (n.stageId === stage.id) n.stageId = null; });
      state.sel = null;
      markDirty();
      renderInspector();
    });
  }
}

/* ---------------- 属性抽屉 ---------------- */
function renderInspector() {
  const existing = document.getElementById('we-inspector');
  if (state.tab !== 'canvas' || !state.sel) { if (existing) DF.drawer.close(); return; }
  let title = '';
  let html = '';
  if (state.sel.type === 'edge') {
    const edge = state.graph.edges.find(function (e) { return e.id === state.sel.id; });
    if (!edge) { if (existing) DF.drawer.close(); return; }
    title = '连线属性';
    html = edgeInspector(edge, state.graph);
  } else if (state.sel.type === 'stage') {
    const stage = state.graph.stages.find(function (s) { return s.id === state.sel.id; });
    if (!stage) { if (existing) DF.drawer.close(); return; }
    title = '阶段属性 · ' + stage.name;
    html = stageInspector(stage);
  } else {
    const node = state.graph.nodes.find(function (n) { return n.id === state.sel.id; });
    if (!node) { if (existing) DF.drawer.close(); return; }
    title = (NODE_META[node.type] || {}).label + '属性 · ' + node.name;
    html = nodeInspector(node, state.graph, state.experts);
  }
  if (!existing) {
    DF.drawer.open({
      title: title, width: 380, noOverlay: true,
      body: '<div id="we-inspector"></div>',
      footer: '<button class="btn" id="we-drawer-close">关闭</button><button class="btn primary" id="we-drawer-save">保存</button>',
      onClose: function () {
        if (state.sel) { state.sel = null; paint(); }
      }
    });
    const footerSave = document.getElementById('we-drawer-save');
    const footerClose = document.getElementById('we-drawer-close');
    if (footerSave) footerSave.onclick = save;
    if (footerClose) footerClose.onclick = function () { DF.drawer.close(); };
  } else {
    const head = existing.closest('.drawer').querySelector('.d-head');
    if (head) head.firstChild.textContent = title;
  }
  const box = document.getElementById('we-inspector');
  box.innerHTML = html;
  bindInspector();
}

function bindInspector() {
  const node = state.sel && state.sel.type === 'node' ? state.graph.nodes.find(function (n) { return n.id === state.sel.id; }) : null;
  const stage = state.sel && state.sel.type === 'stage' ? state.graph.stages.find(function (s) { return s.id === state.sel.id; }) : null;
  const edge = state.sel && state.sel.type === 'edge' ? state.graph.edges.find(function (e) { return e.id === state.sel.id; }) : null;
  if (node) {
    const name = document.getElementById('if-name');
    const type = document.getElementById('if-type');
    const stageSel = document.getElementById('if-stage');
    const expert = document.getElementById('if-expert');
    name.oninput = function () { node.name = name.value; state.dirty = true; refreshValidation(); renderHeader(); renderIssues(); paint(); };
    type.onchange = function () {
      node.type = type.value;
      if (node.type === 'confirm') node.expertId = null;
      state.dirty = true;
      refreshValidation();
      renderHeader();
      renderIssues();
      renderInspector();
      paint();
    };
    stageSel.onchange = function () { node.stageId = stageSel.value || null; state.dirty = true; refreshValidation(); renderHeader(); renderIssues(); paint(); };
    if (expert && !expert.disabled) expert.onchange = function () { node.expertId = expert.value || null; state.dirty = true; refreshValidation(); renderHeader(); renderIssues(); paint(); };
    document.getElementById('if-del').onclick = deleteSelected;
  } else if (stage) {
    const name = document.getElementById('if-sname');
    const desc = document.getElementById('if-sdesc');
    const width = document.getElementById('if-sw');
    const height = document.getElementById('if-sh');
    name.oninput = function () { stage.name = name.value; state.dirty = true; refreshValidation(); renderHeader(); paint(); };
    desc.oninput = function () { stage.description = desc.value; state.dirty = true; refreshValidation(); renderHeader(); paint(); };
    width.oninput = function () { stage.box.w = Math.max(120, Number(width.value) || 460); stage.box = stage.box; state.dirty = true; refreshValidation(); renderHeader(); paint(); };
    height.oninput = function () { stage.box.h = Math.max(80, Number(height.value) || 200); state.dirty = true; refreshValidation(); renderHeader(); paint(); };
    document.getElementById('if-del').onclick = deleteSelected;
  } else if (edge) {
    const kind = document.getElementById('if-kind');
    kind.onchange = function () { edge.kind = kind.value; state.dirty = true; refreshValidation(); renderHeader(); renderIssues(); paint(); };
    document.getElementById('if-del').onclick = deleteSelected;
  }
}

/* ---------------- 校验面板 ---------------- */
function renderBlocker() {
  const el = document.getElementById('we-blocker');
  if (!el) return;
  const blockers = graphLevelErrors();
  if (!blockers.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  el.innerHTML = '<b>图级阻断：</b>' + esc(blockers[0].message) +
    (blockers.length > 1 ? '（另有 ' + (blockers.length - 1) + ' 条）' : '');
}

function renderIssues() {
  const el = document.getElementById('we-issues');
  if (!el) return;
  const errors = allErrors();
  const warnings = state.warnings;
  const expertWarning = state.expertError
    ? '<div class="we-issue warn"><b>警告</b> ' + esc(state.expertError) + '</div>'
    : '';
  if (!errors.length && !warnings.length && !expertWarning) {
    el.innerHTML = '<div class="we-ok">' + icon('check', 14) + ' 校验通过，可以保存</div>';
    return;
  }
  const rows = [];
  errors.forEach(function (issue) {
    const target = issueTarget(issue.path, state.graph);
    rows.push('<div class="we-issue err" data-issue-type="' + target.type + '" data-issue-id="' + esc(target.id || '') + '">' +
      '<b>错误</b> ' + esc(issue.message) + ' <span class="mono">' + esc(issue.path) + '</span></div>');
  });
  warnings.forEach(function (issue) {
    rows.push('<div class="we-issue warn"><b>警告</b> ' + esc(issue.message) + ' <span class="mono">' + esc(issue.path) + '</span></div>');
  });
  el.innerHTML = expertWarning + rows.join('');
  el.querySelectorAll('[data-issue-type]').forEach(function (row) {
    row.addEventListener('click', function () {
      const type = row.getAttribute('data-issue-type');
      const targetId = row.getAttribute('data-issue-id');
      if (type === 'graph' || !targetId) return;
      select({ type: type, id: targetId });
    });
  });
}

async function runValidate() {
  refreshValidation();
  state.serverIssues = [];
  renderAll();
  if (hasErrors({ errors: state.errors })) {
    toast('本地校验发现 ' + state.errors.length + ' 个错误', 'err');
    return;
  }
  try {
    const report = await data.validate(state.detail.id, toB3Graph(state.graph));
    state.errors = normalizeIssues(report.errors);
    state.warnings = normalizeIssues(report.warnings);
    renderAll();
    toast(state.errors.length ? '服务端校验发现错误' : '校验通过', state.errors.length ? 'err' : 'ok');
  } catch (err) {
    toast(errorText(err), 'err');
  }
}

async function save() {
  if (state.saving) return;
  refreshValidation();
  state.serverIssues = [];
  if (hasErrors({ errors: state.errors })) {
    renderAll();
    toast('存在 ' + state.errors.length + ' 个校验错误，保存已阻止', 'err');
    return;
  }
  const nextMeta = meta();
  if (!nextMeta.name) {
    toast('工作流名称不能为空', 'warn');
    return;
  }
  if (nextMeta.name.length > 80) {
    toast('工作流名称不能超过 80 字', 'warn');
    return;
  }
  state.saving = true;
  renderHeader();
  try {
    let revision = state.detail.revision;
    if (nextMeta.name !== state.originalName || nextMeta.type !== state.detail.type || nextMeta.description !== state.detail.description) {
      const updated = await data.update(state.detail.id, revision, nextMeta);
      state.detail.name = updated.name;
      state.detail.type = updated.type;
      state.detail.description = updated.description;
      state.detail.revision = updated.revision;
      state.originalName = updated.name;
      revision = updated.revision;
    }
    const result = await data.save(state.detail.id, revision, toB3Graph(state.graph));
    state.detail = Object.assign({}, state.detail, result.workflow || {}, { graph: result.workflow ? result.workflow.graph : state.detail.graph });
    state.dirty = false;
    state.originalName = state.detail.name;
    state.serverIssues = [];
    state.warnings = normalizeIssues(result.warnings || []);
    state.saving = false;
    renderHeader();
    renderIssues();
    toast('已保存，revision ' + state.detail.revision, 'ok');
  } catch (err) {
    state.saving = false;
    if (err.issues && err.issues.length) {
      state.serverIssues = normalizeIssues(err.issues);
      toast('保存失败：' + err.issues.length + ' 个服务端错误', 'err');
    } else {
      toast(errorText(err), 'err');
    }
    renderHeader();
    renderIssues();
  }
}

/* ---------------- DSL 视图 ---------------- */
function renderDsl() {
  const main = document.querySelector('.we-canvas-col');
  if (!main) return;
  const text = JSON.stringify(toDsl(meta(), state.graph), null, 2);
  main.innerHTML = dslHtml(text);
  document.getElementById('dsl-copy').onclick = function () { DF.copyText(text); };
  document.getElementById('dsl-json').onclick = function () { exportDsl('json'); };
  document.getElementById('dsl-yaml').onclick = function () { exportDsl('yaml'); };
}

async function exportDsl(format) {
  try {
    const file = await data.exportDsl(state.detail.id, format);
    DF.download(file.filename, file.text, file.contentType);
    toast('已导出 B3 当前保存版本', 'ok');
  } catch (err) {
    toast(errorText(err), 'err');
  }
}

/* ---------------- 启动 ---------------- */
init();
