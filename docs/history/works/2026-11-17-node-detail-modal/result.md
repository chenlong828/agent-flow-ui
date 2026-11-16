---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 结果：节点详情改双击 90% 弹层

## 1 结论

工作流编辑器和运行实例详情不再使用右侧抽屉/右侧面板：单击只选中，双击节点/阶段/连线/节点打开 90% × 90% 视口弹层，内容超出时在弹层主体内部滚动。运行实例节点消息原先的二次「全屏」入口已移除（详情本身已是大弹层）。两页对应的 `SCN-0019`、`SCN-0004` 保持 `verified`。

## 2 验收结果

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 工作流编辑器场景 | `node tools/verify-workflow-editor.js` | 24/24 通过（新增 T1 单击/双击/弹层尺寸与滚动断言） |
| 运行实例场景 | `node tools/verify-m1-scenarios.js SCN-0004` | 5/5 通过（T2 弹层 90%/内部滚动/无全屏，T3/T4 双击进入） |
| M1 全量 | `node tools/verify-m1-scenarios.js` | 52 passed, 0 failed |
| 全量门禁 | `npm test` | 通过（语法/文档/索引/依赖/架构/场景追溯/BFF 12/12/冒烟 13/13/M1/工作流） |
| 视觉证据 | `.local-only/node-detail-modal/{editor-modal,run-modal,run-small}.png` | 1440×900 视口下弹层 1296×810（90%/90%）；500px 高视口下弹层跟随重算 |

## 3 结论落点

| 产物 | 落点 |
|---|---|
| 90% 大弹层能力 | `DF.modal.open({ size: 'screen' })`：`assets/js/ui.js`、`assets/css/main.css`（`.modal-screen`） |
| 编辑器属性弹层 | `assets/js/pages/workflow-editor.js`、`pages/workflow-editor.html`；规格 `docs/design/components/workflow-editor/spec.md` |
| 运行实例节点弹层 | `assets/js/pages/instance-detail.js`、`pages/instance-detail.html`；规格 `docs/design/components/instances/spec.md` |
| 场景 | `SCN-0019`（`docs/design/scenarios/flow/workflow-editor/edit-workflow-live/scenario.md`）、`SCN-0004`（`docs/design/scenarios/operations/instances/control-instance/scenario.md`） |
| 需求记录 | `REQ-0020`（节点详情双击 90% 弹层）；`REQ-0017`、`REQ-0019` 澄清记录 |
| 全局约定 | `docs/design/components/ui-shell/spec.md`、`docs/design/architecture.md`、`docs/design/product.md`、`docs/design/code-refactoring.md` |
| 测试 | `tools/verify-workflow-editor.js`、`tools/verify-m1-scenarios.js` |

## 4 偏差与未覆盖

- 弹层尺寸按打开/窗口 resize 时重算；页面字体缩放档位在弹层打开期间不可操作（顶栏被遮罩覆盖），未单独验证“弹层打开时切换字号”的极端路径。
- 工作流编辑器删除节点/阶段走 `DF.modal.confirm`；确认框会先关闭属性弹层，取消后需重新双击打开属性。该行为与 `DF.modal` 单实例语义一致，未改为内联确认。
- 画布上双击连线通过 `path.hit` 中点坐标点击验证（打开「连线属性」）；节点、阶段、连线三种元素均已覆盖。
- 运行实例轮询期间弹层保持打开并按最新 run 数据重绘；未验证弹层打开时 run 被外部删除的极端路径（节点不存在时关闭弹层）。
