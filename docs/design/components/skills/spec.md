---
layer: design
module: skills
component: CMP-skills
requirement: REQ-0005
scenario: SCN-0005
status: active
updated: 2026-10-26
---

# Skill 库

> 导航：资产与注册 / Skill 库　|　形态：列表 + 详情抽屉　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0005` / `SCN-0005`（verified；DOM/jsdom 3 正 1 反）+ `REQ-0013` / `SCN-0013`（verified；4 正 2 反）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为专家与流程设计者提供可复用能力单元的沉淀、检索与组合入口；没有它，专家只能把能力内联写进指令，无法复用、版本化与审计。
- 负责 / 不负责：负责 Skill 列表（分类 + 标签 + 搜索 + 计数）、新建弹窗、详情抽屉五区（描述 / 工作内容渐进披露 / 踩坑记录与禁令 / 参考引用 / 版本）与全文视图的查看与编辑、启停、删除、引用计数弹窗；不负责专家侧组合与挂载（`CMP-experts`）、工作流节点引用配置（`CMP-workflow-editor`）、外壳/菜单/抽屉原语（`CMP-ui-shell`）。
- 数据所有权：页面状态直接保存 B1 `SkillListItem` / `SkillDetail` / `SkillCategory` DTO；列表 `GET /skills`、详情 `GET /skills/{id}`、创建 `POST`、更新 `PUT`、启停 `PATCH /enabled`、删除 `DELETE`、分类 `GET /skill-categories`、文档 `GET /skills/{id}/document` 均经 `window.API`。不读 `MOCK`，不建第二套视图模型；抽屉编辑草稿只是 `SkillDetail` 的深拷贝，取消即丢弃；版本号由服务端生成，页面不本地递增。`window.API` 单独缓存文档文本与 ETag，不缓存详情 DTO；revision 变化时同时丢弃文档缓存。
- 公开契约：页面入口 `pages/skills.html`；操作 `CMP-skills#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail`；不变量 ①分类只使用 API 返回的 `code/label`，`data-cat` 使用 code（全部=`all`）；②创建/更新 body 为 `name/categoryCode/description/tags/sections/pitfalls/refs`，不带 `version/enabled`；`description` 必填 1–400 字，页面 trim 后提交；③五章渐进披露保持 `details` 结构，仅首章默认展开；④引用只显示 `usedByCount`，B1 不提供引用方明细；⑤删除被引用 Skill 由 B1 返回 409 `referenced`，页面提示引用数并保留数据；⑥启停/删除带 revision，`If-Match` 由 API 层生成；⑦全文只消费 API-31 响应体，不在前端拼装，304 复用上次文本。
- 依赖：`DF`（`renderShell`、`table`、`empty`、`modal`、`menu`、`drawer`、`toast`、`tag`、`relTime`、`esc`、`icon`）/ `window.API`；不依赖 `MOCK` 或其他页面组件。
- 变化轴：五章节内容、渐进披露与全文视图的呈现策略（章节增删、纯文本升级为富文本或文件挂载、全文增加 Markdown 渲染/下载）。
- 验证入口：`npm start` + `/pages/skills.html`；`node tools/verify-m1-scenarios.js SCN-0005`、`node tools/verify-m1-scenarios.js SCN-0013`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 预算：`skills.js` 约 34 KB + 本规格约 7 KB；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/skills.html`。
- 删除测试：删除后专家与工作流节点失去可引用的能力单元，复杂度会集中到 `CMP-experts` 与编辑器，故保留为独立组件。
- 已知偏差：B1 不提供版本历史与引用方明细，详情只显示当前 `version` + `updatedAt`；`refs` 使用 `refType`（不是 `type`）；`usedByCount` 只做计数；全文以纯文本 `<pre>` 展示，不渲染 Markdown、不做语法高亮。M1 SCN-0005/SCN-0013 使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-pages.js` / `verify-b1-writes.js` 覆盖。

## 1 页面定位

独立 Skill 资产库（R2 确认）：沉淀可复用能力单元，供专家组合引用；结构遵循 PPT P8 的 Skill 规范（描述路由 / 工作内容渐进披露 / 踩坑禁令 / 参考引用 / 版本）。

## 2 布局结构

