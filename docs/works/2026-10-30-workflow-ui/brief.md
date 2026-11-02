---
layer: works
module: workflow
status: active
updated: 2026-10-30
---

# 工序：工作流列表与编辑器同源接入（B3）

## 需求

- `REQ-0016`：工作流列表同源接入（浏览/检索/新建/复制/删除/导入导出）。
- `REQ-0017`：工作流编辑器同源接入（加载/编辑/校验/手动保存/DSL 导出）。

前置工序：`docs/history/works/2026-10-30-frontend-esm/`（全站 ESM 与测试栈迁移）。本工序的页面按 ESM 写，不回到全局脚本。

## 背景

B3 已冻结「结构/拓扑/专家绑定归后端，`layout/viewport` 纯透传；创建必须带合法图；拓扑/绑定错误阻断保存；导入允许空专家但保存前必须补齐」。UI 两页仍是 MOCK：`workflow-list.js` 写 `MOCK.workflows`，`workflow-editor.js` 用节点 `x/y`、非法边 ID（`n1>n2:seq`）、发布/版本/运行入口。需要按 B3 契约重写数据层与两页，并移除 MOCK 依赖。

同轮已确认的交互模型：纯手动保存、合法才可保存、非法元素红框 + 保存置灰、视口不算未保存修改、新建向导 + 模板复制、旧图不迁移、列表只展示工作流域指标。

## 验收标准

1. `SCN-0018`、`SCN-0019` 实现并 `verified`（Playwright，3 正 1 反）。
2. `workflow/data` 成为两页唯一读写入口；页面不直接 `fetch`；所有写操作带 `If-Match`；`details.issues` 能定位到节点/边/图级。
3. 列表：分页/搜索/类型筛选/排序（`updatedAt:desc`）；新建向导生成 `start→end` 合法图；模板复制 → `GET` 详情；改名/改类型/删除；导入显示 idMap + 未绑定 warning；导出 JSON/YAML；无发布/版本/运行/更新人。
4. 编辑器：加载详情与 `layout/viewport`；阶段/节点/边/专家编辑；本地校验镜像 B3；保存置灰 + 红框 + 校验面板 + 图级阻断条；409/428 不覆盖；离开警告；DSL 只读预览/复制/下载；无发布/版本/运行。
5. 两页 live-only：无 `MOCK` import，后端不可用显式报错；不静默回落。
6. 测试数据清理：上线前删除现有工作流记录（不迁移旧图）；由部署步骤执行，需用户确认（当前未执行）。
7. 文档：`workflow-list/spec.md`、`workflow-editor/spec.md`、`architecture.md`、`REQ/SCN` 与实现一致。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0030-07 | design | `CMP-workflow-list` + `CMP-workflow-editor` | 已完成（2026-10-30） | 本 brief、`REQ-0016/0017`、`SCN-0018/0019`、B3 契约、两页 spec、`dsl.schema.json` |
| T-0030-08 | change | `CMP-workflow-data`（新） | 已完成（2026-10-30） | `workflow/model.js`、`validate.js`、`data.js`、`shared/http.js`、`REQ/SCN` |
| T-0030-09 | change | `CMP-workflow-list` | 已完成（2026-10-30） | `workflow-list.js`、`workflow/data.js`、`shared/ui.js`、`SCN-0018` |
| T-0030-10 | change | `CMP-workflow-editor` | 已完成（2026-10-30） | `workflow-editor.js`、`workflow/model.js`、`validate.js`、`data.js`、`SCN-0019` |
| T-0030-11 | change | `CMP-workflow-list` + `CMP-workflow-editor` | 已完成（2026-10-30） | 两页移除 MOCK/发布/版本/运行引用；新增 fake-b3 与场景脚本 |
| T-0030-12 | verify | 两组件 | 已完成（2026-10-30） | `tools/verify-workflow-list.js`、`tools/verify-workflow-editor.js`、`npm test`、真实 B3 读写联调 |

## 装载清单（必读）

