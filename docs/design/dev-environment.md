---
layer: design
module: global
status: current
updated: 2026-10-26
---

# 开发环境配置（本机实况）

本文档记录在本机开发、运行、验证本项目所需的全部环境事实。所有条目均经过实际操作验证，不是理论配置说明。环境变化时更新本文档并同步检查坑档案（`docs/history/pitfalls.md`）中的存续条件。

## 1. 项目本体与本地运行

- 项目形态：agent-flow 前端 + 同源 BFF，原生 HTML / CSS / JavaScript 为主，无构建步骤；第三方运行时依赖默认零，例外须经准入（`design/dependencies.md`）。
- 静态服务器与 BFF：项目根目录 `server.js`（Node.js 原生模块）做静态托管与 `CMP-bff` 挂载；`bff/` 只转发 `/api/v1/*` 与 `/healthz`。
- 第三方运行时依赖：准入后放 `assets/vendor/<name>/<version>/`，来源/版本/SHA-256/体积登记在 `design/dependencies.md`；下载后 `shasum -a 256` 核对，`npm run check:deps` 校验；运行时不得引用 CDN。
- 启动方式与端口：
  - 默认端口 3000，可用环境变量 `PORT` 覆盖（例如 `PORT=3001 node server.js`）。
  - 根路径 `/` 返回 302 跳转到 `/pages/workflow-list.html`。
  - B1 后端默认 `http://127.0.0.1:3100`，可用 `API_BASE` 覆盖；BFF 超时/body 上限用 `BFF_TIMEOUT_MS` / `BFF_MAX_BODY`。
  - 本次会话中以分离（detached）方式常驻运行，日志输出到 `/tmp/agentflow-server.log`。
- 验证服务是否存活：`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pages/workflow-list.html`，期望 200；同源 BFF 用 `curl http://localhost:3000/healthz` 验证。

## 2. 网络代理（本机固定事实）

- 本机默认**直连**网络，环境变量中不配置任何代理。
- 本机 `127.0.0.1:2080` 常驻一个 SOCKS5 代理，可同时访问被限制的境外站点与国内站点；命令行使用时加前缀 `ALL_PROXY=socks5h://127.0.0.1:2080 <命令>`（`socks5h` 表示域名解析也走代理）。
- 适用命令：`curl`、`git`、多数命令行下载工具。
- 内置的网页抓取工具（web 类工具）**不走**这个代理；需要代理才能访问的站点必须在 bash 中用 curl 加前缀完成。
- 实际用到代理的场景（本次会话真实发生）：下载 Playwright 的 WebKit 浏览器构建包——直连和 npmmirror 镜像均返回 404，只有通过代理访问 `cdn.playwright.dev` 才能拿到。

## 3. Playwright 与 WebKit 浏览器（自动化测试核心）

这是本项目做引擎级验证的基础设施，安装过程每一步都有坑，完整记录如下。

### 3.1 安装位置与约定

- 测试与构建期依赖装在项目目录之外（保持仓库自包含；运行时依赖走 vendor 准入）：历史用 `/tmp/dsh`，2026-10-23 复跑用 `/tmp/afdev-deps`。临时目录可能被清理，清理后按 3.2 重装。
- 浏览器构建存放目录：`/tmp/dsh/pw-browsers`，运行时通过环境变量 `PLAYWRIGHT_BROWSERS_PATH=/tmp/dsh/pw-browsers` 指定。
- 场景测试脚本已入库：`tools/verify-user-menu.js`（SCN-0001，引擎层）、`tools/verify-m1-scenarios.js`（SCN-0002..0011 + SCN-0013 + SCN-0014 + SCN-0015，DOM/jsdom，13 场景、55 条用例）；结构层 `tools/smoke-test.js`（jsdom）；真实 B1：`tools/verify-b1-pages.js` / `tools/verify-b1-writes.js`。历史脚本随工序归档在 `history/works/`，不再作现行入口。

### 3.2 安装步骤（按顺序执行）

1. 安装 Playwright 库时必须重定向 npm 缓存目录（默认的 `~/.npm` 在本机被屏蔽，会直接报权限错误）：
   ```bash
   npm_config_cache=/tmp/dsh/.npm-cache npm install playwright@1.49.1 --prefix /tmp/dsh
   ```
2. `npx playwright install webkit` 会尝试从 CDN 下载浏览器构建，**直连与 npmmirror 镜像都返回 404**，不要反复重试。改为手动下载（必须走代理）：
   ```bash
   curl -x socks5h://127.0.0.1:2080 -o /tmp/dsh/webkit.zip \
     "https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2104/webkit-mac-15-arm64.zip"
   ```
   下载得到的文件大小应为 65870767 字节，可用 `ls -l` 核对（版本号 2104 与 Playwright 1.49.1 对应；若升级 Playwright，构建号会变化，从报错信息里读出期望的构建号）。
3. 解压到 `PLAYWRIGHT_BROWSERS_PATH` 指向的目录下，目录名必须与 Playwright 期望的一致（报错信息中会写出，例如 `webkit-2104`），然后在解压出的目录内创建空文件 `INSTALLATION_COMPLETE`（Playwright 用它判断安装已完成，缺了会认为未安装）。
4. 运行任何测试脚本时都带上环境变量（脚本在项目内）：
   ```bash
   PLAYWRIGHT_BROWSERS_PATH=/tmp/dsh/pw-browsers \
   NODE_PATH=/tmp/afdev-deps/node_modules node tools/verify-user-menu.js
   NODE_PATH=/tmp/afdev-deps/node_modules node tools/smoke-test.js
   NODE_PATH=/tmp/afdev-deps/node_modules node tools/verify-m1-scenarios.js
   ```
