/**
 * 测试专用：把 MOCK 夹具当作 B1 内存后端（Skill 包形态 v1 契约）。
 * 页面只通过 API 数据层消费 DTO；此文件负责 DTO ↔ 夹具的双向转换，
 * 让 M1 场景断言 MOCK 中的业务结果，不进入生产代码。
 */

import { MOCK } from '../assets/js/mock-data.js';

const SEED = {};
for (const k of Object.keys(MOCK)) {
  if (typeof MOCK[k] !== 'function') SEED[k] = structuredClone(MOCK[k]);
}


  var KIND = { '容器': 'container', '服务器': 'server', '台式机': 'desktop', '笔记本': 'laptop' };
  var ACCESS = { '常驻 Agent': 'agent', 'SSH': 'ssh', '容器注册': 'container_registry' };
  var HEALTH = { '在线': 'online', '离线': 'offline', '高负载': 'overloaded', '未知': 'unknown' };
  var TOOL_KIND = { 'MCP': 'mcp', 'CLI': 'cli', '脚本': 'script' };
  var TOOL_STATUS = { '未验证': 'unverified', '可用': 'available', '不可用': 'unavailable' };
  var CAT_CODE = { '编码': 'coding', '检索': 'retrieval', '审视': 'review', '测试': 'testing' };
  var CAT_LABEL = { coding: '编码', retrieval: '检索', review: '审视', testing: '测试' };
  var revs = Object.create(null);
  var seq = 0;

  /* ---------------- 运行编排夹具（B4 run API 子集） ---------------- */
  var WORKFLOW_IN_RUNS = '11111111-1111-4111-8111-111111111111';
  var runs = [];
  var lastStart = null;

  function resetRuns() {
    runs = [
      {
        runId: 'aaaaaaaa-0000-4000-8000-000000000001',
        workflowId: WORKFLOW_IN_RUNS,
        workflowRevision: 3,
        harnessId: 'h-1',
        clientId: 'client-stub-01',
        instanceId: 'bbbbbbbb-0000-4000-8000-000000000001',
        state: 'done',
        outcome: 'succeeded',
        currentNodeId: 'n3',
        archiveState: 'stored',
        createdAt: iso(30), startedAt: iso(30), finishedAt: iso(28),
        workspacePath: '/tmp/fake/ws-1',
        taskSpacePath: '/tmp/fake/ws-1/.agent-flow/task/aaaaaaaa-0000-4000-8000-000000000001',
        autoConfirm: false,
        finalMessage: '完成',
        error: null,
        nodes: [
          { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-1', verdict: null, message: '开始', error: null, dispatchedAt: iso(30), finishedAt: iso(29) },
          { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'succeeded', taskId: 't-2', verdict: null, message: '执行完成', error: null, dispatchedAt: iso(29), finishedAt: iso(28) },
          { nodeId: 'n3', nodeType: 'end', visit: 1, state: 'succeeded', taskId: 't-3', verdict: null, message: '完成', error: null, dispatchedAt: iso(28), finishedAt: iso(28) }
        ]
      },
      {
        runId: 'aaaaaaaa-0000-4000-8000-000000000002',
        workflowId: WORKFLOW_IN_RUNS,
        workflowRevision: 3,
        harnessId: 'h-1',
        clientId: 'client-stub-01',
        instanceId: 'bbbbbbbb-0000-4000-8000-000000000002',
        state: 'waiting_confirm',
        outcome: null,
        currentNodeId: 'n2',
        archiveState: 'none',
        createdAt: iso(10), startedAt: iso(10), finishedAt: null,
        workspacePath: '/tmp/fake/ws-2',
        taskSpacePath: '/tmp/fake/ws-2/.agent-flow/task/aaaaaaaa-0000-4000-8000-000000000002',
        autoConfirm: false,
        finalMessage: null,
        error: null,
        nodes: [
          { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-4', verdict: null, message: '开始', error: null, dispatchedAt: iso(10), finishedAt: iso(9) },
          { nodeId: 'n2', nodeType: 'confirm', visit: 1, state: 'waiting_confirm', taskId: null, verdict: null, message: '请确认方案', error: null, dispatchedAt: null, finishedAt: null }
        ]
      },
      {
        runId: 'aaaaaaaa-0000-4000-8000-000000000003',
        workflowId: WORKFLOW_IN_RUNS,
        workflowRevision: 3,
        harnessId: 'h-1',
        clientId: 'client-stub-01',
        instanceId: 'bbbbbbbb-0000-4000-8000-000000000003',
        state: 'running',
        outcome: null,
        currentNodeId: 'n2',
        archiveState: 'none',
        createdAt: iso(3), startedAt: iso(3), finishedAt: null,
        workspacePath: '/tmp/fake/ws-3',
        taskSpacePath: '/tmp/fake/ws-3/.agent-flow/task/aaaaaaaa-0000-4000-8000-000000000003',
        autoConfirm: false,
        finalMessage: null,
        error: null,
        nodes: [
          { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-5', verdict: null, message: '开始', error: null, dispatchedAt: iso(3), finishedAt: iso(2) },
          { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'dispatched', taskId: 't-6', verdict: null, message: '## 执行中\n\n- 步骤一\n- 步骤二', error: null, dispatchedAt: iso(2), finishedAt: null }
        ]
      },
      {
        runId: 'aaaaaaaa-0000-4000-8000-000000000004',
        workflowId: WORKFLOW_IN_RUNS,
        workflowRevision: 3,
        harnessId: 'h-1',
        clientId: 'client-stub-01',
        instanceId: 'bbbbbbbb-0000-4000-8000-000000000004',
        state: 'done',
        outcome: 'cancelled',
        currentNodeId: 'n1',
        archiveState: 'none',
        createdAt: iso(90), startedAt: iso(90), finishedAt: iso(89),
        workspacePath: '/tmp/fake/ws-4',
        taskSpacePath: '/tmp/fake/ws-4/.agent-flow/task/aaaaaaaa-0000-4000-8000-000000000004',
        autoConfirm: false,
        finalMessage: null,
        error: { code: 'cancelled', message: '运行已取消' },
        nodes: [
          { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'failed', taskId: 't-7', verdict: null, message: '', error: { code: 'cancelled', message: '任务已取消' }, dispatchedAt: iso(90), finishedAt: iso(89) }
        ]
      },
      {
        runId: 'aaaaaaaa-0000-4000-8000-000000000006',
        workflowId: WORKFLOW_IN_RUNS,
        workflowRevision: 3,
        harnessId: 'h-1',
        clientId: 'client-stub-01',
        instanceId: 'bbbbbbbb-0000-4000-8000-000000000006',
        state: 'waiting_resume',
        outcome: null,
        currentNodeId: 'n2',
        archiveState: 'none',
        createdAt: iso(24), startedAt: iso(24), finishedAt: null,
        workspacePath: '/tmp/fake/ws-6',
        taskSpacePath: '/tmp/fake/ws-6/.agent-flow/task/aaaaaaaa-0000-4000-8000-000000000006',
        autoConfirm: false,
        finalMessage: null,
        error: null,
        resumeDelayMs: 600,
        nodes: [
          { nodeId: 'n1', nodeType: 'start', visit: 1, state: 'succeeded', taskId: 't-9', verdict: null, message: '开始', error: null, dispatchedAt: iso(24), finishedAt: iso(23) },
          { nodeId: 'n2', nodeType: 'agent', visit: 1, state: 'waiting_resume', taskId: 't-10', verdict: null, message: '## 超时前输出\n\n- 已读取 intent.md\n- 等待继续', error: { code: 'timeout', message: 'prompt 超时（1800000ms）' }, dispatchedAt: iso(23), finishedAt: null }
        ]
      }
    ];
  }
  resetRuns();

  function runSummary(run) {
    return {
      runId: run.runId, workflowId: run.workflowId,
      workflowName: run.workflowName || '研发四阶段主流程',
      workflowRevision: run.workflowRevision,
      harnessId: run.harnessId, harnessName: run.harnessName || '本机研发 Harness',
      clientId: run.clientId, instanceId: run.instanceId,
      state: run.state, outcome: run.outcome, currentNodeId: run.currentNodeId,
      archiveState: run.archiveState, createdAt: run.createdAt, startedAt: run.startedAt, finishedAt: run.finishedAt
    };
  }
  function runDetail(run) {
    return Object.assign(runSummary(run), {
      workspacePath: run.workspacePath, taskSpacePath: run.taskSpacePath, autoConfirm: run.autoConfirm,
      finalMessage: run.finalMessage, error: run.error, graph: run.graph || null, nodes: run.nodes.slice()
    });
  }
  function runNotFound() {
    return { status: 404, body: { error: { code: 'run_not_found', message: '运行不存在', details: { runId: '' } } } };
  }
  function fakeEntry(name, path, type, sizeBytes, contentType, language, previewable) {
    return {
      name: name, path: path, type: type, sizeBytes: sizeBytes,
      modifiedAt: '2026-11-18T00:00:00.000Z', hidden: false, previewable: previewable !== false,
      contentType: contentType || null, language: language || null
    };
  }
  function fileListingResult(run, query) {
    var root = query.root === 'workspace' ? 'workspace' : 'task-space';
    var path = query.path || '';
    if (path.indexOf('..') >= 0) {
      return { status: 400, body: { error: { code: 'path_escape', message: '路径非法' } } };
    }
    var tree = root === 'workspace'
      ? { '': [fakeEntry('README.md', 'README.md', 'file', 240, 'text/markdown; charset=utf-8', 'markdown')] }
      : {
        '': [
          fakeEntry('intent.md', 'intent.md', 'file', 105, 'text/markdown; charset=utf-8', 'markdown'),
          fakeEntry('src', 'src', 'dir', null, null, null),
          fakeEntry('main.ts', 'main.ts', 'file', 180, 'text/typescript; charset=utf-8', 'typescript'),
          fakeEntry('logo.png', 'logo.png', 'file', 2048, 'image/png', null),
          fakeEntry('big.log', 'big.log', 'file', 2097152, 'text/plain; charset=utf-8', 'text')
        ],
        'src': [fakeEntry('index.ts', 'src/index.ts', 'file', 120, 'text/typescript; charset=utf-8', 'typescript')]
      };
    return {
      status: 200,
      body: { runId: run.runId, root: root, path: path, entries: tree[path] || [], truncated: false, fetchedAt: new Date().toISOString() }
    };
  }
  function fileContentResult(run, query) {
    var root = query.root === 'workspace' ? 'workspace' : 'task-space';
    var path = query.path || '';
    if (path.indexOf('..') >= 0) {
      return { status: 400, body: { error: { code: 'path_escape', message: '路径非法' } } };
    }
    var base = { runId: run.runId, root: root, path: path, modifiedAt: '2026-11-18T00:00:00.000Z', fetchedAt: new Date().toISOString() };
    if (root === 'workspace' && path === 'README.md') {
      return { status: 200, body: Object.assign(base, { name: 'README.md', sizeBytes: 240, contentType: 'text/markdown; charset=utf-8', language: 'markdown', content: '# 工作区\n\n共享产物。\n', truncated: false, reason: null }) };
    }
    if (root !== 'task-space') return notFound();
    if (path === 'intent.md') {
      return { status: 200, body: Object.assign(base, { name: 'intent.md', sizeBytes: 105, contentType: 'text/markdown; charset=utf-8', language: 'markdown', content: '# 启动意图\n\n创建 hello.txt。\n', truncated: false, reason: null }) };
    }
    if (path === 'main.ts' || path === 'src/index.ts') {
      return { status: 200, body: Object.assign(base, {
        name: path === 'main.ts' ? 'main.ts' : 'index.ts', sizeBytes: 120,
        contentType: 'text/typescript; charset=utf-8', language: 'typescript',
        content: path === 'main.ts'
          ? "export function hello(name: string) {\n  return 'hello ' + name;\n}\n"
          : "import { hello } from './main';\n\nhello('world');\n",
        truncated: false, reason: null
      }) };
    }
    if (path === 'logo.png') {
      return { status: 200, body: Object.assign(base, { name: 'logo.png', sizeBytes: 2048, contentType: 'image/png', language: null, content: null, truncated: false, reason: 'binary' }) };
    }
    if (path === 'big.log') {
      return { status: 200, body: Object.assign(base, { name: 'big.log', sizeBytes: 2097152, contentType: 'text/plain; charset=utf-8', language: 'text', content: 'line 1\n', truncated: true, reason: null }) };
    }
    return notFound();
  }
  function sessionStatus(node) {
    if (node.state === 'dispatched') return 'running';
    if (node.state === 'failed') return 'failed';
    return 'completed';
  }
  function sessionView(run, node) {
    return {
      runId: run.runId,
      nodeId: node.nodeId,
      visit: Number(node.visit) || 1,
      status: sessionStatus(node),
      cwd: '/tmp/fake/ws-history',
      startedAt: node.dispatchedAt || new Date().toISOString(),
      finishedAt: node.finishedAt || null,
      eventCount: run.eventProfile === 'many' ? 217 : 3,
      archive: { status: 'stored', sizeBytes: run.eventProfile === 'many' ? 381510 : 42063, sha256: 'abc' }
    };
  }
  function sessionEvents(run, node) {
    if (run.eventProfile === 'many') return manySessionEvents(node);
    var ts = node.dispatchedAt || new Date().toISOString();
    return [
      { seq: 1, ts: ts, kind: 'phase', event: 'session.started', data: {} },
      { seq: 2, ts: ts, kind: 'phase', event: 'prompt.sent', message: '读取 intent.md', data: {} },
      { seq: 3, ts: ts, kind: 'tool', event: 'tool.call', message: 'shell: ls', data: { text: 'evidence intent.md' } }
    ];
  }
  /** 217 条事件：66 次工具调用、42 次 usage、37 段思考、2 段消息、2 条 phase、2 条 result。 */
  function manySessionEvents(node) {
    var start = Date.parse(node.dispatchedAt || Date.now());
    var list = [];
    var seq = 0;
    function push(offsetSec, kind, event, message, data) {
      seq++;
      var item = { seq: seq, ts: new Date(start + offsetSec * 1000).toISOString(), kind: kind, event: event, data: data || {} };
      if (message) item.message = message;
      list.push(item);
    }
    push(0, 'phase', 'session.started', '', {});
    push(1, 'phase', 'prompt.sent', '', { bytes: 811 });
    var tools = ['bash', 'bash', 'bash', 'bash', 'edit', 'write', 'read', 'skill'];
    for (var i = 0; i < 66; i++) {
      var tool = tools[i % tools.length];
      push(2 + i * 2, 'acp', 'tool_call', 'tool call: ' + tool, { acpType: 'tool_call', tool: tool, status: 'in_progress' });
      push(3 + i * 2, 'acp', 'tool_call_update', 'tool ' + tool + ': completed', { acpType: 'tool_call_update', tool: tool, status: 'completed' });
    }
    for (var t = 0; t < 37; t++) {
      push(140 + t, 'acp', 'agent_thought_chunk', 'thought: ' + ((t + 1) * 20) + ' bytes', { acpType: 'agent_thought_chunk' });
    }
    for (var u = 0; u < 42; u++) {
      var used = Math.round(6340 + (u + 1) * (109917 / 42));
      push(180 + u, 'acp', 'usage_update', 'usage: ' + used + '/1000000', { acpType: 'usage_update', usage: { used: used, size: 1000000 } });
    }
    push(225, 'acp', 'agent_message_chunk', 'assistant: 完成', { acpType: 'agent_message_chunk' });
    push(226, 'acp', 'agent_message_chunk', 'assistant: 汇报', { acpType: 'agent_message_chunk' });
    push(227, 'result', 'task.result', 'result: succeeded', { status: 'succeeded' });
    push(228, 'result', 'task.result', 'result: final', { status: 'succeeded' });
    return list;
  }
  function after(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 0); });
  }
  function resumeNodeResult(run, nodeId) {
    if (run.resumeError) return run.resumeError;
    var node = run.nodes.filter(function (n) { return n.nodeId === nodeId; }).pop();
    if (run.state !== 'waiting_resume' || !node || node.state !== 'waiting_resume') {
      return { status: 409, body: { error: { code: 'invalid_state', message: '当前状态不允许该操作：node_not_waiting_resume', details: { reason: 'node_not_waiting_resume' } } } };
    }
    if (!node.taskId) {
      return { status: 409, body: { error: { code: 'invalid_state', message: '当前状态不允许该操作：task_missing', details: { reason: 'task_missing' } } } };
    }
    node.state = 'dispatched';
    node.error = null;
    node.finishedAt = null;
    run.state = 'running';
    run.outcome = null;
    run.finishedAt = null;
    return { status: 200, body: runDetail(run) };
  }
  function runResource(parts, method, body, headers, query) {
    var id = parts[1];
    if (method === 'GET' && parts.length === 1) {
      var items = runs.slice();
      if (query.state) items = items.filter(function (r) { return r.state === query.state; });
      if (query.workflowId) items = items.filter(function (r) { return r.workflowId === query.workflowId; });
      items.sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); });
      var limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
      var offset = Math.max(0, Number(query.offset) || 0);
      return Promise.resolve({ status: 200, body: { items: items.slice(offset, offset + limit).map(runSummary), total: items.length, limit: limit, offset: offset } });
    }
    var run = runs.find(function (r) { return r.runId === id; });
    if (!run) return Promise.resolve(runNotFound());
    if (method === 'GET' && parts.length === 2) return Promise.resolve({ status: 200, body: runDetail(run) });
    if (method === 'POST' && parts[2] === 'cancel') {
      if (run.state !== 'done') {
        run.state = 'done'; run.outcome = 'cancelled'; run.finishedAt = new Date().toISOString();
        run.error = run.error || { code: 'cancelled', message: '运行已取消' };
        run.nodes.forEach(function (n) { if (n.state === 'dispatched' || n.state === 'waiting_confirm') { n.state = 'failed'; n.error = { code: 'cancelled', message: '任务已取消' }; } });
      }
      return Promise.resolve({ status: 200, body: runDetail(run) });
    }
    if (method === 'POST' && parts[2] === 'nodes' && parts[4] === 'decision') {
      var nodeId = parts[3];
      var node = run.nodes.find(function (n) { return n.nodeId === nodeId; });
      if (!node || node.state !== 'waiting_confirm') {
        return Promise.resolve({ status: 409, body: { error: { code: 'invalid_state', message: '当前状态不允许该操作', details: { reason: '节点不在等待确认状态' } } } });
      }
      var decision = body && body.decision;
      if (decision !== 'pass' && decision !== 'reject') {
        return Promise.resolve({ status: 400, body: { error: { code: 'validation_error', message: 'decision 必须是 pass 或 reject' } } });
      }
      /* 执行中确认点：pass/reject 都续跑同一节点，visit 不变、taskId 替换，不推进到 n3。 */
      if (node.verdict && node.verdict.kind === 'confirmation_request') {
        node.state = 'dispatched';
        node.taskId = 't-resume-' + nodeId + '-' + (++seq);
        node.finishedAt = null;
        run.state = 'running';
        run.outcome = null;
        run.currentNodeId = nodeId;
        return Promise.resolve({ status: 200, body: runDetail(run) });
      }
      node.state = decision === 'pass' ? 'succeeded' : 'rejected';
      node.finishedAt = new Date().toISOString();
      node.message = (body.comment || node.message || '');
      node.verdict = { decision: decision, reason: body.comment || '' };
      run.state = decision === 'pass' ? 'running' : 'running';
      run.currentNodeId = 'n3';
      if (decision === 'pass') {
        run.nodes.push({ nodeId: 'n3', nodeType: 'end', visit: 1, state: 'dispatched', taskId: 't-8', verdict: null, message: '', error: null, dispatchedAt: new Date().toISOString(), finishedAt: null });
      }
      return Promise.resolve({ status: 200, body: runDetail(run) });
    }
    if (method === 'POST' && parts[2] === 'nodes' && parts[4] === 'resume') {
      return after(run.resumeDelayMs).then(function () {
        return resumeNodeResult(run, parts[3]);
      });
    }
    if (method === 'GET' && parts[2] === 'nodes' && parts[4] === 'session-log') {
      var visit = Number(query.visit) || 0;
      var target = run.nodes.find(function (n) {
        return n.nodeId === parts[3] && (!visit || (Number(n.visit) || 1) === visit);
      });
      if (!target || !target.taskId) return Promise.resolve(notFound());
      return Promise.resolve({ status: 200, body: null, headers: { 'Content-Type': 'application/x-ndjson', 'Content-Encoding': 'gzip', 'X-Checksum-Sha256': 'x' } });
    }
    if (method === 'GET' && parts[2] === 'files') {
      if (run.filesError) {
        return Promise.resolve({ status: run.filesError.status, body: { error: { code: run.filesError.code, message: run.filesError.message || run.filesError.code } } });
      }
      if (parts[3] === 'content') return Promise.resolve(fileContentResult(run, query));
      return Promise.resolve(fileListingResult(run, query));
    }
    if (method === 'GET' && parts[2] === 'nodes' && parts[4] === 'session') {
      if (run.sessionError) {
        return Promise.resolve({ status: run.sessionError.status, body: { error: { code: run.sessionError.code, message: run.sessionError.message || run.sessionError.code } } });
      }
      var visitNo = Number(query.visit) || 0;
      var node = run.nodes.find(function (n) {
        return n.nodeId === parts[3] && (!visitNo || (Number(n.visit) || 1) === visitNo);
      });
      if (!node || !node.taskId) {
        return Promise.resolve({ status: 404, body: { error: { code: 'session_not_linked', message: '节点尚未关联会话' } } });
      }
      if (parts[5] === 'raw') {
        return Promise.resolve({ status: 200, body: 'raw', headers: { 'Content-Type': 'application/zstd', 'Content-Length': '3', ETag: '"sha256-abc"', 'X-Checksum-Sha256': 'abc', 'Content-Disposition': 'attachment; filename="s.zst"' } });
      }
      if (parts[5] === 'events') {
        var allEvents = sessionEvents(run, node);
        var cursor = Number(query.cursor) || 0;
        var pageLimit = Math.max(1, Math.min(200, Number(query.limit) || 50));
        var pageItems = allEvents.filter(function (e) { return e.seq > cursor; }).slice(0, pageLimit);
        var next = pageItems.length ? String(pageItems[pageItems.length - 1].seq) : undefined;
        var payload = { items: pageItems };
        if (next) payload.nextCursor = next;
        return Promise.resolve({ status: 200, body: payload });
      }
      return Promise.resolve({ status: 200, body: sessionView(run, node) });
    }
    return Promise.resolve(notFound());
  }
  function startRun(workflowId, body) {
    lastStart = { workflowId: workflowId, body: body };
    if (!body || !body.harnessId || !body.workspacePath || body.intentMarkdown == null) {
      return Promise.resolve({ status: 400, body: { error: { code: 'validation_error', message: '缺少必填字段' } } });
    }
    var id = 'aaaaaaaa-0000-4000-8000-' + String(100 + (++seq)).padStart(12, '0');
    var run = {
      runId: id, workflowId: workflowId, workflowRevision: 1, harnessId: body.harnessId,
      clientId: 'client-stub-01', instanceId: 'bbbbbbbb-0000-4000-8000-' + String(200 + seq).padStart(12, '0'),
      state: 'running', outcome: null, currentNodeId: 'n1', archiveState: 'none',
      createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null,
      workspacePath: body.workspacePath, taskSpacePath: body.workspacePath + '/.agent-flow/task/' + id,
      autoConfirm: Boolean(body.autoConfirm), finalMessage: null, error: null,
      nodes: [{ nodeId: 'n1', nodeType: 'start', visit: 1, state: 'dispatched', taskId: 't-' + id, verdict: null, message: '', error: null, dispatchedAt: new Date().toISOString(), finishedAt: null }]
    };
    runs.unshift(run);
    return Promise.resolve({ status: 201, body: { runId: id }, headers: { Location: '/api/v1/runs/' + id } });
  }

  var SKILL_MD_LIMIT = 16384;
  var FILE_LIMIT = 20 * 1024 * 1024;
  var PACKAGE_LIMIT = 100 * 1024 * 1024;
  var FILE_COUNT_LIMIT = 100;
  var DRAFT_TTL_MS = 24 * 3600 * 1000;

  var SECTION_KINDS = ['overview', 'steps', 'examples', 'scripts', 'verification'];
  var SECTION_LABELS = {
    overview: '流程总述', steps: '详细步骤与约束', examples: '参考案例模板',
    scripts: '外部脚本使用指南', verification: '完成验证方案'
  };

  function rev(kind, id) {
    var k = kind + ':' + id;
    if (revs[k] == null) revs[k] = 1;
    return revs[k];
  }
  function bump(kind, id) {
    var k = kind + ':' + id;
    revs[k] = (revs[k] == null ? 1 : revs[k]) + 1;
    return revs[k];
  }
  function iso(minutes) {
    if (minutes == null) return null;
    return new Date(Date.now() - minutes * 60000).toISOString();
  }
  function createdAt(v) {
    if (v.createdAt) return v.createdAt;
    if (v.regAt) return new Date(v.regAt + 'T00:00:00Z').toISOString();
    return new Date().toISOString();
  }
  function conflict() {
    return { status: 409, body: { error: { code: 'revision_conflict', message: '版本冲突' } } };
  }
  function notFound() {
    return { status: 404, body: { error: { code: 'not_found', message: '目标不存在' } } };
  }
  function find(arr, id) {
    return arr.filter(function (x) { return x.id === id; })[0];
  }
  function ifMatch(kind, id, headers) {
    var raw = headers && (headers['If-Match'] || headers['if-match']);
    if (!raw) return true;
    return String(raw).replace(/^"|"$/g, '') === String(rev(kind, id));
  }
  function workflowRefs(id) {
    var n = 0;
    (MOCK.workflows || []).forEach(function (wf) {
      ((wf.graph && wf.graph.nodes) || []).forEach(function (node) {
        if (node.expertId === id) n++;
      });
    });
    return n;
  }

  function utf8Len(str) {
    var s = String(str == null ? '' : str);
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  function yamlScalar(value) {
    return '"' + String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }
  function composeMarkdown(fm, body) {
    return '---\nname: ' + yamlScalar(fm.name) + '\ndescription: ' + yamlScalar(fm.description) +
      '\nversion: ' + yamlScalar(fm.version) + '\n---\n\n' + String(body == null ? '' : body);
  }

  /* ---------------- Skill 包 ---------------- */

  function legacyBody(s) {
    var lines = [];
    SECTION_KINDS.forEach(function (kind) {
      var content = String((s.sections || {})[kind] || '').trim();
      if (content !== '') lines.push('## ' + SECTION_LABELS[kind], '', content, '');
    });
    if ((s.pitfalls || []).length) {
      lines.push('## 常见踩坑', '');
      s.pitfalls.forEach(function (p) { lines.push('- ' + String(p).trim()); });
      lines.push('');
    }
    if ((s.refs || []).length) {
      lines.push('## 参考资料', '');
      s.refs.forEach(function (r) {
        var suffix = r.path == null || r.path === '' ? '' : ' — ' + r.path;
        lines.push('- ' + r.label + '（' + (r.type || r.refType) + '）' + suffix);
      });
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '') + '\n';
  }

  function pkgOf(s) {
    if (!s._pkg) {
      s._pkg = {
        body: s.body != null ? String(s.body) : legacyBody(s),
        files: (s.files || []).map(function (f) { return { path: f.path, content: String(f.content == null ? '' : f.content) }; })
      };
    }
    return s._pkg;
  }

  function fileEntry(path, size, readOnly) {
    return { path: path, size: size, readOnly: readOnly };
  }

  function skillSummary(s) {
    return {
      id: s.id, name: s.name, slug: s.slug || s.id, categoryCode: CAT_CODE[s.category] || s.categoryCode || 'coding',
      categoryLabel: s.category, description: s.description, version: s.version,
      enabled: s.enabled !== false, tags: (s.tags || []).slice(),
      usedByCount: s.usedBy || 0, revision: rev('skill', s.id),
      updatedAt: iso(s.updatedM)
    };
  }

  function skillDetailDto(s) {
    var pkg = pkgOf(s);
    var files = [fileEntry('SKILL.md', utf8Len(composeMarkdown(s, pkg.body)), true)]
      .concat(pkg.files.map(function (f) { return fileEntry(f.path, utf8Len(f.content), true); }));
    return Object.assign(skillSummary(s), {
      body: pkg.body, files: files, createdAt: createdAt(s)
    });
  }

  function docResponse(s, headers) {
    var dto = skillSummary(s);
    var text = composeMarkdown(dto, pkgOf(s).body);
    var etag = '"' + rev('skill', s.id) + '"';
    var inm = headers && (headers['If-None-Match'] || headers['if-none-match']);
    if (inm === etag) return { status: 304, body: null, headers: { ETag: etag } };
    return { status: 200, body: text, headers: { ETag: etag, 'Content-Type': 'text/markdown; charset=utf-8' } };
  }

  /* ---------------- 草稿 ---------------- */

  var drafts = Object.create(null);
  var draftSeq = 0;

  function draftExpired(d) { return d.expiresAt <= Date.now(); }

  function draftFiles(d) {
    var list = [fileEntry('SKILL.md', utf8Len(composeMarkdown(d.fm, d.body)), true)];
    d.files.forEach(function (f) { list.push(fileEntry(f.path, utf8Len(f.content), false)); });
    return list;
  }

  function draftDto(d) {
    return {
      id: d.id, skillId: d.skillId, baseRevision: d.baseRevision, baseVersion: d.baseVersion,
      expiresAt: new Date(d.expiresAt).toISOString(), createdAt: new Date(d.createdAt).toISOString(),
      files: draftFiles(d)
    };
  }

  function createDraft(skillId) {
    var s = skillId ? find(MOCK.skills, skillId) : null;
    if (skillId && !s) return null;
    var pkg = s ? pkgOf(s) : { body: '', files: [] };
    var fm = s ? { name: s.name, description: s.description, version: s.version } : { name: '', description: '', version: 'v1.0' };
    var d = {
      id: 'd-' + (++draftSeq), skillId: skillId || null,
      baseRevision: s ? rev('skill', s.id) : 0,
      baseVersion: s ? s.version : '',
      fm: fm, body: pkg.body,
      files: pkg.files.map(function (f) { return { path: f.path, content: f.content }; }),
      createdAt: Date.now(), expiresAt: Date.now() + DRAFT_TTL_MS
    };
    drafts[d.id] = d;
    return d;
  }

  function pathError(path) {
    if (typeof path !== 'string' || !path) return '附件路径不能为空';
    if (utf8Len(path) > 512) return '附件路径过长';
    if (path === 'SKILL.md') return 'SKILL.md 不能作为附件';
    if (!/^(scripts|references)\//.test(path)) return '附件只能放在 scripts/ 或 references/ 下';
    if (path.indexOf('..') >= 0 || path.indexOf('\\') >= 0 || /[\u0000-\u001f]/.test(path)) return '附件路径不合法';
    var segments = path.split('/');
    if (segments.some(function (seg) { return !seg || utf8Len(seg) > 255; })) return '附件路径段不合法';
    return null;
  }

  function validateError(message, field) {
    return { status: 400, body: { error: { code: 'validation_error', message: message, details: { field: field || 'path' } } } };
  }

  async function uploadFile(d, body) {
    var path = null;
    var content = '';
    var size = 0;
    if (body && typeof body.get === 'function') {
      path = body.get('path');
      var file = body.get('file');
      if (file && typeof file.text === 'function') content = await file.text();
      else if (file != null) content = String(file);
      size = file && typeof file.size === 'number' ? file.size : utf8Len(content);
    } else if (body && body.path != null) {
      path = body.path; content = String(body.content == null ? '' : body.content); size = utf8Len(content);
    }
    var err = pathError(path);
    if (err) return validateError(err);
    if (size > FILE_LIMIT) return { status: 413, body: { error: { code: 'payload_too_large', message: '文件超过 20 MiB' } } };
    var total = utf8Len(d.body);
    d.files.forEach(function (f) { total += utf8Len(f.content); });
    if (total + size > PACKAGE_LIMIT) return { status: 413, body: { error: { code: 'payload_too_large', message: '整包超过 100 MiB' } } };
    var existing = d.files.filter(function (f) { return f.path === path; })[0];
    if (existing) { existing.content = content; existing.size = size; }
    else {
      if (d.files.length + 1 >= FILE_COUNT_LIMIT) {
        return { status: 413, body: { error: { code: 'payload_too_large', message: '文件数量超过 100 个' } } };
      }
      d.files.push({ path: path, content: content, size: size });
    }
    d.files.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    return null;
  }

  function renameFile(d, body) {
    var from = body && body.path;
    var to = body && body.newPath;
    var err = pathError(to);
    if (err) return validateError(err, 'newPath');
    var file = d.files.filter(function (f) { return f.path === from; })[0];
    if (!file) return notFound();
    if (d.files.some(function (f) { return f.path === to && f !== file; })) {
      return { status: 409, body: { error: { code: 'file_conflict', message: '目标路径已存在' } } };
    }
    file.path = to;
    d.files.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    return null;
  }

  function deleteFile(d, path) {
    var idx = -1;
    d.files.forEach(function (f, i) { if (f.path === path) idx = i; });
    if (idx < 0) return notFound();
    d.files.splice(idx, 1);
    return null;
  }

  function saveError(status, code, message, details) {
    return { status: status, body: { error: { code: code, message: message, details: details || {} } } };
  }

  function saveDraft(d, body, headers) {
    var skill = d.skillId ? find(MOCK.skills, d.skillId) : null;
    if (d.skillId && !skill) return notFound();
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return saveError(400, 'validation_error', 'name 不能为空', { field: 'name' });
    }
    var description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) return saveError(400, 'validation_error', 'description 不能为空', { field: 'description' });
    if (description.length > 400) return saveError(400, 'validation_error', 'description 不能超过 400 字', { field: 'description' });

    var others = MOCK.skills.filter(function (x) { return x.id !== d.skillId && x.name === body.name.trim(); });
    if (others.length) return saveError(409, 'name_conflict', '名称已存在');
    var slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (slug && (slug.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))) {
      return saveError(400, 'validation_error', 'slug 必须是 kebab-case', { field: 'slug' });
    }
    if (slug && MOCK.skills.some(function (x) { return x.id !== d.skillId && (x.slug || x.id) === slug; })) {
      return saveError(409, 'name_conflict', '英文名已存在', { field: 'slug' });
    }

    var version = skill ? nextVersion(skill.version) : 'v1.0';
    var fm = { name: body.name.trim(), description: description, version: version };
    var markdown = composeMarkdown(fm, body.body);
    var bytes = utf8Len(markdown);
    if (bytes > SKILL_MD_LIMIT) {
      return saveError(422, 'skill_md_too_large', 'SKILL.md 超过 16 KiB', { limitBytes: SKILL_MD_LIMIT, actualBytes: bytes });
    }

    if (skill) {
      var raw = headers && (headers['If-Match'] || headers['if-match']);
      if (!raw) return saveError(428, 'precondition_required', '缺少 If-Match');
      if (String(raw).replace(/^"|"$/g, '') !== String(rev('skill', skill.id))) return conflict();
      if (d.baseRevision !== rev('skill', skill.id)) return conflict();
      skill.name = fm.name; skill.description = fm.description;
      skill.slug = slug || skill.slug || skill.id;
      skill.category = CAT_LABEL[body.categoryCode] || body.categoryCode || skill.category;
      skill.tags = (body.tags || []).slice();
      skill.version = version;
      skill._pkg = { body: String(body.body == null ? '' : body.body), files: d.files.map(function (f) { return { path: f.path, content: f.content }; }) };
      bump('skill', skill.id);
      delete drafts[d.id];
      return { status: 200, body: { id: skill.id, revision: rev('skill', skill.id), version: version } };
    }

    var created = {
      id: 'sk-fake-' + (++seq), name: fm.name, slug: slug || ('skill-fake-' + seq),
      category: CAT_LABEL[body.categoryCode] || body.categoryCode || '编码',
      categoryCode: body.categoryCode || 'coding', description: fm.description, version: version,
      enabled: true, tags: (body.tags || []).slice(), usedBy: 0, updatedM: 0,
      _pkg: { body: String(body.body == null ? '' : body.body), files: d.files.map(function (f) { return { path: f.path, content: f.content }; }) }
    };
    MOCK.skills.push(created);
    revs['skill:' + created.id] = 1;
    delete drafts[d.id];
    return { status: 201, body: { id: created.id, revision: 1, version: version } };
  }

  function draftResource(parts, method, body, headers, query) {
    if (method === 'POST' && parts.length === 1) {
      var d = createDraft(body && body.skillId);
      if (!d) return Promise.resolve(notFound());
      return Promise.resolve({ status: 201, body: draftDto(d) });
    }
    var draft = drafts[parts[1]];
    if (!draft) return Promise.resolve(notFound());
    if (draftExpired(draft)) return Promise.resolve({ status: 410, body: { error: { code: 'draft_expired', message: '草稿已过期' } } });

    if (method === 'GET' && parts.length === 2) return Promise.resolve({ status: 200, body: draftDto(draft) });
    if (method === 'DELETE' && parts.length === 2) {
      delete drafts[draft.id];
      return Promise.resolve({ status: 204, body: null });
    }
    if (parts[2] === 'save' && method === 'POST') {
      return Promise.resolve(saveDraft(draft, body, headers));
    }
    if (parts[2] === 'files') {
      if (method === 'POST') {
        return uploadFile(draft, body).then(function (err) {
          if (err) return err;
          return { status: 200, body: { file: draftFiles(draft).filter(function (f) { return f.path !== 'SKILL.md'; })[0], files: draftFiles(draft) } };
        });
      }
      if (method === 'PATCH') {
        var renameErr = renameFile(draft, body);
        if (renameErr) return Promise.resolve(renameErr);
        return Promise.resolve({ status: 200, body: { files: draftFiles(draft) } });
      }
      if (method === 'DELETE') {
        var delErr = deleteFile(draft, query && query.path);
        if (delErr) return Promise.resolve(delErr);
        return Promise.resolve({ status: 204, body: null });
      }
    }
    return Promise.resolve({ status: 405, body: { error: { code: 'method_not_allowed', message: '不支持' } } });
  }

  /* ---------------- 其他资产（保持原语义） ---------------- */

  function harnessDto(h) {
    return {
      id: h.id, name: h.name, kind: KIND[h.type] || h.kind || 'server', address: h.address,
      accessMode: ACCESS[h.accessMode] || h.accessMode || 'agent', description: h.desc || '',
      concurrencyMax: h.max || 1, queuePolicy: h.queuePolicy || 'fifo', tags: (h.tags || []).slice(),
      enabled: !h._disabled, clientId: h.clientId || null,
      clientToken: h.clientId ? 'fake-token-' + h.id : null,
      health: HEALTH[h.health] || 'unknown',
      lastHeartbeatAt: iso(h.heartbeatM), toolCount: h.toolCount || 0,
      revision: rev('harness', h.id), createdAt: createdAt(h), updatedAt: createdAt(h)
    };
  }

  function toolDto(t) {
    var params = (t.params || []).map(function (p) {
      return { key: p.k, type: p.type, description: p.desc || '' };
    });
    return {
      id: t.id, name: t.name, kind: TOOL_KIND[t.type] || t.kind || 'cli',
      invocation: t.invocation, description: t.desc || '', harnessId: t.harness,
      timeoutMs: t.timeoutMs || 30000, params: params, paramCount: params.length,
      status: TOOL_STATUS[t.status] || 'unverified', usedByCount: t.refCount || 0,
      lastDebugAt: iso(t.lastDebugM), revision: rev('tool', t.id),
      createdAt: createdAt(t), updatedAt: createdAt(t)
    };
  }

  function toolSummary(t) {
    return { id: t.id, name: t.name, kind: TOOL_KIND[t.type] || t.kind || 'cli', status: TOOL_STATUS[t.status] || 'unverified' };
  }

  function expertDto(e, detail) {
    var skills = (e.skills || []).map(function (id) { return find(MOCK.skills, id); }).filter(Boolean);
    var tools = (e.tools || []).map(function (id) { return find(MOCK.tools, id); }).filter(Boolean);
    return {
      id: e.id, name: e.name, color: e.color, role: e.role, persona: (e.persona || []).slice(),
      enabled: e.enabled !== false, skillCount: e.skillCount || skills.length,
      toolCount: e.toolCount || tools.length,
      refCount: e.refCount != null ? e.refCount : workflowRefs(e.id),
      duty: e.duty || '', skillOrder: e.skillOrder || '', verifyOrder: e.verifyOrder || '', notes: e.notes || '',
      refs: (e.refs || []).map(function (r) { return { label: r.label, refType: r.type || r.refType, path: r.path }; }),
      skills: skills.map(function (s) { return { id: s.id, name: s.name, categoryLabel: s.category, version: s.version, description: s.description }; }),
      tools: detail ? tools.map(toolSummary) : [],
      revision: rev('expert', e.id), createdAt: createdAt(e), updatedAt: createdAt(e)
    };
  }

  function nextVersion(v) {
    var m = /^v(\d+)\.(\d+)$/.exec(v || 'v1.0');
    return m ? 'v' + m[1] + '.' + (parseInt(m[2], 10) + 1) : 'v1.1';
  }

  function applyHarness(h, body) {
    h.name = body.name; h.type = Object.keys(KIND).filter(function (k) { return KIND[k] === body.kind; })[0] || h.type;
    h.address = body.address;
    h.accessMode = Object.keys(ACCESS).filter(function (k) { return ACCESS[k] === body.accessMode; })[0] || h.accessMode;
    h.desc = body.description || ''; h.max = body.concurrencyMax; h.queuePolicy = body.queuePolicy;
    h.tags = (body.tags || []).slice(); h.health = '在线'; h.heartbeatM = 0.05; h.toolCount = h.toolCount || 0;
    if (body.enabled != null) h._disabled = !body.enabled;
    bump('harness', h.id);
  }

  function applyTool(t, body) {
    t.name = body.name;
    t.type = Object.keys(TOOL_KIND).filter(function (k) { return TOOL_KIND[k] === body.kind; })[0] || t.type;
    t.invocation = body.invocation; t.desc = body.description || ''; t.harness = body.harnessId;
    t.timeoutMs = body.timeoutMs; t.params = (body.params || []).map(function (p) {
      return { k: p.key, type: p.type, desc: p.description || '' };
    });
    t.refCount = t.refCount || 0; t.status = t.status || '未验证'; t.runs = t.runs || [];
    bump('tool', t.id);
  }

  function applyExpert(e, body, create) {
    e.name = body.name; e.color = body.color; e.role = body.role;
    e.persona = (body.persona || []).slice();
    e.duty = body.duty || ''; e.skillOrder = body.skillOrder || ''; e.verifyOrder = body.verifyOrder || '';
    e.notes = body.notes || '';
    e.refs = (body.refs || []).map(function (r) { return { label: r.label, type: r.refType, path: r.path }; });
    e.skills = (body.skillIds || e.skills || []).slice();
    e.tools = (body.toolIds || e.tools || []).slice();
    e.skillCount = e.skills.length; e.toolCount = e.tools.length;
    if (create && body.enabled != null) e.enabled = body.enabled;
    bump('expert', e.id);
  }

  function list(arr, map) {
    var items = arr.map(map);
    return Promise.resolve({ status: 200, body: { items: items, total: items.length, limit: 200, offset: 0 } });
  }

  function resource(parts, method, body, headers) {
    var kind = parts[0];
    var id = parts[1];
    var sub = parts[2];
    var arr = kind === 'harnesses' ? MOCK.harnesses
      : kind === 'tools' ? MOCK.tools
      : kind === 'skills' ? MOCK.skills
      : MOCK.experts;
    var map = kind === 'harnesses' ? harnessDto
      : kind === 'tools' ? toolDto
      : kind === 'skills' ? skillSummary
      : function (e) { return expertDto(e, false); };
    var kindName = { harnesses: 'harness', tools: 'tool', skills: 'skill', experts: 'expert' }[kind];

    if (method === 'GET' && parts.length === 1) return list(arr, map);
    if (method === 'GET' && parts.length === 2) {
      var item = find(arr, id);
      if (!item) return Promise.resolve(notFound());
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(item, true) : kind === 'skills' ? skillDetailDto(item) : map(item) });
    }
    if (method === 'POST' && parts.length === 1) {
      if (kind === 'skills') return Promise.resolve({ status: 404, body: { error: { code: 'not_found', message: '技能只能通过草稿保存创建' } } });
      if (arr.some(function (x) { return x.name === body.name; })) {
        return Promise.resolve({ status: 409, body: { error: { code: 'name_conflict', message: '名称已存在' } } });
      }
      var created;
      if (kind === 'harnesses') {
        created = { id: 'h-fake-' + (++seq), name: body.name, type: '服务器', address: body.address, accessMode: '常驻 Agent', tags: [], health: '在线', heartbeatM: 0.05, running: 0, max: 1, queuePolicy: 'fifo', regAt: '2026-10-25', desc: '', lastTasks: [] };
        applyHarness(created, body); arr.push(created);
      } else if (kind === 'tools') {
        created = { id: 't-fake-' + (++seq), name: body.name, type: 'CLI', invocation: body.invocation, params: [], harness: body.harnessId, timeoutMs: 30000, status: '未验证', desc: '', refCount: 0, lastDebugM: null, runs: [] };
        applyTool(created, body); arr.push(created);
      } else {
        created = { id: 'e-fake-' + (++seq), name: body.name, color: body.color, role: body.role, persona: [], skills: [], tools: [], duty: '', skillOrder: '', verifyOrder: '', notes: '', refs: [], enabled: true };
        arr.push(created); applyExpert(created, body, true);
      }
      return Promise.resolve({ status: 201, body: kind === 'experts' ? expertDto(created, true) : map(created) });
    }
    var existing = find(arr, id);
    if (!existing) return Promise.resolve(notFound());
    if (method === 'PUT') {
      if (kind === 'skills') return Promise.resolve({ status: 404, body: { error: { code: 'not_found', message: '技能只能通过草稿保存更新' } } });
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
      if (kind === 'harnesses') applyHarness(existing, body);
      else if (kind === 'tools') applyTool(existing, body);
      else applyExpert(existing, body, false);
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(existing, true) : map(existing) });
    }
    if (method === 'PATCH' && sub === 'enabled') {
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
      existing._disabled = !body.enabled; existing.enabled = body.enabled;
      bump(kindName, id);
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(existing, true) : kind === 'skills' ? skillDetailDto(existing) : map(existing) });
    }
    if (method === 'PATCH' && kind === 'experts') {
      if (!ifMatch('expert', id, headers)) return Promise.resolve(conflict());
      applyExpert(existing, body, false);
      return Promise.resolve({ status: 200, body: expertDto(existing, true) });
    }
    if (method === 'DELETE') {
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
      if (existing._runRefs && existing._runRefs.length) {
        var assetType = kind === 'experts' ? 'expert' : kind === 'harnesses' ? 'harness' : kindName;
        return Promise.resolve({ status: 409, body: { error: { code: 'referenced', message: '资产仍被引用，不能删除', details: { asset: { type: assetType, id: existing.id, name: existing.name }, references: existing._runRefs } } } });
      }
      if (kind === 'tools' && (existing.refCount || 0) > 0) {
        return Promise.resolve({ status: 409, body: { error: { code: 'referenced', message: '该工具被 ' + existing.refCount + ' 个专家引用，禁止删除' } } });
      }
      if (kind === 'skills' && (existing.usedBy || 0) > 0) {
        return Promise.resolve({ status: 409, body: { error: { code: 'referenced', message: '该 Skill 被 ' + existing.usedBy + ' 位专家引用，禁止删除' } } });
      }
      arr.splice(arr.indexOf(existing), 1);
      return Promise.resolve({ status: 204, body: null });
    }
    return Promise.resolve({ status: 405, body: { error: { code: 'method_not_allowed', message: '不支持' } } });
  }

  export const fakeB1 = {
    lastStartRequest: function () { return lastStart; },
    expireDrafts: function () {
      Object.keys(drafts).forEach(function (id) { drafts[id].expiresAt = Date.now() - 1; });
    },
    draftCount: function () { return Object.keys(drafts).length; }
  };

  export function handle(method, path, body, headers) {
    var raw = String(path);
    var qIdx = raw.indexOf('?');
    var query = {};
    if (qIdx >= 0) {
      raw.slice(qIdx + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    var u = raw.split('?')[0].replace(/^\/+|\/+$/g, '');
    var parts = u.split('/').filter(Boolean);
    if (parts[0] === 'skill-categories') {
      return Promise.resolve({ status: 200, body: { items: [
        { code: 'coding', label: '编码', position: 0 }, { code: 'retrieval', label: '检索', position: 1 },
        { code: 'review', label: '审视', position: 2 }, { code: 'testing', label: '测试', position: 3 }
      ] } });
    }
    if (parts[0] === 'skill-drafts') return draftResource(parts, method, body, headers, query);
    if (parts[0] === 'runs') return runResource(parts, method, body, headers, query);
    if (parts[0] === 'workflows' && parts[2] === 'runs' && method === 'POST') return startRun(parts[1], body);
    if (parts[0] === 'skills' && parts[2] === 'document' && method === 'GET') {
      var s = find(MOCK.skills, parts[1]);
      if (!s) return Promise.resolve(notFound());
      return Promise.resolve(docResponse(s, headers));
    }
    if (parts[0] === 'skills' && parts[2] === 'download' && method === 'GET') {
      var dl = find(MOCK.skills, parts[1]);
      if (!dl) return Promise.resolve(notFound());
      return Promise.resolve({ status: 200, body: null, headers: { ETag: '"' + rev('skill', dl.id) + '"', 'Content-Type': 'application/zip' } });
    }
    return resource(parts, method, body, headers);
  };

/** 测试注入一条运行记录（不进入默认 5 条列表夹具，避免影响列表计数断言）。 */
export function addRunFixture(run) {
  runs.push(run);
  return run;
}

export function resetFakeB1() {
  revs = Object.create(null);
  seq = 0;
  resetRuns();
  drafts = Object.create(null);
  for (const k of Object.keys(SEED)) MOCK[k] = structuredClone(SEED[k]);
}
