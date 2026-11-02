/**
 * 工作流数据服务（L1）
 *
 * 两页唯一 B3 读写入口。只做端点映射、revision 缓存与错误归一；
 * 不渲染、不弹 Toast、不实现拓扑规则（validate.js）。
 */

import { ApiError, request, requestText } from '../shared/http.js';

const BASE = '/api/v1/workflows';

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

function filenameFrom(headers, fallback) {
  const raw = headers && typeof headers.get === 'function' ? headers.get('content-disposition') : '';
  const m = /filename="?([^";]+)"?/.exec(raw || '');
  return m ? m[1] : fallback;
}

export function createWorkflowData() {
  const revisions = new Map();

  function remember(detail) {
    if (detail && detail.id && detail.revision !== undefined) revisions.set(detail.id, detail.revision);
    return detail;
  }

  function revisionOf(id) {
    return revisions.has(id) ? revisions.get(id) : undefined;
  }

  function list(params) {
    return request({ method: 'GET', path: BASE + queryString(params) });
  }

  function get(id) {
    return request({ method: 'GET', path: BASE + '/' + encodeURIComponent(id) }).then(remember);
  }

  function create(input) {
    return request({ method: 'POST', path: BASE, body: input }).then(function (result) {
      if (result && result.id && result.revision !== undefined) revisions.set(result.id, result.revision);
      return result;
    });
  }

  function copy(id, input) {
    return request({
      method: 'POST',
      path: BASE + '/' + encodeURIComponent(id) + '/copy',
      body: input || {}
    });
  }

  function update(id, revision, input) {
    return request({
      method: 'PUT',
      path: BASE + '/' + encodeURIComponent(id),
      body: input,
      ifMatch: revision
    }).then(remember);
  }

  function remove(id, revision) {
    return request({
      method: 'DELETE',
      path: BASE + '/' + encodeURIComponent(id),
      ifMatch: revision
    }).then(function (result) {
      revisions.delete(id);
      return result;
    });
  }

  function save(id, revision, graph) {
    return request({
      method: 'PUT',
      path: BASE + '/' + encodeURIComponent(id) + '/definition',
      body: { graph: graph },
      ifMatch: revision
    }).then(function (result) {
      if (result && result.workflow) remember(result.workflow);
      return result;
    });
  }

  function validate(id, graph) {
    return request({
      method: 'POST',
      path: BASE + '/' + encodeURIComponent(id) + '/validate',
      body: { graph: graph }
    });
  }

  function exportDsl(id, format) {
    const fmt = format === 'yaml' ? 'yaml' : 'json';
    return requestText({
      method: 'GET',
      path: BASE + '/' + encodeURIComponent(id) + '/dsl?format=' + fmt
    }).then(function (res) {
      return {
        text: res.text,
        format: fmt,
        filename: filenameFrom(res.headers, 'workflow-' + id + '.' + fmt),
        contentType: fmt === 'json' ? 'application/json' : 'application/yaml'
      };
    });
  }

  async function importDsl(text) {
    let body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      throw new ApiError(400, 'invalid_json', 'DSL 不是合法的 JSON');
    }
    return request({ method: 'POST', path: BASE + '/import', body: body }).then(function (result) {
      if (result && result.workflow) remember(result.workflow);
      return result;
    });
  }

  return {
    list: list,
    get: get,
    create: create,
    copy: copy,
    update: update,
    remove: remove,
    save: save,
    validate: validate,
    exportDsl: exportDsl,
    importDsl: importDsl,
    revisionOf: revisionOf
  };
}

/** 页面统一错误文案；不吞掉 code/status，供 409/428 分支判断。 */
export function errorText(err) {
  if (!err) return '未知错误';
  if (err.status === 0) return '无法连接后端，请检查 BFF/B3 服务';
  if (err.status === 400) return err.message || '请求不合法';
  if (err.status === 404) return '工作流不存在或已删除';
  if (err.status === 409) {
    if (err.code === 'name_conflict') return '名称已存在，请换一个名称';
    return '工作流已被他人修改，请刷新后重试';
  }
  if (err.status === 428) return '缺少版本条件，请刷新后重试';
  if (err.status === 502 || err.status === 503) return '后端服务不可用';
  return err.message || ('请求失败（HTTP ' + err.status + '）');
}
