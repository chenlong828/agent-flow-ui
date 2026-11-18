---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 运行节点文件与执行会话观测：UI 侧方案（P1）

> 定级 **P1**：新增两个 L2 视图、扩展 `CMP-run-data` 公共读契约、把 `CMP-bff` 从全量缓冲改为流式。组件拆分与契约已确认（2026-11-18），本文件作为 UI 侧冻结记录；代码按任务表实施。

## 1 目标与边界

**目标**：运行详情的 90% 节点弹层增加「文件」「执行会话」两个只读 Tab，页头增加「任务文件」入口；文件浏览、会话详情/历史事件/SSE/raw 全部经同源 BFF 完成，不打断现有 5s 轮询、确认、终止。

**不做**：文件编辑/上传/删除、终端、二进制预览、运行后归档浏览、attempt 产品端点、UI 直连 3100/client、新运行时依赖。

**不变**：列表/发起/终止/确认/会话日志下载、双击 90% 弹层、Esc/遮罩/×、run 状态机、轮询周期。

## 2 组件地图

```text
L0 基础设施
  CMP-bff                同源转发；新增 SSE/raw 流式路径
  shared/http            fetch/JSON/ApiError
  shared/markdown        只读 Markdown 渲染

L1 数据服务
  CMP-run-data           B4 唯一读入口；新增 4 个只读方法 + 2 个 URL 构造器

L2 页面/视图
  CMP-instances          运行详情页：弹层骨架、Tab/轮次编排、确认、轮询
  CMP-run-files          只读文件视图：根切换、目录懒加载、预览
  CMP-run-session        只读会话视图：详情、事件、SSE、raw

组合根
  server.js              静态 + 挂载 CMP-bff
```

**依赖边**：

| 调用方 | 被调方 | 契约 | 说明 |
|---|---|---|---|
| `CMP-instances` | `CMP-run-files` / `CMP-run-session` | `mountRunFiles` / `mountRunSession` → `unmount` | 页面只给 run/node/visit 与容器，不介入内部取数 |
| `CMP-run-files` / `CMP-run-session` | `CMP-run-data` | 只读方法/URL | 不直接 `fetch`，不 import 页面 |
| `CMP-run-data` | `shared/http` | `request` | 统一错误归一 |
| `CMP-bff` | orchestrator | `/api/v1/*` | 流式/非流式；无 DTO 映射 |
| 视图 | `DF` / `shared/markdown` | 公共 UI/渲染 | 允许；不复制弹层/表格 |

**禁止边**：页面直连 3100；视图 import 其他页面；`CMP-bff` import 页面/`DF`/`MOCK`；`run-data` 缓存 run/session；DOM 出现 `sessionId`/`attemptId`。

## 3 契约

### 3.1 `CMP-run-data` 新增

```js
listFiles(runId, { root, path, signal })
readFile(runId, { root, path, signal })
getSession(runId, nodeId, { visit, signal })
listSessionEvents(runId, nodeId, { visit, cursor, limit, signal })
sessionStreamUrl(runId, nodeId, { visit })   // EventSource
sessionRawUrl(runId, nodeId, { visit })      // 下载/新窗口
```

- `runId`/`nodeId` 必须 `encodeURIComponent`；`root` 只接受 `task-space|workspace`；`visit` 可选。
- 不新增缓存；不拼 `sessionId`；不推断状态机。
- `errorText` 增补：`session_not_linked`、`run_gone`/`observation_gone`、`session_archive_not_ready`、`path_escape`、`client_observability_unavailable`、`client_observability_unauthorized`、`client_observability_disabled`，并保留 504 逗留重试文案。

### 3.2 视图

```js
// CMP-run-files
mountRunFiles(container, { runId, root = 'task-space', path = '' }) -> { unmount, getState }
// CMP-run-session
mountRunSession(container, { runId, nodeId, visit, live }) -> { unmount }
```

- `mount` 期间只经 `run-data` 取数；`unmount` 关闭 EventSource、abort 在飞请求、清理 DOM 与定时器。
- 视图不拥有业务数据；不写 `sessionStorage`/`MOCK`；不改 run 状态。
- 文件视图状态（`root`/`path`/选中文件）由视图持有，页面在切 Tab 时通过 `getState()` 保存、重挂载时传入。

