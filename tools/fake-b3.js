/**
 * 测试专用 B3 工作流内存后端。只实现 UI 用到的 API-31..40 子集，
 * 错误体与 B3 对齐；生产代码不引用本文件。
 */
import { MOCK } from '../assets/js/mock-data.js';
import { validateGraph, normalizeIssues } from '../assets/js/workflow/validate.js';
import { toDsl, toEditorGraph } from '../assets/js/workflow/model.js';

function expertAt(index) {
  const expert = MOCK.experts[index] || MOCK.experts[0];
  return expert ? expert.id : null;
}

function iso(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function makeGraph(startExpert, endExpert) {
  return {
    stages: [{ id: 's1', name: '阶段一', description: '需求与方案', layout: { x: 40, y: 40, width: 520, height: 220 } }],
    nodes: [
      { id: 'n1', type: 'start', name: '开始', stageId: 's1', expertId: startExpert, layout: { x: 80, y: 120 } },
      { id: 'n2', type: 'agent', name: '需求分析', stageId: 's1', expertId: startExpert, layout: { x: 300, y: 120 } },
      { id: 'n3', type: 'end', name: '结束', stageId: null, expertId: endExpert, layout: { x: 540, y: 120 } }
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', kind: 'seq' },
      { id: 'e2', from: 'n2', to: 'n3', kind: 'seq' }
    ],
    viewport: { x: 16, y: 12, zoom: 0.8 }
  };
}

let seed;
let workflows;
let seq;

function reset() {
  seq = 0;
  seed = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: '研发四阶段主流程',
      type: '研发主流程',
      description: '需求到发布的全流程',
      revision: 3,
      createdAt: iso(4000),
      updatedAt: iso(30),
      graph: makeGraph(expertAt(0), expertAt(0))
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: '需求分析子流程',
      type: '专项子流程',
      description: '需求澄清与范围识别',
      revision: 2,
      createdAt: iso(3000),
      updatedAt: iso(120),
      graph: makeGraph(expertAt(0), expertAt(1))
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: '批量代码审视',
      type: '批量审视任务',
      description: '按模块拆分并行审视',
      revision: 1,
      createdAt: iso(2000),
      updatedAt: iso(240),
      graph: makeGraph(expertAt(1), expertAt(1))
    }
  ];
  workflows = structuredClone(seed);
}

