---
layer: history
module: global
status: frozen
updated: 2026-11-19
---

# 决策：画布几何下沉为共享模块，运行轨迹图复用并套用保存视口

## 背景与问题

运行详情与工作流编辑器的画布各自实现了一套连线几何。编辑器支持保存的 `node.layout.inSide/outSide`、自动选边、进出锚点错开、seq 箭头、rollback 虚线与「↺ 回退」标签，并按保存的 `viewport` 缩放；运行页固定从节点右边框出、左边框进，不做这些处理，也不读视口。

用后端真实工作流（10 节点 / 12 条边）对照，两套渲染器 12 条边里 9 条路径不同，运行页 0 个箭头、0 个回退标签。用户报告「执行过程中的流程图和保存时不一样，主要是连线没有同步」。

## 决策

1. 新增 `assets/js/shared/canvas-geometry.js`，承载 `NODE_W/NODE_H/NODE_SIDES`、`canvasSize`、`portPos`、`autoSides`、`edgeSides`、`edgePath`、`edgeMarkers`、`rollbackLabelPos`、`viewportTransform`；纯函数，无 DOM/网络/页面状态。
2. 编辑器 `workflow/views/canvas.js` 与运行页 `run/views/run-canvas.js` 都改为调用共享几何；各自只保留节点 HTML、状态着色、选中/命中/预览/错误标记等专属组装。
3. 运行页按 `RunDetail.graph.viewport` 设置 `#cvScaler` 的 transform，与保存时编辑器一致；不提供缩放/平移控件。
4. `workflow/model` 的 `NODE_SIDES` 改为从共享几何转出，保持单一来源。
5. 运行图仍使用 `RunDetail.graph` 冻结快照（`REQ-0027` 不变），不改成实时工作流图。

## 候选与否决

- 运行页直接 import 编辑器 `edgeSvg`：否决。同层横调，且 `edgeSvg` 绑定编辑器选中/hit/预览/错误标记，只读页没有这些状态。
- 只给运行页补箭头与回退标签：否决。锚点仍然固定右边框→左边框，横穿画布的问题不解决。
- 共享几何 + 各自组装（采用）：几何只有一份，节点与交互仍按页面分轴演进。

## 影响

- 编辑器连线输出逐字不变，由 `tests/workflow/canvas.test.js` 的基准路径锁定；`SCN-0019` 24/24 回归通过。
- 运行页新增跨页一致性验收 `SCN-0023`（4/4）与 `tests/shared/canvas-geometry.test.js`。
- 依赖新增「工作流两页 / 运行详情 → `shared/canvas-geometry`」，已登记到 `design/architecture.md`。
- 不新增运行时依赖、不改 API、不改 B3/B4 字段。

## 确认

2026-11-19 用户在方案 A/B/C 中选择 B（共享几何 + 运行页套用保存视口），确认模块切分与运行页视口行为；P1 人工确认门通过。
