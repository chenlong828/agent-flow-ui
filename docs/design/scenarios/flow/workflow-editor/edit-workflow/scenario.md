---
layer: design
module: workflow-editor
status: verified
flow: edit-workflow
scenario: SCN-0003
updated: 2026-10-23
---

# SCN-0003 工作流画布编辑与校验

## 入口

- `CMP-workflow-editor/assets/js/pages/workflow-editor.js#init`
- `CMP-workflow-editor/pages/workflow-editor.html?id=<workflowId>`

## 运行序

1. 带 `?id=w1` 进入，画布按 `MOCK.workflows` 的 `graph.nodes/edges` 绘制节点与连线；缺省 id 回落到第一条。
2. 选中节点打开属性抽屉；修改名称/类型/专家绑定后，画布标签与 `MOCK.workflows` 内存对象同步。
3. 执行校验：孤立节点为 warn，评审缺回退目标、专家缺绑定的节点为 err；存在 err 时点击「发布」被拒绝并提示错误数。
4. 导出 DSL：JSON 含 `id/name/version/nodes/edges`；保存/发布只改内存。

失败路径：非法连线（重复回退边、目标不是前序节点）被拒绝并提示；未知 id 回落首条而不是空白页。

## 不可变引用

- `DF.zoomK` / `DF.zoomOnFixed` 的缩放语义与 `toGraph/clientDelta` 坐标换算。
- `MOCK.workflows` 的 graph 节点类型：开始、专家、评审、人工确认、fan-out、fan-in、结束。
- 页面入口 `pages/workflow-editor.html?id=` 与列表跳转约定。

## 测试

执行层：DOM（jsdom）+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-23，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0003-T1 | 正 | 未知 id 回落首条；画布节点数、连线数与 graph.nodes/edges 相等 | `tools/verify-m1-scenarios.js#SCN-0003-T1` |
| SCN-0003-T2 | 正 | n2 属性抽屉名称/专家与夹具一致，角色提示可见；改名后画布标签同步 | `tools/verify-m1-scenarios.js#SCN-0003-T2` |
| SCN-0003-T3 | 正 | 合法图校验通过；DSL 含工作流 id、nodes、edges，from 数=edges 数 | `tools/verify-m1-scenarios.js#SCN-0003-T3` |
| SCN-0003-T4 | 反 | 评审缺回退 + 专家缺绑定各产生 err；点击发布被拒且版本不变 | `tools/verify-m1-scenarios.js#SCN-0003-T4` |
