---
layer: history
module: instances
status: frozen
updated: 2026-11-19
procedure: 2026-11-19-run-start-images
target: agent-flow-ui
---

# UI 修订提案：发起运行时以图片作为初始资料（提交时上传）

> 依据：调度层 [`ui-proposal.md`](../../../../../agent-flow-orchaster/docs/works/2026-11-19-run-start-images/ui-proposal.md) 与 `REQ-0003`；用户 2026-11-19 裁决：**图片只在最终提交时上传**，提交前可随意删除。
> 本文是 `agent-flow-ui` 的实现设计。后端契约不变（上传/删除/列表/内容四个端点），变更只在 UI 的上传时机与暂存生命周期。

## 1 与上游提案的差异

| 维度 | 上游（粘贴即上传） | 本提案（提交时上传） |
|---|---|---|
| 上传触发 | 粘贴/拖放/选择后立刻 `POST /run-inputs` | 点「发起运行」后才逐张上传 |
| 提交前删除 | 发 `DELETE /run-inputs/{id}`，失败留孤儿 | 只删本地 `File` 与 object URL，**零请求** |
| 暂存孤儿 | 依赖关闭弹窗 DELETE + 运维清理 | 上传成功前无暂存；启动失败即 DELETE 已上传项 |
| 上传进度 | 粘贴后显示 | 提交时显示（按钮 + 缩略图进度） |
| 提交耗时 | 图片已就绪，启动即发 | 提交先上传再启动，图片越大等待越久 |
| 服务端契约 | 不变 | 不变：`API-55..58` 与启动 `inputs[{inputId}]` |

**收益**：用户在提交前反悔不产生任何服务端状态，符合「至少有在 web 端提交删除的机会」；暂存孤儿面从「每次粘贴」缩小到「上传中途关闭/崩溃」。
**代价**：提交是一次「上传 + 启动」的组合动作，失败路径必须完整回滚；上传期间不能关弹窗无感退出（可在途中止）。

## 2 目标与非目标

**目标**

- 发起运行弹窗内可粘贴、拖放、选择一张或多张 PNG/JPEG/WebP/GIF，显示本地缩略图与计数。
- 提交前自由删除、追加；不产生网络请求。
- 点「发起运行」时：本地校验 → 上传全部（并发 3）→ 启动并携带 `inputs`；任一步失败都保留弹窗与本地图片，已上传项回滚删除。
- 运行详情展示本次运行的初始资料缩略图，可查看原图。

**非目标**

- 不做图片编辑、裁剪、旋转、OCR、压缩、重排；顺序 = 添加顺序。
- 不做通用文件、断点续传、上传队列持久化；刷新页面后未提交的本地图片丢失。
- 不改后端契约、不改 BFF 白名单（`/api/v1/*` 已覆盖、multipart 120 s / 25 MiB 已满足）。
- 不做运行结束后的归档浏览；不做灯箱组件（点击新标签页打开原图）。

## 3 后端契约（只依赖这些）

| 用途 | 请求 | 成功 |
|---|---|---|
| 上传单张 | `POST /api/v1/run-inputs`，`multipart/form-data`，字段 `file` | 201 `{ inputId, name, mediaType, sizeBytes, sha256, createdAt }` |
| 删除暂存 | `DELETE /api/v1/run-inputs/{inputId}` | 204；404 视为已清理；409 表示已绑定 |
| 启动 | `POST /api/v1/workflows/{id}/runs`，JSON 增加 `inputs: [{ inputId }]` | 201 `{ runId }` |
| 运行初始资料 | `GET /api/v1/runs/{id}/inputs` | 200 `{ items: RunInputView[] }` |
| 图片内容 | `GET /api/v1/runs/{id}/inputs/{inputId}/content` | 200 二进制 `image/*` |

限制（UI 本地也校验，服务端为准）：类型 PNG/JPEG/WebP/GIF（不接受 SVG）；单张 ≤8 MiB；最多 8 张；合计 ≤20 MiB。暂存项不设 TTL；启动失败不消耗暂存项。

## 4 组件与落点

