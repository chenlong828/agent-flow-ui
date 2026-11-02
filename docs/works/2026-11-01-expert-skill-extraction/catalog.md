---
layer: works
module: global
status: active
updated: 2026-11-01
---

# 专家与 Skill 提取清单（uft-issue × web-dev → AgentFlow）

> 本清单是提取方案，不含实现。目标：把两个真实控制面仓里已经跑通的「角色分工 + 能力包 + 门控方法」提炼成 AgentFlow 可承载的 16 个专家（交易域 8 + Web 域 8）/ 24 条 Skill（+4 条可选），替换当前演示用的通用占位内容。

## 0. 结论

两个来源仓不是素材库，而是**已在生产使用的 harness**：

- `~/harness/uft-issue`：交易/清算域控制面（UFT/UFR/ARES）。8 个 Agent、19 个在册 Skill、6 类领域知识、runbook 库；核心是**三 Loop（需求/分析/开发）+ 排查链 + 改码链 + 测试链 + 审核链**。
- `~/harness/web-dev`：Web 研发域（Vue/Java/DB/CRES/LDP）。41 个 Agent 定义、约 31 个专家文件、17 个 Skill、6 类知识；核心是**七阶段流水线 + 18 类需求专家 + 4 个设计专家 + 5 个开发岗 + 阶段评审**。

两仓与 AgentFlow 的 PPT 设计同构：专家=角色模板，Skill=能力包，评审=准出门，知识=分层索引。因此提取的是**方法与资产**，不是运行时（不搬 opencode Task、flow_run、文件桥接、CB Flow）。

目标态：**16 专家（两域各 8）/ 24 条核心 Skill（P0 9 + P1 15）/ 4 条 P2 / 4 个新工具 / 4 类知识 / 8–9 条工作流**。

## 1. 来源盘点

| 仓 | 定位 | 专家/Agent | Skill | 知识 | 迁移判断 |
|---|---|---|---|---|---|
| `uft-issue` | 交易/清算域控制面：分流→需求 Loop→分析 Loop→改码→测试→审核，另有排查链与知识探索 | 8 个主 Agent（01 分流、02 需求 Loop、03 分析 Loop、04 排查、05 改码、06 测试、07 审核、09 知识探索），下挂 6+6+7+6 个子专家 | 19 个：kg-locate、log-parse、svo-decompose、data-fabrication、sql-authoring、uft/ares-code-modification、t2-access、compile-check、backend-env-ops、case-review 等 | `commons/domains/` 6 域 + runbook 库 + 案例库 + 约束门禁 | 方法、判定树、runbook 全部可迁；脚本与 Windows 路径不可直接迁 |
| `web-dev` | Web 研发域：七阶段流水线（需求→设计→开发→集成→测试→发布→复盘） | 18 个需求业务专家 + 3 通用 + 4 设计 + 15 个流水线角色 | 17 个：pipeline、inspect（code/page 双模）、review-gate、knowledge-locate、efficiency-mcp-query、code-review、defect-analysis-review、compound、h5-design-impl 等 | `knowledge/` 业务/方案/runbook/技术/公司/私有 6 类 + conventions | 角色分工、评审矩阵、知识结构可迁；客户与项目信息需脱敏 |

### 1.1 同构性（为什么能提取）

| 来源形态 | AgentFlow 载体 | 对应字段/结构 |
|---|---|---|
| 专家卡：Soul + 3–5 个工作要点 + 脚本支撑 + 参考 | 专家卡 | `role` / `persona` / `duty` / `skillOrder` / `verifyOrder` / `notes` / `refs` |
| Skill 包：`SKILL.md` + `references/` + `schemas/` + `scripts/` | Skill 包（zip） | `description`（含触发）+ 七节正文 + 脚本/引用 |
| 阶段评审 + 回退 + 人工门 | 工作流 | review/confirm 节点 + `rollback` 边 |
| 分层知识：业务域 / 方案 / runbook / 规范 | 知识树 + 专家 `refs` | `workspace:/knowledge/...` |
| 三 Loop（需求/分析/开发） | 工作流分支 | 主流程 + 子流程 |

### 1.2 不能直接搬的四类东西

1. **40 个 Agent / 18 个需求专家**：AgentFlow 的编排单位是工作流节点，不是 Agent 池；逐类建专家会让选择成本爆炸。做法：1 个「需求分析专家」+ 技能内的动作判定树 + 工作流分支。
2. **平台运行时**：opencode Task、`flow_run` 引擎、文件桥接、CB Flow、会话驾驶舱——这些是执行机制，AgentFlow 用节点/边/实例表达。
3. **项目与客户信息**：客户名、项目号、内网地址、环境账号一律脱敏，路径改写为 `workspace:/`。
4. **环境绑定脚本**：依赖 Windows 盘符、本机 `.local`、SSH 配置的脚本不迁；只保留脚本的**接口说明与判定规则**。

## 2. 提取原则

