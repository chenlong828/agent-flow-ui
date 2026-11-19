---
layer: history
module: instances
status: frozen
updated: 2026-11-19
---

# 工序：运行轨迹图与编辑器画布同源（REQ-0028）

## 需求

`REQ-0028`（quality）；验收场景 `SCN-0023`（T1–T4），回归场景 `SCN-0019`（不新增断言）。

## 背景

运行详情画布 `run/views/run-canvas.js` 与编辑器画布 `workflow/views/canvas.js` 各自实现了一套连线几何：运行页固定从节点右边框出、左边框进，不读 `node.layout.inSide/outSide`，不做同节点进出锚点错开，不画箭头与「回退」标签，也不套用保存的 `viewport`。用后端真实工作流（10 节点 / 12 条边）对照，两套渲染器 12 条边里 9 条路径不同，运行页 0 个箭头。

## 定级与确认

- 级别：**P1**。新增共享视图模块 `shared/canvas-geometry.js`，把连线几何的所有权从 `workflow/views/canvas.js` 移到共享层，并新增「运行详情 → 共享几何」的依赖边；属于模块切分与分层依赖变更。
- 人工确认：2026-11-19 用户在方案 A/B/C 中选择 **B**（共享几何 + 运行页套用保存视口），确认了模块切分、契约范围与运行页视口行为。
- 决策：保留 `RunDetail.graph` 冻结快照，不把运行页改成实时工作流图。

## 候选与否决

| 候选 | 结论 | 理由 |
|---|---|---|
| 运行页直接 import `workflow/views/canvas.js#edgeSvg` | 否决 | 同层横调；`edgeSvg` 绑定编辑器选中、错误红框、`hit` 热区与拖拽预览，运行页没有这些状态，硬接会把编辑器专属标记带进只读页 |
| 新增 `shared/canvas-geometry.js` 共享纯几何，两边各自组装 SVG | **采用** | 几何只有一份；节点 HTML/状态着色/交互仍归各自视图，变化轴分离；`shared` 不依赖任何页面或域模型 |
| 只在运行页补箭头与「回退」标签 | 否决 | 锚点仍固定右边框→左边框，横穿画布的问题不解决，只是修饰 |

## 设计要点

- 共享层只导出纯函数与常量：`NODE_W/NODE_H/NODE_SIDES`、`canvasSize`、`portPos`、`autoSides`、`edgeSides`、`edgePath`、`edgeMarkers`、`rollbackLabelPos`、`viewportTransform`；不碰 DOM、网络、页面状态。
- 编辑器 `edgeSvg` 保留选中/hit/预览/错误标记的组装，内部改用共享函数；连线路径输出必须与改造前逐字相同（基准 `d` 锁定）。
- 运行页 `paintCanvas` 用共享函数画边、加箭头/回退标签，并把 `#cvScaler` 的 transform 设为保存的 `viewport`；页面新增 `#cvScaler` 包裹层与 `transform-origin:0 0`。
- 不新增 API 字段与依赖；`inSide/outSide` 非法值继续由 `toEditorGraph` 归一为 `null`，几何层按自动选边处理。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0028-01 | design | instances / workflow-editor | done | `docs/requirements/REQ-0028-*.md`、`design/components/{instances,workflow-editor}/spec.md`、`workflow/model.js`、两套 canvas |
| T-0028-02 | change | shared / workflow-editor | in_progress | `shared/canvas-geometry.js`、`workflow/views/canvas.js`、`workflow-editor.js`、`tests/workflow/*` |
| T-0028-03 | change | instances | pending | `run/views/run-canvas.js`、`instance-detail.js`、`pages/instance-detail.html`、`tests/shared/*` |
| T-0028-04 | verify | instances | pending | `tools/fake-b3.js`、`tools/verify-m1-scenarios.js`、`tools/verify-workflow-editor.js` |

> 三个 change 任务在同一个交付里顺序执行、一个 commit：共享几何没有消费者就不可验收，编辑器与运行页必须同时切换；组件级 WIP 由本次单一工序占用。

## 验收标准

- `SCN-0023` 4/4 通过（Playwright WebKit，跨页比对 `d`）。
- `SCN-0019` 24/24 回归通过（编辑器连线、箭头、选边不变）。
- `node --test tests/shared tests/workflow` 通过。
- `npm run test:gate` 全绿；`npm run check:architecture`、`check:docs`、`docs:index:check`、`check:scenario-trace` 全绿。

## 领取的开放问题

无。