| 单元 | 文件 | 职责 |
|---|---|---|
| 运行数据服务（`CMP-run-data`） | `assets/js/run/data.js` | 新增 `uploadInput`（XHR，带进度）、`deleteInput`、`listInputs`、`inputContentUrl`；`errorText` 增加 `client_unsupported`/`run_input_*`/`inputs` 分支 |
| 初始资料暂存（`CMP-instances` 内部模块） | `assets/js/run/input-upload.js`（新） | 本地校验、暂存列表、object URL、提交时并发 3 上传、失败回滚、销毁；不碰 DOM，依赖注入以便 node 单测 |
| 发起弹窗（`CMP-instances`） | `assets/js/pages/instances.js` | 附件栏渲染、粘贴/拖放/选择、提交编排（上传→启动）、关闭清理 |
| 运行详情（`CMP-instances`） | `assets/js/pages/instance-detail.js` | 「初始资料（N）」横向缩略图，点击新标签打开原图 |
| 样式 | `assets/css/main.css` | 附件栏、64px 缩略图、进度条、删除/重试、拖放高亮、详情条 |
| 测试夹具 | `tools/fake-b1.js` | `POST /run-inputs`、`DELETE /run-inputs/{id}`、`GET /runs/{id}/inputs[/{id}/content]`、失败注入与计数 |

`CMP-run-data` 新契约：

```js
uploadInput(file, { onProgress, timeout }) // -> Promise<RunInputView>；XHR 才能拿到 upload.onprogress
deleteInput(inputId)                        // -> Promise<null>；404 由调用方视为已清理
listInputs(runId, { signal })               // -> Promise<{ items: RunInputView[] }>
inputContentUrl(runId, inputId)             // -> string，交给 <img src>
```

不变量：`uploadInput` 只 POST 单文件、不手写 `Content-Type`（浏览器带 boundary）、120 s 超时、`abort` 时 reject 可识别错误；`inputContentUrl` 只拼 URL，不经 `fetch`。

## 5 暂存状态模型

```ts
type LocalInput = {
  localId: string;          // crypto.randomUUID()
  file: File;               // 本地内存，提交前唯一真相
  name: string;
  sizeBytes: number;
  mediaType: string;
  objectUrl: string;        // URL.createObjectURL(file)
  state: "staged" | "uploading" | "uploaded" | "failed";
  progress: number;         // 0–100
  inputId: string | null;   // uploaded 后由服务端返回
  error: string | null;
};
```

规则：

- 提交前只有 `staged`；删除即移除数组并 `revokeObjectURL`，不调服务端。
- `uploadAll()`：把全部 `staged` 置 `uploading`，并发 3；每项成功置 `uploaded` 并记录 `inputId`。
- 任一项失败：停止取新任务、中止在途 XHR、对已 `uploaded` 的项尽力 `DELETE`、全部重置回 `staged`（`progress=0/inputId=null`），抛出首个错误。本地 `File` 不丢，用户可直接重试。
- 启动失败（`client_unsupported`/`run_conflict`/校验/网络）：对已上传项执行同一回滚，弹窗与本地图片保留。
- 启动成功：项转 `bound`，关闭弹窗时**不再 DELETE**，只释放 object URL。
- 关闭弹窗：中止在途上传、释放全部 object URL；此时若有已上传但未回滚的项，按尽力 DELETE 处理（正常路径下不存在）。

## 6 提交流程

```text
点「发起运行」
  ├─ 原有字段校验（工作流/Harness/路径/意图）不过 → 原逻辑 toast，不上传
  ├─ 有图片：按钮显示「上传图片 i/N…」，附件栏显示每张进度
  │    ├─ 全部成功 → POST start（inputs 按列表顺序）
  │    ├─ 上传失败 → 中止其余 + DELETE 已上传 + 重置本地态 → toast 可重试
  │    └─ 用户关闭弹窗 → 中止在途上传 + 释放 URL（尽力 DELETE 已上传项）
  ├─ 无图片 → 照旧直接 start（不传 inputs）
  ├─ start 201 → 关闭弹窗、记工作区历史、跳转详情（不 DELETE 已绑定项）
  └─ start 失败 → 回滚已上传暂存、恢复按钮、按错误码提示，可直接重试
```

提交体：

```js
{
  harnessId, workspacePath, intentMarkdown, autoConfirm,
  inputs: readyItems.map(function (item) { return { inputId: item.inputId }; })
}
```

无图片时省略 `inputs`（后端等价于空数组）。

## 7 界面细节

- 字段标题「初始资料（图片）」，hint：「可选；PNG/JPEG/WebP/GIF，单张 ≤8 MiB，最多 8 张；点「发起运行」时才上传」。
- 横向附件栏（可横向滚动、隐藏滚动条）：64px 方形缩略图、右下删除按钮（hover/focus 可见，触屏常显）、上传中底部进度条、失败覆盖「上传失败」标记。
- 末尾「添加图片」按钮触发隐藏 `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>`。
- 空态只显示一行提示，不占大块高度；计数「已选 N/8」与合计体积显示在 hint 右侧。
- 粘贴：在弹窗 `body` 捕获阶段监听 `paste`；只取 `kind === "file"` 且 `type.startsWith("image/")` 的项；有图片时 `preventDefault()`，避免把 base64 塞进 Markdown；纯文本不拦截。
- 拖放：`dragenter/dragover/drop` 仅当携带文件时 `preventDefault()` 并高亮；非图片 toast「只支持图片」。
- 缩略图点击用 `window.open(objectUrl)` 看原图（不新增灯箱依赖）。
- 上传/删除按钮在提交中禁用；`aria-label` 齐全，状态变化用 `aria-live="polite"` 播报。

