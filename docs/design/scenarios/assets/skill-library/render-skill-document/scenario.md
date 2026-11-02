---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0015
updated: 2026-10-29
---

# SCN-0015 正文渲染（Milkdown 适配层）

## 入口

- `CMP-skills/pages/skill-detail.html#page-body`
- `CMP-skills/assets/js/pages/skill-detail.js#mountBodyView`

## 运行序

1. 查看态用详情返回的 `body` 调 `window.SKILL_MD.mount(el, { editable: false })`，不请求 `/document`，不在前端拼装章节。
2. 适配层加载 7.7.0 单包，把 Markdown 渲染成只读文档；渲染结果不提供编辑入口，不执行原始 HTML/脚本。
3. 编辑态用同一适配层、`editable: true`，`onChange` 回写正文并触发字节计数。
4. 渲染结果只用于阅读与编辑，不承担保存、版本、启停等业务动作。

失败路径：渲染器初始化失败时显式报错并提供重试，不静默回落为原始 `<pre>`；空正文显示空态。

## 不可变引用

- 详情 `body` 已去掉 frontmatter；正文渲染不再依赖 `/document`。
- `window.SKILL_MD` 适配层契约：`mount(target,{markdown,editable,onChange})`，不泄漏 ProseMirror 类型。
- `DEP-0001` 7.7.0 单包，查看与编辑共用。

## 测试

执行层：Playwright WebKit+ 渲染层（`npm run test:skill-render`）+ 真实引擎。最近一次执行：2026-10-29，SCN-0015 4/4 通过；渲染层 9/9 通过；引擎层（WebKit）29/29 通过（含表格边框、标题/段落间距、长串不撑破页面）。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0015-T1 | 正 | 查看态只读渲染，收到不含 frontmatter 的 Markdown 正文 | `tools/verify-m1-scenarios.js#SCN-0015-T1` |
| SCN-0015-T2 | 正 | 停用 Skill 仍渲染正文 | `tools/verify-m1-scenarios.js#SCN-0015-T2` |
| SCN-0015-T3 | 正 | 渲染结果不是 Markdown 源码 | `tools/verify-m1-scenarios.js#SCN-0015-T3` |
| SCN-0015-T4 | 反 | 渲染器失败显式报错，重试后恢复 | `tools/verify-m1-scenarios.js#SCN-0015-T4` |
