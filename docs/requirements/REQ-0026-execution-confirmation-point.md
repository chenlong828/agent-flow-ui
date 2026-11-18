---
layer: requirements
module: instances
status: delivered
updated: 2026-11-18
---

# REQ-0026 执行中确认点（MCP confirmation_request）

| 字段 | 内容 |
|---|---|
| ID | `REQ-0026` |
| 类型 | `feature` |
| 场景叙述 | 流程运行时，agent/design 节点执行到一半需要人拍板；模型通过 MCP 提交确认请求后，运行进入 `waiting_confirm`，当前节点仍保留同一 `visit`。观察者在运行实例详情双击该节点，弹层顶部出现「执行中确认」卡片：显示模型提出的问题、上下文与候选答案，可单选并补充说明；点「确认并继续」或「拒绝并反馈」后提交现有决策端点，弹层保持打开并立即按响应重绘，节点回到「运行中」、`taskId` 替换、`visit` 不变；拒绝不会让流程回退，而是把意见带回同一 session 继续执行。 |
| 价值 | 执行中遇到契约变更、范围扩展、关键信息缺失等不能自行拍板的问题时，原先只能中断运行重来或把整个节点当作人工确认节点；执行中确认点让人当场回答，模型在同一 session 里继续完成剩余工作，不重复消耗已完成的执行。UI 只需消费 `RunNodeView.verdict`，不新增后端端点、状态或字段。 |
| 非目标 | 不改后端端点、run/节点状态、数据库字段与 `resultSignal`；不新增 `answer` 字段或结构化回答；不把 `comment` 拆分；不做多确认点并行、确认超时策略、跨节点消息总线；不改变 `confirm` 节点的批准/驳回与回退行为；不在 UI 判断 review `verdict` 的业务正确性；不做移动端适配。 |
| 约束 | 只按 `RunNodeView.verdict.kind === "confirmation_request"` 且 `question` 非空识别，不按 `nodeType === "agent"` 猜测；`confirm` 节点判定优先；异常/旧数据只读提示、不提交。选项 + 补充说明统一拼进 `comment`（`选项\n补充说明`），reject 至少选一项或填写说明，pass 可空；成功 toast「已确认，继续执行」/「已拒绝，意见已反馈」，不得写「流程回退」。提交中按钮禁用；400/503 恢复按钮可重试，404 关闭弹层并刷新，409 刷新详情且不自动重复提交。决策响应即 `RunDetail`，直接重绘、不二次 GET；不依赖 `taskId` 不变；历史轮只读且不出现确认卡；轮询重建键至少含 `state|verdict.kind|question|options`，不因 5s 轮询清空用户输入。 |
| 影响场景 | `SCN-0022`（新增 8 条：识别、pass、reject、无选项文本、confirm 回归、异常 verdict、409 防重、历史轮）；`SCN-0004`（confirm 节点与超时继续不回归） |
| 澄清记录 | 2026-11-18 上游调度层完成 client 调用 MCP 的支持，按 agent-flow-orchaster `docs/works/2026-11-18-review-verdict-mcp/ui-integration-proposal.md` 落 UI；确认不新增端点/状态/字段，回答统一走 `decide.comment`，确认点的 reject 是「带拒绝意见继续」而非回退；review verdict 的 UI 展示不新增字段。 |
| 状态 | `delivered`（2026-11-18；`SCN-0022` 8/8、`SCN-0004` 11/11） |
