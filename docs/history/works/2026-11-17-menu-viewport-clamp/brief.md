---
layer: history
module: global
status: frozen
updated: 2026-11-17
---

# 工序：底部菜单视口钳制修复

## 需求

- `REQ-0016`：工作流列表同源接入（卡片「更多」菜单可用性）。

## 背景

工作流列表卡片右下角「更多」菜单在页面靠下位置弹出时，底部菜单项落到窗口外，用户无法点选。根因是 `DF.menu` 把物理视口 `innerHeight` 与菜单 CSS 高度 `offsetHeight` 直接比较；zoom 路径下 fixed 菜单随 html zoom 放大，坐标系未统一，纵向钳制失效。横向同理存在隐患。

## 目标

1. `DF.menu` 在 zoom 路径下用 `innerWidth/Height / zoomK` 与 `offsetWidth/Height` 比较，横向与纵向都整体钳入视口。
2. 保持 `alignRight` 右缘语义与 transform 兜底路径不变。
3. `SCN-0018-T3` 增补底部触发断言；文档与坑档案同步。

## 非目标

- 不改菜单视觉样式、菜单项与触发方式；不改其他页面的菜单调用方。
- 不新增依赖。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-MENU-01 | fix | `CMP-ui-shell` | 完成 | `assets/js/ui.js` 的 `menu()` |
| T-MENU-02 | test | `CMP-workflow-list` | 完成 | `tools/verify-workflow-list.js`（SCN-0018-T3） |
| T-MENU-03 | doc | global | 完成 | `REQ-0016`、`SCN-0018`、`workflow-list`/`ui-shell` 规格、`code-refactoring`、`pitfalls` |

## 验收标准

1. 在视口底部触发卡片「更多」，菜单整体在视口内（顶部 ≥0、底部 ≤ innerHeight）。
2. `SCN-0018` 15/15；`npm test` 通过。
