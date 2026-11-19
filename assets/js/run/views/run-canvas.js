/**
 * 运行轨迹画布（只读）：阶段框、节点、边与点击命中。
 * 交互回调由页面注入；本文件不持有 state。
 *
 * 连线几何与编辑器共用 `shared/canvas-geometry`，并按 `graph.viewport` 呈现；
 * 节点 HTML 与状态着色仍归运行页。
 */

import { DF } from '../../ui.js';
import { NODE_META, NODE_CLASS } from '../node-meta.js';
import {
  canvasSize,
  edgeMarkers,
  edgePath,
  edgeSides,
  rollbackLabelPos,
  viewportTransform
} from '../../shared/canvas-geometry.js';

const { esc, icon } = DF;

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
    const st = opts.nodeState(n.id);
    const meta = NODE_META[n.type] || { label: n.type, cls: 't-plain' };
    const expert = n.expertId ? opts.experts.get(n.expertId) : null;
    const count = opts.visitCount(n.id);
    const sub = st.label + (st.visit > 1 ? ' · 第 ' + st.visit + ' 轮' : '');
    const hint = count > 1 ? '双击查看详情（共 ' + count + ' 轮）' : '双击查看详情';
    return '<div class="cv-node ' + meta.cls + ' ' + (NODE_CLASS[st.key] || 'st-pending') +
      (opts.selectedId === n.id ? ' sel' : '') + '" data-node="' + esc(n.id) + '" title="' + esc(hint) + '"' +
      ' style="left:' + n.x + 'px;top:' + n.y + 'px;cursor:pointer">' +
      '<div class="n-head"><span class="e-dot" style="background:' + (expert ? esc(expert.color) : '#94a3b8') + '"></span>' + esc(n.name) + '</div>' +
      '<div class="n-sub">' + esc(sub) + '</div>' +
      (expert ? '<div class="n-expert">' + icon('user', 10) + esc(expert.name) + '</div>' : '') +
      '</div>';
  }).join('');
}

function edgesHTML(graph) {
  const size = canvasSize(graph);
  const sides = edgeSides(graph);
  let paths = '';
  let labels = '';
  graph.edges.forEach(function (e) {
    const a = graph.nodes.find(function (n) { return n.id === e.from; });
    const b = graph.nodes.find(function (n) { return n.id === e.to; });
    if (!a || !b) return;
    const rollback = e.kind === 'rollback';
    const d = edgePath(a, b, e.kind, sides.get(e.id));
    paths += '<path class="' + (rollback ? 'e-rb' : 'e-seq') + '" d="' + d + '" marker-end="url(#' + (rollback ? 'arw-rb' : 'arw') + ')"/>';
    if (rollback) {
      const pos = rollbackLabelPos(a, b);
      labels += '<text class="edge-label" x="' + pos.x + '" y="' + pos.y + '" text-anchor="middle">↺ 回退</text>';
    }
  });
  return '<svg class="cv-edges" width="' + size.w + '" height="' + size.h + '">' + edgeMarkers() + paths + labels + '</svg>';
}

export function paintCanvas(opts) {
  const graph = opts.graph;
  const canvas = opts.canvas;
  const size = canvasSize(graph);
  canvas.style.width = size.w + 'px';
  canvas.style.height = size.h + 'px';
  opts.scaler.style.transform = viewportTransform(graph.viewport);
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
