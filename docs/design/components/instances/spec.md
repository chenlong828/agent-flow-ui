---
layer: design
module: instances
component: CMP-instances
requirement: REQ-0019
scenario: SCN-0004
status: active
updated: 2026-11-18
---

# 运行实例（列表 + 详情，B4 live）

> 导航：运行与运营 / 运行实例　|　形态：列表页 + 独立详情二级页　|　前置：`design/components/ui-shell/spec.md`、`design/components/run-data/spec.md`
>
> 详情页源码：`assets/js/pages/instance-detail.js`；画布 `assets/js/run/views/run-canvas.js`；节点弹层片段 `assets/js/run/node-view.js`；时间格式化 `assets/js/run/format.js`。

## 0 模块卡

> 追溯：`REQ-0019`（原 `REQ-0004`）/ `SCN-0004`（verified；Playwright 6 条，2026-11-17 节点详情改双击 90% 弹层与多轮历史）。

- 状态：active（2026-11-12 从 MOCK 原型切到 B4 `/runs` live）
- 单元 / 层：组件 / L2 页面组件（列表 + 详情两个页面入口）
- 业务价值：运行观察者与操作者要能看见真实工作流跑到哪一步、失败在哪、并终止、做人工确认或让超时节点继续执行；没有它，工作流只能被定义，无法被观察、干预或审批。
- 负责 / 不负责：负责运行列表（状态 Tab/计数/耗时）、详情（轨迹图、节点状态/结论/日志下载）、发起运行（工作流 + Harness + 工作区路径 + 意图）、终止、人工确认决策；不负责工作流定义与画布编辑（`CMP-workflow-editor`）、B1 资产定义、运行状态机（后端运行编排服务）。
- 内部逻辑：列表一次取 `/runs?limit=200` 与 `/workflows?limit=200`，工作流名在页面侧 join；Tab 由 run.state 分组（全部 / created+running / waiting_confirm / waiting_resume / done）；详情取 run + 工作流图，`toEditorGraph` 得到画布坐标，节点颜色取 `run.nodes` 中该节点最大 `visit` 的行；同一节点按 `nodeId + visit` 保留全部轮次，弹层中用轮次 Tab 切换最新与历史；单击节点只选中高亮，双击节点在 90% × 90% 视口弹层中查看概要、文件、执行会话与会话日志；页头「任务文件」打开同尺寸任务文件弹层；进行中的 run 每 5s 轮询；人工确认为 `waiting_confirm` 节点写决策；`waiting_resume` 运行在轨迹上方显示等待横幅，调用续跑端点前禁用按钮、成功后用响应 `RunDetail` 更新并再拉一次详情，409/404/503 分别提示、返回列表或保留按钮；终止调用 cancel 并刷新。发起运行弹窗的工作区路径输入框右侧下拉列出当前 Harness 对应执行节点（`clientId`）的最近路径，点选填入、小叉删除单条，发起成功后将提交路径置顶记入历史。弹层骨架只建一次：轮询只同步标题/轮次/确认卡/概要，活动文件/会话面板不重建，EventSource 不重开；切 Tab/轮次/关闭时 `unmount` 对应视图。
- 数据所有权：读 B4 `RunSummary`/`RunDetail`（经 `CMP-run-data`）、B3 工作流图（经 `CMP-workflow-data`）与 client 文件/session（经 `CMP-run-data` 的只读方法）；写 localStorage `df-launch-workspace-paths`（`{v:1,byClient:{<clientId>:string[]}}`，仅 UI 偏好：按执行节点保存最近 10 条工作区绝对路径，最近置顶、去重、成功后写入；损坏/版本不符/非法条目按空历史处理）；不写 `MOCK`、不用 `sessionStorage`；页面只持有当前列表/详情/选择/弹层与视图句柄内存态。
- 公开契约：入口 `pages/instances.html?tab=&wfId=`、`pages/instance-detail.html?id=<runId>`；操作 `CMP-instances#list`、`#launch`、`#detail`、`#cancel`、`#decide`、`#resume-node`、`#session-log`、`#run-files`、`#node-modal`；不变量：详情不用常驻右侧面板，双击节点才打开 90% × 90% 弹层（内容内部滚动，Esc/遮罩/× 关闭）；弹层 Tab 固定为 概要 / 文件 / 执行会话 / 会话日志；页头「任务文件」与节点文件 Tab 共用 `CMP-run-files`；多轮节点必须保留历史轮次，最新轮跟随轮询、历史轮只读且不出现人工确认与继续执行入口；会话日志按 `visit` 下载；执行会话按 `visit` 建流；发起运行三个必填（`harnessId`/`workspacePath`/`intentMarkdown`）缺一不提交；工作区路径历史按选中 Harness 的 `clientId` 隔离、每节点最多 10 条、只保留以 `/` 开头的路径，删除只作用于历史不改输入框；Harness 只列 `enabled && clientId`；人工确认只对 `waiting_confirm` 节点出现；继续执行只对 `waiting_resume` 当前节点最新轮出现，请求期间禁用按钮，不传请求体，不展示 `sessionId`/`attempt`；终态 run 不显示终止；后端未提供的能力按钮置灰并注明原因。
- 依赖：`DF`（外壳、表格、Tabs、90% 大弹层、Toast、时间格式化）、`CMP-run-data`、`CMP-workflow-data`、`workflow/model`（图映射）、`shared/http`（Harness/专家列表）、`shared/markdown-editor`（发起运行意图编辑）；不 import 其他页面 JS；跨页只走 URL。
- 冷热属性：热（列表/详情轮询、发起运行、决策）；轮询只在非终态运行期间存在，页面隐藏时跳过一轮。
- 变化轴：B4 run DTO 与状态闭集、可用操作集合（当前只有 cancel/decision）、发起运行入参；变化集中在 `run/data` 与两个页面。
- 验证入口：`node tools/verify-m1-scenarios.js SCN-0004`（11 条）、`node tools/verify-node-observability.js`（SCN-0021，5 条）；`npm start` + `/pages/instances.html`、`/pages/instance-detail.html?id=<runId>`；真实 `waiting_resume` run `01a1ee50…/n3` 只读走查（仅展示，不点击续跑）。
- 验证计划：列表计数与 Tab 分组（含等待继续）；详情轨迹/节点状态来自 run.nodes；双击节点打开 90% 弹层且不出现右侧面板、内容超高走弹层内部滚动；四个 Tab 切换；页头任务文件；多轮节点显示最新/历史 Tab、历史轮只读、按轮下载会话日志、按轮建会话流；轮询不重置文件目录/选中文件、不重开 EventSource；切 Tab/关闭弹层关闭 EventSource；人工确认推进；取消终止不改状态；发起运行请求体（harness/路径/意图）；工作区路径历史按 `clientId` 隔离、下拉点选、单条删除、成功后置顶/去重/封顶 10 条，损坏或他节点数据不进入表单；等待横幅显示超时码与两条提示、继续按钮 loading/禁用、成功后 run 变 `running` 且节点变 `dispatched`、409 按 reason 提示、503 保留按钮、非等待节点无继续入口。
- 预算：列表约 20 KB + 详情约 24 KB + `run/data` 约 8 KB；远低于 120k token。
- 单独运行：`node tools/verify-m1-scenarios.js SCN-0004`。
- 删除测试：删除后运行只能由 API 直接操作，无法观察、终止或审批；复杂度会回流到工作流页面，故保留独立组件。
- 已知偏差：run 详情不含启动时的图快照，轨迹按当前工作流图渲染（工作流被改后节点名可能漂移）；后端未提供暂停/恢复、节点重试、从节点重跑、输入输出与 fan-out 子任务下钻，相关入口置灰并注明「后端未提供」；`split`/`fanout` 可保存但启动返回 `unsupported_node_type`。2026-11-17 节点详情从右侧面板改为双击 90% × 90% 弹层（`REQ-0020`），概要与会话日志不再常驻；节点消息/确认说明直接按 Markdown 在弹层内展示，移除了原来的二次「全屏」入口（`SCN-0004-T2/T4`）。同日补多轮历史（`REQ-0021`）：同一节点按 `nodeId + visit` 聚合，弹层轮次 Tab 查看最新与历史；历史轮只读，确认入口只在最新轮；历史会话日志按 `visit` 下载。若后端只回传最新一轮，页面只能展示收到的记录，前端不做丢失数据的兜底（`SCN-0004-T6`）。同日接入节点观测（`REQ-0022` / `SCN-0021`）：弹层新增「文件」「执行会话」Tab 与页头「任务文件」入口，BFF 对 SSE/raw 改为流式；文件是 run 级、会话是 `nodeId + visit` 级；代码预览只显示语言标签，不引入 Prism。2026-11-18 发起运行工作区路径增加按 `clientId` 隔离的最近 10 条历史（`REQ-0024` / `SCN-0004-T7/T8`）：历史只存本机 localStorage，不校验路径在执行节点上是否存在；换浏览器或清缓存后历史为空，后端仍以 `workspacePath` 为准。同日接入超时节点继续执行（`REQ-0025` / `SCN-0004-T9/T10/T11`）：`waiting_resume` 为非终态，等待横幅与节点等待卡共用续跑处理；UI 不传 `sessionId`、不感知 attempt，等待期工作区占用与 TTL 由后端约束。

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
| 状态 Tab | 全部 / 进行中（`created`+`running`）/ 等待人工确认 / 等待继续（`waiting_resume`）/ 已结束（`done`）；计数来自当次列表，0 不显示角标 |
| 表格列 | 运行 ID（前 8 位，点击进详情）、工作流名 + `r<revision>`、执行节点 `clientId`、当前节点 `currentNodeId`、状态标签（终态显示 outcome，归档态另起一行）、耗时、开始时间、操作 |
| 操作 | 详情；`waiting_confirm` 行额外「去确认」；`waiting_resume` 行额外「去继续」；非终态行「终止」（二次确认） |
| 空态/错误 | 无运行时提示「从右上角发起运行」；加载失败显示错误文案与重试，不回落夹具 |

