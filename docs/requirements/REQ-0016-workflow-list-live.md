---
layer: requirements
module: workflow-list
status: delivered
updated: 2026-10-30
---

# REQ-0016 工作流列表同源接入（B3）

| 字段 | 内容 |
|---|---|
| ID | `REQ-0016` |
| 类型 | `feature` |
| 场景叙述 | 流程研发者进入工作流列表，通过同源 BFF 读取 B3 工作流，按类型/名称筛选并按更新时间排序；通过向导（名称/类型/描述 + 起止专家）或模板复制创建合法工作流，对已有工作流改名/改类型、复制、删除、导入/导出 DSL；列表只展示工作流域指标，不展示发布/版本/最近运行。 |
| 价值 | 没有同源列表，工作流只能停留在 MOCK 演示：无法真实创建、检索、复制或删除，也无法为编辑器提供真实 id；B3 的「创建必须带合法图」「严格拓扑/绑定」没有 UI 入口。 |
| 非目标 | 不做画布节点编辑（`REQ-0017`）；不做实例/运行/发布/版本；不做旧空图迁移（上线前清空）；不展示 `updatedBy`（等后端修 actor）；不做权限与多人协同。 |
| 约束 | 同源 BFF；写操作带 `If-Match`；创建必须提交合法图（start/end 绑专家）；无 MOCK 回落；列表页 live-only，后端不可用显式报错；桌面优先；无构建、无新增运行时依赖；模块按 ESM（`docs/history/works/2026-10-30-frontend-esm/`）。 |
| 影响场景 | `SCN-0018`（`design/scenarios/flow/workflow-list/browse-workflows-live/scenario.md`） |
| 澄清记录 | 2026-10-30 交互式评审：新建走「向导 + 模板复制」；旧图不迁移、可删除；列表只放工作流域指标、不展示更新人；列表与编辑器同轮 live；工作流数据层独立为 `workflow/data`。契约依据 `history/decisions/2026-10-30-frontend-esm.md` 与 B3 `2026-10-30-workflow-contract-boundary`。 |
| 状态 | `delivered`（2026-10-30；场景 `verified`） |
