---
layer: design
module: run-data
component: CMP-run-data
requirement: REQ-0019
scenario: SCN-0004
status: active
updated: 2026-11-19
---

# 运行编排数据服务

> 导航：运行与运营 / 运行实例　|　形态：L1 数据服务（无页面）　|　前置：`design/architecture.md`、`CMP-instances`、`design/components/bff/spec.md`

## 0 模块卡

- 状态：active（2026-11-12 实现，列表/详情/发起运行共用）
- 单元 / 层：组件 / L1 运行编排数据服务
- 业务价值：为运行实例两页提供唯一 B4 读写入口；没有它，列表、详情与发起运行会各自 `fetch`，端点、错误归一与状态词表三处漂移。
- 负责 / 不负责：负责 `list/get/start/cancel/decide/resumeNode/uploadInput/deleteInput/listInputs/inputContentUrl/sessionLogUrl`、状态词表（run/node/outcome/archive）、错误归一与耗时计算；不负责画布渲染、确认决策与续跑的业务规则（后端运行编排服务判定）、页面 Toast/路由、B1/B3 资产。
- 内部逻辑：端点映射 → `shared/http`；`start` 只提交 `{harnessId, workspacePath, intentMarkdown, autoConfirm}`；`decide` 提交 `{decision, comment?}`；`uploadInput` 用 XHR 发 multipart 单文件以拿上传进度（时间 120 s，可 abort），`deleteInput`/`listInputs` 走 `shared/http`，`inputContentUrl` 只拼 URL；`resumeNode` 无请求体，POST 续跑端点；`sessionLogUrl` 只拼 URL，支持 `visit`/`attempt` 查询参数，由浏览器直接下载 gzip JSONL；`listFiles`/`readFile`/`getSession`/`listSessionEvents` 为 client 观测面只读端点，`sessionStreamUrl`/`sessionRawUrl` 只拼 URL（EventSource/下载由视图持有）；所有方法支持 `signal` 取消；`errorText` 按 0/400/404/409/410/413/502/503/504、续跑 `details.reason`、初始资料 `run_input_*`/`inputs` 与观测面错误码分支给文案；`uploadErrorText` 为单张上传单独归一 0/400/404/413/415/超时/取消；`decisionErrorText` 为人工决策单独归一 400/404/409/503（409 由页面刷新详情，不自动重试）。
- 数据所有权：B4 run（`RunSummary` / `RunDetail`）的客户端只读入口与四个写动作（start/cancel/decide/resumeNode）；运行状态机、节点推进、回退、续跑 attempt 与归档由后端运行编排服务拥有，本服务不推断、不缓存、不改写状态；`RunSummary.workflowName`/`harnessName`、`RunDetail.graph`、`RunNodeView.expertName` 是启动时冻结的快照字段，本服务原样透传给页面，不映射、不补造；client 文件/session 由执行节点与 orchestrator 拥有，本服务只转发。
- 公开契约：`list({state, workflowId, limit, offset})`、`get(id)`、`start(workflowId, input)`、`cancel(id)`、`decide(runId, nodeId, input)`、`resumeNode(runId, nodeId)`、`uploadInput(file, {onProgress, timeout})`、`deleteInput(inputId)`、`listInputs(runId, {signal})`、`inputContentUrl(runId, inputId)`、`sessionLogUrl(runId, nodeId, {visit, attempt})`、`listFiles(runId, {root, path, signal})`、`readFile(runId, {root, path, signal})`、`getSession(runId, nodeId, {visit, signal})`、`listSessionEvents(runId, nodeId, {visit, cursor, limit, signal})`、`sessionStreamUrl(runId, nodeId, {visit})`、`sessionRawUrl(runId, nodeId, {visit})`；错误为 `ApiError{status,code,details,issues}`；另导出 `RUN_STATE` / `RUN_OUTCOME` / `NODE_STATE` / `ARCHIVE_STATE` / `ACTIVE_STATES` / `durationMs` / `decisionErrorText`。
- 依赖：`shared/http`（fetch/JSON/错误归一）；不依赖 `DF`、页面或 `MOCK`；B3 图由调用方用 `workflow/data` 与 `workflow/model` 获取/映射。
- 冷热属性：热（运行列表/详情轮询、发起运行）；无重试、无后台任务；失败快速返回，轮询由页面控制。
- 变化轴：B4 端点/DTO、状态闭集、错误码；端点与词表变化集中在本文件。
- 验证入口：`node tools/verify-m1-scenarios.js SCN-0004`（Playwright，16 条）、`node tools/verify-node-observability.js`（SCN-0021，5 条）、`node --test tests/shared/run-data.test.js`、`node --test tests/shared/run-inputs.test.js`、`node tools/verify-m1-scenarios.js SCN-0024`（6 条）；真实后端只读走查 `/api/v1/runs`。
- 验证计划：列表分页/过滤；详情 DTO 字段（含 `workflowName`/`harnessName`/`graph`/`expertName`）与多 `visit` 节点记录；start 请求体与 400/409 错误；cancel 幂等；decision 的 400/404/409/503 文案与 409 刷新分支；会话日志 URL（含 `visit`）与 404；文件列表/内容、session 详情/事件、SSE/raw URL 的编码与 `visit`；观测面错误码文案。
- 预算：源码约 8 KB；远低于 120k token。
- 单独运行：`node tools/verify-m1-scenarios.js SCN-0004`。
- 删除测试：删除后两页只能读死数据，无法发起/终止/决策，运行能力整体消失；故保留独立数据层。
- 已知偏差：旧后端/旧运行可能没有 run 图快照，详情才按当前工作流图回退；后端未提供暂停/恢复/节点重试/重跑/输入输出与 attempt 产品端点；client 文件/session 为只读代理，UI 不落库、不缓存、不推断状态；文件预览不含语法高亮；历史事件一次最多取 200 条，不向前翻页；初始资料上传进度依赖 XHR（`fetch` 拿不到），上传途中关闭页面可能让服务端留下未拿到 `inputId` 的孤儿（暂存无 TTL，需运维清理）；续跑由后端把同一 task 重开为下一 attempt，UI 只发无请求体的 POST，不感知 `attempt`；旧后端/旧运行可能缺 `RunDetail.graph`/`workflowName`/`expertName`，页面回退工作流/专家接口，数据层不做兜底。