5. 依赖安装（2026-10-23 复跑实际使用）：
   ```bash
   npm_config_cache=/tmp/afdev-npm-cache npm install --prefix /tmp/afdev-deps jsdom@24.1.3 playwright-core@1.49.1
   ```
   注意 `playwright-core` 只装库、不自动下载浏览器；浏览器仍按第 2、3 步准备 WebKit 2104。

### 3.3 能做什么、不能做什么

- 能做：真实 WebKit 引擎渲染、层叠与遮挡断言、坐标与拖拽验证、截图、localStorage 持久化验证、`pageerror` 事件收集 JavaScript 运行时错误。
- 已知局限（均有实测证据，详见坑档案）：
  - 无头 Chrome 在本机启动即崩溃（报 `Failed to create headless user data directory container`，随后进程 Trap），**不要再尝试 Chrome，直接用 WebKit**。
  - 合成鼠标事件（`page.mouse`）的坐标与页面内部命中测试在缩放场景下不一致，验证拖拽必须改用页面内程序化派发事件（详见《调试方案》文档第 4 节）。
  - 该 WebKit 构建对 CSS `zoom` 的支持是残缺的（计算值存在、布局无视），不能用它推断真实 Safari 的 zoom 行为。

### 3.4 DOM 场景 runner（jsdom，测试依赖不入仓库）

- 用途：跑 `SCN-0002..0011`、`SCN-0013`、`SCN-0014`、`SCN-0015` 的业务断言（各场景至少 3 正 1 反）；执行层是 jsdom，不是真实引擎。
- 安装（只在需要跑场景时安装，不写入 `package.json`）：
  ```bash
  npm_config_cache=/tmp/agentflow-npm-cache npm install --no-save --package-lock=false jsdom
  ```
  2026-10-26 实测 `jsdom@30.1.3` 可跑通 55/55。
- 运行：`npm run test:scenarios`；单场景 `node tools/verify-m1-scenarios.js SCN-0007`。
- Milkdown 渲染层：`npm run test:skill-render`，用 jsdom + vendor bundle 验证只读渲染、语法高亮与原始 HTML 不执行。
- 引擎层（Playwright WebKit，需 `:3000` 静态服务 + B1）：
  ```bash
  NODE_PATH=/tmp/afdev-deps/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/dsh/pw-browsers \
  BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js
  ```
  也可用 `npm run test:skill-engine`，再按上面环境变量补 Playwright 依赖。
- runner 在 `127.0.0.1:0` 自起临时静态 HTTP，结束后关闭；不依赖 `:3000`，也不要求先启动 `server.js`。必须走 HTTP 而不是 `file://`：页面用 `sessionStorage` 传递 `df-new-workspace`，不透明源下会直接抛错。
- `npm test` 不包含此脚本，保持工具链零外部包；jsdom 缺失时脚本会给出安装提示。

### 3.5 真实 B1 页面 runner（jsdom + 运行中的 BFF）

- 前置：`API_BASE` 指向的 B1 已启动，且 `node server.js` 在 `127.0.0.1:3000` 运行。
- 读验证：`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`，四页各断言列表行/卡片数；不写库。
- 写验证：`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`，每页用唯一名称创建一条，随后经 BFF 更新、启停并删除；失败会清理残留。
- 也可用 `npm run test:b1-pages` / `npm run test:b1-writes`；两者不纳入 `npm test`，避免无后端时误报。

## 4. Safari 手工调试链路（真机引擎）

- Safari 远程自动化（safaridriver / WebDriver）需要先执行 `sudo safaridriver --enable`（对应系统设置里的「允许远程自动化」）；未开启时连接直接被拒。本次会话未启用（没有 sudo 权限交互），自动化一律走上面的 Playwright WebKit。
- 用户侧手工验收路径（告知用户的操作）：
  - 强制刷新绕过陈旧缓存：`Command + Option + R`。用户报「页面不显示/样式错乱」时，第一响应永远是让用户强刷，再要控制台报错（`Option + Command + C` 打开 Web 检查器的控制台）。
  - Web 检查器附加：Safari 菜单「开发」→ 选中页面即可断点、看网络、执行表达式。

## 5. JavaScriptCore 语法冒烟（最轻量的引擎检查）

- 系统自带 JavaScriptCore 命令行解释器，路径：
  ```
  /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
  ```
- 用途：把浏览器端 JavaScript 文件在 Safari 同源的 JavaScript 引擎里跑一遍，抓 `SyntaxError`（语法不兼容 Safari 的情况，例如过早使用某新语法）。运行时的 `ReferenceError: Can't find variable: DF / window / document` 是**预期噪音**（浏览器全局对象在命令行不存在），出现这类错误恰恰说明语法解析已通过。
- 局限：只能查语法，查不出 DOM 绑定作用域错误、层叠错误等任何行为问题。

## 6. 相关文档

- 调试方法与断言模板：`docs/design/debugging-and-testing.md`
- 坑档案（环境类坑的存续条件）：`docs/history/pitfalls.md`
