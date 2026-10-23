---
layer: design
module: keys
status: verified
flow: manage-key
scenario: SCN-0011
updated: 2026-10-23
---

# SCN-0011 个人 Key 登记、校验与绑定

## 入口

- `CMP-keys/assets/js/pages/keys.js#render`
- `CMP-keys/pages/keys.html#page-body`

## 运行序

1. 列表按 git ssh-key / LLM API Key 分栏，显示名称、掩码（仅末 4 位）、状态与绑定用途。
2. 添加弹窗按类型切换两套表单：git 需名称/私钥/指纹，LLM 需名称/供应商/模型/API Key；必填校验通过后 `push`。
3. 校验按钮模拟有效性，状态在有效/失效/未校验间变化；绑定用途从已有工作区/Harness/专家中选择并写回。
4. 删除先 `DF.modal.confirm`，显示被引用次数；确认后从 `MOCK.keys` 移除。

失败路径：必填缺失或两套表单混填不得提交；列表不显示完整密钥；取消删除不写集合。

## 不可变引用

- `MOCK.keys` 的 `id/name/type/mask/status/bind/provider/model` 字段契约。
- git / LLM 两套表单字段分离与末 4 位掩码规则。
- `MOCK.workspaces` / `MOCK.harnesses` / `MOCK.experts` 的绑定目标集合。

## 测试

执行层：DOM（jsdom）+ 本地静态 HTTP（恢复 sessionStorage 语义）；可执行：`node tools/verify-m1-scenarios.js`（单场景追加场景号）。最近一次执行：2026-10-23，40/40 通过。

| ID | 类型 | 断言 | 对应脚本 |
|---|---|---|---|
| SCN-0011-T1 | 正 | 列表数同源；所有掩码含 **** 或 …、保留末 4 位并在列表展示 | `tools/verify-m1-scenarios.js#SCN-0011-T1` |
| SCN-0011-T2 | 正 | 添加合法 git Key +1 且状态「未校验」；git 表单显示时 LLM 表单隐藏 | `tools/verify-m1-scenarios.js#SCN-0011-T2` |
| SCN-0011-T3 | 正 | k3 校验后转「有效」；k1 新增工作区绑定并回写，列表显示工作区×3 | `tools/verify-m1-scenarios.js#SCN-0011-T3` |
| SCN-0011-T4 | 反 | 缺公钥时主按钮 disabled 且不新增；取消删除后集合不变 | `tools/verify-m1-scenarios.js#SCN-0011-T4` |
