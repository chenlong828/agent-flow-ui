---
layer: design
module: global
status: current
updated: 2026-10-30
---

# 系统架构（现行真相）

> 本文只写系统现在是什么。历史重构清单见 git `f7e3efb`；本批审视与收口见 `history/works/2026-10-23-component-baseline/result.md`。组件边界、数据权属与验证入口以各 `design/components/<id>/spec.md` 的 `## 0 模块卡` 为准；本文只给系统级地图与约束。

## 1 技术基线与边界

- 形态：agent-flow 前端（13 个 HTML 页面 + 同源 BFF）；原生 HTML/CSS/ESM，无构建步骤；第三方运行时依赖默认零，例外须经准入（`design/dependencies.md`）并自托管到 `assets/vendor/`，禁止 CDN 外链。
- 模块系统（2026-10-30 完成迁移）：全站原生 ESM，`package.json` 为 `"type":"module"`，Node 侧 `server.js` / `bff/` / `tools/` / `tests/` 同为 ESM；页面只通过显式 `import` 取依赖，无 `window.DF/MOCK/API/WSC`，无构建与 `.cjs` 兼容层。迁移记录见 `history/works/2026-10-30-frontend-esm/`，决策见 `history/decisions/2026-10-30-frontend-esm.md`。
- 数据：Harness / Tool / Skill / Expert 四页直接消费 B1 DTO（经 `CMP-bff` 同源访问），写操作走 B1 并带 `If-Match`；工作流列表/编辑器经 `workflow/data` 消费 B3 `/api/v1/workflows*`，写操作带 `If-Match`，`layout/viewport` 由前端拥有/后端透传；实例、效能、工作区、Key 等页面仍由 `assets/js/mock-data.js` 的 `MOCK` 具名导出提供，写操作只改内存。前端不直接持有数据库或鉴权态。
- 服务：`server.js`（Node 原生 `http`）是组合根，做静态托管、`/` 302 与 `CMP-bff` 挂载；`CMP-bff` 只透明转发 `/api/v1/*` 与 `/healthz`，不承载业务逻辑。
- 验证：`tools/check-docs.js`（五态文档）、`tools/check-deps.js`（依赖准入）、`tools/check-architecture.js`（ESM import 图与边界）、`tools/check-scenario-trace.js`（核对场景卡 / Playwright runner / 外部执行层；统计以 `design/scenarios/_index.md` 为准）、`npm run test:bff`（BFF stub 上游）、`tools/smoke-test.js`（Playwright 13 页结构冒烟）、`tools/verify-user-menu.js`（Playwright WebKit，SCN-0001 45 条断言）、`tools/verify-workflow-list.js` / `tools/verify-workflow-editor.js`（SCN-0018/0019，fake B3 + Playwright）；`npm test` 串联零依赖门禁、BFF 单测、Playwright 业务场景与工作流场景；人工 Safari 走查为发布门禁。
- 明确不做：真实工作流执行引擎、Agent 运行时、CI/CD 触发、权限体系、密钥加密存储、移动端适配、前端持久化；BFF 不做 CORS、鉴权、TLS、DTO 映射、revision 缓存或聚合。

## 2 组件地图

### 2.1 业务组件（11 个 `CMP-*`）

