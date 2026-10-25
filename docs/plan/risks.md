---
layer: plan
module: global
status: current
updated: 2026-10-25
---

# 风险与缓解

| # | 风险 | 影响 | 缓解 | 状态 |
|---|---|---|---|---|
| R1 | WebKit 构建的 html 级 zoom 探测失效，视觉缩放恒走 transform 兜底 | 位置断言在真实 Safari 与测试引擎可能分叉 | 引擎层覆盖最大字号路径（T2）+ 人工 Safari 确认；坐标按 `zoomK` 归一 | 存续 |
| R2 | 固定定位弹层遇 z-index / transform 被遮挡 | 菜单可点但不可见，或命中落到下层 | 场景断言「元素中心点命中自身」（T2）；新弹层复用 `DF.menu` | 存续 |
| R3 | 验证脚本依赖 `/tmp` 下的 Playwright 绝对路径，临时目录清理后不可重跑 | 迁移与回归无法取证 | 脚本改为 `PLAYWRIGHT_MODULE`/`NODE_PATH` 解析，安装与运行命令写进 `design/dev-environment.md` 3.2；2026-10-23 用 Playwright 1.49.1 + WebKit 2104 复跑 45/45 | 已缓解 |
| R4 | 静态原型无后端，登出/权限只有前端反馈 | 误判为真实能力 | 需求卡「非目标」写明；Toast 文案标注「原型演示」 | 接受 |
| R5 | OQ-1~OQ-6 长期未裁定 | 后续页面返工、规格与实现分叉 | M3 逐条裁定并转 REQ；裁定前相关页面冻结 | 开放 |
| R6 | 原型按桌面视口设计，未做移动适配 | 移动端不作为验收面 | 需求约束写明「桌面优先」；移动端另立需求再评估 | 接受 |
| R7 | M1 的 10 个页面组件曾无 REQ/SCN 追溯，只有 jsdom 冒烟 | 验收链薄弱，改行为时无业务回归基线 | 2026-10-23 已补 `REQ-0002..0011` + `SCN-0002..0011`；组件 frontmatter 反查，`check-docs` 强制可解析；场景已验证，R10 关闭 | 已关闭 |
| R8 | `MOCK` 为原型夹具，`workflows` 有两个页面写入口，其余集合单写但都只改内存，刷新复位 | 误当真实数据层；接后端时数据权属需重切 | 架构文档明确多写入口与复位；组件卡登记读/写；接后端时按数据服务重切，不沿用 MOCK 权属 | 接受 |
| R9 | SCN-0001 的 Safari 人工走查未完成，engine 层只覆盖 WebKit 构建 2104 的 transform 兜底路径 | 真实 Safari 的 zoom 路径仍可能分叉 | 登记为发布门禁；`REQ-0001` 交付不依赖人工项，但 Safari 验证完成前不宣称浏览器全兼容 | 开放 |
| R10 | M1 十页场景曾只到 `designed`，3 正 1 反测试尚未落地 | 追溯链完整但验收未闭环，REQ 不能转 delivered | 已补 `tools/verify-m1-scenarios.js`，10 场景 × 3 正 1 反 40/40 通过；SCN 转 `verified`、REQ 转 `delivered` | 已关闭 |
| R11 | B1 后端本地工作区仍显示未提交（HEAD `3171154`，工作区有修改），联调基线未冻结 | 无法回溯联调用的是哪版后端，验收证据不可复现 | 联调前补 commit hash；若在外部 worktree 提交，登记路径与 hash；BFF 只锁 API 契约，不锁后端源码 | 开放 |
