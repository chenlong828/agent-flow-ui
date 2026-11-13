---
layer: history
module: global
status: frozen
updated: 2026-11-13
---

# 工序：Skill 行菜单重复打开与视口定位修复

## 需求

延续 `REQ-0005` / `SCN-0005`（Skill 列表行菜单）与 `REQ-0001` / `SCN-0001`（共享 `DF.menu`）；不新立需求卡。用户 2026-11-13 报告：Skill 列表右侧「更多」菜单点击几次后不再弹出；菜单部分越出窗口边缘，需要往内容区收。

## 背景

`DF.menu` 用 `setTimeout` 在当前点击派发结束后挂 `document.addEventListener('click', closeMenu, { once: true })`；打开新菜单时未摘除上一次的监听器。Skill 行菜单没有 `stopPropagation`，连续点击触发按钮时，旧的 once 监听器在本次点击冒泡阶段把刚打开的新菜单关掉，表现为「点几次后不再弹出」。定位只用 `Math.min(x, innerWidth - 160)` 钳左缘，未按实际宽高和底边钳制，最后一行菜单会落到视口外。

## 目标 / 非目标

- 目标：同一触发按钮可连续打开菜单；菜单按实际宽高整体钳入视口（四边 16px）；Skill 行菜单右对齐触发按钮向左展开。
- 非目标：不改菜单视觉样式与项语义；不改各页面菜单项；不引入依赖。

## 定级

P3：共享组件内的小修，不触碰组件切分、公共契约 schema、数据所有权或热路径。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 |
|---|---|---|---|---|
| `T-MENU-01` | change | `CMP-ui-shell` | 完成 | `ui.js` 菜单关闭监听器生命周期 + 四边钳制 |
| `T-MENU-02` | change | `CMP-skills` | 完成 | `skills.js` 行菜单右对齐锚点 |
| `T-MENU-03` | verify | 两组件 | 完成 | SCN-0005-T5 + 回归 SCN-0001/0011/0018 |

## 装载清单（必读）

- `assets/js/ui.js` `menu()/closeMenu()`
- `assets/js/pages/skills.js` `rowMenu()`
- `docs/design/components/ui-shell/spec.md`
- `docs/design/scenarios/assets/skill-library/manage-skill/scenario.md`
- `tools/verify-m1-scenarios.js`（SCN-0005）、`tools/verify-user-menu.js`

## 验收标准

1. SCN-0005-T5 通过：同一按钮连续点击仍弹出；菜单四边在视口内；右缘对齐触发按钮。
2. SCN-0005 5/5、SCN-0001 45/45、SCN-0018 14/14、M1 全量通过。
3. `npm run test:gate` 与 `npm run check:docs` 通过。