| 组件 | 页面入口 | 源码 | 职责 |
|---|---|---|---|
| `CMP-ui-shell` | 13 页公共外壳 | `assets/js/ui.js` | 顶栏、左侧导航、面包屑/页头、用户区、待确认角标、字号缩放、`DF.*` 原语 |
| `CMP-workflow-list` | `pages/workflow-list.html` | `workflow-list.js` | B3 工作流列表、筛选、统计、新建向导/复制/改名/删除/导入导出；无运行入口 |
| `CMP-workflow-editor` | `pages/workflow-editor.html?id=` | `workflow-editor.js` + `workflow/views/*` | 画布阶段/节点/边编辑、属性抽屉、本地校验、手动保存、DSL 预览与导出；无发布/版本/运行 |
| `CMP-instances` | `instances.html` + `instance-detail.html?id=` | `instances.js`、`instance-detail.js` | 实例列表、轨迹与留痕、暂停/终止/重试/重跑、人工批准驳回、fan-out 聚合 |
| `CMP-skills` | `pages/skills.html` + `pages/skill-detail.html?id=&mode=` | `skills.js`、`skill-detail.js`、`skill-common.js`、`skill-detail-markdown.js` | Skill 列表、筛选、启停、删除、引用方；专门页承接查看/编辑/新建，正文用 Milkdown 渲染、编辑走草稿 |
| `CMP-experts` | `pages/experts.html` | `experts.js` | 专家列表、五区详情/编辑、Skill/工具组合、启停 |
| `CMP-harnesses` | `pages/harnesses.html` | `harnesses.js` | 设施列表、注册、健康/配额、启停、删除 |
| `CMP-tools` | `pages/tools.html` | `tools.js` | 工具注册表、注册、模拟调试、引用方、删除保护 |
| `CMP-analytics` | `pages/analytics.html` | `analytics.js` | KPI、趋势、阶段准出、评审记录、Skill 审计（只读） |
| `CMP-workspaces` | `workspaces.html` + `workspace-detail.html?id=` | `workspaces.js`、`workspace-detail.js` | 工作区列表、三步新建、详情、连通性、归档/清理 |
| `CMP-keys` | `pages/keys.html` | `keys.js` | git/LLM Key 列表、添加、掩码、校验、绑定用途、删除 |

### 2.2 共享模块与基础设施

| 模块 | 源码 | 对外契约 | 说明 |
|---|---|---|---|
| 外壳/公共组件 | `assets/js/ui.js`（具名导出 `DF`） | `DF.renderShell`、`DF.menu`、`DF.modal.*`、`DF.drawer`、`DF.table/empty/field/kv/statCard/tabsHtml`、`DF.zoomK/zoomOnFixed`、`DF.ls*/ss*`、`DF.download/deep/esc` | 13 页共用；不含业务规则 |
| 模拟数据 | `assets/js/mock-data.js`（具名导出 `MOCK`） | 集合 + `MOCK.byId/now/m/mts` | 原型夹具；读写都在内存 |
| 共享数据层 | `assets/js/api.js`（具名导出 `API`） | `list/get/create/update/toggle/remove/document/categories/errorText` | B1 四页共用；revision 缓存 + 文档 ETag/文本缓存；不做 DTO 映射、不回落 MOCK |
| 工作区共用 | `assets/js/pages/workspace-common.js`（具名导出 `WSC`） | `treeHtml/createdText/readNewWs/saveNewWs/dropNewWs/syncNewWs/pad` | 仅 `CMP-workspaces` 两页使用 |
| 静态服务 | `server.js` | 静态文件 + `/` 302 | 只服务 `pages/` 与 `assets/`，绑定 `127.0.0.1`；拒绝点文件与越界路径 |
| 同源网关 | `bff/`（`CMP-bff`） | `/api/v1/*`、`/healthz` 透明转发 | 与 `server.js` 同进程；不做 DTO 映射、revision、重试、聚合；详见 `components/bff/spec.md` |
| 工作流数据服务 | `assets/js/workflow/data.js` | `CMP-workflow-data` §1 的 11 个操作 | B3 工作流唯一读写入口；页面不得直接 `fetch /api/v1/workflows*`；规格见 `components/workflow-data/spec.md` |
| 工作流领域模型/校验 | `assets/js/workflow/model.js`、`validate.js` | 图映射、ID、DSL、B3 规则镜像 | 无 DOM/network；供数据服务与编辑器复用 |
| 工作流视图 | `assets/js/workflow/views/{canvas,inspector,dsl}.js` | 画布/属性/DSL 纯视图 | 编辑器按领域与视图拆分；交互编排留在页面 |
| 同源 HTTP 传输 | `assets/js/shared/http.js` | `request/requestText/ApiError` | B3 工作流复用；B1 仍走 `api.js` 的 ETag/文档缓存 |
| 验证工具 | `tools/check-docs.js`、`tools/smoke-test.js`、`tools/verify-user-menu.js`、`tools/gen-scenario-index.js` | npm scripts | 不参与页面运行 |

