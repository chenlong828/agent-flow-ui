---
layer: requirements
module: skills
status: delivered
updated: 2026-10-26
---

# REQ-0014 Skill 专门页面与 Milkdown 文档渲染

| 字段 | 内容 |
|---|---|
| ID | `REQ-0014` |
| 类型 | `feature` |
| 场景叙述 | Skill 维护者从 Skill 列表进入专门的 Skill 页面，在同一页面完成新建、查看与编辑；查看态默认显示结构化五章，切换到「文档」Tab 时用 Milkdown 只读渲染 API-31 返回的 Markdown，不再使用详情抽屉，也不再把全文当作 `<pre>` 原文阅读。 |
| 价值 | 当前抽屉同时承载查看、编辑、全文三层职责，长文档阅读与结构化编辑互相挤压；页面化后可以用完整版面承载结构化信息与文档阅读，并把 Markdown 阅读从纯文本升级为真正的文档视图。 |
| 非目标 | 不用 Milkdown 做结构化表单编辑或 Markdown 源码编辑；不在列表页引入 Markdown 渲染；不改 B1 契约；不把文档渲染扩展到其他资产；不做版本历史、引用方明细、文档下载/复制；不解决移动端适配。 |
| 约束 | 仍为零构建、live-only，不回落 MOCK；除 Milkdown 外不新增第三方运行时依赖，不使用 CDN 直载；Milkdown 只用于查看态文档 Tab；`description` 仍为 1–400 字；`If-Match`、ETag/304、停用可读语义不变；渲染失败不得静默回落为原始 `<pre>`，必须显式报错并可重试。 |
| 影响场景 | `SCN-0014`（`design/scenarios/assets/skill-library/open-skill-detail/scenario.md`，新建）；`SCN-0015`（`design/scenarios/assets/skill-library/render-skill-document/scenario.md`，新建）；实现后需同步修订 `SCN-0005`、`SCN-0013` 中关于抽屉与 `<pre>` 全文的断言。 |
| 澄清记录 | 2026-10-26 确认：文档 Tab 为只读渲染，不改为可编辑；默认视图仍为结构化；新建也迁移到专门页面；引入 Milkdown 作为第三方渲染运行时；「无第三方运行时依赖」的架构基线与组件规格放到后续变更中修订。 |
| 状态 | `delivered` |
