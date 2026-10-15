/**
 * AgentFlow 原型 · Harness 管理页（列表 + 详情抽屉 + 注册弹窗）
 * 依赖: ../assets/js/mock-data.js (window.MOCK) / ../assets/js/ui.js (window.DF)
 * 数据约定: 直接改 MOCK.harnesses 内存对象后重渲表格；h._disabled 为页面内停用标记。
 */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  var PRESET_TAGS = ['CICD', '构建', '测试', '审视', '检索', '批处理', '造数', '回放', '数据', '调试'];
  var TYPES = ['容器', '服务器', '台式机', '笔记本'];
  var ACCESS = ['常驻 Agent', 'SSH', '容器注册'];
  var QUEUE_TXT = { fifo: '先进先出', priority: '优先级' };

  var body = null; // #page-body

  /* ---------------- 状态工具 ---------------- */
  function isOffline(h) { return h.health === '离线'; }
  function isDisabled(h) { return !!h._disabled; }
  function loadOf(h) { return h.max > 0 ? h.running / h.max : 0; }
  function isHot(h) { return !isOffline(h) && !isDisabled(h) && loadOf(h) >= 0.8; }
  function dotColor(h) {
    if (isDisabled(h) || isOffline(h)) return 'gray';
    return h.health === '高负载' || isHot(h) ? 'orange' : 'green';
  }
  function stats() {
    var hs = MOCK.harnesses;
    return {
      total: hs.length,
      online: hs.filter(function (h) { return h.health === '在线' && !isDisabled(h); }).length,
      offline: hs.filter(isOffline).length,
      hot: hs.filter(isHot).length
    };
  }
  function today() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------------- 表格 ---------------- */
  function hbCell(h) {
    var t = DF.relTime(h.heartbeatM);
    if (isDisabled(h)) return t + '<div class="sub">已停用</div>';
    if (isOffline(h)) return t + '<div class="sub" style="color:var(--c-fail)">心跳超时</div>';
    return t;
  }
  function loadCell(h) {
    var pct = Math.min(100, Math.round(loadOf(h) * 100));
    var style = isHot(h) ? 'background:var(--c-wait)' : '';
    return '<div class="ha-load"><div class="progress"><i style="width:' + pct + '%;' + style + '"></i></div>' +
      '<span class="n">' + h.running + '/' + h.max + '</span></div>';
  }
  function actBtn(act, h, label, danger) {
    return '<button class="btn link sm"' + (danger ? ' style="color:var(--c-fail)"' : '') +
      ' data-act="' + act + '" data-id="' + h.id + '">' + label + '</button>';
  }
  function actsCell(h) {
    var toggleLabel = isDisabled(h) ? '启用' : '停用';
    var del = h.running > 0
      ? '<span title="有 ' + h.running + ' 个任务运行中，无法删除"><button class="btn link sm" disabled style="color:var(--c-fail)">删除</button></span>'
      : actBtn('del', h, '删除', true);
    return '<div class="ha-acts">' + actBtn('detail', h, '详情') + actBtn('edit', h, '编辑') +
      actBtn('toggle', h, toggleLabel) + del + '</div>';
  }
  function tableHtml() {
    var rows = MOCK.harnesses.map(function (h) {
      var dim = (isOffline(h) || isDisabled(h)) ? ' class="ha-dim"' : '';
      var chips = h.tags && h.tags.length
        ? h.tags.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('')
        : '<span class="sub">—</span>';
      return '<tr' + dim + '>' +
        '<td><span class="rowlink" data-act="detail" data-id="' + h.id + '" title="查看详情">' + DF.dot(dotColor(h)) + DF.esc(h.name) + '</span></td>' +
        '<td class="ha-type">' + DF.icon('server', 14) + ' ' + DF.esc(h.type) + '</td>' +
        '<td class="mono">' + DF.esc(h.address) + '</td>' +
        '<td>' + DF.esc(h.accessMode) + '</td>' +
        '<td><div class="chips">' + chips + '</div></td>' +
        '<td>' + DF.tag(isDisabled(h) ? '已停用' : h.health) + '</td>' +
        '<td>' + hbCell(h) + '</td>' +
        '<td>' + loadCell(h) + '</td>' +
        '<td>' + actsCell(h) + '</td>' +
        '</tr>';
    });
    return DF.table(
      ['名称', '类型', '接入地址', '接入方式', '能力标签', '健康', '最近心跳', '当前任务 / 上限', { t: '操作', s: 'style="width:200px"' }],
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

  /* ---------------- 渲染 ---------------- */
  function render() {
    var s = stats();
    body.innerHTML = DF.statRow([
      DF.statCard({ k: '总数', v: s.total }),
      DF.statCard({ k: '在线', v: s.online, dot: 'green' }),
      DF.statCard({ k: '离线', v: s.offline, dot: 'gray' }),
      DF.statCard({ k: '高负载（负载 ≥80%）', v: s.hot, dot: 'orange' })
    ]) + (MOCK.harnesses.length ? tableHtml() : emptyHtml());
  }

  /* ---------------- 能力标签编辑器（弹窗 / 抽屉编辑态共用） ---------------- */
  function fillTags(box, draft, editable) {
    var cur = draft.tags.map(function (t) {
      return '<span class="chip">' + DF.esc(t) + (editable ? '<i class="x" data-rm="' + DF.esc(t) + '" title="移除">✕</i>' : '') + '</span>';
    }).join('');
    var html = '<div class="chips">' + (cur || '<span style="font-size:12px;color:var(--t-3)">暂无标签</span>') + '</div>';
    if (editable) {
      html += '<div class="ha-chips-add"><span class="lbl">预置:</span>' +
        PRESET_TAGS.map(function (t) {
          return '<span class="chip ha-pchip' + (draft.tags.indexOf(t) >= 0 ? ' on' : '') + '" data-add="' + DF.esc(t) + '">' + DF.esc(t) + '</span>';
        }).join('') + '</div>' +
        '<div class="ha-chips-add"><span class="lbl">自定义:</span>' +
        '<input class="inp inp-sm" data-tag-inp style="width:190px" placeholder="输入标签后回车添加"></div>';
    }
    box.innerHTML = html;
    if (!editable) return;
    box.querySelectorAll('[data-rm]').forEach(function (x) {
      x.onclick = function () {
        var t = x.getAttribute('data-rm');
        draft.tags = draft.tags.filter(function (v) { return v !== t; });
        fillTags(box, draft, true);
      };
    });
    box.querySelectorAll('[data-add]').forEach(function (p) {
      p.onclick = function () {
        var t = p.getAttribute('data-add');
        if (draft.tags.indexOf(t) < 0) draft.tags.push(t);
        fillTags(box, draft, true);
      };
    });
    var inp = box.querySelector('[data-tag-inp]');
    inp.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var v = inp.value.trim();
      if (v && draft.tags.indexOf(v) < 0) draft.tags.push(v);
      fillTags(box, draft, true);
      var n = box.querySelector('[data-tag-inp]');
      if (n) n.focus();
    };
  }

  /* ---------------- 详情抽屉 ---------------- */
  function heartbeats(h) {
    if (isOffline(h) || isDisabled(h)) return [h.heartbeatM];
    return [0, 1, 3, 6, 10].map(function (s) { return h.heartbeatM + s; }); // 间隔递增（1/2/3/4 分钟）
  }
  function hbList(h) {
    var off = isOffline(h), dis = isDisabled(h);
    return '<div class="ha-hb">' + heartbeats(h).map(function (o, i) {
      var d = DF.ts(o);
      var clock = DF.fmtClock(d) + ':' + String(d.getSeconds()).padStart(2, '0');
      var sub = off ? '超时未上报（阈值 60s）' : dis ? '停用期间不上报' : '正常上报';
      return '<div class="row' + (off ? ' bad' : '') + '">' +
        '<span class="dot ' + (off ? 'red' : (i === 0 ? 'green' : 'gray')) + '"></span>' +
        '<span class="clock">' + clock + '</span>' +
        '<span class="sub">' + DF.relTime(o) + ' · ' + sub + '</span></div>';
    }).join('') + '</div>';
  }
  function tasksHtml(h) {
    if (!h.lastTasks || !h.lastTasks.length) return '<div class="empty" style="padding:24px">暂无运行任务</div>';
    return DF.table(
      ['任务', '所属实例', '节点', '开始'],
      h.lastTasks.map(function (t) {
        return '<tr><td>' + DF.esc(t.label) + '</td>' +
          '<td><a href="instance-detail.html?id=' + encodeURIComponent(t.inst) + '">' + DF.esc(t.inst) + '</a></td>' +
          '<td>' + DF.esc(t.node) + '</td>' +
          '<td class="sub">' + DF.relTime(t.startedM) + '</td></tr>';
      }),
      { cls: 'ha-mini-tbl' }
    );
  }
  function drawerBody(h, draft, edit) {
    var html = '<div class="section-title">① 基本信息<span class="line"></span></div>';
    if (edit) {
      html += '<div class="ha-form-grid">' +
        '<div class="field"><label>名称<span class="req">*</span></label><input class="inp" data-f="name" value="' + DF.esc(draft.name) + '"></div>' +
        '<div class="field"><label>类型</label><select class="inp" data-f="type">' +
        TYPES.map(function (t) { return '<option' + (t === draft.type ? ' selected' : '') + '>' + DF.esc(t) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label>接入地址<span class="req">*</span></label><input class="inp mono" data-f="address" value="' + DF.esc(draft.address) + '"></div>' +
        '<div class="field"><label>接入方式</label><select class="inp" data-f="accessMode">' +
        ACCESS.map(function (a) { return '<option' + (a === draft.accessMode ? ' selected' : '') + '>' + DF.esc(a) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field full"><label>描述</label><textarea class="inp" data-f="desc" rows="2" placeholder="用途说明">' + DF.esc(draft.desc) + '</textarea></div>' +
        '</div>' +
        '<div class="kv"><span class="k">注册时间</span><span>' + DF.esc(h.regAt) + '（不可修改）</span></div>';
    } else {
      html += '<div class="kv">' +
        '<span class="k">名称</span><span class="ha-kv-name">' + DF.esc(h.name) + '</span>' +
        '<span class="k">类型</span><span>' + DF.icon('server', 14) + ' ' + DF.esc(h.type) + '</span>' +
        '<span class="k">接入地址</span><span class="mono">' + DF.esc(h.address) + '</span>' +
        '<span class="k">接入方式</span><span>' + DF.esc(h.accessMode) + '</span>' +
        '<span class="k">注册时间</span><span>' + DF.esc(h.regAt) + '</span>' +
        '<span class="k">描述</span><span>' + (DF.esc(h.desc) || '—') + '</span>' +
        '</div>';
    }
    html += '<div class="section-title">② 能力标签<span class="line"></span></div><div class="ha-chips-box" data-tags></div>';
    html += '<div class="section-title">③ 配额<span class="line"></span></div>';
    if (edit) {
      html += '<div class="ha-quota">' +
        '<div class="field"><label>并发上限</label><input type="number" class="inp" data-f="max" min="1" value="' + draft.max + '">' +
        '<div class="hint">达到上限后新任务排队等待</div></div>' +
        '<div class="field"><label>排队策略</label><select class="inp" data-f="queuePolicy">' +
        '<option value="fifo"' + (draft.queuePolicy !== 'priority' ? ' selected' : '') + '>先进先出</option>' +
        '<option value="priority"' + (draft.queuePolicy === 'priority' ? ' selected' : '') + '>优先级</option>' +
        '</select><div class="hint">影响排队任务的调度顺序</div></div></div>';
    } else {
      html += '<div class="kv">' +
        '<span class="k">并发上限</span><span>' + h.max + ' 个</span>' +
        '<span class="k">排队策略</span><span>' + (QUEUE_TXT[h.queuePolicy] || DF.esc(h.queuePolicy)) + '</span></div>';
    }
    html += '<div class="section-title">④ 当前任务<span class="line"></span></div>' + tasksHtml(h);
    html += '<div class="section-title">⑤ 心跳记录<span class="line"></span></div>' + hbList(h);
    return html;
  }
  function saveDrawerEdit(h, draft, b, close) {
    var name = b.querySelector('[data-f="name"]').value.trim();
    var addr = b.querySelector('[data-f="address"]').value.trim();
    var max = parseInt(b.querySelector('[data-f="max"]').value, 10);
    if (!name) { DF.toast('请填写名称', 'err'); return; }
    if (!addr) { DF.toast('请填写接入地址', 'err'); return; }
    if (!(max >= 1)) { DF.toast('并发上限需 ≥ 1', 'err'); return; }
    if (MOCK.harnesses.some(function (x) { return x !== h && x.name === name; })) {
      DF.toast('名称已被其他设施使用：' + name, 'err'); return;
    }
    h.name = name;
    h.type = b.querySelector('[data-f="type"]').value;
    h.address = addr;
    h.accessMode = b.querySelector('[data-f="accessMode"]').value;
    h.tags = draft.tags.slice();
    h.max = max;
    h.queuePolicy = b.querySelector('[data-f="queuePolicy"]').value;
    h.desc = b.querySelector('[data-f="desc"]').value.trim();
    DF.toast('已保存「' + name + '」', 'ok');
    close();
    render();
  }
  function openDrawer(h, edit) {
    var draft = {
      name: h.name, type: h.type, address: h.address, accessMode: h.accessMode,
      tags: (h.tags || []).slice(), max: h.max, queuePolicy: h.queuePolicy, desc: h.desc
    };
    DF.drawer.open({
      title: (edit ? '编辑 Harness · ' : 'Harness 详情 · ') + h.name,
      width: 720,
      body: drawerBody(h, draft, edit),
      footer: edit
        ? '<button class="btn" data-foot="cancel">取消</button><button class="btn primary" data-foot="save">' + DF.icon('check', 14) + '保存</button>'
        : '<button class="btn" data-foot="close">关闭</button><button class="btn primary" data-foot="edit">' + DF.icon('edit', 14) + '编辑</button>',
      onMount: function (b, close) {
        var foot = b.closest('.drawer').querySelector('.d-foot'); // 页脚是 d-body 的兄弟节点，需向上取
        fillTags(b.querySelector('[data-tags]'), draft, edit);
        if (edit) {
          foot.querySelector('[data-foot="cancel"]').onclick = close;
          foot.querySelector('[data-foot="save"]').onclick = function () { saveDrawerEdit(h, draft, b, close); };
        } else {
          foot.querySelector('[data-foot="close"]').onclick = close;
          foot.querySelector('[data-foot="edit"]').onclick = function () { close(); openDrawer(h, true); };
        }
      }
    });
  }

  /* ---------------- 停用 / 启用 / 删除 ----------------
   * 确认框直接使用 DF.modal.confirm（ui.js 已修复 footer 作用域与 settle 顺序，无需页面自建确认框） */
  function toggleDisable(h) {
    if (!isDisabled(h)) {
      var extra = h.running > 0
        ? '<div class="warn-box" style="margin-top:8px">当前有 <b>' + h.running + '</b> 个运行中任务，停用后未完成任务继续执行，新任务将进入排队队列。</div>'
        : '<div class="sub" style="margin-top:6px">停用后不再接收新任务，已排队任务将转派其他设施。</div>';
      DF.modal.confirm({
        title: '停用 Harness',
        danger: true,
        okText: '确认停用',
        html: '确定停用 <b>' + DF.esc(h.name) + '</b>（' + DF.esc(h.address) + '）？' + extra
      }).then(function (ok) {
        if (!ok) return;
        h._disabled = true;
        DF.toast('已停用「' + h.name + '」，新任务将排队', 'warn');
        render();
      });
    } else {
      h._disabled = false;
      DF.toast('已启用「' + h.name + '」', 'ok');
      render();
    }
  }
  function delHarness(h) {
    DF.modal.confirm({
      title: '删除 Harness',
      danger: true,
      okText: '确认删除',
      html: '确定删除 <b>' + DF.esc(h.name) + '</b>（' + DF.esc(h.address) + '）？删除后该设施从调度池移除，操作不可恢复。'
    }).then(function (ok) {
      if (!ok) return;
      var i = MOCK.harnesses.indexOf(h);
      if (i >= 0) MOCK.harnesses.splice(i, 1);
      DF.toast('已删除「' + h.name + '」', 'ok');
      render();
    });
  }

  /* ---------------- 注册弹窗 ---------------- */
  function openRegister() {
    var draft = { tags: [] };
    DF.modal.form({
      title: '注册 Harness',
      width: 560,
      body: '<div class="ha-form-grid">' +
        '<div class="field"><label>名称<span class="req">*</span></label><input class="inp" data-m="name" placeholder="如 build-03"></div>' +
        '<div class="field"><label>类型</label><div class="seg" data-m="type">' +
        TYPES.map(function (t, i) { return '<button type="button" data-v="' + t + '"' + (i === 0 ? ' class="on"' : '') + '>' + t + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="field"><label>接入地址<span class="req">*</span></label><input class="inp mono" data-m="address" placeholder="10.0.4.13:7801">' +
        '<div class="hint" data-m="addr-hint">格式 host:port，注册后 Agent 将主动连接</div></div>' +
        '<div class="field"><label>接入方式</label><select class="inp" data-m="accessMode">' +
        ACCESS.map(function (a) { return '<option>' + DF.esc(a) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field full"><label>能力标签</label><div class="ha-chips-box" data-tags></div></div>' +
        '<div class="field"><label>并发上限</label><input type="number" class="inp" data-m="max" min="1" value="10"></div>' +
        '<div class="field"><label>描述</label><input class="inp" data-m="desc" placeholder="用途说明（可选）"></div>' +
        '</div>',
      okText: '确定注册',
      footerExtra: '<button class="btn" data-m="test" style="margin-right:auto">连接测试</button>' +
        '<span class="ha-test-wait" data-m="test-msg"></span>',
      onMount: function (b, close, okBtn) {
        var foot = b.closest('.modal').querySelector('.d-foot'); // 页脚是 d-body 的兄弟节点，需向上取
        var seg = b.querySelector('[data-m="type"]');
        seg.querySelectorAll('button').forEach(function (bt) {
          bt.onclick = function () {
            seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
            bt.classList.add('on');
          };
        });
        fillTags(b.querySelector('[data-tags]'), draft, true);

        var addrInp = b.querySelector('[data-m="address"]');
        addrInp.oninput = function () { addrInp.style.borderColor = ''; };

        // 连接测试：测试中… → 900ms 后按地址非空给出结果
        var testBtn = foot.querySelector('[data-m="test"]');
        var testMsg = foot.querySelector('[data-m="test-msg"]');
        testBtn.onclick = function () {
          if (testBtn.disabled) return;
          testBtn.disabled = true;
          testBtn.textContent = '测试中…';
          testMsg.textContent = '';
          setTimeout(function () {
            testBtn.disabled = false;
            testBtn.textContent = '连接测试';
            if (addrInp.value.trim()) {
              testMsg.textContent = '';
              DF.toast('连接成功', 'ok');
            } else {
              addrInp.style.borderColor = 'var(--c-fail)';
              testMsg.textContent = '请先填写接入地址';
              DF.toast('连接失败：接入地址为空', 'err');
            }
          }, 900);
        };

        okBtn.onclick = function () {
          var name = b.querySelector('[data-m="name"]').value.trim();
          var addr = addrInp.value.trim();
          var max = parseInt(b.querySelector('[data-m="max"]').value, 10);
          if (!name) { DF.toast('请填写名称', 'err'); return; }
          if (!addr) { DF.toast('请填写接入地址', 'err'); return; }
          if (!(max >= 1)) { DF.toast('并发上限需 ≥ 1', 'err'); return; }
          if (MOCK.harnesses.some(function (x) { return x.name === name; })) {
            DF.toast('名称已存在：' + name, 'err'); return;
          }
          MOCK.harnesses.push({
            id: 'h-' + Date.now(),
            name: name,
            type: seg.querySelector('.on').getAttribute('data-v'),
            address: addr,
            accessMode: b.querySelector('[data-m="accessMode"]').value,
            tags: draft.tags.slice(),
            health: '在线',
            heartbeatM: 0.05,
            running: 0,
            max: max,
            queuePolicy: 'fifo',
            regAt: today(),
            desc: b.querySelector('[data-m="desc"]').value.trim(),
            lastTasks: []
          });
          DF.toast('已注册「' + name + '」，状态在线', 'ok');
          close();
          render();
        };
      }
    });
  }

  /* ---------------- 事件（#page-body 事件委托，重渲后依然有效） ---------------- */
  function onBodyClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var h = MOCK.harnesses.find(function (x) { return x.id === el.getAttribute('data-id'); });
    switch (el.getAttribute('data-act')) {
      case 'reg': openRegister(); break;
      case 'detail': if (h) openDrawer(h, false); break;
      case 'edit': if (h) openDrawer(h, true); break;
      case 'toggle': if (h) toggleDisable(h); break;
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
  render();
})();
