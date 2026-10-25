---
layer: design
module: experts
component: CMP-experts
requirement: REQ-0006
scenario: SCN-0006
status: active
updated: 2026-10-25
---

# 专家管理

> 导航：资产与注册 / 专家管理　|　形态：卡片列表 + 详情抽屉　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0006` / `SCN-0006`（verified；DOM/jsdom 3 正 1 反）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为工作流设计者提供可复用的智能体角色（人格与职责 + Skill 组合 + 工具清单 + 参考知识）；没有它，工作流节点无法指定执行者，「评审/审视视角」也没有承载实体。
- 负责 / 不负责：负责专家卡片列表（名称/角色搜索 + 启用状态筛选、`refCount` 展示）、新建专家弹窗、五区详情抽屉（只读与编辑态）、Skill/工具装配、启用/停用、删除；不负责 Skill 与工具自身的定义（`CMP-skills` / `CMP-tools`）、工作流节点上的专家绑定与评审要点（`CMP-workflow-editor`）。
- 数据所有权：页面状态直接保存 B1 `ExpertListItem` / `ExpertDetail` DTO；列表 `GET /experts`（只含前 3 个 Skill 预览与 `skillCount/toolCount/refCount`）、详情 `GET /experts/{id}`（完整 Skill/工具摘要）、创建 `POST`、聚合更新 `PATCH`、启停 `PATCH /enabled`、删除 `DELETE` 均经 `window.API`。不读 `MOCK`，不建第二套视图模型；抽屉编辑草稿由详情 DTO 派生，取消即丢弃。
- 公开契约：页面入口 `pages/experts.html`；操作 `CMP-experts#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail`、`#picker`；不变量 ①卡片 `+N` 使用 `skillCount`，不用预览数组长度；②详情五区结构固定，Skill/工具装配顺序取详情 `skills[].id` / `tools[].id`；③聚合保存 `PATCH /experts/{id}` 提交 `name/color/role/persona/duty/skillOrder/verifyOrder/notes/refs` 与有序 `skillIds/toolIds`，不提交 `enabled/version`；④引用只显示 DTO `refCount`，B1 不提供引用方明细，不遍历 `MOCK.workflows`；⑤启停/删除带 revision，`If-Match` 由 API 层生成。
- 依赖：`DF`（`renderShell`、`modal`、`toast`、`tag/chip/empty/field/icon/esc`）/ `window.API`；不依赖 `MOCK` 或其他页面组件。
- 变化轴：Skill/工具的组合与排序方式（当前有序列表 + 勾选弹窗）最可能演化为带权重/条件的能力编排。
- 验证入口：`npm start` + `/pages/experts.html`；`node tools/verify-m1-scenarios.js SCN-0006`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 预算：`experts.js` 约 28 KB + 本规格约 4 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/experts.html`。
- 删除测试：删除后无法注册与编辑智能体角色，工作流节点失去执行者来源，复杂度会集中到编辑器与实例页，故保留为独立组件。
- 已知偏差：B1 没有工作流引用方接口，页面只显示 `refCount`；列表 Skill 预览最多 3 个，完整装配需打开详情；详情每次打开都重新 `GET`，不缓存旧装配。M1 SCN-0006 使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-pages.js` / `verify-b1-writes.js` 覆盖。

## 1 页面定位

固化专家模板（PPT P4/P8）：配置独立上下文执行的智能体角色——人格与职责 + Skill 组合 + 工具清单 + 参考知识。

## 2 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 专家管理  注册并管理执行智能体角色                  [🔍] [状态▾] [+ 新建专家] │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│ │ ● 需求分析专家 │ │ ● 评审专家    │ │ ● 代码审视专家 │               │
│ │ 厘清真实需求… │ │ 独立否决视角… │ │ AB交叉…      │               │
│ │ [严谨][刨根问底]│ │[否决视角][独立]│ │[挑剔][规范控] │               │
│ │ Skill: CRES…+3│ │ Skill: 审视…+2│ │ Skill: Lint…+2│              │
│ │ 工具 ×4       │ │ 工具 ×2      │ │ 工具 ×6       │               │
│ │ 引用 3 处      │ │ 引用 4 处     │ │ 引用 2 处      │               │
│ │ [启用 ⬤]  详情 │ │ [启用 ⬤] 详情 │ │ [启用 ⬤] 详情 │               │
│ └──────────────┘ └──────────────┘ └──────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

## 3 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 页头 | 新建专家 | 主按钮 | 打开新建弹窗 |
| 筛选 | 搜索 / 状态下拉 | 输入 | 按名称、启用状态 |
| 卡片 | 色块头像 + 姓名 | — | 头像色为专家标识色 |
| 卡片 | 角色定位一句话 | 文字截断 | 如「厘清客户真实需求并成体系展开」 |
| 卡片 | 性格标签 | chips | 如 严谨 / 否决视角 |
| 卡片 | Skill 组合预览 | chips（前 3 + N） | `N = skillCount - 3` |
| 卡片 | 工具数、引用数 | 数字 | 引用数取 DTO `refCount`，B1 无明细 |
| 卡片 | 状态开关 | switch | 停用需确认 |
| 卡片 | 详情 | 链接/按钮 | 打开详情抽屉 |

## 4 详情抽屉（五区，编辑态表单化）

| 区块 | 内容 | 交互 |
|---|---|---|
| ① 角色描述 | 职责范围、性格描述、关注视角 | 编辑态可改 |
| ② Skill 组合 | 有序列表：Skill 名 + 类别 + 摘要；从 Skill 库多选、移除、上下移 | 保存为 `skillIds` 顺序 |
| ③ 工具清单 | 工具名 + 类型 + 状态；从工具库多选、移除 | 保存为 `toolIds` |
| ④ 主要工作内容 | `duty/skillOrder/verifyOrder/notes` | 折叠/编辑 |
| ⑤ 参考知识 | `refs[{label,refType,path}]` | 增删行 |

## 5 新建专家弹窗

名称（必填）、头像色、角色定位一句话（必填）→ `POST /experts` → 用返回 DTO 的 `id` 打开编辑态详情继续补全。

## 6 状态与空态

- 无专家：空态「注册第一位专家，组合 Skill 形成执行角色」
- 列表/详情加载中、错误可重试、空态
- 说明：**评审专家不是独立实体**——同一专家库，绑定到评审节点时承担独立否决视角。

## 7 B1 数据契约

列表：`id,name,color,role,persona,enabled,skillCount,toolCount,refCount,skills[≤3]{id,name,...}`；详情另含 `duty,skillOrder,verifyOrder,notes,refs[]{label,refType,path},skills[],tools[],createdAt`。创建必填 `name,color,role`；聚合更新用 `skillIds/toolIds`，不提交 `enabled/version`；启停/删除必须带 `If-Match`（由 `window.API` 生成）。
