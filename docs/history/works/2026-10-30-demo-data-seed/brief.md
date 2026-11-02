---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 工序：演示数据灌注（B1/B3 经 API）

## 需求

**旁路**（演示/测试数据准备，无用户旅程，不建 `REQ`）。用户 2026-10-30 指示：

- 现有 `assets/js/mock-data.js` 是演示数据的底稿，先检查是否齐备；
- 后端（`:3100`，B1 资产 + B3 工作流）已启动，把数据灌进去让界面「看起来热闹」；
- **不直接写数据库**，只走后端 HTTP API；后端没有的能力不做。

## 背景

13 个页面中 7 页已切 live（Harness / 工具 / Skill / 专家 / Skill 详情 / 工作流列表 / 编辑器），6 页仍读 `MOCK`（实例、实例详情、效能看板、工作区、工作区详情、个人 Key）。本轮开始前后端 B1/B3 库为空（各列表 `total=0`），live 七页全部空态。

设计依据是 `reference/workflow_concept.pptx`（8 页）：四阶段评审准出、专家模板 + Skill 组合、React Loop、Harness 四类执行设施、知识索引、CICD 与 SVO。本轮只负责把「能由 B1/B3 承载」的部分落成可见数据，不实现 B2（工作区/Key）、B4（实例/看板）。

## 目标 / 非目标

**目标**

1. B1 五类资产（Harness / 工具 / Skill / 专家）与 B3 六条工作流有可浏览的数据，页面不出现空态。
2. 数据形态与 `mock-data.js` 的名称、角色、Skill/工具装配、工作流拓扑保持一致，跨页名称可对上。
3. 灌注过程可重复执行（按名称幂等），并能用一条命令重跑。

**非目标**

1. 不改 B1/B3 契约，不改后端源码，不直连 PostgreSQL。
2. 不补 B2/B4；实例、看板、工作区、Key 六页继续 `MOCK`。
3. 不伪造运行期字段（Harness 健康 / 心跳、工具状态 / 最近调试、Skill 版本），这些由后端运行时维护。
4. 不做真实执行、不造实例轨迹、不做 CI/CD 触发。

## 齐备性检查（mock-data → 后端）

| 集合 | 夹具 | 可经 API 写入 | 检查结论 |
|---|---|---|---|
| Harness | 5 | 是 | 类型只有容器×2、服务器×2、笔记本×1，缺 PPT P5 的「台式机」→ 补 1 台 `desk-02`，共 6 |
| 工具 | 10 | 是 | 名称、类型、调用模板、参数、所属 Harness 均可写；`status`/`lastDebugAt` 只读 |
| Skill | 12 | 是（草稿 → 保存） | 专家 `e7` 引用 `sk-smoke2`，夹具里不存在 → 补第 13 条「冒烟验证」，并让 `e7` 绑定它 |
| 专家 | 8 | 是 | 五区、性格、Skill/工具装配、参考知识均可写；装配 ID 需先建 Skill/工具 |
| 工作流 | 6 | 是 | 夹具图**不符合 B3 图契约**，需转换（见下） |
| 实例 / 看板 / 工作区 / Key | 有 | **否** | B2/B4 未实现，无接口；本轮不动 |

### 工作流夹具与 B3 契约的差异

| # | 夹具写法 | B3 要求 | 处理 |
|---|---|---|---|
| 1 | 边 ID `n1>n2:seq` | `[A-Za-z0-9][A-Za-z0-9_-]{0,63}` | 按顺序重编为 `e1…eN` |
| 2 | 边 `kind: 'par'` | 只接受 `seq` / `rollback` | `par` 归并为 `seq`（fan-out→fan-in 本就是顺序边） |
| 3 | `start`/`end`/`fanout`/`fanin` 无 `expertId` | 六类节点必须绑专家（`confirm` 禁止） | start 绑图内首个 agent、end 绑最后一个 review、网关绑 `config.subExpert` |
| 4 | 节点用 `x/y`，阶段用 `note`，`stageBoxes` 另存 | `node.layout{x,y}`、`stage.layout{x,y,width,height}`、`stage.description` | 逐项搬进 `layout` / `description` |
| 5 | 节点带 `config`（输入/输出/知识索引/收敛约束/工具权限） | `WorkflowNode` 只认 `id/type/name/stageId/expertId/layout`，未知字段 400 | 丢弃；这些配置在 live 编辑器里已没有载体 |
| 6 | `w5`/`w6` 用 `graphSmall(ids, names)`，`ids` 比 `names` 短 | 节点数以 `ids` 为准 | 夹具 bug：声明 5 节点、实际 4/3；已修 `mock-data.js` 补 `e6` 与评审项 |
| 7 | `published` / `ver` / `lastRun` / `nodeCount` | B3 不存这些字段，列表由 `graph` 派生 | 不写入；列表显示 `nodeCount`/`stageCount`/`updatedAt` |

### 运行期只读字段（契约限制，非数据缺失）

| 字段 | 页面表现 | 原因 |
|---|---|---|
| `Harness.health` / `lastHeartbeatAt` | 全部「未知 / 无心跳」，统计卡「在线 0」 | B1 无心跳上报端点，`POST` 固定 `unknown` |
| `Tool.status` / `lastDebugAt` | 全部「未验证 / —」 | B1 无调试/标记可用端点 |
| `Skill.version` | 全部 `v1.0` | 版本由保存动作维护，服务端生成 |
| `Workflow.updatedAt` / `revision` | 全部「刚刚」 | 写入时间即当前时间 |

