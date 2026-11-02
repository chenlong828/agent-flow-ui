---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 结果：前端全站 ESM 迁移与测试栈改造

- 工序：`docs/history/works/2026-10-30-frontend-esm/`
- 决策：`history/decisions/2026-10-30-frontend-esm.md`
- 需求：旁路（技术债/架构迁移，无用户旅程，不建 REQ）

## 结论

全站 13 页、Node 侧 `server.js` / `bff/` / `tools/` / `tests/` 已切到原生 ESM；`package.json` 为 `"type":"module"`，无构建、无 `.cjs` 兼容层。jsdom 已删除，DOM/网络断言统一由 Playwright WebKit 执行，纯逻辑用 `node --test`。工作流两页完成机械迁移，按领域切分的 live 重写归 `works/2026-10-30-workflow-ui/`。

## 交付物

| 范围 | 变更 |
|---|---|
| 包边界 | `package.json` 增加 `"type":"module"`；`npm test` 仍为门禁 + BFF 单测 + Playwright 场景 |
| Node 侧 | `server.js`、`bff/index.js`、`bff/standalone.js`、`tools/*.js`、`tests/bff/*.js` 改 ESM；`__dirname` 改 `fileURLToPath(import.meta.url)` |
| 共享模块 | `ui.js` / `mock-data.js` / `api.js` 改为具名导出；HTML 只保留每页一个 `<script type="module">` |
| 页面 | 13 个页面脚本显式 import 依赖，移除 IIFE 与 `window.DF/MOCK/API/WSC/SK` 读写 |
| 测试 | `tools/smoke-test.js`、`tools/verify-m1-scenarios.js`、`tools/verify-skill-page-render.js` 全 Playwright；`tools/test-harness.js` + `tools/fake-b1.js` 提供路由、夹具与错误收集；`tools/playwright.js` 统一解析 `PLAYWRIGHT_MODULE`/本机缓存 |
| 真实 B1 | `verify-b1-pages.js` / `verify-b1-writes.js` 改 Playwright；读验证不写库，写验证只创建并清理唯一测试数据 |
| 门禁 | `check-architecture` 增加 ESM import 图与 `server.js` 组合根检查；`check-deps` 检查 ESM import；场景索引统计改为 Playwright runner |

## 验证证据（2026-10-30）

- `npm test`：PASS；场景 **57 passed, 0 failed**，BFF **12/12**，五态文档/索引/依赖/架构/追溯全绿。
- `node tools/smoke-test.js`：13/13 页面无运行时错误。
- `BASE_URL=http://127.0.0.1:3000/pages/ node tools/verify-user-menu.js`：**45/45**（含菜单位置、命中测试、字号缩放兜底、跨页入口）。
- `BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js`：**29/29**（真实 Milkdown、下载、编辑态、粘性操作栏、拖拽上传）。
- `node tools/verify-skill-page-render.js`：**9/9**（只读/可写、表格、代码高亮、原始 HTML 不执行、round-trip）。
- `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`：**4/4**（真实 B1 读：harnesses 5、tools 10、skills 13、experts 8；`/document` 200/304）。
- `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`：**4/4**（经 UI 创建唯一 harness/tool/skill/expert，随后 API 更新、启停、删除；运行前已确认，运行后复查四条前缀记录均为 0）。

## 迁移中发现并修复的问题

| # | 问题 | 根因 | 修复 | 防回归 |
|---|---|---|---|---|
| 1 | `workspace-detail.html` 白屏，控制台 `Illegal return statement` | 去掉 IIFE 后顶层 `return` 非法 | 把后续逻辑收进 `else` 分支 | 13 页 smoke + SCN-0010 |
| 2 | 共享外壳引用 `window.MOCK.instances` 计算角标，ESM 下抛错 | `ui.js` 越界读 demo 数据 | `renderShell` 改收 `pendingCount`，由页面传入 | smoke + 引擎回归 |
| 3 | `workspaces.js` / `workspace-detail.js` 自引用 `const WSC = window.WSC` | 机械替换残留 | 删除自引用，只保留 import | SCN-0010 |
| 4 | 列表新建工作流后编辑器打开旧夹具，名称/节点都不是新建的 | `MOCK` 是模块内存，整页跳转即重置 | 新建时写 `sessionStorage` 键 `df-new-workflow`，编辑器启动时认领并清理 | SCN-0002-T3 强断言名称 + 2 个节点 |

## 偏差与后续

- 实现保留 `.js` 扩展名（`"type":"module"` 下即 ESM），未把文件批量改成 `.mjs`；`design.md` 中的 `.mjs` 路径视为目标示意，后续工作流模块按 `.js` 落盘。
- 本轮未新建 `shared/http` / `shared/api` 目录：为缩小迁移面，资产传输仍留在 `assets/js/api.js`（已去掉测试钩子），B1 四页调用面不变；`workflow/data` 工序再抽 `shared/http`，届时以 `api.js` 的错误映射为蓝本。这是相对 `design.md` 模块图的已知偏差。
- 未保留 `window` 测试桥；`skill-detail-markdown.js` 仍接受 `window.__AGENTFLOW_SKILL_MD__` 作为 vendor 渲染器注入缝（仅引擎测试使用，不是应用状态桥）。
- `verify-b1-writes.js` 已在开发后端实跑并清理；其余门禁与场景均已执行。
- 工作流 live 数据层/编辑器未在本工序实现，按 `T-0030-07..12` 在后续工序交付；编辑器模块按 `model / validate / data / editor` 切分，过大时再按视图拆交互层。
- `updatedBy` 仍恒为 `local`（后端缺陷），UI 不展示；不在本次前端迁移范围。
