/**
 * 运行实例详情（docs/09 §3）— 只读流程轨迹图 + 节点详情面板 + 人工确认 + fan-out 子任务下钻
 */

import { DF } from '../ui.js';
import { MOCK } from '../mock-data.js';

  const { esc, icon, tag, dot } = DF;
  const NODE_W = 168, NODE_H = 58;

  const TYPE_CN = { start: '开始', end: '结束', agent: '专家执行节点', review: '评审/校验节点', confirm: '人工确认节点', fanout: 'fan-out 网关', fanin: 'fan-in 网关' };
  const ST_CLASS = { ok: 'st-ok', running: 'st-run', wait: 'st-wait', fail: 'st-fail', rollback: 'st-rollback', paused: 'st-paused', pending: 'st-pending', skip: 'st-skip' };
  const ST_LABEL = { ok: '成功', running: '运行中', wait: '等待人工确认', fail: '失败', rollback: '触发回退', paused: '已暂停', pending: '待执行', skip: '已跳过' };

  const state = { inst: null, wf: null, selId: null, tab: 'summary', fanPage: 1 };

  /* ---------------- 载入 ---------------- */
  function init() {
    let id = DF.qs('id');
    let inst = MOCK.byId(MOCK.instances, id);
    if (!inst && id && id.indexOf('INS-NEW') === 0) {
      const raw = DF.ssGet('df-new-instance');
      if (raw) { try { inst = JSON.parse(raw); MOCK.instances.unshift(inst); } catch (e) {} }
    }
    if (!inst) {
      const body = DF.renderShell({
      pendingCount: (MOCK.instances || []).filter(i => i.status === '等待人工确认').length,
        active: 'instances', breadcrumb: [{ label: '运行与运营' }, { label: '运行实例', href: 'instances.html' }, { label: '实例详情' }],
        title: '实例详情', subtitle: ''
      });
      body.innerHTML = DF.empty({
        icon: '🗂',
        html: '未找到该实例<br><br>',
        style: 'background:var(--c-panel);border:1px solid var(--c-line);border-radius:8px',
        action: { id: 'id-back', label: '← 返回实例列表' }
      });
      document.getElementById('id-back').onclick = () => { location.href = 'instances.html'; };
      return;
    }
    state.inst = inst;
    state.wf = MOCK.byId(MOCK.workflows, inst.wfId) || MOCK.workflows[0];
    // 默认选中当前节点
    state.selId = (inst.progress && inst.progress.active) || null;
    renderShell();
    renderTrace();
    renderPanel();
    // 当前节点滚入视野
    setTimeout(() => {
      const el = document.querySelector('.cv-node.st-run,.cv-node.st-wait,.cv-node.sel');
      if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, 120);
  }

  function renderShell() {
    const i = state.inst;
    const canPause = i.status === '运行中' || i.status === '回退重跑中';
    const canResume = i.status === '已暂停';
    const canStop = ['运行中', '回退重跑中', '已暂停', '等待人工确认'].includes(i.status);
    DF.renderShell({
      pendingCount: (MOCK.instances || []).filter(i => i.status === '等待人工确认').length,
      active: 'instances',
      breadcrumb: [{ label: '运行与运营' }, { label: '运行实例', href: 'instances.html' }, { label: i.id }],
      title: i.id + ' · ' + state.wf.name + ' ' + i.ver,
      subtitle: (i.remark ? i.remark + ' · ' : '') + '触发方式：手动 · 工作区：' + wsName(i.workspaceId),
      actions:
        tag(i.status) + '<span class="sub" style="margin:0 10px">耗时 ' + DF.fmtDur(i.durationS) + '</span>' +
        (canPause ? '<button class="btn" id="id-pause">' + icon('pause', 14) + '暂停</button>' : '') +
        (canResume ? '<button class="btn" id="id-resume">' + icon('play', 14) + '恢复</button>' : '') +
        (canStop ? '<button class="btn danger" id="id-stop">' + icon('stop', 14) + '终止</button>' : '') +
        '<button class="btn" id="id-rerun" disabled title="在轨迹图中选择一个历史节点后可用">' + icon('retry', 14) + '从节点重跑</button>'
    });
    const p = document.getElementById('id-pause');
    if (p) p.onclick = () => DF.modal.confirm({ title: '暂停实例', message: '运行中节点将冻结，可随时恢复。', okText: '暂停' }).then(ok => { if (ok) { setAllRunningPaused(); i.status = '已暂停'; DF.toast('已暂停', 'ok'); init(); } });
    const r = document.getElementById('id-resume');
    if (r) r.onclick = () => { i.status = '运行中'; Object.values(i.nodes).forEach(nd => { if (nd.status === 'paused') nd.status = 'running'; }); DF.toast('已恢复运行', 'ok'); init(); };
    const s = document.getElementById('id-stop');
    if (s) s.onclick = () => DF.modal.confirm({ title: '终止实例', html: '终止后<b>进行中的子任务将被取消</b>。', danger: true, okText: '终止' }).then(ok => {
      if (!ok) return;
      i.status = '已终止';
      Object.values(i.nodes).forEach(nd => { if (nd.status === 'running' || nd.status === 'paused' || nd.status === 'wait') nd.status = 'fail'; });
      DF.toast('实例已终止', 'warn'); init();
    });
  }

  function setAllRunningPaused() { Object.values(state.inst.nodes).forEach(nd => { if (nd.status === 'running') nd.status = 'paused'; }); }
  function wsName(id) { const w = MOCK.byId(MOCK.workspaces, id); return w ? w.name : '—'; }
  function expertOf(nodeDef) {
    const eid = nodeDef && nodeDef.expertId;
    const ex = eid && MOCK.byId(MOCK.experts, eid);
    return ex || null;
  }
  function harnessName(nodeDef) {
    const h = nodeDef && nodeDef.harness;
    if (h && h.mode === 'manual' && h.id) { const x = MOCK.byId(MOCK.harnesses, h.id); return x ? x.name : '—'; }
    return '按标签自动分配';
  }

  /* ---------------- 只读轨迹图 ---------------- */
  function renderTrace() {
    const body = document.getElementById('page-body');
    const g = state.wf.graph;
    body.innerHTML =
      '<div class="id-layout">' +
        '<div class="id-trace"><div class="cv-wrap" id="cvWrap">' +
          '<div class="cv-canvas" id="cvCanvas"></div></div>' +
          '<div class="cv-legend">' +
            '<b>' + dot('green') + '成功</b><b>' + dot('blue') + '运行中</b><b>' + dot('orange') + '等待人工</b><b>' + dot('red') + '失败</b><b>' + dot('purple') + '触发回退</b><b>' + dot('gray') + '待执行/已跳过</b>' +
            '<b>点击节点查看右侧详情</b></div>' +
        '</div>' +
        '<div class="id-panel" id="id-panel"></div>' +
      '</div>';
    paint();
    document.getElementById('cvCanvas').addEventListener('click', e => {
      const n = e.target.closest('.cv-node');
      state.selId = n ? n.dataset.node : null;
      if (state.selId) {
        const nd = state.inst.nodes[state.selId];
        if (nd && (nd.status === 'ok' || nd.status === 'skip')) document.getElementById('id-rerun').disabled = false;
        else document.getElementById('id-rerun').disabled = true;
      } else document.getElementById('id-rerun').disabled = true;
      paint(); renderPanel();
    });
    const rb = document.getElementById('id-rerun');
    rb.onclick = () => {
      if (rb.disabled || !state.selId) return;
      DF.modal.confirm({ title: '从节点重跑', html: '将从「<b>' + esc(gnodeName(state.selId)) + '</b>」重新执行，<b>该节点之后的结果将作废</b>。', okText: '重跑' }).then(ok => {
        if (ok) DF.toast('已发起重跑（演示）', 'ok');
      });
    };
  }

  function gnodeName(nid) {
    const n = state.wf.graph.nodes.find(x => x.id === nid);
    return n ? n.name : nid;
  }

  function paint() {
    const g = state.wf.graph;
    const c = document.getElementById('cvCanvas');
    c.style.width = g.w + 'px'; c.style.height = g.h + 'px';
    c.innerHTML = stagesHTML() + edgesHTML() + nodesHTML();
  }

  function stagesHTML() {
    const g = state.wf.graph;
    return (g.stages || []).map(s => {
      const b = g.stageBoxes && g.stageBoxes[s.id];
      if (!b) return '';
      return '<div class="cv-stage" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px">' +
        '<span class="stage-label">' + esc(s.name) + '<span class="stage-note">' + esc(s.note || '') + '</span></span></div>';
    }).join('');
  }

  function nodeStatus(nid) {
    const nd = state.inst.nodes[nid];
    return nd ? nd.status : 'pending';
  }

  function nodesHTML() {
    const g = state.wf.graph;
    return g.nodes.map(n => {
      const st = nodeStatus(n.id);
      const meta = st === 'paused' ? { cls: 'st-paused' } : { cls: ST_CLASS[st] || 'st-pending' };
      const ex = expertOf(n);
      const nd = state.inst.nodes[n.id];
      const sel = state.selId === n.id;
      let sub = ST_LABEL[st] || '';
      if (nd && nd.durS != null && ['ok', 'fail', 'rollback'].includes(st)) sub += ' · ' + DF.fmtDur(nd.durS);
      if (st === 'pending' || st === 'skip') sub = ST_LABEL[st];
      const tcls = n.type === 'agent' ? 't-agent' : n.type === 'review' ? 't-review' : n.type === 'confirm' ? 't-confirm' : (n.type === 'fanout' || n.type === 'fanin') ? 't-gateway' : 't-plain';
      return '<div class="cv-node ' + tcls + ' ' + meta.cls + (sel ? ' sel' : '') + '" data-node="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px;cursor:pointer">' +
        '<div class="n-head"><span class="e-dot" style="background:' + (ex ? ex.color : '#94a3b8') + '"></span>' + esc(n.name) + '</div>' +
        '<div class="n-sub">' + esc(sub) + '</div>' +
        (ex ? '<div class="n-expert">' + icon('user', 10) + esc(ex.name) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function edgesHTML() {
    const g = state.wf.graph;
    let out = '';
    g.edges.forEach(e => {
      const a = g.nodes.find(n => n.id === e.from), b = g.nodes.find(n => n.id === e.to);
      if (!a || !b) return;
      const dimA = ['pending', 'skip'].includes(nodeStatus(a.id));
      const cls = (e.kind === 'rollback' ? 'e-rb' : e.kind === 'par' ? 'e-par' : 'e-seq') + (dimA ? ' e-dim' : '');
      let d, label = '';
      if (e.kind === 'rollback') {
        const s = { x: a.x + NODE_W - 22, y: a.y + NODE_H }, t = { x: b.x + NODE_W / 2, y: b.y + NODE_H };
        const sag = Math.max(70, Math.abs(s.y - t.y) * 0.2 + 60);
        d = 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + sag) + ', ' + (t.x - 40) + ' ' + (t.y + sag) + ', ' + t.x + ' ' + t.y;
        const nd = state.inst.nodes[a.id];
        const round = nd && nd.review && nd.review.round ? nd.review.round : 1;
        label = '<text class="edge-label" x="' + (a.x + NODE_W / 2) + '" y="' + (Math.max(a.y, b.y) + NODE_H + 24) + '" text-anchor="middle">↺ 回退×' + round + '</text>';
      } else {
        const s = { x: a.x + NODE_W, y: a.y + 29 }, t = { x: b.x, y: b.y + 29 };
        const dx = Math.max(40, Math.abs(t.x - s.x) / 2);
        d = 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + dx) + ' ' + s.y + ', ' + (t.x - dx) + ' ' + t.y + ', ' + t.x + ' ' + t.y;
      }
      out += '<path class="' + cls + '" d="' + d + '"/>' + label;
    });
    return '<svg class="cv-edges" width="' + g.w + '" height="' + g.h + '">' + out + '</svg>';
  }

  /* ---------------- 右侧节点面板 ---------------- */
  function renderPanel() {
    const panel = document.getElementById('id-panel');
    const n = state.selId ? state.wf.graph.nodes.find(x => x.id === state.selId) : null;
    if (!n) {
      panel.innerHTML = '<div class="card" style="padding:16px;color:var(--t-3);flex:1">' + icon('panel') + ' 在左侧轨迹图中点击节点，查看输入输出、日志与工作区留痕。</div>';
      return;
    }
    const nd = state.inst.nodes[n.id] || {};
    // 人工确认挂起卡片置顶
    const confirmCard = (nd.status === 'wait' && nd.confirm) ? buildConfirmCard(n, nd) : '';
    panel.innerHTML = confirmCard +
      '<div class="id-tabs">' +
        [['summary', '概要'], ['io', '输入与输出'], ['logs', '执行日志'], ['trace', '工作区留痕']].map(t =>
          '<div class="tab' + (state.tab === t[0] ? ' active' : '') + '" data-t="' + t[0] + '">' + t[1] + '</div>').join('') +
      '</div>' +
      '<div class="id-body" id="id-body"></div>';
    panel.querySelector('.id-tabs').onclick = e => {
      const t = e.target.closest('.tab'); if (!t) return;
      state.tab = t.dataset.t; renderPanel();
    };
    const bodyEl = panel.querySelector('#id-body');
    if (nd.status === 'wait' && nd.confirm) { bodyEl.innerHTML = confirmSummary(n, nd); return; }
    if (state.tab === 'summary') bodyEl.innerHTML = tabSummary(n, nd);
    else if (state.tab === 'io') bodyEl.innerHTML = tabIO(n, nd);
    else if (state.tab === 'logs') { bodyEl.innerHTML = tabLogs(nd); bindLogFilter(bodyEl, nd); }
    else bodyEl.innerHTML = tabTrace(n, nd);
    // fanout 特殊面板
    if (n.type === 'fanout' && nd.fanout) { bodyEl.innerHTML = fanoutPanel(nd); bindFanout(bodyEl, nd); }
  }

  function tabSummary(n, nd) {
    const ex = expertOf(n);
    const st = nd.status || 'pending';
    let h = '<div class="id-node-h"><b>' + esc(n.name) + '</b>' + tag(TYPE_CN[n.type] || n.type, 'gray') + '</div>' +
      DF.kv([
        ['状态', tag(ST_LABEL[st] || st)],
        ['专家', ex ? '<span class="expert-dot" style="background:' + ex.color + ';width:16px;height:16px;font-size:9px;border-radius:4px">' + esc(ex.name[0]) + '</span> ' + esc(ex.name) : '—'],
        ['Harness', esc(harnessName(n))],
        ['开始时间', nd.startedM != null ? DF.fmtClock(DF.ts(nd.startedM)) : '—'],
        ['耗时', DF.fmtDur(nd.durS)],
        ['重试次数', String(nd.retries || 0)]
      ]);
    if (st === 'fail') h += '<div style="margin-top:10px"><button class="btn" id="id-retry">' + icon('retry', 12) + '重试节点</button></div>';
    if (['ok', 'skip', 'rollback'].includes(st)) h += '<div style="margin-top:10px"><button class="btn" id="id-rerun2">' + icon('retry', 12) + '从此节点重跑</button></div>';
    if (nd.review) {
      h += '<div class="section-title">评审结论 <span class="line"></span></div>' +
        DF.kv([
          ['轮次', '第 ' + nd.review.round + ' 轮'],
          ['判定', tag(nd.review.verdict)],
          ['评审意见', esc(nd.review.opinion)]
        ].concat(nd.review.target ? [['回退目标', esc(gnodeName(nd.review.target))]] : []));
    }
    if (nd.fanout) {
      h += '<div class="section-title">并行展开 <span class="line"></span></div><div class="sub">共 ' + nd.fanout.total.toLocaleString() + ' 个子任务，详见「输入与输出」上方面板</div>';
    }
    setTimeout(() => {
      const r1 = document.getElementById('id-retry'); if (r1) r1.onclick = () => DF.toast('已重试（演示）', 'ok');
      const r2 = document.getElementById('id-rerun2'); if (r2) r2.onclick = () => DF.modal.confirm({ title: '从节点重跑', html: '将从「<b>' + esc(n.name) + '</b>」重新执行，<b>该节点之后的结果将作废</b>。', okText: '重跑' }).then(ok => { if (ok) DF.toast('已发起重跑（演示）', 'ok'); });
    }, 0);
    return h;
  }

  function tabIO(n, nd) {
    const io = nd.io || {};
    const inRows = (io.in || []).map(x => '<tr><td class="mono ellipsis" style="max-width:220px">' + esc(x.path) + '</td><td class="sub">' + esc(x.note || '') + '</td></tr>');
    const outRows = (io.out || []).map(o =>
      '<tr><td class="mono ellipsis" style="max-width:220px">' + esc(o.path) + '</td><td class="sub">' + esc(o.note || '') + '</td>' +
      '<td>' + (o.files || []).map(f => '<div class="mono sub"><span style="color:var(--c-ok)">+' + f.add + '</span> <span style="color:var(--c-fail)">-' + f.del + '</span> ' + esc(f.f.split('/').pop()) + '</div>').join('') + '</td></tr>');
    return '<div class="section-title">输入（自工作区读取）<span class="line"></span></div>' +
      (inRows.length ? DF.table(null, inRows, { wrapStyle: 'box-shadow:none' }) : '<div class="sub" style="color:var(--t-3)">无输入记录</div>') +
      '<div class="section-title">输出（写入工作区）<span class="line"></span></div>' +
      (outRows.length ? DF.table(null, outRows, { wrapStyle: 'box-shadow:none' }) : '<div class="sub" style="color:var(--t-3)">暂无产物</div>');
  }

  function tabLogs(nd) {
    const logs = nd.logs || [];
    if (!logs.length) return '<div class="sub" style="color:var(--t-3)">暂无日志</div>';
    return '<div class="chips" id="lg-filter" style="margin-bottom:8px">' +
      ['全部', 'info', 'ok', 'warn', 'err'].map((lv, i) => '<span class="chip click' + (i === 0 ? '" style="background:#dbeafe;color:#1d4ed8' : '') + '" data-lv="' + lv + '">' + lv + '</span>').join('') + '</div>' +
      '<div class="log-view" id="lg-view">' + logs.map(logLine).join('') + '</div>';
  }
  function logLine(l) {
    const cls = l.lv === 'warn' ? 'lv-warn' : l.lv === 'err' ? 'lv-err' : l.lv === 'ok' ? 'lv-ok' : '';
    return '<div class="lg-row" data-lv="' + l.lv + '"><span class="t">' + esc(l.t) + '</span><span class="' + cls + '">' + esc(l.msg) + '</span></div>';
  }
  function bindLogFilter(box, nd) {
    box.querySelectorAll('#lg-filter .chip').forEach(ch => {
      ch.onclick = () => {
        box.querySelectorAll('#lg-filter .chip').forEach(x => { x.style.background = ''; x.style.color = ''; });
        ch.style.background = '#dbeafe'; ch.style.color = '#1d4ed8';
        const lv = ch.dataset.lv;
        box.querySelectorAll('.lg-row').forEach(r => { r.style.display = (lv === '全部' || r.dataset.lv === lv) ? '' : 'none'; });
      };
    });
  }

  function tabTrace(n, nd) {
    const files = [];
    ((nd.io || {}).out || []).forEach(o => (o.files || []).forEach(f => files.push(f)));
    if (!files.length) return '<div class="sub" style="color:var(--t-3)">该节点未产生工作区文件变更</div>';
    return '<div class="tree">' + files.map(f =>
      '<details open><summary>' + icon('file', 12) + ' ' + esc(f.f.split('/').slice(0, -1).join('/') || '/') + '</summary>' +
      '<div class="leaf">' + esc(f.f.split('/').pop()) + ' <span class="note"><span style="color:var(--c-ok)">+' + f.add + '</span> <span style="color:var(--c-fail)">-' + f.del + '</span></span></div>' +
      '</details>').join('') + '</div>' +
      '<div style="margin-top:10px"><a class="btn sm" href="workspace-detail.html?id=' + esc(state.inst.workspaceId) + '">打开工作区详情 →</a></div>';
  }

  /* ---------------- 人工确认 ---------------- */
  function miniMD(src) {
    const lines = esc(src).split('\n');
    let html = '', inList = false;
    lines.forEach(l => {
      if (/^##\s/.test(l)) { if (inList) { html += '</ul>'; inList = false; } html += '<h4>' + l.replace(/^##\s/, '') + '</h4>'; }
      else if (/^-\s/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + l.replace(/^-\s/, '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</li>'; }
      else if (/^\d+\.\s/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + l.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</li>'; }
      else { if (inList) { html += '</ul>'; inList = false; } if (l.trim()) html += '<p>' + l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>'; }
    });
    if (inList) html += '</ul>';
    return '<div class="md">' + html + '</div>';
  }

  function buildConfirmCard(n, nd) {
    const c = nd.confirm;
    return '<div class="id-confirm-card">' +
      '<h4>' + icon('warn', 14) + ' 待人工确认 · ' + esc(c.planTitle || n.name) + '</h4>' +
      miniMD(c.plan || '') +
      '<div class="sub" style="margin:6px 0 10px">方案原文：workspace:/' + esc(c.planPath || '') + '</div>' +
      '<input class="inp" id="cf-opinion" placeholder="审批意见（批准选填 / 驳回必填）" style="margin-bottom:8px">' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn primary" id="cf-ok">' + icon('check', 12) + '批准，继续执行</button>' +
        '<button class="btn danger" id="cf-no">' + icon('x', 12) + '驳回</button>' +
      '</div></div>';
  }

  function confirmSummary(n, nd) {
    const c = nd.confirm;
    return '<div class="id-node-h"><b>' + esc(n.name) + '</b>' + tag('人工确认节点', 'gray') + tag('等待人工确认', 'orange') + '</div>' +
      DF.kv([
        ['确认事项', esc(c.planTitle || '')],
        ['方案路径', '<span class="mono">workspace:/' + esc(c.planPath || '') + '</span>'],
        ['超时策略', esc(c.timeout === 'none' ? '不超时' : c.timeout)]
      ]) +
      '<div class="notice" style="margin-top:10px">批准后流程继续向下执行；驳回将回退到指定前序节点并携带您的意见。</div>';
  }

  function bindConfirm() {
    const ok = document.getElementById('cf-ok'), no = document.getElementById('cf-no');
    if (!ok) return;
    const n = state.wf.graph.nodes.find(x => state.inst.nodes[x.id] && state.inst.nodes[x.id].status === 'wait');
    const nd = state.inst.nodes[n.id];
    ok.onclick = () => {
      const op = document.getElementById('cf-opinion').value;
      nd.status = 'ok'; nd.durS = nd.durS || 120;
      state.inst.status = '运行中';
      const next = nextOf(n.id);
      if (next) { state.inst.nodes[next] = state.inst.nodes[next] || {}; state.inst.nodes[next].status = 'running'; state.inst.progress.active = next; }
      state.inst.progress.done = Math.min((state.inst.progress.done || 0) + 1, state.inst.progress.total);
      DF.toast('已批准，流程继续执行' + (op ? '（意见已留痕）' : ''), 'ok');
      state.selId = next || n.id; init();
    };
    no.onclick = () => {
      const op = document.getElementById('cf-opinion').value;
      if (!op) { DF.toast('驳回必须填写意见', 'err'); return; }
      const rbEdge = state.wf.graph.edges.find(e2 => e2.from === n.id && e2.kind === 'rollback');
      nd.status = 'rollback';
      state.inst.status = '回退重跑中';
      if (rbEdge) {
        const t = rbEdge.to;
        state.inst.nodes[t] = state.inst.nodes[t] || {};
        state.inst.nodes[t].status = 'running';
        state.inst.nodes[t].retries = (state.inst.nodes[t].retries || 0) + 1;
        state.inst.progress.active = t;
        state.selId = t;
      }
      DF.toast('已驳回，流程回退并携带意见', 'warn');
      init();
    };
  }
  function nextOf(nid) {
    const e = state.wf.graph.edges.find(x => x.from === nid && x.kind !== 'rollback');
    return e ? e.to : null;
  }

  /* ---------------- fan-out 面板 ---------------- */
  function fanoutPanel(nd) {
    const f = nd.fanout;
    const bs = f.byStatus || {};
    const pageSize = 10;
    const pages = Math.max(1, Math.ceil((f.sample || []).length / pageSize));
    if (state.fanPage > pages) state.fanPage = pages;
    const rows = (f.sample || []).slice((state.fanPage - 1) * pageSize, state.fanPage * pageSize);
    return '<div class="id-node-h"><b>并行子任务</b>' + tag('聚合视图', 'gray') + '</div>' +
      '<div class="sub" style="margin-bottom:10px">数千并行任务聚合视图 · 共 <b>' + f.total.toLocaleString() + '</b> 个 · 下方为抽样明细（' + (f.sample || []).length + ' 条）</div>' +
      '<div class="id-fan-cards">' +
        '<div class="fc"><div class="n">' + f.total.toLocaleString() + '</div><div class="l">总数</div></div>' +
        '<div class="fc"><div class="n" style="color:var(--c-ok)">' + (bs['成功'] || 0).toLocaleString() + '</div><div class="l">成功</div></div>' +
        '<div class="fc"><div class="n" style="color:var(--c-fail)">' + (bs['失败'] || 0) + '</div><div class="l">失败</div></div>' +
        '<div class="fc"><div class="n" style="color:var(--c-run)">' + (bs['运行中'] || 0) + '</div><div class="l">运行中</div></div>' +
        '<div class="fc"><div class="n" style="color:var(--c-wait)">' + (bs['重试中'] || 0) + '</div><div class="l">重试中</div></div>' +
      '</div>' +
      DF.table(
        ['子任务', '状态', '耗时'],
        rows.map(st => '<tr class="id-sub" data-st="' + st.id + '" style="cursor:pointer"><td class="mono">' + esc(st.id) + '</td><td>' + tag(st.status) + '</td><td>' + DF.fmtDur(st.durS) + '</td></tr>'),
        { wrapStyle: 'box-shadow:none' }
      ) +
      '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">' +
        '<button class="btn sm" id="fp-prev"' + (state.fanPage <= 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span class="sub">第 ' + state.fanPage + ' / ' + pages + ' 页 · 点击行查看子任务详情</span>' +
        '<button class="btn sm" id="fp-next"' + (state.fanPage >= pages ? ' disabled' : '') + '>下一页</button>' +
      '</div>';
  }
  function bindFanout(box, nd) {
    box.querySelector('#fp-prev').onclick = () => { state.fanPage--; renderPanel(); };
    box.querySelector('#fp-next').onclick = () => { state.fanPage++; renderPanel(); };
    box.querySelectorAll('[data-st]').forEach(tr => {
      tr.onclick = () => {
        const st = nd.fanout.sample.find(s2 => s2.id === tr.dataset.st);
        if (!st) return;
        const h = MOCK.byId(MOCK.harnesses, st.harness);
        DF.drawer.open({
          title: '子任务 ' + st.id,
          width: 560,
          body:
            DF.kv([
              ['状态', tag(st.status)],
              ['执行 Harness', esc(h ? h.name : st.harness) + (h ? '（' + h.type + '）' : '')],
              ['耗时', DF.fmtDur(st.durS)],
              ['输入', esc(st.input)],
              ['独立 worktree', '<span class="mono">' + esc(st.worktree) + '</span>']
            ], { style: 'margin-bottom:12px' }) +
            '<div class="notice">每个子任务拥有独立上下文与独立 worktree，经工作区与编排器交换信息。</div>' +
            '<div class="section-title">Patch 文件 <span class="line"></span></div>' +
            ((st.patchFiles || []).length ? st.patchFiles.map(f => '<div class="mono sub" style="margin-bottom:4px">' + esc(f.file) + ' <span style="color:var(--c-ok)">+' + f.add + '</span> <span style="color:var(--c-fail)">-' + f.del + '</span></div>').join('') : '<div class="sub" style="color:var(--t-3)">无 Patch（未产出修改）</div>') +
            '<div class="section-title">执行日志 <span class="line"></span></div>' +
            '<div class="log-view">' + (st.logs || []).map(logLine).join('') + '</div>'
        });
      };
    });
  }

  /* 确认按钮绑定（init 后） */
  const _origInit = init;
  init = function () { _origInit(); bindConfirm(); };

  init();
