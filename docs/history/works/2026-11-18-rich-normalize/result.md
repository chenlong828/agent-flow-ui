---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 结果：rich 事件归一化

## 1 结论

`CMP-run-session` 新增 `normalizeEvent`，把 API-51 preview 与 API-52 rich 统一成同一视图模型。实时 rich 事件现在进入统计、筛选、工具合并与行渲染；同一 seq 的 preview 被 rich 替换，拿到 `text/tool.input/output/durationMs/toolCallId`。

## 2 交付物

- `assets/js/run/views/session.js`：`normalizeEvent`、rich `kind` 映射、`text→message`、`tool/usage/permission/stopReason/error` 归一、`toolCallId` 配对、`tool.durationMs` 耗时、同 seq 替换。
- `docs/design/components/run-session/spec.md`、`SCN-0021-T3` 描述更新。
- `tools/verify-node-observability.js`：T3 改为 rich 形状（tool_call/tool_result/thought/usage）。

## 3 验证

- `node tools/verify-node-observability.js`：7/7。
- 真实运行 `01a1ebf5-121c-74b4-a93d-d2c51c195d7d` / n2（实时，后转终态）走查：
  - 实时阶段显示「运行中 · 实时」，工具行 `read/skill/bash` 带 `4ms/11ms/33ms`，统计 117 次工具、Token 211,986、思考 74；
  - 结束后显示 421 条事件、122 次工具（完成 121/失败 1）、Token 220,785、归档 688K；
  - usage/thought 筛选可用，无控制台错误。
- 全量 `npm test`：见收口。

## 4 已知偏差

- 历史 preview 事件仍没有完整工具 I/O、`level`、`messageId`/`toolCallId`；只有实时 rich 事件有。
- 事件详情 JSON 展开仍未做（`REQ-0023` A 档范围）。

## 5 结论落点

| 项 | 落点 |
|---|---|
| 缺陷 | rich 事件未消费 → 已归一化 |
| 组件 | `CMP-run-session` |
| 场景 | `SCN-0021-T3` rich 断言；7/7 |
| 代码 | `assets/js/run/views/session.js` |
