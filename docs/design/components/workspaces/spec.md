---
layer: design
module: workspaces
component: CMP-workspaces
status: active
updated: 2026-10-23
---

# 工作区配置

> 导航：基础配置 / 工作区配置　|　形态：列表 + 独立详情二级页　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

- 状态：active
- 单元 / 层：组件 / L2 页面组件（列表 + 详情两个页面入口）
- 业务价值：为流程设计者提供工作区的仓库绑定、worktree 策略、目录模板、凭证关联与归档清理；没有它，节点之间唯一的共享信息通道（Workspace）无法准备，Agent 只能各自为战。
- 负责 / 不负责：负责工作区列表（状态/分支/最近使用）、三步新建向导、详情页（仓库与分支、worktree 隔离策略、目录模板、关联 Key、连通性校验、归档/清理）、删除确认；不负责真实 git 操作与远端克隆、Key 的定义与校验（`CMP-keys`）、节点运行期对工作区的读写（编排引擎/`CMP-instances`）、外壳（`CMP-ui-shell`）。
- 数据所有权：读 `MOCK.workspaces`、`MOCK.keys`（关联凭证）；写 `MOCK.workspaces`（新建 `push`、删除 `splice`、归档 `archives.unshift`、详情字段编辑，仅内存态，刷新复位）；sessionStorage `df-new-workspace` 由 `WSC` 在列表与详情间一次性传递；无第二写入口说明：`MOCK.workspaces` 仅本组件写，`workflow-editor` / `instance-detail` / `keys` 等只读。
- 公开契约：页面入口 `pages/workspaces.html` 与 `pages/workspace-detail.html?id=<workspaceId>`；操作 `CMP-workspaces#list`、`#create`（三步向导）、`#detail`、`#check-connection`、`#archive`、`#delete`；不变量 新建固定三步顺序「仓库绑定 → 关联 Key/连接测试 → 目录模板」，步① 的名称/仓库 URL 前缀/分支校验不通过不能前进；连接测试失败只提示、不阻断「完成并初始化」（已知偏差）；详情页只展示已绑定的 Key，不展示未关联凭证；归档只追加 `archives` 记录，不删除工作区；删除必须二次确认。
- 依赖：`DF`（外壳、向导弹窗、表格、Tabs、Toast）/ `MOCK` / `WSC`（`workspace-common.js` 的目录树、创建时间、跨页联动）；不依赖其他页面组件。
- 变化轴：仓库/worktree 策略与目录模板最易变，新增策略须同步新建向导、详情页与 `WSC` 展示。
- 验证入口：`npm start` + `/pages/workspaces.html`、`/pages/workspace-detail.html?id=ws1`；`node tools/smoke-test.js`（12 页冒烟，含两页）；legacy-smoke（M1 基线无 SCN，仅页面加载期断言）。
- 预算：`workspaces.js` 约 13 KB + `workspace-detail.js` 约 8 KB + `workspace-common.js` 约 2.5 KB + 本规格约 7 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/workspaces.html`（详情页用 `?id=` 定位；两页共用 `WSC`）。
- 删除测试：删除后工作区无法准备、绑定与清理，节点失去唯一共享通道；复杂度会集中到实例页与 Key 页，故保留为独立组件。
- 已知偏差：M1 原型基线、无 REQ 追溯（无对应 SCN）；仅冒烟；git 克隆/连通性/目录初始化均为模拟；步骤② 无 `validate`，连接测试失败仍可进入步骤③ 并创建「已初始化」工作区；目录模板为单模板；`df-new-workspace` 为一次性传递，刷新丢失；`WSC` 被两个页面共用，改它需同时回归列表与详情。

## 1 页面定位

统一工作区的准备与配置（PPT P8：git/共享文件管理，节点间唯一信息通道）：仓库绑定、worktree 隔离策略、目录模板初始化、凭证关联、清理归档。

## 2 列表页

### 2.1 布局

```
┌──────────────────────────────────────────────────────────────────┐
│ 工作区配置                                   [+ 新建工作区]         │
│ 状态[全部▾]  [🔍搜索]                                              │
├──────────────────────────────────────────────────────────────────┤
│ 名称        git 仓库地址                    分支    凭证      状态      容量  引用实例 操作 │
│ trading-core git@igit:fin/trading-core.git  master  deploy-key● 已初始化 1.2G 3   详情 ⋮ │
│ ldp-front   git@igit:ldp/front.git          develop ci-key○    校验失败 860M 1   详情 ⋮ │
│ …                                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 元素