## 3 依赖方向与禁止边

| 调用方 | 被调方 | 契约 | 方式 | 备注 |
|---|---|---|---|---|
| 页面 JS | `DF` | `DF.renderShell` / 公共组件 | 同步，ESM import | 13 页统一外壳；禁止绕开 `DF` 自建弹层/表格 |
| 页面 JS | `MOCK` | 集合读取 + 内存写 | 同步，ESM import | 只读为主；写只改内存 |
| 页面 JS（B1 四类资产） | `API` | `/api/v1` DTO + `/skills/{id}/document` | HTTP，同源 | 四页直接用 DTO；文档视图只用 API-31 原文；不建客户端视图模型；不直连 3100 |
| 工作流两页 | `workflow/data` | B3 `/api/v1/workflows*` | HTTP，同源 | 唯一读写入口；写带 `If-Match`；不直连 3100 |
| 工作流两页 | `workflow/model` / `validate` / `views` | 图映射、本地规则、纯视图 | 同步，ESM import | 不碰网络；`validate` 镜像 B3 规则 |
| `CMP-workspaces` 两页 | `WSC` | 目录树/跨页联动 | 同步，ESM import | 不供其他页面使用 |
| 页面 ↔ 页面 | — | URL 参数 / sessionStorage 单键 | 跳转或一次性传递 | 禁止互相 `import`/调用 JS |
| `server.js` | 静态文件 / `CMP-bff` | `/pages/*`、`/assets/*`、`/api/v1/*` | HTTP / 进程内 | 组合根；不承载业务逻辑 |
| `CMP-bff` | B1 后端 | `/api/v1/*`、`/healthz` | HTTP | 透明转发；不改写 DTO/状态/错误体 |
| `tools/*` | 页面 | Playwright / `node --test` | 测试进程 | 不进入生产依赖 |
| 页面 JS | `assets/vendor/<dep>` | `DEP-xxxx` 登记文件 | 本地 ESM/UMD | 仅登记版本；禁 CDN/远程 URL；新依赖先准入 |

**禁止边**：

- 页面组件之间不得互相引用 JS 或共享可变模块状态；跨页只允许 URL 与 `df-new-instance` / `df-new-workspace` 两个一次性键。
- `DF` 与 `MOCK` 不得出现业务规则或页面专属逻辑；`MOCK` 不是数据服务，不得新增“写入口 API”来掩盖多写。
- `server.js` 不得承载业务 API；只允许挂载 `CMP-bff` 做透明转发；页面不得依赖 Node 侧能力。
- `CMP-bff` 不得 import `DF`/`MOCK`/页面代码，不得做 DTO 映射、revision 缓存、重试、聚合或模拟数据。
- 四页 live 后不得自动回落 MOCK；失败必须显式报错。
- 同层页面不横调；共享能力下沉到 `DF`/`WSC`，跨页流程上提到 URL 约定。
- 页面 JS 不得引用未登记 `DEP-xxxx` 的第三方脚本/模块，不得出现 `http(s)://` 或协议相对外链；`package.json` 的 `dependencies` / `devDependencies` 保持为空（构建链另案 P1）。

> 可机械判定的部分：`tools/check-architecture.js` 覆盖边 1/3/4/5，并机械检查边 6 的共享模块路径；边 7 由 `tools/check-deps.js` 覆盖。边 2（`DF`/`MOCK` 是否承载业务规则）与边 6 的任意横向耦合仍需人工评审。

> 上表已是 ESM 后的依赖矩阵：`DF`/`MOCK`/`API`/`WSC` 均为模块 import；页面互引、live/demo 隔离与「工作流只走数据服务」三条禁止边不变。迁移期模块图见 `history/works/2026-10-30-frontend-esm/design.md`。

## 4 契约与入口

### 4.1 页面入口契约

