---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 工序：运行节点多轮历史查看

## 需求

- `REQ-0021`：运行节点多轮历史查看。

关联：`REQ-0019`（运行实例 live）/ `SCN-0004`；前置 `REQ-0020`（节点详情双击 90% 弹层）。

## 背景

运行详情此前把 `run.nodes` 按 `nodeId` 收敛为最新 `visit` 一行，弹层只展示最新轮。节点重新进入或评审打回后，上一轮产出、打回原因与评审结论都看不到，无法复盘回退链路。用户要求用 Tab 展示最新版与历史轮，打回后的评审内容也要保留。

## 目标

1. 按 `nodeId + visit` 聚合 `run.nodes`，画布仍按最新轮着色，弹层保留全部轮次。
2. 多轮节点在弹层顶部显示轮次 Tab：「最新 · 第 N 轮 / 第 N-1 轮…」；默认最新轮。
3. 历史轮只读；概要、消息、判定结论、错误、会话日志均按所选轮展示；历史轮不出现人工确认入口。
4. 会话日志 URL 带 `visit` 查询参数，下载文件名区分轮次。
5. 轮询刷新时：停留在最新则跟随新轮；停留在历史则保持；历史轮被移除时回落到最新。
6. 场景 `SCN-0004` 增补多轮断言并保持 `verified`。

## 非目标

- 不改后端 `RunDetail` / `RunNodeView` 结构；不恢复节点重试/从节点重跑。
- 不展示同一轮内多次 `attempt` 的细分；不在画布上展开历史轮。
- 不新增运行时依赖。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-HIS-01 | change | `CMP-instances` | 完成 | `assets/js/pages/instance-detail.js`、`pages/instance-detail.html`、`SCN-0004` |
| T-HIS-02 | test | `CMP-test-harness` | 完成 | `tools/fake-b1.js`（多轮夹具注入 + 按 visit 的日志）、`tools/verify-m1-scenarios.js`（SCN-0004-T6） |
| T-HIS-03 | verify | global | 完成 | `node tools/verify-m1-scenarios.js SCN-0004`、`node tools/verify-m1-scenarios.js`、`npm test` |
| T-HIS-04 | doc | global | 完成 | `REQ-0021`、`SCN-0004`、`instances`/`run-data` 规格、`architecture`、`roadmap` |

## 验收标准

1. 多轮节点弹层显示「最新 · 第 2 轮 / 第 1 轮」，默认最新；切换历史轮显示上一轮消息与「历史轮次」提示，且无确认入口。
2. 会话日志链接含 `visit`，下载文件名为 `session-<nodeId>-v<n>.ndjson.gz`。
3. 打回后的评审节点仍能打开并显示驳回结论与内容。
4. `SCN-0004` 6/6、M1 全量通过、`npm test` 通过。
