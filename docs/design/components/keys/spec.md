---
layer: design
module: keys
component: CMP-keys
requirement: REQ-0011
scenario: SCN-0011
status: active
updated: 2026-10-23
---

# 个人 Key 管理

> 导航：基础配置 / 个人 Key 管理　|　形态：列表 + 弹窗　|　前置：`design/components/ui-shell/spec.md`

## 0 模块卡

> 追溯：`REQ-0011` / `SCN-0011`（verified；DOM/jsdom 3 正 1 反）。

- 状态：active
- 单元 / 层：组件 / L2 页面组件
- 业务价值：为个人用户提供 git ssh-key 与 LLM API Key 的登记、掩码展示、有效性校验与用途绑定；没有它，工作区、Harness 与专家调用无法关联凭证，原型也无法演示「按用途治理密钥」。
- 负责 / 不负责：负责 Key 列表（类型分栏/状态/掩码）、添加弹窗（git / LLM 两套表单）、指纹与模型信息展示、有效性校验（模拟）、绑定用途编辑、删除；不负责真实登录态与鉴权、密钥的安全存储/加密、工作区/Harness/专家的定义（各自组件）、真实调用凭证。
- 数据所有权：读 `MOCK.keys`、`MOCK.experts`、`MOCK.harnesses`、`MOCK.workspaces`（绑定目标与引用展示）；写 `MOCK.keys`（新增 `push`、删除 `filter`、绑定用途写回，仅内存态，刷新复位）；弹窗编辑态只在内存，不落 localStorage/sessionStorage。
- 公开契约：页面入口 `pages/keys.html`；操作 `CMP-keys#list`、`#create-git`、`#create-llm`、`#verify`、`#bind`、`#delete`；不变量 密钥只显示末 4 位掩码，完整值不在列表/详情回显；git 与 LLM 表单字段分离，不能互相提交；绑定目标只能从已存在的 `MOCK.workspaces` / `MOCK.harnesses` / `MOCK.experts` 中选择；删除必须二次确认；校验状态只取「有效/失效/未校验」三值。
- 依赖：`DF`（外壳、表格、弹窗、表单、Toast、图标）/ `MOCK`；不依赖其他页面组件（跨页只走 URL）。
- 变化轴：凭证供应商与 Key 类型（git / LLM 多供应商）最易变，新增类型须同步列表分栏、添加弹窗与绑定用途。
- 验证入口：`npm start` + `/pages/keys.html`；`node tools/smoke-test.js`（全站冒烟，含本页）；SCN-0011（verified，3 正 1 反；`node tools/verify-m1-scenarios.js SCN-0011`）。
- 预算：`keys.js` 约 15 KB + 本规格约 5 KB，场景断言在 `tools/verify-m1-scenarios.js`；上限 120k token，远低于上限。
- 单独运行：`npm start` → `/pages/keys.html`（绑定目标只读其他夹具集合）。
- 删除测试：删除后凭证无法登记、校验与绑定，工作区/Harness/专家调用失去凭证来源；但真实鉴权不在原型内，复杂度会集中到各消费页，故保留为独立组件。
- 已知偏差：M1 追溯已补（REQ-0011/SCN-0011），场景 verified（DOM/jsdom 3 正 1 反 40/40）；行为级断言已由 M1 runner 覆盖；密钥为演示数据、掩码展示；有效性校验与绑定影响均为模拟，无真实鉴权；删除/绑定只改内存夹具。

## 1 页面定位

个人密钥资产管理（R2 全选）：git ssh-key、LLM API Key；掩码展示与有效性校验；按用途绑定到工作区/Harness/专家调用。

## 2 布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 个人 Key 管理                                 [+ 添加 Key]         │
│ ℹ 密钥仅显示掩码（后 4 位），完整值加密存储、不可回显                   │
│ Tab: 全部 | git ssh-key | LLM API Key           [🔍搜索]            │
├──────────────────────────────────────────────────────────────────┤
│ 名称         类型           掩码摘要                    绑定        状态   最后校验  操作 │
│ deploy-key   git ssh-key    SHA256:ab:12:…:3f2a        工作区×2    有效●  2h前    校验 ⋮ │
│ deepseek-k   LLM API Key    sk-****a1b2（DeepSeek）     专家调用    有效●  1d前    校验 ⋮ │
│ ci-key       git ssh-key    SHA256:9c:44:…:77b0        工作区×1    失效✕  3d前    校验 ⋮ │
│ gateway-k    LLM API Key    gw-****8f3e（内部网关）      未绑定      未校验—        校验 ⋮ │
└──────────────────────────────────────────────────────────────────┘
```

## 3 元素明细

| 区域 | 元素 | 类型 | 说明与交互 |
|---|---|---|---|
| 安全提示条 | 掩码存储说明 | 信息条 | 常驻顶部 |
| Tab | 类型筛选 | Tab | 全部 / git ssh-key / LLM API Key |
| 表格 | 名称、类型图标+标签 | — | — |
| 表格 | 掩码摘要 | 等宽文字 | ssh-key=指纹（SHA256:xx:…:后4位）；LLM=`sk-****abcd`（供应商名） |
| 表格 | 绑定用途 | chips | 工作区×N / Harness×N / 专家调用；点击打开绑定编辑弹层 |
| 表格 | 状态 | 状态点 | 有效（绿）/ 失效（红）/ 未校验（灰） |
| 表格 | 最后校验时间 | 相对时间 | — |
| 表格 | 操作 | 按钮组 | 校验（loading→模拟结果 toast 并更新状态/时间）、编辑（掩码不变，仅改名称/绑定）、删除（被绑定时警示解绑） |

## 4 添加 Key 弹窗（按类型两套表单）

| 类型 | 字段 |
|---|---|
| git ssh-key | 名称✓、公钥（textarea 粘贴，格式校验 `ssh-xxx` 开头）、备注；旁注「生成方式：ssh-keygen -t ed25519」说明链接 |
| LLM API Key | 名称✓、供应商（下拉：OpenAI / DeepSeek / 内部网关）、API Key（密码框）、默认模型（随供应商联动）、额度说明（可选） |

## 5 绑定用途编辑弹层

三组勾选列表：工作区（来自工作区资产）、Harness、专家/模型调用（来自专家资产）；保存后表格绑定 chips 更新，关联资产详情页同步显示该 key。

## 6 状态与空态

- 无 Key：空态「添加第一个密钥，用于仓库访问或模型调用」
- 失效 Key：行内警示色 + 详情提示重新校验或更换

## 7 模拟数据依赖

`MOCK.keys[]`：4 条，字段 `{id,name,type,mask,provider?,model?,bindings{workspaces[],harnesses[],experts[]},status,lastCheckedAt,note}`。
