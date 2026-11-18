/**
 * CMP-run-session（L2 只读视图）
 *
 * 节点执行会话：概览、多选筛选、事件时间线、EventSource 实时事件、raw 下载。
 * 事件归一/统计/分组在 ../session-model.js；本文件只做 DOM、加载与流生命周期。
 */

import { DF } from '../../ui.js';
import { createRunData, errorText } from '../data.js';
import {
  SESSION_STATUS,
  SESSION_ARCHIVE,
  CATEGORIES,
  PRESETS,
  sameCategorySet,
  normalizeEvent,
  eventText,
  shortText,
  toolName,
  buildUsageDelta,
  computeStats,
  filterEvents,
  groupEvents
} from '../session-model.js';

const { esc, icon } = DF;

const PAGE_LIMIT = 200;
const MAX_EVENTS = 1000;
const FILTER_STORE_KEY = 'df-run-session-filter';
const FILTER_STORE_VERSION = 1;
const CATEGORY_KEYS = CATEGORIES.map(function (category) { return category.key; });

function readSavedCategories() {
  const raw = DF.lsGet(FILTER_STORE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== FILTER_STORE_VERSION || !Array.isArray(parsed.categories)) return null;
    const keys = [];
    parsed.categories.forEach(function (key) {
      if (CATEGORY_KEYS.indexOf(key) >= 0 && keys.indexOf(key) < 0) keys.push(key);
    });
    return keys.length ? keys : null;
  } catch {
    return null;
  }
}

function saveCategories(categories) {
  DF.lsSet(FILTER_STORE_KEY, JSON.stringify({
    v: FILTER_STORE_VERSION,
    categories: Array.from(categories)
  }));
}

function fmtTime(iso, withSec) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + (withSec ? ':' + p(d.getSeconds()) : '');
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

function fmtDur(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—';
  const value = Math.max(0, Number(ms));
  if (value < 1000) return Math.round(value) + 'ms';
  const seconds = value / 1000;
  if (seconds < 60) return (Math.round(seconds * 10) / 10) + 's';
  return DF.fmtDur(Math.round(seconds));
}

function parseData(e) {
  try { return JSON.parse(e.data); } catch { return null; }
}

function shellHTML() {
  return '<div class="rs">' +
    '<div class="rs-head" data-role="head"></div>' +
    '<div class="rs-stats" data-role="stats"></div>' +
    '<div class="rs-toolbar" data-role="toolbar">' +
      '<div class="rs-filters" data-role="filters"></div>' +
      '<input class="inp rs-search" type="search" placeholder="搜索事件 / 工具 / 文本" data-role="search">' +
      '<span class="rs-count" data-role="count"></span>' +
    '</div>' +
    '<div class="rs-events" data-role="events"></div>' +
    '<div class="rs-raw" data-role="raw"></div>' +
  '</div>';
}

function createContext(container, opts) {
  opts = opts || {};
  const state = {
    session: null,
    events: [],
    eventCount: 0,
    loading: true,
    error: null,
    stream: 'idle',
    es: null,
    controller: null,
    seq: 0,
    mounted: true,
    categories: new Set(readSavedCategories() || PRESETS[0].keys),
    search: '',
    truncated: false,
    renderTimer: null,
    scrolled: false,
    pinTop: false,
    usageDelta: new Map()
  };
  container.innerHTML = shellHTML();
  return {
    container: container,
    opts: opts,
    data: opts.data || createRunData(),
    runId: opts.runId,
    nodeId: opts.nodeId,
    visit: Number(opts.visit) || 1,
    state: state,
    els: {
      head: container.querySelector('[data-role="head"]'),
      stats: container.querySelector('[data-role="stats"]'),
      filters: container.querySelector('[data-role="filters"]'),
      search: container.querySelector('[data-role="search"]'),
      count: container.querySelector('[data-role="count"]'),
      events: container.querySelector('[data-role="events"]'),
      raw: container.querySelector('[data-role="raw"]')
    }
  };
}

