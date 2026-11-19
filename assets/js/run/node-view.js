/**
 * 运行节点详情弹层的只读视图片段：标题、轮次、概要、会话日志、确认卡。
 * 交互与弹层生命周期在 pages/instance-detail.js；本文件不做网络与状态变更。
 */

import { DF } from '../ui.js';
import { NODE_STATE } from './data.js';
import { NODE_META, NODE_DOT } from './node-meta.js';
import { renderMarkdown } from '../shared/markdown.js';
import { fmtTime, fmtMs } from './format.js';

const { esc, icon, tag, dot } = DF;

export function nodeModalTitle(node, record, isLatest, visitCount) {
  const meta = NODE_META[node.type] || { label: node.type };
  let title = node.name + ' · ' + meta.label;
  if (record && visitCount > 1) {
    title += ' · 第 ' + (Number(record.visit) || 1) + ' 轮' + (isLatest ? '（最新）' : '（历史）');
  }
  return title;
}

/** 轮次 Tab：仅有历史时才出现；最新一轮在左，历史轮次按 visit 倒序。 */
export function roundsHTML(visits, selectedVisit) {
  if (visits.length <= 1) return '';
  return '<div class="id-rounds"><span class="lbl">执行轮次</span><div class="id-round-tabs">' +
    visits.map(function (record, index) {
      const visit = Number(record.visit) || 1;
      const on = visit === Number(selectedVisit);
      return '<button type="button" class="id-round-tab' + (on ? ' on' : '') + '" data-visit="' + visit + '"' +
        ' title="' + esc(NODE_STATE[record.state] || record.state) + '">' +
        dot(NODE_DOT[record.state] || 'gray') +
        esc((index === 0 ? '最新 · 第 ' : '第 ') + visit + ' 轮') + '</button>';
    }).join('') +
    '</div><span class="meta">共 ' + visits.length + ' 轮</span></div>';
}

/** 节点消息与确认说明按 Markdown 渲染；详情本身已是 90% 弹层，不再提供二次全屏。 */
export function mdBlock(title, text) {
  return '<div class="section-title">' + esc(title) + ' <span class="line"></span></div>' +
    '<div class="md-body">' + renderMarkdown(text) + '</div>';
}

const STATUS_TONE = {
  succeeded: 'green',
  failed: 'red',
  rejected: 'purple',
  waiting_confirm: 'orange',
  waiting_resume: 'amber',
  dispatched: 'blue'
};

function expertBadge(color, name) {
  return '<span class="expert-dot" style="background:' + esc(color) +
    ';width:16px;height:16px;font-size:9px;border-radius:4px">' +
    esc(String(name).slice(0, 1)) + '</span> ' + esc(name);
}

/**
 * 专家名优先用 RunNodeView.expertName（启动时冻结，资产删除后仍在）；
 * 其次查当前专家列表；都没有时显示「—」，不展示裸 UUID。
 */
function expertCell(node, runNode, experts) {
  const snapshot = runNode && runNode.expertName ? String(runNode.expertName) : '';
  const expert = node.expertId ? experts.get(node.expertId) : null;
  if (snapshot) return expert ? expertBadge(expert.color, snapshot) : expertBadge('#cbd5e1', snapshot);
  if (expert) return expertBadge(expert.color, expert.name);
  return '<span class="sub" title="专家已删除或未记录">—</span>';
}

function summaryRows(node, st, runNode, opt, experts) {
  const roundSuffix = opt.manyRounds ? (opt.isLatest ? '（最新）' : '（历史）') : '';
  return [
    ['状态', tag(st.label, STATUS_TONE[st.key] || 'gray')],
    ['节点类型', esc((NODE_META[node.type] || { label: node.type }).label)],
    ['专家', expertCell(node, runNode, experts)],
    ['访问轮次', runNode ? '第 ' + esc(runNode.visit) + ' 轮' + roundSuffix : '—'],
    ['任务 ID', runNode && runNode.taskId ? '<span class="mono">' + esc(runNode.taskId) + '</span>' : '—'],
    ['下发时间', esc(fmtTime(runNode && runNode.dispatchedAt))],
    ['完成时间', esc(fmtTime(runNode && runNode.finishedAt))],
    ['节点耗时', runNode && runNode.dispatchedAt ? esc(fmtMs(runNode.dispatchedAt, runNode.finishedAt)) : '—']
  ];
}

