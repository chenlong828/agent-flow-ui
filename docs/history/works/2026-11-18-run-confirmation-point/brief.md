---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：执行中确认点 UI 对接（REQ-0026）

## 需求

- `REQ-0026`：执行中确认点（MCP `confirmation_request`）；新增 `SCN-0022` T1–T8。
- 上游依据：agent-flow-orchaster `docs/works/2026-11-18-review-verdict-mcp/ui-integration-proposal.md`。

## 背景

调度层已让 client 在 agent/design 执行中通过 MCP 提交确认请求：任务以 `succeeded` 结算，run 进入 `waiting_confirm`，人工回答后创建续跑任务，在同一 session 继续当前节点；`visit` 不变、`taskId` 替换，reject 是「带拒绝意见继续」而不是回退。

本仓库原来的 `waiting_confirm` 只对应 `confirm` 节点。本次让 UI 按 `RunNodeView.verdict.kind` 区分两种来源，并复用同一张确认卡的骨架；后端端点、状态、DTO 均不改。

## 验收标准

1. `SCN-0022` T1–T8 通过，`SCN-0004` T1–T11 不回归。
2. 执行中确认卡显示问题、上下文（Markdown）、候选答案与补充说明；`confirm` 节点仍显示原文案。
3. pass/reject 的 `comment` 为「选项 + 换行 + 补充说明」；无 `answer` 字段；reject 未选未填被拦。
4. 成功响应即 `RunDetail`：直接重绘、弹层保持，节点变 `dispatched`、`taskId` 替换、`visit` 不变。
5. 失败映射：400/503 恢复按钮，404/409 刷新，409 不自动重复提交；提交中按钮禁用。
6. 异常 verdict 只读；历史轮不出现确认卡；轮询不清空用户输入。
7. 门禁：`check:syntax`、`check:style`、`check:docs`、`docs:index:check`、`check:architecture`、`check:scenario-trace`、`npm test` 通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0026-01 | change | `CMP-instances` | 已完成 | `assets/js/run/node-view.js`、`assets/js/pages/instance-detail.js`、`pages/instance-detail.html` |
| T-0026-02 | change | `CMP-run-data` | 已完成 | `assets/js/run/data.js`（决策错误映射） |
| T-0026-03 | verify | 两个组件 | 已完成 | `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`、`SCN-0022`、`SCN-0004` |
| T-0026-04 | docs | 文档树 | 已完成 | `REQ-0026`、`SCN-0022`、`instances/spec.md`、`architecture.md`、`roadmap.md`、`_index.md` |

## 装载清单（必读）

- `docs/requirements/REQ-0026-execution-confirmation-point.md`
- `docs/design/scenarios/operations/instances/confirm-during-execution/scenario.md`
- `docs/design/components/instances/spec.md` §3.5
- `assets/js/run/node-view.js`、`assets/js/pages/instance-detail.js`
- `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`

## 已确认（默认采用）

- 2026-11-18 用户要求按上游提案落 UI；提案明确「不需要新端点、不需要新状态」，只消费 `RunNodeView.verdict`。
- 执行中确认点与 `confirm` 节点共用卡片骨架，用 `mode` 参数化；`confirm` 节点行为保持不变。
- reject 的统一文案为「已拒绝，意见已反馈」，不出现「流程回退」。
- 异常/旧数据只读提示，不提交；不做多确认点并行、超时策略与移动端。
