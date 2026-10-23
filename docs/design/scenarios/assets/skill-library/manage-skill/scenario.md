---
layer: design
module: skills
status: verified
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

执行层：DOM（jsdom）+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-23，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0005-T1 | 正 | 列表条目数与计数同源；分类「检索」筛选后 4 条 | `tools/verify-m1-scenarios.js#SCN-0005-T1` |
| SCN-0005-T2 | 正 | 详情抽屉 5 个 details，首章展开、其余折叠 | `tools/verify-m1-scenarios.js#SCN-0005-T2` |
| SCN-0005-T3 | 正 | 编辑保存后版本递增且摘要写回；新建 Skill 为 v1.0 且总数 +1 | `tools/verify-m1-scenarios.js#SCN-0005-T3` |
| SCN-0005-T4 | 反 | 删除 usedBy>0 的 Skill 被拒，提示 N 位专家引用，长度不变 | `tools/verify-m1-scenarios.js#SCN-0005-T4` |
