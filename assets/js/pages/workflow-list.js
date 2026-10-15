/* ============================================================
 * AgentFlow 原型 · 工作流列表页（pages/workflow-list.html）
 * 依赖：assets/js/mock-data.js（window.MOCK）、assets/js/ui.js（window.DF）
 * ============================================================ */
(function () {
  'use strict';

  var LS_VIEW_KEY = 'wl-view';
  var TYPES = ['研发主流程', '专项子流程', '批量审视任务'];
  var TYPE_COLOR = { '研发主流程': 'blue', '专项子流程': 'teal', '批量审视任务': 'purple' };

  var state = {
    tab: '全部',                                        // 全部 | 三种类型
    q: '',                                              // 名称模糊搜索
    view: DF.lsGet(LS_VIEW_KEY) === 'table' ? 'table' : 'card'
  };

  /* ---------- 工具 ---------- */
  var esc = DF.esc;

  function findWf(id) {
    return (MOCK.workflows || []).filter(function (w) { return w.id === id; })[0] || null;
  }

  function pubTag(w) {
    return w.published ? DF.tag('已发布', 'green') : DF.tag('草稿', 'gray');
  }

  function lastRunHtml(w) {
    if (!w.lastRun) return '<span class="wl-never">从未运行</span>';
    return DF.tag(w.lastRun.status) + '<span>' + DF.relTime(w.lastRun.timeM) + '</span>';
  }

  function newId() { return 'w' + (Date.now() % 100000); }

  function blankGraph() {
    return {
      nodes: [
        { id: 'n1', type: 'start', name: '开始', stageId: null, x: 40, y: 56 },
        { id: 'n2', type: 'end', name: '结束', stageId: null, x: 320, y: 56 }
      ],
      edges: [{ id: 'n1>n2', from: 'n1', to: 'n2', kind: 'seq' }],
      stages: [], stageBoxes: {}, w: 600, h: 160
    };
  }

  /* ---------- 统计 ---------- */
  function calcStats() {
    var inst = MOCK.instances || [];
    return {
      total: (MOCK.workflows || []).length,
      running: inst.filter(function (i) { return i.status === '运行中'; }).length,
      waiting: inst.filter(function (i) { return i.status === '等待人工确认'; }).length,
      weekNew: inst.filter(function (i) { return typeof i.startedM === 'number' && i.startedM < 10080; }).length
    };
  }

  function filteredList() {
    var q = state.q.trim().toLowerCase();
    return (MOCK.workflows || []).filter(function (w) {
      if (state.tab !== '全部' && w.type !== state.tab) return false;
      if (q && String(w.name || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ---------- 渲染 ---------- */
  function render(refocusSearch) {
    var body = DF.renderShell({
      active: 'workflows',
      breadcrumb: [{ label: '流程研发' }, { label: '工作流' }],
      title: '工作流',
      subtitle: '管理研发智能体工作流定义',
      actions: '<button class="btn primary" id="btn-new">' + DF.icon('plus', 14) + '新建工作流</button>'
    });

    var st = calcStats();
    var tabs = DF.tabsHtml(
      [{ k: '全部', label: '全部', count: (MOCK.workflows || []).length }].concat(
        TYPES.map(function (t) {
          return { k: t, label: t, count: (MOCK.workflows || []).filter(function (w) { return w.type === t; }).length };
        })
      ), state.tab);

    var list = filteredList();

    body.innerHTML =
      /* Tab + 搜索 */
      '<div class="wl-tabrow">' +
        tabs +
        DF.searchBox('wl-search', '搜索工作流名称', state.q) +
      '</div>' +

      /* 统计条 */
      DF.statRow([
        DF.statCard({ k: '共', v: st.total + ' <small>个工作流</small>', d: '全部类型' }),
        DF.statCard({ k: '运行中', v: st.running + ' <small>个实例</small>', d: '实时状态' }),
        DF.statCard({ k: '等待人工确认', v: st.waiting + ' <small>个实例</small>', d: '去实例列表处理 →', dCls: 'up', click: true, id: 'wl-stat-wait', title: '查看等待人工确认的实例' }),
        DF.statCard({ k: '本周新增运行', v: st.weekNew + ' <small>次</small>', d: '近 7 天发起' })
      ]) +

      /* 视图切换 */
      '<div class="wl-viewbar"><span>视图</span>' +
        '<div class="seg">' +
          '<button data-view="card" class="' + (state.view === 'card' ? 'on' : '') + '">卡片</button>' +
          '<button data-view="table" class="' + (state.view === 'table' ? 'on' : '') + '">表格</button>' +
        '</div>' +
      '</div>' +

      /* 列表主体 */
      '<div id="wl-list">' + (list.length ? listHtml(list) : emptyHtml()) + '</div>';

    wire(body, refocusSearch);
  }

  function listHtml(list) {
    return state.view === 'card' ? cardHtml(list) : tableHtml(list);
  }

  /* 卡片视图 */
  function cardHtml(list) {
    return '<div class="card-grid">' + list.map(function (w) {
      return '<div class="item-card wl-card">' +
        '<div class="ic-head">' + DF.icon('flow', 16) + '<span class="ic-title">' + esc(w.name) + '</span></div>' +
        '<div class="wl-meta">' + DF.tag(w.type, TYPE_COLOR[w.type] || 'gray') +
          '<span>' + esc(w.ver) + '</span><span class="sep">·</span>' + pubTag(w) + '</div>' +
        '<div class="ic-desc">' + esc(w.desc || '（暂无描述）') + '</div>' +
        '<div class="wl-meta">' + w.nodeCount + ' 节点' +
          (w.stageCount ? '<span class="sep">·</span>' + w.stageCount + ' 阶段' : '') + '</div>' +
        '<div class="wl-meta">最近运行：<span class="wl-lastrun" data-wf="' + esc(w.id) + '" title="查看该工作流的实例">' +
          lastRunHtml(w) + '</span></div>' +
        '<div class="ic-foot">' +
          '<button class="btn sm" data-act="edit" data-id="' + esc(w.id) + '">' + DF.icon('edit', 13) + '编辑</button>' +
          '<button class="btn sm primary" data-act="run" data-id="' + esc(w.id) + '"' + (w.published ? '' : ' disabled title="草稿不可运行，请先发布"') + '>' + DF.icon('play', 13) + '运行</button>' +
          '<span style="flex:1"></span>' +
          '<button class="wl-more" data-act="more" data-id="' + esc(w.id) + '" title="更多操作">' + DF.icon('more', 16) + '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* 表格视图 */
  function tableHtml(list) {
    var rows = list.map(function (w) {
      return '<tr>' +
        '<td class="rowlink" data-act="edit" data-id="' + esc(w.id) + '">' + esc(w.name) + '</td>' +
        '<td>' + DF.tag(w.type, TYPE_COLOR[w.type] || 'gray') + '</td>' +
        '<td class="mono">' + esc(w.ver) + '</td>' +
        '<td>' + pubTag(w) + '</td>' +
        '<td>' + w.nodeCount + (w.stageCount ? '<div class="sub">' + w.stageCount + ' 阶段</div>' : '') + '</td>' +
        '<td><span class="wl-lastrun" data-wf="' + esc(w.id) + '" title="查看该工作流的实例">' + lastRunHtml(w) + '</span></td>' +
        '<td>' + esc(w.updater || '—') + '</td>' +
        '<td>' + DF.relTime(w.updatedM) + '</td>' +
        '<td><div class="wl-acts">' +
          '<button class="btn sm" data-act="edit" data-id="' + esc(w.id) + '">编辑</button>' +
          '<button class="btn sm" data-act="run" data-id="' + esc(w.id) + '"' + (w.published ? '' : ' disabled title="草稿不可运行，请先发布"') + '>运行</button>' +
          '<button class="wl-more" data-act="more" data-id="' + esc(w.id) + '" title="更多操作">' + DF.icon('more', 16) + '</button>' +
        '</div></td>' +
      '</tr>';
    });

    return DF.table(
      ['名称', '类型', '版本', '发布状态', '节点数', '最近运行', '更新人', '更新时间', '操作'],
      rows
    );
  }

  /* 空态 */
  function emptyHtml() {
    if (state.q.trim()) {
      return DF.empty({
        icon: 'search', iconSize: 30,
        html: '未找到名称包含「' + esc(state.q.trim()) + '」的工作流<br><br>',
        action: { id: 'wl-clear-q', label: '清除搜索', icon: 'x', sm: true }
      });
    }
    return DF.empty({
      icon: 'flow', iconSize: 32,
      html: '该类型暂无工作流，新建或从模板创建<br><br>',
      action: { id: 'wl-empty-new', label: '新建工作流', icon: 'plus', primary: true, sm: true }
    });
  }

  /* ---------- 事件绑定 ---------- */
  function wire(body, refocusSearch) {
    function one(sel, fn) {
      /* 直接注册：fn 即点击监听器 */
      var el = body.querySelector(sel);
      if (el) el.addEventListener('click', fn);
    }
    function all(sel, fn) {
      /* 批量绑定器：对每个元素调用 fn(el)，由回调内部完成 addEventListener */
      Array.prototype.forEach.call(body.querySelectorAll(sel), fn);
    }

    function oneDoc(id, fn) {
      /* 页头 .acts 在 #page-body 之外（兄弟节点），页头按钮需 document 级查找 */
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    oneDoc('btn-new', openNewModal);
    one('#wl-empty-new', openNewModal);
    one('#wl-clear-q', function () { state.q = ''; render(); });
    one('#wl-stat-wait', function () {
      location.href = 'instances.html?tab=' + encodeURIComponent('等待人工确认');
    });

    Array.prototype.forEach.call(body.querySelectorAll('.tab[data-tab]'), function (el) {
      el.addEventListener('click', function () { state.tab = el.getAttribute('data-tab'); render(); });
    });

    var search = body.querySelector('#wl-search');
    if (search) {
      search.addEventListener('input', function () { state.q = search.value; render(true); });
    }

    all('.seg button[data-view]', function (el) {
      el.addEventListener('click', function () {
        state.view = el.getAttribute('data-view');
        DF.lsSet(LS_VIEW_KEY, state.view);
        render();
      });
    });

    all('[data-act="edit"]', function (el) {
      el.addEventListener('click', function () {
        location.href = 'workflow-editor.html?id=' + encodeURIComponent(el.getAttribute('data-id'));
      });
    });

    all('[data-act="run"]', function (el) {
      el.addEventListener('click', function () {
        var w = findWf(el.getAttribute('data-id'));
        if (w) openRunModal(w);
      });
    });

    all('[data-act="more"]', function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var w = findWf(el.getAttribute('data-id'));
        if (w) openMoreMenu(e, w);
      });
    });

    all('.wl-lastrun', function (el) {
      el.addEventListener('click', function () {
        location.href = 'instances.html?wfId=' + encodeURIComponent(el.getAttribute('data-wf'));
      });
    });

    if (refocusSearch && search) {
      search.focus();
      var len = search.value.length;
      try { search.setSelectionRange(len, len); } catch (e) { /* 忽略 */ }
    }
  }

  /* ---------- 更多菜单：复制 / 导出 DSL / 删除 ---------- */
  function openMoreMenu(e, w) {
    DF.menu([
      { label: '复制', icon: 'copy', onClick: function () { duplicateWf(w); } },
      { label: '导出 DSL', icon: 'download', onClick: function () { exportDsl(w); } },
      { label: '删除', icon: 'trash', danger: true, onClick: function () { removeWf(w); } }
    ], e.clientX, e.clientY);
  }

  function duplicateWf(w) {
    var copy = JSON.parse(JSON.stringify(w));
    copy.id = newId();
    copy.name = w.name + ' 副本';
    copy.published = false;
    copy.lastRun = null;
    copy.updater = '我';
    copy.updatedM = 0;
    MOCK.workflows.push(copy);
    DF.toast('已复制为草稿「' + copy.name + '」', 'ok');
    render();
  }

  function exportDsl(w) {
    DF.download(w.name + '-dsl.json', JSON.stringify(w.graph || {}, null, 2), 'application/json');
    DF.toast('已导出「' + w.name + '」的 DSL JSON', 'ok');
  }

  function removeWf(w) {
    var refs = (MOCK.instances || []).filter(function (i) { return i.wfId === w.id; }).length;
    DF.modal.confirm({
      title: '删除工作流',
      danger: true,
      okText: '删除',
      html: '确定删除 <b>' + esc(w.name) + '</b>（' + esc(w.ver) + '）？<br>' +
        '有 <b>' + refs + '</b> 个实例引用该工作流，删除后不可恢复。'
    }).then(function (ok) {
      if (!ok) return;
      var idx = -1;
      for (var i = 0; i < MOCK.workflows.length; i++) {
        if (MOCK.workflows[i].id === w.id) { idx = i; break; }
      }
      if (idx > -1) MOCK.workflows.splice(idx, 1);
      DF.toast('已删除「' + w.name + '」', 'ok');
      render();
    });
  }

  /* ---------- 发起运行弹窗 ---------- */
  function openRunModal(w) {
    var wsList = (MOCK.workspaces || []).filter(function (ws) { return ws.status === '已初始化'; });
    var wsOpts = wsList.length
      ? wsList.map(function (ws) { return '<option value="' + esc(ws.name) + '">' + esc(ws.name) + '</option>'; }).join('')
      : '<option value="">（无已初始化工作区）</option>';

    var html =
      '<div class="field"><label>工作流</label><input class="inp wl-ro" value="' + esc(w.name) + '" readonly></div>' +
      '<div class="field"><label>版本</label><input class="inp wl-ro" value="' + esc(w.ver) + '" readonly></div>' +
      '<div class="field"><label>工作区</label><select class="inp" id="wl-run-ws">' + wsOpts + '</select></div>' +
      '<div class="field"><label>备注</label><textarea class="inp" id="wl-run-note" rows="3" placeholder="选填，说明本次运行目的"></textarea></div>';

    DF.modal.form({
      title: '发起运行',
      width: 460,
      body: html,
      okText: '发起运行',
      onOk: function () {
        DF.toast('已发起运行', 'ok');
        setTimeout(function () { location.href = 'instances.html'; }, 400);
      }
    });
  }

  /* ---------- 新建工作流弹窗 ---------- */
  function openNewModal() {
    var tpls = (MOCK.workflows || []).filter(function (w) { return w.published; }).slice(0, 4);
    var selTpl = ''; // '' = 空白流程
    var tplCards =
      '<div class="wl-tpl on" data-tpl=""><div class="t1">空白流程</div><div class="t2">从零搭建节点与阶段</div></div>' +
      tpls.map(function (t) {
        return '<div class="wl-tpl" data-tpl="' + esc(t.id) + '">' +
          '<div class="t1">' + esc(t.name) + '</div>' +
          '<div class="t2">' + t.nodeCount + ' 节点' + (t.stageCount ? ' · ' + t.stageCount + ' 阶段' : '') + ' · ' + esc(t.ver) + '</div>' +
        '</div>';
      }).join('');

    var html =
      '<div class="field"><label>名称 <span class="wl-req">*</span></label>' +
        '<input class="inp" id="wl-nf-name" placeholder="如：清算规则分析子流程"></div>' +
      '<div class="field"><label>类型 <span class="wl-req">*</span></label><div>' +
        TYPES.map(function (t, i) {
          return '<label class="wl-radio"><input type="radio" name="wl-nf-type" value="' + esc(t) + '"' + (i === 1 ? ' checked' : '') + '>' + esc(t) + '</label>';
        }).join('') +
      '</div></div>' +
      '<div class="field"><label>描述</label><textarea class="inp" id="wl-nf-desc" rows="2" placeholder="一句话说明用途"></textarea></div>' +
      '<div class="field"><label>从模板创建 <span class="wl-req">*</span></label>' +
        '<div class="wl-tpl-grid" id="wl-nf-tpls">' + tplCards + '</div></div>';

    DF.modal.form({
      title: '新建工作流',
      width: 520,
      body: html,
      okText: '确定',
      onMount: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('.wl-tpl'), function (el) {
          el.addEventListener('click', function () {
            selTpl = el.getAttribute('data-tpl');
            Array.prototype.forEach.call(body.querySelectorAll('.wl-tpl'), function (x) {
              x.classList.toggle('on', x === el);
            });
          });
        });
      },
      onOk: function (body, close) {
        var name = body.querySelector('#wl-nf-name').value.trim();
        if (!name) { DF.toast('请输入工作流名称', 'warn'); body.querySelector('#wl-nf-name').focus(); return; }
        var typeEl = body.querySelector('input[name="wl-nf-type"]:checked');
        var type = typeEl ? typeEl.value : TYPES[1];
        var desc = body.querySelector('#wl-nf-desc').value.trim();

        var graph, nodeCount, stageCount;
        if (selTpl) {
          var t = findWf(selTpl);
          graph = t ? JSON.parse(JSON.stringify(t.graph || blankGraph())) : blankGraph();
          nodeCount = (graph.nodes || []).length;
          stageCount = (graph.stages || []).length;
        } else {
          graph = blankGraph();
          nodeCount = 2;
          stageCount = 0;
        }

        var nw = {
          id: newId(),
          name: name,
          type: type,
          ver: 'v0.1',
          published: false,
          desc: desc,
          nodeCount: nodeCount,
          stageCount: stageCount,
          lastRun: null,
          updater: '我',
          updatedM: 0,
          graph: graph
        };
        MOCK.workflows.push(nw);
        close();
        location.href = 'workflow-editor.html?id=' + encodeURIComponent(nw.id);
      }
    });
  }

  /* ---------- 启动 ---------- */
  render();
})();
