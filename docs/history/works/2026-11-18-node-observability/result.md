---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 结果：运行节点文件与执行会话观测

## 1 结论

运行详情页的 90% 节点弹层扩展为「概要 / 文件 / 执行会话 / 会话日志」四个 Tab，页头新增「任务文件」入口；文件浏览、会话详情/历史事件/SSE/raw 全部经同源 BFF 完成。`CMP-bff` 对 `session/events/stream` 与 `session/raw` 改为流式转发，`CMP-run-data` 扩展为 12 个操作，`CMP-instances` 弹层改为稳定骨架 + 视图挂载，轮询不再重建活动面板或重开 EventSource。

## 2 交付物

### 代码

- `bff/index.js`：识别 SSE/raw 路径；`Readable.fromWeb(...).pipe(res)`；无总超时；透传 `Last-Event-ID`、`x-accel-buffering`、raw 头；SSE 剥 `content-length`；客户端断开 abort 上游；headers 后错误 destroy。
- `assets/js/run/data.js`：新增 `listFiles/readFile/getSession/listSessionEvents/sessionStreamUrl/sessionRawUrl`；错误文案覆盖 `session_not_linked`、`run_gone`、`session_archive_not_ready`、`path_escape`、`client_observability_*`。
- `assets/js/run/views/files.js`（新）：只读文件视图；根切换、面包屑、目录懒加载、Markdown/文本/二进制/截断；跨 Tab 恢复选中文件。
- `assets/js/run/views/session.js`（新）：只读会话视图；详情、历史事件、SSE 追加/关闭、raw 下载；不展示 `sessionId`/`attemptId`。
- `assets/js/pages/instance-detail.js`：弹层骨架、四 Tab、页头任务文件、轮询同步、视图 `mount/unmount` 生命周期。
- `pages/instance-detail.html`：四 Tab 面板与文件/会话视图样式。
- `tools/fake-b1.js`：文件/会话/事件/raw 夹具与 `filesError`/`sessionError` 注入。
- `tools/verify-node-observability.js`（新）：SCN-0021 6 条 Playwright 用例。
- `tests/bff/stream.test.js`（新）：SSE/raw 流式 4 条；`tests/shared/run-data.test.js`（新）：错误文案与 URL 编码 2 条。
- `package.json`：`test:observability`；`check:syntax` 覆盖 `run/views`。

### 文档

- `REQ-0022`、`SCN-0021`、本工序 brief/proposal/result。
- `components/run-data`、`instances`、`bff` 规格更新；新建 `components/run-files`、`components/run-session`。
- `architecture.md` 组件地图、依赖矩阵与操作 ID；`plan/roadmap.md` M16；场景索引重新生成。

## 3 验证

| 项 | 结果 |
|---|---|
| `npm test` | exit 0（语法/文档/索引/依赖/架构/场景追溯全过） |
| `npm run test:bff` | 16/16（含流式 4 条） |
| `npm run test:shared` | 11/11 |
| `npm run test:observability` | SCN-0021 6/6 |
| `npm run test:scenarios` | 53/53（SCN-0004 6/6 不回归） |
| `npm run test:workflow` | 32 + SCN-0018 15/15 + SCN-0019 24/24 |
| 冒烟 / MOCK 页 | 13/13、22/22 |

真实 run 只读走查（`01a1e966-c8ab-71f6-8321-33c4c87e4173`，或本机 3100 + UI 3010）：

- 文件：task-space 列出 `evidence/`、`dev.md`、`intent.md`；`dev.md` Markdown 渲染正常。
- 执行会话：状态「已完成」、cwd、事件数 25、归档「已归档 · 22K」；历史事件 24 条；raw 下载 22300 字节。
- SSE：经 BFF 返回 `text/event-stream` + `x-accel-buffering: no`，无 `content-length`；已结束会话收到 `snapshot` 空 + `end`。
- raw：`application/zstd` + `etag` + `x-checksum-sha256`；`content-length` 在上游给出时透传，上游 chunked 时随之为 chunked（orchestrator 对 `Bun.file` 响应两种模式交替出现）。

## 4 已知偏差与后续

- 真实**进行中**会话的 live SSE 未在本次环境验证：client observer 在跑但没有活跃 run；已用 `window.EventSource` 替身覆盖首帧/追加/关闭/轮次切换。后续在 client 保持 poll 时按 `debug-runbook.md` 补验。
- 代码预览只显示语言标签，不引入 Prism；后续如需高亮按依赖准入另立工序。
- 历史事件一次取 200 条，不提供向前翻页（API-51 只有 after cursor）；完整内容走 raw。
- 文件是 run 级、会话是 `nodeId + visit` 级：文件 Tab 不随轮次变化，执行会话随轮次重载。

## 5 结论落点

| 项 | 落点 |
|---|---|
| 需求 | `REQ-0022` → `delivered` |
| 场景 | `SCN-0021` → `verified`（6/6） |
| 组件 | 新增 `CMP-run-files`、`CMP-run-session`；扩展 `CMP-run-data`、`CMP-instances`、`CMP-bff` |
| 架构 | `design/architecture.md` 组件地图/依赖矩阵/操作 ID |
| 路线图 | `M16` 完成 |
| 代码 | `bff/index.js`、`assets/js/run/{data,views}/*`、`assets/js/pages/instance-detail.js`、`pages/instance-detail.html` |
| 测试 | `tests/bff/stream.test.js`、`tests/shared/run-data.test.js`、`tools/verify-node-observability.js` |
