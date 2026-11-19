/** 工作流画布纯视图：把 editor graph 渲染为阶段/连线/节点 HTML。 */
import { DF } from '../../ui.js';
import { NODE_META } from '../model.js';
import {
  NODE_SIDES,
  edgeMarkers,
  edgePath,
  edgeSides,
  rollbackLabelPos
} from '../../shared/canvas-geometry.js';

const { esc, icon } = DF;

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

/** 拖拽连线的橡皮筋预览：直线跟随指针，不套用边曲线的控制点。 */
export function linkPreviewPath(a, b) {
  return 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y;
}

export function edgeSvg(graph, sel, marked) {
  const paths = [];
  const labels = [];
  const sides = edgeSides(graph);
  graph.edges.forEach(function (edge) {
    const a = graph.nodes.find(function (n) { return n.id === edge.from; });
    const b = graph.nodes.find(function (n) { return n.id === edge.to; });
    if (!a || !b) return;
    const selected = sel && sel.type === 'edge' && sel.id === edge.id;
    const bad = marked('edge', edge.id);
    const cls = (edge.kind === 'rollback' ? 'e-rb' : 'e-seq') + (selected ? ' esel' : '') + (bad ? ' has-error' : '');
    const marker = edge.kind === 'rollback' ? 'arw-rb' : 'arw';
    const d = edgePath(a, b, edge.kind, sides.get(edge.id));
    paths.push('<path class="' + cls + '" d="' + d + '" marker-end="url(#' + marker + ')"/><path class="hit" data-edge="' + esc(edge.id) + '" d="' + d + '"/>');
    if (edge.kind === 'rollback') {
      const pos = rollbackLabelPos(a, b);
      labels.push('<text class="edge-label" x="' + pos.x + '" y="' + pos.y + '" text-anchor="middle">↺ 回退</text>');
    }
  });
  return '<svg class="cv-edges" width="100%" height="100%">' +
    edgeMarkers() +
    paths.join('') +
    '<path class="cv-link-preview" d=""/>' + labels.join('') + '</svg>';
}
