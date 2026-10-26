---
layer: history
module: global
status: frozen
updated: 2026-10-26
---

# 工序：Skill 契约 v2 展示端适配

## 需求

`REQ-0013` / `SCN-0013`（影响 `SCN-0005`、`SCN-0006`、`SCN-0012`）。

## 背景

B1 已把 Skill 管理面升级为契约 v2：`summary + triggers` 合并为 `description`（1–400 字，语义为适用/触发/不适用），并新增编排面 `GET /api/v1/skills/{id}/document`（固定结构 Markdown、`ETag`、`If-None-Match` → 304，停用仍可读）。本工序先完成 BFF/API 对接，再改 Skill 与专家页；不做旧字段兼容。

定级：P2（跨组件公共契约 + 共享 API 缓存 + 多页 UI），用户已明确“先完成后台 API 对接，然后再进一步看前端界面的修改”并“继续执行”，范围确认；合并前仍需 diff 自查与全量验证。

## 验收标准

1. 列表/详情/新建/编辑只读写 `description`，前端校验 1–400 字；专家页 Skill 摘要无 `undefined`，网络请求与落库对象不再出现 `summary/triggers`。
2. 全文视图只消费 API-31 原样 Markdown：首次 200、二次带 `If-None-Match` 得 304 且保留文本；404 可重试；停用 Skill 可读；空踩坑/空引用整节省略。
3. BFF 透传 `If-None-Match` 请求头与 `ETag` 响应头，304 不被改写；BFF 单测 10/10。
4. 旧字段 400 时页面提示「契约已升级，请刷新页面」；M1 场景 46/46；真实 B1 四页读/写 4/4；桌面与移动端关键视口无溢出/遮挡。

## 任务表

| ID | 类型 | 组件 | 状态 | 装载清单 |
|---|---|---|---|---|
| T-0013-01 | change | `CMP-bff` | 已完成 | `bff/index.js`、`tests/bff/bff.test.js`、`components/bff/spec.md`、B1 API-31 契约 |
| T-0013-02 | change | `CMP-skills` | 已完成 | `assets/js/api.js`、`assets/js/pages/skills.js`、`pages/skills.html`、`assets/js/mock-data.js`、`tools/fake-b1.js`、`tools/verify-m1-scenarios.js`、`components/skills/spec.md` |
| T-0013-03 | change | `CMP-experts` | 已完成 | `assets/js/pages/experts.js`、`components/experts/spec.md`、`tools/verify-m1-scenarios.js#SCN-0006-T2` |
| T-0013-04 | verify | 跨组件 | 已完成 | 全量 `npm test`、`npm run test:scenarios`、`test:b1-pages`、`test:b1-writes`、engine/人工视口检查、文档收口 |

## 装载清单（必读）

- `docs/plan/roadmap.md`、本 brief
- `docs/requirements/REQ-0013-skill-contract-v2.md`、`docs/design/scenarios/integration/b1-integration/skill-contract-v2/scenario.md`
- `docs/design/components/skills/spec.md`、`docs/design/components/experts/spec.md`、`docs/design/components/bff/spec.md`
- `docs/design/architecture.md`、`docs/design/product.md`
- B1 契约：`../agent-flow-orchaster/docs/design/components/skill/spec.md`、`../agent-flow-orchaster/docs/design/components/http-gateway/spec.md`

## 领取的开放问题

无。

## 收口记录

- T-0013-01：BFF `REQUEST_HEADERS` 增加 `if-none-match`；新增文档 200/304 透传单测，10/10。
- T-0013-02：`API.document`、列表/详情/新建/编辑切 `description`、全文视图与 404/304 处理；fake B1 增加 v2 校验与文档合成；SCN-0013 6/6。
- T-0013-03：专家页 Skill 预览与挑选弹窗改读 `description`；SCN-0006 T2 补断言。
- T-0013-04：M1 46/46；BFF 10/10；真实 B1 四页读 4/4、写 4/4（临时 3101 + 3002，未改用户 3000/3100）。
