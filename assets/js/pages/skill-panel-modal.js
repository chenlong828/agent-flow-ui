/**
 * Skill 面板 · 弹层宿主
 * 把 `skill-panel.js` 的共享面板装进 90vh 弹层，供「专家弹层里点 Skill 行」使用；
 * 面板本身不感知弹层，宿主在此负责页脚按钮与未保存关闭拦截。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { mountSkillPanel } from './skill-panel.js';

const TITLE = 'Skill 详情';

/**
 * 打开 Skill 弹层（查看 / 编辑 / 保存）。
 * @param {{id: string, mode?: 'view'|'edit', onSaved?: Function, onClose?: Function}} opt
 * @returns {{ close: Function, getHandle: Function }}
 */
export function openSkillPanelModal(opt) {
  var o = opt || {};
  var panel = null;
  var modal = null;
  var allowClose = false;
  var discarding = false;
  var footSig = '';

  function modalEl() { return modal && modal.body ? modal.body.closest('.modal') : null; }
  function footEl() {
    var m = modalEl();
    return m ? m.querySelector('.d-foot') : null;
  }

  function footerHtml() {
    if (!panel) return '<button class="btn" id="skm-close">关闭</button>';
    var st = panel.getState();
    if (st.err) return '<button class="btn" id="skm-close">关闭</button>';
    if (st.mode === 'view') {
      return (st.skill ? '<button class="btn" id="skm-download">' + DF.icon('download', 14) + '下载</button>' : '') +
        '<button class="btn" id="skm-close">关闭</button>' +
        '<button class="btn primary" id="skm-edit">' + DF.icon('edit', 14) + '编辑</button>';
    }
    if (discarding) {
      return '<span class="skd-dirty" style="margin-right:auto">未保存的修改</span>' +
        '<button class="btn" id="skm-keep">继续编辑</button>' +
        '<button class="btn danger" id="skm-discard">放弃修改</button>';
    }
    return '<button class="btn" id="skm-cancel">取消</button>' +
      '<button class="btn primary" id="skm-save">' + DF.icon('check', 14) + '保存</button>';
  }

  function bindFoot() {
    var foot = footEl();
    if (!foot) return;
    var edit = foot.querySelector('#skm-edit');
    if (edit) edit.onclick = function () { if (panel) panel.enterEdit(); };
    var dl = foot.querySelector('#skm-download');
    if (dl) dl.onclick = function () { var s = panel && panel.getSkill(); if (s) API.download('skill', s.id); };
    var closeBtn = foot.querySelector('#skm-close');
    if (closeBtn) closeBtn.onclick = function () { if (modal) modal.close(); };
    var cancel = foot.querySelector('#skm-cancel');
    if (cancel) cancel.onclick = function () {
      if (!panel) return;
      if (!panel.isDirty()) { panel.exitEdit(); return; }
      discarding = true;
      renderFoot();
    };
    var save = foot.querySelector('#skm-save');
    if (save) {
      var st = panel ? panel.getState() : null;
      save.disabled = !!(st && (st.saving || st.over));
      save.onclick = function () { if (panel) panel.save(); };
    }
    var keep = foot.querySelector('#skm-keep');
    if (keep) keep.onclick = function () { discarding = false; renderFoot(); };
    var discard = foot.querySelector('#skm-discard');
    if (discard) discard.onclick = function () {
      discarding = false;
      allowClose = true;
      if (panel) panel.exitEdit();
      if (modal) modal.close();
    };
  }

  function renderFoot() {
    var foot = footEl();
    if (!foot) return;
    foot.innerHTML = footerHtml();
    bindFoot();
  }

  function setTitle() {
    var m = modalEl();
    if (!m) return;
    var head = m.querySelector('.d-head');
    var node = head && head.firstChild;
    var name = panel && panel.getSkill() ? panel.getSkill().name : '';
    var title = TITLE + (name ? ' · ' + name : '');
    if (node && node.nodeType === 3) node.nodeValue = title;
  }

  function onState(state) {
    var sig = [state.mode, state.dirty, state.saving, state.err ? 1 : 0, state.over ? 1 : 0, discarding ? 1 : 0].join('|');
    if (sig !== footSig) { footSig = sig; renderFoot(); }
    setTitle();
  }

  modal = DF.modal.open({
    title: TITLE,
    width: '80vw',
    height: '90vh',
    closeOnEsc: true,
    body: '<div id="sk-panel-root"></div>',
    footer: footerHtml(),
    beforeClose: function () {
      if (allowClose || !panel || !panel.isDirty()) return true;
      discarding = true;
      renderFoot();
      return false;
    },
    onMount: function (body) {
      panel = mountSkillPanel(body.querySelector('#sk-panel-root'), {
        id: o.id,
        mode: o.mode === 'edit' ? 'edit' : 'view',
        onState: onState,
        onSaved: function (skill) { if (typeof o.onSaved === 'function') o.onSaved(skill); }
      });
    },
    onClose: function () {
      if (panel) { panel.destroy(); panel = null; }
      if (typeof o.onClose === 'function') o.onClose();
    }
  });

  renderFoot();
  setTitle();

  return { close: function () { if (modal) modal.close(); }, getHandle: function () { return panel; } };
}

export const SKPM = { open: openSkillPanelModal };
