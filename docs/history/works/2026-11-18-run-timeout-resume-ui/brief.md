---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：超时节点继续执行 UI 对接（REQ-0025）

## 需求

- `REQ-0025`：超时节点继续执行；扩展 `SCN-0004` T9–T11。
- 上游依据：agent-flow-orchaster `docs/works/2026-11-18-run-timeout-resume/ui-integration-proposal.md`。

## 背景

后端已把超时节点置为 `waiting_resume`，run 不再直接结束；新增 `POST /api/v1/runs/{id}/nodes/{nodeId}/resume`。本仓库只做 UI 适配：状态词表、列表筛选、运行详情等待横幅、等待节点弹层继续入口、续跑请求与 409/404/503 处理。上游提案假设「run 详情页 + 当前节点卡片」，本仓库现行为「轨迹图 + 双击 90% 节点弹层」，因此运行级操作落在轨迹图上方的等待横幅，节点级操作落在最新轮节点弹层的等待卡。

## 验收标准

1. `SCN-0004` T9–T11 通过，原 T1–T8 不回归；T1 计数更新为 5 条运行与 5 个 Tab。
2. 列表：新增「等待继续」Tab；`waiting_resume` 显示「执行超时，等待继续」，行内出现「去继续」，终止仍可用。
3. 详情：等待横幅显示节点名、`error.code`/`error.message`、两条提示与「继续执行」「取消运行」；轨迹节点使用 amber 等待继续态；弹层等待卡只在最新轮 `waiting_resume` 节点出现。
4. 续跑：点击后按钮禁用并显示「正在继续…」，只发一次请求；`200` 后 run 变 `running`、节点变 `dispatched`、横幅消失、提示「已提交，等待客户端执行」，同一 `taskId` 保留。
5. 错误：`409` 按 `details.reason` 提示并刷新；`503` 保留按钮；`404` 提示并返回列表；前端不伪造成功。
6. 门禁：`check:syntax`、`check:style`、`check:docs`、`docs:index:check`、`check:architecture`、`check:scenario-trace`、`node tools/verify-m1-scenarios.js SCN-0004` 通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0025-01 | change | `CMP-run-data` | 已完成（2026-11-18） | `assets/js/run/data.js`、`run-data/spec.md`、`REQ-0025`、`SCN-0004` |
| T-0025-02 | change | `CMP-instances` | 已完成（2026-11-18） | `assets/js/pages/instances.js`、`instance-detail.js`、`run/node-view.js`、`run/node-meta.js`、`pages/instance-detail.html`、`assets/css/main.css`、`instances/spec.md` |
| T-0025-03 | verify | 两个组件 | 已完成（2026-11-18） | `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`、`SCN-0004`、`architecture.md`、`roadmap.md` |

## 装载清单（必读）

- `docs/requirements/REQ-0025-run-timeout-resume.md`
- `docs/design/scenarios/operations/instances/control-instance/scenario.md`
- `docs/design/components/instances/spec.md`、`docs/design/components/run-data/spec.md`
- `assets/js/run/data.js`、`assets/js/run/node-view.js`、`assets/js/run/node-meta.js`
- `assets/js/pages/instances.js`、`assets/js/pages/instance-detail.js`
- `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`
- 上游提案全文

## 已确认（默认采用）

- 2026-11-18：按上游提案文案、错误映射与验收清单执行；不新建 SCN，扩展 `SCN-0004`。
- 布局：运行级等待横幅 + 节点弹层等待卡；列表新增「等待继续」Tab（提案「筛选项加等待继续」的落地）。
- 不新增轮询通道；沿用详情页 5s 轮询与现有 toast/modal。
