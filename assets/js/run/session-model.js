/**
 * 执行会话的事件视图模型（无 DOM / 无网络）
 *
 * preview（API-51）与 rich（API-52）事件在这里归一；筛选、分组、统计也在这一层，
 * 供 assets/js/run/views/session.js 渲染。
 */

export const SESSION_STATUS = {
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消'
};

export const SESSION_ARCHIVE = {
  stored: '已归档',
  pending: '归档中',
  failed: '归档失败',
  none: '无归档'
};

export const CATEGORIES = [
  { key: 'tool', label: '工具' },
  { key: 'thought', label: '思考' },
  { key: 'message', label: '消息' },
  { key: 'usage', label: '用量' },
  { key: 'phase', label: '阶段' },
  { key: 'other', label: '其他' }
];

export const PRESETS = [
  { key: 'activity', label: '活动', keys: ['tool', 'message', 'phase', 'other'] },
  { key: 'all', label: '全部', keys: ['tool', 'thought', 'message', 'usage', 'phase', 'other'] }
];

const MATCHERS = {
  tool: (e) => String(e.event || '').indexOf('tool') === 0,
  thought: (e) => e.event === 'agent_thought_chunk',
  message: (e) => e.event === 'agent_message_chunk',
  usage: (e) => e.event === 'usage_update',
  phase: (e) => e.kind === 'phase' || e.kind === 'lifecycle' ||
    e.event === 'session.started' || e.event === 'prompt.result'
};

export function categoryMatch(e, key) {
  if (MATCHERS[key]) return MATCHERS[key](e);
  if (key !== 'other') return false;
  return !MATCHERS.tool(e) && !MATCHERS.thought(e) && !MATCHERS.message(e) &&
    !MATCHERS.usage(e) && !MATCHERS.phase(e);
}

export function sameCategorySet(selected, keys) {
  return keys.length === selected.size && keys.every(function (key) { return selected.has(key); });
}

const KIND_EVENT = {
  tool_call: 'tool_call',
  tool_result: 'tool_call_update',
  usage: 'usage_update',
  thought: 'agent_thought_chunk',
  message: 'agent_message_chunk',
  permission: 'session/request_permission'
};

function eventNameOf(raw) {
  if (raw.event) return raw.event;
  if (KIND_EVENT[raw.kind]) return KIND_EVENT[raw.kind];
  if (raw.kind === 'lifecycle') return raw.lifecycle || 'lifecycle';
  return raw.acpType || raw.kind || 'event';
}

const MESSAGE_BUILDERS = {
  tool_call: (raw, tool) => (tool && tool.name ? 'tool call: ' + tool.name : ''),
  tool_result: (raw, tool) => (tool && tool.name ? 'tool ' + tool.name + ': ' + (tool.status || 'completed') : ''),
  usage: (raw, tool, usage) => (usage ? 'usage: ' + usage.used + '/' + usage.size : ''),
  permission: (raw) => (raw.permission ? 'permission: ' + (raw.permission.decision || '') : ''),
  lifecycle: (raw) => raw.lifecycle || ''
};

function messageOf(raw, tool, usage) {
  if (raw.message) return raw.message;
  if (typeof raw.text === 'string') return raw.text;
  const builder = MESSAGE_BUILDERS[raw.kind];
  const built = builder ? builder(raw, tool, usage) : '';
  if (built) return built;
  return (raw.error && raw.error.message) ? raw.error.message : '';
}

function applyToolData(data, tool) {
  if (!tool) return data;
  if (tool.name && !data.tool) data.tool = tool.name;
  if (tool.status && !data.status) data.status = tool.status;
  if (tool.input !== undefined) data.input = tool.input;
  if (tool.output !== undefined) data.output = tool.output;
  if (tool.durationMs !== undefined) data.durationMs = tool.durationMs;
  return data;
}

function applyMetaData(data, raw) {
  if (raw.permission) data.permission = raw.permission;
  if (raw.stopReason) data.stopReason = raw.stopReason;
  if (raw.error) data.error = raw.error;
  if (raw.truncated === true) data.truncated = true;
  if (raw.originalBytes !== undefined) data.originalBytes = raw.originalBytes;
  return data;
}

function dataOf(raw, tool, usage) {
  const data = Object.assign({}, raw.data || {});
  if (usage) data.usage = usage;
  return applyMetaData(applyToolData(data, tool), raw);
}

