---
layer: requirements
module: bff
status: accepted
updated: 2026-10-25
---

# REQ-0012 B1 资产同源接入与四类资产管理

| 字段 | 内容 |
|---|---|
| ID | `REQ-0012` |
| 类型 | `feature` |
| 场景叙述 | Harness / Tool / Skill / Expert 四个资产页通过 agent-flow-ui 的同源 BFF 访问 B1 后端，完成列表、详情、创建、编辑、启停与删除；写操作遵守 `If-Match` 乐观锁，专家保存走一次聚合 PATCH。其余 8 页继续使用 MOCK，并明确标注为演示数据。 |
| 价值 | 让 B1 的四类基础资产从“内存夹具”变为真实可录入、可回读、可并发保护的数据；没有它，原型只能演示，无法承担基础数据录入。 |
| 非目标 | 不接 B2 Key/Workspace、B3 Workflow、B4 Instance/Analytics；不做登录鉴权、TLS、CORS；不在 BFF 做 DTO 映射、聚合或 revision 缓存；不保留自动 MOCK 回退或 `?demo=1` 演示模式；不把工作流编辑器/实例页的资产选择切到实时数据。 |
| 约束 | BFF 只做同源透明转发，与静态服务同进程、同端口；浏览器以 API DTO 为唯一数据模型；四个资产页 live-only，后端不可用即报错；其余 8 页 MOCK 并标注；无构建、无第三方运行时依赖；只绑定 `127.0.0.1`。 |
| 影响场景 | `SCN-0012`（`design/scenarios/integration/b1-integration/scenario.md`） |
| 澄清记录 | 2026-10-25 确认：BFF 同进程；四页不再保留演示模式；其余页面继续 MOCK 标注；接受新增 `CMP-bff` 与架构边界变更。 |
| 状态 | `accepted` |
