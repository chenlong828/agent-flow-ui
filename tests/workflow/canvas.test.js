import test from 'node:test';
import assert from 'node:assert/strict';

/* canvas.js 经 ui.js 取 DF，ui.js 启动时会探测 zoom；node 环境给最小 DOM 桩。 */
function stubEl() {
  return {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    getBoundingClientRect() { return { width: 10, height: 10, left: 0, top: 0 }; },
    innerHTML: ''
  };
}
globalThis.window = globalThis;
globalThis.document = {
  createElement: stubEl,
  addEventListener() {},
  removeEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  body: stubEl(),
  documentElement: stubEl()
};

const { toEditorGraph } = await import('../../assets/js/workflow/model.js');
const { edgeSvg, nodeHtml, stageHtml } = await import('../../assets/js/workflow/views/canvas.js');

const FIXTURE = {
  stages: [{ id: 's1', name: '阶段一', layout: { x: 20, y: 60, width: 700, height: 460 } }],
  nodes: [
    { id: 'n1', type: 'start', name: '启动', stageId: 's1', expertId: null, layout: { x: 60, y: 120, outSide: 'right' } },
    { id: 'n2', type: 'agent', name: '需求', stageId: 's1', expertId: null, layout: { x: 260, y: 120, inSide: 'left', outSide: 'bottom' } },
    { id: 'n3', type: 'review', name: '方案评审', stageId: 's1', expertId: null, layout: { x: 260, y: 420, inSide: 'top', outSide: 'right' } },
    { id: 'n4', type: 'agent', name: '实现', stageId: 's1', expertId: null, layout: { x: 520, y: 420 } },
    { id: 'n5', type: 'end', name: '收尾', stageId: null, expertId: null, layout: { x: 760, y: 120, inSide: 'left' } }
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
    { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' },
    { id: 'e3', from: 'n3', to: 'n4', kind: 'seq' },
    { id: 'e4', from: 'n4', to: 'n5', kind: 'seq' },
    { id: 'r1', from: 'n3', to: 'n2', kind: 'rollback' }
  ],
  viewport: { x: 16, y: 12, zoom: 0.8 }
};

/** 2026-11-19 抽出共享几何前的编辑器输出，逐字锁定，防止重构改变编辑器连线。 */
const GOLDEN = [
  'M 228 149 C 264 149, 224 149, 260 149',
  'M 344 178 C 344 286.9, 344 311.1, 344 420',
  'M 428 449 C 469.4 449, 478.6 449, 520 449',
  'M 604 420 C 604 279.2880868582905, 619.2880868582905 149, 760 149',
  'M 406 478 C 446 598, 304 298, 344 178'
];

function pathsOf(svg) {
  return [...svg.matchAll(/<path class="(?:e-seq|e-rb)" d="([^"]+)"/g)].map(function (m) { return m[1]; });
}

test('编辑器连线路径与抽出共享几何前逐字一致（含保存锚点与回退边）', () => {
  const graph = toEditorGraph(FIXTURE);
  const svg = edgeSvg(graph, null, function () { return false; });
  assert.deepEqual(pathsOf(svg), GOLDEN);
});

test('编辑器保留选中/命中/预览等专属标记，并带箭头与回退标签', () => {
  const graph = toEditorGraph(FIXTURE);
  const svg = edgeSvg(graph, { type: 'edge', id: 'e2' }, function (kind, id) { return kind === 'edge' && id === 'r1'; });
  assert.equal((svg.match(/class="hit"/g) || []).length, 5, '每条边都要有可点击热区');
  assert.match(svg, /class="e-seq esel" d="M 344 178/, '选中边带 esel');
  assert.match(svg, /class="e-rb has-error"/, '错误边带 has-error');
  assert.equal((svg.match(/marker-end="url\(#arw\)"/g) || []).length, 4);
  assert.equal((svg.match(/marker-end="url\(#arw-rb\)"/g) || []).length, 1);
  assert.match(svg, /→|↺ 回退/);
  assert.match(svg, /↺ 回退<\/text>/);
  assert.match(svg, /class="cv-link-preview" d=""/);
});

test('节点/阶段 HTML 仍由编辑器视图组装（共享层不接管 DOM）', () => {
  const graph = toEditorGraph(FIXTURE);
  const nodes = nodeHtml(graph, { type: 'node', id: 'n2' }, function () { return false; }, function () {
    return { name: '需求分析专家', color: '#2563eb' };
  });
  assert.match(nodes, /class="cv-node t-agent sel"/);
  assert.match(nodes, /data-node="n2"/);
  assert.equal((nodes.match(/class="port"/g) || []).length, 20, '5 个节点 × 四向锚点');
  assert.equal((nodes.match(/class="port rb"/g) || []).length, 1, '只有评审节点带回退落点');
  const stage = stageHtml(graph, { type: 'stage', id: 's1' }, function () { return false; });
  assert.match(stage, /class="cv-stage stage-sel" data-stage="s1"/);
});
