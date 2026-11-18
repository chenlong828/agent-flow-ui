---
layer: design
module: instances
status: verified
flow: inspect-node-observability
scenario: SCN-0021
execution: playwright
updated: 2026-11-18
---

# SCN-0021 运行节点文件与执行会话审查

> 需求：`REQ-0022`；上下游契约：orchestrator `API-48`–`API-53`、`RunSessionRichEvent`。

## 入口

- `CMP-instances/assets/js/pages/instance-detail.js#init`
- `CMP-instances/pages/instance-detail.html?id=<runId>`
- `CMP-run-files/assets/js/run/views/files.js#mountRunFiles`
- `CMP-run-session/assets/js/run/views/session.js#mountRunSession`
- `CMP-run-data/assets/js/run/data.js#createRunData`
- `CMP-bff/bff/index.js#handle`（SSE/raw 流式转发）

## 运行序

1. 打开运行详情 `GET /runs/{id}`；页头出现「任务文件」按钮。点击后打开 90% 弹层，`CMP-run-files` 以 `root=task-space`、`path=''` 调 `GET /runs/{id}/files`，列出目录与文件。
2. 双击轨迹图节点：90% 弹层出现「概要 / 文件 / 执行会话 / 会话日志」四个 Tab；默认概要。文件 Tab 复用同一个 `CMP-run-files` 视图；根可切 `task-space`/`workspace`，面包屑可回上级；目录懒加载；文件经 `GET /runs/{id}/files/content` 预览。
3. 文件预览：`.md`/`text/markdown` 用 `renderMarkdown`；其他文本用 `<pre>` 并显示语言标签；`reason=binary|too_large` 显示原因与大小；`truncated` 显示截断提示；`400 path_escape` 回根目录并提示；文件只读，无编辑/上传/删除入口。
4. 切到「执行会话」：`GET /runs/{id}/nodes/{nodeId}/session?visit=<n>` 取状态、cwd、起止时间、事件数、归档状态；`GET .../session/events?visit=&limit=200` 取历史事件并按 seq 升序展示；会话仍为 `running` 时用 `EventSource` 打开 `GET .../session/events/stream?visit=`，`snapshot` 合并、`event` 追加、`heartbeat` 忽略、`end` 关闭；`session_archive_not_ready` 时 raw 只显示不可下载；归档就绪后给 `GET .../session/raw?visit=` 下载链接。
5. 轮次切换：历史轮只读；执行会话按 `visit` 重新取数与建流，文件不随轮次变化。5s 轮询只刷新概要与确认卡；停留在文件/执行会话 Tab 时不重建面板、不重开 EventSource，选中目录/文件与事件滚动位置保持。
6. 关闭弹层 / 切走执行会话 Tab / 切轮次 / 页面卸载：`unmount` 关闭 EventSource、中止在飞请求、清理定时器。页头「任务文件」弹层关闭同样 `unmount`。

失败路径：

- `404 session_not_linked`：执行会话显示「该节点结果未关联会话」，文件 Tab 与页头任务文件仍可用；不重试。
- `503`/`504 client_observability_*`：显示「执行节点观测面不可用」或「执行节点未响应」，提供重试；不阻塞 run 轮询。
- `410 run_gone`：显示「运行记录已清理」，不重试。
- `409 session_archive_not_ready`：raw 显示「归档未完成」，稍后刷新。
- `400 path_escape`：文件视图回根目录并提示路径非法。
- 任何响应/DOM 不出现 `sessionId`/`attemptId`；页面只请求同源 3000，不直连 3100/client。

## 不可变引用

- `API-48`–`API-53` 路径、查询参数、DTO 与错误码（orchestrator `http-gateway/spec.md` §4.1.1）。
- `RunSessionRichEvent` 的 `seq/ts/kind/event/message/data` 展示口径；SSE `snapshot/event/heartbeat/end` 事件名。
- `CMP-run-data` 的只读方法签名与错误归一；不缓存 run/session。
- `DF.modal`（`size:'screen'` 90% 弹层）、`DF.esc/fmtBytes/fmtClock/icon/tag`、`shared/markdown.js#renderMarkdown`。
- `CMP-bff` 透明转发：不改 DTO、不做缓存/重试/DTO 映射。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1 文件/会话夹具 + `window.EventSource` 替身（记录实例、close 与事件注入）；真实 run 走 `debug-runbook.md`。可执行：`node tools/verify-node-observability.js`。最近一次执行：2026-11-18，8/8 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0021-T1 | 正 | 页头「任务文件」打开 90% 弹层并列出 task-space 根目录（`intent.md` 可见）；双击节点弹层出现四个 Tab；文件 Tab 可切 `workspace` 根、面包屑回上级；`.md` 按 Markdown 渲染 | `tools/verify-node-observability.js#scn0021T1` |
| SCN-0021-T2 | 正 | 代码文件以 `<pre>` 展示并带语言标签；二进制文件显示原因与大小；`truncated` 显示截断提示；目录懒加载与选中文件在切换到其他 Tab 再切回后保持 | `tools/verify-node-observability.js#scn0021T2` |
| SCN-0021-T3 | 正 | 执行会话显示状态/cwd/事件数/归档状态且无 `sessionId`；历史事件按 seq 展示；EventSource 的 rich `snapshot`（`kind/tool/usage/text`）经归一化后进入统计、筛选与工具合并；`end` 后关闭；raw 链接指向 `/session/raw?visit=1` | `tools/verify-node-observability.js#scn0021T3` |
| SCN-0021-T4 | 正 | 5s 轮询后文件 Tab 选中路径不重置、执行会话 EventSource 不重建；切走执行会话 Tab 与关闭弹层均调用 `close()` | `tools/verify-node-observability.js#scn0021T4` |
| SCN-0021-T5 | 反 | confirm 节点 `404 session_not_linked` 显示「未关联会话」且文件可用；文件接口 `503 client_observability_unavailable` 显示观测面不可用与重试；DOM 与请求均不含 `sessionId`/`attemptId` | `tools/verify-node-observability.js#scn0021T5` |
| SCN-0021-T6 | 正 | 多轮节点从第 2 轮切到第 1 轮时关闭旧 EventSource、按 `visit=1` 重载会话（历史轮已结束不建流），切回第 2 轮新建 `visit=2` 流 | `tools/verify-node-observability.js#scn0021T6` |
| SCN-0021-T7 | 正 | 217 条事件分页载入并显示概览（217 / 工具 66 / Token 116,257）；默认活动视图 72 行（66 次工具合并）；多选加「用量」114 行、再加「思考」151 行（全部预设高亮）；回活动预设 72 行；关「工具」6 行；搜索 `bash` 只留工具行 | `tools/verify-node-observability.js#scn0021T7` |
| SCN-0021-T8 | 正 | 选中「活动 + 用量」后写入 `localStorage.df-run-session-filter`；刷新后仍为 114 行且用量 chip 高亮；非法 JSON 与未知类别均回落「活动」72 行 | `tools/verify-node-observability.js#scn0021T8` |
