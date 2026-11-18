---
layer: requirements
module: instances
status: delivered
updated: 2026-11-18
---

# REQ-0023 执行会话概览与事件筛选

| 字段 | 内容 |
|---|---|
| ID | `REQ-0023` |
| 类型 | `feature` |
| 场景叙述 | 运行观察者打开节点弹层的「执行会话」，先看到会话概览（时长、事件数、工具调用与完成率、Token 用量、思考/消息片段、归档），再在默认「活动」视图中看到合并后的 66 次工具调用；可切换全部/工具/思考/消息/用量/阶段并搜索，必要时查看原始逐条事件。 |
| 价值 | 一个 217 条事件的会话里约 80% 是重复的 tool_call/tool_update/usage/thought 行；当前只能逐条滚动，看不出工具分布、Token 消耗和异常。概览与筛选让「这次会话做了什么、花了多少、卡在哪」在首屏可读。 |
| 非目标 | 不做事件详情 JSON 展开（本轮选 A）；不补后端字段（工具完整 I/O、`level`、`messageId`/`toolCallId`）；不解析 raw zstd；不改 `CMP-run-data`/`CMP-bff` 契约。 |
| 约束 | 只经 `CMP-run-data` 的 `getSession`/`listSessionEvents` 取数；历史事件按 after cursor 分页，最多载入 1000 条；工具 start/update 合并按顺序 + 工具名；不展示 `sessionId`/`attemptId`；无新增运行时依赖。 |
| 影响场景 | `SCN-0021`（新增 T7；同一执行会话视图，不新建场景） |
| 澄清记录 | 2026-11-18 用户指出执行会话信息展示太少；确认先做「概览 + 筛选/合并」纯前端方案（A 档），事件列表默认合并/折叠，不做事件详情展开与后端字段扩展。同日追加：过滤器改为多选（工具/思考/消息/用量/阶段/其他），选中类别按时间线合并输出；「活动」「全部」为预设。2026-11-18 再确认：类别集合用 localStorage 全局默认保存（`df-run-session-filter`），非法/空回落活动；不保存搜索词与滚动。 |
| 状态 | `delivered`（2026-11-18；`SCN-0021` T7，7/7） |
