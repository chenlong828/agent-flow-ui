---
layer: design
module: ui-shell
component: CMP-ui-shell
requirement: REQ-0001
scenario: SCN-0001
status: active
updated: 2026-11-17
---

# 全局布局与设计约定

> 导航定位：所有页面的外壳（全局约定）　|　形态：框架布局　|　前置文档：`design/product.md`
> 产品占位名：**AgentFlow · 研发智能体工作流编排**（可在评审时更名）

## 0 模块卡

> 追溯：`REQ-0001` / `SCN-0001`（verified）；`REQ-0018` / `SCN-0020`（MOCK 页关闭与演示模式）；`REQ-0020`（90% 大弹层，服务 `SCN-0019`/`SCN-0004`）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件（跨页共享外壳）
- 业务价值：为 13 个页面提供一致的导航、顶栏、面包屑、页头与字体缩放，并统一门禁仍由 MOCK 供数的页面；没有它，每个页面都要重写外壳，用户区、通知角标与全局交互无处统一。
- 负责 / 不负责：负责 `DF.renderShell` 生成的顶栏/左侧导航/面包屑/页头容器、用户区下拉、待确认角标、字体缩放双路径（zoom / transform 兜底）、`DF.mockPageGate` 演示页门禁与 `DF` 公共组件原语；不负责任何页面的业务主体、业务数据写入与页面路由（由各 `CMP-*` 页面组件承担）。
- 内部逻辑：13 页统一 `renderShell` 生成顶栏/导航/面包屑/页头；`DF.menu` 左缘与 `alignRight` 右缘语义固定，按实际宽高把弹层钳入视口四边（16px，zoom 路径按缩放坐标系换算），打开新菜单前先摘除上一次的 document 关闭监听器；`DF.modal` 统一管理遮罩、头部、主体与底部，`size:'screen'` 时按视口 90% × 90% 计算并在 resize 时重算，内容在主体内滚动；字号优先 `zoom`、探测失败走 `transform` 兜底；铃铛角标只统计 `MOCK.instances` 中「等待人工确认」；导航按 `demoOn()` 过滤 `mockOnly` 项，关闭页由 `mockPageGate` 渲染占位。
- 数据所有权：读 `MOCK.instances`（仅统计 `status === '等待人工确认'` 作为铃铛角标）；不写任何业务集合；写 localStorage `df-font`（字号 s/m/l/xl）与 `df-collapsed`（导航折叠），均为 UI 偏好，刷新保留；写 sessionStorage `df-demo-pages`（演示模式开关，`?demo=1` 置位、`?demo=0` 清除），只在本标签页生效。
- 公开契约：入口 `DF.renderShell(...)`（13 页共用）；操作 `CMP-ui-shell#renderShell`（外壳渲染）、`#topbar`（环境/通知/用户区）、`#nav`（4 组 6 项 + 折叠；演示模式 9 项）、`#font-scale`（字号切换与跨页持久）、`#bell`（待确认角标与跳转）、`#user-menu`（Key 管理 / 退出登录）、`#mock-page-gate`（`DF.mockPageGate` 占位页与演示模式）、`#modal`（`DF.modal.open/confirm/form/picker`，`size:'screen'` 为大弹层）；不变量 13 页外壳结构一致（顶栏 + 220px 导航 + 面包屑/页头/`#page-body` 三兄弟）；默认导航 6 项、演示模式下 9 项；关闭页直达必须渲染占位且不执行页面主体；`DF.menu` 默认左缘语义、`alignRight` 右缘语义不得互换；菜单必须整体留在视口内（四边 16px；zoom 路径下 offsetWidth/Height 与 innerWidth/Height 先换算到同一坐标系），连续点击同一触发器不得因旧关闭监听器而丢失菜单；`size:'screen'` 弹层宽高各为视口 90%，头部/底部固定、主体内部滚动，窗口尺寸变化时重算；缩放系数一律走 `DF.zoomK()` / `DF.zoomOnFixed()`，页面不得各自缓存。
- 依赖：`MOCK`（只读角标）；不依赖任何页面组件；页面通过全局 `DF` 反向依赖本组件，属外壳契约。
- 冷热属性：冷（页面加载时同步渲染，无 SLA 与延迟预算）；不经过 `CMP-bff` 热路径。
- 变化轴：导航分组/页面增减与顶栏全局操作（环境、通知、用户区）最可能变化，改这里会同时影响 13 页。
- 验证入口：`node tools/verify-user-menu.js`（SCN-0001，45/45，2026-11-12 复跑）；`node tools/verify-mock-pages.js`（SCN-0020，22/22，2026-11-12）；`node tools/smoke-test.js`（13/13）；Safari 人工走查待验收（R9）。
- 验证计划：外壳结构与 13 页一致性→`smoke-test`；用户菜单/缩放/遮挡→`verify-user-menu` SCN-0001 4 条 45 断言；MOCK 页关闭与演示模式→`verify-mock-pages` SCN-0020 3 正 1 反；Safari 手工走查仍为发布门禁（R9）。
- 预算：`assets/js/ui.js` 约 20 KB + 本规格约 8 KB + `tools/verify-mock-pages.js` 约 4 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → 任一 `/pages/*.html`（外壳随页面加载）。
- 删除测试：删除后 13 页同时失去导航、顶栏、用户区与字号能力，复杂度会复制到每个页面，故保留为唯一共享组件。
- 已知偏差：M1 十页已有各自 `REQ`/`SCN`；外壳能力仍只有用户区有 `REQ-0001` / `SCN-0001`，导航/字号/待确认角标无独立需求卡；Safari 人工走查未完成；WebKit 2104 的 html 级 zoom 探测失效，引擎证据只覆盖 transform 兜底路径（R1/R9）；MOCK 页关闭期间，用户区「个人 Key 管理」仍可点击但落到占位页（`REQ-0018` 已确认保留该入口）。2026-11-13 修复 `DF.menu` 连续点击不弹与越出视口：关闭监听器改为可摘除的单例、定位按实际宽高钳四边（Skill 行菜单为触发页，SCN-0005-T5）。2026-11-17 修复底部「更多」菜单在最大字号/缩放路径下仍向下溢出：纵向钳制改用 `innerHeight / zoomK` 与菜单 CSS 高度比较（`SCN-0018-T3`）。