## 1 端点映射

| 方法 | 路径 | 用途 | 成功 |
|---|---|---|---|
| `GET` | `/api/v1/runs` | 运行列表，支持 `workflowId`、`state`、分页 | 200 `Page<RunSummary>` |
| `GET` | `/api/v1/runs/{id}` | 运行详情（含 `nodes`） | 200 `RunDetail` |
| `POST` | `/api/v1/workflows/{id}/runs` | 启动运行 | 201 `{runId}` |
| `POST` | `/api/v1/runs/{id}/cancel` | 取消运行（幂等） | 200 `RunDetail` |
| `POST` | `/api/v1/runs/{id}/nodes/{nodeId}/decision` | 人工确认 `pass` / `reject` | 200 `RunDetail` |
| `POST` | `/api/v1/runs/{id}/nodes/{nodeId}/resume` | 超时节点继续执行（无请求体） | 200 `RunDetail` |
| `POST` | `/api/v1/run-inputs` | 上传单张图片初始资料（multipart `file`） | 201 `RunInputView` |
| `DELETE` | `/api/v1/run-inputs/{inputId}` | 删除未绑定的暂存项 | 204；404/409 |
| `GET` | `/api/v1/runs/{id}/inputs` | 运行绑定的初始资料清单 | 200 `{items: RunInputView[]}` |
| `GET` | `/api/v1/runs/{id}/inputs/{inputId}/content` | 初始资料原图 | 200 二进制 |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session-log` | 会话日志（gzip JSONL） | 200 文件 |
| `GET` | `/api/v1/runs/{id}/files` | client 运行文件列表（`root`/`path`） | 200 `RunFileListing` |
| `GET` | `/api/v1/runs/{id}/files/content` | client 运行文件内容 | 200 `RunFileContent` |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session` | 执行会话详情（无 sessionId） | 200 `RunSessionView` |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session/events` | 历史事件（`visit`/`cursor`/`limit`） | 200 `RunSessionEventPage` |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session/events/stream` | 富事件 SSE | 200 `text/event-stream` |
| `GET` | `/api/v1/runs/{id}/nodes/{nodeId}/session/raw` | raw zstd 存档 | 200 `application/zstd` |

