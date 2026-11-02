---
layer: history
module: skills
status: frozen
flow: b1-integration
scenario: SCN-0013
updated: 2026-10-29
---

# SCN-0013 Skill 契约 v2 展示端适配

## 入口

- `CMP-bff/bff/index.js#handle`
- `CMP-skills/pages/skills.html`
- `CMP-experts/pages/experts.html`

## 运行序

1. Skill 列表 `GET /skills` 直接消费 B1 `SkillListItem.description`；搜索框按名称、`description`、标签过滤，列表列头显示「描述」，不再出现 `summary/triggers`。
2. 专门详情页 `GET /skills/{id}` 显示 `description`、类别、标签与五章 `sections`；专家页的 Skill 预览/挑选弹窗只读 `description`，不出现 `undefined` 或旧字段。
3. 新建 `POST /skills`、更新 `PUT /skills/{id}` 的 body 为 `name/categoryCode/description/tags/sections/pitfalls/refs`；`description` 前端校验 1–400 字，服务端 trim 后落库，页面使用返回 DTO 的 `version`。
4. 查看态切换到「文档」：`window.API.document('skill', id)` 请求 `GET /skills/{id}/document`，只接受 `text/markdown`，响应体交给 Milkdown 只读渲染；不读 `sections` 二次拼装，不再使用 `<pre>` 原文视图。
5. 第二次进入文档 Tab 带 `If-None-Match: <上次 ETag>`；200 更新文本与 ETag，304 保留上次文本并显示「304 · 已复用上次文本」。停用 Skill 仍可 200 读取；404 显示「目标不存在或已被删除」并提供重试。
6. BFF 将 `If-None-Match` 加入请求白名单，原样透传 `ETag` 与 304；不缓存文档、不改写 `Content-Type`。

失败路径：旧字段 `summary/triggers` 被后端 400 `validation_error`（`details.field=body`）时，页面提示「契约已升级，请刷新页面」，保留表单可重试；空/超长 `description` 前端阻断；文档 200 但为空按空态显示；304 无本地文本时重新发起非条件请求。

## 不可变引用

- B1 `SkillListItem/SkillDetail` v2 字段：`description` 必填 1–400 字；不再有 `summary/triggers`；`version/enabled/revision` 仍由服务端管理。
- B1 API-31：`GET /api/v1/skills/{id}/document` 返回 `text/markdown; charset=utf-8`、`ETag: "<revision>"`、`Cache-Control: no-cache`；`If-None-Match` 精确匹配返回 304 空体；缺失 404；停用仍 200。
- 文档结构：frontmatter `name/description/version`；五章顺序 `流程总述/执行步骤/示例/脚本/完成验证`；可选 `常见踩坑`、`参考资料`；空可选节整节省略；末尾单换行。
- 旧字段 `summary/triggers` 出现在创建/更新 body 时，B1 返回 400 `validation_error` 且 `details.field="body"`。
- `CMP-bff` 只做透明转发，不缓存、不重试、不映射、不改写文档。

## 测试

本场景随 Skill 契约 v2 废弃，不再执行；由 `SCN-0016`（草稿编辑与保存）与 `SCN-0017`（整包下载）取代。