## 1 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 顶栏: ⬡ AgentFlow │ [演示环境] │              🔔(3) │ ◉ 用户名 ▾ │
├────────────┬─────────────────────────────────────────────────────┤
│ 左侧导航    │  面包屑: 流程研发 / 工作流                            │
│ (220px)    │  ─────────────────────────────────────────────────  │
│            │  页头: 标题 + 说明文字            [主操作按钮]         │
│ 流程研发    │  ─────────────────────────────────────────────────  │
│  工作流     │                                                     │
│ 资产与注册  │                  页面主体内容区                       │
│  专家管理   │                                                     │
│  Skill库   │                                                     │
│  Harness   │                                                     │
│  工具与集成 │                                                     │
│ 运行与运营  │                                                     │
│  运行实例   │                                                     │
│ [演示]效能看板│                                                     │
│ 基础配置    │                                                     │
│ [演示]工作区│                                                     │
│ [演示]个人Key│                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

## 2 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 顶栏 | 产品名+Logo | 文字+图形 | 点击回工作流列表（首页） |
| 顶栏 | 环境徽标 | 标签 | 固定「演示环境」，橙色描边 |
| 顶栏 | 通知铃铛 | 图标+角标 | 角标=等待人工确认的实例数；点击跳转实例列表并自动选中「等待人工确认」Tab |
| 顶栏 | 用户头像+名称 | 下拉 | 显示名「陈龙」；点击用户区弹出菜单：个人 Key 管理（跳 keys.html）/ 退出登录——退出先弹确认框，确认后 Toast 提示（原型静态，无真实登录态）；点击菜单外任意处收起，再点用户区为切换开/收。实现复用 `DF.menu`（fixed 弹层，z-index 250），弹层坐标已按缩放路径归一（见 `assets/js/ui.js` menu() 注释） |
| 左侧导航 | 默认 4 组 6 项（演示模式 9 项） | 分组菜单 | 当前项高亮；可折叠为纯图标（64px）；组标题小字灰色；效能看板/工作区配置/个人 Key 管理仅在演示模式显示 |
| 内容区 | 面包屑 | 链接 | 二级页（编辑器/实例详情/工作区详情）显示层级，可点击返回 |
| 内容区 | 页头 | 标题区 | 标题 + 一句说明 + 右侧主操作按钮（各页面自定义） |

