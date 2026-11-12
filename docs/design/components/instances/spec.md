---
layer: design
module: instances
component: CMP-instances
requirement: REQ-0004
scenario: SCN-0004
status: active
updated: 2026-11-12
---

# 运行实例（列表 + 详情，B4 live）

> 导航：运行与运营 / 运行实例　|　形态：列表页 + 独立详情二级页　|　前置：`design/components/ui-shell/spec.md`、`design/components/run-data/spec.md`

## 0 模块卡

> 追溯：`REQ-0004` / `SCN-0004`（verified；Playwright 5 条）。

- 状态：active（2026-11-12 从 MOCK 原型切到 B4 `/runs` live）
- 单元 / 层：组件 / L2 页面组件（列表 + 详情两个页面入口）
- 业务价值：运行观察者与操作者要能看见真实工作流跑到哪一步、失败在哪、并终止或做人工确认；没有它，工作流只能被定义，无法被观察、干预或审批。
- 负责 / 不负责：负责运行列表（状态 Tab/计数/耗时）、详情（轨迹图、节点状态/结论/日志下载）、发起运行（工作流 + Harness + 工作区路径 + 意图）、终止、人工确认决策；不负责工作流定义与画布编辑（`CMP-workflow-editor`）、B1 资产定义、运行状态机（后端运行编排服务）。
- 内部逻辑：列表一次取 `/runs?limit=200` 与 `/workflows?limit=200`，工作流名在页面侧 join；Tab 由 run.state 分组（全部 / created+running / waiting_confirm / done）；详情取 run + 工作流图，`toEditorGraph` 得到画布坐标，节点状态取 `run.nodes` 中该节点最大 `visit` 的行；进行中的 run 每 5s 轮询；人工确认为 `waiting_confirm` 节点写决策；终止调用 cancel 并刷新。
- 数据所有权：读 B4 `RunSummary`/`RunDetail`（经 `CMP-run-data`）与 B3 工作流图（经 `CMP-workflow-data`）；不写任何本地数据、不写 `MOCK`、不用 `sessionStorage`；页面只持有当前列表/详情/选择内存态。
- 公开契约：入口 `pages/instances.html?tab=&wfId=`、`pages/instance-detail.html?id=<runId>`；操作 `CMP-instances#list`、`#launch`、`#detail`、`#cancel`、`#decide`、`#session-log`；不变量：发起运行三个必填（`harnessId`/`workspacePath`/`intentMarkdown`）缺一不提交；Harness 只列 `enabled && clientId`；人工确认只对 `waiting_confirm` 节点出现；终态 run 不显示终止；后端未提供的能力按钮置灰并注明原因。
- 依赖：`DF`（外壳、表格、Tabs、弹窗、Toast、时间格式化）、`CMP-run-data`、`CMP-workflow-data`、`workflow/model`（图映射）、`shared/http`（Harness/专家列表）、`shared/markdown-editor`（发起运行意图编辑）；不 import 其他页面 JS；跨页只走 URL。
- 冷热属性：热（列表/详情轮询、发起运行、决策）；轮询只在非终态运行期间存在，页面隐藏时跳过一轮。
- 变化轴：B4 run DTO 与状态闭集、可用操作集合（当前只有 cancel/decision）、发起运行入参；变化集中在 `run/data` 与两个页面。
- 验证入口：`node tools/verify-m1-scenarios.js SCN-0004`（5 条）；`npm start` + `/pages/instances.html`、`/pages/instance-detail.html?id=<runId>`；真实后端只读走查。
- 验证计划：列表计数与 Tab 分组；详情轨迹/节点状态来自 run.nodes；人工确认推进；取消终止不改状态；发起运行请求体（harness/路径/意图）。
- 预算：列表约 11 KB + 详情约 18 KB + `run/data` 约 5 KB；远低于 120k token。
- 单独运行：`node tools/verify-m1-scenarios.js SCN-0004`。
- 删除测试：删除后运行只能由 API 直接操作，无法观察、终止或审批；复杂度会回流到工作流页面，故保留独立组件。
- 已知偏差：run 详情不含启动时的图快照，轨迹按当前工作流图渲染（工作流被改后节点名可能漂移）；后端未提供暂停/恢复、节点重试、从节点重跑、输入输出、工作区文件留痕与 fan-out 子任务下钻，相关入口置灰并注明「后端未提供」；`split`/`fanout` 可保存但启动返回 `unsupported_node_type`。

## 1 页面定位

运行观察者从列表看到全部 run 的状态与耗时，进入详情看轨迹与节点结论；操作者在这里发起运行、终止运行、对人工确认节点做批准/驳回，并下载执行节点上传的会话日志。

## 2 运行列表页

### 2.1 布局