## 8 错误映射（按实际后端码）

| 场景 | 文案/处理 |
|---|---|
| 本地类型/体积/数量/合计超限 | toast：`只支持 PNG/JPEG/WebP/GIF 图片` / `单张不能超过 8 MiB` / `最多 8 张图片` / `图片合计不能超过 20 MiB` |
| 上传 413 `run_input_file_bytes` | `单张图片不能超过 8 MiB`，该项 failed |
| 上传 400 `validation_error`（`details.field=file`） | `不支持的图片格式`，该项 failed |
| 上传 415 `unsupported_media_type` | `上传请求格式不正确` |
| 上传 500/503/超时/断网 | `上传失败，请重试`；回滚后可重试 |
| 启动 409 `client_unsupported` | `执行节点暂不支持图片（未升级或未上线）；图片已保留，升级后可直接重试` |
| 启动 409 `run_conflict` | 沿用「同一工作区已有进行中的运行，请先结束它」 |
| 启动 400 `validation_error`（`details.field=inputs`） | `有图片已失效，请重新添加`（回滚后仍可重试） |
| 启动 413 `run_input_bytes` / `run_input_count` | `图片合计超过 20 MiB` / `最多 8 张图片`，提示删除后重试 |
| 启动其他错误 | 沿用 `errorText` |
| 删除 404 | 视为已清理，不提示；删除失败只记日志（不影响本地移除） |

## 9 运行详情

- `load()` 与 run 详情并行请求 `GET /runs/{id}/inputs`；失败不阻断页面，只不渲染区块。
- 有值显示「初始资料（N）」+ 横向 64px 缩略图；`<a target="_blank" href="/api/v1/runs/{id}/inputs/{inputId}/content">` 包 `<img loading="lazy" alt="{name}">`。
- 区块放在等待横幅之后、轨迹图之前；高度约 84px，轨迹图自适应剩余空间。
- 无图不渲染；人工确认在节点弹层内进行，弹层打开时仍能看到上方缩略图。

## 10 测试计划

| 层 | 用例 |
|---|---|
| node 单测（逻辑） | 暂存校验（类型/单张/数量/合计）、删除本地不调远端、提交并发上限 3、顺序保持、失败回滚 DELETE 已上传、`uploadInput` 进度/超时/abort 错误归一、URL 编码 |
| Playwright（`SCN-0024`） | T1 粘贴/选择入栏且提交前零上传；T2 删除本地零请求、提交顺序与 payload 一致；T3 详情缩略图与空态；T4 第 9 张被拒 + 上传失败回滚；T5 启动失败后回滚并重试成功 |
| 门禁 | `npm run test:gate`（语法/风格/文档/依赖/架构/场景追溯/BFF）、`node tools/verify-m1-scenarios.js SCN-0024` 与 SCN-0004 回归 |

## 11 已知偏差与风险

- 上传中途关闭/崩溃：服务端可能已落盘但 UI 未拿到 `inputId`，形成孤儿；后端无 TTL，需运维清理。这是「提交时上传」也无法消除的窗口，已登记。
- 提交是组合动作，总耗时 = 上传 + 启动；网络慢时「启动中…」可能持续数十秒，UI 显示分阶段文案（上传 i/N → 启动中）。
- 调度层 `REQ-0003` §4 仍写「粘贴即上传」，需其同步；本仓库只按用户裁决实现，后端契约不变。
- 粘贴在 Safari/WebKit 的 `clipboardData.items` 行为以引擎测试为准；用 `DataTransfer` 合成事件覆盖回归。

## 12 参考

- 上游交接：[`ui-proposal.md`](../../../../../agent-flow-orchaster/docs/works/2026-11-19-run-start-images/ui-proposal.md)、[`proposal.md`](../../../../../agent-flow-orchaster/docs/works/2026-11-19-run-start-images/proposal.md) §5.1。
- 需求：`REQ-0029`；场景：`SCN-0024`。
- 现有实现：`assets/js/pages/instances.js`、`assets/js/run/data.js`、`assets/js/pages/instance-detail.js`、`bff/index.js`。
- 编排侧契约实现：`agent-flow-orchaster` 的 `src/components/run/{input-ops,commands}.ts`、`src/components/http-gateway/routes/run-inputs.ts`。
