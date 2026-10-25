/**
 * AgentFlow · B1 客户端数据层（window.API）
 *
 * 只做传输、If-Match 版本携带和统一错误解析；不复制、不改写 B1 DTO。
 * 页面直接消费 API DTO 字段（kind / accessMode / concurrencyMax / categoryCode ...）。
 * 测试通过 window.__AGENTFLOW_TRANSPORT__(method, path, body, headers) 注入内存传输。
 */
(function () {
  'use strict';

  var BASE = '/api/v1';
  var PATH = { harness: '/harnesses', tool: '/tools', skill: '/skills', expert: '/experts' };
  var revisions = Object.create(null);

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
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (ifMatch != null) headers['If-Match'] = '"' + ifMatch + '"';

    if (typeof window.__AGENTFLOW_TRANSPORT__ === 'function') {
      return Promise.resolve(window.__AGENTFLOW_TRANSPORT__(method, path, body, headers)).then(function (res) {
        if (res && res.status >= 400) fail(res.status, res.body);
        return res ? res.body : null;
      });
    }

    if (typeof fetch !== 'function') {
      var unsupported = new Error('当前环境不支持 fetch');
      unsupported.code = 'network_error';
      return Promise.reject(unsupported);
    }
    var opts = { method: method, headers: headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
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
    if (dto && dto.id && dto.revision != null) revisions[key(kind, dto.id)] = dto.revision;
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
      delete revisions[key(kind, id)];
      return data;
    });
  }

  function categories() {
    return request('GET', '/skill-categories').then(function (page) { return page.items || []; });
  }

  window.API = {
    list: list,
    get: get,
    create: create,
    update: update,
    patch: patch,
    setEnabled: setEnabled,
    remove: remove,
    categories: categories,
    revision: function (kind, id) { return revisions[key(kind, id)]; },
    errorText: function (error) {
      if (!error) return '操作失败';
      if (error.status === 404) return '目标不存在或已被删除';
      if (error.status === 409) return error.message || '数据已被其他操作修改，请刷新后重试';
      if (error.status === 428) return '缺少版本信息，请刷新后重试';
      if (error.status === 400) return error.message || '提交内容不合法';
      return error.message || '操作失败';
    }
  };
})();
