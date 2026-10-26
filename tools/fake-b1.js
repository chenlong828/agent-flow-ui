/**
 * 测试专用：把 MOCK 夹具当作 B1 内存后端。
 * 页面只通过 window.API 消费 DTO；此文件负责 DTO ↔ 夹具的双向转换，
 * 让 M1 既有场景继续断言 MOCK 中的业务结果，不进入生产代码。
 */
(function () {
  'use strict';

  var KIND = { '容器': 'container', '服务器': 'server', '台式机': 'desktop', '笔记本': 'laptop' };
  var ACCESS = { '常驻 Agent': 'agent', 'SSH': 'ssh', '容器注册': 'container_registry' };
  var HEALTH = { '在线': 'online', '离线': 'offline', '高负载': 'overloaded', '未知': 'unknown' };
  var TOOL_KIND = { 'MCP': 'mcp', 'CLI': 'cli', '脚本': 'script' };
  var TOOL_STATUS = { '未验证': 'unverified', '可用': 'available', '不可用': 'unavailable' };
  var CAT_CODE = { '编码': 'coding', '检索': 'retrieval', '审视': 'review', '测试': 'testing' };
  var CAT_LABEL = { coding: '编码', retrieval: '检索', review: '审视', testing: '测试' };
  var revs = Object.create(null);
  var seq = 0;

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
    var raw = headers && headers['If-Match'];
    if (!raw) return true;
    return String(raw).replace(/^"|"$/g, '') === String(rev(kind, id));
  }
  function workflowRefs(id) {
    var n = 0;
    (window.MOCK.workflows || []).forEach(function (wf) {
      ((wf.graph && wf.graph.nodes) || []).forEach(function (node) {
        if (node.expertId === id) n++;
      });
    });
    return n;
  }

  function harnessDto(h) {
    return {
      id: h.id, name: h.name, kind: KIND[h.type] || h.kind || 'server', address: h.address,
      accessMode: ACCESS[h.accessMode] || h.accessMode || 'agent', description: h.desc || '',
      concurrencyMax: h.max || 1, queuePolicy: h.queuePolicy || 'fifo', tags: (h.tags || []).slice(),
      enabled: !h._disabled, health: HEALTH[h.health] || 'unknown',
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

  function skillDto(s) {
    return {
      id: s.id, name: s.name, categoryCode: CAT_CODE[s.category] || s.categoryCode || 'coding',
      categoryLabel: s.category, description: s.description, version: s.version, enabled: s.enabled !== false,
      tags: (s.tags || []).slice(),
      sections: s.sections || { overview: '', steps: '', examples: '', scripts: '', verification: '' },
      pitfalls: (s.pitfalls || []).slice(),
      refs: (s.refs || []).map(function (r) { return { label: r.label, refType: r.type || r.refType, path: r.path }; }),
      usedByCount: s.usedBy || 0, revision: rev('skill', s.id),
      createdAt: createdAt(s), updatedAt: iso(s.updatedM)
    };
  }

  function skillSummary(s) {
    return { id: s.id, name: s.name, categoryLabel: s.category, version: s.version, description: s.description };
  }
  function toolSummary(t) {
    return { id: t.id, name: t.name, kind: TOOL_KIND[t.type] || t.kind || 'cli', status: TOOL_STATUS[t.status] || 'unverified' };
  }

  function expertDto(e, detail) {
    var skills = (e.skills || []).map(function (id) { return find(window.MOCK.skills, id); }).filter(Boolean);
    var tools = (e.tools || []).map(function (id) { return find(window.MOCK.tools, id); }).filter(Boolean);
    return {
      id: e.id, name: e.name, color: e.color, role: e.role, persona: (e.persona || []).slice(),
      enabled: e.enabled !== false, skillCount: e.skillCount || skills.length,
      toolCount: e.toolCount || tools.length,
      refCount: e.refCount != null ? e.refCount : workflowRefs(e.id),
      duty: e.duty || '', skillOrder: e.skillOrder || '', verifyOrder: e.verifyOrder || '', notes: e.notes || '',
      refs: (e.refs || []).map(function (r) { return { label: r.label, refType: r.type || r.refType, path: r.path }; }),
      skills: (detail ? skills : skills.slice(0, 3)).map(detail ? skillSummary : skillSummary),
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

  function applySkill(s, body) {
    s.name = body.name;
    s.category = CAT_LABEL[body.categoryCode] || body.categoryCode;
    s.categoryCode = body.categoryCode;
    s.description = body.description; s.tags = (body.tags || []).slice();
    s.sections = body.sections || s.sections;
    s.pitfalls = (body.pitfalls || []).slice();
    s.refs = (body.refs || []).map(function (r) { return { label: r.label, type: r.refType, path: r.path }; });
    s.version = (s.version || 'v1.0');
    bump('skill', s.id);
  }

  /* 契约 v2：旧字段直接 400，描述必填且 1–400 字；与 B1 的错误形状一致。 */
  function skillBodyError(body) {
    if (body && (body.summary !== undefined || body.triggers !== undefined)) {
      return { status: 400, body: { error: { code: 'validation_error', message: '请求体包含未知字段', details: { field: 'body' } } } };
    }
    var description = body && body.description;
    if (typeof description !== 'string' || description.trim().length === 0) {
      return { status: 400, body: { error: { code: 'validation_error', message: 'description 不能为空', details: { field: 'description' } } } };
    }
    if (description.trim().length > 400) {
      return { status: 400, body: { error: { code: 'validation_error', message: 'description 长度不能超过 400', details: { field: 'description' } } } };
    }
    return null;
  }

  var SECTION_LABELS = {
    overview: '流程总述', steps: '执行步骤', examples: '示例', scripts: '脚本', verification: '完成验证'
  };
  var SECTION_KINDS = ['overview', 'steps', 'examples', 'scripts', 'verification'];

  function yamlScalar(value) {
    return '"' + String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }

  /* 与 B1 API-31 同构：frontmatter + 五章 + 可选踩坑/参考资料。 */
  function composeSkillDocument(dto) {
    var lines = ['---', 'name: ' + yamlScalar(dto.name), 'description: ' + yamlScalar(dto.description),
      'version: ' + yamlScalar(dto.version), '---', ''];
    SECTION_KINDS.forEach(function (kind) {
      lines.push('## ' + SECTION_LABELS[kind], '');
      var content = String((dto.sections || {})[kind] || '').trim();
      if (content !== '') lines.push(content, '');
    });
    if ((dto.pitfalls || []).length > 0) {
      lines.push('## 常见踩坑', '');
      dto.pitfalls.forEach(function (p) { lines.push('- ' + String(p).trim()); });
      lines.push('');
    }
    if ((dto.refs || []).length > 0) {
      lines.push('## 参考资料', '');
      dto.refs.forEach(function (r) {
        var suffix = r.path == null || r.path === '' ? '' : ' — ' + r.path;
        lines.push('- ' + r.label + '（' + r.refType + '）' + suffix);
      });
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '') + '\n';
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

  function list(arr, map, query) {
    var items = arr.map(map);
    return Promise.resolve({ status: 200, body: { items: items, total: items.length, limit: 200, offset: 0 } });
  }

  function resource(parts, method, body, headers) {
    var kind = parts[0];
    var id = parts[1];
    var sub = parts[2];
    var arr = kind === 'harnesses' ? window.MOCK.harnesses
      : kind === 'tools' ? window.MOCK.tools
      : kind === 'skills' ? window.MOCK.skills
      : window.MOCK.experts;
    var map = kind === 'harnesses' ? harnessDto
      : kind === 'tools' ? toolDto
      : kind === 'skills' ? skillDto
      : function (e) { return expertDto(e, false); };
    var kindName = { harnesses: 'harness', tools: 'tool', skills: 'skill', experts: 'expert' }[kind];

    if (method === 'GET' && parts.length === 1) return list(arr, map);
    if (method === 'GET' && parts.length === 2) {
      var item = find(arr, id);
      if (!item) return Promise.resolve(notFound());
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(item, true) : map(item) });
    }
    if (method === 'POST' && parts.length === 1) {
      if (kind === 'skills') {
        var bodyErr = skillBodyError(body);
        if (bodyErr) return Promise.resolve(bodyErr);
      }
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
      } else if (kind === 'skills') {
        created = { id: 'sk-fake-' + (++seq), name: body.name, category: '编码', description: body.description, version: 'v1.0', enabled: true, tags: [], usedBy: 0, updatedM: 0, sections: body.sections, pitfalls: [], refs: [] };
        applySkill(created, body); arr.push(created);
      } else {
        created = { id: 'e-fake-' + (++seq), name: body.name, color: body.color, role: body.role, persona: [], skills: [], tools: [], duty: '', skillOrder: '', verifyOrder: '', notes: '', refs: [], enabled: true };
        arr.push(created); applyExpert(created, body, true);
      }
      return Promise.resolve({ status: 201, body: kind === 'experts' ? expertDto(created, true) : map(created) });
    }
    var existing = find(arr, id);
    if (!existing) return Promise.resolve(notFound());
    if (method === 'PUT') {
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
      if (kind === 'skills') {
        var putErr = skillBodyError(body);
        if (putErr) return Promise.resolve(putErr);
      }
      if (kind === 'harnesses') applyHarness(existing, body);
      else if (kind === 'tools') applyTool(existing, body);
      else if (kind === 'skills') { applySkill(existing, body); existing.version = nextVersion(existing.version); }
      else applyExpert(existing, body, false);
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(existing, true) : map(existing) });
    }
    if (method === 'PATCH' && sub === 'enabled') {
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
      existing._disabled = !body.enabled; existing.enabled = body.enabled;
      bump(kindName, id);
      return Promise.resolve({ status: 200, body: kind === 'experts' ? expertDto(existing, true) : map(existing) });
    }
    if (method === 'PATCH' && kind === 'experts') {
      if (!ifMatch('expert', id, headers)) return Promise.resolve(conflict());
      applyExpert(existing, body, false);
      return Promise.resolve({ status: 200, body: expertDto(existing, true) });
    }
    if (method === 'DELETE') {
      if (!ifMatch(kindName, id, headers)) return Promise.resolve(conflict());
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

  function skillDocumentResponse(id, headers) {
    var s = find(window.MOCK.skills, id);
    if (!s) return Promise.resolve(notFound());
    var dto = skillDto(s);
    var etag = '"' + rev('skill', id) + '"';
    var inm = headers && (headers['If-None-Match'] || headers['if-none-match']);
    if (inm === etag) return Promise.resolve({ status: 304, body: null, headers: { ETag: etag } });
    return Promise.resolve({ status: 200, body: composeSkillDocument(dto), headers: { ETag: etag } });
  }

  window.__AGENTFLOW_TRANSPORT__ = function (method, path, body, headers) {
    var u = path.split('?')[0].replace(/^\/+|\/+$/g, '');
    var parts = u.split('/').filter(Boolean);
    if (parts[0] === 'skill-categories') {
      return Promise.resolve({ status: 200, body: { items: [
        { code: 'coding', label: '编码', position: 0 }, { code: 'retrieval', label: '检索', position: 1 },
        { code: 'review', label: '审视', position: 2 }, { code: 'testing', label: '测试', position: 3 }
      ] } });
    }
    if (parts[0] === 'skills' && parts[2] === 'document' && method === 'GET') {
      return skillDocumentResponse(parts[1], headers);
    }
    return resource(parts, method, body, headers);
  };
})();
