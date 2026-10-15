/**
 * AgentFlow 原型 · Skill 库页面
 * 依赖: window.MOCK（mock-data.js）、window.DF（ui.js）
 */
(function () {
  'use strict';

  /* ---------------- 常量与状态 ---------------- */
  var CATS = ['编码', '检索', '审视', '测试'];
  var CAT_COLOR = { '编码': 'blue', '检索': 'teal', '审视': 'purple', '测试': 'orange' };
  var SECTIONS = [
    ['overview', '流程总述'],
    ['steps', '详细步骤与约束'],
    ['examples', '参考案例模板'],
    ['scripts', '外部脚本使用指南'],
    ['verification', '完成验证方案']
  ];
  var REF_COLOR = { 'skill': 'blue', '模板': 'teal', '外部规范': 'purple' };

  var state = { cat: '全部', tags: [], kw: '' };
  var cur = null; // 当前抽屉: { id, edit, snap }

  var byId = function (id) { return MOCK.byId(MOCK.skills, id); };
  function bumpVersion(v) {
    var m = /^v(\d+)\.(\d+)$/.exec(v || 'v1.0') || [null, '1', '0'];
    var a = +m[1], b = +m[2] + 1;
    if (b > 9) { a++; b = 0; }
    return 'v' + a + '.' + b;
  }
  function prevVersion(v) {
    var m = /^v(\d+)\.(\d+)$/.exec(v || 'v1.0') || [null, '1', '0'];
    var a = +m[1], b = +m[2] - 1;
    if (b < 0) { a--; b = 9; }
    return 'v' + a + '.' + b;
  }
  function tagCloud() {
    var seen = [];
    MOCK.skills.forEach(function (s) { (s.tags || []).forEach(function (t) { if (seen.indexOf(t) < 0) seen.push(t); }); });
    return seen.slice(0, 10);
  }
  function capLine(s) {
    var t = String(s.summary || '').replace(/\s+/g, '');
    var cut = (t.split(/[。；;]/)[0] || t);
    if (cut.length > 46) cut = cut.slice(0, 46) + '…';
    return '可复用能力：' + (cut || (s.name + ' 标准执行流程'));
  }
  function sceneLine(s) {
    var t = s.triggers || [];
    return t.length
      ? '专家任务上下文出现「' + t.join(' / ') + '」等意图时，路由加载本 Skill'
      : '由专家按任务语义自动路由（暂未配置触发关键词）';
  }
  function filtered() {
    var kw = state.kw.trim().toLowerCase();
    return MOCK.skills.filter(function (s) {
      if (state.cat !== '全部' && s.category !== state.cat) return false;
      if (state.tags.length && !(s.tags || []).some(function (t) { return state.tags.indexOf(t) >= 0; })) return false;
      if (kw && (s.name + ' ' + s.summary + ' ' + (s.triggers || []).join(' ')).toLowerCase().indexOf(kw) < 0) return false;
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
            DF.searchBox('sk-q', '搜索名称 / 触发词 / 摘要', state.kw) +
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
  }

  /* ---------------- 左侧筛选栏 ---------------- */
  function sideHtml() {
    var all = MOCK.skills;
    var cats = [['全部', all.length]].concat(CATS.map(function (c) {
      return [c, all.filter(function (s) { return s.category === c; }).length];
    }));
    var tags = tagCloud();
    return '<div class="sk-side-h">分类</div><div class="sk-cats">' +
      cats.map(function (p) {
        return '<div class="sk-cat' + (state.cat === p[0] ? ' on' : '') + '" data-cat="' + DF.esc(p[0]) + '">' +
          '<span>' + DF.esc(p[0]) + '</span><span class="sk-n">' + p[1] + '</span></div>';
      }).join('') +
      '</div>' +
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
        renderSide(); renderList();
      };
    });
  }

  /* ---------------- 主列表 ---------------- */
  function rowHtml(s) {
    var trig = s.triggers || [];
    var shown = trig.slice(0, 3);
    return '<tr>' +
      '<td><span class="rowlink" data-view="' + s.id + '">' + DF.esc(s.name) + '</span></td>' +
      '<td>' + DF.tag(s.category, CAT_COLOR[s.category] || 'gray') + '</td>' +
      '<td><div class="ellipsis" style="max-width:280px" title="' + DF.esc(s.summary) + '">' + DF.esc(s.summary) + '</div></td>' +
      '<td><div class="chips" style="max-width:210px">' +
        shown.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('') +
        (trig.length > 3 ? '<span class="chip" title="' + DF.esc(trig.slice(3).join('、')) + '">+' + (trig.length - 3) + '</span>' : '') +
        (!trig.length ? '<span class="sk-n">—</span>' : '') +
      '</div></td>' +
      '<td style="text-align:right"><a href="javascript:;" class="sk-uref" data-used="' + s.id + '" title="查看引用方">' + s.usedBy + '</a></td>' +
      '<td><span class="mono">' + DF.esc(s.version) + '</span></td>' +
      '<td class="sub">' + DF.relTime(s.updatedM) + '</td>' +
      '<td><label class="switch" title="' + (s.enabled ? '启用中，点击停用' : '已停用，点击启用') + '">' +
        '<input type="checkbox" data-sw="' + s.id + '"' + (s.enabled ? ' checked' : '') + '><i></i></label></td>' +
      '<td><button class="icon-btn" data-more="' + s.id + '" title="更多操作">' + DF.icon('more') + '</button></td>' +
      '</tr>';
  }
  function listHtml() {
    if (!MOCK.skills.length) {
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
      ['名称', '类别', '常驻摘要', '触发关键词', { t: '被引用', s: 'style="text-align:right"' }, '版本', '更新时间', '状态', { t: '', s: 'style="width:44px"' }],
      rows.map(rowHtml)
    );
  }
  function renderList() {
    var box = document.getElementById('sk-tblbox');
    if (!box) return;
    box.innerHTML = listHtml();
    var n = filtered().length;
    var cnt = document.getElementById('sk-count');
    if (cnt) cnt.textContent = MOCK.skills.length ? '共 ' + n + ' / ' + MOCK.skills.length + ' 个' : '';
    box.querySelectorAll('[data-view]').forEach(function (el) { el.onclick = function () { openDrawer(el.getAttribute('data-view'), false); }; });
    box.querySelectorAll('[data-used]').forEach(function (el) { el.onclick = function () { openUsedBy(el.getAttribute('data-used')); }; });
    box.querySelectorAll('[data-more]').forEach(function (el) { el.onclick = function (e) { rowMenu(e, el.getAttribute('data-more')); }; });
    box.querySelectorAll('[data-sw]').forEach(function (el) { el.onchange = function () { toggleSkill(el.getAttribute('data-sw')); }; });
    var en = box.querySelector('#sk-empty-new');
    if (en) en.onclick = openNew;
    var cl = box.querySelector('#sk-clear');
    if (cl) cl.onclick = function () {
      state.cat = '全部'; state.tags = []; state.kw = '';
      document.getElementById('sk-q').value = '';
      renderSide(); renderList();
    };
  }

  /* ---------------- 状态开关 ---------------- */
  async function toggleSkill(id) {
    var s = byId(id);
    if (!s) return;
    if (s.enabled) {
      var ok = await DF.modal.confirm({
        title: '停用 Skill', danger: true, okText: '确认停用',
        message: '「' + s.name + '」当前被 ' + s.usedBy + ' 位专家引用，停用后这些专家将无法路由到该能力，确定停用？'
      });
      if (!ok) { renderList(); return; }
      s.enabled = false;
      DF.toast('已停用「' + s.name + '」', 'ok');
    } else {
      s.enabled = true;
      DF.toast('已启用「' + s.name + '」', 'ok');
    }
    renderList();
  }

  /* ---------------- 行操作菜单 ---------------- */
  function rowMenu(e, id) {
    var s = byId(id);
    if (!s) return;
    var items = [
      { label: '查看', icon: 'file', onClick: function () { openDrawer(id, false); } },
      { label: '编辑', icon: 'edit', onClick: function () { openDrawer(id, true); } },
      s.enabled
        ? { label: '停用', icon: 'pause', onClick: function () { s.enabled = false; renderList(); DF.toast('已停用「' + s.name + '」', 'ok'); } }
        : { label: '启用', icon: 'play', onClick: function () { s.enabled = true; renderList(); DF.toast('已启用「' + s.name + '」', 'ok'); } },
      { label: '删除', icon: 'trash', danger: true, onClick: async function () {
          if (s.usedBy > 0) { DF.toast('该 Skill 被 ' + s.usedBy + ' 位专家引用，禁止删除', 'err'); return; }
          var ok = await DF.modal.confirm({
            title: '删除 Skill', danger: true, okText: '删除',
            message: '确定删除「' + s.name + '」？该操作不可恢复。'
          });
          if (!ok) return;
          MOCK.skills.splice(MOCK.skills.indexOf(s), 1);
          if (cur && cur.id === id) DF.drawer.close();
          renderList(); renderSide();
          DF.toast('已删除「' + s.name + '」', 'ok');
        } }
    ];
    var r = e.currentTarget.getBoundingClientRect();
    DF.menu(items, r.left, r.bottom + 4);
    if (s.usedBy > 0) {
      var mis = document.querySelectorAll('.menu .mi');
      var del = mis[mis.length - 1];
      if (del) { del.style.opacity = '.45'; del.style.cursor = 'not-allowed'; }
    }
  }

  /* ---------------- 引用方弹窗 ---------------- */
  function openUsedBy(id) {
    var s = byId(id);
    if (!s) return;
    var experts = (MOCK.experts || []).filter(function (x) { return (x.skills || []).indexOf(id) >= 0; });
    var rows = experts.map(function (x) {
      return '<div class="sk-ref">' +
        '<span class="sk-av" style="background:' + (x.color || '#64748b') + '">' + DF.esc(String(x.name || '?').charAt(0)) + '</span>' +
        '<div><div style="font-weight:600">' + DF.esc(x.name) + '</div><div class="sub">' + DF.esc(x.duty || '') + '</div></div>' +
        '</div>';
    }).join('');
    DF.modal.open({
      title: '引用方 · ' + s.name,
      width: 460,
      body: '<div class="notice">' + DF.icon('user', 14) + '<span>被 <b>' + s.usedBy + '</b> 位专家引用</span></div>' +
        (rows || '<div class="sub">引用关系由工作流节点编排配置产生，暂无专家直接挂载。</div>') +
        (rows && experts.length < s.usedBy ? '<div class="sub" style="margin-top:8px">其余 ' + (s.usedBy - experts.length) + ' 处引用来自工作流节点编排配置。</div>' : ''),
      footer: '<button class="btn primary" id="sk-u-close">关闭</button>',
      onMount: function (b, close) { b.closest('.modal').querySelector('#sk-u-close').onclick = close; }
    });
  }

  /* ---------------- 新建 Skill 弹窗 ---------------- */
  function openNew() {
    DF.modal.form({
      title: '新建 Skill',
      width: 520,
      body:
        DF.field('名称', '<input class="inp" id="sk-nk-name" placeholder="如：CRES 技能">', { required: true }) +
        DF.field('类别', '<select class="inp" id="sk-nk-cat">' +
          CATS.map(function (c) { return '<option>' + DF.esc(c) + '</option>'; }).join('') + '</select>') +
        DF.field('常驻摘要', '<textarea class="inp" id="sk-nk-sum" rows="3" maxlength="200" placeholder="一句话描述该 Skill 的能力"></textarea>',
          { hint: '≤200 字，常驻 Context；创建后可在详情抽屉补全触发关键词与各章节' }),
      okText: '确定',
      onMount: function (b, close, okBtn) {
        var nameEl = b.querySelector('#sk-nk-name');
        nameEl.focus();
        nameEl.onkeydown = function (e) { if (e.key === 'Enter') okBtn.click(); };
      },
      onOk: function (b, close) {
        var nameEl = b.querySelector('#sk-nk-name');
        var name = nameEl.value.trim();
        if (!name) { DF.toast('请填写 Skill 名称', 'err'); nameEl.focus(); return; }
        var s = {
          id: 'sk-x-' + Date.now(),
          name: name,
          category: b.querySelector('#sk-nk-cat').value,
          tags: [],
          summary: b.querySelector('#sk-nk-sum').value.trim(),
          triggers: [],
          sections: {
            overview: '（待补充）适用场景、执行步骤总览、输入输出约定、与其他 Skill 的配合关系。',
            steps: '（待补充）详细执行步骤与约束条件。',
            examples: '（待补充）参考案例与产物模板路径。',
            scripts: '（待补充）外部脚本的位置、参数与调用方式。',
            verification: '（待补充）完成验证方案与检查单。'
          },
          pitfalls: [], refs: [],
          version: 'v1.0', enabled: true, updatedM: 0, usedBy: 0
        };
        MOCK.skills.push(s);
        close();
        render();
        openDrawer(s.id, true);
        DF.toast('Skill「' + name + '」已创建，请补全详情', 'ok');
      }
    });
  }

  /* ---------------- 详情抽屉 ---------------- */
  function openDrawer(id, edit) {
    var s = byId(id);
    if (!s) return;
    var st = { id: id, edit: !!edit, snap: JSON.stringify(s) };
    DF.drawer.open({
      title: s.name,
      width: '720',
      body: '<div id="sk-dbody"></div>',
      footer: st.edit ? '<button class="btn" id="sk-d-cancel">取消</button><button class="btn primary" id="sk-d-save">' + DF.icon('check', 14) + '保存</button>' : '',
      onClose: function () { cur = null; },
      onMount: function (body, close) {
        cur = st;
        var head = body.parentElement.querySelector('.d-head');
        var btn = document.createElement('button');
        btn.className = 'btn sm sk-mode';
        btn.onclick = function () {
          if (cur && cur.edit) { // 未保存即切走：还原快照
            var s0 = byId(cur.id);
            if (s0) restoreSnap(s0);
          }
          openDrawer(cur.id, !cur.edit);
        };
        head.insertBefore(btn, head.querySelector('.x'));
        if (st.edit) {
          var foot = body.parentElement.querySelector('.d-foot');
          foot.querySelector('#sk-d-cancel').onclick = function () {
            var s1 = byId(cur.id);
            if (s1) restoreSnap(s1);
            close();
          };
          foot.querySelector('#sk-d-save').onclick = saveSkill;
        }
        paintDrawer();
      }
    });
  }
  function restoreSnap(s) {
    if (!cur || !cur.snap) return;
    var o = JSON.parse(cur.snap);
    Object.keys(o).forEach(function (k) { s[k] = o[k]; });
    renderList();
  }
  function syncHeadFoot() {
    var d = document.querySelector('.drawer');
    if (!d || !cur) return;
    var btn = d.querySelector('.d-head .sk-mode');
    if (btn) btn.innerHTML = cur.edit ? '查看' : DF.icon('edit', 14) + ' 编辑';
    var foot = d.querySelector('.d-foot');
    if (foot) foot.style.display = cur.edit ? '' : 'none';
  }
  function paintDrawer() {
    if (!cur) return;
    var s = byId(cur.id);
    if (!s) { DF.drawer.close(); return; }
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    box.innerHTML = drawerHtml(s, cur.edit);
    bindDrawer(s);
    syncHeadFoot();
  }
  function harvest(s) {
    if (!cur || !cur.edit) return;
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    var sum = box.querySelector('#sk-d-sum');
    if (sum) s.summary = sum.value.trim();
    box.querySelectorAll('textarea[data-sec]').forEach(function (t) {
      s.sections[t.getAttribute('data-sec')] = t.value;
    });
  }
  function saveSkill() {
    var s = byId(cur.id);
    if (!s) return;
    harvest(s);
    s.version = bumpVersion(s.version);
    s.updatedM = 0;
    cur.edit = false;
    cur.snap = JSON.stringify(s);
    renderList(); renderSide();
    paintDrawer();
    DF.toast('已保存', 'ok');
  }
  function drawerHtml(s, edit) {
    var trig = s.triggers || [];
    var pf = s.pitfalls || [];
    var secBlock = function (k, label, idx) {
      var val = (s.sections || {})[k] || '';
      return '<details' + (idx === 0 ? ' open' : '') + '><summary>' + label + '<span class="sk-load">按需加载</span></summary>' +
        '<div class="sk-sec">' + (edit
          ? '<textarea class="inp" data-sec="' + k + '" rows="' + (k === 'overview' ? 4 : 5) + '">' + DF.esc(val) + '</textarea>'
          : '<div class="sk-pre">' + DF.esc(val) + '</div>') + '</div></details>';
    };
    return (
      /* ① 描述与路由 */
      '<div class="section-title">① 描述与路由<span class="line"></span></div>' +
      '<div class="sk-lbl">常驻摘要</div>' +
      (edit
        ? '<textarea class="inp" id="sk-d-sum" rows="3" maxlength="200">' + DF.esc(s.summary) + '</textarea>' +
          '<div class="hint"><span id="sk-d-sumn">' + String(s.summary || '').length + '</span>/200 字 · 常驻 Context，随专家常驻加载</div>'
        : '<div class="sk-ptext">' + DF.esc(s.summary) + '</div>') +
      '<div class="sk-kv"><span class="sk-k">能力清单</span><span>' + DF.esc(capLine(s)) + '</span></div>' +
      '<div class="sk-kv"><span class="sk-k">触发场景</span><span>' + DF.esc(sceneLine(s)) + '</span></div>' +
      '<div class="sk-lbl">触发关键词</div>' +
      '<div class="chips">' +
        (trig.length ? trig.map(function (t, i) {
          return '<span class="chip">' + DF.esc(t) + (edit ? '<span class="sk-x" data-dtrig="' + i + '" title="删除">×</span>' : '') + '</span>';
        }).join('') : '<span class="sk-n">暂无</span>') +
      '</div>' +
      (edit ? '<input class="inp sk-chipin" id="sk-d-trigin" placeholder="输入关键词后回车添加">' : '') +

      /* ② 工作内容（渐进式披露） */
      '<div class="section-title">② 工作内容（渐进式披露）<span class="line"></span></div>' +
      '<div class="notice">' + DF.icon('book', 14) +
        '<span>渐进式披露：常驻摘要常驻 Context，以下章节按需加载，不占用常驻窗口</span></div>' +
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
      ((s.refs || []).length ? s.refs.map(function (r, i) {
        var isSkill = r.type === 'skill';
        return '<div class="sk-ref">' + DF.tag(r.type === 'skill' ? 'Skill' : r.type, REF_COLOR[r.type] || 'gray') +
          (isSkill
            ? '<span class="rowlink" data-goref="' + i + '" title="打开关联 Skill">' + DF.esc(r.label) + '</span>'
            : '<span class="mono sk-refpath">' + DF.esc(r.label) + '</span>') +
          '</div>';
      }).join('') : '<div class="sub" style="padding:2px 0">暂无参考引用</div>') +

      /* ⑤ 版本历史 */
      '<div class="section-title">⑤ 版本历史<span class="line"></span></div>' +
      '<div class="kv">' +
        '<div class="k mono">' + DF.esc(s.version) + '</div><div>' + DF.relTime(s.updatedM) + ' · 当前版本</div>' +
        '<div class="k mono">' + DF.esc(prevVersion(s.version)) + '</div><div>例行修订</div>' +
      '</div>'
    );
  }
  function bindDrawer(s) {
    var box = document.getElementById('sk-dbody');
    if (!box) return;
    var sum = box.querySelector('#sk-d-sum');
    if (sum) {
      var cnt = box.querySelector('#sk-d-sumn');
      sum.oninput = function () { cnt.textContent = sum.value.length; };
    }
    box.querySelectorAll('[data-dtrig]').forEach(function (el) {
      el.onclick = function () { harvest(s); s.triggers.splice(+el.getAttribute('data-dtrig'), 1); paintDrawer(); };
    });
    box.querySelectorAll('[data-dpf]').forEach(function (el) {
      el.onclick = function () { harvest(s); s.pitfalls.splice(+el.getAttribute('data-dpf'), 1); paintDrawer(); };
    });
    var tin = box.querySelector('#sk-d-trigin');
    if (tin) tin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault(); harvest(s);
      var v = tin.value.trim();
      if (!v) return;
      if (s.triggers.indexOf(v) >= 0) { DF.toast('关键词已存在', 'warn'); return; }
      s.triggers.push(v);
      paintDrawer();
    };
    var pin = box.querySelector('#sk-d-pfin');
    if (pin) pin.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault(); harvest(s);
      var v = pin.value.trim();
      if (!v) return;
      s.pitfalls.unshift(v); // 禁令置顶
      paintDrawer();
    };
    box.querySelectorAll('[data-goref]').forEach(function (el) {
      el.onclick = function () {
        var r = (s.refs || [])[+el.getAttribute('data-goref')];
        if (!r) return;
        var name = r.label.replace(/^关联 Skill:\s*/, '').trim();
        var t = MOCK.skills.filter(function (x) { return x.name === name; })[0];
        if (!t) { DF.toast('未找到关联 Skill「' + name + '」', 'err'); return; }
        DF.drawer.close();
        openDrawer(t.id, false);
      };
    });
  }

  /* ---------------- 启动 ---------------- */
  render();
})();