function bindEvents(ctx) {
  const state = ctx.state;
  ctx.els.filters.addEventListener('click', function (e) {
    const presetBtn = e.target.closest('[data-preset]');
    if (presetBtn) {
      const preset = PRESETS.find(function (item) { return item.key === presetBtn.dataset.preset; });
      if (!preset) return;
      state.categories = new Set(preset.keys);
      saveCategories(state.categories);
      state.pinTop = true;
      renderFilters(ctx);
      renderEvents(ctx);
      return;
    }
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const key = btn.dataset.filter;
    if (!CATEGORIES.some(function (item) { return item.key === key; })) return;
    if (state.categories.has(key)) {
      if (state.categories.size <= 1) return;
      state.categories.delete(key);
    } else {
      state.categories.add(key);
    }
    saveCategories(state.categories);
    state.pinTop = true;
    renderFilters(ctx);
    renderEvents(ctx);
  });
  ctx.els.search.addEventListener('input', function () {
    state.search = ctx.els.search.value;
    state.pinTop = true;
    renderEvents(ctx);
  });
  ctx.container.addEventListener('click', function (e) {
    if (e.target.closest('[data-act="retry"]')) load(ctx);
  });
}

function closeStream(ctx) {
  const state = ctx.state;
  if (!state.es) return;
  try { state.es.close(); } catch { /* 已关闭 */ }
  state.es = null;
}

function scheduleRender(ctx) {
  const state = ctx.state;
  if (state.renderTimer || !state.mounted) return;
  state.renderTimer = setTimeout(function () {
    state.renderTimer = null;
    if (!state.mounted) return;
    state.usageDelta = buildUsageDelta(state.events);
    renderStats(ctx);
    renderEvents(ctx);
  }, 80);
}

function mergeEvent(ctx, raw) {
  const state = ctx.state;
  const event = normalizeEvent(raw);
  if (!event) return;
  const index = state.events.findIndex(function (item) { return item.seq === event.seq; });
  if (index >= 0) {
    if (event.rich && !state.events[index].rich) state.events[index] = event;
    return;
  }
  state.events.push(event);
  state.events.sort(function (a, b) { return a.seq - b.seq; });
  state.eventCount = Math.max(state.eventCount, state.events.length);
}

function openStream(ctx) {
  const state = ctx.state;
  if (!state.mounted || state.es || typeof EventSource !== 'function') return;
  let es;
  try {
    es = new EventSource(ctx.data.sessionStreamUrl(ctx.runId, ctx.nodeId, { visit: ctx.visit }));
  } catch {
    state.stream = 'error';
    renderHead(ctx);
    return;
  }
  state.es = es;
  state.stream = 'live';
  renderHead(ctx);
  es.addEventListener('snapshot', function (e) {
    const payload = parseData(e);
    if (!payload) return;
    if (payload.reset === true) state.events = [];
    (payload.events || []).forEach(function (item) { mergeEvent(ctx, item); });
    scheduleRender(ctx);
  });
  es.addEventListener('event', function (e) {
    const payload = parseData(e);
    if (payload) mergeEvent(ctx, payload);
    scheduleRender(ctx);
  });
  es.addEventListener('heartbeat', function () { /* 仅保活 */ });
  es.addEventListener('end', function (e) {
    const payload = parseData(e);
    if (payload && payload.status) {
      state.session = Object.assign({}, state.session, { status: payload.status });
    }
    state.stream = 'ended';
    closeStream(ctx);
    renderAll(ctx);
  });
  es.onerror = function () {
    if (state.stream === 'ended') return;
    state.stream = 'reconnecting';
    renderHead(ctx);
  };
}

