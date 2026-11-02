---
layer: design
module: skills
component: CMP-skills
requirement: REQ-0005
scenario: SCN-0005
status: active
updated: 2026-10-29
---

# Skill 库

> 导航：资产与注册 / Skill 库　|　形态：列表 + 专门详情页　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0005` / `SCN-0005`（verified）+ `REQ-0015` / `SCN-0016`、`SCN-0017`（verified；`SCN-0013` 已废弃）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为专家与流程设计者提供可复用能力单元的沉淀、检索与组合入口；没有它，专家只能把能力内联写进指令，无法复用、版本化与审计。
- 负责 / 不负责：负责 Skill 列表（分类 + 标签 + 搜索 + 计数）、启停、删除、引用计数弹窗；负责专门页 `pages/skill-detail.html` 的查看/编辑/新建：元数据、`SKILL.md` 正文、`scripts/` + `references/` 附件清单、草稿保存、整包下载；不负责专家侧组合与挂载（`CMP-experts`）、工作流节点引用配置（`CMP-workflow-editor`）、外壳/菜单/弹窗原语（`CMP-ui-shell`）、包构建与存储（B1）。
- 内部逻辑：分类计数与列表同源；`description` 1–400；正文上限 16 KiB（UTF-8 字节，含 frontmatter），编辑态实时计数，超限阻断保存并提示把长内容放进 `references/`；保存必须走草稿：建草稿 → 改元数据/正文 → 上传或整理附件 → `save` 带 `If-Match`；版本由服务端递增；同名附件上传即覆盖；附件支持按钮选择与拖入附件区（同样落到 `scripts/`/`references/`）；取消即丢弃草稿，有未保存修改时先确认；`Ctrl/Cmd+S` 保存；编辑态操作栏吸顶；保存成功草稿被消费，页面重拉详情。
- 数据所有权：页面状态直接保存 B1 `SkillListItem` / `SkillDetail`（`body` + `files`）/ `SkillDraft` / `SkillCategory` DTO；列表 `GET /skills`、详情 `GET /skills/{id}`、分类 `GET /skill-categories`、引用 `GET /skills/{id}/references`、启停 `PATCH /enabled`、删除 `DELETE`、下载 `GET /skills/{id}/download`、文档原文 `GET /skills/{id}/document`；草稿 `POST /skill-drafts`、`GET/DELETE /skill-drafts/{id}`、`POST/PATCH/DELETE /skill-drafts/{id}/files`、`POST /skill-drafts/{id}/save`，均经 `window.API`。不读 `MOCK`，不建第二套视图模型；草稿是服务端资源（TTL 24 小时），页面只持有 draft id 与文件清单，不做本地深拷贝；版本号由服务端生成，页面不本地递增。
- 公开契约：页面入口 `pages/skills.html`、`pages/skill-detail.html?id=&mode=`；操作 `CMP-skills#list`、`#create`、`#edit`、`#toggle`、`#delete`、`#detail-page`、`#draft`、`#download`；不变量 ①分类只使用 API 返回的 `code/label`，`data-cat` 使用 code（全部=`all`）；②保存 body 为 `name/categoryCode/description/tags/body`，不带 `version/enabled`；`description` 必填 1–400 字，页面 trim 后提交；③查看态 = 元数据条 + 正文渲染 + 文件清单 + 下载，不再有结构化五章与「结构化/文档」双 Tab；④编辑/新建 = 草稿，`SKILL.md` 只读，附件只能落在 `scripts/`、`references/`，同名上传覆盖；⑤正文超 16 KiB 阻断保存并提示放 `references/`；⑥引用只显示 `usedByCount`；⑦删除被引用 Skill 由 B1 返回 409 `referenced`，页面提示引用数并保留数据；⑧启停/删除/保存带 revision，`If-Match` 由 API 层生成；⑨不提供单文件下载与附件预览；⑩正文渲染边界：内容最大宽度 860px、长串自动换行、代码块与表格内部自适应，页面不得出现横向滚动；⑪编辑态未保存修改时取消/离开需确认；⑫缺图显示占位而不是裸破图。
- 依赖：`DF`（`renderShell`、`table`、`empty`、`field`、`modal`、`menu`、`toast`、`tag`、`esc`、`icon`）/ `window.API` / `window.SKILL_MD`（编辑器适配层）/ `DEP-0001`（7.7.0 单包，只读与编辑共用）；不依赖 `MOCK` 或其他页面组件。
- 冷热属性：冷（管理面用户触发）；编辑器按需加载 `DEP-0001`，不占首屏。
- 变化轴：正文渲染主题、附件清单策略（大小/排序）、下载与复制、草稿自动保存。
- 验证入口：`npm start` + `/pages/skills.html`、`/pages/skill-detail.html?id=sk-cres`；`node tools/verify-m1-scenarios.js SCN-0005|SCN-0014|SCN-0015|SCN-0016|SCN-0017`；`npm run test:skill-render`；`npm run test:skill-engine`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`；`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`。
- 验证计划：列表/启停/删除→SCN-0005；专门页三态→SCN-0014 + `test:skill-engine`；正文渲染→SCN-0015 + `test:skill-render`；草稿编辑与保存→SCN-0016；整包下载→SCN-0017；真实 B1→`test:b1-pages/writes`。
- 预算：`skills.js` 约 12 KB + `skill-detail.js` 约 14 KB + `skill-common.js` 约 3 KB + 本规格约 9 KB；`DEP-0001` 177.3 KiB gzip 按需加载，低于 500 KiB 观测阈值（只 WARN）。
- 单独运行：`npm start` → `/pages/skills.html` 或 `/pages/skill-detail.html?id=sk-cres`。
- 删除测试：删除后专家与工作流节点失去可引用的能力单元，复杂度会集中到 `CMP-experts` 与编辑器，故保留为独立组件。
- 已知偏差：编辑器不提供格式工具栏，依赖 Markdown 快捷输入；取消的草稿与刷新后的编辑不跨会话恢复（仅服务端 TTL 24h）；B1 不提供版本历史、引用方明细与单文件读取；详情/文档/下载都整包 inflate，大包读取有延迟；`scripts/` 在 zip 内无执行位（0644），执行侧自行处理；`usedByCount` 只做计数；M1 场景使用 `tools/fake-b1.js` 内存传输，真实读写由 `verify-b1-*` 覆盖；`DEP-0001` 已升级为 7.7.0 单包（查看与编辑共用），旧 7.22.3 只读包已移除。

## 1 页面定位

独立 Skill 资产库（R2 确认）：沉淀可复用能力单元，供专家组合引用。Skill 的形态是**一个包**：`SKILL.md`（frontmatter + 自由 Markdown 正文）+ `scripts/` + `references/` 附件；列表负责检索与治理，专门页负责阅读、编辑与下载。

## 2 布局结构

```
┌────────────┬───────────────────────────────────────────────────┐
│ 筛选栏      │ Skill 库                        [🔍搜索] [+ 新建Skill]│
│ ─ 分类     ├───────────────────────────────────────────────────┤
│  全部(12)  │ 名称      类别    描述             引用 版本 状态 操作 │
│  编码(2)   │ CRES技能  编码    适用：…方案…    4   v1.4 启用 ⋮   │
│  检索(4)   │ 调用链分析 检索    适用：…影响面…   5   v2.1 启用 ⋮   │
│  审视(3)   │ AB交叉审视 审视    适用：…交叉…     6   v1.0 启用 ⋮   │
└────────────┴───────────────────────────────────────────────────┘
```

专门页（查看态）：

```
┌───────────────────────────────────────────────────────────────┐
│ ← Skill 库   CRES技能  [编码] v1.4 启用                        │
│ 描述：适用：…方案…              [编辑] [下载] [启停] [删除]     │
├───────────────────────────────────────────────────────────────┤
│ 正文（Milkdown 只读渲染）                                      │
│   # 流程总述 …                                                 │
├───────────────────────────────────────────────────────────────┤
│ 附件  SKILL.md · 3.2 KB（只读）  scripts/run.sh · 1.1 KB      │
│       references/spec.md · 8.4 KB                              │
└───────────────────────────────────────────────────────────────┘
```

## 3 列表页元素

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 左筛选 | 分类树 | 树 | 来自 `skill-categories`，含计数 |
| 左筛选 | 标签 | chips 多选 | 如 CRES、LDP、SVO |
| 主区 | 搜索框 | 输入 | 名称 / `description` / 标签匹配，占位「搜索名称 / 描述 / 标签」 |
| 表格 | 名称 | 文本 | 点击跳转 `skill-detail.html?id=<id>` |
| 表格 | 描述 | 文字 | `description` 单行截断，title 显示全文 |
| 表格 | 被引用数 | 数字链接 | 只显示 B1 计数，无引用方明细 |
| 表格 | 版本 / 状态 / 更新时间 | — | 版本只读；状态开关 |
| 表格 | 操作 | ⋮ 菜单 | 查看/编辑跳转专门页，启停、删除原地处理 |

## 4 专门页（查看 / 编辑 / 新建）

| 状态 | 内容 | 交互 |
|---|---|---|
| 查看 | 元数据条、正文渲染、文件清单（`SKILL.md` 标只读）、下载 | 编辑按钮进入编辑态；启停/删除原地 |
| 编辑 | 元数据控件（名称/类别/描述/标签）、正文编辑器、附件区（上传/改名/删除） | 保存 `POST /skill-drafts/{id}/save` 带 `If-Match`；取消丢弃草稿 |
| 新建 | 同编辑，空草稿 | `POST /skill-drafts` 建草稿，保存成功后进入查看态 |

### 4.1 查看态

- 详情 `GET /skills/{id}` 已含 `body` 与 `files`，直接渲染 `body`，不再调用 `/document`；`window.API.document` 保留给需要含 frontmatter 原文的场景。
- `body` 交给 `window.SKILL_MD.mount(el, { editable: false })` 渲染，失败显式报错并提供重试，不回落 `<pre>`。
- 文件清单显示 `path` 与 `size`，标注 `readOnly`；不提供单文件下载与预览。
- 元信息显示 `revision`、`updatedAt`、`usedByCount`；停用 Skill 仍可查看与下载。

### 4.2 编辑态与草稿

- 进入编辑即 `POST /skill-drafts { skillId }`；新建立即 `POST /skill-drafts`（无 `skillId`）。页面以草稿文件集为准，`SKILL.md` 只读。
- 正文编辑器与查看态共用适配层，`editable: true`；`onChange` 更新本地正文，实时计算 UTF-8 字节数（含 frontmatter 估算），超过 16384 字节时保存按钮禁用并提示「把长内容放进 `references/`」。
- 附件区：上传 `POST /skill-drafts/{id}/files`（`multipart`：`path` + `file`，只能 `scripts/`、`references/`），改名 `PATCH`、删除 `DELETE`；同名覆盖前二次确认。
- 取消：`DELETE /skill-drafts/{id}` 后回到查看态；草稿 TTL 24 小时，过期后保存提示重新编辑。

### 4.3 下载

- 「下载」触发 `GET /skills/{id}/download`，由浏览器按 `Content-Disposition` 保存 `<name>-<version>.zip`；不下载单文件、不内联预览。
- 下载失败（404 / 500 `package_unavailable`）用 toast 提示并提供重试。

## 5 新建与保存

新建/编辑统一走草稿：保存 `POST /skill-drafts/{id}/save`，body 为 `name/categoryCode/description/tags/body`，带 `If-Match`（新建不带）；成功 200/201 后草稿被消费，页面重拉详情回到查看态。`description` 必填 1–400 字；错误码 `428`/`409`/`410`/`422`/`413`/`400` 均给出可读提示，保存失败保留草稿允许重试。

## 6 状态与空态

- 库为空：空态「沉淀第一个 Skill」
- 加载中、列表/分类/详情/草稿/下载错误可重试、筛选空态
- 草稿过期：提示「草稿已过期，请重新编辑」并回到查看态

## 7 B1 数据契约

列表字段：`id,name,categoryCode,categoryLabel,description,version,enabled,tags,usedByCount,revision,updatedAt`；详情另含 `body`、`files[{path,size,readOnly}]`、`createdAt`。创建/更新不提交 `version/enabled`；启停/删除/保存必须带 `If-Match`（由 `window.API` 生成）。

草稿：`{id, skillId, baseRevision, baseVersion, expiresAt, createdAt, files}`；`save` 返回 `{id, revision, version}`，页面据此重拉详情。

文档端点保留：`GET /skills/{id}/document` → `text/markdown; charset=utf-8`、`ETag`、`Cache-Control: no-cache`；`If-None-Match` 匹配返回 304 空体。查看态不再依赖它。

下载端点：`GET /skills/{id}/download` → `application/zip`、`ETag: "<revision>"`、`Content-Disposition`（ASCII 回退 + `filename*=UTF-8''`）、`X-Content-Type-Options: nosniff`；BFF 必须透传 `Content-Disposition`。

限制：`SKILL.md` ≤ 16 KiB（含 frontmatter）、单文件 ≤ 20 MiB、包 ≤ 100 MiB、文件数 ≤ 100、路径 ≤ 512 字节且段 ≤ 255；草稿 TTL 24 小时。
