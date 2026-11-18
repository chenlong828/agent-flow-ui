---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：发起运行的工作区路径历史（REQ-0024）

## 需求

- `REQ-0024`：发起运行弹窗按执行节点保存最近 10 条工作区路径，支持下拉选择与单条删除；扩展 `SCN-0004` T7/T8。

## 背景

`CMP-instances` 的发起运行弹窗中，工作区路径是单行文本，默认值为 `/Users/chenlong/hundsun/af-workspace-demo`。工作区路径是执行节点上的绝对路径，长且容易输错；同一执行节点的高频工作区反复手输成本高。路径只在某台执行节点（`clientId`）上有效，因此历史必须按执行节点隔离，不能跨节点复用。

## 验收标准

1. 打开弹窗后，下拉按当前 Harness 的 `clientId` 列出最近路径，最多少 10 条、最近置顶；切换 Harness 时列表随之切换，输入框内容不被自动改写。
2. 点选历史项填入输入框；列表项右侧小叉只删除该条历史，不改输入框；删除后列表与 localStorage 同步。
3. 发起运行成功后才写入历史：同路径去重置顶、每节点封顶 10 条；失败不写入。
4. 损坏 JSON、版本不符、含其他 `clientId` 的历史不进入下拉与表单，仍可手输绝对路径。
5. `node tools/verify-m1-scenarios.js SCN-0004` 8/8；`npm run test:gate` 通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0024-01 | change | `CMP-instances` | 已完成（2026-11-18） | `assets/js/pages/instances.js`、`assets/css/main.css`、`docs/design/components/instances/spec.md`、`SCN-0004` |
| T-0024-02 | change | `CMP-instances`（测试） | 已完成（2026-11-18） | `tools/verify-m1-scenarios.js`（T7/T8） |
| T-0024-03 | doc | global | 已完成（2026-11-18） | `REQ-0024`、`SCN-0004`、`instances` 规格、`architecture.md`、`roadmap.md` |

## 装载清单（必读）

- `docs/requirements/REQ-0024-launch-workspace-history.md`
- `docs/design/scenarios/operations/instances/control-instance/scenario.md`
- `docs/design/components/instances/spec.md`
- `assets/js/pages/instances.js`、`assets/css/main.css`
- `tools/verify-m1-scenarios.js`、`tools/test-harness.js`、`tools/fake-b1.js`

## 领取的开放问题

- 无。

## 确认

- 2026-11-18 用户三问确认：按 `clientId` 隔离（同一执行节点的多个 Harness 共用历史）；输入框 + 下拉选择；发起成功后写入；列表项右侧增加小叉删除。
