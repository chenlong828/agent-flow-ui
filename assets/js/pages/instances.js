/**
 * 运行实例列表（CMP-instances）
 *
 * 数据源：B4 运行编排 API-44 `GET /runs`；工作流名称取自 B3 列表。
 * 页面状态只保存 API DTO；不复用 MOCK，不建第二套视图模型。
 * 后端未提供的能力（暂停/恢复/节点重试/重跑）在这里不出现。
 */

import { DF } from '../ui.js';
import { request } from '../shared/http.js';
import { createWorkflowData } from '../workflow/data.js';
import { mountMarkdown, destroyMarkdown } from '../shared/markdown-editor.js';
import {
  createRunData,
  errorText,
  durationMs,
  RUN_STATE,
  RUN_OUTCOME,
  ARCHIVE_STATE,
  ACTIVE_STATES
} from '../run/data.js';

const { esc, icon, tag } = DF;
const runs = createRunData();
const workflows = createWorkflowData();

const TABS = ['全部', '进行中', '等待人工确认', '已结束'];
const TAB_STATE = {
  进行中: ['created', 'running'],
  等待人工确认: ['waiting_confirm'],
  已结束: ['done']
};

const DEFAULT_WORKSPACE_PATH = '/Users/chenlong/hundsun/af-workspace-demo';

const state = { runs: [], workflows: new Map(), loading: true, error: null, now: Date.now(), editor: null };

function currentTab() {
  const t = DF.qs('tab');
  return TABS.indexOf(t) >= 0 ? t : '全部';
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—';
}

function inTab(run, tab) {
  if (tab === '全部') return true;
  return (TAB_STATE[tab] || []).indexOf(run.state) >= 0;
}

function countOf(tab) {
  return state.runs.filter(function (r) { return inTab(r, tab); }).length;
}

function pendingCount() {
  return state.runs.filter(function (r) { return r.state === 'waiting_confirm'; }).length;
}

function wfOf(run) {
  return state.workflows.get(run.workflowId) || null;
}

function wfLabel(run) {
  const wf = wfOf(run);
  return wf ? wf.name : shortId(run.workflowId);
}

function fmtTime(iso) {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return DF.fmtClock(new Date(ms));
}

function fmtDuration(run) {
  const ms = durationMs(run, state.now);
  return ms == null ? '—' : DF.fmtDur(Math.round(ms / 1000));
}

function stateTag(run) {
  if (run.state === 'done') return tag(RUN_OUTCOME[run.outcome] || '已结束', run.outcome === 'succeeded' ? 'green' : run.outcome === 'cancelled' ? 'gray' : 'red');
  return tag(RUN_STATE[run.state] || run.state, run.state === 'waiting_confirm' ? 'orange' : run.state === 'running' ? 'blue' : 'gray');
}

/* ---------------- 载入 ---------------- */

async function load() {
  state.loading = true;
  state.error = null;
  render();
  const wfId = DF.qs('wfId');
  try {
    const [page, wfPage] = await Promise.all([
      runs.list({ limit: 200, workflowId: wfId || undefined }),
      workflows.list({ limit: 200 })
    ]);
    state.runs = page.items || [];
    state.workflows = new Map((wfPage.items || []).map(function (w) { return [w.id, w]; }));
    state.now = Date.now();
  } catch (err) {
    state.error = err;
  } finally {
    state.loading = false;
    render();
    syncBell();
  }
}

/* ---------------- 渲染 ---------------- */

function syncBell() {
  const bell = document.getElementById('df-bell');
  if (!bell) return;
  const n = pendingCount();
  bell.innerHTML = DF.icon('bell', 18) + (n ? '<span class="badge-count">' + n + '</span>' : '');
}

function render() {
  const body = document.getElementById('page-body');
  if (!body) return;
  if (state.loading) {
    body.innerHTML = '<div class="loading">正在加载运行实例…</div>';
    return;
  }
  if (state.error) {
    body.innerHTML = '<div class="empty"><div class="e-ic">⚠️</div>运行实例加载失败<br><span class="sub">' +
      esc(errorText(state.error)) + '</span><br><br><button class="btn primary" id="in-retry">重试</button></div>';
    document.getElementById('in-retry').onclick = load;
    return;
  }
  const tab = currentTab();
  const wfId = DF.qs('wfId');
  const list = state.runs.filter(function (r) { return inTab(r, tab); });
  body.innerHTML =
    DF.tabsHtml(TABS.map(function (t) { return { k: t, label: t, count: countOf(t) || null }; }), tab, 'data-t', 'id="in-tabs"') +
    (wfId ? '<div class="notice" style="margin-bottom:10px">正在筛选工作流「' + esc(wfLabel({ workflowId: wfId })) +
      '」的实例 <a href="instances.html" style="margin-left:8px">清除筛选</a></div>' : '') +
    DF.table(
      ['运行', '工作流 / 版本', '执行节点', '当前节点', '状态', '耗时', '开始时间', '操作'],
      list.length ? list.map(rowHTML) : ['<tr><td colspan="8"><div class="empty"><div class="e-ic">🗂</div>' +
        (state.runs.length ? '暂无该状态下的运行' : '还没有运行记录') +
        '<br><span class="sub">可从右上角「发起运行」启动一个工作流</span></div></td></tr>'],
      { wrapCls: 'in-list' }
    );

  document.getElementById('in-tabs').onclick = function (e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    location.href = 'instances.html?tab=' + encodeURIComponent(t.dataset.t);
  };
  body.querySelectorAll('[data-act]').forEach(function (btn) {
    btn.onclick = function () { doAction(btn.dataset.act, btn.dataset.id); };
  });
}

