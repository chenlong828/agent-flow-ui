---
layer: history
module: instances
status: frozen
updated: 2026-11-19
procedure: 2026-11-19-run-start-images
---

# 结果：发起运行图片初始资料（UI，提交时上传）

## 1 结论

`REQ-0029` / `SCN-0024` 落地：发起运行弹窗支持粘贴/拖放/选择图片，图片在提交前只存在于浏览器内存（缩略图 + 本地校验 + 可删除），点「发起运行」时才并发 3 上传并随 `inputs: [{inputId}]` 绑定；上传失败或启动失败立即 DELETE 已上传暂存项、保留本地图片可重试；运行详情显示「初始资料（N）」只读缩略图。

与上游调度层提案的差异点是用户 2026-11-19 裁决的**上传时机**：从「粘贴即上传」改为「提交时上传」。后端契约未改（`API-55..58` 与启动 `inputs` 对上传时机不可见），因此编排侧与 client 侧代码无需变更。

## 2 验收对照

| 验收项 | 结果 | 证据 |
|---|---|---|
| 粘贴/拖放/选择入栏，提交前零上传，删除只改本地 | 通过 | `SCN-0024-T1` |
| 提交时按列表顺序上传并绑定，详情显示缩略图 | 通过 | `SCN-0024-T2` |
| 无初始资料的运行详情不渲染区块 | 通过 | `SCN-0024-T3` |
| 第 9 张图片被本地拒绝且已有 8 张不变 | 通过 | `SCN-0024-T4` |
| 上传失败保留本地图片、重试重新上传 | 通过 | `SCN-0024-T5` |
| 启动失败回滚已上传暂存、保留弹窗可重试 | 通过 | `SCN-0024-T6` |
| 暂存队列逻辑：类型/空/单张/数量/合计校验、并发 3、顺序、失败回滚、绑定后不删除 | 通过 | `node --test tests/shared`（27/27，含 `input-upload.test.js`） |
| 上传/删除/列表/内容 URL 与错误归一 | 通过 | `node --test tests/shared`（含 `run-inputs.test.js`） |
| 发起运行既有流程不回归 | 通过 | `SCN-0004` 16/16 |

## 3 结论落点

| 内容 | 落点 |
|---|---|
| 运行数据服务新增上传/删除/列表/内容 URL 与错误文案 | [`data.js`](../../../../assets/js/run/data.js) |
| 本地暂存队列（校验、并发 3、回滚、生命周期） | [`input-upload.js`](../../../../assets/js/run/input-upload.js) |
| 发起弹窗附件栏视图（渲染、粘贴/拖放/选择、按钮文案） | [`launch-inputs.js`](../../../../assets/js/run/views/launch-inputs.js) |
| 发起运行编排（提交时上传→启动→回滚） | [`instances.js`](../../../../assets/js/pages/instances.js) |
| 运行详情初始资料缩略图 | [`instance-detail.js`](../../../../assets/js/pages/instance-detail.js) |
| 附件栏/缩略图/进度/拖放高亮、详情缩略图样式 | [`instances.html`](../../../../pages/instances.html)、[`instance-detail.html`](../../../../pages/instance-detail.html) |
| `image` 图标原语 | [`ui.js`](../../../../assets/js/ui.js) |
| 测试夹具（run-inputs 暂存/绑定/内容、失败注入、计数） | [`fake-b1.js`](../../../../tools/fake-b1.js)、[`test-harness.js`](../../../../tools/test-harness.js) |
| 场景与需求 | `SCN-0024`、`REQ-0029`；组件规格 `instances` / `run-data` 与 `architecture.md` 同步 |

## 4 测试与门禁

- `node tools/verify-m1-scenarios.js SCN-0024`：6/6。
- `node tools/verify-m1-scenarios.js SCN-0004`：16/16（发起运行无图路径回归）。
- `node --test tests/shared`：27/27。
- `npm run test:gate`：通过（语法 / oxlint 0 警告 / 文档 / 场景索引 / 依赖 / 架构 / 场景追溯 / 16 BFF 测试）。
- `npm run check:docs`：通过；场景索引 22 个。

## 5 未决与后续

1. **跨仓库同步**：调度层 `agent-flow-orchaster` 的 `REQ-0003` §4 仍写「粘贴即上传」，需其在下一次改动中改为「UI 提交时上传；服务端只认 `inputId`」，否则两份现行文档在上传时机上冲突。
2. **暂存孤儿**：上传途中关闭弹窗/页面崩溃时，服务端可能已落盘但 UI 未拿到 `inputId`；暂存无 TTL，仍需运维清理。本工序只覆盖「拿到 `inputId` 后一定能 DELETE」的正常回滚。
3. **端到端联调**：真实 orchestrator + client + UI 的「上传→启动→client 落盘→`read_image`→归档」仍属上游 `T-IMG-09`，本工序只验证了 UI 与 fake B1 契约。
4. **详情页图片**：依赖 `GET /runs/{id}/inputs/{inputId}/content` 直连 `<img>`，沿用产品端点现状（无鉴权、无缓存头要求）；若后续加鉴权，需要改为带凭据的加载方式。
