/**
 * AgentFlow 原型 · 工具与集成页（pages/tools.html）
 * 依赖: window.MOCK (assets/js/mock-data.js) + window.DF (assets/js/ui.js)
 * 规格: docs/08-工具与集成.md —— Tab 列表 + 调试抽屉(680px) + 注册/编辑弹窗
 */
(function () {
  'use strict';

  var TYPES = ['MCP', 'CLI', '脚本'];
  var STATUSES = ['可用', '不可用', '未验证'];
  var TYPE_COLOR = { 'MCP': 'teal', 'CLI': 'blue', '脚本': 'orange' };

  var filterType = '';
  var filterStatus = '';
  var filterKw = '';

  /* ---------- 参数示例值（symbol 类参数预填，如 OrderService#submit） ---------- */
  var EXAMPLES = {
    symbol: 'OrderService#submit', depth: '3', entity: 'OrderService',
    keyword: '订单', project: 'trading-core', path: 'trade/UFX/src/main/java/com/fin/order',
    rules: 'default', suite: 'magic', spec: 'api/order-submit.spec', env: 'test',
    scene: '订单提交', rows: '100', src: 'replay/2025-09-30',
    node: '金融证券交易/交易执行/订单提交', pipeline: 'PL-TRADING-3102', stage: '制品级'
  };
  function exampleVal(p) {
    if (EXAMPLES[p.k] != null) return EXAMPLES[p.k];
    if (p.type === 'int') return '3';
    return p.k;
  }

  /* ---------- 页面骨架 ---------- */
  var body = DF.renderShell({
    active: 'tools',
    breadcrumb: [{ label: '资产与注册' }, { label: '工具与集成' }],
    title: '工具与集成',
    subtitle: '确定性工具注册与调试',
    actions: '<button class="btn primary" id="tl-add">' + DF.icon('plus') + '注册工具</button>'
  });

  body.innerHTML =
    '<div class="tabs" id="tl-tabs">' +
      '<div class="tab active" data-tab="tools">MCP/CLI 工具</div>' +
      '<div class="tab" data-tab="cicd">CI/CD 环境</div>' +
    '</div>' +
    '<div id="tl-tab-tools">' +
      '<div class="toolbar">' +
        '<select class="inp inp-sm" id="tl-ft-type" title="按类型筛选">' +
          '<option value="">全部</option>' +
          TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') +
        '</select>' +
        '<select class="inp inp-sm" id="tl-ft-status" title="按状态筛选">' +
          '<option value="">全部</option>' +
          STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') +
        '</select>' +
        DF.searchBox('tl-ft-kw', '搜索名称 / 调用方式 / 说明') +
        '<span class="sp"></span>' +
        '<button class="btn primary sm" id="tl-btn-add">' + DF.icon('plus', 14) + '注册工具</button>' +
      '</div>' +
      '<div id="tl-table"></div>' +
    '</div>' +
    '<div id="tl-tab-cicd" class="tl-hide">' +
      '<div class="card">' + DF.empty({
        icon: 'server', iconSize: 40,
        html: '<div class="tl-empty-title">CI/CD 环境绑定暂未开放</div>' +
          '<div class="tl-empty-sub">当前版本聚焦编排模型演示，流水线绑定将在后续版本提供</div>',
        style: 'padding:70px 20px'
      }) + '</div>' +
    '</div>';

  /* ---------- Tab 切换 ---------- */
  body.querySelector('#tl-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    body.querySelectorAll('#tl-tabs .tab').forEach(function (x) { x.classList.toggle('active', x === tab); });
    body.querySelector('#tl-tab-tools').classList.toggle('tl-hide', tab.getAttribute('data-tab') !== 'tools');
    body.querySelector('#tl-tab-cicd').classList.toggle('tl-hide', tab.getAttribute('data-tab') !== 'cicd');
  });

  /* ---------- 筛选与入口按钮 ---------- */
  body.querySelector('#tl-ft-type').onchange = function () { filterType = this.value; renderTable(); };
  body.querySelector('#tl-ft-status').onchange = function () { filterStatus = this.value; renderTable(); };
  body.querySelector('#tl-ft-kw').oninput = function () { filterKw = this.value.trim().toLowerCase(); renderTable(); };
  document.getElementById('tl-add').onclick = function () { openRegister(null); };
  body.querySelector('#tl-btn-add').onclick = function () { openRegister(null); };

  /* ---------- 工具表格 ---------- */
  function filteredTools() {
    return MOCK.tools.filter(function (t) {
      if (filterType && t.type !== filterType) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterKw && (t.name + ' ' + (t.invocation || '') + ' ' + (t.desc || '')).toLowerCase().indexOf(filterKw) < 0) return false;
      return true;
    });
  }

  function rowHtml(t) {
    var h = MOCK.byId(MOCK.harnesses, t.harness);
    var locked = (t.refCount || 0) > 0;
    return '<tr>' +
      '<td><span class="mono rowlink" data-act="debug" data-id="' + t.id + '" title="打开调试抽屉">' + DF.esc(t.name) + '</span></td>' +
      '<td>' + DF.tag(t.type, TYPE_COLOR[t.type] || 'gray') + '</td>' +
      '<td><div class="mono ellipsis" style="max-width:280px" title="' + DF.esc(t.invocation) + '">' + DF.esc(t.invocation) + '</div>' +
        '<div class="sub">' + (t.params || []).length + ' 个参数</div></td>' +
      '<td><a class="tag gray tl-hlink" href="harnesses.html" title="前往 Harness 管理">' + DF.esc(h ? h.name : (t.harness || '—')) + '</a></td>' +
      '<td>' + DF.tag(t.status) + '</td>' +
      '<td><a class="tl-count" data-act="refs" data-id="' + t.id + '" title="查看引用方">' + (t.refCount || 0) + '</a></td>' +
      '<td>' + DF.relTime(t.lastDebugM) + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn sm" data-act="debug" data-id="' + t.id + '">调试</button> ' +
        '<button class="btn sm" data-act="edit" data-id="' + t.id + '">编辑</button> ' +
        '<button class="btn sm danger" data-act="del" data-id="' + t.id + '"' +
          (locked ? ' disabled title="被 ' + t.refCount + ' 处引用，禁止删除"' : ' title="删除工具"') + '>删除</button>' +
      '</td></tr>';
  }

  function renderTable() {
    var box = document.getElementById('tl-table');
    var list = filteredTools();
    if (!list.length) {
      var noneAll = !MOCK.tools.length;
      box.innerHTML =
        '<div class="card">' + DF.empty({
          icon: 'tool', iconSize: 40,
          html: noneAll
            ? '<div class="tl-empty-title">还没有注册任何工具</div>' +
              '<div class="tl-empty-sub" style="margin-bottom:14px">注册第一个确定性工具，减少对模型的依赖</div>'
            : '<div class="tl-empty-title" style="font-weight:400">未找到匹配的工具</div>' +
              '<div class="tl-empty-sub">调整类型 / 状态 / 搜索条件后重试</div>',
          action: noneAll ? { id: 'tl-empty-add', label: '注册工具', icon: 'plus', primary: true } : null
        }) + '</div>';
      var ea = box.querySelector('#tl-empty-add');
      if (ea) ea.onclick = function () { openRegister(null); };
      return;
    }
    box.innerHTML = DF.table(
      ['名称', '类型', '调用方式', '所属 Harness', '状态', '被引用数', '最近调试', '操作'],
      list.map(rowHtml)
    );
    bindActs(box);
  }

  function bindActs(root) {
    root.querySelectorAll('[data-act]').forEach(function (el) {
      var t = MOCK.byId(MOCK.tools, el.getAttribute('data-id'));
      if (!t) return;
      var act = el.getAttribute('data-act');
      if (act === 'del') {
        el.onclick = function () { confirmDelete(t); };
      } else {
        el.onclick = function () {
          if (act === 'debug') openDebug(t);
          else if (act === 'edit') openRegister(t);
          else if (act === 'refs') openRefs(t);
        };
      }
    });
  }

  function confirmDelete(t) {
    DF.modal.confirm({
      title: '删除工具',
      html: '确定删除工具 <b>' + DF.esc(t.name) + '</b> 吗？删除后不可恢复。',
      danger: true,
      okText: '删除'
    }).then(function (yes) {
      if (!yes) return;
      var i = MOCK.tools.indexOf(t);
      if (i >= 0) MOCK.tools.splice(i, 1);
      DF.drawer.close();
      DF.toast('已删除工具 ' + t.name, 'ok');
      renderTable();
    });
  }

  /* ---------- 被引用详情弹层 ---------- */
  function findRefs(t) {
    var refs = [];
    (MOCK.experts || []).forEach(function (e) {
      if ((e.tools || []).indexOf(t.id) >= 0) refs.push({ icon: 'user', text: '专家: ' + e.name, sub: e.role || '' });
    });
    (MOCK.workflows || []).forEach(function (wf) {
      var nodes = (wf.graph && wf.graph.nodes) || [];
      nodes.forEach(function (n) {
        // 兼容 config.tools 与 mock 数据实际使用的 config.ctx.tools
        var tl = (n.config && (n.config.tools || (n.config.ctx && n.config.ctx.tools))) || [];
        if (tl.indexOf(t.id) >= 0) refs.push({ icon: 'flow', text: '工作流节点: ' + wf.name + '/' + n.name, sub: wf.type + ' · ' + wf.ver });
      });
    });
    return refs;
  }

  function openRefs(t) {
    var refs = findRefs(t);
    DF.modal.open({
      title: '被引用详情 · ' + t.name,
      width: 480,
      body: refs.length
        ? '<div class="tl-dim" style="margin-bottom:6px">共 ' + refs.length + ' 处引用</div>' +
          refs.map(function (r) {
            return '<div class="tl-ref-item">' + DF.icon(r.icon) + '<div><div>' + DF.esc(r.text) + '</div>' +
              (r.sub ? '<div class="sub">' + DF.esc(r.sub) + '</div>' : '') + '</div></div>';
          }).join('')
        : DF.empty({
            icon: 'search', iconSize: 36,
            html: '<div class="tl-empty-title" style="font-weight:400">暂无引用</div>' +
              '<div class="tl-empty-sub">没有专家或工作流节点引用该工具</div>'
          }),
      footer: '<button class="btn primary" id="tl-ref-close">关闭</button>',
      onMount: function (b, close) { b.closest('.modal').querySelector('#tl-ref-close').onclick = close; }
    });
  }

  /* ---------- 调试抽屉 ---------- */
  function paramsHtml(t) {
    if (!(t.params || []).length) return '<div class="tl-hist-empty">该工具未定义参数</div>';
    return t.params.map(function (p) {
      return '<div class="tl-prow">' +
        '<div class="tl-pmeta"><span class="mono tl-pkey">' + DF.esc(p.k) + '</span>' +
          '<span class="tag gray">' + DF.esc(p.type || 'string') + '</span>' +
          '<span class="tl-pdesc">' + DF.esc(p.desc || '') + '</span></div>' +
        '<input class="inp mono" data-k="' + DF.esc(p.k) + '" value="' + DF.esc(exampleVal(p)) + '">' +
      '</div>';
    }).join('');
  }

  function runAgoM(t, i) {
    return t.lastDebugM == null ? null : t.lastDebugM + i * 45; // 历史记录无时间戳，按最近调试时间近似展开
  }

  function histHtml(t) {
    var runs = (t.runs || []).slice(0, 5);
    if (!runs.length) return '<div class="tl-hist-empty">暂无调试记录，点击「运行」开始第一次调试</div>';
    return runs.map(function (r, i) {
      return '<div class="tl-hist-item"><span class="dot ' + (r.ok ? 'green' : 'red') + '"></span>' +
        '<span class="' + (r.ok ? 'tl-ok-t' : 'tl-err-t') + '">' + (r.ok ? '成功' : '失败') + '</span>' +
        '<span class="mono">' + r.ms + 'ms</span><span class="sp"></span>' +
        '<span class="tl-dim">' + DF.relTime(runAgoM(t, i)) + '</span></div>';
    }).join('');
  }

  function buildCommand(t, values) {
    var cmd = t.invocation || '';
    Object.keys(values).forEach(function (k) {
      cmd = cmd.split('{' + k + '}').join(values[k] == null ? '' : values[k]);
    });
    return cmd;
  }

  /* 紧凑 JSON 格式化：数组元素逐行、标量数组收为一行，整体控制在 3-6 行左右 */
  function isScalar(x) { return x == null || typeof x !== 'object'; }
  function fmtJson(v, indent) {
    indent = indent || 0;
    var pad = ''; var i;
    for (i = 0; i < indent; i++) pad += '  ';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (v.every(isScalar)) return JSON.stringify(v);
      return '[\n' + v.map(function (x) { return pad + '  ' + fmtJson(x, indent + 1); }).join(',\n') + '\n' + pad + ']';
    }
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (!keys.length) return '{}';
      return '{\n' + keys.map(function (k) {
        return pad + '  ' + JSON.stringify(k) + ': ' + fmtJson(v[k], indent + 1);
      }).join(',\n') + '\n' + pad + '}';
    }
    return JSON.stringify(v);
  }

  /* 按工具身份生成 3-6 行 JSON 结果样例 */
  function resultPayload(t, values, ms) {
    var sym = values.symbol || 'OrderService#submit';
    var path = values.path || 'trade/UFX/src/main/java/com/fin/order';
    switch (t.id) {
      case 't-trace': {
        var depth = Math.max(1, Math.min(4, parseInt(values.depth, 10) || 3));
        var down = ['OrderDAO#insert', 'SqlSessionTemplate#flush', 'DataSourceProxy#getConn', 'HikariPool#borrow'];
        var chain = []; var caller = sym;
        for (var i = 0; i < depth; i++) {
          var s = down[i] || 'Object#wait';
          chain.push({ depth: i + 1, symbol: s, caller: caller });
          caller = s;
        }
        return chain; // 调用链数组
      }
      case 't-lint':
        return [ // 告警列表
          { file: 'UFX/OrderService.java', line: 87, rule: 'magic-number', msg: '魔法数 86400 应提取为命名常量' },
          { file: 'UFX/OrderDAO.java', line: 143, rule: 'naming', msg: '方法名 doQuery1 不符合驼峰规范' },
          { file: 'UFX/MoneyUtil.java', line: 22, rule: 'unused-import', msg: '未使用的导入 java.util.HashMap' }
        ];
      case 't-meta':
        return [ // 实体字段
          { field: 'orderId', type: 'string(32)', required: true, desc: '订单号' },
          { field: 'amount', type: 'decimal(18,2)', required: true, desc: '订单金额' },
          { field: 'createdAt', type: 'datetime', required: false, desc: '创建时间' }
        ];
      case 't-dsl':
        return [
          { asset: 'form/order-submit.form.json', node: 'LDP/Form/OrderSubmit', score: 0.93 },
          { asset: 'flow/order-cancel.flow.xml', node: 'LDP/Flow/OrderCancel', score: 0.81 },
          { asset: 'svc/OrderSubmitSvc.dsm', node: 'LDP/Service/OrderSubmitSvc', score: 0.76 }
        ];
      case 't-smell':
        return [
          { file: 'UFX/OrderService.java', line: 87, rule: 'magic-number', detail: '魔法数 86400' },
          { file: 'UFX/QuotePush.java', line: 51, rule: 'mem-release', detail: 'Buffer 未在 finally 中释放' },
          { file: 'UFX/LimitCheck.java', line: 130, rule: 'param-check', detail: '入口参数 amount 未做非空校验' }
        ];
      case 't-contract':
        return [
          { contract: 'order-submit.spec', field: 'orderId', verdict: 'pass' },
          { contract: 'settle-result.spec', field: 'settleMode', verdict: 'pass' },
          { contract: 'quote-push.spec', field: 'pushRate', verdict: 'pass' }
        ];
      case 't-factory':
        return { scene: values.scene || '订单提交', rows: parseInt(values.rows, 10) || 100, tables: ['t_order', 't_order_item'], tookMs: ms };
      case 't-btree':
        return { node: values.node || '金融证券交易/交易执行/订单提交', domain: '金融证券交易', stream: '交易执行', scene: '订单提交', entries: ['UFX/OrderService.java', 'api/order-submit.spec'] };
      case 't-smoke':
        return { pipeline: values.pipeline || 'PL-TRADING-3102', stage: values.stage || '制品级', cases: 86, passed: 86, failed: 0 };
      default:
        return { tool: t.name, tookMs: ms, message: '执行完成（演示输出）' };
    }
  }

  /* 单次模拟执行：按 runs[] 轮换结果；不可用工具固定依赖缺失输出 */
  function runOnce(t, values) {
    var runs = t.runs || [];
    var i = runs.length;
    var fixedErr = t.status === '不可用';
    var ok, ms;
    if (fixedErr) {
      ok = false;
      ms = i ? runs[i % runs.length].ms : 1200;
    } else if (i) {
      var rec = runs[i % runs.length];
      ok = !!rec.ok;
      ms = rec.ms || 800;
    } else {
      ok = true; ms = 680;
    }
    var html = '<div class="tl-cmd">$ ' + DF.esc(buildCommand(t, values)) + '</div>';
    if (fixedErr) {
      html += '<div class="lv-err">[err] 依赖缺失: lib replay-core not found (exit 1)</div>';
    } else if (ok) {
      html += '<div class="tl-pre">' + DF.esc(fmtJson(resultPayload(t, values, ms), 0)) + '</div>' +
        '<div class="lv-ok">[ok] exit 0 · ' + ms + 'ms</div>';
    } else {
      html += '<div class="lv-err">[err] exit 1 · 超时</div>';
    }
    return { ok: ok, ms: ms, html: html };
  }

  function openDebug(t) {
    var h = MOCK.byId(MOCK.harnesses, t.harness);
    var html =
      '<div class="notice">' + DF.icon('tool', 14) + '<div>' + DF.esc(t.desc || '（无说明）') +
        ' · Harness: ' + DF.esc(h ? h.name : (t.harness || '—')) + ' · 超时 ' + t.timeoutMs + 'ms</div></div>' +
      '<div class="section-title">参数<span class="line"></span></div>' +
      '<div id="tl-params">' + paramsHtml(t) + '</div>' +
      '<div class="tl-run-row"><button class="btn primary" id="tl-run">' + DF.icon('play') + '运行</button>' +
        '<span class="hint">模拟执行 1s，结果写入调试记录并刷新列表</span></div>' +
      '<div class="section-title">执行输出<span class="line"></span></div>' +
      '<div class="log-view" id="tl-out"><span class="tl-cmd">$ 等待运行…</span></div>' +
      '<div class="section-title">最近 5 次调试<span class="line"></span></div>' +
      '<div id="tl-hist">' + histHtml(t) + '</div>';

    DF.drawer.open({
      title: '调试 · ' + t.name,
      width: 680,
      body: html,
      onMount: function (b) {
        var out = b.querySelector('#tl-out');
        var runBtn = b.querySelector('#tl-run');
        runBtn.onclick = function () {
          var values = {};
          b.querySelectorAll('#tl-params [data-k]').forEach(function (inp) {
            values[inp.getAttribute('data-k')] = inp.value;
          });
          runBtn.disabled = true;
          runBtn.textContent = '执行中…';
          setTimeout(function () {
            var res = runOnce(t, values);
            out.innerHTML = res.html;
            out.scrollTop = 0;
            (t.runs = t.runs || []).unshift({ ok: res.ok, ms: res.ms });
            t.lastDebugM = 0;
            if (res.ok && t.status === '未验证') t.status = '可用';
            renderTable();
            b.querySelector('#tl-hist').innerHTML = histHtml(t);
            runBtn.disabled = false;
            runBtn.innerHTML = DF.icon('play') + '运行';
            DF.toast(res.ok ? '调试成功: ' + t.name : '调试失败: ' + t.name + '（exit 1）', res.ok ? 'ok' : 'err');
          }, 1000);
        };
      }
    });
  }

  /* ---------- 注册 / 编辑弹窗 ---------- */
  function openRegister(existing) {
    var isEdit = !!existing;
    var t = existing || { name: '', type: 'CLI', invocation: '', params: [], harness: (MOCK.harnesses[0] || {}).id, timeoutMs: 30000, desc: '' };
    var segHtml = TYPES.map(function (x) {
      return '<button type="button" data-v="' + x + '"' + (t.type === x ? ' class="on"' : '') + '>' + x + '</button>';
    }).join('');
    var html =
      '<div class="field"><label>名称<span class="req">*</span></label>' +
        '<input class="inp mono" id="tl-f-name" placeholder="如 trace_call_chain" value="' + DF.esc(t.name) + '"></div>' +
      '<div class="field"><label>类型</label><div class="seg" id="tl-f-type">' + segHtml + '</div></div>' +
      '<div class="field"><label>调用方式<span class="req">*</span></label>' +
        '<input class="inp mono" id="tl-f-inv" placeholder="如 trace --symbol {symbol}" value="' + DF.esc(t.invocation) + '">' +
        '<div class="hint">{} 为参数占位符，运行时按参数定义替换</div></div>' +
      '<div class="field"><label>参数定义</label><div id="tl-f-params"></div>' +
        '<button class="btn sm" type="button" id="tl-f-addp">' + DF.icon('plus', 12) + '添加参数</button></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>超时（ms）</label>' +
          '<input class="inp" id="tl-f-timeout" type="number" min="0" step="1000" value="' + (t.timeoutMs || 30000) + '"></div>' +
        '<div class="field"><label>所属 Harness</label><select class="inp" id="tl-f-harness">' +
          (MOCK.harnesses || []).map(function (h) {
            return '<option value="' + h.id + '"' + (h.id === t.harness ? ' selected' : '') + '>' + DF.esc(h.name) + '</option>';
          }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>说明</label>' +
        '<textarea class="inp" id="tl-f-desc" placeholder="工具用途说明">' + DF.esc(t.desc || '') + '</textarea></div>';

    var type = t.type;
    var pbox = null;
    DF.modal.form({
      title: isEdit ? '编辑工具 · ' + t.name : '注册工具',
      width: 560,
      body: html,
      okText: isEdit ? '保存' : '注册',
      onMount: function (b) {
        var seg = b.querySelector('#tl-f-type');
        seg.addEventListener('click', function (e) {
          var btn = e.target.closest('button');
          if (!btn) return;
          type = btn.getAttribute('data-v');
          seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === btn); });
        });

        pbox = b.querySelector('#tl-f-params');
        function addRow(p) {
          p = p || { k: '', type: 'string', desc: '' };
          var row = document.createElement('div');
          row.className = 'tl-frow';
          row.innerHTML =
            '<input class="inp mono inp-sm tl-fk" placeholder="键（如 symbol）" value="' + DF.esc(p.k) + '">' +
            '<select class="inp inp-sm tl-ft">' +
              '<option' + (p.type !== 'int' ? ' selected' : '') + '>string</option>' +
              '<option' + (p.type === 'int' ? ' selected' : '') + '>int</option></select>' +
            '<input class="inp inp-sm tl-fd" placeholder="说明" value="' + DF.esc(p.desc || '') + '">' +
            '<button class="icon-btn tl-fx" type="button" title="移除该参数">' + DF.icon('x', 14) + '</button>';
          row.querySelector('.tl-fx').onclick = function () { row.remove(); };
          pbox.appendChild(row);
        }
        (t.params || []).forEach(addRow);
        if (!(t.params || []).length) addRow();
        b.querySelector('#tl-f-addp').onclick = function () { addRow(); };
      },
      onOk: function (b, close) {
        var name = b.querySelector('#tl-f-name').value.trim();
        var inv = b.querySelector('#tl-f-inv').value.trim();
        if (!name || !inv) { DF.toast('名称与调用方式为必填项', 'err'); return; }
        var params = [];
        pbox.querySelectorAll('.tl-frow').forEach(function (r) {
          var k = r.querySelector('.tl-fk').value.trim();
          if (k) params.push({ k: k, type: r.querySelector('.tl-ft').value, desc: r.querySelector('.tl-fd').value.trim() });
        });
        var timeoutMs = parseInt(b.querySelector('#tl-f-timeout').value, 10);
        if (!(timeoutMs > 0)) timeoutMs = 30000;
        var harness = b.querySelector('#tl-f-harness').value;
        var desc = b.querySelector('#tl-f-desc').value.trim();
        if (isEdit) {
          existing.name = name; existing.type = type; existing.invocation = inv;
          existing.params = params; existing.timeoutMs = timeoutMs; existing.harness = harness; existing.desc = desc;
          DF.toast('已保存修改', 'ok');
        } else {
          var nid = 't-' + Date.now().toString(36);
          while (MOCK.byId(MOCK.tools, nid)) nid += 'x';
          MOCK.tools.unshift({
            id: nid, name: name, type: type, invocation: inv, params: params,
            harness: harness, timeoutMs: timeoutMs, status: '未验证',
            desc: desc, refCount: 0, lastDebugM: null, runs: []
          });
          DF.toast('已注册，调试一次成功后变为可用', 'ok');
        }
        close();
        renderTable();
      }
    });
  }

  renderTable();
})();