1. **一个专家 = 一个可独立准出的角色**，与 PPT 四阶段对齐（需求/设计/开发/验证），再加排查、评审、集成、知识四类横切。
2. **一个 Skill = 一个可独立加载的能力包**：有触发条件、有步骤、有验证、有踩坑，正文 ≤16 KiB，`description` ≤400 字。
3. **能力下沉、专家薄**：专家只写「怎么想、按什么顺序、验证什么」，具体操作全在 Skill；避免专家卡变成大杂烩。
4. **门控显式化**：来源仓的「评审不过就停」必须落成 AgentFlow 的 review 节点 + 回退边，而不是写在专家备注里。
5. **先 P0 后 P1**：P0 保证四阶段主流程能完整演示；P1 补齐排查/评审/知识闭环；P2 只登记不实现。
6. **可回填**：每条 Skill 标注来源路径，后续内容更新可回溯，不做一次性搬运。

## 3. 专家清单（16 个：交易域 8 + Web 域 8）

> 按域分线：交易域对应 `uft-issue`（UFT/UFR/ARES），Web 域对应 `web-dev`（Vue/Java/DB/CRES/LDP）。两域各有完整的「需求→设计→实现→测试→审核/发布」角色；跨域共享 Skill、工具与知识树，不共享专家卡。配色建议：交易域冷色（蓝/青/靛），Web 域暖色（橙/红/紫），页面上可一眼分域。

### 3.1 总览

**交易域（8）**

| ID | 名称 | 一句话 | 技能组合（顺序） | 来源 |
|---|---|---|---|---|
| `exp-tx-req` | 需求分析专家（交易域） | 原始需求/缺陷单 → 场景集合 | `sk-req-route` → `sk-svo` → `sk-biz-tree` → `sk-meta`（P2 `sk-project-init`） | uft-issue 02 需求 Loop |
| `exp-tx-design` | 方案设计专家（交易域） | 需求点 → 七章骨架设计 | `sk-code-inspect` → `sk-impact` → `sk-kg-locate` → `sk-contract` | uft-issue 03 分析 Loop |
| `exp-tx-uft` | UFT/UFR 伪代码专家 | 按伪代码红线落地 UFT/UFR 改动 | `sk-pseudo-code` → `sk-sql` → `sk-lint`（P2 `sk-compile`） | uft-issue 05 / 02a |
| `exp-tx-ares` | ARES 伪代码专家 | ARES 伪代码/XML 壳与表结构 | `sk-pseudo-code` → `sk-sql` → `sk-dsl`（P2 `sk-compile`） | uft-issue 05 / 02b |
| `exp-tx-test` | 测试验证专家（交易域） | 测试设计、造数、复现与验证 | `sk-test-design` → `sk-data-fabrication` → `sk-replay`（P2 `sk-t2`） | uft-issue 06 |
| `exp-tx-review` | 代码审核专家（交易域） | 需求拆解→硬规则→AI 审核→门控 | `sk-gate` → `sk-lint` → `sk-impact` | uft-issue 07 |
| `exp-tx-incident` | 问题排查专家 | 现象→根因，只诊断不修改 | `sk-log-parse` → `sk-kg-locate` → `sk-svo` → `sk-5why` → `sk-retro` | uft-issue 04 |
| `exp-tx-knowledge` | 知识探索专家 | 七跳全景探索与挂点回填 | `sk-retro` → `sk-kg-locate` → `sk-biz-tree` | uft-issue 09 + case-review |

**Web 域（8）**

| ID | 名称 | 一句话 | 技能组合（顺序） | 来源 |
|---|---|---|---|---|
| `exp-web-req` | 需求分析专家（Web 域） | 18 类动作分类 + 四件套产出 | `sk-req-route` → `sk-biz-tree` → `sk-svo` → `sk-meta`（P2 `sk-project-init`） | web-dev req-planner/analyst + 18 业务专家 |
| `exp-web-design` | 方案设计专家（Web 域） | DESIGN_TYPE → 四章设计 + 任务单 | `sk-code-inspect` → `sk-impact` → `sk-contract` → `sk-browser` | web-dev design-planner/architect/api/frontend |
| `exp-web-frontend` | 前端实现专家 | Vue/H5 页面、组件、设计稿映射 | `sk-ldp` → `sk-dsl` → `sk-browser` → `sk-lint` | web-dev developer-vue + mapping/ui-compare |
| `exp-web-backend` | 后端实现专家 | Java/DB/CRES/LDP 落地 | `sk-sql` → `sk-cres` → `sk-ldp` → `sk-lint` | web-dev developer-java/db/cres/ldp |
| `exp-web-test` | 测试验证专家（Web 域） | 用例生成 + 页面实测 + 定性 | `sk-test-design` → `sk-data-fabrication` → `sk-browser` → `sk-replay` | web-dev pipeline-tester |
| `exp-web-review` | 代码评审专家（Web 域） | 多 persona + 置信门控 | `sk-code-review` → `sk-lint` → `sk-gate` → `sk-impact` | web-dev code-review / repo-patrol |
| `exp-web-release` | 集成与发布专家 | 集成、发布、部署证据、健康检查 | `sk-smoke` → `sk-contract` → `sk-log-parse`（P2 `sk-compile` / `sk-backend-env`） | web-dev integrator/releaser |
| `exp-web-retro` | 复盘与沉淀专家 | 复盘、compound、索引更新 | `sk-retro` → `sk-biz-tree` → `sk-kg-locate` | web-dev retrospector/compound |

