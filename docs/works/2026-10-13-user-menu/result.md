---
layer: works
module: global
status: closed
updated: 2026-10-13
---
# 收口：顶栏用户区改「陈龙」＋下拉菜单（含退出登录）

## 验收结果

| 验收标准 | 结果 | 证据（命令/结果摘要） |
|---|---|---|
| 全部 12 页右上角显示「陈龙」 | ✅ 通过 | `verify-engine.js` A 段：12 页 × (显示名 + 无 pageerror) 共 24 断言全过；显示名断言 = 芯片文本含「陈龙」且不含「陈明」 |
| 点击用户区弹出菜单，含「个人 Key 管理」「退出登录」 | ✅ 通过 | B 段：菜单弹出，项 = `个人 Key 管理\|退出登录`（命中 `DF.menu`，z-index 250） |
| 菜单位于用户区正下方、右缘对齐、不被遮挡 | ✅ 通过 | B 段：top≥chip bottom（Δtop=6）、右缘 Δ=0px、`elementFromPoint` 菜单中心命中菜单自身（引擎层，jsdom 不作数） |
| 菜单外点击收起；再点用户区重新弹出；开时再点用户区收起 | ✅ 通过 | B 段：外点收起 ✓、重开 ✓、切换语义 ✓（用户区 `stopPropagation` + `menuEl` 状态切换） |
| 「个人 Key 管理」跳 keys.html | ✅ 通过 | C 段：点击后 URL = `…/pages/keys.html` |
| 「退出登录」有确认与反馈，取消无副作用 | ✅ 通过 | D 段：确认框标题「退出登录」；取消→关闭且无 Toast；确认→Toast「已退出登录（原型演示，无真实登录态）」，弹层全关 |
| 默认字号与「最大」字号（transform 兜底缩放路径）下位置均正确 | ✅ 通过 | E 段：最大字号实测走 transform 兜底（该 WebKit 构建 zoom 探测必失效），Δtop=6、右缘 Δ=0px、不被遮挡 |
| （门禁外加）旧调用方回归：`DF.menu` 默认左缘语义未变 | ✅ 通过 | F 段：workflow-list「更多」（复制\|导出 DSL\|删除）与 keys 行「更多」（绑定用途\|删除）均弹出在触发点处、不溢出视口 |

**分层证据**：语法层 `node --check`（ui.js + 全部 pages/*.js）通过；引擎层 `PLAYWRIGHT_BROWSERS_PATH=/tmp/dsh/pw-browsers node verify-engine.js` → **45 通过 / 0 失败**（全站 12 页 + 查询参数变体加载零 pageerror，即《调试方案》§2 回归循环模板 + 交互冒烟）。

**zoom 路径说明**：本引擎（WebKit 构建 2104）html 级 zoom 探测必失效、恒走 transform 兜底（坑档案 CSS-3），故引擎证据覆盖兜底路径；zoom 路径坐标数学与 `DF.modal` 同模式（视觉坐标 ÷ `zoomK`，见 `assets/js/ui.js` menu() 注释），真实 Safari 行为按坑档案 CSS-3 遗留验证项处理。

**待人工验收**：用户 Safari 手工走查未完成（强制刷新 `Command + Option + R` 后：右上角显示「陈龙」→ 点击弹菜单 → 点他处收起 → 退出登录确认与提示）。

## 结论落点表

| OQ | 结论 | design 落点（文件§节） |
|---|---|---|
| OQ-7 | 用户区显示名「陈龙」；点击弹下拉（`DF.menu` alignRight 锚定）：个人 Key 管理 → keys.html；退出登录 → 确认框 → Toast（原型静态）；外点收起、再点切换。 | `design/ui-shell.md` §2（顶栏·用户头像+名称 行）；`design/code-refactoring.md` §4（`DF.menu` 已下沉能力条目：视觉坐标归一 + alignRight 语义） |

## 新坑登记

| 现象 | 存续条件 | 对策落点 |
|---|---|---|
| JS-7 右缘坐标误用左缘防溢出公式 → 锚定菜单整体推偏 8/25px，命中测试仍通过 | 按右缘语义传 x 的新调用复用默认左缘钳制即复发 | `history/pitfalls.md` JS-7；《代码重构要点》§4 `DF.menu` 条目；《调试方案》§4 规则五 |
| JS-8 程序化 el.click() 无坐标 → clientX 起源弹层画到屏幕最左（测试事件伪装页面缺陷） | 测试用 el.click() 验证 clientX 起源弹层时必然发生；真实用户点击不受影响 | `history/pitfalls.md` JS-8；《调试方案》§4 规则四 |
