---
layer: design
module: run-data
component: CMP-run-data
requirement: REQ-0004
scenario: SCN-0004
status: active
updated: 2026-11-12
---

# 运行编排数据服务

> 导航：运行与运营 / 运行实例　|　形态：L1 数据服务（无页面）　|　前置：`design/architecture.md`、`CMP-instances`、`design/components/bff/spec.md`

## 0 模块卡

- 状态：active（2026-11-12 实现，列表/详情/发起运行共用）
- 单元 / 层：组件 / L1 运行编排数据服务
- 业务价值：为运行实例两页提供唯一 B4 读写入口；没有它，列表、详情与发起运行会各自 `fetch`，端点、错误归一与状态词表三处漂移。
- 负责 / 不负责：负责 `list/get/start/cancel/decide/sessionLogUrl`、状态词表（run/node/outcome/archive）、错误归一与耗时计算；不负责画布渲染、确认决策的业务规则（后端运行编排服务判定）、页面 Toast/路由、B1/B3 资产。
- 内部逻辑：端点映射 → `shared/http`；`start` 只提交 `{harnessId, workspacePath, intentMarkdown, autoConfirm}`；`decide` 提交 `{decision, comment?}`；`sessionLogUrl` 只拼 URL，由浏览器直接下载 gzip JSONL；`errorText` 按 0/400/404/409/502 与 `unsupported_node_type`、`run_conflict`、`binding_conflict`、`invalid_state`、`session_log_missing` 分支给文案。
- 数据所有权：B4 run（`RunSummary` / `RunDetail`）的客户端只读入口与三个写动作（start/cancel/decide）；运行状态机、节点推进、回退与归档由后端运行编排服务 拥有，本服务不推断、不缓存、不改写状态。
- 公开契约：`list({state, workflowId, limit, offset})`、`get(id)`、`start(workflowId, input)`、`cancel(id)`、`decide(runId, nodeId, input)`、`sessionLogUrl(runId, nodeId, {visit, attempt})`；错误为 `ApiError{status,code,details,issues}`；另导出 `RUN_STATE` / `RUN_OUTCOME` / `NODE_STATE` / `ARCHIVE_STATE` / `ACTIVE_STATES` / `durationMs`。
- 依赖：`shared/http`（fetch/JSON/错误归一）；不依赖 `DF`、页面或 `MOCK`；B3 图由调用方用 `workflow/data` 与 `workflow/model` 获取/映射。
- 冷热属性：热（运行列表/详情轮询、发起运行）；无重试、无后台任务；失败快速返回，轮询由页面控制。
- 变化轴：B4 端点/DTO、状态闭集、错误码；端点与词表变化集中在本文件。
- 验证入口：`node tools/verify-m1-scenarios.js SCN-0004`（Playwright，5 条）；真实后端只读走查 `/api/v1/runs`。
- 验证计划：列表分页/过滤；详情 DTO 字段；start 请求体与 400/409 错误；cancel 幂等；decision 的 409 分支；会话日志 URL 与 404。
- 预算：源码约 5 KB；远低于 120k token。
- 单独运行：`node tools/verify-m1-scenarios.js SCN-0004`。
- 删除测试：删除后两页只能读死数据，无法发起/终止/决策，运行能力整体消失；故保留独立数据层。
- 已知偏差：后端无 run 图快照，详情轨迹按当前工作流图渲染；后端未提供暂停/恢复/节点重试/重跑/输入输出/工作区留痕，页面相应入口置灰。

## 1 端点映射

| 方法 | 路径 | 用途 | 成功 |
|---|---|---|---|
| `GET` | `/api/v1/runs` | 运行列表，支持 `workflowId`、`state`、分页 | 200 `Page<RunSummary>` |
| `GET` | `/api/v1/runs/{id}` | 运行详情（含 `nodes`） | 200 `RunDetail` |
| `POST` | `/api/v1/workflows/{id}/runs` | 启动运行 | 201 `{runId}` |
| `POST` | `/api/v1/runs/{id}/cancel` | 取消运行（幂等） | 200 `RunDetail` |
| `POST` | `/api/v1/runs/{id}/nodes/{nodeId}/decision` | 人工确认 `pass` / `reject` | 200 `RunDetail` |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session-log` | 会话日志（gzip JSONL） | 200 文件 |

## 2 状态词表

- `RunState`：`created` / `running` / `waiting_confirm` / `done`；`outcome` 仅 `done` 时有值：`succeeded` / `failed` / `cancelled`。
- `RunNodeState`：`queued` / `dispatched` / `waiting_confirm` / `succeeded` / `rejected` / `failed`。
- `archiveState`：`none` / `pending` / `stored` / `failed`。
- 页面不得把 `outcome` 当 `state` 用；`waiting_confirm` 是 run 级等待，不是节点级失败。

## 3 错误映射

- `400 validation_error`：请求形状/路径非法；`unsupported_node_type`：图含 `split`/`fanout`（第二期开放）。
- `404 run_not_found`：运行或节点不存在；日志未上传时 `404`。
- `409 run_conflict`：同工作区已有活跃 run；`binding_conflict`：执行节点被占用；`invalid_state`：状态不允许（如对非 `waiting_confirm` 节点决策）；`session_log_missing`：结果上报缺日志。
- `502/503`：BFF 或后端不可用；`0`：网络不可达。
