---
layer: design
module: experts
component: CMP-experts
requirement: REQ-0006
scenario: SCN-0006
status: active
updated: 2026-11-22
---

# 专家管理

> 导航：资产与注册 / 专家管理　|　形态：卡片列表 + 详情抽屉　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0006` / `SCN-0006`（verified；Playwright 4 正 1 反）+ `REQ-0013` / `SCN-0013`（Skill 摘要读 `description`）+ `REQ-0030` / `SCN-0025`（点 Skill 行打开共享面板，可编辑并回填摘要）+ `REQ-0031` / `SCN-0026`（列表按工作流筛选）+ `REQ-0032` / `SCN-0006`（详情收敛两区、职责改 Markdown 编辑）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为工作流设计者提供可复用的智能体角色（人格与 Markdown 职责 + 有序 Skill 组合）；没有它，工作流节点无法指定执行者，「评审/审视视角」也没有承载实体。
- 负责 / 不负责：负责专家卡片列表（名称/角色搜索 + 启用状态筛选 + 按工作流筛选、`refCount` 展示）、新建专家弹窗、两区详情（① 角色描述 = Markdown 职责 + 性格；② Skill 组合）、Skill 装配、Skill 行打开共享 Skill 面板（查看/编辑/回填摘要）、启用/停用、删除；不负责 Skill 的定义（`CMP-skills`）、工作流节点上的专家绑定与评审要点（`CMP-workflow-editor`）、工具清单/参考知识/主要工作内容（后端已停用，UI 不再展示），也不负责 Markdown 编辑器的实现（统一走 `shared/markdown-editor.js`）。
- 内部逻辑：流程筛选先读 URL 的 `workflowId`（可重复），再经 `CMP-workflow-data.list` 取流程名；勾选弹窗允许空选（= 全部），应用后按 `workflowId`（可重复）重新请求专家列表，结果以服务端为准，页面不二次过滤；筛选写回 URL `?workflowId=`；卡片 `+N` 与「Skill ×N」均用 `skillCount`；详情弹窗固定 80vw × 90vh（`DF.modal.open({width:'80vw',height:'90vh'})`，页头页脚固定、两区内容在主体内滚动，查看/编辑同尺寸）；两区结构固定，`duty` 为 Markdown：查看态经 `shared/markdown.js` 渲染，编辑态经 `shared/markdown-editor.js` 挂载（重绘/关闭必须销毁实例）；装配顺序取详情 `skills[].id`；聚合 PATCH 只提交新结构；引用只读 `refCount`；启停/删除带 revision。
- 数据所有权：页面状态直接保存 B1 `ExpertListItem` / `ExpertDetail` DTO；列表 `GET /experts`（只含前 3 个 Skill 预览与 `skillCount/toolCount/refCount`）、详情 `GET /experts/{id}`（完整 Skill 摘要与 Markdown `duty`）、创建 `POST`、聚合更新 `PATCH`（只写 `name/color/role/persona/duty/skillIds`；`tools/refs/toolIds/skillOrder/verifyOrder/notes` 过渡期不再提交）、启停 `PATCH /enabled`、删除 `DELETE` 均经 `window.API`；流程筛选的候选流程只经 `CMP-workflow-data.list({limit:200})` 读 `id/name`，页面不直接请求 `/api/v1/workflows*`。不读 `MOCK`，不建第二套视图模型；抽屉编辑草稿由详情 DTO 派生，取消即丢弃。
- 公开契约：页面入口 `pages/experts.html`；操作 `CMP-experts#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail`、`#picker`、`#skill-open`、`#filter-workflow`；不变量 ①卡片 `+N` 与「Skill ×N」使用 `skillCount`，不用预览数组长度；②详情只有两区（① 角色描述 / ② Skill 组合），③④⑤ 不再渲染；职责 `duty` 按 Markdown 渲染与编辑，Skill 装配顺序取详情 `skills[].id`，Skill 摘要只读 `description`；③聚合保存 `PATCH /experts/{id}` 只提交 `name/color/role/persona/duty` 与有序 `skillIds`，不提交 `enabled/version`，也不提交已停用的 `tools/refs/toolIds/skillOrder/verifyOrder/notes`；④引用只显示 DTO `refCount`，B1 不提供引用方明细，不遍历 `MOCK.workflows`；⑤启停/删除带 revision，`If-Match` 由 API 层生成；⑥详情弹窗尺寸固定为视口 80% 宽 × 90% 高，页头页脚不得出视口，内容只在主体内滚动；⑦Skill 行（`data-sopen`）在查看态与编辑态都可点开 `CMP-skills` 的共享面板，关闭后必须回到原专家弹层且专家草稿不丢，Skill 保存后只回填该 Skill 的摘要字段；⑧流程筛选只在有选择时按同名参数发送 `workflowId`（多选取并集、不传即全部），流程列表失败只禁用筛选入口、不影响专家列表，空结果与搜索无结果文案区分，筛选条件写回 URL 且可清除。
- 依赖：`DF`（`renderShell`、`modal`、`toast`、`tag/chip/empty/field/icon/esc`）/ `window.API` / `SKPM`（`skill-panel-modal.js` 的 Skill 弹层宿主，仅 `#skill-open` 使用）/ `CMP-workflow-data`（`createWorkflowData().list`，仅流程筛选取流程名）/ `shared/markdown-editor.js`（职责编辑，经动态 import vendor）/ `shared/markdown.js`（职责查看只读渲染）；不依赖 `MOCK` 或其他页面组件。
- 冷热属性：冷（管理面同步请求，无 SLA）。
- 变化轴：Skill 组合与排序方式（当前有序列表 + 勾选弹窗）最可能演化为带权重/条件的能力编排；职责的四节结构可能演化出模板/校验。
- 验证入口：`npm start` + `/pages/experts.html`；`node tools/verify-m1-scenarios.js SCN-0006|SCN-0025|SCN-0026`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 验证计划：卡片/搜索/两区详情（含职责 Markdown 渲染与编辑回写）/停用/取消/弹窗尺寸→SCN-0006 T1-T5；Skill 行打开面板与回填→SCN-0025 T1-T4；流程筛选→SCN-0026 T1-T5；结构→`smoke-test`；真实 B1→`test:b1-pages/writes`。
- 预算：`experts.js` 约 35 KB + 本规格约 7 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/experts.html`。
- 删除测试：删除后无法注册与编辑智能体角色，工作流节点失去执行者来源，复杂度会集中到编辑器与实例页，故保留为独立组件。
- 已知偏差：后端过渡期仍返回 `skillOrder/verifyOrder/notes`（恒 `""`）与 `tools/refs`（恒 `[]`），页面已不展示也不提交，待后端清理残留列与端点；B1 没有工作流引用方接口，页面只显示 `refCount`；列表 Skill 预览最多 3 个，完整装配需打开详情；详情每次打开都重新 `GET`，不缓存旧装配；Skill 摘要字段为 `description`（契约 v2），不再读 `summary`。M1 SCN-0006 使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-pages.js` / `verify-b1-writes.js` 覆盖。