| 元素 | 说明 |
|---|---|
| 筛选 | 状态（已初始化/校验失败/未初始化）+ 搜索 |
| 表格 | 名称（点击进详情页）、仓库地址（等宽）、默认分支、关联凭证（状态点）、状态、容量、被引用实例数、最近活动、操作（详情/编辑/删除，被引用时禁删） |

## 3 新建向导弹窗（3 步）

| 步骤 | 字段 | 交互 |
|---|---|---|
| ① 仓库信息 | 名称✓、描述、git 仓库 URL✓、默认分支✓ | 下一步 |
| ② 凭证与校验 | 关联 ssh-key（下拉，来自 Key 页） | [连接测试] 模拟成功/失败；失败提示更换凭证 |
| ③ 目录模板 | 模板勾选（默认「标准研发工作区」）+ 目录树预览 | 完成 → 初始化进度模拟 → 状态=已初始化 |

## 4 详情页（独立二级页，R4）

```
┌──────────────────────────────────────────────────────────────────┐
│ ← 返回 │ trading-core │ [已初始化]        [重新校验] [立即清理]     │
├──────────────────────────────────────────────────────────────────┤
│ ① 基本信息   仓库/默认分支/描述/创建时间/创建人                       │
│ ② 分支与 Worktree 策略                                            │
│    主工作区分支 master │ 子任务 worktree 命名模板 task/{instanceId}/{seq} │
│    自动清理 ⬤ 保留 7 天                                            │
│ ③ 目录结构（初始化模板，只读树）        ④ 访问凭证                    │
│    Agents.md            总纲        │  deploy-key · SHA256:ab:…:3f2a │
│    knowledge/           知识库索引    │  最后校验 2h前 [重新校验]        │
│    experts/ experts.md  专家库目录    ├────────────────────────────┤
│    skills/              Skill 库目录  │ ⑤ 清理与归档                  │
│    tasks/2025-*/        并行任务目录  │  策略：结束保留7天后归档         │
│                                       │  归档记录表（实例/大小/时间）    │
└──────────────────────────────────────────────────────────────────┘
```

| 区块 | 内容 | 交互 |
|---|---|---|
| ① 基本信息 | 只读展示 + 编辑入口 | — |
| ② 分支与 Worktree 策略 | 主分支、子任务 worktree 命名模板（输入框，变量提示 `{instanceId}/{seq}`）、自动清理开关 + 保留天数 | 保存提示「对新实例生效」 |
| ③ 目录结构 | 只读目录树 + 每项说明（Agents.md 总纲 / 知识库索引 / 专家库 / Skill 库 / 按任务划分的并行工作目录） | [重新初始化模板] 二次确认（不删除任务数据） |
| ④ 访问凭证 | 关联 key、指纹掩码、最后校验时间 | [重新校验] 模拟结果 |
| ⑤ 清理与归档 | 归档策略（结束保留 N 天）、归档记录表（实例/大小/归档时间）、[立即清理] 二次确认 | — |

## 5 状态与空态

- 无工作区：空态「准备工作区，作为所有节点交互的唯一信息通道」
- 校验失败：状态红 + 详情页顶部警示条（指引到凭证区块）

## 6 模拟数据依赖

`MOCK.workspaces[]`：4 个，字段 `{id,name,repoUrl,branch,worktreeTemplate,autoClean,retainDays,template,credentialId,credStatus,status,size,usedByInstances,archives[],lastActivity}`。
