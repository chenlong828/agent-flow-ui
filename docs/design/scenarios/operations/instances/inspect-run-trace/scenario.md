---
layer: design
module: instances
status: verified
flow: inspect-run-trace
scenario: SCN-0023
updated: 2026-11-19
---

# SCN-0023 运行轨迹图与编辑器画布同源

> 需求：`REQ-0028`。运行轨迹图仍使用 `RunDetail.graph` 冻结快照（`REQ-0027`），本场景只统一「同一份图怎么画」。

## 入口

- `CMP-instances/assets/js/pages/instance-detail.js#paint`
- `CMP-instances/assets/js/run/views/run-canvas.js#paintCanvas`
- `CMP-instances/pages/instance-detail.html?id=<runId>`
- 共享几何：`shared/canvas-geometry`（编辑器与运行页共用）

## 运行序

1. 打开运行详情：`GET /runs/{id}` 返回 `RunDetail.graph`（与 B3 `WorkflowGraph` 同形），经 `toEditorGraph` 得到 `x/y`、`inSide/outSide`、阶段框与 `viewport`；`run.graph` 缺失才回退当前工作流图，两者都没有时显示无图占位。
2. 画布先按内容包围盒设置尺寸，再把 `#cvScaler` 设成 `translate(viewport.x px, viewport.y px) scale(viewport.zoom)`；与编辑器保存时的视口一致，运行页不提供缩放/平移控件，溢出由画布容器滚动。
3. 连线：`edgeSides` 先按节点 `outSide/inSide` 取贴边，缺省按两节点中心相对位置自动选边，同一节点入边与出边落在同一边时错开到未占用的边；`edgePath` 输出 seq 曲线或 rollback 回退曲线。seq 边带灰色箭头，rollback 边为紫色虚线、紫色箭头并在回退源节点下方显示「↺ 回退」。
4. 节点按 `run.nodes` 最新 `visit` 着色、副标题显示状态与轮次；单击选中、双击打开节点详情弹层。节点 HTML 与状态着色仍归 `run/views/run-canvas.js`，不与编辑器共享。

失败路径：`viewport` 缺失或字段非法时按 `normalizeViewport` 的默认值（`0,0,0.85`）渲染；节点 `layout.inSide/outSide` 不在 `top|right|bottom|left` 内时按自动选边，不产生 `NaN` 或空 `d`；`run.graph` 与回退工作流都缺失时显示「该运行没有可用的图快照」占位，不进入整页错误；运行图仍按快照渲染，不因当前工作流已更新而改写。

## 不可变引用

- `RunDetail.graph` / B3 `WorkflowGraph`：`stages/nodes/edges` + 可选 `viewport`；节点 `layout.x/y`、`layout.inSide/outSide` 为前端布局字段，后端透传。
- 编辑器契约：`shared/canvas-geometry` 的 `NODE_W/NODE_H/NODE_SIDES`、`portPos/autoSides/edgeSides/edgePath/canvasSize/edgeMarkers/rollbackLabelPos/viewportTransform`；编辑器连线路径以基准 `d` 锁定，本次不得改变。
- `DF.renderShell`、`DF.tag`、`DF.dot`、`DF.icon` 与 `run/node-meta` 的状态样式映射。
- `RunDetail.graph` 冻结快照语义（`REQ-0027`）：运行页不因工作流后续保存而换图。

## 测试

执行层：Playwright WebKit + 本地静态 HTTP + fake B1/B3（`tools/fake-b1.js` 注入 run 夹具，`tools/fake-b3.js` 注入同一份工作流图；跨页比对编辑器与运行详情的 `path` 的 `d`）。可执行：`node tools/verify-m1-scenarios.js SCN-0023`。最近一次执行：2026-11-19，4/4 通过（T1 编辑器/运行页 5 条边路径逐字一致；T2 箭头/虚线/回退标签；T3 保存视口 0.8+(16,12)；T4 非法视口与锚点回落且无 NaN）。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0023-T1 | 正 | 同一份含 `inSide/outSide`、rollback 与 `viewport` 的图：编辑器与运行详情渲染出的 5 条边 `d` 顺序与字符串完全一致，且 seq/rollback 路径与基准值逐字相等；运行页不再出现「实现→方案评审」式的横穿兜底曲线 | `tools/verify-m1-scenarios.js#scn0023T1` |
| SCN-0023-T2 | 正 | 运行页 4 条 seq 边均带 `marker-end=url(#arw)` 与灰箭头定义，rollback 边为 `.e-rb` 紫色虚线并带 `marker-end=url(#arw-rb)`，节点下方显示「↺ 回退」；`path.e-rb` 的 `stroke-dasharray` 非空 | `tools/verify-m1-scenarios.js#scn0023T2` |
| SCN-0023-T3 | 正 | 运行页 `#cvScaler` 的 `transform` 等于保存视口（`translate(16px,12px) scale(0.8)`），节点屏幕宽度约 `168×0.8=134.4px`，且两节点屏幕水平距离按 0.8 缩放；与编辑器同视口下的节点宽度一致 | `tools/verify-m1-scenarios.js#scn0023T3` |
| SCN-0023-T4 | 反 | `viewport` 为非法值、节点 `inSide` 为 `sideways` 时按默认视口 `translate(0px,0px) scale(0.85)` 与自动选边渲染：边路径不含 `NaN`、箭头与「↺ 回退」仍在，页面无运行时错误，不显示无图占位 | `tools/verify-m1-scenarios.js#scn0023T4` |
