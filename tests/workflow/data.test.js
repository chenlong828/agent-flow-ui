import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowData, errorText } from '../../assets/js/workflow/data.js';
import { ApiError } from '../../assets/js/shared/http.js';

const originalFetch = globalThis.fetch;

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init });
    return handler(path, init, calls.length);
  };
  return calls;
}

test.afterEach(() => { globalThis.fetch = originalFetch; });

function jsonResponse(body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    text: async () => (body === undefined ? '' : JSON.stringify(body))
  };
}

test('list 组合分页/类型/排序参数并跳过空值', async () => {
  const calls = stubFetch(() => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }));
  const data = createWorkflowData();
  await data.list({ q: '审批', type: '研发', sort: 'updatedAt:desc', limit: 20, offset: 0, extra: '' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /^\/api\/v1\/workflows\?/);
  assert.match(calls[0].path, /q=%E5%AE%A1%E6%89%B9/);
  assert.match(calls[0].path, /type=%E7%A0%94%E5%8F%91/);
  assert.match(calls[0].path, /sort=updatedAt%3Adesc/);
  assert.doesNotMatch(calls[0].path, /extra=/);
});

test('update/save/remove 都带 If-Match 与规定路径', async () => {
  const calls = stubFetch((path) => {
    if (path.endsWith('/definition')) return jsonResponse({ workflow: { id: 'w1', revision: 4 }, warnings: [] });
    if (path.endsWith('/w1')) return jsonResponse({ id: 'w1', revision: 4 });
    return jsonResponse(undefined, 204);
  });
  const data = createWorkflowData();
  await data.update('w1', 3, { name: 'A', type: 'T', description: '' });
  await data.save('w1', 4, { nodes: [], edges: [], stages: [] });
  assert.equal(data.revisionOf('w1'), 4);
  await data.remove('w1', 5);
  assert.equal(calls[0].init.headers['If-Match'], '"3"');
  assert.equal(calls[1].init.headers['If-Match'], '"4"');
  assert.deepEqual(JSON.parse(calls[1].init.body), { graph: { nodes: [], edges: [], stages: [] } });
  assert.equal(calls[2].init.headers['If-Match'], '"5"');
  assert.equal(data.revisionOf('w1'), undefined);
});

test('错误体 details.issues 归一为 ApiError.issues', async () => {
  stubFetch(() => jsonResponse({
    error: {
      code: 'validation_error',
      message: '工作流定义不合法',
      details: { issues: [{ code: 'missing_start', path: 'graph.nodes', message: '缺少开始节点' }] }
    }
  }, 400));
  const data = createWorkflowData();
  await assert.rejects(data.create({ name: 'x' }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 'validation_error');
    assert.equal(err.issues[0].code, 'missing_start');
    return true;
  });
});

test('409 名称冲突与 revision 冲突文案分开', () => {
  assert.match(errorText({ status: 409, code: 'name_conflict', message: '' }), /名称已存在/);
  assert.match(errorText({ status: 409, code: 'revision_conflict', message: '' }), /刷新/);
  assert.match(errorText({ status: 0 }), /无法连接后端/);
});

test('exportDsl 解析 Content-Disposition 文件名并保留 YAML 文本', async () => {
  stubFetch(() => ({
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'content-disposition' ? 'attachment; filename="flow.yaml"' : null) },
    text: async () => 'dslVersion: 1\n'
  }));
  const data = createWorkflowData();
  const out = await data.exportDsl('w1', 'yaml');
  assert.equal(out.format, 'yaml');
  assert.equal(out.filename, 'flow.yaml');
  assert.equal(out.text, 'dslVersion: 1\n');
});

test('importDsl 先拒绝非法 JSON，再 POST 原始 DSL', async () => {
  const data = createWorkflowData();
  await assert.rejects(data.importDsl('{bad'), (err) => err.status === 400 && err.code === 'invalid_json');
  const calls = stubFetch(() => jsonResponse({ workflow: { id: 'w9', revision: 1 }, idMap: {}, warnings: [] }, 201));
  const result = await data.importDsl(JSON.stringify({ dslVersion: 1 }));
  assert.equal(result.workflow.id, 'w9');
  assert.equal(JSON.parse(calls[0].init.body).dslVersion, 1);
});
