---
layer: history
module: ui-shell
status: frozen
updated: 2026-11-12
---

# 工序：MOCK 演示页临时关闭与演示模式

## 需求

- `REQ-0018`：MOCK 演示页临时关闭与演示模式（导航隐藏 + 直达占位 + `?demo=1` 放行）。

## 背景

效能看板、工作区列表/详情、个人 Key 管理四页仍由 `MOCK` 供数，与已接入 B1/B3/B4 的 9 页混在同一导航里，容易被误认为真实能力。用户 2026-11-12 指示：先临时关闭 MOCK 页（有需要再展示）；分页问题暂不增加、以后再做。

已确认口径：隐藏这三个导航入口；直达页面显示占位页；地址带 `?demo=1` 打开演示模式（本标签页内保持），`?demo=0` 退出；用户区「个人 Key 管理」入口保留。不删除页面、数据与规格。

## 目标 / 非目标

- 目标：关闭只发生在入口层，关闭状态不执行页面主体；演示模式不需改代码即可打开；三个页面原有业务断言不变。
- 非目标：不做权限/环境级开关；不删除 MOCK 数据；不改业务字段、分页与交互；不做 localStorage 持久化或跨标签页继承。

## 定级

P2：跨 `CMP-ui-shell` 与 3 个页面组件，但不动组件切分、schema、后端契约与依赖；影响面主要是导航与入口。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 |
|---|---|---|---|---|
| `T-MOCK-01` | design | `CMP-ui-shell` | 完成 | 开关语义、占位页与导航过滤方案 |
| `T-MOCK-02` | change | `CMP-ui-shell` + analytics / workspaces / keys | 完成 | `DF.mockPageGate`、`demoOn`、4 页入口门禁、会话级开关 |
| `T-MOCK-03` | verify | global | 完成 | `verify-mock-pages` 22/22；M1 50/50；13 页冒烟；`test:gate` 通过 |

装载清单：`assets/js/ui.js`、`assets/js/pages/{analytics,workspaces,workspace-detail,keys}.js`、`tools/{smoke-test,verify-m1-scenarios,verify-user-menu}.js`、`tools/verify-mock-pages.js`、`docs/design/components/{ui-shell,analytics,workspaces,keys}/spec.md`、`docs/design/scenarios/shell/navigation/mock-pages-gate/scenario.md`。

## 验收标准

1. 默认导航 6 项，不含效能看板 / 工作区配置 / 个人 Key 管理；直达四页显示占位，不渲染业务数据、无运行时报错。
2. `?demo=1` 在本标签页恢复四页与导航；`?demo=0` 退出；演示模式不写 localStorage、不跨标签页。
3. `SCN-0009` / `SCN-0010` / `SCN-0011` 在 `?demo=1` 下业务断言不变，M1 全量通过。
4. `SCN-0020` verified（3 正 1 反）；`npm run test:gate`、13 页冒烟、`npm test` 通过。