async function loadEventPages(ctx, signal) {
  const all = [];
  let cursor;
  let truncated = false;
  for (let page = 0; page < 10; page++) {
    const result = await ctx.data.listSessionEvents(ctx.runId, ctx.nodeId, {
      visit: ctx.visit, cursor: cursor, limit: PAGE_LIMIT, signal: signal
    });
    const items = result.items || [];
    items.forEach(function (item) {
      const event = normalizeEvent(item);
      if (event && !all.some(function (existing) { return existing.seq === event.seq; })) all.push(event);
    });
    if (result.truncatedBefore !== undefined && result.truncatedBefore !== null) truncated = true;
    const next = result.nextCursor;
    if (!next || items.length === 0 || String(next) === String(cursor) || all.length >= MAX_EVENTS) {
      if (all.length >= MAX_EVENTS) truncated = true;
      break;
    }
    cursor = next;
  }
  all.sort(function (a, b) { return a.seq - b.seq; });
  return { events: all, truncated: truncated };
}

async function load(ctx) {
  const state = ctx.state;
  const seq = ++state.seq;
  state.loading = true;
  state.error = null;
  renderAll(ctx);
  const controller = new AbortController();
  state.controller = controller;
  try {
    const session = await ctx.data.getSession(ctx.runId, ctx.nodeId, { visit: ctx.visit, signal: controller.signal });
    if (seq !== state.seq || !state.mounted) return;
    state.session = session;
    state.eventCount = Number(session.eventCount) || 0;
    const page = await loadEventPages(ctx, controller.signal);
    if (seq !== state.seq || !state.mounted) return;
    state.events = page.events;
    state.truncated = page.truncated || page.events.length >= MAX_EVENTS;
    state.usageDelta = buildUsageDelta(state.events);
    state.loading = false;
    state.stream = session.status === 'running' ? 'connecting' : 'ended';
    renderAll(ctx);
    if (session.status === 'running' && ctx.opts.live !== false) openStream(ctx);
  } catch (err) {
    if (seq !== state.seq || !state.mounted || err.name === 'AbortError') return;
    state.loading = false;
    state.error = err;
    state.stream = 'error';
    renderAll(ctx);
  }
}

function renderHead(ctx) {
  const state = ctx.state;
  const session = state.session;
  const status = session ? (SESSION_STATUS[session.status] || session.status) : '—';
  const color = session && session.status === 'running' ? 'blue' : session && session.status === 'failed' ? 'red' : 'gray';
  const live = state.stream === 'live' ? '<span class="rs-live">' + DF.dot('green') + '实时</span>' :
    state.stream === 'reconnecting' ? '<span class="rs-live">' + DF.dot('orange') + '重连中</span>' :
    state.stream === 'ended' ? '<span class="rs-live">' + DF.dot('gray') + '已结束</span>' : '';
  ctx.els.head.innerHTML = '<div class="rs-title"><b>执行会话</b>' +
    (session ? DF.tag(status, color) : '') + live +
    '<span class="sub">第 ' + ctx.visit + ' 轮</span></div>' +
    (session ? '<div class="sub rs-cwd" title="' + esc(session.cwd || '') + '">' + esc(session.cwd || '—') + '</div>' : '');
}

function statCard(label, value, sub) {
  return '<div class="rs-stat"><span class="rs-k">' + esc(label) + '</span><div class="rs-v">' + value + '</div>' +
    '<div class="rs-s">' + sub + '</div></div>';
}

function durationCard(session, stats) {
  const end = session.finishedAt ? fmtTime(session.finishedAt) : (session.status === 'running' ? '进行中' : '—');
  return statCard('时长', esc(fmtDur(stats.durationMs)),
    esc(fmtTime(session.startedAt)) + ' → ' + esc(end));
}

function eventsCard(state, stats) {
  const total = state.eventCount || state.events.length;
  const loaded = state.events.length;
  const rate = stats.rate ? ' · ' + stats.rate.toFixed(1) + '/s' : '';
  return statCard('事件', esc(fmtNum(total)),
    '已载入 ' + esc(fmtNum(loaded)) + (total > loaded ? ' / ' + esc(fmtNum(total)) : '') + rate +
    (state.truncated ? ' · 已截断' : ''));
}

