---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 工序：M1 十页场景 3 正 1 反验证与交付（2026-10-23）

## 需求

**旁路**（验收闭环；承接 `REQ-0002..0011` 与 `SCN-0002..0011`，不新开页面实现）。

用户 2026-10-23 要求：按 skill 相关要求持续执行，补全前期资料，并从业务逻辑、分析设计层次验证通过。上一工序 `2026-10-23-m1-traceability` 只把 10 个场景做到 `designed`，明确留下 R10（3 正 1 反未落地）。本工序补 runner、跑通 3+1，再把 SCN 转 `verified`、REQ 转 `delivered`。

## 背景

- 10 个 M1 页面组件已有 REQ/SCN/Component 反查与 `check-docs` 门禁，但没有可执行业务断言；冒烟只证明页面能加载。
- 若不补业务断言，追溯链完整但验收不闭环，REQ 不能转 `delivered`。
- 本工序不改页面边界、不引入运行时依赖；只补测试、两处展示/导出缺口、文档状态与门禁。

## 验收标准

1. 新增 `tools/verify-m1-scenarios.js`，覆盖 `SCN-0002..0011`，每场景 3 正 1 反，共 40 条；断言业务数据、DOM 结构或状态迁移，不做存在性判断。
2. runner 可直接运行：`node tools/verify-m1-scenarios.js`（可追加场景号跑单场景）；`npm run test:scenarios` 提供等价入口。
3. 10 个场景测试表登记实际断言与脚本锚点，含 `最近一次执行：2026-10-23，40/40 通过`；场景 `status: verified`。
4. 10 张 REQ `status: delivered`，且 `check-docs` 能强制「delivered 需求的场景必须 verified」。
5. 10 个组件模块卡的追溯行、验证入口、已知偏差同步为已验证；architecture 矩阵、roadmap、risks R7/R10 同步。
6. `npm test`、`npm run test:smoke`、`npm run test:scenarios`、`git diff --check` 全部通过。

## 测试设计

- 执行层：DOM（jsdom）。测试内启动临时静态 HTTP 服务，而不是用 `file://`：页面用 `sessionStorage` 保存 `df-new-workspace`，`file://` 是不透明源，`sessionStorage` 不可用；HTTP 源恢复真实浏览器语义。
- 每个测试独立加载页面，互不污染 `MOCK`；需要跨页状态的场景（实例暂停/恢复、工作区新建、归档）在同一测试内显式加载第二个页面。
- 正例覆盖：列表/计数同源、筛选与空态、新建/复制/编辑/删除保护、画布节点与校验、DSL 导出、实例暂停/恢复/批准、Skill 五章与版本递增、专家五区/新建/停用、Harness 注册与健康、工具调试与引用、看板范围/分页、工作区向导/归档、Key 登记/校验/绑定。
- 反例覆盖：删除取消、非法输入、重名、运行中删除禁用、未填驳回意见、12 周禁用、必填缺失、被引用资产禁止删除等。
- 不断言纯存在性；关键断言带具体期望值或与夹具计算的期望值。

## 任务表

| ID | 类型 | 组件 | 状态 | 交付物 |
|---|---|---|---|---|
| T-01 | test | 10 个页面组件 | done | `tools/verify-m1-scenarios.js`（40 条） |
| T-02 | change | workflow-editor | done | DSL payload 补 `id`，与场景断言一致 |
| T-03 | change | experts | done | 详情补「角色定位」，与五区场景一致 |
| T-04 | docs | global | done | 10 场景 verified、10 REQ delivered、10 组件卡同步 |
| T-05 | verify | global | done | 全量测试、门禁、文档索引、收口归档 |

## 映射（唯一事实源）

| SCN | 页面 | 正例 T1/T2/T3 | 反例 T4 |
|---|---|---|---|
| `SCN-0002` | `workflow-list.html` | 卡片/统计同源、筛选/空态、新建/复制 | 删除引用工作流取消 |
| `SCN-0003` | `workflow-editor.html?id=w1` | 未知 id 回落、节点抽屉/改名、校验/DSL | 缺回退/缺专家校验与发布拒绝 |
| `SCN-0004` | `instances.html` / `instance-detail.html` | Tab 计数、INS-2041 轨迹、暂停恢复/批准 | 驳回空意见/已终止无恢复 |
| `SCN-0005` | `skills.html` | 计数/分类、五章、编辑版本/新建 | 被引用 Skill 禁止删除 |
| `SCN-0006` | `experts.html` | 卡片/搜索、五区、新建/编辑/停用 | 取消停用 |
| `SCN-0007` | `harnesses.html` | 健康计数、注册、停用/删除空闲 | 运行中删除禁用/取消停用 |
| `SCN-0008` | `tools.html` | 筛选、注册/调试、引用方 | 删除禁用/调试失败不转可用 |
| `SCN-0009` | `analytics.html` | KPI/阶段/审计、4↔8 周、分页 | 12 周禁用/不写 MOCK |
| `SCN-0010` | `workspaces.html` / `workspace-detail.html` | 列表/Key、向导校验、三步新建、归档 | 被引用禁止删除/取消不写 |
| `SCN-0011` | `keys.html` | 掩码、git 登记、校验/绑定 | 必填缺失/取消删除 |

## 不做

- 不接真实后端、真实执行引擎、鉴权或持久化；`MOCK` 仍是内存夹具，刷新复位。
- 不补引擎层拖拽/坐标断言；jsdom 不可证的拖拽与遮挡仍由 SCN-0001 引擎层与 Safari 人工门禁覆盖。
- 不改页面边界、组件切分或共享契约。

## 装载清单

- 规则：`req-scenario-spec`（REQ/SCN 结构）、`design-before-coding`（先对齐组件与契约）、`dev-execution-spec`（测试/验收/提交）、`doc-layout-spec`（五态与归档）。
- 基线：`history/works/2026-10-23-m1-traceability/result.md`（R10 欠账）。
- 影响面：`docs/requirements/REQ-0002..0011`、`docs/design/scenarios/**`、`docs/design/components/*`、`docs/design/architecture.md`、`docs/plan/*`、`tools/check-docs.js`、`tools/verify-m1-scenarios.js`、`assets/js/pages/{workflow-editor,experts}.js`。
