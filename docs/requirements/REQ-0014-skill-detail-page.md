---
layer: requirements
module: skills
status: delivered
updated: 2026-10-29
---

# REQ-0014 Skill 专门页面与 Milkdown 文档渲染

| 字段 | 内容 |
|---|---|
| ID | `REQ-0014` |
| 类型 | `feature` |
| 场景叙述 | Skill 维护者从 Skill 列表进入专门的 Skill 页面，在同一页面完成新建、查看与编辑；查看态显示元数据、正文（Milkdown 只读渲染）与文件清单，编辑/新建走服务端草稿（见 `REQ-0015`）并用同一编辑器可写正文；不再使用详情抽屉，也不再把正文当作 `<pre>` 原文阅读。 |
| 价值 | 当前抽屉同时承载查看、编辑、全文三层职责，长文档阅读与结构化编辑互相挤压；页面化后可以用完整版面承载结构化信息与文档阅读，并把 Markdown 阅读从纯文本升级为真正的文档视图。 |
| 非目标 | 不用 Milkdown 做元数据表单或 Markdown 源码编辑；不在列表页引入 Markdown 渲染；不把正文渲染扩展到其他资产；不做版本历史、单文件预览；不解决移动端适配。 |
| 约束 | 仍为零构建、live-only，不回落 MOCK；Milkdown 7.7.0 单包经 `DEP-0001` 准入，不使用 CDN 直载；`description` 为 1–400 字；保存/启停/删除带 revision，`If-Match` 由 API 层生成；停用 Skill 仍可查看与下载；渲染失败不得静默回落为原始 `<pre>`，必须显式报错并可重试。 |
| 影响场景 | `SCN-0014`（`design/scenarios/assets/skill-library/open-skill-detail/scenario.md`，新建）；`SCN-0015`（`design/scenarios/assets/skill-library/render-skill-document/scenario.md`，新建）；实现后需同步修订 `SCN-0005` 中关于抽屉的断言；v2 契约部分随 `REQ-0013` 被 `REQ-0015` 取代。 |
| 澄清记录 | 2026-10-29：页面与 Milkdown 渲染保留，五章结构化表单与「文档」Tab 被 `REQ-0015` 的包形态取代，正文改为可编辑；2026-10-26 确认：文档 Tab 为只读渲染，不改为可编辑；默认视图仍为结构化；新建也迁移到专门页面；引入 Milkdown 作为第三方渲染运行时；「无第三方运行时依赖」的架构基线与组件规格放到后续变更中修订。 |
| 状态 | `delivered` |
