/**
 * 工作流列表（B3 live）
 *
 * 唯一数据入口：workflow/data.js。页面只负责查询条件、渲染、向导与
 * 生命周期操作；不引用 MOCK，不在浏览器内改工作流图。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { createWorkflowData, errorText } from '../workflow/data.js';
import { minimalGraph, graphCounts } from '../workflow/model.js';

const { esc, icon, tag, toast } = DF;
const data = createWorkflowData();

const LS_VIEW_KEY = 'wl-view';
const PAGE_SIZE = 20;
const TYPES_DEFAULT = ['研发主流程', '专项子流程', '批量审视任务'];
const TYPE_COLOR = { '研发主流程': 'blue', '专项子流程': 'teal', '批量审视任务': 'purple' };

const state = {
  items: [],
  total: 0,
  offset: 0,
  limit: PAGE_SIZE,
  q: '',
  type: '',
  sort: 'updatedAt:desc',
  view: DF.lsGet(LS_VIEW_KEY) === 'table' ? 'table' : 'card',
  types: TYPES_DEFAULT.slice(),
  experts: [],
  loading: false,
  error: '',
  seq: 0
};

let body = null;
let searchTimer = null;

function relTimeText(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  return DF.relTime(min);
}

function typeColor(type) {
  if (TYPE_COLOR[type]) return TYPE_COLOR[type];
  let h = 0;
  for (let i = 0; i < String(type).length; i += 1) h = (h * 31 + String(type).charCodeAt(i)) % 360;
  return h < 40 ? 'orange' : h < 90 ? 'teal' : h < 160 ? 'green' : h < 230 ? 'blue' : h < 300 ? 'purple' : 'gray';
}

function rememberTypes(items) {
  items.forEach(function (item) {
    if (item.type && state.types.indexOf(item.type) < 0) state.types.push(item.type);
  });
}

function pageRows() {
  return state.items.map(function (item) {
    return {
      name: item.name,
      type: item.type,
      description: item.description || '',
      nodeCount: item.nodeCount,
      stageCount: item.stageCount,
      updatedAt: item.updatedAt,
      revision: item.revision,
      id: item.id
    };
  });
}

function listQuery() {
  return {
    sort: state.sort,
    limit: state.limit,
    offset: state.offset,
    q: state.q.trim(),
    type: state.type
  };
}

async function load(resetOffset) {
  if (resetOffset) state.offset = 0;
  const seq = ++state.seq;
  state.loading = true;
  state.error = '';
  renderBody();
  try {
    const page = await data.list(listQuery());
    if (seq !== state.seq) return;
    state.items = Array.isArray(page.items) ? page.items : [];
    state.total = Number(page.total) || 0;
    state.limit = Number(page.limit) || PAGE_SIZE;
    state.offset = Number(page.offset) || 0;
    rememberTypes(state.items);
    state.loading = false;
    renderBody();
  } catch (err) {
    if (seq !== state.seq) return;
    state.items = [];
    state.total = 0;
    state.error = errorText(err);
    state.loading = false;
    renderBody();
  }
}

async function loadExperts() {
  try {
    const page = await API.list('expert', { limit: 200, offset: 0 });
    state.experts = (page.items || []).slice();
  } catch (err) {
    state.experts = [];
  }
}

function renderShellOnce() {
  body = DF.renderShell({
    pendingCount: 0,
    active: 'workflows',
    breadcrumb: [{ label: '流程研发' }, { label: '工作流' }],
    title: '工作流',
    subtitle: '管理研发智能体工作流定义',
    actions: '<button class="btn" id="btn-import">' + icon('download', 14) + '导入 DSL</button>' +
      '<button class="btn primary" id="btn-new">' + icon('plus', 14) + '新建工作流</button>'
  });
  document.getElementById('btn-new').addEventListener('click', openNewModal);
  document.getElementById('btn-import').addEventListener('click', openImportPicker);
  renderBody();
}

function renderBody() {
  if (!body) return;
  const tabs = [{ k: '', label: '全部', count: state.total }].concat(
    state.types.map(function (type) {
      return { k: type, label: type, count: state.type ? null : state.items.filter(function (w) { return w.type === type; }).length };
    })
  );
  const statsRows = pageRows();
  const nodeTotal = statsRows.reduce(function (sum, r) { return sum + (Number(r.nodeCount) || 0); }, 0);
  const stageTotal = statsRows.reduce(function (sum, r) { return sum + (Number(r.stageCount) || 0); }, 0);
  const latest = statsRows.reduce(function (max, r) {
    const t = new Date(r.updatedAt).getTime();
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);

  body.innerHTML =
    '<div class="wl-tabrow">' +
      DF.tabsHtml(tabs, state.type, 'data-tab', 'id="wl-tabs"') +
      DF.searchBox('wl-search', '搜索工作流名称', state.q) +
    '</div>' +
    '<div class="wl-filterbar">' +
      '<label>排序 <select class="inp inp-sm" id="wl-sort">' +
        '<option value="updatedAt:desc"' + (state.sort === 'updatedAt:desc' ? ' selected' : '') + '>最近更新</option>' +
        '<option value="updatedAt:asc"' + (state.sort === 'updatedAt:asc' ? ' selected' : '') + '>最早更新</option>' +
        '<option value="name:asc"' + (state.sort === 'name:asc' ? ' selected' : '') + '>名称 A→Z</option>' +
        '<option value="name:desc"' + (state.sort === 'name:desc' ? ' selected' : '') + '>名称 Z→A</option>' +
      '</select></label>' +
      '<span class="wl-result-count" id="wl-count">共 ' + state.total + ' 个</span>' +
      '<span style="flex:1"></span>' +
      '<div class="seg">' +
        '<button data-view="card" class="' + (state.view === 'card' ? 'on' : '') + '">卡片</button>' +
        '<button data-view="table" class="' + (state.view === 'table' ? 'on' : '') + '">表格</button>' +
      '</div>' +
    '</div>' +
    (state.error ? '<div class="banner banner-fail" id="wl-error">' + esc(state.error) +
      ' <button class="btn sm" id="wl-retry">重试</button></div>' : '') +
    DF.statRow([
      DF.statCard({ k: '总数', v: state.total + ' <small>个工作流</small>', d: '当前筛选' }),
      DF.statCard({ k: '节点', v: nodeTotal + ' <small>个</small>', d: '本页合计' }),
      DF.statCard({ k: '阶段', v: stageTotal + ' <small>个</small>', d: '本页合计' }),
      DF.statCard({ k: '最近更新', v: latest ? esc(relTimeText(new Date(latest).toISOString())) : '—', d: '本页最近一条' })
    ]) +
    '<div id="wl-list">' + renderList() + '</div>' +
    renderPager();

  wire();
}

function renderList() {
  if (state.loading) return '<div class="loading" id="wl-loading">加载中…</div>';
  if (!state.items.length) {
    if (state.q.trim() || state.type) {
      return DF.empty({
        icon: 'search', iconSize: 30,
        html: '没有匹配的工作流<br><br>',
        action: { id: 'wl-clear', label: '清除筛选', icon: 'x', sm: true }
      });
    }
    return DF.empty({
      icon: 'flow', iconSize: 32,
      html: '还没有工作流，新建一个最小合法流程<br><br>',
      action: { id: 'wl-empty-new', label: '新建工作流', icon: 'plus', primary: true, sm: true }
    });
  }
  return state.view === 'card' ? cardHtml() : tableHtml();
}

function cardHtml() {
  return '<div class="card-grid">' + state.items.map(function (w) {
    return '<div class="item-card wl-card" data-id="' + esc(w.id) + '">' +
      '<div class="ic-head">' + icon('flow', 16) + '<span class="ic-title">' + esc(w.name) + '</span></div>' +
      '<div class="wl-meta">' + tag(w.type, typeColor(w.type)) + '<span class="mono">r' + w.revision + '</span></div>' +
      '<div class="ic-desc">' + esc(w.description || '（暂无描述）') + '</div>' +
      '<div class="wl-meta">' + w.nodeCount + ' 节点' + (w.stageCount ? '<span class="sep">·</span>' + w.stageCount + ' 阶段' : '') + '</div>' +
      '<div class="wl-meta">更新于 ' + esc(relTimeText(w.updatedAt)) + '</div>' +
      '<div class="ic-foot">' +
        '<button class="btn sm" data-act="edit" data-id="' + esc(w.id) + '">' + icon('edit', 13) + '编辑</button>' +
        '<span style="flex:1"></span>' +
        '<button class="wl-more" data-act="more" data-id="' + esc(w.id) + '" title="更多操作">' + icon('more', 16) + '</button>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}

function tableHtml() {
  const rows = state.items.map(function (w) {
    return '<tr>' +
      '<td class="rowlink" data-act="edit" data-id="' + esc(w.id) + '">' + esc(w.name) + '</td>' +
      '<td>' + tag(w.type, typeColor(w.type)) + '</td>' +
      '<td>' + w.nodeCount + '</td>' +
      '<td>' + w.stageCount + '</td>' +
      '<td class="sub">' + esc(w.description || '') + '</td>' +
      '<td>' + esc(relTimeText(w.updatedAt)) + '</td>' +
      '<td><div class="wl-acts">' +
        '<button class="btn sm" data-act="edit" data-id="' + esc(w.id) + '">编辑</button>' +
        '<button class="wl-more" data-act="more" data-id="' + esc(w.id) + '" title="更多操作">' + icon('more', 16) + '</button>' +
      '</div></td>' +
    '</tr>';
  });
  return DF.table(['名称', '类型', '节点数', '阶段数', '描述', '更新时间', '操作'], rows);
}

function renderPager() {
  if (state.total <= state.limit) return '';
  const from = state.total ? state.offset + 1 : 0;
  const to = Math.min(state.offset + state.items.length, state.total);
  return '<div class="wl-pager">' +
    '<span>' + from + '–' + to + ' / ' + state.total + '</span>' +
    '<button class="btn sm" id="wl-prev"' + (state.offset <= 0 ? ' disabled' : '') + '>上一页</button>' +
    '<button class="btn sm" id="wl-next"' + (state.offset + state.limit >= state.total ? ' disabled' : '') + '>下一页</button>' +
  '</div>';
}

function wire() {
  const tabs = document.getElementById('wl-tabs');
  if (tabs) {
    tabs.querySelectorAll('[data-tab]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.type = el.getAttribute('data-tab');
        load(true);
      });
    });
  }
  const search = document.getElementById('wl-search');
  if (search) {
    search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.q = search.value;
        load(true);
      }, 120);
    });
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
  const sort = document.getElementById('wl-sort');
  if (sort) sort.addEventListener('change', function () { state.sort = sort.value; load(true); });
  const retry = document.getElementById('wl-retry');
  if (retry) retry.addEventListener('click', function () { load(true); });
  const clear = document.getElementById('wl-clear');
  if (clear) clear.addEventListener('click', function () { state.q = ''; state.type = ''; load(true); });
  const emptyNew = document.getElementById('wl-empty-new');
  if (emptyNew) emptyNew.addEventListener('click', openNewModal);
  const prev = document.getElementById('wl-prev');
  if (prev) prev.addEventListener('click', function () { state.offset = Math.max(0, state.offset - state.limit); load(false); });
  const next = document.getElementById('wl-next');
  if (next) next.addEventListener('click', function () { state.offset += state.limit; load(false); });

  body.querySelectorAll('.seg button[data-view]').forEach(function (el) {
    el.addEventListener('click', function () {
      state.view = el.getAttribute('data-view');
      DF.lsSet(LS_VIEW_KEY, state.view);
      renderBody();
    });
  });
  body.querySelectorAll('[data-act="edit"]').forEach(function (el) {
    el.addEventListener('click', function () {
      location.href = 'workflow-editor.html?id=' + encodeURIComponent(el.getAttribute('data-id'));
    });
  });
  body.querySelectorAll('[data-act="more"]').forEach(function (el) {
    el.addEventListener('click', function (event) {
      event.stopPropagation();
      const w = state.items.find(function (x) { return x.id === el.getAttribute('data-id'); });
      if (w) openMoreMenu(event, w);
    });
  });
}

function openMoreMenu(event, w) {
  DF.menu([
    { label: '编辑信息', icon: 'edit', onClick: function () { openEditModal(w); } },
    { label: '复制', icon: 'copy', onClick: function () { copyWorkflow(w); } },
    { label: '导出 JSON', icon: 'download', onClick: function () { exportWorkflow(w, 'json'); } },
    { label: '导出 YAML', icon: 'download', onClick: function () { exportWorkflow(w, 'yaml'); } },
    { label: '删除', icon: 'trash', danger: true, onClick: function () { removeWorkflow(w); } }
  ], event.clientX, event.clientY);
}

async function copyWorkflow(w) {
  try {
    const result = await data.copy(w.id, { name: w.name + ' 副本' });
    if (result.warnings && result.warnings.length) toast('已复制，存在 ' + result.warnings.length + ' 条警告', 'warn');
    await data.get(result.id);
    location.href = 'workflow-editor.html?id=' + encodeURIComponent(result.id);
  } catch (err) {
    toast(errorText(err), 'err');
  }
}

async function exportWorkflow(w, format) {
  try {
    const file = await data.exportDsl(w.id, format);
    DF.download(file.filename, file.text, file.contentType);
    toast('已导出 ' + format.toUpperCase(), 'ok');
  } catch (err) {
    toast(errorText(err), 'err');
  }
}

function openEditModal(w) {
  DF.modal.form({
    title: '编辑工作流信息',
    width: 500,
    body:
      DF.field('名称', '<input class="inp" id="wl-ef-name" maxlength="80" value="' + esc(w.name) + '">', { required: true }) +
      DF.field('类型', '<input class="inp" id="wl-ef-type" maxlength="40" value="' + esc(w.type) + '">', { required: true }) +
      DF.field('描述', '<textarea class="inp" id="wl-ef-desc" rows="3" maxlength="500">' + esc(w.description || '') + '</textarea>') +
      '<div class="hint">保存带 If-Match（当前 r' + w.revision + '）；冲突时不会覆盖。</div>',
    okText: '保存',
    onOk: async function (modalBody, close) {
      const name = modalBody.querySelector('#wl-ef-name').value.trim();
      const type = modalBody.querySelector('#wl-ef-type').value.trim();
      const description = modalBody.querySelector('#wl-ef-desc').value;
      if (!name || !type) { toast('名称与类型不能为空', 'warn'); return; }
      try {
        await data.update(w.id, w.revision, { name: name, type: type, description: description });
        close();
        toast('已保存工作流信息', 'ok');
        load(false);
      } catch (err) {
        toast(errorText(err), 'err');
      }
    }
  });
}

function removeWorkflow(w) {
  DF.modal.confirm({
    title: '删除工作流',
    danger: true,
    okText: '删除',
    html: '确定删除 <b>' + esc(w.name) + '</b>（r' + w.revision + '）？<br>删除后不可恢复；不会自动迁移旧图。'
  }).then(async function (ok) {
    if (!ok) return;
    try {
      await data.remove(w.id, w.revision);
      toast('已删除「' + w.name + '」', 'ok');
      load(false);
    } catch (err) {
      toast(errorText(err), 'err');
    }
  });
}

function openNewModal() {
  const expertOptions = state.experts.length
    ? state.experts.map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.name) + (e.enabled === false ? '（已停用）' : '') + '</option>';
    }).join('')
    : '<option value="">（未加载到专家，请检查 B1）</option>';
  const templateOptions = state.items.length
    ? '<option value="">不复制，创建空白最小流程</option>' + state.items.map(function (w) {
      return '<option value="' + esc(w.id) + '">' + esc(w.name) + '（' + w.nodeCount + ' 节点）</option>';
    }).join('')
    : '<option value="">（暂无可复制工作流）</option>';
  const defaultType = state.types[0] || '专项子流程';

  DF.modal.form({
    title: '新建工作流',
    width: 560,
    body:
      DF.field('名称', '<input class="inp" id="wl-nf-name" maxlength="80" placeholder="如：清算规则分析子流程">', { required: true }) +
      DF.field('类型', '<input class="inp" id="wl-nf-type" maxlength="40" list="wl-nf-types" value="' + esc(defaultType) + '">' +
        '<datalist id="wl-nf-types">' + state.types.map(function (t) { return '<option value="' + esc(t) + '"></option>'; }).join('') + '</datalist>', { required: true }) +
      DF.field('描述', '<textarea class="inp" id="wl-nf-desc" rows="2" maxlength="500" placeholder="一句话说明用途"></textarea>') +
      DF.field('起始专家', '<select class="inp" id="wl-nf-start">' + expertOptions + '</select>', { required: true, hint: 'start 节点必须绑定专家；可与结束专家相同' }) +
      DF.field('结束专家', '<select class="inp" id="wl-nf-end">' + expertOptions + '</select>', { required: true, hint: 'end 节点必须绑定专家' }) +
      DF.field('从现有工作流复制', '<select class="inp" id="wl-nf-template">' + templateOptions + '</select>', { hint: '复制由 B3 生成合法副本；不选则创建最小 start→end 图' }),
    okText: '创建并进入编辑器',
    onMount: function (modalBody) {
      const start = modalBody.querySelector('#wl-nf-start');
      const end = modalBody.querySelector('#wl-nf-end');
      if (start && end) end.value = start.value;
    },
    onOk: async function (modalBody, close) {
      const name = modalBody.querySelector('#wl-nf-name').value.trim();
      const type = modalBody.querySelector('#wl-nf-type').value.trim();
      const description = modalBody.querySelector('#wl-nf-desc').value;
      const startExpert = modalBody.querySelector('#wl-nf-start').value;
      const endExpert = modalBody.querySelector('#wl-nf-end').value;
      const template = modalBody.querySelector('#wl-nf-template').value;
      if (!name || !type) { toast('名称与类型不能为空', 'warn'); return; }
      try {
        let result;
        if (template) {
          result = await data.copy(template, { name: name });
        } else {
          if (!startExpert || !endExpert) { toast('请选择起始与结束专家', 'warn'); return; }
          result = await data.create({
            name: name,
            type: type,
            description: description,
            graph: minimalGraph(startExpert, endExpert)
          });
        }
        await data.get(result.id);
        close();
        if (result.warnings && result.warnings.length) toast('创建成功，存在 ' + result.warnings.length + ' 条警告', 'warn');
        location.href = 'workflow-editor.html?id=' + encodeURIComponent(result.id);
      } catch (err) {
        if (err.issues && err.issues.length) {
          toast(err.issues.map(function (i) { return i.path + '：' + i.message; }).join('；'), 'err');
        } else {
          toast(errorText(err), 'err');
        }
      }
    }
  });
}

function openImportPicker() {
  let input = document.getElementById('wl-import-file');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'wl-import-file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
  }
  input.value = '';
  input.onchange = async function () {
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const result = await data.importDsl(text);
      showImportResult(result);
    } catch (err) {
      if (err.issues && err.issues.length) {
        toast(err.issues.map(function (i) { return i.path + '：' + i.message; }).join('；'), 'err');
      } else {
        toast(errorText(err), 'err');
      }
    }
  };
  input.click();
}

function showImportResult(result) {
  const warnings = (result.warnings || []).map(function (w) {
    return '<li>' + esc(w.path) + '：' + esc(w.message) + '</li>';
  }).join('');
  const idMap = Object.keys(result.idMap || {});
  const visibleMap = idMap.slice(0, 10).map(function (key) {
    return '<div class="mono">' + esc(key) + ' → ' + esc(result.idMap[key]) + '</div>';
  }).join('');
  DF.modal.open({
    title: '导入结果',
    width: 560,
    body: '<div id="wl-import-result">' +
      '<p>已导入 <b>' + esc(result.workflow && result.workflow.name || '工作流') + '</b>（r' + (result.workflow ? result.workflow.revision : '—') + '）。</p>' +
      (warnings ? '<div class="warn-box"><b>未绑定/停用警告</b><ul>' + warnings + '</ul></div>' : '<p class="sub">没有警告。</p>') +
      '<div class="sub">ID 映射（' + idMap.length + ' 项）</div>' + (visibleMap || '<div class="sub">恒等映射为空。</div>') +
      '</div>',
    footer: '<button class="btn" id="wl-import-close">关闭</button>' +
      '<button class="btn primary" id="wl-import-open">进入编辑器补绑</button>',
    onMount: function (modalBody, close) {
      const root = modalBody.closest('.modal');
      root.querySelector('#wl-import-close').onclick = close;
      root.querySelector('#wl-import-open').onclick = function () {
        location.href = 'workflow-editor.html?id=' + encodeURIComponent(result.workflow.id);
      };
    }
  });
}

renderShellOnce();
load(true);
loadExperts();
