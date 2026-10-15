---
layer: design
module: global
status: current
updated: 2026-10-13
---

# 调试方案（分层测试策略与断言模板）

本文档是本项目调试与验证的现行做法。核心原则：**不同类型的缺陷必须用对应层次的工具去抓，低层次工具抓不到的问题不要反复重试**（例如用 jsdom 反复查"弹层为什么被遮住"）。

## 1. 四层测试策略（由轻到重）

| 层次 | 工具 | 能抓到 | 抓不到 |
|---|---|---|---|
| 语法层 | `node --check`、JavaScriptCore 命令行解释器（路径见环境文档第 5 节） | 语法错误、引擎不兼容的新语法 | 一切行为问题 |
| 结构层 | jsdom（安装于 /tmp/dsh，项目外） | DOM 结构、事件绑定是否执行、选择器作用域错误、函数抛错 | 层叠/遮挡、CSS zoom、fixed 定位、命中测试、真实布局尺寸 |
| 引擎层 | Playwright WebKit（真实 WebKit 无头浏览器） | 渲染结果、元素尺寸与位置、遮挡关系、持久化、控制台错误 | 真实 Safari 独有行为（如 CSS zoom 的完整实现） |
| 人工层 | 用户 Safari 手工验收 | 全部真实行为 | 需要用户配合反馈 |

执行顺序：改完代码先跑语法层（秒级）→ 涉及行为跑结构层或引擎层冒烟 → 交付用户前对全部页面跑一遍引擎层回归循环。

## 2. 引擎层回归循环（全站冒烟模板）

对所有页面循环加载，收集每个页面的 JavaScript 运行时错误（`pageerror` 事件），同时断言公共结构（顶部栏、字体选择器、侧栏宽度）。这个模式在本项目反复使用，直接复用：

```javascript
const { webkit } = require('/tmp/dsh/node_modules/playwright');
const pages = ['workflow-list', 'workflow-editor', 'skills', 'experts', 'harnesses',
               'tools', 'instances', 'instance-detail', 'analytics',
               'workspaces', 'workspace-detail', 'keys'];
(async () => {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let errs = [];
  page.on('pageerror', e => errs.push(e.message));   // 页面未捕获异常
  for (const p of pages) {
    errs = [];
    await page.goto('http://localhost:3000/pages/' + p + '.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);                   // 等待渲染与初始化脚本
    console.log(p.padEnd(18), '错误:', errs.length ? errs.join('; ') : '无');
  }
  await browser.close();
})();
```

带查询参数的页面（`workflow-editor.html?id=w1`、`instance-detail.html?id=INS-2042`、`workspace-detail.html?id=...`）按需追加参数。需要验证「字体大小设置跨页持久」时，先在第一页执行 `page.selectOption('#df-font', 'xl')` 再开始循环——同一个浏览器上下文内 localStorage 会延续。

## 3. 层叠与遮挡断言（elementFromPoint 命中测试）

jsdom 永远查不出「弹层画在暗色遮罩下面」这类问题（它不做布局与层叠计算），必须用真实引擎做命中测试断言：在目标位置问浏览器"这个点上最顶层的元素是谁"。

```javascript
// 断言：弹窗整体在遮罩之上（取弹窗左上角内侧一点，命中的应是弹窗自身或其子元素）
const hit = await page.evaluate(() => {
  const m = document.querySelector('.modal');
  const r = m.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + 30, r.top + 40);
  return el && el.closest('.modal') ? 'modal-on-top(OK)' : 'COVERED';
});
```

同样的模式适用于抽屉（`.drawer`）、确认框、右键菜单。配套的静态层级约定见 `assets/css/main.css` 顶部的层级注释（顶部栏 100、遮罩 200、抽屉 201、弹窗 220、菜单 250、提示 300）。

## 4. 拖拽与坐标验证（合成事件的坐标系规则）

**规则一：Playwright 的鼠标 API（`page.mouse`）在页面存在 CSS zoom / transform 缩放时，派发坐标与页面内部命中测试可能不一致**（实测中事件目标全部落到 `<html>` 上，拖拽完全失效）。此时改用**页面内程序化派发**——用 `new MouseEvent()` 构造事件、`dispatchEvent` 派发，事件坐标从 `getBoundingClientRect()`（返回的是视觉坐标）取，与真实用户事件的坐标系一致：

