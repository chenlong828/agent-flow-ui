/**
 * 发起运行弹窗的「初始资料（图片）」视图（CMP-instances）
 *
 * 只做附件栏渲染、粘贴/拖放/选择绑定与提交按钮文案；本地暂存与上传回滚由
 * run/input-upload 负责。提交前不产生任何网络请求。
 */

import { DF } from '../../ui.js';
import { createInputStaging, REJECT_TEXT } from '../input-upload.js';

const { esc, icon } = DF;
const REJECT_ORDER = ['type', 'empty', 'size', 'count', 'total'];

export function launchInputsFieldHTML() {
  return DF.field('初始资料（图片）',
    '<div class="rn-inputs" id="rn-inputs">' +
      '<div class="rn-inputs-strip" id="rn-inputs-strip" role="list" aria-label="已选图片"></div>' +
      '<div class="rn-inputs-side">' +
        '<button type="button" class="rn-inputs-add" id="rn-inputs-add">' + icon('plus', 14) + ' 添加图片</button>' +
        '<span class="rn-inputs-meta" id="rn-inputs-count">未选择图片</span>' +
      '</div>' +
    '</div>' +
    '<input type="file" id="rn-inputs-file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>' +
    '<div class="rn-sr" id="rn-inputs-live" aria-live="polite"></div>',
    { hint: '可选；PNG/JPEG/WebP/GIF，单张 ≤8 MiB、最多 8 张、合计 ≤20 MiB；点「发起运行」时才上传' });
}

function rejectText(rejected) {
  const reasons = [];
  (rejected || []).forEach(function (item) {
    if (reasons.indexOf(item.reason) < 0) reasons.push(item.reason);
  });
  reasons.sort(function (a, b) { return REJECT_ORDER.indexOf(a) - REJECT_ORDER.indexOf(b); });
  return reasons.map(function (reason) { return REJECT_TEXT[reason] || '图片无法添加'; }).join('；');
}

function thumbHTML(view, item) {
  const percent = item.state === 'uploading' ? Math.max(4, item.progress || 0) : 0;
  return '<div class="rn-thumb" role="listitem" data-local="' + esc(item.localId) + '" data-state="' + esc(item.state) + '">' +
    '<img src="' + esc(item.objectUrl) + '" alt="' + esc(item.name) + '" title="' + esc(item.name) + ' · ' + esc(DF.fmtBytes(item.sizeBytes)) + '">' +
    (item.state === 'uploading' ? '<span class="rn-thumb-bar"><i style="width:' + percent + '%"></i></span>' : '') +
    (item.state === 'uploaded' || item.state === 'bound' ? '<span class="rn-thumb-ok">' + icon('check', 12) + '</span>' : '') +
    '<button type="button" class="rn-thumb-del" data-del="' + esc(item.localId) + '" aria-label="删除 ' + esc(item.name) + '"' +
      (view.busy ? ' disabled' : '') + '>' + icon('x', 12) + '</button>' +
    '</div>';
}

function renderInputs(view) {
  if (view.disposed) return;
  const strip = view.body.querySelector('#rn-inputs-strip');
  if (!strip) return;
  const items = view.staging.items();
  strip.innerHTML = items.map(function (item) { return thumbHTML(view, item); }).join('');
  const count = view.body.querySelector('#rn-inputs-count');
  if (count) {
    const bytes = items.reduce(function (sum, item) { return sum + item.sizeBytes; }, 0);
    count.textContent = items.length
      ? '已选 ' + items.length + '/8 · 合计 ' + DF.fmtBytes(bytes)
      : '粘贴、拖放或添加图片';
  }
  const add = view.body.querySelector('#rn-inputs-add');
  if (add) add.disabled = view.busy || items.length >= 8;
  const root = view.body.closest('.modal');
  const okBtn = root && root.querySelector('.d-foot .btn.primary');
  if (okBtn) {
    if (!view.busy) okBtn.textContent = '发起运行';
    else if (view.phase === 'start') okBtn.textContent = '启动中…';
    else {
      const progress = view.staging.uploadProgress();
      okBtn.textContent = '上传图片 ' + progress.uploaded + '/' + progress.total + '…';
    }
  }
}

