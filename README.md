# AgentFlow · 研发智能体工作流编排服务 UE 原型

高保真可交互前端 + 同源 BFF：无构建、零运行时依赖；Node 用于静态托管与 B1 API 透明转发。

## 运行

```bash
# 1) 先起 B1 后端（agent-flow-orchaster，:3100）
# 2) 再起原型
node server.js
# ➜ http://127.0.0.1:3000   （/ 重定向到工作流列表）
# ➜ /api/v1/*、/healthz 同源转发到 API_BASE（默认 http://127.0.0.1:3100）
```

也可指定端口：`PORT=8080 node server.js`。静态服务与 BFF 只监听 `127.0.0.1`；静态只服务 `pages/` 与 `assets/`。

## B1 同源接入

`CMP-bff`（`bff/`）只做透明转发，不做 DTO 映射、revision 缓存、重试或聚合：

- 路径：`/api/v1/*`、`/healthz`
- 配置：`API_BASE`（默认 `http://127.0.0.1:3100`）、`BFF_TIMEOUT_MS`（默认 10000）、`BFF_MAX_BODY`（默认 1 MiB）
- 单独运行：`PORT=3001 node bff/standalone.js`
- 当前状态：BFF 已就绪（`npm run test:bff` 9/9）；四个资产页的 live 切换在 P2/P3，当前仍读 MOCK；其余 8 页继续 MOCK 并标注演示数据。

## 目录结构

```
├─ server.js              零依赖静态服务器 + /api/v1、/healthz 同源挂载
├─ bff/                   CMP-bff：透明转发、超时/body 上限/502
├─ tests/bff/             BFF 契约单测（node --test）
├─ package.json           npm start / test / test:bff / check:docs / docs:index
├─ assets/
│  ├─ css/main.css        设计系统：布局/组件/语义色/画布样式（全局唯一）
│  └─ js/
│     ├─ ui.js            DF.* 组件库：外壳导航、抽屉、弹窗（含 form/picker）、
│     │                   空态/表格/搜索框/字段/kv/Tabs/统计卡、Toast、状态标签、图标
│     ├─ mock-data.js     window.MOCK 全量模拟数据（各页面数据契约）
│     └─ pages/           每个页面的逻辑 JS（node --check 可校验）
│                         └─ workspace-common.js  工作区列表/详情共用模块（window.WSC）
├─ pages/                 页面 HTML（每页一个文件，私有样式内联 <style>）
├─ tools/                 check-docs / gen-scenario-index / smoke-test / verify-m1-scenarios / verify-user-menu
├─ docs/                  五态文档：需求 / 计划 / 现行设计 / 工序 / 历史（入口 docs/README.md）
└─ reference/             原始参考资料 workflow_concept.pptx
```

## 页面清单

| 页面 | 文件 | 组件规格 |
|---|---|---|
| 工作流列表 | pages/workflow-list.html | docs/design/components/workflow-list/spec.md |
| 工作流编辑器 | pages/workflow-editor.html | docs/design/components/workflow-editor/spec.md |
| Skill 库 | pages/skills.html | docs/design/components/skills/spec.md |
| 专家管理 | pages/experts.html | docs/design/components/experts/spec.md |
| Harness 管理 | pages/harnesses.html | docs/design/components/harnesses/spec.md |
| 工具与集成 | pages/tools.html | docs/design/components/tools/spec.md |
| 运行实例 / 详情 | pages/instances.html · pages/instance-detail.html | docs/design/components/instances/spec.md |
| 效能看板 | pages/analytics.html | docs/design/components/analytics/spec.md |
| 工作区 / 详情 | pages/workspaces.html · pages/workspace-detail.html | docs/design/components/workspaces/spec.md |
| 个人 Key 管理 | pages/keys.html | docs/design/components/keys/spec.md |

## 原型说明

- B1 四类资产的目标数据源是 `http://127.0.0.1:3100`，经 `CMP-bff` 同源访问；P1 只落 BFF，四个资产页在 P2/P3 切 live。其余 8 页与切换前的资产页仍来自 `assets/js/mock-data.js`（内存态），刷新即复位；不持久化。
- 页面 JS 一律调用 `DF.*` 公共组件拼装 UI；组件地图、依赖方向与数据所有权见 `docs/design/architecture.md`，每个组件的契约见对应规格的 `## 0 模块卡`。
- 门禁：`npm test`（语法 + 五态文档 + 场景索引 + BFF 单测）；BFF 单测：`npm run test:bff`；冒烟：`npm run test:smoke`（需 jsdom）；业务场景：`npm run test:scenarios`（jsdom，10 场景 × 3 正 1 反）；引擎：`npm run test:engine`（需 Playwright WebKit 与运行中的 `:3000`）。安装与命令见 `docs/design/dev-environment.md`。
- 文档入口与阅读顺序见 `docs/README.md`；M1 的 10 个页面组件已补 `REQ-0002..0011` / `SCN-0002..0011`，场景 `verified`（40/40），REQ `delivered`；B1 接入见 `REQ-0012` / `SCN-0012` / `CMP-bff`。
