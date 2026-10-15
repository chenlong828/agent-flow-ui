---
name: feature-lifecycle
description: 需求全生命周期的操作规范：一个需求从入池到归档依次经过六段——登记（需求按序号进入需求池，条目不删除）、领取（占用条目并立项日期编号的工序工作区）、执行（design/ 文档与代码双轨同步）、验证（四层测试策略，充当收口门禁）、收口（result.md 结论落点表回写登记表）、归档（工作区冻结进历史层）。每段有明确的完成判据：验证未过不得收口，收口是归档的前置。与 doc-layout-spec 配合——那份定文档的放置与状态规则，这份定环节的先后与完成判据。适用于新增需求登记、领取开放问题开工、工序执行与验证、收口归档，以及核对需求池与 works/ 目录的一致性。
whenToUse: 有新需求需要登记进需求池时；要从 open-questions.md 领取问题立项开工时；工序执行或验证中需要确认下一步动作与完成判据时；验证通过需要收口或归档时；需要核对登记表与 works/ 目录是否一致时。
---

# 需求生命周期：登记 → 领取 → 执行 → 验证 → 收口 → 归档

| 段 | 动作 | 完成判据 | 落点 |
|---|---|---|---|
| 登记 | 需求写入登记表 | 条目有可验收口径，状态=未领取 | `docs/plan/open-questions.md` |
| 领取 | 占用条目＋立项 | 登记表去向=工序ID，brief.md 存在 | `docs/works/YYYY-MM-DD-<短名>/brief.md` |
| 执行 | 文档＋代码同步改 | design/ 落点明确，过程文件在工作区 | `design/`＋代码目录 |
| 验证 | 四层测试 | 证据记入 result.md，未过不收口 | 验证命令与结果 |
| 收口 | result.md＋回写登记表 | 状态=已关闭，结论落点两处齐全 | `result.md`＋登记表 |
| 归档 | 整目录移入 history | layer=history、status=frozen、目录名不改 | `docs/history/works/` |

放置与 frontmatter 规则见 skill `doc-layout-spec`；验证工具与模板见 `design/debugging-and-testing.md`；动代码前对照 `design/code-refactoring.md` 与 `history/pitfalls.md`。

## 1. 登记（需求入池）

- 需求逐条登记为**独立可验收的最小单元**，过大先拆分再登记；一次可批量追加任意多条。
- **编号硬规则**：`OQ-N` 严格递增，续接表内现有最大号（当前 OQ-6，新条目从 OQ-7 起）；号不重用、不重排、不跳号补洞；**条目永不删除**（被否决走「已否决」，见第 5 节）。
- 条目填写：问题列 = 需求一句话＋**可验收口径**（写明"怎样算做完"，收口时逐条对照）；状态=未领取；去向=—；结论落点=—。同步更新文件 frontmatter 的 `updated`。
- 需求与疑问同池同规则，登记表 schema 不因数量增长加列。

## 2. 领取（claim）

- 选择：默认按序号顺序处理；用户指定优先级从其指示。
- **占用动作顺序固定**（防抢占）：登记表该行 状态→`执行中`、去向→工序ID → 建 `docs/works/<工序ID>/` 写 brief.md。三步一起做，只改登记表不建目录等于没领。
- 多条并入：同一主题的多个 OQ 可并入一个工序（brief 列全编号）；一个 OQ 只允许挂一个工序。
- brief.md 骨架：

```markdown
---
layer: works
module: <所属模块|global>
status: active
updated: <立项日>
---
# 工序：<主题>
## 需求（领取 OQ-7、OQ-9）
<引登记表口径原文，不复制改写>
## 背景
## 验收标准
- [ ] <从 OQ 口径细化，可核验>
## 影响面
- design/：<拟改文件与章节>
- 代码：<拟改页面/文件>
```

## 3. 执行（execute）

- **双轨同步**：代码改动与 design/ 文档修改同工序完成——活结论必须蒸馏进 design/ 具体文件章节（一处一事），只改代码不许收口。
- 过程文件（调研、方案迭代、实测记录）只进工作区，自由命名；代码产物归代码目录。
- 禁区对照：动代码前读 `design/code-refactoring.md`（绑定作用域硬规则等）与 `history/pitfalls.md`。

## 4. 验证门禁（verification gate）

- 按 `design/debugging-and-testing.md` 四层策略：语法层 `node --check`（秒级，必跑）→ 行为改动跑结构层（jsdom）或引擎层（Playwright WebKit）冒烟 → 交付前对受影响页面跑引擎层回归循环（模板见该文档第 2 节）。
- **未通过不得收口**。涉及遮挡/定位/命中测试的改动，jsdom 结果不作数，必须引擎层。
- 验证证据（命令＋结果摘要）写入 result.md；人工层（用户 Safari 手工验收）未完成的标注「待人工验收」，不得自行宣布完成。

## 5. 收口（write result.md）

- result.md：frontmatter `status: closed`；两块内容：**验收结果**（对照 brief 标准逐条＋证据）＋**结论落点表**（每条 OQ → design/ 哪个文件哪一节；每条新坑 → `history/pitfalls.md` 对策落点，带存续条件）。
- 回写登记表：状态→`已关闭`，结论落点列 = design 落点（文件§节）。条目保留不删除。
- **需求被否决**：状态→`已否决`，结论落点记裁定存档位置（追加到 `history/decisions/requirement-rulings.md`），同样不删除。
- **部分完成**：已完成部分正常收口；剩余范围登记新 OQ（续号）并在原条目结论落点注明承接编号。

result.md 骨架：

```markdown
---
layer: works
module: <所属模块|global>
status: closed
updated: <收口日>
---
# 收口：<主题>
## 验收结果
| 验收标准 | 结果 | 证据（命令/结果摘要） |
## 结论落点表
| OQ | 结论 | design 落点（文件§节） |
## 新坑登记
| 现象 | 存续条件 | 对策落点 |
```

## 6. 归档（archive）

- 前置：result.md 已写、登记表已回写——**收口是归档的前置条件**，两者缺一不可。
- 动作：工作区整目录移入 `docs/history/works/`；frontmatter `layer→history`、`status→frozen`；**目录名不改**（排序即时间线）。
- 归档后只读：活结论已在 design/，归档件仅作证据，**不得再被现行文档引用为设计依据**。

## 违规信号（自查即修）

- 登记表条目被删除、重编号或跳号补洞；
- 状态=执行中但 works/ 无对应目录，或反之（目录存在但条目仍=未领取）；
- 代码已改、design/ 无落点就写 result.md；验证证据缺失却宣布完成；待人工验收项被标完成；
- result.md 缺结论落点表；归档目录被改名；归档件被现行文档引用为依据。
