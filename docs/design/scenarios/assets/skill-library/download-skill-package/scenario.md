---
layer: design
module: skills
status: verified
flow: skill-library
scenario: SCN-0017
updated: 2026-10-29
---

# SCN-0017 整包下载 SKILL.zip

## 入口

- `CMP-skills/pages/skill-detail.html#download`
- `CMP-skills/assets/js/api.js#downloadUrl`

## 运行序

1. 查看态点「下载」：页面把 `API.downloadUrl('skill', id)` 交给浏览器导航到 `GET /skills/{id}/download`；缓存校验（`ETag`/`If-None-Match`/304）由浏览器与 BFF 透明完成。
2. 200 时浏览器按 `Content-Disposition` 保存 `<name>-<version>.zip`。
3. zip 内容为 `SKILL.md` + `scripts/**` + `references/**`；停用 Skill 仍可下载。

失败路径：404 提示「目标不存在或已被删除」；500 `package_unavailable` 提示包损坏并可重试；BFF 丢失 `Content-Disposition` 时文件名退化为固定名，需显式修正而不是静默接受。

## 不可变引用

- 后端 v1 `GET /skills/{id}/download`：`application/zip`、`ETag: "<revision>"`、304、`nosniff`、ASCII + UTF-8 文件名。
- BFF 透明转发：必须透传 `Content-Disposition` 与 `Content-Type`。
- 包内条目规则（`SKILL.md` 首项、两个附件根、路径校验）由后端契约定义。

## 测试

执行层：Playwright WebKit+ `tools/fake-b1.js` 内存传输；BFF 头透传由 `tests/bff/bff.test.js`（`node:test`）覆盖，最近一次 12/12 通过。场景最近一次执行：2026-10-30，全量 49/49 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0017-T1 | 正 | 查看态下载入口指向 `/api/v1/skills/{id}/download` | `tools/verify-m1-scenarios.js#SCN-0017-T1` |
| SCN-0017-T2 | 正 | 真实 `<a download>` 路径：创建链接、`href` 指向同源 BFF、`rel=noopener`，且不依赖测试钩子 | `tools/verify-m1-scenarios.js#SCN-0017-T2` |
| SCN-0017-T3 | 正 | 停用 Skill 仍可下载 | `tools/verify-m1-scenarios.js#SCN-0017-T3` |
| SCN-0017-T4 | 反 | 404 页面不显示下载入口，只显示错误与重试 | `tools/verify-m1-scenarios.js#SCN-0017-T4` |
