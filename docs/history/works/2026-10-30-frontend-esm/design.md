---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 设计：前端全站 ESM 迁移（P1 架构规格）

> 结论状态：已随 2026-10-30 交互式评审冻结；编码前不再改模块切分与测试栈。工作流页面的功能设计见 `docs/works/2026-10-30-workflow-ui/`。

## 1 业务能力与约束

| 能力 | 服务对象 | 触发 | 结果 | 不变量 | 冷/热 |
|---|---|---|---|---|---|
| 页面交付 | 全部 13 页用户 | 打开 HTML | 页面初始化、渲染、交互 | 无构建、无 CDN、同源、桌面优先 | 热（用户旅程） |
| 共享 UI | 全部页面 | 渲染外壳/弹层/表格 | 一致的界面原语 | `ui` 不含业务规则 | 热 |
| 资产数据访问 | B1 四页 | 列表/详情/写 | 真实 B1 DTO | 同源 BFF、`If-Match`、live-only | 热 |
| 工作流数据访问 | 工作流两页 | 列表/详情/保存/导入导出 | B3 工作流定义 | 合法图才写、revision 乐观锁、无 MOCK 回落 | 热 |
| demo 数据 | 其余页面 | 打开 | 内存夹具 | 必须显式标注演示；不得被 live 页 import | 冷（演示） |
| 验证 | 研发 | CI/本地 | 门禁结果 | 纯逻辑 `node --test`；DOM/网络 Playwright | 冷 |

**三条不可破的不变量**

1. **页面隔离**：页面之间不得互相 import；跨页只允许 URL 参数与约定的 sessionStorage 单键。
2. **单一写入口**：工作流定义只允许 `workflow/data` 写；页面不得直接 `fetch` 工作流端点。
3. **live/demo 隔离**：live 页不得 import `mock-data`；后端失败必须显式报错，不回落夹具。

**最痛失败**：ESM 迁移中断导致 13 页白屏；Playwright 重写丢断言；Node 侧转换导致静态服务/BFF 回归。

## 2 模块地图

### 2.1 分层

```
L2  pages/*.mjs                         页面组合根（13 个）
      ├─ workflow-list.mjs
      ├─ workflow-editor.mjs
      └─ 其余 11 页
L1  workflow/data.mjs                   工作流数据服务（唯一写入口）
      ├─ workflow/model.mjs             图模型 / ID / 规范化 / DSL 映射
      ├─ workflow/validate.mjs          本地校验（镜像 B3 拓扑 + 绑定）
      └─ shared/api.mjs                 资产数据服务（原 api.js）
L0  shared/http.mjs                     传输 / problem+json / If-Match / 304
    shared/ui.mjs                       组件库（原 ui.js / DF）
    shared/mock-data.mjs                demo 夹具（仅 demo 页）
```

### 2.2 模块卡（新增/变更）

#### 模块卡：shared/http（L0）

- 状态：planned
- 业务价值：把同源 HTTP、错误体、`If-Match`、304 收敛到一处，避免每个数据服务重复实现。
- 负责 / 不负责：负责 fetch 封装、状态码到 `ApiError` 的映射、JSON 解析、请求头；不负责 DTO 映射、重试、缓存、鉴权。
- 数据所有权：无业务数据；不持久化。
- 公开契约：`request({method,path,body,ifMatch,signal}) -> {status,data,headers}`；`ApiError{status,code,details,issues}`。
- 依赖：浏览器 `fetch`；不依赖 `ui`/`mock-data`。
- 冷热：热；失败快速返回，不自动重试。
- 验证入口：`node --test`（纯函数部分）+ Playwright route。

#### 模块卡：workflow/data（L1）

