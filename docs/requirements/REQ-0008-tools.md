---
layer: requirements
module: tools
status: delivered
updated: 2026-10-23
---

# REQ-0008 工具注册、调试与引用治理

| 字段 | 内容 |
|---|---|
| ID | `REQ-0008` |
| 类型 | `feature` |
| 场景叙述 | 工具维护者浏览注册表，按类型/状态查看工具，注册 MCP/CLI/脚本工具，打开调试抽屉模拟执行，查看被专家/工作流节点引用的情况，并删除未被引用的工具。 |
| 价值 | 没有工具注册与调试，确定性能力只能散落在专家提示词里，无法验证、复用或知道被谁引用。 |
| 非目标 | 不做真实 MCP/CLI/脚本执行；不做 CI/CD 环境绑定（本版占位）；调试为模拟 trace，不发起真实调用。 |
| 约束 | 纯前端静态原型；被引用工具不可删除；调试成功才从“未验证”转“可用”；引用方统计来自夹具扫描；不新增依赖。 |
| 影响场景 | `SCN-0008`（`design/scenarios/assets/tool-registry/manage-tool/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：注册/调试/引用方/删除保护已存在；本次补 REQ/SCN；2026-10-23 M1 runner 40/40 通过，场景 `verified`，REQ 转 `delivered`。 |
| 状态 | `delivered` |
