/**
 * AgentFlow 原型 · 专家管理 · 列表页 + 详情抽屉
 * 规格: docs/design/components/experts/spec.md（卡片列表 / 五区详情抽屉 / 新建弹窗 / 空态）
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const M = window.MOCK;
  const E = M.experts, S = M.skills, T = M.tools;

  const PALETTE = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#0d9488', '#dc2626', '#4f46e5', '#0ea5e9'];
  const REF_TYPES = ['行业规则', '规范', '经验', '运行期注入'];
  const CAT_COLOR = { '编码': 'blue', '检索': 'teal', '审视': 'orange', '测试': 'green' };
  const TOOL_COLOR = { 'MCP': 'purple', 'CLI': 'blue', '脚本': 'orange' };

  const state = { q: '', status: 'all' };
  let body = null;
  /* 详情抽屉运行态 */
  let dId = null, dEdit = false, dBody = null, draft = null;

  /* ========== 数据辅助 ========== */
  const skillById = id => M.byId(S, id);
  const toolById = id => M.byId(T, id);

  /* 被引用数 = 绑定该专家的工作流节点数 */
  function usedByCount(id) {
    let n = 0;
    (M.workflows || []).forEach(wf => {
      ((wf.graph && wf.graph.nodes) || []).forEach(nd => { if (nd && nd.expertId === id) n++; });
    });
    return n;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return E.filter(e => {
      if (state.status === 'on' && !e.enabled) return false;
      if (state.status === 'off' && e.enabled) return false;
      if (!q) return true;
      return (e.name || '').toLowerCase().indexOf(q) > -1 || (e.role || '').toLowerCase().indexOf(q) > -1;
    });
  }

  function nextExpertId() {
    let n = 0;
    E.forEach(e => { const m = /^e(\d+)$/.exec(String(e.id)); if (m) n = Math.max(n, +m[1]); });
    return 'e' + (n + 1);
  }

  /* ========== 页面渲染 ========== */
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
    $('#ex-q').addEventListener('input', e => { state.q = e.target.value; renderGrid(); });
    $('#ex-status').addEventListener('change', e => { state.status = e.target.value; renderGrid(); });
    renderGrid();
  }

  function renderGrid() {
    const grid = $('#ex-grid');
    if (!grid) return;
    if (!E.length) { grid.innerHTML = emptyHtml('注册第一位专家，组合 Skill 形成执行角色', true); bindEmpty(grid); return; }
    const list = filtered();
    if (!list.length) { grid.innerHTML = emptyHtml('未找到匹配的专家', false); return; }
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
    const btn = grid.querySelector('#ex-empty-new');
    if (btn) btn.onclick = openNewModal;
  }

  function cardHtml(e) {
    const refN = usedByCount(e.id);
    const skills = (e.skills || []).map(skillById).filter(Boolean);
    const shown = skills.slice(0, 3);
    const more = skills.length - shown.length;
    return '<div class="item-card" data-id="' + DF.esc(e.id) + '">' +
      '<div class="ic-head">' +
        '<span class="expert-dot" style="background:' + DF.esc(e.color) + '">' + DF.esc((e.name || '？')[0]) + '</span>' +
        '<span class="ic-title">' + DF.esc(e.name) + '</span>' +
        '<span style="margin-left:auto">' + DF.tag(e.enabled ? '启用' : '停用', e.enabled ? 'green' : 'gray') + '</span>' +
      '</div>' +
      '<div class="ic-desc" title="' + DF.esc(e.role) + '">' + DF.esc(e.role || '—') + '</div>' +
      '<div class="chips">' + (e.persona || []).map(p => '<span class="tag gray">' + DF.esc(p) + '</span>').join('') + '</div>' +
      '<div class="chips">' +
        (skills.length ? '<span class="chip" style="color:var(--t-3)">Skill</span>' : '<span class="ex-sub">未组合 Skill</span>') +
        shown.map(s => '<span class="chip ex-skill" data-anchor="skill" title="' + DF.esc(s.summary || '') + '">' + DF.esc(s.name) + '</span>').join('') +
        (more > 0 ? '<span class="chip ex-skill" data-anchor="skill">+' + more + '</span>' : '') +
      '</div>' +
      '<div class="ex-sub">工具 ×' + (e.tools || []).length + ' · 引用 ' + refN + ' 个工作流</div>' +
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
    grid.onclick = ev => {
      const card = ev.target.closest('.item-card');
      if (!card) return;
      const id = card.getAttribute('data-id');
      if (ev.target.closest('.ex-skill')) { openDrawer(id, { anchor: 'skill' }); return; }
      if (ev.target.closest('[data-act="detail"]')) { openDrawer(id); return; }
    };
    grid.onchange = ev => {
      if (ev.target.getAttribute && ev.target.getAttribute('data-act') === 'toggle') {
        const card = ev.target.closest('.item-card');
        if (card) toggleExpert(card.getAttribute('data-id'));
      }
    };
  }

  /* ========== 启用/停用 ========== */
  async function toggleExpert(id) {
    const ex = M.byId(E, id);
    if (!ex) return;
    if (ex.enabled) {
      const n = usedByCount(id);
      const ok = await DF.modal.confirm({
        title: '停用专家',
        message: '专家「' + ex.name + '」被 ' + n + ' 个工作流节点引用，停用后相关节点将无法调度该专家。确定停用？',
        danger: true,
        okText: '停用'
      });
      if (!ok) { renderGrid(); return; }
      ex.enabled = false;
      DF.toast('已停用「' + ex.name + '」', 'warn');
    } else {
      ex.enabled = true;
      DF.toast('已启用「' + ex.name + '」', 'ok');
    }
    renderGrid();
  }

  /* ========== 详情抽屉（查看/编辑切换） ========== */
  function openDrawer(id, opts) {
    const ex = M.byId(E, id);
    if (!ex) return;
    dId = id;
    dEdit = !!(opts && opts.edit);
    draft = null;
    if (dEdit) snapshotDraft();
    const anchor = opts && opts.anchor;
    DF.modal.open({
      title: '专家详情 · ' + ex.name,
      width: '80vw',
      resizable: true,
      body: drawerBodyHtml(ex),
      footer: drawerFooterHtml(),
      onMount(b) {
        dBody = b;
        bindDrawerBody(b);
        const foot = b.closest('.modal').querySelector('.d-foot');
        if (foot) bindFooter(foot);
        if (anchor === 'skill') {
          const el = b.querySelector('#ex-sec-skill');
          if (el) {
            el.classList.add('ex-flash');
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
          }
        }
      },
      onClose() { dBody = null; dId = null; dEdit = false; draft = null; }
    });
  }

  function drawerFooterHtml() {
    if (dEdit) return '<button class="btn" id="ex-cancel">取消</button><button class="btn primary" id="ex-save">保存</button>';
    return '<button class="btn" id="ex-dclose">关闭</button><button class="btn primary" id="ex-edit">' + DF.icon('edit', 14) + '编辑</button>';
  }

  function bindFooter(foot) {
    const edit = foot.querySelector('#ex-edit');
    if (edit) edit.onclick = () => { snapshotDraft(); dEdit = true; refreshDrawer(); };
    const dc = foot.querySelector('#ex-dclose');
    if (dc) dc.onclick = () => DF.modal.close();
    const cancel = foot.querySelector('#ex-cancel');
    if (cancel) cancel.onclick = () => { dEdit = false; draft = null; refreshDrawer(); };
    const save = foot.querySelector('#ex-save');
    if (save) save.onclick = saveDraft;
  }

  function snapshotDraft() {
    const ex = M.byId(E, dId);
    if (!ex) return;
    draft = {
      duty: ex.duty || '',
      notes: ex.notes || '',
      persona: (ex.persona || []).slice(),
      skills: (ex.skills || []).slice(),
      tools: (ex.tools || []).slice(),
      refs: (ex.refs || []).map(r => ({ label: r.label || '', type: r.type || '经验', path: r.path || '' }))
    };
  }

  function refreshDrawer() {
    const ex = M.byId(E, dId);
    if (!ex || !dBody) return;
    dBody.innerHTML = drawerBodyHtml(ex);
    bindDrawerBody(dBody);
    const foot = document.querySelector('.modal .d-foot');
    if (foot) { foot.innerHTML = drawerFooterHtml(); bindFooter(foot); }
  }

  function drawerBodyHtml(ex) {
    const src = dEdit ? draft : ex;
    const refN = usedByCount(ex.id);
    let h = '';
    h += '<div class="notice">' + DF.icon('warn', 14) +
      '<span>专家 = 固定人格与职责 + 按任务组合的 Skill 与工具；评审专家绑定到评审节点时承担独立否决视角，不是独立实体。</span></div>';
    h += '<div class="kv" style="margin-bottom:2px"><span class="k">状态</span><span style="display:flex;align-items:center;gap:8px">' +
      DF.tag(ex.enabled ? '启用' : '停用', ex.enabled ? 'green' : 'gray') +
      '<span class="ex-sub">被 ' + refN + ' 个工作流节点引用</span></span></div>';

    /* ① 角色描述 */
    h += '<div class="section-title" id="ex-sec-role">① 角色描述<span class="line"></span></div>';
    if (dEdit) {
      h += '<div class="field"><label>职责范围</label><textarea class="inp" id="ex-duty" rows="3">' + DF.esc(src.duty) + '</textarea></div>';
      h += '<div class="field"><label>性格描述</label><div class="chips">' + personaChipsEdit(src.persona) + '</div></div>';
      h += '<div class="field"><label>关注视角</label><textarea class="inp" id="ex-notes" rows="2">' + DF.esc(src.notes) + '</textarea></div>';
    } else {
      h += '<div class="kv"><span class="k">职责范围</span><span class="ex-pre">' + DF.esc(src.duty || '—') + '</span></div>';
      h += '<div class="kv" style="margin-top:8px"><span class="k">性格描述</span><span><span class="chips" style="display:inline-flex">' +
        (src.persona || []).map(p => '<span class="tag gray">' + DF.esc(p) + '</span>').join('') +
        (!(src.persona || []).length ? '<span class="ex-sub">—</span>' : '') + '</span></span></div>';
      h += '<div class="kv" style="margin-top:8px"><span class="k">关注视角</span><span class="ex-pre">' + DF.esc(src.notes || '—') + '</span></div>';
    }

    /* ② Skill 组合（有序） */
    h += '<div class="section-title ex-sec" id="ex-sec-skill">② Skill 组合<span class="line"></span>' +
      (dEdit ? '<button class="btn sm" data-act="skill-add">' + DF.icon('plus', 12) + '从 Skill 库添加</button>' : '') + '</div>';
    const skills = (src.skills || []).map(skillById).filter(Boolean);
    if (!skills.length) h += '<div class="ex-sub" style="margin-bottom:6px">尚未组合 Skill' + (dEdit ? '，可从 Skill 库添加' : '') + '。</div>';
    skills.forEach((s, i) => {
      h += '<div class="ex-skill-item"><span class="ex-idx">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<b style="font-size:13px">' + DF.esc(s.name) + '</b>' + DF.tag(s.category, CAT_COLOR[s.category] || 'gray') + '</div>' +
          '<div class="ex-sum" title="' + DF.esc(s.summary || '') + '">' + DF.esc(s.summary || '') + '</div></div>' +
        (dEdit
          ? '<button class="ex-move" data-smove="up" data-sid="' + DF.esc(s.id) + '" title="上移"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="ex-move" data-smove="down" data-sid="' + DF.esc(s.id) + '" title="下移"' + (i === skills.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<i class="ex-x" data-sremove="' + DF.esc(s.id) + '" title="移除">×</i>'
          : '') +
        '</div>';
    });

    /* ③ 工具清单 */
    h += '<div class="section-title ex-sec" id="ex-sec-tools">③ 工具清单<span class="line"></span>' +
      (dEdit ? '<button class="btn sm" data-act="tool-add">' + DF.icon('plus', 12) + '添加工具</button>' : '') + '</div>';
    const tools = (src.tools || []).map(toolById).filter(Boolean);
    if (!tools.length) h += '<div class="ex-sub" style="margin-bottom:6px">尚未挂载工具' + (dEdit ? '，可从工具库添加' : '') + '。</div>';
    tools.forEach(t => {
      h += '<div class="ex-row"><span class="ex-mono" style="font-weight:600">' + DF.esc(t.name) + '</span>' +
        DF.tag(t.type, TOOL_COLOR[t.type] || 'gray') +
        '<span class="ex-sum" style="flex:1;margin-top:0" title="' + DF.esc(t.desc || '') + '">' + DF.esc(t.desc || '') + '</span>' +
        (dEdit ? '<i class="ex-x" data-tremove="' + DF.esc(t.id) + '" title="移除">×</i>' : '') +
        '</div>';
    });

    /* ④ 主要工作内容（渐进式披露） */
    h += '<div class="section-title ex-sec" id="ex-sec-work">④ 主要工作内容<span class="line"></span></div>';
    h += '<details class="ex-wc" open><summary>主要职责</summary><div class="ex-pre">' + DF.esc(ex.duty || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>技能配合顺序</summary><div class="ex-pre">' + DF.esc(ex.skillOrder || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>重点验证顺序</summary><div class="ex-pre">' + DF.esc(ex.verifyOrder || '—') + '</div></details>';
    h += '<details class="ex-wc"><summary>对承担任务的解读</summary><div class="ex-pre">' + DF.esc(ex.notes || '—') + '</div></details>';

    /* ⑤ 参考知识 */
    h += '<div class="section-title ex-sec" id="ex-sec-refs">⑤ 参考知识<span class="line"></span></div>';
    const refs = src.refs || [];
    if (!refs.length) h += '<div class="ex-sub">暂无参考知识。</div>';
    refs.forEach((r, i) => {
      h += '<div class="ex-row">' + DF.tag(r.type || '经验', 'purple') +
        '<span style="font-size:13px">' + DF.esc(r.label || '') + '</span>' +
        (r.path ? '<span class="ex-mono ex-sum" style="flex:1;margin-top:0" title="' + DF.esc(r.path) + '">' + DF.esc(r.path) + '</span>' : '<span style="flex:1"></span>') +
        (dEdit ? '<i class="ex-x" data-rremove="' + i + '" title="删除">×</i>' : '') +
        '</div>';
    });
    if (dEdit) {
      h += '<div class="ex-ref-add">' +
        '<input class="inp inp-sm" id="ex-ref-label" placeholder="名称，如: 编码规范约束手册" style="width:200px">' +
        '<select class="inp inp-sm" id="ex-ref-type">' + REF_TYPES.map(t => '<option>' + t + '</option>').join('') + '</select>' +
        '<input class="inp inp-sm" id="ex-ref-path" placeholder="路径（可选），如: workspace:/knowledge/…" style="width:220px">' +
        '<button class="btn sm" data-act="ref-add">添加</button></div>';
    }
    return h;
  }

  function personaChipsEdit(list) {
    return (list || []).map(p =>
      '<span class="chip">' + DF.esc(p) + '<i class="x" data-pdel="' + DF.esc(p) + '" title="移除">×</i></span>').join('') +
      '<span style="display:inline-flex;gap:6px;align-items:center">' +
        '<input class="inp inp-sm" id="ex-persona-inp" placeholder="添加性格词，回车确认" style="width:160px">' +
        '<button class="btn sm" data-act="persona-add">添加</button></span>';
  }

  function bindDrawerBody(b) {
    b.oninput = ev => {
      if (!dEdit || !draft) return;
      if (ev.target.id === 'ex-duty') draft.duty = ev.target.value;
      else if (ev.target.id === 'ex-notes') draft.notes = ev.target.value;
    };
    b.onclick = ev => {
      if (!dEdit || !draft) return;
      const t = ev.target;
      const pdel = t.closest('[data-pdel]');
      if (pdel) {
        const v = pdel.getAttribute('data-pdel');
        draft.persona = draft.persona.filter(x => x !== v);
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="persona-add"]')) { addPersona(b); return; }
      const sm = t.closest('[data-smove]');
      if (sm) { moveSkill(sm.getAttribute('data-smove'), sm.getAttribute('data-sid')); return; }
      const srm = t.closest('[data-sremove]');
      if (srm) {
        draft.skills = draft.skills.filter(id => id !== srm.getAttribute('data-sremove'));
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="skill-add"]')) { openSkillPicker(); return; }
      if (t.closest('[data-act="tool-add"]')) { openToolPicker(); return; }
      const trm = t.closest('[data-tremove]');
      if (trm) {
        draft.tools = draft.tools.filter(id => id !== trm.getAttribute('data-tremove'));
        refreshDrawer();
        return;
      }
      if (t.closest('[data-act="ref-add"]')) { addRef(b); return; }
      const rrm = t.closest('[data-rremove]');
      if (rrm) {
        draft.refs.splice(+rrm.getAttribute('data-rremove'), 1);
        refreshDrawer();
        return;
      }
    };
    b.onkeydown = ev => {
      if (dEdit && ev.target.id === 'ex-persona-inp' && ev.key === 'Enter') {
        ev.preventDefault();
        addPersona(b);
      }
    };
  }

  function addPersona(b) {
    const inp = b.querySelector('#ex-persona-inp');
    if (!inp) return;
    const v = (inp.value || '').trim();
    if (!v) { DF.toast('请输入性格词', 'warn'); return; }
    if (draft.persona.indexOf(v) > -1) { DF.toast('性格词已存在', 'warn'); return; }
    draft.persona.push(v);
    refreshDrawer();
    const ni = dBody.querySelector('#ex-persona-inp');
    if (ni) ni.focus();
  }

  function moveSkill(dir, sid) {
    const arr = draft.skills;
    const i = arr.indexOf(sid);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return;
    arr.splice(j, 0, arr.splice(i, 1)[0]);
    refreshDrawer();
  }

  function addRef(b) {
    const label = (b.querySelector('#ex-ref-label').value || '').trim();
    if (!label) { DF.toast('请填写参考知识名称', 'warn'); return; }
    const type = b.querySelector('#ex-ref-type').value;
    const path = (b.querySelector('#ex-ref-path').value || '').trim();
    draft.refs.push(path ? { label: label, type: type, path: path } : { label: label, type: type });
    refreshDrawer();
    DF.toast('已添加参考知识', 'ok');
  }

  function saveDraft() {
    const ex = M.byId(E, dId);
    if (!ex || !draft) return;
    ex.duty = draft.duty;
    ex.notes = draft.notes;
    ex.persona = draft.persona.slice();
    ex.skills = draft.skills.slice();
    ex.tools = draft.tools.slice();
    ex.refs = draft.refs.map(r => {
      const o = { label: r.label, type: r.type };
      if (r.path) o.path = r.path;
      return o;
    });
    dEdit = false;
    draft = null;
    renderGrid();
    refreshDrawer();
    DF.toast('已保存专家「' + ex.name + '」', 'ok');
  }

  /* ========== 从 Skill 库 / 工具库 添加（复选挑选弹窗 DF.modal.picker） ========== */
  function openSkillPicker() {
    const avail = S.filter(s => draft.skills.indexOf(s.id) < 0);
    if (!avail.length) { DF.toast('Skill 库中的 Skill 均已加入', 'warn'); return; }
    DF.modal.picker({
      title: '从 Skill 库添加',
      items: avail.map(s => ({ id: s.id, name: s.name, tag: s.category, tagColor: CAT_COLOR[s.category] || 'gray', summary: s.summary })),
      noneText: '请先勾选要添加的 Skill',
      onOk(sel, close) {
        draft.skills = draft.skills.concat(sel);
        close();
        refreshDrawer();
        DF.toast('已添加 ' + sel.length + ' 个 Skill', 'ok');
      }
    });
  }

  function openToolPicker() {
    const avail = T.filter(t => draft.tools.indexOf(t.id) < 0);
    if (!avail.length) { DF.toast('工具库中的工具均已加入', 'warn'); return; }
    DF.modal.picker({
      title: '添加工具（从工具库勾选）',
      items: avail.map(t => ({ id: t.id, name: t.name, mono: true, tag: t.type, tagColor: TOOL_COLOR[t.type] || 'gray', summary: t.desc })),
      noneText: '请先勾选要添加的工具',
      onOk(sel, close) {
        draft.tools = draft.tools.concat(sel);
        close();
        refreshDrawer();
        DF.toast('已添加 ' + sel.length + ' 个工具', 'ok');
      }
    });
  }

  /* ========== 新建专家弹窗 ========== */
  function openNewModal() {
    const palette = PALETTE.map((c, i) =>
      '<label class="ex-swatch" style="background:' + c + '" title="' + c + '">' +
        '<input type="radio" name="ex-color" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><i></i></label>').join('');
    DF.modal.form({
      title: '新建专家',
      width: 470,
      body: DF.field('名称', '<input class="inp" id="ex-n-name" placeholder="如: 数据迁移专家">', { required: true }) +
        DF.field('头像色', '<div class="ex-swatches">' + palette + '</div>',
          { hint: '作为专家标识色，在画布与运行实例中复用' }) +
        DF.field('角色定位一句话', '<input class="inp" id="ex-n-role" placeholder="如: 完成存量数据迁移与一致性校验">', { required: true }),
      okText: '确定',
      onOk(b, close) {
        const name = (b.querySelector('#ex-n-name').value || '').trim();
        const role = (b.querySelector('#ex-n-role').value || '').trim();
        if (!name) { DF.toast('请填写专家名称', 'warn'); b.querySelector('#ex-n-name').focus(); return; }
        if (!role) { DF.toast('请填写角色定位一句话', 'warn'); b.querySelector('#ex-n-role').focus(); return; }
        const colorEl = b.querySelector('input[name="ex-color"]:checked');
        const ex = {
          id: nextExpertId(), name: name, color: colorEl ? colorEl.value : PALETTE[0], role: role,
          persona: [], skills: [], tools: [], duty: '', skillOrder: '', verifyOrder: '', notes: '', refs: [], enabled: true
        };
        E.push(ex);
        close();
        renderGrid();
        DF.toast('已创建专家「' + name + '」，请继续补全', 'ok');
        openDrawer(ex.id, { edit: true });
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
  const newBtn = document.getElementById('ex-new');
  if (newBtn) newBtn.onclick = openNewModal;
})();
