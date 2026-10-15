/**
 * AgentFlow 原型 · 页面冒烟测试
 * 用法: npm i --no-save jsdom && node tools/smoke-test.js
 * 逐页用 jsdom 加载 HTML 及其全部脚本（mock-data / ui / 页面 JS），
 * 捕获脚本加载期/初始化期的运行时错误与 console.error，非零退出码表示存在错误。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PAGES = fs.readdirSync(path.join(ROOT, 'pages')).filter(f => f.endsWith('.html')).sort();

(async () => {
  let failed = 0;
  for (const page of PAGES) {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => {
      const msg = (e && e.message) || String(e);
      if (/Could not load img|not implemented/.test(msg)) return; // jsdom 未实现的噪声
      errors.push(msg + (e && e.detail && e.detail.stack ? '\n    ' + String(e.detail.stack).split('\n').slice(0, 4).join('\n    ') : ''));
    });
    vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

    const file = path.join(ROOT, 'pages', page);
    let dom;
    try {
      dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
        url: 'file://' + file,
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole: vc,
        beforeParse(window) {
          window.HTMLElement.prototype.scrollIntoView = function () {};
          window.scrollTo = function () {};
        }
      });
    } catch (e) {
      errors.push('load failed: ' + e.message);
    }

    if (dom) {
      // 留 400ms 让 setTimeout(0/120) 的初始化回调执行完
      await new Promise(r => setTimeout(r, 400));
      dom.window.close();
    }

    const app = dom && dom.window.document.getElementById('app');
    const painted = !!(app && app.innerHTML.trim());
    if (errors.length || !painted) failed++;
    console.log((errors.length || !painted ? '✕ ' : '✓ ') + page +
      (painted ? '' : '  [页面未渲染出内容]'));
    errors.forEach(e => console.log('    ' + e));
  }
  console.log(failed ? '\n' + failed + ' 个页面存在问题' : '\n全部 ' + PAGES.length + ' 个页面冒烟通过');
  process.exit(failed ? 1 : 0);
})();
