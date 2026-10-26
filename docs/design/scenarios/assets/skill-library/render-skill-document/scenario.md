---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0015
updated: 2026-10-26
---

# SCN-0015 Milkdown 渲染 Skill 文档

## 入口

- `CMP-skills/pages/skill-detail.html#document-tab`
- `CMP-skills/assets/js/pages/skill-detail.js#renderDocument`

## 运行序

1. 查看态切换到「文档」Tab，页面调用 `window.API.document('skill', id)` 请求 `GET /skills/{id}/document`。
2. 响应体整体交给 Milkdown 只读渲染；不在前端重组 `sections`，不把 Markdown 塞回 `<pre>`，也不把渲染器暴露为编辑入口；代码块启用语法高亮。
3. 再次进入文档 Tab 时沿用 `window.API` 的 ETag 缓存：200 更新文本与 ETag，304 保留上次文本；停用 Skill 仍可 200 读取。
4. 渲染结果用于阅读，不承担保存、版本、启停等业务动作。

失败路径：404 或网络失败时显示显式错误与重试入口；空文档显示空态；渲染器初始化失败时显式报错，不静默回落为原始 `<pre>`；原始 HTML/脚本不得被执行。

## 不可变引用

- B1 API-31：`GET /api/v1/skills/{id}/document` 返回 `text/markdown; charset=utf-8`、`ETag`、`Cache-Control: no-cache`；`If-None-Match` 精确匹配返回 304 空体；缺失 404；停用仍 200。
- 文档结构：frontmatter `name/description/version`；五章顺序 `流程总述/执行步骤/示例/脚本/完成验证`；可选 `常见踩坑`、`参考资料`；空可选节整节省略；末尾单换行。
- `window.API.document` 的文档缓存语义：按 revision 失效，304 复用上次文本。
- Milkdown 在本场景中只作为只读渲染运行时，不作为编辑器，也不改写 API-31 响应体。

## 测试

执行层：DOM（jsdom）+ 真实引擎（Playwright WebKit）。最近一次执行：2026-10-26，DOM 5/5 + 渲染层 5/5 + 引擎 15/15 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0015-T1 | 正 | 文档 Tab 使用 Milkdown 渲染标题/段落/列表/代码块，代码块带语法高亮，不再出现 `<pre>` 原文视图 | `tools/verify-skill-page-render.js#SCN-0015-T1`、`tools/verify-m1-scenarios.js#SCN-0015-T1`、`tools/verify-skill-page-engine.js#B` |
| SCN-0015-T2 | 正 | 二次进入文档 Tab 带 `If-None-Match`，304 后文本与首次一致且状态提示为 304 | `tools/verify-m1-scenarios.js#SCN-0015-T2` |
| SCN-0015-T3 | 正 | 停用 Skill 仍可读取并渲染文档 | `tools/verify-m1-scenarios.js#SCN-0015-T3` |
| SCN-0015-T4 | 反 | 文档 404/网络失败显示显式错误与重试入口，不显示伪文本或静默空态 | `tools/verify-m1-scenarios.js#SCN-0015-T4` |
| SCN-0015-T5 | 反 | 原始 HTML/脚本不被执行，渲染结果不提供编辑入口 | `tools/verify-skill-page-render.js#SCN-0015-T5`、`tools/verify-m1-scenarios.js#SCN-0015-T5`、`tools/verify-skill-page-engine.js#B` |
