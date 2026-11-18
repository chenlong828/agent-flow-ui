/**
 * 运行轨迹画布（只读）：阶段框、节点、边与点击命中。
 * 交互回调由页面注入；本文件不持有 state。
 */

import { DF } from '../../ui.js';
import { NODE_META, NODE_CLASS } from '../node-meta.js';

const { esc, icon } = DF;
const NODE_W = 168;
const NODE_H = 58;

function nodePos(node) {
  return { x: Number.isFinite(node.x) ? node.x : 60, y: Number.isFinite(node.y) ? node.y : 110 };
}

function canvasSize(graph) {
  let w = 640;
  let h = 360;
  graph.nodes.forEach(function (n) {
    const p = nodePos(n);
    w = Math.max(w, p.x + NODE_W + 120);
    h = Math.max(h, p.y + NODE_H + 120);
  });
  graph.stages.forEach(function (s) {
    if (s.box) { w = Math.max(w, s.box.x + s.box.w + 60); h = Math.max(h, s.box.y + s.box.h + 60); }
  });
  return { w: w, h: h };
}

function stagesHTML(graph) {
  return graph.stages.map(function (stage) {
    if (!stage.box) return '';
    const b = stage.box;
    return '<div class="cv-stage" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px">' +
      '<span class="stage-label">' + esc(stage.name) + '</span></div>';
  }).join('');
}

function nodesHTML(opts, graph) {
  return graph.nodes.map(function (n) {
    const p = nodePos(n);
    const st = opts.nodeState(n.id);
    const meta = NODE_META[n.type] || { label: n.type, cls: 't-plain' };
    const expert = n.expertId ? opts.experts.get(n.expertId) : null;
    const count = opts.visitCount(n.id);
    const sub = st.label + (st.visit > 1 ? ' · 第 ' + st.visit + ' 轮' : '');
    const hint = count > 1 ? '双击查看详情（共 ' + count + ' 轮）' : '双击查看详情';
    return '<div class="cv-node ' + meta.cls + ' ' + (NODE_CLASS[st.key] || 'st-pending') +
      (opts.selectedId === n.id ? ' sel' : '') + '" data-node="' + esc(n.id) + '" title="' + esc(hint) + '"' +
      ' style="left:' + p.x + 'px;top:' + p.y + 'px;cursor:pointer">' +
      '<div class="n-head"><span class="e-dot" style="background:' + (expert ? esc(expert.color) : '#94a3b8') + '"></span>' + esc(n.name) + '</div>' +
      '<div class="n-sub">' + esc(sub) + '</div>' +
      (expert ? '<div class="n-expert">' + icon('user', 10) + esc(expert.name) + '</div>' : '') +
      '</div>';
  }).join('');
}

function edgesHTML(graph) {
  let out = '';
  graph.edges.forEach(function (e) {
    const a = graph.nodes.find(function (n) { return n.id === e.from; });
    const b = graph.nodes.find(function (n) { return n.id === e.to; });
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
  const size = canvasSize(graph);
  return '<svg class="cv-edges" width="' + size.w + '" height="' + size.h + '">' + out + '</svg>';
}

export function paintCanvas(opts) {
  const graph = opts.graph;
  const canvas = opts.canvas;
  const size = canvasSize(graph);
  canvas.style.width = size.w + 'px';
  canvas.style.height = size.h + 'px';
  canvas.innerHTML = stagesHTML(graph) + edgesHTML(graph) + nodesHTML(opts, graph);
  canvas.onclick = function (e) {
    const el = e.target.closest('.cv-node');
    if (!el || opts.selectedId === el.dataset.node) return;
    opts.onSelect(el.dataset.node);
  };
  canvas.ondblclick = function (e) {
    const el = e.target.closest('.cv-node');
    if (el) opts.onOpen(el.dataset.node);
  };
}
