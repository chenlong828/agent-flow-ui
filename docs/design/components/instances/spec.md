---
layer: design
module: instances
component: CMP-instances
requirement: REQ-0019
scenario: SCN-0004
status: active
updated: 2026-11-19
---

# 运行实例（列表 + 详情，B4 live）

> 导航：运行与运营 / 运行实例　|　形态：列表页 + 独立详情二级页　|　前置：`design/components/ui-shell/spec.md`、`design/components/run-data/spec.md`
>
> 列表/弹窗源码：`assets/js/pages/instances.js`；详情页源码：`assets/js/pages/instance-detail.js`；画布 `assets/js/run/views/run-canvas.js`；节点弹层片段 `assets/js/run/node-view.js`；发起弹窗附件栏 `assets/js/run/views/launch-inputs.js`；初始资料暂存队列 `assets/js/run/input-upload.js`；时间格式化 `assets/js/run/format.js`。

## 0 模块卡

> 追溯：`REQ-0019`（原 `REQ-0004`）/ `SCN-0004`（verified；Playwright 16 条，2026-11-19 发起运行补图片初始资料描述）；执行中确认点见 `REQ-0026` / `SCN-0022`；图片初始资料（提交时上传）见 `REQ-0029` / `SCN-0024`。

- 状态：active（2026-11-12 从 MOCK 原型切到 B4 `/runs` live）
- 单元 / 层：组件 / L2 页面组件（列表 + 详情两个页面入口）
- 业务价值：运行观察者与操作者要能看见真实工作流跑到哪一步、失败在哪、并终止、做人工确认或让超时节点继续执行；没有它，工作流只能被定义，无法被观察、干预或审批。
- 负责 / 不负责：负责运行列表（状态 Tab/计数/耗时）、详情（快照轨迹图、节点状态/结论/日志下载）、发起运行（工作流 + Harness + 工作区路径 + 意图 + 可选图片初始资料）、终止、人工确认决策、历史运行快照展示、运行初始资料的只读缩略图；不负责工作流定义与画布编辑（`CMP-workflow-editor`）、B1 资产定义、运行状态机（后端运行编排服务）。
- 内部逻辑：列表一次取 `/runs?limit=200` 与 `/workflows?limit=200`，工作流名优先取 `RunSummary.workflowName`，缺省才在页面侧 join；Tab 由 run.state 分组（全部 / created+running / waiting_confirm / waiting_resume / done）；详情取 run，优先用 `RunDetail.graph` 经 `toEditorGraph` 得到画布坐标（缺失时才回查 `GET /workflows/{id}`，仍失败显示无图占位），标题用 `RunSummary.workflowName`；轨迹图连线用 `shared/canvas-geometry` 的 `edgeSides/edgePath`（与编辑器同一套锚点规则），画布按 `graph.viewport` 设 `#cvScaler` 的 transform；节点颜色取 `run.nodes` 中该节点最大 `visit` 的行；同一节点按 `nodeId + visit` 保留全部轮次，弹层中用轮次 Tab 切换最新与历史；单击节点只选中高亮，双击节点在 90% × 90% 视口弹层中查看概要、文件、执行会话与会话日志；节点「专家」优先显示 `RunNodeView.expertName`，其次查当前专家列表，最后显示「—」；页头「任务文件」打开同尺寸任务文件弹层；进行中的 run 每 5s 轮询；人工确认为 `waiting_confirm` 节点写决策，`RunNodeView.verdict.kind === "confirmation_request"` 时渲染执行中确认卡（问题/上下文/候选答案/补充说明），否则按 `confirm` 节点渲染批准/驳回；`waiting_resume` 运行在轨迹上方显示等待横幅，调用续跑端点前禁用按钮、成功后用响应 `RunDetail` 更新并再拉一次详情，409/404/503 分别提示、返回列表或保留按钮；终止调用 cancel 并刷新。发起运行弹窗的工作区路径输入框右侧下拉列出当前 Harness 对应执行节点（`clientId`）的最近路径，点选填入、小叉删除单条，发起成功后将提交路径置顶记入历史。发起运行的「初始资料（图片）」只在浏览器内存暂存（64px 缩略图走 object URL），点「发起运行」时才按列表顺序逐张上传（并发 3），随后把 `inputId` 列表随启动请求提交；上传失败或启动失败会 DELETE 已上传暂存项并保留本地图片供重试，启动成功后已绑定项不再删除；关闭弹窗中止在途上传并释放 URL。详情页并行取 `GET /runs/{id}/inputs`，有值时在轨迹上方显示只读缩略图，无值不渲染。弹层骨架只建一次：轮询只同步标题/轮次/确认卡/概要，活动文件/会话面板不重建，EventSource 不重开；切 Tab/轮次/关闭时 `unmount` 对应视图。
- 数据所有权：读 B4 `RunSummary`/`RunDetail`（含 `workflowName`/`harnessName`/`graph`/`expertName`，经 `CMP-run-data`）、B3 工作流图（仅 `run.graph` 缺失时经 `CMP-workflow-data` 回退）与 client 文件/session（经 `CMP-run-data` 的只读方法）；写 localStorage `df-launch-workspace-paths`（`{v:1,byClient:{<clientId>:string[]}}`，仅 UI 偏好：按执行节点保存最近 10 条工作区绝对路径，最近置顶、去重、成功后写入；损坏/版本不符/非法条目按空历史处理）；不写 `MOCK`、不用 `sessionStorage`；页面只持有当前列表/详情/选择/弹层与视图句柄内存态。
- 公开契约：入口 `pages/instances.html?tab=&wfId=`、`pages/instance-detail.html?id=<runId>`；操作 `CMP-instances#list`、`#launch`、`#detail`、`#cancel`、`#decide`、`#resume-node`、`#session-log`、`#run-files`、`#node-modal`；不变量：详情不用常驻右侧面板，双击节点才打开 90% × 90% 弹层（内容内部滚动，Esc/遮罩/× 关闭）；弹层 Tab 固定为 概要 / 文件 / 执行会话 / 会话日志；页头「任务文件」与节点文件 Tab 共用 `CMP-run-files`；多轮节点必须保留历史轮次，最新轮跟随轮询、历史轮只读且不出现人工确认与继续执行入口；有 `RunDetail.graph` 时不得再请求 `GET /workflows/{id}`，`run.graph` 缺失才回退，回退失败显示无图占位而不是整页错误；工作流名优先 `workflowName`，节点专家名优先 `expertName`，专家已删除不得显示裸 UUID；会话日志按 `visit` 下载；执行会话按 `visit` 建流；发起运行三个必填（`harnessId`/`workspacePath`/`intentMarkdown`）缺一不提交；工作区路径历史按选中 Harness 的 `clientId` 隔离、每节点最多 10 条、只保留以 `/` 开头的路径，删除只作用于历史不改输入框；Harness 只列 `enabled && clientId`；人工确认只对 `waiting_confirm` 节点出现，`confirm` 节点保持批准/驳回与回退文案，`confirmation_request` 确认点使用「确认并继续 / 拒绝并反馈」且 reject 不回退；执行中确认点的 `comment` 由「选项 + 换行 + 补充说明」拼成，reject 必填、pass 可空，不新增 `answer` 字段；提交中按钮禁用，409 刷新后不自动重复提交；图片初始资料提交前不得发上传/删除请求，提交时上传并发 ≤3、顺序 = 添加顺序，`inputs` 只传 `inputId`，上传或启动失败必须回滚已上传暂存项并保留本地图片；继续执行只对 `waiting_resume` 当前节点最新轮出现，请求期间禁用按钮，不传请求体，不展示 `sessionId`/`attempt`；终态 run 不显示终止；后端未提供的能力按钮置灰并注明原因。
- 依赖：`DF`（外壳、表格、Tabs、90% 大弹层、Toast、时间格式化）、`CMP-run-data`、`CMP-workflow-data`（仅图缺失回退）、`workflow/model`（图映射）、`shared/canvas-geometry`（连线几何与视口变换）、`shared/http`（Harness/专家列表）、`shared/markdown-editor`（发起运行意图编辑）；不 import 其他页面 JS；跨页只走 URL。
- 冷热属性：热（列表/详情轮询、发起运行、决策）；轮询只在非终态运行期间存在，页面隐藏时跳过一轮。
- 变化轴：B4 run DTO 与状态闭集、可用操作集合（当前只有 cancel/decision）、发起运行入参；变化集中在 `run/data` 与两个页面。
- 验证入口：`node tools/verify-m1-scenarios.js SCN-0004`（16 条）、`node tools/verify-m1-scenarios.js SCN-0023`（4 条，连线同源与保存视口）、`node tools/verify-m1-scenarios.js SCN-0022`（8 条）、`node tools/verify-m1-scenarios.js SCN-0024`（6 条，图片初始资料）、`node tools/verify-node-observability.js`（SCN-0021，5 条）；`npm start` + `/pages/instances.html`、`/pages/instance-detail.html?id=<runId>`；真实 `waiting_resume` run `01a1ee50…/n3` 只读走查（仅展示，不点击续跑）。
- 验证计划：列表计数与 Tab 分组（含等待继续）；详情轨迹/节点状态来自 run.nodes；双击节点打开 90% 弹层且不出现右侧面板、内容超高走弹层内部滚动；四个 Tab 切换；页头任务文件；多轮节点显示最新/历史 Tab、历史轮只读、按轮下载会话日志、按轮建会话流；轮询不重置文件目录/选中文件、不重开 EventSource；切 Tab/关闭弹层关闭 EventSource；人工确认推进；取消终止不改状态；发起运行请求体（harness/路径/意图）；工作区路径历史按 `clientId` 隔离、下拉点选、单条删除、成功后置顶/去重/封顶 10 条，损坏或他节点数据不进入表单；等待横幅显示超时码与两条提示、继续按钮 loading/禁用、成功后 run 变 `running` 且节点变 `dispatched`、409 按 reason 提示、503 保留按钮、非等待节点无继续入口；执行中确认点按 `verdict.kind` 渲染问题/上下文/选项、pass/reject 的 `comment` 拼接与 toast、reject 不回退、无选项时只提交自由文本、异常 verdict 只读、提交中禁用与 409 单次提交、历史轮不出现卡片；轨迹图连线与编辑器同源（沿用 `inSide/outSide`、箭头、回退标签）、按保存视口缩放；图片初始资料：粘贴/拖放/选择入栏、提交前零上传、删除零请求、提交顺序与 `inputs` 一致、超 8 张被拒、上传/启动失败回滚与重试、详情缩略图与空态；有 `run.graph` 时详情不再请求 `GET /workflows/{id}`；`run.graph` 缺失回退旧接口、回退失败显示无图占位；专家已删除时节点弹层显示 `expertName` 而非 UUID；列表与筛选横幅优先 `workflowName`；删除弹窗含「未结束的运行」；409 `references` 含 run 时提示运行中实例且不删除。
- 预算：列表约 20 KB + 详情约 24 KB + `run/data` 约 8 KB；远低于 120k token。
- 单独运行：`node tools/verify-m1-scenarios.js SCN-0004`。
- 删除测试：删除后运行只能由 API 直接操作，无法观察、终止或审批；复杂度会回流到工作流页面，故保留独立组件。
- 已知偏差：新运行的轨迹用 `RunDetail.graph` 冻结快照渲染，旧后端/旧运行缺 `graph` 时才按当前工作流图回退（工作流被改后节点名可能漂移）；后端未提供暂停/恢复、节点重试、从节点重跑、输入输出与 fan-out 子任务下钻，相关入口置灰并注明「后端未提供」；`split`/`fanout` 可保存但启动返回 `unsupported_node_type`。2026-11-17 节点详情从右侧面板改为双击 90% × 90% 弹层（`REQ-0020`），概要与会话日志不再常驻；节点消息/确认说明直接按 Markdown 在弹层内展示，移除了原来的二次「全屏」入口（`SCN-0004-T2/T4`）。同日补多轮历史（`REQ-0021`）：同一节点按 `nodeId + visit` 聚合，弹层轮次 Tab 查看最新与历史；历史轮只读，确认入口只在最新轮；历史会话日志按 `visit` 下载。若后端只回传最新一轮，页面只能展示收到的记录，前端不做丢失数据的兜底（`SCN-0004-T6`）。同日接入节点观测（`REQ-0022` / `SCN-0021`）：弹层新增「文件」「执行会话」Tab 与页头「任务文件」入口，BFF 对 SSE/raw 改为流式；文件是 run 级、会话是 `nodeId + visit` 级；代码预览只显示语言标签，不引入 Prism。2026-11-18 发起运行工作区路径增加按 `clientId` 隔离的最近 10 条历史（`REQ-0024` / `SCN-0004-T7/T8`）：历史只存本机 localStorage，不校验路径在执行节点上是否存在；换浏览器或清缓存后历史为空，后端仍以 `workspacePath` 为准。同日接入超时节点继续执行（`REQ-0025` / `SCN-0004-T9/T10/T11`）：`waiting_resume` 为非终态，等待横幅与节点等待卡共用续跑处理；UI 不传 `sessionId`、不感知 attempt，等待期工作区占用与 TTL 由后端约束。同日接入执行中确认点（`REQ-0026` / `SCN-0022`）：`waiting_confirm` 不再只等于 `confirm` 节点，按 `RunNodeView.verdict.kind === "confirmation_request"` 识别 agent/design 执行中的确认；确认点 pass/reject 都由后端续跑同一 session，UI 只提交 `{decision, comment}`，`visit` 不变而 `taskId` 会替换，因此不缓存任务 ID、不把 reject 当作回退；无法识别的 waiting_confirm 数据只读提示，不提交。同日接入资产删除后的运行快照（`REQ-0027` / `SCN-0004-T12–T16`）：列表/标题优先 `workflowName`，详情优先 `RunDetail.graph` 且不再回查已删除工作流，节点专家名优先 `expertName`；旧运行缺 graph 时保留回退路径；删除被活跃 run 引用的资产仍由后端 409 阻止，UI 只提示不自动取消。2026-11-19 轨迹图连线改为复用 `shared/canvas-geometry` 并按 `graph.viewport` 呈现（`REQ-0028` / `SCN-0023`）：此前运行页固定右边框出、左边框进，不读 `inSide/outSide`，也没有箭头与回退标签；同一份 10 节点图 12 条边中 9 条与编辑器不同。共享后编辑器连线输出逐字不变（golden 锁定），运行页只读、不提供缩放控件；`RunDetail.graph` 冻结快照语义不变。2026-11-19 发起运行支持图片初始资料（`REQ-0029` / `SCN-0024`）：按用户裁决由上游的「粘贴即上传」改为提交时上传，提交前删除只改本地、零请求；上传失败或启动失败立即 DELETE 已上传暂存并保留本地图片重试；上传途中关闭弹窗或崩溃可能留下服务端孤儿（暂存无 TTL），需运维清理。

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
| 表格列 | 运行 ID（前 8 位，点击进详情）、工作流名（优先 `RunSummary.workflowName`）+ `r<revision>`、执行节点 `clientId`、当前节点 `currentNodeId`、状态标签（终态显示 outcome，归档态另起一行）、耗时、开始时间、操作 |
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
| 初始资料（图片） | 粘贴/拖放/选择 + 64px 缩略图附件栏 | 否 | 只接受 PNG/JPEG/WebP/GIF；单张 ≤8 MiB、最多 8 张、合计 ≤20 MiB。**提交前只存在浏览器内存，不发任何请求**；点「发起运行」后才上传（并发 3）并随 `inputs` 绑定；删除暂存只改本地；上传/启动失败回滚已上传项并可重试 |

