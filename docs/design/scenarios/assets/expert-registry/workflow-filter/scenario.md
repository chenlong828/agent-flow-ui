---
layer: design
module: experts
status: verified
flow: manage-expert
scenario: SCN-0026
updated: 2026-11-22
---

# SCN-0026 专家列表按工作流筛选

> 需求：`REQ-0031`。上游 B1 契约见 orchaster `docs/works/2026-11-21-expert-workflow-filter/result.md`（`GET /experts?workflowId=` 可重复参数）。

## 入口

- `CMP-experts/assets/js/pages/experts.js#loadWorkflows`、`#openWorkflowFilter`、`#applyWorkflowFilter`、`#loadExperts`
- `pages/experts.html`（可带 `?workflowId=<id>`，可重复）

## 运行序

1. 打开专家管理：先读 URL 的 `workflowId`（可重复）作为初始筛选；随后并发加载流程列表（`CMP-workflow-data.list({limit:200})`，只取 `id/name`）与专家列表（`GET /experts?limit=200`，有筛选时追加可重复的 `workflowId`）。
2. 工具栏显示筛选入口：未选时「流程：全部」；选了一条显示流程名，多条显示「首个流程名 +N」；有筛选时旁边出现「清除流程筛选」。有筛选时 URL 写回 `?workflowId=…`。
3. 点「流程筛选」打开勾选弹窗（标题「按流程筛选专家」），已有选择回填为勾选态；「应用」后按当前勾选重新请求专家列表；全不勾选等于清除。勾选弹窗允许空选（与 `DF.modal.picker` 的「至少选一项」不同，故用 `DF.modal.form` 自绘）。
4. 专家列表以服务端过滤结果为准（多流程由后端取并集）；卡片与详情契约不变，`refCount` 仍是全部工作流下的引用数。
5. 清除：「清除流程筛选」按钮或空态里的「清除流程筛选」都回到未筛选视图，URL 去掉 `workflowId`，重新请求全部专家。

失败路径：流程列表加载失败时筛选按钮禁用并显示「流程列表加载失败，暂时无法按流程筛选」，专家列表照常显示全部；专家列表请求失败沿用既有错误态与「重试」；筛选后无结果显示「所选流程下没有绑定专家」并提供清除入口，不与「未找到匹配的专家」混用；筛选参数只随专家列表请求发送，不影响详情/启停/删除请求。

## 不可变引用

- B1 `GET /experts` 的 `workflowId` 参数语义（可重复、UUID 校验、并集、未知流程空集、`total` 为过滤后数量）与专家卡片 DTO 字段。
- `CMP-workflow-data` 的 `list` 操作与 `WorkflowSummary.id/name`；页面不得直接请求 `/api/v1/workflows*`。
- `CMP-experts` 既有契约：卡片、五区详情/编辑、Skill/工具装配、启停/删除、详情弹窗尺寸与 `#skill-open`。

## 测试

执行层：Playwright WebKit + `tools/fake-b1.js` 内存传输（`GET /experts` 按 `MOCK.workflows` 的节点绑定过滤；`GET /workflows` 返回夹具流程，可注入失败）。真实 B1 读写由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-11-22，SCN-0026 5/5 通过；真实后端实测：全量 16 位、`故障修复流程` 7 位。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0026-T1 | 正 | `?workflowId=w1` 只显示该流程绑定的 5 位专家，按钮显示流程名并出现清除入口 | `tools/verify-m1-scenarios.js#SCN-0026-T1` |
| SCN-0026-T2 | 正 | 两个流程取并集（3 位，公共专家去重），按钮显示「批量代码审视 +1」 | `tools/verify-m1-scenarios.js#SCN-0026-T2` |
| SCN-0026-T3 | 正 | 弹窗勾选应用后只剩 1 位专家且 URL 带 `workflowId=w3`；清除后恢复全部且 URL 不含筛选参数 | `tools/verify-m1-scenarios.js#SCN-0026-T3` |
| SCN-0026-T4 | 反 | 流程列表加载失败：筛选按钮禁用并提示，专家列表仍是全部，点击不打开弹窗 | `tools/verify-m1-scenarios.js#SCN-0026-T4` |
| SCN-0026-T5 | 正 | 未知流程返回空集并显示空态，空态里的清除按钮恢复全部专家 | `tools/verify-m1-scenarios.js#SCN-0026-T5` |
