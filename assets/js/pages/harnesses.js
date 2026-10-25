/**
 * AgentFlow · Harness 管理页（列表 + 详情抽屉 + 注册弹窗）
 * 依赖: ../assets/js/ui.js (window.DF) / ../assets/js/api.js (window.API)
 * 数据约定: 页面状态直接保存 B1 Harness DTO；中文标签仅在渲染/选项时按映射即时转换；不读本地夹具。
 */
(function () {
  'use strict';

  /* ---------------- 常量（B1 枚举 → 展示文案，仅渲染时即时转换） ---------------- */
  var PRESET_TAGS = ['CICD', '构建', '测试', '审视', '检索', '批处理', '造数', '回放', '数据', '调试'];
  var KIND_TXT = { container: '容器', server: '服务器', desktop: '台式机', laptop: '笔记本' };
  var KIND_KEYS = ['container', 'server', 'desktop', 'laptop'];
  var ACCESS_TXT = { agent: '常驻 Agent', ssh: 'SSH', container_registry: '容器注册' };
  var ACCESS_KEYS = ['agent', 'ssh', 'container_registry'];
  var HEALTH_TXT = { online: '在线', offline: '离线', overloaded: '高负载', unknown: '未知' };
  var QUEUE_TXT = { fifo: '先进先出', priority: '优先级' };
  var QUEUE_KEYS = ['fifo', 'priority'];

  var body = null; // #page-body

  /* 页面状态：只保存 API DTO 列表与分页信息，不构造视图模型 */
  var state = { items: [], total: 0, loading: true, error: null };
  var pending = {}; // 写操作进行中的 Harness id，防止重复提交

  /* ---------------- 通用工具 ---------------- */
  function label(map, key) {
    if (key == null || key === '') return '—';
    return map[key] || String(key);
  }
  function find(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }
  function upsert(dto, isNew) {
    if (!dto || !dto.id) return;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === dto.id) { state.items[i] = dto; return; }
    }
    state.items.unshift(dto);
    if (isNew) state.total = (typeof state.total === 'number' ? state.total : state.items.length - 1) + 1;
  }
  function removeDto(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) {
        state.items.splice(i, 1);
        state.total = Math.max(0, (typeof state.total === 'number' ? state.total : state.items.length + 1) - 1);
        return;
      }
    }
  }
  function revOf(h) {
    var r = API.revision('harness', h.id);
    return r == null ? h.revision : r;
  }
  function pendingGuard(key) {
    if (pending[key]) { DF.toast('操作进行中，请稍候', 'warn'); return false; }
    pending[key] = true;
    return true;
  }
  function pendingDone(key) { delete pending[key]; }

  function parseIso(v) {
    if (!v) return null;
    var t = Date.parse(v);
    return isNaN(t) ? null : new Date(t);
  }
  function relIso(v) {
    var d = parseIso(v);
    if (!d) return '—';
    var min = (Date.now() - d.getTime()) / 60000;
    if (min < 0) min = 0;
    return DF.relTime(min);
  }
  function fmtIso(v) {
    var d = parseIso(v);
    if (!d) return '—';
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function healthColor(h) {
    if (h.health === 'online') return 'green';
    if (h.health === 'overloaded') return 'orange';
    return 'gray';
  }
  function dotColor(h) {
    if (!h.enabled) return 'gray';
    return healthColor(h);
  }
  function healthTag(h) { return DF.tag(label(HEALTH_TXT, h.health), healthColor(h)); }
  function healthCell(h) { return h.enabled ? healthTag(h) : DF.tag('已停用', 'gray'); }
  function hbCell(h) {
    var t = relIso(h.lastHeartbeatAt);
    if (!h.enabled) return t + '<div class="sub">已停用</div>';
    if (!h.lastHeartbeatAt) return '—<div class="sub">暂无心跳</div>';
    if (h.health === 'offline') return t + '<div class="sub" style="color:var(--c-fail)">离线</div>';
    return t;
  }
  function chipsHtml(tags) {
    if (!tags || !tags.length) return '<span class="sub">—</span>';
    return tags.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('');
  }
  function stats() {
    var hs = state.items;
    return {
      total: typeof state.total === 'number' ? state.total : hs.length,
      online: hs.filter(function (h) { return h.enabled && h.health === 'online'; }).length,
      offline: hs.filter(function (h) { return h.health === 'offline'; }).length,
      disabled: hs.filter(function (h) { return !h.enabled; }).length
    };
  }
  function selectHtml(attr, keys, map, selected) {
    return '<select class="inp" ' + attr + '>' + keys.map(function (k) {
      return '<option value="' + DF.esc(k) + '"' + (k === selected ? ' selected' : '') + '>' + DF.esc(label(map, k)) + '</option>';
    }).join('') + '</select>';
  }
  function validateForm(name, address, max, description) {
    if (!name) return '请填写名称';
    if (name.length > 80) return '名称不能超过 80 个字符';
    if (!address) return '请填写接入地址';
    if (address.length > 200) return '接入地址不能超过 200 个字符';
    if (!(max >= 1)) return '并发上限需 ≥ 1';
    if (description.length > 500) return '描述不能超过 500 个字符';
    return null;
  }

  /* ---------------- 表格 ---------------- */
  function actBtn(act, h, text, danger) {
    return '<button class="btn link sm"' + (danger ? ' style="color:var(--c-fail)"' : '') +
      ' data-act="' + act + '" data-id="' + DF.esc(h.id) + '">' + text + '</button>';
  }
  function actsCell(h) {
    return '<div class="ha-acts">' + actBtn('detail', h, '详情') + actBtn('edit', h, '编辑') +
      actBtn('toggle', h, h.enabled ? '停用' : '启用') + actBtn('del', h, '删除', true) + '</div>';
  }
  function tableHtml() {
    var rows = state.items.map(function (h) {
      var dim = (!h.enabled || h.health === 'offline') ? ' class="ha-dim"' : '';
      return '<tr' + dim + '>' +
        '<td><span class="rowlink" data-act="detail" data-id="' + DF.esc(h.id) + '" title="查看详情">' +
        DF.dot(dotColor(h)) + DF.esc(h.name) + '</span></td>' +
        '<td class="ha-type">' + DF.icon('server', 14) + ' ' + DF.esc(label(KIND_TXT, h.kind)) + '</td>' +
        '<td class="mono">' + DF.esc(h.address) + '</td>' +
        '<td>' + DF.esc(label(ACCESS_TXT, h.accessMode)) + '</td>' +
        '<td><div class="chips">' + chipsHtml(h.tags) + '</div></td>' +
        '<td>' + healthCell(h) + '</td>' +
        '<td>' + hbCell(h) + '</td>' +
        '<td class="mono">' + DF.esc(h.concurrencyMax) + '</td>' +
        '<td>' + actsCell(h) + '</td>' +
        '</tr>';
    });
    return DF.table(
      ['名称', '类型', '接入地址', '接入方式', '能力标签', '健康', '最近心跳', '并发上限', { t: '操作', s: 'style="width:200px"' }],
      rows
    );
  }
  function emptyHtml() {
    return '<div class="card">' + DF.empty({
      icon: '🖥️',
      html: '<div style="margin-bottom:14px">注册第一台 Harness，Agent 将在此执行任务</div>',
      action: { act: 'reg', label: '注册 Harness', icon: 'plus', primary: true }
    }) + '</div>';
  }
  function loadingHtml() {
    return '<div class="card">' + DF.empty({ icon: '⏳', html: '正在加载 Harness 列表…' }) + '</div>';
  }
  function errorHtml() {
    return '<div class="card">' + DF.empty({
      icon: '⚠️',
      html: '<div style="margin-bottom:6px">Harness 列表加载失败</div>' +
        '<div class="sub" style="margin-bottom:2px">' + DF.esc(API.errorText(state.error)) + '</div>',
      action: { act: 'retry', label: '重试', icon: 'refresh', primary: true }
    }) + '</div>';
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!body) return;
    if (state.loading) { body.innerHTML = loadingHtml(); return; }
    if (state.error) { body.innerHTML = errorHtml(); return; }
    var s = stats();
    body.innerHTML = DF.statRow([
      DF.statCard({ k: '总数', v: s.total }),
      DF.statCard({ k: '在线', v: s.online, dot: 'green' }),
      DF.statCard({ k: '离线', v: s.offline, dot: 'gray' }),
      DF.statCard({ k: '停用', v: s.disabled, dot: 'gray' })
    ]) + (state.items.length ? tableHtml() : emptyHtml());
  }

  function loadList() {
    state.loading = true;
    state.error = null;
    render();
    API.list('harness', { limit: 200 }).then(function (page) {
      if (!page || !Array.isArray(page.items)) throw new Error('B1 返回的 Harness 列表格式不正确');
      state.items = page.items;
      state.total = typeof page.total === 'number' ? page.total : state.items.length;
      state.loading = false;
      render();
    }).catch(function (err) {
      state.loading = false;
      state.error = err || new Error('加载失败');
      render();
    });
  }

  /* ---------------- 能力标签编辑器（注册弹窗 / 抽屉编辑态共用） ---------------- */
  function fillTags(box, tags, editable) {
    if (!box) return;
    var cur = tags.map(function (t) {
      return '<span class="chip">' + DF.esc(t) + (editable ? '<i class="x" data-rm="' + DF.esc(t) + '" title="移除">✕</i>' : '') + '</span>';
    }).join('');
    var html = '<div class="chips">' + (cur || '<span style="font-size:12px;color:var(--t-3)">暂无标签</span>') + '</div>';
    if (editable) {
      html += '<div class="ha-chips-add"><span class="lbl">预置:</span>' +
        PRESET_TAGS.map(function (t) {
          return '<span class="chip ha-pchip' + (tags.indexOf(t) >= 0 ? ' on' : '') + '" data-add="' + DF.esc(t) + '">' + DF.esc(t) + '</span>';
        }).join('') + '</div>' +
        '<div class="ha-chips-add"><span class="lbl">自定义:</span>' +
        '<input class="inp inp-sm" data-tag-inp style="width:190px" placeholder="输入标签后回车添加"></div>';
    }
    box.innerHTML = html;
    if (!editable) return;
    box.querySelectorAll('[data-rm]').forEach(function (x) {
      x.onclick = function () {
        var t = x.getAttribute('data-rm');
        var i = tags.indexOf(t);
        if (i >= 0) tags.splice(i, 1);
        fillTags(box, tags, true);
      };
    });
    box.querySelectorAll('[data-add]').forEach(function (p) {
      p.onclick = function () {
        var t = p.getAttribute('data-add');
        if (tags.indexOf(t) < 0) tags.push(t);
        fillTags(box, tags, true);
      };
    });
    var inp = box.querySelector('[data-tag-inp]');
    inp.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var v = inp.value.trim();
      if (v && tags.indexOf(v) < 0) tags.push(v);
      fillTags(box, tags, true);
      var n = box.querySelector('[data-tag-inp]');
      if (n) n.focus();
    };
  }

  /* ---------------- 详情抽屉 ---------------- */
  function needsDetail(dto) {
    return !dto || dto.description === undefined || dto.createdAt === undefined;
  }
  function detailKv(d, opt) {
    var desc = opt.loading ? '<span class="sub">加载中…</span>' :
      (opt.error ? '—' : (DF.esc(d.description) || '—'));
    var created = opt.loading ? '<span class="sub">加载中…</span>' :
      (opt.error ? '—' : DF.esc(fmtIso(d.createdAt)));
    return DF.kv([
      ['名称', '<span class="ha-kv-name">' + DF.esc(d.name) + '</span>'],
      ['类型', DF.icon('server', 14) + ' ' + DF.esc(label(KIND_TXT, d.kind))],
      ['接入地址', '<span class="mono">' + DF.esc(d.address) + '</span>'],
      ['接入方式', DF.esc(label(ACCESS_TXT, d.accessMode))],
      ['描述', desc],
      ['注册时间', created],
      ['更新时间', DF.esc(fmtIso(d.updatedAt))]
    ]);
  }
  function runtimeKv(d) {
    return DF.kv([
      ['健康', healthTag(d)],
      ['启停', d.enabled ? DF.tag('启用', 'green') : DF.tag('停用', 'gray')],
      ['最近心跳', d.lastHeartbeatAt
        ? DF.esc(relIso(d.lastHeartbeatAt)) + '（' + DF.esc(fmtIso(d.lastHeartbeatAt)) + '）'
        : '—'],
      ['引用工具', DF.esc(d.toolCount) + ' 个']
    ]);
  }
  function detailReadHtml(d, opt) {
    opt = opt || {};
    var html = '';
    if (opt.error) {
      html += '<div class="warn-box" style="margin-bottom:12px">详情加载失败：' + DF.esc(opt.error) +
        '（当前仅展示列表字段）</div>';
    }
    html += '<div class="section-title">① 基本信息<span class="line"></span></div>' + detailKv(d, opt);
    html += '<div class="section-title">② 能力标签<span class="line"></span></div>' +
      '<div class="ha-chips-box" data-tags>' + chipsHtml(d.tags) + '</div>';
    html += '<div class="section-title">③ 配额<span class="line"></span></div>' +
      DF.kv([
        ['并发上限', DF.esc(d.concurrencyMax) + ' 个'],
        ['排队策略', DF.esc(label(QUEUE_TXT, d.queuePolicy))]
      ]);
    html += '<div class="section-title">④ 运行状态<span class="line"></span></div>' + runtimeKv(d);
    return html;
  }
  function openDetail(h) {
    var current = h;
    var loading = needsDetail(h);
    DF.drawer.open({
      title: 'Harness 详情 · ' + h.name,
      width: 720,
      body: detailReadHtml(h, { loading: loading }),
      footer: '<button class="btn" data-foot="close">关闭</button>' +
        '<button class="btn primary" data-foot="edit">' + DF.icon('edit', 14) + '编辑</button>',
      onMount: function (b, close) {
        var foot = b.closest('.drawer').querySelector('.d-foot'); // 页脚是 d-body 的兄弟节点，需向上取
        foot.querySelector('[data-foot="close"]').onclick = close;
        foot.querySelector('[data-foot="edit"]').onclick = function () { close(); openEdit(current); };
        if (!loading) return;
        API.get('harness', h.id).then(function (dto) {
          current = dto;
          upsert(dto);
          b.innerHTML = detailReadHtml(dto, {});
          render();
        }).catch(function (err) {
          b.innerHTML = detailReadHtml(current, { error: API.errorText(err) });
          DF.toast('详情加载失败：' + API.errorText(err), 'err');
        });
      }
    });
  }
  function ensureDetail(dto) {
    if (!needsDetail(dto)) return Promise.resolve(dto);
    return API.get('harness', dto.id).then(function (full) {
      upsert(full);
      return full;
    });
  }

  /* ---------------- 编辑抽屉 ---------------- */
  function editBody(d) {
    var html = '<div class="section-title">① 基本信息<span class="line"></span></div>';
    html += '<div class="ha-form-grid">' +
      '<div class="field"><label>名称<span class="req">*</span></label><input class="inp" data-f="name" value="' + DF.esc(d.name) + '"></div>' +
      '<div class="field"><label>类型</label>' + selectHtml('data-f="kind"', KIND_KEYS, KIND_TXT, d.kind) + '</div>' +
      '<div class="field"><label>接入地址<span class="req">*</span></label><input class="inp mono" data-f="address" value="' + DF.esc(d.address) + '"></div>' +
      '<div class="field"><label>接入方式</label>' + selectHtml('data-f="accessMode"', ACCESS_KEYS, ACCESS_TXT, d.accessMode) + '</div>' +
      '<div class="field full"><label>描述</label><textarea class="inp" data-f="description" rows="2" placeholder="用途说明">' + DF.esc(d.description) + '</textarea></div>' +
      '</div>' +
      '<div class="kv"><span class="k">注册时间</span><span>' + DF.esc(fmtIso(d.createdAt)) + '（不可修改）</span></div>';
    html += '<div class="section-title">② 能力标签<span class="line"></span></div><div class="ha-chips-box" data-tags></div>';
    html += '<div class="section-title">③ 配额<span class="line"></span></div>' +
      '<div class="ha-quota">' +
      '<div class="field"><label>并发上限</label><input type="number" class="inp" data-f="concurrencyMax" min="1" value="' + DF.esc(d.concurrencyMax) + '">' +
      '<div class="hint">达到上限后新任务排队等待</div></div>' +
      '<div class="field"><label>排队策略</label>' + selectHtml('data-f="queuePolicy"', QUEUE_KEYS, QUEUE_TXT, d.queuePolicy) +
      '<div class="hint">影响排队任务的调度顺序</div></div></div>';
    html += '<div class="section-title">④ 运行状态<span class="line"></span></div>' + runtimeKv(d);
    return html;
  }
  function saveEdit(h, tags, b, close, btn) {
    var name = b.querySelector('[data-f="name"]').value.trim();
    var address = b.querySelector('[data-f="address"]').value.trim();
    var max = parseInt(b.querySelector('[data-f="concurrencyMax"]').value, 10);
    var description = b.querySelector('[data-f="description"]').value.trim();
    var msg = validateForm(name, address, max, description);
    if (msg) { DF.toast(msg, 'err'); return; }
    if (!pendingGuard(h.id)) return;
    var payload = {
      name: name,
      kind: b.querySelector('[data-f="kind"]').value,
      address: address,
      accessMode: b.querySelector('[data-f="accessMode"]').value,
      description: description,
      concurrencyMax: max,
      queuePolicy: b.querySelector('[data-f="queuePolicy"]').value,
      tags: tags.slice()
    };
    btn.disabled = true;
    btn.innerHTML = '保存中…';
    API.update('harness', h.id, payload, revOf(h)).then(function (dto) {
      pendingDone(h.id);
      upsert(dto);
      DF.toast('已保存「' + (dto && dto.name ? dto.name : name) + '」', 'ok');
      close();
      render();
    }).catch(function (err) {
      pendingDone(h.id);
      btn.disabled = false;
      btn.innerHTML = DF.icon('check', 14) + '保存';
      DF.toast(API.errorText(err), 'err');
    });
  }
  function openEdit(h) {
    ensureDetail(h).then(function (full) {
      var tags = (full.tags || []).slice();
      DF.drawer.open({
        title: '编辑 Harness · ' + full.name,
        width: 720,
        body: editBody(full),
        footer: '<button class="btn" data-foot="cancel">取消</button>' +
          '<button class="btn primary" data-foot="save">' + DF.icon('check', 14) + '保存</button>',
        onMount: function (b, close) {
          var foot = b.closest('.drawer').querySelector('.d-foot');
          fillTags(b.querySelector('[data-tags]'), tags, true);
          foot.querySelector('[data-foot="cancel"]').onclick = close;
          var saveBtn = foot.querySelector('[data-foot="save"]');
          saveBtn.onclick = function () { saveEdit(full, tags, b, close, saveBtn); };
        }
      });
    }).catch(function (err) {
      DF.toast('无法加载 Harness 详情：' + API.errorText(err), 'err');
    });
  }

  /* ---------------- 启用 / 停用 / 删除 ---------------- */
  function toggleEnabled(h) {
    var next = !h.enabled;
    var fixed = {
      title: next ? '启用 Harness' : '停用 Harness',
      danger: !next,
      okText: next ? '确认启用' : '确认停用',
      html: next
        ? '确定启用 <b>' + DF.esc(h.name) + '</b>（' + DF.esc(h.address) + '）？启用后恢复接收新任务。'
        : '确定停用 <b>' + DF.esc(h.name) + '</b>（' + DF.esc(h.address) + '）？' +
          '<div class="sub" style="margin-top:6px">停用后该 Harness 不再接收新任务。</div>'
    };
    var run = function () {
      if (!pendingGuard(h.id)) return;
      API.setEnabled('harness', h.id, next, revOf(h)).then(function (dto) {
        pendingDone(h.id);
        upsert(dto);
        DF.toast((dto.enabled ? '已启用「' : '已停用「') + dto.name + '」', dto.enabled ? 'ok' : 'warn');
        render();
      }).catch(function (err) {
        pendingDone(h.id);
        DF.toast(API.errorText(err), 'err');
        render();
      });
    };
    if (next) { run(); return; }
    DF.modal.confirm(fixed).then(function (ok) { if (ok) run(); });
  }
  function delHarness(h) {
    DF.modal.confirm({
      title: '删除 Harness',
      danger: true,
      okText: '确认删除',
      html: '确定删除 <b>' + DF.esc(h.name) + '</b>（' + DF.esc(h.address) + '）？删除后不可恢复；仍被工具引用时将删除失败。'
    }).then(function (ok) {
      if (!ok) return;
      if (!pendingGuard(h.id)) return;
      API.remove('harness', h.id, revOf(h)).then(function () {
        pendingDone(h.id);
        removeDto(h.id);
        DF.toast('已删除「' + h.name + '」', 'ok');
        render();
      }).catch(function (err) {
        pendingDone(h.id);
        DF.toast(API.errorText(err), 'err');
      });
    });
  }

  /* ---------------- 注册弹窗 ---------------- */
  function openRegister() {
    var tags = [];
    DF.modal.form({
      title: '注册 Harness',
      width: 560,
      body: '<div class="ha-form-grid">' +
        '<div class="field"><label>名称<span class="req">*</span></label><input class="inp" data-m="name" placeholder="如 build-03"></div>' +
        '<div class="field"><label>类型</label><div class="seg" data-m="kind">' +
        KIND_KEYS.map(function (k, i) {
          return '<button type="button" data-v="' + DF.esc(k) + '"' + (i === 0 ? ' class="on"' : '') + '>' + DF.esc(label(KIND_TXT, k)) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>接入地址<span class="req">*</span></label><input class="inp mono" data-m="address" placeholder="10.0.4.13:7801">' +
        '<div class="hint">格式 host:port，注册后 Agent 将主动连接</div></div>' +
        '<div class="field"><label>接入方式</label>' + selectHtml('data-m="accessMode"', ACCESS_KEYS, ACCESS_TXT, 'agent') + '</div>' +
        '<div class="field full"><label>能力标签</label><div class="ha-chips-box" data-tags></div></div>' +
        '<div class="field"><label>并发上限<span class="req">*</span></label><input type="number" class="inp" data-m="concurrencyMax" min="1" value="10"></div>' +
        '<div class="field"><label>排队策略</label>' + selectHtml('data-m="queuePolicy"', QUEUE_KEYS, QUEUE_TXT, 'fifo') + '</div>' +
        '<div class="field full"><label>描述</label><input class="inp" data-m="description" placeholder="用途说明（可选）"></div>' +
        '</div>',
      okText: '确定注册',
      onMount: function (b, close, okBtn) {
        var seg = b.querySelector('[data-m="kind"]');
        seg.querySelectorAll('button').forEach(function (bt) {
          bt.onclick = function () {
            seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
            bt.classList.add('on');
          };
        });
        fillTags(b.querySelector('[data-tags]'), tags, true);

        okBtn.onclick = function () {
          var name = b.querySelector('[data-m="name"]').value.trim();
          var address = b.querySelector('[data-m="address"]').value.trim();
          var max = parseInt(b.querySelector('[data-m="concurrencyMax"]').value, 10);
          var description = b.querySelector('[data-m="description"]').value.trim();
          var msg = validateForm(name, address, max, description);
          if (msg) { DF.toast(msg, 'err'); return; }
          if (!pendingGuard('__create__')) return;
          var payload = {
            name: name,
            kind: seg.querySelector('.on').getAttribute('data-v'),
            address: address,
            accessMode: b.querySelector('[data-m="accessMode"]').value,
            description: description,
            concurrencyMax: max,
            queuePolicy: b.querySelector('[data-m="queuePolicy"]').value,
            tags: tags.slice()
          };
          okBtn.disabled = true;
          okBtn.textContent = '注册中…';
          API.create('harness', payload).then(function (dto) {
            pendingDone('__create__');
            upsert(dto, true);
            state.error = null;
            DF.toast('已注册「' + (dto && dto.name ? dto.name : name) + '」', 'ok');
            close();
            render();
          }).catch(function (err) {
            pendingDone('__create__');
            okBtn.disabled = false;
            okBtn.textContent = '确定注册';
            DF.toast(API.errorText(err), 'err');
          });
        };
      }
    });
  }

  /* ---------------- 事件（#page-body 事件委托，重渲后依然有效） ---------------- */
  function onBodyClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var id = el.getAttribute('data-id');
    var h = id ? find(id) : null;
    switch (el.getAttribute('data-act')) {
      case 'reg': openRegister(); break;
      case 'retry': loadList(); break;
      case 'detail': if (h) openDetail(h); break;
      case 'edit': if (h) openEdit(h); break;
      case 'toggle': if (h) toggleEnabled(h); break;
      case 'del': if (h) delHarness(h); break;
    }
  }

  /* ---------------- 初始化 ---------------- */
  body = DF.renderShell({
    active: 'harnesses',
    breadcrumb: [{ label: '资产与注册' }, { label: 'Harness 管理' }],
    title: 'Harness 管理',
    subtitle: '执行设施注册与健康',
    actions: '<button class="btn primary" id="ha-reg-btn">' + DF.icon('plus', 14) + '注册 Harness</button>'
  });
  document.getElementById('ha-reg-btn').onclick = openRegister;
  body.addEventListener('click', onBodyClick);
  loadList();
})();
