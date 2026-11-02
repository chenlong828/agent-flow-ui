#!/usr/bin/env node
/**
 * 引擎层验证（Playwright WebKit，无头）
 * 覆盖: 查看态只读渲染（标题/表格/代码高亮）/ 编辑态可写 / 无结构化 Tab / 原始 HTML 不执行
 * 运行（需 :3000 静态服务 + BFF + B1）:
 *   NODE_PATH=<playwright 依赖目录> PLAYWRIGHT_BROWSERS_PATH=<浏览器目录> \
 *   BASE_URL=http://127.0.0.1:3000 node tools/verify-skill-page-engine.js
 */
'use strict';

import { loadPlaywright } from './playwright.js';

const { webkit } = loadPlaywright();
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label);
  cond ? pass++ : fail++;
};

async function api(method, path, body, revision) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (revision != null) headers['If-Match'] = '"' + revision + '"';
  const res = await fetch(BASE + '/api/v1' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
  return { status: res.status, data };
}

const BODY = [
  '# 引擎验证标题',
  '',
  '普通段落，包含 **加粗** 与 `行内代码`，并带一个超长无断点串：' + 'LONGTOKEN'.repeat(38),
  '',
  '| 列一 | 列二 | 列三 | 列四 | 列五 | 列六 | 列七 | 列八 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '| 很长的单元格内容需要换行处理 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |',
  '',
  '```js',
  "const longLine = '" + 'x'.repeat(200) + "';",
  '```',
  '',
  '![缺失图](/assets/not-exist.png)',
  '',
  '<script>window.__XSS__ = 1</script>'
].join('\n');

async function createSkill() {
  const name = '引擎验证 Skill ' + Date.now().toString(36);
  const draft = await api('POST', '/skill-drafts', {});
  assert.equal(draft.status, 201, '创建草稿 -> ' + draft.status);
  const saved = await api('POST', '/skill-drafts/' + draft.data.id + '/save', {
    name, categoryCode: 'coding', description: '引擎验证用，可删除。', tags: ['engine'], body: BODY
  });
  assert.equal(saved.status, 201, '保存草稿 -> ' + saved.status + ' ' + JSON.stringify(saved.data));
  return { id: saved.data.id, revision: saved.data.revision, name };
}

async function removeSkill(skill) {
  const detail = await api('GET', '/skills/' + skill.id);
  const revision = detail.data && detail.data.revision;
  const res = await api('DELETE', '/skills/' + skill.id, undefined, revision);
  assert.ok(res.status === 204 || res.status === 404, '清理 -> ' + res.status);
}

