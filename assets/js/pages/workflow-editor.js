/**
 * 工作流编辑器（docs/04）— 拖拽画布 + 属性抽屉 + DSL 视图 + 校验
 */
(function () {
  'use strict';
  const { esc, icon, tag, toast, modal } = DF;

  /* ---------------- 状态 ---------------- */
  const TYPE_META = {
    start: { label: '开始', cls: 't-plain', ic: 'play', cn: '开始' },
    end: { label: '结束', cls: 't-plain', ic: 'stop', cn: '结束' },
    agent: { label: '专家节点', cls: 't-agent', ic: 'user', cn: '专家执行节点' },
    review: { label: '评审节点', cls: 't-review', ic: 'check', cn: '评审/校验节点' },
    confirm: { label: '人工确认', cls: 't-confirm', ic: 'warn', cn: '人工确认节点' },
    fanout: { label: 'fan-out 网关', cls: 't-gateway', ic: 'flow', cn: 'fan-out 网关' },
    fanin: { label: 'fan-in 网关', cls: 't-gateway', ic: 'flow', cn: 'fan-in 网关' }
  };
  const PALETTE = [
    { group: '基础', types: ['start', 'end', 'stage'] },
    { group: '执行', types: ['agent'] },
    { group: '控制', types: ['review', 'confirm'] },
    { group: '并行', types: ['fanout', 'fanin'] }
  ];
  const NODE_W = 168, NODE_H = 58;

  const state = { wf: null, graph: null, zoom: 0.8, sel: null, tab: 'canvas', dslFmt: 'json', dirty: false };
  let stageSeq = 1, nodeSeq = 1;

  /* ---------------- 载入 ---------------- */
  const deep = DF.deep;
  function init() {
    const id = DF.qs('id');
    state.wf = MOCK.byId(MOCK.workflows, id) || MOCK.workflows[0];
    if (!state.wf.graph) state.wf.graph = { nodes: [], edges: [], stages: [], stageBoxes: {}, w: 800, h: 500 };
    state.graph = deep(state.wf.graph);
    state.graph.nodes.forEach(n => { const m = /^n(\d+)$/.exec(n.id); if (m) nodeSeq = Math.max(nodeSeq, +m[1] + 1); });
    state.graph.stages.forEach(s => { const mm = /^s(\d+)$/.exec(s.id); if (mm) stageSeq = Math.max(stageSeq, +mm[1] + 1); });
    renderShell();
    renderLayout();
    renderCanvas();
    renderInspector();
  }

  function renderShell() {
    const pub = state.wf.published;
    DF.renderShell({
      active: 'workflows',
      breadcrumb: [{ label: '流程研发' }, { label: '工作流', href: 'workflow-list.html' }, { label: '编辑器' }],
      title: '工作流编辑器',
      subtitle: '拖拽节点、绑定专家、绘制顺序与回退边；DSL 只读预览',
      actions:
        '<input id="we-name" class="inp we-name" value="' + esc(state.wf.name) + '" title="工作流名称">' +
        '<span class="mono" style="color:var(--t-3)">' + esc(state.wf.ver) + '</span>' + tag(pub ? '已发布' : '草稿') +
        '<div class="seg" id="we-tab"><button data-t="canvas" class="' + (state.tab === 'canvas' ? 'on' : '') + '">画布</button><button data-t="dsl" class="' + (state.tab === 'dsl' ? 'on' : '') + '">DSL</button></div>' +
        '<button class="btn" id="we-validate">' + icon('check', 14) + '校验</button>' +
        '<button class="btn" id="we-save">' + icon('edit', 14) + '保存</button>' +
        '<button class="btn" id="we-publish">发布</button>' +
        '<button class="btn primary" id="we-run"' + (pub ? '' : ' disabled title="草稿不可运行，请先发布"') + '>' + icon('play', 14) + '运行</button>'
    });
    const nameInput = document.getElementById('we-name');
    nameInput.oninput = () => { state.wf.name = nameInput.value; state.dirty = true; };
    document.getElementById('we-tab').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      state.tab = b.dataset.t;
      document.querySelectorAll('#we-tab button').forEach(x => x.classList.toggle('on', x === b));
      renderMainTab();
    };
    document.getElementById('we-validate').onclick = showValidate;
    document.getElementById('we-save').onclick = save;
    document.getElementById('we-publish').onclick = publish;
    document.getElementById('we-run').onclick = runFlow;
  }

  function renderLayout() {
    const body = document.getElementById('page-body');
    body.innerHTML =
      '<div class="we-layout">' +
        '<div class="we-palette card" id="we-palette" style="padding:10px 12px;height:calc(100vh - 170px);overflow-y:auto">' +
          PALETTE.map(g => '<div class="pg">' + g.group + '</div>' + g.types.map(t =>
            '<div class="we-pitem" draggable="true" data-type="' + t + '">' + icon(t === 'stage' ? 'folder' : (TYPE_META[t] || {}).ic || 'flow', 14) +
            (t === 'stage' ? '阶段分组' : TYPE_META[t].label) + '</div>').join('')).join('') +
        '</div>' +
        '<div class="we-canvas-col" id="we-main"></div>' +
      '</div>';
    const pal = document.getElementById('we-palette');
    pal.addEventListener('dragstart', e => {
      const it = e.target.closest('.we-pitem');
      if (it) e.dataTransfer.setData('text/plain', it.dataset.type);
    });
    pal.addEventListener('click', e => {
      const it = e.target.closest('.we-pitem');
      if (it) { const p = toGraph(document.getElementById('cvWrap').getBoundingClientRect().left + 420, document.getElementById('cvWrap').getBoundingClientRect().top + 160); addNode(it.dataset.type, Math.round(p.x), Math.round(p.y)); }
    });
  }

  function renderMainTab() {
    if (state.tab === 'canvas') renderCanvas(); else renderDSL();
    renderInspector();
  }

  /* ================= 画布 ================= */
  function renderCanvas() {
    const main = document.getElementById('we-main');
    main.innerHTML =
      '<div class="cv-wrap" id="cvWrap">' +
        '<div id="cvScaler"><div class="cv-canvas" id="cvCanvas"></div></div>' +
        '<div class="cv-toolbar"><button id="z-out">−</button><span class="zoom-val" id="z-val"></span><button id="z-in">+</button><button id="z-fit" title="适应画布">⤢</button></div>' +
      '</div>' +
      '<div class="cv-legend">' +
        '<b>' + icon('user', 12) + ' 专家节点</b><b>' + icon('check', 12) + ' 评审节点</b><b>' + icon('warn', 12) + ' 人工确认</b>' +
        '<b>' + icon('flow', 12) + ' 并行网关</b><b><svg class="ic" style="width:22px;height:8px"><path d="M0 4h22" stroke="#7c3aed" stroke-dasharray="5 3"/></svg> 回退边(唯一)</b>' +
        '<b>拖拽端口连线 · 拖动节点调整位置 · 点击节点在右侧抽屉编辑属性 · Delete 删除选中项</b></div>';
    bindCanvasEvents();
    paint();
  }

  function paint() {
    const g = state.graph;
    document.getElementById('z-val').textContent = Math.round(state.zoom * 100) + '%';
    const scaler = document.getElementById('cvScaler');
    scaler.style.width = (g.w * state.zoom) + 'px'; scaler.style.height = (g.h * state.zoom) + 'px';
    scaler.style.transform = 'scale(' + state.zoom + ')'; scaler.style.transformOrigin = '0 0';
    const c = document.getElementById('cvCanvas');
    c.style.width = g.w + 'px'; c.style.height = g.h + 'px';
    c.innerHTML = stageHTML() + edgesSVG() + nodesHTML() + edgeDelBtn();
  }

  function stageHTML() {
    return state.graph.stages.map(s => {
      const b = state.graph.stageBoxes[s.id] || { x: 40, y: 40, w: 400, h: 180 };
      const sel = state.sel && state.sel.type === 'stage' && state.sel.id === s.id;
      return '<div class="cv-stage' + (sel ? ' stage-sel' : '') + '" data-stage="' + s.id + '" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px">' +
        '<span class="stage-label" data-stage="' + s.id + '" style="cursor:grab">' + esc(s.name) + '<span class="stage-note">' + esc(s.note || '') + '</span></span></div>';
    }).join('');
  }

  function nodesHTML() {
    return state.graph.nodes.map(n => {
      const m = TYPE_META[n.type] || TYPE_META.agent;
      const ex = n.expertId && MOCK.byId(MOCK.experts, n.expertId);
      let sub = '';
      if (n.type === 'agent') sub = ex ? esc(ex.role.slice(0, 16)) : '未绑定专家';
      else if (n.type === 'review') sub = n.config && n.config.rollbackTo ? '回退→' + nodeName(n.config.rollbackTo) : '未设置回退目标';
      else if (n.type === 'fanout') sub = '并发上限 ' + (n.config.maxConc || 50);
      else if (n.type === 'fanin') sub = ({ all: '全部完成', threshold: '失败阈值', sample: '抽样人工审核' })[(n.config.strategy) || 'all'];
      else if (n.type === 'confirm') sub = '等待人工批准/驳回';
      const sel = state.sel && state.sel.type === 'node' && state.sel.id === n.id;
      return '<div class="cv-node ' + m.cls + (sel ? ' sel' : '') + '" data-node="' + n.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px">' +
        '<span class="port in" data-node="' + n.id + '"></span>' +
        '<div class="n-head"><span class="e-dot" style="background:' + (ex ? ex.color : '#94a3b8') + '"></span>' + esc(n.name) + '</div>' +
        '<div class="n-sub">' + sub + '</div>' +
        (ex ? '<div class="n-expert">' + icon('user', 10) + esc(ex.name) + '</div>' : '') +
        '<span class="port out" data-node="' + n.id + '"></span>' +
        (n.type === 'review' ? '<span class="port rb" data-node="' + n.id + '" title="拖拽绘制回退边（唯一）"></span>' : '') +
        '</div>';
    }).join('');
  }

  function nodeName(id) { const n = state.graph.nodes.find(x => x.id === id); return n ? n.name : id; }

  function portPos(n, side) {
    if (side === 'out') return { x: n.x + NODE_W, y: n.y + 29 };
    if (side === 'in') return { x: n.x, y: n.y + 29 };
    return { x: n.x + NODE_W - 22, y: n.y + NODE_H }; // rb 底部
  }
  function edgeD(a, b, kind) {
    if (kind === 'rollback') {
      const s = { x: a.x + NODE_W - 22, y: a.y + NODE_H }, t = { x: b.x + NODE_W / 2, y: b.y + NODE_H };
      const sag = Math.max(70, Math.abs(s.y - t.y) * 0.2 + 60);
      return 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + sag) + ', ' + (t.x - 40) + ' ' + (t.y + sag) + ', ' + t.x + ' ' + t.y;
    }
    const s = { x: a.x + NODE_W, y: a.y + 29 }, t = { x: b.x, y: b.y + 29 };
    const dx = Math.max(40, Math.abs(t.x - s.x) / 2);
    return 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + dx) + ' ' + s.y + ', ' + (t.x - dx) + ' ' + t.y + ', ' + t.x + ' ' + t.y;
  }

  function edgesSVG() {
    const g = state.graph;
    let paths = '', labels = '';
    g.edges.forEach(e => {
      const a = g.nodes.find(n => n.id === e.from), b = g.nodes.find(n => n.id === e.to);
      if (!a || !b) return;
      const sel = state.sel && state.sel.type === 'edge' && state.sel.id === e.id;
      const cls = (e.kind === 'rollback' ? 'e-rb' : e.kind === 'par' ? 'e-par' : 'e-seq') + (sel ? ' esel' : '');
      const d = edgeD(a, b, e.kind);
      paths += '<path class="' + cls + '" d="' + d + '"/><path class="hit" data-edge="' + e.id + '" d="' + d + '"/>';
      if (e.kind === 'rollback') {
        const mid = a.x + NODE_W / 2, my = Math.max(a.y, b.y) + NODE_H + 26;
        labels += '<text class="edge-label" x="' + mid + '" y="' + my + '" text-anchor="middle">↺ 回退</text>';
      }
    });
    return '<svg class="cv-edges" width="' + g.w + '" height="' + g.h + '">' +
      '<defs><marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="#94a3b8"/></marker></defs>' +
      paths.replace(/class="e-seq"/g, 'class="e-seq" marker-end="url(#arw)"') + labels + '</svg>';
  }

  function edgeDelBtn() {
    if (!(state.sel && state.sel.type === 'edge')) return '';
    const e = state.graph.edges.find(x => x.id === state.sel.id);
    if (!e) return '';
    const a = state.graph.nodes.find(n => n.id === e.from), b = state.graph.nodes.find(n => n.id === e.to);
    if (!a || !b) return '';
    return '<div class="edge-del" id="edge-del" style="left:' + ((a.x + b.x) / 2 + 60) + 'px;top:' + ((a.y + b.y) / 2 + 66) + 'px" title="删除此边">' + icon('x', 12) + '</div>';
  }

  /* ---------------- 画布事件 ---------------- */
  function bindCanvasEvents() {
    const wrap = document.getElementById('cvWrap');
    let drag = null; // {mode:'node'|'stage'|'link'|'rblink', ...}

    document.getElementById('z-in').onclick = () => { state.zoom = Math.min(1.5, state.zoom + 0.1); paint(); };
    document.getElementById('z-out').onclick = () => { state.zoom = Math.max(0.4, state.zoom - 0.1); paint(); };
    document.getElementById('z-fit').onclick = () => {
      const g = state.graph, zK = DF.zoomK(), inherited = DF.zoomOnFixed() !== false;
      const cw = inherited ? wrap.clientWidth / zK : wrap.clientWidth;
      const ch = inherited ? wrap.clientHeight / zK : wrap.clientHeight;
      state.zoom = Math.min(1.2, Math.max(0.4, Math.min(cw / (g.w + 40), ch / (g.h + 40))));
      paint();
    };

    wrap.addEventListener('dragover', e => e.preventDefault());
    wrap.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (!type) return;
      const r = wrap.getBoundingClientRect();
      const p = toGraph(e.clientX, e.clientY);
      const x = Math.round(p.x) - NODE_W / 2;
      const y = Math.round(p.y) - 20;
      addNode(type, x, y);
    });

    wrap.addEventListener('mousedown', e => {
      const del = e.target.closest('#edge-del');
      if (del) { deleteSel(); return; }
      const port = e.target.closest('.port');
      const stageLbl = e.target.closest('.stage-label');
      const nodeEl = e.target.closest('.cv-node');
      const stageEl = e.target.closest('.cv-stage');
      if (port) {
        const nid = port.dataset.node;
        const isRb = port.classList.contains('rb');
        const n = state.graph.nodes.find(x => x.id === nid);
        drag = { mode: isRb ? 'rblink' : 'link', from: nid, sx: e.clientX, sy: e.clientY, temp: tempPath() };
        e.preventDefault();
      } else if (stageLbl) {
        const sid = stageLbl.dataset.stage;
        select({ type: 'stage', id: sid });
        drag = { mode: 'stage', id: sid, ox: e.clientX, oy: e.clientY, box: deep(state.graph.stageBoxes[sid]) };
        e.preventDefault();
      } else if (nodeEl) {
        const nid = nodeEl.dataset.node;
        select({ type: 'node', id: nid });
        const n = state.graph.nodes.find(x => x.id === nid);
        drag = { mode: 'node', id: nid, ox: e.clientX, oy: e.clientY, gx: n.x, gy: n.y, moved: false };
        e.preventDefault();
      } else if (stageEl && !e.target.closest('.cv-node')) {
        select({ type: 'stage', id: stageEl.dataset.stage });
      } else if (e.target.id === 'cvCanvas' || e.target.id === 'cvScaler' || e.target.id === 'cvWrap') {
        select(null);
      }
    });

    document.addEventListener('mousemove', e => {
      if (!drag) return;
      if (drag.mode === 'node') {
        const d = clientDelta({ x: e.clientX, y: e.clientY }, { x: drag.ox, y: drag.oy });
        const n = state.graph.nodes.find(x => x.id === drag.id);
        n.x = Math.max(0, Math.round(drag.gx + d.x));
        n.y = Math.max(0, Math.round(drag.gy + d.y));
        drag.moved = true; state.dirty = true; paintLight();
      } else if (drag.mode === 'stage') {
        const d = clientDelta({ x: e.clientX, y: e.clientY }, { x: drag.ox, y: drag.oy });
        const b = state.graph.stageBoxes[drag.id];
        b.x = Math.max(0, drag.box.x + Math.round(d.x));
        b.y = Math.max(0, drag.box.y + Math.round(d.y));
        paintLight();
      } else if (drag.mode === 'link' || drag.mode === 'rblink') {
        const g = state.graph, a = g.nodes.find(n => n.id === drag.from);
        const r = document.getElementById('cvWrap').getBoundingClientRect();
        const gx = (e.clientX - r.left + r.ownerDocument.defaultView.scrollX) / 1;
        const pt = svgPoint(e, g);
        let d;
        if (drag.mode === 'rblink') {
          const s = { x: a.x + NODE_W - 22, y: a.y + NODE_H };
          d = 'M ' + s.x + ' ' + s.y + ' C ' + (s.x + 40) + ' ' + (s.y + 80) + ', ' + (pt.x - 40) + ' ' + (pt.y + 80) + ', ' + pt.x + ' ' + pt.y;
        } else {
          const s = { x: a.x + NODE_W, y: a.y + 29 };
          d = 'M ' + s.x + ' ' + s.y + ' L ' + pt.x + ' ' + pt.y;
        }
        drag.temp.setAttribute('d', d);
        drag.temp.style.display = 'block';
      }
    });

    document.addEventListener('mouseup', e => {
      if (!drag) return;
      const d = drag; drag = null;
      const tmp = d.temp; if (tmp) tmp.remove();
      if (d.mode === 'link' || d.mode === 'rblink') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = el && el.closest ? el.closest('.cv-node') : null;
        if (!nodeEl) return;
        const to = nodeEl.dataset.node;
        if (to === d.from) return;
        if (d.mode === 'rblink') createEdge(d.from, to, 'rollback');
        else createEdge(d.from, to, state.graph.nodes.find(n => n.id === d.from).type === 'fanout' && state.graph.nodes.find(n => n.id === to).type === 'fanin' ? 'par' : 'seq');
      } else if ((d.mode === 'node' && d.moved) || d.mode === 'stage') {
        paint();
      }
    });

    document.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel &&
          !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { deleteSel(); e.preventDefault(); }
    });
    wrap.addEventListener('dblclick', e => {
      const hit = e.target.closest('path.hit');
      if (hit) { state.sel = { type: 'edge', id: hit.dataset.edge }; deleteSel(); }
    });
  }

  /* 视口坐标 → 画布图形坐标（兼容 zoom 模式与 transform 兜底模式） */
  function toGraph(clientX, clientY) {
    const wrap = document.getElementById('cvWrap');
    const r = wrap.getBoundingClientRect();
    const z = DF.zoomK() || 1, inherited = DF.zoomOnFixed() !== false;
    const vx = clientX - r.left, vy = clientY - r.top;
    const cx = inherited ? (vx + wrap.scrollLeft) / z : vx / z + wrap.scrollLeft;
    const cy = inherited ? (vy + wrap.scrollTop) / z : vy / z + wrap.scrollTop;
    return { x: cx / state.zoom, y: cy / state.zoom };
  }
  function clientDelta(a, b) { // 两视口点之间的图形坐标增量
    const p1 = toGraph(a.x, a.y), p0 = toGraph(b.x, b.y);
    return { x: p1.x - p0.x, y: p1.y - p0.y };
  }

  function svgPoint(e, g) { return toGraph(e.clientX, e.clientY); }
  function tempPath() {
    const svg = document.querySelector('#cvCanvas svg.cv-edges');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('stroke', '#2563eb'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-dasharray', '5 3');
    p.setAttribute('fill', 'none'); p.style.display = 'none';
    svg.appendChild(p); return p;
  }
  function paintLight() { paint(); }

  function select(sel) { state.sel = sel; paint(); renderInspector(); }

  function addNode(type, x, y) {
    const id = 'n' + (nodeSeq++);
    const n = { id, type, name: (TYPE_META[type] || {}).label || type, stageId: null, x: Math.max(0, x), y: Math.max(0, y) };
    if (type === 'agent') Object.assign(n, { expertId: 'e1', inheritSkills: true, skills: null, harness: { mode: 'auto', tags: [] }, config: { input: '', output: '', ctx: { knowledge: [], constraint: '', maxCtx: 32000, tools: [] } } });
    if (type === 'review') Object.assign(n, { expertId: 'e6', config: { points: '', rollbackTo: '', passNote: '通过 → 下一节点', failNote: '不通过 → 回退' } });
    if (type === 'confirm') Object.assign(n, { config: { desc: '', planPath: '', timeout: 'none', timeoutMin: 30 } });
    if (type === 'fanout') Object.assign(n, { config: { sourceNode: '', sourcePath: '', shard: '按清单项', maxConc: 50, subExpert: 'e3', subSkills: [], worktree: true } });
    if (type === 'fanin') Object.assign(n, { config: { strategy: 'all', threshold: 95, sampleCount: 20, outPath: '' } });
    if (type === 'stage') { // 添加阶段分组
      const sid = 's' + (stageSeq++);
      state.graph.stages.push({ id: sid, name: '新阶段', note: '' });
      state.graph.stageBoxes[sid] = { x: Math.max(0, x), y: Math.max(0, y), w: 460, h: 200 };
      state.graph.nodes = state.graph.nodes; // no-op 保持结构
      select({ type: 'stage', id: sid }); toast('已添加阶段分组，可拖拽标题调整位置', 'ok'); return;
    }
    state.graph.nodes.push(n);
    state.dirty = true;
    select({ type: 'node', id });
    toast('已添加 ' + TYPE_META[type].label, 'ok');
  }

  function createEdge(from, to, kind) {
    const g = state.graph;
    if (kind === 'rollback') {
      const fi = g.nodes.findIndex(n => n.id === from), ti = g.nodes.findIndex(n => n.id === to);
      if (ti >= fi) { toast('回退目标必须是当前评审节点之前的前序节点', 'err'); return; }
      const old = g.edges.find(x => x.kind === 'rollback' && x.from === from);
      if (old) {
        modal.confirm({ title: '替换回退边', message: '该评审节点已存在回退边（→ ' + nodeName(old.to) + '），替换为 → ' + nodeName(to) + ' ？', okText: '替换' }).then(ok => {
          if (!ok) return;
          g.edges.splice(g.edges.indexOf(old), 1);
          g.edges.push({ id: from + '>' + to + ':rollback', from, to, kind: 'rollback' });
          const rn = g.nodes.find(n => n.id === from); if (rn.config) rn.config.rollbackTo = to;
          state.dirty = true; paint(); renderInspector(); toast('回退边已更新', 'ok');
        });
        return;
      }
      g.edges.push({ id: from + '>' + to + ':rollback', from, to, kind: 'rollback' });
      const rn = g.nodes.find(n => n.id === from); if (rn.config) rn.config.rollbackTo = to;
      state.dirty = true; paint(); renderInspector(); toast('已绘制回退边 → ' + nodeName(to), 'ok');
      return;
    }
    const SINGLE_OUT = ['start', 'agent', 'confirm', 'fanin', 'end', 'review'];
    if (SINGLE_OUT.includes(g.nodes.find(n => n.id === from).type)) {
      const old = g.edges.find(x => x.from === from && x.kind !== 'rollback');
      if (old) {
        modal.confirm({ title: '替换连出边', message: '该节点已存在顺序出边（→ ' + nodeName(old.to) + '），每个节点仅允许一条向前的出边，替换？', okText: '替换' }).then(ok => {
          if (!ok) return;
          g.edges.splice(g.edges.indexOf(old), 1);
          g.edges.push({ id: from + '>' + to + (kind !== 'seq' ? ':' + kind : ''), from, to, kind });
          state.dirty = true; paint(); toast('连线已更新', 'ok');
        });
        return;
      }
    }
    g.edges.push({ id: from + '>' + to + (kind !== 'seq' ? ':' + kind : ''), from, to, kind });
    state.dirty = true; paint(); toast('已连线 → ' + nodeName(to), 'ok');
  }

  function deleteSel() {
    const g = state.graph, s = state.sel;
    if (!s) return;
    if (s.type === 'edge') {
      const e = g.edges.find(x => x.id === s.id);
      g.edges.splice(g.edges.indexOf(e), 1);
      toast('已删除连线', 'ok');
    } else if (s.type === 'node') {
      const n = g.nodes.find(x => x.id === s.id);
      modal.confirm({ title: '删除节点', message: '删除节点「' + esc(n.name) + '」及其所有连线？', danger: true, okText: '删除' }).then(ok => {
        if (!ok) return;
        g.nodes.splice(g.nodes.indexOf(n), 1);
        g.edges = g.edges.filter(e2 => e2.from !== n.id && e2.to !== n.id);
        state.sel = null; state.dirty = true; paint(); renderInspector(); toast('节点已删除', 'ok');
      });
      return;
    } else if (s.type === 'stage') {
      const st = g.stages.find(x => x.id === s.id);
      const cnt = g.nodes.filter(n => n.stageId === s.id).length;
      modal.confirm({ title: '删除阶段分组', message: '删除「' + esc(st.name) + '」？' + (cnt ? '组内 ' + cnt + ' 个节点将移出分组（不删除）。' : ''), danger: true, okText: '删除' }).then(ok => {
        if (!ok) return;
        g.stages.splice(g.stages.indexOf(st), 1);
        delete g.stageBoxes[st.id];
        g.nodes.forEach(n => { if (n.stageId === st.id) n.stageId = null; });
        state.sel = null; state.dirty = true; paint(); renderInspector(); toast('阶段分组已删除', 'ok');
      });
      return;
    }
    state.sel = null; state.dirty = true; paint(); renderInspector();
  }

  /* ================= 属性抽屉（选中即在右侧抽屉中编辑，画布保持全宽） ================= */
  function renderInspector() {
    const existing = document.getElementById('we-inspector');
    const s = state.sel;
    if (state.tab !== 'canvas' || !s) { if (existing) DF.drawer.close(); return; }
    let title = '', html = '', bind = null;
    if (s.type === 'edge') { title = '连线属性'; html = edgeInspector(); bind = bindEdgeInspector; }
    else if (s.type === 'stage') {
      const st = state.graph.stages.find(x => x.id === s.id);
      title = '阶段属性 · ' + (st ? st.name : '');
      html = stageInspector(); bind = bindStageInspector;
    } else {
      const n = state.graph.nodes.find(x => x.id === s.id);
      if (!n) { if (existing) DF.drawer.close(); return; }
      const M = TYPE_META[n.type] || TYPE_META.agent;
      title = M.label + '属性 · ' + n.name;
      const pair = {
        agent: [agentInspector, bindAgentInspector], review: [reviewInspector, bindReviewInspector],
        confirm: [confirmInspector, bindConfirmInspector], fanout: [fanoutInspector, bindFanoutInspector],
        fanin: [faninInspector, bindFaninInspector]
      }[n.type] || [plainInspector, bindPlainInspector];
      html = pair[0](n); bind = () => pair[1](n);
    }
    if (!existing) {
      DF.drawer.open({
        title: title,
        width: 408,
        noOverlay: true, // 不加暗遮罩：属性编辑期间画布仍可点选/拖拽（Figma 模式）
        body: '<div id="we-inspector"></div>',
        onClose: () => { // 用户手动关闭 → 同步取消画布选中
          if (state.sel) {
            state.sel = null;
            if (state.tab === 'canvas' && document.getElementById('cvCanvas')) paint();
          }
        }
      });
    } else { // 已打开 → 原地刷新标题与内容（不重建抽屉，避免闪烁）
      existing.closest('.drawer').querySelector('.d-head').firstChild.textContent = title;
    }
    document.getElementById('we-inspector').innerHTML = html;
    if (bind) bind();
  }

  const sec = (t, inner) => '<div class="insp-sec"><div class="t">' + t + '</div>' + inner + '</div>';
  const fld = (label, inner, hint) => DF.field(label, inner, { hint: hint });

  function plainInspector(n) {
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">' + (TYPE_META[n.type] || {}).cn + '</span></div>' +
      sec('基本信息', fld('名称', '<input class="inp" id="if-name" value="' + esc(n.name) + '">') + fld('说明', '<textarea class="inp" id="if-desc" placeholder="节点说明（可选）">' + esc(n.config && n.config.desc || '') + '</textarea>'));
  }
  function bindPlainInspector(n) {
    document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); };
    document.getElementById('if-desc').oninput = e => { n.config = n.config || {}; n.config.desc = e.target.value; state.dirty = true; };
  }

  function edgeInspector() {
    const e = state.graph.edges.find(x => x.id === state.sel.id);
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>连线</b> <span class="sub">' + (e.kind === 'rollback' ? '回退边' : e.kind === 'par' ? '并行边' : '顺序边') + '</span></div>' +
      sec('连线信息', '<div class="kv"><span class="k">起点</span><span>' + esc(nodeName(e.from)) + '</span><span class="k">终点</span><span>' + esc(nodeName(e.to)) + '</span></div>') +
      '<button class="btn danger" id="if-edge-del" style="width:100%">' + icon('trash', 14) + '删除此连线</button>';
  }
  function bindEdgeInspector() {
    document.getElementById('if-edge-del').onclick = deleteSel;
  }

  function stageInspector() {
    const st = state.graph.stages.find(x => x.id === state.sel.id);
    const b = state.graph.stageBoxes[st.id] || { w: 460, h: 200 };
    const cnt = state.graph.nodes.filter(n => n.stageId === st.id).length;
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(st.name) + '</b> <span class="sub">阶段分组 · 内含 ' + cnt + ' 个节点</span></div>' +
      sec('阶段信息', fld('阶段名称', '<input class="inp" id="if-sname" value="' + esc(st.name) + '">') +
        fld('准出说明', '<textarea class="inp" id="if-snote">' + esc(st.note || '') + '</textarea>', '阶段准出标准，展示在分组标签上')) +
      sec('尺寸', '<div class="grid2">' + fld('宽', '<input class="inp" id="if-sw" type="number" value="' + b.w + '">') + fld('高', '<input class="inp" id="if-sh" type="number" value="' + b.h + '">') + '</div>') +
      '<button class="btn danger" id="if-sdel" style="width:100%">' + icon('trash', 14) + '删除阶段分组</button>';
  }
  function bindStageInspector() {
    const st = state.graph.stages.find(x => x.id === state.sel.id);
    if (!state.graph.stageBoxes[st.id]) state.graph.stageBoxes[st.id] = { x: 40, y: 40, w: 460, h: 200 };
    document.getElementById('if-sname').oninput = e => { st.name = e.target.value; state.dirty = true; paintLight(); };
    document.getElementById('if-snote').oninput = e => { st.note = e.target.value; state.dirty = true; paintLight(); };
    document.getElementById('if-sw').oninput = e => { state.graph.stageBoxes[st.id].w = +e.target.value || 400; state.dirty = true; paintLight(); };
    document.getElementById('if-sh').oninput = e => { state.graph.stageBoxes[st.id].h = +e.target.value || 200; state.dirty = true; paintLight(); };
    document.getElementById('if-sdel').onclick = deleteSel;
  }

  /* ---- 专家执行节点 ---- */
  function agentInspector(n) {
    const ex = MOCK.byId(MOCK.experts, n.expertId);
    const allTags = [...new Set(MOCK.harnesses.flatMap(h => h.tags))];
    const cfg = n.config;
    const skillIds = n.inheritSkills ? (ex ? ex.skills : []) : (n.skills || []);
    const kb = (cfg.ctx.knowledge || [])[0] || '';
    const doms = MOCK.knowledgeTree;
    const cur = kb.split('/');
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">专家执行节点</span></div>' +
      sec('基本信息', fld('名称', '<input class="inp" id="if-name" value="' + esc(n.name) + '">')) +
      sec('专家与技能',
        fld('绑定专家', '<select class="inp" id="if-expert">' + MOCK.experts.map(x => '<option value="' + x.id + '"' + (x.id === n.expertId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>', ex ? esc(ex.role) : '') +
        fld('Skill 组合', '<label style="font-weight:400;font-size:12px"><input type="checkbox" id="if-inherit"' + (n.inheritSkills ? ' checked' : '') + '> 继承专家的技能组合</label><div class="chips" id="if-skills" style="margin-top:8px">' +
          skillIds.map(sid => { const sk2 = MOCK.byId(MOCK.skills, sid); return sk2 ? '<span class="chip">' + esc(sk2.name) + (n.inheritSkills ? '' : '<i class="x" data-id="' + sid + '">✕</i>') + '</span>' : ''; }).join('') +
          (n.inheritSkills ? '' : '<select class="inp inp-sm" id="if-skill-add" style="width:auto"><option value="">+ 添加…</option>' + MOCK.skills.filter(s2 => !skillIds.includes(s2.id)).map(s2 => '<option value="' + s2.id + '">' + esc(s2.name) + '</option>').join('') + '</select>') + '</div>', '继承开=跟随专家配置；关=本节点自定义')) +
      sec('执行配置',
        fld('Harness 分配', '<label style="font-weight:400;font-size:12px;display:block"><input type="radio" name="hmode" value="auto"' + (!n.harness || n.harness.mode === 'auto' ? ' checked' : '') + '> 按标签自动分配</label>' +
          '<div class="chips" id="if-htags" style="margin:6px 0 10px">' + allTags.map(t2 => '<span class="chip click' + (n.harness && n.harness.mode === 'auto' && (n.harness.tags || []).includes(t2) ? '" style="background:#dbeafe;color:#1d4ed8' : '') + '" data-tag="' + t2 + '">' + t2 + '</span>').join('') + '</div>' +
          '<label style="font-weight:400;font-size:12px;display:block"><input type="radio" name="hmode" value="manual"' + (n.harness && n.harness.mode === 'manual' ? ' checked' : '') + '> 手动指定</label>' +
          '<select class="inp" id="if-hselect"' + (!n.harness || n.harness.mode !== 'manual' ? ' disabled' : '') + '>' + MOCK.harnesses.map(h => '<option value="' + h.id + '"' + (n.harness && n.harness.id === h.id ? ' selected' : '') + '>' + esc(h.name) + '（' + h.type + '）</option>').join('') + '</select>') +
        fld('输入说明', '<textarea class="inp" id="if-input" placeholder="从工作区读取哪些路径">' + esc(cfg.input || '') + '</textarea>') +
        fld('输出约定', '<textarea class="inp" id="if-output" placeholder="写入哪些路径 / 产物">' + esc(cfg.output || '') + '</textarea>')) +
      sec('上下文与收敛',
        fld('知识索引注入', '<div class="grid2"><select class="inp" id="if-kb-dom">' + doms.map(d => '<option' + (cur[0] === d.domain ? ' selected' : '') + '>' + esc(d.domain) + '</option>').join('') + '</select>' +
          '<select class="inp" id="if-kb-stream"></select></div>' +
          '<select class="inp" id="if-kb-scene" style="margin-top:6px"></select>' +
          '<div id="if-kb-entries" style="margin-top:6px"></div>' +
          '<input class="inp" id="if-svo" placeholder="SVO 事实锚（可选）" value="' + esc(cfg.ctx.svo || '') + '" style="margin-top:6px">', '按 业务域→价值流→场景→代码入口 注入，防止大海捞针') +
        fld('收敛约束', '<textarea class="inp" id="if-constraint" placeholder="格式规范 / 禁令等">' + esc(cfg.ctx.constraint || '') + '</textarea>') +
        fld('上下文上限（token）', '<input class="inp" id="if-maxctx" type="number" value="' + (cfg.ctx.maxCtx || 32000) + '">') +
        fld('工具使用权限', '<div class="chips" id="if-tools">' + (cfg.ctx.tools || []).map(tid => { const t2 = MOCK.byId(MOCK.tools, tid); return t2 ? '<span class="chip">' + esc(t2.name) + '<i class="x" data-id="' + tid + '">✕</i></span>' : ''; }).join('') + '</div><div class="chip-add"><select class="inp inp-sm" id="if-tool-add" style="width:auto"><option value="">+ 添加工具…</option>' + MOCK.tools.filter(t2 => !(cfg.ctx.tools || []).includes(t2.id)).map(t2 => '<option value="' + t2.id + '">' + esc(t2.name) + '</option>').join('') + '</select></div>', '限定本节点可调用的 MCP/CLI 工具')) +
      '<button class="btn danger" id="if-ndel" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
  }
  function bindAgentInspector(n) {
    const cfg = n.config;
    const cur = ((cfg.ctx.knowledge || [])[0] || '').split('/'); // 当前知识注入路径（agentInspector 内 cur 的本函数作用域副本）
    document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); };
    document.getElementById('if-expert').onchange = e => { n.expertId = e.target.value; n.inheritSkills = true; n.skills = null; state.dirty = true; paintLight(); renderInspector(); };
    document.getElementById('if-inherit').onchange = e => {
      n.inheritSkills = e.target.checked;
      if (!n.inheritSkills) { const ex = MOCK.byId(MOCK.experts, n.expertId); n.skills = deep(ex ? ex.skills : []); }
      state.dirty = true; renderInspector();
    };
    const skillAdd = document.getElementById('if-skill-add');
    if (skillAdd) skillAdd.onchange = e => { if (e.target.value) { n.skills.push(e.target.value); state.dirty = true; renderInspector(); } };
    document.querySelectorAll('#if-skills .x').forEach(x => x.onclick = () => { n.skills = n.skills.filter(s2 => s2 !== x.dataset.id); state.dirty = true; renderInspector(); });
    document.querySelectorAll('input[name=hmode]').forEach(r => r.onchange = e => {
      n.harness = n.harness || {};
      if (e.target.value === 'auto') { n.harness = { mode: 'auto', tags: n.harness.tags || [] }; }
      else { n.harness = { mode: 'manual', id: (MOCK.harnesses[0] || {}).id }; }
      state.dirty = true; renderInspector();
    });
    document.querySelectorAll('#if-htags .chip').forEach(c => c.onclick = () => {
      if (!n.harness || n.harness.mode !== 'auto') return;
      const t2 = c.dataset.tag; n.harness.tags = n.harness.tags || [];
      n.harness.tags = n.harness.tags.includes(t2) ? n.harness.tags.filter(x => x !== t2) : n.harness.tags.concat(t2);
      state.dirty = true; renderInspector();
    });
    const hsel = document.getElementById('if-hselect');
    if (hsel) hsel.onchange = e => { n.harness.id = e.target.value; state.dirty = true; };
    document.getElementById('if-input').oninput = e => { cfg.input = e.target.value; state.dirty = true; };
    document.getElementById('if-output').oninput = e => { cfg.output = e.target.value; state.dirty = true; };
    // 知识索引级联
    const doms = MOCK.knowledgeTree;
    const domSel = document.getElementById('if-kb-dom'), stmSel = document.getElementById('if-kb-stream'), scSel = document.getElementById('if-kb-scene'), entBox = document.getElementById('if-kb-entries');
    function fillStreams() {
      const d = doms.find(x => x.domain === domSel.value) || doms[0];
      stmSel.innerHTML = d.streams.map(s2 => '<option' + (cur[1] === s2.name ? ' selected' : '') + '>' + esc(s2.name) + '</option>').join('');
      fillScenes();
    }
    function fillScenes() {
      const d = doms.find(x => x.domain === domSel.value) || doms[0];
      const st2 = d.streams.find(s2 => s2.name === stmSel.value) || d.streams[0];
      scSel.innerHTML = st2.scenes.map(s2 => '<option' + (cur[2] === s2.name ? ' selected' : '') + '>' + esc(s2.name) + '</option>').join('');
      fillEntries();
    }
    function fillEntries() {
      const d = doms.find(x => x.domain === domSel.value) || doms[0];
      const st2 = d.streams.find(s2 => s2.name === stmSel.value) || d.streams[0];
      const sc = st2.scenes.find(s2 => s2.name === scSel.value) || st2.scenes[0];
      entBox.innerHTML = sc.entries.map(en => '<label style="font-size:12px;display:block"><input type="checkbox" value="' + esc(en) + '"' + ((cfg.ctx.knowledge || []).includes(d.domain + '/' + st2.name + '/' + sc.name + '/' + en) ? ' checked' : '') + '> ' + esc(en) + '</label>').join('');
      entBox.querySelectorAll('input').forEach(cb => cb.onchange = () => {
        const path = d.domain + '/' + st2.name + '/' + sc.name + '/' + cb.value;
        cfg.ctx.knowledge = cfg.ctx.knowledge || [];
        if (cb.checked) { cfg.ctx.knowledge = [path]; } else { cfg.ctx.knowledge = []; }
        state.dirty = true;
      });
    }
    domSel.onchange = () => { cur[0] = domSel.value; fillStreams(); };
    stmSel.onchange = () => { fillScenes(); };
    scSel.onchange = () => { fillEntries(); };
    fillStreams();
    document.getElementById('if-svo').oninput = e => { cfg.ctx.svo = e.target.value; state.dirty = true; };
    document.getElementById('if-constraint').oninput = e => { cfg.ctx.constraint = e.target.value; state.dirty = true; };
    document.getElementById('if-maxctx').oninput = e => { cfg.ctx.maxCtx = +e.target.value || 32000; state.dirty = true; };
    const toolAdd = document.getElementById('if-tool-add');
    if (toolAdd) toolAdd.onchange = e => { if (e.target.value) { cfg.ctx.tools = cfg.ctx.tools || []; cfg.ctx.tools.push(e.target.value); state.dirty = true; renderInspector(); } };
    document.querySelectorAll('#if-tools .x').forEach(x => x.onclick = () => { cfg.ctx.tools = cfg.ctx.tools.filter(t2 => t2 !== x.dataset.id); state.dirty = true; renderInspector(); });
    document.getElementById('if-ndel').onclick = deleteSel;
  }

  /* ---- 评审节点 ---- */
  function reviewInspector(n) {
    const idx = state.graph.nodes.findIndex(x => x.id === n.id);
    const earlier = state.graph.nodes.slice(0, idx);
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">评审/校验节点 · 独立否决视角</span></div>' +
      sec('评审配置',
        fld('评审专家', '<select class="inp" id="if-expert">' + MOCK.experts.map(x => '<option value="' + x.id + '"' + (x.id === n.expertId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>', '建议选择具备「独立、否决视角」的专家') +
        fld('评审要点', '<textarea class="inp" id="if-points">' + esc(n.config.points || '') + '</textarea>') +
        fld('回退目标节点（唯一）', '<select class="inp" id="if-rb"><option value="">未设置</option>' + earlier.map(x => '<option value="' + x.id + '"' + (n.config.rollbackTo === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>', '不通过时携带评审意见回退到此节点重跑；也可从节点下方紫色端口拖拽绘制') +
        fld('通过说明', '<input class="inp" id="if-pass" value="' + esc(n.config.passNote || '') + '">') +
        fld('不通过说明', '<input class="inp" id="if-fail" value="' + esc(n.config.failNote || '') + '">')) +
      '<button class="btn danger" id="if-ndel" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
  }
  function bindReviewInspector(n) {
    document.getElementById('if-name') && (document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); });
    document.getElementById('if-expert').onchange = e => { n.expertId = e.target.value; state.dirty = true; paintLight(); };
    document.getElementById('if-points').oninput = e => { n.config.points = e.target.value; state.dirty = true; };
    document.getElementById('if-rb').onchange = e => {
      const v = e.target.value; n.config.rollbackTo = v; state.dirty = true;
      if (v) {
        const old = state.graph.edges.find(x => x.kind === 'rollback' && x.from === n.id);
        if (old) state.graph.edges.splice(state.graph.edges.indexOf(old), 1);
        state.graph.edges.push({ id: n.id + '>' + v + ':rollback', from: n.id, to: v, kind: 'rollback' });
      } else {
        state.graph.edges = state.graph.edges.filter(x => !(x.kind === 'rollback' && x.from === n.id));
      }
      paint(); toast(v ? '回退目标已设置 → ' + nodeName(v) : '已清除回退目标', 'ok');
    };
    document.getElementById('if-pass').oninput = e => { n.config.passNote = e.target.value; state.dirty = true; };
    document.getElementById('if-fail').oninput = e => { n.config.failNote = e.target.value; state.dirty = true; };
    document.getElementById('if-ndel').onclick = deleteSel;
  }

  /* ---- 人工确认节点 ---- */
  function confirmInspector(n) {
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">人工确认节点</span></div>' +
      sec('确认配置',
        fld('确认事项说明', '<textarea class="inp" id="if-desc">' + esc(n.config.desc || '') + '</textarea>', '人工在实例详情中查看方案并批准/驳回') +
        fld('方案模板路径', '<input class="inp mono" id="if-plan" value="' + esc(n.config.planPath || '') + '">', 'Agent 先将方案写入该 workspace 路径')) +
      sec('超时策略', '<select class="inp" id="if-timeout"><option value="none"' + (n.config.timeout === 'none' ? ' selected' : '') + '>不超时</option><option value="remind"' + (n.config.timeout === 'remind' ? ' selected' : '') + '>超时提醒</option><option value="terminate"' + (n.config.timeout === 'terminate' ? ' selected' : '') + '>超时自动终止</option></select>' +
        (n.config.timeout !== 'none' ? fld('超时时长（小时）', '<input class="inp" id="if-tmin" type="number" value="' + (n.config.timeoutMin || 24) + '">') : '')) +
      '<button class="btn danger" id="if-ndel" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
  }
  function bindConfirmInspector(n) {
    document.getElementById('if-name') && (document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); });
    document.getElementById('if-desc').oninput = e => { n.config.desc = e.target.value; state.dirty = true; };
    document.getElementById('if-plan').oninput = e => { n.config.planPath = e.target.value; state.dirty = true; };
    document.getElementById('if-timeout').onchange = e => { n.config.timeout = e.target.value; state.dirty = true; renderInspector(); };
    const tm = document.getElementById('if-tmin'); if (tm) tm.oninput = e => { n.config.timeoutMin = +e.target.value; state.dirty = true; };
    document.getElementById('if-ndel').onclick = deleteSel;
  }

  /* ---- fan-out / fan-in ---- */
  function fanoutInspector(n) {
    const idx = state.graph.nodes.findIndex(x => x.id === n.id);
    const earlier = state.graph.nodes.slice(0, idx);
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">fan-out 网关 · 清单驱动并行</span></div>' +
      sec('任务清单来源',
        fld('上游节点', '<select class="inp" id="if-srcn"><option value="">未设置</option>' + earlier.map(x => '<option value="' + x.id + '"' + (n.config.sourceNode === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>') +
        fld('清单产物路径', '<input class="inp mono" id="if-srcp" value="' + esc(n.config.sourcePath || '') + '">', '上游节点写入 workspace 的任务清单文件')) +
      sec('调度',
        '<div class="grid2">' + fld('分片规则', '<select class="inp" id="if-shard"><option' + (n.config.shard === '按清单项' ? ' selected' : '') + '>按清单项</option><option' + (n.config.shard === '按模块' ? ' selected' : '') + '>按模块</option><option' + (n.config.shard === '按文件' ? ' selected' : '') + '>按文件</option></select>') +
        fld('并发上限', '<input class="inp" id="if-conc" type="number" value="' + (n.config.maxConc || 50) + '">') + '</div>' +
        fld('子任务执行专家', '<select class="inp" id="if-subex">' + MOCK.experts.map(x => '<option value="' + x.id + '"' + (n.config.subExpert === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>') +
        fld('子任务 Skill', '<div class="chips" id="if-subskills">' + (n.config.subSkills || []).map(sid => { const s2 = MOCK.byId(MOCK.skills, sid); return s2 ? '<span class="chip">' + esc(s2.name) + '<i class="x" data-id="' + sid + '">✕</i></span>' : ''; }).join('') + '</div><div class="chip-add"><select class="inp inp-sm" id="if-subskill-add" style="width:auto"><option value="">+ 添加…</option>' + MOCK.skills.filter(s2 => !(n.config.subSkills || []).includes(s2.id)).map(s2 => '<option value="' + s2.id + '">' + esc(s2.name) + '</option>').join('') + '</select></div>') +
        '<label style="font-size:12px;font-weight:400"><input type="checkbox" id="if-wt"' + (n.config.worktree ? ' checked' : '') + '> 每个子任务使用独立 worktree（上下文隔离）</label>') +
      '<button class="btn danger" id="if-ndel" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
  }
  function bindFanoutInspector(n) {
    document.getElementById('if-name') && (document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); });
    document.getElementById('if-srcn').onchange = e => { n.config.sourceNode = e.target.value; state.dirty = true; };
    document.getElementById('if-srcp').oninput = e => { n.config.sourcePath = e.target.value; state.dirty = true; };
    document.getElementById('if-shard').onchange = e => { n.config.shard = e.target.value; state.dirty = true; };
    document.getElementById('if-conc').oninput = e => { n.config.maxConc = +e.target.value || 50; state.dirty = true; paintLight(); };
    document.getElementById('if-subex').onchange = e => { n.config.subExpert = e.target.value; state.dirty = true; };
    const add = document.getElementById('if-subskill-add');
    if (add) add.onchange = e => { if (e.target.value) { n.config.subSkills.push(e.target.value); state.dirty = true; renderInspector(); } };
    document.querySelectorAll('#if-subskills .x').forEach(x => x.onclick = () => { n.config.subSkills = n.config.subSkills.filter(s2 => s2 !== x.dataset.id); state.dirty = true; renderInspector(); });
    document.getElementById('if-wt').onchange = e => { n.config.worktree = e.target.checked; state.dirty = true; };
    document.getElementById('if-ndel').onclick = deleteSel;
  }

  function faninInspector(n) {
    const st = n.config.strategy || 'all';
    return '<div class="card" style="padding:14px;margin-bottom:12px"><b>' + esc(n.name) + '</b> <span class="sub">fan-in 网关 · 聚合</span></div>' +
      sec('聚合策略',
        '<label style="display:block;font-size:12px;font-weight:400;margin-bottom:6px"><input type="radio" name="fstrat" value="all"' + (st === 'all' ? ' checked' : '') + '> 全部完成</label>' +
        '<label style="display:block;font-size:12px;font-weight:400;margin-bottom:6px"><input type="radio" name="fstrat" value="threshold"' + (st === 'threshold' ? ' checked' : '') + '> 失败阈值（失败率低于阈值即聚合）</label>' +
        (st === 'threshold' ? '<div style="margin:0 0 8px 20px">' + fld('阈值（%）', '<input class="inp" id="if-th" type="number" value="' + (n.config.threshold || 95) + '" style="width:120px">') + '</div>' : '') +
        '<label style="display:block;font-size:12px;font-weight:400;margin-bottom:6px"><input type="radio" name="fstrat" value="sample"' + (st === 'sample' ? ' checked' : '') + '> 抽样人工审核</label>' +
        (st === 'sample' ? '<div style="margin:0 0 8px 20px">' + fld('抽样数', '<input class="inp" id="if-sc" type="number" value="' + (n.config.sampleCount || 20) + '" style="width:120px">') + '</div>' : '')) +
      sec('汇聚产物', fld('写入路径', '<input class="inp mono" id="if-out" value="' + esc(n.config.outPath || '') + '">')) +
      '<button class="btn danger" id="if-ndel" style="width:100%">' + icon('trash', 14) + '删除节点</button>';
  }
  function bindFaninInspector(n) {
    document.getElementById('if-name') && (document.getElementById('if-name').oninput = e => { n.name = e.target.value; state.dirty = true; paintLight(); });
    document.querySelectorAll('input[name=fstrat]').forEach(r => r.onchange = e => { n.config.strategy = e.target.value; state.dirty = true; renderInspector(); });
    const th = document.getElementById('if-th'); if (th) th.oninput = e => { n.config.threshold = +e.target.value; state.dirty = true; };
    const sc = document.getElementById('if-sc'); if (sc) sc.oninput = e => { n.config.sampleCount = +e.target.value; state.dirty = true; };
    document.getElementById('if-out').oninput = e => { n.config.outPath = e.target.value; state.dirty = true; };
    document.getElementById('if-ndel').onclick = deleteSel;
  }

  /* ================= 校验 / 保存 / 发布 / 运行 ================= */
  function validateGraph() {
    const g = state.graph, issues = [];
    if (!g.nodes.some(n => n.type === 'start')) issues.push({ lv: 'err', msg: '缺少「开始」节点' });
    if (!g.nodes.some(n => n.type === 'end')) issues.push({ msg: '缺少「结束」节点', lv: 'err' });
    g.nodes.forEach(n => {
      const linked = g.edges.some(e => e.from === n.id || e.to === n.id);
      if (!linked && n.type !== 'start' && n.type !== 'end') issues.push({ lv: 'warn', msg: '孤立节点「' + n.name + '」未连线', node: n.id });
      if (n.type === 'agent' && !n.expertId) issues.push({ lv: 'err', msg: '专家节点「' + n.name + '」未绑定专家', node: n.id });
      if (n.type === 'review') {
        if (!n.config.rollbackTo) issues.push({ lv: 'err', msg: '评审节点「' + n.name + '」未设置回退目标', node: n.id });
        else { const fi = g.nodes.findIndex(x => x.id === n.id), ti = g.nodes.findIndex(x => x.id === n.config.rollbackTo); if (ti >= fi) issues.push({ lv: 'err', msg: '评审节点「' + n.name + '」回退目标不是前序节点', node: n.id }); }
      }
      if (n.type === 'fanout' && !n.config.sourceNode) issues.push({ lv: 'err', msg: 'fan-out「' + n.name + '」未设置任务清单来源', node: n.id });
      const outN = g.edges.filter(e => e.from === n.id && e.kind !== 'rollback').length;
      if (['start', 'agent', 'confirm', 'fanin', 'end', 'review'].includes(n.type) && outN > 1) issues.push({ lv: 'err', msg: '「' + n.name + '」存在多条向前出边', node: n.id });
    });
    return issues;
  }
  function showValidate() {
    const issues = validateGraph();
    modal.open({
      title: '流程校验',
      width: 520,
      body: issues.length
        ? issues.map(i => '<div class="' + (i.lv === 'err' ? 'pitfall' : 'warn-box') + '" style="cursor:pointer;margin-bottom:8px" data-node="' + (i.node || '') + '">' + (i.lv === 'err' ? '✕ ' : '⚠ ') + esc(i.msg) + '</div>').join('')
        : '<div style="text-align:center;padding:20px;color:var(--c-ok)">' + icon('check', 28) + '<div style="margin-top:8px">校验通过，可以发布运行</div></div>',
      onMount(b) {
        b.querySelectorAll('[data-node]').forEach(el => el.onclick = () => {
          if (!el.dataset.node) return;
          modal.close(); state.tab = 'canvas';
          document.querySelectorAll('#we-tab button').forEach(x => x.classList.toggle('on', x.dataset.t === 'canvas'));
          renderMainTab();
          select({ type: 'node', id: el.dataset.node });
        });
      }
    });
  }
  function save() {
    state.wf.graph = deep(state.graph);
    state.wf.name = document.getElementById('we-name').value || state.wf.name;
    state.wf.nodeCount = state.graph.nodes.filter(n => n.type !== 'stage').length;
    state.wf.stageCount = state.graph.stages.length;
    state.dirty = false;
    toast('已保存', 'ok');
  }
  function publish() {
    const issues = validateGraph().filter(i => i.lv === 'err');
    if (issues.length) { toast('存在 ' + issues.length + ' 个校验错误，无法发布', 'err'); showValidate(); return; }
    modal.confirm({ title: '发布工作流', message: '发布后工作流可被发起运行。当前版本 ' + esc(state.wf.ver) + ' 将升级为次版本 +0.1。', okText: '发布' }).then(ok => {
      if (!ok) return;
      save();
      state.wf.published = true;
      const m2 = /v(\d+)\.(\d+)/.exec(state.wf.ver);
      if (m2) state.wf.ver = 'v' + m2[1] + '.' + (+m2[2] + 1);
      document.querySelector('.page-header .acts .mono').textContent = state.wf.ver;
      const btnRun = document.getElementById('we-run'); btnRun.disabled = false; btnRun.title = '';
      const tags = document.querySelectorAll('.page-header .acts .tag'); if (tags[0]) tags[0].outerHTML = tag('已发布');
      toast('已发布 ' + state.wf.ver, 'ok');
    });
  }
  function runFlow() {
    if (!state.wf.published) { toast('草稿不可运行，请先发布', 'warn'); return; }
    const wsList = MOCK.workspaces.filter(w => w.status === '已初始化');
    modal.form({
      title: '发起运行 · ' + state.wf.name,
      width: 460,
      okText: '发起运行',
      body: '<div class="field"><label>工作流</label><input class="inp" value="' + esc(state.wf.name + ' · ' + state.wf.ver) + '" disabled></div>' +
        '<div class="field"><label>工作区 <span class="req">*</span></label><select class="inp" id="ru-ws">' + wsList.map(w => '<option value="' + w.id + '">' + esc(w.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>备注</label><textarea class="inp" id="ru-note" placeholder="可选"></textarea></div>',
      onOk(b, close) {
        close(); toast('已发起运行', 'ok');
        setTimeout(() => { location.href = 'instances.html'; }, 500);
      }
    });
  }

  /* ================= DSL ================= */
  function payload() {
    const g = state.graph;
    return {
      name: document.getElementById('we-name') ? document.getElementById('we-name').value : state.wf.name,
      version: state.wf.ver, published: state.wf.published,
      stages: g.stages.map(s2 => ({ id: s2.id, name: s2.name, note: s2.note })),
      nodes: g.nodes.map(n => ({ id: n.id, type: n.type, name: n.name, expert: n.expertId || undefined, config: n.config || undefined })),
      edges: g.edges.map(e2 => ({ from: e2.from, to: e2.to, kind: e2.kind }))
    };
  }
  function toYAML(o, ind) {
    ind = ind || 0; const pad = '  '.repeat(ind);
    if (o === null || o === undefined) return 'null';
    if (Array.isArray(o)) return o.length ? o.map(v => '\n' + pad + '- ' + toYAML(v, ind + 1).trimStart()).join('').replace(/\n\s*\n/g, '\n') : ' []';
    if (typeof o === 'object') {
      const ks = Object.keys(o).filter(k => o[k] !== undefined);
      return ks.length ? ks.map((k, i) => (i ? '\n' + pad : '') + k + ': ' + (needBlock(o[k]) ? '\n' + toYAML(o[k], ind + 1) : toYAML(o[k], ind))).join('') : ' {}';
    }
    if (typeof o === 'string') return (/[:#\-\n]/.test(o) || o === '' ? '"' + o.replace(/"/g, '\\"') + '"' : o);
    return String(o);
    function needBlock(v) { return v && typeof v === 'object'; }
  }
  function renderDSL() {
    const main = document.getElementById('we-main');
    const p = payload();
    const text = state.dslFmt === 'json' ? JSON.stringify(p, null, 2) : toYAML(p);
    main.innerHTML = '<div class="card" style="flex:1;display:flex;flex-direction:column;overflow:hidden">' +
      '<div class="card-h">DSL 结构预览（只读）<span class="sp" style="flex:1"></span>' +
      '<div class="seg" id="dsl-fmt"><button data-f="json" class="' + (state.dslFmt === 'json' ? 'on' : '') + '">JSON</button><button data-f="yaml" class="' + (state.dslFmt === 'yaml' ? 'on' : '') + '">YAML</button></div>' +
      '<button class="btn sm" id="dsl-copy">' + icon('copy', 12) + '复制</button>' +
      '<button class="btn sm" id="dsl-dl">' + icon('download', 12) + '导出</button></div>' +
      '<div style="flex:1;overflow:auto"><div class="code-block" style="border:none;border-radius:0;max-height:none;height:100%">' + esc(text) + '</div></div></div>';
    document.getElementById('dsl-fmt').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      state.dslFmt = b.dataset.f;
      document.querySelectorAll('#dsl-fmt button').forEach(x => x.classList.toggle('on', x === b));
      renderDSL();
    };
    document.getElementById('dsl-copy').onclick = () => DF.copyText(text);
    document.getElementById('dsl-dl').onclick = () => {
      DF.download((p.name || 'workflow') + '.' + state.dslFmt, text,
        state.dslFmt === 'json' ? 'application/json' : 'text/yaml');
      toast('已导出', 'ok');
    };
  }

  init();
})();
