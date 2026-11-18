---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：运行节点文件与执行会话观测（API-48–53）

## 需求

- `REQ-0022`：运行节点文件与执行会话观测（新建 `SCN-0021`）。
- 上游工序：orchestrator `2026-11-17-ui-observability-layer`（方案 A / `EventSource` / BFF 超时已确认；本仓只做 UI 侧）。

## 背景

orchestrator `API-48`–`API-53` 已实现并通过 416 测试，client `client-observability-v1.2` 已联调。UI 侧现状：

- `CMP-bff` 对所有上游响应 `await upstream.arrayBuffer()`，SSE 会被全量缓冲且被 10s 超时切断；响应头/请求头白名单缺 `x-accel-buffering`、`content-length`、`accept-ranges`、`last-event-id`。
- `CMP-run-data` 只有 6 个操作，没有文件/session 读方法。
- `CMP-instances` 节点弹层只有概要/会话日志；5s 轮询整块重建弹层，不能直接挂接有状态的视图。
- `assets/vendor/` 没有 Prism，代码预览先纯文本 + 语言标签。

真实环境已探测：`GET /runs/{id}/files`、`/files/content`、`/nodes/{nodeId}/session`、`/session/events`、`/session/raw` 在 3100 直连均可用；SSE `snapshot` 来自 client 内存 ring，已结束会话可能为空，历史事件必须先用 API-51 播种。

## 验收标准

1. `SCN-0021` 实现并 `verified`（Playwright 5 正 1 反 + 真实 run 只读走查）。
2. `CMP-bff` 对 `/session/events/stream` 与 `/session/raw` 流式转发：SSE 首帧不等待上游结束、无总超时、透传 `Last-Event-ID`/`x-accel-buffering`/raw 头；headers 已发后出错 `destroy`，未发时 502/504。
3. `CMP-run-data` 新增 `listFiles`/`readFile`/`getSession`/`listSessionEvents`/`sessionStreamUrl`/`sessionRawUrl`，补错误文案；页面不直连 3100，不展示 `sessionId`/`attemptId`。
4. `CMP-instances` 节点弹层为「概要 / 文件 / 执行会话 / 会话日志」；页头「任务文件」入口；5s 轮询不重建活动面板、不重开 EventSource；关闭/切 Tab/切轮次必须 `unmount`。
5. `CMP-run-files` 只读：根切换、面包屑、懒加载、Markdown/文本/二进制/截断/错误态；无编辑/上传/删除。
6. `CMP-run-session` 只读：详情、历史事件、SSE、raw；无 `sessionId`；SSE `end` 后关闭，`heartbeat` 忽略。
7. 文档：更新 `run-data`/`instances`/`bff` 规格，新建 `run-files`/`run-session` 规格，更新 `architecture.md` 组件地图与依赖矩阵；场景索引重新生成。
8. 门禁：`npm run check:syntax`、`check:docs`、`docs:index:check`、`check:deps`、`check:architecture`、`check:scenario-trace`、`test:bff`、`test:observability`、`test:smoke`、`test:scenarios`、`test:workflow`。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0022-01 | design | `CMP-instances` + `CMP-run-data` + `CMP-bff` | 已完成（2026-11-18） | 本 brief、`REQ-0022`、`SCN-0021`、`proposal.md`、orchestrator proposal/debug-runbook、`run-data`/`instances`/`bff` 规格 |
| T-0022-02 | change | `CMP-bff` | 已完成（2026-11-18） | `bff/index.js`、`tests/bff/bff.test.js`、`tests/bff/stream.test.js`、`bff/spec.md` |
| T-0022-03 | change | `CMP-run-data` | 已完成（2026-11-18） | `assets/js/run/data.js`、`shared/http.js`、`run-data/spec.md`、`SCN-0021` |
| T-0022-04 | change | `CMP-instances` | 已完成（2026-11-18） | `instance-detail.js`、`pages/instance-detail.html`、`instances/spec.md`、`SCN-0021` |
| T-0022-05 | change | `CMP-run-files`（新） | 已完成（2026-11-18） | `assets/js/run/views/files.js`、`pages/instance-detail.html`、`run-files/spec.md`、`SCN-0021` |
| T-0022-06 | change | `CMP-run-session`（新） | 已完成（2026-11-18） | `assets/js/run/views/session.js`、`pages/instance-detail.html`、`run-session/spec.md`、`SCN-0021` |
| T-0022-07 | verify | 全部 | 已完成（2026-11-18） | `tools/fake-b1.js`、`tools/verify-node-observability.js`、`README`/`architecture`、`SCN-0021`、真实 run runbook |

## 装载清单（必读）

- `docs/requirements/REQ-0022-node-run-observability.md`
- `docs/design/scenarios/operations/instances/inspect-node-observability/scenario.md`
- `docs/works/2026-11-18-node-observability/proposal.md`
- `docs/design/components/{run-data,instances,bff}/spec.md`
- `/Users/chenlong/harness/agent-flow-orchaster/docs/works/2026-11-17-ui-observability-layer/{proposal,debug-runbook}.md`
- `/Users/chenlong/harness/agent-flow-orchaster/docs/design/components/http-gateway/spec.md` §4.1.1
- `bff/index.js`、`assets/js/run/data.js`、`assets/js/pages/instance-detail.js`、`pages/instance-detail.html`
- `tools/fake-b1.js`、`tools/verify-m1-scenarios.js`、`tools/test-harness.js`

## 已确认（2026-11-18）

- 入口：节点弹层 + 详情页头部「任务文件」按钮。
- Tab：概要 / 文件 / 执行会话 / 会话日志。
- 代码预览：纯文本 + 语言标签，不引入 Prism。
- 场景：新建 `SCN-0021`，不扩展 `SCN-0004`。
- 组件拆分沿用 orchestrator 已冻结的方案 A：新增 `CMP-run-files`、`CMP-run-session`；`CMP-instances` 只做 Tab/上下文编排。
- SSE：`EventSource`；BFF 透传 `Last-Event-ID`。
- BFF：文件/session JSON 30s；SSE/raw 无总超时；流式路径不缓冲。
