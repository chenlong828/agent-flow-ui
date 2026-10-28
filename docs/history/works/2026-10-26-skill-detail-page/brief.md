---
layer: history
module: skills
status: frozen
updated: 2026-10-26
---

# 工序：Skill 专门页面与 Milkdown 文档渲染

## 需求

`REQ-0014` / `SCN-0014` / `SCN-0015`。

## 背景

当前 Skill 页面用抽屉同时承载查看、编辑、全文三层职责，全文仍以 `<pre>` 原样展示 API-31 Markdown。本工序把新建、查看、编辑迁移到专门的 Skill 页面，并在查看态用第三方 Markdown 渲染运行时只读渲染文档 Tab；列表页保留搜索、筛选、启停、删除与引用计数入口。

技术方案已确认采用 Milkdown + Prism 语法高亮；本阶段已完成列表页改造、专门页与渲染适配层实现，并接入 DOM 层场景测试。架构基线、`CMP-skills` 模块卡与 README/roadmap 已同步修订；B1 读/写脚本已改为专门页入口，真实 B1 读写验证已通过。

## 验收标准

1. Skill 列表点击查看/编辑/新建进入专门页面，不再打开详情抽屉；查看态默认结构化五章，文档 Tab 用第三方 Markdown 渲染运行时只读渲染 API-31 Markdown，代码块带语法高亮。
2. 编辑仍走结构化表单并带 `If-Match`，成功后使用响应 DTO 更新版本；新建成功后进入该 id 的编辑态。
3. 文档 Tab 保留 200/304/404/停用可读语义；渲染器只读，不承担编辑职责；渲染失败显式报错，不静默回落为 `<pre>`。
4. 除第三方 Markdown 渲染运行时外不新增运行时依赖，不使用 CDN 直载；移动端适配不在本次范围。
5. `SCN-0005`、`SCN-0013` 中关于抽屉与 `<pre>` 全文的断言在实现后同步修订，全量场景与真实 B1 读/写验证通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0014-01 | 文档 | `CMP-skills` | 已完成 | `REQ-0014`、`SCN-0014`、`SCN-0015`、本 brief、`SCN-0005`、`SCN-0013`、`CMP-skills` 模块卡 |
| T-0014-02 | design | `CMP-skills` | 已完成 | `architecture.md`、`CMP-skills` 模块卡、Markdown 渲染运行时选型与安全配置、页面路由与状态设计、`design.md` |
| T-0014-03 | change | `CMP-skills` | 已完成 | `pages/skills.html`、`assets/js/pages/skills.js`、`pages/skill-detail.html`、`assets/js/pages/skill-detail.js` |
| T-0014-04 | change | `CMP-skills` | 已完成 | Milkdown 渲染适配层、语法高亮、文档 Tab 接入、只读与安全约束 |
| T-0014-05 | verify | `CMP-skills` | 已完成 | `tools/verify-m1-scenarios.js`、`tools/verify-skill-page-render.js`、`tools/verify-b1-pages.js`、`tools/verify-b1-writes.js`、语法高亮断言、`npm test`、`test:b1-pages`、`test:b1-writes`、文档收口 |

## 装载清单（必读）

- `docs/plan/roadmap.md`、本 brief
- `docs/requirements/REQ-0014-skill-detail-page.md`
- `docs/design/scenarios/assets/skill-library/open-skill-detail/scenario.md`
- `docs/design/scenarios/assets/skill-library/render-skill-document/scenario.md`
- `docs/design/components/skills/spec.md`
- `docs/design/scenarios/assets/skill-library/manage-skill/scenario.md`
- `docs/design/scenarios/integration/b1-integration/skill-contract-v2/scenario.md`
- `docs/design/architecture.md`

## 领取的开放问题

- 渲染器选型与依赖上限已确认：Milkdown + Prism 语法高亮，依赖准入上限 500 KB gzip。
- `CMP-skills` 模块卡与架构基线已按专门页 + 第三方依赖口径修订。