reset();

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function find(id) { return workflows.find((w) => w.id === id); }
function summary(w) {
  return {
    id: w.id,
    name: w.name,
    type: w.type,
    description: w.description,
    nodeCount: w.graph.nodes.length,
    stageCount: w.graph.stages.length,
    revision: w.revision,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    updatedBy: 'local'
  };
}
function detail(w) { return Object.assign(summary(w), { graph: clone(w.graph) }); }
function error(status, code, message, issues) {
  const body = { error: { code, message } };
  if (issues && issues.length) body.error.details = { issues };
  return { status, body };
}
function ifMatch(headers, revision) {
  const raw = headers && (headers['If-Match'] || headers['if-match']);
  if (!raw) return error(428, 'precondition_required', '缺少 If-Match');
  if (String(raw).replace(/^"|"$/g, '') !== String(revision)) return error(409, 'revision_conflict', '版本冲突');
  return null;
}
function expertWarnings(graph) {
  return graph.nodes.filter((n) => n.expertId && !MOCK.experts.some((e) => e.id === n.expertId)).map((n) => ({
    code: 'expert_disabled', path: 'graph.nodes[' + graph.nodes.indexOf(n) + '].expertId', message: '专家已停用'
  }));
}
function validate(graph, allowNullExperts) {
  const report = validateGraph(graph, MOCK.experts);
  const errors = report.errors.filter((issue) => !(allowNullExperts && (issue.code === 'expert_required' || issue.code === 'expert_missing')));
  return { errors: normalizeIssues(errors), warnings: normalizeIssues(report.warnings.concat(expertWarnings(graph))) };
}
function nameConflict(name, exceptId) {
  return workflows.some((w) => w.id !== exceptId && w.name.toLowerCase() === String(name).toLowerCase());
}
function importReport(graph) {
  const report = validateGraph(graph, MOCK.experts);
  const errors = report.errors.filter((issue) => issue.code !== 'expert_required' && issue.code !== 'expert_missing');
  const missing = report.errors.filter((issue) => issue.code === 'expert_missing').map((issue) => ({
    code: 'expert_unbound', path: issue.path, message: '导入时专家不存在，已清空绑定'
  }));
  return { errors: normalizeIssues(errors), warnings: normalizeIssues(report.warnings.concat(missing)) };
}
function createWorkflow(input, allowNullExperts) {
  if (!input || typeof input.name !== 'string' || !input.name.trim()) return error(400, 'validation_error', '名称不能为空');
  if (!input.type || !input.type.trim()) return error(400, 'validation_error', '类型不能为空');
  if (nameConflict(input.name)) return error(409, 'name_conflict', '名称已存在');
  if (!input.graph) return error(400, 'validation_error', '必须提交 graph', [{ code: 'graph_shape', path: 'graph', message: '必须是对象' }]);
  const report = validate(input.graph, allowNullExperts);
  if (report.errors.length) return error(400, 'validation_error', '工作流定义不合法', report.errors);
  const now = new Date().toISOString();
  const w = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type.trim(),
    description: typeof input.description === 'string' ? input.description : '',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    graph: clone(input.graph)
  };
  workflows.unshift(w);
  seq += 1;
  return { status: 201, body: { id: w.id, revision: w.revision, warnings: report.warnings } };
}
function copyWorkflow(id, input) {
  const source = find(id);
  if (!source) return error(404, 'not_found', '工作流不存在');
  const base = (input && input.name) || (source.name + ' 副本');
  let name = String(base).slice(0, 80);
  let index = 1;
  while (nameConflict(name)) {
    index += 1;
    const suffix = ' (' + index + ')';
    name = String(base).slice(0, 80 - suffix.length) + suffix;
  }
  const now = new Date().toISOString();
  const w = {
    id: crypto.randomUUID(),
    name: name,
    type: source.type,
    description: source.description,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    graph: clone(source.graph)
  };
  workflows.unshift(w);
  seq += 1;
  return { status: 201, body: { id: w.id, revision: 1, warnings: [] } };
}
function dslFor(w) {
  const dsl = toDsl({ name: w.name, type: w.type, description: w.description }, toEditorGraph(w.graph));
  return dsl;
}
function yamlScalar(value) {
  return JSON.stringify(value == null ? '' : String(value));
}
function toYaml(dsl) {
  const lines = [
    'dslVersion: ' + dsl.dslVersion,
    'metadata:',
    '  name: ' + yamlScalar(dsl.metadata.name),
    '  type: ' + yamlScalar(dsl.metadata.type),
    '  description: ' + yamlScalar(dsl.metadata.description),
    'stages:',
    ...dsl.stages.map((s) => '  - id: ' + yamlScalar(s.id) + '\n    name: ' + yamlScalar(s.name)),
    'nodes:',
    ...dsl.nodes.map((n) => '  - id: ' + yamlScalar(n.id) + '\n    type: ' + yamlScalar(n.type) + '\n    name: ' + yamlScalar(n.name)),
    'edges:',
    ...dsl.edges.map((e) => '  - id: ' + yamlScalar(e.id) + '\n    from: ' + yamlScalar(e.from) + '\n    to: ' + yamlScalar(e.to) + '\n    kind: ' + yamlScalar(e.kind))
  ];
  return lines.join('\n') + '\n';
}

/** 测试夹具：把 B1 专家 ID 换成 B3 要求的 UUID；必须在 openPage setup 中调用。 */
export function prepareUuidExperts() {
  MOCK.experts.forEach(function (expert, index) {
    expert.id = '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0');
  });
}

export function resetFakeB3() { reset(); }

