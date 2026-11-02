/**
 * 工作流领域模型（L1）
 *
 * 只负责 B3 `WorkflowGraph` ↔ 编辑器视图模型映射、ID、最小合法图与 DSL 包装；
 * 不校验拓扑（validate.js）、不发请求（data.js）、不碰 DOM。
 *
 * 编辑器视图模型在 B3 字段之外增加：
 *   node.x / node.y            画布坐标（保存时写入 node.layout）
 *   stage.box                  阶段框（保存时写入 stage.layout）
 *   stage.description          B3 可选字段
 *   viewport                   {x,y,zoom}
 */

export const NODE_TYPES = ['start', 'end', 'agent', 'review', 'confirm', 'fanout', 'fanin'];
export const EDGE_KINDS = ['seq', 'rollback'];
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_STAGES = 100;
export const MAX_NODES = 500;
export const MAX_EDGES = 1000;

export const NODE_META = {
  start: { label: '开始', short: '开始', cls: 't-plain', icon: 'play' },
  end: { label: '结束', short: '结束', cls: 't-plain', icon: 'stop' },
  agent: { label: '专家节点', short: '专家', cls: 't-agent', icon: 'user' },
  review: { label: '评审节点', short: '评审', cls: 't-review', icon: 'check' },
  confirm: { label: '人工确认', short: '确认', cls: 't-confirm', icon: 'warn' },
  fanout: { label: 'fan-out 网关', short: 'fan-out', cls: 't-gateway', icon: 'flow' },
  fanin: { label: 'fan-in 网关', short: 'fan-in', cls: 't-gateway', icon: 'flow' }
};

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function randomId(prefix) {
  const cryptoObj = globalThis.crypto;
  const suffix = cryptoObj && typeof cryptoObj.randomUUID === 'function'
    ? cryptoObj.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + '-' + suffix;
}

/** 生成符合 B3 ID 规则的稳定 ID；阶段/节点/边各自前缀。 */
export function newId(prefix) {
  return randomId(prefix || 'id');
}

export function isId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function emptyGraph() {
  return {
    stages: [],
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 }
  };
}

/** 新建向导的最小合法图：start → end，专家可按调用方传入；同一专家合法。 */
export function minimalGraph(startExpertId, endExpertId) {
  return {
    stages: [],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', stageId: null, expertId: startExpertId || null, layout: { x: 80, y: 100 } },
      { id: 'n2', type: 'end', name: '结束', stageId: null, expertId: endExpertId || null, layout: { x: 380, y: 100 } }
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' }],
    viewport: { x: 0, y: 0, zoom: 0.85 }
  };
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nodePos(node) {
  if (isObject(node.layout) && finiteNumber(node.layout.x) && finiteNumber(node.layout.y)) {
    return { x: node.layout.x, y: node.layout.y };
  }
  return null;
}

function stageBox(stage) {
  if (!isObject(stage.layout)) return null;
  const l = stage.layout;
  if (finiteNumber(l.x) && finiteNumber(l.y)) {
    return {
      x: l.x,
      y: l.y,
      w: finiteNumber(l.width) ? l.width : 460,
      h: finiteNumber(l.height) ? l.height : 200
    };
  }
  return null;
}

function autoLayout(nodes, stages) {
  const unplaced = [];
  nodes.forEach(function (node) {
    if (node.x === null || node.y === null) unplaced.push(node);
  });
  unplaced.forEach(function (node, index) {
    node.x = 60 + (index % 4) * 220;
    node.y = 110 + Math.floor(index / 4) * 130;
  });
  // 起点优先放到最左，终点放到最右，避免旧图无 layout 时形成随机观感。
  const start = nodes.find(function (n) { return n.type === 'start'; });
  const end = nodes.find(function (n) { return n.type === 'end'; });
  if (start && !isObject(nodes.find(function (n) { return n === start; })._layout)) {
    // 不覆盖真实 layout；仅对自动生成的位置做轻微排序。
    if (start.x > 60) start.x = 60;
  }
  if (end && !isObject(end._layout)) {
    if (end.x < 300) end.x = 380;
  }
  stages.forEach(function (stage, index) {
    if (stage.box) return;
    const members = nodes.filter(function (n) { return n.stageId === stage.id; });
    if (members.length) {
      const minX = Math.min.apply(null, members.map(function (n) { return n.x; }));
      const minY = Math.min.apply(null, members.map(function (n) { return n.y; }));
      const maxX = Math.max.apply(null, members.map(function (n) { return n.x + 168; }));
      stage.box = { x: minX - 36, y: minY - 58, w: Math.max(360, maxX - minX + 72), h: 200 };
    } else {
      stage.box = { x: 40, y: 80 + index * 220, w: 460, h: 200 };
    }
  });
  nodes.forEach(function (node) { delete node._layout; });
}

/**
 * B3 图 → 编辑器视图。
 * 不改变业务字段；只把 layout 提升为 x/y/box，未知 layout 字段留在原对象里。
 */
export function toEditorGraph(graph) {
  const src = isObject(graph) ? graph : emptyGraph();
  const stages = Array.isArray(src.stages) ? src.stages.map(function (stage) {
    return {
      id: stage.id,
      name: stage.name,
      description: typeof stage.description === 'string' ? stage.description : '',
      box: stageBox(stage),
      _rawLayout: isObject(stage.layout) ? deepClone(stage.layout) : null
    };
  }) : [];
  const nodes = Array.isArray(src.nodes) ? src.nodes.map(function (node) {
    const pos = nodePos(node);
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      stageId: node.stageId === undefined ? null : node.stageId,
      expertId: node.expertId === undefined ? null : node.expertId,
      x: pos ? pos.x : null,
      y: pos ? pos.y : null,
      _rawLayout: isObject(node.layout) ? deepClone(node.layout) : null
    };
  }) : [];
  nodes.forEach(function (node) { node._layout = node._rawLayout; });
  autoLayout(nodes, stages);
  const edges = Array.isArray(src.edges) ? src.edges.map(function (edge) {
    return { id: edge.id, from: edge.from, to: edge.to, kind: edge.kind };
  }) : [];
  const viewport = normalizeViewport(src.viewport);
  return { stages: stages, nodes: nodes, edges: edges, viewport: viewport };
}

