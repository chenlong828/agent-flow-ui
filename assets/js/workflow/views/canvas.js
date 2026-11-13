/** 工作流画布纯视图：把 editor graph 渲染为阶段/连线/节点 HTML。 */
import { DF } from '../../ui.js';
import { NODE_META, NODE_SIDES } from '../model.js';

const { esc, icon } = DF;
export const NODE_W = 168;
export const NODE_H = 58;

export function canvasSize(graph) {
  let w = 900, h = 520;
  graph.nodes.forEach(function (n) { w = Math.max(w, n.x + NODE_W + 160); h = Math.max(h, n.y + NODE_H + 160); });
  graph.stages.forEach(function (s) {
    if (s.box) { w = Math.max(w, s.box.x + s.box.w + 120); h = Math.max(h, s.box.y + s.box.h + 120); }
  });
  return { w: w, h: h };
}

export function stageHtml(graph, sel, marked) {
  return graph.stages.map(function (stage) {
    const box = stage.box || { x: 40, y: 40, w: 460, h: 200 };
    const selected = sel && sel.type === 'stage' && sel.id === stage.id;
    const bad = marked('stage', stage.id);
    return '<div class="cv-stage' + (selected ? ' stage-sel' : '') + (bad ? ' has-error' : '') + '" data-stage="' + esc(stage.id) + '"' +
      ' style="left:' + box.x + 'px;top:' + box.y + 'px;width:' + box.w + 'px;height:' + box.h + 'px">' +
      '<span class="stage-label" data-stage="' + esc(stage.id) + '" style="cursor:grab">' + esc(stage.name) +
      (stage.description ? '<span class="stage-note">' + esc(stage.description) + '</span>' : '') + '</span></div>';
  }).join('');
}

export function nodeHtml(graph, sel, marked, expertOf) {
  return graph.nodes.map(function (node) {
    const metaNode = NODE_META[node.type] || NODE_META.agent;
    const expert = expertOf(node.expertId);
    const selected = sel && sel.type === 'node' && sel.id === node.id;
    const bad = marked('node', node.id);
    let sub = '';
    if (node.type === 'confirm') sub = '等待人工确认';
    else if (node.type === 'agent') sub = expert ? expert.role || expert.name : '未绑定专家';
    else if (node.type === 'review') sub = '评审/校验';
    else if (node.type === 'split') sub = '拆分（产物 task.db）';
    else if (node.type === 'fanout') sub = '展开（前驱必须是 split）';
    else if (node.type === 'start') sub = '开始';
    else sub = '结束';
    return '<div class="cv-node ' + metaNode.cls + (selected ? ' sel' : '') + (bad ? ' has-error' : '') + '" data-node="' + esc(node.id) + '"' +
      ' style="left:' + node.x + 'px;top:' + node.y + 'px">' +
      NODE_SIDES.map(function (side) {
        return '<span class="port" data-node="' + esc(node.id) + '" data-side="' + side + '" title="拖拽连线"></span>';
      }).join('') +
      '<div class="n-head"><span class="e-dot" style="background:' + (expert && expert.color ? expert.color : '#94a3b8') + '"></span>' + esc(node.name) + '</div>' +
      '<div class="n-sub">' + esc(sub) + '</div>' +
      (expert ? '<div class="n-expert">' + icon('user', 10) + esc(expert.name) + '</div>' : '') +
      (node.type === 'review' || node.type === 'confirm' ? '<span class="port rb" data-node="' + esc(node.id) + '" title="拖拽绘制回退边"></span>' : '') +
      '</div>';
  }).join('');
}

export function portPos(node, side) {
  if (side === 'top') return { x: node.x + NODE_W / 2, y: node.y };
  if (side === 'bottom') return { x: node.x + NODE_W / 2, y: node.y + NODE_H };
  if (side === 'left') return { x: node.x, y: node.y + NODE_H / 2 };
  if (side === 'right') return { x: node.x + NODE_W, y: node.y + NODE_H / 2 };
  return { x: node.x + NODE_W - 22, y: node.y + NODE_H };
}

const SIDE_NORMALS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

/** 两个节点的缺省进出口：横向差更大走左右，否则走上下；平局取横向。 */
export function autoSides(a, b) {
  const dx = (b.x + NODE_W / 2) - (a.x + NODE_W / 2);
  const dy = (b.y + NODE_H / 2) - (a.y + NODE_H / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  }
  return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
}

function sideCurve(s, sSide, t, tSide) {
  const ns = SIDE_NORMALS[sSide] || SIDE_NORMALS.right;
  const nt = SIDE_NORMALS[tSide] || SIDE_NORMALS.left;
  const distance = Math.sqrt(Math.pow(t.x - s.x, 2) + Math.pow(t.y - s.y, 2));
  const k = Math.max(36, Math.min(180, distance * 0.45));
  return 'M ' + s.x + ' ' + s.y +
    ' C ' + (s.x + ns.x * k) + ' ' + (s.y + ns.y * k) +
    ', ' + (t.x + nt.x * k) + ' ' + (t.y + nt.y * k) +
    ', ' + t.x + ' ' + t.y;
}

/** 拖拽连线的橡皮筋预览：直线跟随指针，不套用边曲线的控制点。 */
export function linkPreviewPath(a, b) {
  return 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y;
}

function edgePath(a, b, kind) {
  if (kind === 'rollback') {
    const s = portPos(a, 'rb');
    const t = { x: b.x + NODE_W / 2, y: b.y + NODE_H };
    const sag = Math.max(70, Math.abs(s.y - t.y) * 0.2 + 60);
    return 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + sag) + ', ' + (t.x - 40) + ' ' + (t.y + sag) + ', ' + t.x + ' ' + t.y;
  }
  const auto = autoSides(a, b);
  const fromSide = a.outSide || auto.from;
  const toSide = b.inSide || auto.to;
  return sideCurve(portPos(a, fromSide), fromSide, portPos(b, toSide), toSide);
}

export function edgeSvg(graph, sel, marked) {
  const paths = [];
  const labels = [];
  graph.edges.forEach(function (edge) {
    const a = graph.nodes.find(function (n) { return n.id === edge.from; });
    const b = graph.nodes.find(function (n) { return n.id === edge.to; });
    if (!a || !b) return;
    const selected = sel && sel.type === 'edge' && sel.id === edge.id;
    const bad = marked('edge', edge.id);
    const cls = (edge.kind === 'rollback' ? 'e-rb' : 'e-seq') + (selected ? ' esel' : '') + (bad ? ' has-error' : '');
    const d = edgePath(a, b, edge.kind);
    paths.push('<path class="' + cls + '" d="' + d + '"/><path class="hit" data-edge="' + esc(edge.id) + '" d="' + d + '"/>');
    if (edge.kind === 'rollback') {
      labels.push('<text class="edge-label" x="' + (a.x + NODE_W / 2) + '" y="' + (Math.max(a.y, b.y) + NODE_H + 26) + '" text-anchor="middle">↺ 回退</text>');
    }
  });
  return '<svg class="cv-edges" width="100%" height="100%">' +
    '<defs><marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">' +
    '<path d="M0 0L8 4L0 8" fill="#94a3b8"/></marker></defs>' +
    paths.join('').replace(/class="e-seq"/g, 'class="e-seq" marker-end="url(#arw)"') +
    '<path class="cv-link-preview" d=""/>' + labels.join('') + '</svg>';
}
