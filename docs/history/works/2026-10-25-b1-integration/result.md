---
layer: history
module: bff
status: frozen
updated: 2026-10-25
---

# 工序结果：B1 资产同源接入

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| BFF 同源透明转发 | 通过 | `npm run test:bff` 9/9；`/healthz` 与 `/api/v1/skills` 经 3000 返回 |
| 四类资产页读 B1 DTO | 通过 | `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js` 4/4 |
| 四类资产页写 B1 | 通过 | `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js` 4/4（页面创建 + BFF 更新/启停/删除） |
| M1 既有场景不回归 | 通过 | `node tools/verify-m1-scenarios.js` 40/40 |
| 文档五态与索引 | 通过 | `npm test`（syntax/docs/scenario index/BFF） |
| 静态页面冒烟 | 通过 | `npm run test:smoke` 12/12 |

## 结论落点

- `REQ-0012` 置为 `delivered`；`SCN-0012` 置为 `verified`。
- 四个资产页直接消费 B1 DTO，不保留客户端视图模型或 MOCK fallback；B1 缺口（任务/心跳历史、Tool 调试、引用方明细、Skill 版本历史）已移除或标注。
- M1 的四页场景通过 `tools/fake-b1.js` 内存传输保留；真实后端读写由 `tools/verify-b1-pages.js` 与 `tools/verify-b1-writes.js` 单独验证。
- 其余 8 页继续 MOCK，共用外壳「演示环境」标识。