- 列表/配置页：`/pages/<name>.html`。
- 详情页：`/pages/instance-detail.html?id=<instanceId>`、`/pages/workspace-detail.html?id=<workspaceId>`、`/pages/workflow-editor.html?id=<workflowId>`、`/pages/skill-detail.html?id=<skillId>&mode=<view|edit|new>`；MOCK 页缺省时回落到夹具第一条；工作流编辑器与 Skill 专门页缺 `id`/404 显式报错，不回落。
- 所有页面加载后由 `DF.renderShell` 生成外壳；页面主体写入 `#page-body`。

### 4.2 组件操作契约

| 组件 | 操作 ID |
|---|---|
| `CMP-ui-shell` | `#renderShell`、`#topbar`、`#nav`、`#font-scale`、`#bell`、`#user-menu` |
| `CMP-workflow-list` | `#list`、`#create`、`#copy`、`#update`、`#delete`、`#import`、`#export` |
| `CMP-workflow-editor` | `#open`、`#add-node`、`#connect-edge`、`#inspector`、`#validate`、`#save`、`#dsl` |
| `CMP-instances` | `#list`、`#start-run`、`#pause-resume`、`#terminate`、`#retry-node`、`#approve-reject` |
| `CMP-skills` | `#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail-page`、`#document` |
| `CMP-experts` | `#list`、`#create`、`#edit`、`#toggle`、`#detail`、`#picker` |
| `CMP-harnesses` | `#list`、`#register`、`#detail`、`#toggle`、`#delete` |
| `CMP-tools` | `#list`、`#register`、`#edit`、`#refs`、`#delete` |
| `CMP-analytics` | `#overview`、`#trend`、`#stage-pass`、`#review-records`、`#skill-audit` |
| `CMP-workspaces` | `#list`、`#create`、`#detail`、`#check-connection`、`#archive`、`#delete` |
| `CMP-keys` | `#list`、`#create-git`、`#create-llm`、`#verify`、`#bind`、`#delete` |

### 4.3 共享契约不变量

- 13 页外壳结构一致；`DF.menu` 默认左缘、`#user-menu` 使用 `alignRight` 右缘语义，不得互换。
- 缩放系数只通过 `DF.zoomK()` / `DF.zoomOnFixed()` 获取；页面不得缓存或自算。
- 弹窗 footer 按钮以最近容器为作用域绑定；同一 id 全文档唯一；先 `innerHTML` 后 `appendChild`。
- 错误与校验在页面入口统一处理，业务数据缺失不得用 `?? 0` / `|| "Unknown"` 掩盖；展示性占位符除外。
- B1 四类资产的数据契约以 OpenAPI DTO 为准；工作流两页以 B3 OpenAPI 为准；其余页面以 `MOCK` 集合字段为准。字段不一致时以代码为准并登记到模块卡「已知偏差」。
- Skill 契约 v2 的 `description` 取代 `summary/triggers`；文档视图只消费 API-31 响应体，不在前端重组 `sections`，`API` 的文档缓存按 revision 失效、304 复用上次文本；渲染走 `SKILL_MD` + `DEP-0001`，只读且不执行原始 HTML。

## 5 数据所有权

| 数据 | 写入口 | 读方 | 存储 | 一致性/复位 |
|---|---|---|---|---|
| B3 Workflow + Definition | `CMP-workflow-list`、`CMP-workflow-editor`（经 `workflow/data`） | 列表、编辑器 | B3 PostgreSQL | revision + `If-Match`；`layout/viewport` 前端拥有/后端透传 |
| `MOCK.workflows` | 无（只读夹具） | 实例页（MOCK） | 内存 | 工作流两页已切 B3，不再写夹具 |
| `MOCK.instances` | `CMP-instances` | 实例、列表统计、外壳角标 | 内存 | 单写；刷新复位 |
| `MOCK.workspaces` | `CMP-workspaces` | 列表、编辑器、实例、Key 绑定 | 内存 | 单写；刷新复位 |
| B1 Harness/Tool/Skill/Expert | 四个资产页 | 四个资产页 | B1 PostgreSQL | B1 事务 + `If-Match`；不写 `MOCK` |
| B1 Skill 文档文本/ETag | 无（`API` 派生缓存） | `CMP-skills` 文档视图 | 内存 | 按 skill revision 失效；304 复用上次文本；刷新复位 |
| `MOCK.experts/skills/tools/harnesses` | 无（四页已切 B1） | 其余 MOCK 页的演示数据 | 内存 | 只读夹具；刷新复位；工作流向导的专家列表走 B1 |
| `MOCK.keys` | `CMP-keys` | 工作区绑定、Key 列表 | 内存 | 单写；刷新复位 |
| `MOCK.analytics` | —（只读） | 效能看板 | 内存 | 只读夹具 |
| `MOCK.knowledgeTree` | —（只读） | 编辑器节点配置 | 内存 | 只读夹具 |
| `df-font` / `df-collapsed` | `CMP-ui-shell` | 外壳、13 页 | localStorage | UI 偏好；跨页保留 |
| `wl-view` | `CMP-workflow-list` | 本页 | localStorage | UI 偏好；跨页保留 |
| `df-new-instance` | `CMP-instances` | 列表 → 详情 | sessionStorage | 一次性；消费后删除 |
| `df-new-workspace` | `CMP-workspaces`（`WSC`） | 列表 → 详情 | sessionStorage | 一次性；消费后删除 |