function rowHTML(run) {
  const wf = wfOf(run);
  const active = ACTIVE_STATES.indexOf(run.state) >= 0;
  const confirmable = run.state === 'waiting_confirm';
  let act = '<button class="btn sm" data-act="view" data-id="' + esc(run.runId) + '">详情</button>';
  if (confirmable) act += '<button class="btn sm" data-act="view" data-id="' + esc(run.runId) + '">' + icon('warn', 12) + '去确认</button>';
  if (active) act += '<button class="btn sm danger" data-act="stop" data-id="' + esc(run.runId) + '">' + icon('stop', 12) + '终止</button>';
  const archive = run.archiveState && run.archiveState !== 'none'
    ? '<div class="sub">' + esc(ARCHIVE_STATE[run.archiveState] || run.archiveState) + '</div>' : '';
  return '<tr' + (confirmable ? ' class="row-warn"' : '') + '>' +
    '<td><a class="rowlink" data-act="view" data-id="' + esc(run.runId) + '" href="javascript:void(0)" title="' + esc(run.runId) + '">' + esc(shortId(run.runId)) + '</a></td>' +
    '<td>' + esc(wfLabel(run)) + '<div class="sub">r' + esc(run.workflowRevision) + '</div></td>' +
    '<td>' + (run.clientId ? '<span class="mono">' + esc(run.clientId) + '</span>' : '<span class="sub">—</span>') + '</td>' +
    '<td>' + (run.currentNodeId ? '<span class="mono">' + esc(run.currentNodeId) + '</span>' : '<span class="sub">—</span>') +
      (confirmable ? '<div class="sub">等待人工确认</div>' : '') + '</td>' +
    '<td>' + stateTag(run) + archive + '</td>' +
    '<td>' + esc(fmtDuration(run)) + '</td>' +
    '<td class="sub">' + esc(fmtTime(run.startedAt)) + '</td>' +
    '<td style="white-space:nowrap">' + act + '</td></tr>';
}

/* ---------------- 操作 ---------------- */

function doAction(act, id) {
  if (act === 'view') { location.href = 'instance-detail.html?id=' + encodeURIComponent(id); return; }
  if (act === 'stop') stopRun(id);
}

function stopRun(id) {
  const run = state.runs.find(function (r) { return r.runId === id; });
  DF.modal.confirm({
    title: '终止运行',
    html: '终止后<b>正在执行的节点将被取消</b>，运行进入「已终止」终态，不可恢复。',
    danger: true,
    okText: '终止'
  }).then(function (ok) {
    if (!ok) return;
    runs.cancel(id).then(function () {
      DF.toast('运行已终止', 'warn');
      return load();
    }).catch(function (err) {
      DF.toast(errorText(err), 'err');
      return load();
    });
  });
}

/* ---------------- 发起运行 ---------------- */

