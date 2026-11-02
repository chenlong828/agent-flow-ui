---
layer: design
module: workflow-editor
component: CMP-workflow-editor
requirement: REQ-0017
scenario: SCN-0019
status: active
updated: 2026-10-30
---

# 工作流编辑器（B3 live）

> 导航：流程研发 / 工作流 → 编辑器　|　形态：画布 + 属性抽屉 + DSL　|　前置：`design/components/ui-shell/spec.md`、`design/components/workflow-data/spec.md`

## 0 模块卡

> 追溯：`REQ-0017` / `SCN-0019`（verified；Playwright 11/11）。

- 状态：active（2026-10-30 从 MOCK 原型切到 B3 live）
- 单元 / 层：组件 / L2 页面组件
- 业务价值：让 B3 当前工作流定义可被真实编辑与持久化；没有它，`stages/nodes/edges`、`layout/viewport`、专家绑定与乐观锁都没有 UI 入口。
- 负责 / 不负责：负责加载详情、画布/阶段/节点/边编辑、专家绑定、本地校验与阻断、手动保存、DSL 只读预览/复制/导出；不负责新建（列表向导/复制）、导入（列表页）、列表检索、运行/发布/版本（明确不做）。
- 内部逻辑：B3 图 → `toEditorGraph`（layout→x/y/box，viewport 归一）；编辑只改视图模型；`validateEditorGraph` 实时产出 errors/warnings；保存时 `toB3Graph`（box→layout）并 `PUT /definition` 带 `If-Match`；名称/类型/描述变更先 `PUT /workflows/{id}`，再用新 revision 保存图；视口平移/缩放不算 dirty，保存时随图提交。
- 数据所有权：B3 `WorkflowDefinition` 的唯一编辑写入口（经 `workflow/data`）；页面只持有当前详情、编辑器图、selection/dirty 等内存态；不写 localStorage、不写 `MOCK`。
- 公开契约：入口 `pages/workflow-editor.html?id=<uuid>`；操作 `#open`、`#add-node`、`#connect-edge`、`#inspector`、`#validate`、`#save`、`#dsl`；不变量：非法图保存按钮置灰、问题元素红框、图级阻断条；写操作必须带 `If-Match`；409/428 不覆盖当前编辑；缺 id/404 显式报错，不回落第一条。
- 依赖：`DF`（外壳、抽屉、弹窗、Toast、下载）、`API`（仅专家列表）、`workflow/model`、`workflow/validate`、`workflow/data`、`workflow/views/{canvas,inspector,dsl}`；不依赖列表页 JS；跨页只走 URL。
- 冷热属性：冷；单详情加载 + 用户编辑，无轮询。
- 变化轴：节点类型/边类型/校验矩阵；`layout/viewport` 结构变化集中在 `model`；三块视图分别演进。
- 验证入口：`node tools/verify-workflow-editor.js`（SCN-0019，11/11）；`npm run test:workflow`；真实 B3 只读走查 `/pages/workflow-editor.html?id=<真实 id>`。
- 验证计划：T1 加载/layout/viewport/未知 id；T2 编辑与保存（含元数据、If-Match、layout/viewport）；T3 非法图阻断与服务端 400 回填；T4 409/428、离开警告、无发布/版本/运行。
- 预算：页面编排约 28 KB + 三视图约 7 KB + 本规格；远低于 120k token。
- 单独运行：`npm start` → `/pages/workflow-editor.html?id=<workflowId>`。
- 删除测试：删除后工作流只能被创建/删除，不能改结构、校验或导出 DSL，编排能力整体消失；故保留独立页面。
- 已知偏差：元数据与图是两次 PUT，非原子；元数据成功、图失败时列表名称已变、图未变（页面保留编辑态并提示）。无自动保存/草稿/版本历史/发布/运行。现有 B3 测试数据需确认后清理。

## 1 页面定位

以画布维护「阶段 + 节点 + 有向边」结构，节点绑定专家；评审/确认节点可发回退边；fanout/fanin 表示并行。右栏编辑属性，底部显示校验问题；DSL 只读。

## 2 布局

```
┌ [名称输入] 已保存·rN [画布|DSL] [校验] [保存] ┐
│ 节点面板 │ 画布（阶段框/连线/节点/缩放） │ 属性抽屉（选中时） │
│          │ 校验面板（错误/警告）          │                    │
└───────────────────────────────────────────────────────────────┘
```

## 3 编辑与约束

- 节点类型：`start|end|agent|review|confirm|fanout|fanin`；边：`seq|rollback`；ID 由 `model.newId` 生成，符合 B3 规则。
- `start/end/agent/review/fanout/fanin` 必须绑定专家；`confirm` 禁止绑定专家；`fanout` 唯一指向一个 `fanin`，`fanin` 唯一来自 `fanout`；回退只能从 review/confirm 指向 seq 祖先且不能指向 end。
- 顺序边每个节点最多一进一出；拖出边会替换同源/同目标的旧 seq；回退边每个源最多一条。
- 保存前本地校验 errors 必须为 0；服务端 400 的 `details.issues` 回填到面板/红框，并保留编辑态。

## 4 保存与并发

- 名称/类型/描述有变更：先 `PUT /workflows/{id}`（`If-Match` 当前 revision），成功后用返回 revision 再 `PUT /definition`。
- 图保存：`PUT /workflows/{id}/definition`，body `{graph}`，`If-Match` 当前 revision；成功清 dirty、刷新 revision/warnings。
- 409：提示刷新/版本冲突，不覆盖；428：提示缺少版本条件；404：提示已删除。
- 视口/布局：pan/zoom 只改本地 viewport，不置 dirty；保存时提交当前 viewport 与节点/阶段 layout。

## 5 DSL

- 只读预览由本地编辑图生成（`toDsl`），不提交；导出 JSON/YAML 走 B3 已保存版本；不提供导入（列表页负责）。

## 6 离开与禁止入口

- `beforeunload` 与页内链接在 dirty 时二次确认；无 dirty 直接离开。
- 无发布、版本历史、运行、更新人入口；不 import `MOCK`。

## 7 数据依赖

B3 详情/定义/校验/导出全部经 `workflow/data`；专家列表经 `API`。页面不直接 `fetch /api/v1/workflows*`。