- 提交成功：关闭弹窗、提示运行 ID、跳转详情页；失败按 `validation_error` / `run_conflict` / `unsupported_node_type` / `client_unsupported` 显示错误，弹窗保留。
- 有图片时提交分两段：先上传（按钮显示「上传图片 i/N…」），全部成功后才启动；任一段失败都恢复按钮与本地图片，已上传暂存项由暂存队列 DELETE。
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

有初始资料时，页头与轨迹图之间显示「初始资料（N）」横向缩略图（48px，只读，点击新标签打开原图）；无资料不渲染区块。

### 3.2 头部控制区

| 操作 | 交互 |
|---|---|
| 任务文件 | 打开 90% × 90% 任务文件弹层（`CMP-run-files`，默认 `task-space`）；与节点弹层共用同一个只读视图 |
| 终止 | 非终态可见；二次确认后 `POST /runs/{id}/cancel`，成功刷新详情 |
| 继续执行 / 取消运行 | 仅 `waiting_resume` 运行显示在轨迹上方等待横幅；继续执行调用续跑端点，取消运行复用终止确认 |
| 暂停 / 恢复 / 从节点重跑 | 保留入口、置灰，`title` 注明「后端未提供」 |

### 3.3 轨迹图（主区，只读）

- 图优先来自 `RunDetail.graph`（启动时冻结），经 `toEditorGraph` 得到节点坐标与阶段框；只有 `run.graph` 缺失时才回退 `GET /workflows/{workflowId}`，回退也失败显示「该运行没有可用的图快照」占位，不把详情页置为错误。节点状态来自 `run.nodes`（同节点多次访问取最大 `visit`，副标题显示「第 N 轮」）。
- 状态着色：`queued`→待执行灰、`dispatched`→运行中蓝、`waiting_confirm`→等待人工橙、`waiting_resume`→等待继续琥珀、`succeeded`→成功绿、`rejected`→已驳回紫、`failed`→失败红；未出现的节点为「待执行」。
- 单击节点只切换选中高亮；双击节点打开节点详情弹层。页面加载时不再默认展开任何节点的详情。
- 多轮节点画布仍按最新 `visit` 着色，节点副标题显示「第 N 轮」，`title` 提示「共 N 轮」；历史轮次只在弹层内查看。
- 连线与编辑器同源：`shared/canvas-geometry` 的 `edgeSides` 先取保存的 `outSide/inSide`，缺省按两节点相对位置自动选边，同一节点进出锚点冲突时错开；seq 边带灰色箭头，rollback 边为紫色虚线 + 紫色箭头并显示「↺ 回退」；不在这里重复实现几何。
- 视口：按 `graph.viewport` 设 `#cvScaler` 的 `transform`（`translate(x,y) scale(zoom)`，左上为原点），与保存时编辑器一致；运行页不提供缩放/平移控件，溢出走画布容器滚动。
- 图例固定七类；不显示进度百分比（后端无节点总数之外的进度字段）。

