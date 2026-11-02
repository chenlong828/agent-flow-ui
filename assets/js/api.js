/**
 * AgentFlow · B1 客户端数据层
 *
 * 只做传输、If-Match 版本携带和统一错误解析；不复制、不改写 B1 DTO。
 * 页面直接消费 API DTO 字段（kind / accessMode / concurrencyMax / categoryCode ...）。
 * 测试通过真实 HTTP 路由注入响应，不读取页面内部状态。
 */

  var BASE = '/api/v1';
  var PATH = { harness: '/harnesses', tool: '/tools', skill: '/skills', expert: '/experts' };
  var revisions = Object.create(null);
  // 编排文档缓存：派生数据，唯一真相仍为 B1；以 ETag 做条件请求复用。
  var documents = Object.create(null);

  function key(kind, id) { return kind + ':' + id; }

  function qs(query) {
    if (!query) return '';
    var parts = [];
    Object.keys(query).forEach(function (k) {
      var v = query[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function parse(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function fail(status, data) {
    var error = new Error((data && data.error && data.error.message) || ('B1 返回 HTTP ' + status));
    error.status = status;
    error.code = data && data.error && data.error.code;
    error.details = data && data.error && data.error.details;
    throw error;
  }

  function request(method, path, body, ifMatch) {
    var headers = { 'Accept': 'application/json' };
    var isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (ifMatch != null) headers['If-Match'] = '"' + ifMatch + '"';

    if (typeof fetch !== 'function') {
      var unsupported = new Error('当前环境不支持 fetch');
      unsupported.code = 'network_error';
      return Promise.reject(unsupported);
    }
    var opts = { method: method, headers: headers };
    if (body !== undefined) opts.body = isForm ? body : JSON.stringify(body);
    return fetch(BASE + path, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = parse(text);
        if (!res.ok) fail(res.status, data);
        return data;
      });
    }).catch(function (error) {
      if (error && error.status) throw error;
      var wrapped = new Error('无法连接 B1 后端');
      wrapped.code = 'network_error';
      throw wrapped;
    });
  }

  function remember(kind, dto) {
    if (dto && dto.id && dto.revision != null) {
      var k = key(kind, dto.id);
      if (revisions[k] != null && revisions[k] !== dto.revision) delete documents[k];
      revisions[k] = dto.revision;
    }
    return dto;
  }

  function list(kind, query) {
    return request('GET', PATH[kind] + qs(query)).then(function (page) {
      (page.items || []).forEach(function (item) { remember(kind, item); });
      return page;
    });
  }

  function get(kind, id) {
    return request('GET', PATH[kind] + '/' + encodeURIComponent(id)).then(function (dto) {
      return remember(kind, dto);
    });
  }

  function create(kind, body) {
    return request('POST', PATH[kind], body).then(function (dto) { return remember(kind, dto); });
  }

  function update(kind, id, body, revision) {
    return request('PUT', PATH[kind] + '/' + encodeURIComponent(id), body, revision).then(function (dto) {
      return remember(kind, dto);
    });
  }

  function patch(kind, id, body, revision) {
    return request('PATCH', PATH[kind] + '/' + encodeURIComponent(id), body, revision).then(function (dto) {
      return remember(kind, dto);
    });
  }

  function setEnabled(kind, id, enabled, revision) {
    return request('PATCH', PATH[kind] + '/' + encodeURIComponent(id) + '/enabled', { enabled: enabled }, revision).then(function (dto) {
      return remember(kind, dto);
    });
  }

  function remove(kind, id, revision) {
    return request('DELETE', PATH[kind] + '/' + encodeURIComponent(id), undefined, revision).then(function (data) {
      var k = key(kind, id);
      delete revisions[k];
      delete documents[k];
      return data;
    });
  }

  function headerValue(res, name) {
    if (!res || !res.headers) return null;
    if (typeof res.headers.get === 'function') return res.headers.get(name);
    var lower = name.toLowerCase();
    var keys = Object.keys(res.headers);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === lower) return res.headers[keys[i]];
    }
    return null;
  }

  function settleDocument(kind, id, status, body, etag) {
    var k = key(kind, id);
    var cached = documents[k];
    if (status === 304) {
      if (!cached) {
        var miss = new Error('文档未修改但没有可复用的缓存');
        miss.code = 'document_cache_miss';
        throw miss;
      }
      return { text: cached.text, etag: cached.etag, notModified: true };
    }
    if (status >= 400) fail(status, typeof body === 'string' ? parse(body) : body);
    if (typeof body !== 'string') {
      var invalid = new Error('文档响应不是文本');
      invalid.code = 'invalid_document_response';
      throw invalid;
    }
    documents[k] = { etag: etag || null, text: body };
    return { text: body, etag: etag || null, notModified: false };
  }

  /**
   * 取编排文档（API-31）。纯文本原样返回，不在客户端二次拼装。
   * 首次 200 保存 ETag/文本；再次请求带 If-None-Match，304 复用上次文本。
   */
  function fetchDocument(kind, id) {
    var path = PATH[kind] + '/' + encodeURIComponent(id) + '/document';
    var cached = documents[key(kind, id)];
    var headers = { 'Accept': 'text/markdown' };
    if (cached && cached.etag) headers['If-None-Match'] = cached.etag;

    if (typeof fetch !== 'function') {
      var unsupported = new Error('当前环境不支持 fetch');
      unsupported.code = 'network_error';
      return Promise.reject(unsupported);
    }
    return fetch(BASE + path, { method: 'GET', headers: headers }).then(function (res) {
      return res.text().then(function (text) {
        return settleDocument(kind, id, res.status, res.status === 304 ? '' : text, headerValue(res, 'ETag'));
      });
    }).catch(function (error) {
      if (error && (error.status || error.code)) throw error;
      var wrapped = new Error('无法连接 B1 后端');
      wrapped.code = 'network_error';
      throw wrapped;
    });
  }

  /* ---------------- Skill 草稿 ---------------- */

  function draftCreate(skillId) {
    return request('POST', '/skill-drafts', { skillId: skillId || undefined });
  }

  function draftGet(id) {
    return request('GET', '/skill-drafts/' + encodeURIComponent(id));
  }

  function draftUpload(id, path, file) {
    var form = new FormData();
    form.append('path', path);
    form.append('file', file);
    return request('POST', '/skill-drafts/' + encodeURIComponent(id) + '/files', form);
  }

  function draftRename(id, path, newPath) {
    return request('PATCH', '/skill-drafts/' + encodeURIComponent(id) + '/files', { path: path, newPath: newPath });
  }

  function draftDeleteFile(id, path) {
    return request('DELETE', '/skill-drafts/' + encodeURIComponent(id) + '/files?path=' + encodeURIComponent(path));
  }

  function draftSave(id, body, revision) {
    return request('POST', '/skill-drafts/' + encodeURIComponent(id) + '/save', body, revision);
  }

  function draftCancel(id) {
    return request('DELETE', '/skill-drafts/' + encodeURIComponent(id));
  }

  function downloadUrl(kind, id) {
    return BASE + PATH[kind] + '/' + encodeURIComponent(id) + '/download';
  }

  function download(kind, id) {
    var url = downloadUrl(kind, id);
    var doc = document;
    var a = doc.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
  }

  function categories() {
    return request('GET', '/skill-categories').then(function (page) { return page.items || []; });
  }

  export const API = {
    list: list,
    get: get,
    create: create,
    update: update,
    patch: patch,
    setEnabled: setEnabled,
    remove: remove,
    document: fetchDocument,
    downloadUrl: downloadUrl,
    download: download,
    draftCreate: draftCreate,
    draftGet: draftGet,
    draftUpload: draftUpload,
    draftRename: draftRename,
    draftDeleteFile: draftDeleteFile,
    draftSave: draftSave,
    draftCancel: draftCancel,
    categories: categories,
    revision: function (kind, id) { return revisions[key(kind, id)]; },
    errorText: function (error) {
      if (!error) return '操作失败';
      if (error.status === 404) return '目标不存在或已被删除';
      if (error.status === 409) return error.message || '数据已被其他操作修改，请刷新后重试';
      if (error.status === 428) return '缺少版本信息，请刷新后重试';
      if (error.status === 410) return '草稿已过期，请重新编辑';
      if (error.status === 413) return '文件或整包超过大小限制';
      if (error.status === 415) return '上传格式不支持';
      if (error.status === 422 && error.code === 'skill_md_too_large') {
        return '正文超过 16 KiB，请把长内容放进 references/';
      }
      if (error.status === 400) {
        if (error.code === 'validation_error' && error.details && error.details.field === 'body') {
          return '契约已升级，请刷新页面';
        }
        return error.message || '提交内容不合法';
      }
      return error.message || '操作失败';
    }
  };