## 1 页面定位

固化专家模板（PPT P4/P8）：配置独立上下文执行的智能体角色——人格与 Markdown 职责 + 有序 Skill 组合；工具清单、参考知识与主要工作内容已并入职责或停用，不在界面展示。

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
│ │ Skill ×4      │ │ Skill ×2     │ │ Skill ×6      │               │
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
| 卡片 | Skill 数、引用数 | 数字 | Skill 数取 DTO `skillCount`；引用数取 DTO `refCount`，B1 无明细 |
| 卡片 | 状态开关 | switch | 停用需确认 |
| 卡片 | 详情 | 链接/按钮 | 打开详情抽屉 |

## 4 详情抽屉（五区，编辑态表单化）

| 区块 | 内容 | 交互 |
|---|---|---|
| ① 角色描述 | 职责范围、性格描述、关注视角 | 编辑态可改 |
| ② Skill 组合 | 有序列表：Skill 名 + 类别 + `description`；从 Skill 库多选、移除、上下移 | 保存为 `skillIds` 顺序 |
| ③ 工具清单 | 工具名 + 类型 + 状态；从工具库多选、移除 | 保存为 `toolIds` |
| ④ 主要工作内容 | `duty/skillOrder/verifyOrder/notes` | 折叠/编辑 |
| ⑤ 参考知识 | `refs[{label,refType,path}]` | 增删行 |

## 5 新建专家弹窗

名称（必填）、头像色、角色定位一句话（必填）→ `POST /experts` → 用返回 DTO 的 `id` 打开编辑态详情继续补全。

## 6 状态与空态

- 无专家：空态「注册第一位专家，组合 Skill 形成执行角色」
- 列表/详情加载中、错误可重试、空态
- 说明：**评审专家不是独立实体**——同一专家库，绑定到评审节点时承担独立否决视角。
- 删除确认：说明「被当前工作流或未结束的运行引用时不能删除」；409 `referenced` 且 `details.references` 含 `type="run"` 时提示「有未结束的运行」，保留详情与列表，不自动取消运行。

## 7 B1 数据契约

列表：`id,name,color,role,persona,enabled,skillCount,toolCount,refCount,skills[≤3]{id,name,description,...}`；详情另含 `duty,skillOrder,verifyOrder,notes,refs[]{label,refType,path},skills[],tools[],createdAt`。创建必填 `name,color,role`；聚合更新用 `skillIds/toolIds`，不提交 `enabled/version`；启停/删除必须带 `If-Match`（由 `window.API` 生成）。
