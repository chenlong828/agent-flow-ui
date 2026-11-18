/**
 * 运行编排数据服务（L1）
 *
 * 运行实例两页唯一的 run API 入口：只做端点映射与错误归一，
 * 不渲染、不弹 Toast、不推断业务状态（状态机由 CMP-run 决定）。
 * 端点来自 B4 运行编排：API-42..API-53。
 */

import { request } from '../shared/http.js';

const BASE = '/api/v1';

export const RUN_STATE = {
  created: '已创建',
  running: '运行中',
  waiting_confirm: '等待人工确认',
  done: '已结束'
};

export const RUN_OUTCOME = {
  succeeded: '成功',
  failed: '失败',
  cancelled: '已终止'
};

export const NODE_STATE = {
  queued: '待执行',
  dispatched: '运行中',
  waiting_confirm: '等待人工确认',
  succeeded: '成功',
  rejected: '已驳回',
  failed: '失败'
};

export const ARCHIVE_STATE = {
  none: '无归档',
  pending: '待归档',
  stored: '已归档',
  failed: '归档失败'
};

export const ACTIVE_STATES = ['created', 'running', 'waiting_confirm'];

const CODE_TEXT = {
  session_not_linked: '该节点结果未关联会话；任务文件仍可查看',
  run_gone: '运行记录已按保留策略清理，无法再查看',
  observation_gone: '运行记录已按保留策略清理，无法再查看',
  session_archive_not_ready: '会话归档尚未完成，请稍后再试',
  archive_not_ready: '会话归档尚未完成，请稍后再试',
  path_escape: '路径非法，已回到根目录',
  invalid_path: '路径非法，已回到根目录',
  client_observability_unavailable: '执行节点观测面不可用：请确认 client 已启动并开启观测面',
  client_observability_unauthorized: '执行节点观测面鉴权失败，请检查 client token',
  client_observability_disabled: '执行节点未开启观测面'
};

function queryString(params) {
  const search = new URLSearchParams();
  Object.keys(params || {}).forEach(function (key) {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? '?' + text : '';
}

function sessionPath(runId, nodeId) {
  return BASE + '/runs/' + encodeURIComponent(runId) + '/nodes/' + encodeURIComponent(nodeId) + '/session';
}

function list(params) {
  return request({ method: 'GET', path: BASE + '/runs' + queryString(params) });
}

function get(id) {
  return request({ method: 'GET', path: BASE + '/runs/' + encodeURIComponent(id) });
}

function start(workflowId, input) {
  return request({
    method: 'POST',
    path: BASE + '/workflows/' + encodeURIComponent(workflowId) + '/runs',
    body: input
  });
}

function cancel(id) {
  return request({
    method: 'POST',
    path: BASE + '/runs/' + encodeURIComponent(id) + '/cancel'
  });
}

function decide(runId, nodeId, input) {
  return request({
    method: 'POST',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/nodes/' + encodeURIComponent(nodeId) + '/decision',
    body: input
  });
}

/** 会话日志由执行节点上传，返回 gzip JSONL；直接交给浏览器下载。 */
function sessionLogUrl(runId, nodeId, params) {
  return BASE + '/runs/' + encodeURIComponent(runId) + '/nodes/' + encodeURIComponent(nodeId) + '/session-log' + queryString(params);
}

/* ---------------- client 观测面（只读） ---------------- */

function listFiles(runId, opts) {
  opts = opts || {};
  return request({
    method: 'GET',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/files' +
      queryString({ root: opts.root, path: opts.path }),
    signal: opts.signal
  });
}

function readFile(runId, opts) {
  opts = opts || {};
  return request({
    method: 'GET',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/files/content' +
      queryString({ root: opts.root, path: opts.path }),
    signal: opts.signal
  });
}

function getSession(runId, nodeId, opts) {
  opts = opts || {};
  return request({
    method: 'GET',
    path: sessionPath(runId, nodeId) + queryString({ visit: opts.visit }),
    signal: opts.signal
  });
}

function listSessionEvents(runId, nodeId, opts) {
  opts = opts || {};
  return request({
    method: 'GET',
    path: sessionPath(runId, nodeId) + '/events' +
      queryString({ visit: opts.visit, cursor: opts.cursor, limit: opts.limit }),
    signal: opts.signal
  });
}

/** 只拼 URL；EventSource 由视图创建与关闭。 */
function sessionStreamUrl(runId, nodeId, params) {
  return sessionPath(runId, nodeId) + '/events/stream' + queryString(params);
}

/** raw zstd；由浏览器直接下载，不把流读进内存。 */
function sessionRawUrl(runId, nodeId, params) {
  return sessionPath(runId, nodeId) + '/raw' + queryString(params);
}

export function createRunData() {
  return {
    list: list,
    get: get,
    start: start,
    cancel: cancel,
    decide: decide,
    sessionLogUrl: sessionLogUrl,
    listFiles: listFiles,
    readFile: readFile,
    getSession: getSession,
    listSessionEvents: listSessionEvents,
    sessionStreamUrl: sessionStreamUrl,
    sessionRawUrl: sessionRawUrl
  };
}

function conflictText(err) {
  if (err.code === 'run_conflict') return '同一工作区已有进行中的运行，请先结束它';
  if (err.code === 'binding_conflict') return '执行节点已被占用，请刷新后重试';
  if (err.code === 'invalid_state') return '当前状态不允许该操作';
  if (err.code === 'session_log_missing') return '执行日志尚未上传，请稍后重试';
  return err.message || '状态冲突，请刷新后重试';
}

function statusText(err) {
  if (err.status === 400) {
    if (err.code === 'unsupported_node_type') return '该流程含暂不支持执行的节点（split/fanout 第二期开放）';
    return err.message || '请求不合法';
  }
  if (err.status === 404) return err.code === 'run_not_found' ? '运行不存在或已删除' : '目标不存在或已被删除';
  if (err.status === 409) return conflictText(err);
  if (err.status === 502 || err.status === 503) return '后端服务不可用，请检查运行服务';
  if (err.status === 504) return '请求超时，可稍后重试';
  return err.message || ('请求失败（HTTP ' + err.status + '）');
}

/** 页面统一错误文案；保留 code/status 供分支判断。 */
export function errorText(err) {
  if (!err) return '未知错误';
  if (CODE_TEXT[err.code]) return CODE_TEXT[err.code];
  if (err.status === 0) return '无法连接后端，请检查 BFF/运行服务';
  return statusText(err);
}

/** 运行耗时：终态用 finishedAt，进行中用当前时间。 */
export function durationMs(run, now) {
  if (!run || !run.startedAt) return null;
  const started = Date.parse(run.startedAt);
  if (Number.isNaN(started)) return null;
  const end = run.finishedAt ? Date.parse(run.finishedAt) : (now || Date.now());
  if (Number.isNaN(end)) return null;
  return Math.max(0, end - started);
}
