---
layer: design
module: ui-shell
status: verified
flow: navigation
scenario: SCN-0020
execution: playwright
updated: 2026-11-12
---

# SCN-0020 MOCK 演示页关闭与演示模式

## 入口

- `CMP-ui-shell/assets/js/ui.js#mockPageGate`（占位页与门禁）
- `CMP-ui-shell/assets/js/ui.js#renderShell`（导航过滤）
- 四个页面：`pages/analytics.html`、`pages/workspaces.html`、`pages/workspace-detail.html?id=`、`pages/keys.html`

## 运行序

1. 地址不带 `demo` 参数：`renderShell` 过滤 `mockOnly` 导航项（效能看板 / 工作区配置 / 个人 Key 管理）；直达上述四页时，页面模块先调 `mockPageGate`，只渲染「该页面由演示数据驱动，已临时关闭」占位与「以演示模式打开」入口。
2. 点击占位入口：地址追加 `?demo=1`，`demoOn` 写入 sessionStorage `df-demo-pages`，同页恢复真实页面；同标签页内跨页保持演示模式，导航恢复 9 项。
3. 地址带 `?demo=0`：清除标记，当前页回到占位，导航再次隐藏三项。
4. 用户区菜单的「个人 Key 管理」始终保留；关闭状态点击落到 `keys.html` 占位页，由占位页再给出演示入口。

失败路径：占位页不得执行页面主体（无业务表格 / 统计卡）；演示模式不得写入 localStorage、不得跨标签页继承；关闭状态不得产生运行时报错。

## 不可变引用

- `SCN-0001` 的用户区菜单项与显示名（本场景不改用户区）。
- `SCN-0009` / `SCN-0010` / `SCN-0011` 的业务断言（以 `?demo=1` 执行，页面行为不变）。
- `DF.renderShell` 的外壳结构与 `DF.menu` 定位语义。

## 测试

执行层：真实引擎（Playwright WebKit）；可执行：`node tools/verify-mock-pages.js`。最近一次执行：2026-11-12，22/22 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0020-T1 | 正 | 四个 MOCK 页直达显示占位页（`#mock-demo-open`），不渲染业务表格，零运行时错误 | `tools/verify-mock-pages.js#T1` |
| SCN-0020-T2 | 正 | 默认导航 6 项且不含三项；用户区菜单仍为「个人 Key 管理 / 退出登录」；live 页不出现占位 | `tools/verify-mock-pages.js#T2` |
| SCN-0020-T3 | 正 | 占位页「以演示模式打开」恢复同页真实内容；导航恢复 9 项；同标签页跨页保持；`?demo=0` 回到占位 | `tools/verify-mock-pages.js#T3` |
| SCN-0020-T4 | 反 | 演示模式不写 localStorage；新标签页不继承，仍显示占位页 | `tools/verify-mock-pages.js#T4` |
