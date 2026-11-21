/**
 * Skill 面板 · 附件区操作（渲染 / 删除 / 改名 / 上传）
 * 只服务 `skill-panel.js`：以面板实例作为上下文（`panel.st`、`panel.qs`、`panel.markDirty`），对外不是公共契约。
 * 草稿是服务端资源：每个操作完成后都以 `GET /skill-drafts/{id}` 的最新文件清单为准，不在本地拼装。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { filesHtml } from './skill-panel-render.js';

/** 渲染 `#sk-files` 并按当前模式挂上改名/删除。 */
export function renderFiles(panel) {
  var box = panel.qs('#sk-files');
  if (!box) return;
  box.innerHTML = filesHtml(panel.st.files, panel.st.mode !== 'view');
  box.querySelectorAll('.sk-del').forEach(function (el) {
    el.onclick = function () { removeFile(panel, el.getAttribute('data-path')); };
  });
  box.querySelectorAll('.sk-rename').forEach(function (el) {
    el.onclick = function () { startRename(panel, el.getAttribute('data-path')); };
  });
}

export function removeFile(panel, path) {
  var st = panel.st;
  if (!st.draft) return;
  API.draftDeleteFile(st.draft.id, path).then(function () {
    return API.draftGet(st.draft.id);
  }).then(function (d) {
    st.draft = d; st.files = d.files || []; renderFiles(panel);
    panel.markDirty();
    DF.toast('已删除 ' + path, 'ok');
  }).catch(function (err) { DF.toast(API.errorText(err), 'err'); });
}

export function startRename(panel, path) {
  var st = panel.st;
  var row = panel.root.querySelector('.sk-file[data-path="' + path.replace(/"/g, '\\"') + '"]');
  if (!row) return;
  row.innerHTML = '<input class="inp inp-sm" id="sk-rename-in" style="flex:1" value="' + DF.esc(path) + '">' +
    '<button class="btn btn-sm" id="sk-rename-ok">确定</button>' +
    '<button class="btn btn-sm" id="sk-rename-no">取消</button>';
  var input = panel.qs('#sk-rename-in');
  panel.qs('#sk-rename-ok').onclick = function () {
    var next = input.value.trim();
    if (!next || next === path) { renderFiles(panel); return; }
    API.draftRename(st.draft.id, path, next).then(function () {
      return API.draftGet(st.draft.id);
    }).then(function (d) {
      st.draft = d; st.files = d.files || []; renderFiles(panel);
      panel.markDirty();
      DF.toast('已改名', 'ok');
    }).catch(function (err) { DF.toast(API.errorText(err), 'err'); });
  };
  panel.qs('#sk-rename-no').onclick = function () { renderFiles(panel); };
}

export function uploadFiles(panel, fileList) {
  var st = panel.st;
  if (!st.draft || !fileList || !fileList.length) return;
  var dirName = st.uploadDir;
  var list = Array.prototype.slice.call(fileList);
  var chain = Promise.resolve();
  list.forEach(function (file) {
    chain = chain.then(function () { return API.draftUpload(st.draft.id, dirName + '/' + file.name, file); });
  });
  chain.then(function () { return API.draftGet(st.draft.id); }).then(function (d) {
    st.draft = d;
    st.files = d.files || [];
    panel.renderEdit();
    panel.markDirty();
    DF.toast('已上传 ' + list.length + ' 个附件', 'ok');
  }).catch(function (err) {
    DF.toast(API.errorText(err), 'err');
  });
}