- `docs/requirements/REQ-0016-workflow-list-live.md`、`REQ-0017-workflow-editor-live.md`
- `docs/design/scenarios/flow/workflow-list/browse-workflows-live/scenario.md`、`flow/workflow-editor/edit-workflow-live/scenario.md`
- `docs/history/works/2026-10-30-frontend-esm/design.md`（ESM 模块边界与测试栈）
- B3 仓库：`docs/history/works/2026-10-30-workflow-contract-boundary/design.md`、`docs/history/decisions/2026-10-30-workflow-contract-boundary.md`、`src/components/workflow/graph.ts`、`service.ts`、`http-gateway/routes/workflow.ts`、`openapi.yaml`
- `src/components/workflow/dsl.schema.json`（`layout/viewport` 详细结构）
- `docs/design/components/workflow-list/spec.md`、`workflow-editor/spec.md`
- `assets/js/pages/workflow-list.js`、`workflow-editor.js`、`assets/js/api.js`、`assets/js/mock-data.js`
- `tools/fake-b1.js`、`tools/check-architecture.js`

## 已确认（2026-10-30）

- 纯手动保存；不自动保存、不做 localStorage 草稿；离开未保存警告。
- 只有合法图可保存；保存置灰 + 问题元素红框 + 校验面板 + 图级阻断条。
- 视口不算未保存修改，随保存提交。
- 新建向导（起止专家）+ 模板复制；旧图不迁移。
- 列表只展示工作流域指标，不展示 `updatedBy`。
- 工作流数据层独立，不扩原 `api.js`。
- 编辑器按领域切分：`model / validate / data / editor`；若 `editor` 过大，交互逻辑层再按视图（画布 / 属性 / DSL）拆分。
- 工作流两页已在 ESM 迁移中完成机械迁移；live 重写直接从现有 ESM 文件起步。

## 前置状态（开工前）

- `docs/history/works/2026-10-30-frontend-esm/` 已收口：全站 ESM、Playwright 测试栈、无 jsdom。
- 开工前两页仍读 `MOCK`；本次已移除并接 B3。


## 实现结果（2026-10-30）

### 代码

- 新增 `assets/js/shared/http.js`：B3 传输、`If-Match`、`ApiError.issues` 归一。
- 新增 `assets/js/workflow/model.js`：B3 图 ↔ 编辑器视图、ID、最小合法图、DSL、viewport 归一。
- 新增 `assets/js/workflow/validate.js`：镜像 B3 形状/拓扑/绑定规则；`issueTarget` 按下标定位。
- 新增 `assets/js/workflow/data.js`：两页唯一 B3 读写入口；revision 缓存、错误文案、DSL 文件名。
- 新增 `assets/js/workflow/views/{canvas,inspector,dsl}.js`：编辑器按画布/属性/DSL 视图拆分，交互编排保留在页面。
- 重写 `assets/js/pages/workflow-list.js`、`workflow-editor.js`：移除 `MOCK`、发布/版本/运行/更新人；列表向导与模板复制；编辑器本地校验 + `If-Match` 手动保存 + 409/428 + 离开警告。
- 新增 `tools/fake-b3.js`（测试内存后端）与 `tools/verify-workflow-list.js`、`tools/verify-workflow-editor.js`。
- `package.json` 增加 `test:workflow`，`check:syntax` 覆盖 `shared/workflow/views/tests`。

### 验证

- `node --test tests/workflow`：24/24。
- `node tools/verify-workflow-list.js`：SCN-0018 14/14。
- `node tools/verify-workflow-editor.js`：SCN-0019 11/11。
- 真实 B3 只读走查（2026-10-30，`127.0.0.1:3000`）：列表 14 条、编辑器加载详情与 viewport、无控制台错误。
- 真实 B3 写路径（2026-10-30，用户确认）：创建临时工作流 → 编辑器改名保存（revision 2，含 layout/viewport）→ 列表删除；GET 404，临时记录已清理，现有 14 条未动。
- 真实写验证发现并修复 `minimalGraph` 顶层 `x/y`（B3 仅接受 `layout`）；本地 `shapeIssues` 同步拒绝 graph/stage/node/edge 未知字段，fake B3 现在也会拦住同类回归。
- 全量 `npm test`：通过（语法/文档/依赖/架构/场景追溯/BFF 12/12/冒烟 13/13/M1 49/49/workflow 22+14+11）。

### 保留偏差

- 元数据与图两次 PUT 非原子；图保存失败时名称可能已更新。
- 列表类型 Tab 计数为当前页分布（B3 无独立 count 端点）。
- 现有 B3 测试工作流与 B1 测试 Skill 未清理，需用户确认后执行。
- 真实写路径（创建/保存/删除）已用临时记录验证并清理；存量 14 条测试工作流未清理。
