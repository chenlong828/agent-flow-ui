---
layer: works
module: global
status: active
updated: 2026-11-12
---

# 工序：列表分页统一提案（待裁）

## 需求

旁路（提案，未立项）。用户 2026-11-12 指示：前台大多数列表不支持分页，先整理需求并向调度层提交提议；同时明确「分页暂时不增加，以后再做」。

## 背景

前台 13 页中，工作流列表已按 B3 分页（20/页），其余 5 个 live 列表（运行实例、Skill、专家、Harness、工具）都以 `limit=200` 一次拉全量，再在浏览器内搜索/筛选/分组；B1/B3/B4 的列表端点都已返回 `{items,total,limit,offset}`（默认 50、上限 200）。问题不是「没有分页能力」，而是超过 200 条后静默截断、搜索不全、统计与行数不一致。

MOCK 三组页面（效能看板、工作区两页、Key）已按 `REQ-0018` 默认关闭，其分页不占本轮范围。

## 目标 / 非目标

- 目标：给出影响面、方案选项、推荐批次与验收口径，提交 `plan/roadmap.md`（候选批次）与 `plan/open-questions.md`（OQ-9）裁定。
- 非目标：本工序不写代码、不改组件、不建 REQ/SCN；裁定后才转需求与实现工序。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 |
|---|---|---|---|---|
| `T-PAGE-01` | design | global | 已完成 | 盘点 6 个 live 列表的取数、筛选位置与截断风险 |
| `T-PAGE-02` | doc | global | 已完成 | 提案落 `proposal.md`，写入 roadmap 候选批次与 OQ-9 |
| `T-PAGE-03` | design | global | 待裁 | 用户裁定范围/方式/批次后，转 REQ + SCN 并开实现工序 |

## 验收标准

1. 每个受影响列表的现状与缺口可核对到源码/契约。
2. 方案对比含推荐项与否决理由。
3. 提案进入调度层：`roadmap.md` 有候选批次，`open-questions.md` 有 OQ-9，`risks.md` 有对应风险。
4. 不产生代码改动，不新增 REQ/SCN。

## 装载清单（必读）

- `docs/works/2026-11-12-list-pagination-proposal/proposal.md`
- `docs/design/architecture.md` §2/§4
- `docs/design/components/{workflow-list,instances,skills,experts,harnesses,tools}/spec.md`
- 后端：`agent-flow-orchaster/src/core/kernel/pagination.ts`、`docs/design/components/http-gateway/spec.md`
