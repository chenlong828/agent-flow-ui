#!/usr/bin/env node
/**
 * Milkdown 渲染层验证（jsdom + vendor bundle）
 * 用法: node tools/verify-skill-page-render.js
 * 覆盖: Milkdown 只读渲染、代码块语法高亮、原始 HTML 不执行、渲染容器不可编辑。
 */
'use strict';

const path = require('path');
const assert = require('assert/strict');
const { JSDOM } = require('jsdom');

const VENDOR = path.join(__dirname, '..', 'assets', 'vendor', 'milkdown', '7.22.3', 'milkdown-view.esm.js');

const MARKDOWN = [
  '---',
  'name: "CRES 技能"',
  'description: "适用：需要按 CRES 专属框架编写代码或产出技术方案时。"',
  'version: "v1.4"',
  '---',
  '',
  '## 流程总述',
  '',
  '这是 <b>原始</b> HTML。',
  '',
  '```js',
  'const enabled = true;',
  '```',
  ''
].join('\n');

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://127.0.0.1:3000/pages/skill-detail.html',
    pretendToBeVisual: true
  });
  const win = dom.window;
  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true });
  global.HTMLElement = win.HTMLElement;
  global.Element = win.Element;
  global.Node = win.Node;
  global.localStorage = win.localStorage;
  global.CustomEvent = win.CustomEvent;
  global.addEventListener = win.addEventListener.bind(win);
  global.removeEventListener = win.removeEventListener.bind(win);
  global.dispatchEvent = win.dispatchEvent.bind(win);
  if (typeof win.requestAnimationFrame === 'function') global.requestAnimationFrame = win.requestAnimationFrame.bind(win);
  if (typeof win.cancelAnimationFrame === 'function') global.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);

  const vendor = await import(VENDOR);
  assert.equal(typeof vendor.renderMarkdown, 'function', 'vendor bundle 缺 renderMarkdown 导出');
  await vendor.renderMarkdown(global.document.getElementById('root'), MARKDOWN);

  const root = global.document.getElementById('root');
  assert.ok(root.querySelector('.ProseMirror'), 'Milkdown 未生成渲染容器');
  assert.equal(root.querySelector('.ProseMirror').getAttribute('contenteditable'), 'false', '渲染容器仍可编辑');
  assert.ok(root.textContent.includes('流程总述'), '标题未渲染');
  assert.ok(root.querySelector('pre code'), '代码块未渲染');
  assert.ok(root.querySelectorAll('.token').length > 0, '代码块缺语法高亮 token');
  assert.equal(global.document.querySelectorAll('script').length, 0, '原始 HTML 被执行');
  assert.equal(root.querySelector('b'), null, '原始 HTML 被当作标签渲染');

  console.log('SCN-0015 渲染层 5/5 通过');
  win.close();
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