function toolsCard(stats) {
  const sub = stats.toolTotal
    ? '完成 ' + stats.toolCompleted + '/' + stats.toolTotal +
      (stats.toolFailed ? ' · 失败 ' + stats.toolFailed : '') +
      (stats.toolTop ? ' · ' + stats.toolTop : '')
    : '未记录工具调用';
  return statCard('工具调用', esc(fmtNum(stats.toolTotal)), esc(sub));
}

function tokenCard(stats) {
  const last = stats.usageLast;
  const percent = last && last.size ? Math.min(100, (last.used / last.size) * 100) : 0;
  const delta = last && stats.usageFirst ? Math.max(0, last.used - stats.usageFirst.used) : 0;
  const value = esc(fmtNum(last ? last.used : 0)) +
    (last && last.size ? ' <span class="rs-u">/ ' + esc(fmtNum(last.size)) + '</span>' : '');
  return '<div class="rs-stat"><span class="rs-k">Token</span><div class="rs-v">' + value + '</div>' +
    '<div class="rs-bar"><i style="width:' + percent.toFixed(1) + '%"></i></div>' +
    '<div class="rs-s">' + (last ? percent.toFixed(1) + '%' : '—') +
    (delta ? ' · 增量 ' + esc(fmtNum(delta)) : '') + '</div></div>';
}

function thoughtsCard(stats) {
  return statCard('思考 / 消息',
    esc(fmtNum(stats.thoughts)) + ' <span class="rs-u">/ ' + esc(fmtNum(stats.messages)) + '</span>',
    '思考片段 · 消息片段');
}

function archiveCard(session) {
  const archive = session.archive || {};
  return statCard('归档', esc(SESSION_ARCHIVE[archive.status] || archive.status || '—'),
    archive.sizeBytes ? esc(DF.fmtBytes(archive.sizeBytes)) : '—');
}

function statsHTML(state, session) {
  const stats = computeStats(state.events, session);
  return durationCard(session, stats) + eventsCard(state, stats) + toolsCard(stats) +
    tokenCard(stats) + thoughtsCard(stats) + archiveCard(session);
}

function renderStats(ctx) {
  const state = ctx.state;
  if (state.loading) {
    ctx.els.stats.innerHTML = '<div class="loading">正在读取会话…</div>';
    ctx.els.count.textContent = '';
  } else if (state.error) {
    const retry = state.error.code === 'session_not_linked' ? '' :
      '<br><br><button type="button" class="btn sm" data-act="retry">重试</button>';
    ctx.els.stats.innerHTML = '<div class="empty rs-empty">' + esc(errorText(state.error)) + retry + '</div>';
    ctx.els.count.textContent = '';
  } else if (!state.session) {
    ctx.els.stats.innerHTML = '<div class="empty rs-empty">该节点无执行会话</div>';
    ctx.els.count.textContent = '';
  } else {
    ctx.els.stats.innerHTML = statsHTML(state, state.session);
  }
  renderFilters(ctx);
}

function renderFilters(ctx) {
  const selected = ctx.state.categories;
  const presets = PRESETS.map(function (preset) {
    return '<button type="button" class="rs-filter rs-preset' + (sameCategorySet(selected, preset.keys) ? ' on' : '') +
      '" data-preset="' + preset.key + '" data-filter="' + preset.key + '">' + preset.label + '</button>';
  }).join('');
  const categories = CATEGORIES.map(function (category) {
    return '<button type="button" class="rs-filter' + (selected.has(category.key) ? ' on' : '') +
      '" data-filter="' + category.key + '">' + category.label + '</button>';
  }).join('');
  ctx.els.filters.innerHTML = presets + '<span class="rs-fdiv"></span>' + categories;
}