要让这些字段有颜色，只能由后端提供运行时数据（或改后端契约），不在本工序范围。

## 输入方案

### 写入顺序（依赖方向）

```text
Harness ──▶ 工具 ──▶ Skill（草稿 → 保存） ──▶ 专家（引用 Skill/工具 UUID） ──▶ 工作流（引用专家 UUID）
```

### 字段映射

| 目标 | API | 由夹具映射 |
|---|---|---|
| Harness | `POST /api/v1/harnesses` | `type→kind`（容器/服务器/台式机/笔记本）、`accessMode→accessMode`、`max→concurrencyMax`、`tags`、`desc→description` |
| 工具 | `POST /api/v1/tools` | `type→kind`（MCP/CLI/脚本）、`invocation`、`params[{k,type,desc}]→[{key,type,description}]`、`harness→harnessId` |
| Skill | `POST /skill-drafts` → `POST /skill-drafts/{id}/save` | `category→categoryCode`（编码/检索/审视/测试）、`description`、`tags`、五段正文 + 踩坑 + 引用 → `body`；`enabled=false` 再走 `PATCH /skills/{id}/enabled` |
| 专家 | `POST /api/v1/experts` | `color`、`role`、`persona`、`duty`、`skillOrder`、`verifyOrder`、`notes`、`refs[{label,type}]→[{label,refType,path:null}]`、`skills/tools→skillIds/toolIds` |
| 工作流 | `POST /api/v1/workflows` | `name`、`type`、`desc→description`、`graph` 按上表转换 |

### 幂等与重跑

- 所有集合按 `name` 判重：已存在则跳过，可反复执行。
- 只更新工作流图时用 `REFRESH=1`：按名称取 `revision`，`PUT /workflows/{id}/definition`（带 `If-Match`）。
- 失败时打印后端 `error.details.issues`，定位到 `graph.nodes[i]` / `graph.edges[i]`。

### 执行

```bash
# 后端需先起在 :3100（/healthz 返回 {"status":"ok","database":"up"}）
node tools/demo-seed.mjs

# 只重写已有工作流的图定义
REFRESH=1 node tools/demo-seed.mjs
```

`API_BASE` 可覆盖后端地址；脚本不读取、不打印任何凭据。

### 数据清单

- **Harness 6**：build-01 / build-02（容器）、agent-07 / etl-03（服务器）、dev-lap（笔记本）、desk-02（台式机）。
- **工具 10**：trace_call_chain、metadata_query、dsl_search、linter、code_smell_scan、contract_assert、data_factory、replay_clean、business_tree_query、smoke_runner。
- **Skill 13**：编码 2 / 检索 4 / 审视 3 / 测试 4；「回放数据清洗」停用，其余启用；新增「冒烟验证」补 `e7` 的悬空引用。
- **专家 8**：需求分析、方案设计、开发实现、测试验证、代码审视、评审、集成验证、知识库运营；共 23 条 Skill 装配、23 条工具装配。
- **工作流 6**：研发四阶段主流程（14 节点 / 4 阶段 / 18 边）、需求分析子流程（10）、批量代码审视（6）、每日构建复验（7）、遗留代码逻辑抽取（5）、知识库索引更新（5）。

## 验收清单

| 页面 | 期望 |
|---|---|
| 工作流列表 | 6 张卡；类型页签「研发主流程 1 / 专项子流程 3 / 批量审视任务 2」；节点合计 47 |
| 工作流编辑器（研发四阶段主流程） | 4 个阶段框、14 节点、18 条边、5 条紫色回退边；专家名与角色可读 |
| 专家管理 | 8 张卡，颜色各异，Skill 芯片与工具/引用计数非空 |
| Skill 库 | 13 行；分类计数 2/4/3/4；1 条停用；详情页正文与整包下载可用 |
| Harness 管理 | 6 行，四类齐全；健康列统一「未知」（见限制） |
| 工具与集成 | 10 行；类型/参数数/所属 Harness/被引用数非空；状态统一「未验证」 |
| 实例 / 看板 / 工作区 / Key | 仍由 `MOCK` 渲染，本轮不改，刷新复位 |

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0031-01 | design | 平台（全局） | 已完成（2026-10-30：齐备性检查与本方案） | 本 brief、`reference/workflow_concept.pptx`、`mock-data.js`、B1/B3 契约 |
| T-0031-02 | change | 平台（全局） | 已完成（2026-10-30：新增 `tools/demo-seed.mjs`） | `tools/demo-seed.mjs`、`api.js` 契约、B1/B3 DTO |
| T-0031-03 | change | 平台（全局） | 已完成（2026-10-30：修 `w5`/`w6` 夹具图） | `assets/js/mock-data.js`（`graphSmall` 调用） |
| T-0031-04 | verify | 平台（全局） | 已完成（2026-10-30：API 计数 + 六页截图走查） | `result.md`、`tools/demo-seed.mjs`、`:3000` / `:3100` |

## 装载清单（必读）

- `reference/workflow_concept.pptx`
- `assets/js/mock-data.js`
- `assets/js/api.js`、`assets/js/workflow/data.js`、`assets/js/workflow/model.js`、`assets/js/workflow/validate.js`
- B1/B3 契约：`agent-flow-orchaster` 的 `docs/design/components/http-gateway/spec.md`、`workflow/spec.md`（只读，不改）
- `tools/demo-seed.mjs`
