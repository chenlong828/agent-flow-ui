---
layer: design
module: tools
status: verified
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

执行层：DOM（jsdom）+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-23，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0008-T1 | 正 | 行数同源；CLI 类型、未验证状态、关键词 trace 筛选均=夹具子集 | `tools/verify-m1-scenarios.js#SCN-0008-T1` |
| SCN-0008-T2 | 正 | 注册后新增「未验证」工具；调试 t-factory 成功后转「可用」且 runs 增加 | `tools/verify-m1-scenarios.js#SCN-0008-T2` |
| SCN-0008-T3 | 正 | 引用方抽屉条目数与 refCount 一致，共 5 处 | `tools/verify-m1-scenarios.js#SCN-0008-T3` |
| SCN-0008-T4 | 反 | 全部 refCount>0 的工具删除禁用；t-replay 调试失败后仍为「不可用」 | `tools/verify-m1-scenarios.js#SCN-0008-T4` |
