---
layer: history
module: global
status: frozen
updated: 2026-10-26
---

# 工序结果：Skill 契约 v2 展示端适配

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| BFF 透传 `If-None-Match`/`ETag` 与 304 | 通过 | `npm run test:bff` 10/10；文档端点 200/304 单测 |
| Skill 列表/详情/新建/编辑切 `description` | 通过 | `node tools/verify-m1-scenarios.js SCN-0005`、`SCN-0013`；body 不含 `summary/triggers` |
| 全文只消费 API-31 原文，200/304/404 正确 | 通过 | SCN-0013-T3/T5；真实 B1 `GET /skills/{id}/document` 200/304 |
| 空踩坑/空引用整节省略、停用可读 | 通过 | SCN-0013-T4；`sk-replay` / `sk-dsl` 夹具；真实文档对比 |
| 专家页 Skill 摘要无旧字段/undefined | 通过 | SCN-0006-T2；WebKit 专家详情 1440/1024 无 `undefined` |
| 旧字段 400 提示与重试 | 通过 | SCN-0013-T6；真实 B1 旧字段 PUT 400 `details.field=body` |
| M1 全量不回归 | 通过 | `npm run test:scenarios` 46/46 |
| 真实 B1 四页读写 | 通过 | `BASE_URL=http://127.0.0.1:3002 node tools/verify-b1-pages.js` 4/4；`verify-b1-writes.js` 4/4（临时 3101 后端） |
| 桌面视口布局 | 通过 | WebKit 1440/1280/1024：页面无横向溢出；表格在 1280/1024 内部滚动；抽屉与文档不越界 |
| 引擎层页面健康 | 通过 | `verify-user-menu.js` 45/45（含 skills/experts 无运行时错误） |
| 文档五态与索引 | 通过 | `npm test`（syntax/docs/scenario index/BFF） |

移动端适配为项目明确非目标（`design/architecture.md` §1「明确不做」），本工序不宣称移动端验收；真实 Safari 人工走查仍按 R9 遗留。

## 结论落点

- `REQ-0013` 置为 `delivered`；`SCN-0013` 置为 `verified`；`REQ-0005` / `SCN-0005`、`REQ-0006` / `SCN-0006`、`REQ-0012` / `SCN-0012` 同步更新字段断言与计数。
- `CMP-skills`：`description` 替代 `summary/triggers`，1–400 字校验；新增结构化/全文切换，全文只渲染 API-31 响应体；文档缓存独立于 revision 缓存。
- `CMP-experts`：Skill 预览与挑选弹窗读 `description`，不出现 `undefined`。
- `CMP-bff`：请求头白名单补 `if-none-match`，响应继续透传 `ETag`；新增文档 200/304 单测。
- `window.API`：新增 `document(kind,id)`，管理 `{text, etag, notModified}`；revision 变化或删除时丢弃文档缓存；400 `validation_error`+`details.field=body` 映射「契约已升级，请刷新页面」。
- 夹具与测试：`mock-data.js` 去除旧字段并加入空踩坑/空引用样本；`fake-b1.js` 同构合成文档、校验 v2 body；M1 新增 SCN-0013。
- 文档：新增 `REQ-0013`、`SCN-0013`、本工序；更新 skills/experts/bff 规格、architecture、product、README、roadmap、dev-environment、SCN-0005/0006/0012、pitfalls。

## 未决与风险

- 运行中的 `:3100` 是旧进程（Skill/专家列表 500、文档路由 404）；本工序用 `:3101` 新后端 + `:3002` 临时同源 BFF 完成真实验证，未重启用户现有服务。验证前需重启后端。
- 移动端不适配为项目既有范围；本次只验证桌面 1024/1280/1440。
- 真实 Safari 人工走查仍未完成（R9），WebKit 2104 引擎层已通过。