```
┌──────────────────────────────────────────────────────────────────────┐
│ 运行实例                                            [▶ 发起运行]       │
│ Tab: 全部(10)|进行中|等待人工确认|已结束(10)                          │
├──────────────────────────────────────────────────────────────────────┤
│ 运行     工作流/版本    执行节点      当前节点  状态        耗时   操作 │
│ 01a1cef7 研发演示 r3   client-stub-01 n1      [已终止]     8s    详情 │
│ 01a1cef6 联调确认 r1   client-stub-01 n3      [成功][已归档] 29s   详情 │
│ …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 元素

| 元素 | 说明 |
|---|---|
| 状态 Tab | 全部 / 进行中（`created`+`running`）/ 等待人工确认 / 已结束（`done`）；计数来自当次列表，0 不显示角标 |
| 表格列 | 运行 ID（前 8 位，点击进详情）、工作流名 + `r<revision>`、执行节点 `clientId`、当前节点 `currentNodeId`、状态标签（终态显示 outcome，归档态另起一行）、耗时、开始时间、操作 |
| 操作 | 详情；`waiting_confirm` 行额外「去确认」；非终态行「终止」（二次确认） |
| 空态/错误 | 无运行时提示「从右上角发起运行」；加载失败显示错误文案与重试，不回落夹具 |

### 2.3 发起运行弹窗

| 字段 | 控件 | 必填 | 说明 |
|---|---|---|---|
| 工作流 | 下拉（B3 全部工作流） | 是 | 选项带 `r<revision> · <nodeCount> 节点`；启动时后端冻结图快照 |
| 执行 Harness | 下拉（`/harnesses`） | 是 | 只列 `enabled && clientId`；未绑定/停用的选项置灰并注明原因；无可用项时提交按钮禁用 |
| 工作区路径 | 单行文本（绝对路径） | 是 | 默认值 `/Users/chenlong/hundsun/af-workspace-demo`（可改）；前端校验以 `/` 开头；同 `clientId` + 路径已有实例时后端复用 |
| 启动意图 | Milkdown 所见即所得编辑器 | 是 | 保存时取 `getMarkdown()` 作为 `intentMarkdown`，由 start 节点写入 task-space |
| autoConfirm | 复选框 | 否 | 提交到 `autoConfirm`；`true` 时 confirm 节点自动通过 |

- 提交成功：关闭弹窗、提示运行 ID、跳转详情页；失败按 `validation_error` / `run_conflict` / `unsupported_node_type` 显示错误，弹窗保留。

## 3 运行详情页（独立二级页）

### 3.1 布局

```
┌────────────────────────────────────────────────────────────────────┐
│ ← 返回 │ 01a1cef7 · 工作流 r3 │ [运行中] 耗时 42s [暂停禁用][恢复禁用]  │
│                         [↺从节点重跑 禁用] [⏹终止]                   │
├──────────────────────────────────────────────────┬─────────────────┤
│  轨迹图（B3 图 + run.nodes 状态着色）               │ 节点面板          │
│   [开始✓]──[执行●]──[确认◆]──[结束○]                │ 概要 | 会话日志    │
│   图例：成功/运行中/等待人工/失败/已驳回/待执行        │                  │
└──────────────────────────────────────────────────┴─────────────────┘
```

### 3.2 头部控制区

| 操作 | 交互 |
|---|---|
| 终止 | 非终态可见；二次确认后 `POST /runs/{id}/cancel`，成功刷新详情 |
| 暂停 / 恢复 / 从节点重跑 | 保留入口、置灰，`title` 注明「后端未提供」 |

### 3.3 轨迹图（主区，只读）

- 图来自 `GET /workflows/{workflowId}`，经 `toEditorGraph` 得到节点坐标与阶段框；节点状态来自 `run.nodes`（同节点多次访问取最大 `visit`，副标题显示「第 N 轮」）。
- 状态着色：`queued`→待执行灰、`dispatched`→运行中蓝、`waiting_confirm`→等待人工橙、`succeeded`→成功绿、`rejected`→已驳回紫、`failed`→失败红；未出现的节点为「待执行」。
- 点击节点联动右侧面板；当前节点默认选中。
- 图例固定六类；不显示进度百分比（后端无节点总数之外的进度字段）。

### 3.4 右侧节点面板

| Tab | 内容 |
|---|---|
| 概要 | 节点名/类型、状态、专家、访问轮次、任务 ID、下发/完成时间、节点耗时；`verdict` 原样 JSON、`message`、`error` 分块展示；底部「重试节点」「从此节点重跑」置灰并注明后端未提供；一行说明「输入与输出、工作区文件留痕：当前执行面未提供对应端点」 |
| 会话日志 | 有 `taskId` 时给下载按钮（`GET /runs/{id}/nodes/{nodeId}/session-log`，gzip JSONL）；无 `taskId`（如 confirm 节点）说明不产生会话 |

### 3.5 人工确认（`waiting_confirm`）

- 面板顶部橙色卡片：显示节点 `message`，意见输入框（驳回必填），「批准，继续执行」/「驳回」。
- 决策成功 `POST .../decision` → 刷新详情（节点状态、当前节点、run 状态由后端推进）。
- 重复提交幂等；非 `waiting_confirm` 节点不出现该卡片。

## 4 状态与空态

- 无 run：列表空态给出「发起运行」路径；详情 `404` 显示「运行不存在或已删除」并保留返回入口。
- 终态 run：只读，无终止；归档态在列表与副标题中展示。
- 加载中显示占位；网络/后端错误显示 `errorText` 与重试按钮，不回落 MOCK。

## 5 数据依赖

- 读：`GET /api/v1/runs`、`GET /api/v1/runs/{id}`（`CMP-run-data`）；`GET /api/v1/workflows`、`GET /api/v1/workflows/{id}`（`CMP-workflow-data`）；`GET /api/v1/harnesses`、`GET /api/v1/experts`（`shared/http`）。
- 写：`POST /api/v1/workflows/{id}/runs`、`POST /api/v1/runs/{id}/cancel`、`POST /api/v1/runs/{id}/nodes/{nodeId}/decision`。
- 下载：`GET /api/v1/runs/{id}/nodes/{nodeId}/session-log`。
- 不再读写 `MOCK.instances`；`sessionStorage` 键 `df-new-instance` 已移除。
