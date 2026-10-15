/**
 * AgentFlow 原型 · 基础配置 / 个人 Key 管理
 * 密钥资产（git ssh-key / LLM API Key）、有效性校验、用途绑定。
 */
(function () {
  'use strict';

  /* ---------------- 页面私有状态 ---------------- */
  let tabType = '全部';          // 全部 | git ssh-key | LLM API Key
  let kw = '';                   // 搜索关键字（名称/掩码）

  const MODEL_BY_PROVIDER = {
    'OpenAI': ['gpt-4o', 'gpt-4o-mini'],
    'DeepSeek': ['deepseek-v3', 'deepseek-r1'],
    '内部网关': ['llm-gw-default']
  };

  /* ---------------- 外壳 ---------------- */
  const body = DF.renderShell({
    active: 'keys',
    breadcrumb: [{ label: '基础配置' }, { label: '个人 Key 管理' }],
    title: '个人 Key 管理',
    subtitle: '密钥资产、校验与用途绑定',
    actions: '<button class="btn primary" id="ky-add">' + DF.icon('plus', 14) + '添加 Key</button>'
  });

  body.innerHTML =
    '<div class="notice"><span style="font-weight:700">ℹ</span>密钥仅显示掩码（后 4 位），完整值加密存储、不可回显</div>' +
    '<div class="toolbar">' +
      '<div class="tabs" style="margin-bottom:0;border-bottom:none">' +
        '<div class="tab active" data-type="全部">全部</div>' +
        '<div class="tab" data-type="git ssh-key">git ssh-key</div>' +
        '<div class="tab" data-type="LLM API Key">LLM API Key</div>' +
      '</div>' +
      '<span class="sp"></span>' +
      DF.searchBox('ky-search', '搜索名称 / 掩码') +
    '</div>' +
    '<div id="ky-list"></div>';

  document.getElementById('ky-add').onclick = openAdd;
  document.getElementById('ky-search').oninput = function () { kw = this.value.trim().toLowerCase(); renderList(); };
  body.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      body.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      tabType = t.getAttribute('data-type');
      renderList();
    };
  });

  /* ---------------- 工具 ---------------- */
  function hex(n) { let s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function bindCount(k) {
    const b = k.bindings || {};
    return (b.workspaces || []).length + (b.harnesses || []).length + (b.experts || []).length;
  }
  function bindSummary(k) {
    const b = k.bindings || {}, parts = [];
    if ((b.workspaces || []).length) parts.push('工作区×' + b.workspaces.length);
    if ((b.harnesses || []).length) parts.push('Harness×' + b.harnesses.length);
    if ((b.experts || []).length) parts.push('专家×' + b.experts.length);
    return parts;
  }

  /* ---------------- 列表渲染 ---------------- */
  function chipsHtml(k) {
    const parts = bindSummary(k);
    if (!parts.length) return '<span class="chip click" data-bind="' + k.id + '"><span class="ky-no-bind">未绑定</span></span>';
    return '<div class="chips">' + parts.map(p =>
      '<span class="chip click" data-bind="' + k.id + '">' + p + '</span>').join('') + '</div>';
  }

  function rowHtml(k) {
    const isLLM = k.type === 'LLM API Key';
    const typeTag = DF.tag(isLLM ? 'LLM API Key' : 'ssh-key', isLLM ? 'teal' : 'blue');
    const sub = isLLM ? '<div class="sub">（' + DF.esc(k.provider || '—') + ' · ' + DF.esc(k.model || '—') + '）</div>' : '';
    const warnSub = k.status === '失效' ? '<div class="ky-sub-warn">已失效，请重新校验或更换</div>' : '';
    return '<tr' + (k.status === '失效' ? ' class="row-warn"' : '') + '>' +
      '<td><b>' + DF.esc(k.name) + '</b>' + warnSub + '</td>' +
      '<td><span style="display:inline-flex;align-items:center;gap:6px">' + DF.icon('key', 14) + typeTag + '</span></td>' +
      '<td><span class="mono">' + DF.esc(k.mask) + '</span>' + sub + '</td>' +
      '<td>' + chipsHtml(k) + '</td>' +
      '<td>' + DF.tag(k.status) + '</td>' +
      '<td>' + DF.relTime(k.lastCheckedM) + '</td>' +
      '<td><div class="ky-acts">' +
        '<button class="btn sm ky-verify" data-id="' + k.id + '">校验</button>' +
        '<button class="btn sm ky-edit" data-id="' + k.id + '">编辑</button>' +
        '<button class="icon-btn ky-more" data-id="' + k.id + '" title="更多">' + DF.icon('more', 14) + '</button>' +
      '</div></td>' +
    '</tr>';
  }

  function renderList() {
    const list = document.getElementById('ky-list');
    if (!MOCK.keys.length) {
      list.innerHTML = DF.empty({
        icon: '🔑', title: '添加第一个密钥，用于仓库访问或模型调用',
        action: { id: 'ky-empty-add', label: '添加 Key', icon: 'plus', primary: true }
      });
      document.getElementById('ky-empty-add').onclick = openAdd;
      return;
    }
    let arr = MOCK.keys.slice();
    if (tabType !== '全部') arr = arr.filter(k => k.type === tabType);
    if (kw) arr = arr.filter(k => (k.name + ' ' + k.mask).toLowerCase().indexOf(kw) >= 0);
    if (!arr.length) { list.innerHTML = DF.empty({ icon: '', title: '未找到匹配的密钥' }); return; }

    list.innerHTML = DF.table(
      ['名称', '类型', '掩码摘要', '绑定用途', '状态', '最后校验', { t: '操作', s: 'style="width:170px"' }],
      arr.map(rowHtml)
    );

    list.querySelectorAll('.ky-verify').forEach(b => { b.onclick = () => verifyKey(byId(b.getAttribute('data-id')), b); });
    list.querySelectorAll('.ky-edit').forEach(b => { b.onclick = () => openEdit(byId(b.getAttribute('data-id'))); });
    list.querySelectorAll('.ky-more').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const k = byId(b.getAttribute('data-id'));
        DF.menu([
          { label: '绑定用途', icon: 'key', onClick: () => openBindDrawer(k) },
          { label: '删除', icon: 'trash', danger: true, onClick: () => delKey(k) }
        ], e.clientX, e.clientY);
      };
    });
    list.querySelectorAll('.chip.click[data-bind]').forEach(c => {
      c.onclick = () => openBindDrawer(byId(c.getAttribute('data-bind')));
    });
  }

  function byId(id) { return MOCK.byId(MOCK.keys, id); }

  /* ---------------- 校验（模拟） ---------------- */
  function verifyKey(k, btn) {
    if (!k || btn.disabled) return;
    btn.disabled = true; btn.textContent = '校验中…';
    setTimeout(() => {
      const ok = k.type === 'git ssh-key' ? true
        : (k.provider === '内部网关' ? true : Math.random() < 0.5);
      k.lastCheckedM = 0;
      k.status = ok ? '有效' : '失效';
      DF.toast(ok ? '校验通过' : '校验失败：认证被拒绝', ok ? 'ok' : 'err');
      renderList();
    }, 800);
  }

  /* ---------------- 添加 Key（两步式弹窗） ---------------- */
  function sshFormHtml() {
    return '<div class="field"><label>名称 <span class="req">*</span></label>' +
        '<input class="inp" id="ky-ssh-name" placeholder="如 deploy-key">' +
      '</div>' +
      '<div class="field"><label>公钥 <span class="req">*</span></label>' +
        '<textarea class="inp" id="ky-ssh-pub" rows="4" placeholder="ssh-ed25519 AAAA…"></textarea>' +
        '<div class="hint" id="ky-ssh-hint">需以 ssh- 开头（如 ssh-ed25519 / ssh-rsa）</div>' +
        '<div class="ky-gen">本地生成: <span class="mono">ssh-keygen -t ed25519 -C "agentflow"</span></div>' +
      '</div>' +
      '<div class="field"><label>备注</label><input class="inp" id="ky-ssh-note" placeholder="用途说明（可选）"></div>';
  }

  function llmFormHtml() {
    return '<div class="field"><label>名称 <span class="req">*</span></label>' +
        '<input class="inp" id="ky-llm-name" placeholder="如 deepseek-key">' +
      '</div>' +
      '<div class="field"><label>供应商 <span class="req">*</span></label>' +
        '<select class="inp" id="ky-llm-provider"><option>OpenAI</option><option>DeepSeek</option><option>内部网关</option></select>' +
      '</div>' +
      '<div class="field"><label>API Key <span class="req">*</span></label>' +
        '<input type="password" class="inp" id="ky-llm-key" placeholder="sk-… / gw-…" autocomplete="new-password">' +
      '</div>' +
      '<div class="field"><label>默认模型 <span class="req">*</span></label>' +
        '<select class="inp" id="ky-llm-model"></select>' +
      '</div>' +
      '<div class="field"><label>额度说明</label><input class="inp" id="ky-llm-quota" placeholder="可选，如 月度 $50 配额"></div>';
  }

  function openAdd() {
    DF.modal.form({
      title: '添加 Key',
      width: 560,
      okText: '确定',
      okDisabled: true,
      body:
        '<div class="field"><label>Key 类型 <span class="req">*</span></label>' +
          '<label class="ky-radio" data-t="git ssh-key"><input type="radio" name="ky-type" value="git ssh-key"> git ssh-key <span class="sub">仓库访问凭证</span></label>' +
          '<label class="ky-radio" data-t="LLM API Key"><input type="radio" name="ky-type" value="LLM API Key"> LLM API Key <span class="sub">模型调用凭证</span></label>' +
        '</div>' +
        '<div id="ky-form-ssh" class="ky-type-form" style="display:none">' + sshFormHtml() + '</div>' +
        '<div id="ky-form-llm" class="ky-type-form" style="display:none">' + llmFormHtml() + '</div>',
      onMount(b, close, okBtn) {
        const radios = b.querySelectorAll('input[name="ky-type"]');
        const fSsh = document.getElementById('ky-form-ssh');
        const fLlm = document.getElementById('ky-form-llm');
        const hint = document.getElementById('ky-ssh-hint');
        let curType = '';

        function selType() {
          const r = b.querySelector('input[name="ky-type"]:checked');
          return r ? r.value : '';
        }
        function syncModelOpts() {
          const prov = document.getElementById('ky-llm-provider').value;
          document.getElementById('ky-llm-model').innerHTML =
            (MODEL_BY_PROVIDER[prov] || []).map(m => '<option>' + m + '</option>').join('');
        }
        function checkSsh() {
          const pub = document.getElementById('ky-ssh-pub').value.trim();
          const bad = pub.length > 0 && pub.indexOf('ssh-') !== 0;
          hint.textContent = bad ? '公钥格式不正确：必须以 ssh- 开头' : '需以 ssh- 开头（如 ssh-ed25519 / ssh-rsa）';
          hint.classList.toggle('ky-hint-err', bad);
          return pub.indexOf('ssh-') === 0;
        }
        function refresh() {
          okBtn.disabled = !curType || !(
            curType === 'git ssh-key'
              ? (document.getElementById('ky-ssh-name').value.trim() && checkSsh())
              : (document.getElementById('ky-llm-name').value.trim() && document.getElementById('ky-llm-key').value.trim())
          );
        }

        radios.forEach(r => {
          r.onchange = () => {
            curType = r.value;
            b.querySelectorAll('.ky-radio').forEach(x => x.classList.toggle('on', x.contains(r) && r.checked));
            fSsh.style.display = curType === 'git ssh-key' ? '' : 'none';
            fLlm.style.display = curType === 'LLM API Key' ? '' : 'none';
            if (curType === 'LLM API Key') syncModelOpts();
            refresh();
          };
        });
        ['ky-ssh-name', 'ky-ssh-pub', 'ky-llm-name', 'ky-llm-key'].forEach(id => {
          const el = document.getElementById(id);
          el.addEventListener('input', refresh);
          el.addEventListener('change', refresh);
        });
        document.getElementById('ky-llm-provider').onchange = function () { syncModelOpts(); };
      },
      onOk(b, close) {
        const t = selTypeOf(b);
        if (!t) return;
        let item;
        if (t === 'git ssh-key') {
          const note = document.getElementById('ky-ssh-note').value.trim();
          item = {
            name: document.getElementById('ky-ssh-name').value.trim(),
            type: 'git ssh-key',
            mask: 'SHA256:' + hex(2) + ':' + hex(2) + ':' + hex(2) + ':…:' + hex(4),
            provider: '—', model: '—',
            bindings: { workspaces: [], harnesses: [], experts: [] },
            status: '未校验', lastCheckedM: null, note: note
          };
        } else {
          const prov = document.getElementById('ky-llm-provider').value;
          const quota = document.getElementById('ky-llm-quota').value.trim();
          const note = quota ? '额度: ' + quota : '';
          item = {
            name: document.getElementById('ky-llm-name').value.trim(),
            type: 'LLM API Key',
            mask: (prov === '内部网关' ? 'gw-****' : 'sk-****') + hex(4),
            provider: prov,
            model: document.getElementById('ky-llm-model').value || (MODEL_BY_PROVIDER[prov] || [''])[0],
            bindings: { workspaces: [], harnesses: [], experts: [] },
            status: '未校验', lastCheckedM: null, note: note
          };
        }
        let n = MOCK.keys.length + 1;
        while (MOCK.keys.some(k => k.id === 'k' + n)) n++;
        item.id = 'k' + n;
        MOCK.keys.push(item);
        close();
        DF.toast('已添加「' + item.name + '」，状态未校验', 'ok');
        renderList();
      }
    });
  }

  /* onOk 内取当前选中的 Key 类型（ radios 作用域在 onMount 内，此处从 DOM 重查） */
  function selTypeOf(b) {
    const r = b.querySelector('input[name="ky-type"]:checked');
    return r ? r.value : '';
  }

  /* ---------------- 编辑弹窗（名称/绑定/备注，掩码只读） ---------------- */
  function openEdit(k) {
    if (!k) return;
    DF.modal.form({
      title: '编辑 Key',
      width: 520,
      okText: '保存',
      body:
        '<div class="field"><label>掩码摘要</label>' +
          '<input class="inp ky-ro" value="' + DF.esc(k.mask) + '" readonly title="完整值加密存储、不可回显">' +
          '<div class="hint">掩码只读，完整密钥不可回显</div>' +
        '</div>' +
        '<div class="field"><label>名称 <span class="req">*</span></label>' +
          '<input class="inp" id="ky-ed-name" value="' + DF.esc(k.name) + '">' +
        '</div>' +
        '<div class="field"><label>绑定用途</label><div id="ky-ed-binds">' + chipsHtml(k) + '</div>' +
          '<div class="hint">点击 chips 或下方按钮打开绑定编辑抽屉</div>' +
        '</div>' +
        '<div class="field"><label>备注</label><input class="inp" id="ky-ed-note" value="' + DF.esc(k.note || '') + '"></div>',
      onMount(b) {
        const refreshChips = () => { const el = document.getElementById('ky-ed-binds'); if (el) el.innerHTML = chipsHtml(k); };
        b.addEventListener('click', (e) => {
          const c = e.target.closest('.chip.click');
          if (c) openBindDrawer(k, refreshChips);
        });
      },
      onOk(b, close) {
        const name = document.getElementById('ky-ed-name').value.trim();
        if (!name) { DF.toast('名称不能为空', 'err'); return; }
        k.name = name;
        k.note = document.getElementById('ky-ed-note').value.trim();
        close();
        DF.toast('已保存修改', 'ok');
        renderList();
      }
    });
  }

  /* ---------------- 绑定编辑抽屉（560px） ---------------- */
  function openBindDrawer(k, onChange) {
    if (!k) return;
    if (!k.bindings) k.bindings = { workspaces: [], harnesses: [], experts: [] };
    const picked = {
      workspaces: (k.bindings.workspaces || []).slice(),
      harnesses: (k.bindings.harnesses || []).slice(),
      experts: (k.bindings.experts || []).slice()
    };
    const group = (title, keyName, items, subOf) => {
      const rows = items.map(it => {
        const on = picked[keyName].indexOf(it.id) >= 0;
        return '<label class="ky-check"><input type="checkbox" data-g="' + keyName + '" value="' + it.id + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + DF.esc(it.name) + (subOf ? ' <span class="sub">' + DF.esc(subOf(it)) + '</span>' : '') + '</span></label>';
      }).join('');
      return '<div class="field"><label>' + title + '</label><div class="ky-checklist">' + rows + '</div></div>';
    };
    DF.drawer.open({
      title: '绑定用途 — ' + k.name,
      width: '560',
      body:
        group('工作区', 'workspaces', MOCK.workspaces) +
        group('Harness', 'harnesses', MOCK.harnesses, h => h.type) +
        group('专家调用', 'experts', MOCK.experts),
      footer: '<button class="btn" id="ky-b-cancel">取消</button><button class="btn primary" id="ky-b-save">保存</button>',
      onMount(b, close) {
        document.getElementById('ky-b-cancel').onclick = close;
        document.getElementById('ky-b-save').onclick = () => {
          const sel = { workspaces: [], harnesses: [], experts: [] };
          b.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => sel[cb.getAttribute('data-g')].push(cb.value));
          k.bindings = sel;
          close();
          DF.toast('绑定已更新：' + (bindSummary(k).join(' / ') || '未绑定'), 'ok');
          renderList();
          if (onChange) onChange();
        };
      }
    });
  }

  /* ---------------- 删除 ---------------- */
  async function delKey(k) {
    if (!k) return;
    const n = bindCount(k);
    const ok = await DF.modal.confirm({
      title: '删除 Key',
      danger: true,
      okText: '删除',
      html: '确定删除 <b>' + DF.esc(k.name) + '</b>（' + DF.esc(k.mask) + '）？' +
        (n ? '<div class="notice warn" style="margin-top:8px">' + DF.icon('warn', 14) +
          '该 Key 被 ' + n + ' 处使用，删除后相关资产将无法访问</div>' : '')
    });
    if (!ok) return;
    MOCK.keys = MOCK.keys.filter(x => x.id !== k.id);
    DF.toast('已删除「' + k.name + '」', 'ok');
    renderList();
  }

  /* ---------------- 启动 ---------------- */
  renderList();
})();
