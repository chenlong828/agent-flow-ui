import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderInline } from '../../assets/js/shared/markdown.js';

test('原始 HTML 与脚本被转义', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<img'));
});

test('标题、段落与软换行', () => {
  const html = renderMarkdown('## 产物文件\n\n第一行\n第二行');
  assert.match(html, /<h2>产物文件<\/h2>/);
  assert.match(html, /<p>第一行<br>第二行<\/p>/);
});

test('无序与有序列表', () => {
  const html = renderMarkdown('- 甲\n- 乙\n\n1. 丙\n2. 丁');
  assert.ok(html.includes('<ul><li>甲</li><li>乙</li></ul>'));
  assert.ok(html.includes('<ol><li>丙</li><li>丁</li></ol>'));
});

test('行内代码与粗体不被格式串扰', () => {
  assert.equal(renderInline('已说明（`570f1935.zip`）'), '已说明（<code>570f1935.zip</code>）');
  assert.match(renderInline('**重点** 与 `a*b`'), /<strong>重点<\/strong>/);
  assert.match(renderInline('`a*b`'), /<code>a\*b<\/code>/);
});

test('代码块整体转义，语言类名白名单化', () => {
  const html = renderMarkdown('```js\nconst x = "<b>";\nif (a < b) x();\n```');
  assert.match(html, /<pre class="md-code"><code class="lang-js">/);
  assert.ok(html.includes('&quot;&lt;b&gt;&quot;'));
  assert.ok(html.includes('if (a &lt; b)'));
  assert.ok(!html.includes('<b>'));
});

test('链接只放行安全协议', () => {
  assert.match(renderInline('[报告](https://example.com/a)'), /<a href="https:\/\/example.com\/a" target="_blank" rel="noopener noreferrer">报告<\/a>/);
  assert.equal(renderInline('[点我](javascript:alert(1))'), '点我');
  assert.equal(renderInline('[相对](/pages/instances.html)'), '<a href="/pages/instances.html" target="_blank" rel="noopener noreferrer">相对</a>');
});

test('表格识别表头、对齐与行', () => {
  const html = renderMarkdown('| 名称 | 数量 |\n|:---|---:|\n| 甲 | 2 |\n| 乙 | 3 |');
  assert.ok(html.includes('<table class="md-table">'));
  assert.match(html, /<th style="text-align:left">名称<\/th>/);
  assert.match(html, /<td style="text-align:right">2<\/td>/);
  assert.ok(html.includes('乙'));
});

test('引用与分隔线', () => {
  const html = renderMarkdown('> 注意\n> 第二行\n\n---');
  assert.match(html, /<blockquote><p>注意<br>第二行<\/p><\/blockquote>/);
  assert.match(html, /<hr>/);
});

test('空输入返回空串', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
});
