/**
 * AgentFlow 原型 · Skill 专门页面（外壳 + 共享面板）
 * 依赖: DF（ui.js）、API、SK、SKP（skill-panel.js，查看/编辑/新建的唯一实现）
 *
 * 约定：
 * - 本文件只做「页面外壳」：query、面包屑/页头、页头操作、URL 回写、离开提醒、Cmd+S；
 * - 查看/编辑/新建、草稿、正文与附件、Markdown 编辑器全部在 `skill-panel.js`（与专家弹层共用）；
 * - 编辑/新建一律走服务端草稿（建草稿 → 改正文/附件 → save 带 If-Match）。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { SK } from './skill-common.js';
import { SKP } from './skill-panel.js';

  var panel = null;
  var lastSig = '';
  var pageMode = 'view';

  function shellSubtitle() {
    var s = panel && panel.getSkill();
    if (!s) return '';
    return [
      s.categoryLabel || s.categoryCode,
      s.version,
      s.updatedAt ? SK.fmtDateTime(s.updatedAt) : ''
    ].filter(Boolean).join(' · ');
  }

  function shellActionsHtml(s) {
    if (s.mode === 'view') {
      return (s.skill ? '<button class="btn" id="sk-download">' + DF.icon('download', 14) + '下载</button>' : '') +
        '<button class="btn primary" id="sk-edit">' + DF.icon('edit', 14) + '编辑</button>';
    }
    var saveLabel = s.mode === 'new' ? '创建' : '保存';
    return '<span class="skd-dirty" id="sk-dirty"' + (s.dirty ? '' : ' hidden') + '>未保存</span>' +
      '<button class="btn" id="sk-cancel">取消</button>' +
      '<button class="btn primary" id="sk-save"' + (s.saving || s.over ? ' disabled' : '') + '>' +
        DF.icon('check', 14) + saveLabel + '</button>';
  }

  /* 外壳只渲染一次：DF.renderShell 会重建 #app（连同 #page-body），
   * 之后只更新页头文字与操作区，面板 DOM 与编辑器实例必须保持不动。 */
  function titleOf(s) {
    var skill = s.skill;
    return s.mode === 'new' ? '新建 Skill'
      : (skill ? skill.name : (s.mode === 'edit' ? '编辑 Skill' : 'Skill 详情'));
  }

  function renderChrome(s) {
    var title = titleOf(s);
    var h1 = document.querySelector('.page-header h1');
    if (h1) h1.textContent = title;
    var head = document.querySelector('.page-header > div');
    if (head) {
      var sub = head.querySelector('.sub');
      var text = shellSubtitle();
      if (text && !sub) {
        sub = document.createElement('div');
        sub.className = 'sub';
        head.appendChild(sub);
      }
      if (sub) { sub.textContent = text; sub.hidden = !text; }
    }
    var crumb = document.querySelectorAll('.breadcrumb span');
    if (crumb.length) crumb[crumb.length - 1].textContent = s.mode === 'new' ? '新建' : title;
    var acts = document.querySelector('.page-header .acts');
    if (acts) { acts.innerHTML = shellActionsHtml(s); bindActions(); }
    document.body.classList.toggle('sk-edit-mode', s.mode !== 'view');
  }

  function bindActions() {
    var editBtn = document.getElementById('sk-edit');
    if (editBtn) editBtn.onclick = function () { if (panel) panel.enterEdit(); };
    var downloadBtn = document.getElementById('sk-download');
    if (downloadBtn) downloadBtn.onclick = function () {
      var sk = panel && panel.getSkill();
      if (sk) API.download('skill', sk.id);
    };
    var cancelBtn = document.getElementById('sk-cancel');
    if (cancelBtn) cancelBtn.onclick = cancel;
    var saveBtn = document.getElementById('sk-save');
    if (saveBtn) saveBtn.onclick = function () { if (panel) panel.save(); };
  }

  /* 每次状态变化按「外壳相关字段」去重，避免按键时重建页头 */
  function onState(state) {
    var sig = [state.mode, state.dirty, state.saving, state.err ? 1 : 0, state.over ? 1 : 0,
      state.skill ? (state.skill.name || '') : '', state.skill ? (state.skill.version || '') : ''].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    renderChrome(state);
  }

  function cancel() {
    if (!panel) return;
    if (panel.isDirty()) {
      DF.modal.confirm({
        title: '放弃编辑', danger: true, okText: '放弃修改',
        message: '未保存的修改将丢失，确定取消？'
      }).then(function (ok) { if (ok && panel) panel.exitEdit(); });
      return;
    }
    var hadSkill = !!panel.getSkill();
    panel.exitEdit();
    if (pageMode === 'new' && !hadSkill) location.href = 'skills.html';
  }

  function boot() {
    var id = DF.qs('id');
    var mode = DF.qs('mode');
    pageMode = mode === 'new' ? 'new' : (mode === 'edit' ? 'edit' : 'view');
    DF.renderShell({
      active: 'skills',
      breadcrumb: [{ label: '资产与注册' }, { label: 'Skill 库', href: 'skills.html' }, { label: '详情' }],
      title: pageMode === 'new' ? '新建 Skill' : 'Skill 详情',
      actions: ''
    });
    var host = document.getElementById('page-body');
    panel = SKP.mount(host, {
      id: id || null,
      mode: pageMode,
      onState: onState,
      onSaved: function (res) {
        try { history.replaceState(null, '', 'skill-detail.html?id=' + encodeURIComponent(res.id)); } catch {}
        pageMode = 'view';
      }
    });
  }

  window.addEventListener('beforeunload', function (e) {
    if (panel && panel.getMode() !== 'view' && panel.isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 's' && panel && panel.getMode() !== 'view') {
      e.preventDefault();
      panel.save();
    }
  });

  boot();
