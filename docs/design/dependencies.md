---
layer: design
module: global
status: current
updated: 2026-10-28
---

# 第三方运行时依赖准入

> 本清单是「运行时依赖」的唯一数据源：规则 + 已登记依赖。门禁 `tools/check-deps.js` 读取本文末尾的 JSON 块并扫描源码；`tools/check-docs.js` 校验 `DEP-xxxx` 引用可解析。
>
> 并入 `architecture.md` 会让架构文档随每次准入频繁改版；清单需要独立机读数据源与独立更新频率，故单独成文（`module: global`）。

## 1 基线

- **默认零运行时依赖**：页面与 `bff/` 不得出现任何未登记的第三方运行时依赖。
- 例外必须走本清单的准入程序，登记为 `DEP-xxxx` 后才能存在。
- 本基线变更自 2026-10-26 起生效；历史决策见 `history/decisions/2026-10-26-dependency-admission.md`。

## 2 三条红线（不随准入放开）

1. **工具链零外部包**：`tools/*`、`tests/bff/*`、`server.js`、`bff/*` 保持零第三方依赖；门禁脚本自身不得依赖 npm 包。
2. **服务端零第三方依赖**：`server.js` 与 `bff/` 不吃准入；Node 侧只用内置模块。
3. **禁止运行时外链**：页面与 CSS 不得引用 CDN / 远程 URL；依赖必须自托管落仓。

## 3 引入形态（方案 A：自托管 vendor + 保持零构建）

- 唯一允许形态：单文件 ESM / UMD 构建产物，落 `assets/vendor/<name>/<version>/<file>`。
- 版本精确钉住（`1.2.3`，禁止 `^` / `~` / `latest`）；登记 SHA-256。
- 页面用本地 `<script>` 或 ESM 引用；`package.json` 的 `dependencies` / `devDependencies` 保持为空。
- 确需构建链（npm 包 + bundler）的组件不在此形态内，必须另案 P1 决策，由本清单登记 `form: build` 的例外（当前为 0 条）。

## 4 准入程序

### 4.1 触发

- 新增浏览器运行时依赖；
- 替换已有依赖；
- major / minor 升级。
- patch 升级不触发审批，但必须同步更新清单版本号与 SHA-256（P3，登记即可）。

### 4.2 申请材料（8 项，缺一不受理）

1. 用途与页面范围（哪个 `CMP-*`、哪些页面）；
2. 手写成本对比（为什么不能复用 `DF.*` 或手写）；
3. 候选与选定版本 + 来源仓库 + 许可证；
4. 实测体积（min+gz）；
5. 维护活跃度与已知 CVE 情况；
6. 交付形态：vendor 单文件 ESM/UMD；
7. 影响面：受影响页面、初始加载增量；
8. 回退/移除方案（删文件 + 摘清单 + 改引用）。

### 4.3 准入判据（体积为观测项）

- 许可证 ∈ { MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC }；GPL / AGPL / 商业限制许可默认拒绝。
- 版本精确钉住 + SHA-256 登记；无未修复的高危 CVE。
- 不改变页面路由、不引入构建步骤、不引入远程字体/图标 CDN。
- 体积只观测、不阻断：单依赖 **500 KiB**、任一页面首屏脚本增量 **120 KiB**、全站新增总量 **300 KiB** 是警告阈值（2026-10-28 起不再作为硬门限）。实测值必须写入 `gzipKb`，且不得大于登记值；超阈值只打印 WARN，按「节约优先」自行取舍。

### 4.4 审批与分级

| 动作 | 级别 | 门 |
|---|---|---|
| 新增依赖 / 替换 / major·minor 升级 | P2 | **用户签字**后才登记与落文件 |
| patch 升级 | P3 | 登记 + 跑门禁，不需签字 |
| 引入构建链（npm + bundler） | P1 | 另案评审，本清单只登记结果 |

### 4.5 登记与移除

- 登记：`DEP-xxxx` 写入本文第 6 节 JSON 块 → 落 `assets/vendor/` → 模块卡「依赖」字段引用 `DEP-xxxx` → 有供应链风险时在 `plan/risks.md` 登记。
- 移除：同一门（P2），删文件、摘清单、改引用、跑门禁。

## 5 预算与门禁

- 观测阈值见 4.3；`check-deps.js` 校验实测 gzip 不超过登记值，并在超过 500/120/300 KiB 时打印 WARN，不作为失败。
- 门禁清单：
  - 页面 HTML 的 `<script src>` / `<link href>` / 内联 `url()` 出现 `http(s)://` 或 `//` → 失败；
  - `assets/vendor/**` 下存在未登记文件 → 失败；
  - `assets/js/**` 出现裸模块名（非相对路径）→ 失败；
  - `bff/**` require 非 Node 内置 / 非相对路径 → 失败；
  - `package.json` 出现 `dependencies` / `devDependencies` 条目 → 失败；
  - 登记文件缺失、SHA-256 不符、实测 gzip 大于登记值 → 失败；
  - `DEP-xxxx` 引用解析不到 → 失败。

## 6 已登记依赖（机读）

> `check-deps.js` 读取此 JSON 块；当前已登记 1 条第三方运行时依赖（`DEP-0001`）。

```json
{
  "deps": [
    {
      "id": "DEP-0001",
      "name": "milkdown",
      "version": "7.7.0",
      "license": "MIT",
      "path": "assets/vendor/milkdown/7.7.0/skill-editor.esm.js",
      "sha256": "15e36e16020b881e1137e1227a2ea6a512f58bddea74e29409750d209f40186a",
      "gzipKb": 177.6,
      "pages": [],
      "note": "Milkdown 只在 Skill 专门页按需动态加载，查看态与编辑态共用"
    }
  ]
}
```
