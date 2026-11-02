---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 决策：前端全站 ESM 化与测试栈迁移

## 背景与问题

本项目现行前端是「无构建 + 全局对象」范式：13 个 HTML 页面按顺序加载 `assets/js/ui.js`（`window.DF`）、`mock-data.js`（`window.MOCK`）、`api.js`（`window.API`）与页面脚本；共享靠全局，页面间禁止互相引用。测试用 jsdom 执行经典脚本（`tools/smoke-test.js`、`tools/verify-m1-scenarios.js`），引擎层另用 Playwright。

2026-10-30 准备接入 B3 工作流时，暴露出两个问题：

1. 工作流编辑器需要拆成图模型、校验、数据服务、页面控制四块，继续用全局对象会让依赖顺序和命名空间快速腐化；
2. jsdom 不能执行 `<script type="module">`，只要引入 ESM，现有 13 页冒烟与 10 场景 × 3 正 1 反（319 条断言）就必须换执行层。

用户在同日交互式评审中逐项确认：接受跨站迁移成本，选择全站 ESM，并要求先迁移、再做工作流页面。

## 决策

1. **全站原生 ESM，保持无构建**：13 页与共享模块改用 `import/export`，HTML 使用 `<script type="module">`；不引入 bundler、不做转译、不新增运行时依赖。
2. **仓库统一 `"type": "module"`**：`server.js`、`bff/`、`tools/`、`tests/` 一并转为 ESM；不再保留 `.cjs` 兼容层。
3. **取消全局对象**：`window.DF/MOCK/API/WSC` 改为模块导出；页面之间仍禁止互相 import，共享能力只能下沉到 `assets/js/shared/` 或领域模块。
4. **测试栈替换**：纯逻辑用 `node --test` 直接 import；页面结构、业务场景与网络断言全部迁移到 Playwright；删除 jsdom 依赖与入口；不保留 `window.__APP__` 测试桥。
5. **迁移顺序**：先完成 ESM 迁移（共享模块 → 页面分批 → 测试栈 → 门禁），再做工作流列表/编辑器；工作流两页直接按 ESM 写。
6. **工作流数据层独立**：新增 `workflow/data` 作为唯一读写入口，不把工作流方法并入原 `api.js`；原 `api.js` 保持 B1 四类资产边界。
7. **工作流交互模型**：只做手动保存（取消自动保存与本地草稿）；只有合法图可保存；视口不算未保存修改、随保存提交；非法元素红框 + 保存置灰；新建走向导（名称/类型/描述 + 起止专家）与模板复制并存；旧图不迁移、上线前清空。

## 被否决的方案

| 方案 | 否决理由 |
|---|---|
| 继续 IIFE + `window.WF` 命名空间 | 依赖顺序隐式、测试需桥；与用户选择的全站 ESM 不符 |
| 只把工作流子树改成 ESM | jsdom 不能跑 module，会形成“编辑器 Playwright、其余 jsdom”的混合测试栈；两套加载范式长期共存 |
| 浏览器 `.mjs` + Node 保持 CJS | 与“全仓 `type:module`”冲突；`node --check`、import 解析与包边界不统一 |
| 引入 esbuild/Vitest 等构建或测试 runner | 违反“无构建、运行时零依赖”的现行基线；依赖准入需另立 P1 |
| 保留 `window.MOCK` / `window.__APP__` 测试桥 | 迁移不彻底，业务代码会继续依赖全局；用户明确选择全部改 DOM/网络断言 |

## 影响与代价

- **范围**：13 个 HTML、18 个 JS 文件（约 7,400 行）、`server.js`/`bff`/`tools`/`tests` 的 Node 侧转换；`check:syntax`、`check:architecture`、`check:scenario-trace` 都要适配。
- **测试**：48 个 SCN 引用、319 条断言的执行方式改变；断言要从“读内部状态”改为“看 DOM/网络结果”，不是机械替换。
- **风险**：迁移量大概率超过工作流两页本身；Node 侧 ESM 转换会触碰静态服务与 BFF；Playwright 场景重写可能引入覆盖空洞。缓解见 `plan/risks.md` R15–R17。
- **工作流约束**：无草稿意味着编辑到一半关闭会丢，只靠离开警告；这是与“合法才可保存”一起接受的取舍。
- **后端待修**：`updatedBy` 恒为 `local`（workflow service 未使用 `X-Actor`），UI 暂不展示更新人。

## 用户确认记录

2026-10-30 交互式问答，逐项结论：

1. 保存模型：取消自动保存，改为纯手动保存；只有合法图能保存；离开时未保存要警告。
2. 视口：不算未保存修改，随保存提交。
3. 非法图：保存置灰 + 问题元素红框 + 校验面板汇总 + 图级阻断条。
4. 新建：向导（起止专家生成最小合法图）+ 模板复制并存。
5. 旧数据：不迁移，现有工作流可直接删除；上线前清空。
6. 列表信息：只放工作流域指标，不展示 `updatedBy`。
7. 范围：列表 + 编辑器同轮切真实 API。
8. 数据层：新增工作流数据模块，不扩 `window.API`。
9. 模块化：全站 ESM。
10. 测试：`node --test` + 全量 Playwright，删除 jsdom。
11. 可观测性：全部 DOM/网络断言，不保留测试桥。
12. 顺序：先 ESM，再做工作流。
13. Node 边界：`"type":"module"`，Node 侧全部转 ESM。

## 后续

- ESM 迁移工序：`docs/history/works/2026-10-30-frontend-esm/`。
- 工作流接入工序：`docs/works/2026-10-30-workflow-ui/`。
- 后端修复 `updatedBy` 的 actor 透传后，再评估列表/详情展示更新人。
- 若后续确需构建链，另立 P1 方案，不在本决策范围内。
