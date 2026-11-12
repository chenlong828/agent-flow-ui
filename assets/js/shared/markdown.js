/**
 * 轻量 Markdown 渲染（显示用，非编辑器）
 *
 * 只服务运行详情里的模型输出（节点消息、确认说明）：标题、段落、列表、
 * 代码块/行内代码、粗斜体、链接、引用、分隔线、表格。
 * 规则：先转义再生成标签，链接只放行 http(s)/mailto/站内路径，生成结果中不出现原始 HTML。
 */

const SAFE_LINK = /^(https?:|mailto:|\/|#)/i;
const FENCE = /^\s*(```|~~~)\s*([\w-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^\s*([-*_])\s*(?:\1\s*){2,}$/;
const QUOTE = /^\s*>\s?/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^:?-{2,}:?$/;

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

/** 行内格式：代码/链接/粗体/斜体/删除线；先转义，代码用占位符暂存。 */
export function renderInline(text) {
  const codes = [];
  let s = String(text == null ? '' : text).replace(/`([^`\n]+)`/g, function (_m, code) {
    codes.push(code);
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()]*\))+)\)/g, function (m, label, url) {
    if (!SAFE_LINK.test(url)) return label;
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, function (_m, index) {
    return '<code>' + escapeHtml(codes[Number(index)]) + '</code>';
  });
  return s;
}

function isBlank(line) {
  return /^\s*$/.test(line);
}

function isTableStart(lines, index) {
  if (index + 1 >= lines.length) return false;
  if (!lines[index].includes('|')) return false;
  const next = lines[index + 1];
  if (!next.includes('|') && !/^\s*\|?\s*:?-{2,}/.test(next)) return false;
  const cells = splitRow(next);
  return cells.length > 0 && cells.every(function (cell) { return TABLE_SEP.test(cell); });
}

function splitRow(line) {
  return String(line).replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (cell) {
    return cell.trim();
  });
}

function isBlockStart(lines, index) {
  const line = lines[index];
  if (isBlank(line)) return true;
  return FENCE.test(line) || HEADING.test(line) || HR.test(line) || QUOTE.test(line) ||
    LIST_ITEM.test(line) || isTableStart(lines, index);
}

function renderTable(lines, start) {
  const head = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map(function (cell) {
    const left = cell.charAt(0) === ':';
    const right = cell.charAt(cell.length - 1) === ':';
    if (left && right) return 'center';
    if (right) return 'right';
    return left ? 'left' : '';
  });
  let index = start + 2;
  const rows = [];
  while (index < lines.length && !isBlank(lines[index]) && lines[index].includes('|')) {
    rows.push(splitRow(lines[index]));
    index += 1;
  }
  const cellHtml = function (tag, value, col) {
    const align = aligns[col] ? ' style="text-align:' + aligns[col] + '"' : '';
    return '<' + tag + align + '>' + renderInline(value == null ? '' : value) + '</' + tag + '>';
  };
  return {
    html: '<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
      head.map(function (cell, col) { return cellHtml('th', cell, col); }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr>' + head.map(function (_cell, col) { return cellHtml('td', row[col], col); }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>',
    next: index
  };
}

function renderList(lines, start) {
  const ordered = /^\s*\d+[.)]\s+/.test(lines[start]);
  const items = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    const item = LIST_ITEM.exec(line);
    if (item) {
      items.push([item[3]]);
      index += 1;
      continue;
    }
    if (items.length && !isBlank(line) && /^\s{2,}/.test(line) && !isBlockStart(lines, index)) {
      items[items.length - 1].push(line.trim());
      index += 1;
      continue;
    }
    break;
  }
  const tag = ordered ? 'ol' : 'ul';
  return {
    html: '<' + tag + '>' + items.map(function (linesOfItem) {
      return '<li>' + linesOfItem.map(renderInline).join('<br>') + '</li>';
    }).join('') + '</' + tag + '>',
    next: index
  };
}

/** Markdown → HTML；未识别的内容按段落处理。 */
export function renderMarkdown(source) {
  const lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) { index += 1; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2];
      index += 1;
      const buffer = [];
      while (index < lines.length && !new RegExp('^\\s*' + marker).test(lines[index])) {
        buffer.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      out.push('<pre class="md-code"><code' + (lang ? ' class="lang-' + escapeHtml(lang) + '"' : '') + '>' +
        escapeHtml(buffer.join('\n')) + '</code></pre>');
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
      index += 1;
      continue;
    }

    if (HR.test(line) && !isTableStart(lines, index)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = renderTable(lines, index);
      out.push(table.html);
      index = table.next;
      continue;
    }

    if (QUOTE.test(line)) {
      const buffer = [];
      while (index < lines.length && QUOTE.test(lines[index])) {
        buffer.push(lines[index].replace(QUOTE, ''));
        index += 1;
      }
      out.push('<blockquote>' + renderMarkdown(buffer.join('\n')) + '</blockquote>');
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const list = renderList(lines, index);
      out.push(list.html);
      index = list.next;
      continue;
    }

    const paragraph = [];
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    out.push('<p>' + paragraph.map(renderInline).join('<br>') + '</p>');
  }

  return out.join('\n');
}
