---
layer: design
module: workspaces
status: designed
flow: configure-workspace
scenario: SCN-0010
updated: 2026-10-23
---

# SCN-0010 工作区创建、配置与归档

## 入口

- `CMP-workspaces/assets/js/pages/workspaces.js#render`
- `CMP-workspaces/assets/js/pages/workspace-detail.js#init`
- `CMP-workspaces/pages/workspaces.html`、`pages/workspace-detail.html?id=<workspaceId>`

## 运行序

1. 列表渲染工作区名称、仓库/分支、状态、关联 Key 与最近使用；行数与 `MOCK.workspaces` 同源。
2. 新建向导固定三步：仓库绑定（名称/描述/URL/分支必填）→ 关联 Key 与连接测试 → 目录模板；步① 校验不通过不能前进。
3. 完成初始化后新增工作区并写 `MOCK.workspaces`，状态「已初始化」；详情显示仓库、分支、worktree 模板、目录树与归档历史。
4. 归档只追加 `archives`；删除先确认，被实例引用的工作区删除入口禁用。

失败路径：缺名称/URL 前缀错误/缺分支不得进入步②；连接测试失败只提示、不阻断（已知偏差）；取消删除不写集合。

## 不可变引用

- `MOCK.workspaces` 的 `id/name/repo/branch/status/credId/worktreeTemplate/archives` 字段契约。
- `WSC` 的目录树、创建时间、`df-new-workspace` 一次性传递。
- 页面入口 `pages/workspaces.html` 与 `pages/workspace-detail.html?id=`。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0010-T1 | 正 | 列表行数与 `MOCK.workspaces.length` 相等；状态/关联 Key 展示与夹具一致 | 待补 |
| SCN-0010-T2 | 正 | 步① 缺名称或非法 URL 前缀时提示且不前进；合法输入进入步② | 待补 |
| SCN-0010-T3 | 正 | 完成三步后 `MOCK.workspaces` 增加 1 条「已初始化」记录；详情显示仓库/分支/Key | 待补 |
| SCN-0010-T4 | 反 | 被实例引用的工作区删除入口禁用；取消删除后集合长度与归档历史不变 | 待补 |
