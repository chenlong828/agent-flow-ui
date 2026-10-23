---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 工序：组件基线与方案 A 落地（2026-10-23）

## 需求

**旁路**（无用户旅程；依据 2026-10-23 实现审视结论与用户决策）。

用户 2026-10-23 决策：

- 组件口径采用**方案 A**：保留 11 个 `CMP-*`，补齐最小模块卡与 `architecture.md` 现行真相。
- **不为 M1 十个页面补 REQ**：登记为「原型基线、无 REQ 追溯」，写入 `plan/roadmap.md` / `plan/risks.md`；只为**本次真正改行为**的页面新建场景。
- 本批不改页面业务行为，因此**不新建原计划的 4 条旅程 SCN**；它们转为「页面行为变更时再补」的欠账，不假装已完成。
- 用子任务逐项交付，一个子任务一个交付物；每批提交后工作区保持 clean。

## 背景

2026-10-23 审视的结论是「有条件通过」：运行验证真实通过（check-docs / 12 页冒烟 / 45 条引擎断言），但 11 个 `CMP-*` 只有页面规格，缺契约、数据所有权、验证入口与预算；`architecture.md` 仍是重构报告；check-docs 只查形状；README/页面注释断链；静态服务器暴露整仓。此前迁移已按三个 commit 入库：

- `c1bcdda chore(skills): adopt af-dev five-skill set`
- `f7e3efb docs: migrate to five-state tree and archive completed works`
- `6f2ff45 chore(tools): add five-state docs check and engine verification`

本工序只补「现行真相 + 最小可检查契约」，不重构页面、不改交互、不引入依赖。

## 验收标准

1. 11 个 `design/components/*/spec.md` 均含 `## 0 模块卡`，且 13 项字段齐全：状态、单元/层、业务价值、负责/不负责、数据所有权、公开契约、依赖、变化轴、验证入口、预算、单独运行、删除测试、已知偏差。
2. `architecture.md` 是现行系统真相（组件地图、依赖方向、契约入口、数据所有权、冷热 N/A、验证矩阵、基线偏差），不再含「重构前/效果」叙事。
3. `plan/roadmap.md` 明确「M1 = 原型基线、无 REQ 追溯」；`plan/risks.md` 登记 M1 验收欠账、MOCK 多写入口、Safari 人工待验收。
4. `tools/check-docs.js` 能守住：模块卡必备字段、works brief/result、CMP 引用可解析、场景索引新鲜度、README/页面注释旧路径。
5. README、4 处页面 JS 注释不再指向已删除的 `docs/0x`；OQ-7 以「→ REQ-0001」保留；`product.md` 的「评审稿/下一步」陈旧说明修正。
6. `server.js` 拒绝越界与点文件、只服务 `pages/` + `assets/`、绑定 `127.0.0.1`；`.env` 加入 `.gitignore`。
7. `npm run check:docs`、`node --check`、12 页冒烟、45 条引擎断言全部通过；工作区 clean。

## 任务表

