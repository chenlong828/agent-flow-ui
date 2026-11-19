---
layer: design
module: instances
status: verified
flow: control-instance
scenario: SCN-0004
updated: 2026-11-19
---

# SCN-0004 运行实例监控与发起运行（B4 live）

> 需求：`REQ-0019`（取代 `REQ-0004`）；节点详情交互调整见 `REQ-0020`；多轮历史查看见 `REQ-0021`；发起运行的工作区路径历史见 `REQ-0024`；超时节点继续执行见 `REQ-0025`；资产删除后的运行快照见 `REQ-0027`。

## 入口

- `CMP-instances/assets/js/pages/instances.js#init`
- `CMP-instances/assets/js/pages/instance-detail.js#init`
- `CMP-instances/pages/instances.html`、`pages/instance-detail.html?id=<runId>`

## 运行序

1. 打开列表：并发加载 `GET /runs?limit=200` 与 `GET /workflows?limit=200`；按状态分组渲染五个 Tab（全部 / 进行中 / 等待人工确认 / 等待继续 / 已结束），工作流名优先取 `RunSummary.workflowName`，缺省才在页面侧 join；行内操作随状态出现：详情、去确认（`waiting_confirm`）、去继续（`waiting_resume`）、终止（非终态）。
2. 发起运行：选工作流（B3 列表）、选执行 Harness（`/harnesses` 中 `enabled && clientId`）、填绝对路径（或从该 Harness 执行节点最近 10 条路径下拉中选择、用小叉删除单条）、在 Milkdown 编辑器写启动意图；可选在「初始资料（图片）」粘贴/拖放/选择图片，点「发起运行」时才上传并随 `inputs` 绑定（`REQ-0029` / `SCN-0024`）。提交 `POST /workflows/{id}/runs`，成功后把本次路径置顶记入该 `clientId` 的历史并跳转详情。
3. 详情：`GET /runs/{id}`；有 `RunDetail.graph` 时直接按 `toEditorGraph` 布局，标题用 `RunSummary.workflowName`，不再请求 `GET /workflows/{workflowId}`；`run.graph` 缺失时才回退 `GET /workflows/{workflowId}`，回退也失败则显示「该运行没有可用的图快照」占位。轨迹图占满内容区，画布颜色取 `run.nodes` 中该节点最大 `visit`；单击节点只切换选中高亮，双击节点打开 90% × 90% 弹层（`DF.modal size:'screen'`，窗口 resize 重算，内容超出在弹层主体内滚动，Esc/遮罩/× 关闭）。同一节点按 `nodeId + visit` 保留全部执行轮次：多轮时弹层显示「最新 · 第 N 轮 / 第 N-1 轮…」Tab，默认最新轮；切到历史轮显示该轮的状态、消息、判定结论、错误与会话日志，历史轮只读。节点消息与确认说明按 Markdown 渲染，不再提供二次「全屏」；非终态每 5s 轮询，弹层打开时按最新数据重绘（停留在最新则跟随新轮，停留在历史则保持）。
4. 人工确认：双击 `waiting_confirm` 节点，弹层顶部出现橙色卡片；节点「专家」优先显示 `RunNodeView.expertName`，没有快照时才查当前专家列表，仍无则显示「—」而不显示裸 UUID；仅最新轮可提交，批准/驳回提交 `POST /runs/{id}/nodes/{nodeId}/decision`，成功后刷新详情，节点状态与 run 状态由后端推进。
5. 终止：二次确认后 `POST /runs/{id}/cancel`，成功刷新；终态 run 不再显示终止。
6. 超时继续：`GET /runs/{id}` 返回 `state=waiting_resume` 且当前节点为 `waiting_resume` 时，轨迹上方显示等待横幅（节点名、`error.code`/`error.message`、原任务原会话提示、工作区占用提示、「继续执行」「取消运行」），画布当前节点用 amber 等待继续态；双击该节点，最新轮弹层出现同款等待卡与继续按钮，非等待节点与历史轮不出现。点击继续后按钮禁用并显示「正在继续…」，调用 `POST /runs/{id}/nodes/{nodeId}/resume`（无请求体），请求期间不重复提交；`200` 后用响应 `RunDetail` 或重新拉取更新页面，run 回到 `running`、节点回到 `dispatched`、等待横幅与等待卡消失，提示「已提交，等待客户端执行」，同一 `taskId` 保留；`409` 按 `details.reason` 提示并刷新，`503`/网络错误保留按钮可重试，`404` 提示并返回列表。等待期「取消运行」沿用取消端点。
7. 资产删除兼容：工作流/专家/Harness 的删除确认框都说明未结束的运行会阻止删除；删除只被终态 run 引用的资产成功后，历史运行仍可用 `RunDetail.graph` 与 `workflowName` 打开；删除被活跃 run 引用的资产返回 409 `referenced`，前端按 `details.references` 中 `type="run"` 提示「有未结束的运行」并保留当前列表/对话框，不自动取消运行。

