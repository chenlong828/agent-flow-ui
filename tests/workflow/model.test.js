import test from 'node:test';
import assert from 'node:assert/strict';
import {
  minimalGraph,
  toB3Graph,
  toEditorGraph,
  toDsl,
  normalizeViewport,
  isId
} from '../../assets/js/workflow/model.js';

test('minimalGraph 是 B3 合法形状且起止专家可相同', () => {
  const graph = minimalGraph('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes[0].type, 'start');
  assert.equal(graph.nodes[1].type, 'end');
  assert.equal(graph.nodes[0].expertId, graph.nodes[1].expertId);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].kind, 'seq');
  assert.deepEqual(graph.nodes[0].layout, { x: 80, y: 100 });
  assert.equal(graph.nodes[0].x, undefined);
  assert.equal(graph.nodes[0].y, undefined);
  assert.ok(isId(graph.nodes[0].id));
  assert.ok(isId(graph.edges[0].id));
});

test('编辑器视图与 B3 图往返时保留 layout 与 viewport', () => {
  const source = {
    stages: [{ id: 's1', name: '阶段一', description: '说明', layout: { x: 10, y: 20, width: 500, height: 300 } }],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', stageId: 's1', expertId: '11111111-1111-4111-8111-111111111111', layout: { x: 30, y: 40 } },
      { id: 'n2', type: 'end', name: '结束', stageId: 's1', expertId: '11111111-1111-4111-8111-111111111111', layout: { x: 340, y: 40 } }
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' }],
    viewport: { x: 12, y: 8, zoom: 0.7 }
  };
  const editor = toEditorGraph(source);
  assert.equal(editor.nodes[0].x, 30);
  assert.equal(editor.stages[0].box.w, 500);
  const out = toB3Graph(editor);
  assert.deepEqual(out.nodes[0].layout, { x: 30, y: 40 });
  assert.deepEqual(out.stages[0].layout, { x: 10, y: 20, width: 500, height: 300 });
  assert.deepEqual(out.viewport, { x: 12, y: 8, zoom: 0.7 });
});

test('无 layout 的旧图自动排版并生成阶段框', () => {
  const editor = toEditorGraph({
    stages: [{ id: 's1', name: '阶段' }],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', stageId: 's1', expertId: null },
      { id: 'n2', type: 'end', name: '结束', stageId: 's1', expertId: null }
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' }]
  });
  assert.equal(typeof editor.nodes[0].x, 'number');
  assert.equal(typeof editor.nodes[1].y, 'number');
  assert.ok(editor.stages[0].box.w >= 360);
});

test('toDsl 输出 dslVersion/metadata/layout.viewport', () => {
  const dsl = toDsl({ name: '流程', type: '研发', description: '说明' }, minimalGraph(null, null));
  assert.equal(dsl.dslVersion, 1);
  assert.equal(dsl.metadata.name, '流程');
  assert.equal(dsl.metadata.type, '研发');
  assert.deepEqual(dsl.layout.viewport, { x: 0, y: 0, zoom: 0.85 });
});

test('viewport 对非法缩放回落，不产生 0', () => {
  assert.deepEqual(normalizeViewport({ zoom: 0, x: 1 }), { x: 1, y: 0, zoom: 0.85 });
  assert.equal(normalizeViewport({ zoom: 9, x: 0, y: 0 }).zoom, 2);
});

test('保存时 layout 只保留 schema 字段，不透传未知键', () => {
  const editor = toEditorGraph({
    stages: [{ id: 's1', name: '阶段', layout: { x: 1, y: 2, width: 300, height: 200, hidden: true } }],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', expertId: null, layout: { x: 5, y: 6, color: 'red' } },
      { id: 'n2', type: 'end', name: '结束', expertId: null, layout: { x: 7, y: 8 } }
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' }],
    viewport: { x: 0, y: 0, zoom: 0.85 }
  });
  const out = toB3Graph(editor);
  assert.deepEqual(out.nodes[0].layout, { x: 5, y: 6 });
  assert.deepEqual(out.stages[0].layout, { x: 1, y: 2, width: 300, height: 200 });
});