export function normalizeViewport(raw) {
  if (!isObject(raw)) return { x: 0, y: 0, zoom: 0.85 };
  const zoom = finiteNumber(raw.zoom) && raw.zoom > 0.1 ? Math.min(2, raw.zoom) : 0.85;
  return {
    x: finiteNumber(raw.x) ? raw.x : 0,
    y: finiteNumber(raw.y) ? raw.y : 0,
    zoom: zoom
  };
}

/** 编辑器视图 → B3 图；只保留 B3 字段，layout/viewport 由前端生成。 */
export function toB3Graph(editorGraph) {
  const g = editorGraph || emptyGraph();
  const stages = (g.stages || []).map(function (stage) {
    const box = stage.box || { x: 40, y: 40, w: 460, h: 200 };
    const raw = stage._rawLayout || {};
    const layout = {
      x: finiteNumber(box.x) ? box.x : (finiteNumber(raw.x) ? raw.x : 40),
      y: finiteNumber(box.y) ? box.y : (finiteNumber(raw.y) ? raw.y : 40),
      width: finiteNumber(box.w) ? box.w : (finiteNumber(raw.width) ? raw.width : 460),
      height: finiteNumber(box.h) ? box.h : (finiteNumber(raw.height) ? raw.height : 200)
    };
    const out = { id: stage.id, name: stage.name };
    if (typeof stage.description === 'string' && stage.description !== '') out.description = stage.description;
    out.layout = layout;
    return out;
  });
  const nodes = (g.nodes || []).map(function (node) {
    const raw = node._rawLayout || {};
    const layout = {
      x: finiteNumber(node.x) ? node.x : (finiteNumber(raw.x) ? raw.x : 0),
      y: finiteNumber(node.y) ? node.y : (finiteNumber(raw.y) ? raw.y : 0)
    };
    if (finiteNumber(raw.width)) layout.width = raw.width;
    if (finiteNumber(raw.height)) layout.height = raw.height;
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      stageId: node.stageId === undefined ? null : node.stageId,
      expertId: node.expertId === undefined ? null : node.expertId,
      layout: layout
    };
  });
  const edges = (g.edges || []).map(function (edge) {
    return { id: edge.id, from: edge.from, to: edge.to, kind: edge.kind };
  });
  return { stages: stages, nodes: nodes, edges: edges, viewport: normalizeViewport(g.viewport) };
}

/** 构造 DSL v1；用于只读预览与本地复制，下载仍以后端导出为准。 */
export function toDsl(meta, editorGraph) {
  const graph = toB3Graph(editorGraph);
  const out = {
    dslVersion: 1,
    metadata: {
      name: String(meta.name || '未命名工作流'),
      type: String(meta.type || '未分类'),
      description: String(meta.description || '')
    },
    stages: graph.stages,
    nodes: graph.nodes,
    edges: graph.edges
  };
  if (graph.viewport) out.layout = { viewport: graph.viewport };
  return out;
}

export function graphCounts(editorGraph) {
  return {
    nodes: (editorGraph && editorGraph.nodes ? editorGraph.nodes.length : 0),
    stages: (editorGraph && editorGraph.stages ? editorGraph.stages.length : 0),
    edges: (editorGraph && editorGraph.edges ? editorGraph.edges.length : 0)
  };
}

export function nodeName(editorGraph, id) {
  const n = (editorGraph.nodes || []).find(function (x) { return x.id === id; });
  return n ? n.name : id;
}

export function stageName(editorGraph, id) {
  const s = (editorGraph.stages || []).find(function (x) { return x.id === id; });
  return s ? s.name : id;
}
