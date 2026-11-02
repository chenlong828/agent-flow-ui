#!/usr/bin/env node
/**
 * Milkdown 编辑器运行时验证（Playwright WebKit + vendor bundle）
 * 用法: node tools/verify-skill-page-render.js
 * 覆盖: 只读渲染、编辑态可写、代码块高亮、原始 HTML 不执行、销毁。
 */
import assert from 'node:assert/strict';
import { startStaticServer, launchBrowser } from './test-harness.js';

const BODY = [
  '## 流程总述',
  '',
  '这是 <b>原始</b> HTML。',
  '',
  '| 列 A | 列 B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '```js',
  'const enabled = true;',
  '```',
  ''
].join('\n');

(async () => {
  const staticServer = await startStaticServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(staticServer.base + '/pages/skill-detail.html', { waitUntil: 'networkidle' });
    const facts = await page.evaluate(async (body) => {
      const vendor = await import('/assets/vendor/milkdown/7.7.0/skill-editor.esm.js');
      if (typeof vendor.mount !== 'function') throw new Error('vendor bundle 缺 mount 导出');
      const root = document.createElement('div');
      document.body.appendChild(root);
      const view = await vendor.mount(root, { markdown: body, editable: false });
      await new Promise((r) => setTimeout(r, 60));
      const pm = root.querySelector('.ProseMirror');
      const markdown = view.getMarkdown();
      const result = {
        hasProseMirror: !!pm,
        editable: pm && pm.getAttribute('contenteditable'),
        text: root.textContent,
        hasTable: !!root.querySelector('table'),
        hasCode: !!root.querySelector('pre code'),
        tokens: root.querySelectorAll('.token').length,
        hasBoldTag: !!root.querySelector('b'),
        scripts: root.querySelectorAll('script').length,
        markdown
      };
      await view.destroy();

      const editRoot = document.createElement('div');
      document.body.appendChild(editRoot);
      const edit = await vendor.mount(editRoot, { markdown: '# 编辑', editable: true, onChange: () => {} });
      await new Promise((r) => setTimeout(r, 60));
      const editPm = editRoot.querySelector('.ProseMirror');
      result.editEditable = editPm && editPm.getAttribute('contenteditable');
      await edit.destroy();
      return result;
    }, BODY);

    assert.ok(facts.hasProseMirror, 'Milkdown 未生成渲染容器');
    assert.equal(facts.editable, 'false', '只读容器仍可编辑');
    assert.ok(facts.text.includes('流程总述'), '标题未渲染');
    assert.ok(facts.hasTable, '表格未渲染');
    assert.ok(facts.hasCode, '代码块未渲染');
    assert.ok(facts.tokens > 0, '代码块缺语法高亮 token');
    assert.equal(facts.hasBoldTag, false, '原始 HTML 被当作标签渲染');
    assert.equal(facts.scripts, 0, '原始 HTML 被执行');
    assert.match(facts.markdown, /## 流程总述/, '序列化丢标题');
    assert.match(facts.markdown, /\| 列 A \| 列 B \|/, '序列化丢表格');
    assert.equal(facts.editEditable, 'true', '编辑态不可写');

    console.log('SCN-0015 编辑器层 9/9 通过');
  } finally {
    await browser.close();
    await staticServer.close();
  }
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
