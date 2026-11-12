---
layer: history
module: global
status: frozen
updated: 2026-11-12
---

# 工序：运行实例与工作流编辑器对齐 B4/B3 现行 API

## 需求

`REQ-0004`（运行实例监控与运行控制）；顺带对齐 `REQ-0017`（工作流编辑器）的节点类型闭集。用户 2026-11-12 指示：按后端现行 API 调整界面；发起运行从 Harness 列表选节点、工作区路径用文本框、启动意图用所见即所得编辑器；后端没有的能力入口保留但置灰。

## 背景

后端（`agent-flow-orchaster` `49b6bc8`）已落地运行编排：产品面新增 `API-42`–`API-47`（启动 run、run 列表/详情、取消、confirm 决策、会话日志），执行面升到 v3。UI 的运行实例两页仍是 MOCK 原型；工作流编辑器的节点类型仍是旧的 `fanin` 口径，而 B3 已删除 `fanin` 并新增 `split`（`fanout` 唯一前驱必须是 `split`）。两处不齐会导致「能画不能存/能存不能跑」。

## 目标

1. 运行列表/详情改为 live `/api/v1/runs`：状态 Tab、工作流名 join、轨迹图节点状态、终止、人工确认、会话日志下载。
2. 发起运行弹窗：工作流下拉、Harness 下拉（仅 `enabled && clientId`）、工作区路径文本框、Milkdown 所见即所得意图编辑、autoConfirm。
3. 工作流编辑器对齐 B3 七类节点：删除 `fanin`、新增 `split`、`fanout` 前驱规则。
4. 后端未提供的控制能力（暂停/恢复、节点重试、从节点重跑、输入输出、工作区留痕、fan-out 下钻）保留入口并置灰，注明原因。
5. 场景 `SCN-0004` 按 live 重写（3 正 1 反 + 发起运行），playwright 可执行。

## 非目标

- 不做暂停/恢复/重跑（后端无端点）；不做运行历史回放；不接实例级鉴权。
- 不做 `split`/`fanout` 的启动执行（后端第二期）。
- 不新增运行时依赖：意图编辑器复用已准入的 Milkdown 7.7.0（`DEP-0001`）。
- 不改 BFF 转发策略与超时。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 |
|---|---|---|---|---|
| `T-RUNUI-01` | change | `CMP-run-data` | 完成 | `assets/js/run/data.js`：6 个操作 + 状态词表 + `errorText` |
| `T-RUNUI-02` | change | `CMP-instances` | 完成 | 列表/详情/发起运行改 live；未提供能力置灰；`shared/markdown-editor` 抽出复用 |
| `T-RUNUI-03` | change | `CMP-workflow-editor` | 完成 | `model`/`validate`/`views`/palette 对齐七类节点 |
| `T-RUNUI-04` | verify | global | 完成 | `SCN-0004` 5/5；`npm run test:gate`、冒烟 13 页、M1 49/49、工作流 26 条 + SCN-0018/0019 |
| `T-RUNUI-05` | doc | global | 完成 | `run-data` 新规格、`instances`/`workflow-editor`/`architecture` 更新、`SCN-0004` 重写、REQ 澄清记录 |

装载清单：`docs/design/components/instances/spec.md`、`docs/design/scenarios/operations/instances/control-instance/scenario.md`、`assets/js/workflow/model.js`、`assets/js/workflow/validate.js`、后端 `docs/design/components/http-gateway/spec.md` §4.1.1/§5.9。

## 验收标准

1. `node tools/verify-m1-scenarios.js SCN-0004` 5/5；`npm run test:gate` 通过。
2. `node tools/smoke-test.js` 13/13；`node tools/verify-workflow-list.js`、`verify-workflow-editor.js`、`npm run test:workflow` 通过。
3. 真实后端目视：列表/详情/发起运行/终止均有 200/201 证据，页面无 console 错误。
4. 文档：`check-docs` 通过；组件规格含模块卡 16 项；场景 `verified` 带最近执行证据。

## 风险与偏差

| 项 | 说明 |
|---|---|
| 无 graph snapshot | run 详情不含启动时图快照，轨迹按当前工作流图渲染；工作流被改后节点名可能漂移 |
| 无暂停/重跑 | 后端未提供；入口置灰并注明，不伪造状态迁移 |
| `split`/`fanout` 不可启动 | 保存/校验可过，启动返回 `400 unsupported_node_type`，页面按错误文案提示 |
| 轮询 | 非终态 5s 轮询；页面隐藏时跳过一轮，不引入推送 |
