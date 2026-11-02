---
layer: history
module: workflow-list
status: frozen
flow: browse-workflows
scenario: SCN-0002
updated: 2026-10-30
---

# SCN-0002 工作流列表浏览与生命周期入口

## 入口

- `CMP-workflow-list/assets/js/pages/workflow-list.js#render`
- `CMP-workflow-list/pages/workflow-list.html#page-body`

## 运行序

1. `DF.renderShell` 完成后渲染统计条与默认卡片视图；统计项的 total 与 `MOCK.workflows.length` 一致。
2. 类型 Tab 与名称搜索组合过滤列表；无匹配时显示 `DF.empty`，清空搜索后恢复全量。
3. 新建/复制打开弹窗并写 `MOCK.workflows`；删除先 `DF.modal.confirm` 并显示实例引用数；导出 DSL 走 `DF.download`。
4. 「发起运行」打开弹窗，选择工作区后 Toast 并跳 `instances.html`；原型不创建真实实例。

失败路径：删除取消、新建名称为空、运行弹窗未选工作区时不得写 `MOCK.workflows`；错误以 Toast 或字段错误呈现。

## 不可变引用

- `MOCK.workflows` 的 `id/name/type/ver/nodeCount/stageCount/updatedM` 字段契约。
- `DF.renderShell`、`DF.modal`、`DF.toast`、`DF.download` 的公共语义。
- 页面入口 `pages/workflow-list.html` 与编辑器入口 `pages/workflow-editor.html?id=`。

## 测试

执行层：Playwright WebKit+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-30，已由 SCN-0018/0019 取代；历史断言不再进入现行 runner。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0002-T1 | 正 | 列表卡片数、统计「共 n」与 MOCK.workflows.length 一致，默认卡片视图 | `tools/verify-m1-scenarios.js#SCN-0002-T1` |
| SCN-0002-T2 | 正 | 选择「专项子流程」后条目数=夹具子集；搜索不存在名称显示空态；改搜「需求」恢复 1 条 | `tools/verify-m1-scenarios.js#SCN-0002-T2` |
| SCN-0002-T3 | 正 | 新建合法名称后 MOCK.workflows +1、跳转编辑器并显示新名称与 start/end 两节点；复制 w1 生成含「副本」的草稿再 +1 | `tools/verify-m1-scenarios.js#SCN-0002-T3` |
| SCN-0002-T4 | 反 | 删除被 3 个实例引用的 w1 时确认框显示引用数；取消后条目与实例引用不变 | `tools/verify-m1-scenarios.js#SCN-0002-T4` |
