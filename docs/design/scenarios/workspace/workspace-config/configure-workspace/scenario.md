---
layer: design
module: workspaces
status: verified
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
3. 完成初始化后生成 `ws-new-*` 并写入 `df-new-workspace`（sessionStorage），状态「已初始化」；列表/详情下次加载通过 WSC 合并显示，详情展示仓库、分支、worktree 模板与目录树。
4. 清理归档只向 `archives` 追加记录；删除先确认，被实例引用的工作区删除入口禁用。

失败路径：缺名称/URL 前缀错误/缺分支不得进入步②；连接测试失败只提示、不阻断（已知偏差）；取消删除不写集合。

## 不可变引用

- `MOCK.workspaces` 的 `id/name/repo/branch/status/credId/worktreeTemplate/archives` 字段契约。
- `WSC` 的目录树、创建时间、`df-new-workspace` 一次性传递。
- 页面入口 `pages/workspaces.html` 与 `pages/workspace-detail.html?id=`。

## 测试

执行层：DOM（jsdom）+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-23，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0010-T1 | 正 | 行数与计数同源；3 个被引用工作区无删除入口；ws1 关联 Key、ws4 「未关联」 | `tools/verify-m1-scenarios.js#SCN-0010-T1` |
| SCN-0010-T2 | 正 | 缺名称、ftp:// URL 均提示且不前进；合法输入进入步② | `tools/verify-m1-scenarios.js#SCN-0010-T2` |
| SCN-0010-T3 | 正 | 三步完成后 df-new-workspace 为「已初始化」，allWorkspaces +1 | `tools/verify-m1-scenarios.js#SCN-0010-T3` |
| SCN-0010-T4 | 反 | 被引用工作区无删除入口；取消删除 ws4 后集合长度不变；清理归档只向 ws1.archives 追加 1 条 | `tools/verify-m1-scenarios.js#SCN-0010-T4` |