### 3.4 节点详情弹层（90% × 90%）

| Tab | 内容 |
|---|---|
| 概要 | 节点名/类型、状态、专家（优先 `RunNodeView.expertName`，已删除专家显示快照名或「—」，不显示裸 UUID）、访问轮次、任务 ID、下发/完成时间、节点耗时；`verdict` 原样 JSON（`confirmation_request` 优先结构化展示 question/context/options，原始 JSON 收进折叠区）、`error` 分块展示；`message` 按 Markdown 渲染（`shared/markdown.js`），详情本身已是大弹层，不再提供二次「全屏」；最新轮 `waiting_resume` 节点显示等待继续卡（超时码、超时说明、原任务原会话提示、继续执行按钮），非等待节点只显示错误块；底部「重试节点」「从此节点重跑」置灰并注明后端未提供；「查看任务文件」切到文件 Tab |
| 文件 | `CMP-run-files` 只读视图：`task-space`/`workspace` 根切换、面包屑、目录懒加载、Markdown/文本/二进制/截断预览；不提供编辑/上传/删除 |
| 执行会话 | `CMP-run-session` 只读视图：会话状态/cwd/起止时间/事件数/归档状态；概览统计（时长、工具、Token、思考）；事件分页、筛选、搜索与工具调用合并；`running` 时 `EventSource` 实时追加；raw 下载；不显示 `sessionId`/`attemptId` |
| 会话日志 | 有 `taskId` 时给下载按钮（`GET /runs/{id}/nodes/{nodeId}/session-log?visit=<n>`，gzip JSONL）；无 `taskId`（如 confirm 节点）说明不产生会话 |

