/** 节点类型/状态到画布样式与圆点的映射（纯常量）。 */

export const NODE_META = {
  start: { label: '开始节点', cls: 't-plain' },
  end: { label: '结束节点', cls: 't-plain' },
  agent: { label: '专家执行节点', cls: 't-agent' },
  split: { label: '拆分节点', cls: 't-gateway' },
  review: { label: '评审节点', cls: 't-review' },
  confirm: { label: '人工确认节点', cls: 't-confirm' },
  fanout: { label: '展开节点', cls: 't-gateway' }
};

export const NODE_CLASS = {
  queued: 'st-pending',
  dispatched: 'st-run',
  waiting_confirm: 'st-wait',
  succeeded: 'st-ok',
  rejected: 'st-rollback',
  failed: 'st-fail'
};

export const NODE_DOT = {
  queued: 'gray',
  dispatched: 'blue',
  waiting_confirm: 'orange',
  succeeded: 'green',
  rejected: 'purple',
  failed: 'red'
};
