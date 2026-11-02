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
      id: s.id, name: s.name, categoryCode: CAT_CODE[s.category] || s.categoryCode || 'coding',
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
      skill.category = CAT_LABEL[body.categoryCode] || body.categoryCode || skill.category;
      skill.tags = (body.tags || []).slice();
      skill.version = version;
      skill._pkg = { body: String(body.body == null ? '' : body.body), files: d.files.map(function (f) { return { path: f.path, content: f.content }; }) };
      bump('skill', skill.id);
      delete drafts[d.id];
      return { status: 200, body: { id: skill.id, revision: rev('skill', skill.id), version: version } };
    }

    var created = {
      id: 'sk-fake-' + (++seq), name: fm.name, category: CAT_LABEL[body.categoryCode] || body.categoryCode || '编码',
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

export function resetFakeB1() {
  revs = Object.create(null);
  seq = 0;
  drafts = Object.create(null);
  for (const k of Object.keys(SEED)) MOCK[k] = structuredClone(SEED[k]);
}
