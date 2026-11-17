---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 结果：运行节点多轮历史查看

## 1 结论

运行实例详情不再把同一节点收敛成最新一行：`run.nodes` 按 `nodeId + visit` 聚合，画布仍按最新轮着色，节点弹层新增轮次 Tab（「最新 · 第 N 轮 / 第 N-1 轮…」）。历史轮可查看该轮状态、消息、判定结论、错误与会话日志；历史轮只读，人工确认只在最新轮出现。被打回的评审节点仍可打开并看到驳回结论与内容。

## 2 验收结果

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 运行场景 | `node tools/verify-m1-scenarios.js SCN-0004` | 6/6 通过（新增 T6 多轮/历史/日志/打回评审） |
| M1 全量 | `node tools/verify-m1-scenarios.js` | 53 passed, 0 failed |
| 全量门禁 | `npm test` | 通过（语法/文档/索引/依赖/架构/场景追溯/BFF/冒烟/M1/工作流） |
| 视觉证据 | `.local-only/node-detail-modal/run-rounds-latest.png`、`run-rounds-history.png`、`run-review-rejected.png` | 最新轮/历史轮 Tab、历史提示条、评审驳回内容 |

## 3 结论落点

| 产物 | 落点 |
|---|---|
| 多轮聚合与轮次弹层 | `assets/js/pages/instance-detail.js`（`nodeVisits` / `visitList` / `roundsHTML` / `renderNodeModal`） |
| 轮次样式 | `pages/instance-detail.html`（`.id-rounds` / `.id-round-tab` / `.id-history-note`） |
| 会话日志按轮 | `sessionLogUrl(..., { visit })`；下载名 `session-<nodeId>-v<visit>.ndjson.gz` |
| 测试夹具 | `tools/fake-b1.js` 的 `addRunFixture` 与按 `visit` 解析会话日志；`tools/verify-m1-scenarios.js#scn0004T6` |
| 场景 | `SCN-0004`（`docs/design/scenarios/operations/instances/control-instance/scenario.md`，6/6） |
| 需求 | `REQ-0021`；`REQ-0019` 澄清记录 |
| 组件规格 | `docs/design/components/instances/spec.md`、`docs/design/components/run-data/spec.md` |
| 全局 | `docs/design/architecture.md`、`docs/plan/roadmap.md`（M15） |

## 4 边界与未覆盖

- 前端只能展示 `run.nodes` 实际返回的记录；若后端只回传最新一轮，页面不会凭空补历史。当前按 `visit` 聚合并对同一 `visit` 的重复记录取最后一条。
- 会话日志按 `visit` 查询；后端若不支持该参数，历史轮下载会落回默认日志或 404。run-data 规格已声明 `{visit, attempt}`，本次只使用 `visit`。
- 同一轮内多次 `attempt` 的细分未展开，仍按 `visit` 聚合；人工确认与运行控制只对最新轮开放。
- 轮询时停留在历史轮会保持当前轮；该历史轮若被后端移除，回落到最新轮。
