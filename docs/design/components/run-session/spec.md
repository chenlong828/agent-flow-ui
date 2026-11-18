---
layer: design
module: run-session
component: CMP-run-session
requirement: REQ-0022
scenario: SCN-0021
status: active
updated: 2026-11-18
---

# 执行会话（只读，SSE）

> 导航：运行与运营 / 运行实例 → 节点弹层「执行会话」Tab | 形态：L2 只读视图（无独立页面） | 前置：`design/components/run-data/spec.md`、`design/components/instances/spec.md`
>
> 源码：事件模型 `assets/js/run/session-model.js`；DOM/加载/SSE `assets/js/run/views/session.js`。

## 0 模块卡

- 状态：active（2026-11-18 随 `REQ-0022` 实现）
- 单元 / 层：组件 / L2 页面视图
- 业务价值：运行观察者要看到某个执行节点本轮会话的状态、事件过程与实时富事件，并能下载完整 raw 存档；没有它，只能下载 gzip 会话日志，无法在运行详情内追踪执行过程。
- 负责 / 不负责：负责会话详情、历史事件、`EventSource` 实时追加、raw 下载入口、加载/错误/空态与流生命周期；不负责取数端点、run 状态机、attempt 列表、sessionId/attemptId 展示、事件内容编辑。
- 内部逻辑：先 `getSession` 取状态/归档，再按 `nextCursor` 分页取历史事件（每页 200、上限 1000）；计算会话概览（时长/事件/工具/Token/思考/归档）；默认「活动」视图隐藏 `usage_update` 与 `agent_thought_chunk`，并把相邻的 `tool_call` + `tool_call_update` 合并为一行；筛选为多选类别（工具/思考/消息/用量/阶段/其他），「活动」「全部」为预设；多选后按 `seq` 时间线合并输出，选中工具时仍合并相邻 start/update；搜索匹配消息、事件名与工具名；仅当 `status=running` 时用 `sessionStreamUrl` 建 `EventSource`；`normalizeEvent` 把 preview 与 rich 统一为 `{event,message,data,tool,usage,...}`（rich `kind` → `tool_call/tool_call_update/usage_update/agent_thought_chunk/agent_message_chunk`，`text → message`）；`snapshot` 按 `reset` 合并、`event` 按 `seq` 去重、同 seq 的 preview 被 rich 替换、`heartbeat` 忽略、`end` 关闭；`unmount` 必关流并 abort 在飞请求。
- 数据所有权：业务数据无持久化；仅 localStorage 保存过滤器类别（`df-run-session-filter`，`{v:1,categories:string[]}`），不保存搜索词、滚动位置或事件内容；只持有当前会话的事件内存副本与流句柄，`unmount` 全部释放；业务数据由后端拥有。
- 公开契约：`mountRunSession(container, { runId, nodeId, visit, live }) -> { unmount() }`；`live=false` 时不建流。
- 依赖：`DF`（`esc/icon/tag/dot/fmtBytes/kv`）、`CMP-run-data#getSession/listSessionEvents/sessionStreamUrl/sessionRawUrl`、浏览器 `EventSource`；不 import 页面、不直接 `fetch`。
- 冷热属性：热（实时流 + 事件展示）；单流、无轮询；失败不阻塞 run 轮询。
- 变化轴：`RunSessionRichEvent` 字段、SSE 事件名、归档状态词表；变化集中在视图渲染与 `run-data`。
- 验证入口：`node tools/verify-node-observability.js`（SCN-0021-T3/T4/T5/T6/T7）。
- 验证计划：详情字段；历史事件分页与按 seq；概览统计（工具/Token/思考/归档）；活动视图工具合并与 usage/thinking 过滤；全部/用量/思考筛选行数；搜索；SSE snapshot/event 追加、end 关闭；切 Tab/切轮次/关闭弹层关闭流；`session_not_linked` 空态；raw 链接带 `visit`；DOM/请求无 `sessionId`；多轮切换按 `visit` 重载。
- 预算：源码约 9 KB + 规格约 4 KB，远低于 120k token。
- 单独运行：`node tools/verify-node-observability.js`。
- 删除测试：删除后节点弹层只剩概要与会话日志下载，无法看会话过程与实时事件；复杂度回流到 `CMP-instances`，故保留独立视图。
- 已知偏差：历史事件按 after cursor 分页，页面最多载入 1000 条；历史 preview DTO 不含工具完整 I/O、`messageId`/`toolCallId`、`level`/`truncated`（API-51 定义），因此历史工具行只显示名称/状态/耗时、历史思考只显示摘要；rich 实时事件可提供 `text/tool.input/output/durationMs/toolCallId/permission/stopReason/error`，同 seq 时优先用 rich；工具 start/update 优先按 `toolCallId` 配对，缺失时按顺序 + 工具名，并发调用时可能不精确；已结束会话的 SSE `snapshot` 可能为空，历史以 API-51 为准。

## 1 契约与生命周期

```js
const view = mountRunSession(container, { runId, nodeId, visit, live });
view.unmount(); // close EventSource + abort 在飞请求 + 清空 DOM
```

- `visit` 缺省为 1；轮次切换由页面重挂载。
- `EventSource` 只在 `session.status === 'running'` 且 `live !== false` 时创建。
- `end` 事件关闭流并更新状态；`error` 显示「重连中」，浏览器自动重连由 BFF 透传 `Last-Event-ID`。

## 2 展示规则

- 头部：状态、实时/已结束、轮次、cwd；**不显示 `sessionId`/`attemptId`**。
- 概览：时长（开始→结束）、事件总数/已载入/速率、工具调用数/完成率/Top 工具、Token 用量（当前/总量/百分比/增量/进度条）、思考/消息片段数、归档状态与大小。
- 偏好：过滤器类别写入 `localStorage.df-run-session-filter`；读取时校验版本与类别白名单，非法/空回落「活动」；不保存搜索词与滚动位置。
- 事件：默认「活动」预设（工具/消息/阶段/其他）隐藏 `usage_update` 与 `agent_thought_chunk`，相邻 `tool_call` + `tool_call_update` 合并为「工具名 + 状态 + 耗时 + seq 范围」一行；「全部」选中六类；类别可多选，选中集合按 `seq` 时间线输出；关掉「工具」时工具行不再合并；搜索匹配消息、事件名、工具名。
- 事件行：`seq`、时间、`kind`、`event`、`data.tool/status/usage/bytes` 徽标；工具状态 completed/failed 着色；usage 显示累计值与增量。
- 分页：每页 200，按 `nextCursor` 继续，最多 1000；超出时显示「已截断」，完整内容走 raw。
- raw：仅 `archive.status=stored` 时给下载链接（`sessionRawUrl` 带 `visit`），显示大小与 sha256 前 12 位；其余显示归档状态。
- 空态：`404 session_not_linked` 显示「该节点结果未关联会话」且不提供重试；其他错误可重试。

## 3 测试

| 场景 | 断言 |
|---|---|
| `SCN-0021-T3` | 详情字段；3 条历史事件；snapshot/event 追加；end 关闭；raw 链接带 visit；无 sessionId |
| `SCN-0021-T4` | 5s 轮询不重建流；切 Tab/关闭弹层关闭；重进新建流 |
| `SCN-0021-T5` | `session_not_linked` 空态；无 sessionId |
| `SCN-0021-T6` | 多轮切换关闭旧流并按 `visit` 重载；历史轮不建流 |
| `SCN-0021-T7` | 217 条事件分页与概览；活动视图合并 66 次工具；全部/用量/思考筛选；搜索 |
