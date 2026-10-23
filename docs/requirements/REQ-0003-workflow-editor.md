---
layer: requirements
module: workflow-editor
status: accepted
updated: 2026-10-23
---

# REQ-0003 工作流画布编辑与校验

| 字段 | 内容 |
|---|---|
| ID | `REQ-0003` |
| 类型 | `feature` |
| 场景叙述 | 流程研发者从列表进入编辑器，拖入或选中节点、连线、在属性抽屉配置专家/评审/人工确认/fan-out，运行校验并导出 DSL。 |
| 价值 | 没有可视化编辑与校验，工作流只能停在静态条目，回退、并行网关与上下文收敛无处配置，也无法产出可评审的 DSL。 |
| 非目标 | 不做真实执行引擎与后端保存；不做多人协同；不做权限；保存/发布只改内存夹具，刷新复位。 |
| 约束 | 纯前端静态原型；坐标与缩放统一走 `toGraph` / `DF.zoomK`；校验错误未清零不得发布；不新增依赖。 |
| 影响场景 | `SCN-0003`（`design/scenarios/flow/workflow-editor/edit-workflow/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：编辑器与 6 类节点校验已存在；本次补 REQ/SCN，场景到 `designed`，未 `verified`。 |
| 状态 | `accepted` |
