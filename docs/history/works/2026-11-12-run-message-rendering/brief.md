---
layer: history
module: global
status: frozen
updated: 2026-11-12
---

# 工序：运行详情的节点消息按 Markdown 渲染并可全屏

## 需求

延续 `REQ-0004` / `SCN-0004`（不新立需求卡）。用户 2026-11-12 指示：节点消息按 Markdown 显示，并增加按钮扩大到浏览器可见全区域。

## 背景

运行详情的节点消息原本用 `<pre>` 原样输出：模型返回的标题、列表、行内代码、表格都退化成纯文本，长报告只能在窄面板里滚动。节点消息是判断运行结果的直接证据，可读性影响排障效率。

## 目标 / 非目标

- 目标：节点消息与人工确认说明按 Markdown 渲染；右上「全屏」在整屏浮层查看，Esc 或点遮罩关闭；渲染对原始 HTML 转义，链接只放行安全协议。
- 非目标：不引入新的 Markdown 依赖（不挂 Milkdown），不改变 run API 与数据层；不做消息编辑、搜索、复制按钮。

## 定级

P3：单页面显示层改动，不触碰组件切分、公共契约、schema、依赖或热路径；自动化测试可覆盖。

## 任务表

| ID | 类型 | 组件 | 状态 | 出口 |
|---|---|---|---|---|
| `T-RUNUI-06` | change | `CMP-instances` | 完成 | `assets/js/shared/markdown.js` + 详情 Markdown 渲染与全屏浮层 |
| `T-RUNUI-07` | verify | global | 完成 | `tests/shared/markdown.test.js` 9/9；SCN-0004 增 Markdown/全屏断言后 5/5 |

装载清单：`assets/js/pages/instance-detail.js`、`pages/instance-detail.html`、`docs/design/scenarios/operations/instances/control-instance/scenario.md`。

## 验收标准

1. `node --test tests/shared` 9/9；`node tools/verify-m1-scenarios.js SCN-0004` 5/5；`npm run test:gate` 通过。
2. 真实后端目视：含 `##` 标题、列表、表格的模型消息渲染为对应元素；「全屏」覆盖整屏且可 Esc 关闭。
3. 原始 HTML/脚本被转义；`javascript:` 链接不生成 `<a>`。