```
┌────────────┬───────────────────────────────────────────────────┐
│ 筛选栏      │ Skill 库                        [🔍搜索] [+ 新建Skill]│
│ ─ 分类     ├───────────────────────────────────────────────────┤
│  全部(12)  │ 名称      类别    描述             引用 版本 状态 操作 │
│  编码(2)   │ CRES技能  编码    适用：…方案…    4   v1.4 启用 ⋮   │
│  检索(4)   │ 调用链分析 检索    适用：…影响面…   5   v2.1 启用 ⋮   │
│  审视(3)   │ AB交叉审视 审视    适用：…交叉…     6   v1.0 启用 ⋮   │
│  测试(3)   │ …                                                 │
└────────────┴───────────────────────────────────────────────────┘
```

## 3 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 左筛选 | 分类树 | 树 | 来自 `skill-categories`，含计数 |
| 左筛选 | 标签 | chips 多选 | 如 CRES、LDP、SVO |
| 主区 | 搜索框 | 输入 | 名称 / `description` / 标签匹配，占位「搜索名称 / 描述 / 标签」 |
| 表格 | 名称、类别标签 | — | 名称点击打开详情抽屉 |
| 表格 | 描述 | 文字 | `description` 单行截断，title 显示全文；不再有摘要/触发列 |
| 表格 | 被引用数 | 数字链接 | 只显示 B1 计数，无引用方明细 |
| 表格 | 版本 / 状态 / 更新时间 | — | 版本只读；状态开关 |
| 表格 | 操作 | ⋮ 菜单 | 查看/编辑、启停、删除 |
| 详情 | 视图切换 | tabs | 查看态「结构化 / 全文」；编辑态固定结构化 |

## 4 详情抽屉（查看/编辑复用）

| 区块 | 内容 | 交互 |
|---|---|---|
| ① 描述 | `description`、类别、标签 | 编辑态可改；必填 1–400 字，实时计数；不再有触发关键词 |
| ② 工作内容 | 五章 `sections` 折叠：总述/步骤/案例/脚本/验证 | 每章纯文本编辑；仅首章展开 |
| ③ 踩坑记录与禁令 | `pitfalls` 列表 | 增删行 |
| ④ 参考引用 | `refs[{label,refType,path}]` | 只读展示；B1 无按名跳转 |
| ⑤ 版本 | 当前 `version` + `updatedAt` | 只读；B1 无历史接口 |

### 4.1 全文视图（API-31）

- 查看态点击「全文」调用 `window.API.document('skill', id)`，请求 `GET /skills/{id}/document`，`Accept: text/markdown`。
- 响应体原样放入 `<pre class="sk-doc">`，不解析、不重排、不二次拼装；frontmatter 与可选章节都按后端返回展示。
- 元信息显示 `200 · 已更新` / `304 · 已复用上次文本` / `正在校验更新…`；304 保留上次文本。
- 404 显示「目标不存在或已被删除」与「重试」；停用 Skill 仍可读取（B1 返回 200）。

## 5 新建与保存

新建弹窗：名称、类别（API 分类）、`description`（必填 1–400 字）→ `POST /skills`，服务端返回 `v1.0` 并进入编辑抽屉。保存 `PUT` 后使用响应 DTO 的 `version`，不本地递增；旧字段 `summary/triggers` 不再提交。

## 6 状态与空态

- 库为空：空态「沉淀第一个 Skill」
- 加载中、列表/分类/详情错误可重试、筛选空态

## 7 B1 数据契约

列表/详情字段：`id,name,categoryCode,categoryLabel,description,version,enabled,tags,sections,pitfalls,refs,usedByCount,revision,createdAt,updatedAt`；`summary/triggers` 已移除。创建/更新不提交 `version/enabled`；启停/删除必须带 `If-Match`（由 `window.API` 生成）。

文档端点：`GET /skills/{id}/document` → `text/markdown; charset=utf-8`、`ETag`、`Cache-Control: no-cache`；`If-None-Match` 匹配返回 304 空体。`window.API` 以 `{text, etag, notModified}` 暴露，文档缓存独立于 revision 缓存；revision 变化时失效。BFF 需透传 `If-None-Match` 与 `ETag`。
