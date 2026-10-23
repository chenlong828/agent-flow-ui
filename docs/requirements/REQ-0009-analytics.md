---
layer: requirements
module: analytics
status: delivered
updated: 2026-10-23
---

# REQ-0009 效能看板只读回看

| 字段 | 内容 |
|---|---|
| ID | `REQ-0009` |
| 类型 | `feature` |
| 场景叙述 | 管理者打开效能看板，查看交付吞吐、缺陷率、成功率、平均时长等 KPI，切换近 4/8 周趋势，查看阶段准出、评审准出记录与 Skill 审计。 |
| 价值 | 没有看板，运行数据只能停在实例列表，无法回答整体是否变好、卡在哪个阶段、哪些 Skill 需要审计。 |
| 非目标 | 不做真实指标采集与计算；不做导出；不做准出打分卡配置；近 12 周仅占位禁用。 |
| 约束 | 纯前端静态原型；全部数字来自 `MOCK.analytics`；页面只读、不写业务集合；不新增依赖。 |
| 影响场景 | `SCN-0009`（`design/scenarios/operations/performance/review-performance/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：KPI/趋势/准出/审计已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。 |
| 状态 | `delivered` |
