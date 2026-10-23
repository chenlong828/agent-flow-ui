# 文档导航

本目录按「五态分离」组织：**位置即状态**——文档在哪一层，就处于什么生命周期；frontmatter（layer / module / status / updated）与路径互相校验。分层规则见 skill `doc-layout-spec`（不在文档树内）。

```
docs/
├── README.md
├── requirements/                  ← 需求：为什么做（一卡一文件）
│   └── REQ-0001-user-menu.md
├── plan/                          ← 调度：接下来做什么（三份固定文档）
│   ├── roadmap.md
│   ├── risks.md
│   └── open-questions.md
├── design/                        ← 现行真相：系统现在是什么
│   ├── product.md / architecture.md
│   ├── dev-environment.md / debugging-and-testing.md / code-refactoring.md
│   ├── components/<id>/spec.md    ← 组件规格（11 个）
│   └── scenarios/<领域>/<价值流>/<场景>/scenario.md
├── works/                         ← 执行：正在做什么（一级只有工序目录）
└── history/                       ← 记忆：怎么走到这里（冻结只读）
    ├── decisions/                 ← 决策与裁定
    ├── works/                     ← 已归档工序
    └── pitfalls.md                ← 坑档案
```

## 组件清单（`design/components/` 目录名即组件 ID）

`ui-shell` · `workflow-list` · `workflow-editor` · `skills` · `experts` · `harnesses` · `tools` · `instances` · `analytics` · `workspaces` · `keys`

每个组件目录内 `spec.md` 为入口规格；组件的公开能力以 `CMP-<id>` 引用，场景入口写成 `CMP-<id>/file#symbol`。

## 阅读顺序（新接手者）

1. `design/product.md` —— 项目是什么、范围、页面地图
2. `design/components/ui-shell/spec.md` —— 全局外壳与设计约定
3. `design/dev-environment.md` —— 本机怎么跑起来（环境事实、代理、WebKit 安装）
4. `design/debugging-and-testing.md` —— 怎么验证（语法/结构/引擎/人工四层策略与断言模板）
5. `design/code-refactoring.md` —— 改代码前必读（绑定作用域等防御性规则）
6. `history/pitfalls.md` —— 踩过的坑与存续条件
7. `design/components/<id>/spec.md` —— 按需查阅

## 维护纪律（速记）

- 新文档先问「属于哪一态」，按路径放置并写 frontmatter；layer 与目录矛盾、status 越出本层值域、module 与组件目录不符，发现即修；改完跑 `npm run check:docs`（零依赖，校验路径、值域、模块卡必备字段、works brief/result、`CMP-`/`SCN-`/`REQ-` 引用、旧路径残留）；
- 组件规格必须在 `## 1` 前有 `## 0 模块卡`，13 个字段齐全（见 `history/works/2026-10-23-component-baseline/brief.md` 模板）；
- 场景索引 `design/scenarios/_index.md` 是生成物，用 `npm run docs:index` 重生成，`npm run docs:index:check` 校验无 diff，不手改；
- 一处一事：同一事实只有一个权威文档，其他地方引用不复制；
- 需求进 `requirements/`；工序 brief 必须引 `REQ-xxxx`，一个 REQ 同时只挂一个在飞工序；
- 收口写 `result.md` 后才可归档到 `history/works/`；归档件不得作为设计依据；
- 新坑必须带存续条件进 `history/pitfalls.md`；坑消失时回填实证日期。
