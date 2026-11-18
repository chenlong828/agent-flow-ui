---
layer: design
module: run-files
component: CMP-run-files
requirement: REQ-0022
scenario: SCN-0021
status: active
updated: 2026-11-18
---

# 运行任务文件（只读）

> 导航：运行与运营 / 运行实例 → 节点弹层文件 Tab | 形态：L2 只读视图（无独立页面） | 前置：`design/components/run-data/spec.md`、`design/components/instances/spec.md`

## 0 模块卡

- 状态：active（2026-11-18 随 `REQ-0022` 实现）
- 单元 / 层：组件 / L2 页面视图
- 业务价值：运行观察者要在运行详情内直接确认 task-space/workspace 产物是否存在、内容是否正确；没有它，只能下载会话日志或回到执行机找文件。
- 负责 / 不负责：负责根切换（`task-space`/`workspace`）、面包屑、目录懒加载、文件只读预览、加载/空/错误态与 `path_escape` 回根；不负责取数端点、run 状态机、文件编辑/上传/删除、终端、二进制预览。
- 内部逻辑：`mountRunFiles` 建一次壳；`listFiles` 列当前目录，目录点击下钻、文件点击 `readFile`；`.md`/`text/markdown` 用 `renderMarkdown`，其他文本用 `<pre>` + 语言标签；`reason=binary|too_large` 显示原因与大小；`truncated` 显示截断提示；每次新请求 abort 旧请求；`unmount` abort 在飞请求并清空 DOM。
- 数据所有权：无持久化；只持有当前 `root/path/selected` 视图态，经 `getState()` 交还页面保存；业务数据仍由后端拥有，本组件不缓存。
- 公开契约：`mountRunFiles(container, { runId, root = 'task-space', path = '', selectedPath }) -> { unmount(), getState() }`；`getState()` 返回 `{root, path, selectedPath}`。
- 依赖：`DF`（`esc/icon/fmtBytes/toast/kv`）、`CMP-run-data#listFiles/readFile`、`shared/markdown#renderMarkdown`；不 import 页面、不直接 `fetch`。
- 冷热属性：热（用户点击目录/文件），无后台轮询、无缓存；失败快速返回错误态。
- 变化轴：文件 DTO 字段、预览类型（Markdown/文本/二进制）、root 集合；变化集中在视图预览分支与 `run-data`。
- 验证入口：`node tools/verify-node-observability.js`（SCN-0021-T1/T2/T5）。
- 验证计划：根切换与面包屑；目录懒加载；`.md` 渲染；代码语言标签；二进制/超大/截断文案；跨 Tab 恢复 `root/path/selected`；`503 client_observability_unavailable` 错误态与重试；`path_escape` 分支由 `errorText` 单测覆盖（`tests/shared/run-data.test.js`）。
- 预算：源码约 10 KB + 规格约 4 KB，远低于 120k token。
- 单独运行：`node tools/verify-node-observability.js`。
- 删除测试：删除后节点弹层与页头「任务文件」都无法浏览产物，只能看结论/日志；复杂度回流到 `CMP-instances`，故保留独立视图。
- 已知偏差：代码高亮只显示语言标签，不引入 Prism；二进制/超大文件只显示原因与大小；不提供下载原文件（本阶段只读预览）。

## 1 契约与生命周期

```js
const view = mountRunFiles(container, { runId, root, path, selectedPath });
view.getState(); // { root, path, selectedPath }
view.unmount();  // abort 在飞请求、关闭 DOM
```

- `root` 只接受 `task-space|workspace`；非法值回落 `task-space`。
- `selectedPath` 用于切 Tab 重挂载后恢复选中文件；目录不存在时只恢复到目录。
- 页面负责在切 Tab 时保存 `getState()`、重挂载时传入；视图内部不持久化。

## 2 预览规则

| 文件 | 行为 |
|---|---|
| `language=markdown` / `text/markdown` / `.md` | `renderMarkdown` 渲染为 `.md-body` |
| 其他文本（`content` 非空） | `<pre class="rf-pre"><code>` 原样转义；头部显示语言标签 |
| `reason=binary` | 「二进制文件，暂不支持预览」+ 大小 |
| `reason=too_large` | 「文件超过 1 MiB 预览上限」+ 大小 |
| `truncated=true` | 预览上方提示「文件超过 1 MiB，已截断显示」 |
| 目录列表 `truncated=true` | 「目录条目超过 2000 条，仅显示前 2000 条」 |

## 3 测试

| 场景 | 断言 |
|---|---|
| `SCN-0021-T1` | 页头与节点文件 Tab 列 task-space；根切换；面包屑回根；`.md` 渲染 |
| `SCN-0021-T2` | 代码语言标签；二进制/截断文案；目录懒加载；跨 Tab 恢复目录 |
| `SCN-0021-T5` | `503 client_observability_unavailable` 错误文案与重试；无 sessionId |