function statusChip(status) {
  if (!status) return '';
  const cls = status === 'completed' ? ' ok' : status === 'failed' ? ' fail' : '';
  return '<span class="rs-status' + cls + '">' + esc(status) + '</span>';
}

function toolRowHTML(group) {
  const start = group.start;
  const end = group.end;
  const startMs = Date.parse(start.ts);
  const endMs = Date.parse(end.ts);
  const richDuration = end.tool && typeof end.tool.durationMs === 'number' ? end.tool.durationMs : null;
  const duration = richDuration !== null ? richDuration :
    (Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : null);
  const name = toolName(start) || toolName(end) || 'tool';
  const status = end.tool && end.tool.status ? end.tool.status : 'completed';
  return '<div class="rs-ev rs-ev-tool' + (status === 'failed' ? ' rs-ev-fail' : '') + '">' +
    '<span class="rs-seq">#' + esc(String(start.seq)) + (end.seq !== start.seq ? '–#' + esc(String(end.seq)) : '') + '</span>' +
    '<span class="rs-ts">' + esc(fmtTime(start.ts, true)) + '</span>' +
    '<span class="rs-kind">tool</span>' +
    '<span class="rs-tool-name">' + esc(name) + '</span>' +
    statusChip(status) +
    (duration !== null ? '<span class="rs-dur">' + esc(fmtDur(duration)) + '</span>' : '') +
    '<span class="rs-text">' + esc(eventText(end) || eventText(start)) + '</span>' +
  '</div>';
}

function toolChips(tool) {
  const chips = [];
  if (tool && tool.name) chips.push('<span class="rs-chip">' + esc(tool.name) + '</span>');
  if (tool && tool.status) chips.push(statusChip(tool.status));
  return chips;
}

function usageChips(ctx, e, usage) {
  if (!usage || typeof usage.used !== 'number') return [];
  const chips = ['<span class="rs-chip">' + esc(fmtNum(usage.used)) + ' / ' + esc(fmtNum(usage.size)) + '</span>'];
  const delta = ctx.state.usageDelta.get(e.seq);
  if (delta) chips.push('<span class="rs-delta">+' + esc(fmtNum(delta)) + '</span>');
  return chips;
}

function metaChips(e, data) {
  const chips = [];
  if (typeof data.bytes === 'number') chips.push('<span class="rs-chip">' + esc(fmtNum(data.bytes)) + ' B</span>');
  if (e.permission) chips.push('<span class="rs-chip">permission ' + esc(e.permission.decision || 'request') + '</span>');
  if (e.stopReason) chips.push('<span class="rs-chip">stop ' + esc(e.stopReason) + '</span>');
  if (e.error || data.error) {
    const error = e.error || data.error;
    chips.push('<span class="rs-chip rs-chip-fail">' + esc(error.code || error.class || 'error') + '</span>');
  }
  if (e.truncated) chips.push('<span class="rs-chip">截断' + (e.originalBytes ? ' ' + esc(fmtNum(e.originalBytes)) + 'B' : '') + '</span>');
  return chips;
}

function eventChips(ctx, e) {
  const data = e.data || {};
  const tool = e.tool || (data.tool ? { name: data.tool, status: data.status } : null);
  const usage = e.usage || data.usage;
  return toolChips(tool).concat(usageChips(ctx, e, usage), metaChips(e, data)).join('');
}

function eventRowHTML(ctx, e) {
  return '<div class="rs-ev rs-ev-kind-' + esc(String(e.kind || 'event')) + '">' +
    '<span class="rs-seq">#' + esc(String(e.seq)) + '</span>' +
    '<span class="rs-ts">' + esc(fmtTime(e.ts, true)) + '</span>' +
    '<span class="rs-kind">' + esc(e.kind || '') + '</span>' +
    '<span class="rs-name mono">' + esc(e.event || '') + '</span>' +
    eventChips(ctx, e) +
    (eventText(e) ? '<span class="rs-text">' + esc(shortText(eventText(e))) + '</span>' : '') +
  '</div>';
}

