---
layer: design
module: skills
status: designed
flow: manage-skill
scenario: SCN-0005
updated: 2026-10-23
---

# SCN-0005 Skill 维护与渐进披露

## 入口

- `CMP-skills/assets/js/pages/skills.js#render`
- `CMP-skills/pages/skills.html#page-body`

## 运行序

1. 列表渲染分类/标签/关键词筛选与「共 n / 总数」计数；计数与 `MOCK.skills` 同源。
2. 打开详情抽屉，五章工作内容按 `SECTIONS` 渐进披露：常驻摘要 + 默认展开首章，其余折叠。
3. 编辑保存写回 `MOCK.skills` 并递增版本号（次位 +1，满 10 进位）；新建生成 v1.0。
4. 启停/删除：启停改 `enabled`；被专家引用（`usedBy > 0`）时删除被拒绝，停用需确认。

失败路径：删除被引用 Skill 不得 `splice`；取消编辑丢弃草稿；空名称/空章节不得保存。

## 不可变引用

- `MOCK.skills` 的 `id/name/category/ver/enabled/usedBy/sections/updatedM` 字段契约。
- 五章 `SECTIONS` 结构与 `bumpVersion` 的版本规则。
- `DF.drawer`、`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0005-T1 | 正 | 列表条目数与 `MOCK.skills.length` 相等；分类筛选后计数与对应夹具子集相等 | 待补 |
| SCN-0005-T2 | 正 | 详情抽屉显示五个章节；首章展开、其余折叠；摘要常驻 | 待补 |
| SCN-0005-T3 | 正 | 保存编辑后版本号递增一档并写回内存；新建 Skill 版本为 v1.0 且总数 +1 | 待补 |
| SCN-0005-T4 | 反 | 删除 `usedBy > 0` 的 Skill 被拒绝并提示引用数，`MOCK.skills` 长度不变 | 待补 |
