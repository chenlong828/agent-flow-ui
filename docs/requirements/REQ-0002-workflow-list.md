---
layer: requirements
module: workflow-list
status: superseded
superseded_by: REQ-0016
updated: 2026-10-23
---

# REQ-0002 工作流列表浏览与生命周期入口

| 字段 | 内容 |
|---|---|
| ID | `REQ-0002` |
| 类型 | `feature` |
| 场景叙述 | 流程研发者进入工作流列表，按类型或名称找到目标流程，查看统计与最近运行，并通过新建、复制、删除、导出 DSL 或发起运行入口推进工作。 |
| 价值 | 没有列表，用户只能靠 URL 直进编辑器，无法回答“有哪些流程、各自最近跑得如何”，也无法完成生命周期入口动作。 |
| 非目标 | 不做画布节点编辑（`REQ-0003`）；不做实例生命周期（`REQ-0004`）；原型中的“发起运行”只提示并跳转实例页，不创建真实实例；不做权限与真实执行。 |
| 约束 | 纯前端静态原型；数据来自内存夹具、刷新复位；桌面视口；不新增依赖。 |
| 影响场景 | 已归档，由 `REQ-0016` / `SCN-0018` 取代；原文件 `history/scenarios/workflow-list-browse-workflows/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：页面与组件已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`；2026-10-30 由 `REQ-0016` 取代，旧场景归档。已知实现“发起运行”不写 `MOCK.instances`，已写入非目标。 |
| 状态 | `superseded`（2026-10-30，由 `REQ-0016` 取代） |
