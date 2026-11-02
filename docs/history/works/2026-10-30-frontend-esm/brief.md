---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 工序：前端全站 ESM 迁移与测试栈改造

## 需求

旁路（技术债/架构迁移，无用户旅程，不建 REQ）。依据 `history/decisions/2026-10-30-frontend-esm.md`。

## 背景

现行前端为「无构建 + 全局对象」：13 页按顺序加载 `ui.js`（`DF`）、`mock-data.js`（`MOCK`）、`api.js`（`API`）与页面脚本；测试用 jsdom 执行经典脚本。工作流两页需要拆成图模型/校验/数据服务/页面四块，继续叠全局会让依赖顺序与测试可观测性同时恶化。

用户 2026-10-30 已确认：全站原生 ESM、仓库 `"type":"module"`、Node 侧（server/bff/tools/tests）一并转 ESM、测试改为 `node --test` + 全量 Playwright、删除 jsdom、不保留 `window` 测试桥、先迁移再做工作流页面。

## 验收标准

1. 13 个 HTML 全部使用 `<script type="module">`；13 个页面脚本与 `ui/mock-data/api` 均为 ESM；页面之间无互相 import。
2. `package.json` 增加 `"type":"module"`；`server.js`、`bff/`、`tools/`、`tests/` 全部以 ESM 运行；`npm start`、`npm run test:bff` 通过。
3. 纯逻辑模块（图模型、校验、数据服务的纯函数）可用 `node --test` 直接 import；页面与网络断言用 Playwright 执行。
4. jsdom 依赖与入口删除；`tools/smoke-test.js`、`tools/verify-m1-scenarios.js` 不再以 jsdom 运行，等价覆盖迁到 Playwright。
5. 门禁全绿：`check:syntax`（ESM 语法）、`check:docs`、`docs:index:check`、`check:deps`、`check:architecture`（import 图/层方向/页面互引/mock 隔离）、`check:scenario-trace`。
6. 运行时无 `window.DF` / `window.MOCK` / `window.API` / `window.WSC`；`mock-data` 只被 demo 页 import，live 页（B1 四页 + 工作流两页）禁止 import。
7. `architecture.md`、`dev-environment.md`、`README.md` 与 ESM 后的加载方式、测试命令一致。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0030-01 | design | 平台（全局） | 已完成（2026-10-30：本 brief + `design.md` + 决策记录） | 本 brief、决策记录、`architecture.md`、`dev-environment.md`、`tools/check-*.js` |
| T-0030-02 | change | 平台（全局） | 已完成（2026-10-30：`type:module`；server/bff/tools/tests ESM） | `package.json`、`server.js`、`bff/*`、`tools/*`、`tests/bff/*`、`design.md` §3/§8 |
| T-0030-03 | change | 平台（全局） | 已完成（2026-10-30：共享模块 ESM；13 页仅剩 module 入口） | `assets/js/ui.js`、`mock-data.js`、`api.js`、`pages/*.html`、`design.md` §2/§4 |
| T-0030-04 | change | 平台（全局） | 已完成（2026-10-30：13 页全 module；工作流两页机械迁移） | 11 个非工作流页面 + 工作流两页机械迁移、`design.md` §5 |
| T-0030-05 | change | 平台（全局） | 已完成（2026-10-30：smoke/scenarios/Milkdown 全 Playwright；jsdom 删除） | `tools/smoke-test.js`、`tools/verify-m1-scenarios.js`、Playwright 基础设施、`design.md` §8 |
| T-0030-06 | verify | 平台（全局） | 已完成（2026-10-30：门禁 + 57/57 + 引擎回归；证据见 `result.md`） | `npm test`、Playwright 全量、13 页手工走查、`design.md` §8 |

## 装载清单（必读）

- `docs/history/decisions/2026-10-30-frontend-esm.md`
- `docs/history/works/2026-10-30-frontend-esm/design.md`
- `docs/design/architecture.md`（现行真相，迁移完成后改写）
- `docs/design/dev-environment.md`（jsdom/Playwright 安装与命令）
- `package.json`、`server.js`、`bff/index.js`、`bff/standalone.js`
- `tools/check-docs.js`、`tools/check-architecture.js`、`tools/check-deps.js`、`tools/check-scenario-trace.js`、`tools/gen-scenario-index.js`
- `tools/smoke-test.js`、`tools/verify-m1-scenarios.js`、`tools/verify-user-menu.js`
- `assets/js/ui.js`、`assets/js/mock-data.js`、`assets/js/api.js`
- `pages/*.html`、`assets/js/pages/*.js`

## 已确认（2026-10-30）

- 全站原生 ESM，无构建；不引入 bundler/转译。
- 仓库 `"type":"module"`，Node 侧全部转 ESM；不保留 `.cjs` 兼容层。
- 测试：`node --test`（纯逻辑）+ 全量 Playwright（DOM/网络）；删除 jsdom。
- 不保留 `window.MOCK` / `window.__APP__` 测试桥；断言改为 DOM/网络结果。
- 先 ESM 迁移，再工作流两页；工作流页面直接按 ESM 写。
- 迁移范围包含 13 页（工作流两页先做机械迁移，功能重写在后续工序）。

## 结项

- 2026-10-30 完成 Phase 0.1–0.5；结果与证据见 `result.md`。
- 已确认：工作流两页在 Phase 0 做机械迁移；live 重写归 `works/2026-10-30-workflow-ui/`，编辑模块按 `model / validate / data / editor` 切分。
- 新增发现并修复：列表新建工作流整页跳转后模块内存重置，导致编辑器打开旧夹具而不是新流程；用 `sessionStorage` 一次性交接键修复，并恢复场景中的强断言。
