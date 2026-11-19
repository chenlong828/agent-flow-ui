/**
 * 画布几何（编辑器与运行轨迹共用的纯函数）
 *
 * 只计算节点尺寸、锚点、连线路径与画布包围盒；不碰 DOM、网络与页面状态。
 * 两个画布各自组装 SVG 与节点 HTML，几何只有这一份。
 */

export const NODE_W = 168;
export const NODE_H = 58;
export const NODE_SIDES = ['top', 'right', 'bottom', 'left'];

const SIDE_NORMALS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

const CANVAS_MIN_W = 900;
const CANVAS_MIN_H = 520;
const CANVAS_PAD = 160;

/** 内容包围盒 + 右侧/底部留白；编辑器与运行页共用同一基线。 */
export function canvasSize(graph) {
  let w = CANVAS_MIN_W;
  let h = CANVAS_MIN_H;
  graph.nodes.forEach(function (n) {
    w = Math.max(w, n.x + NODE_W + CANVAS_PAD);
    h = Math.max(h, n.y + NODE_H + CANVAS_PAD);
  });
  graph.stages.forEach(function (s) {
    if (!s.box) return;
    w = Math.max(w, s.box.x + s.box.w + 120);
    h = Math.max(h, s.box.y + s.box.h + 120);
  });
  return { w: w, h: h };
}

/** 锚点图坐标；`rb` 是回退边的起点（节点右下角内侧）。 */
export function portPos(node, side) {
  if (side === 'top') return { x: node.x + NODE_W / 2, y: node.y };
  if (side === 'bottom') return { x: node.x + NODE_W / 2, y: node.y + NODE_H };
  if (side === 'left') return { x: node.x, y: node.y + NODE_H / 2 };
  if (side === 'right') return { x: node.x + NODE_W, y: node.y + NODE_H / 2 };
  return { x: node.x + NODE_W - 22, y: node.y + NODE_H };
}

/** 两个节点的缺省进出口：横向差更大走左右，否则走上下；平局取横向。 */
export function autoSides(a, b) {
  const dx = (b.x + NODE_W / 2) - (a.x + NODE_W / 2);
  const dy = (b.y + NODE_H / 2) - (a.y + NODE_H / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  }
  return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
}

/** 选取与目标方向最接近、且不是 banned 的一条边。 */
function pickAlternativeSide(node, target, banned) {
  const dx = (target.x + NODE_W / 2) - (node.x + NODE_W / 2);
  const dy = (target.y + NODE_H / 2) - (node.y + NODE_H / 2);
  let best = 'right';
  let bestScore = -Infinity;
  NODE_SIDES.forEach(function (side) {
    if (side === banned) return;
    const normal = SIDE_NORMALS[side];
    const score = normal.x * dx + normal.y * dy;
    if (score > bestScore) { bestScore = score; best = side; }
  });
  return best;
}

/**
 * 计算每条 seq 边的实际贴边。节点只有一进一出：
 * 两侧都手写相同、或自动算出相同时，保持入边/手动边不动，把另一侧错到未占用的边。
 */
export function edgeSides(graph) {
  const map = new Map();
  const incoming = new Map();
  const outgoing = new Map();
  graph.edges.forEach(function (edge) {
    if (edge.kind !== 'seq') return;
    const a = graph.nodes.find(function (n) { return n.id === edge.from; });
    const b = graph.nodes.find(function (n) { return n.id === edge.to; });
    if (!a || !b) return;
    const auto = autoSides(a, b);
    map.set(edge.id, { from: a.outSide || auto.from, to: b.inSide || auto.to });
    incoming.set(edge.to, edge);
    outgoing.set(edge.from, edge);
  });
  graph.nodes.forEach(function (node) {
    const inEdge = incoming.get(node.id);
    const outEdge = outgoing.get(node.id);
    if (!inEdge || !outEdge) return;
    const inSides = map.get(inEdge.id);
    const outSides = map.get(outEdge.id);
    if (!inSides || !outSides || inSides.to !== outSides.from) return;
    const inSource = graph.nodes.find(function (n) { return n.id === inEdge.from; });
    const outTarget = graph.nodes.find(function (n) { return n.id === outEdge.to; });
    if (!node.outSide && outTarget) {
      outSides.from = pickAlternativeSide(node, outTarget, inSides.to);
    } else if (!node.inSide && inSource) {
      inSides.to = pickAlternativeSide(node, inSource, outSides.from);
    } else if (outTarget) {
      outSides.from = pickAlternativeSide(node, outTarget, inSides.to);
    }
  });
  return map;
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

/** 由两边锚点得到 SVG path；seq 与 rollback 两种形态。 */
export function edgePath(a, b, kind, sides) {
  if (kind === 'rollback') {
    const s = portPos(a, 'rb');
    const t = { x: b.x + NODE_W / 2, y: b.y + NODE_H };
    const sag = Math.max(70, Math.abs(s.y - t.y) * 0.2 + 60);
    return 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + sag) + ', ' + (t.x - 40) + ' ' + (t.y + sag) + ', ' + t.x + ' ' + t.y;
  }
  const auto = autoSides(a, b);
  const fromSide = (sides && sides.from) || a.outSide || auto.from;
  const toSide = (sides && sides.to) || b.inSide || auto.to;
  return sideCurve(portPos(a, fromSide), fromSide, portPos(b, toSide), toSide);
}

/** 回退标签位置：回退源节点下方、两节点中更低者之下。 */
export function rollbackLabelPos(a, b) {
  return { x: a.x + NODE_W / 2, y: Math.max(a.y, b.y) + NODE_H + 26 };
}

/** SVG 箭头定义；两个画布共用同一组 marker id（每个页面只有一个画布）。 */
export function edgeMarkers() {
  return '<defs><marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">' +
    '<path d="M0 0L8 4L0 8" fill="#94a3b8"/></marker>' +
    '<marker id="arw-rb" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">' +
    '<path d="M0 0L8 4L0 8" fill="#7c3aed"/></marker></defs>';
}

/** 保存的视口 → `#cvScaler` 的 transform；两个画布写法一致。 */
export function viewportTransform(vp) {
  return 'translate(' + vp.x + 'px,' + vp.y + 'px) scale(' + vp.zoom + ')';
}
