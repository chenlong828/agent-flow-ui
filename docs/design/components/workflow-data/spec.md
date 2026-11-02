---
layer: design
module: workflow-data
component: CMP-workflow-data
requirement: REQ-0016
scenario: SCN-0018
status: active
updated: 2026-10-30
---

# 工作流数据服务

> 导航：流程研发 / 工作流　|　形态：L1 数据服务（无页面）　|　前置：`design/architecture.md`、`CMP-workflow-list`、`CMP-workflow-editor`

## 0 模块卡

- 状态：active（2026-10-30 实现，列表/编辑器共用）
- 单元 / 层：组件 / L1 工作流领域数据服务
- 业务价值：为列表与编辑器提供唯一 B3 读写入口；没有它，两页会各自 `fetch`，revision、错误归一、图映射三处漂移。
- 负责 / 不负责：负责 `list/get/create/copy/update/remove/save/validate/exportDsl/importDsl`、`If-Match`、revision 缓存、错误归一、DSL 下载文件名；不负责画布渲染、拓扑规则本身（`workflow/validate`）、页面 Toast/路由、B1 资产。
- 内部逻辑：端点映射 → `shared/http`；`get/update/save` 成功记住 revision；`remove` 清缓存；`save` 返回 `{workflow,warnings}`；`exportDsl` 解析 `Content-Disposition`；`importDsl` 先 `JSON.parse`，非法 JSON 抛 `ApiError(400)`；`errorText` 统一 0/400/404/409/428/502 文案。
- 数据所有权：B3 `Workflow` 与其当前 `WorkflowDefinition` 的客户端唯一读写入口；页面不得直接 `fetch /api/v1/workflows*`；`layout/viewport` 由前端写入、后端透传，本服务不解释其字段。
- 公开契约：`list(params)`、`get(id)`、`create(input)`、`copy(id,input)`、`update(id,revision,input)`、`remove(id,revision)`、`save(id,revision,graph)`、`validate(id,graph)`、`exportDsl(id,format)`、`importDsl(text)`、`revisionOf(id)`；错误为 `ApiError{status,code,details,issues}`。
- 依赖：`shared/http`（fetch/JSON/If-Match/错误归一）；不依赖 `DF`、页面或 `MOCK`；图映射由调用方用 `workflow/model` 完成，本服务只传 B3 graph。
- 冷热属性：热（列表查询/保存路径）；无重试、无后台任务；失败快速返回。
- 变化轴：B3 端点/DTO、错误体 `issues|fieldErrors`、DSL 下载头；端点变化集中在本文件。
- 验证入口：`node --test tests/workflow`（24 条纯逻辑）；`node tools/verify-workflow-list.js`、`node tools/verify-workflow-editor.js`（页面网络契约）；真实 B3 只读走查。
- 验证计划：list 参数/分页；create/copy/update/save/remove 路径与 `If-Match`；400 issues、409 名称/revision、428；export 文件名；import 非法 JSON；revision 缓存。
- 预算：源码约 5 KB + 测试；远低于 120k token。
- 单独运行：`node --test tests/workflow`。
- 删除测试：删除后两页各自直连 B3，revision/错误/下载逻辑重复，复杂度分散到两页；故保留独立服务。
- 已知偏差：`copy` 不写 revision 缓存（调用方随后 GET）；`update` 返回详情而非摘要；`exportDsl` 只读服务端已保存版本；`importDsl` 只接受 JSON（YAML 导入不做）。

## 1 契约

| 操作 | 输入 | 输出 | 失败 |
|---|---|---|---|
| `list` | `{q,type,sort,limit,offset}` | `{items,total,limit,offset}` | 400/502 |
| `get` | `id` | `WorkflowDetail` | 404/502 |
| `create` | `{name,type,description,graph}` | `{id,revision,warnings}` | 400/409 |
| `copy` | `id,{name?}` | `{id,revision,warnings}` | 400/404/409 |
| `update` | `id,revision,{name,type,description}` | `WorkflowDetail` | 400/404/409/428 |
| `remove` | `id,revision` | `null`（204） | 404/409/428 |
| `save` | `id,revision,graph` | `{workflow,warnings}` | 400/404/409/428 |
| `validate` | `id,graph` | `{errors,warnings}` | 400/404 |
| `exportDsl` | `id,format=json\|yaml` | `{text,filename,contentType,format}` | 400/404 |
| `importDsl` | JSON 文本 | `{workflow,idMap,warnings}` | 400/409 |

**不变量**

- 写操作必须带 `If-Match: "<revision>"`；`create` 必须带合法 graph；`save` 只传整图，不做增量。
- `layout/viewport` 只透传对象形状，不校验字段语义；前端按 B3 `dsl.schema.json` 自校。
- 400 的 `error.details.issues` 优先；`fieldErrors` 归一为 issues。

## 2 关系

- 列表/编辑器只通过本服务读写 B3；不直接 `fetch`，不写 `MOCK`。
- 与 `workflow/validate` 的分工：validate 产出本地规则结果；本服务只传输与归一服务端结果。