### 3.2 专家卡要点

**交易域**

`exp-tx-req` 需求分析专家（交易域）

- Soul：只回答「用户要什么、边界在哪、怎么验收」，不设计、不写代码。
- persona：追问到底 / 场景化 / 不臆测
- duty：需求拉取 → 意图判别 → SVO 拆分 → 业务功能命中 → 场景枚举 → 越界检查 → 独立审视 → 人审放行
- skillOrder：`sk-req-route` → `sk-svo` → `sk-biz-tree` → `sk-meta`
- verifyOrder：场景覆盖业务规则 → 功能/业务/SVO 三维越界 → 待确认项闭环
- notes：以需求 Loop 的 12 章与 5 项人审为准出依据；18 类动作只是技能内判定树。
- refs：需求 Loop 规范、业务功能树、场景用例模板

`exp-tx-design` 方案设计专家（交易域）

- Soul：核心判断是「这个改动真的落得下去吗」——调用链、触点、字段、接口、回退。
- persona：契约优先 / 影响面闭合 / 假设显式
- duty：定位 → 源码探索 → 触点决策 → 七章骨架（改造目标/功能域/元数据/文件字段/任务改造/接口实现/待确认项）→ 独立审视
- skillOrder：`sk-code-inspect` → `sk-impact` → `sk-kg-locate` → `sk-contract`
- verifyOrder：七章齐全 → 影响面闭合 → 待确认项有归属
- notes：设计不验证；「设计假设」必须标来源，禁止静默取值。
- refs：七章模板、调用链分析、服务映射

`exp-tx-uft` UFT/UFR 伪代码专家

- Soul：最小改动、先备份、按伪代码红线写；改完自己先过静态检查。
- persona：克制 / 最小改动 / 先备份
- duty：修改规划 → 触点确认 → UFT/UFR 伪代码编码 → L0–L3 四层判定 → 影响面与测试交接
- skillOrder：`sk-pseudo-code` → `sk-sql` → `sk-lint`
- verifyOrder：Linter 0 告警 → 四层判定 → 编译（人工门）
- notes：宏/事务/遍历/结果集/错误号按 `domains/pseudocode/uft` 规则；编译命令由人工执行。
- refs：UFT 伪代码红线、UFTDB 规范、错误号表

`exp-tx-ares` ARES 伪代码专家

- Soul：按 ARES 分层与规则 JSON 写伪代码，VAS/结果集/事务一个都不省。
- persona：分层控 / 规则化
- duty：ARES 伪代码与 XML 壳 → VAS/分层/结果集/事务 → 表结构（.singletabledata/.table）→ 脚本审核
- skillOrder：`sk-pseudo-code` → `sk-sql` → `sk-dsl`
- verifyOrder：规则 JSON 审核 → 人工核对清单
- notes：ARES 规则集（ARES_XML_/SVC_/FNC_/SQL_/SAFE_/CTRQ_/BD_/TBL_）是硬约束。
- refs：ARES 伪代码规则、表结构定义

`exp-tx-test` 测试验证专家（交易域）

- Soul：只相信可机判的断言与可复现的数据；没有证据不算通过。
- persona：证据癖 / 数据敏感 / 不轻信
- duty：Phase T 测试设计 → 接口识别 → 造数设计 → 用例生成 → Phase R 复现 → Phase V 验证定性
- skillOrder：`sk-test-design` → `sk-data-fabrication` → `sk-replay`
- verifyOrder：断言锚点查证 → 造数对账 → 行为差异源码定性
- notes：区分缺陷与设计必须回到源码；基线不可得按三档降级。
- refs：用例模板、造数模板、环境 runbook

`exp-tx-review` 代码审核专家（交易域）

- Soul：审核只报有证据的问题；门控只有通过与回退两种结论。
- persona：独立 / 规则优先 / 不留情面
- duty：需求拆解 → 影响分析 → 硬规则检查 → AI 审核 → 审核门控
- skillOrder：`sk-gate` → `sk-lint` → `sk-impact`
- verifyOrder：证据链完整 → 规则红线无豁免 → 门控记录可追溯
- notes：审核与执行上下文隔离；评审意见必须可执行。
- refs：审核矩阵、准出清单、伪代码红线

`exp-tx-incident` 问题排查专家

