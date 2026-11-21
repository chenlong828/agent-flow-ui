---
layer: requirements
module: experts
status: delivered
updated: 2026-11-21
---

# REQ-0030 从专家弹层查看与编辑 Skill（共用一套 Skill 面板）

| 字段 | 内容 |
|---|---|
| ID | `REQ-0030` |
| 类型 | `feature` |
| 场景叙述 | 研发人员在专家详情弹层里查看或编辑专家时，看到「② Skill 组合」里每个 Skill 只有被截断的一句话描述，无法判断这个 Skill 到底怎么写、适不适合当前任务。点某一行 Skill 后，在同一窗口内打开 Skill 全文弹层：元数据、`SKILL.md` 正文渲染、附件清单齐全；底部可「编辑」就地进入编辑态，改完「保存」写回 B1（版本由服务端递增），保存后弹层回到只读，专家弹层里的 Skill 名称/描述同步刷新。关闭 Skill 弹层后回到专家弹层，专家未保存的草稿保持原样。 |
| 价值 | 专家与 Skill 是「组合」关系，判断一个专家能不能胜任必须能读到 Skill 全文；当前只能记住 Skill 名再去 Skill 库逐个搜索，或者放弃阅读直接保存。同时条目里的 Skill 是最常被修的地方（触发词、边界、步骤），必须在看专家的上下文里能改，否则每次都要切页、找 Skill、再切回来。 |
| 非目标 | 不做跨专家的批量编辑、不做 Skill 版本历史/对比、不在弹层里新建 Skill、不改 Skill 的草稿与版本契约、不改专家 `PATCH /experts/{id}` 的提交字段、不引入第二个 Markdown 编辑器实现、不改 BFF 与后端。 |
| 约束 | 弹层与 Skill 专门页必须共用同一份查看/编辑实现（`skill-panel.js`），不得复制草稿/保存逻辑；Markdown 编辑一律经 `shared/markdown-editor.js`（经 `SKILL_MD` 适配层），页面与弹层不得各自挂载；弹层 80vw × 90vh，头部/底部固定、内容在主体内滚动；编辑态有未保存修改时关闭弹层须就地确认（不弹第二个弹层）；Skill 保存后只回填专家弹层里的 Skill 摘要（`name/description/categoryCode/categoryLabel/enabled`），不得覆盖专家草稿的其他字段；同一时刻只允许一个弹层。 |
| 影响场景 | `SCN-0025`（新建，验收证据）；`SCN-0006` 详情步骤补「Skill 行可点开全文弹层」的描述同步，不新增断言 |
| 澄清记录 | 2026-11-21：确认三点——①弹层内可编辑并保存（不是只读预览、也不是跳专门页）；②「统一编辑器」本次只统 Skill 正文，专家「职责范围/关注视角」保持纯文本 textarea；③保留 `skill-detail.html`，弹层与专门页共用同一套面板实现。 |
| 状态 | `delivered`（2026-11-21；`SCN-0025` 4/4、`SCN-0005` 6/6、`SCN-0014` 5/5、`SCN-0015` 4/4、`SCN-0006` 5/5 回归、`npm run test:gate` 通过） |

## 组件落点

- 新增共享面板 `assets/js/pages/skill-panel.js`（`SKP.mount`，配 `skill-panel-render.js` / `skill-panel-files.js`）与弹层宿主 `skill-panel-modal.js`（`SKPM.open`）：Skill 查看/编辑/新建的唯一实现，页面与弹层共用；
- `pages/skill-detail.js` 退化为「页面外壳」：query、面包屑/页头、页头操作、URL 回写、离开提醒、Cmd+S；
- `CMP-experts` 的 Skill 行新增 `#skill-open`：点行打开 Skill 弹层，关闭后恢复专家弹层；
- `DF.modal` 增加 `beforeClose` 钩子，用于「有未保存修改」时拦截遮罩/×/Esc 关闭并就地确认。
