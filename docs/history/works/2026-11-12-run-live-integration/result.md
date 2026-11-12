---
layer: history
module: global
status: frozen
updated: 2026-11-12
---

# 结果：运行实例与工作流编辑器对齐 B4/B3 现行 API

## 1 结论

运行实例两页已从 MOCK 切到 B4 live：列表/详情/终止/人工确认/会话日志读取真实 `/api/v1/runs`，发起运行按「工作流 + Harness + 工作区路径 + 所见即所得意图」提交并跳转详情。工作流编辑器节点类型对齐 B3 七类（删 `fanin`、增 `split`、`fanout` 前驱必须是 `split`）。后端未提供的控制入口保留并置灰。

## 2 验收结果

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 快速门禁 | `npm run test:gate` | 通过（语法/文档/索引/依赖/架构/场景追溯/BFF 12/12） |
| 运行场景 | `node tools/verify-m1-scenarios.js SCN-0004` | 5/5 通过（T1 列表、T2 详情、T3 决策、T4 取消、T5 发起） |
| M1 全量 | `node tools/verify-m1-scenarios.js` | 50/50 通过 |
| 页面冒烟 | `node tools/smoke-test.js` | 13/13 通过 |
| 工作流纯逻辑 | `node --test tests/workflow` | 26/26 通过 |
| 工作流列表/编辑器 | `node tools/verify-workflow-list.js`、`node tools/verify-workflow-editor.js` | 14/14、11/11 通过 |
| 真实后端目视 | Playwright + `:3000` → BFF `:3100` | 列表 10 条、详情节点状态、发起运行 `201`、终止 `200`，console 零错误 |

## 3 结论落点

| 产物 | 落点 |
|---|---|
| 运行数据服务 | `assets/js/run/data.js`；规格 `docs/design/components/run-data/spec.md` |
| 运行列表/详情 | `assets/js/pages/instances.js`、`assets/js/pages/instance-detail.js`；规格 `docs/design/components/instances/spec.md` |
| 意图编辑器适配 | `assets/js/shared/markdown-editor.js`（`skill-detail-markdown.js` 改为委托） |
| 节点类型对齐 | `assets/js/workflow/model.js`、`validate.js`、`views/{canvas,inspector}.js`、`pages/workflow-editor.js` |
| 场景 | `docs/design/scenarios/operations/instances/control-instance/scenario.md`（`SCN-0004` verified 5/5） |
| 系统地图 | `docs/design/architecture.md`（数据源、依赖边、数据所有权、验证矩阵） |
| 测试替身 | `tools/fake-b1.js`（run 端点与夹具、Harness `clientId`）、`tools/test-harness.js`（`/workflows/{id}/runs` 不走 B3）、`tools/verify-m1-scenarios.js`（SCN-0004 重写） |

## 4 偏差与未覆盖

- run 详情不含启动图快照，轨迹按当前工作流图渲染；工作流被改后节点名可能漂移，未做快照对齐。
- 暂停/恢复、节点重试、从节点重跑、输入输出、工作区留痕、fan-out 下钻：后端未提供，入口置灰并注明。
- `split`/`fanout` 可保存、不可启动；启动被后端 `400 unsupported_node_type` 拒绝，页面按错误文案提示。
- 非终态 5s 轮询，无推送；页面隐藏时跳过一次轮询。
- 真实后端验证期间经 UI 发起过 1 次运行（工作区 `/tmp/agentflow/ui-check-*`），随后用页面终止；该 run 保留在开发库作为证据。

## 5 未决

- Harness 页仍未展示 `clientId`/`clientToken`，也没有节点登记/解绑入口；发起运行依赖这些已绑定的 Harness。是否把登记接进 Harness 详情另立任务。
- 运行详情是否需要展示冻结图快照（需后端 `RunDetail` 增加 graph 字段）。
