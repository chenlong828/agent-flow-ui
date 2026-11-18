---
layer: history
module: instances
status: frozen
updated: 2026-11-18
---

# 工序：执行会话概览与事件筛选（REQ-0023）

## 需求

- `REQ-0023`：执行会话概览与事件筛选；扩展 `SCN-0021` T7。
- 前置：`REQ-0022` / `SCN-0021`（会话视图已接入 API-50/51/52/53）。

## 背景

真实会话 `01a1ea62…/n2` 有 217 条事件：66 次工具调用、42 次 usage、37 段 thinking、2 段消息、2 条 phase；当前视图只显示 6 行 kv 和逐条事件，看不出工具分布、Token 与异常，且只取第一页 199/217。

## 验收标准

1. 概览：时长、事件总数/已载入/速率、工具调用数/完成率/Top、Token 当前/总量/百分比/增量、思考/消息数、归档。
2. 分页：按 `nextCursor` 拉取至多 1000 条；显示已载入/总数；超出标「已截断」。
3. 默认「活动」：隐藏 usage/thought，相邻 tool_call+tool_call_update 合并为一行（工具名/状态/耗时/seq 范围）。
4. 筛选：全部/工具/思考/消息/用量/阶段；搜索消息、事件名、工具名。
5. `SCN-0021-T7` 通过；原 T1–T6 不回归；真实 217 条会话走查可读。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0023-01 | change | `CMP-run-session` | 已完成（2026-11-18） | `assets/js/run/views/session.js`、`pages/instance-detail.html`、`run-session/spec.md`、`SCN-0021` |
| T-0023-02 | change | fake B1/测试 | 已完成（2026-11-18） | `tools/fake-b1.js`（分页 + 217 条夹具）、`tools/verify-node-observability.js`、`SCN-0021-T7` |

## 装载清单（必读）

- `docs/requirements/REQ-0023-session-overview.md`
- `docs/design/scenarios/operations/instances/inspect-node-observability/scenario.md`
- `docs/design/components/run-session/spec.md`
- `assets/js/run/views/session.js`、`pages/instance-detail.html`
- `tools/fake-b1.js`、`tools/verify-node-observability.js`

## 确认

- 2026-11-18 用户选择 A 档（概览 + 筛选/合并），事件列表默认合并/折叠；不做事件详情展开与后端字段扩展。
