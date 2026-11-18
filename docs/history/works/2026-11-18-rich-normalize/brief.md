---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：rich 事件归一化（旁路）

## 需求

旁路：修复 `CMP-run-session` 对 API-52 rich 事件的消费缺陷，属 `REQ-0023` 执行会话视图的缺陷修复；不新增需求卡。

## 背景

历史事件走 API-51 preview（`event/message/data.tool`），实时 SSE 走 rich（`kind/tool/usage/text`）。原渲染层只按 preview 形状取字段，导致 live 的工具/usage/文本、统计、筛选、合并全部失效；`SCN-0021-T3` 的 EventSource 替身也发 preview 形状，未覆盖 rich。

## 验收标准

1. 新增 `normalizeEvent`，把 preview 与 rich 统一为 `{event,message,data,tool,usage,permission,stopReason,error,...}`。
2. rich `kind` 映射：`tool_call`→`tool_call`、`tool_result`→`tool_call_update`、`usage`→`usage_update`、`thought`→`agent_thought_chunk`、`message`→`agent_message_chunk`、`permission`、`lifecycle`。
3. 同 seq 的 preview 被 rich 替换；rich `tool.durationMs` 用于工具行耗时；`toolCallId` 优先配对。
4. `SCN-0021-T3` 改为 rich 形状断言；真实运行 run `01a1ebf5-121c-74b4-a93d-d2c51c195d7d`/n2 实时走查通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-RICH-01 | fix | `CMP-run-session` | 已完成（2026-11-18） | `assets/js/run/views/session.js`、`run-session/spec.md`、`SCN-0021-T3` |
| T-RICH-02 | verify | 全部 | 已完成（2026-11-18） | `tools/verify-node-observability.js`、真实 run `01a1ebf5…`、`npm test` |

## 装载清单（必读）

- `assets/js/run/views/session.js`
- `docs/design/components/run-session/spec.md`
- `docs/design/scenarios/operations/instances/inspect-node-observability/scenario.md`
- `tools/verify-node-observability.js`
