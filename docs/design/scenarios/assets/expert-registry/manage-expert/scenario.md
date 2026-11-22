---
layer: design
module: experts
status: verified
flow: manage-expert
scenario: SCN-0006
updated: 2026-11-22
---

# SCN-0006 专家注册与组合配置

## 入口

- `CMP-experts/assets/js/pages/experts.js#renderGrid`
- `CMP-experts/pages/experts.html#page-body`

## 运行序

1. 页面通过 `API.list('expert',{limit:200})` 读列表 DTO；卡片显示前 3 个 `skills` 预览、「Skill ×N」（`skillCount`）与 `refCount`，不再展示 `toolCount`；搜索/状态筛选在客户端完成。
2. 打开详情：`API.get('expert', id)` 取完整 DTO，弹窗固定 80vw × 90vh（页头页脚固定、内容区滚动），只渲染两区——① 角色描述（职责范围按 Markdown 渲染 + 性格描述）与 ② Skill 组合（装配顺序取 `skills[].id`）；`skillOrder/verifyOrder/notes/refs/tools` 已并入 `duty` 或停用，不再展示。② Skill 组合的每一行可点开共享 Skill 面板查看/编辑全文（详见 `SCN-0025`），Skill 保存后只回填该行的名称/描述。
3. 新建 `POST /experts`（`name/color/role`），用返回 DTO 的 `id` 打开编辑详情；编辑态职责范围用共享 Markdown 编辑器（`shared/markdown-editor.js`），聚合保存 `PATCH /experts/{id}`，body 只含 `name/color/role/persona/duty` 与有序 `skillIds`，不含 `enabled/version`，也不再提交 `tools/refs/toolIds/skillOrder/verifyOrder/notes`。
4. 启停 `PATCH /enabled`、删除 `DELETE`；引用只显示 DTO `refCount`，B1 不提供引用方明细。

失败路径：名称为空不得创建；取消停用保持 `enabled=true`；保存冲突保留草稿并提示；取消编辑丢弃草稿。

## 不可变引用

- B1 `ExpertListItem/ExpertDetail` 的 `id/name/color/role/persona/enabled/skillCount/toolCount/refCount/skills/tools/duty/skillOrder/verifyOrder/notes/refs/revision` 字段契约。
- 列表 Skill 预览最多 3 个；详情 `skills/tools` 为完整摘要，Skill 摘要字段为 `description`（契约 v2，不再有 `summary`），`skillIds/toolIds` 只能从 `[].id` 派生。
- `DF.modal`、`DF.toast` 与两区详情结构；职责范围的 Markdown 编辑只经 `shared/markdown-editor.js`，查看态只经 `shared/markdown.js`。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js` 内存传输；真实读取/写入另由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-11-22，SCN-0006 5/5 通过（含 `SCN-0025` 4/4 回归）；全量场景 91/91 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0006-T1 | 正 | 卡片数同源；卡片显示「Skill ×N」且 N 等于 DTO `skillCount`，不显示工具数；搜索「评审」后仅 1 张 | `tools/verify-m1-scenarios.js#SCN-0006-T1` |
| SCN-0006-T2 | 正 | 两区齐全（① 角色描述 / ② Skill 组合）；③④⑤ 已下线不渲染；职责按 Markdown 渲染（标题/加粗，不出现源码）；角色、Skill（含 `description`）与 DTO 一致且无 `undefined`；引用显示 `refCount` 与「B1 未提供引用方明细」 | `tools/verify-m1-scenarios.js#SCN-0006-T2` |
| SCN-0006-T3 | 正 | 新建合法专家 +1；编辑态职责走共享 Markdown 编辑器且 Markdown 原样回写；停用后 enabled=false 且卡片显示停用 | `tools/verify-m1-scenarios.js#SCN-0006-T3` |
| SCN-0006-T4 | 反 | 取消停用确认后 enabled 仍为 true | `tools/verify-m1-scenarios.js#SCN-0006-T4` |
| SCN-0006-T5 | 正 | 查看/编辑态详情弹窗高度均为视口 90%，页头页脚在视口内，「取消/保存」不被浏览器边框截断，内容超高时只在主体内滚动 | `tools/verify-m1-scenarios.js#SCN-0006-T5` |
