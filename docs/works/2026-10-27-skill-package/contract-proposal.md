---
layer: works
module: skills
status: active
updated: 2026-10-28
---

# Skill 契约 v3 提案：包形态（SKILL.md + scripts/ + references/）

> **已作废（2026-10-29）**：B1 已按自己的 v1 契约重建（`agent-flow-orchaster/docs/works/2026-10-28-skill-package/contract-proposal.md`），本文件仅作为决策过程记录保留。实现口径见 `REQ-0015` 与 B1 契约 v1；`body_md`、staging 表、`/files`、`/package`、256 KiB 等设计不再生效。

状态：**草案，待确认（P1）**。确认后冻结为实现依据；本文同时是跨仓库（`agent-flow-ui` / `agent-flow-orchaster`）的唯一契约口径。
关联：`REQ-0013`（v2）、`REQ-0014`、`SCN-0005`、`SCN-0013`、`SCN-0014`、`SCN-0015`。v2 提案见 B1 仓库 `docs/works/2026-10-26-skill-contract-v2/contract-proposal.md`。

## 0 摘要

**一句话**：Skill 改成一个 **Skill 包**——`SKILL.md`（frontmatter + 自由 Markdown 正文）+ `scripts/` + `references/`；编辑期附件先落在临时区，保存时与元数据、正文一起提交，并打包成 `SKILL.zip` 供下载。

> **现有数据不做迁移**：Skill 尚未实际使用，旧子表直接删除，不写回填脚本、不保留兼容层。

| 变 | 内容 |
|---|---|
| 改 | 五章 + 踩坑 + 引用三张子表 → 一列 `body_md`；五个 textarea → 一个 Markdown 编辑器 |
| 增 | 附件暂存区（staging）+ 提交时落库 + `SKILL.zip` 打包下载 |
| 不变 | 列表、筛选、启停、删除与引用保护、专家装配、`/document` 的媒体类型与 ETag 语义 |
| 代价 | P1 契约破坏；BFF 需支持大请求；引入编辑器包（统一 7.7.0，单包） |

**已确认**（2026-10-28）：

1. 正文不强制五章，创建时 seed 模板。
2. 删除 `refs` 字段：链接写进正文，文件进 `references/`。
3. 附件存本地文件系统 + `BlobStore` 端口。
4. 上传即时进入**临时暂存区**；提交后打包成 `SKILL.zip`，下载时 `SKILL.md` 与附件一起取回。
5. 附件操作不推进 `revision` / `version`；保存时随正文一起推进。
6. `/document` 不含附件清单，编排侧单独取文件。
7. 上限：单文件 20 MiB、单 Skill 合计 100 MiB、100 个文件。
8. 编辑器与只读渲染统一到 **Milkdown 7.7.0**，仓外构建、只维护一套。
9. 依赖体积（`check-deps` 的 500 / 120 / 300 KiB）已改为**观测阈值**，超出只 WARN、不阻断；实现按节约优先，不为数字砍能力。

**怎么读**：

- 只想知道结论 → 本节 + §9 分期 + §11 已收口项。
- 要对契约 → §3 契约 diff、§4 数据模型。
- 要评估编辑器 → [`editor-reuse.md`](editor-reuse.md)。

## 1 为什么改

