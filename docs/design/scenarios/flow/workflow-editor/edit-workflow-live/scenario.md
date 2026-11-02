---
layer: design
module: workflow-editor
status: verified
flow: edit-workflow-live
scenario: SCN-0019
execution: playwright
updated: 2026-10-30
---

# SCN-0019 工作流编辑器同源加载、校验与保存

## 入口

- `CMP-workflow-editor/assets/js/pages/workflow-editor.js#init`
- `CMP-workflow-editor/pages/workflow-editor.html?id=<workflowId>`
- `CMP-bff/bff/index.js#handle`（同源转发，B3 `/api/v1/workflows/{id}*`）

## 运行序

1. 带 `?id=<uuid>` 进入，`GET /workflows/{id}` 加载当前定义；画布按 `graph.nodes/edges/stages` 渲染，应用 `graph.viewport` 与节点/阶段 `layout`；缺 id 显示错误并回列表，不静默回落第一条。
2. 选中节点打开属性抽屉；修改名称/类型/专家绑定、增删阶段/节点/边；ID 由 `workflow/model` 生成并满足 B3 规则；6 类节点类型与边类型（seq/rollback）按矩阵约束。
3. 实时本地校验：`workflow/validate` 产出 `errors/warnings`；有 error 的节点/边加红框角标，图级问题（缺 start/end、seq 环、缺专家）显示顶部阻断条；保存按钮置灰；校验面板列出全部问题，点击定位。
4. 手动保存：图合法时 `PUT /workflows/{id}/definition` 带 `If-Match`，body `{graph}`（含 `stages/nodes/edges/viewport`）；成功刷新 revision 与 warnings，清除未保存标记。
5. 视口：平移/缩放只改本地视图，不算未保存修改；保存时把当前 `viewport` 随图提交；布局按 `dsl.schema.json` 本地校验，非法则阻断保存。
6. 离开：存在未保存修改时 `beforeunload` 与页内跳转二次确认；无未保存则直接离开。
7. 导出 DSL：`GET /workflows/{id}/dsl?format=json|yaml`；编辑器只读预览/复制/下载，不导入（导入在列表页）。
8. 移除发布/版本/运行入口；编辑器不提供运行入口。

失败路径：保存遇 400 → 展示 `details.issues` 并定位，保留编辑态；409 → 提示刷新/对比，不覆盖；428 → 提示重新加载；404 → 回列表；后端不可用不回落 MOCK。

## 不可变引用

- B3 API-37/38/40：整图替换；`graph.viewport` 随图保存或清空；拓扑/绑定/专家不存在 400；停用专家 warning；`If-Match` 缺失 428、旧 revision 409。
- `WorkflowGraph`：`stages/nodes/edges` + 可选 `viewport`；节点类型 `start|end|agent|review|confirm|fanout|fanin`；边 `seq|rollback`；ID 规则同上。
- `layout/viewport` 由前端拥有、后端透传；前端以 `src/components/workflow/dsl.schema.json` 为详细结构来源。
- 页面入口 `pages/workflow-editor.html?id=` 与列表跳转约定；查看/编辑共用页面。

## 测试

执行层：Playwright WebKit（DOM + 网络拦截/ B3 stub）；可执行：`node tools/verify-workflow-editor.js`（Playwright WebKit + fake B3/B1）。

最近一次执行：2026-10-30，11/11 通过（T1 2 / T2 2 / T3 3 / T4 4）。

真实 B3 写路径追加验证（2026-10-30）：从列表创建临时工作流进入本页，改名后保存（元数据 PUT + definition PUT，revision 2），`layout`/`viewport` 落库；随后由列表删除，GET 404。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0019-T1 | 正 | 加载真实详情：节点/边/阶段数与 DTO 一致；`viewport` 与节点/阶段 `layout` 应用；未知 id 不回落首条 | `tools/verify-workflow-editor.js` |
| SCN-0019-T2 | 正 | 改名/改专家/增删阶段节点边后保存：元数据与图各一次 PUT，`If-Match` 依次为当前 revision；请求体含完整 `graph`/`layout`/`viewport`；revision 更新；未保存标记清除 | `tools/verify-workflow-editor.js` |
| SCN-0019-T3 | 正 | 非法图：保存置灰、问题元素红框、校验面板定位；修正后恢复可保存；服务端 400 issues 回填定位 | `tools/verify-workflow-editor.js` |
| SCN-0019-T4 | 反 | 409/428 不覆盖、提示刷新；离开有未保存修改弹确认；无发布/版本/运行入口；不回落 MOCK | `tools/verify-workflow-editor.js` |