- 状态：planned
- 业务价值：工作流定义的唯一读写入口；没有它，列表与编辑器会各自 `fetch`，revision、错误、图映射三处漂移。
- 负责 / 不负责：负责 list/get/create/copy/update/delete/save/validate/export/import、revision 缓存、错误归一、DTO ↔ 视图模型；不负责画布渲染、本地校验规则、路由。
- 数据所有权：B3 `Workflow` + `WorkflowDefinition` 的客户端唯一写入口；`layout/viewport` 由前端写、后端透传。
- 公开契约：`CMP-workflow-data#list/get/create/copy/update/remove/save/validate/export/import`（详见 §4）。
- 依赖：`shared/http`、`workflow/model`、`workflow/validate`；不依赖 `ui`/`mock-data`/页面。
- 冷热：热（保存路径）；失败快速返回，409/428/400 直接上抛。
- 验证入口：`node --test`（映射与错误归一）+ Playwright（页面路径）。

#### 模块卡：workflow/model（L1）

- 状态：planned
- 业务价值：图结构、ID 规则、规范化与 DSL 映射的单一实现；没有它，编辑器与数据服务会各写一套图变换。
- 负责 / 不负责：负责 `WorkflowGraph` 类型、节点/阶段/边 ID 校验、`normalizeGraph`、`toDsl/fromDsl`、布局默认值；不负责 HTTP、DOM、校验文案。
- 数据所有权：无持久化；纯函数。
- 公开契约：`createId(prefix)`、`isValidId`、`normalizeGraph`、`toDsl`、`fromDsl`、`emptyViewport`。
- 依赖：无。
- 冷热：热；纯函数、无 I/O。
- 验证入口：`node --test`。

#### 模块卡：workflow/validate（L1）

- 状态：planned
- 业务价值：把 B3 的拓扑/绑定规则镜像到本地，保存前即时定位；没有它，只能等服务端 400。
- 负责 / 不负责：负责 `missing_start/missing_end/broken_chain/seq_cycle/invalid_rollback/rollback_target_not_ancestor/fanout_fanin_unpaired/expert_required/expert_forbidden` 与 shape 检查；不负责专家启停状态（服务端 `expert_disabled` 只作 warning）、不负责 HTTP。
- 数据所有权：无持久化；纯函数。
- 公开契约：`validateGraph(graph, experts) -> {errors, warnings}`；issue `{code,path,message}`，path 用数组下标。
- 依赖：`workflow/model`。
- 冷热：热；纯函数。
- 验证入口：`node --test`（与 B3 用例对齐）。

#### 模块卡：shared/ui（L0，迁移）

- 状态：active（改造为 ESM）
- 业务价值：13 页共用外壳与原语；迁移只改加载方式，不改视觉与交互语义。
- 负责 / 不负责：同现行 `ui.js`；不新增业务规则。
- 数据所有权：无业务数据；localStorage/sessionStorage 键仍按现行约定。
- 公开契约：`renderShell`、`menu`、`modal.*`、`drawer`、`table/empty/field/kv/statCard/tabsHtml`、`zoomK/zoomOnFixed`、`ls*/ss*`、`download/deep/esc`。
- 依赖：无页面、无数据服务。
- 冷热：热。
- 验证入口：Playwright 13 页冒烟 + 现有 SCN-0001 引擎断言。

#### 模块卡：shared/mock-data（L0，保留 demo）

- 状态：active（改造为 ESM）
- 业务价值：为 demo 页提供夹具；让未接后端的页面仍可演示。
- 负责 / 不负责：负责夹具集合与 `byId/now/m/mts`；不负责写入口 API、不被 live 页 import。
- 数据所有权：demo 页内存写；刷新复位。
- 公开契约：命名导出集合与辅助函数。
- 依赖：无。
- 冷热：冷。
- 验证入口：demo 页 Playwright 冒烟。

## 3 依赖矩阵

| 调用方 | 被调方 | 契约 | 方式 | 路径 | 失败处理 |
|---|---|---|---|---|---|
| `pages/*` | `shared/ui` | 外壳/原语 | 同步 import | 热 | 渲染错误上抛到页面错误态 |
| `pages/*` | `workflow/data`（仅工作流两页） | §4 数据契约 | 同步 await | 热 | 400/409/428 映射为表单/弹层 |
| `pages/*` | `shared/api`（仅 B1 四页） | 现行资产契约 | 同步 await | 热 | 同现行 |
| `workflow/data` | `shared/http` | `request` | 同步 await | 热 | `ApiError` 上抛 |
| `workflow/data` | `workflow/model` | 纯函数 | 同步 | 热 | 抛 `TypeError`（编程错误） |
| `workflow/data` | `workflow/validate` | 纯函数 | 同步 | 热 | 返回 issues，不抛 |
| demo 页 | `shared/mock-data` | 夹具 | 同步 import | 冷 | 不适用 |
| `server.mjs` | 静态文件 / `bff/index.mjs` | 路径挂载 | 进程内 | 热 | 404/502 |
| `tools/*` | 页面/模块 | Playwright / import | 测试进程 | 冷 | 门禁失败 |