- Soul：只诊断不修改；每个结论都要能指到日志行、代码行或数据行。
- persona：证据链 / 反证 / 保守
- duty：受理建档 → SVO 拆现象 → 入口定位 → 四要素计划 → 扇出取证 → 对抗审核 → 报告与转交 → 复盘
- skillOrder：`sk-log-parse` → `sk-kg-locate` → `sk-svo` → `sk-5why` → `sk-retro`
- verifyOrder：根因合理性 / 证据充分性 / 修改点正确性 三判定
- notes：单一证据点可走轻量取证；出现「为什么」立即转全链。
- refs：runbook 库（性能/死锁/业务日志）、案例库、术语表

`exp-tx-knowledge` 知识探索专家

- Soul：维护索引与挂点，让下一次探索少走一条弯路；知识库膨胀是最大风险。
- persona：归纳癖 / 索引控
- duty：七跳全景探索 → 挂点回填 → 索引更新 → 冲突检测
- skillOrder：`sk-retro` → `sk-kg-locate` → `sk-biz-tree`
- verifyOrder：挂点可回指 → 索引一致性 → 冲突/重复检测
- notes：坚持渐进式披露；知识条目必须能回指证据。
- refs：知识库运营手册、索引规范、案例库

**Web 域**

`exp-web-req` 需求分析专家（Web 域）

- Soul：先判「这是什么活」，再产四件套；不确认的写 PENDING，不猜。
- persona：分类控 / 追问到底 / 不臆测
- duty：动作分类 → 现状确认 → analysis/tasks/scope-boundary/site-verification 四件套 → 待确认管理 → 提交审核
- skillOrder：`sk-req-route` → `sk-biz-tree` → `sk-svo` → `sk-meta`
- verifyOrder：四件套齐全 → D 脚本通过 → PENDING 项逐条处置
- notes：18 类动作只在本技能判定树内分流，不建 18 个专家。
- refs：四件套模板、动作分类词表、检查脚本清单

`exp-web-design` 方案设计专家（Web 域）

- Soul：按四章轴出可开发、可验证的设计；字段/功能号事实交给脚本，判断留给自己。
- persona：契约优先 / 假设显式
- duty：DESIGN_TYPE 判别 → 四章（架构/数据库/接口/UI 落点）→ 任务单 → 测试验证计划 → 三横切
- skillOrder：`sk-code-inspect` → `sk-impact` → `sk-contract` → `sk-browser`
- verifyOrder：四章齐全 → 五岗位映射无遗漏 → 时区/权限/操作日志三横切
- notes：涉及 T2/引擎、新表字段、新增接口时不得走轻量道。
- refs：design-rule 四章轴、设计技能库、接口族模板

`exp-web-frontend` 前端实现专家

- Soul：先把设计稿映射成结构，再写 Vue；能复用就不新写。
- persona：还原度控 / 复用优先
- duty：元素映射 → 复用决策 → 页面/组件实现 → UI 对比与兼容性检查
- skillOrder：`sk-ldp` → `sk-dsl` → `sk-browser` → `sk-lint`
- verifyOrder：页面走查 → 多端兼容 → Linter
- notes：设计稿映射的 @2x→@1x 与小数位规则按 mapping 技能执行。
- refs：组件库规范、映射模板、UI 对比基线

`exp-web-backend` 后端实现专家

- Soul：契约先定，再写 Controller/Service；SQL 按实际表结构拆列。
- persona：契约优先 / 数据严谨
- duty：接口实现 → Service/POJO → DB 脚本 → CRES/LDP 适配 → DAO 一致性
- skillOrder：`sk-sql` → `sk-cres` → `sk-ldp` → `sk-lint`
- verifyOrder：编译通过 → DAO/表结构一致 → 接口契约对齐
- notes：跨团队 LDP 核心依赖必须显式标注风险。
- refs：后端规范、表结构索引、CRES/LDP 框架说明

`exp-web-test` 测试验证专家（Web 域）

- Soul：用例必须可机判；页面问题先截图再定性。
- persona：证据癖 / 页面敏感
- duty：测试设计 → 用例生成 → 造数与数据准备 → 浏览器实测 → 缺陷定性
- skillOrder：`sk-test-design` → `sk-data-fabrication` → `sk-browser` → `sk-replay`
- verifyOrder：用例覆盖需求点 → 页面实测有截图 → 缺陷有源码定性
- notes：造数与回放数据必须可还原。
- refs：用例模板、浏览器验证清单、缺陷分级

`exp-web-review` 代码评审专家（Web 域）

- Soul：按 diff 选 persona，多视角独立评审，置信门控后才报。
- persona：多疑 / 交叉 / 细致
- duty：persona 选择 → 并行评审 → 置信锚 → 跨员晋级 → 独立复核 → autofix 分级
- skillOrder：`sk-code-review` → `sk-lint` → `sk-gate` → `sk-impact`
- verifyOrder：每条 finding 有文件:行号与置信度 → 复核一致
- notes：评审与被评审上下文隔离。
- refs：persona catalog、历史缺陷库、评审矩阵

