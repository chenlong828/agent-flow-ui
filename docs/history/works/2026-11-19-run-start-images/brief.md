---
layer: history
module: instances
status: frozen
updated: 2026-11-19
procedure: 2026-11-19-run-start-images
---

# 工序：发起运行支持图片初始资料（UI，提交时上传）

## 需求

`REQ-0029`：发起运行时用图片作为初始资料；图片只在点击「发起运行」的提交动作里上传，提交前可在弹窗内自由删除。

上游来源：`agent-flow-orchaster` 的 [`ui-proposal.md`](../../../../../agent-flow-orchaster/docs/works/2026-11-19-run-start-images/ui-proposal.md)（2026-11-19，调度层交付）。本工序按用户 2026-11-19 裁决**改变上传时机**：由「粘贴即上传」改为「提交时上传」，其余交互沿用上游提案。

## 背景

编排侧已实现 `API-55..58`（`POST /run-inputs` 暂存、`DELETE /run-inputs/{id}`、`GET /runs/{id}/inputs`、`GET /runs/{id}/inputs/{inputId}/content`）与启动绑定（`inputs: [{inputId}]`），`agent-flow-client` 已声明 `run-inputs` 能力并实测 `read_image`。UI 尚未接入。

上游原方案「粘贴即上传」会在用户尚未决定提交时就产生暂存项；暂存不设 TTL，删错/放弃都依赖 DELETE 与运维清理。用户要求把上传推迟到最终提交，让「选错图」只发生在本地内存，不产生服务端状态。

## 验收标准

1. 发起运行弹窗可粘贴、拖放、选择图片；本地校验类型/单张 8 MiB/最多 8 张/合计 20 MiB，超出给 toast 且不进入列表。
2. 提交前不产生任何上传请求；删除暂存图片只释放本地预览，不发 DELETE。
3. 点「发起运行」后才按列表顺序上传（并发 3），全部成功后启动并携带 `inputs: [{inputId}]`；顺序与缩略图一致。
4. 上传失败或启动失败：中止其余上传、DELETE 已上传暂存项、保留本地图片与弹窗，可直接重试；重试重新上传。
5. 运行详情显示「初始资料（N）」缩略图，点击可看原图；无图不渲染区块。
6. `SCN-0024` 3 正 2 反可执行且通过；`npm run test:gate`、`npm run test:scenarios` 不回归。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0029-01 | design | `CMP-instances` + `CMP-run-data` | 完成（2026-11-19） | 本 brief、上游 `ui-proposal.md`、`proposal.md` §5.1、`REQ-0003`、`instances/spec.md`、`run-data/spec.md` |
| T-0029-02 | change | `CMP-run-data` | 完成（2026-11-19：上传/删除/列表/内容 URL + 错误文案 + node 单测） | `run/data.js`、`shared/http.js`、`tests/shared/run-data.test.js` |
| T-0029-03 | change | `CMP-instances` | 完成（2026-11-19：暂存队列、附件栏、提交编排、详情缩略图） | `run/input-upload.js`（新）、`pages/instances.js`、`pages/instance-detail.js`、`assets/css/main.css` |
| T-0029-04 | change | 测试夹具 | 完成（2026-11-19：fake B1 run-inputs 端点、失败注入与计数） | `tools/fake-b1.js`、`tools/verify-m1-scenarios.js` |
| T-0029-05 | verify | `CMP-instances` + `CMP-run-data` | 完成（2026-11-19：SCN-0024 6/6、SCN-0004 16/16、test:gate 通过） | `SCN-0024`、`npm run test:gate`、`node tools/verify-m1-scenarios.js SCN-0024` |

## 装载清单（必读）

- `docs/works/2026-11-19-run-start-images/ui-proposal.md`（本工序设计）
- `agent-flow-orchaster`：`docs/works/2026-11-19-run-start-images/ui-proposal.md`、`proposal.md` §5.1/§6、`docs/requirements/REQ-0003-run-start-image-inputs.md`、`src/components/run/input-ops.ts`、`src/components/run/commands.ts`、`src/components/http-gateway/routes/run-inputs.ts`
- `assets/js/pages/instances.js`、`assets/js/pages/instance-detail.js`、`assets/js/run/data.js`、`assets/js/shared/http.js`、`assets/css/main.css`
- `tools/fake-b1.js`、`tools/test-harness.js`、`tools/verify-m1-scenarios.js`
- `docs/design/components/instances/spec.md`、`docs/design/components/run-data/spec.md`

## 已确认（2026-11-19 用户裁决）

- 上传时机：**提交时上传**；提交前删除只改本地，不发请求。上游「粘贴即上传」被本工序取代。
- 启动失败处理：**立即 DELETE 已上传暂存，保留本地图片供重试**（重试重新上传）。
- 交付范围：实现 + 建 REQ/工序文档；修订版提案落在 `agent-flow-ui` 工序目录，不回写调度层仓库。

## 跨仓库待同步

调度层 `agent-flow-orchaster` 的 `REQ-0003` §4 约束仍写「上传采用『粘贴即上传』的暂存模式」。本工序只改 UI 交互，不改后端契约（后端对上传时机不敏感）；该约束需由调度层在下一次改动中同步为「UI 提交时上传、服务端只认 `inputId`」，否则两份现行文档冲突。

## 领取的开放问题

- `SCN-0024` 新建后进场景索引；`QU-01`（关闭时是否 DELETE）由「提交失败即删」吸收，普通关闭无暂存可删。
- 在途上传被关闭中断时服务端可能落盘成为孤儿（无 TTL）。本工序不新增清理机制，登记为已知偏差。
