---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 决策：技能体系升级到 af-dev 五技能 / 五态

## 背景与复核

原体系是 `feature-lifecycle`（六阶段）+ 四态文档（design/plan/works/history）。与 `~/skills/af-dev-skill` 的五技能/五态逐条比对后，8 条候选结论的处理是：

- 4 条重复：可验收口径、双轨收口、新坑登记、否决裁定——af-dev 已有等价规则，不重复并入；
- 1 条过时：`部分完成续号`——af-dev 用 REQ/SCN/任务表表达，不再需要；
- 2 条合并为 1 条（D1）：`brief 引 REQ` + `一个 REQ 只挂一个在飞工序` + `开工=建目录+写 brief`；
- 1 条部分采纳（D2）：场景测试计划必须声明执行层；DOM 不能证明遮挡/定位/命中；人工未完成不得标 `verified`；
- 2 条一致性修正：D3 给 `design/` 全局主题文档留 status 值域；D4 修正 arch-design-spec 的组件路径笔误。

净增规则 2 条（D1、D2）+ 一致性修正 2 条（D3、D4）。

## 决策

1. 技能层采用 af-dev 五技能：`req-scenario-spec`、`arch-design-spec`、`design-before-coding`、`dev-execution-spec`、`doc-layout-spec`；退役 `feature-lifecycle`。
2. 文档树从四态迁到五态：`requirements/ plan/ design/ works/ history/`；组件规格落 `design/components/<slug>/spec.md`，场景落 `design/scenarios/<domain>/<flow>/<scenario>/scenario.md`。
3. 复核净增规则并入技能源与项目副本：D1 进 `req-scenario-spec`，D2 进 `dev-execution-spec`，D3 进 `doc-layout-spec`，D4 进 `arch-design-spec`。
4. 已收口的两个工序（2026-10-13-user-menu、2026-10-14-patent-disclosure）归档到 `history/works/`；场景测试脚本入库为 `tools/verify-user-menu.js`。
5. 组件目录用 `<slug>` 而非 `CMP-0001` 编号；场景路径采用 `shell/topbar/user-menu`，与现有页面结构一致。

## 落地结果

- 项目副本：5 个技能已部署，`feature-lifecycle` 已移除；技能目录在会话内实时切换。
- 文档树：11 个组件、1 张需求卡（REQ-0001）、1 个场景（SCN-0001）、3 份 plan 文档、2 个归档工序。
- 工具：`tools/check-docs.js`（零依赖五态检查）、`tools/smoke-test.js`、`tools/verify-user-menu.js`；`npm run check:docs`。
- 验证：`check-docs` PASS；jsdom 12/12 页；Playwright WebKit 45/45 断言。

## 边界：源目录暂不同步

按用户 2026-10-23 的决定，`~/skills/af-dev-skill` 保持 v0.1，不与项目副本 v0.2 同步。因此源与项目副本存在已知差异：D1–D4 与 v0.2 README 只在项目副本中。

- 项目副本的 5 个技能是完整可用的，路径 `.agents/skills/`；
- 同步包暂存在 `/tmp/afdev-migration/af-dev-skill-v0.2/`（临时目录，可能被清理）；
- 若日后要同步，先备份源目录，再把 `.agents/skills/` 的 5 个技能目录与 v0.2 README 复制过去；源 v0.1 的备份在 `/tmp/afdev-migration/source-v0.1-backup/`（同样是临时目录）。
- 本条不影响项目自身运行；只影响“从源目录初始化下一个项目”时拿到的是旧规则。

## 回滚

- 项目：`git checkout backup/pre-afdev -- .`，并清理迁移新增的未跟踪文件；回滚分支 `backup/pre-afdev` 指向 `7aab501`。
- 文档：迁移前的四态树在该分支完整保留。
- 源：本次未改动，无需回滚。

## 证据

- 预演：`/tmp/afdev-migration/migrate.py --sim` 在副本上完整执行并通过检查，再 `--apply` 落盘。
- 一致性：`npm run check:docs` → `components: 11 | requirements: 1 | scenarios: 1`，PASS。
- 结构层：`node tools/smoke-test.js` → 12/12。
- 引擎层：`node tools/verify-user-menu.js` → 45 通过 / 0 失败（2026-10-23 复跑）。
- 技能目录：本会话技能目录已切换为上述 5 个，`feature-lifecycle` 不再出现。
