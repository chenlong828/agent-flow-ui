---
layer: plan
module: global
status: current
updated: 2026-10-30
---

# 风险与缓解

| # | 风险 | 影响 | 缓解 | 状态 |
|---|---|---|---|---|
| R1 | WebKit 构建的 html 级 zoom 探测失效，视觉缩放恒走 transform 兜底 | 位置断言在真实 Safari 与测试引擎可能分叉 | 引擎层覆盖最大字号路径（T2）+ 人工 Safari 确认；坐标按 `zoomK` 归一 | 存续 |
| R2 | 固定定位弹层遇 z-index / transform 被遮挡 | 菜单可点但不可见，或命中落到下层 | 场景断言「元素中心点命中自身」（T2）；新弹层复用 `DF.menu` | 存续 |
| R3 | 验证脚本依赖 `/tmp` 下的 Playwright 绝对路径，临时目录清理后不可重跑 | 迁移与回归无法取证 | 脚本用 `PLAYWRIGHT_MODULE` 指向 `~/.cache/playwright-libs/<version>`，浏览器放 `~/Library/Caches/ms-playwright`（不再受 `/tmp` 3 天清理影响）；安装与运行命令见 `design/dev-environment.md` §3.2；2026-10-29 实测引擎 45/45 + 29/29 | 已缓解 |
| R4 | 静态原型无后端，登出/权限只有前端反馈 | 误判为真实能力 | 需求卡「非目标」写明；Toast 文案标注「原型演示」 | 接受 |
| R5 | OQ-1~OQ-6 长期未裁定 | 后续页面返工、规格与实现分叉 | M3 逐条裁定并转 REQ；裁定前相关页面冻结 | 开放 |
| R6 | 原型按桌面视口设计，未做移动适配 | 移动端不作为验收面 | 需求约束写明「桌面优先」；移动端另立需求再评估 | 接受 |
| R7 | M1 的 10 个页面组件曾无 REQ/SCN 追溯，只有 jsdom 冒烟 | 验收链薄弱，改行为时无业务回归基线 | 2026-10-23 已补 `REQ-0002..0011` + M1 场景；组件 frontmatter 反查，`check-docs` 强制可解析；场景已验证，R10 关闭 | 已关闭 |
| R8 | `MOCK` 仍服务实例/效能/工作区/Key 等页面；工作流两页已切 B3，其余 MOCK 集合单写且只改内存，刷新复位 | 误把 B2–B4 演示数据当真实数据 | 架构文档明确 MOCK 只服务非 live 页；B1 四页与 B3 工作流两页已 live-only；组件卡登记读/写 | 接受 |
| R9 | SCN-0001 的 Safari 人工走查未完成，engine 层只覆盖 WebKit 构建 2104 的 transform 兜底路径 | 真实 Safari 的 zoom 路径仍可能分叉 | 登记为发布门禁；`REQ-0001` 交付不依赖人工项，但 Safari 验证完成前不宣称浏览器全兼容 | 开放 |
| R10 | M1 十页场景曾只到 `designed`，3 正 1 反测试尚未落地 | 追溯链完整但验收未闭环，REQ 不能转 delivered | 已补 `tools/verify-m1-scenarios.js`，10 场景 × 3 正 1 反 40/40 通过；SCN 转 `verified`、REQ 转 `delivered` | 已关闭 |
| R11 | B1 后端联调基线曾未登记，无法回溯用的是哪版后端 | 验收证据不可复现 | 2026-10-25 已确认代码提交：`b38fffc`（专家聚合写）、`ef376de`（列表读模型）；199 tests / 0 fail / 1953 expect，typecheck 通过；仅 `docs/playbook` 未提交，不影响 API。联调以 `ef376de` 为基线 | 已缓解 |
| R12 | B1 不可用时四个资产页直接报错，不回落 MOCK | 本地演示需同时启动 B1 与 BFF | 需求卡明确 live-only；页面提供错误态/重试；`verify-b1-pages` / `verify-b1-writes` 作为联调门禁 | 接受 |
| R13 | M1 四页使用内存 fake B1，可能掩盖真实契约漂移 | 页面测试通过但真实 DTO 不匹配 | 增加 `tools/verify-b1-pages.js` 与 `tools/verify-b1-writes.js`，按真实 B1 验证读写 | 已缓解 |
| R14 | 第三方运行时依赖引入后带来许可/体积/维护/CVE 风险 | 页面性能、合规与供应链安全 | 准入程序 + `design/dependencies.md` 清单 + `tools/check-deps.js` 门禁（哈希/体积/外链）；patch 升级只登记，其余需用户签字 | 接受 |
| R15 | 全站 ESM 迁移横跨 13 页 + Node 侧，迁移量可能超过工作流两页本身 | 交付延期、迁移中途双范式并存、页面白屏 | 单独立项、分批迁移、每批门禁全绿；工作流功能在迁移完成后开工；见 `history/works/2026-10-30-frontend-esm/` | 已关闭 |
| R16 | 工作流只接受合法图、无草稿态；编辑到一半关闭会丢 | 大图编辑中断即丢工作，用户误以为已保存 | 明确未保存标识 + 离开确认；不做 localStorage 草稿（已确认）；需求非目标写明；后续如需草稿另立契约 | 接受 |
| R17 | jsdom 场景迁移到 Playwright 时，断言从“读内部状态”改为“看 DOM/网络”，可能丢覆盖 | 迁移后场景变绿但业务回归未被覆盖 | 逐场景对照原断言重写；纯逻辑下沉 `node --test`；新增工作流场景按 3 正 1 反；门禁保留 `check:scenario-trace`；2026-10-30 全量 49/49，迁移中发现并修复新建工作流跨页丢失 | 已缓解 |
| R18 | 后端 `updatedBy` 恒为 `local`（workflow service 未使用 `X-Actor`） | 列表/详情展示“最后更新人”会误导 | UI 暂不展示更新人；记录为后端 P2 修复项；修复前不把它当审计依据 | 开放 |
