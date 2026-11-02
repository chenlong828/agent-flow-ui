/**
 * AgentFlow 原型 · DF 组件库
 * 用法: 页面 JS 调 DF.renderShell({active,...}) 渲染外壳，再用 DF.drawer/modal/toast 等组件。
 */

  /* ---------------- 图标（feather 风格线性图标） ---------------- */
  const P = {
    flow: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h8V14"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    server: '<rect x="2" y="3" width="20" height="7" rx="1.5"/><rect x="2" y="14" width="20" height="7" rx="1.5"/><path d="M6 6.5h.01M6 17.5h.01"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    play: '<circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/>',
    chart: '<path d="M12 20V10M18 20V4M6 20v-6"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    retry: '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    collapse: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>'
  };
  function icon(name, size) {
    const s = size || 16;
    return '<svg class="ic" style="width:' + s + 'px;height:' + s + 'px" viewBox="0 0 24 24">' + (P[name] || '') + '</svg>';
  }

  /* ---------------- 通用工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function relTime(minAgo) {
    if (minAgo == null) return '—';
    if (minAgo < 1) return '刚刚';
    if (minAgo < 60) return Math.round(minAgo) + ' 分钟前';
    if (minAgo < 1440) return Math.round(minAgo / 60) + ' 小时前';
    return Math.round(minAgo / 1440) + ' 天前';
  }
  function fmtDur(sec) {
    if (sec == null) return '—';
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm' + (sec % 60 ? (sec % 60) + 's' : '');
    return (sec / 3600).toFixed(1) + 'h';
  }
  function fmtBytes(n) {
    if (n == null) return '—';
    if (n >= 1073741824) return (n / 1073741824).toFixed(1) + 'G';
    if (n >= 1048576) return (n / 1048576).toFixed(0) + 'M';
    return Math.round(n / 1024) + 'K';
  }
  function ts(minAgo) { return new Date(Date.now() - (minAgo || 0) * 60000); }
  function fmtClock(d) {
    const p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------------- 本地存储（统一 try-catch，隐私模式不抛错） ---------------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 忽略 */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 忽略 */ } }
  function ssRemove(k) { try { sessionStorage.removeItem(k); } catch (e) { /* 忽略 */ } }

  /* ---------------- 文件下载（Blob + a[download]，各页导出共用） ---------------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* 深拷贝（原型无外部依赖，JSON 序列化足够） */
  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- 状态词表 → 语义色 ---------------- */
  const STATUS = {
    '运行中': 'blue', '等待人工确认': 'orange', '回退重跑中': 'purple', '已暂停': 'gray',
    '成功': 'green', '失败': 'red', '已终止': 'gray', '排队中': 'gray', '已完成': 'green',
    '待执行': 'gray', '运行完成': 'green', '已跳过': 'gray', '触发回退': 'purple',
    '草稿': 'gray', '已发布': 'green',
    '在线': 'green', '离线': 'gray', '高负载': 'orange',
    '可用': 'green', '不可用': 'red', '未验证': 'gray',
    '启用': 'green', '停用': 'gray',
    '有效': 'green', '失效': 'red', '未校验': 'gray',
    '已初始化': 'green', '校验失败': 'red', '未初始化': 'gray',
    '通过': 'green', '不通过': 'red', '回退': 'purple', '驳回': 'red', '批准': 'green',
    '重试中': 'orange', '研发主流程': 'blue', '专项子流程': 'teal', '批量审视任务': 'purple'
  };
  function tag(text, color) {
    const c = color || STATUS[text] || 'gray';
    return '<span class="tag ' + c + '">' + esc(text) + '</span>';
  }
  function dot(color) { return '<span class="dot ' + (color || 'gray') + '"></span>'; }
  function statusMeta(s) { return { label: s, color: STATUS[s] || 'gray' }; }

  /* ---------------- 公共页面构件（列表页反复出现的 HTML 骨架） ---------------- */

  /* 搜索框：icon + input.inp（各列表页工具条共用） */
  function searchBox(id, placeholder, value, sm) {
    return '<span class="search-box">' + icon('search', 14) +
      '<input class="inp' + (sm ? ' inp-sm' : '') + '" id="' + esc(id) + '" placeholder="' + esc(placeholder || '') + '"' +
      (value ? ' value="' + esc(value) + '"' : '') + '></span>';
  }

  /* 空态：icon 传图标名（渲染 svg）或 emoji/空串；title 转义、html 原样；action 渲染底部按钮 */
  function empty(opt) {
    opt = opt || {};
    const raw = opt.icon == null ? '🔍' : String(opt.icon);
    const icHtml = /^[a-z][\w-]*$/i.test(raw) ? icon(raw, opt.iconSize || 32) : raw;
    let inner = (opt.title != null ? '<div>' + esc(opt.title) + '</div>' : '') + (opt.html || '');
    if (opt.action) {
      const a = opt.action;
      inner += '<div style="margin-top:12px"><button class="btn' + (a.primary ? ' primary' : '') + (a.sm ? ' sm' : '') + '"' +
        (a.id ? ' id="' + esc(a.id) + '"' : '') + (a.act ? ' data-act="' + esc(a.act) + '"' : '') +
        (a.style ? ' style="' + a.style + '"' : '') + '>' + (a.icon ? icon(a.icon, 14) : '') + esc(a.label || '') + '</button></div>';
    }
    return '<div class="empty"' + (opt.style ? ' style="' + opt.style + '"' : '') + '><div class="e-ic">' + icHtml + '</div>' + inner + '</div>';
  }

  /* 表格骨架：cols 为字符串或 {t, s(样式)}，传 null 则无表头；rows 为完整 '<tr>…</tr>' 串数组；
   * opt: { cls(附加 table 类), wrapCls(附加 tbl-wrap 类), wrapStyle(tbl-wrap 内联样式) } */
  function table(cols, rows, opt) {
    opt = opt || {};
    const thead = cols ? '<thead><tr>' + cols.map(function (c) {
      const o = (typeof c === 'string') ? { t: c } : c;
      return '<th' + (o.s ? ' ' + o.s : '') + '>' + o.t + '</th>';
    }).join('') + '</tr></thead>' : '';
    return '<div class="tbl-wrap' + (opt.wrapCls ? ' ' + opt.wrapCls : '') + '"' + (opt.wrapStyle ? ' style="' + opt.wrapStyle + '"' : '') + '><table class="tbl' + (opt.cls ? ' ' + opt.cls : '') + '">' +
      thead + '<tbody>' + (rows || []).join('') + '</tbody></table></div>';
  }

  /* 表单字段：label + 必填星号 + 内容 + 提示 */
  function field(label, inner, opt) {
    opt = opt || {};
    return '<div class="field"' + (opt.style ? ' style="' + opt.style + '"' : '') + '><label>' + esc(label) +
      (opt.required ? '<span class="req">*</span>' : '') + '</label>' + inner +
      (opt.hint ? '<div class="hint">' + opt.hint + '</div>' : '') + '</div>';
  }

  /* 键值对：pairs 为 [key, valueHtml] 二元组数组，value 原样（可含 tag/链接） */
  function kv(pairs, opt) {
    opt = opt || {};
    return '<div class="kv"' + (opt.style ? ' style="' + opt.style + '"' : '') + '>' +
      pairs.map(function (p) { return '<span class="k">' + esc(p[0]) + '</span><span>' + p[1] + '</span>'; }).join('') + '</div>';
  }

  /* Tabs 条：items 为 {k, label, count}；count 传 null/undefined 不渲染徽标；
   * attr 为选项属性名（默认 data-tab），wrapAttrs 为容器附加属性（如 'id="xx"'） */
  function tabsHtml(items, active, attr, wrapAttrs) {
    attr = attr || 'data-tab';
    return '<div class="tabs"' + (wrapAttrs ? ' ' + wrapAttrs : '') + '>' + items.map(function (it) {
      return '<div class="tab' + (it.k === active ? ' active' : '') + '" ' + attr + '="' + esc(it.k) + '">' + esc(it.label) +
        (it.count != null ? '<span class="badge-count">' + it.count + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* 统计卡：v/d/side 为原样 HTML（可含 small/箭头/迷你图），k 转义；
   * dFlex 时 d 与 side 横向排列（如 环比文本 + 迷你趋势线） */
  function statCard(o) {
    return '<div class="stat-card' + (o.click ? ' click' : '') + '"' +
      (o.id ? ' id="' + esc(o.id) + '"' : '') + (o.title ? ' title="' + esc(o.title) + '"' : '') +
      (o.style ? ' style="' + o.style + '"' : '') + '>' +
      '<div class="k">' + (o.dot ? dot(o.dot) : '') + esc(o.k) + '</div>' +
      '<div class="v">' + (o.v == null ? '' : o.v) + '</div>' +
      ((o.d || o.side) ?
        (o.dFlex ? '<div style="display:flex;align-items:center;gap:8px">' : '') +
        (o.d ? '<div class="d' + (o.dCls ? ' ' + o.dCls : '') + '">' + o.d + '</div>' : '') +
        (o.side || '') +
        (o.dFlex ? '</div>' : '') : '') +
      '</div>';
  }
  function statRow(cards, style) {
    return '<div class="stat-row"' + (style ? ' style="' + style + '"' : '') + '>' + cards.join('') + '</div>';
  }

  /* ---------------- 外壳 ---------------- */
  const NAV = [
    { group: '流程研发', items: [{ id: 'workflows', label: '工作流', icon: 'flow', href: 'workflow-list.html' }] },
    { group: '资产与注册', items: [
      { id: 'experts', label: '专家管理', icon: 'user', href: 'experts.html' },
      { id: 'skills', label: 'Skill 库', icon: 'book', href: 'skills.html' },
      { id: 'harnesses', label: 'Harness 管理', icon: 'server', href: 'harnesses.html' },
      { id: 'tools', label: '工具与集成', icon: 'tool', href: 'tools.html' }
    ] },
    { group: '运行与运营', items: [
      { id: 'instances', label: '运行实例', icon: 'play', href: 'instances.html' },
      { id: 'analytics', label: '效能看板', icon: 'chart', href: 'analytics.html' }
    ] },
    { group: '基础配置', items: [
      { id: 'workspaces', label: '工作区配置', icon: 'folder', href: 'workspaces.html' },
      { id: 'keys', label: '个人 Key 管理', icon: 'key', href: 'keys.html' }
    ] }
  ];

  /* ---------------- 界面字体大小（顶部栏可调：小/中/大/最大，最大≈20px 基准） ----------------
   * 双路径：优先 html 级 zoom（真实 Safari/Chrome 支持，fixed 弹层一并缩放）；
   * 探测不生效（如部分引擎）则 transform 兜底缩放外壳（.topbar + #df-layout），弹层保持基准尺寸。 */
  const FONT_STEPS = { s: 12 / 13, m: 1, l: 16 / 13, xl: 20 / 13 };
  let fontKey = 'm';
  fontKey = lsGet('df-font') || 'm';
  let effZoom = FONT_STEPS[fontKey] || 1;   // 实际生效的视觉缩放系数（画布/拖拽数学用）
  let zoomOnFixed = true;                    // fixed 弹层是否随 zoom 缩放
  function applyZoom() {
    const z = FONT_STEPS[fontKey] || 1;
    document.documentElement.style.zoom = z === 1 ? '' : z;
    let probe = document.getElementById('df-zoom-probe');
    if (!probe) {
      probe = document.createElement('div');
      probe.id = 'df-zoom-probe';
      probe.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:10px;pointer-events:none;opacity:0;z-index:-1';
      document.body.appendChild(probe);
    }
    const measured = probe.getBoundingClientRect().width / 100;
    if (z === 1 || Math.abs(measured - z) < 0.03) {   // zoom 生效（且 fixed 继承）
      zoomOnFixed = true; effZoom = z;
      const tb = document.querySelector('.topbar'), lay = document.getElementById('df-layout');
      if (tb) { tb.style.transform = ''; tb.style.width = ''; tb.style.right = ''; }
      if (lay) { lay.style.transform = ''; lay.style.width = ''; lay.style.minHeight = ''; }
    } else {                                           // zoom 无效 → transform 兜底（并彻底清除 zoom：部分引擎 zoom 不缩放内容却会缩小 fixed 包含块）
      document.documentElement.style.zoom = '';
      zoomOnFixed = false; effZoom = z;
      const tb = document.querySelector('.topbar'), lay = document.getElementById('df-layout');
      if (tb) { tb.style.transformOrigin = '0 0'; tb.style.transform = 'scale(' + z + ')'; tb.style.width = (100 / z) + '%'; tb.style.right = 'auto'; tb.style.left = '0'; }
      if (lay) { lay.style.transformOrigin = '0 0'; lay.style.transform = 'scale(' + z + ')'; lay.style.width = (100 / z) + '%'; lay.style.minHeight = (100 / z) + 'vh'; }
    }
  }
  function zoomK() { return effZoom; }
  applyZoom();

  function renderShell(opt) {
    const app = document.getElementById('app');
    const bell = opt.pendingCount || 0;
    const bc = (opt.breadcrumb || []).map((b, i, arr) =>
      (b.href && i < arr.length - 1 ? '<a href="' + b.href + '">' + esc(b.label) + '</a>' : '<span>' + esc(b.label) + '</span>')
    ).join(' <span style="margin:0 4px">/</span> ');

    app.innerHTML =
      '<header class="topbar">' +
        '<span class="logo"><span class="logo-mark">⬡</span>AgentFlow <span style="font-weight:400;color:var(--t-3);font-size:12px">研发智能体工作流编排</span></span>' +
        '<span class="env">演示环境</span><span class="sp"></span>' +
        '<span class="font-ctl" title="界面字体大小">字体 <select id="df-font">' +
          ['s|m|小', 'm|m|中', 'l|l|大', 'xl|xl|最大'].map(function (it) {
            var p = it.split('|');
            return '<option value="' + p[0] + '"' + (fontKey === p[1] ? ' selected' : '') + '>' + p[2] + '</option>';
          }).join('') + '</select></span>' +
        '<span class="bell" id="df-bell" title="待人工确认">' + icon('bell', 18) + (bell ? '<span class="badge-count">' + bell + '</span>' : '') + '</span>' +
        '<span class="user" id="df-user" title="账号菜单"><span class="avatar">陈</span>陈龙 ' + icon('down', 14) + '</span>' +
      '</header>' +
      '<div class="layout" id="df-layout"><aside class="sidebar">' +
        NAV.map(g => '<div class="nav-group"><div class="nav-group-title">' + g.group + '</div>' +
          g.items.map(it => '<a class="nav-item' + (it.id === opt.active ? ' active' : '') + '" href="' + it.href + '">' + icon(it.icon) + '<span class="lbl">' + it.label + '</span></a>').join('') + '</div>').join('') +
        '<button class="btn sm collapse-btn" id="df-collapse" style="justify-content:center">' + icon('collapse') + '<span class="lbl">收起</span></button>' +
      '</aside><main class="main">' +
        '<div class="breadcrumb">' + bc + '</div>' +
        '<div class="page-header"><div><h1>' + esc(opt.title || '') + '</h1>' +
          (opt.subtitle ? '<div class="sub">' + esc(opt.subtitle) + '</div>' : '') + '</div>' +
          '<div class="acts">' + (opt.actions || '') + '</div></div>' +
        '<div class="page-body" id="page-body"></div>' +
      '</main></div>';

    document.getElementById('df-bell').onclick = () => { location.href = 'instances.html?tab=' + encodeURIComponent('等待人工确认'); };
    /* 用户区下拉菜单（design/ui-shell.md §2）：个人 Key 管理快捷入口 / 退出登录（原型静态）。
     * stopPropagation 是切换语义的关键：菜单开时点用户区不再被 document 关闭监听器抢收（见 menu()），自行收起。 */
    document.getElementById('df-user').onclick = (e) => {
      e.stopPropagation();
      if (menuEl) { closeMenu(); return; }
      const r = document.getElementById('df-user').getBoundingClientRect();
      menu([
        { icon: 'key', label: '个人 Key 管理', onClick() { location.href = 'keys.html'; } },
        { icon: 'logout', label: '退出登录', danger: true, async onClick() {
            if (await modal.confirm({ title: '退出登录', danger: true, okText: '退出', message: '确定要退出当前登录吗？' }))
              toast('已退出登录（原型演示，无真实登录态）', 'ok');
          } }
      ], r.right, r.bottom + 6, { alignRight: true });
    };
    document.getElementById('df-font').onchange = e => {
      fontKey = e.target.value;
      lsSet('df-font', fontKey);
      applyZoom();
      toast('界面字体已调整为「' + e.target.selectedOptions[0].text + '」', 'ok');
    };
    applyZoom(); // DOM 就绪后重探测并应用（兜底 transform 需要外壳存在）
    document.getElementById('df-collapse').onclick = () => {
      const lay = document.getElementById('df-layout');
      lay.classList.toggle('collapsed');
      const c = lay.classList.contains('collapsed');
      document.querySelector('#df-collapse .lbl').textContent = c ? '' : '收起';
      lsSet('df-collapsed', c ? '1' : '');
    };
    if (lsGet('df-collapsed')) document.getElementById('df-layout').classList.add('collapsed');
    return document.getElementById('page-body');
  }

  /* ---------------- 抽屉 ---------------- */
  const drawer = {};
  drawer.open = function (opt) {
    drawer.close();
    const ov = opt.noOverlay ? null : document.createElement('div'); if (ov) ov.className = 'overlay';
    const d = document.createElement('div'); d.className = 'drawer'; d.style.width = (opt.width || 720) + 'px'; d.style.maxWidth = '94vw';
    d.innerHTML = '<div class="d-head">' + esc(opt.title || '') +
      '<button class="icon-btn x">' + icon('x') + '</button></div>' +
      '<div class="d-body"></div>' + (opt.footer ? '<div class="d-foot">' + opt.footer + '</div>' : '');
    if (ov) document.body.appendChild(ov); document.body.appendChild(d);
    const body = d.querySelector('.d-body');
    if (typeof opt.body === 'string') body.innerHTML = opt.body; else if (opt.body) body.appendChild(opt.body);
    const close = () => { if (ov) ov.remove(); d.remove(); document.removeEventListener('keydown', onKey); if (opt.onClose) opt.onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    if (ov) ov.onclick = close; d.querySelector('.x').onclick = close;
    if (opt.onMount) opt.onMount(body, close);
    drawer._close = close;
    return { close, body };
  };
  drawer.close = function () { if (drawer._close) { drawer._close(); drawer._close = null; } };

  /* ---------------- 弹窗 ---------------- */
  const modal = {};
  modal.open = function (opt) {
    modal.close();
    const ov = document.createElement('div'); ov.className = 'overlay';
    const w = document.createElement('div'); w.className = 'modal-wrap';
    const m = document.createElement('div'); m.className = 'modal';
    const zK0 = zoomOnFixed ? (zoomK() || 1) : 1; // 兜底模式下弹层不缩放，不除系数
    const resolveW = v => { // vw/% 期望的"视觉"宽度 → 除以 zoom 得 CSS px（html zoom 会再放大）
      if (typeof v !== 'string') return (v || 480) + 'px';
      const mm = /^([\d.]+)(?:vw|%)$/.exec(v);
      return mm ? (parseFloat(mm[1]) / 100 * window.innerWidth / (zK0 || 1)) + 'px' : v;
    };
    m.style.width = resolveW(opt.width);
    m.innerHTML = '<div class="d-head">' + esc(opt.title || '') +
      '<button class="icon-btn x">' + icon('x') + '</button></div>' +
      '<div class="d-body"></div>' + (opt.footer ? '<div class="d-foot">' + opt.footer + '</div>' : '');
    /* 可横向拖拽调宽（opt.resizable）：左右把手，居中对称为两侧同步展开；双击把手恢复默认宽 */
    if (opt.resizable) {
      const addGrip = side => {
        const g = document.createElement('div');
        g.className = 'rz rz-' + side;
        g.title = '拖拽调整宽度 · 双击恢复默认';
        g.addEventListener('mousedown', e => {
          e.preventDefault();
          const zK = zoomOnFixed ? (zoomK() || 1) : 1; // 兜底模式下弹层未缩放，不除系数（同作用域为布尔标志）
          const startX = e.clientX, startW = m.getBoundingClientRect().width / zK, dir = side === 'l' ? -1 : 1;
          const move = ev => {
            const dx = (ev.clientX - startX) * dir / zK;
            const maxW = window.innerWidth * 0.96 / zK, minW = 480;
            m.style.width = Math.max(minW, Math.min(maxW, startW + dx * 2)) + 'px';
          };
          const up = () => {
            document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
            document.body.style.userSelect = '';
          };
          document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        });
        g.addEventListener('dblclick', () => { m.style.width = resolveW(opt.width); });
        m.appendChild(g);
      };
      addGrip('l'); addGrip('r');
    }
    w.appendChild(ov); w.appendChild(m);
    document.body.appendChild(w);
    const body = m.querySelector('.d-body');
    if (typeof opt.body === 'string') body.innerHTML = opt.body; else if (opt.body) body.appendChild(opt.body);
    const close = () => { w.remove(); if (opt.onClose) opt.onClose(); };
    ov.onclick = close; m.querySelector('.x').onclick = close;
    if (opt.onMount) opt.onMount(body, close);
    modal._close = close;
    return { close, body };
  };
  modal.close = function () { if (modal._close) { modal._close(); modal._close = null; } };

  modal.confirm = function (opt) {
    return new Promise(resolve => {
      let settled = false;
      const done = v => { if (!settled) { settled = true; resolve(v); } };
      modal.open({
        title: opt.title || '确认操作',
        body: '<div style="display:flex;gap:10px;align-items:flex-start">' + icon(opt.danger ? 'warn' : 'check', 20) +
          '<div>' + (opt.html || esc(opt.message || '')) + '</div></div>',
        footer: '<button class="btn" id="mc-no">取消</button><button class="btn ' + (opt.danger ? 'danger' : 'primary') + '" id="mc-ok">' + esc(opt.okText || '确定') + '</button>',
        onMount(body, close) {
          const root = body.closest('.modal'); // footer 按钮在 .d-foot 内，是 .d-body 的兄弟节点
          root.querySelector('#mc-no').onclick = () => { done(false); close(); };
          root.querySelector('#mc-ok').onclick = () => { done(true); close(); };
        },
        onClose() { done(false); } // 遮罩/×关闭视为取消；按钮路径已先 done 再 close
      });
    });
  };

  /* 表单弹窗：自动渲染并绑定「取消 / 确定」footer，消灭各页重复的 closest('.modal') 绑定。
   * opt: { title, width, body, okText, okDisabled, footerExtra(置于取消前), onOk(body, close),
   *        onMount(body, close, okBtn), onClose, resizable }
   * onOk 内自行决定是否 close()（校验失败可不关）。 */
  let mfSeq = 0;
  modal.form = function (opt) {
    const okId = 'df-mf-ok-' + (++mfSeq);
    modal.open({
      title: opt.title,
      width: opt.width,
      body: opt.body,
      resizable: opt.resizable,
      footer: (opt.footerExtra || '') +
        '<button class="btn" data-mf-cancel>取消</button>' +
        '<button class="btn primary" id="' + okId + '"' + (opt.okDisabled ? ' disabled' : '') + '>' + esc(opt.okText || '确定') + '</button>',
      onMount(body, close) {
        const root = body.closest('.modal');
        root.querySelector('[data-mf-cancel]').onclick = close;
        const okBtn = root.querySelector('#' + okId);
        okBtn.onclick = () => { if (opt.onOk) opt.onOk(body, close); };
        if (opt.onMount) opt.onMount(body, close, okBtn);
      },
      onClose: opt.onClose
    });
  };

  /* 复选挑选弹窗：从列表勾选若干项（专家页 Skill/工具挑选等场景）。
   * opt: { title, width, items:[{id, name, mono, tag, tagColor, summary}], okText, noneText, onOk(ids, close) } */
  modal.picker = function (opt) {
    const rows = (opt.items || []).map(it =>
      '<label class="df-pick-row"><input type="checkbox" value="' + esc(it.id) + '">' +
      '<span' + (it.mono ? ' class="mono"' : '') + ' style="font-weight:600;font-size:13px">' + esc(it.name) + '</span>' +
      (it.tag ? tag(it.tag, it.tagColor) : '') +
      '<span class="df-pick-sum" title="' + esc(it.summary || '') + '">' + esc(it.summary || '') + '</span></label>').join('');
    modal.form({
      title: opt.title,
      width: opt.width || 540,
      body: '<div>' + rows + '</div>',
      okText: opt.okText || '添加所选',
      onOk(body, close) {
        const sel = Array.prototype.map.call(body.querySelectorAll('input[type="checkbox"]:checked'), i => i.value);
        if (!sel.length) { toast(opt.noneText || '请先勾选要添加的项', 'warn'); return; }
        if (opt.onOk) opt.onOk(sel, close);
      }
    });
  };

  /* ---------------- Toast ---------------- */
  function toast(msg, type) {
    let box = document.getElementById('toast-box');
    if (!box) { box = document.createElement('div'); box.id = 'toast-box'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    const ic = type === 'ok' ? 'check' : type === 'err' ? 'x' : type === 'warn' ? 'warn' : 'bell';
    t.innerHTML = icon(ic, 14) + esc(msg);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2400);
  }

  /* ---------------- 右键/更多菜单 ---------------- */
  let menuEl = null;
  function menu(items, x, y, opts) {
    closeMenu();
    /* 调用方统一传视觉坐标（clientX / rect 均是视觉值）：zoom 路径下 fixed 弹层随内容缩放，需除以
     * 系数换算为 CSS px（规则见《代码重构要点》§5.4 数学归一）；transform 兜底路径弹层不缩放，zK=1 原样。 */
    const zK = zoomOnFixed ? (zoomK() || 1) : 1;
    x = x / zK; y = y / zK;
    menuEl = document.createElement('div'); menuEl.className = 'menu';
    menuEl.style.left = Math.min(x, innerWidth - 160) + 'px'; menuEl.style.top = y + 'px';
    items.forEach(it => {
      const mi = document.createElement('div');
      mi.className = 'mi' + (it.danger ? ' danger' : '');
      mi.innerHTML = (it.icon ? icon(it.icon, 14) : '') + esc(it.label);
      mi.onclick = () => { closeMenu(); if (it.onClick) it.onClick(); };
      menuEl.appendChild(mi);
    });
    document.body.appendChild(menuEl);
    /* opts.alignRight：锚定下拉以右缘坐标 x 对齐——先钳右缘坐标入视口（8px 边距），再量实际宽度反推 left。
     * 默认 x 语义仍为左缘 + innerWidth-160 防溢出钳制，右键菜单等旧调用不受影响。 */
    if (opts && opts.alignRight) menuEl.style.left = Math.max(8, Math.min(x, innerWidth - 8) - menuEl.offsetWidth) + 'px';
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
  }
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }

  function copyText(t) {
    const done = () => toast('已复制到剪贴板', 'ok');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => toast('复制失败', 'err'));
    else {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); done();
    }
  }

  export const DF = { icon, esc, qs, relTime, fmtDur, fmtBytes, ts, fmtClock, tag, dot, statusMeta, renderShell, drawer, modal, toast, menu, closeMenu, copyText, NAV, zoomK, zoomOnFixed: () => zoomOnFixed,
    lsGet, lsSet, ssGet, ssSet, ssRemove, download, deep,
    searchBox, empty, table, field, kv, tabsHtml, statCard, statRow };
