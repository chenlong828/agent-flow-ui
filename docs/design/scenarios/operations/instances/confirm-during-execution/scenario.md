---
layer: design
module: instances
status: verified
flow: confirm-during-execution
scenario: SCN-0022
updated: 2026-11-18
---

# SCN-0022 执行中确认点（MCP confirmation_request）

> 需求：`REQ-0026`。上游契约与 UI 对接提案见 agent-flow-orchaster `docs/works/2026-11-18-review-verdict-mcp/`；本仓库只消费 `RunNodeView.verdict`，不改后端。

## 入口

- `CMP-instances/assets/js/pages/instance-detail.js#resolveModal`、`#renderModalChrome`、`#bindConfirm`
- `CMP-instances/assets/js/run/node-view.js#confirmationOf`、`#confirmModeOf`、`#confirmKeyOf`、`#confirmCard`、`#readDecisionComment`
- `pages/instance-detail.html?id=<runId>`，双击 `waiting_confirm` 节点打开 90% 弹层

## 运行序

1. 打开 `waiting_confirm` 运行详情：列表仍显示「去确认」，详情轨迹按 `run.nodes` 最新轮着色，当前节点为橙色等待人工。
2. 双击节点：按顺序判定卡片类型——
   - 节点类型为 `confirm`：渲染原有「待人工确认」卡，显示 `message`、意见输入框、「批准，继续执行」/「驳回」；
   - `verdict.kind === "confirmation_request"` 且 `question` 非空：「执行中确认 · <节点名>」卡，显示 `question`、`context`（Markdown）、`options` 单选、补充说明输入框与「模型说明」折叠区；
   - 两者都不满足：只读提示 + 「刷新详情」，不提供提交按钮。
3. 提交决策（两种卡片共用 `POST /api/v1/runs/{id}/nodes/{nodeId}/decision`，请求体只有 `{decision:"pass"|"reject", comment?}`）：
   - `confirm` 节点：批准可空意见；驳回必填，成功 toast「已驳回，流程回退」；
   - 执行中确认点：选项与补充说明拼成 `comment`（`选项\n补充说明`）；reject 至少选一项或填写说明，pass 可空；toast「已确认，继续执行」/「已拒绝，意见已反馈」。
4. 成功响应即更新后的 `RunDetail`：直接重绘并保留弹层、继续 5s 轮询；节点从 `waiting_confirm` 变 `dispatched`、`taskId` 替换、`visit` 不变，之后轮询看到节点最终结算。
5. 轮询刷新：确认卡按 `state|verdict.kind|question|options`（`confirm` 节点按 `state|message|visit`）判断是否重建，内容未变时保留用户已选/已输入内容。
6. 多轮节点：确认卡只在最新轮出现；切到历史轮只读，不出现提交入口。

失败路径：`question` 为空、`verdict` 非对象、`kind` 不是 `confirmation_request` 时按异常数据只读，不提交；执行中确认点 reject 未选选项且未填说明被前端拦住；400/503 恢复按钮可重试，404 关闭弹层并刷新，409 刷新详情且不自动重复提交；历史轮不出现确认卡；`confirm` 节点的批准/驳回、回退 toast 与历史轮只读不回归。

## 不可变引用

- `RunNodeView` 字段与 `waiting_confirm` 状态闭集：`nodeId`、`nodeType`、`visit`、`state`、`taskId`、`verdict`、`message`。
- `confirmation_request` 形状：`{kind, question, context?, options?: string[], allowFreeText?}`；`options` 最多 8 项。
- 决策端点 `POST /runs/{id}/nodes/{nodeId}/decision` 的请求体与错误码（400 `validation_error`、404 `not_found`、409 `invalid_state`、503 `service_unavailable`）。
- `DF.modal.open({ size: 'screen' })`、`DF.toast`、`shared/markdown.js` 的渲染语义。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1/B3；确认点夹具由 `addRunFixture` 注入，决策响应在 `tools/fake-b1.js` 按 `verdict.kind` 模拟「visit 不变、taskId 替换、节点回 dispatched」。可执行：`node tools/verify-m1-scenarios.js SCN-0022`。最近一次执行：2026-11-18，8/8 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0022-T1 | 正 | 执行中确认卡标题为「执行中确认 · 需求分析」，显示 question/context/options，两个单选项与「确认并继续 / 拒绝并反馈」，不出现 confirm 节点的「批准，继续执行 / 驳回」文案 | `tools/verify-m1-scenarios.js#scn0022T1` |
| SCN-0022-T2 | 正 | 选「允许」+ 补充「按 B 做」后提交体为 `{decision:"pass", comment:"允许\n按 B 做"}`；toast「已确认，继续执行」；节点变 `dispatched`、`taskId` 变为 `t-resume-n2-*`、访问轮次仍为第 1 轮，概要显示结构化「确认请求」 | `tools/verify-m1-scenarios.js#scn0022T2` |
| SCN-0022-T3 | 正 | 空内容 reject 被拦；选「拒绝」+ 补充「改为软删除」后提交体 `comment="拒绝\n改为软删除"`；toast「已拒绝，意见已反馈」，页面不出现「流程回退」，节点回 `dispatched`、run 仍为「运行中」 | `tools/verify-m1-scenarios.js#scn0022T3` |
| SCN-0022-T4 | 正 | 无 `options` 时不渲染单选；只填补充说明「使用测试环境」提交，请求体为 `{decision:"pass", comment:"使用测试环境"}`，不含 `answer` 字段 | `tools/verify-m1-scenarios.js#scn0022T4` |
| SCN-0022-T5 | 反 | `confirm` 节点卡片保持「待人工确认」、显示 message、「批准，继续执行 / 驳回」；空意见驳回被拦，填意见驳回后 toast「已驳回，流程回退」且确认卡消失 | `tools/verify-m1-scenarios.js#scn0022T5` |
| SCN-0022-T6 | 反 | `waiting_confirm` 但 verdict 为旧的 `needs_human` 时只显示只读提示「缺少可识别的确认信息」，无提交按钮，点「刷新详情」后仍不发出 decision 请求 | `tools/verify-m1-scenarios.js#scn0022T6` |
| SCN-0022-T7 | 反 | 决策请求延迟 300ms 期间两个按钮均禁用；返回 409 后只发出 1 次请求，toast「该确认已被处理或状态已变化，已刷新」，按钮恢复可重试，确认卡保留 | `tools/verify-m1-scenarios.js#scn0022T7` |
| SCN-0022-T8 | 反 | 两轮节点默认最新轮（第 2 轮）显示确认卡；切到第 1 轮不出现确认卡并显示历史提示；切回第 2 轮恢复确认卡 | `tools/verify-m1-scenarios.js#scn0022T8` |