/**
 * 解析 `confirmation_request` 形状（不看节点状态）：用于等待卡与概要 Tab；
 * 等待卡是否出现仍由 `confirmationOf` / `confirmModeOf` 按 waiting_confirm 判断。
 */
export function confirmationFromVerdict(verdict) {
  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) return null;
  if (verdict.kind !== 'confirmation_request') return null;
  if (typeof verdict.question !== 'string' || verdict.question.trim() === '') return null;
  return verdict;
}

/**
 * `waiting_confirm` 有两种来源：`confirm` 节点（nodeType=confirm）与执行中确认点
 * （agent/design 节点执行中通过 MCP 回传 `confirmation_request`）。
 * 只认 RunNodeView，不按节点类型猜；question 为空或 verdict 形状不对时返回 null。
 */
export function confirmationOf(runNode) {
  if (!runNode || runNode.state !== 'waiting_confirm') return null;
  return confirmationFromVerdict(runNode.verdict);
}

/** 仅最新轮等待中的节点返回 confirm / confirmation / abnormal；其余返回 null。 */
export function confirmModeOf(node, runNode) {
  if (!runNode || runNode.state !== 'waiting_confirm') return null;
  if ((runNode.nodeType || (node && node.type)) === 'confirm') return 'confirm';
  return confirmationOf(runNode) ? 'confirmation' : 'abnormal';
}

/**
 * 确认卡的轮询重建键：执行中确认点不含 message，避免 5s 轮询把用户已选的选项/输入清空；
 * 选项或问题变化时才重建。
 */
export function confirmKeyOf(mode, runNode) {
  if (!mode || !runNode) return 'none';
  const visit = Number(runNode.visit) || 1;
  if (mode === 'confirm') {
    return 'confirm|' + runNode.state + '|' + (runNode.message || '') + '|' + visit;
  }
  if (mode === 'confirmation') {
    const request = confirmationOf(runNode);
    if (!request) return 'confirmation|missing|' + visit;
    const options = Array.isArray(request.options) ? request.options : [];
    return 'confirmation|' + runNode.state + '|' + String(runNode.verdict.kind || '') + '|' +
      request.question + '|' + JSON.stringify(options) + '|' + visit;
  }
  return 'abnormal|' + runNode.state + '|' + visit;
}

/** 选项 + 补充说明统一拼进 comment；不生成 answer 字段。 */
export function readDecisionComment(mode) {
  const input = document.getElementById('cf-comment');
  const text = (input ? input.value : '').trim();
  if (mode !== 'confirmation') return text;
  const picked = document.querySelector('#id-confirm input[name="cf-option"]:checked');
  return [picked ? picked.value.trim() : '', text].filter(Boolean).join('\n');
}

/** confirm 节点沿用原有文案；执行中确认点的 reject 不回退，不能写「流程回退」。 */
export function decisionToast(mode, decision) {
  if (mode === 'confirmation') {
    return decision === 'pass' ? '已确认，继续执行' : '已拒绝，意见已反馈';
  }
  return decision === 'pass' ? '已批准，流程继续' : '已驳回，流程回退';
}

function optionsOf(request) {
  return Array.isArray(request.options)
    ? request.options.filter(function (option) { return typeof option === 'string'; })
    : [];
}

function verdictBlock(verdict) {
  return '<div class="section-title">判定结论 <span class="line"></span></div>' +
    '<pre class="id-pre">' + esc(typeof verdict === 'string' ? verdict : JSON.stringify(verdict, null, 2)) + '</pre>';
}

/** 执行中确认点：结构化展示问题/上下文/候选答案，原始 verdict 收进折叠区。 */
function confirmationBlock(request, verdict) {
  const options = optionsOf(request);
  return '<div class="section-title">确认请求 <span class="line"></span></div>' +
    '<div class="id-cf-summary">' +
      '<div class="id-cf-q">' + esc(request.question) + '</div>' +
      (request.context
        ? '<div class="id-cf-label">上下文</div><div class="md-body">' + renderMarkdown(request.context) + '</div>'
        : '') +
      (options.length
        ? '<div class="id-cf-label">候选答案</div><div class="id-cf-opt-list">' + options.map(esc).join(' / ') + '</div>'
        : '') +
    '</div>' +
    '<details class="id-fold"><summary>原始 verdict</summary>' +
      '<pre class="id-pre">' + esc(typeof verdict === 'string' ? verdict : JSON.stringify(verdict, null, 2)) + '</pre>' +
    '</details>';
}

