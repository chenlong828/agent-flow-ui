/**
 * AgentFlow · 工具与集成页（pages/tools.html）
 * 依赖: API（B1 客户端数据层）+ DF（assets/js/ui.js）
 * 直接消费 B1 Tool DTO；不读本地夹具，不引入客户端视图模型。
 * B1 无调试端点：状态与 lastDebugAt 只读展示，页面不执行工具、不改状态。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';


  /* ---------- DTO 枚举 → 中文标签（仅渲染时映射，不写回 DTO） ---------- */
  var KINDS = [
    { value: 'mcp', label: 'MCP' },
    { value: 'cli', label: 'CLI' },
    { value: 'script', label: '脚本' }
  ];
  var KIND_COLOR = { mcp: 'teal', cli: 'blue', script: 'orange' };
  var KIND_LABEL = Object.create(null);

  var STATUSES = [
    { value: 'unverified', label: '未验证' },
    { value: 'available', label: '可用' },
    { value: 'unavailable', label: '不可用' }
  ];
  var STATUS_COLOR = { unverified: 'gray', available: 'green', unavailable: 'red' };
  var STATUS_LABEL = Object.create(null);

  var PARAM_TYPES = ['string', 'int'];

  KINDS.forEach(function (k) { KIND_LABEL[k.value] = k.label; });
  STATUSES.forEach(function (s) { STATUS_LABEL[s.value] = s.label; });

  /* ---------- 页面状态（只存 B1 DTO / 请求状态） ---------- */
  var state = {
    tools: [],
    harnesses: [],
    loading: true,
    error: null
  };

  var filterKind = '';
  var filterStatus = '';
  var filterKw = '';

  /* ---------- 页面骨架 ---------- */
  var body = DF.renderShell({
    active: 'tools',
    breadcrumb: [{ label: '资产与注册' }, { label: '工具与集成' }],
    title: '工具与集成',
    subtitle: '确定性工具注册与引用治理 · B1 未提供调试',
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
          KINDS.map(function (k) {
            return '<option value="' + k.value + '">' + k.label + '</option>';
          }).join('') +
        '</select>' +
        '<select class="inp inp-sm" id="tl-ft-status" title="按状态筛选">' +
          '<option value="">全部</option>' +
          STATUSES.map(function (s) {
            return '<option value="' + s.value + '">' + s.label + '</option>';
          }).join('') +
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
          '<div class="tl-empty-sub">B1 未提供 CI/CD 集成接口，本页仅保留占位</div>',
        style: 'padding:70px 20px'
      }) + '</div>' +
    '</div>';

  /* ---------- Tab 切换 ---------- */
  body.querySelector('#tl-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab) return;
    var tabs = body.querySelectorAll('#tl-tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i] === tab);
    }
    body.querySelector('#tl-tab-tools').classList.toggle('tl-hide', tab.getAttribute('data-tab') !== 'tools');
    body.querySelector('#tl-tab-cicd').classList.toggle('tl-hide', tab.getAttribute('data-tab') !== 'cicd');
  });

  /* ---------- 筛选与入口按钮 ---------- */
  body.querySelector('#tl-ft-type').onchange = function () { filterKind = this.value; renderTable(); };
  body.querySelector('#tl-ft-status').onchange = function () { filterStatus = this.value; renderTable(); };
  body.querySelector('#tl-ft-kw').oninput = function () { filterKw = this.value.trim().toLowerCase(); renderTable(); };
  document.getElementById('tl-add').onclick = openCreate;
  body.querySelector('#tl-btn-add').onclick = openCreate;

  /* 把同步抛错的传输层也收敛成 rejected Promise，统一走页面错误态 */
  function run(fn) {
    return new Promise(function (resolve) { resolve(fn()); });
  }

  /* ---------- 数据加载 ---------- */
  function loadPage() {
    state.loading = true;
    state.error = null;
    renderTable();
    return Promise.all([
      run(function () { return API.list('tool', { limit: 200 }); }),
      run(function () { return API.list('harness', { limit: 200 }); })
    ]).then(function (res) {
      state.tools = res[0].items || [];
      state.harnesses = res[1].items || [];
      state.loading = false;
      renderTable();
    }).catch(function (err) {
      state.loading = false;
      state.error = err;
      renderTable();
    });
  }

  function loadTools() {
    state.loading = true;
    state.error = null;
    renderTable();
    return run(function () { return API.list('tool', { limit: 200 }); }).then(function (page) {
      state.tools = page.items || [];
      state.loading = false;
      renderTable();
    }).catch(function (err) {
      state.loading = false;
      state.error = err;
      renderTable();
    });
  }

  /* ---------- 错误文案 ---------- */
  function errText(err) {
    if (err && (err.code === 'referenced' || err.code === 'name_conflict') && err.message) return err.message;
    return API.errorText(err);
  }

  /* ---------- 工具表格 ---------- */
  function kindLabel(kind) {
    return KIND_LABEL[kind] || kind || '—';
  }

  function statusLabel(status) {
    return STATUS_LABEL[status] || status || '—';
  }

  function paramCount(t) {
    if (t.paramCount != null) return t.paramCount;
    return (t.params || []).length;
  }

  function harnessLabel(t) {
    for (var i = 0; i < state.harnesses.length; i++) {
      if (state.harnesses[i].id === t.harnessId) return state.harnesses[i].name;
    }
    return t.harnessName || t.harnessId || '—';
  }

  function lastDebugCell(t) {
    if (t.lastDebugAt == null) return '—';
    var ms = Date.parse(t.lastDebugAt);
    if (isNaN(ms)) return DF.esc(t.lastDebugAt);
    return '<span title="' + DF.esc(t.lastDebugAt) + '">' +
      DF.relTime((Date.now() - ms) / 60000) + '</span>';
  }

  function filteredTools() {
    return state.tools.filter(function (t) {
      if (filterKind && t.kind !== filterKind) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterKw) {
        var hay = [t.name, t.invocation, t.description].join(' ').toLowerCase();
        if (hay.indexOf(filterKw) < 0) return false;
      }
      return true;
    });
  }

  function rowHtml(t) {
    var used = t.usedByCount == null ? 0 : t.usedByCount;
    var delTitle = used > 0
      ? ' title="被 ' + used + ' 个专家引用，删除时后端会拒绝"'
      : ' title="删除工具"';
    return '<tr>' +
      '<td><span class="mono rowlink" data-act="edit" data-id="' + DF.esc(t.id) + '" title="编辑工具">' +
        DF.esc(t.name) + '</span></td>' +
      '<td>' + DF.tag(kindLabel(t.kind), KIND_COLOR[t.kind] || 'gray') + '</td>' +
      '<td><div class="mono ellipsis" style="max-width:280px" title="' + DF.esc(t.invocation) + '">' +
        DF.esc(t.invocation) + '</div>' +
        '<div class="sub">' + paramCount(t) + ' 个参数</div></td>' +
      '<td><a class="tag gray tl-hlink" href="harnesses.html" title="前往 Harness 管理">' +
        DF.esc(harnessLabel(t)) + '</a></td>' +
      '<td><span title="B1 未提供调试，状态由后端返回">' +
        DF.tag(statusLabel(t.status), STATUS_COLOR[t.status] || 'gray') + '</span></td>' +
      '<td><a class="tl-count" data-act="refs" data-id="' + DF.esc(t.id) + '" title="查看引用计数">' +
        used + '</a></td>' +
      '<td>' + lastDebugCell(t) + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn sm" data-act="edit" data-id="' + DF.esc(t.id) + '">编辑</button> ' +
        '<button class="btn sm danger" data-act="del" data-id="' + DF.esc(t.id) + '"' + delTitle + '>删除</button>' +
      '</td></tr>';
  }

  function renderTable() {
    var box = document.getElementById('tl-table');
    if (!box) return;

    if (state.loading) {
      box.innerHTML = '<div class="card">' + DF.empty({
        icon: 'tool', iconSize: 40,
        html: '<div class="tl-empty-title">正在加载工具列表…</div>' +
          '<div class="tl-empty-sub">从 B1 读取工具与 Harness</div>'
      }) + '</div>';
      return;
    }

    if (state.error) {
      box.innerHTML = '<div class="card">' + DF.empty({
        icon: 'warn', iconSize: 40,
        html: '<div class="tl-empty-title">工具列表加载失败</div>' +
          '<div class="tl-empty-sub">' + DF.esc(errText(state.error)) + '</div>',
        action: { id: 'tl-retry', label: '重新加载', icon: 'retry', primary: true }
      }) + '</div>';
      var retry = box.querySelector('#tl-retry');
      if (retry) retry.onclick = loadPage;
      return;
    }

    var list = filteredTools();
    if (!list.length) {
      var noneAll = !state.tools.length;
      box.innerHTML = '<div class="card">' + DF.empty({
        icon: 'tool', iconSize: 40,
        html: noneAll
          ? '<div class="tl-empty-title">还没有注册任何工具</div>' +
            '<div class="tl-empty-sub" style="margin-bottom:14px">注册第一个确定性工具，减少对模型的依赖</div>'
          : '<div class="tl-empty-title" style="font-weight:400">未找到匹配的工具</div>' +
            '<div class="tl-empty-sub">调整类型 / 状态 / 搜索条件后重试</div>',
        action: noneAll ? { id: 'tl-empty-add', label: '注册工具', icon: 'plus', primary: true } : null
      }) + '</div>';
      var emptyAdd = box.querySelector('#tl-empty-add');
      if (emptyAdd) emptyAdd.onclick = openCreate;
      return;
    }

    box.innerHTML = DF.table(
      ['名称', '类型', '调用方式', '所属 Harness', '状态', '被引用数', '最近调试', '操作'],
      list.map(rowHtml)
    );
    bindActs(box);
  }

  function findTool(id) {
    for (var i = 0; i < state.tools.length; i++) {
      if (state.tools[i].id === id) return state.tools[i];
    }
    return null;
  }

  function bindActs(root) {
    var nodes = root.querySelectorAll('[data-act]');
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        var t = findTool(el.getAttribute('data-id'));
        if (!t) return;
        var act = el.getAttribute('data-act');
        el.onclick = function () {
          if (act === 'edit') startEdit(t);
          else if (act === 'del') confirmDelete(t, el);
          else if (act === 'refs') openRefs(t);
        };
      })(nodes[i]);
    }
  }

  /* ---------- 引用计数（B1 只有 usedByCount，无引用方明细接口） ---------- */
  function openRefs(t) {
    var used = t.usedByCount == null ? 0 : t.usedByCount;
    DF.modal.open({
      title: '引用详情 · ' + t.name,
      width: 480,
      body:
        '<div style="font-size:12px;color:var(--t-3);margin-bottom:4px">引用该工具的专家数</div>' +
        '<div style="font-size:24px;font-weight:700;margin-bottom:14px">' + used + '</div>' +
        '<div class="notice warn" style="margin-bottom:0">' + DF.icon('warn', 14) +
          '<div>B1 未提供引用方明细，这里只显示引用计数。</div></div>',
      footer: '<button class="btn primary" id="tl-ref-close">关闭</button>',
      onMount: function (b, close) {
        b.closest('.modal').querySelector('#tl-ref-close').onclick = close;
      }
    });
  }

  /* ---------- 删除 ---------- */
  function revisionOf(dto) {
    var rev = API.revision('tool', dto.id);
    return rev == null ? dto.revision : rev;
  }

  function confirmDelete(t, btn) {
    DF.modal.confirm({
      title: '删除工具',
      html: '确定删除工具 <b>' + DF.esc(t.name) + '</b> 吗？删除后不可恢复。' +
        (t.usedByCount > 0 ? '<div class="tl-empty-sub" style="margin-top:8px">该工具仍被专家引用，后端会拒绝删除。</div>' : ''),
      danger: true,
      okText: '删除'
    }).then(function (yes) {
      if (!yes) return;
      if (btn) btn.disabled = true;
      run(function () { return API.remove('tool', t.id, revisionOf(t)); }).then(function () {
        DF.toast('已删除工具 ' + t.name, 'ok');
        loadTools();
      }).catch(function (err) {
        if (btn) btn.disabled = false;
        DF.toast('删除失败：' + errText(err), 'err');
      });
    });
  }

  /* ---------- 注册 / 编辑弹窗 ---------- */
  function openCreate() {
    if (state.loading) { DF.toast('工具数据加载中，请稍后再试', 'warn'); return; }
    if (state.error) { DF.toast('工具数据加载失败，请先重试', 'err'); return; }
    if (!state.harnesses.length) { DF.toast('暂无可用 Harness，请先在 Harness 管理页创建', 'err'); return; }
    openEditor(null);
  }

  function startEdit(t) {
    run(function () { return API.get('tool', t.id); }).then(function (detail) {
      openEditor(detail);
    }).catch(function (err) {
      DF.toast('加载工具详情失败：' + errText(err), 'err');
    });
  }

  function collectParams(pbox) {
    var params = [];
    var seen = Object.create(null);
    var rows = pbox.querySelectorAll('.tl-frow');
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].querySelector('.tl-fk').value.trim();
      var description = rows[i].querySelector('.tl-fd').value.trim();
      if (!key) {
        if (description) return { error: '第 ' + (i + 1) + ' 行参数缺少键' };
        continue;
      }
      if (seen[key]) return { error: '参数键重复：' + key };
      seen[key] = true;
      params.push({
        key: key,
        type: rows[i].querySelector('.tl-ft').value,
        description: description
      });
    }
    return { params: params };
  }

  function openEditor(existing) {
    var isEdit = !!existing;
    var draft = existing || {
      name: '',
      kind: 'cli',
      invocation: '',
      description: '',
      harnessId: state.harnesses.length ? state.harnesses[0].id : '',
      timeoutMs: 30000,
      params: []
    };

    var harnessOpts = state.harnesses.map(function (h) {
      return '<option value="' + DF.esc(h.id) + '"' +
        (h.id === draft.harnessId ? ' selected' : '') + '>' + DF.esc(h.name) + '</option>';
    }).join('');

    var harnessFound = false;
    for (var hi = 0; hi < state.harnesses.length; hi++) {
      if (state.harnesses[hi].id === draft.harnessId) { harnessFound = true; break; }
    }
    if (draft.harnessId && !harnessFound) {
      harnessOpts += '<option value="' + DF.esc(draft.harnessId) + '" selected>' +
        DF.esc(draft.harnessName || draft.harnessId) + '（不在 Harness 列表）</option>';
    }
    if (!harnessOpts) {
      harnessOpts = '<option value="">暂无可用 Harness</option>';
    } else if (!draft.harnessId) {
      harnessOpts = '<option value="">请选择 Harness</option>' + harnessOpts;
    }

    var segHtml = KINDS.map(function (k) {
      return '<button type="button" data-v="' + k.value + '"' +
        (draft.kind === k.value ? ' class="on"' : '') + '>' + k.label + '</button>';
    }).join('');

    var html =
      '<div class="field"><label>名称<span class="req">*</span></label>' +
        '<input class="inp mono" id="tl-f-name" maxlength="80" placeholder="如 trace_call_chain" value="' +
          DF.esc(draft.name) + '"></div>' +
      '<div class="field"><label>类型</label><div class="seg" id="tl-f-type">' + segHtml + '</div></div>' +
      '<div class="field"><label>调用方式<span class="req">*</span></label>' +
        '<input class="inp mono" id="tl-f-inv" maxlength="500" placeholder="如 trace --symbol {symbol}" value="' +
          DF.esc(draft.invocation) + '">' +
        '<div class="hint">{} 为参数占位符，按参数定义替换（B1 不执行工具）</div></div>' +
      '<div class="field"><label>参数定义</label><div id="tl-f-params"></div>' +
        '<button class="btn sm" type="button" id="tl-f-addp">' + DF.icon('plus', 12) + '添加参数</button></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>超时（ms）</label>' +
          '<input class="inp" id="tl-f-timeout" type="number" min="1000" max="600000" step="1000" value="' +
            DF.esc(draft.timeoutMs == null ? '' : draft.timeoutMs) + '"></div>' +
        '<div class="field"><label>所属 Harness<span class="req">*</span></label>' +
          '<select class="inp" id="tl-f-harness">' + harnessOpts + '</select></div>' +
      '</div>' +
      '<div class="field"><label>说明</label>' +
        '<textarea class="inp" id="tl-f-desc" maxlength="500" placeholder="工具用途说明">' +
          DF.esc(draft.description || '') + '</textarea></div>';

    var kind = draft.kind;
    var pbox = null;
    var okBtn = null;
    var saving = false;
    var okText = isEdit ? '保存' : '注册';

    DF.modal.form({
      title: isEdit ? '编辑工具 · ' + draft.name : '注册工具',
      width: 560,
      body: html,
      okText: okText,
      onMount: function (b, close, btn) {
        okBtn = btn;

        var seg = b.querySelector('#tl-f-type');
        seg.addEventListener('click', function (e) {
          var target = e.target.closest('button');
          if (!target) return;
          kind = target.getAttribute('data-v');
          var buttons = seg.querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.toggle('on', buttons[i] === target);
          }
        });

        pbox = b.querySelector('#tl-f-params');
        function addRow(p) {
          p = p || { key: '', type: 'string', description: '' };
          var row = document.createElement('div');
          row.className = 'tl-frow';
          row.innerHTML =
            '<input class="inp mono inp-sm tl-fk" placeholder="键（如 symbol）" value="' + DF.esc(p.key) + '">' +
            '<select class="inp inp-sm tl-ft">' +
              PARAM_TYPES.map(function (type) {
                return '<option value="' + type + '"' +
                  (p.type === type ? ' selected' : '') + '>' + type + '</option>';
              }).join('') +
            '</select>' +
            '<input class="inp inp-sm tl-fd" placeholder="说明" value="' + DF.esc(p.description) + '">' +
            '<button class="icon-btn tl-fx" type="button" title="移除该参数">' + DF.icon('x', 14) + '</button>';
          row.querySelector('.tl-fx').onclick = function () { row.remove(); };
          pbox.appendChild(row);
        }

        var initial = draft.params || [];
        for (var pi = 0; pi < initial.length; pi++) addRow(initial[pi]);
        if (!initial.length) addRow();
        b.querySelector('#tl-f-addp').onclick = function () { addRow(); };
      },
      onOk: function (b, close) {
        if (saving) return;

        var name = b.querySelector('#tl-f-name').value.trim();
        var invocation = b.querySelector('#tl-f-inv').value.trim();
        var description = b.querySelector('#tl-f-desc').value.trim();
        var timeoutMs = parseInt(b.querySelector('#tl-f-timeout').value, 10);
        var harnessId = b.querySelector('#tl-f-harness').value;

        if (!name) { DF.toast('名称为必填项', 'err'); return; }
        if (name.length > 80) { DF.toast('名称不能超过 80 个字符', 'err'); return; }
        if (!invocation) { DF.toast('调用方式为必填项', 'err'); return; }
        if (invocation.length > 500) { DF.toast('调用方式不能超过 500 个字符', 'err'); return; }
        if (description.length > 500) { DF.toast('说明不能超过 500 个字符', 'err'); return; }
        if (!(timeoutMs >= 1000 && timeoutMs <= 600000)) {
          DF.toast('超时需在 1000–600000 ms 之间', 'err');
          return;
        }
        if (!harnessId) { DF.toast('请选择所属 Harness', 'err'); return; }

        var collected = collectParams(pbox);
        if (collected.error) { DF.toast(collected.error, 'err'); return; }

        var payload = {
          name: name,
          kind: kind,
          invocation: invocation,
          description: description,
          harnessId: harnessId,
          timeoutMs: timeoutMs,
          params: collected.params
        };

        saving = true;
        if (okBtn) {
          okBtn.disabled = true;
          okBtn.textContent = '保存中…';
        }

        var task = run(function () {
          return isEdit
            ? API.update('tool', draft.id, payload, revisionOf(draft))
            : API.create('tool', payload);
        });

        task.then(function () {
          close();
          DF.toast(isEdit ? '已保存修改' : '已注册工具', 'ok');
          loadTools();
        }).catch(function (err) {
          saving = false;
          if (okBtn) {
            okBtn.disabled = false;
            okBtn.textContent = okText;
          }
          DF.toast((isEdit ? '保存失败：' : '注册失败：') + errText(err), 'err');
        });
      }
    });
  }

  /* ---------- 首次加载 ---------- */
  loadPage();
