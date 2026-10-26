---
layer: history
module: global
status: frozen
updated: 2026-10-26
---

# 工序：运行时依赖准入制落地（2026-10-26）

## 需求

**旁路**（无用户旅程；依据用户 2026-10-26 的基线变更决策）。

用户 2026-10-26 决策：

- **前提变化**：项目从前端无构建原型，进化为实际 agent-flow 的前端；后续需要灵活使用第三方前端组件，但每次引入必须经过审批与准入。
- **引入形态采用方案 A**：自托管 vendor + 保持零构建——依赖文件落 `assets/vendor/<name>/<version>/`，版本钉死、哈希登记；禁止运行时 CDN 外链。
- **审批颗粒度**：每条新增 / 替换 / major·minor 升级都需用户签字（P2）；patch 升级只登记（P3）；构建链另案（P1）。
- **体积预算**：单依赖 ≤ 80 KB gzip、单页首屏增量 ≤ 120 KB gzip、全站新增总量 ≤ 300 KB gzip。

## 背景

现行「无第三方运行时依赖」是项目诞生时的形态约定（见 `history/decisions/` 追溯结论），散落在 8 处文档与描述中；但 `check-docs` 只校验模块卡字段字面存在，没有任何门禁真正检查依赖是否存在、是否登记。前提变化后，若只改措辞不补程序，规则会立刻漂移。本工序把「口径 + 清单 + 门禁」一次补齐：

- 口径：`架构 §1 形态行`、禁止边、基线登记；`dev-environment`；`product`；`ui-shell` 规格；`README`；`package.json` 描述。
- 清单：`design/dependencies.md`（唯一数据源，机读 JSON 块）。
- 门禁：`tools/check-deps.js` 扫描页面外链 / import / BFF require / package.json / vendor 文件哈希与体积；`check-docs` 校验 `DEP-xxxx` 引用可解析。

不改已交付的 `REQ-0012` / `REQ-0013` 约束行（历史记录），由决策记录声明基线自本日起变更。

## 验收标准

1. `design/dependencies.md` 含准入规则、判据、登记模板与机读清单；清单初始为空（证明「默认零依赖」仍成立）。
2. 8 处口径与新基线一致，仓库内不再出现与新基线矛盾的「零第三方运行时依赖」绝对表述。
3. `tools/check-deps.js` 零依赖可跑，能拦截：未登记依赖、CDN/远程外链、`package.json` 运行时依赖、vendor 文件哈希/体积不符。
4. 负向验证：临时构造一个未登记依赖用例，`check:deps` 必须失败；移除后必须通过。
5. `npm test`（含 `check:deps`）全绿；`check-docs` 能解析 `DEP-xxxx`。
6. 工序写 `result.md` 后归档；决策记录落 `history/decisions/`。

## 任务表

| ID | 类型 | 组件 | 状态 | 交付物 | 装载清单 |
|---|---|---|---|---|---|
| T-01 | design | global | done | 本 brief | 用户决策 3 条 |
| T-02 | design | global | done | `design/dependencies.md` | 准入程序与清单 |
| T-03 | change | global | done | 8 处口径更新 | architecture / dev-environment / product / ui-shell / README / package.json / risks |
| T-04 | change | global | done | `tools/check-deps.js` + `check-docs` 增强 + npm script | 零依赖扫描器 |
| T-05 | verify | global | done | `npm test` + 负向验证 | 门禁证据 |
| T-06 | verify | global | done | 决策记录 + `result.md` + 归档 | 收口 |

## 领取的开放问题

无（OQ-1 ~ OQ-7 未领取）。

## 收口方式

T-05 执行：`npm test`、`node --check`、负向用例（未登记依赖必须被拦截）；T-06 写 `result.md`、决策记录，归档到 `history/works/`。
