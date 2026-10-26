---
layer: works
module: skills
status: closed
updated: 2026-10-26
---

# 工序结果：Skill 专门页面与 Milkdown 文档渲染

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| 专门页 + 列表抽屉移除 | 通过 | `node tools/verify-m1-scenarios.js SCN-0014` 4/4；`SCN-0005`、`SCN-0013` 同步修订后 10/10 |
| 文档 Tab 只读 Markdown 渲染 + 语法高亮 | 通过 | `npm run test:skill-render` 5/5（Milkdown 渲染、`.token` 高亮、原始 HTML 不执行、渲染容器只读） |
| 专门页真实浏览器引擎验证 | 通过 | `npm run test:skill-engine` 15/15（结构化五章、无抽屉、Milkdown 容器、只读、不注入脚本、错误态） |
| 文档 200 / 304 / 404 / 停用可读 | 通过 | `node tools/verify-m1-scenarios.js SCN-0015` 5/5 |
| 编辑/新建走结构化表单并带 `If-Match` | 通过 | `SCN-0014` 4/4、`SCN-0013` 6/6 |
| 依赖准入与门禁 | 通过 | `npm run check:deps`（`DEP-0001` 148.3 KB gzip，上限 500 KB） |
| 全量场景不回归 | 通过 | `node tools/verify-m1-scenarios.js` 55/55 |
| 静态页面冒烟 | 通过 | `npm run test:smoke` 13/13 |
| B1 真实读/写 | 通过 | `BASE_URL=http://127.0.0.1:3102 node tools/verify-b1-pages.js` 4/4、`node tools/verify-b1-writes.js` 4/4 |
| 文档五态与索引 | 通过 | `npm test`（syntax/docs/scenario index/BFF） |

## 结论落点

- `pages/skills.html` 只保留列表、筛选、启停、删除、引用计数；查看/编辑/新建迁移到 `pages/skill-detail.html?id=&mode=`。
- 查看态默认结构化五章；「文档」Tab 只读渲染 API-31 Markdown，frontmatter 用元信息块 + 正文展示，代码块由 Prism 高亮。
- 渲染失败、加载失败显式报错并可重试；原始 HTML/脚本不执行；渲染容器不可编辑。
- 依赖准入登记 `DEP-0001`（Milkdown + Prism），文档 Tab 按需动态加载，不计入首屏增量。
- `SCN-0014` / `SCN-0015` 置为 `verified`；`REQ-0014` 置为 `delivered`；`SCN-0005` / `SCN-0013` 已同步修订。
