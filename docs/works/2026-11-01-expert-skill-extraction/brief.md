---
layer: works
module: global
status: active
updated: 2026-11-01
---

# 工序：真实专家与 Skill 内容提取

## 需求

**旁路**（产品内容资产建设，无用户旅程，不建 `REQ`）。用户 2026-11-01 指示：检索 `~/harness/uft-issue` 与 `~/harness/web-dev`，整理合适的「专家 + Skill」提取，以 AgentFlow 的模式梳理，**先出清单与计划方案**，确认后再实施。

## 背景

AgentFlow 当前 9 个专家、13 条 Skill 是演示占位：专家职责泛化（「按调用链审视代码」），Skill 正文是同一段模板（「按标准流程逐步执行」），与 PPT 的「专家=角色+Skill 组合、Skill=渐进披露能力包」只对上形状，没对上内容。

两个来源仓是已跑通的生产 harness：

- `uft-issue`：交易/清算域，三 Loop（需求/分析/开发）+ 排查链 + 改码链 + 测试链 + 审核链，19 条 Skill 带 references/schemas/scripts。
- `web-dev`：Web 研发域，七阶段流水线 + 18 类需求专家 + 4 个设计专家 + 5 个开发岗 + 17 条 Skill。

两仓的专家卡（Soul + 3–5 步 + 脚本 + 参考）、Skill 包（SKILL.md + references + schemas + scripts）、阶段门控、分层知识，与 AgentFlow 的专家/技能/评审/知识结构同构，具备直接提取条件。

## 目标 / 非目标

**目标**

1. 产出一份可评审的清单：16 个专家（交易域 8 + Web 域 8）、24 条核心 Skill（P0 9 + P1 15）、4 条 P2、4 个新工具、4 类知识；每条标注来源、触发、结构、主用专家。
2. 给出可执行的分期计划与验收标准，确认后按 B1/B3 API 灌入，不改契约、不写库。
3. 让两域各自的四阶段主流程、需求/分析/开发三条 Loop、问题排查与代码审视在界面上有真实内容可看。

**非目标**

1. 不迁移平台运行时（opencode Task、`flow_run`、文件桥接、CB Flow、会话驾驶舱）。
2. 不接真实执行；Skill 的脚本段只写接口与判定，不承诺可跑。
3. 不改 B1/B3 契约、不改页面代码；内容经 API 写入。
4. 不逐类复制 40 个 Agent / 18 个需求专家；分类维度进 Skill 判定树。

## 方案要点

完整清单见 [`catalog.md`](catalog.md)，Skill 逐条拆分见 [`skills.md`](skills.md)。核心取舍：

| 维度 | 决定 |
|---|---|
| 专家 | 16 个，按域分线：交易域 8（需求/设计/UFT 伪代码/ARES 伪代码/测试/审核/排查/知识）+ Web 域 8（需求/设计/前端/后端/测试/评审/发布/复盘） |
| Skill | 24 条：现有 13 条中保留 7、重写 6（含合并 1），新增 11；类别 检索 6 / 审视 9 / 测试 5 / 编码 4 |
| 评审 | 来源仓的「评审不过即停」落成 review 节点 + `rollback` 边，不写进专家备注 |
| 域权重 | 两域全部产出；交易域冷色、Web 域暖色，页面上分区可辨 |
| 工具 | 新增 browser_inspect、log_parser、kg_query、efficiency_mcp；P2 预留 compile/backend_env |
| 知识 | 四类：business / design / runbooks / standards，专家 `refs` 统一 `workspace:/knowledge/...` |
| 脱敏 | 客户名、项目号、内网地址、账号不进正文与示例 |

## 分期计划

| 里程碑 | 范围 | 产出 | 工作量 |
|---|---|---|---|
| M0 确认 | 清单评审、命名与范围定稿 | 本 brief + `catalog.md` 定稿 | 0.5 天 |
| M1 可演示 | 16 个专家 + P0 9 条 Skill + 4 个新工具 | B1 有 16 专家 / 22 技能；两域主流程重绑 | 5 天 |
| M2 能力补齐 | P1 15 条 Skill + 知识树 + 三条 Loop + 排查/审视子流程 | B1 达 24 技能；B3 达 8–9 条工作流 | 4 天 |
| M3 可选 | P2 4 条 + 编译/环境工具 + 验收报告 | 可选清单、`result.md` | 2 天 |

