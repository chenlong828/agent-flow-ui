---
layer: plan
module: global
status: current
updated: 2026-10-23
---

# 路线图

## 里程碑

| 里程碑 | 内容 | 状态 | 关联 |
|---|---|---|---|
| M1 | 12 页高保真原型（列表/编辑器/四类资产/实例/看板/工作区/Key） | 已完成 | `design/components/` 各规格 |
| M2 | 全局外壳交互（用户区显示与下拉菜单） | 已完成 | `REQ-0001` / `SCN-0001` |
| M3 | 开放问题裁定：OQ-1~OQ-6 逐条转需求或决策 | 待排 | `plan/open-questions.md` |
| M4 | 组件基线与门禁（方案 A）：11 个模块卡、architecture 现行真相、check-docs 增强 | 已完成 | `history/works/2026-10-23-component-baseline/` |

> **M1 口径（2026-10-23 用户确认）**：M1 的 10 个页面组件登记为「原型基线、无 REQ 追溯」，验收只有 12 页 jsdom 冒烟；不补 10 张 REQ，也不把冒烟当业务验收。仅为**后续真正改行为**的页面新建场景；原计划的 4 条旅程 SCN 转为欠账，不假装完成。详见 `plan/risks.md` R7。

## 工序与依赖

- 一个 REQ 同一时刻只允许一个在飞工序；开工即在 `works/` 建目录并写 brief（引 REQ ID）。
- M3 的每条裁定先落需求卡，再排工序；裁定前不新增页面。
- 无用户旅程的文档/债务活走旁路，不进 `requirements/`。

## 当前在飞

无。