### 3.3 `CMP-bff` 流式

- 识别：`/api/v1/runs/{id}/nodes/{nodeId}/session/events/stream`、`.../session/raw`（路径正则）。
- 写流：不读 `upstream.body`；先 `res.writeHead` + `flushHeaders()`；`Readable.fromWeb(upstream.body).pipe(res)`；`res.on('close')` 时 `controller.abort()`。
- 透传响应头：`content-type`、`cache-control`、`x-accel-buffering`、`content-disposition`、`content-length`（raw）、`etag`、`x-checksum-sha256`、`accept-ranges`、`x-request-id`。
- 请求头：`REQUEST_HEADERS` 增 `last-event-id`、`accept`。
- SSE 不设总超时、不设 `content-length`；raw 不设总超时、保留 `content-length`。
- headers 已发后上游错误：`res.destroy()`；headers 前：502/504 JSON。

## 4 页面生命周期

- `state.modal = { nodeId, visit, followLatest, tab, handle, filesState, filesView, sessionView }`。
- 弹层骨架只建一次：轮次槽、确认卡槽、四个 Tab、四个面板；Tab 切换只改面板显隐与挂载状态。
- 5s 轮询时 `syncNodeModal()` 只更新标题/轮次/确认卡/概要，不重建文件与会话面板，不重开 EventSource。
- 停留最新轮时新 `visit` 出现 → 更新 visit；执行会话按新 visit 重挂载；文件不随轮次变化。
- Tab 切换：先 `unmount` 旧视图，再 `mount` 新视图；文件状态经 `filesState` 恢复。
- 弹层关闭 / 页面卸载：`unmount` 全部视图。

## 5 错误矩阵

| 状态 | 文案/行为 |
|---|---|
| `404 session_not_linked` | 「该节点结果未关联会话」；文件仍可用 |
| `404 not_found` | 文件/会话不存在 |
| `409 session_archive_not_ready` | raw 显示「归档未完成，稍后刷新」 |
| `410 run_gone` / `observation_gone` | 「运行记录已按保留策略清理」，不重试 |
| `503/504 client_observability_*` | 「执行节点观测面不可用」/「执行节点未响应」，可重试 |
| `400 path_escape` | 回根目录并提示路径非法 |
| `0 network_error` | 「无法连接后端，请检查 BFF/运行服务」 |

## 6 测试

- `tests/bff/stream.test.js`：SSE 首帧不缓冲、`Last-Event-ID` 透传、raw 头、客户端断开 abort、headers 前后错误。
- `tools/verify-node-observability.js`：`SCN-0021` 4 正 1 反；`window.EventSource` 替身断言生命周期。
- 真实 run：`debug-runbook.md` 的 files/session/SSE/raw + Network 只出现 3000。

## 7 P1 确认记录

| 决策 | 结论 | 确认 |
|---|---|---|
| 组件拆分 | 方案 A：`CMP-run-files` / `CMP-run-session`；`CMP-instances` 只做编排 | 2026-11-18 |
| 入口 | 节点弹层 + 详情页头部「任务文件」 | 2026-11-18 |
| Tab | 概要 / 文件 / 执行会话 / 会话日志 | 2026-11-18 |
| 代码高亮 | 纯文本 + 语言标签；不引入 Prism | 2026-11-18 |
| 场景 | 新建 `SCN-0021`（页面内新增独立操作与价值） | 2026-11-18 |
| SSE | `EventSource`；BFF 透传 `Last-Event-ID` | 2026-11-18（沿用上游冻结） |
| BFF 超时 | JSON 30s；SSE/raw 无总超时；流不缓冲 | 2026-11-18（沿用上游冻结） |

## 8 开放问题

- 真实 client 的 live SSE 需在 client 保持 poll 时补验；当前环境 observer 在跑但无活跃 run，已结束会话只能验 `snapshot` 空 + `end`。
- 文件代码高亮后续如需 Prism，按依赖准入另立工序，不影响本契约。