`exp-web-release` 集成与发布专家

- Soul：拼起来能跑才算完；没有部署证据不进验证。
- persona：流程控 / 全链路
- duty：集成 → 测试 → 发布 → 部署证据 → 健康检查 → 回归
- skillOrder：`sk-smoke` → `sk-contract` → `sk-log-parse`
- verifyOrder：健康检查全绿 → 契约通过 → 回归通过 → 证据落盘
- notes：启停/发布保留人工 gate。
- refs：CICD 指南、发布 runbook、契约清单

`exp-web-retro` 复盘与沉淀专家

- Soul：把一次问题转成一条可检索的学习，而不是一篇总结。
- persona：归纳癖 / 可检索
- duty：复盘 → 资产行使清单 → compound 沉淀 → 索引更新
- skillOrder：`sk-retro` → `sk-biz-tree` → `sk-kg-locate`
- verifyOrder：沉淀可检索 → 索引更新 → 重复检测
- notes：沉淀条目必须有 frontmatter 与证据引用。
- refs：compound 规范、knowledge/solutions 索引

## 4. Skill 清单

### 4.1 统计

| 类别 | P0 | P1 | 合计 |
|---|---:|---:|---:|
| 检索 | 3（分流/功能树/现状） | 3（图谱/元数据/DSL） | 6 |
| 审视 | 2（SVO/影响面） | 7（日志/评审/5Why/准出/复盘/契约/Linter） | 9 |
| 测试 | 2（测试设计/造数） | 3（冒烟/浏览器/回放） | 5 |
| 编码 | 2（伪代码/SQL） | 2（CRES/LDP） | 4 |
| **合计** | **9** | **15** | **24** |

### 4.2 核心 24 条

> 逐条职责、步骤与文件拆分（SKILL.md + references 数量/大小）见 [`skills.md`](skills.md)。

