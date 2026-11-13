---
layer: history
module: global
status: frozen
updated: 2026-11-13
---

# 结果：Skill 行菜单重复打开与视口定位修复

## 结论

`DF.menu` 的 document 关闭监听器改为可摘除的单例：打开新菜单前先 `removeEventListener`，关闭时同步摘除，连续点击同一触发器不再被上一次的 once 监听器关掉。定位改为菜单挂载后按实际宽高钳入视口四边（16px），底边不再越界。Skill 行菜单由左缘锚定改为右缘锚定（`r.right` + `alignRight`），向左展开进内容区。

## 验收

| 项 | 结果 |
|---|---|
| `node tools/verify-m1-scenarios.js SCN-0005` | 5/5 通过（新增 T5：重复点击仍弹出、右缘对齐、最后一行菜单不越出视口） |
| `node tools/verify-m1-scenarios.js` | 51/51 通过 |
| `node tools/verify-user-menu.js` | 45/45 通过（用户区下拉、旧调用方回归） |
| `node tools/verify-workflow-list.js` | SCN-0018 14/14 通过 |
| `npm run test:gate` / `npm run check:docs` | 通过 |

## 落点

`assets/js/ui.js`、`assets/js/pages/skills.js`、`tools/verify-m1-scenarios.js`、`docs/design/scenarios/assets/skill-library/manage-skill/scenario.md`、`docs/design/components/ui-shell/spec.md`、`docs/design/components/skills/spec.md`、`docs/requirements/REQ-0005-skills.md`、`docs/history/pitfalls.md`（JS-9）。

## 偏差

- 菜单只在视口内钳制，不做上下翻转；最后一行菜单会覆盖上方部分行内容，但四个菜单项均可见。
- 菜单打开时会覆盖相邻行的「更多」按钮（右对齐展开的固有取舍），切换行需先点菜单外收起。
