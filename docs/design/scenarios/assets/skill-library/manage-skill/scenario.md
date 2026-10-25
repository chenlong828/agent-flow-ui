---
layer: design
module: skills
status: verified
flow: manage-skill
scenario: SCN-0005
updated: 2026-10-25
---

# SCN-0005 Skill 维护与渐进披露

## 入口

- `CMP-skills/assets/js/pages/skills.js#renderList`
- `CMP-skills/pages/skills.html#page-body`

## 运行序

1. 页面通过 `API.list('skill',{limit:200})` 读 B1 DTO；分类由 `API.categories()` 提供，`data-cat` 使用 code，计数与列表同源。
2. 打开详情抽屉：`API.get('skill', id)` 取完整 DTO，五章 `sections` 按 `details` 渐进披露，首章展开、其余折叠。
3. 编辑保存 `PUT /skills/{id}`，body 只含 `name/categoryCode/summary/tags/triggers/sections/pitfalls/refs`；版本号由服务端返回，页面不本地递增。新建 `POST` 必须带非空 `summary`，服务端生成 v1.0。
4. 启停 `PATCH /enabled`、删除 `DELETE`；被专家引用时 B1 返回 409 `referenced`，页面提示引用数并保留列表。

失败路径：被引用 Skill 不得删除；取消编辑丢弃草稿；空名称/空摘要不得保存；加载失败显示重试。

## 不可变引用

- B1 `SkillListItem/SkillDetail` 的 `id/name/categoryCode/categoryLabel/summary/version/enabled/tags/triggers/sections/pitfalls/refs/usedByCount/revision` 字段契约。
- 五章 `sections` 结构与 `refs[].refType`；`If-Match` 由 `window.API` 生成。
- `DF.drawer`、`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-25，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0005-T1 | 正 | 列表条目数与计数同源；分类 `retrieval` 筛选后 4 条 | `tools/verify-m1-scenarios.js#SCN-0005-T1` |
| SCN-0005-T2 | 正 | 详情抽屉 5 个 details，首章展开、其余折叠 | `tools/verify-m1-scenarios.js#SCN-0005-T2` |
| SCN-0005-T3 | 正 | 编辑保存后版本递增且摘要写回；新建 Skill 需摘要、为 v1.0 且总数 +1 | `tools/verify-m1-scenarios.js#SCN-0005-T3` |
| SCN-0005-T4 | 反 | 删除 usedByCount>0 的 Skill 被 B1 409 拒绝，提示 N 位专家引用，长度不变 | `tools/verify-m1-scenarios.js#SCN-0005-T4` |