> `MOCK` 是夹具而非数据服务：没有事务、没有并发控制、没有跨标签页一致性；工作流两页已不再写 `MOCK.workflows`，写入口统一为 B3 `workflow/data`。
>
> B1 四类资产的唯一写入口是 B1 后端；B3 工作流的唯一写入口是 B3 后端（经 `workflow/data`）。`CMP-bff` 只做传输，无业务数据所有权。

## 6 冷热路径

除 BFF 外仍为 N/A（原型页面同步内存操作）。BFF 是唯一热路径：

| 路径 | 依赖 | 失败语义 | 资源隔离 | 预算 |
|---|---|---|---|---|
| `/api/v1/*`、`/healthz` | Node `http`/`fetch`；无业务依赖 | 502/504/413/405；不重试；不改写后端状态 | body ≤1 MiB；timeout 10s；单进程事件循环 | 源码 + 测试约 20 KB |

静态页面与 MOCK 页面不设延迟预算，不编造指标。

## 7 验证矩阵

| 组件 | check-docs（模块卡 + REQ/SCN） | Playwright 13 页 | 场景 | 人工 Safari |
|---|---|---|---|---|
| `CMP-ui-shell` | ✓ | ✓ | `SCN-0001` verified（45/45） | 待验收（R9） |
| `CMP-workflow-list` | ✓ | ✓ | `SCN-0018` verified（14/14） | — |
| `CMP-workflow-editor` | ✓ | ✓ | `SCN-0019` verified（11/11） | — |
| `CMP-workflow-data` | ✓ | — | `SCN-0018/0019` 页面路径 + 24 条纯逻辑 | — |
| `CMP-instances` | ✓ | ✓ | `SCN-0004` verified（4/4） | — |
| `CMP-skills` | ✓ | ✓ | `SCN-0005` 4/4 + `SCN-0014` 5/5 + `SCN-0015` 4/4 + `SCN-0016` 4/4 + `SCN-0017` 4/4；引擎 29/29；`SCN-0013` 已废弃 | — |
| `CMP-experts` | ✓ | ✓ | `SCN-0006` verified（4/4） | — |
| `CMP-harnesses` | ✓ | ✓ | `SCN-0007` verified（4/4） | — |
| `CMP-tools` | ✓ | ✓ | `SCN-0008` verified（4/4） | — |
| `CMP-analytics` | ✓ | ✓ | `SCN-0009` verified（4/4） | — |
| `CMP-workspaces` | ✓ | ✓ | `SCN-0010` verified（4/4） | — |
| `CMP-keys` | ✓ | ✓ | `SCN-0011` verified（4/4） | — |
| `CMP-bff` | ✓ | — | `SCN-0012` verified（BFF 12/12） | — |