**禁止边**

- 页面 ↔ 页面：禁止 import/调用；跨页只走 URL 与约定 sessionStorage 键。
- live 页 → `mock-data`：禁止。
- `shared/ui` / `shared/http` / `shared/mock-data` → `workflow/*` 或页面：禁止反向依赖。
- `workflow/model` → `shared/http` / DOM：禁止。
- `server.mjs`/`bff` → 页面模块：禁止（Node 与浏览器模块边界）。
- 第三方运行时依赖：仍按 `design/dependencies.md` 准入；本迁移不新增。

## 4 契约

### 4.1 `shared/http`

- 签名：`request({ method, path, body, ifMatch, signal }) -> Promise<{status, data, headers}>`
- 不变量：同源相对路径；`body` 为 JSON 时自动 `content-type: application/json`；`ifMatch` 转 `If-Match`；304 返回 `{status:304,data:null}`。
- 错误模式：非 2xx 抛 `ApiError`，携带 `status`、`code`（problem+json `code` 或 `error.code`）、`details`（含 `issues`/`fieldErrors`）；网络错误抛 `NetworkError`。
- 约定：不重试、不缓存、不弹 Toast；由调用方决定展示。

### 4.2 `workflow/data`

| 操作 | 输入 | 输出 | 失败 |
|---|---|---|---|
| `list` | `{q,type,sort,limit,offset}` | `{items,total,limit,offset}` | 400/502 |
| `get` | `id` | `WorkflowDetail`（含 graph） | 404/502 |
| `create` | `{name,type,description,graph}` | `{id,revision,warnings}` | 400/409 |
| `copy` | `id,{name?}` | `{id,revision,warnings}` | 400/404/409 |
| `update` | `id,revision,{name,type,description}` | `WorkflowSummary` | 400/404/409/428 |
| `remove` | `id,revision` | `void` | 404/409/428 |
| `save` | `id,revision,graph` | `{workflow,warnings}` | 400/404/409/428 |
| `validate` | `id,graph` | `{errors,warnings}` | 400/404 |
| `exportDsl` | `id,format` | `{text,filename}` | 400/404 |
| `importDsl` | `text` | `{workflow,idMap,warnings}` | 400/409 |

- 不变量：所有写操作必须带 `If-Match`（revision）；`create`/`save`/`copy`/`export` 前本地 `validateGraph` 必须无 errors；`layout/viewport` 原样透传，前端按 `dsl.schema.json` 自校。
- 错误：优先暴露 `details.issues`；保留 `fieldErrors` 兼容；409 区分 `name_conflict` / `revision_conflict`。
- revision：成功后更新缓存；409 时以服务端返回的 `currentRevision` 刷新，不自动重试。

### 4.3 `workflow/model` 与 `workflow/validate`

- `model` 只接受/产出稳定类型；ID 规则 `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`。
- `validate` 返回 `issues`，path 与 B3 一致（`graph.nodes[0].expertId`），供红框/面板定位。
- 两者都不依赖 DOM/HTTP，可被 `node --test` 直接 import。

## 5 迁移阶段

| 阶段 | 内容 | 退出条件 |
|---|---|---|
| 0.1 仓库/Node | `"type":"module"`；`server.js`/`bff`/`tools`/`tests` 改 ESM；静态 MIME 与 `check:syntax` 适配 | `npm start`、`test:bff` 绿 |
| 0.2 共享模块 | `ui/mock-data/api` 改 ESM；抽 `shared/http`；HTML 改 module | 页面可 import、无全局 |
| 0.3 页面分批 | A：壳 + 资产四页；B：工作台/实例/密钥/分析；C：工作流两页机械迁移 | 13 页全 module |
| 0.4 测试栈 | smoke/scenarios 迁 Playwright；纯逻辑 `node --test`；删 jsdom | 场景与门禁绿 |
| 0.5 收口 | 删全局、架构门禁（import 图/层/页面互引/mock 隔离） | 无 `window.*`；`npm test` 绿 |