async function openLaunch() {
  let wfList;
  let harnesses;
  try {
    const [wfPage, hPage] = await Promise.all([
      workflows.list({ limit: 200 }),
      request({ method: 'GET', path: '/api/v1/harnesses?limit=200' })
    ]);
    wfList = wfPage.items || [];
    harnesses = hPage.items || [];
  } catch (err) {
    DF.toast('无法加载工作流或 Harness：' + errorText(err), 'err');
    return;
  }
  if (!wfList.length) { DF.toast('还没有工作流，请先在编辑器创建', 'warn'); return; }

  const usable = harnesses.filter(function (h) { return h.enabled && h.clientId; });
  const options = harnesses.map(function (h) {
    const bound = Boolean(h.enabled && h.clientId);
    return '<option value="' + esc(h.id) + '"' + (bound ? '' : ' disabled') + '>' +
      esc(h.name) + '（' + esc(h.kind) + (h.clientId ? ' · ' + esc(h.clientId) : ' · 未绑定执行节点') + (h.enabled ? '' : ' · 已停用') + '）</option>';
  }).join('');

  DF.modal.form({
    title: '发起运行',
    width: 760,
    okText: '发起运行',
    okDisabled: !usable.length,
    body:
      DF.field('工作流',
        '<select class="inp" id="rn-wf">' + wfList.map(function (w) {
          return '<option value="' + esc(w.id) + '">' + esc(w.name) + '（r' + esc(w.revision) + ' · ' + esc(w.nodeCount) + ' 节点）</option>';
        }).join('') + '</select>',
        { required: true, hint: '启动时冻结当前图快照；split/fanout 节点暂不可执行' }) +
      DF.field('执行 Harness',
        '<select class="inp" id="rn-harness">' + options + '</select>',
        { required: true, hint: usable.length ? '只列出已绑定执行节点且启用的 Harness' : '没有可用的执行节点：请先在 Harness 详情登记 clientId 与凭据' }) +
      DF.field('工作区路径',
        '<input class="inp mono" id="rn-path" value="' + esc(DEFAULT_WORKSPACE_PATH) + '" placeholder="' + esc(DEFAULT_WORKSPACE_PATH) + '" autocomplete="off">',
        { required: true, hint: '执行节点上的绝对路径；同一 clientId + 路径已有实例时复用' }) +
      DF.field('启动意图（Markdown）',
        '<div class="rn-editor" id="rn-intent"></div>',
        { required: true, hint: '所见即所得编辑，保存后作为 intentMarkdown 传给 start 节点' }) +
      '<label class="rn-check"><input type="checkbox" id="rn-auto"> 自动通过人工确认节点（autoConfirm）</label>',
    onMount: function (body, close) {
      if (usable.length) document.getElementById('rn-harness').value = usable[0].id;
      state.editor = null;
      mountMarkdown(document.getElementById('rn-intent'), {
        markdown: '',
        editable: true,
        onChange: function (md) { state.intent = md; }
      }).then(function (handle) {
        state.editor = handle;
        if (handle && typeof handle.focus === 'function') handle.focus();
      }).catch(function (err) {
        const box = document.getElementById('rn-intent');
        if (box) box.innerHTML = '<div class="notice">编辑器初始化失败：' + esc(err && err.message ? err.message : '未知错误') + '</div>';
      });
    },
    onOk: function (body, close) {
      const wfId = body.querySelector('#rn-wf').value;
      const harnessId = body.querySelector('#rn-harness').value;
      const workspacePath = body.querySelector('#rn-path').value.trim();
      const autoConfirm = body.querySelector('#rn-auto').checked;
      const intentMarkdown = state.editor && typeof state.editor.getMarkdown === 'function'
        ? String(state.editor.getMarkdown() || '')
        : (state.intent != null ? String(state.intent) : '');
      if (!wfId) { DF.toast('请选择工作流', 'warn'); return; }
      if (!harnessId) { DF.toast('请选择已绑定执行节点的 Harness', 'warn'); return; }
      if (!workspacePath || workspacePath.charAt(0) !== '/') { DF.toast('工作区路径必须是绝对路径', 'warn'); return; }
      if (!intentMarkdown.trim()) { DF.toast('请填写启动意图', 'warn'); return; }
      const okBtn = body.closest('.modal').querySelector('.d-foot .btn.primary');
      if (okBtn) { okBtn.disabled = true; okBtn.textContent = '启动中…'; }
      runs.start(wfId, {
        harnessId: harnessId,
        workspacePath: workspacePath,
        intentMarkdown: intentMarkdown,
        autoConfirm: autoConfirm
      }).then(function (result) {
        closeRunModal(close);
        DF.toast('已发起运行 ' + shortId(result.runId), 'ok');
        state.now = Date.now();
        setTimeout(function () { location.href = 'instance-detail.html?id=' + encodeURIComponent(result.runId); }, 300);
      }).catch(function (err) {
        if (okBtn) { okBtn.disabled = false; okBtn.textContent = '发起运行'; }
        DF.toast(errorText(err), 'err');
      });
    },
    onClose: function () {
      if (state.editor) { destroyMarkdown(state.editor); state.editor = null; }
      state.intent = '';
    }
  });
}

function closeRunModal(close) {
  if (state.editor) { destroyMarkdown(state.editor); state.editor = null; }
  close();
}

/* ---------------- 启动 ---------------- */

function init() {
  DF.renderShell({
    pendingCount: pendingCount(),
    active: 'instances',
    breadcrumb: [{ label: '运行与运营' }, { label: '运行实例' }],
    title: '运行实例',
    subtitle: '工作流运行的实时状态：发起、查看、终止与人工确认',
    actions: '<button class="btn primary" id="in-launch">' + icon('play', 14) + '发起运行</button>'
  });
  document.getElementById('in-launch').onclick = openLaunch;
  load();
}

init();
