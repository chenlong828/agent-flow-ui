/**
 * 运行详情的时间/耗时格式化（CMP-instances 与节点视图共用）。
 */

import { DF } from '../ui.js';

export function fmtTime(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? '—' : DF.fmtClock(new Date(ms));
}

export function fmtMs(fromIso, toIso) {
  const from = fromIso ? Date.parse(fromIso) : NaN;
  if (Number.isNaN(from)) return '—';
  const to = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(to)) return '—';
  return DF.fmtDur(Math.round(Math.max(0, to - from) / 1000));
}
