/* 效能看板 · 交付价值与运行健康（KPI 指标卡 + 趋势图 + 准出记录汇总 + Skill 审计） */

import { DF } from '../ui.js';
import { MOCK } from '../mock-data.js';


  const A = MOCK.analytics;
  const PAGE_SIZE = 5;
  const VERDICT_COLOR = { '通过': 'green', '回退': 'purple', '驳回': 'red', '不通过': 'red' };
  const ISSUE_COLOR = { '被跳过': 'orange', '自我冲突': 'red', '老化': 'purple' };

  const state = { n: 8, page: 0 };

  /* ---------- 外壳 ---------- */
  DF.renderShell({
      pendingCount: (MOCK.instances || []).filter(i => i.status === '等待人工确认').length,
    active: 'analytics',
    breadcrumb: [{ label: '运行与运营' }, { label: '效能看板' }],
    title: '效能看板',
    subtitle: '交付价值与运行健康',
    actions:
      '时间范围 <select class="inp inp-sm" id="an-range">' +
        '<option value="4">近 4 周</option>' +
        '<option value="8" selected>近 8 周</option>' +
        '<option value="12" disabled title="数据积累中">近 12 周（数据积累中）</option>' +
      '</select> <span class="sub">更新于 10:15</span>'
  });
  const body = document.getElementById('page-body');

  /* ---------- 工具 ---------- */
  function tail(arr, n) { return (arr || []).slice(Math.max(0, arr.length - n)); }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // 环比：最后一项相对前一项的百分比变化
  function deltaPct(arr) {
    if (!arr || arr.length < 2 || !arr[arr.length - 2]) return null;
    const last = arr[arr.length - 1], prev = arr[arr.length - 2];
    return Math.round((last - prev) / prev * 100);
  }
  function fmtDelta(d) { return d == null ? '环比 —' : '环比 ' + (d > 0 ? '+' : '') + d + '%'; }

  /* ---------- SVG：迷你趋势线（120x36，手写 polyline，仅末点圆点） ---------- */
  function miniTrend(vals, color) {
    const w = 120, h = 36, pad = 3;
    if (!vals || vals.length < 2) return '<svg class="mini-trend" width="' + w + '" height="' + h + '"></svg>';
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const span = (max - min) || 1;
    const pts = vals.map(function (v, i) {
      const x = pad + i * (w - pad * 2) / (vals.length - 1);
      const y = h - pad - (v - min) * (h - pad * 2) / span;
      return Math.round(x * 10) / 10 + ',' + Math.round(y * 10) / 10;
    });
    const last = pts[pts.length - 1].split(',');
    return '<svg class="mini-trend" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="' + color + '"/>' +
    '</svg>';
  }

  /* ---------- SVG：交付趋势双线（viewBox 640x220，网格 4 横线 + 每点 circle + 末点数值 + 周标签） ---------- */
  function bigTrend(weeks, tp, dr) {
    const W = 640, H = 220, L = 44, R = 54, T = 18, B = 30;
    const iw = W - L - R, ih = H - T - B;
    const n = weeks.length;
    if (n < 2) return '<div class="empty">数据积累中</div>';
    const x = function (i) { return +(L + i * iw / (n - 1)).toFixed(1); };
    function sy(vals) {
      const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
      if (max === min) return function () { return T + ih / 2; };
      return function (v) { return +(T + ih - (v - min) / (max - min) * ih).toFixed(1); };
    }
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block" role="img" aria-label="吞吐率与缺陷率趋势">';
    for (let g = 0; g < 4; g++) {
      const gy = +(T + ih * g / 3).toFixed(1);
      s += '<line x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '" stroke="#e8edf3" stroke-width="1"/>';
    }
    [{ vals: tp, y: sy(tp), color: '#2563eb', label: '吞吐率', unit: '' },
     { vals: dr, y: sy(dr), color: '#dc2626', label: '缺陷率', unit: '%' }].forEach(function (ser) {
      const pts = ser.vals.map(function (v, i) { return x(i) + ',' + ser.y(v); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + ser.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      ser.vals.forEach(function (v, i) {
        s += '<circle cx="' + x(i) + '" cy="' + ser.y(v) + '" r="3" fill="#fff" stroke="' + ser.color + '" stroke-width="2">' +
          '<title>' + DF.esc(weeks[i] + ' ' + ser.label + ' ' + v + ser.unit) + '</title></circle>';
      });
      const li = n - 1;
      s += '<text x="' + (x(li) + 7) + '" y="' + (ser.y(ser.vals[li]) + 4) + '" font-size="11" font-weight="600" fill="' + ser.color + '">' +
        ser.vals[li] + ser.unit + '</text>';
    });
    weeks.forEach(function (wk, i) {
      s += '<text x="' + x(i) + '" y="' + (H - 8) + '" font-size="10" fill="#98a2b3" text-anchor="middle">' + DF.esc(wk) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------- 指标卡 ×5 ---------- */
  function statCards() {
    const tp = tail(A.throughput, state.n), dr = tail(A.defectRate, state.n);
    const tpD = deltaPct(tp), drD = deltaPct(dr);
    // 吞吐率：升=利好，箭头随数值、颜色随利好
    const tpCls = tpD == null || tpD === 0 ? 'an-muted' : (tpD > 0 ? 'up' : 'down');
    const tpArrow = tpD == null ? '' : (tpD > 0 ? '↗ ' : (tpD < 0 ? '↘ ' : '→ '));
    // 缺陷率：箭头按数值升降，颜色按利好（降=绿 up，升=红 down）
    const drCls = drD == null || drD === 0 ? 'an-muted' : (drD < 0 ? 'up' : 'down');
    const drArrow = drD == null ? '' : (drD < 0 ? '↘ ' : (drD > 0 ? '↗ ' : '→ '));
    const tpLast = tp[tp.length - 1], drLast = dr[dr.length - 1];

    return DF.statRow([
      DF.statCard({ k: '需求吞吐率', v: tpLast + ' <small>需求/周</small>',
        d: tpArrow + fmtDelta(tpD), dCls: tpCls, dFlex: true, side: miniTrend(tp, '#2563eb') }),
      DF.statCard({ k: '现场缺陷率', v: drLast + '%',
        d: drArrow + fmtDelta(drD), dCls: drCls, dFlex: true, side: miniTrend(dr, '#dc2626') }),
      DF.statCard({ k: '实例成功率与平均耗时', v: A.successRate + '% <small>· 均 ' + DF.fmtDur(A.avgDurationS) + '</small>',
        d: '滚动统计 · 全部运行实例', dCls: 'an-muted' }),
      DF.statCard({ k: '待人工确认数', v: A.pendingConfirm + ' <small>项</small>',
        d: '点击前往处理 →', dCls: 'an-muted', click: true, id: 'an-card-confirm' }),
      DF.statCard({ k: '并行子任务规模', v: fmtNum(A.subtaskTotal) + ' <small>· 失败率 ' + A.subtaskFailRate + '%</small>',
        d: '累计并行执行子任务', dCls: 'an-muted' })
    ], 'margin-bottom:16px');
  }

  /* ---------- 趋势区：左双线图 2fr + 右阶段准出通过率 1fr ---------- */
  function trendSection() {
    const weeks = tail(A.weeks, state.n), tp = tail(A.throughput, state.n), dr = tail(A.defectRate, state.n);
    return '<div class="grid2 an-grid-21">' +
      '<div class="card"><div class="card-h">交付趋势 <span class="sub">吞吐率 / 缺陷率 · 近 ' + weeks.length + ' 周（悬浮数据点可看数值）</span></div>' +
        '<div class="card-b">' + bigTrend(weeks, tp, dr) + '</div></div>' +
      '<div class="card"><div class="card-h">阶段准出通过率 <span class="sub">四阶段评审准出</span></div>' +
        '<div class="card-b">' +
        (A.stagePass || []).map(function (sp) {
          const w = Math.max(0, Math.min(100, sp.rate));
          return '<div class="an-stage-row"><span class="an-stage-name">' + DF.esc(sp.stage) + '</span>' +
            '<div class="progress"><i style="width:' + w + '%"></i></div>' +
            '<span class="an-stage-val">' + sp.rate + '%</span></div>';
        }).join('') +
      '</div></div></div>';
  }

  /* ---------- 评审准出记录汇总（分页表，每页 5） ---------- */
  function reviewCard() {
    const recs = A.reviewRecords || [];
    const maxPage = Math.max(0, Math.ceil(recs.length / PAGE_SIZE) - 1);
    if (state.page > maxPage) state.page = maxPage;   // 空页钳制
    if (state.page < 0) state.page = 0;
    const rows = recs.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
    let h = '<div class="card"><div class="card-h">评审准出记录汇总 <span class="sub">共 ' + recs.length + ' 条 · 每页 ' + PAGE_SIZE + ' 条</span></div><div class="card-b">';
    if (!rows.length) return h + '<div class="empty">暂无评审准出记录</div></div></div>';
    h += DF.table(
      ['时间', '实例', '阶段', '评审节点', '结论', '意见摘要'],
      rows.map(function (r) {
        return '<tr>' +
          '<td>' + DF.relTime(r.timeM) + '</td>' +
          '<td><span class="an-inst-link" data-id="' + DF.esc(r.inst) + '" title="查看实例详情">' + DF.esc(r.inst) + '</span></td>' +
          '<td>' + DF.esc(r.stage) + '</td>' +
          '<td>' + DF.esc(r.node) + '</td>' +
          '<td>' + DF.tag(r.verdict, VERDICT_COLOR[r.verdict] || 'gray') + '</td>' +
          '<td><div class="ellipsis" title="' + DF.esc(r.opinion) + '">' + DF.esc(r.opinion) + '</div></td>' +
        '</tr>';
      })
    ) +
      '<div class="an-pager">' +
        '<button class="btn sm" id="an-prev"' + (state.page === 0 ? ' disabled' : '') + '>上一页</button>' +
        '<span class="sub">第 ' + (state.page + 1) + ' / ' + (maxPage + 1) + ' 页</span>' +
        '<button class="btn sm" id="an-next"' + (state.page >= maxPage ? ' disabled' : '') + '>下一页</button>' +
      '</div>';
    return h + '</div></div>';
  }

  /* ---------- Skill 审计 ---------- */
  function skillAuditCard() {
    const list = A.skillAudit || [];
    let h = '<div class="card"><div class="card-h">Skill 审计 <span class="sub">规则老化与执行异常治理</span></div><div class="card-b">';
    if (!list.length) return h + '<div class="empty">暂未发现技能规则异常</div></div></div>';
    h += '<div>' + list.map(function (it) {
      return '<div class="an-audit-item">' +
        '<div class="an-audit-top">' + DF.tag(it.issue, ISSUE_COLOR[it.issue] || 'gray') +
          '<span class="an-skill-name">' + DF.esc(it.skill) + '</span>' +
          '<span class="sub">发生 ' + it.count + ' 次 · 最近 ' + DF.relTime(it.lastM) + '</span>' +
          '<a class="an-link" href="skills.html">查看 Skill</a></div>' +
        '<div class="an-audit-advice">' + DF.esc(it.advice) + '</div>' +
      '</div>';
    }).join('') + '</div>';
    return h + '</div></div>';
  }

  /* ---------- 渲染 ---------- */
  function render() { body.innerHTML = statCards() + trendSection() + bottomSection(); }
  function bottomSection() {
    return '<div class="grid2" style="margin-top:16px">' +
      '<div id="an-review-wrap">' + reviewCard() + '</div>' +
      skillAuditCard() +
    '</div>';
  }
  function paintReview() {
    const wrap = document.getElementById('an-review-wrap');
    if (wrap) wrap.innerHTML = reviewCard();
  }

  /* ---------- 事件 ---------- */
  document.getElementById('an-range').addEventListener('change', function (e) {
    state.n = +e.target.value;
    state.page = 0;
    render();
    DF.toast('时间范围已切换为近 ' + state.n + ' 周');
  });

  body.addEventListener('click', function (e) {
    const inst = e.target.closest('.an-inst-link');
    if (inst) { location.href = 'instance-detail.html?id=' + encodeURIComponent(inst.getAttribute('data-id')); return; }
    if (e.target.closest('#an-card-confirm')) { location.href = 'instances.html?tab=' + encodeURIComponent('等待人工确认'); return; }
    if (e.target.closest('#an-prev')) { state.page--; paintReview(); return; }
    if (e.target.closest('#an-next')) { state.page++; paintReview(); }
  });

  render();
