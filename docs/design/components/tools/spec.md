---
layer: design
module: tools
component: CMP-tools
requirement: REQ-0008
scenario: SCN-0008
status: active
updated: 2026-10-28
---

# 工具与集成

> 导航：资产与注册 / 工具与集成　|　形态：Tab 列表 + 编辑弹窗　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0008` / `SCN-0008`（verified；DOM/jsdom 3 正 1 反）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为专家与流程设计者提供确定性工具（MCP/CLI/脚本）的注册与治理入口；没有它，工具只能散落在专家提示词里，无法复用、查看被引用情况。
- 负责 / 不负责：负责工具列表（类型/状态/搜索筛选）、注册/编辑弹窗（参数定义、超时、所属 Harness）、引用计数查看、删除；不负责工具真实执行运行时、Harness 注册与健康（`CMP-harnesses`）、专家/工作流节点对工具的绑定（各自组件）、CI/CD 集成（本版占位）。
- 内部逻辑：筛选 value 用 DTO 枚举；创建/更新固定 body；状态只按 B1 返回，不提供调试；引用只读 `usedByCount`；删除被引用 409。
- 数据所有权：页面状态直接保存 B1 `ToolListItem` / `ToolDetail` DTO；列表 `GET /tools`、详情 `GET /tools/{id}`、创建 `POST`、更新 `PUT`、删除 `DELETE` 均经 `window.API`；所属 Harness 下拉只读 `GET /harnesses`。不读 `MOCK`，不建第二套视图模型；写成功后重新拉列表或更新 DTO。
- 公开契约：页面入口 `pages/tools.html`；操作 `CMP-tools#list`、`#register`、`#edit`、`#refs`、`#delete`；不变量 ①列表筛选的 value 使用 DTO 枚举 `mcp/cli/script` 与 `unverified/available/unavailable`，中文只在显示时映射；②创建/更新 body 为 `name/kind/invocation/description/harnessId/timeoutMs/params[{key,type,description}]`；③状态只按 B1 返回值展示，B1 没有调试端点，页面不提供调试、不把状态改为 `available`；④引用只显示 `usedByCount`，B1 不提供引用方明细；⑤删除被引用工具由 B1 返回 409 `referenced`，页面提示并保留数据。
- 依赖：`DF`（外壳、Tabs、表格、弹窗、Toast、图标）/ `window.API`；不依赖 `MOCK` 或其他页面组件。
- 冷热属性：冷（管理面；工具真实执行不在本组件）。
- 变化轴：工具调用协议与参数 schema（MCP 端点 / CLI 命令模板 / 脚本）最易变。
- 验证入口：`npm start` + `/pages/tools.html`；`node tools/verify-m1-scenarios.js SCN-0008`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 验证计划：注册/筛选/引用/删除→SCN-0008 T1-T4；结构→`smoke-test`；真实 B1→`test:b1-pages/writes`。
- 预算：`tools.js` 约 22 KB + 本规格约 4 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/tools.html`（所属 Harness 下拉读真实 Harness 列表）。
- 删除测试：删除后专家/节点失去可引用的确定性工具来源，复杂度会集中到专家与编辑器，故保留为独立组件。
- 已知偏差：B1 没有调试端点、运行记录与引用方明细；原调试抽屉、`runs`、状态转可用、`MOCK` 引用扫描均已移除。`lastDebugAt` 可为空，页面显示「—」。M1 SCN-0008 使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-pages.js` / `verify-b1-writes.js` 覆盖。

## 1 页面定位

确定性工具资产注册中心（PPT P5「能用工具解决的不依赖模型」「固定方法沉淀」）：MCP/CLI/脚本工具注册与治理；CI/CD 环境绑定为本版占位（R3）。

## 2 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 工具与集成                                     [+ 注册工具]         │
│ Tab: [MCP/CLI 工具] [CI/CD 环境(占位)]                             │
├──────────────────────────────────────────────────────────────────┤
│ 筛选: 类型[全部▾] 状态[全部▾]                     [🔍搜索]           │
│ 名称            类型   调用方式                    所属Harness 状态  引用  最近调试 操作 │
│ trace_call_chain CLI   trace --symbol {sym}      build-01   可用  5    2h前    编辑 删除 │
│ data_factory     脚本   python tools/make_data.py build-01   未验证 2    —       编辑 删除 │
└──────────────────────────────────────────────────────────────────┘
```

## 3 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 筛选 | 类型下拉、状态下拉、搜索 | 控件 | 类型：mcp/cli/script；状态：unverified/available/unavailable |
| 表格 | 名称 | 等宽文字 | 点击打开编辑弹窗 |
| 表格 | 类型 | 标签 | 颜色区分 MCP/CLI/脚本 |
| 表格 | 调用方式 | 等宽代码样式 | 命令模板或 mcp:// 端点 |
| 表格 | 所属 Harness | 标签 | 显示 Harness 名称；找不到时显示 ID |
| 表格 | 状态、被引用数、最近调试 | 标签/数字/时间 | 状态只读；引用数点击显示 B1 计数说明 |
| 表格 | 操作 | 按钮组 | 编辑、删除（引用时后端 409） |

## 4 注册/编辑弹窗

名称、类型（MCP/CLI/脚本）、调用方式、参数定义（key/type/description，可增删行）、超时（1000–600000 ms）、所属 Harness（下拉）、说明。编辑时先 `GET /tools/{id}` 取完整 `params`，保存用 `PUT`；状态由后端返回，不在页面修改。

## 5 引用与删除

引用弹层只显示 `usedByCount` 和「B1 未提供引用方明细」。删除按钮不按引用数预先禁用；确认后调用 `DELETE`，B1 返回 409 `referenced` 时提示「资产仍被引用，不能删除」，列表保留。

## 6 状态与空态

- 无工具：空态「注册第一个确定性工具，减少对模型的依赖」
- 加载中、加载失败（`#tl-retry`）、筛选无结果、CI/CD 占位空态

## 7 B1 数据契约

列表/详情字段：`id,name,kind,invocation,description,harnessId,timeoutMs,params,paramCount,status,usedByCount,lastDebugAt,revision,createdAt,updatedAt`。创建/更新不提交 `status`；删除必须带 `If-Match`（由 `window.API` 生成）。