> 已定：工作流两页在 Phase 0 做机械迁移；后续 live 重写归 `works/2026-10-30-workflow-ui/`，仍按 ESM 写。

## 6 数据所有权

| 数据 | 唯一写入口 | 读方 | 一致性 |
|---|---|---|---|
| B3 工作流定义 | `workflow/data` | 列表/编辑器 | revision 乐观锁；保存后刷新 |
| `layout/viewport` | 前端（随 graph 保存） | 画布/DSL 导出 | 后端透传，前端自校 |
| B1 资产 | `shared/api` | 四页 | 同现行 |
| demo 夹具 | `shared/mock-data` | demo 页 | 内存态，刷新复位 |
| 视图偏好 | `shared/ui`（localStorage） | 列表/编辑器 | 本机，非业务数据 |

## 7 装配、复用与状态

- 无依赖注入容器；每个页面是组合根，直接 import 所需模块。
- `shared/http` 是唯一传输实现；`shared/api` 与 `workflow/data` 都复用它，不各自写 `fetch`。
- 页面状态只在页面模块内；跨页只走 URL/约定 sessionStorage 键。
- 无模块级可变业务状态；revision 缓存限定在 `workflow/data` 实例内（每页一个）。
- 复用判定：同一逻辑第二次出现才抽；`shared/http` 是当前唯一确定要抽的横切实现。

## 8 验证计划与 CI 门禁

| 模块 | 契约/规则 | 失败 | 架构约束 | 数据/迁移 | 观测 |
|---|---|---|---|---|---|
| `shared/http` | `node --test`（错误映射）+ Playwright route | 400/409/428/502/304 | 不依赖上层 | — | 断言状态/错误体 |
| `workflow/model` | `node --test`（ID/规范化/DSL 往返） | 非法 ID/shape | 纯函数、无 I/O | — | 断言输出 |
| `workflow/validate` | `node --test`（9 类 issue） | 缺 start/end/环/绑定 | 纯函数 | — | 断言 code/path |
| `workflow/data` | `node --test`（映射/错误归一）+ Playwright | 409/428/400 | 唯一写入口 | revision 缓存 | 断言请求体/响应映射 |
| 13 页 | Playwright 冒烟 | 白屏/控制台错误 | 页面互引=0 | — | 页面标题/关键元素 |
| 场景 | Playwright | SCN 断言 | 外部执行层 | — | 见场景卡 |

**门禁**

- `check:syntax`：`node --check` 覆盖 ESM 文件。
- `check:docs` / `docs:index:check`：文档五态与索引。
- `check:architecture`：import 图无环、层方向、页面互引、live 页禁 mock、无全局。
- `check:scenario-trace`：文档用例 ↔ 执行层；Playwright 场景按 `execution: playwright` 归外部层。
- `npm test`：上述 + `test:bff` + Playwright 全量。

## 9 决策与开放问题

**已定**：全站 ESM、`type:module`、Node 全转、无测试桥、先迁移后工作流、工作流数据独立模块。

**已收口（2026-10-30）**：

1. 工作流两页在 Phase 0 做了机械迁移。
2. `server.js` 未拆分，避免与迁移混在一起。
3. 顺序为 13 页冒烟 → M1 场景 → Milkdown 渲染；工作流 live 场景归后续工序。

## 10 定级与确认

- **级别：P1**。理由：改全站模块系统、分层依赖、测试栈与仓库包边界；新增工作流数据模块与组件切分。
- **人工门**：2026-10-30 交互式评审已确认模块切分、测试栈、Node 边界与顺序；规格冻结后已按 T-0030-02..06 实施，结果见 `result.md`。
- **未确认不得编码**：Phase 0 的实现任务在 brief 任务表领取前，需再次对照本规格与决策记录。
