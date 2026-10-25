---
layer: works
module: bff
status: active
updated: 2026-10-25
---

# 工序：B1 资产同源接入

## 需求

`REQ-0012` / `SCN-0012`。

## 背景

B1 后端已提供 Harness / Tool / Skill / Expert 四类资产的完整 HTTP 契约，且专家聚合写、列表读模型已补齐。agent-flow-ui 仍是纯 MOCK 原型，需要新增同源 BFF 组件，随后把四个资产页切到 live API；其余 8 页继续 MOCK 并标注。

## 验收标准

- `CMP-bff` 同进程挂载在 `server.js`，只转发 `/api/v1/*` 与 `/healthz`，无 DTO 映射、无 revision 缓存、无重试。
- 后端可用时，经 3000 访问 `healthz` 与列表成功；后端停掉返回 502 JSON；无 CORS 头。
- 静态页面、现有 `npm test` 不回归；BFF 单测覆盖透传、错误、超时、body 上限、路径越界。
- P2/P3：四类资产页切 live API，写操作带 `If-Match`，专家聚合保存一次 `PATCH`，失败显式报错；其余 8 页 MOCK 标注。
- 文档：`REQ-0012`、`SCN-0012`、`CMP-bff` 模块卡、架构与 README 更新，`check-docs` 通过。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-B1-UI-01 | 文档 | `CMP-bff` | done | `REQ-0012`、`SCN-0012`、组件卡、works brief |
| T-B1-UI-02 | 实现 | `CMP-bff` | done | `bff/`、`server.js` |
| T-B1-UI-03 | 测试 | `CMP-bff` | done | `tests/bff/`、`package.json` |
| T-B1-UI-04 | 文档 | `CMP-bff` | done | `architecture.md`、`README.md`、`dev-environment.md` |
| T-B1-UI-05 | 验证 | `CMP-bff` | done | `npm test`、`curl` 同源冒烟 |
| T-B1-UI-06 | 实现 | `API` 共享模块（P2） | pending | `assets/js/api.js` |
| T-B1-UI-07 | 实现 | 四资产页 | pending | `harnesses.js`、`tools.js`、`skills.js`、`experts.js` 只读接入 |
| T-B1-UI-08 | 实现 | 四资产页 | pending | 写操作、专家聚合、revision/409、错误态 |
| T-B1-UI-09 | 文档/验证 | 全局 | pending | M1 场景 FakeAPI、未接入能力标注、SCN-0012 verified |

## 领取的开放问题

- 后端工作区在本地仍显示未提交（`HEAD 3171154`）；联调验收需补 commit hash 或确认外部 worktree 的基线。
- 四页 live 接入与 M1 场景改用 FakeAPI 在 P2/P3 处理，不在本工序展开。