P0 的 9 条：需求分流、SVO 拆分、业务功能树检索、代码现状检查、变更影响面分析、UFT/ARES 伪代码修改、SQL 编写审核、测试设计、测试数据构造。它们保证「需求→设计→开发→验证」四阶段各至少有一条真实能力。

## 验收标准

1. B1 专家 16 条：每条 Skill 装配 ≥3、工具 ≥1、参考知识 ≥1；`skillOrder` / `verifyOrder` 非空；无自引用。
2. B1 Skill 24 条：`description` ≤400 字且含「适用/触发/不适用」；正文 ≤16 KiB；七节齐全（适用场景/执行步骤/示例/脚本/完成验证/常见踩坑/参考资料）。
3. 类别计数 检索 6 / 审视 9 / 测试 5 / 编码 4；每条 Skill 至少被 1 个专家引用，每个专家至少 3 条 Skill。
4. B3 工作流：两域四阶段主流程各一条；新增「需求 Loop」「分析 Loop」「开发 Loop」「问题排查」「代码审视」「知识更新」子流程；`nodeCount` 与定义一致，校验全绿。
5. 页面走查（1440×900）：专家卡、Skill 详情、工作流编辑器、知识引用均无空态与模板句。
6. `npm run check:docs`、`check:syntax` 通过；`result.md` 记录实际计数与偏差。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0032-01 | design | 平台（全局） | 进行中（2026-11-01：清单与计划待确认） | 本 brief、`catalog.md`、两来源仓 |
| T-0032-02 | change | B1 专家 | 待启动 | `catalog.md` §3、`tools/demo-seed.mjs`、B1 experts 契约 |
| T-0032-03 | change | B1 Skill（P0） | 已完成（2026-11-01：24 条正文按 `rewrite-spec.md` 详细重写并落库，正文 8.0–15.9 KB；默认合并 references） | `catalog.md` §4、B1 skills 契约、来源 SKILL.md |
| T-0032-04 | change | B1 Skill（P1）+ 工具 + 知识 | Skill 部分完成（24 条详细正文 + SVO 一份原文附录；工具、知识待做） | `catalog.md` §4/§6、B1 tools 契约 |
| T-0032-05 | change | B3 工作流 | 待启动 | `catalog.md` §3、B3 graph 校验、现有 6 条工作流 |
| T-0032-06 | verify | 平台（全局） | 待启动 | 验收标准 1–6、`result.md` |

## 风险

| 风险 | 缓解 |
|---|---|
| 来源内容含客户/项目/内网信息 | 只取方法；示例脱敏；路径改 `workspace:/` |
| 24 条蒸馏工作量大 | P0 9 条先上；P1 分批；每条 ≤16 KiB |
| 专家过细导致选择困难 | 16 个角色按域分线；工作流只绑定本域角色，跨域靠 Skill 复用 |
| 来源重叠（影响面/调用链/评审） | 合并为单条，以 uft 判定 + web-dev persona 为准 |
| 演示无真实执行 | 脚本段标注「演示不执行」，验证写可判定项 |

## 已确认与待确认

**已确认（2026-11-01）**

1. 专家按域拆成 16 个（交易域 8 + Web 域 8）。
2. Skill 24 条全量交付，不做 P0 截断。
3. 两域全部产出，不分主次。

**仍需确认**

1. 工作流数量：8 条（两域主流程 + 三条 Loop + 排查 + 审视 + 知识）还是 9 条（再加 Web 七阶段流水线）？
2. P2 的 T2 / 编译 / 后台环境是否进演示（默认只登记、不实现）？
3. 现有 9 个通用专家的历史实例/引用是否保留映射（默认整批替换）？

## 装载清单（必读）

- [`catalog.md`](catalog.md)（专家/Skill 清单）
- [`skills.md`](skills.md)（24 条 Skill 的职责与文件拆分）
- [`skills-spec.md`](skills-spec.md)（逐条写作规格与 `sk-svo` 完整样例）
- `~/harness/uft-issue`：`README.md`、`commons/agents/0*/`、`commons/skills/*/SKILL.md`、`commons/domains/engineering/`、`registry/projects_index.json`
- `~/harness/web-dev`：`AGENTS.md`、`.opencode/experts/{README,INDEX,routing,expert-skill-matrix}.md`、`.opencode/agents/INDEX.md`、`skills/*/SKILL.md`、`knowledge/`
- `assets/js/mock-data.js`（现有 9 专家 / 13 技能）
- `tools/demo-seed.mjs`（写入器）
- B1/B3 契约：`agent-flow-orchaster` 的 `docs/design/components/http-gateway/spec.md`、`workflow/spec.md`
