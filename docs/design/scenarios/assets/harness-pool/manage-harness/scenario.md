---
layer: design
module: harnesses
status: verified
flow: manage-harness
scenario: SCN-0007
updated: 2026-10-25
---

# SCN-0007 Harness 注册与健康治理

## 入口

- `CMP-harnesses/assets/js/pages/harnesses.js#render`
- `CMP-harnesses/pages/harnesses.html#page-body`

## 运行序

1. 列表通过 `API.list('harness',{limit:200})` 读 DTO；统计卡与表格同源：在线=`enabled && health==='online'`、离线=`health==='offline'`、停用=`!enabled`。
2. 注册弹窗校验名称、接入地址、`concurrencyMax ≥ 1`、`kind/accessMode/queuePolicy`；通过后 `POST /harnesses`，用响应 DTO 更新列表。
3. 编辑 `PUT /harnesses/{id}`（不提交 enabled）；启停 `PATCH /enabled`；删除 `DELETE`，均带 revision。B1 无当前任务数，删除按钮不按运行中预禁用。
4. 详情 `GET /harnesses/{id}` 展示健康、最近心跳、工具数、排队策略；B1 无任务/心跳历史，页面不展示假数据。

失败路径：重名、`concurrencyMax <= 0`、空地址不得注册；取消停用保持启用；被引用设施删除由 B1 返回 409 并提示。

## 不可变引用

- B1 `HarnessListItem/HarnessDetail` 的 `id/name/kind/address/accessMode/description/concurrencyMax/queuePolicy/tags/enabled/health/lastHeartbeatAt/toolCount/revision` 字段契约。
- 统计判据与 DTO 字段的对应关系；`If-Match` 由 `window.API` 生成。
- `DF.renderShell`、`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-30，全量 49/49 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0007-T1 | 正 | 表格行数同源；总数/在线/离线/停用卡与 DTO 判据一致 | `tools/verify-m1-scenarios.js#SCN-0007-T1` |
| SCN-0007-T2 | 正 | 注册合法设施 +1；重名或 concurrencyMax=0 时提示且不写集合 | `tools/verify-m1-scenarios.js#SCN-0007-T2` |
| SCN-0007-T3 | 正 | 停用确认后行显示已停用；删除空闲设施后行数 -1 | `tools/verify-m1-scenarios.js#SCN-0007-T3` |
| SCN-0007-T4 | 反 | 删除入口存在；取消停用后仍为启用 | `tools/verify-m1-scenarios.js#SCN-0007-T4` |
