---
layer: design
module: instances
status: verified
flow: control-instance
scenario: SCN-0024
updated: 2026-11-19
---

# SCN-0024 发起运行的图片初始资料（提交时上传）

> 需求：`REQ-0029`；上游契约与交互来源见 `agent-flow-orchaster` 的 `docs/works/2026-11-19-run-start-images/{proposal.md,ui-proposal.md}`。本场景只覆盖 UI：图片在提交前只存在于浏览器内存，点「发起运行」时才上传并随启动绑定。

## 入口

- `CMP-instances/assets/js/pages/instances.js#openLaunch`（附件栏、粘贴/拖放/选择、提交编排）
- `CMP-instances/assets/js/run/input-upload.js#createInputStaging`（暂存队列与上传回滚）
- `CMP-instances/assets/js/pages/instance-detail.js#inputsHTML`（运行详情缩略图）
- `pages/instances.html`、`pages/instance-detail.html?id=<runId>`

## 运行序

1. 打开「发起运行」弹窗，在「启动意图」之后出现「初始资料（图片）」附件栏；空态只显示一行提示，不占用大块高度。
2. 粘贴/拖放/选择图片：只接受 `image/png`、`image/jpeg`、`image/webp`、`image/gif`；本地校验单张 ≤8 MiB、最多 8 张、合计 ≤20 MiB，超限给 toast 且不进入列表。入栏后立即显示 64px 缩略图、已选张数与合计体积；**此时不发任何上传请求**。粘贴只拦截含图片文件的剪贴板，纯文本仍交给 Markdown 编辑器；拖放非图片文件只提示「只支持图片」。
3. 删除/追加：删除只移除本地 `File` 与 object URL，不发 `DELETE`；追加保持添加顺序，同一文件重复添加允许。
4. 点「发起运行」：先做原有工作流/Harness/路径/意图校验；有图片时按钮显示「上传图片 i/N…」，逐张 `POST /run-inputs`（并发 ≤3，顺序 = 列表顺序），全部成功后 `POST /workflows/{id}/runs` 并携带 `inputs: [{inputId}]`；成功后关闭弹窗、跳转详情，已绑定项不再 `DELETE`。
5. 失败路径：任一上传失败 → 中止其余在途上传、对已拿到 `inputId` 的项尽力 `DELETE`、本地项恢复 `staged` 并保留 `File`，弹窗不关闭，可重试（重试重新上传）；启动失败（`client_unsupported`/`run_conflict`/校验/网络）→ 对已上传项执行同一回滚，按错误码提示后可直接重试；关闭弹窗 → 中止在途上传、尽力删除未绑定项、释放全部 object URL。
6. 详情页：并行请求 `GET /runs/{id}/inputs`；有值时在等待横幅与轨迹图之间显示「初始资料（N）」横向缩略图，`<a target="_blank">` 包 `GET /runs/{id}/inputs/{inputId}/content`，点击查看原图；无值不渲染区块。请求失败不阻断详情页。

失败路径：非图片剪贴板/拖放不进入队列；超过 8 张时第 9 张被拒且已有图片不变；上传中删除被禁用；上传失败或启动失败后暂存项不得残留（已拿到 `inputId` 的必须被 DELETE）；关闭弹窗后不得继续发包；详情页无图时不出现空区块；图片请求失败不把详情页置为错误态。

## 不可变引用

- `API-55`–`API-58` 的路径、`RunInputView` 字段（`inputId/name/mediaType/sizeBytes/sha256/createdAt`）与状态码（201/204/400/409/413）；`DELETE` 对已绑定项返回 409。
- 启动端点 `POST /workflows/{id}/runs` 的既有字段与错误码；`inputs` 只传 `inputId` 列表，不把图片字节放进启动请求或 prompt。
- 本地限制 8 张 / 单张 8 MiB / 合计 20 MiB；类型闭集不含 SVG。
- `DF.modal.form` / `DF.field` / `DF.toast` 的展示语义；`shared/http` 的 `ApiError{status,code,details}` 错误形状（上传经 XHR 归一为同一形状）。
- 运行详情既有画布布局与轮询；初始资料区块只读，不参与确认/决策。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1（`tools/fake-b1.js` 增加 `run-inputs` 暂存/绑定/内容与失败注入；粘贴/拖放用合成事件 + 伪 `clipboardData`/`dataTransfer` 载荷）。逻辑层：`node --test tests/shared`（暂存校验、并发 3、顺序、回滚、上传错误归一）。可执行：`node tools/verify-m1-scenarios.js SCN-0024`。最近一次执行：2026-11-19，6/6 通过；`node --test tests/shared` 27/27。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0024-T1 | 正 | 粘贴/拖放/选择各 1 张后附件栏 3 张、计数「已选 3/8」；上传请求数为 0；纯文本粘贴不被 `preventDefault`；删除 1 张后剩 2 张且 `DELETE` 数为 0 | `tools/verify-m1-scenarios.js#scn0024T1` |
| SCN-0024-T2 | 正 | 选 3 张删中间 1 张后提交：上传 2 次、`start.inputs` 2 项且顺序 = 列表顺序；成功后详情出现「初始资料（2）」与 2 个指向 `/content` 的缩略图 | `tools/verify-m1-scenarios.js#scn0024T2` |
| SCN-0024-T3 | 正 | 无初始资料的运行详情不渲染 `#id-inputs`，轨迹图正常、无页面错误 | `tools/verify-m1-scenarios.js#scn0024T3` |
| SCN-0024-T4 | 反 | 一次选择 9 张：只保留 8 张，toast「最多 8 张图片」，无上传请求 | `tools/verify-m1-scenarios.js#scn0024T4` |
| SCN-0024-T5 | 反 | 上传返回 500：toast「上传失败」、弹窗与本地缩略图保留、服务端无暂存项、按钮恢复「发起运行」；重试后重新上传并绑定成功 | `tools/verify-m1-scenarios.js#scn0024T5` |
| SCN-0024-T6 | 反 | 启动返回 409 `client_unsupported`：toast 含「暂不支持图片」、已上传项被 `DELETE`、本地缩略图保留；重试后启动成功并绑定 1 张 | `tools/verify-m1-scenarios.js#scn0024T6` |
