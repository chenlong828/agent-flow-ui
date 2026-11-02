import test from 'node:test';
import assert from 'node:assert/strict';
import { minimalGraph, toEditorGraph } from '../../assets/js/workflow/model.js';
import {
  validateGraph,
  validateEditorGraph,
  issueTarget,
  normalizeIssues,
  shapeIssues
} from '../../assets/js/workflow/validate.js';

const EXPERT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function validGraph() {
  return minimalGraph(EXPERT, EXPERT);
}

test('最小图无错误', () => {
  const report = validateGraph(validGraph(), [{ id: EXPERT, enabled: true }]);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
});

test('缺开始/结束与断链产生 B3 对应 code', () => {
  const graph = validGraph();
  graph.nodes = graph.nodes.filter((n) => n.type !== 'end');
  graph.nodes.push({ id: 'n3', type: 'agent', name: '节点三', stageId: null, expertId: EXPERT });
  graph.nodes.push({ id: 'n4', type: 'agent', name: '孤立', stageId: null, expertId: EXPERT });
  graph.edges = [{ id: 'e1', from: 'n1', to: 'n3', kind: 'seq' }];
  const report = validateGraph(graph, [{ id: EXPERT, enabled: true }]);
  const codes = report.errors.map((e) => e.code);
  assert.ok(codes.includes('missing_end'));
  assert.ok(codes.includes('broken_chain'));
});

test('专家必填与 confirm 禁止绑定', () => {
  const graph = validGraph();
  graph.nodes[0].expertId = null;
  graph.nodes[1].type = 'confirm';
  graph.nodes[1].expertId = EXPERT;
  const report = validateGraph(graph, [{ id: EXPERT, enabled: true }]);
  const codes = report.errors.map((e) => e.code);
  assert.ok(codes.includes('expert_required'));
  assert.ok(codes.includes('expert_forbidden'));
});

test('停用专家是 warning 而不是 error', () => {
  const report = validateGraph(validGraph(), [{ id: EXPERT, enabled: false }]);
  assert.deepEqual(report.errors, []);
  assert.equal(report.warnings[0].code, 'expert_disabled');
});

test('回退目标必须是 seq 祖先且不能回退到结束', () => {
  const graph = validGraph();
  graph.nodes = [
    { id: 'n1', type: 'start', name: '开始', stageId: null, expertId: EXPERT },
    { id: 'n2', type: 'agent', name: '执行', stageId: null, expertId: EXPERT },
    { id: 'n3', type: 'review', name: '评审', stageId: null, expertId: EXPERT },
    { id: 'n4', type: 'end', name: '结束', stageId: null, expertId: EXPERT }
  ];
  graph.edges = [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' },
    { id: 'e3', from: 'n3', to: 'n4', kind: 'seq' },
    { id: 'e4', from: 'n3', to: 'n4', kind: 'rollback' }
  ];
  const report = validateGraph(graph, [{ id: EXPERT, enabled: true }]);
  assert.ok(report.errors.some((e) => e.code === 'rollback_target_not_ancestor' || e.code === 'invalid_rollback'));
});

test('fanout/fanin 必须成对', () => {
  const graph = validGraph();
  graph.nodes = [
    { id: 'n1', type: 'start', name: '开始', stageId: null, expertId: EXPERT },
    { id: 'n2', type: 'fanout', name: '并发', stageId: null, expertId: EXPERT },
    { id: 'n3', type: 'agent', name: '执行', stageId: null, expertId: EXPERT },
    { id: 'n4', type: 'end', name: '结束', stageId: null, expertId: EXPERT }
  ];
  graph.edges = [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' },
    { id: 'e3', from: 'n3', to: 'n4', kind: 'seq' }
  ];
  const report = validateGraph(graph, [{ id: EXPERT, enabled: true }]);
  assert.ok(report.errors.some((e) => e.code === 'fanout_fanin_unpaired'));
});

test('编辑器图校验前先剥离 x/y/box', () => {
  const editor = toEditorGraph(validGraph());
  const report = validateEditorGraph(editor, [{ id: EXPERT, enabled: true }]);
  assert.deepEqual(report.errors, []);
});

test('issueTarget 按数组下标定位节点/边/阶段', () => {
  const graph = { stages: [{ id: 's1' }], nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1' }] };
  assert.deepEqual(issueTarget('graph.nodes[1].expertId', graph), { type: 'node', index: 1, id: 'n2' });
  assert.deepEqual(issueTarget('graph.edges[0].to', graph), { type: 'edge', index: 0, id: 'e1' });
  assert.deepEqual(issueTarget('graph.stages[0].name', graph), { type: 'stage', index: 0, id: 's1' });
  assert.deepEqual(issueTarget('graph.nodes', graph), { type: 'graph', index: -1, id: null });
});

test('normalizeIssues 兼容 fieldErrors 归一后的对象', () => {
  assert.deepEqual(normalizeIssues([{ code: 'x', path: 'graph.nodes[0].name', message: '必填' }]), [
    { code: 'x', path: 'graph.nodes[0].name', message: '必填' }
  ]);
});

test('重复连线 ID 与专家列表未加载时不误报 missing', () => {
  const graph = validGraph();
  graph.edges.push({ id: 'e1', from: 'n1', to: 'n2', kind: 'seq' });
  const duplicate = validateGraph(graph, []);
  assert.ok(duplicate.errors.some((e) => e.code === 'duplicate_id' && /edges/.test(e.path)));
  // 空专家列表表示“列表不可用/尚未加载”，仍检查类型矩阵但不做存在性推断。
  assert.equal(duplicate.errors.some((e) => e.code === 'expert_missing'), false);
});

test('缺 id / 非字符串 id 按非法 ID 报错', () => {
  const graph = {
    stages: [{ name: '阶段' }],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', expertId: null },
      { id: 'n2', type: 'end', name: '结束', expertId: null }
    ],
    edges: [{ from: 'n1', to: 'n2', kind: 'seq' }]
  };
  const issues = shapeIssues(graph);
  assert.ok(issues.some((i) => i.path === 'graph.stages[0].id' && i.code === 'invalid_id'));
  assert.ok(issues.some((i) => i.path === 'graph.edges[0].id' && i.code === 'invalid_id'));
});

test('未知字段按 graph_shape 报错（对齐 B3 unknownFields）', () => {
  const graph = validGraph();
  graph.nodes[0].x = 80;
  graph.edges[0].extra = true;
  const issues = shapeIssues(graph);
  assert.ok(issues.some((i) => i.path === 'graph.nodes[0].x' && i.message === '未知字段'));
  assert.ok(issues.some((i) => i.path === 'graph.edges[0].extra' && i.message === '未知字段'));
});
