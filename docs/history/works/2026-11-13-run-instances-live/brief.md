---
layer: history
module: global
status: frozen
updated: 2026-11-13
---

# 工序：运行实例同源接入与发起运行（B4）

> 需求承接：`REQ-0019`。本工序为补建记录：实现已于 2026-11-12 合入并推送，2026-11-13 按用户要求单独立卡后建工序。

## 背景

后端 B4 运行编排（`API-42`–`API-47`）就绪后，UI 运行实例两页仍为 MOCK。2026-11-12 用户要求按现行 API 适配界面，明确发起运行要「Harness 从列表选、路径用文本框、意图用所见即所得编辑器」，后端没有的能力保留入口但置灰。实现与验证同日完成；当时挂在 `REQ-0004` 下，2026-11-13 用户裁定单独立卡（`REQ-0019`）并补建本工序。

## 定级与确认

- 定级：**P2**（新增 UI 内部数据服务、实质性跨模块、数据所有权从 `MOCK` 切到 B4；未改后端契约与 UI 组件切分）。
- 确认记录：2026-11-12 用户确认范围（运行实例 + 工作流编辑器节点类型）与缺失能力处理（保留并置灰）；2026-11-13 用户要求新卡 + 工序并提交推送。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 | 提交 |
|---|---|---|---|---|---|
| `T-RUNLIVE-01` | change | `CMP-run-data` | 完成 | `run/data` 6 个操作 + 状态词表 | `cf2109b` |
| `T-RUNLIVE-02` | change | `CMP-instances` | 完成 | 列表/详情 live、发起运行（Harness + 路径 + Milkdown 意图）、终止、人工确认、日志；默认工作区路径 | `cf2109b` / `36c75ab` |
| `T-RUNLIVE-03` | change | `CMP-workflow-editor` | 完成 | 七类节点：删 `fanin`、增 `split`、`fanout` 前驱规则 | `9696426` |
| `T-RUNLIVE-04` | change | `CMP-instances` | 完成 | 节点消息 Markdown 渲染 + 全屏浮层（P3，另见 `2026-11-12-run-message-rendering`） | `482c970` |
| `T-RUNLIVE-05` | verify | global | 完成 | 场景、门禁、真实后端验证与规格归档 | `cf2109b` 等 |

装载清单：`docs/requirements/REQ-0019-run-instances-live.md`、`docs/design/components/instances/spec.md`、`docs/design/components/run-data/spec.md`、`docs/design/scenarios/operations/instances/control-instance/scenario.md`。

## 验收标准

1. `SCN-0004` 5/5；M1 全量 50/50；13 页冒烟通过；`npm run test:gate` 通过。
2. 真实后端：列表/详情读取、发起运行 `201`、终止 `200`、人工确认决策可用；console 零错误。
3. 后端未提供的能力入口置灰并注明；不出现 MOCK 回落。

## 已知偏差

- 运行详情按当前工作流图渲染（`RunDetail` 无启动图快照）。
- `split`/`fanout` 可保存、启动被后端 `400 unsupported_node_type` 拒绝。
- 暂停/恢复/重试/重跑/IO 留痕/子任务下钻后端未提供，入口置灰。