### 2.3 发起运行弹窗

| 字段 | 控件 | 必填 | 说明 |
|---|---|---|---|
| 工作流 | 下拉（B3 全部工作流） | 是 | 选项带 `r<revision> · <nodeCount> 节点`；启动时后端冻结图快照 |
| 执行 Harness | 下拉（`/harnesses`） | 是 | 只列 `enabled && clientId`；未绑定/停用的选项置灰并注明原因；无可用项时提交按钮禁用 |
| 工作区路径 | 单行文本 + 历史下拉（绝对路径） | 是 | 默认值 `/Users/chenlong/hundsun/af-workspace-demo`（可改）；右侧下拉按当前 Harness 的 `clientId` 列出最近 10 条，点选填入、小叉删除单条；前端校验以 `/` 开头；同 `clientId` + 路径已有实例时后端复用 |
| 启动意图 | Milkdown 所见即所得编辑器 | 是 | 保存时取 `getMarkdown()` 作为 `intentMarkdown`，由 start 节点写入 task-space |
| autoConfirm | 复选框 | 否 | 提交到 `autoConfirm`；`true` 时 confirm 节点自动通过 |

- 提交成功：关闭弹窗、提示运行 ID、跳转详情页；失败按 `validation_error` / `run_conflict` / `unsupported_node_type` 显示错误，弹窗保留。
- 工作区路径历史：localStorage `df-launch-workspace-paths`（`{v:1,byClient:{<clientId>:string[]}}`）；只记录发起成功提交的路径，同路径去重置顶，每 `clientId` 最多 10 条；切换 Harness 时下拉列表切换为该执行节点的历史，输入框内容不因切换自动改写；历史为空时显示空态，仍可手输新路径；损坏 JSON、版本不符、非 `/` 开头条目按空历史/过滤处理，不阻塞发起。

