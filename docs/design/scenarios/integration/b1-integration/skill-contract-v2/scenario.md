---
layer: design
module: skills
status: deprecated
flow: b1-integration
scenario: SCN-0013
updated: 2026-10-29
---

# SCN-0013 Skill 契约 v2 展示端适配（已废弃）

## 入口

- `CMP-bff/bff/index.js#handle`
- `CMP-skills/pages/skills.html`

## 运行序

v2 契约（`sections/pitfalls/refs` + `description`）已被 B1 v1 包契约取代，本场景不再执行；由 `SCN-0016`（草稿编辑与保存）与 `SCN-0017`（整包下载）承接。

## 不可变引用

- 无（历史场景，保留编号与断言记录）。

## 测试

执行层：无（历史场景，不再执行）。

以下断言仅作历史记录。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0013-T1 | 正 | 列表列头为「描述」；行文本含 DTO `description` | 历史上 `tools/verify-m1-scenarios.js`（已移除） |
| SCN-0013-T2 | 正 | 新建/编辑 body 只含 `description`；空与 401 字被阻断 | 同上 |
| SCN-0013-T3 | 正 | 文档 Tab 首次 200、二次 304 且渲染文本一致 | 同上 |
| SCN-0013-T4 | 正 | 空踩坑/空引用整节省略；停用 Skill 仍能读文档 | 同上 |
| SCN-0013-T5 | 反 | 文档 404 不显示伪文本，显示错误与重试入口 | 同上 |
| SCN-0013-T6 | 反 | 旧字段 400 映射为「契约已升级，请刷新页面」 | 同上 |
