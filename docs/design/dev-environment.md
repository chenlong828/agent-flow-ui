---
layer: design
module: global
status: current
updated: 2026-10-28
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

- **库**：`~/.cache/playwright-libs/<version>/node_modules/playwright-core`（版本入目录名，多版本可共存）。2026-10-29 定版为 `~/.cache/playwright-libs/1.49.1`。
- **浏览器**：`~/Library/Caches/ms-playwright/webkit-2104/`（Playwright 在 macOS 的默认缓存位置；Linux 为 `~/.cache/ms-playwright`）。按构建号分目录，多项目/多版本共享且互不覆盖，运行时**不需要**设 `PLAYWRIGHT_BROWSERS_PATH`。
- **加载方式**：脚本统一从 `tools/playwright.js` 的 `loadPlaywright()` 取模块：优先 `PLAYWRIGHT_MODULE`，其次本机缓存，最后普通模块解析。不要用 `NODE_PATH`（全局模块搜索根、影响整条 `require` 链且 ESM 忽略）。
- **根因（2026-10-29 查明）**：macOS 自带 `com.apple.tmp_cleaner`（`/usr/libexec/tmp_cleaner`，launchd 每天 0 点执行）会删除 `/tmp` 下 **atime/mtime/ctime 都超过 3 天**的文件，再删空的旧目录。它按文件删除、保留目录骨架，所以表现为「依赖目录还在、`require` 却报 MODULE_NOT_FOUND」。与重启无关（本次 `kern.boottime` 为 10 月 2 日）。**`/tmp` 只适合临时验证，不适合长期存放测试依赖**；历史路径 `/tmp/dsh`、`/tmp/afdev-deps`、`/tmp/pw` 均已废弃。
- 版本配对由库内 `browsers.json` 决定：`playwright-core@1.49.1 → webkit revision 2104 / WebKit 18.2`；换库版本必须同时换对应浏览器构建。
- 测试栈已无 jsdom：纯逻辑用 Node 自带 `node:test`，DOM/网络用 Playwright WebKit。
- 场景测试脚本已入库：`tools/verify-user-menu.js`（SCN-0001，引擎层）、`tools/verify-m1-scenarios.js`（SCN-0004..0011 + SCN-0013..0017，Playwright，12 个执行场景、49 条用例；SCN-0013 已废弃挂起；原工作流列表/编辑器场景已归档，由 SCN-0018/0019 取代）；结构层 `tools/smoke-test.js`（Playwright 13 页）；真实 B1：`tools/verify-b1-pages.js` / `tools/verify-b1-writes.js`。历史脚本随工序归档在 `history/works/`，不再作现行入口。

### 3.2 安装步骤（按顺序执行）

1. 安装库（npm 缓存重定向到 `/tmp`，因为默认 `~/.npm` 在本机被屏蔽）：
   ```bash
   mkdir -p ~/.cache/playwright-libs/1.49.1
   npm_config_cache=/tmp/afdev-npm-cache \
     npm install --prefix ~/.cache/playwright-libs/1.49.1 playwright-core@1.49.1
   ```
2. 下载浏览器构建。`npx playwright install webkit` 的 CDN **直连与 npmmirror 镜像都返回 404**，不要反复重试；手动走代理下载：
   ```bash
   curl -x socks5h://127.0.0.1:2080 -L -o /tmp/webkit-2104.zip \
     "https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2104/webkit-mac-15-arm64.zip"
   ```
   大小应为 65870767 字节（构建号 2104 对应 1.49.1；升级库版本时从报错信息读出新构建号）。
3. 解压到默认缓存并补安装标记：
   ```bash
   mkdir -p ~/Library/Caches/ms-playwright/webkit-2104
   unzip -q /tmp/webkit-2104.zip -d ~/Library/Caches/ms-playwright/webkit-2104
   touch ~/Library/Caches/ms-playwright/webkit-2104/INSTALLATION_COMPLETE
   ```
