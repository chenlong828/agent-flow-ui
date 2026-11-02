/** 工作流属性抽屉纯视图：节点/阶段/连线表单 HTML。 */
import { DF } from '../../ui.js';
import { NODE_META, NODE_TYPES, nodeName } from '../model.js';

const { esc, icon } = DF;

function field(label, inner, hint) { return DF.field(label, inner, { hint: hint }); }
function section(title, inner) { return '<div class="insp-sec"><div class="t">' + title + '</div>' + inner + '</div>'; }

function expertOptions(current, allowEmpty, experts) {
  const opts = (allowEmpty ? '<option value="">（未绑定）</option>' : '') + experts.map(function (e) {
    return '<option value="' + esc(e.id) + '"' + (e.id === current ? ' selected' : '') + '>' + esc(e.name) +
      (e.enabled === false ? '（已停用）' : '') + '</option>';
  }).join('');
  if (current && !experts.some(function (e) { return e.id === current; })) {
    return '<option value="' + esc(current) + '" selected>' + esc(current) + '（未在当前列表）</option>' + opts;
  }
  return opts;
}

function stageOptions(current, graph) {
  return '<option value="">（不属于阶段）</option>' + graph.stages.map(function (s) {
    return '<option value="' + esc(s.id) + '"' + (s.id === current ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');
}

export function nodeInspector(node, graph, experts) {
  const requires = node.type !== 'confirm';
  return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(node.name) + '</b> <span class="sub">' +
    esc((NODE_META[node.type] || {}).label) + '</span></div>' +
    section('基本信息',
      field('名称', '<input class="inp" id="if-name" maxlength="80" value="' + esc(node.name) + '">') +
      field('类型', '<select class="inp" id="if-type">' + NODE_TYPES.map(function (t) {
        return '<option value="' + t + '"' + (t === node.type ? ' selected' : '') + '>' + NODE_META[t].label + '</option>';
      }).join('') + '</select>') +
      field('所属阶段', '<select class="inp" id="if-stage">' + stageOptions(node.stageId, graph) + '</select>')) +
    section('专家绑定',
      field('绑定专家', '<select class="inp" id="if-expert"' + (requires ? '' : ' disabled') + '>' +
        expertOptions(node.expertId, !requires, experts) + '</select>',
      requires ? 'start/end/agent/review/fanout/fanin 必须绑定专家' : 'confirm 节点禁止绑定专家')) +
    '<button class="btn danger" id="if-del" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
}

export function edgeInspector(edge, graph) {
  return '<div class="card" style="padding:14px;margin-bottom:12px"><b>连线</b> <span class="sub">' +
    (edge.kind === 'rollback' ? '回退边' : '顺序边') + '</span></div>' +
    section('连线信息',
      '<div class="kv"><span class="k">起点</span><span>' + esc(nodeName(graph, edge.from)) + '</span>' +
      '<span class="k">终点</span><span>' + esc(nodeName(graph, edge.to)) + '</span></div>' +
      field('类型', '<select class="inp" id="if-kind"><option value="seq"' + (edge.kind === 'seq' ? ' selected' : '') + '>seq 顺序</option>' +
        '<option value="rollback"' + (edge.kind === 'rollback' ? ' selected' : '') + '>rollback 回退</option></select>')) +
    '<button class="btn danger" id="if-del" style="width:100%">' + icon('trash', 14) + '删除连线</button>';
}

export function stageInspector(stage) {
  return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(stage.name) + '</b> <span class="sub">阶段分组</span></div>' +
    section('阶段信息',
      field('阶段名称', '<input class="inp" id="if-sname" maxlength="80" value="' + esc(stage.name) + '">') +
      field('阶段描述', '<textarea class="inp" id="if-sdesc" rows="2" maxlength="500">' + esc(stage.description || '') + '</textarea>')) +
    section('尺寸',
      '<div class="grid2">' + field('宽', '<input class="inp" id="if-sw" type="number" min="120" value="' + stage.box.w + '">') +
      field('高', '<input class="inp" id="if-sh" type="number" min="80" value="' + stage.box.h + '">') + '</div>') +
    '<button class="btn danger" id="if-del" style="width:100%">' + icon('trash', 14) + '删除阶段</button>';
}
