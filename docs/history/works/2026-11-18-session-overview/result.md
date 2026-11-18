---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 结果：执行会话概览与事件筛选

## 1 结论

执行会话视图从「6 行 kv + 逐条事件」升级为「概览统计 + 活动/全部/工具/思考/消息/用量/阶段筛选 + 搜索 + 工具调用合并 + 分页」。真实 217 条事件会话首屏可读到：3m37s、217 条、66 次工具调用（bash 48 · edit 9 · write 5，完成 66/66）、Token 116,257/1,000,000（11.6%）、37 段思考、2 段消息、归档 373K；默认活动视图 71 行（合并 66 次工具调用），不再被 42 条 usage 与 37 条 thought 淹没。

## 2 交付物

- `assets/js/run/views/session.js`：概览统计、分页、筛选/搜索、工具合并、usage/thinking 默认隐藏、初始滚动（运行中跟尾、已结束回顶）。
- `pages/instance-detail.html`：`rs-stats`/`rs-toolbar`/`rs-filter`/工具行/状态徽标样式；文件/会话视图高度改为 `calc(90vh - 200px)`。
- `tools/fake-b1.js`：会话事件按 `cursor`/`limit` 分页；新增 217 条事件夹具（`eventProfile: 'many'`）。
- `tools/verify-node-observability.js`：新增 `SCN-0021-T7`；T3 适配工具合并后的 3 行。
- 文档：`REQ-0023`、`run-session`/`instances` 规格、`SCN-0021-T7`。

## 3 验证

- `node tools/verify-node-observability.js`：7/7（T1–T7）。
- `node tools/verify-m1-scenarios.js SCN-0004`：6/6 不回归。
- 真实 run `01a1ea62-a856-77e6-b4ac-3d262a4e51ac` / n2 只读走查：概览、71 行活动视图、66 个工具行、216/217 载入、筛选与搜索正常，无控制台错误。
- 门禁：`check:syntax`、`check:docs`、`docs:index:check`、`check:scenario-trace`、`check:architecture` 通过；全量 `npm test` 见收口运行。

## 4 已知偏差

- 历史 preview DTO 不含工具完整 I/O、`level`、`messageId`/`toolCallId`，工具行只显示名称/状态/耗时；并发工具调用按顺序 + 工具名配对可能不精确。
- 事件详情 JSON 展开未做（B 档未选）。
- raw 为 zstd，不在前端解析。

## 5 结论落点

| 项 | 落点 |
|---|---|
| 需求 | `REQ-0023` → `delivered` |
| 场景 | `SCN-0021` 新增 T7；7/7 |
| 组件 | `CMP-run-session`（单组件） |
| 代码 | `assets/js/run/views/session.js`、`pages/instance-detail.html` |
| 测试 | `tools/fake-b1.js`、`tools/verify-node-observability.js` |