失败路径：损坏或版本不符的路径历史按空历史处理，其他 `clientId` 的历史不得进入当前下拉，删除历史不得改写输入框；未双击节点不出现节点详情；历史轮次不出现人工确认入口；取消终止确认不改状态；驳回未填意见被前端拦住；非 `waiting_confirm` 节点不出现确认卡片；非 `waiting_resume` 节点不出现继续入口；续跑 `409` 按 reason 提示并保留等待态、不伪造成功，`503` 保留按钮；`run_not_found` 显示「运行不存在或已删除」且不回落夹具；发起运行缺 Harness/路径/意图时前端不提交；有 `run.graph` 时不得再请求 `GET /workflows/{id}`；`run.graph` 与回退工作流都没有时显示无图占位而不是整页错误；专家已删除时不得显示裸 UUID；删除 409 含 run 时必须提示「有未结束的运行」且不删除。

## 不可变引用

- B4 `RunSummary` / `RunDetail` / `RunNodeView` 字段与状态闭集（`CMP-run-data` §2）；资产删除场景额外依赖 `RunSummary.workflowName`/`harnessName`、`RunDetail.graph`、`RunNodeView.expertName` 与删除 409 `details.references` 的 `type="run"`。
- API-42–API-47 的路径、错误码与 `If-Match` 无关（运行编排不使用 revision 头）；API-54 `resumeRunNode` 无请求体，成功返回 `RunDetail`，`409 invalid_state` 的 `details.reason` 用于区分续跑失败原因。图片初始资料的 `API-55`–`API-58` 由 `SCN-0024` 引用，本场景只在无图启动时不带 `inputs`。
- `DF.renderShell`、`DF.modal`、`DF.tag`、`DF.fmtDur`、`DF.fmtClock` 的展示语义。
- Milkdown 适配层 `shared/markdown-editor.js` 的 `mountMarkdown/destroyMarkdown`。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1/B3（运行接口由 `tools/fake-b1.js` 的 run 夹具提供，工作流由 `tools/fake-b3.js` 提供；多轮夹具由 `addRunFixture` 注入并配套自定义工作流图）。可执行：`node tools/verify-m1-scenarios.js SCN-0004`。最近一次执行：2026-11-18，16/16 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0004-T1 | 正 | 列表 5 行；Tab 计数 全部5 / 进行中1 / 等待人工确认1 / 等待继续1 / 已结束2；执行节点列显示 `client-stub-01`；`waiting_resume` 行显示「执行超时，等待继续」 | `tools/verify-m1-scenarios.js#scn0004T1` |
| SCN-0004-T2 | 正 | 详情画布 3 个节点，成功 1 / 等待人工 1，无右侧面板；双击节点打开 90% × 90% 弹层（宽度/高度与视口 90% 误差 ≤2px），确认卡片与「请确认方案」可见且按 Markdown 渲染；Tab 可切到会话日志；视口压到 500px 后弹层重算高度、内容超高时由弹层主体滚动；无二次全屏入口；Esc 关闭；暂停按钮 disabled | `tools/verify-m1-scenarios.js#scn0004T2` |
| SCN-0004-T3 | 正 | 双击节点后空意见驳回被拦（保留卡片）；填意见后批准 → 成功节点 2、运行中节点 1，run 回到「运行中」 | `tools/verify-m1-scenarios.js#scn0004T3` |
| SCN-0004-T4 | 反 | 双击节点后节点消息按 Markdown 渲染（标题 + 2 条列表）且无全屏按钮；关闭弹层后取消终止确认仍为「运行中」且终止入口仍在；再次终止后状态「已终止」且终止入口消失 | `tools/verify-m1-scenarios.js#scn0004T4` |
| SCN-0004-T5 | 正 | 发起运行提交体 `harnessId`/`workspacePath`/`intentMarkdown` 与表单一致，`autoConfirm=false`，跳转详情 | `tools/verify-m1-scenarios.js#scn0004T5` |
| SCN-0004-T6 | 正 | 多轮节点（开发 2 轮 + 评审打回）弹层出现「最新 · 第 2 轮 / 第 1 轮」Tab；默认最新轮显示第 2 轮消息，切历史轮显示第 1 轮消息、历史提示且无确认入口；会话日志链接带 `visit=1` 与 `session-n2-v1.ndjson.gz`；打回后的评审节点仍可打开并显示「评审不通过」与驳回结论 | `tools/verify-m1-scenarios.js#scn0004T6` |
| SCN-0004-T7 | 正 | 预置 10 条 `client-stub-01` 历史与 1 条其他节点历史：下拉只显示当前节点 10 条且位于输入框下方、不越出视口；点选第二条填入输入框；小叉删除第三条后列表与 localStorage 均剩 9 条且输入框不变；发起成功后新路径置顶、同路径去重、封顶 10 条 | `tools/verify-m1-scenarios.js#scn0004T7` |
| SCN-0004-T8 | 反 | localStorage 为损坏 JSON 或只含其他 `clientId` 的历史时，下拉显示空态、不出现任何历史项，输入框保留默认路径且仍可手输新的绝对路径 | `tools/verify-m1-scenarios.js#scn0004T8` |
| SCN-0004-T9 | 正 | 打开 `waiting_resume` 详情：画布当前节点为 `st-timeout` 且副标题「超时，等待继续」；等待横幅显示节点名、`prompt 超时（1800000ms）`、两条提示、`taskId` 与「继续执行」「取消运行」；非等待节点弹层无继续卡，等待节点弹层有继续卡与按钮；点击继续后按钮禁用并显示「正在继续…」，只发一次 `POST /runs/{id}/nodes/n2/resume`；`200` 后横幅消失、节点变 `st-run`、run 显示「运行中」，提示「已提交，等待客户端执行」，弹层仍显示同一 `taskId` | `tools/verify-m1-scenarios.js#scn0004T9` |
| SCN-0004-T10 | 反 | 续跑返回 409 `node_not_waiting_resume`：toast 显示「继续失败：节点已不在等待继续状态，请刷新后重试」，保留等待横幅与可用按钮，不出现成功提示，run 仍为等待态 | `tools/verify-m1-scenarios.js#scn0004T10` |
| SCN-0004-T11 | 反 | 续跑返回 503：toast 显示后端不可用，保留等待横幅与可重试按钮，不本地改成成功 | `tools/verify-m1-scenarios.js#scn0004T11` |
| SCN-0004-T12 | 正 | 有 `RunDetail.graph` 时详情用快照画 3 个节点、标题显示 `workflowName` 与 `r7`，不再请求 `GET /workflows/{id}`；`run.graph` 缺失且工作流已删除时显示「该运行没有可用的图快照」占位，不进入整页错误 | `tools/verify-m1-scenarios.js#scn0004T12` |
| SCN-0004-T13 | 正 | 专家列表不含 `run.nodes[].expertId` 时，节点弹层「专家」显示 `RunNodeView.expertName`，不显示裸 UUID | `tools/verify-m1-scenarios.js#scn0004T13` |
| SCN-0004-T14 | 正 | 运行列表与 `?wfId=` 筛选横幅优先显示 `RunSummary.workflowName`；已删除工作流的运行仍可读，按历史 `workflowId` 过滤命中 1 条 | `tools/verify-m1-scenarios.js#scn0004T14` |
| SCN-0004-T15 | 正 | 工作流/专家/Harness 删除确认框均含「未结束的运行」；删除只被终态 run 引用的工作流成功，历史运行详情仍用 `RunDetail.graph` 渲染且标题保留 `workflowName` | `tools/verify-m1-scenarios.js#scn0004T15` |
| SCN-0004-T16 | 反 | 删除工作流/专家返回 409 `referenced` 且 `details.references` 含 `type="run"` 时，提示「有未结束的运行」，列表/对话框保留，不自动取消运行 | `tools/verify-m1-scenarios.js#scn0004T16` |
