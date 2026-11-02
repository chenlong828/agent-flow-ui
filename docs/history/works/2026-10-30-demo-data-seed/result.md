---
layer: history
module: global
status: frozen
updated: 2026-10-30
---

# 结果：演示数据灌注（B1/B3 经 API）

- 工序：`docs/history/works/2026-10-30-demo-data-seed/`
- 需求：旁路（演示/测试数据准备，无用户旅程，不建 `REQ`）

## 结论

B1 五类资产与 B3 六条工作流已通过后端 HTTP API 灌入本机 `:3100`，**未直连数据库、未改后端源码**；live 七页（Harness / 工具 / Skill / 专家 / Skill 详情 / 工作流列表 / 编辑器）从空态变为可浏览数据。实例、看板、工作区、Key 六页仍由 `MOCK` 提供（B2/B4 未实现），刷新复位属预期。

## 实测计数（2026-10-30）

| 资源 | 条数 | 明细 |
|---|---|---|
| Harness | 6 | 容器 2 / 服务器 2 / 笔记本 1 / 台式机 1 |
| 工具 | 10 | CLI 6 / MCP 2 / 脚本 2；全部「未验证」（后端只读） |
| Skill | 13 | 编码 2 / 检索 4 / 审视 3 / 测试 4；1 条停用 |
| 专家 | 8 | Skill 装配 23 条、工具装配 23 条 |
| 工作流 | 6 | 节点 47、阶段 4、边 51（含 10 条回退边） |

数据经 UI 同源 BFF（`:3000/api/v1/*`）复核，`total` 与上表一致。

## 变更

| 文件 | 变更 |
|---|---|
| `tools/demo-seed.mjs` | 新增。按「Harness → 工具 → Skill → 专家 → 工作流」顺序调用 B1/B3 API；按名称幂等；`REFRESH=1` 用 `If-Match` 重写工作流图；失败打印 `error.details.issues` |
| `assets/js/mock-data.js` | 修 `w5`/`w6` 的 `graphSmall(ids, names)` 参数长度不一致（声明 5 节点、实际 4/3），补评审专家 `e6` 与名称项 |

## 验证

- API：`/healthz` 为 `{"status":"ok","database":"up"}`；五类列表 `total` 见上表；Skill 详情页 `GET /skills/{id}/document` 返回 `SKILL.md`，`GET /skills/{id}/download` 200（869 B）。
- 页面走查（Playwright WebKit 1440×900，经 `:3000`）：
  - 工作流列表 6 卡，节点合计 47，类型页签 1/3/2；
  - 编辑器画布 4 阶段、14 节点、18 边、5 条回退边，专家名可读；
  - 专家 8 卡、Skill 13 行、工具 10 行、Harness 6 行；
  - 无控制台级空态；页面脚本不报错。

## 已知限制（后端能力边界，未绕过）

1. **Harness 健康 / 心跳**：B1 无心跳上报端点，`POST` 固定 `unknown`，页面统一「未知 / 无心跳」，统计卡在线 0。要点亮状态需要后端运行面数据。
2. **工具状态 / 最近调试**：同样只读，全部「未验证 / —」。
3. **Skill 版本 / 更新时间**：服务端生成，全部 `v1.0`、同一时刻。
4. **工作流节点 `config`**（输入/输出、知识索引注入、收敛约束、工具权限）不在 B3 `WorkflowNode` 内，转换时丢弃；live 编辑器不展示这些配置。
5. **实例 / 看板 / 工作区 / Key**：B2/B4 未实现，无接口可灌，继续 `MOCK`；实例页与 B3 工作流不联动。
6. 为对齐 PPT P5 四类执行设施补了 `desk-02`（台式机）、为修 `e7` 悬空引用补了第 13 条 Skill「冒烟验证」，均属夹具补齐，不改变契约。

## 结论落点

| 结论 | 落点 |
|---|---|
| 演示数据可由 API 一键重灌 | `tools/demo-seed.mjs`（`node tools/demo-seed.mjs` / `REFRESH=1`） |
| 夹具 `w5`/`w6` 节点数错误 | `assets/js/mock-data.js` |
| 运行期字段不可写、B2/B4 缺位 | 本 `result.md` 第「已知限制」节；不新增文档 |
| 后续若要实例/看板 live | 需另立 B4 后端工序，超出本工序范围 |
