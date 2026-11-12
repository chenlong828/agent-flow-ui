---
layer: history
module: ui-shell
status: frozen
updated: 2026-11-12
---

# 结果：MOCK 演示页临时关闭与演示模式

## 结论

`CMP-ui-shell` 新增演示页门禁：`demoOn()` 读取 `?demo=1` / `?demo=0` 并写 sessionStorage `df-demo-pages`；`renderShell` 默认过滤效能看板 / 工作区配置 / 个人 Key 管理三个导航项；`DF.mockPageGate` 在四个页面初始化前渲染「已临时关闭」占位页并跳过页面主体。演示模式在本标签页内保持，新标签页默认关闭；用户区「个人 Key 管理」入口保留。

## 验收

| 项 | 结果 |
|---|---|
| `node tools/verify-mock-pages.js` | 22/22（SCN-0020：占位、导航、放行、会话保持、`?demo=0` 退出、无 localStorage、新标签页） |
| `node tools/verify-m1-scenarios.js` | 50/50（MOCK 三场景由 runner 自动带 `?demo=1`，业务断言不变） |
| `node tools/smoke-test.js` | 13/13（MOCK 四页同样带 `?demo=1` 加载真实页面） |
| `npm run test:gate` | 通过 |
| `npm test` | 通过 |

## 落点

`assets/js/ui.js`（`demoOn` / `mockPageGate` / 导航过滤 / `DF` 导出）、`assets/js/pages/{analytics,workspaces,workspace-detail,keys}.js`（初始化门禁）、`tools/verify-mock-pages.js`（新增）、`tools/{smoke-test,verify-m1-scenarios,verify-user-menu}.js`、`package.json`（`test:mock-pages`）、`docs/design/scenarios/shell/navigation/mock-pages-gate/scenario.md`（SCN-0020）、`docs/design/scenarios/{operations/performance/review-performance,workspace/workspace-config/configure-workspace,workspace/credential/manage-key}/scenario.md`、`docs/design/components/{ui-shell,analytics,workspaces,keys}/spec.md`、`docs/design/architecture.md`、`README.md`。

## 偏差

- 演示模式用 sessionStorage 而非仅 URL 参数：保证同一标签页内从占位页跳转后仍可访问其他 MOCK 页；代价是新开标签页需要重新带 `?demo=1`（已在 SCN-0020 覆盖）。
- 关闭状态直达 `workspace-detail.html?id=...` 的占位页不解析 `id`，演示入口会保留原 query（`?id=...&demo=1`）。
- `npm test` 的 M1/冒烟现需 Playwright；未新增运行时依赖。
