---
layer: plan
module: global
status: current
updated: 2026-11-17
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
| M11 | 运行实例 live（B4）：列表/详情/发起运行/终止/人工确认/会话日志；工作流编辑器对齐七类节点 | 已完成（2026-11-12；SCN-0004 5/5、M1 49/49、13 页冒烟、真实后端发起/终止） | `REQ-0019` / `REQ-0017` / `SCN-0004` / `history/works/2026-11-12-run-live-integration/` |
| M12 | MOCK 演示页临时关闭：导航隐藏 + 直达占位页 + `?demo=1` 演示模式 | 已完成（2026-11-12；SCN-0020 22/22、M1 50/50、13 页冒烟、`npm test` 通过） | `REQ-0018` / `SCN-0020` / `history/works/2026-11-12-mock-pages-off/` |
| M13 | 真实专家与 Skill 内容提取（旁路）：16 专家 / 30 Skill 入 B1；执行 `catalog.md`、`import-plan.md` | 主体完成（2026-11-02；S4 工作流 9 条、4 工具、4 类知识未做，另立工序） | `history/works/2026-11-01-expert-skill-extraction/` |
| M14 | 节点详情交互统一：双击 90% 弹层，移除右侧抽屉/面板与节点消息二次全屏 | 已完成（2026-11-17；SCN-0019 24/24、SCN-0004 5/5、`npm test` 通过） | `REQ-0020` / `SCN-0019` / `SCN-0004` / `history/works/2026-11-17-node-detail-modal/` |
| M15 | 运行节点多轮历史：按 `visit` 保留全部轮次，弹层轮次 Tab 查看最新与历史；历史轮只读、日志按轮下载 | 已完成（2026-11-17；SCN-0004 6/6、`npm test` 通过） | `REQ-0021` / `SCN-0004` / `history/works/2026-11-17-run-node-history/` |

> **M1 追溯与验收（2026-10-23 用户要求）**：10 个页面组件已补 `REQ-0002..0011` + M1 场景，组件 frontmatter 反查、`check-docs` 强制。`tools/verify-m1-scenarios.js` 覆盖 10 场景 × 3 正 1 反，40/40 通过；SCN 转 `verified`、REQ 转 `delivered`，R7/R10 关闭。详见 `history/works/2026-10-23-m1-scenario-verification/result.md`。

## 候选批次（未排期）

| 批次 | 内容 | 前置/依据 | 规模 |
|---|---|---|---|
| B1 | 列表分页统一：运行实例 / 工具 / Skill 库 → 专家 / Harness → 工作流换统一分页器 | `OQ-9` 裁定；提案见 `works/2026-11-12-list-pagination-proposal/proposal.md` | 5 个 `change` + 2 个 `verify`（分批验收） |
| B2 | MOCK 三页 live 化或解禁（效能看板 / 工作区 / Key） | 后端 B2/B4 对应能力就绪后再评估；解禁只需去掉 `mockOnly` 与门禁 | 待估 |

> 分页（B1）由用户 2026-11-12 明确「暂时不增加，以后再做」：需求已整理为提案，进入候选批次与 OQ-9，裁定后再转 REQ/SCN 并排期；裁定前不新增分页代码。

## 工序与依赖

- 一个 REQ 同一时刻只允许一个在飞工序；开工即在 `works/` 建目录并写 brief（引 REQ ID）。
- M3 的每条裁定先落需求卡，再排工序；裁定前不新增页面。
- 无用户旅程的文档/债务活走旁路，不进 `requirements/`。

## 当前在飞

- `works/2026-10-27-skill-package`：Skill 包形态重构（`REQ-0015`；对齐 B1 v1 契约，施工中）。
- `works/2026-10-30-workflow-ui`：工作流两页同源接入（`REQ-0016` / `REQ-0017`；实现、fake + 真实写路径与文档已收口，存量测试数据清理待确认）。
- `works/2026-11-12-list-pagination-proposal`：列表分页统一提案（旁路，待裁；无代码改动，裁定后转 REQ/SCN）。
