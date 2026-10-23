---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 收口：M1 十页场景 3 正 1 反验证与交付

## 结论

上一工序留下 R10：10 个 M1 场景只到 `designed`，3 正 1 反未落地。本工序补齐 `tools/verify-m1-scenarios.js`，以 DOM/jsdom 覆盖 `SCN-0002..0011` 各 3 正 1 反，**40/40 通过**；据此把 10 个场景转 `verified`、10 张 REQ 转 `delivered`，并把「delivered 需求的场景必须 verified」写进 `check-docs` 门禁。R7/R10 关闭。

页面行为层面只修了两处与场景契约不一致的展示/导出缺口（DSL 补工作流 `id`、专家详情补「角色定位」），未改组件边界、数据所有权或依赖；`MOCK` 仍是内存夹具。

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| 10 场景 × 3 正 1 反 | 通过 | `node tools/verify-m1-scenarios.js`：40 passed / 0 failed |
| 业务数据同源 | 通过 | 各 T1/T2 断言 `MOCK` 计数、筛选子集、Tab 分组、轨迹状态计数 |
| 状态迁移 | 通过 | 实例暂停→恢复、批准→运行中；工作区三步→`df-new-workspace`；Key 校验→有效；工具调试→可用 |
| 失败/取消路径 | 通过 | 删除取消、非法 URL/必填缺失、重名/max=0、运行中删除禁用、驳回空意见、12 周禁用 |
| REQ/SCN 状态 | 通过 | 10 `SCN-*` verified；10 `REQ-*` delivered；场景索引 11 个全部 verified |
| 设计层交叉引用 | 通过 | `check-docs`：components 11 / requirements 11 / scenarios 11，PASS |
| 文档门禁 | 通过 | `npm test`：syntax + 五态 + 索引无 diff |
| 结构冒烟 | 通过 | `npm run test:smoke`：12/12 页面 |
| 展示/导出缺口 | 通过 | 编辑器 DSL 含 `"id"`；专家详情显示角色定位 |

## 场景结果

| SCN | 标题 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| `SCN-0002` | 工作流列表浏览与生命周期入口 | 卡片/统计同源 | 筛选/空态 | 新建+复制 | 删除引用取消 |
| `SCN-0003` | 工作流画布编辑与校验 | 未知 id 回落/节点连线 | 节点抽屉/改名同步 | 校验通过/DSL | 缺回退+缺专家/发布拒绝 |
| `SCN-0004` | 实例监控与运行控制 | Tab 计数 | INS-2041 轨迹状态 | 暂停恢复/批准 | 驳回空意见/已终止无恢复 |
| `SCN-0005` | Skill 维护与渐进披露 | 计数/分类 | 五章折叠 | 编辑版本/新建 | 被引用禁止删除 |
| `SCN-0006` | 专家注册与组合配置 | 卡片/搜索 | 五区/引用数 | 新建/编辑/停用 | 取消停用 |
| `SCN-0007` | Harness 注册与健康治理 | 健康计数 | 注册/重名/max=0 | 停用/删除空闲 | 运行中删除禁用/取消停用 |
| `SCN-0008` | 工具注册、调试与引用治理 | 类型/状态/关键词 | 注册/调试成功 | 引用方计数 | 删除禁用/失败不转可用 |
| `SCN-0009` | 效能看板只读回看 | KPI/阶段/审计 | 4↔8 周数据点 | 分页/顺序 | 12 周禁用/不写 MOCK |
| `SCN-0010` | 工作区创建、配置与归档 | 列表/Key/引用保护 | 缺名称/非法 URL | 三步/归档 | 被引用禁止删除/取消不写 |
| `SCN-0011` | 个人 Key 登记、校验与绑定 | 掩码末 4 位 | git 登记/表单互斥 | 校验/绑定写回 | 必填缺失/取消删除 |

## 变更清单

| 变更 | 落点 |
|---|---|
| 新 runner（40 条，内置静态 HTTP） | `tools/verify-m1-scenarios.js` |
| npm 入口 | `package.json` `test:scenarios` |
| DSL payload 补 `id` | `assets/js/pages/workflow-editor.js` |
| 专家详情补「角色定位」 | `assets/js/pages/experts.js` |
| 门禁：verified 场景 3+1/无待补/有执行记录；delivered REQ 的场景必须 verified | `tools/check-docs.js` |
| 10 场景测试表 + 状态 + 执行记录 | `docs/design/scenarios/**/scenario.md` |
| 10 REQ 转 delivered | `docs/requirements/REQ-0002..0011-*.md` |
| 10 组件卡验证入口/已知偏差/预算 | `docs/design/components/*/spec.md` |
| 验证矩阵、路线图、风险 | `docs/design/architecture.md`、`docs/plan/roadmap.md`、`docs/plan/risks.md` |
| 运行说明 | `README.md`、`docs/design/dev-environment.md` |

## 测试口径

- 不用 `file://` 加载页面：`sessionStorage` 在 jsdom 的不透明源下不可用，工作区场景会误报。runner 在 `127.0.0.1:0` 起临时静态服务，页面脚本、CSS、字体均走 HTTP，测试结束 `server.close()`。
- 每个测试独立 `JSDOM`，`MOCK` 不跨用例污染；跨页动作（暂停→恢复、批准、归档）在单条测试内显式二次加载。
- 断言取业务值或夹具推导值，不做「元素存在即通过」；负例断言集合长度、状态不变或按钮 disabled。
- `check-docs` 新增两类硬门禁：
  1. `verified` 场景必须至少 3 正 1 反、无 `待补`、含 `最近一次执行：`；
  2. `delivered` REQ 引用的每个场景必须是 `verified`。

## 残余与边界

1. **引擎层拖拽/坐标**：jsdom 不实现真实布局与遮挡；画布拖拽、回退边拖拽、缩放坐标仍只由 `SCN-0001` 的 Playwright 引擎用例与 Safari 人工门禁覆盖（R1/R2/R9）。
2. **真实后端/执行**：`MOCK` 内存夹具、刷新复位；暂停/批准/校验/归档均为前端模拟，不代表真实调度或鉴权。
3. **工作区持久化**：新建工作区写 `sessionStorage` 的 `df-new-workspace`，不是 `MOCK.workspaces`；列表/详情下次加载由 `WSC` 合并，刷新/新会话丢失。场景卡已按此口径修正。
4. **Safari 人工走查**：未完成，仍是发布确认项；不影响本次 DOM 层结论。

## 提交与归档

- 本批代码/测试/文档一次提交，归档目录：`history/works/2026-10-23-m1-scenario-verification/`。
- 前一工序（追溯补齐、场景 designed）见 `history/works/2026-10-23-m1-traceability/result.md`；本 result 取代其中「R10 开放」的结论。
- 复跑命令：`npm test`、`npm run test:scenarios`、`npm run test:smoke`；单场景：`node tools/verify-m1-scenarios.js SCN-0007`。

## 结论落点

| 内容 | 落点 |
|---|---|
| 可执行业务验收 | `tools/verify-m1-scenarios.js` |
| 场景与断言 | `design/scenarios/**/scenario.md` |
| 需求交付状态 | `requirements/REQ-0002..0011-*.md` |
| 验证矩阵/风险 | `design/architecture.md` §7/§8、`plan/risks.md` R7/R10 |
| 路线图 | `plan/roadmap.md` M1 |
