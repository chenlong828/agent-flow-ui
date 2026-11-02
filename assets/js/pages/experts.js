/**
 * AgentFlow 原型 · 专家管理 · 列表页 + 详情弹窗
 * 数据契约: API（assets/js/api.js）——页面状态只保存 B1 DTO，渲染直接读 DTO。
 * 规格: docs/design/components/experts/spec.md（卡片列表 / 五区详情 / 新建弹窗 / 空态）
 */

import { DF } from '../ui.js';
import { API } from '../api.js';


  var PALETTE = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#0d9488', '#dc2626', '#4f46e5', '#0ea5e9'];
  var REF_TYPES = ['行业规则', '规范', '经验', '运行期注入'];
  var CAT_COLOR = { '编码': 'blue', '检索': 'teal', '审视': 'orange', '测试': 'green' };

  /* 列表状态：items 直接保存 ExpertListItem / ExpertDetail DTO */
  var state = { items: [], loading: true, error: null, q: '', status: 'all' };
  var body = null;
  var listSeq = 0;
  var busy = {};

  /* 详情运行态：d.dto 为 ExpertDetail DTO；d.draft 仅为编辑草稿（由 DTO 派生） */
  var d = null;
  var dSeq = 0;
  var pickerRestoring = false;

  /* ========== 数据辅助 ========== */
  /* API 在无 fetch 的环境会同步抛错：转成 rejection 走统一错误态，不吞错。 */
  function apiCall(fn) {
    try { return fn(); } catch (err) { return Promise.reject(err); }
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function replaceItem(dto) {
    if (!dto) return;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === dto.id) { state.items[i] = dto; return; }
    }
    state.items.push(dto);
  }

  function dropItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) { state.items.splice(i, 1); return; }
    }
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function (e) {
      if (state.status === 'on' && !e.enabled) return false;
      if (state.status === 'off' && e.enabled) return false;
      if (!q) return true;
      return (e.name || '').toLowerCase().indexOf(q) > -1 || (e.role || '').toLowerCase().indexOf(q) > -1;
    });
  }

  function categoryColor(s) {
    return CAT_COLOR[s.categoryLabel] || CAT_COLOR[s.categoryCode] || 'gray';
  }

  function categoryLabel(s) {
    return s.categoryLabel || s.categoryCode || 'Skill';
  }

  function toolKindMeta(kind) {
    if (kind === 'mcp') return { label: 'MCP', color: 'purple' };
    if (kind === 'cli') return { label: 'CLI', color: 'blue' };
    if (kind === 'script') return { label: '脚本', color: 'orange' };
    return { label: kind || '工具', color: 'gray' };
  }

  function toolStatusMeta(status) {
    if (status === 'available') return { label: '可用', color: 'green' };
    if (status === 'unavailable') return { label: '不可用', color: 'red' };
    if (status === 'unverified') return { label: '未验证', color: 'gray' };
    return { label: status || '未验证', color: 'gray' };
  }

  /* ========== 列表渲染 ========== */
  function render() {
    body.innerHTML =
      '<div class="toolbar">' +
        DF.searchBox('ex-q', '搜索专家名称 / 角色定位', state.q) +
        '<select class="inp" id="ex-status" style="width:110px">' +
          '<option value="all"' + (state.status === 'all' ? ' selected' : '') + '>全部状态</option>' +
          '<option value="on"' + (state.status === 'on' ? ' selected' : '') + '>启用</option>' +
          '<option value="off"' + (state.status === 'off' ? ' selected' : '') + '>停用</option>' +
        '</select>' +
      '</div>' +
      '<div id="ex-grid"></div>';
    document.getElementById('ex-q').addEventListener('input', function (e) {
      state.q = e.target.value;
      renderGrid();
    });
    document.getElementById('ex-status').addEventListener('change', function (e) {
      state.status = e.target.value;
      renderGrid();
    });
    renderGrid();
  }

  function renderGrid() {
    var grid = document.getElementById('ex-grid');
    if (!grid) return;
    if (state.error) {
      grid.innerHTML = DF.empty({
        icon: 'warn', iconSize: 36, title: API.errorText(state.error),
        action: { id: 'ex-retry', act: 'retry', label: '重试', icon: 'refresh' }
      });
      var retry = grid.querySelector('[data-act="retry"]');
      if (retry) retry.onclick = loadExperts;
      return;
    }
    if (state.loading && !state.items.length) {
      grid.innerHTML = DF.empty({ icon: 'user', iconSize: 36, title: '正在加载专家…' });
      return;
    }
    if (!state.items.length) {
      grid.innerHTML = emptyHtml('注册第一位专家，组合 Skill 形成执行角色', true);
      bindEmpty(grid);
      return;
    }
    var list = filtered();
    if (!list.length) {
      grid.innerHTML = emptyHtml('未找到匹配的专家', false);
      return;
    }
    grid.innerHTML = '<div class="card-grid">' + list.map(cardHtml).join('') + '</div>';
    bindGrid(grid);
  }

  function emptyHtml(msg, withNew) {
    return DF.empty({
      icon: 'user', iconSize: 36, title: msg,
      action: withNew ? { id: 'ex-empty-new', label: '新建专家', icon: 'plus', primary: true } : null
    });
  }

  function bindEmpty(grid) {
    var btn = grid.querySelector('#ex-empty-new');
    if (btn) btn.onclick = openNewModal;
  }

  function cardHtml(e) {
    var skills = e.skills || [];
    var shown = skills.slice(0, 3);
    var count = e.skillCount || 0;
    var more = count - shown.length;
    var color = e.color || '#64748b';
    return '<div class="item-card" data-id="' + DF.esc(e.id) + '">' +
      '<div class="ic-head">' +
        '<span class="expert-dot" style="background:' + DF.esc(color) + '">' + DF.esc(String(e.name || '？').charAt(0)) + '</span>' +
        '<span class="ic-title">' + DF.esc(e.name) + '</span>' +
        '<span style="margin-left:auto">' + DF.tag(e.enabled ? '启用' : '停用', e.enabled ? 'green' : 'gray') + '</span>' +
      '</div>' +
      '<div class="ic-desc" title="' + DF.esc(e.role) + '">' + DF.esc(e.role || '—') + '</div>' +
      '<div class="chips">' + (e.persona || []).map(function (p) {
        return '<span class="tag gray">' + DF.esc(p) + '</span>';
      }).join('') + '</div>' +
      '<div class="chips">' +
        (count > 0 ? '<span class="chip" style="color:var(--t-3)">Skill</span>' : '<span class="ex-sub">未组合 Skill</span>') +
        shown.map(function (s) {
          return '<span class="chip ex-skill" data-anchor="skill" title="' + DF.esc(s.name) + '">' + DF.esc(s.name) + '</span>';
        }).join('') +
        (more > 0 ? '<span class="chip ex-skill" data-anchor="skill" title="共 ' + count + ' 个 Skill">+' + more + '</span>' : '') +
      '</div>' +
      '<div class="ex-sub" title="引用数来自专家 DTO 的 refCount；B1 未提供引用方明细">工具 ×' + (e.toolCount || 0) +
        ' · 引用 ' + (e.refCount || 0) + ' 处</div>' +
      '<div class="ic-foot">' +
        '<button class="btn sm" data-act="detail">详情</button>' +
        '<span style="margin-left:auto;display:inline-flex;align-items:center;gap:8px">' +
          '<span class="ex-sub">' + (e.enabled ? '启用中' : '已停用') + '</span>' +
          '<label class="switch" title="' + (e.enabled ? '点击停用' : '点击启用') + '">' +
            '<input type="checkbox" data-act="toggle"' + (e.enabled ? ' checked' : '') + '><i></i></label>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  function bindGrid(grid) {
    grid.onclick = function (ev) {
      var card = ev.target.closest('.item-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      if (ev.target.closest('.ex-skill')) { openDrawer(id, { anchor: 'skill' }); return; }
      if (ev.target.closest('[data-act="detail"]')) { openDrawer(id); return; }
    };
    grid.onchange = function (ev) {
      if (ev.target.getAttribute && ev.target.getAttribute('data-act') === 'toggle') {
        var card = ev.target.closest('.item-card');
        if (card) toggleExpert(card.getAttribute('data-id'));
      }
    };
  }

  /* ========== 列表加载 ========== */
  function loadExperts() {
    var seq = ++listSeq;
    state.loading = true;
    state.error = null;
    renderGrid();
    apiCall(function () { return API.list('expert', { limit: 200 }); }).then(function (page) {
      if (seq !== listSeq) return;
      state.items = (page && page.items) || [];
      state.loading = false;
      renderGrid();
    }, function (err) {
      if (seq !== listSeq) return;
      state.loading = false;
      state.error = err;
      renderGrid();
    });
  }

  /* ========== 启用/停用 ========== */
  function toggleExpert(id) {
    var item = findItem(id);
    if (!item) { renderGrid(); return; }
    if (busy[id]) { renderGrid(); return; }
    var next = !item.enabled;
    if (!next) {
      DF.modal.confirm({
        title: '停用专家',
        message: '确定停用专家「' + item.name + '」？停用后引用该专家的节点将无法调度。',
        danger: true,
        okText: '停用'
      }).then(function (ok) {
        if (!ok) { renderGrid(); return; }
        applyToggle(id, false);
      });
      return;
    }
    applyToggle(id, true);
  }

  function applyToggle(id, enabled) {
    var item = findItem(id);
    if (!item) return;
    busy[id] = true;
    var rev = API.revision('expert', id);
    apiCall(function () { return API.setEnabled('expert', id, enabled, rev); }).then(function (dto) {
      delete busy[id];
      replaceItem(dto);
      renderGrid();
      DF.toast((enabled ? '已启用「' : '已停用「') + dto.name + '」', enabled ? 'ok' : 'warn');
    }, function (err) {
      delete busy[id];
      renderGrid();
      DF.toast('操作失败：' + API.errorText(err), 'err');
      if (err && (err.status === 409 || err.status === 404 || err.status === 428)) loadExperts();
    });
  }

  /* ========== 详情弹窗（查看/编辑） ========== */
  function openDrawer(id, opts) {
    opts = opts || {};
    var st = {
      id: id, dto: null, loading: true, error: null,
      edit: !!opts.edit, draft: null, seq: ++dSeq, anchor: opts.anchor || null, bodyEl: null
    };
    d = st;
    showDrawer(st);
    loadDetail(st);
  }

  function showDrawer(st) {
    d = st;
    st.bodyEl = null;
    var initial = st.loading
      ? loadingBodyHtml()
      : (st.error ? detailErrorHtml() : drawerBodyHtml());
    DF.modal.open({
      title: '专家详情' + (st.dto ? ' · ' + st.dto.name : ''),
      width: '80vw',
      resizable: true,
      body: initial,
      footer: drawerFooterHtml(),
      onMount: function (b) {
        st.bodyEl = b;
        bindDrawerBody(b);
        var modalEl = b.closest('.modal');
        var foot = modalEl ? modalEl.querySelector('.d-foot') : null;
        if (foot) bindFooter(foot);
      },
      onClose: function () { if (d === st) d = null; }
    });
  }

  function loadDetail(st) {
    var seq = st.seq;
    apiCall(function () { return API.get('expert', st.id); }).then(function (dto) {
      if (d !== st || st.seq !== seq) return;
      st.dto = dto;
      st.loading = false;
      st.error = null;
      if (st.edit) snapshotDraft(st);
      updateDetailTitle();
      refreshDrawer();
      if (st.anchor === 'skill') { scrollToSkill(); st.anchor = null; }
    }, function (err) {
      if (d !== st || st.seq !== seq) return;
      st.loading = false;
      st.error = err;
      updateDetailTitle();
      refreshDrawer();
    });
  }

  function reloadDetail() {
    if (!d) return;
    var st = d;
    st.loading = true;
    st.error = null;
    st.edit = false;
    st.draft = null;
    st.seq = ++dSeq;
    refreshDrawer();
    loadDetail(st);
  }

  function updateDetailTitle() {
    var head = document.querySelector('.modal .d-head');
    if (!head) return;
    var title = '专家详情' + (d && d.dto ? ' · ' + d.dto.name : '');
    var node = head.firstChild;
    if (node && node.nodeType === 3) node.nodeValue = title;
  }

  function scrollToSkill() {
    var el = document.getElementById('ex-sec-skill');
    if (!el) return;
    el.classList.add('ex-flash');
    setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }

  function loadingBodyHtml() {
    return '<div class="ex-sub" style="padding:24px 0">正在加载专家详情…</div>';
  }

  function detailErrorHtml() {
    return '<div class="notice">' + DF.icon('warn', 14) +
        '<span>加载专家详情失败：' + DF.esc(API.errorText(d && d.error)) + '</span></div>' +
      '<div style="margin-top:12px"><button class="btn" id="ex-dretry" data-act="retry">' +
        DF.icon('refresh', 14) + '重试</button></div>';
  }

  function refreshDrawer() {
    if (!d || !d.bodyEl) return;
    d.bodyEl.innerHTML = d.loading
      ? loadingBodyHtml()
      : (d.error ? detailErrorHtml() : drawerBodyHtml());
    bindDrawerBody(d.bodyEl);
    var modalEl = d.bodyEl.closest('.modal');
    var foot = modalEl ? modalEl.querySelector('.d-foot') : null;
    if (foot) {
      foot.innerHTML = drawerFooterHtml();
      bindFooter(foot);
    }
  }

  function drawerFooterHtml() {
    if (!d || d.loading || d.error || !d.dto) {
      return '<button class="btn" id="ex-dclose">关闭</button>';
    }
    if (d.edit) {
      return '<button class="btn" id="ex-cancel">取消</button>' +
        '<button class="btn primary" id="ex-save">保存</button>';
    }
    return '<button class="btn danger" id="ex-delete">' + DF.icon('trash', 14) + '删除</button>' +
      '<button class="btn" id="ex-dclose">关闭</button>' +
      '<button class="btn primary" id="ex-edit">' + DF.icon('edit', 14) + '编辑</button>';
  }

  function bindFooter(foot) {
    if (!foot) return;
    var edit = foot.querySelector('#ex-edit');
    if (edit) edit.onclick = enterEdit;
    var dc = foot.querySelector('#ex-dclose');
    if (dc) dc.onclick = function () { DF.modal.close(); };
    var cancel = foot.querySelector('#ex-cancel');
    if (cancel) cancel.onclick = function () {
      if (!d || !d.dto) return;
      d.edit = false;
      d.draft = null;
      refreshDrawer();
    };
    var save = foot.querySelector('#ex-save');
    if (save) save.onclick = saveDraft;
    var del = foot.querySelector('#ex-delete');
    if (del) del.onclick = deleteExpert;
  }

  function enterEdit() {
    if (!d || !d.dto) return;
    d.edit = true;
    snapshotDraft(d);
    refreshDrawer();
  }

  /* 编辑草稿从详情 DTO 派生；装配顺序取自 skills[].id / tools[].id */
  function snapshotDraft(st) {
    var dto = st.dto;
    if (!dto) return;
    st.draft = {
      name: dto.name || '',
      color: dto.color || PALETTE[0],
      role: dto.role || '',
      duty: dto.duty || '',
      skillOrder: dto.skillOrder || '',
      verifyOrder: dto.verifyOrder || '',
      notes: dto.notes || '',
      persona: (dto.persona || []).slice(),
      refs: (dto.refs || []).map(function (r) {
        return { label: r.label || '', refType: r.refType || '经验', path: r.path || '' };
      }),
      skills: (dto.skills || []).map(function (s) {
        return {
          id: s.id, name: s.name,
          categoryCode: s.categoryCode, categoryLabel: s.categoryLabel,
          description: s.description
        };
      }),
      tools: (dto.tools || []).map(function (t) {
        return { id: t.id, name: t.name, kind: t.kind, status: t.status };
      })
    };
  }

  function drawerBodyHtml() {
    var dto = d.dto;
    var edit = d.edit;
    var src = edit ? d.draft : dto;
    var refCount = dto.refCount || 0;
    var h = '';
    h += '<div class="notice">' + DF.icon('warn', 14) +
      '<span>专家 = 固定人格与职责 + 按任务组合的 Skill 与工具；评审专家绑定到评审节点时承担独立否决视角，不是独立实体。</span></div>';
    h += '<div class="kv" style="margin-bottom:2px"><span class="k">状态</span><span style="display:flex;align-items:center;gap:8px">' +
      DF.tag(dto.enabled ? '启用' : '停用', dto.enabled ? 'green' : 'gray') +
      '<span class="ex-sub">被引用 ' + refCount + ' 处 · B1 未提供引用方明细</span></span></div>';
    h += '<div class="kv" style="margin-bottom:2px"><span class="k">角色定位</span><span class="ex-pre">' + DF.esc(dto.role || '—') + '</span></div>';

    /* ① 角色描述 */
    h += '<div class="section-title" id="ex-sec-role">① 角色描述<span class="line"></span></div>';
    if (edit) {
      h += '<div class="field"><label>职责范围</label><textarea class="inp" id="ex-duty" rows="3">' + DF.esc(src.duty) + '</textarea></div>';
      h += '<div class="field"><label>性格描述</label><div class="chips">' + personaChipsEdit(src.persona) + '</div></div>';
      h += '<div class="field"><label>关注视角</label><textarea class="inp" id="ex-notes" rows="2">' + DF.esc(src.notes) + '</textarea></div>';
    } else {
      h += '<div class="kv"><span class="k">职责范围</span><span class="ex-pre">' + DF.esc(src.duty || '—') + '</span></div>';
      h += '<div class="kv" style="margin-top:8px"><span class="k">性格描述</span><span><span class="chips" style="display:inline-flex">' +
        (src.persona || []).map(function (p) {
          return '<span class="tag gray">' + DF.esc(p) + '</span>';
        }).join('') +
        (!(src.persona || []).length ? '<span class="ex-sub">—</span>' : '') + '</span></span></div>';
      h += '<div class="kv" style="margin-top:8px"><span class="k">关注视角</span><span class="ex-pre">' + DF.esc(src.notes || '—') + '</span></div>';
    }

    /* ② Skill 组合（有序） */
    h += '<div class="section-title ex-sec" id="ex-sec-skill">② Skill 组合<span class="line"></span>' +
      (edit ? '<button class="btn sm" data-act="skill-add">' + DF.icon('plus', 12) + '从 Skill 库添加</button>' : '') + '</div>';
    var skills = src.skills || [];
    if (!skills.length) {
      h += '<div class="ex-sub" style="margin-bottom:6px">尚未组合 Skill' + (edit ? '，可从 Skill 库添加' : '') + '。</div>';
    }
    skills.forEach(function (s, i) {
      h += '<div class="ex-skill-item"><span class="ex-idx">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<b style="font-size:13px">' + DF.esc(s.name) + '</b>' + DF.tag(categoryLabel(s), categoryColor(s)) + '</div>' +
          '<div class="ex-sum" title="' + DF.esc(s.description || '') + '">' + DF.esc(s.description || '') + '</div></div>' +
        (edit
          ? '<button class="ex-move" data-smove="up" data-sid="' + DF.esc(s.id) + '" title="上移"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="ex-move" data-smove="down" data-sid="' + DF.esc(s.id) + '" title="下移"' + (i === skills.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<i class="ex-x" data-sremove="' + DF.esc(s.id) + '" title="移除">×</i>'
          : '') +
        '</div>';
    });

    /* ③ 工具清单 */
    h += '<div class="section-title ex-sec" id="ex-sec-tools">③ 工具清单<span class="line"></span>' +
      (edit ? '<button class="btn sm" data-act="tool-add">' + DF.icon('plus', 12) + '添加工具</button>' : '') + '</div>';
    var tools = src.tools || [];
    if (!tools.length) {
      h += '<div class="ex-sub" style="margin-bottom:6px">尚未挂载工具' + (edit ? '，可从工具库添加' : '') + '。</div>';
    }
    tools.forEach(function (t) {
      var kind = toolKindMeta(t.kind);
      var status = toolStatusMeta(t.status);
      h += '<div class="ex-row"><span class="ex-mono" style="font-weight:600">' + DF.esc(t.name) + '</span>' +
        DF.tag(kind.label, kind.color) + DF.tag(status.label, status.color) +
        '<span class="ex-sum" style="flex:1;margin-top:0" title="' + DF.esc(t.description || '') + '">' + DF.esc(t.description || '') + '</span>' +
        (edit ? '<i class="ex-x" data-tremove="' + DF.esc(t.id) + '" title="移除">×</i>' : '') +
        '</div>';
    });

    /* ④ 主要工作内容（渐进式披露） */
    h += '<div class="section-title ex-sec" id="ex-sec-work">④ 主要工作内容<span class="line"></span></div>';
    h += '<details class="ex-wc" open><summary>主要职责</summary><div class="ex-pre">' + DF.esc(src.duty || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>技能配合顺序</summary><div class="ex-pre">' + DF.esc(src.skillOrder || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>重点验证顺序</summary><div class="ex-pre">' + DF.esc(src.verifyOrder || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>对承担任务的解读</summary><div class="ex-pre">' + DF.esc(src.notes || '—') + '</div></details>';

    /* ⑤ 参考知识 */
    h += '<div class="section-title ex-sec" id="ex-sec-refs">⑤ 参考知识<span class="line"></span></div>';
    var refs = src.refs || [];
    if (!refs.length) h += '<div class="ex-sub">暂无参考知识。</div>';
    refs.forEach(function (r, i) {
      h += '<div class="ex-row">' + DF.tag(r.refType || '经验', 'purple') +
        '<span style="font-size:13px">' + DF.esc(r.label || '') + '</span>' +
        (r.path
          ? '<span class="ex-mono ex-sum" style="flex:1;margin-top:0" title="' + DF.esc(r.path) + '">' + DF.esc(r.path) + '</span>'
          : '<span style="flex:1"></span>') +
        (edit ? '<i class="ex-x" data-rremove="' + i + '" title="删除">×</i>' : '') +
        '</div>';
    });
    if (edit) {
      h += '<div class="ex-ref-add">' +
        '<input class="inp inp-sm" id="ex-ref-label" placeholder="名称，如: 编码规范约束手册" style="width:200px">' +
        '<select class="inp inp-sm" id="ex-ref-type">' + REF_TYPES.map(function (t) {
          return '<option>' + DF.esc(t) + '</option>';
        }).join('') + '</select>' +
        '<input class="inp inp-sm" id="ex-ref-path" placeholder="路径（可选），如: workspace:/knowledge/…" style="width:220px">' +
        '<button class="btn sm" data-act="ref-add">添加</button></div>';
    }
    return h;
  }

  function personaChipsEdit(list) {
    return (list || []).map(function (p) {
      return '<span class="chip">' + DF.esc(p) + '<i class="x" data-pdel="' + DF.esc(p) + '" title="移除">×</i></span>';
    }).join('') +
      '<span style="display:inline-flex;gap:6px;align-items:center">' +
        '<input class="inp inp-sm" id="ex-persona-inp" placeholder="添加性格词，回车确认" style="width:160px">' +
        '<button class="btn sm" data-act="persona-add">添加</button></span>';
  }

  function bindDrawerBody(b) {
    b.oninput = function (ev) {
      if (!d || !d.edit || !d.draft) return;
      if (ev.target.id === 'ex-duty') d.draft.duty = ev.target.value;
      else if (ev.target.id === 'ex-notes') d.draft.notes = ev.target.value;
    };
    b.onclick = function (ev) {
      if (!d) return;
      var t = ev.target;
      if (t.closest('#ex-dretry') || t.closest('[data-act="retry"]')) { reloadDetail(); return; }
      if (!d.edit || !d.draft) return;
      var pdel = t.closest('[data-pdel]');
      if (pdel) {
        var v = pdel.getAttribute('data-pdel');
        d.draft.persona = d.draft.persona.filter(function (x) { return x !== v; });
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="persona-add"]')) { addPersona(b); return; }
      var sm = t.closest('[data-smove]');
      if (sm) { moveSkill(sm.getAttribute('data-smove'), sm.getAttribute('data-sid')); return; }
      var srm = t.closest('[data-sremove]');
      if (srm) {
        var sid = srm.getAttribute('data-sremove');
        d.draft.skills = d.draft.skills.filter(function (s) { return s.id !== sid; });
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="skill-add"]')) { openSkillPicker(); return; }
      if (t.closest('[data-act="tool-add"]')) { openToolPicker(); return; }
      var trm = t.closest('[data-tremove]');
      if (trm) {
        var tid = trm.getAttribute('data-tremove');
        d.draft.tools = d.draft.tools.filter(function (x) { return x.id !== tid; });
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="ref-add"]')) { addRef(b); return; }
      var rrm = t.closest('[data-rremove]');
      if (rrm) {
        d.draft.refs.splice(+rrm.getAttribute('data-rremove'), 1);
        refreshDrawer();
        return;
      }
    };
    b.onkeydown = function (ev) {
      if (d && d.edit && d.draft && ev.target.id === 'ex-persona-inp' && ev.key === 'Enter') {
        ev.preventDefault();
        addPersona(b);
      }
    };
  }

  function addPersona(b) {
    if (!d || !d.draft) return;
    var inp = b.querySelector('#ex-persona-inp');
    if (!inp) return;
    var v = (inp.value || '').trim();
    if (!v) { DF.toast('请输入性格词', 'warn'); return; }
    if (d.draft.persona.indexOf(v) > -1) { DF.toast('性格词已存在', 'warn'); return; }
    d.draft.persona.push(v);
    refreshDrawer();
    var ni = d.bodyEl ? d.bodyEl.querySelector('#ex-persona-inp') : null;
    if (ni) ni.focus();
  }

  function moveSkill(dir, sid) {
    if (!d || !d.draft) return;
    var arr = d.draft.skills;
    var ids = arr.map(function (s) { return s.id; });
    var i = ids.indexOf(sid);
    var j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return;
    arr.splice(j, 0, arr.splice(i, 1)[0]);
    refreshDrawer();
  }

  function addRef(b) {
    if (!d || !d.draft) return;
    var label = (b.querySelector('#ex-ref-label').value || '').trim();
    if (!label) { DF.toast('请填写参考知识名称', 'warn'); return; }
    var refType = b.querySelector('#ex-ref-type').value;
    var path = (b.querySelector('#ex-ref-path').value || '').trim();
    d.draft.refs.push({ label: label, refType: refType, path: path });
    refreshDrawer();
    DF.toast('已添加参考知识', 'ok');
  }

  function saveDraft() {
    if (!d || !d.dto || !d.draft) return;
    var st = d;
    var dto = st.dto;
    var rev = dto.revision != null ? dto.revision : API.revision('expert', st.id);
    var body = {
      name: st.draft.name,
      color: st.draft.color,
      role: st.draft.role,
      persona: st.draft.persona.slice(),
      duty: st.draft.duty,
      skillOrder: st.draft.skillOrder,
      verifyOrder: st.draft.verifyOrder,
      notes: st.draft.notes,
      refs: st.draft.refs.map(function (r) {
        var o = { label: r.label, refType: r.refType };
        if (r.path) o.path = r.path;
        return o;
      }),
      skillIds: st.draft.skills.map(function (s) { return s.id; }),
      toolIds: st.draft.tools.map(function (t) { return t.id; })
    };
    var modalEl = st.bodyEl ? st.bodyEl.closest('.modal') : null;
    var saveBtn = modalEl ? modalEl.querySelector('#ex-save') : null;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }
    apiCall(function () { return API.patch('expert', st.id, body, rev); }).then(function (saved) {
      replaceItem(saved);
      renderGrid();
      if (d !== st) {
        DF.toast('已保存专家「' + saved.name + '」', 'ok');
        return;
      }
      st.dto = saved;
      st.edit = false;
      st.draft = null;
      refreshDrawer();
      DF.toast('已保存专家「' + saved.name + '」', 'ok');
    }, function (err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
      DF.toast('保存失败：' + API.errorText(err), 'err');
      if (err && (err.status === 409 || err.status === 428 || err.status === 404)) reloadDetail();
    });
  }

  function deleteExpert() {
    if (!d || !d.dto) return;
    var dto = d.dto;
    var id = dto.id;
    var rev = API.revision('expert', id);
    if (rev == null) rev = dto.revision;
    DF.modal.confirm({
      title: '删除专家',
      message: '确定删除专家「' + dto.name + '」？该操作不可恢复。',
      danger: true,
      okText: '删除'
    }).then(function (ok) {
      if (!ok) { openDrawer(id); return; }
      apiCall(function () { return API.remove('expert', id, rev); }).then(function () {
        dropItem(id);
        renderGrid();
        DF.toast('已删除专家「' + dto.name + '」', 'ok');
      }, function (err) {
        DF.toast('删除失败：' + API.errorText(err), 'err');
        loadExperts();
      });
    });
  }

  /* ========== 挑选弹窗（DF.modal.form + 复选行；关闭后恢复详情弹窗） ========== */
  function openPickerDialog(opt) {
    var cur = d;
    if (!cur || !cur.edit || !cur.draft) return;
    var rows = opt.items.map(function (it) {
      return '<label class="df-pick-row"><input type="checkbox" value="' + DF.esc(it.id) + '">' +
        '<span' + (it.mono ? ' class="mono"' : '') + ' style="font-weight:600;font-size:13px">' + DF.esc(it.name) + '</span>' +
        (it.tag ? DF.tag(it.tag, it.tagColor) : '') +
        '<span class="df-pick-sum" title="' + DF.esc(it.description || '') + '">' + DF.esc(it.description || '') + '</span></label>';
    }).join('');
    DF.modal.form({
      title: opt.title,
      width: 540,
      body: '<div>' + rows + '</div>',
      okText: opt.okText || '添加所选',
      onOk: function (b, close) {
        var boxes = b.querySelectorAll('input[type="checkbox"]:checked');
        var ids = [];
        for (var i = 0; i < boxes.length; i++) ids.push(boxes[i].value);
        if (!ids.length) { DF.toast(opt.noneText || '请先勾选要添加的项', 'warn'); return; }
        var picked = opt.items.filter(function (it) { return ids.indexOf(it.id) >= 0; });
        opt.onPick(picked);
        close();
      },
      onClose: function () {
        if (pickerRestoring) return;
        pickerRestoring = true;
        if (cur) showDrawer(cur);
        pickerRestoring = false;
      }
    });
  }

  function openSkillPicker() {
    if (!d || !d.edit || !d.draft) return;
    var cur = d;
    apiCall(function () { return API.list('skill', { limit: 200 }); }).then(function (page) {
      if (d !== cur || !cur.edit || !cur.draft) return;
      var taken = {};
      cur.draft.skills.forEach(function (s) { taken[s.id] = true; });
      var items = ((page && page.items) || []).filter(function (s) {
        return !taken[s.id];
      }).map(function (s) {
        return {
          id: s.id, name: s.name,
          tag: categoryLabel(s), tagColor: categoryColor(s),
          description: s.description || '',
          categoryCode: s.categoryCode, categoryLabel: s.categoryLabel
        };
      });
      if (!items.length) { DF.toast('Skill 库中的 Skill 均已加入', 'warn'); return; }
      openPickerDialog({
        title: '从 Skill 库添加',
        items: items,
        noneText: '请先勾选要添加的 Skill',
        onPick: function (picked) {
          picked.forEach(function (it) {
            cur.draft.skills.push({
              id: it.id, name: it.name,
              categoryCode: it.categoryCode, categoryLabel: it.categoryLabel,
              description: it.description
            });
          });
          DF.toast('已添加 ' + picked.length + ' 个 Skill', 'ok');
        }
      });
    }, function (err) {
      DF.toast('加载 Skill 库失败：' + API.errorText(err), 'err');
    });
  }

  function openToolPicker() {
    if (!d || !d.edit || !d.draft) return;
    var cur = d;
    apiCall(function () { return API.list('tool', { limit: 200 }); }).then(function (page) {
      if (d !== cur || !cur.edit || !cur.draft) return;
      var taken = {};
      cur.draft.tools.forEach(function (t) { taken[t.id] = true; });
      var items = ((page && page.items) || []).filter(function (t) {
        return !taken[t.id];
      }).map(function (t) {
        var kind = toolKindMeta(t.kind);
        return {
          id: t.id, name: t.name, mono: true,
          tag: kind.label, tagColor: kind.color,
          description: t.description || '',
          kind: t.kind, status: t.status
        };
      });
      if (!items.length) { DF.toast('工具库中的工具均已加入', 'warn'); return; }
      openPickerDialog({
        title: '添加工具（从工具库勾选）',
        items: items,
        noneText: '请先勾选要添加的工具',
        onPick: function (picked) {
          picked.forEach(function (it) {
            cur.draft.tools.push({ id: it.id, name: it.name, kind: it.kind, status: it.status });
          });
          DF.toast('已添加 ' + picked.length + ' 个工具', 'ok');
        }
      });
    }, function (err) {
      DF.toast('加载工具库失败：' + API.errorText(err), 'err');
    });
  }

  /* ========== 新建专家弹窗 ========== */
  function openNewModal() {
    var palette = PALETTE.map(function (c, i) {
      return '<label class="ex-swatch" style="background:' + c + '" title="' + c + '">' +
        '<input type="radio" name="ex-color" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><i></i></label>';
    }).join('');
    var okBtnEl = null;
    var submitting = false;
    DF.modal.form({
      title: '新建专家',
      width: 470,
      body: DF.field('名称', '<input class="inp" id="ex-n-name" placeholder="如: 数据迁移专家">', { required: true }) +
        DF.field('头像色', '<div class="ex-swatches">' + palette + '</div>',
          { hint: '作为专家标识色，在画布与运行实例中复用' }) +
        DF.field('角色定位一句话', '<input class="inp" id="ex-n-role" placeholder="如: 完成存量数据迁移与一致性校验">', { required: true }),
      okText: '确定',
      onMount: function (b, close, okBtn) {
        okBtnEl = okBtn;
        var nameEl = b.querySelector('#ex-n-name');
        if (nameEl) nameEl.focus();
      },
      onOk: function (b, close) {
        if (submitting) return;
        var name = (b.querySelector('#ex-n-name').value || '').trim();
        var role = (b.querySelector('#ex-n-role').value || '').trim();
        if (!name) { DF.toast('请填写专家名称', 'warn'); b.querySelector('#ex-n-name').focus(); return; }
        if (!role) { DF.toast('请填写角色定位一句话', 'warn'); b.querySelector('#ex-n-role').focus(); return; }
        var colorEl = b.querySelector('input[name="ex-color"]:checked');
        submitting = true;
        if (okBtnEl) { okBtnEl.disabled = true; okBtnEl.textContent = '创建中…'; }
        apiCall(function () {
          return API.create('expert', {
            name: name,
            color: colorEl ? colorEl.value : PALETTE[0],
            role: role
          });
        }).then(function (dto) {
          submitting = false;
          close();
          replaceItem(dto);
          renderGrid();
          DF.toast('已创建专家「' + dto.name + '」，请继续补全', 'ok');
          openDrawer(dto.id, { edit: true });
        }, function (err) {
          submitting = false;
          if (okBtnEl) { okBtnEl.disabled = false; okBtnEl.textContent = '确定'; }
          DF.toast('创建失败：' + API.errorText(err), 'err');
        });
      }
    });
  }

  /* ========== 初始化 ========== */
  body = DF.renderShell({
    active: 'experts',
    breadcrumb: [{ label: '资产与注册' }, { label: '专家管理' }],
    title: '专家管理',
    subtitle: '注册并管理执行智能体角色',
    actions: '<button class="btn primary" id="ex-new">' + DF.icon('plus', 14) + '新建专家</button>'
  });
  render();
  var newBtn = document.getElementById('ex-new');
  if (newBtn) newBtn.onclick = openNewModal;
  loadExperts();
