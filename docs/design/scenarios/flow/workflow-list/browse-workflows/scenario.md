---
layer: design
module: workflow-list
status: designed
flow: browse-workflows
scenario: SCN-0002
updated: 2026-10-23
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

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0002-T1 | 正 | 列表条目数、统计 total 与 `MOCK.workflows.length` 相等；默认视图为卡片视图 | 待补 |
| SCN-0002-T2 | 正 | 选择「专项子流程」后条目数等于该类型夹具数；搜索无匹配显示空态，清空后恢复 | 待补 |
| SCN-0002-T3 | 正 | 新建合法名称后 `MOCK.workflows` 增加 1 条且列表 total +1；复制生成含「副本」的草稿 | 待补 |
| SCN-0002-T4 | 反 | 删除被实例引用的工作流时确认框显示引用数；取消后条目数与引用关系不变 | 待补 |
