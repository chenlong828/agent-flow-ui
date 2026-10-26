#!/usr/bin/env node
/**
 * 引擎层验证（Playwright WebKit，无头）
 * 覆盖: Skill 专门页结构化五章 / 文档 Tab 只读渲染 / 语法高亮 / 原始 HTML 不执行
 * 运行（需 :3000 静态服务 + B1）:
 *   NODE_PATH=<playwright 依赖目录> PLAYWRIGHT_BROWSERS_PATH=<浏览器目录> \
 *   BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js
 */
'use strict';

const { webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('assert/strict');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label);
  cond ? pass++ : fail++;
};

async function firstSkillId() {
  const res = await fetch(BASE + '/api/v1/skills?limit=1');
  assert.equal(res.status, 200, 'GET /api/v1/skills -> ' + res.status);
  const body = await res.json();
  assert.ok(body.items && body.items.length > 0, 'B1 无 Skill 可用');
  return body.items[0].id;
}

(async () => {
  const skillId = await firstSkillId();
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  /* A. 专门页结构化五章 + 无抽屉 */
  errs = [];
  await page.goto(BASE + '/pages/skill-detail.html?id=' + encodeURIComponent(skillId), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !!document.getElementById('sk-tab')), '专门页出现结构化 / 文档 Tab');
  ok(await page.evaluate(() => document.querySelectorAll('#sk-viewbox details').length === 5), '结构化五章 5 个 details');
  ok(await page.evaluate(() => !document.querySelector('.drawer')), '不再出现详情抽屉');
  ok(await page.evaluate(() => !!document.querySelector('[data-tab="document"]')), '查看态提供文档 Tab');
  ok(errs.length === 0, '结构化视图无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  /* B. 文档 Tab 只读渲染 + 语法高亮 + 原始 HTML 不执行 */
  errs = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errs.push('console.error: ' + msg.text()); });
  await page.evaluate(() => document.querySelector('[data-tab="document"]').click());
  try {
    await page.waitForSelector('#sk-doc-root .ProseMirror', { timeout: 10000 });
  } catch (e) {
    const html = await page.evaluate(() => document.getElementById('sk-doc-root') ? document.getElementById('sk-doc-root').innerHTML : null);
    const meta = await page.evaluate(() => { const el = document.querySelector('.skd-docmeta'); return el ? el.textContent : null; });
    console.error('Milkdown 未渲染: meta=' + meta + ', html=' + String(html).slice(0, 300) + ', errors=' + errs.join(' | '));
    throw e;
  }
  ok(await page.evaluate(() => !!document.getElementById('sk-doc-root')), '文档 Tab 渲染容器出现');
  ok(await page.evaluate(() => document.getElementById('sk-doc-text') === null), '文档不再走 <pre> 原文视图');
  ok(await page.evaluate(() => !!document.querySelector('#sk-doc-root .ProseMirror')), 'Milkdown 渲染容器出现');
  ok(await page.evaluate(() => document.querySelector('#sk-doc-root .ProseMirror').getAttribute('contenteditable') === 'false'), '渲染容器不可编辑');
  ok(await page.evaluate(() => document.querySelectorAll('#sk-viewbox script').length === 0), '页面不注入脚本');
  if (await page.evaluate(() => document.querySelectorAll('#sk-doc-root pre code').length > 0)) {
    ok(await page.evaluate(() => document.querySelectorAll('#sk-doc-root .token').length > 0), '代码块出现语法高亮 token');
  }
  ok(errs.length === 0, '文档 Tab 无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  /* C. 缺 id / 无效 id 显式报错 */
  errs = [];
  await page.goto(BASE + '/pages/skill-detail.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.getElementById('page-body').textContent.includes('缺少 Skill id')), '缺 id 显示显式错误');
  await page.goto(BASE + '/pages/skill-detail.html?id=' + encodeURIComponent('00000000-0000-0000-0000-000000000000'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('page-body').textContent.includes('目标不存在或已被删除')), '无效 id 显示显式错误');
  ok(await page.evaluate(() => !!document.getElementById('sk-retry')), '错误态提供重试入口');
  errs = [];
  ok(errs.length === 0, '错误态无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

  await browser.close();
  console.log(`\n引擎层验证：${pass} 通过 / ${fail} 失败`);
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