function errorBlock(runNode) {
  return '<div class="section-title">错误 <span class="line"></span></div>' +
    '<pre class="id-pre id-pre-err">' + esc((runNode.error.code || '') + '：' + (runNode.error.message || '')) + '</pre>';
}

function timeoutHint(error) {
  if (error && error.code === 'prompt_timeout') return '提示词阶段超过执行节点超时阈值，本次执行已被中断。';
  if (error && error.code === 'idle_timeout') return '执行节点长时间无活动，本次执行已被中断。';
  return '节点执行超过超时阈值，被客户端中断。';
}

/** 超时等待继续卡：只在最新轮且 run 仍为 waiting_resume 时由页面传入 waitingResume。 */
export function resumeNotice(runNode, resuming) {
  const error = runNode.error || null;
  const code = error && error.code ? error.code : 'timeout';
  const message = error && error.message ? error.message : '';
  return '<div class="id-wait" id="id-node-wait">' +
    '<div class="id-wait-h">' + icon('warn', 14) + '<b>执行超时，等待继续</b>' + tag(code, 'amber') + '</div>' +
    (message ? '<div class="id-wait-err">' + esc(message) + '</div>' : '') +
    '<div class="id-wait-tip">' + esc(timeoutHint(error)) + '</div>' +
    '<div class="id-wait-tip">使用原任务、原会话继续；不会新建运行。继续后仍可能再次超时。</div>' +
    '<div class="id-wait-acts">' +
      '<button type="button" class="btn primary" data-resume-node="' + esc(runNode.nodeId || '') + '"' +
        (resuming ? ' disabled' : '') + '>' + icon('play', 14) + (resuming ? '正在继续…' : '继续执行') + '</button>' +
      '<span class="sub">继续后节点回到「已派发」，等待执行节点领取。</span>' +
    '</div></div>';
}

function summaryFooter() {
  return '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn sm" disabled title="后端未提供节点重试能力">' + icon('retry', 12) + '重试节点</button>' +
    '<button class="btn sm" disabled title="后端未提供从节点重跑能力">' + icon('retry', 12) + '从此节点重跑</button>' +
    '</div>' +
    '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn sm" data-act="open-files">' + icon('folder', 12) + '查看任务文件</button>' +
      '<span class="sub">输入与输出：当前执行面未提供对应端点；任务文件可只读浏览。</span>' +
    '</div>';
}

export function summaryTab(node, st, runNode, opt, experts) {
  opt = opt || {};
  const manyRounds = (opt.count || 0) > 1;
  const isLatest = opt.isLatest !== false;
  const meta = NODE_META[node.type] || { label: node.type };
  let html = '<div class="id-node-h"><b>' + esc(node.name) + '</b>' + tag(meta.label, 'gray') + tag(st.label, 'gray') +
    (manyRounds ? tag(isLatest ? '最新轮次' : '历史轮次', isLatest ? 'blue' : 'gray') : '') + '</div>' +
    DF.kv(summaryRows(node, st, runNode, { manyRounds: manyRounds, isLatest: isLatest }, experts));
  if (runNode && runNode.verdict) {
    const request = confirmationFromVerdict(runNode.verdict);
    html += request ? confirmationBlock(request, runNode.verdict) : verdictBlock(runNode.verdict);
  }
  if (runNode && runNode.message) html += mdBlock('节点消息', runNode.message);
  if (runNode && runNode.state === 'waiting_resume' && isLatest && opt.waitingResume) {
    html += resumeNotice(runNode, opt.resuming);
  } else if (runNode && runNode.error) {
    html += errorBlock(runNode);
  }
  return html + summaryFooter();
}

