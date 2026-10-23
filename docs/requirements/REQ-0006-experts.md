---
layer: requirements
module: experts
status: delivered
updated: 2026-10-23
---

# REQ-0006 专家注册与组合配置

| 字段 | 内容 |
|---|---|
| ID | `REQ-0006` |
| 类型 | `feature` |
| 场景叙述 | 专家维护者浏览/搜索专家，打开五区详情，编辑角色、Skill 组合、工具清单、工作内容与参考知识，启停专家或新建专家。 |
| 价值 | 没有专家注册，工作流节点无法绑定可复用的角色、方法与工具组合，专家只能散落在各页面提示词里。 |
| 非目标 | 不做真实 Agent 运行时与权限；不做 Skill/工具定义（各自组件负责）；停用只改夹具状态，不撤销已运行实例。 |
| 约束 | 纯前端静态原型；五区详情结构固定；Skill/工具只能取自本页可见资产；被引用时停用需确认；不新增依赖。 |
| 影响场景 | `SCN-0006`（`design/scenarios/assets/expert-registry/manage-expert/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：卡片/五区抽屉/启停已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。 |
| 状态 | `delivered` |
