---
layer: design
module: global
status: current
updated: 2026-10-23
---

# 系统架构（现行真相）

> 本文只写系统现在是什么。历史重构清单与效果数据见 git `f7e3efb`；本批审视与收口见 `history/works/2026-10-23-component-baseline/result.md`。组件边界、数据权属与验证入口以各 `design/components/<id>/spec.md` 的 `## 0 模块卡` 为准；本文只给系统级地图与约束。

## 1 技术基线与边界

- 形态：纯前端高保真交互原型，12 个 HTML 页面；原生 HTML/CSS/JS，无构建、无第三方运行时依赖。
- 数据：`assets/js/mock-data.js` 在页面加载时构造 `window.MOCK`；全部页面只读消费，写操作只改内存，刷新复位；无后端、无数据库、无真实鉴权。
- 服务：`server.js`（Node 原生 `http`）只做静态托管与 `/` 302；不承载业务 API。
- 验证：`tools/check-docs.js`（五态文档）、`tools/smoke-test.js`（jsdom 12 页结构冒烟）、`tools/verify-user-menu.js`（Playwright WebKit，SCN-0001 45 条断言）；人工 Safari 走查为发布门禁。
- 明确不做：真实工作流执行引擎、Agent 运行时、CI/CD 触发、权限体系、密钥加密存储、移动端适配、持久化。

## 2 组件地图

### 2.1 业务组件（11 个 `CMP-*`）

| 组件 | 页面入口 | 源码 | 职责 |
|---|---|---|---|
| `CMP-ui-shell` | 12 页公共外壳 | `assets/js/ui.js` | 顶栏、左侧导航、面包屑/页头、用户区、待确认角标、字号缩放、`DF.*` 原语 |
| `CMP-workflow-list` | `pages/workflow-list.html` | `workflow-list.js` | 工作流列表、筛选、统计、新建/复制/删除/导出、发起运行入口 |
| `CMP-workflow-editor` | `pages/workflow-editor.html?id=` | `workflow-editor.js` | 画布节点/边编辑、属性抽屉、校验、DSL 预览与导出 |
| `CMP-instances` | `instances.html` + `instance-detail.html?id=` | `instances.js`、`instance-detail.js` | 实例列表、轨迹与留痕、暂停/终止/重试/重跑、人工批准驳回、fan-out 聚合 |
| `CMP-skills` | `pages/skills.html` | `skills.js` | Skill 列表、筛选、详情/编辑抽屉、启停、删除、引用方 |
| `CMP-experts` | `pages/experts.html` | `experts.js` | 专家列表、五区详情/编辑、Skill/工具组合、启停 |
| `CMP-harnesses` | `pages/harnesses.html` | `harnesses.js` | 设施列表、注册、健康/配额、启停、删除 |
| `CMP-tools` | `pages/tools.html` | `tools.js` | 工具注册表、注册、模拟调试、引用方、删除保护 |
| `CMP-analytics` | `pages/analytics.html` | `analytics.js` | KPI、趋势、阶段准出、评审记录、Skill 审计（只读） |
| `CMP-workspaces` | `workspaces.html` + `workspace-detail.html?id=` | `workspaces.js`、`workspace-detail.js` | 工作区列表、三步新建、详情、连通性、归档/清理 |
| `CMP-keys` | `pages/keys.html` | `keys.js` | git/LLM Key 列表、添加、掩码、校验、绑定用途、删除 |

### 2.2 共享模块与基础设施

| 模块 | 源码 | 对外契约 | 说明 |
|---|---|---|---|
| 外壳/公共组件 | `assets/js/ui.js`（`window.DF`） | `DF.renderShell`、`DF.menu`、`DF.modal.*`、`DF.drawer`、`DF.table/empty/field/kv/statCard/tabsHtml`、`DF.zoomK/zoomOnFixed`、`DF.ls*/ss*`、`DF.download/deep/esc` | 12 页共用；不含业务规则 |
| 模拟数据 | `assets/js/mock-data.js`（`window.MOCK`） | 集合 + `MOCK.byId/now/m/mts` | 原型夹具；读写都在内存 |
| 工作区共用 | `assets/js/pages/workspace-common.js`（`window.WSC`） | `treeHtml/createdText/readNewWs/saveNewWs/dropNewWs/syncNewWs/pad` | 仅 `CMP-workspaces` 两页使用 |
| 静态服务 | `server.js` | 静态文件 + `/` 302 | 只服务 `pages/` 与 `assets/`，绑定 `127.0.0.1`；拒绝点文件与越界路径 |
| 验证工具 | `tools/check-docs.js`、`tools/smoke-test.js`、`tools/verify-user-menu.js`、`tools/gen-scenario-index.js` | npm scripts | 不参与页面运行 |

## 3 依赖方向与禁止边