| 现状事实 | 后果 |
|---|---|
| 正文被拆成 `overview/steps/examples/scripts/verification` 五章 + `pitfalls` + `refs`，共四张子表 | 作者在五个 textarea 里分段写作，代码块、表格、整段粘贴都退化；Skill 的真实形态（一份说明书 + 脚本）无法表达 |
| 编辑态「预览」由前端 `draftMarkdown` 拼装，查看态「文档」由 B1 `composeDocument` 拼装 | 两个拼装方已经漂移：前端标题「详细步骤与约束 / 参考案例模板 / 外部脚本使用指南 / 完成验证方案」≠ 文档标题「执行步骤 / 示例 / 脚本 / 完成验证」；空章节是否省略也不一致 |
| 编辑态把 `refs` 只读展示，保存请求恒发 `refs: []`，B1 `replaceChildren` 先删后插 | **每次保存静默清空全部引用**（[skill-detail.js:602](../../../assets/js/pages/skill-detail.js#L602)、B1 `skill/store.ts` `replaceChildren`）；新建也无法写入引用 |
| `scripts` 章节只是文字说明，仓库里没有任何地方能放真正的脚本或二进制 | Skill 无法被真正执行；附件需求只能挂在 `refs.path` 字符串上，是假引用 |

目标形态对齐业界事实标准（`SKILL.md` + 目录），并保留 v2 已确认的两面切分：**管理面**（列表、表单、审计）与**编排面**（整篇 markdown）。

## 2 目标形态

### 2.1 包结构

```
<skill>/
├── SKILL.md            # 唯一入口文档
├── scripts/            # 可执行脚本（.sh / .py / .js / 二进制）
└── references/         # 参考资料、模板、规范文本
```

- 两个文件根固定为 `scripts/`、`references/`，允许子目录；不允许其他根目录。
- 正文用相对路径引用附件（`scripts/run.sh`）；运行时由编排侧按 `GET /files` 取回。

### 2.2 SKILL.md

````markdown
---
name: "CRES 需求规范"
description: "适用：客户提出新需求或需求含糊时；触发词：需求分析、需求澄清、CRES；不适用：纯技术重构。"
version: "v1.3"
---

## 流程总述

……

## 执行步骤

```bash
./scripts/run.sh --spec specs/cres.yaml
```
````

- frontmatter 三键、固定顺序、由 B1 生成：`name`、`description`、`version`。**正文里不得包含 frontmatter**。
- 正文是自由 Markdown：不强制五章；创建时前端 seed 模板（默认上面五个 H2），作者可增删改。
- 渐进披露的落点：列表只展示 `description`；详情页从正文 H2 生成导航大纲（渲染层行为，不入契约）。
- 存储的 `body` **不含** frontmatter；`GET /document` 返回 frontmatter + body。

### 2.3 编辑 → 暂存 → 提交 → 打包

```
进入编辑 ──► POST /skill-staging（带 skillId 则快照现有文件）
              │
              ├─ 上传/重命名/删除附件  → 只作用于 staging
              ├─ 编辑元数据 + 正文      → 页面草稿
              │
保存 ────────► PUT /skills/{id}（带 stagingId）
              └─ 事务：替换文件集 + revision+1 + version minor+1
              └─ 提交后构建 SKILL.zip（失败则由下载时重建）
取消 ────────► DELETE /skill-staging/{id}（TTL 兜底清理）
```

- 附件在提交前**不属于** Skill：查看态、`/files`、`/document` 都看不到暂存文件。
- 新建 Skill 也走同一路径：先建 staging（无 `skillId`），保存时 `POST /skills` 带 `stagingId`。
- 提交是整体的：元数据、正文、文件三者同一个 `revision`，不存在"文件已生效、正文未保存"的中间态。

### 2.4 下载

- `GET /skills/{id}/package` → `application/zip`，文件名 `<name>-<version>.zip`，内容：`SKILL.md` + `scripts/**` + `references/**`。
- 单个文件仍可通过 `GET /skills/{id}/files/{fileId}` 下载（对比、调试用）。
- 包内 `SKILL.md` 与 `GET /document` 完全一致，不重新拼装。

## 3 契约 diff

### 3.1 字段归属

管理面字段保留不变：

| 字段 | 说明 |
|---|---|
| `id` `name` `categoryCode` `categoryLabel` | 列表、筛选、详情标题 |
| `tags` `enabled` `version` `revision` | 筛选、启停、版本、乐观锁 |
| `updatedAt` `createdAt` `usedByCount` | 审计与引用计数 |
| `description` | 两面共用：路由键 + frontmatter |

内容字段本次变更：

| 字段 | v2 | v3 | 说明 |
|---|---|---|---|
| `sections`（五章） | 管理面 + 子表 | **删除** | 并入 `body` |
| `pitfalls` | 管理面 + 子表 | **删除** | 并入 `body`（`## 常见踩坑`） |
| `refs` | 管理面 + 子表 | **删除** | 链接写进正文；文件进 `references/` |
| `body` | — | **新增** | Markdown 正文，不含 frontmatter |
| `files` | — | **新增** | `SkillFileMeta[]`，只含元信息 |
| `stagingId` | — | **新增**（请求） | 编辑态附件草稿；不传则文件不变 |

### 3.2 管理面 DTO

```ts
type SkillDetail = SkillListItem & {
  body: string;              // markdown，无 frontmatter；≤ 256 KiB
  files: SkillFileMeta[];    // 已提交文件，按 path 排序
  createdAt: string;
};

type SkillFileMeta = {
  id: string;
  path: string;              // "scripts/run.sh" | "references/spec.md"
  sizeBytes: number;
  mime: string;
  sha256: string;
  createdAt: string;
};
```

列表项 `SkillListItem` 不变；专家侧 `ExpertSkillSummary` 只读 `description`，不变。

### 3.3 写请求

`POST /api/v1/skills`、`PUT /api/v1/skills/{id}`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 1–80，唯一 |
| `categoryCode` | string | 是 | 必须存在 |
| `description` | string | 是 | 1–400 |
| `tags` | string[] | 否 | 有序 |
| `body` | string | 是 | 可为空串；≤ 256 KiB；不得以 `---` frontmatter 开头 |
| `stagingId` | string | 否 | 有则用该草稿的文件集替换；无则文件不变 |

`version`、`enabled` 不可写；出现 `sections`/`pitfalls`/`refs`/`summary`/`triggers` 等未声明字段按现有规则 400。

### 3.4 草稿（staging）API（新增）

| 方法 | 路径 | 说明 | 成功 |
|---|---|---|---|
| POST | `/api/v1/skill-staging` | body `{skillId?}`；有 `skillId` 则快照现有文件 | 201 `{id, files, expiresAt}` |
| GET | `/api/v1/skill-staging/{id}` | 草稿与文件清单 | 200 |
| POST | `/api/v1/skill-staging/{id}/files` | `multipart/form-data`：`file`、`dir`（`scripts` 或 `references`）、可选 `filename` | 201 文件元信息 |
| PATCH | `/api/v1/skill-staging/{id}/files/{fileId}` | JSON `{path}` 重命名/移动 | 200 |
| DELETE | `/api/v1/skill-staging/{id}/files/{fileId}` | 从草稿移除 | 204 |
| DELETE | `/api/v1/skill-staging/{id}` | 放弃草稿 | 204 |

- 草稿是**临时资源**：`expiresAt = now + 24h`，后台按过期时间清理；提交或放弃后立即删除。
- 带 `skillId` 时做**快照**：把现有文件行复制为草稿初始内容；提交 = 草稿整体替换，取消 = 全部丢弃。
- 上传不改变 `skill.revision`，也未提交前对任何读接口不可见。
- 同 `path` 在同一草稿内唯一，重复 → 409 `path_conflict`。
- 提交后 `skill_file` 的行由草稿行复制而来（**沿用草稿行的 `id`**，uuid 由应用生成），草稿行级联删除。

### 3.5 已提交文件与包

| 方法 | 路径 | 说明 | 成功 |
|---|---|---|---|
| GET | `/api/v1/skills/{id}/files` | 已提交文件清单 | 200 `{items}` |
| GET | `/api/v1/skills/{id}/files/{fileId}` | 单文件下载；`ETag: "<sha256>"`、`If-None-Match` → 304 | 200 二进制 |
| GET | `/api/v1/skills/{id}/package` | `SKILL.zip`；`ETag: "<revision>"`、`If-None-Match` → 304 | 200 zip |

- `Content-Disposition: attachment; filename*=UTF-8''<name>-<version>.zip`。
- 保存时构建一次并缓存（`packages/<skillId>/<revision>.zip`）；构建失败不阻塞保存，下载时重建，成功后落缓存。
- 不做"替换单个文件"：替换 = 草稿里删掉再传。

### 3.6 编排面 `GET /api/v1/skills/{id}/document`

- 媒体类型、`ETag: "<revision>"`、`If-None-Match` → 304、停用可读、404 信封：**全部不变**。
- 内容：`frontmatter(name, description, version)` + `body`。
- **不含附件清单**；需要文件时调 `GET /files` 或直接取 `/package`。

### 3.7 版本与修订语义

| 操作 | `revision` | `version` | 说明 |
|---|---|---|---|
| 草稿的建/传/改名/删/放弃 | **不变** | **不变** | 草稿不属于 Skill |
| 保存（带 `stagingId`） | +1 | minor+1（`v1.9 → v2.0`） | 元数据 + 正文 + 文件同一事务 |
| 启停 | +1 | 不变 | 不变 |

### 3.8 破坏性清单

- `SkillDetail` 删除 `sections`/`pitfalls`/`refs`，新增 `body`/`files`。
- 写请求删除 `sections`/`pitfalls`/`refs`，新增 `body`/`stagingId`。
- 删除表 `skill_section`、`skill_pitfall`、`skill_ref`。
- 受影响读方：`catalog.getSkillDetail`、前端 Skill 详情页、`tools/fake-b1.js`、全部 Skill 场景测试。
- 不受影响：Skill 列表、分类、启停、删除与引用保护、专家装配与摘要、工作流节点。

## 4 数据模型（无数据迁移）

Skill 尚未实际使用：只做结构变更，**不回填、不保留兼容层**。

### 4.1 结构变更（`0006_skill_package.sql`）

```sql
-- 1) 正文入库
alter table skill add column body_md text not null default '';
alter table skill add constraint skill_body_md_len check (char_length(body_md) <= 262144);

-- 2) 无数据的旧子表直接删除
drop table skill_section;
drop table skill_pitfall;
drop table skill_ref;

-- 3) 附件与草稿
create table skill_file (
  id uuid primary key,
  skill_id uuid not null references skill (id) on delete cascade,
  path text not null check (path ~ '^(scripts|references)/' and path !~ '(^|/)\.\.(/|$)'),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 20971520),
  mime text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by text,
  unique (skill_id, path)
);
create index skill_file_skill_id_idx on skill_file (skill_id);
create index skill_file_sha256_idx on skill_file (sha256);

create table skill_staging (
  id uuid primary key,
  skill_id uuid references skill (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index skill_staging_expires_at_idx on skill_staging (expires_at);

create table skill_staging_file (
  id uuid primary key,
  staging_id uuid not null references skill_staging (id) on delete cascade,
  path text not null check (path ~ '^(scripts|references)/' and path !~ '(^|/)\.\.(/|$)'),
  size_bytes bigint not null check (size_bytes >= 0),
  mime text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (staging_id, path)
);
```

`skill` 根表其余字段与 `skill_tag` 保持 v2 结构不变。

### 4.2 Blob 存储

- 新增端口 `BlobStore`（L0）：`put(bytes) -> sha256` / `read(sha256)` / `delete(sha256)` / `exists(sha256)`。
- 内容寻址：`blobs/<sha256[0:2]>/<sha256>`，根目录由 `[storage] root` 配置（默认 `./data/blobs`）。
- 草稿上传的字节立即落到内容寻址区（等价于"临时目录"），但只被 `skill_staging_file` 引用，对 `/files`、`/document`、`/package` 不可见；提交时只把引用转成 `skill_file` 行，不搬字节。
- 草稿行与已提交行引用同一 blob；提交不搬字节，只换行。
- 孤儿 blob（替换/放弃草稿后无引用）由 GC 清理：扫描 `skill_file` + `skill_staging_file` 的 sha256 集合，删多余文件；先记录数量，再定时执行。
- 不选 PG `bytea`：会撑大 WAL 与备份，且二进制读写更重。

### 4.3 提交事务

```
BEGIN
  SELECT ... FROM skill WHERE id = $1 FOR UPDATE        -- 校验 revision
  DELETE FROM skill_file WHERE skill_id = $1
  INSERT INTO skill_file (id, skill_id, path, size_bytes, mime, sha256, created_by)
    SELECT id, $1, path, size_bytes, mime, sha256, $actor
    FROM skill_staging_file WHERE staging_id = $2
  DELETE FROM skill_staging WHERE id = $2               -- 级联删草稿行
  UPDATE skill SET body_md = ..., description = ..., name = ..., category_code = ...,
                   revision = revision + 1, version = next(version), updated_at = now()
COMMIT
-- 提交后：构建 SKILL.zip；失败只记日志，下载时重建
```

约束：`staging.skill_id` 必须为空或等于目标 Skill；为空表示新建。提交同样校验 100 MiB / 100 个上限。

### 4.4 包的构建

- 无第三方依赖：自写 ZIP 写入器（store 模式 + CRC32），只处理 UTF-8 路径与 `\n` 文本，约 100 行。
- 条目顺序固定：`SKILL.md`、`scripts/**`、`references/**`（同目录按 path 排序）。
- 文件时间戳取 `skill.updated_at`；`scripts/` 下 `.sh/.py/.js` 给 `0755`，其余 `0644`。

## 5 限制与安全

| 项 | 值 | 说明 |
|---|---|---|
| 单文件 | ≤ 20 MiB | DB check + 网关 413 |
| 单 Skill 合计 | ≤ 100 MiB | 提交时累计校验；草稿同样受此约束 |
| 文件数 | ≤ 100 | 草稿与提交后一致 |
| `path` 长度 | ≤ 200 字符 | 含两级根目录 |
| 文件名字符 | 禁止控制字符、`\`、`..`、首尾空白 | 保留 Unicode |
| MIME | 取上传声明，不嗅探 | 原型不执行/不渲染附件 |
| 草稿 TTL | 24 小时 | 过期清理，见 §11 |
| 病毒扫描 / 解压炸弹 | **不做** | 附件由运行时执行，需在执行侧隔离（不属于本轮） |

## 6 前端形态（`agent-flow-ui`）

### 6.1 页面骨架（`pages/skill-detail.html`）

```
skill-detail.html
├─ 顶部：面包屑 · 名称 · 版本 · 更新时间 · [下载 SKILL.zip]
├─ 元数据卡：名称 / 类别 / 标签 / 描述（400 字计数）
├─ 正文区：WYSIWYG 编辑器（工具栏 + H2 大纲）
├─ 附件区：拖拽上传 + scripts/ 与 references/ 两个清单 + 新增/改名/删除
└─ 底部操作：取消 · 保存（元数据 + 正文 + stagingId）
```

- 查看态与编辑态同一页面，编辑器 `editable:false` 即查看态；删除 v2 的「结构化 / 文档」双 Tab。
- 正文工具栏最小集：H1–H3、加粗/斜体/行内代码、链接、图片（选附件）、有序/无序/任务列表、引用、代码块（Prism 高亮）、表格、分割线、撤销/重做。
- 图片：工具栏从 `references/` 选已有附件插入；粘贴/拖拽图片自动上传到草稿并插入相对路径（S4）。
- 脏状态 = 元数据 + 正文 + 草稿文件是否有变化；有变化时离开页面需确认，取消时 `DELETE /skill-staging/{id}`。
- 上传失败逐文件展示并可重试；上传中允许继续编辑，保存按钮提示「N 个文件上传中」。

### 6.2 文件区状态

| 状态 | 来源 | 展示 |
|---|---|---|
| 已提交 | `GET /skills/{id}` 的 `files` | 只读态可见；编辑态作为草稿初始内容 |
| 草稿新增 | 上传后 | 标记「新增」，可移除 |
| 草稿删除 | 编辑态移除 | 标记「待删除」，保存后生效 |
| 重命名 | 草稿 PATCH | 保存后生效 |

- 编辑开始即建草稿（快照现有文件），因此"删除"只是从草稿移除，不触碰已提交数据。
- 保存成功后用响应 DTO 刷新页面并丢弃草稿；保存失败保留草稿，允许重试。

### 6.3 组件与文件落点

| 文件 | 变化 |
|---|---|
| `pages/skill-detail.html` + `assets/js/pages/skill-detail.js` | 重写为三区 + 草稿生命周期 |
| `assets/js/pages/skill-common.js` | 删除 `SECTIONS`；新增正文模板、文件大小格式化 |
| `assets/js/pages/skill-detail-markdown.js` | 改为编辑器适配层：`mount(el, md, {editable})` / `getMarkdown()` / `setMarkdown()` / `onChange()` |
| `assets/js/api.js` | 新增 staging、上传（`FormData`）、`packageUrl` |
| `tools/fake-b1.js` | v3 DTO + 草稿 + 文档 + 包（内存） |
| `bff/index.js` | 见 6.4 |
| `assets/vendor/` | 单个 7.7.0 编辑器包（替换 `DEP-0001`） |

### 6.4 BFF 必须先改（否则附件传不上去）

`bff/index.js` 当前把请求体整体缓冲并限制 1 MiB（`BFF_MAX_BODY` 默认 `1024*1024`，[bff/index.js:15](../../../bff/index.js#L15)），20 MiB 的上传会直接 413。

- 方案 A（最小改动）：把默认上限提到 32 MiB，并为上传路径放宽 `BFF_TIMEOUT_MS`。
- 方案 B（推荐）：`multipart/form-data` 走流式转发（不缓冲），其余请求维持缓冲 + 1 MiB。
- 两种都要补 BFF 单测（超限、流式透传、上游失败）。

## 7 编辑器选型

统一到 **Milkdown 7.7.0**：只读渲染与编辑共用一个包，仓外构建、提交入口源码与命令，`package.json` 保持空。最小集实测 **177.3 KiB gzip**（7.7.0，正好是目标版本）。详见 [`editor-reuse.md`](editor-reuse.md)。

## 8 影响面

### 8.1 B1（`agent-flow-orchaster`）

| 位置 | 改动 |
|---|---|
| `db/migrations/0006_skill_package.sql` | 加 `body_md`、删三张子表、建文件与草稿表（无回填） |
| `src/components/skill/types.ts` | `SkillSections`/`SkillRefInput` → `body`；新增 `SkillFileMeta`、草稿类型 |
| `src/components/skill/service.ts` | 规范化、`composeDocument`（frontmatter + body）、草稿/提交/打包用例 |
| `src/components/skill/store.ts` | 根表读写、`replaceChildren` 只剩 tags、文件与草稿 CRUD |
| `src/components/skill/package.ts` | ZIP 写入器 + 包构建（新增） |
| `src/components/catalog/index.ts` | `SkillDetailView` 换 `body` + `files` |
| `src/components/http-gateway/app.ts` | multipart、草稿路由、下载路由、错误码 |
| `src/components/http-gateway/openapi.yaml` | 全部 Skill schema 与路径 |
| `src/core/platform/` + `config/` | `BlobStore` 端口、FS 适配器、`[storage] root`、GC |
| `tests/` | 契约测试、草稿/提交/打包用例、GC 用例 |

### 8.2 UI（本仓库）

| 位置 | 改动 |
|---|---|
| `docs/design/components/skills/spec.md` | 模块卡、公开契约、不变量重写 |
| `docs/design/architecture.md` | `CMP-skills` 一句职责与依赖 |
| `docs/design/dependencies.md` | `DEP-0001` 降到 7.7.0、体积重测、构建说明 |
| `docs/design/scenarios/assets/skill-library/**` | `SCN-0005`/`0013`/`0014`/`0015` 断言重写；新增草稿/打包场景 |
| `tools/verify-m1-scenarios.js`、`tools/verify-skill-page-*.js`、`tools/verify-b1-*.js` | 断言与夹具 |
| `docs/requirements/REQ-0013/0014` | 被 v3 取代（`superseded`），并新建本需求的需求卡与场景卡 |
| `README.md`、`docs/design/product.md`、`docs/plan/roadmap.md` | 页面能力与里程碑 |

### 8.3 兼容性承诺

- BFF 仍是透明转发，不做 DTO 映射。
- 专家、工作流、实例、看板四类资产/页面不受影响。
- Skill 列表、筛选、启停、删除、引用保护语义不变。

## 9 分期

| 期 | 内容 | 依赖 | 可独立验收 |
|---|---|---|---|
| S1 | B1 v3 基线：结构变更 + `body` + DTO/写请求 + `/document`；前端先用纯 textarea 编辑正文 | 契约确认 | 是 |
| S2 | 草稿与包：staging 表/API + 提交事务 + ZIP + `GET /package`；前端文件区 | S1 + BFF 改造 | 是 |
| S3 | 编辑器：7.7.0 单包构建、准入、适配层接入，查看/编辑共用 | S1 | 是 |
| S4 | 粘贴图片转附件、H2 大纲、包导入（`.zip` → 新 Skill） | S2/S3 | 是 |

## 10 定级与确认门

**P1**：核心契约、核心 schema、数据所有权（新增附件与草稿子表、BlobStore）、新增 HTTP 面与存储适配器。

已确认（2026-10-28）：不迁移旧数据；编辑器统一 7.7.0、单包维护；依赖体积为观测阈值（见 §0 第 9 条）；草稿为**快照 + 整体替换**；`scripts/` 下 `.sh/.py/.js` 在 zip 内为 `0755`；三条实现细节按默认值收口——包在保存时构建并缓存（失败则下载时重建）、草稿 TTL 24 小时（启动 + 每小时清理）、删除 Skill 后孤儿 blob 交给 GC。

人工门：

1. 本提案确认（字段与 API 冻结）；
2. 编辑器包与构建入口确认（见 `editor-reuse.md`）；
3. 建表脚本评审后才执行。

## 11 未决问题（已收口）

无待定项。原三条实现细节按默认值落地：

| 项 | 决定 |
|---|---|
| 包生成时机 | 保存时构建并缓存；失败不阻塞保存，下载时重建 |
| 草稿 TTL | 24 小时；启动时 + 每小时扫描过期草稿 |
| 孤儿 blob | 行级联删除；blob 由 GC 按引用集合回收 |
