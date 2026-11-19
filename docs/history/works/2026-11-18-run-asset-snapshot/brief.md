---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：资产删除后的运行快照 UI 对接（REQ-0027）

## 需求

- `REQ-0027`：资产删除后的运行快照展示；扩展 `SCN-0004` T12–T16。
- 上游依据：agent-flow-orchaster `docs/works/2026-11-18-run-asset-detach/ui-integration-proposal.md`（P2，后端已上线）。

## 背景

工作流/专家/Harness 可在运行结束后删除。后端已在 `RunSummary` 增加 `workflowName`/`harnessName`，在 `RunDetail` 增加冻结 `graph`，在 `RunNodeView` 增加 `expertName`；删除被未终态 run 引用时返回 409 `referenced`，`details.references` 可含 `type="run"`。UI 目前运行详情回查 `GET /workflows/{id}`、列表用实时工作流名、节点弹层用专家 ID 查名，资产删除后会 404 或显示裸 UUID。

## 验收标准

1. 运行详情用 `RunDetail.graph` 画图，标题用 `workflowName`；有 graph 时不发 `GET /workflows/{id}`；graph 缺失回退旧接口，仍失败显示无图占位而非整页错误。
2. 节点弹层「专家」优先 `RunNodeView.expertName`；专家已删除时显示快照名与中性圆点，不显示裸 UUID；无快照且查不到时显示「—」。
3. 运行列表与 `?wfId=` 筛选横幅优先 `workflowName`；已删除工作流的运行仍可读。
4. 工作流/专家/Harness 删除对话框包含「未结束的运行」；409 `referenced` 且 `references` 含 run 时提示「有未结束的运行」并保留列表/对话框。
5. 旧字段与旧路径保留；`run.graph` 缺失时回退逻辑不回归。
6. `SCN-0004` T1–T16 通过；`SCN-0021`/`SCN-0022` 不回归；`npm test` 通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0027-01 | change | `CMP-instances` | 已完成（2026-11-18） | `instance-detail.js`、`instances.js`、`run/node-view.js`、`instances/spec.md` |
| T-0027-02 | change | `CMP-workflow-list` / `CMP-experts` / `CMP-harnesses` | 已完成（2026-11-18） | 三页删除弹窗、`api.js`/`workflow/data.js` 409 映射、对应规格 |
| T-0027-03 | test | 运行两页 + 三资产页 | 已完成（2026-11-18） | `fake-b1.js`、`verify-m1-scenarios.js`、`SCN-0004` T12–T16 |
| T-0027-04 | docs | 文档树 | 已完成（2026-11-18） | `REQ-0027`、`SCN-0004`、`instances`/`run-data`/`workflow-list`/`experts`/`harnesses` 规格、`architecture.md`、`roadmap.md` |

## 装载清单（必读）

- `docs/requirements/REQ-0027-run-asset-snapshot.md`
- `docs/design/scenarios/operations/instances/control-instance/scenario.md`
- `docs/design/components/instances/spec.md`、`run-data/spec.md`、`workflow-list/spec.md`、`experts/spec.md`、`harnesses/spec.md`
- `assets/js/pages/instance-detail.js`、`instances.js`、`workflow-list.js`、`experts.js`、`harnesses.js`
- `assets/js/run/node-view.js`、`assets/js/api.js`、`assets/js/workflow/data.js`
- `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`
- 上游提案全文

## 已确认

- 2026-11-18 按上游 P2 提案执行；旧字段保留，`run.graph` 缺失时回退 `workflows.get`。
- 不新增页面；不自动取消运行；删除被活跃 run 引用时保留原页面并提示。
