---
layer: works
module: skills
status: active
updated: 2026-10-28
---

# 评估：`md_preview` 的所见即所得编辑器能否复用

评估对象：`~/productive/md_preview`（Typora 风格 macOS Markdown 编辑器，Swift 壳 + WKWebView，web 前端在 `web/`）。
结论先行：**不能整包引用，也不能共享运行底座**（它是原生壳 + 本地文件 + 桥，我们是浏览器页面 + B1 HTTP），**只在代码级参考它的编辑器实现**；建议自建一个约 177 KB gzip 的单文件 ESM 编辑器包，替换现有只读渲染包 `DEP-0001`。

## 1 事实盘点

| 项 | 事实 |
|---|---|
| 许可 | MIT，Copyright (c) 2026 chenlong（与本项目同一作者）；再分发需保留版权与许可声明 |
| 架构 | Swift/AppKit 壳（窗口、菜单、文件 IO、脏标记、PDF 导出）+ `WKWebView` 载本地 `web/dist`；前端无网络依赖 |
| 技术栈 | Milkdown **7.7.0**（ProseMirror）+ `plugin-math` 7.5.9 + KaTeX 0.16 + Mermaid 10 + `refractor`/Prism |
| 构建 | `web/build.mjs`：esbuild 打 IIFE，`minify`、`target: safari16.4`、外置 sourcemap |
| 产物体积 | `bundle.js` 3.9 MB（min）/ **1.24 MB gzip**；`bundle.css` 36 KB / 6.9 KB gzip；`dist/assets` 1.1 MB（KaTeX 字体） |
| 依赖体量 | `mermaid` 24 MB 源码、`katex` 4.3 MB、`refractor` 2.8 MB、`@milkdown/*` 3.5 MB |
| 桥协议 | JS 侧唯一表面 `window.mdbridge`：`init/setMarkdown/getMarkdown/markClean/setTheme/setZoom/toggleSource/formatCommand/tableCommand/focusAt/exportStandaloneHTML…`；JS→Swift 走 `window.webkit.messageHandlers.mdbridge.postMessage`（有 `try/catch`，浏览器里不会崩，但消息无人接收） |
| 全局契约 | `index.html` 固定 `#app`、`#source-editor`、`#find-bar`；菜单/快捷键由 Swift 侧驱动，JS 只是命令实现 |
| 文件相关 | 图片粘贴/插入依赖 Swift 把文件复制到文档旁 `resource/<md名>/`，路径换算用 `baseDir`；纯浏览器环境不可用 |
| 版本差 | 本项目现有只读包是 **7.22.3**，`md_preview` 是 **7.7.0**；已确认**统一下降到 7.7.0**，只维护一套（见 §8）。7.7 家族在表格命令上有回归，`md_preview` 为此自实现了 `tables.js`，本项目沿用其做法 |

### 1.1 运行底座差异（为什么不能共享实现）

| 维度 | `md_preview` | 本页 |
|---|---|---|
| 宿主 | Swift/AppKit + WKWebView，本地 `file://` | 浏览器页面（Safari / Chrome），`http://127.0.0.1` |
| 内容来源 | 本地 `.md` 文件，经原生桥 `setMarkdown/getMarkdown` | B1 HTTP API（DTO + `If-Match`），页面自己持草稿 |
| 文件 | 原生写盘（`resource/<md名>/`）、`baseDir` 换算 | 附件上传 API + 相对路径 |
| 菜单/快捷键 | Swift 菜单 → 桥 → JS 命令 | 页面工具栏 + JS 快捷键 |
| 主题 | 系统外观 + `data-theme` | 项目设计令牌 + 页面主题 |
| 错误上报 | `postMessage` 给原生 | Toast / 页面错误态 |

结论：能共享的只有 **ProseMirror/Milkdown 这一层的 DOM 行为与 Markdown 序列化**；桥、菜单、文件、主题、错误处理全部要按本页重写。所以是"抄实现"，不是"接组件"。

## 2 体积实测：真正需要多大

`md_preview` 的 1.24 MB gzip 主要是 Mermaid 与 KaTeX，不是编辑器本身。用它的 `node_modules` 打一个**最小可用编辑器**（`commonmark + gfm + history + listener + prism + clipboard + trailing`，去掉数学、图表、图片、导出、查找、统计），esbuild `--minify --format=esm --target=safari16`：

