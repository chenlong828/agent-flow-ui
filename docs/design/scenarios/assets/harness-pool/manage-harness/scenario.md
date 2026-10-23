---
layer: design
module: harnesses
status: designed
flow: manage-harness
scenario: SCN-0007
updated: 2026-10-23
---

# SCN-0007 Harness 注册与健康治理

## 入口

- `CMP-harnesses/assets/js/pages/harnesses.js#render`
- `CMP-harnesses/pages/harnesses.html#page-body`

## 运行序

1. 列表渲染统计卡与表格：在线/离线/负载状态点、健康列、并发与排队策略；状态与 `MOCK.harnesses` 同源。
2. 注册弹窗校验名称唯一、`max ≥ 1`、接入地址与接入方式；通过后 `push` 到 `MOCK.harnesses`。
3. 编辑保存连接/配额/标签；启停切换页面标记 `_disabled`；运行中设施删除按钮禁用。
4. 删除空闲设施先 `DF.modal.confirm`，确认后 `splice`；取消不写。

失败路径：重名、`max <= 0`、空地址不得注册；运行中删除被禁用；停用取消保持启用。

## 不可变引用

- `MOCK.harnesses` 的 `id/name/type/address/accessMode/health/running/max/queuePolicy/tags` 字段契约。
- 在线/离线/负载的展示判据（`health === '在线'`、`running/max ≥ 80%`、`_disabled` 优先）。
- `DF.renderShell`、`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0007-T1 | 正 | 表格行数与 `MOCK.harnesses.length` 相等；在线/离线/高负载计数与夹具判据一致 | 待补 |
| SCN-0007-T2 | 正 | 注册合法设施后表行 +1；重名或 `max=0` 时字段报错且不写集合 | 待补 |
| SCN-0007-T3 | 正 | 停用确认后行显示已停用且不计入在线；删除空闲设施后行数 -1 | 待补 |
| SCN-0007-T4 | 反 | `running > 0` 的设施删除按钮禁用；取消停用后仍为启用 | 待补 |