- 语法层：`node --check` 全部页面 JS、`bff/*.js`、`tests/bff/*.js`。
- 结构层：`node tools/smoke-test.js`（Playwright WebKit；13/13 页面）。
- 引擎层：`node tools/verify-user-menu.js`（需 Playwright WebKit 与运行中的 `:3000`）。
- 业务场景层：`node tools/verify-m1-scenarios.js`（Playwright，49/49；各场景至少 3 正 1 反）；工作流：`npm run test:workflow`（纯逻辑 24/24 + SCN-0018 14/14 + SCN-0019 11/11）；B1 真实验证：`tools/verify-b1-pages.js`（读 4/4）；`tools/verify-b1-writes.js`（写 4/4，2026-10-30 已确认并清理）。
- BFF 层：`npm run test:bff`（Node `node:test` + stub 上游；12 条契约断言，含 `If-None-Match`/304）。
- 人工层：Safari 走查为发布门禁；未完成不宣称“浏览器全兼容”。
- **M1 十页 + B1/Skill v2/Skill 专门页场景已 verified**：M1 40/40；全量 Playwright 49/49（数量见 `design/scenarios/_index.md`）；专门页另加引擎层 29/29。

## 8 已知偏差与基线登记

1. **M1 追溯与验收闭环**：10 个页面已补 M1 追溯；原列表/编辑器场景已归档，其余场景 `verified`，M1 40/40 通过，10 张 REQ 转 `delivered`（R7/R10 关闭）。冒烟仍不是业务验收。
2. **MOCK 多写/复位**：工作流两页已切 B3；其余 MOCK 集合单写但都只改内存，刷新复位，无事务/并发控制（R8）。
3. **Safari 人工未完成**：engine 层只覆盖 WebKit 2104 的 transform 兜底路径；zoom 路径需真实 Safari 确认（R1/R9）。
4. **页面组件不是独立部署单元**：11 个业务组件 + 1 个基础设施组件（`CMP-bff`）共享 `DF`/`MOCK`（BFF 不共享）；按页面入口划分；不引入模块打包、事务或分层过度设计（KISS）。
5. **静态服务与 BFF 仅本地**：无鉴权、无 TLS；只服务 `pages/` 与 `assets/`，BFF 只转发 `/api/v1/*` 与 `/healthz`，均绑定 `127.0.0.1`。
6. **B1 四类资产与 B3 工作流已接入**：`CMP-bff` 12 条单测通过；四个资产页直接消费 B1 DTO，工作流两页经 `workflow/data` 消费 B3（`layout/viewport` 透传）；B1 真实读写由 `tools/verify-b1-*` 覆盖；B3 页面契约由 `tools/verify-workflow-*` 覆盖（fake B3）；真实 B3 写路径已于 2026-10-30 用临时记录验证创建/保存/删除并清理；实例/效能/工作区/Key 仍 MOCK。
7. **运行时依赖改为准入制**：基线由「无第三方运行时依赖」改为「默认零 + 准入登记（`DEP-xxxx`）」；当前已登记 `DEP-0001`（Milkdown 7.7.0，查看与编辑共用 + Prism 语法高亮，177.6 KB gzip，按需加载）；门禁 `tools/check-deps.js`；三条红线（工具链/服务端零依赖、禁 CDN）见 `design/dependencies.md`。

## 9 查阅与变更

- 组件边界与契约：`design/components/<id>/spec.md` §0；组件 frontmatter 的 `requirement` / `scenario` 是 REQ/SCN 反查入口。
- 需求与场景：`requirements/REQ-0001..0017`、`design/scenarios/`（`_index.md` 为生成索引）；工作流 live 见 `REQ-0016/0017`、`SCN-0018/0019`。
- 工序与决策：`history/works/2026-10-26-skill-detail-page/brief.md`、`history/works/2026-10-25-b1-integration/brief.md`、`history/works/2026-10-23-component-baseline/brief.md`、`history/decisions/2026-10-23-skill-system-upgrade.md`。
- 依赖准入：`design/dependencies.md`（清单 + 程序）；编码防御规则：`design/code-refactoring.md`；测试方法：`design/debugging-and-testing.md`。
- **变更规则**：改页面边界、数据所有权、CMP 操作或共享契约 → 先按 `arch-design-spec` 定级；P1 需人确认，更新对应模块卡 + 本文 + `check-docs`，再动代码。新增页面必须登记组件卡与验证入口，禁止静默扩页。
