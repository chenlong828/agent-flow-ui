/**
 * AgentFlow 原型 · Skill 专门页面（查看 / 编辑 / 新建）
 * 依赖: API（B1 DTO 客户端）、DF（ui.js）、SK（skill-common.js）、
 *       SKILL_MD（编辑器适配层）
 *
 * 约定：
 * - 查看态：元数据条 + 正文只读渲染 + 文件清单 + 下载；
 * - 编辑/新建：一律走服务端草稿（建草稿 → 改正文/附件 → save 带 If-Match），SKILL.md 只读；
 * - 正文 16 KiB 上限，编辑态实时计数，超限阻断保存并提示放 references/；
 * - 不读 MOCK，不建第二套视图模型；加载/渲染失败显式报错，可重试。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { SK } from './skill-common.js';
import { SKILL_MD } from './skill-detail-markdown.js';


  var state = {
    mode: 'view',        // view | edit | new
    id: null,
    skill: null,
    draft: null,
    files: [],
    cats: [],
    catsLoading: false,
    catsErr: '',
    loading: false,
    err: '',
    saving: false,
    dirty: false,
    body: '',
    form: { name: '', categoryCode: '', description: '', tags: [] },
    editor: null,
    editorToken: 0,
    bodyErr: '',
    filesErr: '',
    uploadDir: 'scripts'
  };

  function catOptionsHtml(code) {
    var has = false;
    var html = state.cats.map(function (c) {
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

  function bytes() {
    var version = state.skill ? state.skill.version : 'v1.0';
    return SK.markdownBytes({
      name: state.form.name,
      description: state.form.description,
      version: version
    }, state.body);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    var id = DF.qs('id');
    var mode = DF.qs('mode');
    if (mode === 'new') {
      state.mode = 'new';
      state.id = null;
      state.body = SK.defaultBody();
      loadCats();
      createDraft();
      render();
      return;
    }
    if (!id) {
      state.err = '缺少 Skill id';
      render();
      return;
    }
    state.id = id;
    state.mode = mode === 'edit' ? 'edit' : 'view';
    if (state.mode === 'edit') loadCats();
    loadDetail();
  }

  function loadCats() {
    state.catsLoading = true;
    state.catsErr = '';
    render();
    return API.categories().then(function (cats) {
      state.cats = SK.sortCats(cats);
      state.catsLoading = false;
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
      state.skill = dto;
      state.files = (dto.files || []).slice();
      if (state.mode === 'edit') {
        state.body = String(dto.body == null ? '' : dto.body);
        state.form = {
          name: dto.name || '',
          categoryCode: dto.categoryCode || '',
          description: dto.description || '',
          tags: (dto.tags || []).slice()
        };
        state.files = (dto.files || []).slice();
        createDraft();
      }
      render();
    }).catch(function (err) {
      state.loading = false;
      state.err = API.errorText(err);
      state.skill = null;
      render();
    });
  }

  function createDraft() {
    state.draft = null;
    state.filesErr = '';
    API.draftCreate(state.id || null).then(function (draft) {
      state.draft = draft;
      state.files = (draft.files || []).slice();
      if (state.mode === 'new' && !state.body) state.body = SK.defaultBody();
      render();
    }).catch(function (err) {
      state.filesErr = API.errorText(err);
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
      return (state.skill ? '<button class="btn" id="sk-download">' + DF.icon('download', 14) + '下载</button>' : '') +
        '<button class="btn primary" id="sk-edit">' + DF.icon('edit', 14) + '编辑</button>';
    }
    var saveLabel = state.mode === 'new' ? '创建' : '保存';
    var busy = state.saving ? ' disabled' : '';
    return '<span class="skd-dirty" id="sk-dirty"' + (state.dirty ? '' : ' hidden') + '>未保存</span>' +
      '<button class="btn" id="sk-cancel">取消</button>' +
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
    if (editBtn) editBtn.onclick = enterEdit;
    var downloadBtn = document.getElementById('sk-download');
    if (downloadBtn) downloadBtn.onclick = function () { API.download('skill', state.id); };
    var cancelBtn = document.getElementById('sk-cancel');
    if (cancelBtn) cancelBtn.onclick = cancel;
    var saveBtn = document.getElementById('sk-save');
    if (saveBtn) saveBtn.onclick = save;
  }

  function enterEdit() {
    state.mode = 'edit';
    state.dirty = false;
    // 查看态没有加载过分类；缺了会导致类别下拉为空、校验永远失败
    if (!state.cats.length && !state.catsLoading) loadCats();
    state.body = String((state.skill && state.skill.body) || '');
    state.form = {
      name: state.skill.name || '',
      categoryCode: state.skill.categoryCode || '',
      description: state.skill.description || '',
      tags: (state.skill.tags || []).slice()
    };
    createDraft();
    render();
  }

  function cancel() {
    if (state.dirty) {
      DF.modal.confirm({
        title: '放弃编辑', danger: true, okText: '放弃修改',
        message: '未保存的修改将丢失，确定取消？'
      }).then(function (ok) { if (ok) doCancel(); });
      return;
    }
    doCancel();
  }

  function doCancel() {
    var draft = state.draft;
    state.draft = null;
    state.mode = 'view';
    state.body = '';
    state.dirty = false;
    destroyEditor();
    setEditChrome(false);
    if (draft) API.draftCancel(draft.id).catch(function () {});
    if (!state.skill) { location.href = 'skills.html'; return; }
    render();
  }

  function markDirty() {
    state.dirty = true;
    var el = document.getElementById('sk-dirty');
    if (el) el.hidden = false;
  }

  function resetDirty() {
    state.dirty = false;
    var el = document.getElementById('sk-dirty');
    if (el) el.hidden = true;
  }

  function setEditChrome(on) {
    if (!document.body) return;
    document.body.classList.toggle('sk-edit-mode', !!on);
  }

  function bindMediaFallback(root) {
    if (!root || root.__skMediaBound) return;
    root.__skMediaBound = true;
    root.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      t.classList.add('sk-img-broken');
      if (!t.getAttribute('alt')) t.setAttribute('alt', '图片加载失败');
      t.setAttribute('title', '图片加载失败：' + (t.getAttribute('src') || ''));
    }, true);
  }

  function destroyEditor() {
    state.editorToken++;
    if (state.editor) { SKILL_MD.destroy(state.editor); state.editor = null; }
  }

  function render() {
    renderShell();
    renderBody();
  }

  /* ---------------- 主体 ---------------- */
  function renderBody() {
    var body = document.getElementById('page-body');
    if (!body) return;
    if (state.err) { setEditChrome(false); body.innerHTML = errorHtml('Skill 详情加载失败', state.err); bindErrorRetry(); return; }
    if (state.loading) {
      setEditChrome(false);
      body.innerHTML = '<div class="sub" style="padding:24px 2px">正在加载 Skill 详情…</div>';
      return;
    }
    if (state.mode === 'view') renderView();
    else renderEdit();
  }

  function errorHtml(title, msg) {
    return DF.empty({
      icon: 'warn',
      html: '<div>' + DF.esc(title) + '</div>' +
        '<div class="sub" style="margin-top:6px">' + DF.esc(msg || '') + '</div>',
      action: { id: 'sk-retry', label: '重试', icon: 'refresh', primary: true, style: 'margin-top:12px' }
    });
  }

  function bindErrorRetry() {
    var btn = document.getElementById('sk-retry');
    if (btn) btn.onclick = loadDetail;
  }

  /* ---------------- 查看态 ---------------- */
  function renderView() {
    var s = state.skill;
    if (!s) return;
    setEditChrome(false);
    resetDirty();
    destroyEditor();
    var body = document.getElementById('page-body');
    body.innerHTML =
      '<div class="skd-card">' +
        '<div class="skd-kv"><span class="skd-k">描述</span><span>' + DF.esc(s.description || '') + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">类别</span><span>' +
          DF.tag(s.categoryLabel || catLabelOf(s.categoryCode), catColorOf(s.categoryCode)) + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">标签</span><span>' +
          ((s.tags || []).length ? s.tags.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('')
            : '<span class="sub">暂无</span>') + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">版本</span><span class="mono">' + DF.esc(s.version || '—') +
          '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">更新时间</span><span>' + DF.esc(SK.fmtDateTime(s.updatedAt)) + '</span></div>' +
        '<div class="skd-kv"><span class="skd-k">被引用</span><span>' + DF.esc(String(s.usedByCount == null ? 0 : s.usedByCount)) + ' 位专家</span></div>' +
      '</div>' +
      '<div class="section-title">正文<span class="line"></span></div>' +
      '<div class="skd-card"><div id="sk-body" class="skd-docroot sk-md-body"></div><div id="sk-body-msg"></div></div>' +
      '<div class="section-title">附件<span class="line"></span></div>' +
      '<div class="skd-card" id="sk-files"></div>';
    renderFiles();
    mountBodyView();
  }

  function mountBodyView() {
    var root = document.getElementById('sk-body');
    if (!root) return;
    var token = ++state.editorToken;
    var msg = document.getElementById('sk-body-msg');
    if (msg) msg.innerHTML = '';
    bindMediaFallback(root);
    var text = String(state.skill.body == null ? '' : state.skill.body);
    if (!text.trim()) { root.innerHTML = '<div class="sub" style="padding:4px 0">正文为空</div>'; return; }
    SKILL_MD.mount(root, { markdown: text, editable: false }).then(function (handle) {
      if (token !== state.editorToken) { SKILL_MD.destroy(handle); return; }
      state.editor = handle;
    }).catch(function (err) {
      if (token !== state.editorToken) return;
      if (msg) msg.innerHTML = '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc('正文渲染失败：' + (err && err.message ? err.message : '未知错误')) +
        ' <a href="javascript:;" id="sk-body-retry">重试</a></span></div>';
      var retry = document.getElementById('sk-body-retry');
      if (retry) retry.onclick = mountBodyView;
    });
  }

  function renderFiles() {
    var box = document.getElementById('sk-files');
    if (!box) return;
    var files = state.files || [];
    if (!files.length) { box.innerHTML = '<div class="sub" style="padding:2px 0">暂无附件</div>'; return; }
    box.innerHTML = files.map(function (f) {
      var editableFile = state.mode !== 'view' && !f.readOnly;
      return '<div class="sk-file" data-path="' + DF.esc(f.path) + '" style="display:flex;align-items:center;gap:8px;padding:4px 0">' +
        '<span class="mono" style="flex:1">' + DF.esc(f.path) + '</span>' +
        '<span class="sub">' + DF.esc(SK.fmtSize(f.size)) + '</span>' +
        (f.readOnly ? '<span class="sub">只读</span>' : '') +
        (editableFile
          ? '<a href="javascript:;" class="sk-rename" data-path="' + DF.esc(f.path) + '">改名</a>' +
            '<a href="javascript:;" class="sk-del" data-path="' + DF.esc(f.path) + '">删除</a>'
          : '') +
        '</div>';
    }).join('');
    box.querySelectorAll('.sk-del').forEach(function (el) {
      el.onclick = function () { removeFile(el.getAttribute('data-path')); };
    });
    box.querySelectorAll('.sk-rename').forEach(function (el) {
      el.onclick = function () { startRename(el.getAttribute('data-path')); };
    });
  }

  function removeFile(path) {
    if (!state.draft) return;
    API.draftDeleteFile(state.draft.id, path).then(function () {
      return API.draftGet(state.draft.id);
    }).then(function (d) {
      state.draft = d; state.files = d.files || []; renderFiles();
      markDirty();
      DF.toast('已删除 ' + path, 'ok');
    }).catch(function (err) { DF.toast(API.errorText(err), 'err'); });
  }

  function startRename(path) {
    var row = document.querySelector('.sk-file[data-path="' + path.replace(/"/g, '\\"') + '"]');
    if (!row) return;
    row.innerHTML = '<input class="inp inp-sm" id="sk-rename-in" style="flex:1" value="' + DF.esc(path) + '">' +
      '<button class="btn btn-sm" id="sk-rename-ok">确定</button>' +
      '<button class="btn btn-sm" id="sk-rename-no">取消</button>';
    var input = document.getElementById('sk-rename-in');
    document.getElementById('sk-rename-ok').onclick = function () {
      var next = input.value.trim();
      if (!next || next === path) { renderFiles(); return; }
      API.draftRename(state.draft.id, path, next).then(function () {
        return API.draftGet(state.draft.id);
      }).then(function (d) {
        state.draft = d; state.files = d.files || []; renderFiles();
        markDirty();
        DF.toast('已改名', 'ok');
      }).catch(function (err) { DF.toast(API.errorText(err), 'err'); });
    };
    document.getElementById('sk-rename-no').onclick = renderFiles;
  }

  /* ---------------- 编辑 / 新建 ---------------- */
  function renderEdit() {
    var body = document.getElementById('page-body');
    if (!body) return;
    setEditChrome(true);
    if (!state.draft) {
      if (state.filesErr) {
        body.innerHTML = DF.empty({
          icon: 'warn',
          html: '<div>草稿创建失败</div><div class="sub" style="margin-top:6px">' + DF.esc(state.filesErr) + '</div>',
          action: { id: 'sk-draft-retry', label: '重试', icon: 'refresh', primary: true, style: 'margin-top:12px' }
        });
        var retry = document.getElementById('sk-draft-retry');
        if (retry) retry.onclick = createDraft;
        return;
      }
      body.innerHTML = '<div class="sub" style="padding:24px 2px">正在创建草稿…</div>';
      return;
    }
    var d = state.form;
    var tags = d.tags || [];
    var total = bytes();
    body.innerHTML =
      '<div class="skd-card">' +
        DF.field('名称', '<input class="inp" id="sk-name" maxlength="80" value="' + DF.esc(d.name) + '" placeholder="如：CRES 技能">', { required: true }) +
        DF.field('类别', '<select class="inp" id="sk-cat">' +
          (state.cats.length ? catOptionsHtml(d.categoryCode) : '') +
          '</select>' +
          (state.catsErr ? '<div class="hint">分类加载失败：' + DF.esc(state.catsErr) + ' <a href="javascript:;" id="sk-cat-retry">重试</a></div>' : ''),
          { required: true }) +
        DF.field('描述', '<textarea class="inp" id="sk-desc" rows="3" maxlength="' + SK.DESC_MAX + '" placeholder="适用：…；触发：…；不适用：…">' + DF.esc(d.description) + '</textarea>' +
          '<div class="hint"><span id="sk-descn">' + descLen(d.description) + '</span>/' + SK.DESC_MAX + ' 字 · 列表检索与路由的唯一依据</div>',
          { required: true }) +
        '<div class="section-title">标签<span class="line"></span></div>' +
        '<div class="chips" id="sk-tags">' +
          (tags.length ? tags.map(function (t, i) {
            return '<span class="chip">' + DF.esc(t) + '<span class="skd-x" data-dtag="' + i + '" title="删除">×</span></span>';
          }).join('') : '<span class="sub">暂无标签</span>') +
        '</div>' +
        '<input class="inp skd-chipin" id="sk-tag-in" placeholder="输入标签后回车添加">' +
      '</div>' +
      '<div class="section-title">正文<span class="line"></span>' +
        '<span class="sub" id="sk-bytes" style="margin-left:auto">' + total + ' / ' + SK.BODY_LIMIT + ' 字节</span></div>' +
      '<div class="skd-card"><div id="sk-editor" class="skd-docroot sk-md-body"></div><div id="sk-body-err"></div>' +
        '<div class="hint" id="sk-bytes-hint"></div></div>' +
      '<div class="section-title">附件<span class="line"></span></div>' +
      '<div class="skd-card skd-attach" id="sk-attach">' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
          '<select class="inp inp-sm" id="sk-dir" style="width:auto">' +
            '<option value="scripts"' + (state.uploadDir === 'scripts' ? ' selected' : '') + '>scripts/</option>' +
            '<option value="references"' + (state.uploadDir === 'references' ? ' selected' : '') + '>references/</option>' +
          '</select>' +
          '<input type="file" id="sk-upload" multiple style="display:none">' +
          '<button class="btn btn-sm" id="sk-add-file">上传附件</button>' +
          '<span class="sub">只允许 scripts/、references/；同名覆盖</span>' +
        '</div>' +
        '<div id="sk-files"></div>' +
      '</div>';
    renderFiles();
    bindForm();
    mountEditor();
    updateBytes();
  }

  function bindForm() {
    var d = state.form;
    var nameEl = document.getElementById('sk-name');
    var catEl = document.getElementById('sk-cat');
    var descEl = document.getElementById('sk-desc');
    var descn = document.getElementById('sk-descn');
    if (nameEl) nameEl.oninput = function () { d.name = nameEl.value; updateBytes(); markDirty(); };
    if (catEl) catEl.onchange = function () { d.categoryCode = catEl.value; markDirty(); };
    if (descEl) descEl.oninput = function () {
      d.description = descEl.value;
      if (descn) descn.textContent = descLen(d.description);
      updateBytes();
      markDirty();
    };
    var tagIn = document.getElementById('sk-tag-in');
    if (tagIn) tagIn.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var val = tagIn.value.trim();
      if (!val) return;
      if (!d.tags.some(function (x) { return x === val; })) {
        d.tags = d.tags.concat([val]);
        tagIn.value = '';
        markDirty();
        renderEdit();
      }
    };
    document.querySelectorAll('[data-dtag]').forEach(function (el) {
      el.onclick = function () {
        var i = Number(el.getAttribute('data-dtag'));
        d.tags = d.tags.filter(function (x, idx) { return idx !== i; });
        markDirty();
        renderEdit();
      };
    });
    var catRetry = document.getElementById('sk-cat-retry');
    if (catRetry) catRetry.onclick = loadCats;
    var dir = document.getElementById('sk-dir');
    if (dir) dir.onchange = function () { state.uploadDir = dir.value; };
    var upload = document.getElementById('sk-upload');
    var addBtn = document.getElementById('sk-add-file');
    if (addBtn) addBtn.onclick = function () { upload.click(); };
    if (upload) upload.onchange = function () { uploadFiles(upload.files); };
    var attach = document.getElementById('sk-attach');
    if (attach) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        attach.addEventListener(ev, function (e) { e.preventDefault(); attach.classList.add('drag-over'); });
      });
      attach.addEventListener('dragleave', function () { attach.classList.remove('drag-over'); });
      attach.addEventListener('drop', function (e) {
        e.preventDefault();
        attach.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
      });
    }
  }

  function mountEditor() {
    var root = document.getElementById('sk-editor');
    if (!root || !state.draft) return;
    if (state.editor) { SKILL_MD.destroy(state.editor); state.editor = null; }
    bindMediaFallback(root);
    var token = ++state.editorToken;
    SKILL_MD.mount(root, {
      markdown: state.body,
      editable: true,
      onChange: function (md) {
        if (md === state.body) return;
        state.body = md;
        updateBytes();
        markDirty();
      }
    }).then(function (handle) {
      if (token !== state.editorToken) { SKILL_MD.destroy(handle); return; }
      state.editor = handle;
    }).catch(function (err) {
      if (token !== state.editorToken) return;
      var box = document.getElementById('sk-body-err');
      if (box) box.innerHTML = '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc('编辑器初始化失败：' + (err && err.message ? err.message : '未知错误')) +
        ' <a href="javascript:;" id="sk-editor-retry">重试</a></span></div>';
      var retry = document.getElementById('sk-editor-retry');
      if (retry) retry.onclick = mountEditor;
    });
  }

  function updateBytes() {
    var total = bytes();
    var el = document.getElementById('sk-bytes');
    var hint = document.getElementById('sk-bytes-hint');
    var saveBtn = document.getElementById('sk-save');
    if (el) el.textContent = total + ' / ' + SK.BODY_LIMIT + ' 字节';
    var over = total > SK.BODY_LIMIT;
    if (hint) hint.textContent = over
      ? '正文超过 16 KiB：请把长内容放进 references/，正文只留入口与索引。'
      : '上限 16 KiB（含 frontmatter）；超出内容请放 references/ 渐进披露。';
    if (saveBtn) saveBtn.disabled = over || state.saving;
  }

  function uploadFiles(fileList) {
    if (!state.draft || !fileList || !fileList.length) return;
    var dir = state.uploadDir;
    var list = Array.prototype.slice.call(fileList);
    var chain = Promise.resolve();
    list.forEach(function (file) {
      chain = chain.then(function () {
        return API.draftUpload(state.draft.id, dir + '/' + file.name, file);
      });
    });
    chain.then(function () { return API.draftGet(state.draft.id); }).then(function (d) {
      state.draft = d;
      state.files = d.files || [];
      renderEdit();
      markDirty();
      DF.toast('已上传 ' + list.length + ' 个附件', 'ok');
    }).catch(function (err) {
      DF.toast(API.errorText(err), 'err');
    });
  }

  function validate() {
    var d = state.form;
    if (!d.name.trim()) { DF.toast('请填写 Skill 名称', 'err'); return false; }
    if (descLen(d.description) < SK.DESC_MIN) { DF.toast('请填写 Skill 描述', 'err'); return false; }
    if (descLen(d.description) > SK.DESC_MAX) { DF.toast('描述需在 1–400 字之间', 'err'); return false; }
    if (!d.categoryCode || !state.cats.some(function (c) { return c.code === d.categoryCode; })) {
      DF.toast('请选择 Skill 类别', 'err');
      return false;
    }
    if (bytes() > SK.BODY_LIMIT) {
      DF.toast('正文超过 16 KiB，请把长内容放进 references/', 'err');
      return false;
    }
    return true;
  }

  function save() {
    if (!state.draft || state.saving) return;
    if (!validate()) return;
    state.saving = true;
    renderShell();
    var payload = {
      name: state.form.name.trim(),
      categoryCode: state.form.categoryCode,
      description: state.form.description.trim(),
      tags: state.form.tags.slice(),
      body: state.body
    };
    API.draftSave(state.draft.id, payload, state.skill ? state.skill.revision : null).then(function (res) {
      state.saving = false;
      state.draft = null;
      state.dirty = false;
      destroyEditor();
      setEditChrome(false);
      DF.toast('已保存 · 当前版本 ' + res.version, 'ok');
      state.id = res.id;
      state.mode = 'view';
      try { history.replaceState(null, '', 'skill-detail.html?id=' + encodeURIComponent(res.id)); } catch (e) {}
      state.skill = null;
      loadDetail();
    }).catch(function (err) {
      state.saving = false;
      DF.toast(API.errorText(err), 'err');
      renderShell();
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (state.mode !== 'view' && state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 's' && state.mode !== 'view') {
      e.preventDefault();
      save();
    }
  });

  init();
