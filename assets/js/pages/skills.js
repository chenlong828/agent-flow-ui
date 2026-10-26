/**
 * AgentFlow 原型 · Skill 库页面（B1 实时接口）
 * 依赖: window.API（B1 DTO 客户端）、window.DF（ui.js）
 *
 * 约定：
 * - 页面状态直接保存 B1 DTO（SkillListItem / SkillDetail / SkillCategory），渲染直接读 DTO 字段；
 *   不读演示夹具、不建客户端视图模型、不做 demo 回退。
 * - 版本由服务端维护：保存后取返回 DTO 的 version，不在本地 bump；日期统一用 updatedAt。
 * - 分类仅使用 API.categories() 的 code / label，中文名只在渲染时映射。
 * - refs 使用 refType；usedByCount 只作计数展示（B1 无引用方明细）。
 * - If-Match 由 API 层负责，页面只把 API.revision() 交给 API 写方法。
 */
(function () {
  'use strict';

  /* ---------------- 展示映射（仅渲染，不承载数据） ---------------- */
  var SECTIONS = [
    ['overview', '流程总述'],
    ['steps', '详细步骤与约束'],
    ['examples', '参考案例模板'],
    ['scripts', '外部脚本使用指南'],
    ['verification', '完成验证方案']
  ];
  var CAT_COLORS = ['blue', 'teal', 'purple', 'orange', 'green', 'red'];
  var REF_COLORS = { skill: 'blue', template: 'teal', spec: 'purple', doc: 'gray', url: 'orange' };

  /* ---------------- 状态（全部为 B1 DTO） ---------------- */
  var state = {
    cat: 'all',
    tags: [],
    kw: '',
    items: [],      // SkillListItem[]
    total: 0,
    cats: [],       // SkillCategory[]
    loading: true,
    listErr: '',
    catErr: ''
  };
  // 当前抽屉: { id, dto: SkillDetail, edit: Boolean, draft: SkillDetail, err, saving,
  //             view: 'structured' | 'document', doc: { text, notModified, loading, err } }
  var cur = null;
  var DESC_MIN = 1;
  var DESC_MAX = 400;

  /* ---------------- 通用小工具 ---------------- */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function relTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var min = (Date.now() - d.getTime()) / 60000;
    if (min < 0) min = 0;
    return DF.relTime(min);
  }

  function sortCats(cats) {
    return (cats || []).slice().sort(function (a, b) {
      var pa = a && a.position != null ? a.position : 0;
      var pb = b && b.position != null ? b.position : 0;
      return pa - pb;
    });
  }

  function catLabelOf(code) {
    for (var i = 0; i < state.cats.length; i++) {
      if (state.cats[i].code === code) return state.cats[i].label;
    }
    return code || '—';
  }

  function catColor(code) {
    for (var i = 0; i < state.cats.length; i++) {
      if (state.cats[i].code === code) return CAT_COLORS[i % CAT_COLORS.length];
    }
    return 'gray';
  }

  function itemById(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function replaceItem(dto) {
    if (!dto || !dto.id) return;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === dto.id) { state.items[i] = dto; return; }
    }
    state.items.unshift(dto);
    state.total += 1;
  }

  function tagCloud() {
    var seen = [];
    state.items.forEach(function (s) {
      (s.tags || []).forEach(function (t) {
        if (seen.indexOf(t) < 0) seen.push(t);
      });
    });
    return seen.slice(0, 10);
  }

  function filtered() {
    var kw = state.kw.trim().toLowerCase();
    return state.items.filter(function (s) {
      if (state.cat !== 'all' && s.categoryCode !== state.cat) return false;
      if (state.tags.length && !(s.tags || []).some(function (t) { return state.tags.indexOf(t) >= 0; })) return false;
      if (kw) {
        var hay = [s.name, s.description, (s.tags || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function descLen(v) { return String(v == null ? '' : v).trim().length; }

  /* ---------------- 页面骨架 ---------------- */
  function render() {
    var body = DF.renderShell({
      active: 'skills',
      breadcrumb: [{ label: '资产与注册' }, { label: 'Skill 库' }],
      title: 'Skill 库',
      subtitle: '独立沉淀的能力单元，供专家组合引用',
      actions: '<button class="btn primary" id="sk-new">' + DF.icon('plus', 14) + '新建 Skill</button>'
    });
    body.innerHTML =
      '<div class="sk-layout">' +
        '<aside class="card sk-side" id="sk-side"></aside>' +
        '<section class="sk-main">' +
          '<div class="toolbar">' +
            DF.searchBox('sk-q', '搜索名称 / 描述 / 标签', state.kw) +
            '<span class="sp"></span><span class="sk-n" id="sk-count"></span>' +
          '</div>' +
          '<div id="sk-tblbox"></div>' +
        '</section>' +
      '</div>';
    document.getElementById('sk-new').onclick = openNew;
    var q = document.getElementById('sk-q');
    q.oninput = function () { state.kw = q.value; renderList(); };
    renderSide();
    renderList();
    loadCats();
    loadList();
  }

  /* ---------------- 数据加载 ---------------- */
  function loadCats() {
    state.catErr = '';
    renderSide();
    API.categories().then(function (cats) {
      state.cats = sortCats(cats);
      state.catErr = '';
      renderSide();
      renderList();
    }).catch(function (err) {
      state.catErr = API.errorText(err);
      renderSide();
      renderList();
    });
  }

  function loadList() {
    state.loading = true;
    state.listErr = '';
    renderList();
    API.list('skill', { limit: 200, sort: 'updatedAt:desc' }).then(function (page) {
      state.items = (page && page.items) || [];
      state.total = page && typeof page.total === 'number' ? page.total : state.items.length;
      state.loading = false;
      state.listErr = '';
      renderSide();
      renderList();
    }).catch(function (err) {
      state.loading = false;
      state.listErr = API.errorText(err);
      renderList();
    });
  }

  /* ---------------- 左侧筛选栏 ---------------- */
  function sideHtml() {
    var all = state.items;
    var cats = [{ code: 'all', label: '全部', count: all.length }].concat(state.cats.map(function (c) {
      return {
        code: c.code,
        label: c.label,
        count: all.filter(function (s) { return s.categoryCode === c.code; }).length
      };
    }));
    var tags = tagCloud();
    return '<div class="sk-side-h">分类</div><div class="sk-cats">' +
      cats.map(function (c) {
        return '<div class="sk-cat' + (state.cat === c.code ? ' on' : '') + '" data-cat="' + DF.esc(c.code) + '">' +
          '<span>' + DF.esc(c.label) + '</span><span class="sk-n">' + c.count + '</span></div>';
      }).join('') +
      '</div>' +
      (state.catErr
        ? '<div class="notice" style="margin:0 2px 12px">' + DF.icon('warn', 14) +
          '<span>分类加载失败：' + DF.esc(state.catErr) + ' <a href="javascript:;" id="sk-cat-retry">重试</a></span></div>'
        : '') +
      '<div class="sk-side-h">标签</div><div class="chips sk-tagcloud">' +
      (tags.length ? tags.map(function (t) {
        return state.tags.indexOf(t) >= 0
          ? '<span class="tag blue" data-tag="' + DF.esc(t) + '">' + DF.esc(t) + '</span>'
          : '<span class="chip click" data-tag="' + DF.esc(t) + '">' + DF.esc(t) + '</span>';
      }).join('') : '<span class="sk-n">暂无标签</span>') +
      '</div>' +
      '<div class="notice" style="margin:14px 2px 0">' + DF.icon('book', 14) +
        '<span>技能以渐进式披露方式注入专家上下文</span></div>';
  }

  function renderSide() {
    var el = document.getElementById('sk-side');
    if (!el) return;
    el.innerHTML = sideHtml();
    el.querySelectorAll('[data-cat]').forEach(function (x) {
      x.onclick = function () { state.cat = x.getAttribute('data-cat'); renderSide(); renderList(); };
    });
    el.querySelectorAll('[data-tag]').forEach(function (x) {
      x.onclick = function () {
        var t = x.getAttribute('data-tag');
        var i = state.tags.indexOf(t);
        if (i >= 0) state.tags.splice(i, 1); else state.tags.push(t);
        renderSide();
        renderList();
      };
    });
    var retry = el.querySelector('#sk-cat-retry');
    if (retry) retry.onclick = loadCats;
  }

  /* ---------------- 主列表 ---------------- */
  function rowHtml(s) {
    return '<tr>' +
      '<td><span class="rowlink" data-view="' + DF.esc(s.id) + '">' + DF.esc(s.name) + '</span></td>' +
      '<td>' + DF.tag(s.categoryLabel || catLabelOf(s.categoryCode), catColor(s.categoryCode)) + '</td>' +
      '<td><div class="ellipsis" style="max-width:360px" title="' + DF.esc(s.description || '') + '">' + DF.esc(s.description || '') + '</div></td>' +
      '<td style="text-align:right"><a href="javascript:;" class="sk-uref" data-used="' + DF.esc(s.id) +
        '" title="查看引用计数">' + (s.usedByCount || 0) + '</a></td>' +
      '<td><span class="mono">' + DF.esc(s.version || '—') + '</span></td>' +
      '<td class="sub" title="' + DF.esc(fmtDateTime(s.updatedAt)) + '">' + DF.esc(relTime(s.updatedAt)) + '</td>' +
      '<td><label class="switch" title="' + (s.enabled ? '启用中，点击停用' : '已停用，点击启用') + '">' +
        '<input type="checkbox" data-sw="' + DF.esc(s.id) + '"' + (s.enabled ? ' checked' : '') + '><i></i></label></td>' +
      '<td><button class="icon-btn" data-more="' + DF.esc(s.id) + '" title="更多操作">' + DF.icon('more') + '</button></td>' +
      '</tr>';
  }

  function listHtml() {
    if (state.loading) {
      return '<div class="sub" id="sk-list-loading" style="padding:24px 4px">正在加载 Skill 列表…</div>';
    }
    if (state.listErr) {
      return DF.empty({
        icon: 'warn',
        html: '<div>Skill 列表加载失败</div><div class="sk-n" style="margin-top:6px">' + DF.esc(state.listErr) + '</div>',
        action: { id: 'sk-retry', label: '重试', icon: 'refresh', primary: true }
      });
    }
    if (!state.items.length) {
      return DF.empty({
        icon: '📦',
        html: 'Skill 库还是空的',
        action: { id: 'sk-empty-new', label: '沉淀第一个 Skill', icon: 'plus', primary: true, style: 'margin-top:10px' }
      });
    }
    var rows = filtered();
    if (!rows.length) {
      return DF.empty({
        icon: '🔍',
        html: '未找到匹配的 Skill<div class="sk-n" style="margin-top:8px"><a href="javascript:;" id="sk-clear">清除筛选条件</a></div>'
      });
    }
    return DF.table(
      ['名称', '类别', '描述', { t: '被引用', s: 'style="text-align:right"' }, '版本', '更新时间', '状态', { t: '', s: 'style="width:44px"' }],
      rows.map(rowHtml)
    );
  }

  function renderList() {
    var box = document.getElementById('sk-tblbox');
    if (!box) return;
    box.innerHTML = listHtml();
    var n = filtered().length;
    var cnt = document.getElementById('sk-count');
    if (cnt) {
      if (state.loading) cnt.textContent = '加载中…';
      else if (state.listErr) cnt.textContent = '';
      else cnt.textContent = state.items.length ? '共 ' + n + ' / ' + (state.total || state.items.length) + ' 个' : '';
    }
    box.querySelectorAll('[data-view]').forEach(function (el) {
      el.onclick = function () { openDrawer(el.getAttribute('data-view'), false); };
    });
    box.querySelectorAll('[data-used]').forEach(function (el) {
      el.onclick = function () { openUsedBy(el.getAttribute('data-used')); };
    });
    box.querySelectorAll('[data-more]').forEach(function (el) {
      el.onclick = function (e) { rowMenu(e, el.getAttribute('data-more')); };
    });
    box.querySelectorAll('[data-sw]').forEach(function (el) {
      el.onchange = function () { setEnabled(el.getAttribute('data-sw'), el.checked); };
    });
    var en = box.querySelector('#sk-empty-new');
    if (en) en.onclick = openNew;
    var retry = box.querySelector('#sk-retry');
    if (retry) retry.onclick = loadList;
    var cl = box.querySelector('#sk-clear');
    if (cl) cl.onclick = function () {
      state.cat = 'all';
      state.tags = [];
      state.kw = '';
      var q = document.getElementById('sk-q');
      if (q) q.value = '';
      renderSide();
      renderList();
    };
  }

  /* ---------------- 启停 / 删除 ---------------- */
  function setEnabled(id, next) {
    var s = itemById(id);
    if (!s) return;
    var apply = function () {
      API.setEnabled('skill', id, next, API.revision('skill', id)).then(function (dto) {
        replaceItem(dto);
        if (cur && cur.id === id && !cur.edit) {
          cur.dto = dto;
          paintDrawer();
        }
        renderSide();
        renderList();
        DF.toast((next ? '已启用「' : '已停用「') + dto.name + '」', 'ok');
      }).catch(function (err) {
        renderList(); // 失败回滚为服务端 DTO 的 enabled 状态
        DF.toast(API.errorText(err), 'err');
      });
    };
    if (!next) {
      DF.modal.confirm({
        title: '停用 Skill', danger: true, okText: '确认停用',
        message: '「' + s.name + '」当前被 ' + (s.usedByCount || 0) + ' 位专家引用，停用后这些专家将无法路由到该能力，确定停用？'
      }).then(function (ok) {
        if (!ok) { renderList(); return; }
        apply();
      });
      return;
    }
    apply();
  }

  function deleteSkill(id) {
    var s = itemById(id);
    if (!s) return;
    DF.modal.confirm({
      title: '删除 Skill', danger: true, okText: '删除',
      html: '<div>确定删除「' + DF.esc(s.name) + '」？该操作不可恢复。</div>' +
        ((s.usedByCount || 0) > 0
          ? '<div class="sub" style="margin-top:8px">当前被 ' + (s.usedByCount || 0) + ' 位专家引用，服务端可能拒绝删除。</div>'
          : '')
    }).then(function (ok) {
      if (!ok) return;
      API.remove('skill', id, API.revision('skill', id)).then(function () {
        state.items = state.items.filter(function (x) { return x.id !== id; });
        state.total = Math.max(0, state.total - 1);
        if (cur && cur.id === id) { cur = null; DF.drawer.close(); }
        renderSide();
        renderList();
        DF.toast('已删除「' + s.name + '」', 'ok');
      }).catch(function (err) {
        DF.toast('删除失败：' + deleteErrorText(err, s), 'err');
      });
    });
  }

  // B1 对被引用资产返回 409 referenced；引用方明细不提供，提示里只带计数
  function deleteErrorText(err, s) {
    if (err && err.status === 409 && err.code === 'referenced') {
      return '该 Skill 被 ' + (s.usedByCount || 0) + ' 位专家引用，禁止删除';
    }
    return API.errorText(err);
  }

  /* ---------------- 行操作菜单 / 引用计数 ---------------- */
  function rowMenu(e, id) {
    var s = itemById(id);
    if (!s) return;
    var items = [
      { label: '查看', icon: 'file', onClick: function () { openDrawer(id, false); } },
      { label: '编辑', icon: 'edit', onClick: function () { openDrawer(id, true); } },
      s.enabled
        ? { label: '停用', icon: 'pause', onClick: function () { setEnabled(id, false); } }
        : { label: '启用', icon: 'play', onClick: function () { setEnabled(id, true); } },
      { label: '删除', icon: 'trash', danger: true, onClick: function () { deleteSkill(id); } }
    ];
    var r = e.currentTarget.getBoundingClientRect();
    DF.menu(items, r.left, r.bottom + 4);
  }

  function openUsedBy(id) {
    var s = itemById(id);
    if (!s) return;
    DF.modal.open({
      title: '引用方 · ' + s.name,
      width: 460,
      body: '<div class="notice">' + DF.icon('user', 14) +
        '<span>被 <b>' + (s.usedByCount || 0) + '</b> 位专家引用</span></div>' +
        '<div class="sub" style="margin-top:8px">当前 B1 接口只提供引用计数，不提供引用方明细。</div>',
      footer: '<button class="btn primary" id="sk-u-close">关闭</button>',
      onMount: function (b, close) { b.closest('.modal').querySelector('#sk-u-close').onclick = close; }
    });
  }

  /* ---------------- 新建 Skill 弹窗 ---------------- */
  function openNew() {
    if (!state.cats.length) {
      API.categories().then(function (cats) {
        state.cats = sortCats(cats);
        if (!state.cats.length) { DF.toast('暂无可用分类，无法新建 Skill', 'err'); return; }
        renderSide();
        renderList();
        showNewModal();
      }).catch(function (err) {
        DF.toast(API.errorText(err), 'err');
      });
      return;
    }
    showNewModal();
  }

  function showNewModal() {
    var okBtn = null;
    DF.modal.form({
      title: '新建 Skill',
      width: 520,
      body:
        DF.field('名称', '<input class="inp" id="sk-nk-name" maxlength="80" placeholder="如：CRES 技能">', { required: true }) +
        DF.field('类别', '<select class="inp" id="sk-nk-cat">' +
          state.cats.map(function (c) {
            return '<option value="' + DF.esc(c.code) + '">' + DF.esc(c.label) + '</option>';
          }).join('') + '</select>') +
        DF.field('描述', '<textarea class="inp" id="sk-nk-desc" rows="3" maxlength="' + DESC_MAX + '" placeholder="适用：…；触发：…；不适用：…"></textarea>' +
          '<div class="hint"><span id="sk-nk-descn">0</span>/' + DESC_MAX + ' 字 · 适用 / 触发 / 不适用；列表检索与路由的唯一依据</div>',
          { required: true }),
      okText: '确定',
      onMount: function (b, close, btn) {
        okBtn = btn;
        var nameEl = b.querySelector('#sk-nk-name');
        var descEl = b.querySelector('#sk-nk-desc');
        var cnt = b.querySelector('#sk-nk-descn');
        nameEl.focus();
        nameEl.onkeydown = function (e) { if (e.key === 'Enter') okBtn.click(); };
        descEl.oninput = function () { cnt.textContent = descEl.value.length; };
      },
      onOk: function (b, close) {
        var nameEl = b.querySelector('#sk-nk-name');
        var descEl = b.querySelector('#sk-nk-desc');
        var name = nameEl.value.trim();
        var description = descEl.value.trim();
        if (!name) { DF.toast('请填写 Skill 名称', 'err'); nameEl.focus(); return; }
        if (name.length > 80) { DF.toast('Skill 名称不能超过 80 字', 'err'); nameEl.focus(); return; }
        if (descLen(description) < DESC_MIN) { DF.toast('请填写 Skill 描述', 'err'); descEl.focus(); return; }
        if (descLen(description) > DESC_MAX) { DF.toast('描述需在 1–400 字之间', 'err'); descEl.focus(); return; }
        var sections = {};
        SECTIONS.forEach(function (x) { sections[x[0]] = ''; });
        var body = {
          name: name,
          categoryCode: b.querySelector('#sk-nk-cat').value,
          description: description,
          tags: [],
          sections: sections,
          pitfalls: [],
          refs: []
        };
        if (okBtn) okBtn.disabled = true;
        API.create('skill', body).then(function (dto) {
          close();
          replaceItem(dto);
          renderSide();
          renderList();
          DF.toast('Skill「' + dto.name + '」已创建 · 版本 ' + dto.version, 'ok');
          openDrawer(dto.id, true);
        }).catch(function (err) {
          if (okBtn) okBtn.disabled = false;
          DF.toast(API.errorText(err), 'err');
        });
      }
    });
  }

  /* ---------------- 详情抽屉 ---------------- */
  function openDrawer(id, edit) {
    var item = itemById(id);
    DF.drawer.open({
      title: item ? item.name : 'Skill 详情',
      width: '720',
      body: '<div id="sk-dbody"></div>',
      footer: edit ? '<button class="btn" id="sk-d-cancel">取消</button><button class="btn primary" id="sk-d-save">' +
        DF.icon('check', 14) + '保存</button>' : '',
      onClose: function () { cur = null; },
      onMount: function (body, close) {
        cur = { id: id, dto: null, edit: !!edit, draft: null, err: '', saving: false,
          view: 'structured', doc: null };
        var head = body.parentElement.querySelector('.d-head');
        var btn = document.createElement('button');
        btn.className = 'btn sm sk-mode';
        btn.disabled = true;
        btn.onclick = function () {
          if (!cur || !cur.dto) return;
          openDrawer(cur.id, !cur.edit);
        };
        head.insertBefore(btn, head.querySelector('.x'));
        if (edit) {
          var foot = body.parentElement.querySelector('.d-foot');
          foot.querySelector('#sk-d-cancel').onclick = function () { close(); };
          foot.querySelector('#sk-d-save').onclick = saveSkill;
        }
        paintDrawer();
        loadDetail(id);
      }
    });
  }

  function loadDetail(id) {
    API.get('skill', id).then(function (dto) {
      if (!cur || cur.id !== id) return;
      cur.dto = dto;
      cur.err = '';
      if (cur.edit) cur.draft = DF.deep(dto);
      var head = document.querySelector('.drawer .d-head');
      if (head && head.firstChild && head.firstChild.nodeType === 3) head.firstChild.nodeValue = dto.name;
      paintDrawer();
    }).catch(function (err) {
      if (!cur || cur.id !== id) return;
      cur.err = API.errorText(err);
      paintDrawer();
      DF.toast('详情加载失败：' + API.errorText(err), 'err');
    });
  }

  function syncHeadFoot() {
    var d = document.querySelector('.drawer');
    if (!d || !cur) return;
    var btn = d.querySelector('.d-head .sk-mode');
    if (btn) {
      btn.disabled = !cur.dto;
      btn.innerHTML = cur.edit ? '查看' : DF.icon('edit', 14) + ' 编辑';
    }
    var foot = d.querySelector('.d-foot');
    if (foot) foot.style.display = cur.edit ? '' : 'none';
  }

  function paintDrawer() {
    if (!cur) return;
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    if (!cur.dto) {
      if (cur.err) {
        box.innerHTML = '<div class="notice">' + DF.icon('warn', 14) + '<span>' + DF.esc(cur.err) + '</span></div>' +
          '<div style="margin-top:12px"><button class="btn sm" id="sk-d-retry">重试</button></div>';
        var retry = box.querySelector('#sk-d-retry');
        if (retry) retry.onclick = function () {
          if (!cur) return;
          cur.err = '';
          paintDrawer();
          loadDetail(cur.id);
        };
      } else {
        box.innerHTML = '<div class="sub" style="padding:20px 2px">正在加载 Skill 详情…</div>';
      }
      syncHeadFoot();
      return;
    }
    if (!cur.edit && cur.view === 'document') {
      box.innerHTML = DF.tabsHtml([
        { k: 'structured', label: '结构化' },
        { k: 'document', label: '全文' }
      ], cur.view, 'data-skview') + docViewHtml();
      bindViewTabs();
      bindDocView();
      syncHeadFoot();
      return;
    }
    box.innerHTML =
      (cur.edit ? '' : DF.tabsHtml([
        { k: 'structured', label: '结构化' },
        { k: 'document', label: '全文' }
      ], cur.view, 'data-skview')) +
      drawerHtml(cur.edit ? cur.draft : cur.dto, cur.edit);
    bindDrawer();
    if (!cur.edit) bindViewTabs();
    syncHeadFoot();
  }

  /* ---------------- 全文视图（API-31，纯文本） ---------------- */
  function bindViewTabs() {
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    box.querySelectorAll('[data-skview]').forEach(function (el) {
      el.onclick = function () {
        if (!cur) return;
        var next = el.getAttribute('data-skview');
        if (cur.view === next) return;
        cur.view = next;
        paintDrawer();
        if (next === 'document') loadDocument();
      };
    });
  }

  function loadDocument() {
    if (!cur || !cur.dto) return;
    var id = cur.id;
    if (!cur.doc) cur.doc = { text: '', notModified: false, loading: false, err: '' };
    cur.doc.loading = true;
    cur.doc.err = '';
    paintDrawer();
    API.document('skill', id).then(function (res) {
      if (!cur || cur.id !== id) return;
      cur.doc.text = res.text;
      cur.doc.notModified = !!res.notModified;
      cur.doc.loading = false;
      cur.doc.err = '';
      paintDrawer();
    }).catch(function (err) {
      if (!cur || cur.id !== id) return;
      cur.doc.loading = false;
      cur.doc.err = API.errorText(err);
      if (err && err.status === 404) cur.doc.text = '';
      paintDrawer();
    });
  }

  function docViewHtml() {
    var d = cur.doc || { text: '', notModified: false, loading: false, err: '' };
    var head = '<div class="sk-docbar"><b>编排文档</b>' +
      '<span class="sk-n mono">GET /skills/{id}/document · text/markdown</span></div>';
    if (d.loading && !d.text) {
      return head + '<div class="sub" style="padding:16px 2px">正在加载编排文档…</div>';
    }
    var err = d.err
      ? '<div class="notice" style="margin-bottom:10px">' + DF.icon('warn', 14) +
        '<span>' + DF.esc(d.err) + ' <a href="javascript:;" id="sk-doc-retry">重试</a></span></div>'
      : '';
    var meta = d.loading ? '正在校验更新…' : (d.notModified ? '304 · 已复用上次文本' : '200 · 已更新');
    var body = d.text
      ? '<div class="sk-docmeta">' + meta + '</div><pre class="sk-doc" id="sk-doc-text">' + DF.esc(d.text) + '</pre>'
      : '';
    if (!d.text && !d.err) {
      body = '<div class="sub" style="padding:16px 2px">文档为空</div>';
    }
    return head + err + body;
  }

  function bindDocView() {
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    var retry = box.querySelector('#sk-doc-retry');
    if (retry) retry.onclick = loadDocument;
  }

  /* ---------------- 抽屉内容 ---------------- */
  function catOptionsHtml(code) {
    var list = state.cats;
    var has = false;
    var html = list.map(function (c) {
      if (c.code === code) has = true;
      return '<option value="' + DF.esc(c.code) + '"' + (c.code === code ? ' selected' : '') + '>' +
        DF.esc(c.label) + '</option>';
    }).join('');
    if (code && !has) {
      html = '<option value="' + DF.esc(code) + '" selected>' + DF.esc(code) + '</option>' + html;
    }
    return html;
  }

  function drawerHtml(s, edit) {
    var tags = s.tags || [];
    var pf = s.pitfalls || [];
    var refs = s.refs || [];
    var desc = String(s.description || '');
    var secBlock = function (k, label, idx) {
      var val = String((s.sections || {})[k] || '');
      var inner = edit
        ? '<textarea class="inp" data-sec="' + k + '" rows="' + (k === 'overview' ? 4 : 5) + '">' + DF.esc(val) + '</textarea>'
        : (val ? '<div class="sk-pre">' + DF.esc(val) + '</div>' : '<div class="sub" style="padding:2px 0">暂无内容</div>');
      return '<details' + (idx === 0 ? ' open' : '') + '><summary>' + label +
        '<span class="sk-load">按需加载</span></summary><div class="sk-sec">' + inner + '</div></details>';
    };
    return (
      /* ① 描述 */
      '<div class="section-title">① 描述<span class="line"></span></div>' +
      '<div class="sk-lbl">描述（适用 / 触发 / 不适用）</div>' +
      (edit
        ? '<textarea class="inp" id="sk-d-desc" rows="3" maxlength="' + DESC_MAX + '">' + DF.esc(desc) + '</textarea>' +
          '<div class="hint"><span id="sk-d-descn">' + desc.length + '</span>/' + DESC_MAX + ' 字 · 列表检索与路由的唯一依据</div>'
        : '<div class="sk-ptext">' + DF.esc(desc) + '</div>') +
      '<div class="sk-kv"><span class="sk-k">类别</span><span>' +
        (edit
          ? '<select class="inp" id="sk-d-cat" style="max-width:240px">' + catOptionsHtml(s.categoryCode) + '</select>'
          : DF.tag(s.categoryLabel || catLabelOf(s.categoryCode), catColor(s.categoryCode))) +
      '</span></div>' +
      '<div class="sk-lbl">标签</div>' +
      '<div class="chips">' +
        (tags.length ? tags.map(function (t, i) {
          return '<span class="chip">' + DF.esc(t) + (edit ? '<span class="sk-x" data-dtag="' + i + '" title="删除">×</span>' : '') + '</span>';
        }).join('') : '<span class="sk-n">暂无</span>') +
      '</div>' +
      (edit ? '<input class="inp sk-chipin" id="sk-d-tagin" placeholder="输入标签后回车添加">' : '') +

      /* ② 工作内容（渐进式披露） */
      '<div class="section-title">② 工作内容（渐进式披露）<span class="line"></span></div>' +
      '<div class="notice">' + DF.icon('book', 14) +
        '<span>以下五章、踩坑与引用组成编排文档；全文视图按 API-31 原样展示，前端不再拼接</span></div>' +
      '<div class="tree">' + SECTIONS.map(function (x, i) { return secBlock(x[0], x[1], i); }).join('') + '</div>' +

      /* ③ 踩坑记录与禁令 */
      '<div class="section-title">③ 踩坑记录与禁令<span class="line"></span></div>' +
      (pf.length ? pf.map(function (p, i) {
        return '<div class="pitfall">' + DF.icon('warn', 14) + '<span style="flex:1">' + DF.esc(p) + '</span>' +
          (edit ? '<span class="sk-x" data-dpf="' + i + '" title="删除">×</span>' : '') + '</div>';
      }).join('') : '<div class="sub" style="padding:2px 0">暂无踩坑记录</div>') +
      (edit ? '<input class="inp sk-chipin" id="sk-d-pfin" placeholder="输入踩坑/禁令后回车添加（新条目置顶展示）">' : '') +

      /* ④ 参考引用 */
      '<div class="section-title">④ 参考引用<span class="line"></span></div>' +
      (refs.length ? refs.map(function (r) {
        return '<div class="sk-ref">' + DF.tag(r.refType || 'ref', REF_COLORS[r.refType] || 'gray') +
          '<span>' + DF.esc(r.label) + '</span>' +
          (r.path ? '<span class="mono sk-refpath">' + DF.esc(r.path) + '</span>' : '') +
          '</div>';
      }).join('') : '<div class="sub" style="padding:2px 0">暂无参考引用</div>') +

      /* ⑤ 版本（B1 只提供当前版本与更新时间，无版本历史） */
      '<div class="section-title">⑤ 版本<span class="line"></span></div>' +
      '<div class="kv">' +
        '<div class="k mono">' + DF.esc(s.version || '—') + '</div>' +
        '<div>当前版本 · 更新于 ' + DF.esc(fmtDateTime(s.updatedAt)) + '</div>' +
      '</div>'
    );
  }

  /* ---------------- 抽屉编辑态 ---------------- */
  function harvest() {
    if (!cur || !cur.edit || !cur.draft) return;
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    var desc = box.querySelector('#sk-d-desc');
    if (desc) cur.draft.description = desc.value;
    var cat = box.querySelector('#sk-d-cat');
    if (cat) cur.draft.categoryCode = cat.value;
    box.querySelectorAll('textarea[data-sec]').forEach(function (t) {
      cur.draft.sections[t.getAttribute('data-sec')] = t.value;
    });
  }

  function bindDrawer() {
    if (!cur || !cur.edit || !cur.draft) return;
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    var desc = box.querySelector('#sk-d-desc');
    if (desc) {
      var cnt = box.querySelector('#sk-d-descn');
      desc.oninput = function () { if (cnt) cnt.textContent = desc.value.length; };
    }
    box.querySelectorAll('[data-dtag]').forEach(function (el) {
      el.onclick = function () {
        harvest();
        cur.draft.tags.splice(+el.getAttribute('data-dtag'), 1);
        paintDrawer();
      };
    });
    box.querySelectorAll('[data-dpf]').forEach(function (el) {
      el.onclick = function () {
        harvest();
        cur.draft.pitfalls.splice(+el.getAttribute('data-dpf'), 1);
        paintDrawer();
      };
    });
    var tagin = box.querySelector('#sk-d-tagin');
    if (tagin) tagin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      harvest();
      var v = tagin.value.trim();
      if (!v) return;
      if ((cur.draft.tags || []).indexOf(v) >= 0) { DF.toast('标签已存在', 'warn'); return; }
      cur.draft.tags.push(v);
      paintDrawer();
    };
    var pin = box.querySelector('#sk-d-pfin');
    if (pin) pin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      harvest();
      var v = pin.value.trim();
      if (!v) return;
      cur.draft.pitfalls.unshift(v); // 禁令置顶
      paintDrawer();
    };
  }

  function saveSkill() {
    if (!cur || !cur.edit || !cur.draft || cur.saving) return;
    harvest();
    var d = cur.draft;
    var name = String(d.name || '').trim();
    var description = String(d.description || '').trim();
    if (!name) { DF.toast('请填写 Skill 名称', 'err'); return; }
    if (descLen(description) < DESC_MIN) { DF.toast('请填写 Skill 描述', 'err'); return; }
    if (descLen(description) > DESC_MAX) { DF.toast('描述需在 1–400 字之间', 'err'); return; }
    if (!d.categoryCode) { DF.toast('请选择 Skill 类别', 'err'); return; }
    var sections = {};
    SECTIONS.forEach(function (x) {
      sections[x[0]] = String((d.sections || {})[x[0]] || '');
    });
    var body = {
      name: name,
      categoryCode: d.categoryCode,
      description: description,
      tags: (d.tags || []).slice(),
      sections: sections,
      pitfalls: (d.pitfalls || []).slice(),
      refs: (d.refs || []).map(function (r) {
        return { label: r.label, refType: r.refType, path: r.path == null ? null : r.path };
      })
    };
    var id = cur.id;
    cur.saving = true;
    var saveBtn = document.querySelector('.drawer #sk-d-save');
    if (saveBtn) saveBtn.disabled = true;
    API.update('skill', id, body, API.revision('skill', id)).then(function (dto) {
      replaceItem(dto);
      renderSide();
      renderList();
      if (!cur || cur.id !== id) return;
      cur.saving = false;
      cur.dto = dto;
      cur.draft = DF.deep(dto);
      cur.edit = false;
      cur.doc = null;
      paintDrawer();
      DF.toast('已保存 · 当前版本 ' + dto.version, 'ok');
    }).catch(function (err) {
      if (cur && cur.id === id) cur.saving = false;
      var btn = document.querySelector('.drawer #sk-d-save');
      if (btn) btn.disabled = false;
      DF.toast(API.errorText(err), 'err');
    });
  }

  /* ---------------- 启动 ---------------- */
  render();
})();