| # | 建议 ID | 名称 | 类别 | 优先级 | 来源（相对两个仓） | 适用/触发（摘要） | 主用专家 |
|---|---|---|---|---|---|---|---|
| 1 | `sk-req-route` | 需求分流与动作分类 | 检索 | P0 | web-dev `experts/routing.md` + `expert-skill-matrix.md`；uft `01_分流路由Agent` | 收到原始诉求判断「这是什么活、走哪条流」；触发：需求分类/动作判定/加按钮/加逻辑/改现有/修缺陷 | `exp-tx-req` `exp-web-req` |
| 2 | `sk-svo` | SVO 拆分 | 审视 | P0 | uft `commons/skills/svo-decompose` | 把人话拆成 主体-行为-实体-影响态 的事实锚；触发：SVO/拆现象/锚点齐备性 | `exp-tx-req` `exp-tx-incident` `exp-web-req` |
| 3 | `sk-biz-tree` | 业务功能树检索 | 检索 | P0 | uft 需求 Loop 4b + `domains/biz-spec`；web-dev `knowledge/business` | 沿 业务域→价值流→场景 定位入口；触发：功能树/业务域/这个功能在哪 | `exp-tx-req` `exp-tx-knowledge` `exp-web-req` `exp-web-retro` |
| 4 | `sk-code-inspect` | 代码现状检查 | 检索 | P0 | web-dev `skills/inspect`（mode:code） | 按功能号/路由/文件输出当前实现摘要；触发：看现状/这个功能怎么实现的 | `exp-tx-design` `exp-web-design` |
| 5 | `sk-impact` | 变更影响面分析 | 审视 | P0 | uft `02c_影响分析专家` + `kg-locate` + `source-asset`；web-dev `design-skills/call-chain-analysis` | 从改动点反向追调用链/引用/数据流；触发：影响面/调用链/回归范围 | `exp-tx-design` `exp-tx-review` `exp-web-design` `exp-web-review` |
| 6 | `sk-kg-locate` | 知识图谱入口定位 | 检索 | P1 | uft `commons/skills/kg-locate` | 按功能号/服务名/业务词定位 V 卡与入口全集；触发：功能号定位/入口定位/知识图谱 | `exp-tx-design` `exp-tx-incident` `exp-tx-knowledge` `exp-web-retro` |
| 7 | `sk-pseudo-code` | UFT/ARES 伪代码修改 | 编码 | P0 | uft `commons/skills/uft-code-modification` + `ares-code-modification` + `domains/engineering/pseudocode/` | 按规则改伪代码与 XML 壳；触发：伪代码/事务/遍历/结果集/UFTDB | `exp-tx-uft` `exp-tx-ares` |
| 8 | `sk-sql` | SQL 编写与审核 | 编码 | P0 | uft `commons/skills/sql-authoring` | 定位表结构、按实际字段写 SQL、35 条规范与 EXPLAIN；触发：写 SQL/落库脚本/方言 | `exp-tx-uft` `exp-tx-ares` `exp-web-backend` |
| 9 | `sk-test-design` | 测试设计与用例生成 | 测试 | P0 | uft `06_测试验证Agent` 01/04 专家 | 从场景生成可机判用例与断言锚；触发：测试设计/用例/断言/覆盖 | `exp-tx-test` `exp-web-test` |
| 10 | `sk-data-fabrication` | 测试数据构造 | 测试 | P0 | uft `commons/skills/data-fabrication` | 把不存在/不满足的数据造成存在且满足校验；触发：造数/账户池/资金可用/基础数据 | `exp-tx-test` `exp-web-test` |
| 11 | `sk-log-parse` | 日志证据解析 | 审视 | P1 | uft `commons/skills/log-parse` | 大日志/redo/报文/性能 CSV → 结构化证据；触发：日志/redo/死锁/报文 | `exp-tx-incident` `exp-web-release` |
| 12 | `sk-code-review` | 多 persona 代码评审 | 审视 | P1 | web-dev `skills/code-review` | 按 diff 选 persona 并行评审 + 置信门控；触发：代码评审/review/提测前 | `exp-tx-review` `exp-web-review` |
| 13 | `sk-5why` | 缺陷 5Why 分析评审 | 审视 | P1 | web-dev `skills/defect-analysis-review` | 审现场缺陷 5Why 与改进措施；触发：5Why/根因评审/缺陷分析 | `exp-tx-incident` |
| 14 | `sk-gate` | 阶段准出门控 | 审视 | P1 | uft `05_审核门控专家`；web-dev `pipeline-reviewer` + `conventions/phase-gate-rule.md` | 对照准出清单核验并给通过/回退；触发：准出/门控/能不能进下一阶段 | `exp-tx-review` `exp-web-review` |
| 15 | `sk-smoke` | 冒烟验证 | 测试 | P1 | 现有 `sk-smoke2` + uft `06` Phase V | 部署后跑关键路径最小集并留证；触发：冒烟/部署后验证/回归 | `exp-web-release` |
| 16 | `sk-browser` | 浏览器页面验证 | 测试 | P1 | web-dev `skills/inspect`（mode:page） | 打开页面截图/交互确认；触发：打开页面/截图/页面验证 | `exp-web-design` `exp-web-frontend` `exp-web-test` |
| 17 | `sk-retro` | 复盘与经验沉淀 | 审视 | P1 | web-dev `skills/compound`；uft `commons/skills/case-review` + `06_复盘专家` | 把一次排查/缺陷/项目转成结构化学习；触发：复盘/沉淀/compound/案例 | `exp-tx-incident` `exp-tx-knowledge` `exp-web-retro` |
| 18 | `sk-contract` | 契约断言 | 审视 | P1 | 现有 `sk-contract` + web-dev `design-api` C 章 | 为接口契约生成断言并守护；触发：契约/断言/接口 | `exp-tx-design` `exp-web-design` `exp-web-release` |
| 19 | `sk-cres` | CRES 编码规范 | 编码 | P1 | 现有 `sk-cres` + web-dev `pipeline-developer-cres` | 按 CRES 框架写代码/方案；触发：CRES | `exp-web-backend` |
| 20 | `sk-ldp` | LDP 低代码开发 | 编码 | P1 | 现有 `sk-ldp` + web-dev `pipeline-developer-ldp` | LDP 页面/服务/DSL 开发；触发：LDP/低代码/DSL | `exp-web-frontend` `exp-web-backend` |
| 21 | `sk-meta` | 元数据查询 | 检索 | P1 | 现有 `sk-meta` + web-dev `design-skills/metadata-query.md` | 补全实体/字段/服务上下文；触发：元数据/字段 | `exp-tx-req` `exp-web-req` |
| 22 | `sk-dsl` | DSL 检索 | 检索 | P1 | 现有 `sk-dsl` | 在低代码 DSL 资产中检索扩展点；触发：DSL/扩展点 | `exp-tx-ares` `exp-web-frontend` `exp-web-backend` |
| 23 | `sk-lint` | Linter 代码体检 | 审视 | P1 | 现有 `sk-lint` + uft `agent_lint` | 静态检查编码规范；触发：lint/静态检查 | `exp-tx-uft` `exp-tx-review` `exp-web-frontend` `exp-web-backend` `exp-web-review` |
| 24 | `sk-replay` | 回放数据清洗 | 测试 | P1 | 现有 `sk-replay` + uft `data-fabrication` 对账段 | 回放前清洗脱敏与对账；触发：回放/清洗 | `exp-tx-test` `exp-web-test` |

### 4.3 P2（只登记，不实现）

