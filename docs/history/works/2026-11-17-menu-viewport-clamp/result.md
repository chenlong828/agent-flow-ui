---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 结果：底部菜单视口钳制修复

## 1 结论

`DF.menu` 的横向/纵向钳制改为在 zoom 路径下先换算视口坐标系：`innerWidth/Height / zoomK` 与菜单 `offsetWidth/Height` 比较；transform 兜底路径保持原语义。工作流列表卡片右下角「更多」菜单在视口底部触发时整体留在视口内，最大字号下不再向下溢出。

## 2 验收结果

| 项 | 命令/方式 | 结果 |
|---|---|---|
| 工作流列表场景 | `node tools/verify-workflow-list.js` | 15/15 通过（T3 新增底部触发菜单断言） |
| 全量门禁 | `npm test` | 通过（语法/文档/索引/依赖/架构/场景追溯/BFF/冒烟/M1/工作流） |
| 回归 | `node tools/verify-m1-scenarios.js` | 53 passed, 0 failed |
| 视觉 | `.local-only/node-detail-modal/` 已保存多轮弹层截图；菜单问题由 `SCN-0018-T3` 几何断言覆盖 | — |

## 3 结论落点

| 产物 | 落点 |
|---|---|
| 菜单钳制 | `assets/js/ui.js` `menu()`：`viewW/viewH` 与 `offsetWidth/Height` 同坐标系比较 |
| 回归测试 | `tools/verify-workflow-list.js`（SCN-0018-T3 底部菜单不出视口） |
| 场景 | `SCN-0018`（15/15） |
| 需求 | `REQ-0016` 澄清记录与状态 |
| 规格 | `docs/design/components/workflow-list/spec.md`、`docs/design/components/ui-shell/spec.md` |
| 全局约定 | `docs/design/code-refactoring.md` §4 `DF.menu` |
| 坑档案 | `docs/history/pitfalls.md` JS-11 |

## 4 边界与未覆盖

- WebKit 2104 的 html 级 zoom 探测失效，本机引擎测试只覆盖 transform 兜底路径；zoom 路径的修复依据项目既有 `DF.zoomK()` 归一约定，需在真实 Chrome/Safari 复验底部菜单。
- 只修 `DF.menu` 的定位数学；菜单视觉样式、调用方与 `alignRight` 语义未变。
- 菜单在极窄视口（小于菜单宽高 + 32px）下会被钳到 `margin`，可能覆盖触发器；这是原有策略，未改为滚动或强制换向。
