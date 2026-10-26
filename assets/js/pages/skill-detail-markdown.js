/**
 * Skill 专门页面 · Markdown 渲染适配层
 *
 * 只向页面暴露 `window.SKILL_MD.render(target, text)`；
 * 不把 Milkdown / Prism 的类型、上下文或编辑能力泄漏给业务代码。
 */
(function () {
  'use strict';

  var VENDOR_URL = '/assets/vendor/milkdown/7.22.3/milkdown-view.esm.js';
  var vendorPromise = null;

  function parseFrontmatter(text) {
    var raw = String(text == null ? '' : text);
    var lines = raw.split('\n');
    if (!lines.length || lines[0].trim() !== '---') return { meta: null, body: raw };
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        var meta = {};
        lines.slice(1, i).forEach(function (line) {
          var m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
          if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
        });
        return { meta: meta, body: lines.slice(i + 1).join('\n') };
      }
    }
    return { meta: null, body: raw };
  }

  function metadataHtml(meta) {
    if (!meta) return '';
    var rows = [
      ['name', '名称'],
      ['description', '描述'],
      ['version', '版本']
    ].filter(function (pair) { return meta[pair[0]]; }).map(function (pair) {
      return '<div class="sk-md-meta-row"><span class="sk-md-meta-k">' + DF.esc(pair[1]) + '</span>' +
        '<span class="sk-md-meta-v">' + DF.esc(meta[pair[0]]) + '</span></div>';
    });
    return rows.length ? '<div class="sk-md-meta">' + rows.join('') + '</div>' : '';
  }

  function loadVendor() {
    if (!vendorPromise) {
      vendorPromise = import(VENDOR_URL).then(function (mod) {
        if (!mod || typeof mod.renderMarkdown !== 'function') {
          throw new Error('Milkdown 渲染模块不可用');
        }
        return mod;
      }).catch(function (err) {
        vendorPromise = null;
        throw err;
      });
    }
    return vendorPromise;
  }

  window.SKILL_MD = {
    render: function (target, text) {
      if (!target) return Promise.reject(new Error('缺少渲染容器'));
      var parsed = parseFrontmatter(text);
      target.innerHTML = metadataHtml(parsed.meta) + '<div class="sk-md-body" aria-live="polite"></div>';
      var body = target.querySelector('.sk-md-body');
      return loadVendor().then(function (mod) {
        return mod.renderMarkdown(body, parsed.body || '');
      });
    }
  };
})();