## 3 运行详情页（独立二级页）

### 3.1 布局

```
┌────────────────────────────────────────────────────────────────────┐
│ ← 返回 │ 01a1cef7 · 工作流 r3 │ [运行中] 耗时 42s [暂停禁用][恢复禁用]  │
│                         [↺从节点重跑 禁用] [⏹终止]                   │
├────────────────────────────────────────────────────────────────────┤
│  轨迹图（B3 图 + run.nodes 状态着色，占满内容区）                     │
│   [开始✓]──[执行●]──[确认◆]──[结束○]                                 │
│   图例：成功/运行中/等待人工/失败/已驳回/待执行 · 双击节点查看详情       │
└────────────────────────────────────────────────────────────────────┘

双击节点 → 90% × 90% 节点详情弹层（概要 | 文件 | 执行会话 | 会话日志；内容内部滚动）
```

### 3.2 头部控制区

| 操作 | 交互 |
|---|---|
| 任务文件 | 打开 90% × 90% 任务文件弹层（`CMP-run-files`，默认 `task-space`）；与节点弹层共用同一个只读视图 |
| 终止 | 非终态可见；二次确认后 `POST /runs/{id}/cancel`，成功刷新详情 |
| 继续执行 / 取消运行 | 仅 `waiting_resume` 运行显示在轨迹上方等待横幅；继续执行调用续跑端点，取消运行复用终止确认 |
| 暂停 / 恢复 / 从节点重跑 | 保留入口、置灰，`title` 注明「后端未提供」 |

