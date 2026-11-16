---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 工序：节点详情改双击 90% 弹层

## 需求

- `REQ-0020`：节点详情双击 90% 弹层（本工序的主需求）。
- `REQ-0017`：工作流编辑器同源接入（属性编辑交互调整）。
- `REQ-0019`：运行实例同源接入（节点详情交互调整）。

用户 2026-11-17 指示：工作流编辑器与运行实例的查看不再使用右侧抽屉/右侧面板，改为双击节点/元素后弹层展示；弹层为界面 90% 高度、90% 宽度，内容超出后内部滚动。随后补充：运行实例的节点消息已在大弹层展示，去掉原来的二次「全屏」入口。

## 背景

两页此前的详情形态不一致：工作流编辑器单击节点即打开 380px 属性抽屉（无遮罩）；运行实例详情常驻 410px 右侧节点面板，节点消息另有整屏「全屏」浮层。右侧区域挤占画布宽度，且大屏下内容展示面积不足。统一为双击打开的 90% 视口大弹层后，画布恢复全宽，节点消息无需二次全屏。

## 目标

1. `DF.modal` 增加 `size:'screen'`：宽高各为视口 90%，头部/底部固定，主体在内容超高时内部滚动，窗口 resize 时重算，Esc/遮罩/× 关闭。
2. 工作流编辑器：单击只选中，双击节点/阶段/连线打开属性弹层；移除右侧抽屉；新增节点/阶段只选中不自动弹层；阶段标题单击不置 dirty。
3. 运行实例详情：移除右侧节点面板；单击只选中，双击节点打开节点详情弹层（概要/会话日志/人工确认）；节点消息与确认说明不再提供二次「全屏」。
4. 场景断言同步更新，`SCN-0019`、`SCN-0004` 保持 `verified`。

## 非目标

- 不改运行/工作流数据结构与 API。
- 不改其他页面继续使用的 `DF.drawer`。
- 不引入新依赖。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-NDM-01 | change | `CMP-ui-shell` | 完成 | `assets/css/main.css`、`assets/js/ui.js`、`docs/design/components/ui-shell/spec.md` |
| T-NDM-02 | change | `CMP-workflow-editor` | 完成 | `assets/js/pages/workflow-editor.js`、`pages/workflow-editor.html`、`tools/verify-workflow-editor.js`、`SCN-0019` |
| T-NDM-03 | change | `CMP-instances` | 完成 | `assets/js/pages/instance-detail.js`、`pages/instance-detail.html`、`tools/verify-m1-scenarios.js`、`SCN-0004` |
| T-NDM-04 | verify | global | 完成 | `node tools/verify-workflow-editor.js`、`node tools/verify-m1-scenarios.js SCN-0004`、`npm test` |
| T-NDM-05 | doc | global | 完成 | 两组件规格、两场景、`REQ-0017`/`REQ-0019` 澄清记录、`ui-shell`/`architecture`/`product`/`code-refactoring` |

## 验收标准

1. 编辑器：单击不弹层；双击节点/阶段打开 `.modal-screen`，宽高与视口 90% 误差 ≤2px；视口变矮后高度重算且 `.d-body` 内部滚动；Esc 关闭；新增节点不再遮挡调色板。
2. 运行实例：页面无 `#id-panel`；未双击不出现节点详情；双击节点打开 90% 弹层；内容超高时内部滚动；无 `[data-md]`/`.id-full` 二次全屏；批准/驳回仍可完成。
3. `SCN-0019` 24/24、`SCN-0004` 5/5；`npm test` 通过；`check-docs` 通过。
