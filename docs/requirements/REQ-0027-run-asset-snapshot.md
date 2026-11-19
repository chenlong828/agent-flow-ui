---
layer: requirements
module: instances
status: delivered
updated: 2026-11-18
---

# REQ-0027 资产删除后的运行快照展示

| 字段 | 内容 |
|---|---|
| ID | `REQ-0027` |
| 类型 | `feature` |
| 场景叙述 | 工作流、专家或 Harness 在运行结束后可以被删除；删除后，运行列表与详情仍显示启动时冻结的工作流名、Harness 名、工作流图和节点专家名。运行详情直接使用 `RunDetail.graph` 画图，不再因 `GET /workflows/{id}` 返回 404 而失败；节点弹层优先显示 `RunNodeView.expertName`，专家已删除时不出现裸 UUID。删除资产时，确认框说明未结束的运行会阻止删除；收到 409 `referenced` 且 `details.references` 含 `type="run"` 时提示有未结束的运行。 |
| 价值 | 资产是可变配置，运行是历史事实。资产删除后如果运行页仍依赖实时资产接口，历史运行会 404、画布空白或显示裸 ID，用户无法回看执行过程；删除提示不说明运行引用，用户也无法理解 409 的原因。 |
| 非目标 | 不新增页面、不改 BFF 转发、不做资产删除时的自动取消/结束运行；不迁移历史数据；不改变工作流/专家/Harness 的删除 API；不把运行快照反向写回资产。 |
| 约束 | `RunDetail.graph` 与 `GET /workflows/{id}` 的 `graph` 同形，继续用 `toEditorGraph`；`run.graph` 缺失时回退 `workflows.get`，回退 404 时显示「无可用图快照」占位而不是整页错误；标题与列表优先 `workflowName`，缺省回落旧查询/短 ID；节点专家名优先 `expertName`，否则查当前专家列表，仍无则显示「—」，不展示裸 UUID；删除对话框文案必须包含「未结束的运行」；409 `referenced` 的 `details.references` 按数组处理，含 `type="run"` 时提示运行中实例，可列前 3 个 ID；旧字段与旧路径保留。 |
| 影响场景 | `SCN-0004`（新增 T12–T16） |
| 澄清记录 | 2026-11-18 依据 agent-flow-orchaster `docs/works/2026-11-18-run-asset-detach/ui-integration-proposal.md` 落地；上游为 P2 加法契约，后端已上线。UI 采用「运行快照优先、旧接口回退」策略，不删除旧代码路径。 |
| 状态 | `delivered`（2026-11-18；`SCN-0004` 16/16） |
