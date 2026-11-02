---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0016
updated: 2026-10-29
---

# SCN-0016 草稿编辑与保存 Skill 包

## 入口

- `CMP-skills/pages/skill-detail.html#page-body`
- `CMP-skills/assets/js/pages/skill-detail.js#init`
- `CMP-skills/assets/js/pages/skills.html#row-edit`

## 运行序

1. 查看态 `GET /skills/{id}` 拿到 `body` 与 `files`；`body` 交给编辑器适配层只读渲染；文件清单显示 `path/size`，`SKILL.md` 标记只读。
2. 点「编辑」`POST /skill-drafts {skillId}` 建草稿；服务端把当前包快照到草稿，页面改以草稿文件集为准。
3. 上传 `POST /skill-drafts/{id}/files`（`multipart`：`path` + `file`）；同名覆盖；路径必须是 `scripts/` 或 `references/` 下。
4. 改名 `PATCH /skill-drafts/{id}/files {path,newPath}`；删除 `DELETE /skill-drafts/{id}/files?path=`。
5. 保存 `POST /skill-drafts/{id}/save`，带 `If-Match: <revision>`，body 只含 `name/categoryCode/description/tags/body`；200/201 后草稿被消费，页面重拉详情并回到查看态。
6. 取消 `DELETE /skill-drafts/{id}`，丢弃草稿回到查看态。

失败路径：`428` 缺 `If-Match`、`409` revision/名称冲突、`410` 草稿过期、`422` 正文超 16 KiB、`413` 文件或包超限、`400` 非法路径，都要给出可读提示；保存失败保留草稿允许重试。

## 不可变引用

- 后端 v1 契约端点 SKP-09..SKP-15 与错误码。
- 详情与草稿的 `readOnly` 语义：发布态全只读，草稿态仅 `SKILL.md` 只读。
- 草稿 TTL 24 小时；附件路径规则；`SKILL.md` 16 KiB 上限。
- 编辑器适配层边界：页面不直接接触 ProseMirror/Milkdown 类型。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js` 内存传输（`multipart` 用浏览器 `FormData`/`File`）；真实 B1 读写由 `tools/verify-b1-pages.js`、`tools/verify-b1-writes.js` 覆盖。最近一次执行：2026-10-30，全量 49/49 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0016-T1 | 正 | 点编辑建草稿，文件清单来自草稿快照，`SKILL.md` 标只读 | `tools/verify-m1-scenarios.js#SCN-0016-T1` |
| SCN-0016-T2 | 正 | 上传 `scripts/run.sh` 出现在草稿清单；保存后详情 `files` 含该文件 | `tools/verify-m1-scenarios.js#SCN-0016-T2` |
| SCN-0016-T3 | 正 | 改名/删除只作用于草稿；有未保存修改时取消需确认，确认后草稿丢弃、详情恢复原状 | `tools/verify-m1-scenarios.js#SCN-0016-T3` |
| SCN-0016-T4 | 反 | 正文超 16 KiB 时保存按钮禁用、点击被拦截并提示，版本不变 | `tools/verify-m1-scenarios.js#SCN-0016-T4` |
