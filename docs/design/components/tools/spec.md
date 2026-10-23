---
layer: design
module: tools
component: CMP-tools
status: active
updated: 2026-10-23
---

# 工具与集成

> 导航：资产与注册 / 工具与集成　|　形态：Tab 列表 + 抽屉　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为专家与流程设计者提供确定性工具（MCP/CLI/脚本）的注册、调试、引用查看与治理入口；没有它，工具只能散落在专家提示词里，无法复用、验证被谁引用。
- 负责 / 不负责：负责工具注册表（类型/状态/搜索筛选）、注册/编辑弹窗（参数定义、超时、所属 Harness）、调试抽屉（模拟 trace/结果、运行记录）、引用方查看、删除保护；不负责工具真实执行运行时、Harness 的注册与健康（`CMP-harnesses`）、专家/工作流节点对工具的绑定（各自组件）、CI/CD 集成（本版占位）。
- 数据所有权：读 `MOCK.tools`、`MOCK.harnesses`、`MOCK.experts`、`MOCK.workflows`（引用方统计与节点引用反查）；写 `MOCK.tools`（注册 `push`、删除 `splice`、调试运行记录 `runs`、状态「未验证→可用」，仅内存态，刷新复位）；调试抽屉的输入/输出/执行中状态只在内存。
- 公开契约：页面入口 `pages/tools.html`；操作 `CMP-tools#list`、`#register`、`#debug`、`#refs`、`#delete`；不变量 被专家或工作流节点引用的工具（`refCount > 0`）不可直接删除，删除入口置灰并显示引用数；只有调试成功一次才从「未验证」转「可用」，失败保持不可用；引用方统计必须来自 `MOCK.experts[].tools` 与 `MOCK.workflows` 节点配置的同源扫描，不得使用静态数字冒充。
- 依赖：`DF`（外壳、Tabs、表格、抽屉、弹窗、Toast、图标）/ `MOCK`；不依赖其他页面组件（跨页只走 URL）。
- 变化轴：工具调用协议与参数 schema（MCP 端点 / CLI 命令模板 / 脚本）最易变，新增类型须同步注册表单、调试抽屉与引用方展示。
- 验证入口：`npm start` + `/pages/tools.html`；`node tools/smoke-test.js`（12 页冒烟，含本页）；legacy-smoke（M1 基线无 SCN，仅页面加载期断言）。
- 预算：`tools.js` 约 19 KB + 本规格约 7 KB，无专属测试；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/tools.html`（所属 Harness 下拉只读 `MOCK.harnesses`）。
- 删除测试：删除后工具资产无法注册、调试、查引用与治理，专家/节点失去可引用的确定性工具来源；复杂度会集中到专家与编辑器，故保留为独立组件。
- 已知偏差：M1 原型基线、无 REQ 追溯（无对应 SCN）；仅冒烟，调试为模拟执行、无真实工具调用；CI/CD 环境绑定仅为占位 Tab；删除保护只按 `refCount` 夹具字段判断，不阻断真实并发引用。

## 1 页面定位

确定性工具资产注册中心（PPT P5「能用工具解决的不依赖模型」「固定方法沉淀」）：MCP/CLI 工具注册与调试；CI/CD 环境绑定为本版占位（R3）。

## 2 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 工具与集成                                     [+ 注册工具]         │
│ Tab: [MCP/CLI 工具] [CI/CD 环境(占位)]                             │
├──────────────────────────────────────────────────────────────────┤
│ 筛选: 类型[全部▾] 状态[全部▾]                     [🔍搜索]           │
│ 名称            类型   调用方式                    所属Harness 状态  引用  最近调试 操作 │
│ trace_call_chain CLI   $ trace --symbol {sym}     build-01   可用  5    2h前  调试 ⋮ │
│ linter          CLI    $ lint --path {path}       agent-07   可用  3    1d前  调试 ⋮ │
│ metadata_query  MCP    mcp://meta/query           build-02   可用  4    3h前  调试 ⋮ │
│ data_factory    脚本    python tools/make_data.py  build-01   未验证 2    —     调试 ⋮ │
│ …                                                                │
├──────────────────────────────────────────────────────────────────┤
│ Tab2 CI/CD 环境: ┌────────────────────────┐                       │
│                  │   ⛔ 暂未开放            │  （占位空态）           │
│                  │ 当前版本聚焦编排模型演示  │                       │
│                  └────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

## 3 元素明细（Tab1 工具注册表）

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 筛选 | 类型下拉、状态下拉、搜索 | 控件 | 类型：MCP / CLI / 脚本；状态：可用/不可用/未验证 |
| 表格 | 名称 | 等宽文字 | 点击打开调试抽屉 |
| 表格 | 类型 | 标签 | 颜色区分 MCP/CLI/脚本 |
| 表格 | 调用方式 | 等宽代码样式 | 命令模板或 mcp:// 端点，`{}` 为参数占位 |
| 表格 | 所属 Harness | 标签 | 工具在该设施上运行；点击跳 Harness 详情 |
| 表格 | 被引用数 | 数字链接 | 弹层列出引用它的专家/节点 |
| 表格 | 最近调试时间 | 相对时间 | — |
| 表格 | 操作 | 按钮组 | 调试、编辑、删除（被引用时禁删并提示） |

## 4 调试抽屉

| 区块 | 内容 |
|---|---|
| 参数 | 键值对表单（按调用方式模板自动生成参数行） |
| 执行 | [运行] 按钮 → loading → 输出区（终端样式）+ 退出码 + 耗时 |
| 结果记录 | 最近 5 次调试结果列表（成功/失败、耗时） |

## 5 注册工具弹窗

名称、类型（MCP/CLI/脚本）、调用方式（命令模板 / 端点）、参数定义（键/类型/说明，可增删行）、超时（ms）、所属 Harness（下拉）、说明 → 保存后状态=未验证（调试一次成功后变可用）。

## 6 状态与空态

- 无工具：空态「注册第一个确定性工具，减少对模型的依赖」
- CI/CD Tab：固定占位空态（R3：暂不展开）

## 7 模拟数据依赖

`MOCK.tools[]`：10 个（trace_call_chain、metadata_query、dsl_search、linter、code_smell_scan、contract_assert、data_factory、replay_clean、business_tree_query、smoke_runner），字段 `{id,name,type,invocation,params[],harnessId,timeout,status,usedBy,refCount,lastDebugAt}`。
