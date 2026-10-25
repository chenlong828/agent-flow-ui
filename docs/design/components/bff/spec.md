---
layer: design
module: bff
component: CMP-bff
requirement: REQ-0012
scenario: SCN-0012
status: active
updated: 2026-10-25
---

# 同源 BFF

> 导航：基础设施 / 同源 API 网关　|　形态：Node 组件，挂在静态服务同进程　|　前置：`design/architecture.md`

## 0 模块卡

> 追溯：`REQ-0012` / `SCN-0012`（designed；P1 先落 BFF，四页 live 接入在 P2/P3）。

- 状态：active
- 单元 / 层：基础设施组件 / L0 技术边界
- 业务价值：为浏览器提供同源 B1 API 入口，消除 CORS 与跨源部署差异；它的价值是隔离与部署稳定性，不承载任何业务能力。
- 负责 / 不负责：负责把 `/api/v1/*` 与 `/healthz` 透明转发到 `API_BASE`，透传方法、查询串、请求体、`If-Match`、`X-Actor`、`X-Request-Id`、状态码、错误体与 `Location`；负责超时、body 上限、上游不可用的 JSON 错误。不负责 DTO 映射、枚举翻译、revision 缓存、重试、专家装配、列表富化、鉴权、TLS、模拟数据，也不负责静态页面渲染。
- 数据所有权：无业务数据；不缓存响应、不落库、不保存 revision；上游是唯一数据源。
- 公开契约：`GET|POST|PUT|PATCH|DELETE /api/v1/*` 与 `GET /healthz`；只转发白名单路径；请求/响应原样透传；代理自身错误为 `{error:{code,message,details?}}`，HTTP 502/504/413/405。
- 依赖：仅 Node 内置 `http`/`https`/`crypto`；由 `server.js` 组合根挂载；不得 import `DF`/`MOCK`/页面模块/后端源码。
- 变化轴：`API_BASE`、超时、body 上限；后续若加登录/限流/审计，只加在转发边界，不改 DTO。
- 验证入口：`npm run test:bff`（stub 上游，9/9 通过）；`node bff/standalone.js`；`curl http://127.0.0.1:3000/healthz` 与 `/api/v1/skills`。
- 预算：源码 + 测试约 20 KB；组件上限 120k token，远低于上限。
- 单独运行：`PORT=3001 node bff/standalone.js`（只起 BFF，便于组件验证；生产由 `node server.js` 同进程挂载）。
- 删除测试：删除后浏览器跨源访问 B1 失败，四个资产页无法读写；静态页面仍可用。它的价值是部署隔离，不是业务能力；若后端直接提供同源入口，可整体删除。
- 已知偏差：无鉴权、无 TLS、仅绑定 `127.0.0.1`；不代理 `/docs` 与 `/openapi.yaml`；P1 已落 BFF（9/9 单测），四页仍读 MOCK，P2/P3 切换为 live；不保留演示回退。

## 1 定位与边界

`CMP-bff` 是**技术边界组件**，不是业务薄层。浏览器把 `/api/v1/*` 当作同源 API 使用，BFF 只负责把 HTTP 语义完整送到 B1 后端。任何字段改名、枚举翻译、revision 管理、专家装配都属于浏览器数据层或后端，不属于这里。

```text
浏览器 → /api/v1/*（同源 3000） → CMP-bff → B1 后端（3100）
```

## 2 契约

| 项 | 约定 |
|---|---|
| 路径 | `/api/v1/` 前缀；精确 `/healthz` |
| 方法 | GET / POST / PUT / PATCH / DELETE |
| 请求头 | `Content-Type`、`If-Match`、`X-Actor`、`X-Request-Id` |
| 响应头 | `Content-Type`、`Location`、`X-Request-Id` |
| 状态码 | 后端状态码原样返回 |
| 请求体 | 按字节缓冲，默认上限 1 MiB |
| 超时 | 默认 10s |
| CORS | 不设置；同源即可 |
| 映射 | 无 |

## 3 转发规则

1. 解析 `req.url`，只接受白名单路径；URL 规范化后仍须落在白名单内。
2. 复制允许的请求头；不转发 `host`、`connection`、`cookie`、`origin`、`referer`。
3. 读取请求体并设置 `content-length`；超过上限返回 413。
4. 用 `fetch` 请求 `API_BASE + path + query`，`redirect: "manual"`，带 `AbortController` 超时。
5. 响应体按字节返回；剥离 `content-encoding`、`content-length`、`transfer-encoding` 与 CORS 头，避免浏览器解码错误。
6. 每个请求生成或透传 `X-Request-Id`，日志记录方法、路径、状态与耗时，不记录请求体。

## 4 错误与安全

- 上游不可用：`502 {error:{code:"upstream_unavailable",message:"B1 后端不可用"}}`。
- 超时：`504 {error:{code:"upstream_timeout",message:"B1 后端超时"}}`。
- 请求体超限：`413 {error:{code:"payload_too_large",message:"请求体超过上限"}}`。
- 非白名单路径：`404`；不允许的方法：`405`。
- 只绑定 `127.0.0.1`；无鉴权、无 TLS；不跟随重定向；不把任意 URL 作为代理目标，避免 SSRF。

## 5 验证

- `npm run test:bff`：stub 上游覆盖透传、查询串、`If-Match`、`X-Actor`、409 错误体、502/504/413/405、无 CORS、路径越界。
- 同源冒烟：`node server.js` + `curl :3000/healthz`、`curl :3000/api/v1/skills`；后端停掉后 `curl` 返回 502 JSON。
- 与四页联调由 `SCN-0012` 覆盖；BFF 自身不写业务数据。

## 6 部署与配置

| 变量 | 默认 | 说明 |
|---|---|---|
| `API_BASE` | `http://127.0.0.1:3100` | B1 后端地址，只取 origin |
| `BFF_TIMEOUT_MS` | `10000` | 上游超时 |
| `BFF_MAX_BODY` | `1048576` | 请求体上限（字节） |
| `PORT` | `3000` | 静态 + BFF 同端口 |
| `HOST` | `127.0.0.1` | 仅本机 |
