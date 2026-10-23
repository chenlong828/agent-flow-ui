---
layer: requirements
module: skills
status: accepted
updated: 2026-10-23
---

# REQ-0005 Skill 维护与渐进披露

| 字段 | 内容 |
|---|---|
| ID | `REQ-0005` |
| 类型 | `feature` |
| 场景叙述 | Skill 维护者浏览/搜索 Skill，打开详情查看工作内容与引用方，编辑章节、启停或删除 Skill，并新建一条带版本号的 Skill。 |
| 价值 | 没有 Skill 库，专家只能把方法写在提示词里，无法复用、按需加载与治理引用。 |
| 非目标 | 不做真实 Skill 执行与向量检索；不做跨版本 diff/回滚；引用计数使用夹具字段，不接真实反向索引。 |
| 约束 | 纯前端静态原型；工作内容渐进披露；保存递增版本号；被专家引用时删除受保护；不新增依赖。 |
| 影响场景 | `SCN-0005`（`design/scenarios/assets/skill-library/manage-skill/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/抽屉/版本递增已存在；本次补 REQ/SCN，场景到 `designed`，未 `verified`。 |
| 状态 | `accepted` |
