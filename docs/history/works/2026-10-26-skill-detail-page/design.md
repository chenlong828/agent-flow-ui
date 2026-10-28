---
layer: history
module: skills
status: frozen
updated: 2026-10-26
---

# 技术设计评审：Skill 专门页面与只读 Markdown 渲染

> 关联：`REQ-0014` / `SCN-0014` / `SCN-0015`。  
> 本文档是工序内评审稿；确认后再落 `architecture.md`、`components/skills/spec.md` 与依赖清单。

## 1 定级与确认门

- 定级：**P2**
  - 新增一个页面入口和页面内渲染适配层；
  - 新增第三方 Markdown 渲染运行时（走依赖准入）；
  - 不新增 `CMP-*` 组件、不改 B1 契约、不改数据所有权、不触热路径。
- 人工门：
  1. 本设计评审通过；
  2. 依赖准入清单新增条目需用户签字；
  3. 实现前不再重新拆组件边界。

## 2 现状

- `CMP-skills` 目前是「列表 + 详情抽屉」：查看、编辑、新建、全文都挤在抽屉里。
- 全文视图当前把 API-31 文本放进 `<pre>`，不做 Markdown 渲染。
- `window.API.document` 已具备：
  - `GET /skills/{id}/document`；
  - `ETag` / `If-None-Match` / 304；
  - revision 变化时失效文档缓存；
  - 停用 Skill 仍可读。
- 当前项目零第三方运行时依赖；`assets/vendor/` 为空。

## 3 目标形态

### 3.1 页面入口

- 列表页：`/pages/skills.html`
  - 保留：搜索、分类/标签筛选、启停、删除、引用计数、新建入口。
  - 移除：详情/编辑抽屉、全文 `<pre>` 视图。
- 专门页面：`/pages/skill-detail.html`
  - `?mode=new`：新建。
  - `?id=<skillId>`：查看态，默认「结构化」Tab。
  - `?id=<skillId>&mode=edit`：编辑态。
- 查看态 Tab：
  - 结构化：沿用五章渐进披露。
  - 文档：只读渲染 API-31 Markdown。
- 编辑态：
  - 只显示结构化表单，不显示文档 Tab。

### 3.2 状态机

```
list --查看--> detail(view) --编辑--> detail(edit)
list --编辑--> detail(edit)
list --新建--> detail(new) --创建成功--> detail(edit, id=<newId>)
detail(edit) --保存成功--> detail(view)
detail(view) --结构化/文档--> tab 切换
```

## 4 组件与文件

| 文件 | 职责 | 备注 |
|---|---|---|
| `pages/skills.html` + `assets/js/pages/skills.js` | 列表页 | 删除抽屉/全文逻辑，保留治理入口 |
| `pages/skill-detail.html` + `assets/js/pages/skill-detail.js` | 专门页面 | 承接新建/查看/编辑 |
| `assets/js/pages/skill-common.js` | 两页共用的纯渲染 helpers | 常量、分类色、日期/相对时间、描述长度校验等 |
| `assets/js/pages/skill-detail-markdown.js` | Markdown 渲染适配层 | 对页面只暴露 `window.SKILL_MD.render(target, text)` |
| `assets/vendor/milkdown/7.22.3/milkdown-view.esm.js` | Markdown 只读渲染 + Prism 语法高亮 | 第三方依赖（文档 Tab 按需加载） |

- `skill-common.js` 不做数据请求、不做页面壳、不做业务写操作。
- `skill-detail-markdown.js` 不暴露 Milkdown / Prism 类型给页面代码。

## 5 渲染选型

| 候选 | 结果 | 结论 |
|---|---|---|
| `Milkdown` + `@milkdown/plugin-prism` | 原型打包后约 **148 KB gzip** | **采用** |
| `marked` + `DOMPurify` | 原型打包后约 **25.5 KB gzip** | 放弃：不满足语法高亮需求 |
| `markdown-it` + `DOMPurify` | 原型打包后约 **60 KB gzip** | 放弃：同样不满足语法高亮需求 |

- 你已确认把依赖准入的单依赖上限提升到 **500 KB gzip**，Milkdown 体积可接受。
- 页面首屏预算不变，渲染器只在「文档」Tab 打开时按需加载。
- 语法高亮使用 `@milkdown/plugin-prism`，与 Milkdown 打包进同一个 vendor 文件。
- 具体版本、SHA-256、体积与许可在依赖准入时最终登记。

