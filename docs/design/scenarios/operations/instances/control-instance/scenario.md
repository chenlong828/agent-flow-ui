---
layer: design
module: instances
status: verified
flow: control-instance
scenario: SCN-0004
updated: 2026-11-17
---

# SCN-0004 运行实例监控与发起运行（B4 live）

> 需求：`REQ-0019`（取代 `REQ-0004`）；节点详情交互调整见 `REQ-0020`；多轮历史查看见 `REQ-0021`。

## 入口

- `CMP-instances/assets/js/pages/instances.js#init`
- `CMP-instances/assets/js/pages/instance-detail.js#init`
- `CMP-instances/pages/instances.html`、`pages/instance-detail.html?id=<runId>`

## 运行序

1. 打开列表：并发加载 `GET /runs?limit=200` 与 `GET /workflows?limit=200`；按状态分组渲染四个 Tab（全部 / 进行中 / 等待人工确认 / 已结束），工作流名在页面侧 join；行内操作随状态出现：详情、去确认（`waiting_confirm`）、终止（非终态）。
2. 发起运行：选工作流（B3 列表）、选执行 Harness（`/harnesses` 中 `enabled && clientId`）、填绝对路径、在 Milkdown 编辑器写启动意图；提交 `POST /workflows/{id}/runs`，成功跳转详情。
3. 详情：`GET /runs/{id}` + `GET /workflows/{workflowId}`；轨迹图按 `toEditorGraph` 布局占满内容区，画布颜色取 `run.nodes` 中该节点最大 `visit`；单击节点只切换选中高亮，双击节点打开 90% × 90% 弹层（`DF.modal size:'screen'`，窗口 resize 重算，内容超出在弹层主体内滚动，Esc/遮罩/× 关闭）。同一节点按 `nodeId + visit` 保留全部执行轮次：多轮时弹层显示「最新 · 第 N 轮 / 第 N-1 轮…」Tab，默认最新轮；切到历史轮显示该轮的状态、消息、判定结论、错误与会话日志，历史轮只读。节点消息与确认说明按 Markdown 渲染，不再提供二次「全屏」；非终态每 5s 轮询，弹层打开时按最新数据重绘（停留在最新则跟随新轮，停留在历史则保持）。
4. 人工确认：双击 `waiting_confirm` 节点，弹层顶部出现橙色卡片；仅最新轮可提交，批准/驳回提交 `POST /runs/{id}/nodes/{nodeId}/decision`，成功后刷新详情，节点状态与 run 状态由后端推进。
5. 终止：二次确认后 `POST /runs/{id}/cancel`，成功刷新；终态 run 不再显示终止。

失败路径：未双击节点不出现节点详情；历史轮次不出现人工确认入口；取消终止确认不改状态；驳回未填意见被前端拦住；非 `waiting_confirm` 节点不出现确认卡片；`run_not_found` 显示「运行不存在或已删除」且不回落夹具；发起运行缺 Harness/路径/意图时前端不提交。

## 不可变引用

- B4 `RunSummary` / `RunDetail` / `RunNodeView` 字段与状态闭集（`CMP-run-data` §2）。
- API-42–API-47 的路径、错误码与 `If-Match` 无关（运行编排不使用 revision 头）。
- `DF.renderShell`、`DF.modal`、`DF.tag`、`DF.fmtDur`、`DF.fmtClock` 的展示语义。
- Milkdown 适配层 `shared/markdown-editor.js` 的 `mountMarkdown/destroyMarkdown`。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1/B3（运行接口由 `tools/fake-b1.js` 的 run 夹具提供，工作流由 `tools/fake-b3.js` 提供；多轮夹具由 `addRunFixture` 注入并配套自定义工作流图）。可执行：`node tools/verify-m1-scenarios.js SCN-0004`。最近一次执行：2026-11-17，6/6 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0004-T1 | 正 | 列表 4 行；Tab 计数 全部4 / 进行中1 / 等待人工确认1 / 已结束2；执行节点列显示 `client-stub-01` | `tools/verify-m1-scenarios.js#scn0004T1` |
| SCN-0004-T2 | 正 | 详情画布 3 个节点，成功 1 / 等待人工 1，无右侧面板；双击节点打开 90% × 90% 弹层（宽度/高度与视口 90% 误差 ≤2px），确认卡片与「请确认方案」可见且按 Markdown 渲染；Tab 可切到会话日志；视口压到 500px 后弹层重算高度、内容超高时由弹层主体滚动；无二次全屏入口；Esc 关闭；暂停按钮 disabled | `tools/verify-m1-scenarios.js#scn0004T2` |
| SCN-0004-T3 | 正 | 双击节点后空意见驳回被拦（保留卡片）；填意见后批准 → 成功节点 2、运行中节点 1，run 回到「运行中」 | `tools/verify-m1-scenarios.js#scn0004T3` |
| SCN-0004-T4 | 反 | 双击节点后节点消息按 Markdown 渲染（标题 + 2 条列表）且无全屏按钮；关闭弹层后取消终止确认仍为「运行中」且终止入口仍在；再次终止后状态「已终止」且终止入口消失 | `tools/verify-m1-scenarios.js#scn0004T4` |
| SCN-0004-T5 | 正 | 发起运行提交体 `harnessId`/`workspacePath`/`intentMarkdown` 与表单一致，`autoConfirm=false`，跳转详情 | `tools/verify-m1-scenarios.js#scn0004T5` |
| SCN-0004-T6 | 正 | 多轮节点（开发 2 轮 + 评审打回）弹层出现「最新 · 第 2 轮 / 第 1 轮」Tab；默认最新轮显示第 2 轮消息，切历史轮显示第 1 轮消息、历史提示且无确认入口；会话日志链接带 `visit=1` 与 `session-n2-v1.ndjson.gz`；打回后的评审节点仍可打开并显示「评审不通过」与驳回结论 | `tools/verify-m1-scenarios.js#scn0004T6` |