| 产物 | 原始 | gzip |
|---|---|---|
| 最小编辑器 ESM | 579,059 B（565 KiB） | **181,582 B（177.3 KiB）**（十进制 181.6 KB） |
| 现有只读渲染包 `DEP-0001` | — | 148.3 KiB |
| `md_preview` 全量 bundle | 3.9 MB | 1.24 MB |

- 现状准入阈值是单依赖 500 KiB、合计 300 KiB（`tools/check-deps.js` 的 `WARN_LIMITS`）。**2026-10-28 起已改为观测项，只 WARN 不失败**；设计按「节约优先」自证，而不是卡数字。
- 即便如此，仍建议**单包替换** `DEP-0001` 而不是并存：并存是 325.6 KiB，但真正的代价不是超门限，而是两份 Milkdown、两套版本、两份 CSS 与两套加载时机。
- 替换后总量 177.3 KiB；编辑器按需加载，不占首屏预算。
- 说明：以上实测就是目标版本 7.7.0，不存在版本换算；换版本时重测即可。若最终保留双包或加入额外能力（数学/图表），把实测值登记进 `dependencies.md` 即可，不需要为了数字砍功能。

## 3 能不能直接引用

| 方式 | 判断 | 理由 |
|---|---|---|
| iframe 嵌入整个 `md_preview` 应用 | 不可行 | 它是应用（菜单、查找栏、统计、导出）而非组件；全局 CSS 与 `#app` 布局会污染页面；1.24 MB gzip 只是附带问题 |
| 引入其 dist 并用 `webkit.messageHandlers` 垫片驱动 | 不推荐 | 体积问题同上；桥是双向协议，垫片要模拟 `changed/stats/sourceMode/jserror` 等事件；菜单命令在 Swift 侧，网页里没有触发入口 |
| fork 该仓库、加一个 embed 入口再发包 | 可行但不建议 | 跨仓库耦合、双份版本与发布流程；本项目「无构建步骤 + 自托管 vendor」的形态更适合在本地打一个包 |
| **复用其源码模式，在本仓库自建单文件 ESM** | **推荐** | 只带能力、不带应用；体积 177 KB；版本可与现有只读包统一 |

## 4 代码级参考清单

用户的最低特性要求是：表格、列表、缩进、Heading、图片、超级链接。逐项对应参考实现与本项目落地：

| 特性 | `md_preview` 参考 | 本项目落地 | 验收点 |
|---|---|---|---|
| Heading | `preset-commonmark` 标题 + `typora.css` 排版 | 同一 preset；CSS 改为设计令牌 | H1–H3 切换、大纲 |
| 列表 / 缩进 | `preset-gfm` + `list-indent.js`（每级 4 空格） | 照抄 4 空格序列化口径 | Tab/Shift+Tab、有序/无序/任务列表、往返一致 |
| 表格 | `preset-gfm` + `tables.js`（绕 7.7 回归自实现行列命令） | 先试 7.22.3 原生命令；不行再抄 `tables.js` | 插入、增删行列、删整表、单元格内编辑 |
| 图片 | `image-view.js`（点击切源码编辑）+ `image-paste.js` | 插入附件（`references/…`）+ 路径源码框；粘贴上传排 S4 | 显示、改路径、相对路径正确 |
| 超级链接 | `preset-commonmark` link + `commands.js` | 工具栏弹窗输入 URL | 插入、编辑、移除、编码 |
| 代码块 | `plugin-prism` + 额外语言注册 + token 色板 | 同配置，色板改设计令牌 | 语言高亮、多行粘贴 |
| 源码模式 | `toggleSource`（textarea） | 可选，作为兜底 | 切换不丢内容 |
| 撤销/重做 | `plugin-history` | 同 | 编辑后可撤销 |

8 项里 6 项能直接照抄实现思路；图片落点与主题必须按本页重写。

### 4.1 不要搬的

- Mermaid / KaTeX：Skill 正文不需要图表与公式。
- 导出 HTML/PDF、查找栏、字数统计、选区信息：属于编辑器应用能力，本期不做。
- 图片粘贴的原生写盘与 `baseDir`：只借鉴交互，落点换成上传 API。
- 桥协议与全局 DOM 契约（`#app`/`#source-editor`/`#find-bar`）：自建入口重写。
- Swift 壳（菜单、快捷键、文件监听）：与本项目无关。

### 4.2 编辑器功能验收（最低集）

