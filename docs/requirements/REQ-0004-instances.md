---
layer: requirements
module: instances
status: accepted
updated: 2026-10-23
---

# REQ-0004 实例监控与运行控制

| 字段 | 内容 |
|---|---|
| ID | `REQ-0004` |
| 类型 | `feature` |
| 场景叙述 | 运行观察者进入实例列表或详情，查看进度、节点轨迹与留痕，对运行中的实例暂停/恢复/终止，对失败节点重试或从节点重跑，并处理等待人工确认的批准/驳回。 |
| 价值 | 没有实例视图，工作流只能被定义，无法被观察、干预或审批；异常与回退也无法留痕。 |
| 非目标 | 不做真实调度器与执行引擎；fan-out 数千规模只做聚合统计 + 抽样；终止/重跑为原型状态迁移，不取消真实任务。 |
| 约束 | 纯前端静态原型；实例状态机固定值；终止不可逆、暂停可恢复；人工批准/驳回互斥；不新增依赖。 |
| 影响场景 | `SCN-0004`（`design/scenarios/operations/instances/control-instance/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/详情与状态迁移已存在；本次补 REQ/SCN，场景到 `designed`，未 `verified`。 |
| 状态 | `accepted` |