## 3 导航与页面文档映射（索引）

| 导航项 | 页面文档 | 形态 |
|---|---|---|
| 工作流 | `design/components/workflow-list/spec.md` | 列表页 |
| └ 编辑器（二级） | `design/components/workflow-editor/spec.md` | 画布二级页 |
| 专家管理 | `design/components/experts/spec.md` | 卡片列表 + 抽屉 |
| Skill 库 | `design/components/skills/spec.md` | 列表 + 专门详情页 |
| Harness 管理 | `design/components/harnesses/spec.md` | 列表 + 抽屉 |
| 工具与集成 | `design/components/tools/spec.md` | Tab 列表 + 抽屉 |
| 运行实例 | `design/components/instances/spec.md` | 列表 + 独立详情页 |
| 效能看板 | `design/components/analytics/spec.md` | 仪表盘 |
| 工作区配置 | `design/components/workspaces/spec.md` | 列表 + 独立详情页 |
| 个人 Key 管理 | `design/components/keys/spec.md` | 列表 + 弹窗 |

## 4 详情形态策略（R4 已确认）

- **右侧抽屉**：专家、Harness、工具、子任务等资产类详情（宽 640~760px，列表上下文不丢失）；Skill 专门页改为独立二级页
- **独立二级页**：内容重、需要主从结构的页面——工作流编辑器、实例详情、工作区详情、Skill 专门页
- **大弹层**：工作流编辑器的节点/阶段/连线属性、运行实例的节点详情——双击元素/节点打开，宽高各为视口 90%，头部与底部固定，内容超出时弹层主体内部滚动；Esc/遮罩/× 关闭。实现统一走 `DF.modal.open({ size: 'screen' })`，页面不重复算尺寸
- **弹窗**：新建/发起运行/删除确认等短表单与确认操作

## 5 设计约定

- **语义色**（CSS 变量）：运行中=蓝 `--c-run`、成功=绿 `--c-ok`、失败=红 `--c-fail`、等待人工=橙 `--c-wait`、回退=紫 `--c-rollback`、暂停/停用=灰 `--c-pause`
- **主色**：科技蓝（导航高亮、主按钮、链接）
- **字号层级**：页头 20px / 区块标题 15px / 正文 13px / 辅助 12px；表格行高 40px
- **组件**：优先手写（按钮/标签/表格/卡片/抽屉/弹窗/Tab/表单），SVG 画布与图表；无构建链；已准入第三方依赖见 `design/dependencies.md`（按 `DEP-xxxx` 引用）
- **模拟数据**：统一 `js/mock-data.js`，挂载 `window.MOCK`（workflows / experts / skills / harnesses / tools / instances / workspaces / keys / analytics），页面 JS 只读消费，跨页跳转用 `location` 带 query 参数

## 6 状态与空态

- 所有列表页提供空态插画 + 引导按钮（如「注册第一个专家」）
- 加载态：骨架屏（原型可 200ms 模拟延迟后渲染）
