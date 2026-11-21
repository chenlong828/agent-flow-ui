/**
 * Skill 面板（共享）· 查看 / 编辑 / 新建
 * 数据契约: API（B1 DTO 客户端）；渲染块: skill-panel-render.js；Markdown 编辑器: SKILL_MD。
 *
 * 用途：`skill-detail.html` 的页面主体与「专家弹层里点 Skill」的弹层共用这一份实现，
 * 保证 SKILL.md 的查看与编辑只有一套（背景见 REQ-0030 / SCN-0025）。
 *
 * 约定：
 * - 只渲染到传入的 root，不碰页面外壳、URL、beforeunload；这些由宿主负责；
 * - 查看态：元数据 + 正文只读渲染 + 附件清单；
 * - 编辑/新建：一律走服务端草稿（建草稿 → 改正文/附件 → save 带 If-Match），SKILL.md 只读；
 * - 正文 16 KiB 上限，编辑态实时计数，超限阻断保存并提示放 references/；
 * - 草稿由面板持有，宿主只通过 handle 操作；未保存离开的确认由宿主负责（isDirty()）。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { SK } from './skill-common.js';
import { SKILL_MD } from './skill-detail-markdown.js';
import { viewHtml, editHtml } from './skill-panel-render.js';
import {
  renderFiles as renderFilesBlock,
  removeFile as removeFileOp,
  startRename as renameFileOp,
  uploadFiles as uploadFilesOp
} from './skill-panel-files.js';

const BODY_LIMIT = SK.BODY_LIMIT;

class SkillPanel {
  constructor(root, opts) {
    this.root = root;
    this.o = opts || {};
    this.st = {
      mode: this.o.mode === 'edit' ? 'edit' : (this.o.mode === 'new' ? 'new' : 'view'),
      id: this.o.id || null,
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
      over: false,
      body: '',
      form: { name: '', slug: '', categoryCode: '', description: '', tags: [] },
      editor: null,
      editorToken: 0,
      filesErr: '',
      uploadDir: 'scripts'
    };
    this.start();
  }

  qs(sel) { return this.root ? this.root.querySelector(sel) : null; }

  snapshot() {
    var st = this.st;
    return {
      mode: st.mode, dirty: st.dirty, saving: st.saving, loading: st.loading,
      err: st.err, skill: st.skill, draftReady: !!st.draft, over: !!st.over
    };
  }

  notify() { if (typeof this.o.onState === 'function') this.o.onState(this.snapshot()); }

  catOptionsHtml(code) {
    var has = false;
    var html = this.st.cats.map(function (c) {
      if (c.code === code) has = true;
      return '<option value="' + DF.esc(c.code) + '"' + (c.code === code ? ' selected' : '') + '>' +
        DF.esc(c.label) + '</option>';
    }).join('');
    if (code && !has) {
      html = '<option value="' + DF.esc(code) + '" selected>' + DF.esc(code) + '</option>' + html;
    }
    return html;
  }

  catLabelOf(code) { return SK.catLabel(this.st.cats, code); }
  catColorOf(code) { return SK.catColor(this.st.cats, code); }
  descLen(v) { return SK.descLen(v); }

  bytes() {
    var version = this.st.skill ? this.st.skill.version : 'v1.0';
    return SK.markdownBytes({
      name: this.st.form.name,
      description: this.st.form.description,
      version: version
    }, this.st.body);
  }

  /* ---------------- 数据 ---------------- */
  loadCats() {
    var self = this;
    this.st.catsLoading = true;
    this.st.catsErr = '';
    this.render();
    return API.categories().then(function (cats) {
      self.st.cats = SK.sortCats(cats);
      self.st.catsLoading = false;
      self.render();
    }).catch(function (err) {
      self.st.catsLoading = false;
      self.st.catsErr = API.errorText(err);
      self.render();
    });
  }

  loadDetail() {
    var self = this;
    var st = this.st;
    if (!st.id) { this.render(); return Promise.resolve(); }
    st.loading = true;
    st.err = '';
    this.render();
    return API.get('skill', st.id).then(function (dto) {
      st.loading = false;
      st.skill = dto;
      st.files = (dto.files || []).slice();
      if (st.mode === 'edit') {
        st.body = String(dto.body == null ? '' : dto.body);
        st.form = {
          name: dto.name || '',
          slug: dto.slug || '',
          categoryCode: dto.categoryCode || '',
          description: dto.description || '',
          tags: (dto.tags || []).slice()
        };
        st.files = (dto.files || []).slice();
        self.createDraft();
      }
      self.render();
    }).catch(function (err) {
      st.loading = false;
      st.err = API.errorText(err);
      st.skill = null;
      self.render();
    });
  }

  createDraft() {
    var self = this;
    var st = this.st;
    st.draft = null;
    st.filesErr = '';
    return API.draftCreate(st.id || null).then(function (draft) {
      st.draft = draft;
      st.files = (draft.files || []).slice();
      if (st.mode === 'new' && !st.body) st.body = SK.defaultBody();
      self.render();
    }).catch(function (err) {
      st.filesErr = API.errorText(err);
      self.render();
    });
  }

  /* ---------------- 状态 ---------------- */
  markDirty() {
    this.st.dirty = true;
    this.renderDirtyFlag();
    this.notify();
  }

  resetDirty() {
    this.st.dirty = false;
    this.renderDirtyFlag();
    this.notify();
  }

  /** 页面宿主的吸顶提示条与弹层宿主的「未保存」都在宿主里渲染，这里只更新页面内的占位。 */
  renderDirtyFlag() {
    var el = this.qs('#sk-dirty');
    if (el) el.hidden = !this.st.dirty;
  }

  bindMediaFallback(node) {
    if (!node || node.__skMediaBound) return;
    node.__skMediaBound = true;
    node.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      t.classList.add('sk-img-broken');
      if (!t.getAttribute('alt')) t.setAttribute('alt', '图片加载失败');
      t.setAttribute('title', '图片加载失败：' + (t.getAttribute('src') || ''));
    }, true);
  }

  destroyEditor() {
    this.st.editorToken++;
    if (this.st.editor) { SKILL_MD.destroy(this.st.editor); this.st.editor = null; }
  }

  /* ---------------- 渲染 ---------------- */
  render() {
    this.renderBody();
    this.notify();
  }

  renderBody() {
    var st = this.st;
    if (!this.root) return;
    if (st.err) { this.root.innerHTML = this.errorHtml('Skill 详情加载失败', st.err); this.bindErrorRetry(); return; }
    if (st.loading) {
      this.root.innerHTML = '<div class="sub" style="padding:24px 2px">正在加载 Skill 详情…</div>';
      return;
    }
    if (st.mode === 'view') this.renderView();
    else this.renderEdit();
  }

  errorHtml(title, msg) {
    return DF.empty({
      icon: 'warn',
      html: '<div>' + DF.esc(title) + '</div>' +
        '<div class="sub" style="margin-top:6px">' + DF.esc(msg || '') + '</div>',
      action: { id: 'sk-retry', label: '重试', icon: 'refresh', primary: true, style: 'margin-top:12px' }
    });
  }

  bindErrorRetry() {
    var self = this;
    var btn = this.qs('#sk-retry');
    if (btn) btn.onclick = function () { self.loadDetail(); };
  }

  renderView() {
    if (!this.st.skill) return;
    this.resetDirty();
    this.destroyEditor();
    this.root.innerHTML = viewHtml(this.st.skill, {
      catLabel: this.catLabelOf(this.st.skill.categoryCode),
      catColor: this.catColorOf(this.st.skill.categoryCode)
    });
    this.renderFiles();
    this.mountBodyView();
  }

  mountBodyView() {
    var self = this;
    var node = this.qs('#sk-body');
    if (!node) return;
    var token = ++this.st.editorToken;
    var msg = this.qs('#sk-body-msg');
    if (msg) msg.innerHTML = '';
    this.bindMediaFallback(node);
    var text = String(this.st.skill && this.st.skill.body != null ? this.st.skill.body : '');
    if (!text.trim()) { node.innerHTML = '<div class="sub" style="padding:4px 0">正文为空</div>'; return; }
    SKILL_MD.mount(node, { markdown: text, editable: false }).then(function (handle) {
      if (token !== self.st.editorToken) { SKILL_MD.destroy(handle); return; }
      self.st.editor = handle;
    }).catch(function (err) {
      if (token !== self.st.editorToken) return;
      if (msg) msg.innerHTML = '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc('正文渲染失败：' + (err && err.message ? err.message : '未知错误')) +
        ' <a href="javascript:;" id="sk-body-retry">重试</a></span></div>';
      var retry = self.qs('#sk-body-retry');
      if (retry) retry.onclick = function () { self.mountBodyView(); };
    });
  }

  renderFiles() { renderFilesBlock(this); }
  removeFile(path) { removeFileOp(this, path); }
  startRename(path) { renameFileOp(this, path); }
  uploadFiles(fileList) { uploadFilesOp(this, fileList); }

  /* ---------------- 编辑 / 新建 ---------------- */
  renderEdit() {
    var st = this.st;
    if (!st.draft) {
      if (st.filesErr) {
        var self = this;
        this.root.innerHTML = DF.empty({
          icon: 'warn',
          html: '<div>草稿创建失败</div><div class="sub" style="margin-top:6px">' + DF.esc(st.filesErr) + '</div>',
          action: { id: 'sk-draft-retry', label: '重试', icon: 'refresh', primary: true, style: 'margin-top:12px' }
        });
        var retry = this.qs('#sk-draft-retry');
        if (retry) retry.onclick = function () { self.createDraft(); };
        return;
      }
      this.root.innerHTML = '<div class="sub" style="padding:24px 2px">正在创建草稿…</div>';
      return;
    }
    this.root.innerHTML = editHtml(st.form, {
      catSelectHtml: this.catOptionsHtml(st.form.categoryCode),
      catsErr: st.catsErr,
      total: this.bytes(),
      bodyLimit: BODY_LIMIT,
      descMax: SK.DESC_MAX,
      uploadDir: st.uploadDir
    });
    this.renderFiles();
    this.bindForm();
    this.mountEditor();
    this.updateBytes();
  }

  bindForm() {
    var self = this;
    var st = this.st;
    var d = st.form;
    var nameEl = this.qs('#sk-name');
    var slugEl = this.qs('#sk-slug');
    var catEl = this.qs('#sk-cat');
    var descEl = this.qs('#sk-desc');
    var descn = this.qs('#sk-descn');
    if (nameEl) nameEl.oninput = function () { d.name = nameEl.value; self.updateBytes(); self.markDirty(); };
    if (slugEl) slugEl.oninput = function () { d.slug = slugEl.value; self.markDirty(); };
    if (catEl) catEl.onchange = function () { d.categoryCode = catEl.value; self.markDirty(); };
    if (descEl) descEl.oninput = function () {
      d.description = descEl.value;
      if (descn) descn.textContent = self.descLen(d.description);
      self.updateBytes();
      self.markDirty();
    };
    var tagIn = this.qs('#sk-tag-in');
    if (tagIn) tagIn.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var val = tagIn.value.trim();
      if (!val) return;
      if (!d.tags.some(function (x) { return x === val; })) {
        d.tags = d.tags.concat([val]);
        tagIn.value = '';
        self.markDirty();
        self.renderEdit();
      }
    };
    this.root.querySelectorAll('[data-dtag]').forEach(function (el) {
      el.onclick = function () {
        var i = Number(el.getAttribute('data-dtag'));
        d.tags = d.tags.filter(function (x, idx) { return idx !== i; });
        self.markDirty();
        self.renderEdit();
      };
    });
    var catRetry = this.qs('#sk-cat-retry');
    if (catRetry) catRetry.onclick = function () { self.loadCats(); };
    var dir = this.qs('#sk-dir');
    if (dir) dir.onchange = function () { st.uploadDir = dir.value; };
    var upload = this.qs('#sk-upload');
    var addBtn = this.qs('#sk-add-file');
    if (addBtn) addBtn.onclick = function () { upload.click(); };
    if (upload) upload.onchange = function () { self.uploadFiles(upload.files); };
    var attach = this.qs('#sk-attach');
    if (attach) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        attach.addEventListener(ev, function (e) { e.preventDefault(); attach.classList.add('drag-over'); });
      });
      attach.addEventListener('dragleave', function () { attach.classList.remove('drag-over'); });
      attach.addEventListener('drop', function (e) {
        e.preventDefault();
        attach.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files) self.uploadFiles(e.dataTransfer.files);
      });
    }
  }

  mountEditor() {
    var self = this;
    var st = this.st;
    var node = this.qs('#sk-editor');
    if (!node || !st.draft) return;
    if (st.editor) { SKILL_MD.destroy(st.editor); st.editor = null; }
    this.bindMediaFallback(node);
    var token = ++st.editorToken;
    SKILL_MD.mount(node, {
      markdown: st.body,
      editable: true,
      onChange: function (md) {
        if (md === st.body) return;
        st.body = md;
        self.updateBytes();
        self.markDirty();
      }
    }).then(function (handle) {
      if (token !== st.editorToken) { SKILL_MD.destroy(handle); return; }
      st.editor = handle;
    }).catch(function (err) {
      if (token !== st.editorToken) return;
      var box = self.qs('#sk-body-err');
      if (box) box.innerHTML = '<div class="notice" style="margin-top:6px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc('编辑器初始化失败：' + (err && err.message ? err.message : '未知错误')) +
        ' <a href="javascript:;" id="sk-editor-retry">重试</a></span></div>';
      var retry = self.qs('#sk-editor-retry');
      if (retry) retry.onclick = function () { self.mountEditor(); };
    });
  }

  updateBytes() {
    var total = this.bytes();
    var el = this.qs('#sk-bytes');
    var hint = this.qs('#sk-bytes-hint');
    if (el) el.textContent = total + ' / ' + BODY_LIMIT + ' 字节';
    var over = total > BODY_LIMIT;
    if (hint) hint.textContent = over
      ? '正文超过 16 KiB：请把长内容放进 references/，正文只留入口与索引。'
      : '上限 16 KiB（含 frontmatter）；超出内容请放 references/ 渐进披露。';
    // 只在「可保存/不可保存」翻转时通知宿主，避免每次按键重建外壳
    if (over !== this.st.over) { this.st.over = over; this.notify(); }
    return over;
  }

  validate() {
    var d = this.st.form;
    if (!d.name.trim()) { DF.toast('请填写 Skill 名称', 'err'); return false; }
    var slug = (d.slug || '').trim();
    if (slug && (slug.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))) {
      DF.toast('英文名需为 kebab-case（小写字母、数字、连字符），如 cres-skill', 'err');
      return false;
    }
    if (this.descLen(d.description) < SK.DESC_MIN) { DF.toast('请填写 Skill 描述', 'err'); return false; }
    if (this.descLen(d.description) > SK.DESC_MAX) { DF.toast('描述需在 1–400 字之间', 'err'); return false; }
    var cats = this.st.cats;
    if (!d.categoryCode || !cats.some(function (c) { return c.code === d.categoryCode; })) {
      DF.toast('请选择 Skill 类别', 'err');
      return false;
    }
    if (this.bytes() > BODY_LIMIT) {
      DF.toast('正文超过 16 KiB，请把长内容放进 references/', 'err');
      return false;
    }
    return true;
  }

  save() {
    var self = this;
    var st = this.st;
    if (!st.draft || st.saving) return Promise.resolve(null);
    if (!this.validate()) return Promise.resolve(null);
    st.saving = true;
    this.notify();
    var payload = {
      name: st.form.name.trim(),
      categoryCode: st.form.categoryCode,
      description: st.form.description.trim(),
      tags: st.form.tags.slice(),
      body: st.body
    };
    var slug = (st.form.slug || '').trim();
    if (slug) payload.slug = slug;
    return API.draftSave(st.draft.id, payload, st.skill ? st.skill.revision : null).then(function (res) {
      st.saving = false;
      st.draft = null;
      st.dirty = false;
      self.destroyEditor();
      DF.toast('已保存 · 当前版本 ' + res.version, 'ok');
      st.id = res.id;
      st.mode = 'view';
      st.skill = null;
      // 保存返回的是草稿结果，回填给宿主前先取一次最新 DTO（名称/描述/类别才是新的）
      return self.loadDetail().then(function () {
        var fresh = st.skill;
        if (typeof self.o.onSaved === 'function' && fresh) self.o.onSaved(fresh);
        return fresh || res;
      });
    }).catch(function (err) {
      st.saving = false;
      DF.toast(API.errorText(err), 'err');
      self.notify();
      return null;
    });
  }

  /* ---------------- 模式切换 ---------------- */
  enterEdit() {
    var st = this.st;
    if (!st.skill || st.mode !== 'view') return;
    st.mode = 'edit';
    st.dirty = false;
    st.body = String(st.skill.body == null ? '' : st.skill.body);
    st.form = {
      name: st.skill.name || '',
      slug: st.skill.slug || '',
      categoryCode: st.skill.categoryCode || '',
      description: st.skill.description || '',
      tags: (st.skill.tags || []).slice()
    };
    // 查看态没有加载过分类；缺了会导致类别下拉为空、校验永远失败
    if (!st.cats.length && !st.catsLoading) this.loadCats();
    this.createDraft();
    this.render();
  }

  exitEdit() {
    var st = this.st;
    var draft = st.draft;
    st.draft = null;
    st.mode = 'view';
    st.body = '';
    st.dirty = false;
    this.destroyEditor();
    if (draft) API.draftCancel(draft.id).catch(function () {});
    this.render();
  }

  reload() {
    var st = this.st;
    st.err = '';
    st.mode = 'view';
    st.draft = null;
    st.dirty = false;
    this.destroyEditor();
    return this.loadDetail();
  }

  destroy() {
    var st = this.st;
    this.destroyEditor();
    if (st.draft) { API.draftCancel(st.draft.id).catch(function () {}); st.draft = null; }
    if (this.root) this.root.innerHTML = '';
    this.root = null;
  }

  start() {
    var st = this.st;
    if (st.mode === 'new') {
      st.body = SK.defaultBody();
      this.loadCats();
      this.createDraft();
      this.render();
    } else if (!st.id) {
      st.err = '缺少 Skill id';
      this.render();
    } else {
      if (st.mode === 'edit') this.loadCats();
      this.loadDetail();
    }
  }
}

/**
 * 挂载 Skill 面板。
 * @param {HTMLElement} root 渲染容器
 * @param {{id?: string|null, mode?: 'view'|'edit'|'new', onState?: Function, onSaved?: Function}} opts
 * @returns handle：{ enterEdit, exitEdit, save, isDirty, getMode, getSkill, getState, reload, destroy }
 */
export function mountSkillPanel(root, opts) {
  if (!root) throw new Error('mountSkillPanel 需要渲染容器');
  var panel = new SkillPanel(root, opts);
  return {
    root: root,
    enterEdit: function () { panel.enterEdit(); },
    exitEdit: function () { panel.exitEdit(); },
    save: function () { return panel.save(); },
    isDirty: function () { return panel.st.dirty; },
    isSaving: function () { return panel.st.saving; },
    getMode: function () { return panel.st.mode; },
    getSkill: function () { return panel.st.skill; },
    getState: function () { return panel.snapshot(); },
    reload: function () { return panel.reload(); },
    destroy: function () { panel.destroy(); }
  };
}

export const SKP = { mount: mountSkillPanel };
