---
layer: design
module: bff
status: verified
flow: b1-integration
scenario: SCN-0012
updated: 2026-10-26
---

# SCN-0012 B1 资产同源接入与四类资产读写

## 入口

- `CMP-bff/bff/index.js#handle`（同源转发）
- `CMP-harnesses/pages/harnesses.html`
- `CMP-tools/pages/tools.html`
- `CMP-skills/pages/skills.html`
- `CMP-experts/pages/experts.html`

## 运行序

1. 浏览器在 `127.0.0.1:3000` 打开四个资产页，页面通过相对路径 `/api/v1/*` 发起请求。
2. `CMP-bff` 将 `/api/v1/*` 与 `/healthz` 透明转发到 `API_BASE`（默认 `http://127.0.0.1:3100`），不改写路径、字段、状态码与错误体。
3. 列表页直接消费 B1 DTO：Harness 的 `kind/accessMode/concurrencyMax/queuePolicy`、Tool 的 `kind/params/usedByCount`、Skill 的 `categoryCode/description/version/refs[].refType`、Expert 的 `skillCount/toolCount/refCount` 与前 3 个 `skills` 预览；详情按需 `GET`。
4. 写操作携带 `If-Match`：创建走 `POST`，资产编辑走 `PUT`/`PATCH`，专家聚合保存走 `PATCH /experts/{id}` 一次提交五区、引用与有序 `skillIds`/`toolIds`。
5. `409` 冲突在页面提示刷新，不自动覆盖；`400` 字段错误回到对应表单；后端不可用显示连接错误，不落假数据。B1 没有的运行时能力（Harness 任务/心跳历史、Tool 调试、引用方明细、Skill 版本历史）显示「B1 未提供」，不本地模拟。
6. Skill 详情可切换「全文」：`GET /skills/{id}/document` 经 BFF 原样返回 Markdown 与 `ETag`；重复请求带 `If-None-Match`，304 由 API 层复用上次文本。
7. 其余 8 页继续读 MOCK，共用外壳的「演示环境」标识。

失败路径：后端未启动返回 `502`；超时返回 `504`；请求体超限返回 `413`；非白名单路径不由 BFF 转发；旧 revision 返回 `409`；任何失败不得写入半套专家装配。

## 不可变引用

- BFF 只转发 `/api/v1/*` 与精确 `/healthz`，不代理 `/docs`、`/openapi.yaml`。
- 浏览器看到的 DTO 与 B1 OpenAPI 一致：`kind/accessMode/concurrencyMax/queuePolicy`、`params[].key`、`categoryCode`、`description`、`refs[].refType`、`skillIds/toolIds`。
- 写操作必须带 `If-Match`；专家聚合 `PATCH` 的数组字段整体替换，空数组清空。
- BFF 请求头白名单含 `If-None-Match`，响应头含 `ETag`；304 必须透传，不得被 BFF 改成 200 或缓存。
- `CMP-bff` 不缓存、不重试、不映射、不聚合；`server.js` 只做组合根，不承载业务逻辑。

## 测试

执行层：Node HTTP（BFF stub 上游）+ DOM（jsdom，fake B1）+ 真实 B1 页面读写。可执行脚本：`npm run test:bff`、`npm run test:scenarios`、`npm run test:b1-pages`、`npm run test:b1-writes`。最近一次执行：2026-10-26，BFF 10/10、M1 46/46、四页真实读取 4/4、四页真实写入 4/4。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0012-T1 | 正 | 经 3000 访问 `/healthz` 与 `/api/v1/skills` 返回后端数据；无 CORS 响应头；静态页面不受影响 | `tests/bff/bff.test.js` |
| SCN-0012-T2 | 正 | 四类资产创建经页面生效；更新/启停/删除经 BFF 带 `If-Match` 生效；专家聚合 PATCH 一次请求、一次 revision、无半写 | `tools/verify-b1-writes.js` |
| SCN-0012-T3 | 正 | 写操作带 `If-Match`；BFF 原样透传 409；页面冲突提示刷新；字段错误落回表单 | `tests/bff/bff.test.js`、`tools/verify-m1-scenarios.js` |
| SCN-0012-T4 | 反 | 后端不可用返回 502、超时 504、超大 body 413；非白名单路径不转发；失败不产生假成功或半套写入 | `tests/bff/bff.test.js` |
| SCN-0012-T5 | 正 | 文档端点经 BFF 返回 `text/markdown` 与 `ETag`；带 `If-None-Match` 返回 304 空体，BFF 不改写 | `tests/bff/bff.test.js` |
