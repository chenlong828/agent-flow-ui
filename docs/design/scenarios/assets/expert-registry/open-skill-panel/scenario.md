---
layer: design
module: experts
status: verified
flow: open-skill-panel
scenario: SCN-0025
updated: 2026-11-21
---

# SCN-0025 从专家弹层查看与编辑 Skill

> 需求：`REQ-0030`。Skill 面板本身的行为由 `SCN-0005` / `SCN-0014` 覆盖，本场景只覆盖「从专家弹层进入、保存回填、关闭回来」这条链路。

## 入口

- `CMP-experts/assets/js/pages/experts.js#openSkillPanelModal`
- `CMP-skills/assets/js/pages/skill-panel-modal.js#openSkillPanelModal`
- `CMP-skills/assets/js/pages/skill-panel.js#mountSkillPanel`
- `pages/experts.html`（专家详情弹层）、`pages/skill-detail.html?id=&mode=`（同一面板的页面宿主）

## 运行序

1. 专家详情弹层渲染「② Skill 组合」：每行带 `data-sopen="<skillId>"`，查看态显示「查看 ›」提示，编辑态与上移/下移/移除按钮共存；整行可点。
2. 点某一行 → `SKPM.open({id})`：`DF.modal.open` 关闭专家弹层后打开 80vw × 90vh 的 Skill 弹层，标题 `Skill 详情 · <名称>`；面板 `GET /skills/{id}` 渲染元数据、`SKILL.md` 正文（经 `SKILL_MD`）与附件清单，底部为「下载 / 关闭 / 编辑」。
3. 点「编辑」→ 面板保持同一实例切到编辑态，`POST /skill-drafts` 建草稿，正文由同一个 `SKILL_MD` 以可编辑方式挂载；底部换成「取消 / 保存」，未保存时出现「未保存」标记。
4. 点「保存」→ `POST /skill-drafts/{id}/save`（带 `If-Match`），成功后面板回到只读并重拉详情；`onSaved(skill)` 把最新的 `name/description/categoryCode/categoryLabel/enabled` 回填专家弹层里的 Skill 摘要（`d.dto.skills` / `d.draft.skills` / 列表卡片预览），其他专家草稿字段不动。
5. 关闭 Skill 弹层（关闭 / × / Esc / 遮罩）→ 专家弹层用同一个状态对象重新渲染，专家草稿（职责、性格词、Skill/工具顺序、参考知识）保持原样；原专家弹层处于编辑态时回到编辑态。
6. 编辑态有未保存修改时，`DF.modal` 的 `beforeClose` 拦下关闭：弹层不关，底部换成「未保存的修改 / 继续编辑 / 放弃修改」；「继续编辑」回到「取消 / 保存」并保留草稿，「放弃修改」才真正关闭。

失败路径：Skill 详情加载失败时弹层内显示错误态与重试，不显示「编辑」；草稿创建失败显示重试；保存失败（409/网络）提示错误并保留草稿与编辑态；`slug` 非 kebab-case、描述缺失或正文超 16 KiB 时前端拦截保存；专家弹层期间被外部关闭时不重开（`d !== cur` 才恢复）。

## 不可变引用

- B1 `SkillDetail`（`body` / `files`）、`SkillDraft` 与 `POST /skill-drafts/{id}/save` 的 `If-Match` 语义；专家 `PATCH /experts/{id}` 的字段集合不变。
- `DF.modal` 的单实例语义：打开新弹层会先关闭当前弹层，关闭后由调用方负责恢复；`beforeClose` 返回 `false` 即拦截关闭。
- `shared/markdown-editor.js` 的 `mountMarkdown/destroyMarkdown`；`SKILL_MD` 只是它的适配层，不允许页面另起一套编辑器。
- 专家详情弹层的五区结构与其他交互（启停、删除、保存、Skill/工具挑选、参考知识增删）。

## 测试

执行层：Playwright WebKit + `tools/fake-b1.js` 内存传输（编辑器用 `editorInit` 替身，正文渲染断言落在替身容器上）；真实 B1 读写由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-11-21，SCN-0025 4/4 通过；同批回归 SCN-0005 6/6、SCN-0014 5/5、SCN-0015 4/4、SCN-0006 5/5。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0025-T1 | 正 | 点专家弹层里的 Skill 行，同窗口打开且只打开一个弹层；标题为「Skill 详情 · <名称>」，正文由共享编辑器适配层渲染，底部有「编辑」 | `tools/verify-m1-scenarios.js#SCN-0025-T1` |
| SCN-0025-T2 | 正 | 弹层内编辑改名称并保存：弹层回到只读且标题更新；关闭后回到专家详情弹层，该 Skill 行显示新名称 | `tools/verify-m1-scenarios.js#SCN-0025-T2` |
| SCN-0025-T3 | 正 | 专家编辑态先改职责，再打开并关闭 Skill 弹层：回到专家编辑态且职责草稿保留 | `tools/verify-m1-scenarios.js#SCN-0025-T3` |
| SCN-0025-T4 | 反 | 编辑态有未保存修改时点 ×：弹层不关闭并出现「放弃修改」；点「继续编辑」保留草稿 | `tools/verify-m1-scenarios.js#SCN-0025-T4` |
