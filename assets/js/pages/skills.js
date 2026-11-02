/**
 * AgentFlow 原型 · Skill 列表页（B1 实时接口）
 * 依赖: API（B1 DTO 客户端）、DF（ui.js）、SK（skill-common.js）
 *
 * 约定：
 * - 本页只承载列表、筛选、启停、删除与引用计数；
 * - 查看/编辑/新建跳转 `skill-detail.html`，不再打开抽屉；
 * - 页面状态直接保存 B1 DTO，不读 MOCK，不建第二套视图模型。
 */

import { DF } from '../ui.js';
import { API } from '../api.js';
import { SK } from './skill-common.js';


  var state = {
    cat: 'all',
    tags: [],
    kw: '',
    items: [],
    total: 0,
    cats: [],
    loading: true,
    listErr: '',
    catErr: ''
  };

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
      state.cats = SK.sortCats(cats);
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
      '<td>' + DF.tag(s.categoryLabel || SK.catLabel(state.cats, s.categoryCode), SK.catColor(state.cats, s.categoryCode)) + '</td>' +
      '<td><div class="ellipsis" style="max-width:360px" title="' + DF.esc(s.description || '') + '">' + DF.esc(s.description || '') + '</div></td>' +
      '<td style="text-align:right"><a href="javascript:;" class="sk-uref" data-used="' + DF.esc(s.id) +
        '" title="查看引用计数">' + (s.usedByCount || 0) + '</a></td>' +
      '<td><span class="mono">' + DF.esc(s.version || '—') + '</span></td>' +
      '<td class="sub" title="' + DF.esc(SK.fmtDateTime(s.updatedAt)) + '">' + DF.esc(SK.relTime(s.updatedAt)) + '</td>' +
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
      el.onclick = function () { location.href = SK.detailUrl(el.getAttribute('data-view')); };
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
      { label: '查看', icon: 'file', onClick: function () { location.href = SK.detailUrl(id); } },
      { label: '编辑', icon: 'edit', onClick: function () { location.href = SK.detailUrl(id, 'edit'); } },
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

  function openNew() {
    location.href = SK.detailUrl(null, 'new');
  }

  render();
