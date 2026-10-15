---
layer: design
module: global
status: current
updated: 2025-10-14
---

# 代码结构与公共组件

> 系统层现行真相：技术基线、代码目录结构、`DF.*` 公共组件清单。
> 背景说明：2025 年对 12 个页面 JS 中重复、冗余的 HTML 模板代码做过一次系统梳理，
> 将反复出现的 UI 结构抽取为 `DF.*` 公共组件。所有页面 id/class 与交互行为保持不变。

## 1 · 梳理结论（重构前的重复清单）

### A 类 · 跨页面重复的 UI 模式

| # | 重复模式 | 重构前 | 抽取为 |
|---|---|---|---|
| 1 | 空态 `.empty > .e-ic + 文案 + 按钮` | 14 处 / 8 页 | `DF.empty(opt)` |
| 2 | 表格骨架 `.tbl-wrap > table.tbl > thead/tbody` | 13 处 / 9 页 | `DF.table(cols, rows, opt)` |
| 3 | 搜索框 `.search-box > icon + input.inp` | 7 处 / 6 页 | `DF.searchBox(id, placeholder, value, sm)` |
| 4 | 弹窗 footer「取消/确定」对 + `b.closest('.modal')` 手工绑定 | 15 处 / 9 页 | `DF.modal.form(opt)` |
| 5 | 表单字段 `.field > label + .req + input + .hint` | 40+ 处 | `DF.field(label, inner, opt)` |
| 6 | 复选挑选弹窗（experts 两份逐行相同的实现） | ~100 行 | `DF.modal.picker(opt)` |
| 7 | 统计卡 `.stat-card`（三页各写一套） | 12 张卡 | `DF.statCard(o)` / `DF.statRow(cards, style)` |
| 8 | 键值对 `.kv > .k + span` | 5 处 | `DF.kv(pairs, opt)` |
| 9 | Tabs 条 `.tabs > .tab` | 4 页 | `DF.tabsHtml(items, active, attr, wrapAttrs)` |

### B 类 · 重复造轮子（直接删除或换用已有实现）

| # | 问题 | 处理 |
|---|---|---|
| 10 | harnesses.js 自建 `confirmBox()`（40 行），注释称 `DF.modal.confirm` 有 bug | ui.js 早已修复（workspaces.js 注释可证），整段删除换回 `DF.modal.confirm` |
| 11 | `byId` 三处重写（skills / keys / workflow-list `findWf`） | 统一走 `MOCK.byId` |
| 12 | Blob 下载样板两份（workflow-list `exportDsl`、编辑器 DSL 导出） | `DF.download(filename, content, mime)` |
| 13 | localStorage/sessionStorage 裸 `try-catch` 读写 5 处 | `DF.lsGet/lsSet/ssGet/ssSet/ssRemove` |
| 14 | 局部 `esc` 包装与 `deep` 深拷贝各页重写 | `var esc = DF.esc`、`DF.deep` |

### C 类 · 页面间复制粘贴的领域代码

| # | 问题 | 处理 |
|---|---|---|
| 15 | `createdText()` 两份逐字节相同（且 workspaces.js 那份是死代码，从未调用） | 删除死代码；活代码入 `workspace-common.js` |
| 16 | `treeHtml()` 工作区目录树两份 | 入 `assets/js/pages/workspace-common.js`（`WSC.treeHtml`），两页共用 |
| 17 | 跨页联动（`df-new-workspace` 的 sessionStorage 读写）两份 | `WSC.readNewWs / saveNewWs / dropNewWs / syncNewWs` |

### D 类 · HTML 层

- 12 页 `<head>` 细节漂移：viewport meta 仅 2 页有 → 已全部补齐；
- 标题后缀「· AgentFlow」仅 7 页有 → 已全部统一。

## 2 · 公共组件 API（`assets/js/ui.js`，window.DF）

### 2.1 页面构件

