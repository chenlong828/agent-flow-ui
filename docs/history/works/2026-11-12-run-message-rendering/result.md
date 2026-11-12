---
layer: history
module: global
status: frozen
updated: 2026-11-12
---

# 结果：节点消息 Markdown 渲染与全屏

## 结论

新增 `assets/js/shared/markdown.js`（显示用轻量渲染：标题/段落/列表/代码/引用/表格/链接，先转义后出标签），运行详情的节点消息与确认说明改用它渲染，并加「全屏」浮层（Esc/遮罩关闭）。实时后端验证：含标题、表格、行内代码与列表的模型消息正确渲染。

## 验收

| 项 | 结果 |
|---|---|
| `node --test tests/shared` | 9/9 通过（含 XSS 转义、`javascript:` 链接拦截、代码块转义、表格对齐） |
| `node tools/verify-m1-scenarios.js SCN-0004` | 5/5 通过（T2 确认卡片 Markdown + 全屏开关；T4 节点消息标题/列表） |
| `npm run test:gate` | 通过（新增 `test:shared`） |
| 真实后端 | 含 `##`/表格/代码的消息渲染正确；`.id-full` 打开与关闭正常；console 零错误 |

## 落点

`assets/js/shared/markdown.js`、`tests/shared/markdown.test.js`、`assets/js/pages/instance-detail.js`、`pages/instance-detail.html`、`package.json`（`test:shared`）、`docs/design/scenarios/operations/instances/control-instance/scenario.md`、`docs/design/components/instances/spec.md`、`docs/design/architecture.md`。

## 偏差

- 表格在窄面板内改为横向滚动（`md-table-wrap`），避免列被挤成单字换行；全屏视图仍铺满宽度。
- 行内不会识别任务列表复选框与脚注；模型输出里少见，未覆盖。
