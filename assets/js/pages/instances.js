/**
 * 运行实例列表（docs/09 §2）
 */
(function () {
  'use strict';
  const { esc, icon, tag } = DF;

  const TABS = ['全部', '运行中', '等待人工确认', '回退重跑中', '已暂停', '已结束'];
  const ENDED = ['成功', '失败', '已终止'];

  function init() {
    const body = DF.renderShell({
      active: 'instances',
      breadcrumb: [{ label: '运行与运营' }, { label: '运行实例' }],
      title: '运行实例',
      subtitle: '运行中工作流的查看与控制：终止、暂停恢复、节点重跑、留痕查看',
      actions: '<button class="btn primary" id="in-launch">' + icon('play', 14) + '发起运行</button>'
    });
    document.getElementById('in-launch').onclick = openLaunch;
    render();
  }

  function currentTab() {
    const t = DF.qs('tab');
    if (t && TABS.includes(t)) return t;
    return '全部';
  }
  function countOf(st) {
    return MOCK.instances.filter(i => st === '已结束' ? ENDED.includes(i.status) : i.status === st).length;
  }
  function wfName(id) { const w = MOCK.byId(MOCK.workflows, id); return w ? w.name : id; }
  function nodeName(inst, nid) {
    const w = MOCK.byId(MOCK.workflows, inst.wfId);
    if (!w || !w.graph) return nid || '—';
    const n = w.graph.nodes.find(x => x.id === nid);
    return n ? n.name : (nid || '—');
  }

  function render() {
    const body = document.getElementById('page-body');
    const tab = currentTab();
    const wfFilter = DF.qs('wfId'); // 来自工作流列表卡片「最近运行」
    let list = MOCK.instances.filter(i => tab === '全部' ? true : tab === '已结束' ? ENDED.includes(i.status) : i.status === tab);
    if (wfFilter) list = list.filter(i => i.wfId === wfFilter);
    list = list.sort((a, b) => a.startedM - b.startedM);
    body.innerHTML =
      DF.tabsHtml(
        TABS.map(t => ({ k: t, label: t, count: countOf(t) || null })),
        tab, 'data-t', 'id="in-tabs"'
      ) +
      (wfFilter ? '<div class="notice" style="margin-bottom:10px">正在筛选工作流「' + esc(wfName(wfFilter)) + '」的实例 <a href="instances.html" style="margin-left:8px">清除筛选</a></div>' : '') +
      DF.table(
        ['实例 ID', '工作流 / 版本', '触发', '当前节点', { t: '进度', s: 'style="min-width:150px"' }, '状态', '耗时', '开始时间', '操作'],
        list.length
          ? list.map(rowHTML)
          : ['<tr><td colspan="9"><div class="empty"><div class="e-ic">🗂</div>暂无该状态下的实例<br><span class="sub">可从工作流列表或右上角发起运行</span></div></td></tr>'],
        { wrapCls: 'in-list' }
      );

    document.getElementById('in-tabs').onclick = e => {
      const t = e.target.closest('.tab'); if (!t) return;
      location.href = 'instances.html?tab=' + encodeURIComponent(t.dataset.t);
    };
    body.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = () => doAction(btn.dataset.act, btn.dataset.id);
    });
    body.querySelectorAll('[data-open]').forEach(a => { a.onclick = () => { location.href = 'instance-detail.html?id=' + a.dataset.open; }; });
  }

  function rowHTML(i) {
    const done = i.progress ? i.progress.done : '—';
    const total = i.progress ? i.progress.total : '—';
    const pct = i.progress && i.progress.total ? Math.round(done / total * 100) : 0;
    const waitCls = i.status === '等待人工确认' ? ' class="row-warn"' : '';
    let act = '<button class="btn sm" data-act="view" data-id="' + i.id + '">详情</button>';
    if (i.status === '运行中' || i.status === '回退重跑中') {
      act += '<button class="btn sm" data-act="pause" data-id="' + i.id + '">' + icon('pause', 12) + '暂停</button>';
      act += '<button class="btn sm danger" data-act="stop" data-id="' + i.id + '">' + icon('stop', 12) + '终止</button>';
    } else if (i.status === '已暂停') {
      act += '<button class="btn sm" data-act="resume" data-id="' + i.id + '">' + icon('play', 12) + '恢复</button>';
      act += '<button class="btn sm danger" data-act="stop" data-id="' + i.id + '">' + icon('stop', 12) + '终止</button>';
    }
    return '<tr' + waitCls + '>' +
      '<td><a class="rowlink" data-open="' + i.id + '" href="javascript:void(0)">' + i.id + '</a></td>' +
      '<td>' + esc(wfName(i.wfId)) + '<div class="sub">' + esc(i.ver) + '</div></td>' +
      '<td>手动</td>' +
      '<td>' + esc(nodeName(i, i.progress && i.progress.active)) + '</td>' +
      '<td><div class="in-prog"><div class="progress"><i style="width:' + pct + '%"></i></div><span class="sub">' + done + '/' + total + '</span></div></td>' +
      '<td>' + tag(i.status) + '</td>' +
      '<td>' + DF.fmtDur(i.durationS) + '</td>' +
      '<td class="sub">' + DF.fmtClock(DF.ts(i.startedM)) + '</td>' +
      '<td style="white-space:nowrap">' + act + '</td></tr>';
  }

  function doAction(act, id) {
    const inst = MOCK.byId(MOCK.instances, id);
    if (!inst) return;
    if (act === 'view') { location.href = 'instance-detail.html?id=' + id; return; }
    if (act === 'pause') {
      DF.modal.confirm({ title: '暂停实例', message: '暂停后所有运行中节点将冻结，可随时恢复。', okText: '暂停' }).then(ok => {
        if (!ok) return;
        inst.status = '已暂停';
        Object.values(inst.nodes || {}).forEach(nd => { if (nd.status === 'running') nd.status = 'paused'; });
        DF.toast('实例已暂停', 'ok'); render();
      });
    } else if (act === 'resume') {
      inst.status = '运行中';
      Object.values(inst.nodes || {}).forEach(nd => { if (nd.status === 'paused') nd.status = 'running'; });
      DF.toast('实例已恢复运行', 'ok'); render();
    } else if (act === 'stop') {
      DF.modal.confirm({ title: '终止实例', html: '终止后<b>进行中的子任务将被取消</b>，实例进入「已终止」状态，可通过「从节点重跑」恢复执行。', danger: true, okText: '终止' }).then(ok => {
        if (!ok) return;
        inst.status = '已终止';
        Object.values(inst.nodes || {}).forEach(nd => { if (nd.status === 'running' || nd.status === 'paused') nd.status = 'fail'; });
        DF.toast('实例已终止', 'warn'); render();
      });
    }
  }

  /* ---------------- 发起运行弹窗 ---------------- */
  function openLaunch() {
    const wfs = MOCK.workflows.filter(w => w.published);
    const wsList = MOCK.workspaces.filter(w => w.status === '已初始化');
    if (!wfs.length) { DF.toast('暂无已发布的工作流，请先在编辑器发布', 'warn'); return; }
    DF.modal.form({
      title: '发起运行',
      width: 460,
      okText: '发起运行',
      body:
        '<div class="field"><label>工作流 <span class="req">*</span></label><select class="inp" id="ru-wf">' +
          wfs.map(w => '<option value="' + w.id + '">' + esc(w.name) + '（' + esc(w.ver) + '）</option>').join('') + '</select></div>' +
        '<div class="field"><label>版本</label><input class="inp" id="ru-ver" disabled></div>' +
        '<div class="field"><label>工作区 <span class="req">*</span></label><select class="inp" id="ru-ws">' +
          (wsList.length ? wsList.map(w => '<option value="' + w.id + '">' + esc(w.name) + '</option>').join('') : '<option value="">（无已初始化工作区）</option>') + '</select>' +
          '<div class="hint">实例运行期的读写均发生在此工作区</div></div>' +
        '<div class="field"><label>备注</label><textarea class="inp" id="ru-note" placeholder="可选"></textarea></div>',
      onMount(b) {
        const wfSel = b.querySelector('#ru-wf'), verInp = b.querySelector('#ru-ver');
        const syncVer = () => { const w = MOCK.byId(MOCK.workflows, wfSel.value); verInp.value = w ? w.ver : ''; };
        wfSel.onchange = syncVer; syncVer();
      },
      onOk(b, close) {
        const wf = MOCK.byId(MOCK.workflows, b.querySelector('#ru-wf').value);
        const wsId = b.querySelector('#ru-ws').value;
        if (!wsId) { DF.toast('请先准备一个已初始化的工作区', 'warn'); return; }
        const id = 'INS-' + (2042 + Math.floor(Math.random() * 90));
        const g = wf.graph || { nodes: [] };
        const first = g.nodes[0];
        const nodes = {};
        g.nodes.forEach((n, idx) => { nodes[n.id] = { status: idx === 0 ? 'running' : 'pending' }; });
        const inst = {
          id, wfId: wf.id, ver: wf.ver, status: '运行中', workspaceId: wsId,
          startedM: 0, durationS: 0, remark: b.querySelector('#ru-note').value || '',
          progress: { done: 0, total: g.nodes.length, active: first ? first.id : null },
          nodes
        };
        DF.ssSet('df-new-instance', JSON.stringify(inst));
        MOCK.instances.unshift(inst);
        close();
        DF.toast('已发起运行 ' + id, 'ok');
        setTimeout(() => { location.href = 'instance-detail.html?id=' + id; }, 450);
      }
    });
  }

  init();
})();
