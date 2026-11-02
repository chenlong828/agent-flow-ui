/**
 * 工作流本地校验（L1）
 *
 * 镜像 B3 `graph.ts` 的形状、拓扑、绑定规则，供编辑器实时反馈与保存前置检查；
 * 服务端仍是唯一权威。这里不推断 layout/viewport 语义，只检查对象形状。
 */

import {
  EDGE_KINDS,
  ID_PATTERN,
  MAX_EDGES,
  MAX_NODES,
  MAX_STAGES,
  NODE_TYPES,
  UUID_PATTERN,
  isObject,
  toB3Graph
} from './model.js';

function push(issues, code, path, message) {
  issues.push({ code: code, path: path, message: message });
}

function unknownFields(value, allowed, path, issues) {
  Object.keys(value).forEach(function (key) {
    if (allowed.indexOf(key) < 0) push(issues, 'graph_shape', path + '.' + key, '未知字段');
  });
}

function nodePath(index) {
  return 'graph.nodes[' + index + ']';
}
function edgePath(index) {
  return 'graph.edges[' + index + ']';
}
function stagePath(index) {
  return 'graph.stages[' + index + ']';
}

export function shapeIssues(graph) {
  const issues = [];
  if (!isObject(graph)) {
    push(issues, 'graph_shape', 'graph', '必须是对象');
    return issues;
  }
  unknownFields(graph, ['stages', 'nodes', 'edges', 'viewport'], 'graph', issues);
  ['stages', 'nodes', 'edges'].forEach(function (key) {
    if (!Array.isArray(graph[key])) push(issues, 'graph_shape', 'graph.' + key, '必须是数组');
  });
  if (!Array.isArray(graph.stages) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return issues;
  if (graph.stages.length > MAX_STAGES) push(issues, 'graph_too_large', 'graph.stages', '不能超过 ' + MAX_STAGES + ' 个');
  if (graph.nodes.length > MAX_NODES) push(issues, 'graph_too_large', 'graph.nodes', '不能超过 ' + MAX_NODES + ' 个');
  if (graph.edges.length > MAX_EDGES) push(issues, 'graph_too_large', 'graph.edges', '不能超过 ' + MAX_EDGES + ' 条');

  const stageIds = new Set();
  graph.stages.forEach(function (stage, index) {
    const p = stagePath(index);
    if (!isObject(stage)) { push(issues, 'graph_shape', p, '必须是对象'); return; }
    unknownFields(stage, ['id', 'name', 'description', 'layout'], p, issues);
    if (typeof stage.id !== 'string' || !ID_PATTERN.test(stage.id)) push(issues, 'invalid_id', p + '.id', '必须是 1–64 位字母、数字、下划线或连字符');
    else if (stageIds.has(stage.id)) push(issues, 'duplicate_id', p + '.id', '阶段 ID ' + stage.id + ' 重复');
    else stageIds.add(stage.id);
    if (typeof stage.name !== 'string' || stage.name.trim() === '') push(issues, 'graph_shape', p + '.name', '必须是非空字符串');
    else if (stage.name.length > 80) push(issues, 'graph_shape', p + '.name', '不能超过 80 字');
    if (stage.description !== undefined && (typeof stage.description !== 'string' || stage.description.length > 500)) {
      push(issues, 'graph_shape', p + '.description', '必须是不超过 500 字的字符串');
    }
    if (stage.layout !== undefined) {
      if (!isObject(stage.layout)) push(issues, 'invalid_layout', p + '.layout', '必须是对象');
      else {
        if (!Number.isFinite(stage.layout.x) || !Number.isFinite(stage.layout.y)) push(issues, 'invalid_layout', p + '.layout', 'x/y 必须是数字');
        if (stage.layout.width !== undefined && !Number.isFinite(stage.layout.width)) push(issues, 'invalid_layout', p + '.layout.width', 'width 必须是数字');
        if (stage.layout.height !== undefined && !Number.isFinite(stage.layout.height)) push(issues, 'invalid_layout', p + '.layout.height', 'height 必须是数字');
      }
    }
  });

  const nodeIds = new Set();
  graph.nodes.forEach(function (node, index) {
    const p = nodePath(index);
    if (!isObject(node)) { push(issues, 'graph_shape', p, '必须是对象'); return; }
    unknownFields(node, ['id', 'type', 'name', 'stageId', 'expertId', 'layout'], p, issues);
    if (typeof node.id !== 'string' || !ID_PATTERN.test(node.id)) push(issues, 'invalid_id', p + '.id', '必须是 1–64 位字母、数字、下划线或连字符');
    else if (nodeIds.has(node.id)) push(issues, 'duplicate_id', p + '.id', '节点 ID ' + node.id + ' 重复');
    else nodeIds.add(node.id);
    if (typeof node.name !== 'string' || node.name.trim() === '') push(issues, 'graph_shape', p + '.name', '必须是非空字符串');
    else if (node.name.length > 80) push(issues, 'graph_shape', p + '.name', '不能超过 80 字');
    if (NODE_TYPES.indexOf(node.type) < 0) push(issues, 'invalid_node_type', p + '.type', '节点类型非法');
    if (node.stageId !== undefined && node.stageId !== null) {
      if (typeof node.stageId !== 'string') push(issues, 'graph_shape', p + '.stageId', '必须是字符串或 null');
      else if (!stageIds.has(node.stageId)) push(issues, 'missing_stage', p + '.stageId', '阶段 ' + node.stageId + ' 不存在');
    }
    if (node.expertId !== undefined && node.expertId !== null && (typeof node.expertId !== 'string' || !UUID_PATTERN.test(node.expertId))) {
      push(issues, 'invalid_expert_id', p + '.expertId', '必须是 UUID 或 null');
    }
    if (node.layout !== undefined) {
      if (!isObject(node.layout)) push(issues, 'invalid_layout', p + '.layout', '必须是对象');
      else if (!Number.isFinite(node.layout.x) || !Number.isFinite(node.layout.y)) push(issues, 'invalid_layout', p + '.layout', 'x/y 必须是数字');
    }
  });

  const edgeIds = new Set();
  graph.edges.forEach(function (edge, index) {
    const p = edgePath(index);
    if (!isObject(edge)) { push(issues, 'graph_shape', p, '必须是对象'); return; }
    unknownFields(edge, ['id', 'from', 'to', 'kind'], p, issues);
    if (typeof edge.id !== 'string' || !ID_PATTERN.test(edge.id)) push(issues, 'invalid_id', p + '.id', '必须是 1–64 位字母、数字、下划线或连字符');
    else if (edgeIds.has(edge.id)) push(issues, 'duplicate_id', p + '.id', '连线 ID ' + edge.id + ' 重复');
    else edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) push(issues, 'missing_endpoint', p + '.from', '起点节点不存在');
    if (!nodeIds.has(edge.to)) push(issues, 'missing_endpoint', p + '.to', '终点节点不存在');
    if (edge.from === edge.to) push(issues, 'self_edge', p + '.to', '起点与终点不能相同');
    if (EDGE_KINDS.indexOf(edge.kind) < 0) push(issues, 'invalid_edge_kind', p + '.kind', '必须是 seq 或 rollback');
  });
  if (graph.viewport !== undefined && !isObject(graph.viewport)) push(issues, 'invalid_layout', 'graph.viewport', '必须是对象');
  return issues;
}