| 调用方 | 被调方 | 契约 | 方式 | 备注 |
|---|---|---|---|---|
| 页面 JS | `DF` | `DF.renderShell` / 公共组件 | 同步，全局对象 | 12 页统一外壳；禁止绕开 `DF` 自建弹层/表格 |
| 页面 JS | `MOCK` | 集合读取 + 内存写 | 同步，全局对象 | 只读为主；写只改内存 |
| `CMP-workspaces` 两页 | `WSC` | 目录树/跨页联动 | 同步，全局对象 | 不供其他页面使用 |
| 页面 ↔ 页面 | — | URL 参数 / sessionStorage 单键 | 跳转或一次性传递 | 禁止互相 `import`/调用 JS |
| `server.js` | 静态文件 | `/pages/*`、`/assets/*` | HTTP | 不执行页面逻辑 |
| `tools/*` | 页面 | jsdom / Playwright | 测试进程 | 不进入生产依赖 |

**禁止边**：

- 页面组件之间不得互相引用 JS 或共享可变模块状态；跨页只允许 URL 与 `df-new-instance` / `df-new-workspace` 两个一次性键。
- `DF` 与 `MOCK` 不得出现业务规则或页面专属逻辑；`MOCK` 不是数据服务，不得新增“写入口 API”来掩盖多写。
- `server.js` 不得承载 API；页面不得依赖 Node 侧能力。
- 同层页面不横调；共享能力下沉到 `DF`/`WSC`，跨页流程上提到 URL 约定。

## 4 契约与入口

### 4.1 页面入口契约

- 列表/配置页：`/pages/<name>.html`。
- 详情页：`/pages/instance-detail.html?id=<instanceId>`、`/pages/workspace-detail.html?id=<workspaceId>`、`/pages/workflow-editor.html?id=<workflowId>`；缺省时回落到夹具第一条。
- 所有页面加载后由 `DF.renderShell` 生成外壳；页面主体写入 `#page-body`。

### 4.2 组件操作契约

| 组件 | 操作 ID |
|---|---|
| `CMP-ui-shell` | `#renderShell`、`#topbar`、`#nav`、`#font-scale`、`#bell`、`#user-menu` |
| `CMP-workflow-list` | `#list`、`#create`、`#run`、`#copy`、`#delete`、`#exportDsl` |
| `CMP-workflow-editor` | `#open`、`#drag-node`、`#connect-edge`、`#inspector`、`#validate`、`#exportDsl` |
| `CMP-instances` | `#list`、`#start-run`、`#pause-resume`、`#terminate`、`#retry-node`、`#approve-reject` |
| `CMP-skills` | `#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail` |
| `CMP-experts` | `#list`、`#create`、`#edit`、`#toggle`、`#detail`、`#picker` |
| `CMP-harnesses` | `#list`、`#register`、`#detail`、`#toggle`、`#delete` |
| `CMP-tools` | `#list`、`#register`、`#debug`、`#refs`、`#delete` |
| `CMP-analytics` | `#overview`、`#trend`、`#stage-pass`、`#review-records`、`#skill-audit` |
| `CMP-workspaces` | `#list`、`#create`、`#detail`、`#check-connection`、`#archive`、`#delete` |
| `CMP-keys` | `#list`、`#create-git`、`#create-llm`、`#verify`、`#bind`、`#delete` |

### 4.3 共享契约不变量

- 12 页外壳结构一致；`DF.menu` 默认左缘、`#user-menu` 使用 `alignRight` 右缘语义，不得互换。
- 缩放系数只通过 `DF.zoomK()` / `DF.zoomOnFixed()` 获取；页面不得缓存或自算。
- 弹窗 footer 按钮以最近容器为作用域绑定；同一 id 全文档唯一；先 `innerHTML` 后 `appendChild`。
- 错误与校验在页面入口统一处理，业务数据缺失不得用 `?? 0` / `|| "Unknown"` 掩盖；展示性占位符除外。
- 数据契约以 `MOCK` 集合字段为准；页面规格中的字段名与夹具不一致时，以代码为准并登记到模块卡「已知偏差」。

## 5 数据所有权