## 2 状态词表

- `RunState`：`created` / `running` / `waiting_confirm` / `waiting_resume` / `done`；`outcome` 仅 `done` 时有值：`succeeded` / `failed` / `cancelled`。
- `RunNodeState`：`queued` / `dispatched` / `waiting_confirm` / `waiting_resume` / `succeeded` / `rejected` / `failed`。
- `archiveState`：`none` / `pending` / `stored` / `failed`。
- `ACTIVE_STATES`：`created` / `running` / `waiting_confirm` / `waiting_resume`；非终态决定详情轮询与终止入口。
- 页面不得把 `outcome` 当 `state` 用；`waiting_confirm` 是 run 级等待人工确认，`waiting_resume` 是 run 级等待超时续跑，都不是节点级失败。

## 3 错误映射

- `400 validation_error`：请求形状/路径非法；`unsupported_node_type`：图含 `split`/`fanout`（第二期开放）；`path_escape`：文件路径越界，回根目录。
- `404 run_not_found`：运行或节点不存在；日志未上传时 `404`；`session_not_linked`：节点结果未关联执行会话（文件仍可用）。
- `409 run_conflict`：同工作区已有活跃 run；`binding_conflict`：执行节点被占用；`invalid_state`：状态不允许（如对非 `waiting_confirm` 节点决策、对非 `waiting_resume` 节点续跑）；`session_log_missing`：结果上报缺日志；`session_archive_not_ready`：raw 归档未完成。
- 续跑 `409 invalid_state` 的 `details.reason`：`node_not_waiting_resume`（节点已不等待）、`task_missing`（无 taskId）、`session_missing`（无 sessionId）、`instance_not_dispatchable`（实例不可派发）、`task_not_resumable`（任务不可重开）；`errorText` 按 reason 给具体文案，未知 reason 回落通用 409 文案。
- 决策 `400 validation_error` / `404 not_found` / `409 invalid_state` / `503 service_unavailable`：`decisionErrorText` 分别给「修正后重试 / 运行或节点不存在 / 已处理或状态已变化 / 服务暂不可用」文案；页面在 404 关闭弹层、409 刷新详情，均不自动重复提交。
- `410 run_gone` / `observation_gone`：运行/会话记录已按保留策略清理，不重试。
- `413 payload_too_large`：`details.limit=run_input_file_bytes` → 单张超 8 MiB；`run_input_bytes` → 合计超 20 MiB；`run_input_count` → 超过 8 张。
- `409 client_unsupported`：执行节点未声明 `run-inputs` 能力，启动被拒且不建 run；提示图片已保留、升级后重试。
- `400 validation_error`（`details.field=inputs`）：启动引用的暂存项不存在或已绑定；UI 提示图片已失效并保留本地图片。
- 上传 `415 unsupported_media_type` / `400 validation_error`（field=file）：请求不是 multipart 或图片格式/魔数不合法；上传 `404 input_not_found`：暂存项已不存在。
- `502/503`：BFF 或后端不可用；`503/504 client_observability_unavailable|unauthorized|disabled`：执行节点观测面不可用/鉴权失败/未开启；`504`：执行节点未响应；`0`：网络不可达。
