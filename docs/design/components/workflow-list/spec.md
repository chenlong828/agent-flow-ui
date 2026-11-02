---
layer: design
module: workflow-list
component: CMP-workflow-list
requirement: REQ-0016
scenario: SCN-0018
status: active
updated: 2026-10-30
---

# 工作流列表（B3 live）

> 导航：流程研发 / 工作流　|　形态：列表页（卡片/表格）　|　前置：`design/components/ui-shell/spec.md`、`design/components/workflow-data/spec.md`

## 0 模块卡

> 追溯：`REQ-0016` / `SCN-0018`（verified；Playwright 14/14）。

- 状态：active（2026-10-30 从 MOCK 原型切到 B3 live）
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为流程研发者提供工作流的真实浏览、检索、创建与生命周期入口；没有它，B3 中已存在的工作流无法被发现，新建/复制/删除/导入导出也只能靠 API 手工调用。
- 负责 / 不负责：负责分页/搜索/类型筛选/排序、卡片与表格视图、工作流域统计、新建向导、模板复制、改名/改类型/改描述、删除、导入 DSL、导出 JSON/YAML、从列表进入编辑器；不负责节点图编辑与保存（`CMP-workflow-editor`）、实例运行与生命周期（`CMP-instances`）、权限与多人协同。
- 内部逻辑：查询条件变化 → `workflow/data#list`；名称搜索 120 ms 防抖；新建向导在浏览器构造 `start→end` 最小合法图，模板复制走 B3 copy；改名/删除带当前 revision 的 `If-Match`；导入成功后展示 `idMap` 与 warnings，再 GET 并进入编辑器；失败只渲染错误态，不落假数据。
- 数据所有权：B3 `Workflow` 列表/详情的只读缓存；写操作全部委托 `workflow/data`（创建/复制/更新/删除/导入）；本页不直接 `fetch`，不写 `MOCK`；视图偏好 `wl-view` 只存 `card|table`。
- 公开契约：入口 `pages/workflow-list.html`；操作 `#list`（查询 + 分页 + 双视图）、`#create`（向导 → 最小合法图）、`#copy`（模板复制）、`#update`（元数据）、`#delete`（二次确认）、`#import`、`#export`；不变量：创建/复制必须得到合法图，所有更新/删除携带 `If-Match`，列表不显示发布/版本/运行/更新人。
- 依赖：`DF`（外壳、弹窗、菜单、表格/空态、统计卡、Toast、`lsGet/lsSet`）、`API`（仅专家列表，用于向导起止专家）、`workflow/data`、`workflow/model`（`minimalGraph`/`graphCounts`）；不依赖其他页面 JS。
- 冷热属性：冷；一次列表查询 + 用户动作，无后台轮询。失败快速显示错误，不重试。
- 变化轴：查询维度（类型/排序/分页）与工作流生命周期操作；B3 DTO 字段变化集中在 `workflow/data`。
- 验证入口：`node tools/verify-workflow-list.js`（SCN-0018，14/14）；`npm run test:workflow`；真实 B3 只读走查 `http://127.0.0.1:3000/pages/workflow-list.html`。
- 验证计划：T1 查询/筛选/搜索/排序/空态；T2 新建与模板复制；T3 元数据/删除/导入/导出；T4 400/409/428/后端不可用与不回落。
- 预算：页面源码约 19 KB + 本规格；远低于 120k token。
- 单独运行：`npm start` → `/pages/workflow-list.html`。
- 删除测试：删除后 B3 工作流没有发现与创建入口，编辑器只能靠手写 URL 进入，复杂度会集中到编辑器；故保留独立页面。
- 已知偏差：类型 Tab 的计数是当前页分布（无独立 count API）；导入只接受 JSON（YAML 由服务端导出）；现有 B3 测试工作流未清理，按 brief 的部署步骤需用户确认后执行。

## 1 页面定位

B3 工作流的统一入口：浏览、检索、创建、复制、改名/改类型、删除、导入导出，并进入编辑器。只展示工作流域指标（总数、节点、阶段、最近更新），不显示实例运行/发布/版本/更新人。

## 2 布局结构

```
┌ 工作流  管理研发智能体工作流定义              [导入 DSL] [新建工作流] ┐
│ Tab: 全部 | 研发主流程 | 专项子流程 | 批量审视任务 …   [搜索名称]      │
│ 排序 [最近更新▾]  共 N 个                         [卡片|表格]          │
│ 统计：总数 / 节点 / 阶段 / 最近更新                                     │
│ 卡片或表格：名称、类型、描述、节点·阶段、更新时间、[编辑] [更多▾]       │
│ 分页：上一页 / 第 x 页 / 下一页                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## 3 元素与交互

| 区域 | 元素 | 说明 |
|---|---|---|
| 页头 | 导入 DSL / 新建工作流 | 文件选择；打开新建向导 |
| 筛选 | 类型 Tab | `type` 参数；计数为当前页分布 |
| 筛选 | 搜索 | 120 ms 防抖，`q` 参数；空态有清除按钮 |
| 筛选 | 排序 | `updatedAt:desc`（默认）/`updatedAt:asc`/`name:asc`/`name:desc` |
| 视图 | 卡片/表格 | `wl-view` 记忆；两种视图使用同一数据 |
| 卡片/表格 | 编辑/更多 | 编辑进编辑器；更多含编辑信息、复制、导出 JSON/YAML、删除 |
| 分页 | 上一页/下一页 | `limit=20`；`total` 来自 B3 |

## 4 新建向导与模板复制

- 名称（必填）、类型（必填，可从当前类型选或输入）、描述、起始专家、结束专家（可同一人）、可选模板。
- 无模板：构造 `start→end` 最小图（`n1/n2`、`e1 seq`、合法 ID、起止专家），`POST /workflows`；201 后 `GET` 详情并进入编辑器。
- 有模板：`POST /workflows/{id}/copy`，可选名称；201 后同样 `GET` 详情并进入编辑器。
- 服务端 400/409 时保留向导并展示 `details.issues`/名称冲突，不导航。

## 5 导入与导出

- 导入：读取 JSON → `POST /workflows/import`；成功弹层显示 `idMap`、warnings（未绑定专家/停用），引导进编辑器补绑。
- 导出：`GET /workflows/{id}/dsl?format=json|yaml`，按 `Content-Disposition` 文件名下载；导出的是 B3 已保存版本，不是编辑器未保存图。

## 6 状态与失败

- 初次加载：`#wl-loading`；失败：`#wl-error` + 重试，列表为空，不出现 MOCK 行。
- 搜索/筛选无结果：空态 + 清除条件。
- 400：优先展示 `details.issues` 文本；409 名称冲突/版本冲突分开；428 提示刷新；404 提示已删除；网络错误提示 BFF/B3 不可用。

## 7 数据依赖

只经 `workflow/data` 访问 B3 `/api/v1/workflows*`；专家下拉经 `API.list('expert')`。不再 import `MOCK`。
