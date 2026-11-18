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

function expertCell(node, experts) {
  if (!node.expertId) return '—';
  const expert = experts.get(node.expertId);
  if (!expert) return '<span class="mono">' + esc(node.expertId) + '</span>';
  return '<span class="expert-dot" style="background:' + esc(expert.color) +
    ';width:16px;height:16px;font-size:9px;border-radius:4px">' +
    esc(String(expert.name).slice(0, 1)) + '</span> ' + esc(expert.name);
}

function summaryRows(node, st, runNode, opt, experts) {
  const roundSuffix = opt.manyRounds ? (opt.isLatest ? '（最新）' : '（历史）') : '';
  return [
    ['状态', tag(st.label, STATUS_TONE[st.key] || 'gray')],
    ['节点类型', esc((NODE_META[node.type] || { label: node.type }).label)],
    ['专家', expertCell(node, experts)],
    ['访问轮次', runNode ? '第 ' + esc(runNode.visit) + ' 轮' + roundSuffix : '—'],
    ['任务 ID', runNode && runNode.taskId ? '<span class="mono">' + esc(runNode.taskId) + '</span>' : '—'],
    ['下发时间', esc(fmtTime(runNode && runNode.dispatchedAt))],
    ['完成时间', esc(fmtTime(runNode && runNode.finishedAt))],
    ['节点耗时', runNode && runNode.dispatchedAt ? esc(fmtMs(runNode.dispatchedAt, runNode.finishedAt)) : '—']
  ];
}

function verdictBlock(verdict) {
  return '<div class="section-title">判定结论 <span class="line"></span></div>' +
    '<pre class="id-pre">' + esc(typeof verdict === 'string' ? verdict : JSON.stringify(verdict, null, 2)) + '</pre>';
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
  if (runNode && runNode.verdict) html += verdictBlock(runNode.verdict);
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

export function confirmCard(node, runNode) {
  return '<div class="id-confirm-card">' +
    '<h4>' + icon('warn', 14) + ' 待人工确认 · ' + esc(node.name) + '</h4>' +
    (runNode.message ? mdBlock('确认说明', runNode.message) : '<div class="sub">执行节点正在等待确认决策。</div>') +
    '<input class="inp" id="cf-comment" placeholder="审批意见（批准选填 / 驳回必填）" style="margin:8px 0">' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn primary" id="cf-ok">' + icon('check', 12) + '批准，继续执行</button>' +
      '<button class="btn danger" id="cf-no">' + icon('x', 12) + '驳回</button>' +
    '</div></div>';
}
