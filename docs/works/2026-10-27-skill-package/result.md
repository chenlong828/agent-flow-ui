---
layer: works
module: skills
status: active
updated: 2026-10-29
---

# 结果：Skill 包形态重构（REQ-0015）

- 工序：`docs/works/2026-10-27-skill-package/`
- 需求：`REQ-0015`；场景：`SCN-0016`、`SCN-0017` 新建并 `verified`，`SCN-0005`、`SCN-0014`、`SCN-0015` 重写后仍 `verified`；`SCN-0013` 废弃（保留历史断言，runner 挂起）。
- 契约口径：B1 v1（zip 即真相、草稿生命周期、`/download`、16 KiB 正文）；UI 侧 v3 提案作废。

## 交付物

| 范围 | 变更 |
|---|---|
| 页面 | `assets/js/pages/skill-detail.js` 重写为查看/编辑/新建三态；正文由 `SKILL_MD` 渲染，编辑走草稿；`skill-common.js` 改为字节计数/模板/路径工具 |
| 客户端 | `assets/js/api.js` 新增 `draftCreate/draftGet/draftUpload/draftRename/draftDeleteFile/draftSave/draftCancel`、`downloadUrl/download`；`multipart` 不走 JSON 头；410/413/415/422 可读文案 |
| 夹具 | `tools/fake-b1.js` 重写为 v1 包模型：`body` + `files`、草稿生命周期、16 KiB/20 MiB/100 MiB 限制、428/409/410/413/422、`/document`、`/download` |
| BFF | `DEFAULT_MAX_BODY` 25 MiB；响应头新增 `content-disposition`、`x-content-type-options`；`multipart` 上传超时 120 s |
| 编辑器 | 7.7.0 单包 `assets/vendor/milkdown/7.7.0/skill-editor.esm.js`（177.6 KiB gzip，`DEP-0001`），查看/编辑共用 |
| 测试 | `verify-m1-scenarios.js` 五场景 21 条 DOM 用例；`tests/bff/bff.test.js` +2（>1 MiB 透传、下载头）；live 脚本改为草稿流程 |

## 验证证据（2026-10-29）

- `npm run test:gate`：PASS（五态一致性、场景索引、依赖准入、架构边界、场景追溯）。
- `npm test`：57 passed, 0 failed（含 BFF 12/12）。
- `npm run test:skill-render`：9/9 通过（真实 7.7.0 包，只读/可写/表格/代码高亮/HTML 不执行/round-trip）。
- `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-pages.js`：4/4 通过（skills 行数 12、`/document` 200/304）。
- `BASE_URL=http://127.0.0.1:3000 node tools/verify-b1-writes.js`：4/4 通过；Skill 走「建草稿 → save（If-Match）→ 启停 → 删除」，旧 `PUT /skills` 返回 404、缺 `If-Match` 返回 428。
- 引擎层（Playwright WebKit）：29/29 通过。`PLAYWRIGHT_MODULE=~/.cache/playwright-libs/1.49.1/node_modules/playwright-core`（库与浏览器曾被 macOS `tmp_cleaner` 按 3 天规则清空；已迁到 `~/.cache/playwright-libs/1.49.1` 与 `~/Library/Caches/ms-playwright/webkit-2104`，不再受 `/tmp` 清理影响；根因见 `dev-environment.md` §3.1）；覆盖只读/可写、表格/代码/排版、无横向溢出、真实下载 zip、查看→编辑分类回填、Ctrl+S 保存、拖拽上传、缺图兜底。

## 引擎探针发现并修复的问题（2026-10-29）

| # | 问题 | 根因 | 修复 | 防回归 |
|---|---|---|---|---|
| 1 | 点「下载」抛 `document.createElement is not a function`，不发请求 | `api.js` 内 `function document(kind,id)` 遮蔽全局 `document`，下载正在用它 | 内部改名 `fetchDocument`，下载改用 `window.document` | SCN-0017-T2 改走真实 `<a download>` 路径，不再用测试钩子短路 |
| 2 | 查看态点「编辑」后类别下拉为空，保存提示「请选择 Skill 类别」 | `enterEdit()` 未加载分类，校验又依赖 `state.cats` | 进入编辑时按需 `loadCats()` | SCN-0014-T2 改为从查看态点击进入 |
| 3 | 正文零排版：标题/段落无间距，表格无边框，代码块无底色 | 页面写了 `.sk-md-body` 样式但容器从未挂这个 class | 容器加 `sk-md-body`，并补 860px 阅读宽度、长串换行、表格/图片自适应 | 引擎断言标题字号/段落 margin、td 边框 |
| 4 | 长串/长代码撑破页面横向滚动（1440 下 3274px） | 缺 `overflow-wrap` 与 `min-width:0` | 上述样式 + 图片/代码块自适应 | 引擎断言 `scrollWidth <= innerWidth`（查看/编辑） |
| 5 | 缺图只显示裸破图 | 无 error 兜底 | 捕获 img error，加 `sk-img-broken` 占位样式 | 引擎断言占位 class |
| 6 | 无拖拽上传 | 只有 file input | 附件区支持 dragenter/over/drop | 引擎用 DataTransfer 投放断言 |
| 7 | 未保存修改取消无确认、无离开保护 | 无 dirty 状态 | dirty 提示 + 取消确认 + beforeunload + Ctrl/Cmd+S | SCN-0016-T3 断言确认弹窗 |
| 8 | 长正文保存按钮滚出视口 | `.page-header` 非 sticky | 编辑态操作栏吸顶 | 引擎断言 `position: sticky` |

修复后证据截图：`assets/probe-view-1440.png`（查看态）、`assets/probe-edit-1440.png`（编辑态）、`assets/probe-view-768.png`（窄屏）；探针脚本为一次性脚本，未入库。

## 偏差与后续

- B1 详情/文档/下载整包 inflate（契约 §6.2 要求仅读中心目录）：大包有延迟，属后端待优化项，不阻塞 UI。
- 附件无执行位（解压 0644）：执行侧需自行 `chmod`，已在场景与 spec 记录。
- 未做：版本历史、单文件读取/预览、在线执行、鉴权；图片不入包（用户确认）。
- 真实浏览器视觉验收（Safari）与人工交互走查未做，`architecture.md` 对应列保持「—」。
