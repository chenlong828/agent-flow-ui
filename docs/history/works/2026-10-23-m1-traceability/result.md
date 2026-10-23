---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 收口：M1 十页 REQ/SCN/Component 追溯补齐

## 结论

按用户 2026-10-23 要求，反转此前「M1 不补 REQ」的口径，为 10 个 M1 页面组件补齐：

- 10 张需求卡 `REQ-0002..0011`（`accepted`）；
- 10 个场景 `SCN-0002..0011`（`designed`，各含 3 正 1 反测试方案）；
- 11 个组件规格的 `requirement` / `scenario` 反查与模块卡追溯行；
- `check-docs` 对「组件 ↔ REQ/SCN、场景 ↔ 组件、REQ → SCN」的强制校验；
- 场景索引、architecture 验证矩阵、roadmap/risks 的同步更新。

页面行为、页面 JS、依赖均未改。**场景没有标 `verified`，REQ 没有标 `delivered`**：本批只补到 `designed`，3+1 测试尚未落地；这一欠账登记为 R10。

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| 10 张 M1 REQ | 通过 | `requirements/REQ-0002..0011`，均 `accepted`，影响场景可解析 |
| 10 个 M1 场景 | 通过 | `SCN-0002..0011` 均 `designed`，各 4 条测试行 |
| 组件反查 | 通过 | 11 个 `spec.md` 的 `requirement`/`scenario` 全部解析到存在的卡 |
| 门禁强制 | 通过 | `tools/check-docs.js` 新增 3 类交叉校验 |
| 索引/计划/架构 | 通过 | `_index.md` 重生成；architecture 矩阵、roadmap、R7/R10 同步 |
| 不虚标 | 通过 | 无 `verified` 场景新增；无 `delivered` REQ 新增 |

## 交付与提交

| 交付 | 落点 | 提交 |
|---|---|---|
| 工序 brief + 10 页映射 | `works/2026-10-23-m1-traceability/brief.md` | `0f9f3d5` |
| 10 REQ + 10 SCN + 场景索引 | `requirements/`、`design/scenarios/` | `a7167fe` |
| 11 组件反查 + check-docs + architecture + roadmap/risks + 入口说明 | `design/components/`、`tools/check-docs.js`、`design/architecture.md`、`plan/`、`README.md`、`docs/README.md` | `15aed8d` |
| 收口与归档 | `history/works/2026-10-23-m1-traceability/` | 归档提交 |

## 验证

- `npm test`：PASS（syntax + `check-docs` + 场景索引无 diff）。
- `check-docs` 输出：`components: 11 | requirements: 11 | scenarios: 11`。
- 映射复核：11 个组件 ↔ 11 个 REQ/SCN；10 个 M1 场景均为 `designed`，每场景 4 条测试行。
- `git diff --check`：无空白错误。
- **smoke 未复跑**：本机 `node_modules` 无 `jsdom`，`npm install --no-save jsdom` 因 `~/.npm` 权限被拒。本次只改文档，页面 JS 未动；基线 `3bd2ce9` 上曾 12/12，但该结果不作为本次 docs-only 变更的页面验证。

## 未做与后续

1. **R10**：10 个场景的 3+1 测试未实现，暂无 runner；后续补 DOM/引擎层 runner，跑通后才可改 `verified` / `delivered`。
2. M1 仍只有 jsdom 冒烟，冒烟不是业务验收。
3. Safari 人工走查（R9）不受本批影响，仍为发布门禁。

## 结论落点

| 内容 | 落点 |
|---|---|
| 10 页需求与验收叙述 | `requirements/REQ-0002..0011-*.md` |
| 10 个场景运行序与测试方案 | `design/scenarios/**/scenario.md` |
| 组件追溯 | `design/components/*/spec.md` frontmatter + `## 0 模块卡` |
| 强制校验 | `tools/check-docs.js` |
| 风险与欠账 | `plan/risks.md` R7/R10；`plan/roadmap.md` M1 注 |
| 本工序记忆 | 本目录归档到 `history/works/2026-10-23-m1-traceability/` |
