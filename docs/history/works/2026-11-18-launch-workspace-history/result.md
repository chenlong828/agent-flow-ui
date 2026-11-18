---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 结果：发起运行的工作区路径历史

## 1 结论

发起运行弹窗的工作区路径增加按执行节点（`clientId`）隔离的历史：localStorage `df-launch-workspace-paths` 保存每节点最近 10 条绝对路径，最近使用置顶、同路径去重，只在发起成功后写入。输入框保留手输，右侧下拉列出当前 Harness 对应执行节点的历史，列表项右侧小叉只删除该条历史；切换 Harness 只切换列表，不改写输入框。下拉在弹层主体内优先向下展开，空间不足时收窄或改向上，避免被 `.d-body` 裁切。

## 2 验收结果

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 运行实例场景 | `node tools/verify-m1-scenarios.js SCN-0004` | 8/8 通过（新增 T7 正例、T8 反例；T1–T6 不回归） |
| 全量门禁 | `npm test` | 通过（语法/风格/文档/索引/依赖/架构/场景追溯/BFF/冒烟/MOCK 页/M1/观测/工作流；M1 runner 55 passed、观测 8 passed） |
| 视觉 | `.local-only/launch-workspace-history/dropdown-1440.png`、`dropdown-hover-1440.png`、`dropdown-900.png` | 1440×900 下拉位于输入框下方、10 条列表内部滚动、长路径省略；900×640 下拉收窄后不被弹层主体裁切 |

## 3 结论落点

| 产物 | 落点 |
|---|---|
| 历史读写与下拉交互 | `assets/js/pages/instances.js`（`readWorkspaceHistory`/`rememberWorkspacePath`/`forgetWorkspacePath`、`mountWorkspacePicker`） |
| 下拉样式 | `assets/css/main.css`（`.ws-path*`） |
| 回归测试 | `tools/verify-m1-scenarios.js#scn0004T7`、`#scn0004T8` |
| 场景 | `SCN-0004`（8/8） |
| 需求 | `REQ-0024` |
| 规格 | `docs/design/components/instances/spec.md` §0/§2.3/§5 |
| 数据所有权 | `docs/design/architecture.md` §5 新增 `df-launch-workspace-paths` |
| 路线图 | `docs/plan/roadmap.md` M19 |

## 4 边界与未覆盖

- 不校验路径在执行节点上是否存在或可写；后端仍以请求体 `workspacePath` 为准。
- 历史只存本机 localStorage，清缓存/换浏览器/换设备后为空；不监听 `storage` 事件，另一标签页需重新打开弹窗才能看到最新历史。
- 按 `clientId` 隔离：同一执行节点被多个 Harness 引用时共用历史；Harness 未绑定 `clientId` 或未启用时不出现在可发起列表，也无历史。
- 极短视口下下拉可能走内部滚动；本次只按桌面视口验证（1440×900 / 900×640），不含移动端验收。
- 未改动后端入参、运行复用规则与 B4 业务数据。