/** 把 preview 与 rich 统一成 {event,message,data,tool,usage,...}。 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw.seq !== 'number') return null;
  const data = Object.assign({}, raw.data || {});
  const tool = raw.tool || (data.tool ? { name: data.tool, status: data.status } : null);
  const usage = raw.usage || (data.usage && typeof data.usage.used === 'number' ? data.usage : null);
  return {
    seq: raw.seq,
    ts: raw.ts,
    kind: raw.kind,
    event: eventNameOf(raw),
    message: messageOf(raw, tool, usage),
    data: dataOf(raw, tool, usage),
    tool: tool,
    usage: usage,
    permission: raw.permission || null,
    stopReason: raw.stopReason || null,
    error: raw.error || null,
    messageId: raw.messageId,
    toolCallId: raw.toolCallId,
    truncated: raw.truncated === true,
    originalBytes: raw.originalBytes,
    rich: raw.event === undefined ? raw : null
  };
}

export function eventText(e) {
  return (e && e.message) ? String(e.message) : '';
}

export function shortText(text, limit) {
  const value = String(text == null ? '' : text);
  const max = limit || 800;
  return value.length > max ? value.slice(0, max) + '…' : value;
}

export function toolName(e) {
  if (!e) return '';
  if (e.tool && e.tool.name) return e.tool.name;
  return (e.data && typeof e.data.tool === 'string') ? e.data.tool : '';
}

export function isToolStart(e) {
  return e && (e.event === 'tool_call' || e.event === 'tool.call');
}

export function isToolEnd(e) {
  return e && (e.event === 'tool_call_update' || e.event === 'tool.done' || e.event === 'tool_result');
}

export function sameTool(a, b) {
  if (a && b && a.toolCallId && b.toolCallId) return a.toolCallId === b.toolCallId;
  const left = toolName(a);
  const right = toolName(b);
  if (left && right) return left === right;
  return !left && !right;
}

export function statusOf(e) {
  if (!e) return '';
  if (e.tool && e.tool.status) return e.tool.status;
  return (e.data && typeof e.data.status === 'string') ? e.data.status : '';
}

export function buildUsageDelta(events) {
  const map = new Map();
  let prev = 0;
  events.forEach(function (e) {
    const usage = e.usage || (e.data && e.data.usage);
    if (e.event === 'usage_update' && usage && typeof usage.used === 'number') {
      map.set(e.seq, Math.max(0, usage.used - prev));
      prev = usage.used;
    }
  });
  return map;
}

export function computeStats(events, session) {
  const toolCalls = events.filter(function (e) { return e.event === 'tool_call'; });
  const toolEnds = events.filter(function (e) { return e.event === 'tool_call_update'; });
  const counts = {};
  toolCalls.forEach(function (e) {
    const name = toolName(e) || '其他';
    counts[name] = (counts[name] || 0) + 1;
  });
  const top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3)
    .map(function (name) { return name + ' ' + counts[name]; }).join(' · ');
  const completed = toolEnds.filter(function (e) { return statusOf(e) === 'completed'; }).length;
  const failed = toolEnds.filter(function (e) { return statusOf(e) === 'failed'; }).length;
  const usages = events.filter(function (e) {
    const usage = e.usage || (e.data && e.data.usage);
    return e.event === 'usage_update' && usage && typeof usage.used === 'number';
  }).map(function (e) { return e.usage || e.data.usage; });
  const firstUsage = usages.length ? usages[0] : null;
  const lastUsage = usages.length ? usages[usages.length - 1] : null;
  const peak = usages.reduce(function (max, u) { return Math.max(max, u.used); }, 0);
  const start = session && session.startedAt ? Date.parse(session.startedAt) : NaN;
  const end = session ? (session.finishedAt ? Date.parse(session.finishedAt) : Date.now()) : NaN;
  const durationMs = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
  const seconds = durationMs ? durationMs / 1000 : 0;
  return {
    toolTotal: toolCalls.length,
    toolTop: top,
    toolCompleted: completed,
    toolFailed: failed,
    usageFirst: firstUsage,
    usageLast: lastUsage,
    usagePeak: peak,
    thoughts: events.filter(function (e) { return e.event === 'agent_thought_chunk'; }).length,
    messages: events.filter(function (e) { return e.event === 'agent_message_chunk'; }).length,
    durationMs: durationMs,
    rate: seconds > 0 ? (events.length / seconds) : 0
  };
}

export function filterEvents(events, categories, search) {
  const q = String(search || '').trim().toLowerCase();
  return events.filter(function (e) {
    let hit = false;
    categories.forEach(function (key) { if (!hit && categoryMatch(e, key)) hit = true; });
    if (!hit) return false;
    if (!q) return true;
    const haystack = (eventText(e) + ' ' + (e.event || '') + ' ' + toolName(e) + ' ' +
      (e.toolCallId || '') + ' ' + ((e.data && e.data.acpType) || '')).toLowerCase();
    return haystack.indexOf(q) >= 0;
  });
}

/** 相邻 tool start/update 合并；其他事件保持 seq 时间线。 */
export function groupEvents(events, categories) {
  const mergeTools = categories.has('tool');
  const groups = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (mergeTools && isToolStart(e) && i + 1 < events.length && isToolEnd(events[i + 1]) && sameTool(e, events[i + 1])) {
      groups.push({ type: 'tool', start: e, end: events[i + 1] });
      i++;
    } else {
      groups.push({ type: 'event', event: e });
    }
  }
  return groups;
}
