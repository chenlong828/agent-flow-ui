---
layer: history
module: global
status: frozen
updated: 2026-10-23
---

# 收口：组件基线与方案 A 落地

## 结论

方案 A 的 7 项交付已完成：11 张模块卡、architecture 现行真相、门禁增强、入口断链修复、server 加固、M1 基线登记、全量验证。页面业务行为未改，未新增依赖，工作区在收口提交前保持 clean。

按用户 2026-10-23 决策，**没有**补 10 张 M1 REQ，也**没有**新建原计划的 4 条旅程 SCN；M1 登记为「原型基线、无 REQ 追溯」（R7），后续只为真正改行为的页面补场景。Safari 人工走查仍未完成（R9）。

## 交付与提交

| 交付 | 落点 | 提交 |
|---|---|---|
| 工序 brief、组件/数据底稿、模块卡模板 | `works/2026-10-23-component-baseline/brief.md` | `7e85cb9` |
| 11 个 `CMP-*` 的 `## 0 模块卡` | `design/components/*/spec.md` | `0e8d9d9` |
| architecture 现行真相（地图/依赖/契约/数据/验证/偏差） | `design/architecture.md` | `ff5fd72` |
| check-docs 增强、场景索引生成器、npm 脚本 | `tools/`、`package.json`、`design/scenarios/_index.md`、`docs/README.md` | `bf9d301` |
| README、4 处页面 JS 注释、OQ-7、product 陈旧说明 | `README.md`、`assets/js/pages/*.js`、`plan/open-questions.md`、`design/product.md` | `4e93515` |
| server 白名单/越界/点文件/回环绑定、`.env` 忽略 | `server.js`、`.gitignore` | `1f40f22` |
| M1 基线、R7/R8/R9、路线图 M4 | `plan/roadmap.md`、`plan/risks.md` | `caa5ca8` |

## 执行方式（如实记录）

- 子任务按「一组件一卡」派发，但运行环境并发上限为 8；第一波 8 个、第二波 1 个，其中多个子任务在落盘后异常退出、未回报。
- **由子任务落盘并复核通过**：`workflow-list`、`workflow-editor`、`skills`、`experts`、`harnesses` 共 5 张卡；`workflow-list` 子任务完整回报。
- **由主代理按同一 brief 补齐**：`ui-shell`、`instances`、`tools`、`analytics`、`workspaces`、`keys` 共 6 张卡，以及 architecture、门禁、入口、server、roadmap/risks。未降低验收标准：所有落盘内容均由主代理逐项复核字段、数据所有权与代码行为。
- 没有把子任务失败当作完成；失败后改为低并发/主代理补齐，最终以全量验证为准。

## 验证结果（2026-10-23）

| 层 | 命令 | 结果 |
|---|---|---|
| 语法 | `npm run check:syntax`（server/ui/mock/12 页/tools） | 通过 |
| 文档 | `npm run check:docs` | PASS，`components: 11 / requirements: 1 / scenarios: 1` |
| 索引 | `npm run docs:index:check` | PASS，无 diff |
| 结构 | `node tools/smoke-test.js`（jsdom） | 12/12 |
| 引擎 | `npm run test:engine`（Playwright WebKit） | 45 通过 / 0 失败 |
| 服务 | `curl` + `lsof` | 根 302、页面/资源 200、`.git/config` 404、`package.json` 404、越界与编码越界 404；仅 `127.0.0.1:3000` |

`npm test` 已把语法、文档、索引串成一条门禁；smoke 与 engine 仍是显式命令，依赖 jsdom/Playwright 的临时安装（见 `design/dev-environment.md`）。

## 代码行为与卡片的纠偏

复核中发现并已修正的卡片失真：

- `CMP-ui-shell` 导航是 **4 组 9 项**，不是 10 项。
- 实例状态没有「排队」；实际为运行中/等待人工确认/回退重跑中/已暂停/成功/失败/已终止，「已结束」只是聚合 Tab。
- 效能看板趋势**默认近 8 周**，可切近 4 周（近 12 周禁用），不是固定 8 周；评审记录按夹具新→旧顺序分页，页面不重排。
- 工作区向导顺序是「仓库绑定 → 关联 Key/连接测试 → 目录模板」；步骤② 无 `validate`，**连接测试失败仍可创建**“已初始化”工作区，已写入已知偏差。
- `MOCK.workflows` 只有列表/编辑器两个写入口；`instances`/`workspaces` 等单写。brief、architecture、R8 已统一为这一口径。
- `CMP-experts` 读 `MOCK.workflows` 仅用于引用计数；brief 底稿已补。

未改代码的已知行为缺口（需要改行为时另立 REQ）：

1. `CMP-workflow-list#run` 只 toast + 跳转，不写 `MOCK.instances`，与页面规格「发起运行」有落差。
2. 「本周新增运行」按 `startedM < 10080` 分钟近似自然周。
3. 工作区连接测试失败不阻断创建。
4. `CMP-skills` 规格的时间字段 `updatedAt` 与实现/夹具的 `updatedM` 不一致。
5. `CMP-harnesses` 规格的 `concurrencyMax` 与实现的 `max` 不一致。

## 未做与欠账

- **4 条旅程 SCN**：本批不改页面行为，按用户决策不新建；转为「页面行为变更时再补」的欠账，不假装完成。
- **Safari 人工走查**：仍为发布门禁（R9）；engine 只覆盖 WebKit 2104 的兜底路径。
- **M1 10 个页面组件的 REQ/SCN**：不补；R7 已明确「原型基线、无 REQ 追溯」，冒烟不作为业务验收。
- 真实工作流执行、权限、持久化、移动端等仍不在原型范围。

## 归档

本工序已完成并归档到 `history/works/2026-10-23-component-baseline/`；路线图 M4 的关联路径同步改为归档位置。归档件只作历史，不作为后续设计依据。
