---
layer: works
module: skills
status: active
updated: 2026-10-28
---

# 工序：Skill 包形态重构（SKILL.md + scripts/ + references/）

## 需求

旁路：本工序先产出契约 v3 提案与编辑器复用评估；需求卡与场景卡待提案确认后按 `req-scenario-spec` 新建，本工序不预占编号。
上一版 Skill 工序见 `docs/history/works/2026-10-26-skill-detail-page/`（已收口归档），其结论（五章结构化表单 + 只读文档 Tab）将被本工序推翻。

## 背景

用户决定重构 Skill 的结构设计：Skill 不再用「五章结构化子表」承载内容，而是一个 **Skill 包**——
`SKILL.md`（frontmatter + 自由 Markdown 正文）+ `scripts/` + `references/` 附件。
编辑界面拆成三块独立编辑：元数据（控件）、正文（所见即所得）、附件（文件清单 + 上传）；
编辑期附件先进**临时暂存区**，保存时与元数据、正文一起提交，并打包成 `SKILL.zip` 供下载。

现有数据未实际使用，**不做迁移**：旧子表直接删除，不写回填。

本工序只做提案与评估，**不改任何现有代码**，等待确认门。

## 验收标准

1. 产出 Skill 契约 v3 提案：字段归属、DTO、写请求、草稿（staging）与文件面 API、`/document` 与 `/package` 语义、版本与 ETag、数据模型（无迁移）、限制与安全、分期。
2. 产出 `md_preview` 复用评估：能否整包引用、体积与准入、桥接耦合、可复用/不可复用清单、推荐形态与待验证项。
3. 提案包含 P 级定级、人工确认门与需用户拍板的剩余问题清单。
4. 不修改 `pages/`、`assets/`、`bff/`、`server.js`、`tools/` 与既有文档；仅新增本工序目录下的文档。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0027-01 | design | `CMP-skills` + `CMP-bff` | 已完成 | 本 brief、`CMP-skills` 模块卡、`REQ-0013`、`REQ-0014`、`SCN-0013`、`SCN-0014`、`SCN-0015`、`architecture.md`、B1 `skill` 组件规格、`http-gateway` 规格、既有迁移 |
| T-0027-02 | design | `CMP-skills` | 已完成 | `md_preview` 源码与构建、依赖体积实测、准入清单、`dependencies.md` |
| T-0027-03 | review | `CMP-skills` | 待确认 | 本 proposal 的未决问题、P1 确认门、`REQ/SCN` 补卡 |

## 装载清单（必读）

- `docs/works/2026-10-27-skill-package/contract-proposal.md`
- `docs/works/2026-10-27-skill-package/editor-reuse.md`
- `docs/requirements/REQ-0013-skill-contract-v2.md`、`docs/requirements/REQ-0014-skill-detail-page.md`
- `docs/design/components/skills/spec.md`
- `docs/design/scenarios/assets/skill-library/manage-skill/scenario.md`
- `docs/design/scenarios/integration/b1-integration/skill-contract-v2/scenario.md`
- `docs/design/dependencies.md`
- B1 仓库：`agent-flow-orchaster/docs/design/components/skill/spec.md`、`http-gateway/spec.md`、`db/migrations/0003_skill.sql`、`0005_skill_description.sql`

## 已确认（2026-10-27 ~ 2026-10-28）

- `md_preview` 只做**代码级参考**，不共享运行底座（原生壳 + 本地文件 + 桥 ≠ 浏览器页面 + B1 HTTP）；目标能力为 Heading / 列表 / 缩进 / 表格 / 图片 / 链接 / 代码块。
- 依赖体积上限（`check-deps` 的 500 / 120 / 300 KiB）已改为**观测阈值**（2026-10-28），超了只 WARN；实现按节约优先，不为数字砍能力。
- **不做数据迁移**：Skill 未实际使用，旧子表直接删除，不回填。
- 正文不强制五章（seed 模板）；删除 `refs`（链接进正文、文件进 `references/`）。
- 附件存本地 FS + `BlobStore`；上传进临时暂存区，保存时提交并打包 `SKILL.zip`；上传不推进 revision/version。
- `/document` 不含附件清单；上限 20 MiB / 100 MiB / 100 个。
- 编辑器统一 **7.7.0**、仓外构建、单包替换 `DEP-0001`。

## 剩余待确认

- 草稿快照语义、打包时机、TTL 与 GC、脚本可执行位（见 proposal §11 Q1–Q5）。
- 是否允许复制 `md_preview` 的 MIT 源码片段（默认允许，需保留版权头）。
