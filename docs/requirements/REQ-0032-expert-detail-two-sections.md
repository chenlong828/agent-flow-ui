---
layer: requirements
module: experts
status: delivered
updated: 2026-11-22
---

# REQ-0032 专家详情收敛为两区，职责范围改用 Markdown 编辑

| 字段 | 内容 |
|---|---|
| ID | `REQ-0032` |
| 类型 | `feature` |
| 场景叙述 | 打开专家详情时，只看到真正在用的两块内容：① 角色描述（职责范围 + 性格描述）与 ② Skill 组合。职责范围按 Markdown 呈现（标题、列表、加粗等），编辑态用与 Skill 正文相同的 Markdown 编辑器，保存后回写到 `duty`。原来的「③ 工具清单 / ④ 主要工作内容 / ⑤ 参考知识」不再出现在界面上。 |
| 价值 | 调度层已把 `skillOrder` / `verifyOrder` / `notes` 合并进 `duty`（四节：主要职责 / 技能配合顺序 / 重点验证顺序 / 对承担任务的解读），工具清单与参考知识也不再进入提示词；界面继续展示这些空区块会让用户以为能手填、实际保存后被忽略。同时职责本身是长文，纯 textarea 无法承载 Markdown 结构。 |
| 非目标 | 不改 Skill 组合与 Skill 面板、不改专家的启停/删除/新建、不改后端字段与表（删除残留列与端点另立工序）、不做历史归档件的表述回写、不做职责模板向导/预览切换。 |
| 约束 | 职责编辑必须走统一编辑器（`shared/markdown-editor.js`，经现有适配层），不得新增第二套 Markdown 编辑实现；查看态用共享只读渲染器（`shared/markdown.js`，先转义再出标签）；保存只提交新结构 `name/color/role/persona/duty/skillIds`，不再提交 `tools/refs/toolIds/skillOrder/verifyOrder/notes`（后端过渡期接受但忽略）；`duty` 原样提交，不做本地格式化或截断；编辑器实例在重绘/关闭/切换 Skill 弹层时必须销毁，避免泄漏与重复监听。 |
| 影响场景 | `SCN-0006`（修改 T2/T3 断言：两区结构、职责 Markdown 渲染与编辑保存） |
| 澄清记录 | 2026-11-22：先要求「③④⑤ 先去掉」，随后按 orchaster `docs/works/2026-11-22-expert-structure/result.md` 的已交付口径确认「职责范围用 Markdown 编辑」；两件事合并在本次交付。 |
| 状态 | `delivered`（2026-11-22；`SCN-0006` 5/5、`SCN-0025` 4/4 回归、全量场景 91/91、`npm run test:gate` 通过） |

## 契约依赖

- 上游：`GET /experts/{id}` 的 `duty` 为 Markdown（固定四节），`skillOrder/verifyOrder/notes` 恒为 `""`、`tools/refs` 恒为 `[]`；`PATCH /experts/{id}` 对旧字段与 `toolIds` 接受但忽略。
- 前端：`CMP-experts#edit` 的职责编辑走 `shared/markdown-editor.js`；查看态走 `shared/markdown.js`。
