---
layer: requirements
module: keys
status: accepted
updated: 2026-10-23
---

# REQ-0011 个人 Key 登记、校验与绑定

| 字段 | 内容 |
|---|---|
| ID | `REQ-0011` |
| 类型 | `feature` |
| 场景叙述 | 个人用户查看 git ssh-key 与 LLM API Key 列表，新增凭证、查看掩码、做有效性校验、绑定到工作区/Harness/专家，并删除不再使用的 Key。 |
| 价值 | 没有个人 Key 管理，工作区、Harness 与专家调用无法关联凭证，也无法演示按用途治理密钥。 |
| 非目标 | 不做真实登录态与鉴权；不做密钥加密存储；不做真实供应商校验；绑定只改内存夹具。 |
| 约束 | 纯前端静态原型；密钥只显示末 4 位掩码；git/LLM 表单分离；删除需二次确认；不新增依赖。 |
| 影响场景 | `SCN-0011`（`design/scenarios/workspace/credential/manage-key/scenario.md`） |
| 澄清记录 | 2026-10-23 回溯登记：列表/添加/掩码/校验/绑定/删除已存在；本次补 REQ/SCN，场景到 `designed`，未 `verified`。 |
| 状态 | `accepted` |
