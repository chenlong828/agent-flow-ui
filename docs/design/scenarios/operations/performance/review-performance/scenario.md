---
layer: design
module: analytics
status: designed
flow: review-performance
scenario: SCN-0009
updated: 2026-10-23
---

# SCN-0009 效能看板只读回看

## 入口

- `CMP-analytics/assets/js/pages/analytics.js#render`
- `CMP-analytics/pages/analytics.html#page-body`

## 运行序

1. KPI 卡渲染吞吐、缺陷率、成功率、平均时长、待确认与 fan-out 子任务指标；数值来自 `MOCK.analytics`。
2. 时间范围切换近 4/8 周，趋势图标签与数据点数量同步变化；近 12 周禁用并标注「数据积累中」。
3. 阶段准出固定 4 行；评审记录按夹具新→旧分页，每页 5 条；Skill 审计列表只读。
4. 页面不写任何 `MOCK` 集合；实例号链接只跳详情，不改变数据。

失败路径：12 周选项不可选；空记录显示空态；无任何编辑/删除入口。

## 不可变引用

- `MOCK.analytics` 的 `weeks/throughput/defectRate/successRate/avgDurationS/stagePass/reviewRecords/skillAudit` 字段契约。
- 4 周/8 周窗口与阶段准出 4 阶段的展示口径。
- `DF.renderShell`、`DF.table`、`DF.tag`、`DF.relTime` 的公共语义。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0009-T1 | 正 | KPI 数值与 `MOCK.analytics` 对应字段一致；阶段准出 4 行、Skill 审计条目数与夹具一致 | 待补 |
| SCN-0009-T2 | 正 | 切近 4 周后趋势数据点/标签为 4 个；切回 8 周恢复 8 个 | 待补 |
| SCN-0009-T3 | 正 | 评审记录首页 5 条且按夹具顺序；下一页显示余下条目，页码正确 | 待补 |
| SCN-0009-T4 | 反 | 近 12 周选项 disabled；页面不存在编辑/删除按钮，切换范围不写 `MOCK` | 待补 |
