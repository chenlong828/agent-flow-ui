---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 工序：M1 十页 REQ/SCN/Component 追溯补齐（2026-10-23）

## 需求

**旁路**（文档追溯补齐；10 个 REQ 为对既有原型的回溯登记，不新开 10 个实现工序）。

用户 2026-10-23 要求：把 10 张 M1 REQ 以及对应的 Scenario、Component 等补齐。此前 `2026-10-23-component-baseline` 按“M1 原型基线、无 REQ 追溯”收口；本次反转该口径，补追溯链。

## 背景

M1 的 11 个 `CMP-*` 中，`CMP-ui-shell` 已有 `REQ-0001` / `SCN-0001`，其余 10 个页面组件只有模块卡与冒烟，没有需求卡与场景卡。页面实现已存在，本次是**回溯建卡**，不改页面行为、不新增依赖、不补 40 条测试。

## 验收标准

1. `requirements/REQ-0002..REQ-0011` 共 10 张卡，`status: accepted`，每张卡的影响场景指向对应 `SCN-xxxx`。
2. `design/scenarios/**/scenario.md` 共 10 个新场景（`SCN-0002..SCN-0011`），`status: designed`，含入口、运行序、不可变引用、3 正 1 反测试方案。
3. 11 个 `design/components/*/spec.md` 的 frontmatter 增加 `requirement` / `scenario`，并在 `## 0 模块卡` 下加一行追溯；`check-docs` 强制两者可解析。
4. `design/scenarios/_index.md` 重生成并校验无 diff；`architecture.md` 验证矩阵、`plan/roadmap.md`、`plan/risks.md` 同步为“已补追溯、场景 designed、未 verified”。
5. `npm test` 通过，工作区 clean。**不把 designed 写成 verified，不把 10 张 REQ 写成 delivered。**

## 任务表

| ID | 类型 | 组件 | 状态 | 交付物 |
|---|---|---|---|---|
| T-01 | design | global | done | 本 brief + 10 页 REQ/SCN 映射 |
| T-02 | design | 10 个页面组件 | done | 10 张 REQ + 10 个场景 |
| T-03 | change | global | done | 组件 frontmatter/模块卡追溯 + check-docs 强制 |
| T-04 | change | global | done | 场景索引、architecture、roadmap/risks |
| T-05 | verify | global | done | 全量验证、分批提交、result.md |

## 映射（唯一事实源）

| REQ | 组件 | 页面入口 | SCN | 场景目录 | 场景标题 |
|---|---|---|---|---|---|
| `REQ-0002` | `CMP-workflow-list` | `pages/workflow-list.html` | `SCN-0002` | `flow/workflow-list/browse-workflows` | 工作流列表浏览与生命周期入口 |
| `REQ-0003` | `CMP-workflow-editor` | `pages/workflow-editor.html?id=` | `SCN-0003` | `flow/workflow-editor/edit-workflow` | 工作流画布编辑与校验 |
| `REQ-0004` | `CMP-instances` | `instances.html` / `instance-detail.html?id=` | `SCN-0004` | `operations/instances/control-instance` | 实例监控与运行控制 |
| `REQ-0005` | `CMP-skills` | `pages/skills.html` | `SCN-0005` | `assets/skill-library/manage-skill` | Skill 维护与渐进披露 |
| `REQ-0006` | `CMP-experts` | `pages/experts.html` | `SCN-0006` | `assets/expert-registry/manage-expert` | 专家注册与组合配置 |
| `REQ-0007` | `CMP-harnesses` | `pages/harnesses.html` | `SCN-0007` | `assets/harness-pool/manage-harness` | Harness 注册与健康治理 |
| `REQ-0008` | `CMP-tools` | `pages/tools.html` | `SCN-0008` | `assets/tool-registry/manage-tool` | 工具注册、调试与引用治理 |
| `REQ-0009` | `CMP-analytics` | `pages/analytics.html` | `SCN-0009` | `operations/performance/review-performance` | 效能看板只读回看 |
| `REQ-0010` | `CMP-workspaces` | `workspaces.html` / `workspace-detail.html?id=` | `SCN-0010` | `workspace/workspace-config/configure-workspace` | 工作区创建、配置与归档 |
| `REQ-0011` | `CMP-keys` | `pages/keys.html` | `SCN-0011` | `workspace/credential/manage-key` | 个人 Key 登记、校验与绑定 |

## 场景测试口径

- 本批只把 10 个场景做到 `designed`：写清 3 正 1 反的断言、执行层与可执行 ID，**不写** `tools/verify-m1-scenarios.js`。
- 因此 10 张 REQ 保持 `accepted`，不标 `delivered`；10 个场景不标 `verified`。这是有意保留的验收欠账，详见 `plan/risks.md` R10。
- 若后续要闭环，下一工序补一个 DOM/引擎 runner，跑通 3+1 后再改 `verified` / `delivered`。

## 装载清单

- `design/scenarios/shell/topbar/user-menu/scenario.md`（格式样例）
- `requirements/REQ-0001-user-menu.md`（格式样例）
- `design/components/<id>/spec.md` 的 `## 0 模块卡`
- `tools/check-docs.js`、`plan/roadmap.md`、`plan/risks.md`、`design/architecture.md`

## 收口

`npm test` + 索引检查；按「REQ / SCN / 组件与门禁 / 计划」分批提交；写 `result.md` 后归档到 `history/works/2026-10-23-m1-traceability/`。
