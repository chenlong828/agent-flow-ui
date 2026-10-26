---
layer: design
module: skills
status: verified
flow: b1-integration
scenario: SCN-0013
updated: 2026-10-26
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

执行层：DOM（jsdom）+ `tools/fake-b1.js` 内存传输；BFF 契约用 Node `node:test` + stub 上游；真实 B1 页面读写用 `tools/verify-b1-pages.js` / `tools/verify-b1-writes.js`。可执行脚本：`node tools/verify-m1-scenarios.js SCN-0013`、`npm run test:bff`、`npm run test:b1-pages`、`npm run test:b1-writes`。最近一次执行：2026-10-26，SCN-0013 6/6 通过（专门页改造后）。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0013-T1 | 正 | 列表列头为「描述」；行文本含 DTO `description`；搜「方案」命中 CRES 技能且仅 1 行 | `tools/verify-m1-scenarios.js#SCN-0013-T1` |
| SCN-0013-T2 | 正 | 新建/编辑 body 只含 `description`；空与 401 字被阻断；合法值落库且无 `summary/triggers`；version 由服务端递增 | `tools/verify-m1-scenarios.js#SCN-0013-T2` |
| SCN-0013-T3 | 正 | 文档 Tab 首次 200 无 `If-None-Match`，渲染器收到以 frontmatter 开头的 Markdown；二次请求带 ETag，304 后渲染文本与首次完全一致 | `tools/verify-m1-scenarios.js#SCN-0013-T3` |
| SCN-0013-T4 | 正 | 空踩坑/空引用分别整节省略；停用 Skill 仍能读文档；专家 Skill 摘要读 `description` | `tools/verify-m1-scenarios.js#SCN-0013-T4`、`#SCN-0006-T2` |
| SCN-0013-T5 | 反 | 文档 404 不显示伪文本，显示错误与重试入口；恢复后重试可再走渲染器 | `tools/verify-m1-scenarios.js#SCN-0013-T5` |
| SCN-0013-T6 | 反 | 旧字段 400 映射为「契约已升级，请刷新页面」，保存按钮恢复且可重试成功 | `tools/verify-m1-scenarios.js#SCN-0013-T6` |
