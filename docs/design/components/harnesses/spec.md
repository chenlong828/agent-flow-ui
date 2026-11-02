---
layer: design
module: harnesses
component: CMP-harnesses
requirement: REQ-0007
scenario: SCN-0007
status: active
updated: 2026-10-28
---

# Harness 管理

> 导航：资产与注册 / Harness 管理　|　形态：列表 + 详情抽屉　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0007` / `SCN-0007`（verified；Playwright 3 正 1 反）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为平台运维者提供执行设施（Agent 实际运行处）的注册、健康与配额管理；没有它，节点「按标签自动」调度无池可调，工作流只能绑死在单一设施上。
- 负责 / 不负责：负责 Harness 列表（统计卡 + 表格）、详情抽屉、注册弹窗、抽屉编辑保存、启停与删除；不负责节点图的 Harness 选择与标签匹配（`CMP-workflow-editor`）、运行任务的实际调度（`CMP-instances`）、工具绑定（`CMP-tools`）、密钥绑定（`CMP-keys`）、外壳与公共组件（`CMP-ui-shell`）。
- 内部逻辑：在线=`enabled && health==='online'`、离线=`health==='offline'`、停用=`!enabled`；创建必填六字段且并发为正整数；更新不提交 enabled；删除二次确认带 revision；被引用 409。
- 数据所有权：页面状态直接保存 B1 `HarnessListItem` / `HarnessDetail` DTO；列表 `GET /harnesses`、详情 `GET /harnesses/{id}`、创建 `POST`、更新 `PUT`、启停 `PATCH /enabled`、删除 `DELETE` 均经 `window.API`；不读 `MOCK`，不建第二套视图模型。写成功后用响应 DTO 更新本地列表；`If-Match` 由 API 层从 revision 派生。B1 没有当前任务数、任务列表与心跳历史，页面不展示这些运行时字段。
- 公开契约：页面入口 `pages/harnesses.html`；操作 `CMP-harnesses#list`、`#register`、`#detail`、`#edit`、`#toggle`、`#delete`；不变量 ①统计卡与表格行同源：在线=`enabled && health==='online'`，离线=`health==='offline'`，停用=`!enabled`，总数取 `page.total`；②创建必填 `name/kind/address/accessMode/concurrencyMax/queuePolicy`，并发上限为正整数；③更新 `PUT` 全量字段但不提交 `enabled`，启停单独 `PATCH`，删除经二次确认并带 revision；被引用设施的删除由 B1 返回 409 `referenced`，页面提示后保留数据。
- 依赖：`DF`（`renderShell`、`drawer.open`、`modal.form/confirm`、`table/empty/statRow/statCard`、`tag/dot/icon/esc`、`relTime`、`toast`）/ `window.API`；不依赖 `MOCK` 或其他页面组件。
- 冷热属性：冷（管理面；健康状态由 B1 返回，不做本地探测）。
- 变化轴：B1 健康/心跳字段与引用规则（当前 `health`、`lastHeartbeatAt`、`toolCount` 由 DTO 提供）。
- 验证入口：`npm start` + `/pages/harnesses.html`；`node tools/verify-m1-scenarios.js SCN-0007`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 验证计划：表格/注册/停用/取消→SCN-0007 T1-T4；结构→`smoke-test`；真实 B1→`test:b1-pages/writes`。
- 预算：`harnesses.js` 约 23 KB + 本规格约 4 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/harnesses.html`。
- 删除测试：删除后执行设施无法注册、查看、启停与删除，调度池失去管理入口，故保留为独立组件。
- 已知偏差：B1 不提供当前任务数/任务列表/心跳历史，相关假数据与「连接测试」已移除；`health` 与 `lastHeartbeatAt` 由 B1 返回，未做本地探测；M1 SCN-0007 使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-pages.js` / `verify-b1-writes.js` 覆盖。

## 1 页面定位

执行设施池注册与管理（PPT P5 四类 Harness）：Agent 实际运行处，承载能力标签、健康状态与并发配额，供节点按标签调度。

## 2 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ Harness 管理  执行设施注册与健康                     [+ 注册 Harness] │
├──────────────────────────────────────────────────────────────────┤
│ [总数 5] [在线 3] [离线 1] [停用 1]                               │
├──────────────────────────────────────────────────────────────────┤
│ 名称        类型     接入地址            能力标签     健康   最近心跳  并发上限  操作 │
│ ● build-01  容器     10.0.4.11:7801    [CICD][构建]  在线   5 分钟前  20     详情 编辑 停用 删除 │
│ ○ dev-lap   笔记本   192.168.1.8:7801  [调试]       离线   2 小时前  5      详情 编辑 启用 删除 │
└──────────────────────────────────────────────────────────────────┘
```

## 3 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 统计卡 | 总数/在线/离线/停用 | 卡片 | 由 DTO 的 `enabled` 与 `health` 计算 |
| 表格 | 名称 + 状态点 | — | 点击名称打开详情抽屉 |
| 表格 | 类型 | 图标+文字 | `container/server/desktop/laptop` 映射为容器/服务器/台式机/笔记本 |
| 表格 | 接入地址、接入方式 | 等宽文字 | 接入方式：`agent/ssh/container_registry` |
| 表格 | 能力标签 | chips | 调度匹配依据 |
| 表格 | 健康 | 状态点+文字 | `online/offline/overloaded/unknown` |
| 表格 | 最近心跳、并发上限 | 时间/数字 | `lastHeartbeatAt` 相对时间；`concurrencyMax` |
| 表格 | 操作 | 按钮组 | 详情、编辑、启用/停用、删除 |

## 4 详情抽屉

| 区块 | 内容 | 交互 |
|---|---|---|
| 基本信息 | 名称/类型/地址/接入方式/注册时间/描述 | 编辑态可改 |
| 能力标签 | chips 增删（预置 + 自定义） | 保存后影响调度 |
| 配额 | 并发上限、排队策略（fifo/priority） | 编辑态可改 |
| 运行信息 | 健康、最近心跳、工具数 | 只读；B1 未提供任务/心跳历史 |

## 5 注册弹窗

名称、类型（四选一）、接入地址、接入方式、能力标签、并发上限、排队策略、描述 → 确定后 `POST /harnesses`，成功刷新列表。B1 未提供连接测试端点，页面不提供该按钮。

## 6 状态与空态

- 无设施：空态「注册第一台 Harness，Agent 将在此执行任务」
- 加载中、加载失败（可重试）、离线设施行置灰

## 7 B1 数据契约

列表/详情字段：`id,name,kind,address,accessMode,description,concurrencyMax,queuePolicy,tags,enabled,health,lastHeartbeatAt,toolCount,revision,createdAt,updatedAt`。创建/更新 body 不提交 `enabled`；启停与删除必须带 `If-Match`（由 `window.API` 生成）。