export const fakeB3 = {
  reset: resetFakeB3,
  handle: async function (method, path, body, headers) {
    const url = new URL(path, 'http://local');
    const parts = url.pathname.replace(/^\/workflows\/?/, '').split('/').filter(Boolean);
    if (parts.length === 0) {
      if (method === 'GET') {
        let items = workflows.slice();
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const type = url.searchParams.get('type') || '';
        if (q) items = items.filter((w) => w.name.toLowerCase().includes(q));
        if (type) items = items.filter((w) => w.type === type);
        const sort = url.searchParams.get('sort') || 'updatedAt:desc';
        const [key, dir] = sort.split(':');
        items.sort((a, b) => {
          const av = key === 'name' ? a.name : a.updatedAt;
          const bv = key === 'name' ? b.name : b.updatedAt;
          return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'asc' ? 1 : -1);
        });
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 20));
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        return { status: 200, body: { items: items.slice(offset, offset + limit).map(summary), total: items.length, limit, offset } };
      }
      if (method === 'POST') {
        if (!body || !body.graph) return error(400, 'validation_error', '必须提交 graph', [{ code: 'graph_shape', path: 'graph', message: '必须是对象' }]);
        return createWorkflow(body, false);
      }
      return error(404, 'not_found', '路径不存在');
    }
    if (parts.length === 1 && parts[0] === 'import' && method === 'POST') {
      if (!body || body.dslVersion !== 1) return error(400, 'validation_error', 'dslVersion 必须是 1');
      const graph = {
        stages: body.stages || [],
        nodes: body.nodes || [],
        edges: body.edges || [],
        viewport: body.layout && body.layout.viewport ? body.layout.viewport : undefined
      };
      const report = importReport(graph);
      if (report.errors.length) return error(400, 'validation_error', 'DSL 不合法', report.errors);
      const created = createWorkflow({ name: body.metadata && body.metadata.name, type: body.metadata && body.metadata.type, description: body.metadata && body.metadata.description, graph }, true);
      if (created.status !== 201) return created;
      const w = find(created.body.id);
      return {
        status: 201,
        body: { workflow: detail(w), idMap: Object.fromEntries(graph.nodes.map((n) => [n.id, n.id])), warnings: report.warnings }
      };
    }
    const id = parts[0];
    const w = find(id);
    if (!w) return error(404, 'not_found', '工作流不存在');
    if (parts.length === 1) {
      if (method === 'GET') return { status: 200, body: detail(w) };
      if (method === 'PUT') {
        const bad = ifMatch(headers, w.revision);
        if (bad) return bad;
        if (!body || !body.name || !body.type || body.description === undefined) return error(400, 'validation_error', '字段不完整');
        if (nameConflict(body.name, w.id)) return error(409, 'name_conflict', '名称已存在');
        w.name = String(body.name).trim();
        w.type = String(body.type).trim();
        w.description = String(body.description);
        w.revision += 1;
        w.updatedAt = new Date().toISOString();
        return { status: 200, body: detail(w) };
      }
      if (method === 'DELETE') {
        const bad = ifMatch(headers, w.revision);
        if (bad) return bad;
        workflows = workflows.filter((x) => x.id !== id);
        return { status: 204, body: null };
      }
    }
    if (parts.length === 2 && parts[1] === 'copy' && method === 'POST') return copyWorkflow(id, body);
    if (parts.length === 2 && parts[1] === 'validate' && method === 'POST') {
      if (!body || !body.graph) return error(400, 'validation_error', '必须提交 graph');
      return { status: 200, body: validate(body.graph, false) };
    }
    if (parts.length === 2 && parts[1] === 'definition' && method === 'PUT') {
      const bad = ifMatch(headers, w.revision);
      if (bad) return bad;
      if (!body || !body.graph) return error(400, 'validation_error', '必须提交 graph');
      const report = validate(body.graph, false);
      if (report.errors.length) return error(400, 'validation_error', '工作流定义不合法', report.errors);
      w.graph = clone(body.graph);
      w.revision += 1;
      w.updatedAt = new Date().toISOString();
      return { status: 200, body: { workflow: detail(w), warnings: report.warnings } };
    }
    if (parts.length === 2 && parts[1] === 'dsl' && method === 'GET') {
      const format = url.searchParams.get('format') || 'json';
      const dsl = dslFor(w);
      if (format === 'yaml') {
        return {
          status: 200,
          body: toYaml(dsl),
          headers: { 'Content-Type': 'application/yaml; charset=utf-8', 'Content-Disposition': 'attachment; filename="workflow-' + w.id + '.yaml"' }
        };
      }
      return {
        status: 200,
        body: dsl,
        headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="workflow-' + w.id + '.json"' }
      };
    }
    return error(404, 'not_found', '路径不存在');
  }
};