4. 运行引擎脚本（项目根目录；不设 `PLAYWRIGHT_BROWSERS_PATH`）：
   ```bash
   PLAYWRIGHT_MODULE=$HOME/.cache/playwright-libs/1.49.1/node_modules/playwright-core \
     BASE_URL=http://127.0.0.1:3000/pages/ node tools/verify-user-menu.js
   PLAYWRIGHT_MODULE=$HOME/.cache/playwright-libs/1.49.1/node_modules/playwright-core \
     BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js
   ```
5. 2026-10-29 实测：上述位置 + 命令下，SCN-0001 引擎 45/45、Skill 引擎 29/29 通过。

### 3.3 能做什么、不能做什么

- 能做：真实 WebKit 引擎渲染、层叠与遮挡断言、坐标与拖拽验证、截图、localStorage 持久化验证、`pageerror` 事件收集 JavaScript 运行时错误。
- 已知局限（均有实测证据，详见坑档案）：
  - 无头 Chrome 在本机启动即崩溃（报 `Failed to create headless user data directory container`，随后进程 Trap），**不要再尝试 Chrome，直接用 WebKit**。
  - 合成鼠标事件（`page.mouse`）的坐标与页面内部命中测试在缩放场景下不一致，验证拖拽必须改用页面内程序化派发事件（详见《调试方案》文档第 4 节）。
  - 该 WebKit 构建对 CSS `zoom` 的支持是残缺的（计算值存在、布局无视），不能用它推断真实 Safari 的 zoom 行为。

### 3.4 业务场景 runner（Playwright WebKit）

- 用途：跑 `SCN-0004..0011`、`SCN-0014`、`SCN-0015`、`SCN-0016`、`SCN-0017` 的业务断言（各场景至少 3 正 1 反；`SCN-0013` 已废弃、挂起不执行；原工作流列表/编辑器场景已归档，现由 `SCN-0018/0019` 取代）；执行层是真实 WebKit，不是 DOM 模拟。
- 无需另装 jsdom。`tools/test-harness.js` 在 `127.0.0.1:0` 自起临时静态服务，用 `page.route` 把 `/api/v1/**` 接到 `tools/fake-b1.js`，每个场景独立 page；结束后关闭浏览器与静态服务。
- 运行：`npm run test:scenarios`；单场景 `node tools/verify-m1-scenarios.js SCN-0007`。
- Milkdown 渲染层：`npm run test:skill-render`，用真实 WebKit + vendor bundle 验证只读渲染、语法高亮与原始 HTML 不执行。
- 引擎层（Playwright WebKit，需 `:3000` 静态服务 + B1）：
  ```bash
  PLAYWRIGHT_MODULE=$HOME/.cache/playwright-libs/1.49.1/node_modules/playwright-core \
  BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js
  ```
  也可用 `npm run test:skill-engine`，并带上 `PLAYWRIGHT_MODULE`。
- runner 在 `127.0.0.1:0` 自起临时静态 HTTP，结束后关闭；不依赖 `:3000`，也不要求先启动 `server.js`。必须走 HTTP 而不是 `file://`：页面用 `sessionStorage` 传递 `df-new-workspace`，不透明源下会直接抛错。
- 工作流：`npm run test:workflow`（`node --test tests/workflow` + `tools/verify-workflow-list.js` + `tools/verify-workflow-editor.js`）；runner 用 `tools/fake-b3.js` 与 `tools/fake-b1.js`，不写真实 B3；真实 B3 只读走查见 `docs/works/2026-10-30-workflow-ui/brief.md`。
- `npm test` 包含此脚本；`npm run test:gate` 是只跑门禁与 BFF、不跑浏览器的快速子集。首次运行需要已安装 WebKit（见 §3.2）。

### 3.5 真实 B1 页面 runner（Playwright + 运行中的 BFF）

- 前置：`API_BASE` 指向的 B1 已启动，且 `node server.js` 在 `127.0.0.1:3000` 运行。
- 读验证：`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`，四页各断言列表行/卡片数；不写库。
- 写验证：`BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`，每页用唯一名称创建一条，随后经 BFF 更新、启停并删除；失败会清理残留。**会写并删除真实 B1 测试数据，运行前确认目标环境。**
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