| ID | 名称 | 类别 | 来源 | 主用专家 | 理由 |
|---|---|---|---|---|---|
| `sk-t2` | T2 报文交互 | 测试 | uft `t2-access` | `exp-tx-test` | 依赖真实 T2SDK 环境，演示无法执行 |
| `sk-compile` | 编译构造与检查 | 编码 | uft `compile-check` | `exp-tx-uft` `exp-tx-ares` `exp-web-release` | 依赖节点环境与 project.xml |
| `sk-backend-env` | 后台环境操作 | 测试 | uft `backend-env-ops` | `exp-web-release` | 依赖 SSH 与内网环境 |
| `sk-project-init` | 需求项目初始化 | 编码 | web-dev `project-init` | `exp-tx-req` `exp-web-req` | 依赖效能平台 MCP，演示可跳过 |

### 4.4 每条 Skill 的正文结构（落库即按此七节）

1. **适用场景**：一句话边界 + 触发词 + 不适用。
2. **执行步骤**：3–7 步，每步有输入/产物；来源仓的长流程只保留主干与判定点。
3. **示例**：一个最小输入→输出的样例（脱敏）。
4. **脚本**：脚本名、参数、调用方式；无脚本写「无，按步骤人工执行」。
5. **完成验证**：可判定的检查项（文件存在/字段齐全/断言通过/证据行号）。
6. **常见踩坑**：从来源仓的「禁止事项 / 教训」提炼 2–4 条。
7. **参考资料**：`workspace:/knowledge/...` + 来源仓文档名（不含内网路径）。

约束：`description` 1–400 字，含「适用/触发/不适用」三段；正文 ≤16 KiB；超长内容拆到 `references/`，正文只留索引。

## 5. Skill 覆盖校验（每条至少 1 个专家）

| Skill | 主用专家（≥1） |
|---|---|
| `sk-req-route` | `exp-tx-req` `exp-web-req` |
| `sk-svo` | `exp-tx-req` `exp-tx-incident` `exp-web-req` |
| `sk-biz-tree` | `exp-tx-req` `exp-tx-knowledge` `exp-web-req` `exp-web-retro` |
| `sk-code-inspect` | `exp-tx-design` `exp-web-design` |
| `sk-impact` | `exp-tx-design` `exp-tx-review` `exp-web-design` `exp-web-review` |
| `sk-kg-locate` | `exp-tx-design` `exp-tx-incident` `exp-tx-knowledge` `exp-web-retro` |
| `sk-pseudo-code` | `exp-tx-uft` `exp-tx-ares` |
| `sk-sql` | `exp-tx-uft` `exp-tx-ares` `exp-web-backend` |
| `sk-test-design` | `exp-tx-test` `exp-web-test` |
| `sk-data-fabrication` | `exp-tx-test` `exp-web-test` |
| `sk-log-parse` | `exp-tx-incident` `exp-web-release` |
| `sk-code-review` | `exp-tx-review` `exp-web-review` |
| `sk-5why` | `exp-tx-incident` |
| `sk-gate` | `exp-tx-review` `exp-web-review` |
| `sk-smoke` | `exp-web-release` |
| `sk-browser` | `exp-web-design` `exp-web-frontend` `exp-web-test` |
| `sk-retro` | `exp-tx-incident` `exp-tx-knowledge` `exp-web-retro` |
| `sk-contract` | `exp-tx-design` `exp-web-design` `exp-web-release` |
| `sk-cres` | `exp-web-backend` |
| `sk-ldp` | `exp-web-frontend` `exp-web-backend` |
| `sk-meta` | `exp-tx-req` `exp-web-req` |
| `sk-dsl` | `exp-tx-ares` `exp-web-frontend` `exp-web-backend` |
| `sk-lint` | `exp-tx-uft` `exp-tx-review` `exp-web-frontend` `exp-web-backend` `exp-web-review` |
| `sk-replay` | `exp-tx-test` `exp-web-test` |

## 6. 工具与知识

### 6.1 工具缺口

现有 10 个工具（trace_call_chain、metadata_query、dsl_search、linter、code_smell_scan、contract_assert、data_factory、replay_clean、business_tree_query、smoke_runner）覆盖 6 条 Skill。需要新增：

| 建议 ID | 名称 | 类型 | 用途 | 被谁用 | 优先级 |
|---|---|---|---|---|---|
| `t-browser` | browser_inspect | MCP | 打开页面/截图/交互取证 | sk-browser | P0 |
| `t-log` | log_parser | CLI | 日志/redo/报文结构化解析 | sk-log-parse | P0 |
| `t-kg` | kg_query | CLI | 知识图谱按功能号/业务词定位 | sk-kg-locate | P0 |
| `t-eff` | efficiency_mcp | MCP | 需求/任务/缺陷/工时查询 | exp-req、exp-incident | P1 |
| `t-compile` | compile_runner | CLI | 触发编译与 so 检查 | sk-compile（P2） | P2 |
| `t-env` | backend_env | SSH | 进程/日志/启停 | sk-backend-env（P2） | P2 |

只登记定义（名称/类型/调用模板/参数/所属 Harness），不接执行；与当前演示一致。

### 6.2 知识树（专家 refs 的落点）