/** 拓扑检查，规则与 B3 analyzeTopology 一致。 */
export function topologyIssues(graph) {
  const issues = [];
  if (!isObject(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return issues;
  const nodes = new Map(graph.nodes.map(function (n) { return [n.id, n]; }));
  const nodeIndex = new Map(graph.nodes.map(function (n, i) { return [n.id, i]; }));
  const edgeIndex = new Map(graph.edges.map(function (e, i) { return [e.id, i]; }));
  const nPath = function (id) {
    return nodeIndex.has(id) ? nodePath(nodeIndex.get(id)) : 'graph.nodes';
  };
  const ePath = function (id) {
    return edgeIndex.has(id) ? edgePath(edgeIndex.get(id)) : 'graph.edges';
  };
  const starts = graph.nodes.filter(function (n) { return n.type === 'start'; });
  const ends = graph.nodes.filter(function (n) { return n.type === 'end'; });
  if (starts.length === 0) push(issues, 'missing_start', 'graph.nodes', '缺少开始节点');
  if (starts.length > 1) push(issues, 'multiple_start', 'graph.nodes', '开始节点必须恰好一个');
  if (ends.length === 0) push(issues, 'missing_end', 'graph.nodes', '缺少结束节点');
  if (ends.length > 1) push(issues, 'multiple_end', 'graph.nodes', '结束节点必须恰好一个');

  const seqIn = new Map();
  const seqOut = new Map();
  const rollbackOut = new Map();
  graph.nodes.forEach(function (n) {
    seqIn.set(n.id, []); seqOut.set(n.id, []); rollbackOut.set(n.id, []);
  });
  graph.edges.forEach(function (e) {
    if (e.kind === 'seq') {
      if (seqIn.has(e.to)) seqIn.get(e.to).push(e);
      if (seqOut.has(e.from)) seqOut.get(e.from).push(e);
    } else if (rollbackOut.has(e.from)) {
      rollbackOut.get(e.from).push(e);
    }
  });
  const start = starts.length === 1 ? starts[0] : undefined;
  const end = ends.length === 1 ? ends[0] : undefined;
  if (start && (seqIn.get(start.id) || []).length > 0) push(issues, 'start_has_incoming', nPath(start.id), '开始节点不能有入边');
  if (end && (seqOut.get(end.id) || []).length > 0) push(issues, 'end_has_outgoing', nPath(end.id), '结束节点不能有出边');

  graph.nodes.forEach(function (n) {
    if ((seqIn.get(n.id) || []).length > 1) push(issues, 'broken_chain', nPath(n.id), '节点最多一条 seq 入边');
    if ((seqOut.get(n.id) || []).length > 1) push(issues, 'broken_chain', nPath(n.id), '节点最多一条 seq 出边');
    if (start && n.id !== start.id && (seqIn.get(n.id) || []).length === 0) push(issues, 'broken_chain', nPath(n.id), '非开始节点必须有一条 seq 入边');
    if (end && n.id !== end.id && (seqOut.get(n.id) || []).length === 0) push(issues, 'broken_chain', nPath(n.id), '非结束节点必须有一条 seq 出边');
  });

  if (start) {
    const reachable = new Set();
    const queue = [start.id];
    while (queue.length) {
      const current = queue.shift();
      if (reachable.has(current)) continue;
      reachable.add(current);
      (seqOut.get(current) || []).forEach(function (e) {
        if (!reachable.has(e.to)) queue.push(e.to);
      });
    }
    graph.nodes.forEach(function (n) {
      if (!reachable.has(n.id)) push(issues, 'broken_chain', nPath(n.id), '节点从开始节点不可达');
    });
  }

  const visiting = new Set();
  const visited = new Set();
  function hasCycle(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const out = seqOut.get(id) || [];
    for (let i = 0; i < out.length; i += 1) {
      if (hasCycle(out[i].to)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (graph.nodes.some(function (n) { return hasCycle(n.id); })) push(issues, 'seq_cycle', 'graph.edges', 'seq 子图存在环');

  graph.nodes.forEach(function (n) {
    const rollbacks = rollbackOut.get(n.id) || [];
    if (rollbacks.length === 0) return;
    if (n.type !== 'review' && n.type !== 'confirm') push(issues, 'invalid_rollback', nPath(n.id), '只有 review/confirm 可以发起回退');
    if (rollbacks.length > 1) push(issues, 'invalid_rollback', nPath(n.id), '每个节点最多一条回退边');
    const ancestors = new Set();
    const queue = [n.id];
    while (queue.length) {
      const current = queue.shift();
      (seqIn.get(current) || []).forEach(function (e) {
        if (!ancestors.has(e.from)) { ancestors.add(e.from); queue.push(e.from); }
      });
    }
    rollbacks.forEach(function (e) {
      const target = nodes.get(e.to);
      if (!target) push(issues, 'invalid_rollback', ePath(e.id) + '.to', '回退目标不存在');
      else if (target.type === 'end') push(issues, 'invalid_rollback', ePath(e.id) + '.to', '不能回退到结束节点');
      else if (!ancestors.has(target.id)) push(issues, 'rollback_target_not_ancestor', ePath(e.id) + '.to', '回退目标不是 seq 路径上的祖先');
    });
  });

  graph.nodes.forEach(function (n) {
    if (n.type === 'fanout') {
      const out = seqOut.get(n.id) || [];
      if (out.length !== 1 || !nodes.get(out[0].to) || nodes.get(out[0].to).type !== 'fanin') {
        push(issues, 'fanout_fanin_unpaired', nPath(n.id), 'fanout 必须唯一指向一个 fanin');
      }
    }
    if (n.type === 'fanin') {
      const incoming = seqIn.get(n.id) || [];
      if (incoming.length !== 1 || !nodes.get(incoming[0].from) || nodes.get(incoming[0].from).type !== 'fanout') {
        push(issues, 'fanout_fanin_unpaired', nPath(n.id), 'fanin 必须唯一来自一个 fanout');
      }
    }
  });
  return issues;
}

function requiresExpert(type) {
  return type === 'start' || type === 'end' || type === 'agent' || type === 'review' || type === 'fanout' || type === 'fanin';
}

/** 绑定矩阵 + 可选的专家状态检查；专家列表不全时只检查类型矩阵。 */
export function bindingReport(graph, experts) {
  const errors = [];
  const warnings = [];
  if (!isObject(graph) || !Array.isArray(graph.nodes)) return { errors: errors, warnings: warnings };
  const byId = new Map((experts || []).map(function (e) { return [e.id, e]; }));
  graph.nodes.forEach(function (node, index) {
    const p = nodePath(index) + '.expertId';
    if (requiresExpert(node.type) && (node.expertId === null || node.expertId === undefined)) {
      push(errors, 'expert_required', p, node.type + ' 节点必须绑定专家');
    }
    if (node.type === 'confirm' && node.expertId !== null && node.expertId !== undefined) {
      push(errors, 'expert_forbidden', p, 'confirm 节点不能绑定专家');
    }
    if (Array.isArray(experts) && experts.length > 0 && node.expertId) {
      const expert = byId.get(node.expertId);
      if (!expert) push(errors, 'expert_missing', p, '专家不存在');
      else if (expert.enabled === false) push(warnings, 'expert_disabled', p, '专家已停用');
    }
  });
  return { errors: errors, warnings: warnings };
}

/** 完整本地校验（B3 图）。 */
export function validateGraph(graph, experts) {
  const shape = shapeIssues(graph);
  const topology = shape.length ? [] : topologyIssues(graph);
  const binding = shape.length ? { errors: [], warnings: [] } : bindingReport(graph, experts);
  return {
    errors: shape.concat(topology, binding.errors),
    warnings: binding.warnings
  };
}

/** 编辑器视图校验；先映射到 B3 图，避免 x/y/box 被形状检查误判。 */
export function validateEditorGraph(editorGraph, experts) {
  return validateGraph(toB3Graph(editorGraph), experts);
}

export function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.filter(function (issue) {
    return issue && typeof issue.path === 'string' && typeof issue.message === 'string';
  }).map(function (issue) {
    return {
      code: typeof issue.code === 'string' ? issue.code : 'validation_error',
      path: issue.path,
      message: issue.message
    };
  });
}

/** 从 B3 issue path 提取元素定位信息；数组下标即元素位置。 */
export function issueTarget(path, graph) {
  if (typeof path !== 'string') return null;
  let m = /^graph\.stages\[(\d+)\]/.exec(path);
  if (m && graph && graph.stages && graph.stages[+m[1]]) return { type: 'stage', index: +m[1], id: graph.stages[+m[1]].id };
  m = /^graph\.nodes\[(\d+)\]/.exec(path);
  if (m && graph && graph.nodes && graph.nodes[+m[1]]) return { type: 'node', index: +m[1], id: graph.nodes[+m[1]].id };
  m = /^graph\.edges\[(\d+)\]/.exec(path);
  if (m && graph && graph.edges && graph.edges[+m[1]]) return { type: 'edge', index: +m[1], id: graph.edges[+m[1]].id };
  return { type: 'graph', index: -1, id: null };
}

export function hasErrors(report) {
  return Boolean(report && report.errors && report.errors.length);
}

export function issueText(issue) {
  return issue && issue.message ? issue.message : String(issue || '未知校验错误');
}
