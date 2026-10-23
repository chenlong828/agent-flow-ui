---
layer: requirements
module: harnesses
status: delivered
updated: 2026-10-23
---

# REQ-0007 Harness 注册与健康治理

| 字段 | 内容 |
|---|---|
| ID | `REQ-0007` |
| 类型 | `feature` |
| 场景叙述 | 设施维护者查看 Harness 列表与在线/负载状态，注册新的执行设施，编辑连接与配额，启停设施或删除空闲设施。 |
| 价值 | 没有 Harness 池，专家与工作流无法知道任务在哪里执行、容量多少、是否健康，运行只能停在纸面。 |
| 非目标 | 不做真实健康探测与调度；不做集群编排；心跳/负载为夹具模拟；停用标记只在本页内存有效。 |
| 约束 | 纯前端静态原型；并发上限为正数；运行中设施不可删除；停用需二次确认；不新增依赖。 |
| 影响场景 | `SCN-0007`（`design/scenarios/assets/harness-pool/manage-harness/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/注册/启停/删除已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。 |
| 状态 | `delivered` |