| 数据 | 写入口 | 读方 | 存储 | 一致性/复位 |
|---|---|---|---|---|
| `MOCK.workflows` | `CMP-workflow-list`、`CMP-workflow-editor` | 列表、编辑器、实例、工具、专家引用统计 | 内存 | 两个写入口（R8）；刷新复位 |
| `MOCK.instances` | `CMP-instances` | 实例、列表统计、外壳角标 | 内存 | 单写；刷新复位 |
| `MOCK.workspaces` | `CMP-workspaces` | 列表、编辑器、实例、Key 绑定 | 内存 | 单写；刷新复位 |
| `MOCK.experts` | `CMP-experts` | 编辑器、工具引用、实例、Key 绑定、Skill 引用 | 内存 | 单写；刷新复位 |
| `MOCK.skills` | `CMP-skills` | 编辑器、专家组合 | 内存 | 单写；刷新复位 |
| `MOCK.tools` | `CMP-tools` | 编辑器、专家组合、引用统计 | 内存 | 单写；刷新复位 |
| `MOCK.harnesses` | `CMP-harnesses` | 编辑器、工具、实例、Key 绑定 | 内存 | 单写；刷新复位 |
| `MOCK.keys` | `CMP-keys` | 工作区绑定、Key 列表 | 内存 | 单写；刷新复位 |
| `MOCK.analytics` | —（只读） | 效能看板 | 内存 | 只读夹具 |
| `MOCK.knowledgeTree` | —（只读） | 编辑器节点配置 | 内存 | 只读夹具 |
| `df-font` / `df-collapsed` | `CMP-ui-shell` | 外壳、12 页 | localStorage | UI 偏好；跨页保留 |
| `wl-view` | `CMP-workflow-list` | 本页 | localStorage | UI 偏好；跨页保留 |
| `df-new-instance` | `CMP-instances` | 列表 → 详情 | sessionStorage | 一次性；消费后删除 |
| `df-new-workspace` | `CMP-workspaces`（`WSC`） | 列表 → 详情 | sessionStorage | 一次性；消费后删除 |

> `MOCK` 是夹具而非数据服务：没有事务、没有并发控制、没有跨标签页一致性；`workflows` 有两个页面写入口。接真实后端时按数据服务重切，不沿用本表的“所有者”作为数据库权属（R8）。

## 6 冷热路径

**N/A（原型）**。理由：没有后端、真实异步任务、队列、重试或 SLA；页面加载与交互全部是同步内存操作，唯一的延时是 `setTimeout` 模拟渲染/跳转。不设“热路径”与“冷路径”预算，也不编造延迟指标；真实执行引擎落地时再按 `arch-design-spec` 补路径卡。

## 7 验证矩阵

| 组件 | check-docs（模块卡） | jsdom 12 页 | SCN-0001 引擎 | 人工 Safari |
|---|---|---|---|---|
| `CMP-ui-shell` | ✓ | ✓ | ✓ 45/45 | 待验收（R9） |
| `CMP-workflow-list` | ✓ | ✓ | —（基线） | — |
| `CMP-workflow-editor` | ✓ | ✓ | —（基线） | — |
| `CMP-instances` | ✓ | ✓ | —（基线） | — |
| `CMP-skills` | ✓ | ✓ | —（基线） | — |
| `CMP-experts` | ✓ | ✓ | —（基线） | — |
| `CMP-harnesses` | ✓ | ✓ | —（基线） | — |
| `CMP-tools` | ✓ | ✓ | —（基线） | — |
| `CMP-analytics` | ✓ | ✓ | —（基线） | — |
| `CMP-workspaces` | ✓ | ✓ | —（基线） | — |
| `CMP-keys` | ✓ | ✓ | —（基线） | — |

- 语法层：`node --check` 全部页面 JS。
- 结构层：`node tools/smoke-test.js`（需 jsdom，安装见 `dev-environment.md`）。
- 引擎层：`node tools/verify-user-menu.js`（需 Playwright WebKit 与运行中的 `:3000`）。
- 人工层：Safari 走查为发布门禁；未完成不宣称“浏览器全兼容”。

## 8 已知偏差与基线登记

1. **M1 无 REQ 追溯**：10 个页面组件只有冒烟，没有 SCN；按用户 2026-10-23 决策登记为「原型基线、无 REQ 追溯」，不补 10 张 REQ，也不把冒烟当业务验收（R7）。
2. **MOCK 多写/复位**：`workflows` 有两个页面写入口；其余集合单写但都只改内存；刷新复位，无事务/并发控制（R8）。
3. **Safari 人工未完成**：engine 层只覆盖 WebKit 2104 的 transform 兜底路径；zoom 路径需真实 Safari 确认（R1/R9）。
4. **页面组件不是独立部署单元**：11 个组件共享 `DF`/`MOCK`，按页面入口划分；不引入模块打包、事务或分层过度设计（KISS）。
5. **静态服务仅本地**：无鉴权、无 TLS；只服务 `pages/` 与 `assets/`，绑定 `127.0.0.1`。

## 9 查阅与变更

- 组件边界与契约：`design/components/<id>/spec.md` §0。
- 工序与决策：`history/works/2026-10-23-component-baseline/brief.md`、`history/decisions/2026-10-23-skill-system-upgrade.md`。
- 编码防御规则：`design/code-refactoring.md`；测试方法：`design/debugging-and-testing.md`。
- **变更规则**：改页面边界、数据所有权、CMP 操作或共享契约 → 先按 `arch-design-spec` 定级；P1 需人确认，更新对应模块卡 + 本文 + `check-docs`，再动代码。新增页面必须登记组件卡与验证入口，禁止静默扩页。
