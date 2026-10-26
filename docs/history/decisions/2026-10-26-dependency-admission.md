---
layer: history
module: global
status: frozen
updated: 2026-10-26
---

# 决策：运行时依赖由「零依赖」改为准入制

## 背景与问题

项目诞生于「高保真纯前端原型」，基线是原生 HTML/CSS/JS、无构建、无第三方运行时依赖；该约定以散落形式存在（README、`product.md`、`dev-environment.md`、`architecture.md`、`REQ-0012/0013` 约束行），而 `check-docs` 只校验模块卡字段字面存在，没有任何脚本检查依赖是否存在、是否登记——「零依赖」实际是口径约束而非门禁约束。

2026-10-26 前提变化：项目成为实际 agent-flow 的前端（B1 已接入、四页 live），后续需要灵活使用第三方前端组件。只改文字会立刻漂移，故以「准入制」替换「零依赖」，一次补齐口径、清单与门禁。

## 决策

1. **基线**：默认零运行时依赖；引入必须走准入并登记 `DEP-xxxx`；清单唯一数据源为 `design/dependencies.md`。
2. **引入形态（方案 A）**：自托管 vendor 单文件 ESM/UMD 落 `assets/vendor/<name>/<version>/`，版本精确钉住 + SHA-256 登记；保持零构建；禁止运行时 CDN/远程外链。
3. **审批**：新增 / 替换 / major·minor 升级 = P2，用户签字后才登记；patch 升级 = P3 登记即可；构建链（npm + bundler）= P1 另案。
4. **判据**：许可白名单（MIT/Apache-2.0/BSD/ISC）；体积预算单依赖 ≤80 KB gzip、单页首屏增量 ≤120 KB gzip、全站新增 ≤300 KB gzip；无未修复高危 CVE；不引入构建步骤。
5. **三条红线**：`tools/*` 零外部包；`server.js` / `bff/` 零第三方依赖；禁止运行时外链。
6. **门禁**：新增 `tools/check-deps.js`（清单校验、页面外链、未登记 vendor、裸模块、BFF require、`package.json` 依赖、哈希/体积），并入 `npm test`；`check-docs` 校验 `DEP-xxxx` 引用可解析。
7. **历史口径**：已交付的 `REQ-0012` / `REQ-0013` 不改（当时口径的记录）；本决策自 2026-10-26 起生效。

## 用户确认记录

2026-10-26 方案评审，用户三项选择：

- 引入形态：**A 自托管 vendor + 保持零构建**（否决允许构建链）；
- 审批颗粒度：**每条新增/替换/major·minor 升级均需用户签字**（否决阈值自动放行）；
- 体积预算：**采用默认值 80/120/300 KB gzip**。

## 落地结果

- 新增：`design/dependencies.md`、`tools/check-deps.js`、本决策、工序归档。
- 更新：`architecture.md`（形态行 / 依赖表 / 禁止边 / 基线登记 / 查阅）、`dev-environment.md`、`product.md`、`ui-shell/spec.md`、`README.md`、`package.json`、`risks.md`（R14）、`check-docs.js`（DEP 解析）、`docs/README.md`。
- 验证：`npm test` 全绿（含 `check:deps`）；三条负向用例（未登记 vendor / 页面 CDN 外链 / 未登记 DEP 引用）均按预期失败，复原后通过。

## 后续

- 首个准入申请由用户发起，按 `design/dependencies.md` §4 程序走。
- 若确需构建链，另立 P1 方案，不在本决策范围内。