| ID | 类型 | 组件 | 状态 | 交付物 | 子任务 |
|---|---|---|---|---|---|
| T-01 | design | global | done | 本 brief + 组件/数据所有权底稿 + 模块卡模板 | 主代理 |
| T-02 | change | global | done | `design/architecture.md` 重写 | 子任务 A |
| T-03 | change | ui-shell | done | `ui-shell/spec.md` 模块卡 | 子任务 B1 |
| T-04 | change | workflow-list | done | `workflow-list/spec.md` 模块卡 | 子任务 B2 |
| T-05 | change | workflow-editor | done | `workflow-editor/spec.md` 模块卡 | 子任务 B3 |
| T-06 | change | instances | done | `instances/spec.md` 模块卡 | 子任务 B4 |
| T-07 | change | skills | done | `skills/spec.md` 模块卡 | 子任务 C1 |
| T-08 | change | experts | done | `experts/spec.md` 模块卡 | 子任务 C2 |
| T-09 | change | harnesses | done | `harnesses/spec.md` 模块卡 | 子任务 C3 |
| T-10 | change | tools | done | `tools/spec.md` 模块卡 | 子任务 C4 |
| T-11 | change | analytics | done | `analytics/spec.md` 模块卡 | 子任务 D1 |
| T-12 | change | workspaces | done | `workspaces/spec.md` 模块卡（含详情页） | 子任务 D2 |
| T-13 | change | keys | done | `keys/spec.md` 模块卡 | 子任务 D3 |
| T-14 | change | tools | done | `check-docs.js` 增强 + 场景索引生成器 + npm 脚本 | 子任务 E |
| T-15 | change | global | done | README / 4 处 JS 注释 / OQ-7 / `product.md` 陈旧说明 | 子任务 F |
| T-16 | change | server | done | `server.js` 加固 + `.gitignore` | 子任务 G |
| T-17 | verify | global | done | roadmap/risks、全量验证、分批提交、`result.md` | 主代理 |

## 组件与数据所有权底稿（所有子任务的共同事实源）

**共享模块**（不属于 11 个业务组件）：

| 模块 | 源码 | 契约 | 数据 |
|---|---|---|---|
| 外壳与公共组件 | `assets/js/ui.js`（`window.DF`） | `DF.renderShell`、`DF.menu`、`DF.modal.*`、`DF.table/empty/field/kv/statCard/tabsHtml`、`DF.zoomK` | 读 `MOCK.instances`（待确认角标）；写 localStorage `df-font` / `df-collapsed` |
| 模拟数据 | `assets/js/mock-data.js`（`window.MOCK`） | 只读集合 + `MOCK.byId` / `now` / `m` / `mts` | 页面加载时一次性构造；无持久化 |
| 工作区共用 | `assets/js/pages/workspace-common.js`（`window.WSC`） | `treeHtml/createdText/readNewWs/saveNewWs/dropNewWs/syncNewWs/pad` | sessionStorage `df-new-workspace`；读 `MOCK.workspaces/keys` |
| 静态服务 | `server.js` | 静态文件 + `/` 302 | 无业务数据 |

**11 个组件**：

| 组件 ID | 页面入口 | 源码 | 读 MOCK | 写 MOCK（内存态） | 其他状态 | 当前验证 |
|---|---|---|---|---|---|---|
| `CMP-ui-shell` | 12 页公共外壳 | `assets/js/ui.js` | `instances`（角标） | — | localStorage `df-font` / `df-collapsed` | SCN-0001（45/45）；Safari 人工待验收 |
| `CMP-workflow-list` | `pages/workflow-list.html` | `workflow-list.js` | `workflows`、`instances`、`workspaces` | `workflows`（新建/复制/删除） | localStorage `wl-view` | 仅冒烟（基线） |
| `CMP-workflow-editor` | `pages/workflow-editor.html?id=` | `workflow-editor.js` | `workflows`、`experts`、`skills`、`harnesses`、`tools`、`workspaces`、`knowledgeTree` | `workflows`（编辑态 graph / DSL） | 画布视图状态（内存） | 仅冒烟（基线） |
| `CMP-instances` | `instances.html` + `instance-detail.html?id=` | `instances.js`、`instance-detail.js` | `instances`、`workflows`、`workspaces`、`experts`、`harnesses` | `instances`（发起/暂停/终止/重试/节点状态） | sessionStorage `df-new-instance` | 仅冒烟（基线） |
| `CMP-skills` | `pages/skills.html` | `skills.js` | `skills`、`experts` | `skills`（新建/编辑/启停/删除） | 抽屉编辑态（内存） | 仅冒烟（基线） |
| `CMP-experts` | `pages/experts.html` | `experts.js` | `experts`、`skills`、`tools`、`workflows`（引用计数） | `experts`（注册/编辑/启停） | 抽屉编辑态（内存） | 仅冒烟（基线） |
| `CMP-harnesses` | `pages/harnesses.html` | `harnesses.js` | `harnesses` | `harnesses`（注册/删除/启停） | 抽屉编辑态（内存） | 仅冒烟（基线） |
| `CMP-tools` | `pages/tools.html` | `tools.js` | `tools`、`harnesses`、`experts`、`workflows` | `tools`（注册/调试运行记录） | 调试抽屉状态（内存） | 仅冒烟（基线） |
| `CMP-analytics` | `pages/analytics.html` | `analytics.js` | `analytics` | — | 无 | 仅冒烟（基线） |
| `CMP-workspaces` | `workspaces.html` + `workspace-detail.html?id=` | `workspaces.js`、`workspace-detail.js`、`workspace-common.js` | `workspaces`、`keys` | `workspaces`（新建/删除/归档） | sessionStorage `df-new-workspace` | 仅冒烟（基线） |
| `CMP-keys` | `pages/keys.html` | `keys.js` | `keys`、`experts`、`harnesses`、`workspaces` | `keys`（新增/删除/绑定用途） | 弹窗编辑态（内存） | 仅冒烟（基线） |

