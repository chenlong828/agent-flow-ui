---
layer: design
module: experts
status: designed
flow: manage-expert
scenario: SCN-0006
updated: 2026-10-23
---

# SCN-0006 专家注册与组合配置

## 入口

- `CMP-experts/assets/js/pages/experts.js#render`
- `CMP-experts/pages/experts.html#page-body`

## 运行序

1. 卡片网格渲染专家名称、角色、Skill/工具数量与启停状态；搜索/状态筛选与 `MOCK.experts` 同源。
2. 打开五区详情：角色描述、Skill 组合、工具清单、主要工作内容、参考知识；引用数来自 `MOCK.workflows` 节点扫描。
3. 新建/编辑：名称与角色必填；Skill/工具通过 picker 从 `MOCK.skills`/`MOCK.tools` 选择，保存写回 `MOCK.experts`。
4. 启停：停用需确认并提示引用节点数；启用直接生效；切换后卡片状态与筛选结果同步。

失败路径：名称为空不得创建；picker 不重复添加已选项；取消停用保持 `enabled=true`。

## 不可变引用

- `MOCK.experts` 的 `id/name/role/enabled/skills/tools/duty/notes/persona/refs` 字段契约。
- `DF.modal.picker` 的多选语义与五区详情结构。
- `MOCK.workflows` 节点 `expertId` 的引用计数口径（只读）。

## 测试

执行层：DOM（jsdom）；本批只到 `designed`，未写 runner，因此不标 `verified`。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0006-T1 | 正 | 卡片数与 `MOCK.experts.length` 相等；搜索名称后只保留匹配项 | 待补 |
| SCN-0006-T2 | 正 | 详情五区标题齐全；Skill/工具列表与夹具数组一致；引用数等于工作流节点引用数 | 待补 |
| SCN-0006-T3 | 正 | 新建合法专家后总数 +1；编辑保存后字段回写；停用确认后卡片显示「已停用」 | 待补 |
| SCN-0006-T4 | 反 | 取消停用确认后 `enabled` 仍为 true；picker 中已选 Skill 不出现在可选列表 | 待补 |
