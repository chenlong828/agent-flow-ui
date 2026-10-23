---
layer: requirements
module: workspaces
status: accepted
updated: 2026-10-23
---

# REQ-0010 工作区创建、配置与归档

| 字段 | 内容 |
|---|---|
| ID | `REQ-0010` |
| 类型 | `feature` |
| 场景叙述 | 流程设计者查看工作区列表，按三步向导绑定仓库、关联 Key 并做连接测试、选择目录模板，进入详情查看配置、归档历史或删除空闲工作区。 |
| 价值 | 没有工作区配置，节点之间唯一的共享信息通道无法准备，Agent 无法在隔离的仓库/worktree 中协作。 |
| 非目标 | 不做真实 git clone/worktree/目录初始化；连接测试为模拟，失败不阻断创建（已知偏差）；单目录模板；不做真实清理任务。 |
| 约束 | 纯前端静态原型；新建固定三步；步① 必填校验；归档只追加 `archives`；删除需二次确认；不新增依赖。 |
| 影响场景 | `SCN-0010`（`design/scenarios/workspace/workspace-config/configure-workspace/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/向导/详情/归档已存在；本次补 REQ/SCN，场景到 `designed`，未 `verified`。 |
| 状态 | `accepted` |
