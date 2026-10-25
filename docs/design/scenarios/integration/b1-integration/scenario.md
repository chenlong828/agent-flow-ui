---
layer: design
module: bff
status: designed
flow: b1-integration
scenario: SCN-0012
updated: 2026-10-25
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
3. 列表页使用 API DTO 渲染：Skill 的 `triggers`、Tool 的 `description`、Expert 的最多 3 个 `skills` 预览；详情抽屉按需 `GET`。
4. 写操作携带 `If-Match`：创建走 `POST`，资产编辑走 `PUT`/`PATCH`，专家聚合保存走 `PATCH /experts/{id}` 一次提交五区、引用与有序 `skillIds`/`toolIds`。
5. `409` 冲突在页面提示刷新，不自动覆盖；`400` 字段错误回到对应表单；后端不可用显示连接错误，不落假数据。
6. 其余 8 页继续读 MOCK，并在页面或规格中标注“演示数据，未接后端”。

失败路径：后端未启动返回 `502`；超时返回 `504`；请求体超限返回 `413`；非白名单路径不由 BFF 转发；旧 revision 返回 `409`；任何失败不得写入半套专家装配。

## 不可变引用

- BFF 只转发 `/api/v1/*` 与精确 `/healthz`，不代理 `/docs`、`/openapi.yaml`。
- 浏览器看到的 DTO 与 B1 OpenAPI 一致：`kind/accessMode/concurrencyMax/queuePolicy`、`params[].key`、`categoryCode`、`refs[].refType`、`skillIds/toolIds`。
- 写操作必须带 `If-Match`；专家聚合 `PATCH` 的数组字段整体替换，空数组清空。
- `CMP-bff` 不缓存、不重试、不映射、不聚合；`server.js` 只做组合根，不承载业务逻辑。

## 测试

执行层：Node HTTP（BFF stub 上游）+ 浏览器 DOM/真实后端（四页读写）；可执行脚本 `npm run test:bff` 与后续 `tools/verify-b1-integration.js`。最近一次执行：2026-10-25 `npm run test:bff` 9/9；四页 live 读写待 P3。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0012-T1 | 正 | 经 3000 访问 `/healthz` 与 `/api/v1/skills` 返回后端数据；无 CORS 响应头；静态页面不受影响 | `tests/bff/bff.test.js` |
| SCN-0012-T2 | 正 | 四类资产创建/编辑/启停/删除经 BFF 生效；专家聚合 PATCH 一次请求、一次 revision、无半写 | `tools/verify-b1-integration.js` |
| SCN-0012-T3 | 正 | 写操作带 `If-Match`；旧 revision 返回 409 并提示刷新；字段错误落回表单 | `tools/verify-b1-integration.js` |
| SCN-0012-T4 | 反 | 后端不可用返回 502、超时 504、超大 body 413；非白名单路径不转发；失败不产生假成功或半套写入 | `tests/bff/bff.test.js` |