```js
DF.searchBox(id, placeholder, value, sm)            // 搜索框（icon + input.inp）
DF.empty(opt)                                       // 空态
//   opt = { icon: '图标名|emoji|空串', iconSize, title(转义), html(原样),
//           style, action: { id?, act?, label, icon?, primary?, sm?, style? } }
DF.table(cols, rows, opt)                           // 表格骨架；cols 传 null 则无表头
//   cols = ['名称', {t:'操作', s:'style="width:200px"'}]，rows = ['<tr>…</tr>', …]
//   opt = { cls(附加 table 类), wrapCls(附加 tbl-wrap 类), wrapStyle }
DF.field(label, inner, opt)                         // 表单字段；opt = { required, hint, style }
DF.kv(pairs, opt)                                   // 键值对；pairs = [[key, valueHtml], …]
DF.tabsHtml(items, active, attr, wrapAttrs)         // Tabs；items = [{k, label, count}]
DF.statCard(o)                                      // 统计卡
//   o = { k, v, d?, dCls?, side?, dFlex?, dot?, click?, id?, title?, style? }
DF.statRow(cards, style)
```

### 2.2 弹窗扩展

```js
DF.modal.form(opt)   // 自动渲染并绑定「取消 / 确定」footer 的表单弹窗
//   opt = { title, width, body, okText?, okDisabled?, footerExtra?(置于取消前),
//           onOk(body, close), onMount(body, close, okBtn), onClose?, resizable? }
//   onOk 内自行决定是否 close()（校验失败可不关）。

DF.modal.picker(opt) // 复选挑选弹窗（专家页 Skill/工具挑选等）
//   opt = { title, width, items:[{id, name, mono?, tag?, tagColor?, summary}],
//           okText?, noneText?, onOk(ids, close) }
```

### 2.3 工具函数

```js
DF.lsGet(k) / DF.lsSet(k, v)                        // localStorage（隐私模式不抛错）
DF.ssGet(k) / DF.ssSet(k, v) / DF.ssRemove(k)       // sessionStorage
DF.download(filename, content, mime)                // Blob + a[download]
DF.deep(obj)                                        // JSON 深拷贝
```

> `DF.modal.confirm / DF.modal.open / DF.drawer` 等 API 维持原样；
> 带自定义 footer 的弹窗（向导、单按钮提示、多扩展按钮）仍直接用 `DF.modal.open`。

## 3 · 新增文件

| 文件 | 作用 |
|---|---|
| `assets/js/pages/workspace-common.js` | 工作区列表页 / 详情页共用模块（`window.WSC`）：跨页联动、`createdText` 确定性创建日期、只读目录树 `treeHtml`、`pad` |
| `tools/smoke-test.js` | 页面冒烟测试：jsdom 逐页加载 HTML+全部脚本，捕获运行时错误 |

## 4 · 效果

- JS 总行数 6,569 → 5,831（**-738 行，约 -11%**），其中各列表页重复模板平均缩减 10%~15%；
- 「取消/确定」footer 绑定逻辑从 15 处收敛为 `DF.modal.form` 1 处；
- 挑选弹窗从 2 份 ~50 行实现收敛为 `DF.modal.picker` 1 处；
- experts.html 私有样式中 `.ex-pick-row` 上收为 main.css 的 `.df-pick-row`；
- 死代码清除：workspaces.js 的 `createdText`、harnesses.js 的 `confirmBox`、instance-detail.js 未使用的局部 `deep`、workflow-list.html 的 `.wl-btnrow`、tools.html 的 `.tl-cicd-empty`。

## 5 · 验证方式

```bash
# 1) 语法检查（无依赖）
for f in assets/js/ui.js assets/js/mock-data.js assets/js/pages/*.js; do node --check $f; done

# 2) 页面冒烟（需临时安装 jsdom，不入 package.json）
npm i --no-save jsdom && node tools/smoke-test.js
#    ✓ 12/12 页面加载并渲染出 #app 内容，无运行时错误

# 3) 交互抽查（重构期间人工执行）
#    modal.form 取消/确定/校验拦截、harnesses 注册弹窗 footerExtra、
#    keys 添加弹窗 okDisabled 联动、MOCK 数据写入断言等 15 项全部通过。
```

> 已知测试环境限制：jsdom 不支持跨文档导航（`location.href` 跳转类断言需以数据变化代替），
> 浏览器中行为正常。

## 6 · 后续可选事项（本次未做）

- instances.js 与 instance-detail.js 的暂停/恢复/终止节点状态迁移规则仍各写一份，
  可再收敛为共享的「实例控制」小模块；
- 各页 `<style>` 私有样式可进一步审查上收通用部分（本次仅上收挑选行样式）；
- 若页面继续增多，可考虑将页面 JS 改为 ES Module 并引入构建步骤（当前保持零构建）。
