/**
 * 运行编排数据服务（L1）
 *
 * 运行实例两页唯一的 run API 入口：只做端点映射与错误归一，
 * 不渲染、不弹 Toast、不推断业务状态（状态机由 CMP-run 决定）。
 * 端点来自 B4 运行编排：API-42..API-58（含图片初始资料上传/删除/列表/内容）。
 */

import { ApiError, request } from '../shared/http.js';

const BASE = '/api/v1';
const UPLOAD_TIMEOUT_MS = 120000;

export const RUN_STATE = {
  created: '已创建',
  running: '运行中',
  waiting_confirm: '等待人工确认',
  waiting_resume: '执行超时，等待继续',
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
  waiting_resume: '超时，等待继续',
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

export const ACTIVE_STATES = ['created', 'running', 'waiting_confirm', 'waiting_resume'];

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
  client_observability_disabled: '执行节点未开启观测面',
  client_unsupported: '执行节点暂不支持图片（未升级或未上线）；图片已保留，升级后可直接重试'
};

/** 409 invalid_state 的续跑细分原因；只匹配后端约定的 reason。 */
const RESUME_REASON_TEXT = {
  node_not_waiting_resume: '节点已不在等待继续状态，请刷新后重试',
  task_missing: '该节点没有可续跑的任务，无法继续',
  session_missing: '该节点超时结果缺少会话，无法继续',
  instance_not_dispatchable: '执行节点已停用或不可用，请联系管理员',
  task_not_resumable: '任务已不可重开，请刷新后重试或终止运行'
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

/* ---------------- 初始资料（图片） ---------------- */

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function errorFromResponse(status, text) {
  const data = parseJson(text);
  const body = data && typeof data === 'object' && data.error && typeof data.error === 'object' ? data.error : data;
  const details = body && typeof body === 'object' && body.details && typeof body.details === 'object' ? body.details : null;
  return new ApiError(
    status,
    body && typeof body === 'object' && typeof body.code === 'string' ? body.code : undefined,
    body && typeof body === 'object' && typeof body.message === 'string' ? body.message : undefined,
    details
  );
}

/** 上传单张图片。multipart 的上传进度只有 XHR 能拿到；同源 BFF 负责转发。 */
function uploadInput(file, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    if (opts.signal && opts.signal.aborted) {
      reject(new ApiError(0, 'aborted', '上传已取消'));
      return;
    }
    let xhr;
    try {
      xhr = new XMLHttpRequest();
    } catch {
      reject(new ApiError(0, 'network_error', '当前环境不支持上传'));
      return;
    }
    let settled = false;
    const settle = function (fn, value) {
      if (settled) return;
      settled = true;
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      fn(value);
    };
    const onAbort = function () { xhr.abort(); };

    const form = new FormData();
    form.append('file', file);
    xhr.open('POST', BASE + '/run-inputs');
    xhr.timeout = opts.timeout || UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = function (event) {
      if (!opts.onProgress) return;
      if (!event.lengthComputable || !event.total) return;
      opts.onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = function () {
      const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
      if (xhr.status === 201) {
        const data = parseJson(text);
        if (data && typeof data.inputId === 'string') settle(resolve, data);
        else settle(reject, new ApiError(xhr.status, 'invalid_response', '上传响应格式不正确'));
        return;
      }
      settle(reject, errorFromResponse(xhr.status, text));
    };
    xhr.onerror = function () { settle(reject, new ApiError(0, 'network_error', '无法连接后端')); };
    xhr.ontimeout = function () { settle(reject, new ApiError(0, 'timeout', '上传超时，请重试')); };
    xhr.onabort = function () { settle(reject, new ApiError(0, 'aborted', '上传已取消')); };
    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true });
    try {
      xhr.send(form);
    } catch {
      settle(reject, new ApiError(0, 'network_error', '上传请求发送失败'));
    }
  });
}

/** 删除未绑定的暂存项；404 由调用方视为已清理。 */
function deleteInput(inputId) {
  return request({
    method: 'DELETE',
    path: BASE + '/run-inputs/' + encodeURIComponent(inputId)
  });
}

/** 运行绑定的初始资料清单（只读）。 */
function listInputs(runId, opts) {
  opts = opts || {};
  return request({
    method: 'GET',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/inputs',
    signal: opts.signal
  });
}

/** 只拼 URL；图片由浏览器直接加载，不读进内存。 */
function inputContentUrl(runId, inputId) {
  return BASE + '/runs/' + encodeURIComponent(runId) + '/inputs/' + encodeURIComponent(inputId) + '/content';
}

function decide(runId, nodeId, input) {
  return request({
    method: 'POST',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/nodes/' + encodeURIComponent(nodeId) + '/decision',
    body: input
  });
}

/** 超时节点继续执行：无请求体，后端把同一 task 重开为下一 attempt。 */
function resumeNode(runId, nodeId) {
  return request({
    method: 'POST',
    path: BASE + '/runs/' + encodeURIComponent(runId) + '/nodes/' + encodeURIComponent(nodeId) + '/resume'
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
    resumeNode: resumeNode,
    uploadInput: uploadInput,
    deleteInput: deleteInput,
    listInputs: listInputs,
    inputContentUrl: inputContentUrl,
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
    if (err.details && err.details.field === 'inputs') return '有图片已失效，请重新添加';
    return err.message || '请求不合法';
  }
  if (err.status === 404) return err.code === 'run_not_found' ? '运行不存在或已删除' : '目标不存在或已被删除';
  if (err.status === 409) {
    const reason = err.details && err.details.reason;
    if (reason && RESUME_REASON_TEXT[reason]) return RESUME_REASON_TEXT[reason];
    return conflictText(err);
  }
  if (err.status === 413) {
    const limit = err.details && err.details.limit;
    if (limit === 'run_input_file_bytes') return '单张图片不能超过 8 MiB';
    if (limit === 'run_input_count') return '最多 8 张图片';
    if (limit === 'run_input_bytes') return '图片合计不能超过 20 MiB';
    return err.message || '请求内容超过限制';
  }
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

/** 单张图片上传的错误文案：网络、超时、体积、格式分别可操作。 */
export function uploadErrorText(err) {
  if (!err) return '上传失败，请重试';
  if (err.code === 'aborted') return '已取消上传';
  if (err.code === 'timeout') return '上传超时，请重试';
  if (err.status === 0) return '上传失败，请检查网络后重试';
  if (err.status === 413) return '单张图片不能超过 8 MiB';
  if (err.status === 415) return '上传请求格式不正确';
  if (err.status === 400) return '不支持的图片格式';
  if (err.status === 404) return '暂存项不存在，请重试';
  if (err.status >= 500) return '上传失败，请重试';
  return err.message || '上传失败，请重试';
}

/** 决策提交错误按 UI 对接约定映射；409 由页面刷新详情，不在本函数重试。 */
export function decisionErrorText(err) {
  if (!err) return '未知错误';
  if (err.status === 400) return '决策参数不合法，请修正后重试';
  if (err.status === 404) return '运行或节点已不存在';
  if (err.status === 409) return '该确认已被处理或状态已变化，已刷新';
  if (err.status === 503) return '服务暂不可用，请稍后重试';
  return errorText(err);
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
