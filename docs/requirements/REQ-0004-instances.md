---
layer: requirements
module: instances
status: delivered
updated: 2026-10-23
---

# REQ-0004 实例监控与运行控制

| 字段 | 内容 |
|---|---|
| ID | `REQ-0004` |
| 类型 | `feature` |
| 场景叙述 | 运行观察者进入运行列表或详情，查看真实工作流运行的状态、节点轨迹与结论；从列表发起运行（选工作流、执行 Harness、工作区路径与意图），对进行中的运行终止，对等待人工确认的节点批准或驳回，并下载执行节点上传的会话日志。 |
| 价值 | 没有实例视图，工作流只能被定义，无法被观察、干预或审批；异常与回退也无法留痕。 |
| 非目标 | 不实现调度器与执行引擎（由 B4 提供）；不提供后端没有的暂停/恢复、节点重试、从节点重跑、输入输出与工作区留痕、fan-out 子任务下钻；不做运行历史版本回放；不做 split/fanout 的启动执行（第二期）。 |
| 约束 | 运行两页 live-only，数据源为 B4 `/api/v1/runs`（经同源 BFF），不回落 MOCK；发起运行必须选已绑定 `clientId` 且启用的 Harness，工作区路径为绝对路径，意图为 Markdown；状态闭集 `created/running/waiting_confirm/done` 与 `outcome` 由后端决定，页面不推断；后端未提供的能力入口置灰并注明；不新增运行时依赖（意图编辑复用已准入的 Milkdown 7.7.0）。 |
| 影响场景 | `SCN-0004`（`design/scenarios/operations/instances/control-instance/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/详情与状态迁移已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。2026-11-12 用户要求按 B4 运行编排 API 适配界面：运行列表/详情改为 live `/runs`，发起运行改为「工作流 + Harness 下拉 + 路径文本框 + 意图所见即所得编辑器」，后端未提供的控制入口保留并置灰；`SCN-0004` 按 live 重写并保持 `verified`（5/5）。 |
| 状态 | `delivered` |
