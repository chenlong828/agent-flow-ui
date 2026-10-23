/* 引擎层冒烟（Playwright WebKit，无头）：SCN-0001 顶栏用户区「陈龙」+ 下拉菜单
 * 覆盖：12 页显示名 / 菜单弹出与切换 / 菜单项 / 位置与命中测试 / 登出确认（取消+确认）/ 最大字号兜底缩放路径
 * 运行（需 :3000 静态服务）:
 *   NODE_PATH=<playwright 依赖目录> PLAYWRIGHT_BROWSERS_PATH=<浏览器目录> node tools/verify-user-menu.js
 * 模块名可用 PLAYWRIGHT_MODULE 覆盖，默认 playwright-core。*/
const { webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const BASE = process.env.BASE_URL || 'http://localhost:3000/pages/';
const pages = ['workflow-list', 'workflow-editor', 'skills', 'experts', 'harnesses',
               'tools', 'instances', 'instance-detail', 'analytics',
               'workspaces', 'workspace-detail', 'keys'];
const queryParams = { 'workflow-editor': '?id=w1', 'instance-detail': '?id=INS-2042', 'workspace-detail': '?id=ws1' };
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); cond ? pass++ : fail++; };

(async () => {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let errs = [];
  page.on('pageerror', e => errs.push(e.message));

  /* A. 全 12 页：右上角显示「陈龙」且页面无运行时错误 */
  console.log('A. 全站显示名与页面健康');
  for (const p of pages) {
    errs = [];
    await page.goto(BASE + p + '.html' + (queryParams[p] || ''), { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const name = await page.evaluate(() => { const u = document.getElementById('df-user'); return u ? u.textContent.trim() : null; });
    /* 芯片 textContent = 头像「陈」+ 名称「陈龙」→ '陈陈龙'，故断言包含名称且不含旧名（FLOW-2：断言对象选错伪装缺陷） */
    ok(!!name && name.includes('陈龙') && !name.includes('陈明'), p + ' 右上角显示「陈龙」');
    ok(errs.length === 0, p + ' 无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));
  }

  /* 菜单状态采集：项、位置（视觉坐标）、命中测试 */
  const openMenu = () => page.evaluate(() => document.getElementById('df-user').click());
  const menuState = () => page.evaluate(() => {
    const m = document.querySelector('.menu');
    if (!m) return null;
    const items = Array.from(m.querySelectorAll('.mi')).map(x => x.textContent.trim());
    const r = m.getBoundingClientRect(), u = document.getElementById('df-user').getBoundingClientRect();
    const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { items, top: r.top, left: r.left, width: r.width, chipBottom: u.bottom, chipRight: u.right,
             hit: c && c.closest('.menu') ? 'on-top' : 'COVERED' };
  });

  /* B. 下拉交互（workflow-list，默认字号） */
  console.log('B. 下拉交互与位置断言（默认字号）');
  errs = [];
  await page.goto(BASE + 'workflow-list.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await openMenu(); await page.waitForTimeout(80);
  let s = await menuState();
  ok(!!s, '点击用户区弹出菜单');
  if (s) {
    ok(s.items.join('|') === '个人 Key 管理|退出登录', '菜单项 = 个人 Key 管理 / 退出登录');
    ok(s.top >= s.chipBottom - 1, '菜单位于用户区正下方 (menu top=' + Math.round(s.top) + ' ≥ chip bottom=' + Math.round(s.chipBottom) + ')');
    ok(Math.abs(s.chipRight - (s.left + s.width)) <= 1, '菜单右缘对齐用户区右缘 (Δ=' + Math.round(s.chipRight - s.left - s.width) + 'px)');
    ok(s.hit === 'on-top', '命中测试：菜单中心点命中最顶层即菜单自身（不被遮挡）');
  }
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(80);
  ok(await page.evaluate(() => !document.querySelector('.menu')), '点击菜单外任意处收起');
  await openMenu(); await page.waitForTimeout(80);
  ok(await page.evaluate(() => !!document.querySelector('.menu')), '菜单开→收→再点用户区重新弹出');
  await openMenu(); await page.waitForTimeout(80);
  ok(await page.evaluate(() => !document.querySelector('.menu')), '菜单开时再点用户区收起（切换语义）');
  ok(errs.length === 0, '交互全程无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  /* C. 个人 Key 管理跳转 */
  console.log('C. 个人 Key 管理快捷入口');
  errs = [];
  await openMenu(); await page.waitForTimeout(80);
  await page.evaluate(() => Array.from(document.querySelectorAll('.menu .mi')).find(x => x.textContent.includes('个人 Key 管理')).click());
  await page.waitForTimeout(300);
  ok(/keys\.html$/.test(new URL(page.url()).pathname), '点「个人 Key 管理」跳转 keys.html（当前 ' + page.url() + '）');

  /* D. 退出登录：取消无副作用 / 确认有反馈 */
  console.log('D. 退出登录确认流程');
  await openMenu(); await page.waitForTimeout(80);
  await page.evaluate(() => Array.from(document.querySelectorAll('.menu .mi')).find(x => x.textContent.includes('退出登录')).click());
  await page.waitForTimeout(120);
  let modalTitle = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? m.querySelector('.d-head').textContent.trim() : null; });
  ok(modalTitle === '退出登录', '点「退出登录」弹出确认框');
  await page.evaluate(() => { const b = document.querySelector('.modal #mc-no'); if (b) b.click(); });
  await page.waitForTimeout(120);
  ok(await page.evaluate(() => !document.querySelector('.modal')), '取消 → 确认框关闭');
  ok(await page.evaluate(() => (document.getElementById('toast-box') || { childElementCount: 0 }).childElementCount === 0), '取消无 Toast 副作用');
  errs = [];
  await openMenu(); await page.waitForTimeout(80);
  await page.evaluate(() => Array.from(document.querySelectorAll('.menu .mi')).find(x => x.textContent.includes('退出登录')).click());
  await page.waitForTimeout(120);
  await page.evaluate(() => { const b = document.querySelector('.modal #mc-ok'); if (b) b.click(); });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => (document.getElementById('toast-box') || { childElementCount: 0 }).childElementCount >= 1), '确认退出 → Toast 反馈');
  ok(await page.evaluate(() => !document.querySelector('.modal') && !document.querySelector('.menu')), '确认后确认框与菜单均已关闭');
  ok(errs.length === 0, '登出流程无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  /* E. 最大字号（transform 兜底缩放路径）：位置与命中 */
  console.log('E. 最大字号（兜底缩放路径）位置断言');
  await page.goto(BASE + 'workflow-list.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const sel = document.getElementById('df-font'); sel.value = 'xl'; sel.dispatchEvent(new Event('change')); });
  await page.waitForTimeout(150);
  const mode = await page.evaluate(() => document.documentElement.style.zoom ? 'zoom' : 'transform 兜底');
  await openMenu(); await page.waitForTimeout(80);
  s = await menuState();
  ok(!!s && s.top >= s.chipBottom - 1 && s.hit === 'on-top' && Math.abs(s.chipRight - (s.left + s.width)) <= 1,
     mode + ' 路径：菜单位于用户区下方、右缘对齐 (Δ=' + (s ? Math.round(s.chipRight - s.left - s.width) : '—') + 'px)、不被遮挡 (Δtop=' + (s ? Math.round(s.top - s.chipBottom) : '—') + ')');
  await page.evaluate(() => { const sel = document.getElementById('df-font'); sel.value = 'm'; sel.dispatchEvent(new Event('change')); });

  /* F. 旧调用方回归：menu() 默认左缘语义未变（workflow-list 更多 / keys 行更多，clientX 起源）。
   * 程序化 el.click() 无坐标（e.clientX=0 会把 clientX 起源的菜单画到屏幕最左），必须派发带坐标的 MouseEvent。 */
  console.log('F. 旧调用方回归（默认左缘语义）');
  errs = [];
  await page.goto(BASE + 'workflow-list.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  let more = await page.evaluate(() => {
    const b = document.querySelector('[data-act="more"]');
    if (!b) return null;
    const br = b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: br.left + br.width / 2, clientY: br.top + br.height / 2 }));
    const m = document.querySelector('.menu');
    if (!m) return null;
    const mr = m.getBoundingClientRect();
    return { items: Array.from(m.querySelectorAll('.mi')).map(x => x.textContent.trim()).join('|'),
             dLeft: Math.round(mr.left - br.left), halfW: Math.round(br.width / 2), fit: mr.right <= innerWidth };
  });
  ok(!!more && more.items === '复制|导出 DSL|删除', 'workflow-list「更多」菜单正常弹出（' + (more ? more.items : '未弹出') + '）');
  ok(!!more && Math.abs(more.dLeft - more.halfW) <= 2 && more.fit,
     '「更多」菜单画在触发点（按钮中心）处 (Δleft=' + (more ? more.dLeft : '—') + ' ≈ 半宽 ' + (more ? more.halfW : '—') + ') 且不溢出视口');
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(60);
  await page.goto(BASE + 'keys.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  more = await page.evaluate(() => {
    const b = document.querySelector('.ky-more');
    if (!b) return null;
    const br = b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: br.left + br.width / 2, clientY: br.top + br.height / 2 }));
    const m = document.querySelector('.menu');
    return m ? Array.from(m.querySelectorAll('.mi')).map(x => x.textContent.trim()).join('|') : null;
  });
  ok(more === '绑定用途|删除', 'keys 行「更多」菜单正常弹出（' + (more || '未弹出') + '）');
  ok(errs.length === 0, '旧调用方回归无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  await browser.close();
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('脚本失败:', e); process.exit(1); });