function addFiles(view, files) {
  const result = view.staging.addFiles(files);
  if (result.rejected.length) DF.toast(rejectText(result.rejected), 'warn');
  const live = view.body.querySelector('#rn-inputs-live');
  if (live && result.added) live.textContent = '已添加 ' + result.added + ' 张图片';
  renderInputs(view);
}

function setBusy(view, busy, phase) {
  view.busy = Boolean(busy);
  view.phase = phase || null;
  const root = view.body.closest('.modal');
  if (!root) return;
  const okBtn = root.querySelector('.d-foot .btn.primary');
  const cancel = root.querySelector('.d-foot [data-mf-cancel]');
  if (okBtn) okBtn.disabled = view.busy;
  /* 上传阶段允许取消（关闭会中止在途请求并回滚）；启动请求已发出后不允许 */
  if (cancel) cancel.disabled = view.busy && view.phase === 'start';
  renderInputs(view);
}

function hasFilePayload(event) {
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  return Array.prototype.slice.call(transfer.types || []).indexOf('Files') >= 0;
}

function bindLaunchInputs(view) {
  const body = view.body;
  const fileInput = body.querySelector('#rn-inputs-file');
  const addBtn = body.querySelector('#rn-inputs-add');
  if (addBtn && fileInput) {
    addBtn.onclick = function () { if (!view.busy) fileInput.click(); };
    fileInput.onchange = function () {
      addFiles(view, fileInput.files);
      fileInput.value = '';
    };
  }
  const strip = body.querySelector('#rn-inputs-strip');
  if (strip) {
    strip.onclick = function (event) {
      const del = event.target.closest('[data-del]');
      if (del) {
        if (view.busy) return;
        view.staging.remove(del.dataset.del).then(function () { renderInputs(view); });
        return;
      }
      const thumb = event.target.closest('[data-local]');
      if (!thumb) return;
      const item = view.staging.items().find(function (it) { return it.localId === thumb.dataset.local; });
      if (item && item.objectUrl) window.open(item.objectUrl, '_blank', 'noopener');
    };
  }
  body.addEventListener('paste', function (event) {
    const clipboard = event.clipboardData;
    if (!clipboard || !clipboard.items) return;
    const files = [];
    for (let i = 0; i < clipboard.items.length; i += 1) {
      const item = clipboard.items[i];
      if (item.kind !== 'file' || !String(item.type || '').startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    addFiles(view, files);
  }, true);
  body.addEventListener('dragenter', function (event) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    body.classList.add('rn-drag');
  }, true);
  body.addEventListener('dragover', function (event) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    body.classList.add('rn-drag');
  }, true);
  body.addEventListener('dragleave', function (event) {
    if (event.target === body || !body.contains(event.relatedTarget)) body.classList.remove('rn-drag');
  }, true);
  body.addEventListener('drop', function (event) {
    body.classList.remove('rn-drag');
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = Array.prototype.slice.call((event.dataTransfer && event.dataTransfer.files) || []);
    const images = files.filter(function (file) { return String(file.type || '').startsWith('image/'); });
    if (images.length < files.length) DF.toast('只支持图片', 'warn');
    if (images.length) addFiles(view, images);
  }, true);
}

/**
 * @param {HTMLElement} body 弹窗主体
 * @param {{ upload: Function, remove: Function }} options 数据层上传/删除函数
 * @returns {{ staging: object, setBusy: Function, isBusy: Function, render: Function, dispose: Function }}
 */
export function mountLaunchInputs(body, options) {
  const opts = options || {};
  const view = { body: body, staging: null, busy: false, phase: null, disposed: false };
  view.staging = createInputStaging({
    upload: opts.upload,
    remove: opts.remove,
    onChange: function () { renderInputs(view); }
  });
  bindLaunchInputs(view);
  renderInputs(view);
  return {
    staging: view.staging,
    setBusy: function (busy, phase) { setBusy(view, busy, phase); },
    isBusy: function () { return view.busy; },
    render: function () { renderInputs(view); },
    dispose: function () { view.disposed = true; view.staging.dispose(); }
  };
}