1. 标题：H1–H3 增删改，切换不残留标记。
2. 列表：有序/无序/任务列表，Tab/Shift+Tab 缩进，保存后每级 4 空格。
3. 表格：插入表格、增删行列、删除整表、单元格内换行。
4. 图片：插入 `references/` 下附件、显示、改路径、删除。
5. 链接：插入/编辑/移除，URL 编码正确。
6. 代码块：围栏语言、Prism 高亮、多行粘贴。
7. 行内格式：加粗、斜体、行内代码、删除线。
8. 撤销/重做与中文 IME 不冲突。

## 5 推荐形态

- 一个 vendor 文件：`assets/vendor/milkdown/7.7.0/milkdown-editor.esm.js`，导出 `mount(el, markdown, opts)` / `getMarkdown()` / `setMarkdown(md)` / `destroy()`，`opts.editable` 控制查看/编辑。
- 页面适配层 `skill-detail-markdown.js` 只调用这套 API，不接触 Milkdown/ProseMirror 类型（沿用现有适配层边界）。
- 同一个包同时承担查看态与编辑态，建议**替换**现有只读包，避免两个 Milkdown 版本、两套 CSS、两次加载共存（这是工程取舍，不是体积门限逼出来的）。
- CSS 单独一个 vendor 文件（或内联进现有 `main.css` 的 skill 私有段），约 7 KB gzip。
- 工具栏最小集见契约提案 6.1；表格/列表操作复用 `tables.js`、`list-indent.js` 的实现思路。

## 6 构建与准入

现状问题：`DEP-0001`（7.22.3）在仓库里**没有任何构建脚本或来源记录**，只有 SHA-256 与体积，不可复现。新增编辑器包不能重复这个问题。

**已确认（2026-10-28）：选 A**（仓外构建、提交入口源码 + 构建说明），并且**统一到 7.7.0**：重建后替换 `DEP-0001`（只读与编辑同一个包），不保留 7.22.3。

三个选项：

| 选项 | 说明 | 代价 |
|---|---|---|
| A. 仓外构建、只提交产物 + 构建说明（**选定**） | 在 `dependencies.md` 的 `note` 写清入口、esbuild 版本、命令；入口源码放 `tools/vendor-build/milkdown-editor/`（不参与运行，`package.json` 保持空） | 最小；仍是"手工可复现" |
| B. 登记 `form: build` 例外，建 dev 构建链 | 新增 `package.json` devDependencies + CI 构建 | 触碰"无构建步骤 / 零依赖"基线，P1 |
| C. 继续无来源 | 与现状一致 | 供应链不可复现，不建议 |

落地要求：`dependencies.md` 里把"入口源码路径 + 工具版本 + 命令"写成准入必填项；`DEP-0001` 的 `version` 改为 7.7.0、`gzipKb` 用重测值。

## 7 风险与验证

| 风险 | 影响 | 验证/缓解 |
|---|---|---|
| Markdown 往返丢内容 | ProseMirror schema 不认识的原始 HTML 会在保存时被丢弃 | 夹具往返测试：frontmatter、HTML 块、表格、代码块、链接、任务列表、中文标点 |
| 中文 IME | 组合输入时选区/提交异常 | 真实浏览器手测（Safari + Chrome） |
| 版本切换 | 7.22.3 → 7.7.0 是**降级**：7.7 表格命令有已知回归，部分插件 API 也更旧 | 表格命令一律走 `tables.js`；重跑只读渲染、frontmatter、代码高亮断言 |
| 体积偏大 | 首屏/加载变慢（门限已放开，不阻塞） | 打包后记录实测；按需加载；必要时去掉 Prism 额外语言 |
| 只读/编辑同包 | 查看态误可编辑 | `editable:false` + 只读断言（引擎测试） |

验证计划：
1. 产物：`gzip` 体积、`sha256` 登记；超过 `check-deps` 的 `WARN_LIMITS` 时记录警告即可，不因体积砍功能。
2. 行为：挂载/取回/设置、表格增删行列、列表缩进、代码块高亮、撤销重做。
3. 往返：`fixtures/*.md` 逐份 `set → get` 比对（允许规范化差异，需白名单）。
4. 只读：`editable:false` 时输入无效、DOM 不可编辑。
5. 引擎：`tools/verify-skill-page-engine.js` 增加编辑器断言。

## 8 待确认

已定（2026-10-28）：

- 版本：统一 **7.7.0**，替换现有 7.22.3 只读包，只维护一套。
- 构建：选 **A**（仓外构建 + 提交入口源码与说明）。

剩余：

- 是否允许从 `md_preview` 复制源码片段（MIT，同一作者；需在文件头保留版权声明与来源链接）。默认允许。
