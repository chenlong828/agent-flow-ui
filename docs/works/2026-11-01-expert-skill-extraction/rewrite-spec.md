---
layer: works
module: global
status: active
updated: 2026-11-01
---

# Skill 重写规范（详细版）

> 背景：第一版 24 条 Skill 正文平均只有 1 KB，是「给页面看的摘要」，不是「给模型看的说明」；references 也按小节硬拆。本轮改为从来源仓原文逐条提取，默认合并回正文。

## 0. 两条原则

1. **正文是操作说明，不是目录**。模型只读正文就能执行；每条规则、每个判定、每个反例都要写出来，不用「见 references」代替。
2. **能合并就合并**。references 只在正文放不下时保留，不再按小节人为拆分。

## 1. 合并策略

| 情况 | 处理 |
|---|---|
| 源 SKILL.md + 源 references 合计 ≤ 15.5 KiB | 全部合并进正文，包内只留 `SKILL.md` |
| 合计 15.5–25 KiB | 合并定义、规则、判定、示例；保留一份「大型附录」作为 reference |
| 两套独立规则（UFT / ARES） | 正文写共同骨架 + 当前栈细节，另一栈保留 reference |
| 合计 > 25 KiB 且场景差异大 | 正文写主场景全量，次场景保留 reference |

判定按合并后的 UTF-8 字节数算，正文硬上限 16 KiB（16,384 B），目标 8–15 KB。

合并顺序：定义 → 规则 → 场景增量 → 示例 → 输出契约。删除第一版按小节拆出来的薄 reference，换成来源仓的原文附录（如有必要）。

## 2. 正文结构

七节固定，节内用 `###` 展开：

```text
## 适用场景      输入是什么、输出是什么、不做什么、触发词
## 执行步骤      分步；每步含判据、表格、反例、边界
## 示例          2–4 个完整例子（输入 → 输出）
## 脚本          有无脚本；输出契约 JSON
## 完成验证      可勾选的判定项
## 常见踩坑      6–10 条，来自来源仓的红线
## 参考资料      仅列真正保留的附录
```

## 3. 语言

- 用完整句子写说明，不用「A→B」「S/V/O 齐」这类速记；术语首次出现给全称与英文。
- 规则要写「判据 + 做法 + 反例」，不只写结论。
- 表格用于对照（类型、取值、字段），不用于替代解释。
- 示例给原文与拆解结果，能对照。
- 不写客户名、项目号、内网地址、账号。

## 4. 24 条来源与合并决定

| # | Skill | 主要来源 | 正文目标 | references 决定 |
|---|---|---|---:|---|
| 1 | 需求分流与动作分类 | web `experts/routing.md`、`expert-skill-matrix.md`；uft `01_分流路由Agent` | 10 KB | 全合并 |
| 2 | SVO 拆分 | uft `svo-decompose` 正文 + 01/02/03/04 | 12.7 KB | **已完成**：保留 05 需求拆解规范 |
| 3 | 业务功能树检索 | uft `02_需求LoopAgent` 4b；web `knowledge/business` | 8 KB | 全合并 |
| 4 | 代码现状检查 | web `skills/inspect`（code 模式） | 10 KB | 全合并 |
| 5 | 变更影响面分析 | uft `02c_影响分析专家`、`kg-locate`、`source-asset`；web `call-chain-analysis.md` | 12 KB | 全合并 |
| 6 | 知识图谱入口定位 | uft `kg-locate` 正文 + 12 refs | 12 KB | 保留 2 份（按词收卡、示例库） |
| 7 | UFT/ARES 伪代码修改 | uft `uft-code-modification`、`ares-code-modification` | 14 KB | 保留 ARES 规则一份 |
| 8 | SQL 编写与审核 | uft `sql-authoring` 正文 + 4 refs | 14 KB | 全合并 |
| 9 | 测试设计与用例生成 | uft `06_测试验证Agent` 01/04 | 10 KB | 全合并 |
| 10 | 测试数据构造 | uft `data-fabrication` 正文 + 4 refs | 14 KB | 保留 1 份（对账与还原） |
| 11 | 日志证据解析 | uft `log-parse` 正文 + 6 refs | 14 KB | 保留 1–2 份（大日志/redo） |
| 12 | 多 persona 代码评审 | web `skills/code-review` 正文 + 2 refs | 14 KB | 全合并 |
| 13 | 缺陷 5Why 分析评审 | web `skills/defect-analysis-review` | 13 KB | 全合并 |
| 14 | 阶段准出门控 | uft `05_审核门控专家`；web `review-gate`、`phase-gate-rule.md` | 12 KB | 全合并 |
| 15 | 冒烟验证 | uft `06` Phase V；现有 `sk-smoke2` | 8 KB | 全合并 |
| 16 | 浏览器页面验证 | web `skills/inspect`（page 模式） | 10 KB | 全合并 |
| 17 | 复盘与经验沉淀 | web `compound`；uft `case-review` | 13 KB | 保留 1 份（沉淀模板） |
| 18 | 契约断言 | web `design-api` C 章；现有 | 8 KB | 全合并 |
| 19 | CRES 编码规范 | web `design-architect` CRES 约束；现有 | 9 KB | 全合并 |
| 20 | LDP 低代码开发 | web `design-architect` LDP 约束；现有 | 9 KB | 全合并 |
| 21 | 元数据查询 | 现有 + `metadata-query.md` | 8 KB | 全合并 |
| 22 | DSL 检索 | 现有 + `ai-dev` | 8 KB | 全合并 |
| 23 | Linter 代码体检 | 现有 + `agent_lint` | 8 KB | 全合并 |
| 24 | 回放数据清洗 | 现有 + `data-fabrication` 对账段 | 8 KB | 全合并 |

## 5. 落库流程

正文写到 `tools/skill-bodies/<key>.md`，附录放 `tools/skill-refs/`，然后：

```bash
node tools/rewrite-skill.mjs --skill "<名称>" --body <正文件> \
  [--delete references/旧.md]... [--add references/新.md=<本地路径>]...
```

脚本会：建草稿 → 删旧附件 → 传新附件 → 带 If-Match 保存，并打印正文字节数与附件数。

## 6. 进度

| 状态 | 数量 | 说明 |
|---|---:|---|
| 重写完成 | 24 | 24 条全部落库：正文合计 276,092 B，单条 8,001–15,908 B，平均 11,504 B；23 条仅 `SKILL.md`，SVO 另带 1 份附录 |
| 待增补 | 0 | 第二轮增补已完成（2026-11-01），全部 ≥8 KB |

每完成一批（3–5 条）更新本表，并抽查页面渲染与整包下载。

## 7. 验收

- [ ] 正文 ≥8 KB，≤16 KiB，无「见 references」式摘要。
- [ ] 每条规则有判据与反例，示例可对照。
- [ ] 保留的 reference 是原文级附录，不是二次摘要。
- [ ] `GET /skills/{id}` 的 `files` 与正文「参考资料」一致。
- [ ] 页面渲染无报错；整包 zip 条目数正确。
