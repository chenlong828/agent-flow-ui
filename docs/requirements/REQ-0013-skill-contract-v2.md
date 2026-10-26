---
layer: requirements
module: skills
status: delivered
updated: 2026-10-26
---

# REQ-0013 Skill 契约 v2 展示端适配

| 字段 | 内容 |
|---|---|
| ID | `REQ-0013` |
| 类型 | `feature` |
| 场景叙述 | Skill 维护者在列表中看到合并后的 `description`（适用 / 触发 / 不适用），在详情抽屉查看结构化五章，并切换到「全文」原样阅读 B1 API-31 返回的 Markdown 文档；新建/编辑只提交 `description`，旧字段 `summary/triggers` 不再出现；全文请求复用 `ETag`，304 时继续显示上次文本，停用 Skill 也能读。 |
| 价值 | B1 已将 Skill 管理面契约升级为 `description`，并新增编排面固定结构文档；展示端不跟随会导致列表/搜索/表单继续读写已删除字段、专家页出现 `undefined`，以及全文视图在前端二次拼装而与后端不一致。 |
| 非目标 | 不改 B1 后端与数据库；不保留 `summary/triggers` 兼容层或双写；不在前端重新拼装 Markdown、不引入 Markdown 渲染器；不做版本历史、引用方明细、文档下载/复制；不把全文视图扩展到其他资产。 |
| 约束 | 沿用零构建、零第三方运行时依赖；四类资产页仍 live-only；全文只消费 `GET /api/v1/skills/{id}/document`，不读详情 DTO 重组；`description` 前端校验 1–400 字；BFF 只透传 `If-None-Match`/`ETag`，不做缓存或改写。 |
| 影响场景 | `SCN-0013`（`design/scenarios/integration/b1-integration/skill-contract-v2/scenario.md`）；同步修改 `SCN-0005`、`SCN-0006`、`SCN-0012` 的字段断言与计数。 |
| 澄清记录 | 2026-10-26 确认：按 B1 契约 v2 直接切换，不做旧字段兼容；先完成后台 API 对接，再改前端界面；全文视图使用 API-31 原样文本；旧字段被后端 400 时提示「契约已升级，请刷新页面」。 |
| 状态 | `delivered` |
