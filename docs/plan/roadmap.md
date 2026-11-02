---
layer: plan
module: global
status: current
updated: 2026-10-30
---

# 路线图

## 里程碑

| 里程碑 | 内容 | 状态 | 关联 |
|---|---|---|---|
| M1 | 12 页高保真原型（列表/编辑器/四类资产/实例/看板/工作区/Key） | 已完成（追溯 + 场景验证） | `requirements/REQ-0002..0011`、`design/scenarios/`、`design/components/` 各规格 |
| M2 | 全局外壳交互（用户区显示与下拉菜单） | 已完成 | `REQ-0001` / `SCN-0001` |
| M3 | 开放问题裁定：OQ-1~OQ-6 逐条转需求或决策 | 待排 | `plan/open-questions.md` |
| M4 | 组件基线与门禁（方案 A）：11 个业务模块卡、architecture 现行真相、check-docs 增强 | 已完成 | `history/works/2026-10-23-component-baseline/` |
| M5 | B1 四类资产同源接入：`CMP-bff` + 四页 live（读/写/聚合/乐观锁） | 已完成（BFF 9/9 当时基线、M1 40/40、live 读写 4/4） | `REQ-0012` / `SCN-0012` / `history/works/2026-10-25-b1-integration/` |
| M6 | Skill 契约 v2 展示端适配：`description` 合并 + API-31 全文 200/304 | 已完成（BFF 10/10、M1 40/40 + SCN-0013 6/6、live 读写 4/4） | `REQ-0013` / `SCN-0013` / `history/works/2026-10-26-skill-contract-v2/` |
| M7 | Skill 专门页与 Milkdown 渲染：列表 + 独立页 + 正文只读渲染 | 已完成 | `REQ-0014` / `SCN-0014` / `SCN-0015` / `history/works/2026-10-26-skill-detail-page/` |
| M8 | Skill 包形态重构：`SKILL.md` + `scripts/`/`references/`、草稿编辑、整包下载（对齐 B1 v1 契约） | 施工中（05/06/07 已落代码，08 验证中） | `REQ-0015` / `SCN-0016` / `SCN-0017` / `works/2026-10-27-skill-package/` |
| M9 | 前端全站 ESM 与测试栈迁移：13 页 + Node 侧 `type:module`、Playwright 场景、删除 jsdom | 已完成（2026-10-30；49/49、BFF 12/12、引擎 45/45 + 29/29） | `history/decisions/2026-10-30-frontend-esm.md` / `history/works/2026-10-30-frontend-esm/` |
| M10 | 工作流两页同源接入（B3）：列表 + 编辑器、`workflow/data` 唯一写入口、手动保存与严格校验 | 已完成（2026-10-30；24 纯逻辑 + SCN-0018 14/14 + SCN-0019 11/11；真实 B3 读写） | `REQ-0016` / `REQ-0017` / `SCN-0018` / `SCN-0019` / `works/2026-10-30-workflow-ui/` |

> **M1 追溯与验收（2026-10-23 用户要求）**：10 个页面组件已补 `REQ-0002..0011` + M1 场景，组件 frontmatter 反查、`check-docs` 强制。`tools/verify-m1-scenarios.js` 覆盖 10 场景 × 3 正 1 反，40/40 通过；SCN 转 `verified`、REQ 转 `delivered`，R7/R10 关闭。详见 `history/works/2026-10-23-m1-scenario-verification/result.md`。

## 工序与依赖

- 一个 REQ 同一时刻只允许一个在飞工序；开工即在 `works/` 建目录并写 brief（引 REQ ID）。
- M3 的每条裁定先落需求卡，再排工序；裁定前不新增页面。
- 无用户旅程的文档/债务活走旁路，不进 `requirements/`。

## 当前在飞

- `works/2026-10-27-skill-package`：Skill 包形态重构（`REQ-0015`；对齐 B1 v1 契约，施工中）。
- `works/2026-10-30-workflow-ui`：工作流两页同源接入（`REQ-0016` / `REQ-0017`；实现、fake + 真实写路径与文档已收口，存量测试数据清理待确认）。
- `works/2026-11-01-expert-skill-extraction`：从 `uft-issue`/`web-dev` 提取专家与 Skill 内容（旁路；16 专家 / 24 Skill；24 条 Skill 含 references 已入 API，专家与工作流待做）。
