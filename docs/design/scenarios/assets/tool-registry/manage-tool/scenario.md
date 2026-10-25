---
layer: design
module: tools
status: verified
flow: manage-tool
scenario: SCN-0008
updated: 2026-10-25
---

# SCN-0008 工具注册、引用与治理

## 入口

- `CMP-tools/assets/js/pages/tools.js#loadPage`
- `CMP-tools/pages/tools.html#page-body`

## 运行序

1. 列表通过 `API.list('tool',{limit:200})` 和 `API.list('harness',{limit:200})` 读 DTO；类型/状态筛选使用 `mcp/cli/script`、`unverified/available/unavailable`，中文只在显示时映射。
2. 注册弹窗填写名称、类型、调用方式、所属 Harness、超时与 `params[{key,type,description}]`；通过后 `POST /tools`，状态由 B1 返回（通常 `unverified`）。
3. 编辑前 `GET /tools/{id}` 取完整参数，保存 `PUT`；删除 `DELETE`，均带 revision。
4. 引用只显示 DTO `usedByCount`，弹层说明 B1 未提供引用方明细；被引用工具删除由 B1 返回 409 `referenced`，列表保留。

失败路径：空名称/无 Harness/超时越界/重复参数 key 不得保存；B1 无调试端点，页面不提供调试、不修改状态。

## 不可变引用

- B1 `ToolListItem/ToolDetail` 的 `id/name/kind/invocation/description/harnessId/timeoutMs/params/paramCount/status/usedByCount/lastDebugAt/revision` 字段契约。
- 状态只读；`If-Match` 由 `window.API` 生成。
- `DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-25，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0008-T1 | 正 | 行数同源；`cli` 类型、`unverified` 状态、关键词 trace 筛选均与夹具子集一致 | `tools/verify-m1-scenarios.js#SCN-0008-T1` |
| SCN-0008-T2 | 正 | 注册后新增「未验证」工具，列表重新拉取 | `tools/verify-m1-scenarios.js#SCN-0008-T2` |
| SCN-0008-T3 | 正 | 引用弹层显示 `usedByCount` 与「B1 未提供引用方明细」，不再有引用方列表 | `tools/verify-m1-scenarios.js#SCN-0008-T3` |
| SCN-0008-T4 | 反 | 被引用工具删除由 B1 409 拒绝，行保留并提示禁止删除 | `tools/verify-m1-scenarios.js#SCN-0008-T4` |