function rowHTML(ctx, group) {
  return group.type === 'tool' ? toolRowHTML(group) : eventRowHTML(ctx, group.event);
}

function renderEvents(ctx) {
  const state = ctx.state;
  if (state.loading || state.error || !state.session) {
    ctx.els.events.innerHTML = '';
    ctx.els.count.textContent = '';
    return;
  }
  const groups = groupEvents(filterEvents(state.events, state.categories, state.search), state.categories);
  ctx.els.count.textContent = '显示 ' + groups.length + ' 行 / ' + state.events.length + ' 条事件' +
    (state.eventCount > state.events.length ? '（共 ' + state.eventCount + '）' : '');
  if (!groups.length) {
    ctx.els.events.innerHTML = '<div class="empty rs-empty">没有匹配的事件</div>';
    return;
  }
  const preset = PRESETS.find(function (item) { return sameCategorySet(state.categories, item.keys); });
  const label = preset ? preset.label : Array.from(state.categories).map(function (key) {
    const category = CATEGORIES.find(function (item) { return item.key === key; });
    return category ? category.label : key;
  }).join(' + ');
  const nearBottom = ctx.els.events.scrollHeight - ctx.els.events.scrollTop - ctx.els.events.clientHeight < 48;
  ctx.els.events.innerHTML = '<div class="rs-ev-head"><b>' + esc(label) +
    '</b><span class="sub">' + groups.length + ' 行</span></div>' +
    '<div class="rs-ev-list">' + groups.map(function (group) { return rowHTML(ctx, group); }).join('') + '</div>';
  if (state.pinTop) {
    ctx.els.events.scrollTop = 0;
    state.pinTop = false;
  } else if (!state.scrolled) {
    ctx.els.events.scrollTop = (state.session && state.session.status === 'running') ? ctx.els.events.scrollHeight : 0;
    state.scrolled = true;
  } else if (nearBottom) {
    ctx.els.events.scrollTop = ctx.els.events.scrollHeight;
  }
}

function renderRaw(ctx) {
  const session = ctx.state.session;
  if (!session) { ctx.els.raw.innerHTML = ''; return; }
  if (!session.archive || session.archive.status !== 'stored') {
    ctx.els.raw.innerHTML = '<div class="sub">raw 会话存档：' +
      esc(SESSION_ARCHIVE[session.archive && session.archive.status] || '未就绪') + '，归档完成后可下载。</div>';
    return;
  }
  const url = ctx.data.sessionRawUrl(ctx.runId, ctx.nodeId, { visit: ctx.visit });
  const sha = session.archive.sha256 ? ' · sha256 ' + esc(String(session.archive.sha256).slice(0, 12)) + '…' : '';
  ctx.els.raw.innerHTML = '<a class="btn sm" href="' + esc(url) + '" download="session-' +
    esc(ctx.nodeId) + '-v' + ctx.visit + '.jsonl.zstd">' + icon('download', 12) + '下载 raw 存档</a>' +
    '<span class="sub" style="margin-left:8px">zstd 压缩的完整会话（' +
    esc(DF.fmtBytes(session.archive.sizeBytes)) + sha + '）</span>';
}

function renderAll(ctx) {
  renderHead(ctx);
  renderStats(ctx);
  renderEvents(ctx);
  renderRaw(ctx);
}

function unmount(ctx) {
  const state = ctx.state;
  state.mounted = false;
  state.seq++;
  if (state.renderTimer) { clearTimeout(state.renderTimer); state.renderTimer = null; }
  closeStream(ctx);
  if (state.controller) { try { state.controller.abort(); } catch { /* 已中止 */ } }
  state.controller = null;
  ctx.container.innerHTML = '';
}

export function mountRunSession(container, opts) {
  const ctx = createContext(container, opts);
  bindEvents(ctx);
  load(ctx);
  return {
    unmount: function () { unmount(ctx); }
  };
}
