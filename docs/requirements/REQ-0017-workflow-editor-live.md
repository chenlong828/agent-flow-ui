---
layer: requirements
module: workflow-editor
status: delivered
updated: 2026-10-30
---

# REQ-0017 工作流编辑器同源接入（B3）

| 字段 | 内容 |
|---|---|
| ID | `REQ-0017` |
| 类型 | `feature` |
| 场景叙述 | 流程研发者从列表进入编辑器，加载 B3 当前定义与 `layout/viewport`，编辑阶段、节点、有向边与专家绑定；本地校验镜像 B3 拓扑/绑定规则，非法元素红框、保存置灰；图合法时手动保存并携带 `If-Match`；离开前有未保存修改时警告；可导出 DSL；不再有发布/版本/运行入口。 |
| 价值 | 没有同源编辑器，工作流结构无法真实持久化：B3 的当前定义、乐观锁、拓扑/绑定错误、`graph.viewport` 都没有编辑入口；严格保存使「能存下来的都是可执行定义」这一契约无法在 UI 兑现。 |
| 非目标 | 不做自动保存、本地草稿、版本历史、发布/运行；不做多人协同/实时合并；不做执行配置（skills/harness/knowledge/tools/inputs）；不做旧图迁移；不把 `layout/viewport` 的字段语义交给后端校验。 |
| 约束 | 同源 BFF；写操作带 `If-Match`；只有合法图可保存；本地校验与服务端规则一致；`layout/viewport` 由前端按 `dsl.schema.json` 自校、后端透传；无 MOCK 回落；桌面优先；无构建、无新增运行时依赖；模块按 ESM（`docs/history/works/2026-10-30-frontend-esm/`）。 |
| 影响场景 | `SCN-0019`（`design/scenarios/flow/workflow-editor/edit-workflow-live/scenario.md`） |
| 澄清记录 | 2026-10-30 交互式评审：纯手动保存（取消自动保存/草稿）；保存置灰 + 问题元素红框 + 校验面板 + 图级阻断条；视口不算未保存修改、随保存提交；离开警告；移除发布/版本/运行；新建入口由列表向导/模板复制提供合法起点。契约依据 `history/decisions/2026-10-30-frontend-esm.md` 与 B3 `2026-10-30-workflow-contract-boundary`。 |
| 状态 | `delivered`（2026-10-30；场景 `verified`） |
