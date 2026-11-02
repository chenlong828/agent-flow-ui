/**
 * AgentFlow 原型 · 工作区配置 · 详情页（独立二级页）
 * 规格: docs/design/components/workspaces/spec.md §4 详情页 / §5 状态与空态
 */

import { DF } from '../ui.js';
import { MOCK } from '../mock-data.js';
import { WSC } from './workspace-common.js';

  const $ = s => document.querySelector(s);
  const M = MOCK;

  /* ========== 取数：MOCK.workspaces 按 id；ws-new* 从 sessionStorage 合并 ========== */
  const id = DF.qs('id');
  let ws = M.byId(M.workspaces || [], id);
  if (!ws) { const nw = WSC.readNewWs(); if (nw && nw.id === id) ws = nw; }

  const title = ws ? ws.name : '工作区详情';
  const body = DF.renderShell({
      pendingCount: (MOCK.instances || []).filter(i => i.status === '等待人工确认').length,
    active: 'workspaces',
    breadcrumb: [{ label: '基础配置' }, { label: '工作区配置', href: 'workspaces.html' }, { label: title }],
    title: title,
    subtitle: ws ? (ws.desc || '') : '',
    actions: ws
      ? '<button class="btn" id="wd-recheck">' + DF.icon('refresh', 14) + '重新校验</button>' +
        '<button class="btn" id="wd-clean">' + DF.icon('trash', 14) + '立即清理</button>'
      : ''
  });

  if (!ws) {
    body.innerHTML =
      '<div class="card">' + DF.empty({
        icon: '🗂️',
        html: '<p>未找到该工作区（可能已被删除，或为其他会话新建的工作区）</p>',
        action: { id: 'wd-back', label: '返回工作区配置', style: 'margin-top:14px' }
      }) + '</div>';
    document.getElementById('wd-back').onclick = () => { location.href = 'workspaces.html'; };
  } else {

  /* ws-new* 记录的变更回写 sessionStorage，保证列表页联动可见（见 workspace-common.js） */
  function syncSession() { WSC.syncNewWs(ws); }

  /* MOCK.workspaces 无 createdAt 字段：按 id 确定性推导（ws-new 记录真实创建时间）—— 见 workspace-common.js */
  const createdText = WSC.createdText;

  /* ========== 目录结构（初始化模板，只读树）—— 见 workspace-common.js ========== */
  const treeHtml = WSC.treeHtml;

  /* ========== 渲染 ========== */
  function credInfo() {
    const key = ws.credId ? M.byId(M.keys || [], ws.credId) : null;
    return { key, status: key ? key.status : (ws.credStatus || '未校验') };
  }

  function render() {
    const cred = credInfo();
    const warn = ws.status === '校验失败'
      ? '<div class="notice warn">' + DF.icon('warn', 14) +
        '<span>仓库凭证校验失败，请检查访问凭证' +
        '<a href="javascript:void(0)" id="wd-goto-cred" style="margin-left:6px">前往凭证区块 →</a></span></div>'
      : '';

    const archives = ws.archives || [];
    const arcTable = archives.length
      ? DF.table(['实例', '大小', '归档时间'],
          archives.map(a =>
            '<tr><td class="mono">' + DF.esc(a.inst) + '</td><td>' + DF.fmtBytes(a.size) + '</td><td>' + DF.esc(a.at) + '</td></tr>'))
      : '<div class="empty" style="padding:26px">暂无归档记录</div>';

    body.innerHTML = warn +
      '<div class="wd-topline"><a class="btn sm" href="workspaces.html">← 返回</a>' + DF.tag(ws.status) +
        '<span class="sub">最近活动 ' + DF.relTime(ws.lastActivityM) + '</span>' +
      '</div>' +

      /* ① 基本信息 */
      '<div class="card wd-block"><div class="card-h">① 基本信息</div><div class="card-b"><div class="kv">' +
        '<span class="k">名称</span><span>' + DF.esc(ws.name) + '</span>' +
        '<span class="k">描述</span><span>' + DF.esc(ws.desc || '—') + '</span>' +
        '<span class="k">仓库</span><span class="mono">' + DF.esc(ws.repo) + '</span>' +
        '<span class="k">默认分支</span><span class="mono">' + DF.esc(ws.branch) + '</span>' +
        '<span class="k">创建时间</span><span>' + DF.esc(createdText(ws)) + '</span>' +
        '<span class="k">状态</span><span>' + DF.tag(ws.status) + '</span>' +
      '</div></div></div>' +

      /* ② 分支与 Worktree 策略 */
      '<div class="card wd-block"><div class="card-h">② 分支与 Worktree 策略</div><div class="card-b">' +
        '<div class="wd-frow"><label>主工作区分支</label><span class="mono">' + DF.esc(ws.branch) + '</span></div>' +
        '<div class="wd-frow"><label>子任务 worktree 命名模板</label>' +
          '<span><input class="inp mono" id="wd-wt" style="max-width:360px" value="' + DF.esc(ws.worktreeTemplate || '') + '"></span>' +
          '<div class="hint">可用变量 {instanceId} {seq}</div></div>' +
        '<div class="wd-frow"><label>自动清理</label><span style="display:flex;align-items:center;gap:10px">' +
          '<label class="switch"><input type="checkbox" id="wd-clean-sw"' + (ws.autoClean ? ' checked' : '') + '><i></i></label>' +
          '<span style="font-size:12px;color:var(--t-2)">运行结束后自动清理 worktree，保留 ' +
            '<input type="number" class="inp inp-sm" id="wd-days" min="1" max="90" value="' + (ws.retainDays || 7) + '" style="width:64px"> 天</span>' +
        '</span></div>' +
        '<button class="btn primary" id="wd-save-policy">保存策略</button>' +
      '</div></div>' +

      /* ③ 目录结构 + ④ 访问凭证 */
      '<div class="wd-grid2">' +
        '<div class="card"><div class="card-h">③ 目录结构（初始化模板）' +
          '<span class="wd-card-h-btn"><button class="btn sm" id="wd-reinit">重新初始化模板</button></span></div>' +
          '<div class="card-b">' + treeHtml() + '</div></div>' +
        '<div class="card" id="wd-sec-cred"><div class="card-h">④ 访问凭证</div><div class="card-b">' +
          '<div class="kv">' +
            '<span class="k">关联 Key</span><span>' +
              (cred.key
                ? DF.esc(cred.key.name) + '<span class="wd-kv-mask">' + DF.esc(cred.key.mask || '') + '</span>'
                : '<span style="color:var(--t-3)">未关联</span>') + '</span>' +
            '<span class="k">凭证状态</span><span>' + DF.tag(cred.status) + '</span>' +
            '<span class="k">最后校验</span><span>' + DF.relTime(cred.key ? cred.key.lastCheckedM : null) + '</span>' +
          '</div>' +
          '<button class="btn sm" id="wd-recheck2" style="margin-top:14px">重新校验</button>' +
        '</div></div>' +
      '</div>' +

      /* ⑤ 清理与归档 */
      '<div class="card"><div class="card-h">⑤ 清理与归档' +
        '<span class="wd-card-h-btn"><button class="btn sm" id="wd-clean2">立即清理</button></span></div>' +
        '<div class="card-b">' +
          '<div class="wd-policy" id="wd-policy">归档策略：运行结束保留 <b>' + (ws.retainDays || 7) + '</b> 天后自动归档</div>' +
          arcTable +
        '</div></div>';

    /* ---- 事件绑定 ---- */
    const goto = $('#wd-goto-cred');
    if (goto) goto.onclick = scrollToCred;
    $('#wd-recheck').onclick = recheck;
    $('#wd-recheck2').onclick = recheck;
    $('#wd-clean').onclick = cleanNow;
    $('#wd-clean2').onclick = cleanNow;
    $('#wd-save-policy').onclick = savePolicy;
    $('#wd-reinit').onclick = reinitTpl;
  }

  function scrollToCred() {
    const sec = document.getElementById('wd-sec-cred');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ========== 重新校验（头部与④区块共用） ========== */
  function recheck() {
    scrollToCred();
    setTimeout(() => {
      const cred = credInfo();
      if (cred.key && cred.key.status === '有效') {
        cred.key.lastCheckedM = 0;
        ws.credStatus = '有效';
        if (ws.status === '校验失败') ws.status = '已初始化';
        syncSession();
        DF.toast('凭证校验通过', 'ok');
        render();
      } else {
        DF.toast(!cred.key ? '未关联凭证，无法校验' : '凭证校验失败：「' + cred.key.name + '」状态为 ' + cred.key.status, 'err');
      }
    }, 500);
  }

  /* ========== 立即清理（头部与⑤区块共用） ========== */
  async function cleanNow() {
    const ok = await DF.modal.confirm({
      title: '立即清理',
      message: '将清理所有已完成任务的 worktree 与临时产物',
      danger: true,
      okText: '确认清理'
    });
    if (!ok) return;
    const d = new Date();
    ws.archives = ws.archives || [];
    ws.archives.unshift({ inst: 'INS-2042', size: 132 * 1048576, at: d.getFullYear() + '-' + WSC.pad(d.getMonth() + 1) + '-' + WSC.pad(d.getDate()) });
    syncSession();
    DF.toast('清理完成，worktree 与临时产物已归档', 'ok');
    render();
  }

  /* ========== 保存策略 ========== */
  function savePolicy() {
    ws.worktreeTemplate = $('#wd-wt').value.trim() || ws.worktreeTemplate;
    ws.autoClean = $('#wd-clean-sw').checked;
    ws.retainDays = Math.max(1, parseInt($('#wd-days').value, 10) || 7);
    syncSession();
    DF.toast('已保存，对新实例生效', 'ok');
    render();
  }

  /* ========== 重新初始化模板 ========== */
  async function reinitTpl() {
    const ok = await DF.modal.confirm({
      title: '重新初始化目录模板',
      html: '将按当前模板重建工作区目录结构，<b>不会删除任务数据</b>。',
      okText: '重新初始化'
    });
    if (ok) DF.toast('目录模板已重新初始化', 'ok');
  }

  render();
  }
