# 文档导航

本目录按「四态分离」组织：**位置即状态**——文档在哪一层，就处于什么生命周期；每份文档的 frontmatter（layer / module / status / updated）与路径互相校验。分层规则见 skill `doc-layout-spec`（不在文档树内）。目录结构：

```
docs/
├── README.md                        ← 本页：阅读顺序与入口
├── design/                          ← 现行真相（唯一权威，只写现行内容）
│   ├── product.md                   ← 产品层（全局）：需求画像、范围、页面地图
│   ├── architecture.md              ← 系统层（全局）：技术基线、代码结构、公共组件
│   ├── ui-shell.md                  ← 全局外壳与设计约定
│   ├── dev-environment.md           ← 全局：开发环境配置
│   ├── debugging-and-testing.md     ← 全局：调试方案
│   ├── code-refactoring.md          ← 全局：代码重构要点
│   └── <模块>/spec.md               ← 十个页面模块的入口规格（模块清单由目录名推导）
├── plan/                            ← 意图（只放全局意图，不按模块分）
│   └── open-questions.md            ← 开放问题登记（领取制）
├── works/                           ← 执行（首个工序立项时创建，一级只有工序目录）
└── history/                         ← 记忆（冻结只读；坑档案可更新存续状态）
    ├── decisions/requirement-rulings.md
    └── pitfalls.md
```

## 模块清单（由 design/ 目录名推导，与页面路由一一对应）

`workflow-list` · `workflow-editor` · `skills` · `experts` · `harnesses` · `tools` · `instances` · `analytics` · `workspaces` · `keys` —— 每个模块目录内 `spec.md` 为入口规格，专项文档围绕规格放置（模块内不嵌套子目录）。

## 阅读顺序（新接手者）

1. `design/product.md` —— 项目是什么、需求画像、页面地图
2. `design/ui-shell.md` —— 界面骨架与全局设计约定
3. `design/dev-environment.md` —— 本机怎么跑起来（环境事实、代理、WebKit 安装）
4. `design/debugging-and-testing.md` —— 怎么验证改动（四层测试策略、断言模板）
5. `design/code-refactoring.md` —— 改代码前必读（绑定作用域等防御性规则）
6. `history/pitfalls.md` —— 踩过的坑与存续条件（评审时对照检查）
7. `design/<模块>/spec.md` —— 按需查阅对应模块规格

## design/（现行真相）

| 文档 | module | 内容 |
|---|---|---|
| `product.md` | global | 产品层：项目概述、范围、页面地图、原型口径 |
| `architecture.md` | global | 系统层：技术基线、代码目录结构、DF 公共组件清单 |
| `ui-shell.md` | global | 全局布局与设计约定（所有页面的外壳） |
| `dev-environment.md` | global | 开发环境配置：本地服务、网络代理、Playwright WebKit 安装、JavaScriptCore 语法冒烟、Safari 手工调试链路 |
| `debugging-and-testing.md` | global | 调试方案：语法/结构/引擎/人工四层策略、全站回归模板、命中测试断言、合成事件坐标系规则、探针验证法、用户报告响应流程 |
| `code-refactoring.md` | global | 代码重构要点：绑定作用域三条硬规则、闭包断链、innerHTML 次序、共享能力下沉、双路径兼容模式、先锁行为再动代码、子代理协作经验、重构禁区 |
| `<模块>/spec.md` | 各模块 | 十个页面模块的需求与交互规格 |

## plan/（意图）

| 文档 | 内容 |
|---|---|
| `open-questions.md` | 跨工序开放问题登记（OQ-1 ~ OQ-6，领取制；关闭时记结论落点，条目不删除） |

## history/（记忆）

| 文档 | 内容 |
|---|---|
| `pitfalls.md` | 坑档案：CSS 类（z-index 无 position、inset 简写、CSS zoom 部分实现、fixed 遇 transform、flex-shrink、视口单位与缩放）、JavaScript/DOM 类（页脚绑定、页头静默失绑、confirm 解析次序、闭包断链、innerHTML 覆盖）、工具链类、流程类。每条含现象 / 存续条件 / 对策落点 |
| `decisions/requirement-rulings.md` | 需求裁定记录（R1–R4 问答决策 + Google 建议对照），活结论已蒸馏进 design/ 各规格 |

## 维护纪律（速记）

- 新文档先问「属于哪一态」，按路径放置并写 frontmatter（layer / module / status / updated）；layer 与目录位置矛盾、status 越出本层值域、module 与目录不符，发现即修；
- 一处一事：同一事实只有一个权威文档，其他地方引用不复制；
- 新坑必须带存续条件，写入 `history/pitfalls.md`；坑消失时回填实证日期；
- 工序类工作（需求 → 方案 → 实施 → 收口）立项时建 `works/YYYY-MM-DD-<短名>/`（brief.md 必写），收口写 `result.md` 后才可归档至 `history/works/`；
- 归档工序不得作为设计依据：活结论必须先蒸馏进 design/ 再引用。