(async () => {
  const skill = await createSkill();
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  let errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  try {
    /* A. 查看态只读渲染 */
    await page.goto(BASE + '/pages/skill-detail.html?id=' + encodeURIComponent(skill.id), { waitUntil: 'networkidle' });
    await page.waitForSelector('#sk-body .ProseMirror', { timeout: 15000 });
    ok(await page.evaluate(() => document.querySelector('#sk-body .ProseMirror').getAttribute('contenteditable') === 'false'),
      '查看态正文只读');
    ok(await page.evaluate(() => document.querySelector('#sk-body').innerText.includes('引擎验证标题')), '正文标题已渲染');
    ok(await page.evaluate(() => !!document.querySelector('#sk-body table')), '表格已渲染');
    ok(await page.evaluate(() => !!document.querySelector('#sk-body pre code')), '代码块已渲染');
    ok(await page.evaluate(() => document.querySelectorAll('#sk-body .token').length > 0), '语法高亮生效');
    ok(await page.evaluate(() => document.querySelector('#sk-body script') === null), '原始 script 未注入');
    ok(await page.evaluate(() => window.__XSS__ === undefined), '原始 HTML 未执行');
    ok(await page.evaluate(() => document.querySelectorAll('[data-tab]').length === 0), '无结构化/文档 Tab');
    ok(await page.evaluate(() => document.querySelector('#sk-files').textContent.includes('SKILL.md')), '文件清单含 SKILL.md');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '查看态无横向溢出');
    ok(await page.evaluate(() => {
      const td = document.querySelector('#sk-body td');
      return !!td && parseFloat(getComputedStyle(td).borderTopWidth) > 0;
    }), '表格边框样式生效');
    ok(await page.evaluate(() => {
      const h1 = document.querySelector('#sk-body h1');
      const p = document.querySelector('#sk-body p');
      if (!h1 || !p) return false;
      return parseFloat(getComputedStyle(h1).fontSize) > parseFloat(getComputedStyle(p).fontSize) &&
        parseFloat(getComputedStyle(p).marginTop) > 0;
    }), '标题层级与段落间距生效');
    const broken = await page.waitForSelector('#sk-body img.sk-img-broken', { timeout: 4000 }).then(() => true).catch(() => false);
    ok(broken, '缺图有兜底样式');
    ok(errs.length === 0, '查看态无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

    /* A2. 真实下载路径（不注入钩子） */
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#sk-download')
    ]);
    ok(/\.zip$/i.test(download.suggestedFilename()), '下载触发 zip 文件（' + download.suggestedFilename() + '）');

    /* B. 编辑态可写 */
    errs = [];
    await page.goto(BASE + '/pages/skill-detail.html?id=' + encodeURIComponent(skill.id) + '&mode=edit', { waitUntil: 'networkidle' });
    await page.waitForSelector('#sk-editor .ProseMirror', { timeout: 15000 });
    ok(await page.evaluate(() => document.querySelector('#sk-editor .ProseMirror').getAttribute('contenteditable') === 'true'),
      '编辑态正文可写');
    ok(await page.evaluate(() => !!document.querySelector('#sk-save')), '编辑态有保存按钮');
    ok(await page.evaluate(() => document.querySelector('#sk-files').textContent.includes('SKILL.md')), '编辑态 SKILL.md 只读出现');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.page-header')).position === 'sticky'), '编辑态操作栏吸顶');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '编辑态无横向溢出');
    ok(errs.length === 0, '编辑态无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

    /* C. 查看态点「编辑」：分类必须可选、可保存 */
    errs = [];
    await page.goto(BASE + '/pages/skill-detail.html?id=' + encodeURIComponent(skill.id), { waitUntil: 'networkidle' });
    await page.waitForSelector('#sk-edit', { timeout: 15000 });
    await page.click('#sk-edit');
    await page.waitForSelector('#sk-editor .ProseMirror', { timeout: 15000 });
    const catOptions = await page.waitForFunction(
      () => document.querySelectorAll('#sk-cat option').length >= 4, null, { timeout: 8000 }
    ).then(() => true).catch(() => false);
    ok(catOptions, '查看态进入编辑后类别可选');
    ok(await page.evaluate(() => document.querySelector('#sk-cat') && document.querySelector('#sk-cat').value === 'coding'), '类别回填当前值');
    await page.evaluate(() => {
      const el = document.querySelector('#sk-desc');
      el.value = '引擎验证编辑后的描述';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    ok(await page.evaluate(() => document.querySelector('#sk-dirty') && !document.querySelector('#sk-dirty').hidden), '编辑后显示未保存提示');
    await page.keyboard.press('Control+s');
    await page.waitForSelector('#sk-body .ProseMirror', { timeout: 15000 });
    ok(await page.evaluate(() => document.querySelector('.page-header').textContent.includes('v1.1')), 'Ctrl+S 保存后版本递增到 v1.1');
    ok(errs.length === 0, '查看→编辑→保存无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));

    /* D. 拖拽上传 */
    errs = [];
    await page.click('#sk-edit');
    await page.waitForSelector('#sk-attach', { timeout: 15000 });
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['drop-body'], 'drop.md', { type: 'text/markdown' }));
      document.getElementById('sk-attach').dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: dt
      }));
    });
    const dropped = await page.waitForFunction(
      () => document.querySelector('#sk-files').textContent.includes('scripts/drop.md'), null, { timeout: 8000 }
    ).then(() => true).catch(() => false);
    ok(dropped, '拖拽上传落到 scripts/');
    await page.click('#sk-cancel');
    await page.waitForSelector('#mc-ok', { timeout: 5000 });
    await page.click('#mc-ok');
    await page.waitForSelector('#sk-edit', { timeout: 5000 });
    ok(true, '有未保存修改时取消需确认且能回到查看态');
    ok(errs.length === 0, '拖拽上传无运行时错误' + (errs.length ? ' → ' + errs.join('; ') : ''));
  } finally {
    await context.close();
    await browser.close();
    await removeSkill(skill);
  }

  console.log('\n引擎层：' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('引擎层验证失败:', e && e.message ? e.message : e);
  process.exit(1);
});
