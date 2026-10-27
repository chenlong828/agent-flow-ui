---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0014
updated: 2026-10-27
---

# SCN-0014 Skill 专门页面查看与编辑

## 入口

- `CMP-skills/pages/skill-detail.html#page-body`
- `CMP-skills/assets/js/pages/skill-detail.js#init`
- `CMP-skills/pages/skills.html#row-open`（已改造：从打开抽屉改为跳转专门页面）

## 运行序

1. 列表点击名称或「查看」打开 `/pages/skill-detail.html?id=<id>`；页面经 `window.API.get('skill', id)` 读取详情，默认显示结构化五章；`CMP-skills` 不再打开详情抽屉。
2. 行菜单「编辑」打开 `/pages/skill-detail.html?id=<id>&mode=edit`；编辑态复用现有结构化五章表单，保存 `PUT /skills/{id}` 时仍带 `If-Match`，成功后使用响应 DTO 更新 `version/updatedAt` 并回到查看态。
3. 列表「+ 新建Skill」打开 `/pages/skill-detail.html?mode=new`；最小必填项仍为 `name/categoryCode/description`，提交 `POST /skills` 成功后进入该 id 的编辑态，不再回到列表弹窗。
4. 列表页保留搜索、分类/标签筛选、启停、删除、引用计数入口；文档 Tab 只在查看态出现，编辑/新建态提供「预览」Tab，用本地草稿 Markdown 做只读渲染，不调用 API-31。

失败路径：缺 id、无效 id、404 或网络失败时页面显示显式错误与重试入口，不得回落 MOCK；`description` 为空或超 400 字时前端阻断；取消编辑丢弃草稿。

## 不可变引用

- B1 `SkillListItem/SkillDetail` v2 契约：`description` 必填 1–400 字，`version/revision` 由服务端管理，仍无 `summary/triggers`。
- `window.API` 对 B1 DTO 的直连语义与 `If-Match` 生成规则。
- `DF.renderShell` 外壳与 `DF.toast/modal/menu` 原语语义。
- `CMP-bff` 只做透明转发，不缓存、不改写 DTO。

## 测试

执行层：DOM（jsdom）+ 真实引擎（Playwright WebKit）。最近一次执行：2026-10-27，DOM 5/5 + 引擎 15/15 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0014-T1 | 正 | 列表点名称/查看进入专门页面而非抽屉，默认显示结构化五章 | `tools/verify-m1-scenarios.js#SCN-0014-T1`、`tools/verify-skill-page-engine.js#A` |
| SCN-0014-T2 | 正 | 编辑保存后 `version/updatedAt` 来自响应 DTO，页面回到查看态且仍无 `summary/triggers` | `tools/verify-m1-scenarios.js#SCN-0014-T2` |
| SCN-0014-T3 | 正 | 新建态提交后进入新建 Skill 的编辑态，列表重新进入后能看到新条目 | `tools/verify-m1-scenarios.js#SCN-0014-T3` |
| SCN-0014-T4 | 反 | 缺 id/无效 id/404 显示显式错误与重试入口，不回落 MOCK、不渲染空页 | `tools/verify-m1-scenarios.js#SCN-0014-T4`、`tools/verify-skill-page-engine.js#C` |
| SCN-0014-T5 | 正 | 编辑态「预览」Tab 用最新草稿 Markdown 只读渲染，不调用 API-31 | `tools/verify-m1-scenarios.js#SCN-0014-T5` |
