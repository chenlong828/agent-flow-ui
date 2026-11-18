---
layer: requirements
module: instances
status: delivered
updated: 2026-11-18
---

# REQ-0025 超时节点继续执行

| 字段 | 内容 |
|---|---|
| ID | `REQ-0025` |
| 类型 | `feature` |
| 场景叙述 | 操作者在运行实例列表或详情看到 `waiting_resume` 的运行：当前节点显示超时码与错误信息，页面提示该运行正在占用工作区。操作者点击「继续执行」后，前端调用续跑端点，按钮进入加载态；成功后运行回到「运行中」、节点回到「已派发」，同一任务与同一会话继续执行；等待期也可取消运行。 |
| 价值 | 超时不再直接把运行判死。没有这个入口，等待态会被当成未知状态展示，工作区被占住且用户无法恢复，只能丢弃已有会话重新发起。 |
| 非目标 | 不新建运行或任务、不传 `sessionId`、不改 client；不做 TTL、自动续跑、续跑次数上限或「给模型留言」；不新增 SSE/推送；不显示 `sessionId`/`attempt`；不覆盖没有 `sessionId` 的未回报超时。 |
| 约束 | 只调用 `POST /api/v1/runs/{id}/nodes/{nodeId}/resume`，无请求体；`waiting_resume` 是非终态，轮询与终止保持可用；继续入口只在最新轮且状态为 `waiting_resume` 的当前节点出现；请求期间禁用按钮；`200` 以响应 `RunDetail` 或重新拉取为准，`409` 按 `details.reason` 提示并刷新，`404` 返回列表，`503`/网络错误保留按钮；不新增运行时依赖、不回落 MOCK。 |
| 影响场景 | `SCN-0004`（新增 T9 正例与 T10/T11 反例，并更新列表计数断言） |
| 澄清记录 | 2026-11-18 依据 agent-flow-orchaster `docs/works/2026-11-18-run-timeout-resume/ui-integration-proposal.md` 落 UI；默认采用提案文案与错误映射。UI 布局按现有「轨迹图 + 双击节点弹层」结构落为运行级等待横幅 + 等待节点弹层继续卡；列表新增「等待继续」Tab。 |
| 状态 | `delivered`（2026-11-18；`SCN-0004` 11/11） |
