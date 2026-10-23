---
layer: design
module: instances
status: designed
flow: control-instance
scenario: SCN-0004
updated: 2026-10-23
---

# SCN-0004 实例监控与运行控制

## 入口

- `CMP-instances/assets/js/pages/instances.js#render`
- `CMP-instances/assets/js/pages/instance-detail.js#init`
- `CMP-instances/pages/instances.html`、`pages/instance-detail.html?id=<instanceId>`

## 运行序

1. 列表按状态 Tab 渲染；「已结束」聚合成功/失败/已终止，计数与 `MOCK.instances` 同源。
2. 进入详情，顶部显示状态、耗时、进度；流程轨迹按节点状态着色，节点抽屉显示输入/输出/留痕。
3. 运行中可暂停/恢复；终止先确认，确认后状态为「已终止」且节点转失败；等待人工时可批准或驳回。
4. 失败/已跳过节点可重试或从节点重跑；状态迁移只改 `MOCK.instances` 内存。

失败路径：终止取消不得改状态；驳回必须填写意见；已终止实例不可恢复运行；暂停/恢复只作用于运行中节点。

## 不可变引用

- 实例状态集合：运行中、等待人工确认、回退重跑中、已暂停、成功、失败、已终止。
- `DF.renderShell`、`DF.modal`、`DF.tag`、`DF.fmtDur` 的展示语义。
- `sessionStorage` 键 `df-new-instance`（列表到详情的一次性传递）。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0004-T1 | 正 | 列表 Tab 计数与 `MOCK.instances` 按状态分组数一致；「已结束」等于成功+失败+已终止 | 待补 |
| SCN-0004-T2 | 正 | `?id=INS-2042` 详情显示对应实例状态/进度，轨迹节点数与 `inst.nodes` 一致 | 待补 |
| SCN-0004-T3 | 正 | 暂停运行中实例后状态为「已暂停」，恢复后回到「运行中」；批准后等待人工节点转成功 | 待补 |
| SCN-0004-T4 | 反 | 终止确认框取消后状态不变；已终止实例不可恢复；驳回未填意见不得提交 | 待补 |
