---
layer: design
module: skills
status: verified
flow: manage-skill
scenario: SCN-0005
updated: 2026-10-29
---

# SCN-0005 Skill 维护与渐进披露

## 入口

- `CMP-skills/assets/js/pages/skills.js#renderList`
- `CMP-skills/pages/skills.html#page-body`

## 运行序

1. 页面通过 `API.list('skill',{limit:200})` 读 B1 DTO；分类由 `API.categories()` 提供，`data-cat` 使用 code，计数与列表同源。
2. 名称/查看跳转 `skill-detail.html?id=<id>`；专门页 `API.get('skill', id)` 取 `body` 与 `files`，正文交给渲染器只读渲染，文件清单标出 `SKILL.md` 只读。
3. 编辑保存不再 `PUT /skills`：先建草稿，保存 `POST /skill-drafts/{id}/save`，body 只含 `name/categoryCode/description/tags/body`，版本号由服务端返回。
4. 启停 `PATCH /enabled`、删除 `DELETE`；被专家引用时 B1 返回 409 `referenced`，页面提示引用数并保留列表。

失败路径：被引用 Skill 不得删除；取消编辑丢弃草稿；空名称/空描述/超 400 字不得保存；正文超 16 KiB 阻断并提示放 `references/`；加载失败显示重试。

## 不可变引用

- B1 `SkillListItem/SkillDetail` 字段契约（含 `body`、`files[{path,size,readOnly}]`）；不再有 `sections/pitfalls/refs` 与 `summary/triggers`。
- 保存走草稿与 `If-Match` 语义；`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js` 内存传输；真实读写另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-29，SCN-0005 4/4 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0005-T1 | 正 | 列表条目数与计数同源；分类 `retrieval` 筛选后 4 条 | `tools/verify-m1-scenarios.js#SCN-0005-T1` |
| SCN-0005-T2 | 正 | 查看态渲染正文且无结构化/文档 Tab；文件清单含只读 `SKILL.md` | `tools/verify-m1-scenarios.js#SCN-0005-T2` |
| SCN-0005-T3 | 正 | 编辑保存后描述写回、版本递增、草稿被消费并回到查看态 | `tools/verify-m1-scenarios.js#SCN-0005-T3` |
| SCN-0005-T4 | 反 | 删除 usedByCount>0 的 Skill 被 B1 409 拒绝，提示 N 位专家引用，长度不变 | `tools/verify-m1-scenarios.js#SCN-0005-T4` |
