import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunData, errorText } from '../../assets/js/run/data.js';

test('观测面错误码映射为可操作文案', () => {
  assert.match(errorText({ status: 404, code: 'session_not_linked' }), /未关联会话/);
  assert.match(errorText({ status: 410, code: 'run_gone' }), /已按保留策略清理/);
  assert.match(errorText({ status: 409, code: 'session_archive_not_ready' }), /归档尚未完成/);
  assert.match(errorText({ status: 400, code: 'path_escape' }), /路径非法/);
  assert.match(errorText({ status: 504, code: 'client_observability_unavailable' }), /观测面不可用/);
  assert.match(errorText({ status: 401, code: 'client_observability_unauthorized' }), /鉴权失败/);
  assert.match(errorText({ status: 504 }), /超时/);
  assert.match(errorText({ status: 0 }), /无法连接后端/);
});

test('session URL 构造器编码 runId/nodeId 并带 visit', () => {
  const runs = createRunData();
  const stream = runs.sessionStreamUrl('r/1', 'n 1', { visit: 2 });
  assert.equal(stream, '/api/v1/runs/r%2F1/nodes/n%201/session/events/stream?visit=2');
  const raw = runs.sessionRawUrl('r/1', 'n 1', { visit: 1 });
  assert.equal(raw, '/api/v1/runs/r%2F1/nodes/n%201/session/raw?visit=1');
});
