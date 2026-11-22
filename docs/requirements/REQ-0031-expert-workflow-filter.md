---
layer: requirements
module: experts
status: delivered
updated: 2026-11-22
---

# REQ-0031 专家列表按工作流筛选

| 字段 | 内容 |
|---|---|
| ID | `REQ-0031` |
| 类型 | `feature` |
| 场景叙述 | 研发人员想在某个流程的上下文里核对「这条流程到底有哪些专家在跑、各自的 Skill/工具装了什么」。在专家管理页勾选一条或多条工作流后，列表只显示这些流程节点绑定过的专家（多选取并集）；再点「清除流程筛选」回到全部专家。筛选条件带在选择项上并可写回 URL，刷新或转发链接后仍是同一视图。 |
| 价值 | 专家库按能力沉淀，与流程是组合关系；专家一多，找「这个流程用了谁」只能逐个打开工作流画布或凭记忆搜索。后端已支持 `GET /experts?workflowId=`（orchaster `REQ-0004`），前端不接就仍然只能看全量列表。 |
| 非目标 | 不做专家↔流程的编辑（绑定仍在工作流编辑器）、不做按流程的专家统计/导出、不改专家卡片字段、不做分页（沿用 `limit=200`）、不新增前端模块或依赖、不改 BFF 白名单。 |
| 约束 | 工作流列表只经 `CMP-workflow-data`（`createWorkflowData().list`）读取，页面不得直接 `fetch /api/v1/workflows*`；筛选参数只在有选择时发送，按同名参数重复（`workflowId=a&workflowId=b`），不传即全部；后端过滤结果以服务端为准，页面不再二次按流程过滤；工作流列表加载失败只禁用筛选入口并提示，专家列表照常；筛选条件写 `?workflowId=` 到 URL，刷新可复现；空结果与「未找到匹配的专家」区分文案。 |
| 影响场景 | `SCN-0026`（新建，验收证据）；`SCN-0006` 不新增断言（列表卡片与详情契约不变） |
| 澄清记录 | 2026-11-22：按 orchaster `docs/works/2026-11-21-expert-workflow-filter/result.md` 的已交付契约接入；多选并集、清除即全部、URL 可复现，均为本次确认的行为。 |
| 状态 | `delivered`（2026-11-22；`SCN-0026` 5/5、全量场景 91/91、`npm run test:gate` 通过） |

## 契约依赖

- 上游：`GET /api/v1/experts?workflowId=<uuid>[&workflowId=...]`（可重复参数、UUID 校验 400、未知流程 200 空集、`total` 为过滤后数量、`refCount` 仍按全部工作流计算）。
- 前端：`CMP-experts#filter-workflow`；流程名来自 `CMP-workflow-data.list({limit:200})`，只取 `id/name`。