- 弹层由 `DF.modal.open({ size: 'screen' })` 提供：宽高各为视口 90%，头部标题与底部「关闭」固定，`.d-body` 在内容超高时内部滚动；窗口 resize 时重算尺寸。
- **轮次 Tab**：同一 `nodeId` 存在多个 `visit` 时，弹层顶部显示「最新 · 第 N 轮 / 第 N-1 轮…」；默认最新轮，切到历史轮后该轮只读，历史提示条说明确认与操作入口在最新轮。单轮节点不显示轮次 Tab。
- 轮询刷新时弹层保持打开，只更新标题/轮次/确认卡/概要；文件与执行会话面板不重建、EventSource 不重开。停留在最新轮则跟随新轮（执行会话按新 `visit` 重挂载），停留在历史轮则保持当前轮；文件不随轮次变化。历史轮被后端移除时回落到最新轮。
- Tab 切换先 `unmount` 旧视图再 `mount` 新视图；文件 `root/path/selected` 由页面保存并在重挂载时恢复。
- 关闭方式：Esc、点击遮罩、右上 ×、底部「关闭」。

### 3.5 人工确认（`waiting_confirm`）

`waiting_confirm` 有两种来源，按以下顺序判定：

| 条件 | 类型 | 卡片 |
|---|---|---|
| 节点类型 `confirm`（`runNode.nodeType`，缺省看图节点 `type`）且等待中 | 节点级确认 | 显示节点 `message`，意见输入框（驳回必填），「批准，继续执行」/「驳回」 |
| `RunNodeView.verdict.kind === "confirmation_request"` 且 `question` 非空 | 执行中确认点 | 「执行中确认 · <节点名>」：`question`、`context`（Markdown）、`options` 单选、补充说明、模型说明折叠；「确认并继续」/「拒绝并反馈」 |
| 等待中但两者都不满足 | 异常/旧数据 | 只读提示 + 「刷新详情」，不提交 |