```
knowledge/
├── business/        业务域 → 价值流 → 场景/SVO（来源：web-dev knowledge/business、uft biz-spec）
├── design/          方案模式、接口族、调用链、四章/七章模板（来源：web-dev design-skills、uft 03）
├── runbooks/        性能/死锁/业务日志/部署（来源：uft runbooks、web-dev knowledge/runbooks）
└── standards/       编码红线、评审矩阵、准出清单、脱敏规范（来源：两仓 constraints/conventions）
```

专家 `refs` 一律写 `workspace:/knowledge/...`，不写来源仓绝对路径。

## 7. 现有 13 条演示 Skill 的处置

| 现有 | 处置 | 目标 |
|---|---|---|
| sk-svo | 重写 | `sk-svo`（真实 SVO 规则与判定） |
| sk-btree | 重写 | `sk-biz-tree`（业务域→价值流→场景） |
| sk-callchain | 合并 | 并入 `sk-impact`（影响面 + 调用链 + 数据流） |
| sk-factory | 重写 | `sk-data-fabrication`（盘点/选路/对账） |
| sk-ab | 重写 | `sk-code-review`（多 persona + 置信门控） |
| sk-smoke2 | 重写 | `sk-smoke`（关键路径 + 证据） |
| sk-cres | 保留 | 补 CRES 框架边界与验证 |
| sk-ldp | 保留 | 补 LDP 五岗位中的低代码职责 |
| sk-contract | 保留 | 补接口族与权限点断言 |
| sk-replay | 保留 | 补清洗-对账-还原三段 |
| sk-meta | 保留 | 补版本号纪律 |
| sk-dsl | 保留 | 补扩展点检索 |
| sk-lint | 保留 | 补规则集与误报证据 |

## 8. 不迁移清单

| 来源 | 原因 |
|---|---|
| web-dev 18 个需求业务专家（btn-api/logic-calc/…） | 分类维度并入 `sk-req-route` 判定树，不逐类建专家 |
| web-dev `pipeline` 编排技能 | 编排由 AgentFlow 工作流表达，不是 Skill |
| web-dev `algo-h5-*`、`font-audit`、`ding-talk`、`repo-patrol` | 客户/工具强绑定，演示不需要 |
| uft `session-extract`、`index-version-mgmt`、`devops-daily` | 平台运维能力，超出研发四阶段 |
| uft `t2-access`、`compile-check`、`backend-env-ops` | 保留为 P2 占位，不实现 |
| 两仓的 Agent 调度、flow_run、文件桥接、CB Flow | 运行时机制，AgentFlow 用节点/边/实例表达 |

## 9. 落库映射（B1）

- **Expert**：`name`、`color`、`role`、`persona[]`、`duty`、`skillOrder`（文字顺序）、`verifyOrder`、`notes`、`refs[{label, refType, path}]`、`skillIds[]`、`toolIds[]`。
- **Skill**：`name`、`categoryCode`（编码/检索/审视/测试）、`description`（三段式，≤400）、`tags[]`、`body`（七节）、`enabled`。
- **工具**：`name`、`kind`（MCP/CLI/脚本）、`invocation`、`params[]`、`harnessId`、`timeoutMs`。
- 只读字段（`health`/`status`/`version`/`updatedAt`）仍由运行时维护，不在本次内容范围内。
- 目标计数：专家 16、Skill 24、工具 14（10 现有 + 4 新增）、知识 4 类、工作流 8–9 条。
- 专家命名带域前缀（`exp-tx-*` / `exp-web-*`），页面上用配色区分；原 9 个通用专家由这 16 个替换。

## 10. 风险与待确认

| 风险 | 影响 | 缓解 |
|---|---|---|
| 来源内容带客户/项目/内网信息 | 泄露 | 只取方法；路径统一 `workspace:/`；示例脱敏 |
| 24 条 Skill 全量蒸馏工作量大 | 延期 | P0 9 条先上，P1 分批；每条 ≤16 KiB |
| 专家过细导致工作流选择困难 | 演示效果差 | 16 个角色按域分线；工作流只绑定本域角色，跨域靠 Skill 复用 |
| 两仓内容互相重叠（如影响面/调用链） | 重复维护 | 以 uft 的判定 + web-dev 的 persona 合并为一条 |
| 演示无真实执行 | Skill 只能「看起来能跑」 | 正文写清前置/验证，脚本段标注「演示不执行」 |

**已确认（2026-11-01）**

1. 专家：按域拆成 16 个（交易域 8 + Web 域 8）。
2. Skill：24 条全量交付。
3. 域权重：两域全部产出，不做主次。

**仍需确认**

1. 工作流数量：8 条（两域主流程 + 三条 Loop + 排查 + 审视 + 知识）还是 9 条（再加 Web 七阶段流水线）？
2. P2 的 T2/编译/后台环境是否进演示（默认只登记、不实现）？
3. 现有 9 个通用专家的历史实例/引用是否需要保留映射（默认整批替换）？
