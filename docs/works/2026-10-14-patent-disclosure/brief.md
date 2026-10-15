---
layer: works
module: global
status: active
updated: 2026-10-14
---
# 工序：把 AgentFlow 整套方案整理为专利交底书

## 需求

> 用户口径：把当前 Agent 编排能力的设计整理编辑，输出一份专利交底书；范围**不只是编排，
> 是整套 AgentFlow 的方案**——编排引擎、四大资产体系（专家/Skill/Harness/工具）、工作区唯一信道、
> 实例控制、效能与知识治理闭环全部纳入。

## 背景

- 设计真相分布在 `design/` 十份模块规格 + 3 份全局规格（product / ui-shell / debugging 等）；
- 原始概念源头 `reference/workflow_concept.pptx`（P1–P8）已提取：计划–执行–审视骨架、固化专家模板、
  Skill 渐进披露、知识库索引、Harness 边界、编排器代码化、Workspace 组织、专家工作群；
- 本工序是**纯文档整理与再创作**：不改代码、不改 design/ 现行真相，只做跨文档蒸馏 + 交底书结构重组。

## 验收标准

- [ ] 交底书覆盖整套 AgentFlow：架构原则（编排器代码化、工作区唯一信道）、工作流定义模型（五类节点/三类边/配置扮演）、评审回退、清单驱动大规模并行、人工确认人机协同、四大资产体系、实例状态机与控制、效能与知识治理闭环、凭证管理；
- [ ] 结构符合专利交底书惯例：发明名称/技术领域/背景技术/发明目的/术语/技术方案/创新点对比/有益效果/附图说明/实施例/权利要求建议；
- [ ] 附图 6 张（总体架构/节点模型/并行调度/状态机/资产体系/方法流程），中文字体渲染正常；
- [ ] 双格式交付：Markdown 源 + Word（.docx，嵌入附图）；
- [ ] design/ 与代码零改动（本工序只新增 works/ 工序文件）。

## 影响面

- 新增：`works/2026-10-14-patent-disclosure/`（brief、交底书 md、figures/、docx、result）
- 不改：`design/`、`assets/`、`pages/`、`docs/plan/open-questions.md`
