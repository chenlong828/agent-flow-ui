---
layer: design
module: keys
component: CMP-keys
status: active
updated: 2026-10-14
---

# 个人 Key 管理

> 导航：基础配置 / 个人 Key 管理　|　形态：列表 + 弹窗　|　前置：`design/components/ui-shell/spec.md`

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