```javascript
// 在页面上下文里完成一次完整的拖拽（mousedown → mousemove × N → mouseup）
const res = await page.evaluate(() => {
  const node = document.querySelector('.cv-node[data-node="n5"]');
  node.scrollIntoView({ block: 'center', inline: 'center' });   // 先滚入视口
  const r = node.getBoundingClientRect();
  const sx = r.left + 60, sy = r.top + 14;                      // 视觉坐标
  node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: sx, clientY: sy }));
  for (let i = 1; i <= 5; i++) {
    document.dispatchEvent(new MouseEvent('mousemove',
      { bubbles: true, clientX: sx + 150 * i / 5, clientY: sy + 60 * i / 5 }));
  }
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: sx + 150, clientY: sy + 60 }));
  const r2 = document.querySelector('.cv-node[data-node="n5"]').getBoundingClientRect();
  return { dx: Math.round(r2.left - r.left), dy: Math.round(r2.top - r.top) };
});
// 断言：视觉位移与鼠标位移一致（内部数学已按缩放系数归一时）
```

**规则二：先 `scrollIntoView` 再取坐标**。画布内容超出视口时，直接用元素坐标会命中视口外的空白区域，位移恒为 0——遇到「拖了但纹丝不动」先怀疑这一点。

**规则三：测试脚本自己的问题优先排除**。本会话多次出现"修复了半天，其实是测试脚本变量写错/坐标点落在把手边界外/断言对象选错"的情况。位移为 0 时按顺序检查：事件有没有派发到正确元素（在页面里挂捕获阶段监听器记录 `event.target`）→ 坐标是否在视口内 → 是否被别的层挡住。

**规则四：验证 `clientX` 起源的弹层必须派发带坐标的合成事件**。程序化 `el.click()` 派发的点击**没有坐标**（`clientX = clientY = 0`），以 `e.clientX` 为弹层定位起源的组件会把弹层画到屏幕最左——2026-10-13 真实踩到：验证旧「更多」菜单时 `b.click()` 后断言"菜单不在按钮附近"，其实是测试事件缺坐标，页面代码无缺陷。写法：

```javascript
const br = b.getBoundingClientRect();
b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: br.left + br.width / 2, clientY: br.top + br.height / 2 }));
```

**规则五：断言弹层位置前先确认 x 语义**。锚定下拉传的是**右缘**坐标、右键菜单传的是**左缘**坐标（`DF.menu` 两分支，见《代码重构要点》§4）——用左缘防溢出公式钳制右缘坐标会把菜单整体推偏（2026-10-13 真实踩到：默认字号右偏 8px、最大字号右偏 25px，且命中测试仍通过，位置断言抓得住、命中测试抓不住）。

## 5. 引擎行为探针验证法（不信任文档与计算值）

对引擎行为有疑问时（例如"这个 Safari 版本支不支持某个 CSS 属性"），写一个**最小 HTML 探针**：已知尺寸的元素 + 简单断言，一次测一个行为矩阵。方法论：

1. 探针元素用固定像素尺寸，断言只看 `getBoundingClientRect()` 的实际渲染值；
2. 同时测「声明式（样式表）」与「CSSOM 动态赋值」两条路径，两者可能行为不同；
3. 同时测「流内元素」与「fixed 定位元素」，缩放类属性对两者经常不一致；
4. `getComputedStyle()` 返回值**不作为生效证据**——实测中出现过计算值显示 `zoom: 2` 而布局完全无视的情况；
5. 结论必须标注验证所用的引擎与构建号，推广到其他引擎前重新探测。

本次会话用探针法确认的事实（详见坑档案）：Playwright WebKit 构建 2104 中 html 级 CSS zoom 对内容无任何视觉作用，但会把 fixed 元素的包含块（视口）按 zoom 比例缩小。据此实现了「探测生效则用 zoom、探测失效则用 transform 兜底」的双路径方案（见 `assets/js/ui.js` 的 `applyZoom`）。

## 6. 用户报告响应流程（人工层）

用户报「页面白屏 / 不显示 / 样式错乱 / 点了没反应」时按序处理：

1. **先要求强制刷新**（`Command + Option + R`）——Safari 的陈旧缓存是此类报告的最常见原因，本会话真实发生；
2. 仍异常时，要用户打开控制台（`Option + Command + C`）读红色报错，最好截图；
3. 用同源引擎（Playwright WebKit）复现同样操作路径；复现不了再怀疑版本差异（用探针法验证可疑特性）；
4. 服务端问题先看日志：`tail -20 /tmp/agentflow-server.log`。

## 7. 状态与持久化的断言要点

- 字体大小设置存于 localStorage 键 `df-font`（取值 s / m / l / xl），验证持久化用 `page.reload()` 后读取 `document.getElementById('df-font').value` 与 `document.documentElement.style.zoom`。
- 注意 Playwright 每次 `browser.newPage` 是全新上下文，localStorage 为空——要测持久化必须在**同一个 page 会话内**先设置再刷新。
- 原型的业务数据全部是内存模拟数据（`assets/js/mock-data.js`），刷新即重置；跨页传递的临时数据用 sessionStorage（键 `df-new-instance`、`df-new-workspace`，均为单条目）。验证时不要把"刷新后数据消失"当缺陷报。
