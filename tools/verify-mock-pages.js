/* MOCK 页关闭与演示模式（SCN-0020，Playwright WebKit）
 * 覆盖：默认导航隐藏 / 直达占位 / ?demo=1 放行并在本标签页保持 / ?demo=0 退出 / 占位页不渲染业务数据。
 * 运行：node tools/verify-mock-pages.js（需本机 Playwright，见 docs/design/dev-environment.md） */
import { startStaticServer, launchBrowser, openPage } from './test-harness.js';

const MOCK_PAGES = ['analytics', 'workspaces', 'keys'];
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); cond ? pass++ : fail++; };
const navLabels = (page) => page.locator('.sidebar .nav-item .lbl').allTextContents();

(async () => {
  const server = await startStaticServer();
  const base = server.base + '/pages/';
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  /* T1 默认：三个 MOCK 页直达显示占位页，不渲染业务数据 */
  console.log('T1. 默认关闭：直达显示占位页');
  const targets = [
    { name: 'analytics', url: 'analytics.html' },
    { name: 'workspaces', url: 'workspaces.html' },
    { name: 'workspace-detail', url: 'workspace-detail.html?id=ws1' },
    { name: 'keys', url: 'keys.html' }
  ];
  for (const { name, url } of targets) {
    errors.length = 0;
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      gate: !!document.getElementById('mock-demo-open'),
      text: (document.getElementById('page-body') || {}).textContent || '',
      tables: document.querySelectorAll('#page-body table').length,
      rows: document.querySelectorAll('#page-body tbody tr').length
    }));
    ok(state.gate && state.text.includes('已临时关闭'), name + ' 显示占位页');
    ok(state.tables === 0 && state.rows === 0, name + ' 占位页不渲染业务表格（table=' + state.tables + ' rows=' + state.rows + '）');
    ok(errors.length === 0, name + ' 无运行时错误' + (errors.length ? ' → ' + errors.join('; ') : ''));
  }

  /* T2 默认：导航隐藏三项，用户区菜单与 live 页不受影响 */
  console.log('T2. 默认关闭：导航隐藏');
  await page.goto(base + 'workflow-list.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  let labels = await navLabels(page);
  ok(labels.join('|') === '工作流|专家管理|Skill 库|Harness 管理|工具与集成|运行实例', '导航 6 项且不含三项 MOCK 页（' + labels.join('|') + '）');
  const menu = await page.evaluate(() => {
    document.getElementById('df-user').click();
    const m = document.querySelector('.menu');
    return m ? Array.from(m.querySelectorAll('.mi')).map((x) => x.textContent.trim()).join('|') : '';
  });
  ok(menu === '个人 Key 管理|退出登录', '用户区菜单仍含「个人 Key 管理」（' + menu + '）');
  await page.evaluate(() => document.body.click());
  await page.goto(base + 'instances.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok(!(await page.locator('#mock-demo-open').count()), 'live 页（运行实例）不出现占位');

  /* T3 演示模式：?demo=1 在本标签页恢复，?demo=0 退出 */
  console.log('T3. 演示模式放行与保持');
  await page.goto(base + 'keys.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  await page.click('#mock-demo-open');
  await page.waitForURL(/keys\.html\?demo=1/);
  await page.waitForTimeout(350);
  ok(/demo=1/.test(page.url()) && (await page.locator('#mock-demo-open').count()) === 0, '「以演示模式打开」回到本页并渲染真实页面');
  const keyRows = await page.locator('#ky-list tbody tr').count();
  ok(keyRows > 0, 'Key 列表渲染 ' + keyRows + ' 行');
  labels = await navLabels(page);
  ok(labels.length === 9 && labels.includes('效能看板'), '演示模式下导航恢复 9 项（' + labels.join('|') + '）');
  await page.goto(base + 'analytics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok((await page.locator('.stat-card').count()) > 0, '同标签页进入效能看板仍为演示模式（KPI 卡已渲染）');
  await page.goto(base + 'analytics.html?demo=0', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok(!!(await page.locator('#mock-demo-open').count()), '?demo=0 退出演示模式后回到占位页');

  /* T4 反例：演示模式不落 localStorage，新标签页不继承 */
  console.log('T4. 反例：演示模式不跨标签页');
  const stored = await page.evaluate(() => {
    const hit = Object.keys(localStorage).filter((k) => /demo/i.test(k));
    return hit.length;
  });
  ok(stored === 0, '演示模式不写 localStorage（命中 ' + stored + ' 项）');
  const other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await other.goto(base + 'keys.html', { waitUntil: 'networkidle' });
  await other.waitForTimeout(300);
  ok(!!(await other.locator('#mock-demo-open').count()), '新标签页直达仍显示占位页');
  await other.close();

  await page.close();
  await browser.close();
  await server.close();
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('脚本失败:', e); process.exit(1); });