## 6 渲染流水线

1. 从 API-31 文本中解析前置 frontmatter：
   - 只识别文首 `---` 包裹的块；
   - 展示 `name / description / version` 元信息；
   - 剩余部分交给 Markdown 渲染。
2. `Milkdown` 只读渲染 Markdown：
   - 启用常用 Markdown 结构；
   - 代码块启用 `@milkdown/plugin-prism` 语法高亮；
   - 不做源码编辑。
3. 将渲染结果写入文档 Tab 容器。
4. 页面代码只看到 `window.SKILL_MD.render(target, text)`，不接触第三方类型。

安全约束：

- 原始 HTML 以文本形式保留，不执行；
- 渲染结果不可编辑；
- 渲染失败、加载失败都显式报错并提供重试；
- 不把渲染结果当成可编辑表单。

## 7 外部契约与依赖

### 7.1 外部契约

- B1 API 契约：不变。
- `window.API`：不变。
- 页面 URL 契约：新增 `/pages/skill-detail.html?id=&mode=`。
- 组件操作契约：
  - `CMP-skills` 增加页面入口 `#detail-page`；
  - 原抽屉相关入口从列表页移除。

### 7.2 第三方依赖

- 新增一条依赖：
  - `Milkdown` + `@milkdown/plugin-prism`
- 交付形态：自托管单文件 ESM，落 `assets/vendor/`。
- 版本精确钉住，登记 SHA-256 与 gzip 体积。
- 依赖准入的单依赖上限提升到 **500 KB gzip**。
- `package.json` 保持空依赖。
- 运行时不使用 CDN。

## 8 数据所有权

- Skill DTO 与文档文本的唯一真相仍是 B1。
- `window.API` 的 revision/ETag 缓存继续作为唯一前端派生缓存。
- 渲染层不缓存 Markdown 文本、不缓存 DOM。
- 页面状态仅保存当前视图状态，不复制业务数据。

## 9 失败路径

| 场景 | 行为 |
|---|---|
| 详情 404 / 网络 | 显式错误 + 重试 |
| 文档 404 / 网络 | 显式错误 + 重试 |
| 文档为空 | 空态 |
| 304 | 保留上次文本，状态显示 304 |
| 停用 Skill | 仍可读取文档 |
| 渲染器加载失败 | 显式错误，不回落 `<pre>` |
| 原始 HTML/脚本 | 不执行 |

## 10 测试计划

| 层 | 内容 |
|---|---|
| DOM / jsdom | `SCN-0014`：列表跳转、新建、编辑、错误态 |
| DOM / jsdom | `SCN-0015` 状态部分：文档 200/304/404/停用 |
| 引擎 / WebKit | `SCN-0015` 渲染部分：真实 Markdown 渲染、语法高亮、只读、原始 HTML 不执行 |
| BFF / live B1 | 现有读写验证不回归 |
| 依赖门禁 | `check-deps` 校验 vendor、SHA-256、体积 |
| 文档一致性 | `check-docs` / `docs:index` |

计划新增脚本：

- `tools/verify-skill-page-render.js`
- `tools/verify-m1-scenarios.js` 内扩展 `SCN-0014` / `SCN-0015`

## 11 文档与规格影响

实现确认后需要同步更新：

- `docs/design/dependencies.md`
- `docs/design/architecture.md`
- `docs/design/components/skills/spec.md`
- `docs/design/product.md`
- `docs/README.md`
- `docs/plan/roadmap.md`
- `SCN-0005` / `SCN-0013`
- `SCN-0015` 中的语法高亮断言

## 12 未决问题

无。你已确认：

1. 渲染器采用 `Milkdown`；
2. 依赖准入的单依赖上限提升到 **500 KB gzip**；
3. frontmatter 用「元信息块 + Markdown 正文」展示；
4. 文档 Tab 需要语法高亮。

## 13 评审确认点

- [x] 渲染器选型
- [x] 依赖准入
- [x] 页面路由与状态机
- [x] 组件文件切分
- [x] frontmatter 展示方式
- [x] 语法高亮
