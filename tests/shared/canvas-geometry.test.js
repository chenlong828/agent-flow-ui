import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_W,
  NODE_H,
  NODE_SIDES,
  canvasSize,
  portPos,
  autoSides,
  edgeSides,
  edgePath,
  rollbackLabelPos,
  edgeMarkers,
  viewportTransform
} from '../../assets/js/shared/canvas-geometry.js';

function node(id, x, y, extra) {
  return Object.assign({ id: id, type: 'agent', x: x, y: y, inSide: null, outSide: null }, extra || {});
}

test('缺省选边：横向差更大走左右，纵向差更大走上下，平局取横向', () => {
  assert.deepEqual(autoSides(node('a', 0, 0), node('b', 300, 0)), { from: 'right', to: 'left' });
  assert.deepEqual(autoSides(node('a', 300, 0), node('b', 0, 0)), { from: 'left', to: 'right' });
  assert.deepEqual(autoSides(node('a', 0, 0), node('b', 0, 300)), { from: 'bottom', to: 'top' });
  assert.deepEqual(autoSides(node('a', 0, 300), node('b', 0, 0)), { from: 'top', to: 'bottom' });
  assert.deepEqual(autoSides(node('a', 0, 0), node('b', 100, 100)), { from: 'right', to: 'left' });
});

test('锚点图坐标：四边中点与回退落点', () => {
  const n = node('a', 100, 200);
  assert.deepEqual(portPos(n, 'top'), { x: 100 + NODE_W / 2, y: 200 });
  assert.deepEqual(portPos(n, 'bottom'), { x: 100 + NODE_W / 2, y: 200 + NODE_H });
  assert.deepEqual(portPos(n, 'left'), { x: 100, y: 200 + NODE_H / 2 });
  assert.deepEqual(portPos(n, 'right'), { x: 100 + NODE_W, y: 200 + NODE_H / 2 });
  assert.deepEqual(portPos(n, 'rb'), { x: 100 + NODE_W - 22, y: 200 + NODE_H });
});

test('edgeSides 沿用保存的 inSide/outSide，不被自动选边覆盖', () => {
  const graph = {
    nodes: [node('a', 0, 0, { outSide: 'bottom' }), node('b', 300, 0, { inSide: 'top' })],
    edges: [{ id: 'e1', from: 'a', to: 'b', kind: 'seq' }]
  };
  assert.deepEqual(edgeSides(graph).get('e1'), { from: 'bottom', to: 'top' });
});

test('同一节点进出边落在同一侧时错开，手动入边保持不动', () => {
  const graph = {
    nodes: [
      node('a', 0, 0, { outSide: 'right' }),
      node('b', 300, 120, { inSide: 'left' }),
      node('c', 0, 120)
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', kind: 'seq' },
      { id: 'e2', from: 'b', to: 'c', kind: 'seq' }
    ]
  };
  const sides = edgeSides(graph);
  const into = sides.get('e1');
  const out = sides.get('e2');
  assert.equal(into.to, 'left', '手写 inSide 不应被改写');
  assert.notEqual(out.from, into.to, '出边必须错到未占用的边');
  assert.equal(NODE_SIDES.includes(out.from), true);
});

test('rollback 路径与标签位置固定，seq 路径按给定锚点绘制', () => {
  const a = node('a', 260, 420);
  const b = node('b', 260, 120);
  assert.equal(edgePath(a, b, 'rollback'), 'M 406 478 C 446 598, 304 298, 344 178');
  assert.deepEqual(rollbackLabelPos(a, b), { x: 344, y: 504 });
  assert.equal(
    edgePath(a, b, 'seq', { from: 'right', to: 'left' }),
    'M 428 449 C 582.7267268444596 449, 105.27327315554044 149, 260 149'
  );
});

test('画布包围盒有下限且随节点/阶段增长', () => {
  assert.deepEqual(canvasSize({ nodes: [], stages: [] }), { w: 900, h: 520 });
  const grown = canvasSize({
    nodes: [node('a', 1000, 800)],
    stages: [{ box: { x: 900, y: 700, w: 300, h: 200 } }]
  });
  assert.equal(grown.w, 1328);
  assert.equal(grown.h, 1020);
});

test('箭头定义与视口 transform 供两个画布共用', () => {
  const markers = edgeMarkers();
  assert.match(markers, /id="arw"/);
  assert.match(markers, /id="arw-rb"/);
  assert.equal(viewportTransform({ x: 16, y: -12, zoom: 0.8 }), 'translate(16px,-12px) scale(0.8)');
});
