---
layer: design
module: experts
status: verified
flow: manage-expert
scenario: SCN-0006
updated: 2026-10-28
---

# SCN-0006 专家注册与组合配置

## 入口

- `CMP-experts/assets/js/pages/experts.js#renderGrid`
- `CMP-experts/pages/experts.html#page-body`

## 运行序

1. 页面通过 `API.list('expert',{limit:200})` 读列表 DTO；卡片显示前 3 个 `skills` 预览、`skillCount/toolCount/refCount`，搜索/状态筛选在客户端完成。
2. 打开详情：`API.get('expert', id)` 取完整 DTO，五区读取 `duty/skillOrder/verifyOrder/notes/persona/refs/skills/tools`；装配顺序取 `skills[].id` / `tools[].id`。
3. 新建 `POST /experts`（`name/color/role`），用返回 DTO 的 `id` 打开编辑详情；聚合保存 `PATCH /experts/{id}`，body 含五区字段与有序 `skillIds/toolIds`，不含 `enabled/version`。
4. 启停 `PATCH /enabled`、删除 `DELETE`；引用只显示 DTO `refCount`，B1 不提供引用方明细。

失败路径：名称为空不得创建；取消停用保持 `enabled=true`；保存冲突保留草稿并提示；取消编辑丢弃草稿。

## 不可变引用

- B1 `ExpertListItem/ExpertDetail` 的 `id/name/color/role/persona/enabled/skillCount/toolCount/refCount/skills/tools/duty/skillOrder/verifyOrder/notes/refs/revision` 字段契约。
- 列表 Skill 预览最多 3 个；详情 `skills/tools` 为完整摘要，Skill 摘要字段为 `description`（契约 v2，不再有 `summary`），`skillIds/toolIds` 只能从 `[].id` 派生。
- `DF.modal`、`DF.toast` 与五区详情结构。

## 测试

执行层：DOM（jsdom）+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-28，M1 40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0006-T1 | 正 | 卡片数同源；搜索「评审」后仅 1 张 | `tools/verify-m1-scenarios.js#SCN-0006-T1` |
| SCN-0006-T2 | 正 | 五区齐全；角色、Skill（含 `description`）、工具、参考知识与 B1 DTO 一致且无 `undefined`；引用显示 `refCount` 与「B1 未提供引用方明细」 | `tools/verify-m1-scenarios.js#SCN-0006-T2` |
| SCN-0006-T3 | 正 | 新建合法专家 +1；编辑 duty 回写；停用后 enabled=false 且卡片显示停用 | `tools/verify-m1-scenarios.js#SCN-0006-T3` |
| SCN-0006-T4 | 反 | 取消停用确认后 enabled 仍为 true | `tools/verify-m1-scenarios.js#SCN-0006-T4` |