> **数据单家说明**：`MOCK` 是原型夹具，不是数据服务。`workflows` 有两个页面写入口（列表/编辑器），其余集合单写但都只改内存，刷新即复位；这是原型豁免，登记为 R8，不伪装成多写入口。接真实后端时按数据服务重切。

## 模块卡模板（必须逐字使用字段名）

放在每份 `spec.md` 的引言之后、`## 1` 之前：

```markdown
## 0 模块卡

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为 <谁> 提供 <什么>；没有它，<能力> 不存在。
- 负责 / 不负责：负责 <X>；不负责 <Y>。
- 数据所有权：读 `MOCK.<集合>`；写 `MOCK.<集合>`（仅内存态，刷新复位）；无第二写入口说明。
- 公开契约：页面入口 `<pages/x.html>`；操作 `CMP-<id>#op1` / `#op2` / `#op3`；不变量 <...>。
- 依赖：`DF` / `MOCK` / `WSC`；不依赖其他页面组件。
- 变化轴：<最可能变化的一条>。
- 验证入口：`npm start` + `<URL>`；`node tools/smoke-test.js`；<SCN / legacy-smoke / manual>。
- 预算：源码 + 规格 + 测试约 <n> KB（上限 120k token，本组件远低于上限）。
- 单独运行：`npm start` → `<URL>`。
- 删除测试：删除后 <能力/页面> 消失，复杂度<消失/集中>。
- 已知偏差：<如 M1 无 REQ 追溯 / 仅冒烟 / 人工待验收>。
```

**要求**：

- 字段名、顺序保持一致，便于 `check-docs` 正则校验。
- 数据所有权必须与上表一致；如代码与表不符，以代码为准并在回报中说明。
- 不重写原有 `## 1` 之后的页面内容，只在前面插入模块卡。
- 更新 frontmatter `updated: 2026-10-23`；不改 `layer/module/component/status`。

## 子任务边界与纪律

- 子任务只改自己任务行指向的文件；不运行 `git add/commit`；不改页面行为；不新增依赖。
- 每个子任务完成即回报：改了哪些文件、模块卡字段是否齐全、数据所有权是否与代码一致、发现的偏差。
- 主代理负责最终验证与提交；子任务之间不互相等待，文件集不重叠。
- 本批不新建场景；若子任务发现某页面必须改行为才能满足模块卡，停止并回报，不自行扩权。

## 领取的开放问题

无（OQ-1~OQ-6 未领取；OQ-7 已在 T-15 转 REQ-0001 保留条目）。

## 收口方式

T-17 执行：`npm run check:docs`、`node --check`、12 页冒烟、45 条引擎断言；更新 roadmap/risks；按「组件卡 / 架构 / 门禁 / 入口 / server」分批提交；写 `result.md` 并归档前保持 `works/2026-10-23-component-baseline/` 原状。