export function logTab(node, runNode, runId, sessionLogUrl) {
  if (!runNode) return '<div class="sub" style="color:var(--t-3)">该节点尚未下发执行，暂无会话日志。</div>';
  if (!runNode.taskId) {
    if (confirmationOf(runNode)) {
      return '<div class="sub" style="color:var(--t-3)">该确认点尚未关联执行会话；确认后以续跑任务恢复同一 session。</div>';
    }
    return '<div class="sub" style="color:var(--t-3)">该节点没有执行会话（人工确认节点不产生会话日志）。</div>';
  }
  const visit = Number(runNode.visit) || 1;
  return '<div class="section-title">会话日志 <span class="line"></span></div>' +
    '<div class="sub" style="margin-bottom:10px">第 ' + visit + ' 轮由执行节点上传的 gzip JSONL（<span class="mono">' + esc(runNode.taskId) + '</span>）。</div>' +
    '<a class="btn primary" href="' + esc(sessionLogUrl(runId, node.id, { visit: visit })) + '"' +
      ' download="session-' + esc(node.id) + '-v' + visit + '.ndjson.gz">' +
      icon('download', 14) + '下载第 ' + visit + ' 轮会话日志</a>' +
    '<div class="sub" style="margin-top:8px">首次点击若提示 404，表示执行节点尚未上传该轮日志。</div>';
}

function nodeConfirmCard(node, runNode) {
  return '<div class="id-confirm-card">' +
    '<h4>' + icon('warn', 14) + ' 待人工确认 · ' + esc(node.name) + '</h4>' +
    (runNode.message ? mdBlock('确认说明', runNode.message) : '<div class="sub">执行节点正在等待确认决策。</div>') +
    '<input class="inp" id="cf-comment" placeholder="审批意见（批准选填 / 驳回必填）" style="margin:8px 0">' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn primary" id="cf-ok">' + icon('check', 12) + '批准，继续执行</button>' +
      '<button class="btn danger" id="cf-no">' + icon('x', 12) + '驳回</button>' +
    '</div></div>';
}

function confirmationCard(node, runNode, request) {
  const options = optionsOf(request);
  return '<div class="id-confirm-card id-confirm-point">' +
    '<h4>' + icon('warn', 14) + ' 执行中确认 · ' + esc(node.name) + '</h4>' +
    '<div class="id-cf-q">' + esc(request.question) + '</div>' +
    (request.context
      ? '<div class="id-cf-label">上下文</div><div class="id-cf-context md-body">' + renderMarkdown(request.context) + '</div>'
      : '') +
    (options.length
      ? '<div class="id-cf-label">选择</div><div class="id-cf-options" role="radiogroup" aria-label="候选答案">' +
        options.map(function (option, index) {
          return '<label class="id-cf-opt"><input type="radio" name="cf-option" value="' + esc(option) + '" data-i="' + index + '">' +
            '<span>' + esc(option) + '</span></label>';
        }).join('') +
        '</div>'
      : '') +
    '<input class="inp" id="cf-comment" placeholder="补充说明（可选）" style="margin:8px 0">' +
    (runNode.message
      ? '<details class="id-cf-note"><summary>模型说明</summary><div class="md-body">' + renderMarkdown(runNode.message) + '</div></details>'
      : '') +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button class="btn primary" id="cf-ok">' + icon('check', 12) + '确认并继续</button>' +
      '<button class="btn danger" id="cf-no">' + icon('x', 12) + '拒绝并反馈</button>' +
    '</div></div>';
}

function abnormalConfirmCard(node) {
  return '<div class="id-confirm-card id-confirm-abnormal">' +
    '<h4>' + icon('warn', 14) + ' 等待人工确认 · ' + esc(node.name) + '</h4>' +
    '<div class="sub">该节点处于等待确认状态，但缺少可识别的确认信息（可能是旧数据或状态不同步）。本卡片不提供提交入口，请刷新后重试。</div>' +
    '<div style="margin-top:8px"><button class="btn" id="cf-refresh">' + icon('refresh', 12) + '刷新详情</button></div>' +
    '</div>';
}

export function confirmCard(node, runNode, mode) {
  if (mode === 'confirmation') {
    const request = confirmationOf(runNode);
    return request ? confirmationCard(node, runNode, request) : abnormalConfirmCard(node);
  }
  if (mode === 'abnormal') return abnormalConfirmCard(node);
  return nodeConfirmCard(node, runNode);
}
