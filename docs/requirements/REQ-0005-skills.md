---
layer: requirements
module: skills
status: delivered
updated: 2026-11-13
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
| 澄清记录 | 2026-10-23 回溯登记：列表/抽屉/版本递增已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。<br>2026-11-13 用户报告 Skill 列表行「更多」菜单点击几次后不再弹出、菜单部分越出窗口；并入本卡修复（不新立 REQ）：共享 `DF.menu` 摘除旧关闭监听器并按实际宽高钳入视口四边（16px），行菜单改为右对齐触发按钮；SCN-0005 新增 T5。 |
| 状态 | `delivered`（2026-10-23；2026-11-13 行菜单重复打开与视口定位修复，SCN-0005 5/5） |
