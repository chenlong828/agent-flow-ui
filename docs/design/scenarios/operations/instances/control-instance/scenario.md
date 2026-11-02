---
layer: design
module: instances
status: verified
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

执行层：Playwright WebKit+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-30，全量 49/49 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0004-T1 | 正 | 6 个 Tab 计数与状态分组一致；已结束=成功+失败+已终止 | `tools/verify-m1-scenarios.js#SCN-0004-T1` |
| SCN-0004-T2 | 正 | ?id=INS-2041 轨迹节点数=workflow graph；ok/running 节点计数与 inst.nodes 一致 | `tools/verify-m1-scenarios.js#SCN-0004-T2` |
| SCN-0004-T3 | 正 | 暂停后状态「已暂停」，恢复后「运行中」；INS-2038 批准后转运行中且等待节点 ok | `tools/verify-m1-scenarios.js#SCN-0004-T3` |
| SCN-0004-T4 | 反 | 取消终止后仍为运行中；驳回未填意见被拒且状态不变；INS-2019 无暂停/恢复/终止按钮 | `tools/verify-m1-scenarios.js#SCN-0004-T4` |
