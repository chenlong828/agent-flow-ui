---
layer: design
module: ui-shell
status: verified
flow: topbar
scenario: SCN-0001
updated: 2026-10-23
---

# SCN-0001 顶栏用户区下拉菜单

## 入口

- `CMP-ui-shell/assets/js/ui.js#renderShell`（`#df-user` 用户区与菜单绑定）

## 运行序

1. 点击 `#df-user` → `DF.menu(items, { alignRight })` 渲染在芯片正下方、右缘对齐。
2. 点击菜单外任意处 → 关闭；再点芯片 → 重新弹出；菜单开着再点芯片 → 收起（切换语义）。
3. 点「个人 Key 管理」→ 跳 `pages/keys.html`。
4. 点「退出登录」→ `DF.modal.confirm`；取消无副作用，确认后 Toast（原型静态）。

失败路径：`DF.menu` 定位钳制按左缘公式处理右缘锚定 → 菜单整体偏移（T2/T4 捕获）；弹层被遮挡 → 命中测试失败（T2）。

## 不可变引用

- `DF.menu` 默认左缘语义（`workflow-list`、`keys` 的旧调用方依赖）。
- 12 页 shell 的 `#df-user` 结构与显示名。

## 测试

执行层：真实引擎（Playwright WebKit）；可执行：`tools/verify-user-menu.js`。3 正 1 反，全部断言具体值/位置/状态。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0001-T1 | 正 | 12 页右上角显示「陈龙」且无旧名、零 pageerror | A 段 |
| SCN-0001-T2 | 正 | 菜单项 = Key 管理 / 退出登录；位于芯片正下方、右缘对齐；中心点命中自身；开→收→再开；最大字号路径位置正确 | B、E 段 |
| SCN-0001-T3 | 正 | 点 Key 管理到 `keys.html`；退出登录弹确认框，确认后 Toast | C、D 段 |
| SCN-0001-T4 | 反 | 取消退出登录无 Toast、弹层全关；旧调用方菜单仍按左缘弹出、不溢出视口 | D、F 段 |

最近一次执行：2026-10-23 迁移后复跑，45 通过 / 0 失败（命令见 `design/dev-environment.md` 3.2；原始证据见 `history/works/2026-10-13-user-menu/result.md`）。

## 人工确认（不计入 3+1）

Safari 手工走查（强制刷新 → 显示名 → 弹菜单 → 外点收起 → 退出登录）仍未完成，记为发布确认项；不影响上述引擎层结论。
