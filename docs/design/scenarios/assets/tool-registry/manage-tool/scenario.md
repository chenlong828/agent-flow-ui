---
layer: design
module: tools
status: designed
flow: manage-tool
scenario: SCN-0008
updated: 2026-10-23
---

# SCN-0008 工具注册、调试与引用治理

## 入口

- `CMP-tools/assets/js/pages/tools.js#render`
- `CMP-tools/pages/tools.html#page-body`

## 运行序

1. 注册表按类型/状态筛选；行显示名称、类型、所属 Harness、状态、引用数与最近调试时间。
2. 注册弹窗填写名称、类型、Harness、参数/超时；通过后 `push` 为「未验证」。
3. 调试抽屉模拟执行：成功一次后「未验证」转「可用」；失败/依赖缺失保持不可用，并写 `runs`。
4. 引用方抽屉扫描 `MOCK.experts[].tools` 与 `MOCK.workflows` 节点配置；`refCount > 0` 时删除禁用。

失败路径：被引用工具不得删除；调试失败不得转「可用」；空名称/无 Harness 不得注册。

## 不可变引用

- `MOCK.tools` 的 `id/name/type/harness/status/refCount/runs/lastDebugM` 字段契约。
- `MOCK.experts[].tools` 与 `MOCK.workflows` 节点工具引用的扫描口径。
- `DF.drawer`、`DF.modal`、`DF.toast` 的公共语义。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0008-T1 | 正 | 行数与 `MOCK.tools.length` 相等；类型/状态筛选后的计数与夹具子集一致 | 待补 |
| SCN-0008-T2 | 正 | 注册合法工具后新增「未验证」行；调试成功后状态变「可用」且 `runs` 增加 | 待补 |
| SCN-0008-T3 | 正 | 引用方抽屉的专家/工作流条目数与 `findRefs` 扫描结果一致 | 待补 |
| SCN-0008-T4 | 反 | `refCount > 0` 的工具删除按钮禁用；调试失败后状态仍为「未验证」或「不可用」 | 待补 |