### 3.3 轨迹图（主区，只读）

- 图来自 `GET /workflows/{workflowId}`，经 `toEditorGraph` 得到节点坐标与阶段框；节点状态来自 `run.nodes`（同节点多次访问取最大 `visit`，副标题显示「第 N 轮」）。
- 状态着色：`queued`→待执行灰、`dispatched`→运行中蓝、`waiting_confirm`→等待人工橙、`waiting_resume`→等待继续琥珀、`succeeded`→成功绿、`rejected`→已驳回紫、`failed`→失败红；未出现的节点为「待执行」。
- 单击节点只切换选中高亮；双击节点打开节点详情弹层。页面加载时不再默认展开任何节点的详情。
- 多轮节点画布仍按最新 `visit` 着色，节点副标题显示「第 N 轮」，`title` 提示「共 N 轮」；历史轮次只在弹层内查看。
- 图例固定七类；不显示进度百分比（后端无节点总数之外的进度字段）。

### 3.4 节点详情弹层（90% × 90%）

| Tab | 内容 |
|---|---|
| 概要 | 节点名/类型、状态、专家、访问轮次、任务 ID、下发/完成时间、节点耗时；`verdict` 原样 JSON、`error` 分块展示；`message` 按 Markdown 渲染（`shared/markdown.js`），详情本身已是大弹层，不再提供二次「全屏」；最新轮 `waiting_resume` 节点显示等待继续卡（超时码、超时说明、原任务原会话提示、继续执行按钮），非等待节点只显示错误块；底部「重试节点」「从此节点重跑」置灰并注明后端未提供；「查看任务文件」切到文件 Tab |
| 文件 | `CMP-run-files` 只读视图：`task-space`/`workspace` 根切换、面包屑、目录懒加载、Markdown/文本/二进制/截断预览；不提供编辑/上传/删除 |
| 执行会话 | `CMP-run-session` 只读视图：会话状态/cwd/起止时间/事件数/归档状态；概览统计（时长、工具、Token、思考）；事件分页、筛选、搜索与工具调用合并；`running` 时 `EventSource` 实时追加；raw 下载；不显示 `sessionId`/`attemptId` |
| 会话日志 | 有 `taskId` 时给下载按钮（`GET /runs/{id}/nodes/{nodeId}/session-log?visit=<n>`，gzip JSONL）；无 `taskId`（如 confirm 节点）说明不产生会话 |

- 弹层由 `DF.modal.open({ size: 'screen' })` 提供：宽高各为视口 90%，头部标题与底部「关闭」固定，`.d-body` 在内容超高时内部滚动；窗口 resize 时重算尺寸。
- **轮次 Tab**：同一 `nodeId` 存在多个 `visit` 时，弹层顶部显示「最新 · 第 N 轮 / 第 N-1 轮…」；默认最新轮，切到历史轮后该轮只读，历史提示条说明确认与操作入口在最新轮。单轮节点不显示轮次 Tab。
- 轮询刷新时弹层保持打开，只更新标题/轮次/确认卡/概要；文件与执行会话面板不重建、EventSource 不重开。停留在最新轮则跟随新轮（执行会话按新 `visit` 重挂载），停留在历史轮则保持当前轮；文件不随轮次变化。历史轮被后端移除时回落到最新轮。
- Tab 切换先 `unmount` 旧视图再 `mount` 新视图；文件 `root/path/selected` 由页面保存并在重挂载时恢复。
- 关闭方式：Esc、点击遮罩、右上 ×、底部「关闭」。

