---
layer: design
module: workflow-list
status: verified
flow: browse-workflows-live
scenario: SCN-0018
execution: playwright
updated: 2026-10-30
---

# SCN-0018 工作流列表同源浏览、创建与生命周期

## 入口

- `CMP-workflow-list/assets/js/pages/workflow-list.js#init`
- `CMP-workflow-list/pages/workflow-list.html`
- `CMP-bff/bff/index.js#handle`（同源转发，B3 `/api/v1/workflows*`）

## 运行序

1. 页面加载后经 BFF `GET /api/v1/workflows?sort=updatedAt:desc` 拉取第一页；统计条显示总数、各类型数与最近更新，不显示运行中/发布/版本。
2. 名称搜索、类型筛选、排序与分页组合请求；`name:asc|name:desc|updatedAt:asc|updatedAt:desc` 使用冒号格式；空结果显示 `DF.empty`，清空条件恢复全量。
3. 新建向导：名称、类型、描述 + 起始/结束专家（可同一人）；客户端生成 `start→end` 最小合法图（seq 边、合法 ID），`POST /workflows` 提交 `{name,type,description,graph}`；201 返回 `{id,revision,warnings}` 后 `GET` 详情并跳转编辑器。
4. 模板复制：选择任一合法工作流，`POST /workflows/{id}/copy`；201 返回 `{id,revision,warnings}` 后 `GET` 详情；名称冲突由后端自动后缀，仍冲突显示 409。
5. 改名/改类型/改描述：`PUT /workflows/{id}` 带 `If-Match`；成功刷新列表项，409 提示刷新。
6. 删除：二次确认后 `DELETE /workflows/{id}` 带 `If-Match`；成功移除，409/428 显示原因。
7. 导入 JSON：`POST /workflows/import`；成功显示 idMap 与未绑定专家 warning，引导进编辑器补绑；导出：`GET /workflows/{id}/dsl?format=json|yaml` 下载。
8. 失败：后端不可用显示连接错误；不回落 MOCK、不写内存夹具。

失败路径：创建缺 graph、空图、缺 start/end、未绑定专家、专家不存在 → 400 并展示 `details.issues`；名称重复 → 409；`If-Match` 缺失 → 428；旧 revision → 409；复制/导出非法旧图 → 400（通用错误，不做迁移入口）。

## 不可变引用

- B3 API-31..40：`sort` 冒号格式；创建必带合法 `graph`；创建/复制返回 `{id,revision,warnings}`（无详情）；`If-Match` 乐观锁；`details.issues[{code,path,message}]` 路径为数组下标。
- 工作流 ID 为 UUIDv7；节点/阶段/边 ID 规则 `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`。
- BFF 只透传 `/api/v1/*` 与 `/healthz`，不改写 DTO/状态码/错误体。
- 页面入口 `pages/workflow-list.html` 与编辑器入口 `pages/workflow-editor.html?id=`。
- 列表不展示发布、版本、最近运行、更新人；`updatedBy` 仅在后端修复 actor 后重新评估。

## 测试

执行层：Playwright WebKit（DOM + 网络拦截/ B3 stub）；可执行：`node tools/verify-workflow-list.js`（Playwright WebKit + fake B3/B1）。

最近一次执行：2026-10-30，14/14 通过（T1 4 / T2 2 / T3 4 / T4 4）。

真实 B3 写路径追加验证（2026-10-30）：经 BFF 在真实 B3 创建临时工作流 → 编辑器改名保存（revision 2）→ 列表删除，删除后 GET 404；未保留测试记录，现有 14 条测试工作流未动。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0018-T1 | 正 | 列表按 `updatedAt:desc` 请求并渲染；统计总数=服务端 total；类型筛选/搜索/排序请求参数正确；空态与恢复 | `tools/verify-workflow-list.js` |
| SCN-0018-T2 | 正 | 新建向导提交含 `start→end` 的合法 graph 与起止专家；201 后 GET 详情并跳转；模板复制同样 201→GET→跳转 | `tools/verify-workflow-list.js` |
| SCN-0018-T3 | 正 | 改名/改类型带 `If-Match` 生效；删除二次确认；导入显示 idMap/warnings；导出下载 JSON/YAML | `tools/verify-workflow-list.js` |
| SCN-0018-T4 | 反 | 服务端 400 issues 保留向导；名称重复 409；元数据 PUT 428 提示刷新；后端不可用显示错误且不落假数据 | `tools/verify-workflow-list.js` |
