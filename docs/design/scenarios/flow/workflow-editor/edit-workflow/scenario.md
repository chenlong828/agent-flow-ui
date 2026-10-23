---
layer: design
module: workflow-editor
status: designed
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
3. 执行校验：孤立节点为 warn，评审缺回退目标、专家缺绑定的节点为 err；err 未清零时「发布」不可用。
4. 导出 DSL：JSON 含 `id/name/ver/nodes/edges`，可复制；保存/发布只改内存。

失败路径：非法连线（重复回退边、目标不是前序节点）被拒绝并提示；未知 id 回落首条而不是空白页。

## 不可变引用

- `DF.zoomK` / `DF.zoomOnFixed` 的缩放语义与 `toGraph/clientDelta` 坐标换算。
- `MOCK.workflows` 的 graph 节点类型：开始、专家、评审、人工确认、fan-out、fan-in、结束。
- 页面入口 `pages/workflow-editor.html?id=` 与列表跳转约定。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0003-T1 | 正 | `?id=w1` 画布节点数、连线数与夹具 `graph.nodes/edges` 相等；未知 id 回落首条 | 待补 |
| SCN-0003-T2 | 正 | 点击专家节点打开属性抽屉，名称/角色/绑定字段与夹具一致；改名后画布标签同步 | 待补 |
| SCN-0003-T3 | 正 | 合法图校验 err=0；导出 DSL 含 `nodes`、`edges` 与工作流 id，复制内容与预览一致 | 待补 |
| SCN-0003-T4 | 反 | 评审节点缺回退目标或专家节点缺专家绑定时校验产生 err，发布按钮不可用 | 待补 |
