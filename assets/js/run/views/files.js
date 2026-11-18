/**
 * CMP-run-files（L2 只读视图）
 *
 * 运行任务文件浏览器：root 切换、面包屑、目录懒加载、Markdown/文本预览。
 * 只经 CMP-run-data 取数；不编辑/上传/删除，不缓存业务数据。
 */

import { DF } from '../../ui.js';
import { createRunData, errorText } from '../data.js';
import { renderMarkdown } from '../../shared/markdown.js';

const { esc, icon } = DF;

const ROOTS = [
  { key: 'task-space', label: '任务空间' },
  { key: 'workspace', label: '工作区' }
];

const TYPE_ICON = { dir: 'folder', file: 'file', symlink: 'file', other: 'file' };

function fmtDate(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function dirName(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function isMarkdown(file) {
  if (!file) return false;
  if (file.language === 'markdown') return true;
  if (/^text\/markdown/i.test(file.contentType || '')) return true;
  return /\.(md|markdown|mdx)$/i.test(file.name || file.path || '');
}

function shellHTML() {
  return '<div class="rf">' +
    '<div class="rf-bar">' +
      '<div class="rf-roots">' +
        ROOTS.map(function (r) {
          return '<button type="button" class="rf-root" data-root="' + r.key + '">' + esc(r.label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="rf-crumbs"></div>' +
      '<button type="button" class="btn sm" data-act="refresh" title="刷新当前目录">' + icon('refresh', 12) + '刷新</button>' +
    '</div>' +
    '<div class="rf-main"><div class="rf-list"></div><div class="rf-preview"></div></div>' +
  '</div>';
}

function createContext(container, opts) {
  opts = opts || {};
  const state = {
    root: opts.root === 'workspace' ? 'workspace' : 'task-space',
    path: opts.path || '',
    entries: [],
    listing: true,
    listError: null,
    truncated: false,
    selected: null,
    file: null,
    fileLoading: false,
    fileError: null,
    controller: null,
    seq: 0,
    unmounted: false,
    restoreSelected: opts.selectedPath || null
  };
  container.innerHTML = shellHTML();
  return {
    container: container,
    data: opts.data || createRunData(),
    runId: opts.runId,
    state: state,
    els: {
      roots: container.querySelector('.rf-roots'),
      crumbs: container.querySelector('.rf-crumbs'),
      list: container.querySelector('.rf-list'),
      preview: container.querySelector('.rf-preview'),
      bar: container.querySelector('.rf-bar')
    }
  };
}

function abort(ctx) {
  if (ctx.state.controller) {
    try { ctx.state.controller.abort(); } catch { /* 已中止 */ }
  }
  ctx.state.controller = null;
}

function resetForRoot(ctx, root) {
  if (!ROOTS.some(function (r) { return r.key === root; })) return;
  const state = ctx.state;
  state.root = root;
  state.path = '';
  state.selected = null;
  state.file = null;
  state.fileError = null;
  state.restoreSelected = null;
  loadDir(ctx);
}

function openDir(ctx, path) {
  const state = ctx.state;
  state.path = path || '';
  state.selected = null;
  state.file = null;
  state.fileError = null;
  loadDir(ctx);
}

function applyListing(ctx, page) {
  const state = ctx.state;
  state.entries = (page.entries || []).slice().sort(function (a, b) {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  state.truncated = page.truncated === true;
  state.listing = false;
}

function restoreSelected(ctx) {
  const state = ctx.state;
  if (!state.restoreSelected) return false;
  const restore = state.restoreSelected;
  state.restoreSelected = null;
  const target = state.entries.find(function (entry) { return entry.path === restore && entry.type !== 'dir'; });
  if (!target) return false;
  openFile(ctx, target);
  return true;
}

function resetForEscape(ctx, err) {
  const state = ctx.state;
  state.path = '';
  state.selected = null;
  state.file = null;
  state.listError = null;
  state.listing = false;
  DF.toast(errorText(err), 'warn');
  loadDir(ctx);
}

async function loadDir(ctx) {
  const state = ctx.state;
  abort(ctx);
  const seq = ++state.seq;
  state.listing = true;
  state.listError = null;
  renderBar(ctx);
  renderList(ctx);
  renderPreview(ctx);
  const controller = new AbortController();
  state.controller = controller;
  try {
    const page = await ctx.data.listFiles(ctx.runId, { root: state.root, path: state.path, signal: controller.signal });
    if (state.unmounted || seq !== state.seq) return;
    applyListing(ctx, page);
    if (restoreSelected(ctx)) return;
  } catch (err) {
    if (state.unmounted || seq !== state.seq || err.name === 'AbortError') return;
    if (err.code === 'path_escape') { resetForEscape(ctx, err); return; }
    state.listing = false;
    state.listError = err;
  }
  if (seq !== state.seq) return;
  renderBar(ctx);
  renderList(ctx);
  renderPreview(ctx);
}

async function openFile(ctx, entry) {
  if (!entry || entry.type === 'dir') return;
  const state = ctx.state;
  abort(ctx);
  const seq = ++state.seq;
  state.selected = entry;
  state.file = null;
  state.fileLoading = true;
  state.fileError = null;
  renderList(ctx);
  renderPreview(ctx);
  const controller = new AbortController();
  state.controller = controller;
  try {
    const file = await ctx.data.readFile(ctx.runId, { root: state.root, path: entry.path, signal: controller.signal });
    if (state.unmounted || seq !== state.seq) return;
    state.file = file;
    state.fileLoading = false;
  } catch (err) {
    if (state.unmounted || seq !== state.seq || err.name === 'AbortError') return;
    state.fileLoading = false;
    state.fileError = err;
  }
  if (seq !== state.seq) return;
  renderPreview(ctx);
}

function renderBar(ctx) {
  const state = ctx.state;
  ctx.els.roots.querySelectorAll('.rf-root').forEach(function (btn) {
    btn.classList.toggle('on', btn.dataset.root === state.root);
  });
  const parts = String(state.path || '').split('/').filter(Boolean);
  if (!parts.length) {
    ctx.els.crumbs.innerHTML = '';
    return;
  }
  const rootLabel = (ROOTS.find(function (r) { return r.key === state.root; }) || ROOTS[0]).label;
  let html = '<button type="button" class="rf-crumb" data-path="">' + esc(rootLabel) + '</button>';
  let acc = '';
  parts.forEach(function (part) {
    acc = acc ? acc + '/' + part : part;
    html += '<span class="rf-sep">/</span><button type="button" class="rf-crumb" data-path="' + esc(acc) + '">' + esc(part) + '</button>';
  });
  ctx.els.crumbs.innerHTML = html;
}

function renderList(ctx) {
  const state = ctx.state;
  if (state.listing) {
    ctx.els.list.innerHTML = '<div class="loading">正在加载目录…</div>';
    return;
  }
  if (state.listError) {
    ctx.els.list.innerHTML = '<div class="empty rf-empty">' + esc(errorText(state.listError)) +
      '<br><br><button type="button" class="btn sm" data-act="retry">重试</button></div>';
    return;
  }
  if (!state.entries.length) {
    ctx.els.list.innerHTML = '<div class="empty rf-empty">目录为空</div>';
    return;
  }
  let html = state.entries.map(function (entry) {
    const selected = state.selected && state.selected.path === entry.path;
    return '<button type="button" class="rf-item' + (entry.type === 'dir' ? ' dir' : '') +
      (entry.hidden ? ' hidden' : '') + (selected ? ' on' : '') +
      '" data-path="' + esc(entry.path || '') + '" data-type="' + esc(entry.type || 'other') + '">' +
      '<span class="rf-ic">' + icon(TYPE_ICON[entry.type] || 'file', 14) + '</span>' +
      '<span class="rf-nm" title="' + esc(entry.name || '') + '">' + esc(entry.name || '') + '</span>' +
      '<span class="rf-meta">' + esc(entry.type === 'dir' ? '目录' : DF.fmtBytes(entry.sizeBytes)) + '</span>' +
    '</button>';
  }).join('');
  if (state.truncated) html += '<div class="rf-note">目录条目超过 2000 条，仅显示前 2000 条。</div>';
  ctx.els.list.innerHTML = html;
}

function previewHead(file, selected) {
  const name = file.name || dirName(selected.path) || '文件';
  return '<div class="rf-ph"><b>' + esc(name) + '</b>' +
    '<span class="rf-tags">' +
      (file.language ? '<span class="rf-lang">' + esc(file.language) + '</span>' : '') +
      '<span>' + esc(DF.fmtBytes(file.sizeBytes)) + '</span>' +
      '<span>' + esc(fmtDate(file.modifiedAt)) + '</span>' +
    '</span></div>';
}

function previewBody(file) {
  if (file.reason === 'binary') {
    return '<div class="empty rf-empty">二进制文件，暂不支持预览（' + esc(DF.fmtBytes(file.sizeBytes)) + '）</div>';
  }
  if (file.reason === 'too_large') {
    return '<div class="empty rf-empty">文件超过 1 MiB 预览上限（' + esc(DF.fmtBytes(file.sizeBytes)) + '）</div>';
  }
  if (file.content === null || file.content === undefined) {
    return '<div class="empty rf-empty">文件内容不可用</div>';
  }
  if (isMarkdown(file)) return '<div class="md-body rf-md">' + renderMarkdown(file.content) + '</div>';
  return '<pre class="rf-pre"><code>' + esc(file.content) + '</code></pre>';
}

function renderPreview(ctx) {
  const state = ctx.state;
  if (!state.selected) {
    ctx.els.preview.innerHTML = '<div class="empty rf-empty">选择左侧文件预览（只读）</div>';
    return;
  }
  if (state.fileLoading) {
    ctx.els.preview.innerHTML = '<div class="loading">正在读取文件…</div>';
    return;
  }
  if (state.fileError) {
    ctx.els.preview.innerHTML = '<div class="empty rf-empty">' + esc(errorText(state.fileError)) +
      '<br><br><button type="button" class="btn sm" data-act="retry-file">重试</button></div>';
    return;
  }
  const file = state.file;
  if (!file) return;
  const note = file.truncated ? '<div class="rf-note">文件超过 1 MiB，已截断显示。</div>' : '';
  ctx.els.preview.innerHTML = previewHead(file, state.selected) + note + previewBody(file);
}

function bindEvents(ctx) {
  const state = ctx.state;
  ctx.els.roots.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-root]');
    if (btn) resetForRoot(ctx, btn.dataset.root);
  });
  ctx.els.crumbs.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-path]');
    if (btn) openDir(ctx, btn.dataset.path || '');
  });
  ctx.els.list.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="retry"]')) { loadDir(ctx); return; }
    const item = e.target.closest('.rf-item');
    if (!item) return;
    if (item.dataset.type === 'dir') openDir(ctx, item.dataset.path);
    else openFile(ctx, { path: item.dataset.path, name: item.querySelector('.rf-nm').textContent, type: 'file' });
  });
  ctx.els.preview.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="retry-file"]') && state.selected) openFile(ctx, state.selected);
  });
  ctx.els.bar.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="refresh"]')) loadDir(ctx);
  });
}

export function mountRunFiles(container, opts) {
  const ctx = createContext(container, opts);
  bindEvents(ctx);
  loadDir(ctx);
  return {
    unmount: function () {
      ctx.state.unmounted = true;
      ctx.state.seq++;
      abort(ctx);
      ctx.container.innerHTML = '';
    },
    getState: function () {
      return {
        root: ctx.state.root,
        path: ctx.state.path,
        selectedPath: ctx.state.selected ? ctx.state.selected.path : null
      };
    }
  };
}
