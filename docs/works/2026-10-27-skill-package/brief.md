---
layer: works
module: skills
status: active
updated: 2026-10-29
---

# 工序：Skill 包形态重构（SKILL.md + scripts/ + references/）

## 需求

`REQ-0015`：Skill 改为包形态，正文 + 附件草稿编辑，保存后整包生效并可下载 `SKILL.zip`。
上一版 Skill 工序见 `docs/history/works/2026-10-26-skill-detail-page/`（已收口归档），其结论（五章结构化表单 + 只读文档 Tab）被本工序推翻。

## 背景

B1（`agent-flow-orchaster`）已按自己的 v1 契约重建 Skill：**zip 包即内容真相**，数据库只存 brief、包指针与草稿；编辑先建草稿，附件在草稿里增删改，保存时生成 `SKILL.md`、打包并原子切换；读接口只给详情、文档原文与整包下载。
本仓库此前的 v3 提案（`body_md` + staging 表 + `/files`）已被该契约取代，**以 B1 契约为准**。

本工序负责 UI 侧对齐：详情/编辑/新建三态改为草稿流程，整包下载，BFF 支持大文件上传与下载头，编辑器统一 7.7.0 单包。

## 验收标准

1. `SCN-0016`（草稿编辑与保存）、`SCN-0017`（整包下载）实现并 `verified`；`SCN-0005`、`SCN-0014`、`SCN-0015` 按新流程重写后仍 `verified`。
2. 详情页：`body` 只读渲染、文件清单（`path/size/readOnly`）、整包下载入口；编辑/新建走草稿，支持上传/覆盖/改名/删除/取消。
3. 正文 16 KiB 上限在编辑态做字节计数与阻断提示；超限时引导把内容放进 `references/`。
4. 保存错误码可读：`428` / `409` / `410` / `422` / `413` / `400`；保存失败保留草稿可重试。
5. BFF：上传支持 ≥20 MiB（或 multipart 流式），透传 `Content-Disposition`。
6. 编辑器 7.7.0 单包替换 `DEP-0001`，只读/编辑共用，Markdown 往返与只读断言通过。
7. `skills/spec.md`、`architecture.md`、`product.md`、`dependencies.md` 与实现一致。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0027-04 | design | `CMP-skills` + `CMP-bff` | 已完成（2026-10-29：spec 重写、gate 绿） | 本 brief、`REQ-0015`、B1 契约 v1、`skills/spec.md`、`SCN-0016`、`SCN-0017`、`SCN-0005/0014/0015`、`bff/index.js` |
| T-0027-05 | change | `CMP-skills` | 已完成（2026-10-29：页面/API/夹具重写，五场景 DOM 21/21） | `skill-detail.js`、`api.js`、`skill-common.js`、`skill-detail-markdown.js`、`fake-b1.js`、`SCN-0016` |
| T-0027-06 | change | `CMP-bff` | 已完成（2026-10-29：body 上限 25 MiB、下载头透传、BFF 12/12） | `bff/index.js`、`tests/bff/bff.test.js`、`SCN-0017` |
| T-0027-07 | change | `CMP-skills` | 已完成（2026-10-29：7.7.0 单包、适配层、渲染 9/9） | `editor-reuse.md`、`dependencies.md`、`assets/vendor/`、编辑器适配层 |
| T-0027-08 | verify | `CMP-skills` + `CMP-bff` | 已完成（2026-10-29：五场景 verified、BFF 12/12、全量 57/57、live 读 4/4 + 写 4/4） | `verify-m1-scenarios.js`、`verify-skill-page-*.js`、`verify-b1-*.js`、`check-deps`、场景卡 |

## 装载清单（必读）

- `docs/requirements/REQ-0015-skill-package.md`
- B1 仓库：`docs/works/2026-10-28-skill-package/contract-proposal.md`（契约 v1，唯一口径）、`src/components/skill/contract.ts`、`src/components/http-gateway/app.ts`
- `docs/works/2026-10-27-skill-package/editor-reuse.md`
- `docs/design/components/skills/spec.md`
- `docs/design/scenarios/assets/skill-library/edit-skill-draft/scenario.md`、`download-skill-package/scenario.md`
- `docs/design/scenarios/assets/skill-library/manage-skill/scenario.md`、`open-skill-detail/scenario.md`、`render-skill-document/scenario.md`
- `assets/js/pages/skill-detail.js`、`assets/js/api.js`、`tools/fake-b1.js`、`bff/index.js`
- `docs/design/dependencies.md`

## 已确认（2026-10-29）

- **以后端 v1 契约为唯一口径**：zip 即真相、草稿生命周期、`/download` 整包下载、无单文件读取。
- 正文上限 **16 KiB**（含 frontmatter）是刻意设计；更长的内容放 `references/` 渐进披露。
- 附件**不含图片**；只接收 `scripts/`、`references/` 下文件；脚本作为附件保留以便执行。
- 不做数据迁移（Skill 未实际使用）；不做版本历史、在线执行、鉴权。
- 编辑器统一 **7.7.0**、仓外构建、单包替换 `DEP-0001`；体积为观测阈值（只 WARN）。

## 待确认

- 无。
