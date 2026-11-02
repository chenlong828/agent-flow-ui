---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0014
updated: 2026-10-29
---

# SCN-0014 Skill 专门页面查看、编辑与下载

## 入口

- `CMP-skills/pages/skill-detail.html#page-body`
- `CMP-skills/assets/js/pages/skill-detail.js#init`
- `CMP-skills/pages/skills.html#row-open`（跳转专门页面，不再打开抽屉）

## 运行序

1. 列表点击名称或「查看」打开 `/pages/skill-detail.html?id=<id>`；页面经 `window.API.get('skill', id)` 读取详情，展示元数据条、正文渲染、文件清单与下载入口。
2. 行菜单「编辑」打开 `/pages/skill-detail.html?id=<id>&mode=edit`；建草稿后编辑元数据与正文，保存 `POST /skill-drafts/{id}/save` 带 `If-Match`，成功后重拉详情回到查看态。
3. 列表「+ 新建Skill」打开 `/pages/skill-detail.html?mode=new`；建空草稿，最小必填项为 `name/categoryCode/description`，保存成功后进入该 id 的查看态。
4. 查看态「下载」触发 `GET /skills/{id}/download`；不提供单文件下载与附件预览。

失败路径：缺 id、无效 id、404 或网络失败时页面显示显式错误与重试入口，不得回落 MOCK；`description` 为空或超 400 字时前端阻断；取消编辑丢弃草稿。

## 不可变引用

- B1 `SkillDetail` 契约：`body` + `files`，`version/revision` 由服务端管理。
- 草稿保存与 `If-Match` 生成规则；`CMP-bff` 只做透明转发。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js`；真实引擎由 `tools/verify-skill-page-engine.js` 覆盖。最近一次执行：2026-10-29，DOM 5/5 通过；引擎层（WebKit）29/29 通过（含排版、无横向溢出、真实下载、查看→编辑分类回填）。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0014-T1 | 正 | 查看态渲染正文、文件清单与下载入口，无详情抽屉 | `tools/verify-m1-scenarios.js#SCN-0014-T1` |
| SCN-0014-T2 | 正 | 从查看态点「编辑」进入，类别下拉已加载并回填，保存后版本更新并回到查看态 | `tools/verify-m1-scenarios.js#SCN-0014-T2` |
| SCN-0014-T3 | 正 | 新建走草稿，成功后进入该 Skill 的查看态 | `tools/verify-m1-scenarios.js#SCN-0014-T3` |
| SCN-0014-T4 | 反 | 缺 id/404 显示显式错误与重试入口，不渲染空页 | `tools/verify-m1-scenarios.js#SCN-0014-T4` |
| SCN-0014-T5 | 正 | 下载入口指向 `/api/v1/skills/{id}/download` | `tools/verify-m1-scenarios.js#SCN-0014-T5` |
