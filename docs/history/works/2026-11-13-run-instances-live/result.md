---
layer: history
module: global
status: frozen
updated: 2026-11-13
---

# 结果：运行实例同源接入与发起运行（B4）

## 结论

运行实例两页已从 MOCK 切到 B4 live；发起运行按「工作流 + Harness + 工作区路径 + 所见即所得意图」提交；工作流编辑器对齐 B3 七类节点；节点消息按 Markdown 渲染并可全屏。实现与验证记录见已归档的 `history/works/2026-11-12-run-live-integration/` 与 `2026-11-12-run-message-rendering/`。

## 提交映射

| 提交 | 内容 |
|---|---|
| `9696426` | 工作流编辑器对齐 B3 七类节点 |
| `cf2109b` | 运行实例 live、发起运行、run 数据层 |
| `36c75ab` | 发起运行默认工作区路径 |
| `482c970` | 节点消息 Markdown 渲染 + 全屏 |

## 验证

`SCN-0004` 5/5、M1 50/50、冒烟 13/13、`test:gate` 通过；真实后端发起/终止/决策实测通过，console 零错误。

## 开放

- 是否展示冻结图快照，取决于后端 `RunDetail` 是否补 `graph`。
- Harness 页的 `clientId` 登记入口另立任务。
