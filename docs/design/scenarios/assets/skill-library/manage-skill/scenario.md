---
layer: design
module: skills
status: verified
flow: manage-skill
scenario: SCN-0005
updated: 2026-10-26
---

# SCN-0005 Skill 维护与渐进披露

## 入口

- `CMP-skills/assets/js/pages/skills.js#renderList`
- `CMP-skills/pages/skills.html#page-body`

## 运行序

1. 页面通过 `API.list('skill',{limit:200})` 读 B1 DTO；分类由 `API.categories()` 提供，`data-cat` 使用 code，计数与列表同源。
2. 名称/查看跳转 `skill-detail.html?id=<id>`；专门页 `API.get('skill', id)` 取完整 DTO，五章 `sections` 按 `details` 渐进披露，首章展开、其余折叠，不再打开详情抽屉。
3. 编辑保存 `PUT /skills/{id}`，body 只含 `name/categoryCode/description/tags/sections/pitfalls/refs`；版本号由服务端返回，页面不本地递增。新建 `POST` 必须带 1–400 字的 `description`，服务端生成 v1.0。
4. 启停 `PATCH /enabled`、删除 `DELETE`；被专家引用时 B1 返回 409 `referenced`，页面提示引用数并保留列表。

失败路径：被引用 Skill 不得删除；取消编辑丢弃草稿；空名称/空描述/超 400 字不得保存；加载失败显示重试。

## 不可变引用

- B1 `SkillListItem/SkillDetail` 的 `id/name/categoryCode/categoryLabel/description/version/enabled/tags/sections/pitfalls/refs/usedByCount/revision` 字段契约；不再有 `summary/triggers`。
- 五章 `sections` 结构与 `refs[].refType`；`If-Match` 由 `window.API` 生成。
- `DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-26，SCN-0005 4/4 通过（专门页改造后）。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0005-T1 | 正 | 列表条目数与计数同源；分类 `retrieval` 筛选后 4 条 | `tools/verify-m1-scenarios.js#SCN-0005-T1` |
| SCN-0005-T2 | 正 | 专门页结构化五章 5 个 details，首章展开、其余折叠，且无详情抽屉 | `tools/verify-m1-scenarios.js#SCN-0005-T2` |
| SCN-0005-T3 | 正 | 专门页编辑保存后版本递增且 `description` 写回；`summary/triggers` 仍不出现 | `tools/verify-m1-scenarios.js#SCN-0005-T3` |
| SCN-0005-T4 | 反 | 删除 usedByCount>0 的 Skill 被 B1 409 拒绝，提示 N 位专家引用，长度不变 | `tools/verify-m1-scenarios.js#SCN-0005-T4` |
