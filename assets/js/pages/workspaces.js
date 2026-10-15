/**
 * AgentFlow 原型 · 工作区配置 · 列表页
 * 规格: docs/11-工作区配置.md §2 列表页 / §3 新建向导弹窗 / §5 状态与空态
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const M = window.MOCK;
  const WSC = window.WSC; // 工作区列表页 / 详情页共用模块（跨页联动、目录树等）

  /* ========== 页面 ========== */
  function render() {
    const body = DF.renderShell({
      active: 'workspaces',
      breadcrumb: [{ label: '基础配置' }, { label: '工作区配置' }],
      title: '工作区配置',
      subtitle: '统一工作区准备与配置：仓库绑定、worktree 隔离策略、目录模板初始化、凭证关联与清理归档',
      actions: '<button class="btn primary" id="ws-btn-new">' + DF.icon('plus', 14) + '新建工作区</button>'
    });
    body.innerHTML =
      '<div class="toolbar ws-toolbar">' +
        '<select class="inp inp-sm" id="ws-f-status" title="按状态筛选">' +
          '<option value="">全部状态</option><option>已初始化</option><option>校验失败</option><option>未初始化</option>' +
        '</select>' +
        DF.searchBox('ws-f-kw', '搜索名称 / 仓库 / 描述', '', true) +
        '<span class="sp"></span><span class="ws-count" id="ws-count"></span>' +
      '</div><div id="ws-table"></div>';
    $('#ws-f-status').onchange = renderTable;
    $('#ws-f-kw').oninput = renderTable;
    $('#ws-btn-new').onclick = openWizard;
    renderTable();
  }

  function renderTable() {
    const st = $('#ws-f-status').value;
    const kw = ($('#ws-f-kw').value || '').trim().toLowerCase();
    const rows = WSC.allWorkspaces().filter(w =>
      (!st || w.status === st) &&
      (!kw || [w.name, w.repo, w.desc].some(v => String(v || '').toLowerCase().indexOf(kw) >= 0))
    );
    $('#ws-count').textContent = rows.length ? '共 ' + rows.length + ' 个工作区' : '';

    const host = $('#ws-table');
    if (!WSC.allWorkspaces().length) {
      host.innerHTML =
        '<div class="card">' + DF.empty({
          icon: '🗂️',
          html: '<p style="font-weight:600;color:var(--t-2)">准备工作区</p>' +
            '<p>准备工作区，作为所有节点交互的唯一信息通道</p>',
          action: { id: 'ws-empty-new', label: '新建工作区', icon: 'plus', primary: true }
        }) + '</div>';
      $('#ws-empty-new').onclick = openWizard;
      return;
    }
    if (!rows.length) {
      host.innerHTML = '<div class="card">' + DF.empty({ icon: '🔍', title: '没有符合筛选条件的工作区' }) + '</div>';
      return;
    }

    const trs = rows.map(w => {
      const key = WSC.keyById(w.credId);
      const used = w.usedBy || [];
      const credCell = key
        ? '<span class="dot ' + (key.status === '有效' ? 'green' : key.status === '失效' ? 'red' : 'gray') + '"></span>' +
          DF.esc(key.name) + ' <span class="sub mono" title="' + DF.esc(key.mask || '') + '">' + DF.esc(key.mask || '') + '</span>'
        : '<span style="color:var(--t-3)">未关联</span>';
      const del = used.length
        ? '<span class="ws-dis" title="被 ' + used.length + ' 个运行实例引用（' + DF.esc(used.join('、')) + '），禁止删除">删除</span>'
        : '<button class="btn link" data-act="del" data-id="' + DF.esc(w.id) + '">删除</button>';
      return '<tr' + (w.status === '校验失败' ? ' class="row-warn"' : '') + '>' +
        '<td><a class="rowlink" href="workspace-detail.html?id=' + encodeURIComponent(w.id) + '">' + DF.esc(w.name) + '</a>' +
          '<div class="sub">' + DF.esc(w.desc || '—') + '</div></td>' +
        '<td class="mono ellipsis" title="' + DF.esc(w.repo) + '">' + DF.esc(w.repo) + '</td>' +
        '<td class="mono">' + DF.esc(w.branch) + '</td>' +
        '<td class="mono ellipsis" title="' + DF.esc(w.worktreeTemplate || '') + '">' + DF.esc(w.worktreeTemplate || '—') + '</td>' +
        '<td class="ws-cred">' + credCell + '</td>' +
        '<td>' + DF.tag(w.status) + '</td>' +
        '<td>' + DF.fmtBytes(w.size) + '</td>' +
        '<td' + (used.length ? ' title="引用实例: ' + DF.esc(used.join('、')) + '"' : '') + ' style="cursor:default">' + used.length + '</td>' +
        '<td>' + DF.relTime(w.lastActivityM) + '</td>' +
        '<td class="ws-op">' +
          '<a class="btn link" href="workspace-detail.html?id=' + encodeURIComponent(w.id) + '">详情</a>' +
          '<button class="btn link" data-act="edit" data-id="' + DF.esc(w.id) + '">编辑</button>' + del +
        '</td></tr>';
    });

    host.innerHTML = DF.table(
      ['名称', 'git 仓库地址', '默认分支', 'worktree 策略', '关联凭证',
       '状态', '容量', '引用实例', '最近活动', '操作'],
      trs
    );

    host.querySelectorAll('[data-act="edit"]').forEach(b => { b.onclick = () => openEdit(b.getAttribute('data-id')); });
    host.querySelectorAll('[data-act="del"]').forEach(b => { b.onclick = () => del(b.getAttribute('data-id')); });
  }

  /* ========== 编辑弹窗 ========== */
  function openEdit(id) {
    const ws = WSC.allWorkspaces().find(w => w.id === id);
    if (!ws) return;
    DF.modal.form({
      title: '编辑工作区 · ' + ws.name,
      width: 520,
      okText: '保存',
      body:
        '<div class="field"><label>名称<span class="req">*</span></label><input class="inp" id="we-name" value="' + DF.esc(ws.name) + '"></div>' +
        '<div class="field"><label>描述</label><input class="inp" id="we-desc" value="' + DF.esc(ws.desc || '') + '"></div>' +
        '<div class="field"><label>默认分支<span class="req">*</span></label><input class="inp mono" id="we-branch" value="' + DF.esc(ws.branch || '') + '"></div>' +
        '<div class="field"><label>worktree 命名模板</label><input class="inp mono" id="we-wt" value="' + DF.esc(ws.worktreeTemplate || '') + '">' +
          '<div class="hint">可用变量 {instanceId} {seq}</div></div>' +
        '<div class="field" style="display:flex;align-items:center;gap:10px">' +
          '<label style="margin:0">自动清理</label>' +
          '<label class="switch"><input type="checkbox" id="we-clean"' + (ws.autoClean ? ' checked' : '') + '><i></i></label>' +
          '<span style="margin-left:auto;font-size:12px;color:var(--t-2)">保留 ' +
            '<input type="number" class="inp inp-sm" id="we-days" min="1" max="90" value="' + (ws.retainDays || 7) + '" style="width:64px"> 天</span>' +
        '</div>',
      onOk(b, close) {
        const name = b.querySelector('#we-name').value.trim();
        const branch = b.querySelector('#we-branch').value.trim();
        if (!name || !branch) { DF.toast('名称与默认分支为必填项', 'err'); return; }
        ws.name = name;
        ws.desc = b.querySelector('#we-desc').value.trim();
        ws.branch = branch;
        ws.worktreeTemplate = b.querySelector('#we-wt').value.trim() || ws.worktreeTemplate;
        ws.autoClean = b.querySelector('#we-clean').checked;
        ws.retainDays = Math.max(1, parseInt(b.querySelector('#we-days').value, 10) || 7);
          if (String(ws.id).indexOf('ws-new') === 0) WSC.saveNewWs(ws);
        close();
        renderTable();
        DF.toast('已保存，对新实例生效', 'ok');
      }
    });
  }

  /* ========== 删除 ========== */
  async function del(id) {
    const ws = WSC.allWorkspaces().find(w => w.id === id);
    if (!ws) return;
    const ok = await DF.modal.confirm({
      title: '删除工作区',
      message: '确认删除工作区「' + ws.name + '」？删除后不可恢复。',
      danger: true,
      okText: '确认删除'
    });
    if (!ok) return;
    if (String(id).indexOf('ws-new') === 0) {
      WSC.dropNewWs(id);
    } else {
      const i = (M.workspaces || []).indexOf(ws);
      if (i >= 0) M.workspaces.splice(i, 1);
    }
    renderTable();
    DF.toast('工作区已删除', 'ok');
  }

  /* ========== 目录树预览（新建向导步③，模板树见 workspace-common.js） ========== */
  function treeHtml() { return WSC.treeHtml(); }

  /* ========== 新建向导弹窗（3 步） ========== */
  function openWizard() {
    const st = { step: 1, name: '', desc: '', repo: '', branch: 'master', credId: '', testTip: '未测试', testFail: false };
    let cancelled = false;
    DF.modal.open({
      title: '新建工作区',
      width: 660,
      body:
        '<div class="wizard-steps" id="wz-steps">' +
          '<div class="ws on" data-n="1">仓库信息</div>' +
          '<div class="ws" data-n="2">凭证与校验</div>' +
          '<div class="ws" data-n="3">目录模板</div>' +
        '</div><div id="wz-body"></div>',
      footer: '<button class="btn" id="wz-prev" style="visibility:hidden">上一步</button>' +
              '<button class="btn primary" id="wz-next">下一步</button>',
      onClose() { cancelled = true; },
      onMount(body, close) {
        const foot = body.closest('.modal').querySelector('.d-foot');
        const bPrev = foot.querySelector('#wz-prev');
        const bNext = foot.querySelector('#wz-next');

        /* ---- 步① 仓库信息 ---- */
        function renderStep1(host) {
          host.innerHTML =
            '<div class="ws-step-desc">绑定 git 仓库，工作区将作为所有节点交互的唯一信息通道。</div>' +
            '<div class="field"><label>名称<span class="req">*</span></label>' +
              '<input class="inp" id="wz-name" placeholder="如 trading-core" value="' + DF.esc(st.name) + '">' +
              '<div class="ws-err" id="wz-name-err" style="display:none">请输入工作区名称</div></div>' +
            '<div class="field"><label>描述</label>' +
              '<input class="inp" id="wz-desc" placeholder="一句话说明该工作区的用途" value="' + DF.esc(st.desc) + '"></div>' +
            '<div class="field"><label>git 仓库 URL<span class="req">*</span></label>' +
              '<input class="inp mono" id="wz-repo" placeholder="git@igit:org/repo.git 或 https://git.example.com/org/repo.git" value="' + DF.esc(st.repo) + '">' +
              '<div class="hint">支持 git@ / https:// 协议</div>' +
              '<div class="ws-err" id="wz-repo-err" style="display:none">仓库 URL 必须以 git@ 或 https:// 开头</div></div>' +
            '<div class="field"><label>默认分支<span class="req">*</span></label>' +
              '<input class="inp mono" id="wz-branch" value="' + DF.esc(st.branch) + '">' +
              '<div class="ws-err" id="wz-branch-err" style="display:none">请输入默认分支</div></div>';
        }
        function collectStep1(host) {
          st.name = host.querySelector('#wz-name').value.trim();
          st.desc = host.querySelector('#wz-desc').value.trim();
          st.repo = host.querySelector('#wz-repo').value.trim();
          st.branch = host.querySelector('#wz-branch').value.trim();
        }
        function validateStep1(host) {
          let ok = true;
          const mark = (input, errId, bad) => {
            input.classList.toggle('ws-inp-err', bad);
            host.querySelector('#' + errId).style.display = bad ? 'block' : 'none';
            if (bad) ok = false;
          };
          mark(host.querySelector('#wz-name'), 'wz-name-err', !st.name);
          mark(host.querySelector('#wz-repo'), 'wz-repo-err', !(st.repo && (st.repo.indexOf('git@') === 0 || st.repo.indexOf('https://') === 0)));
          mark(host.querySelector('#wz-branch'), 'wz-branch-err', !st.branch);
          if (!ok) DF.toast('请先完善必填项', 'err');
          return ok;
        }

        /* ---- 步② 凭证与校验 ---- */
        function renderStep2(host) {
          const gitKeys = (M.keys || []).filter(k => k.type === 'git ssh-key');
          host.innerHTML =
            '<div class="ws-step-desc">关联用于访问 git 仓库的 ssh-key，并完成连接测试。</div>' +
            '<div class="field"><label>关联 ssh-key</label><select class="inp" id="wz-cred">' +
              '<option value="">— 请选择 git ssh-key —</option>' +
              gitKeys.map(k => '<option value="' + DF.esc(k.id) + '"' + (st.credId === k.id ? ' selected' : '') + '>' +
                DF.esc(k.name) + '（' + DF.esc(k.status) + '）</option>').join('') +
            '</select><div class="hint">选项来自 个人Key管理 中「git ssh-key」类型凭证</div></div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
              '<button class="btn" id="wz-test">连接测试</button>' +
              '<span class="ws-test-tip" id="wz-test-tip">' + DF.esc(st.testTip) + '</span></div>' +
            '<div class="warn-box" id="wz-warn" style="display:' + (st.testFail ? 'block' : 'none') + '">' +
              '凭证无效，请更换或在 <a href="keys.html">个人Key管理</a> 中修复</div>';
          host.querySelector('#wz-cred').onchange = () => {
            st.credId = host.querySelector('#wz-cred').value;
            st.testTip = '未测试'; st.testFail = false;
            host.querySelector('#wz-test-tip').textContent = '未测试';
            host.querySelector('#wz-warn').style.display = 'none';
          };
          host.querySelector('#wz-test').onclick = testConn;
        }
        function collectStep2(host) { st.credId = host.querySelector('#wz-cred').value; }
        function testConn() {
          const sel = body.querySelector('#wz-cred');
          if (sel) st.credId = sel.value;
          const k = st.credId ? WSC.keyById(st.credId) : null;
          const host = body.querySelector('#wz-body');
          const tip = host.querySelector('#wz-test-tip');
          const warn = host.querySelector('#wz-warn');
          if (!k || k.status !== '有效') {
            st.testTip = '连接测试失败'; st.testFail = true;
            tip.textContent = st.testTip;
            warn.style.display = 'block';
            DF.toast('连接测试失败：' + (!k ? '未选择凭证' : '凭证「' + k.name + '」无效'), 'err');
          } else {
            st.testTip = '连接测试通过（' + k.name + '）'; st.testFail = false;
            tip.textContent = st.testTip;
            warn.style.display = 'none';
            DF.toast('连接测试通过：' + k.name, 'ok');
          }
        }

        /* ---- 步③ 目录模板 ---- */
        function renderStep3(host) {
          host.innerHTML =
            '<div class="ws-step-desc">选择初始化目录模板，完成后将按模板初始化工作区目录结构。</div>' +
            '<label class="ws-radio-row on"><input type="radio" name="wz-tpl" checked><span>' +
              '<b>标准研发工作区</b>' +
              '<div style="font-size:11px;color:var(--t-3)">含总纲、知识库索引、专家库、Skill 库与并行任务目录</div>' +
            '</span></label>' +
            '<div class="ws-tree-box">' + treeHtml() + '</div>';
        }
        function collectStep3() { /* 单模板，无字段 */ }

        const steps = [
          { render: renderStep1, collect: collectStep1, validate: validateStep1 },
          { render: renderStep2, collect: collectStep2, validate: null },
          { render: renderStep3, collect: collectStep3, validate: null }
        ];

        function paint() {
          body.querySelectorAll('#wz-steps .ws').forEach((el, i) => el.classList.toggle('on', i < st.step));
          bPrev.style.visibility = st.step === 1 ? 'hidden' : 'visible';
          bNext.textContent = st.step === 3 ? '完成并初始化' : '下一步';
        }
        function draw() { steps[st.step - 1].render(body.querySelector('#wz-body')); paint(); }

        bPrev.onclick = () => {
          if (st.step > 1) { steps[st.step - 1].collect(body.querySelector('#wz-body')); st.step--; draw(); }
        };
        bNext.onclick = () => {
          const cur = steps[st.step - 1];
          cur.collect(body.querySelector('#wz-body'));
          if (cur.validate && !cur.validate(body.querySelector('#wz-body'))) return;
          if (st.step < 3) { st.step++; draw(); return; }
          /* 步③ → 完成并初始化 */
          bNext.disabled = true;
          bNext.textContent = '初始化中…';
          setTimeout(() => {
            if (cancelled) return;
            const k = st.credId ? WSC.keyById(st.credId) : null;
            const d = new Date();
            const nw = {
              id: 'ws-new-' + d.getTime(),
              name: st.name,
              desc: st.desc,
              repo: st.repo,
              branch: st.branch || 'master',
              worktreeTemplate: 'task/{instanceId}/{seq}',
              autoClean: true,
              retainDays: 7,
              credId: k ? k.id : null,
              credStatus: k ? k.status : '未校验',
              status: '已初始化',
              size: 0,
              usedBy: [],
              lastActivityM: 0,
              archives: [],
              createdAt: d.getFullYear() + '-' + WSC.pad(d.getMonth() + 1) + '-' + WSC.pad(d.getDate()) + ' ' + WSC.pad(d.getHours()) + ':' + WSC.pad(d.getMinutes())
            };
            WSC.saveNewWs(nw);
            DF.toast('工作区已创建并完成初始化', 'ok');
            setTimeout(() => {
              if (!cancelled) location.href = 'workspace-detail.html?id=' + encodeURIComponent(nw.id);
            }, 700);
          }, 1200);
        };

        draw();
      }
    });
  }

  render();
})();
