/**
 * AgentFlow 原型 · 页面冒烟测试（Playwright WebKit）
 * 用法: node tools/smoke-test.js
 * 逐页在真实浏览器加载 ESM 页面，捕获初始化期运行时错误与 console.error；
 * B1 请求由 tools/fake-b1.js 经 Playwright route 注入，非零退出码表示存在错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startStaticServer, launchBrowser, openPage } from './test-harness.js';

const PAGES = fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.html')).sort();

(async () => {
  const staticServer = await startStaticServer();
  const browser = await launchBrowser();
  let failed = 0;

  for (const file of PAGES) {
    const name = file.replace(/\.html$/, '');
    let ctx;
    try {
      ctx = await openPage(browser, staticServer.base, name);
      const painted = await ctx.page.locator('#app').evaluate((el) => el.innerHTML.trim().length > 0);
      if (ctx.errors.length || !painted) failed++;
      console.log((ctx.errors.length || !painted ? '✕ ' : '✓ ') + file + (painted ? '' : '  [页面未渲染出内容]'));
      ctx.errors.forEach((e) => console.log('    ' + e));
    } catch (err) {
      failed++;
      console.log('✕ ' + file + '  [加载失败] ' + err.message);
    } finally {
      if (ctx) await ctx.page.close();
    }
  }

  await browser.close();
  await staticServer.close();
  console.log(failed ? '\n' + failed + ' 个页面存在问题' : '\n全部 ' + PAGES.length + ' 个页面冒烟通过');
  process.exit(failed ? 1 : 0);
})();
