/**
 * AgentFlow 原型 · Skill 专门页面（查看 / 编辑 / 新建）
 * 依赖: window.API（B1 DTO 客户端）、window.DF（ui.js）、window.SK（skill-common.js）、
 *       window.SKILL_MD（skill-detail-markdown.js）
 *
 * 约定：
 * - 查看态默认显示结构化五章；「文档」Tab 只在查看态出现，使用 Milkdown 只读渲染 API-31 文本；
 * - 编辑/新建只走结构化表单，保存带 `If-Match`，不使用 Markdown 源码编辑；
 * - 不读 MOCK，不建第二套视图模型；加载/渲染失败显式报错，可重试。
 */
(function () {
  'use strict';

  var state = {
    mode: 'view',        // view | edit | new
    id: null,
    skill: null,
    draft: null,
    cats: [],
    catsLoading: false,
    catsErr: '',
    loading: false,
    err: '',
    tab: 'structured',   // structured | document | preview
    doc: null,           // {loading, err, text, notModified, rendered, renderErr, rendering}
    preview: null,       // {text, rendered, renderErr, rendering}
    saving: false
  };

  function catOptionsHtml(code) {
    var list = state.cats;
    var has = false;
    var html = list.map(function (c) {
      if (c.code === code) has = true;
      return '<option value="' + DF.esc(c.code) + '"' + (c.code === code ? ' selected' : '') + '>' +
        DF.esc(c.label) + '</option>';
    }).join('');
    if (code && !has) {
      html = '<option value="' + DF.esc(code) + '" selected>' + DF.esc(code) + '</option>' + html;
    }
    return html;
  }

  function catLabelOf(code) { return SK.catLabel(state.cats, code); }
  function catColorOf(code) { return SK.catColor(state.cats, code); }
  function descLen(v) { return SK.descLen(v); }

  /* ---------------- 启动 ---------------- */
  function init() {
    var id = DF.qs('id');
    var mode = DF.qs('mode');
    if (mode === 'new') {
      state.mode = 'new';
      state.id = null;
      state.skill = null;
      state.draft = {
        name: '',
        categoryCode: '',
        description: '',
        tags: [],
        sections: { overview: '', steps: '', examples: '', scripts: '', verification: '' },
        pitfalls: []
      };
      loadCats().then(function () { render(); });
      render();
      return;
    }
    if (mode === 'edit') {
      state.mode = 'edit';
      loadCats();
    } else state.mode = 'view';
    if (!id) {
      state.err = '缺少 Skill id';
      render();
      return;
    }
    state.id = id;
    loadDetail();
  }

  function loadCats() {
    state.catsLoading = true;
    state.catsErr = '';
    render();
    return API.categories().then(function (cats) {
      state.cats = SK.sortCats(cats);
      state.catsLoading = false;
      state.catsErr = '';
      render();
    }).catch(function (err) {
      state.catsLoading = false;
      state.catsErr = API.errorText(err);
      render();
    });
  }

  function loadDetail() {
    state.loading = true;
    state.err = '';
    render();
    API.get('skill', state.id).then(function (dto) {
      state.loading = false;
      state.err = '';
      state.skill = dto;
      if (state.mode === 'edit') state.draft = DF.deep(dto);
      render();
    }).catch(function (err) {
      state.loading = false;
      state.err = API.errorText(err);
      state.skill = null;
      state.draft = null;
      render();
    });
  }

  /* ---------------- 外壳 ---------------- */
  function shellSubtitle() {
    var s = state.skill;
    if (!s) return '';
    return [
      s.categoryLabel || catLabelOf(s.categoryCode),
      s.version,
      SK.fmtDateTime(s.updatedAt)
    ].filter(Boolean).join(' · ');
  }

  function shellActions() {
    if (state.mode === 'view') {
      return '<button class="btn primary" id="sk-edit">' + DF.icon('edit', 14) + '编辑</button>';
    }
    var saveLabel = state.mode === 'new' ? '创建' : '保存';
    var busy = state.saving ? ' disabled' : '';
    return '<button class="btn" id="sk-cancel">取消</button>' +
      '<button class="btn primary" id="sk-save"' + busy + '>' + DF.icon('check', 14) + saveLabel + '</button>';
  }

  function renderShell() {
    var title = state.mode === 'new'
      ? '新建 Skill'
      : (state.skill ? state.skill.name : (state.mode === 'edit' ? '编辑 Skill' : 'Skill 详情'));
    var bc = [{ label: '资产与注册' }, { label: 'Skill 库', href: 'skills.html' }];
    if (state.mode === 'new') bc.push({ label: '新建' });
    else bc.push({ label: state.skill ? state.skill.name : '详情' });
    DF.renderShell({
      active: 'skills',
      breadcrumb: bc,
      title: title,
      subtitle: shellSubtitle(),
      actions: shellActions()
    });
    var editBtn = document.getElementById('sk-edit');
    if (editBtn) editBtn.onclick = function () {
      state.mode = 'edit';
      state.draft = DF.deep(state.skill);
      state.doc = null;
      state.preview = null;
      state.tab = 'structured';
      render();
    };
    var cancelBtn = document.getElementById('sk-cancel');
    if (cancelBtn) cancelBtn.onclick = function () {
      if (state.mode === 'new') { location.href = 'skills.html'; return; }
      state.mode = 'view';
      state.draft = null;
      state.doc = null;
      state.preview = null;
      state.tab = 'structured';
      render();
    };
    var saveBtn = document.getElementById('sk-save');
    if (saveBtn) saveBtn.onclick = save;
  }

  function render() {
    renderShell();
    renderBody();
  }

  /* ---------------- 主体 ---------------- */
  function renderBody() {
    var body = document.getElementById('page-body');
    if (!body) return;
    if (state.err) { body.innerHTML = errorHtml('Skill 详情加载失败', state.err, 'sk-retry'); bindErrorRetry(); return; }
    if (state.loading || state.mode !== 'new' && !state.skill) {
      body.innerHTML = '<div class="sub" style="padding:24px 2px">正在加载 Skill 详情…</div>';
      return;
    }
    if (state.mode === 'view') renderView();
    else renderEdit();
  }

  function errorHtml(title, msg, retryId) {
    return DF.empty({
      icon: 'warn',
      html: '<div>' + DF.esc(title) + '</div>' +
        '<div class="sub" style="margin-top:6px">' + DF.esc(msg || '') + '</div>',
      action: { id: retryId, label: '重试', icon: 'refresh', primary: true, style: 'margin-top:12px' }
    });
  }

  function bindErrorRetry() {
    var btn = document.getElementById('sk-retry');
    if (btn) btn.onclick = loadDetail;
  }

  /* ---------------- 查看态 ---------------- */
  function renderView() {
    var body = document.getElementById('page-body');
    if (!body) return;
    body.innerHTML =
      '<div class="skd-layout">' +
        DF.tabsHtml([
          { k: 'structured', label: '结构化' },
          { k: 'document', label: '文档' }
        ], state.tab, 'data-tab', 'id="sk-tab"') +
        '<div id="sk-viewbox"></div>' +
      '</div>';
    body.querySelectorAll('#sk-tab [data-tab]').forEach(function (el) {
      el.onclick = function () {
        var next = el.getAttribute('data-tab');
        if (next === state.tab) return;
        state.tab = next;
        if (state.tab === 'document') loadDocument();
        else renderBody();
      };
    });
    if (state.tab === 'document') renderDocumentView();
    else renderStructuredView();
  }

  function renderStructuredView() {
    var s = state.skill;
    if (!s) return;
    var tags = s.tags || [];
    var pf = s.pitfalls || [];
    var refs = s.refs || [];
    var secBlock = function (k, label, idx) {
      var val = String((s.sections || {})[k] || '');
      var inner = val ? '<div class="skd-pre">' + DF.esc(val) + '</div>' : '<div class="sub" style="padding:2px 0">暂无内容</div>';
      return '<details' + (idx === 0 ? ' open' : '') + '><summary>' + DF.esc(label) + '</summary>' +
        '<div class="skd-sec">' + inner + '</div></details>';
    };
    var html =
      '<div class="skd-card">' +
        '<div class="skd-kv"><span class="skd-k">描述</span><span>' + DF.esc(s.description || '') + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">类别</span><span>' +
          DF.tag(s.categoryLabel || catLabelOf(s.categoryCode), catColorOf(s.categoryCode)) + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">标签</span><span>' +
          (tags.length ? tags.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('')
            : '<span class="sub">暂无</span>') + '</span></div>' +
        '<div class="section-title">工作内容（渐进式披露）<span class="line"></span></div>' +
        '<div class="tree">' + SK.SECTIONS.map(function (x, i) { return secBlock(x[0], x[1], i); }).join('') + '</div>' +
        '<div class="section-title">踩坑记录与禁令<span class="line"></span></div>' +
        (pf.length ? pf.map(function (p) {
          return '<div class="notice">' + DF.icon('warn', 14) + '<span style="flex:1">' + DF.esc(p) + '</span></div>';
        }).join('') : '<div class="sub" style="padding:2px 0">暂无踩坑记录</div>') +
        '<div class="section-title">参考引用<span class="line"></span></div>' +
        (refs.length ? refs.map(function (r) {
          return '<div class="skd-ref">' + DF.tag(r.refType || 'ref', SK.REF_COLORS[r.refType] || 'gray') +
            '<span>' + DF.esc(r.label) + '</span>' +
            (r.path ? '<span class="mono skd-refpath">' + DF.esc(r.path) + '</span>' : '') + '</div>';
        }).join('') : '<div class="sub" style="padding:2px 0">暂无参考引用</div>') +
        '<div class="section-title">版本<span class="line"></span></div>' +
        '<div class="skd-kv"><span class="skd-k">版本</span><span class="mono">' + DF.esc(s.version || '—') + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">更新时间</span><span>' + DF.esc(SK.fmtDateTime(s.updatedAt)) + '</span></div>' +
      '</div>';
    document.getElementById('sk-viewbox').innerHTML = html;
  }

  function renderDocumentView() {
    var d = state.doc || { loading: true };
    var meta = d.loading ? '正在校验更新…'
      : (d.notModified ? '304 · 已复用上次文本' : '200 · 已更新');
    var err = d.err
      ? '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc(d.err) + ' <a href="javascript:;" id="sk-doc-retry">重试</a></span></div>'
      : (d.renderErr
        ? '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
          '<span>' + DF.esc(d.renderErr) + ' <a href="javascript:;" id="sk-doc-retry">重试</a></span></div>'
        : '');
    var inner = d.loading
      ? '<div class="skd-empty">正在加载文档…</div>'
      : (d.empty ? '<div class="skd-empty">文档为空</div>' : '<div id="sk-doc-root" class="skd-docroot"></div>');
    document.getElementById('sk-viewbox').innerHTML =
      '<div class="skd-card">' +
        '<div class="skd-docbar"><div><div class="skd-docmeta">' + DF.esc(meta) + '</div>' + err + '</div></div>' +
        inner +
      '</div>';
    var retry = document.getElementById('sk-doc-retry');
    if (retry) retry.onclick = loadDocument;
    if (!d.loading && !d.err && !d.empty && d.text) renderMarkdown();
  }

  function loadDocument() {
    if (!state.id) return;
    state.doc = { loading: true, err: '', text: '', notModified: false, rendered: false, renderErr: '', rendering: false };
    renderBody();
    API.document('skill', state.id).then(function (res) {
      state.doc = {
        loading: false,
        err: '',
        text: res.text || '',
        notModified: !!res.notModified,
        etag: res.etag || null,
        empty: !res.text || !String(res.text).trim(),
        rendered: false,
        renderErr: '',
        rendering: false
      };
      renderBody();
    }).catch(function (err) {
      state.doc = {
        loading: false,
        err: API.errorText(err),
        text: '',
        notModified: false,
        rendered: false,
        renderErr: '',
        rendering: false
      };
      renderBody();
    });
  }

  function renderMarkdown() {
    var d = state.doc;
    if (!d || !d.text || d.rendered || d.rendering) return;
    var target = document.getElementById('sk-doc-root');
    if (!target) return;
    if (typeof window.SKILL_MD !== 'object' || typeof window.SKILL_MD.render !== 'function') {
      d.renderErr = 'Markdown 渲染器不可用';
      d.rendering = false;
      renderBody();
      return;
    }
    d.rendering = true;
    d.renderErr = '';
    window.SKILL_MD.render(target, d.text).then(function () {
      if (state.doc !== d) return; // 期间文档已被替换
      d.rendering = false;
      d.rendered = true;
    }).catch(function (err) {
      if (state.doc !== d) return;
      d.rendering = false;
      d.rendered = false;
      d.renderErr = 'Markdown 渲染失败：' + (err && err.message ? err.message : '未知错误');
      renderBody();
    });
  }

  /* ---------------- 编辑 / 新建 ---------------- */
  function draftMarkdown(d) {
    var lines = [];
    var name = (d && d.name) || '';
    var desc = (d && d.description) || '';
    var version = (d && d.version) || '';
    if (name || desc || version) {
      lines.push('---');
      if (name) lines.push('name: "' + name + '"');
      if (desc) lines.push('description: "' + desc + '"');
      if (version) lines.push('version: "' + version + '"');
      lines.push('---', '');
    }
    SK.SECTIONS.forEach(function (sec) {
      lines.push('## ' + sec[1], '');
      lines.push(String((d && d.sections && d.sections[sec[0]]) || ''), '');
    });
    var pf = (d && d.pitfalls) || [];
    if (pf.length) {
      lines.push('## 常见踩坑', '');
      pf.forEach(function (p) { lines.push('- ' + p); });
      lines.push('');
    }
    var refs = (d && d.refs) || [];
    if (refs.length) {
      lines.push('## 参考资料', '');
      refs.forEach(function (r) {
        var bits = [];
        if (r && r.label) bits.push(r.label);
        if (r && r.refType) bits.push('(' + r.refType + ')');
        if (r && r.path) bits.push('— ' + r.path);
        lines.push('- ' + bits.join(' '));
      });
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '') + '\n';
  }

  function renderEdit() {
    var body = document.getElementById('page-body');
    if (!body) return;
    body.innerHTML =
      '<div class="skd-layout">' +
        DF.tabsHtml([
          { k: 'structured', label: '结构化' },
          { k: 'preview', label: '预览' }
        ], state.tab, 'data-tab', 'id="sk-tab"') +
        '<div id="sk-viewbox"></div>' +
      '</div>';
    body.querySelectorAll('#sk-tab [data-tab]').forEach(function (el) {
      el.onclick = function () {
        var next = el.getAttribute('data-tab');
        if (next === state.tab) return;
        state.tab = next;
        if (state.tab === 'preview') renderPreviewTab();
        else renderForm();
      };
    });
    if (state.tab === 'preview') renderPreviewTab();
    else renderForm();
  }

  function renderPreviewTab() {
    var body = document.getElementById('page-body');
    if (!body) return;
    var text = draftMarkdown(state.draft);
    state.preview = { text: text, rendered: false, renderErr: '', rendering: false };
    document.getElementById('sk-viewbox').innerHTML =
      '<div class="skd-card">' +
        '<div class="skd-docbar"><div><div class="skd-docmeta">草稿预览 · 未保存</div><div id="sk-preview-err"></div></div></div>' +
        '<div id="sk-preview-root" class="skd-docroot"></div>' +
      '</div>';
    renderMarkdownPreview();
  }

  function renderPreviewError(msg) {
    var el = document.getElementById('sk-preview-err');
    if (el) el.innerHTML =
      '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
      '<span>' + DF.esc(msg) + ' <a href="javascript:;" id="sk-preview-retry">重试</a></span></div>';
    var retry = document.getElementById('sk-preview-retry');
    if (retry) retry.onclick = renderPreviewTab;
  }

  function renderMarkdownPreview() {
    var p = state.preview;
    if (!p || !p.text || p.rendered || p.rendering) return;
    var target = document.getElementById('sk-preview-root');
    if (!target) return;
    if (typeof window.SKILL_MD !== 'object' || typeof window.SKILL_MD.render !== 'function') {
      renderPreviewError('Markdown 渲染器不可用');
      return;
    }
    p.rendering = true;
    p.renderErr = '';
    window.SKILL_MD.render(target, p.text).then(function () {
      if (state.preview !== p) return;
      p.rendering = false;
      p.rendered = true;
    }).catch(function (err) {
      if (state.preview !== p) return;
      p.rendering = false;
      p.rendered = false;
      renderPreviewError('Markdown 渲染失败：' + (err && err.message ? err.message : '未知错误'));
    });
  }

  /* ---------------- 编辑 / 新建表单 ---------------- */
  function renderForm() {
    var viewbox = document.getElementById('sk-viewbox');
    if (!viewbox) return;
    var d = state.draft;
    if (!d) return;
    var isEdit = state.mode === 'edit';
    var tags = d.tags || [];
    var pf = d.pitfalls || [];
    var refs = (isEdit && state.skill && state.skill.refs) || [];
    var sections = SK.SECTIONS.map(function (x, i) {
      var k = x[0], label = x[1];
      var val = String((d.sections || {})[k] || '');
      return '<details' + (i === 0 ? ' open' : '') + '><summary>' + DF.esc(label) + '</summary>' +
        '<div class="skd-sec"><textarea class="inp" data-sec="' + k + '" rows="5">' + DF.esc(val) + '</textarea></div></details>';
    }).join('');
    viewbox.innerHTML =
      '<div class="skd-card">' +
          DF.field('名称', '<input class="inp" id="sk-name" maxlength="80" value="' + DF.esc(d.name || '') + '" placeholder="如：CRES 技能">', { required: true }) +
          DF.field('类别', '<select class="inp" id="sk-cat">' +
            (state.cats.length ? catOptionsHtml(d.categoryCode) : '') +
            '</select>' +
            (state.catsErr ? '<div class="hint">分类加载失败：' + DF.esc(state.catsErr) + ' <a href="javascript:;" id="sk-cat-retry">重试</a></div>' : ''),
            { required: true }) +
          DF.field('描述', '<textarea class="inp" id="sk-desc" rows="3" maxlength="' + SK.DESC_MAX + '" placeholder="适用：…；触发：…；不适用：…">' + DF.esc(d.description || '') + '</textarea>' +
            '<div class="hint"><span id="sk-descn">' + descLen(d.description) + '</span>/' + SK.DESC_MAX + ' 字 · 适用 / 触发 / 不适用；列表检索与路由的唯一依据</div>',
            { required: true }) +
          '<div class="section-title">标签<span class="line"></span></div>' +
          '<div class="chips">' +
            (tags.length ? tags.map(function (t, i) {
              return '<span class="chip">' + DF.esc(t) + '<span class="skd-x" data-dtag="' + i + '" title="删除">×</span></span>';
            }).join('') : '<span class="sub">暂无标签</span>') +
          '</div>' +
          '<input class="inp skd-chipin" id="sk-tagin" placeholder="输入标签后回车添加">' +
          '<div class="section-title">工作内容<span class="line"></span></div>' +
          '<div class="tree">' + sections + '</div>' +
          '<div class="section-title">踩坑记录与禁令<span class="line"></span></div>' +
          (pf.length ? pf.map(function (p, i) {
            return '<div class="notice">' + DF.icon('warn', 14) + '<span style="flex:1">' + DF.esc(p) + '</span>' +
              '<span class="skd-x" data-dpf="' + i + '" title="删除">×</span></div>';
          }).join('') : '<div class="sub" style="padding:2px 0">暂无踩坑记录</div>') +
          '<input class="inp skd-chipin" id="sk-pfin" placeholder="输入踩坑/禁令后回车添加（新条目置顶展示）">' +
          (isEdit
            ? '<div class="section-title">参考引用<span class="line"></span></div>' +
              (refs.length ? refs.map(function (r) {
                return '<div class="skd-ref">' + DF.tag(r.refType || 'ref', SK.REF_COLORS[r.refType] || 'gray') +
                  '<span>' + DF.esc(r.label) + '</span>' +
                  (r.path ? '<span class="mono skd-refpath">' + DF.esc(r.path) + '</span>' : '') + '</div>';
              }).join('') : '<div class="sub" style="padding:2px 0">暂无参考引用</div>')
            : '') +
        '</div>';
    bindForm();
  }

  function bindForm() {
    var d = state.draft;
    if (!d) return;
    var nameEl = document.getElementById('sk-name');
    var catEl = document.getElementById('sk-cat');
    var descEl = document.getElementById('sk-desc');
    var descn = document.getElementById('sk-descn');
    var tagin = document.getElementById('sk-tagin');
    var pfin = document.getElementById('sk-pfin');
    if (nameEl) nameEl.oninput = function () { d.name = nameEl.value; };
    if (catEl) catEl.onchange = function () { d.categoryCode = catEl.value; };
    if (descEl) descEl.oninput = function () {
      d.description = descEl.value;
      if (descn) descn.textContent = descLen(d.description);
    };
    if (tagin) tagin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var val = tagin.value.trim();
      if (!val) return;
      if (!(d.tags || []).some(function (x) { return x === val; })) {
        d.tags = (d.tags || []).concat([val]);
        renderBody();
      }
      tagin.value = '';
      tagin.focus();
    };
    if (pfin) pfin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var val = pfin.value.trim();
      if (!val) return;
      d.pitfalls = [val].concat(d.pitfalls || []);
      renderBody();
      pfin.value = '';
      pfin.focus();
    };
    document.querySelectorAll('[data-sec]').forEach(function (el) {
      var key = el.getAttribute('data-sec');
      el.oninput = function () {
        d.sections = d.sections || {};
        d.sections[key] = el.value;
      };
    });
    document.querySelectorAll('[data-dtag]').forEach(function (el) {
      el.onclick = function () {
        var i = Number(el.getAttribute('data-dtag'));
        d.tags = (d.tags || []).filter(function (x, idx) { return idx !== i; });
        renderBody();
      };
    });
    document.querySelectorAll('[data-dpf]').forEach(function (el) {
      el.onclick = function () {
        var i = Number(el.getAttribute('data-dpf'));
        d.pitfalls = (d.pitfalls || []).filter(function (x, idx) { return idx !== i; });
        renderBody();
      };
    });
    var catRetry = document.getElementById('sk-cat-retry');
    if (catRetry) catRetry.onclick = loadCats;
  }

  function validate() {
    var d = state.draft;
    if (!d.name || !d.name.trim()) { DF.toast('请填写 Skill 名称', 'err'); return false; }
    if (d.name.trim().length > 80) { DF.toast('Skill 名称不能超过 80 字', 'err'); return false; }
    if (descLen(d.description) < SK.DESC_MIN) { DF.toast('请填写 Skill 描述', 'err'); return false; }
    if (descLen(d.description) > SK.DESC_MAX) { DF.toast('描述需在 1–400 字之间', 'err'); return false; }
    if (!d.categoryCode || !state.cats.some(function (c) { return c.code === d.categoryCode; })) {
      DF.toast('请选择 Skill 类别', 'err');
      return false;
    }
    return true;
  }

  function save() {
    var d = state.draft;
    if (!d || state.saving) return;
    if (!validate()) return;
    var body = {
      name: d.name.trim(),
      categoryCode: d.categoryCode,
      description: d.description.trim(),
      tags: (d.tags || []).slice(),
      sections: SK.SECTIONS.reduce(function (acc, x) {
        acc[x[0]] = String((d.sections || {})[x[0]] || '');
        return acc;
      }, {}),
      pitfalls: (d.pitfalls || []).slice(),
      refs: []
    };
    state.saving = true;
    renderShell();
    var req = state.mode === 'new'
      ? API.create('skill', body)
      : API.update('skill', state.id, body, API.revision('skill', state.id));
    req.then(function (dto) {
      state.saving = false;
      state.skill = dto;
      state.draft = null;
      state.doc = null;
      state.preview = null;
      if (state.mode === 'new') {
        state.id = dto.id;
        state.mode = 'edit';
        state.draft = DF.deep(dto);
        try { history.replaceState(null, '', 'skill-detail.html?id=' + encodeURIComponent(dto.id) + '&mode=edit'); } catch (e) {}
        render();
      } else {
        state.mode = 'view';
        state.tab = 'structured';
        render();
      }
      DF.toast('已保存 · 当前版本 ' + dto.version, 'ok');
    }).catch(function (err) {
      state.saving = false;
      DF.toast(API.errorText(err), 'err');
      renderShell();
    });
  }

  init();
})();