- 卡片只在最新轮出现，历史轮不出现；`confirm` 节点的 `taskId` 为 `null`，执行中确认点通常有 `taskId`，会话日志与执行会话按 `taskId` 正常展示。
- `confirm` 节点文案与行为保持不变：批准 toast「已批准，流程继续」；驳回必填意见、toast「已驳回，流程回退」。
- 执行中确认点：选项与补充说明拼进 `comment`（`选项\n补充说明`），不新增 `answer` 字段；reject 必填（选项或说明至少一项），pass 可空；toast「已确认，继续执行」/「已拒绝，意见已反馈」，不出现「流程回退」。
- 决策成功响应即更新后的 `RunDetail`：直接重绘并保留弹层、继续轮询，不二次 GET；节点从 `waiting_confirm` 变 `dispatched`、`taskId` 替换、`visit` 不变；之后 5s 轮询看到节点最终结算。
- 提交中两个按钮禁用，防重复；失败按 400/404/409/503 映射：400/503 恢复按钮可重试，404 关闭弹层并刷新，409 刷新详情且不自动重复提交。
- 轮询重建键：`confirm` 节点用 `state|message|visit`；确认点用 `state|kind|question|options|visit`，避免 5s 轮询清空用户已选/已输入内容。
- 非 `waiting_confirm` 节点不出现卡片。

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
- 运行有快照但工作流已删除：正常显示快照图与 `workflowName`；`run.graph` 与回退工作流都缺失时显示无图占位，页头「任务文件」等只读入口仍可用。
- 加载中显示占位；网络/后端错误显示 `errorText` 与重试按钮，不回落 MOCK。

## 5 数据依赖

- 读：`GET /api/v1/runs`、`GET /api/v1/runs/{id}`（`CMP-run-data`，含 `workflowName`/`harnessName`/`graph`/`expertName`）；`GET /api/v1/workflows`、`GET /api/v1/workflows/{id}`（`CMP-workflow-data`，详情仅在 `run.graph` 缺失时回退）；`GET /api/v1/harnesses`、`GET /api/v1/experts`（`shared/http`）。
- 写：`POST /api/v1/workflows/{id}/runs`、`POST /api/v1/runs/{id}/cancel`、`POST /api/v1/runs/{id}/nodes/{nodeId}/decision`、`POST /api/v1/runs/{id}/nodes/{nodeId}/resume`。
- 下载：`GET /api/v1/runs/{id}/nodes/{nodeId}/session-log`。
- 本地偏好：读写 localStorage `df-launch-workspace-paths`（发起运行弹窗的工作区路径历史，按 `clientId` 隔离，最多 10 条）；不承载运行业务数据，后端仍以请求体 `workspacePath` 为唯一入参。
- 不再读写 `MOCK.instances`；`sessionStorage` 键 `df-new-instance` 已移除。
