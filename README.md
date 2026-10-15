# AgentFlow · 研发智能体工作流编排服务 UE 原型

高保真可交互纯前端原型：无构建、零外部依赖，Node 仅用于静态托管。

## 运行

```bash
node server.js
# ➜ http://localhost:3000   （自动打开工作流列表页）
```

也可指定端口：`PORT=8080 node server.js`

## 目录结构

```
├─ server.js              零依赖静态服务器（/ 重定向到首页）
├─ package.json           npm start = node server.js
├─ assets/
│  ├─ css/main.css        设计系统：布局/组件/语义色/画布样式（全局唯一）
│  └─ js/
│     ├─ ui.js            DF.* 组件库：外壳导航、抽屉、弹窗（含 form/picker）、
│     │                   空态/表格/搜索框/字段/kv/Tabs/统计卡、Toast、状态标签、图标
│     ├─ mock-data.js     window.MOCK 全量模拟数据（各页面数据契约）
│     └─ pages/           每个页面的逻辑 JS（node --check 可校验）
│                         └─ workspace-common.js  工作区列表/详情共用模块（window.WSC）
├─ pages/                 页面 HTML（每页一个文件，私有样式内联 <style>）
├─ tools/smoke-test.js    页面冒烟测试（jsdom 逐页加载，见 docs/13 §5）
├─ docs/                  需求归纳与页面细化规格（实现依据）
└─ reference/             原始参考资料 workflow_concept.pptx
```

## 页面清单

| 页面 | 文件 | 规格 |
|---|---|---|
| 工作流列表 | pages/workflow-list.html | docs/03 |
| 工作流编辑器 | pages/workflow-editor.html | docs/04 |
| Skill 库 | pages/skills.html | docs/05 |
| 专家管理 | pages/experts.html | docs/06 |
| Harness 管理 | pages/harnesses.html | docs/07 |
| 工具与集成 | pages/tools.html | docs/08 |
| 运行实例 / 详情 | pages/instances.html · pages/instance-detail.html | docs/09 |
| 效能看板 | pages/analytics.html | docs/10 |
| 工作区 / 详情 | pages/workspaces.html · pages/workspace-detail.html | docs/11 |
| 个人 Key 管理 | pages/keys.html | docs/12 |

## 原型说明

- 所有数据来自 `assets/js/mock-data.js`（内存态），刷新即复位；不持久化、无后端。
- 页面 JS 一律调用 `DF.*` 公共组件拼装 UI（空态/表格/表单弹窗等），新增页面请优先复用，
  组件清单与 API 见 `docs/13-代码梳理与公共组件.md`。
- 页面质量自检：`node --check` 全部 JS；`npm i --no-save jsdom && node tools/smoke-test.js` 冒烟。
- 推荐走查路径见 `docs/01-需求归纳总结.md` §6（旅程 A/B/C/D）。