### 3.5 人工确认（`waiting_confirm`）

- 弹层顶部橙色卡片只在最新轮且状态为 `waiting_confirm` 时出现：显示节点 `message`，意见输入框（驳回必填），「批准，继续执行」/「驳回」。历史轮不出现该卡片。
- 卡片内的模型输出同样按 Markdown 渲染；不再提供二次「全屏」入口。
- 决策成功 `POST .../decision` → 刷新详情（节点状态、当前节点、run 状态由后端推进），弹层保持打开并按新状态重绘。
- 重复提交幂等；非 `waiting_confirm` 节点不出现该卡片。

### 3.6 超时继续（`waiting_resume`）

- 运行级等待横幅位于轨迹上方：显示当前节点名、`error.code`（`timeout`/`prompt_timeout`/`idle_timeout`）与 `error.message`、「使用原任务、原会话继续；不会新建运行。继续后仍可能再次超时。」、「等待期间该工作区不能启动新的运行，直到继续或取消。」以及「继续执行」「取消运行」两个按钮；仅 `run.state === 'waiting_resume'` 时出现。
- 节点级等待卡位于最新轮 `waiting_resume` 节点的概要 Tab（与横幅同文案与按钮）；历史轮、非等待节点不出现。两块入口共用同一个续跑处理，`state.resuming` 为真时全部禁用并显示「正在继续…」。
- 点击继续调用 `POST /runs/{id}/nodes/{nodeId}/resume`（无请求体）；成功后以响应 `RunDetail` 更新当前页并再拉一次详情，run 回到 `running`、节点回到 `dispatched`、等待态消失、提示「已提交，等待客户端执行」；`409` 按 `details.reason` 提示并刷新，`503`/网络错误保留按钮可重试，`404` 提示后返回列表。
- 等待期终止沿用 `POST /runs/{id}/cancel`，节点由后端置为失败、run 进入已终止；前端不本地推断终态。
- 等待横幅与等待卡的按钮均为请求期间禁用，防止并发重复提交；不传 `sessionId`、不新建 run、不展示 `attempt`。

## 4 状态与空态

- 无 run：列表空态给出「发起运行」路径；详情 `404` 显示「运行不存在或已删除」并保留返回入口。
- 终态 run：只读，无终止；归档态在列表与副标题中展示。
- `waiting_resume` 是非终态：详情继续 5s 轮询、列表计入非终态并显示终止；等待期该工作区被占用，UI 不隐藏运行也不落到「失败」。
- 加载中显示占位；网络/后端错误显示 `errorText` 与重试按钮，不回落 MOCK。

## 5 数据依赖

- 读：`GET /api/v1/runs`、`GET /api/v1/runs/{id}`（`CMP-run-data`）；`GET /api/v1/workflows`、`GET /api/v1/workflows/{id}`（`CMP-workflow-data`）；`GET /api/v1/harnesses`、`GET /api/v1/experts`（`shared/http`）。
- 写：`POST /api/v1/workflows/{id}/runs`、`POST /api/v1/runs/{id}/cancel`、`POST /api/v1/runs/{id}/nodes/{nodeId}/decision`、`POST /api/v1/runs/{id}/nodes/{nodeId}/resume`。
- 下载：`GET /api/v1/runs/{id}/nodes/{nodeId}/session-log`。
- 本地偏好：读写 localStorage `df-launch-workspace-paths`（发起运行弹窗的工作区路径历史，按 `clientId` 隔离，最多 10 条）；不承载运行业务数据，后端仍以请求体 `workspacePath` 为唯一入参。
- 不再读写 `MOCK.instances`；`sessionStorage` 键 `df-new-instance` 已移除。
