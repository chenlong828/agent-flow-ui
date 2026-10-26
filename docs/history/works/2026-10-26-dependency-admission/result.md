---
layer: history
module: global
status: frozen
updated: 2026-10-26
---

# 结果：运行时依赖准入制落地（2026-10-26）

## 验收结果

| 验收标准 | 结果 | 证据 |
|---|---|---|
| 1. 清单 | ✅ | `design/dependencies.md` 含规则 + 机读 JSON（`deps: []`，证明默认零依赖仍成立） |
| 2. 口径统一 | ✅ | 8 处更新；现行文档不再出现「无第三方运行时依赖」绝对表述 |
| 3. `check-deps` | ✅ | 覆盖 8 类检查（清单 / 外链 / vendor / 裸模块 / BFF require / package.json / 哈希 / 体积） |
| 4. 负向验证 | ✅ | 未登记 vendor、页面 CDN 外链、未登记的 `DEP` 引用均 FAIL；复原后 PASS |
| 5. `npm test` | ✅ | check:syntax / check:docs（deps: 0）/ docs:index:check / check:deps / test:bff 10/10 |
| 6. 归档 | ✅ | 决策落 `history/decisions/`，本工序归档 `history/works/` |

## 结论落点

| 结论 | 落点 |
|---|---|
| 基线改为准入制 | `design/dependencies.md` + `architecture.md` §1/§8 |
| 引入形态与红线 | `design/dependencies.md` §2/§3；`architecture.md` §3 禁止边 |
| 门禁 | `tools/check-deps.js` + `npm test`；`tools/check-docs.js` 解析 `DEP-xxxx` |
| 风险登记 | `plan/risks.md` R14 |
| 决策存档 | `history/decisions/2026-10-26-dependency-admission.md` |

## 未决

- 首个依赖准入申请待用户发起（清单当前为空）。
- 构建链未启用；如需要另立 P1。
