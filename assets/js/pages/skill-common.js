/**
 * Skill 两页共用的纯渲染 helpers。
 * 不发请求、不持状态、不做业务写操作；只把 DTO 渲染成页面可用的字符串/值。
 */

import { DF } from '../ui.js';

  var CAT_COLORS = ['blue', 'teal', 'purple', 'orange', 'green', 'red'];
  var DESC_MIN = 1;
  var DESC_MAX = 400;
  var BODY_LIMIT = 16384;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function relTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var min = (Date.now() - d.getTime()) / 60000;
    if (min < 0) min = 0;
    return DF.relTime(min);
  }

  function sortCats(cats) {
    return (cats || []).slice().sort(function (a, b) {
      var pa = a && a.position != null ? a.position : 0;
      var pb = b && b.position != null ? b.position : 0;
      return pa - pb;
    });
  }

  function catLabel(cats, code) {
    var list = cats || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i].label;
    }
    return code || '—';
  }

  function catColor(cats, code) {
    var list = cats || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return CAT_COLORS[i % CAT_COLORS.length];
    }
    return 'gray';
  }

  function descLen(v) { return String(v == null ? '' : v).trim().length; }

  function utf8Len(str) {
    var s = String(str == null ? '' : str);
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  function fmtSize(n) {
    var v = Number(n) || 0;
    if (v < 1024) return v + ' B';
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
    return (v / 1024 / 1024).toFixed(1) + ' MB';
  }

  function yamlScalar(value) {
    return '"' + String(value == null ? '' : value)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }

  /** 与 B1 一致：frontmatter（name/description/version）+ 正文。 */
  function composeMarkdown(fm, body) {
    var meta = fm || {};
    return '---\nname: ' + yamlScalar(meta.name || '') + '\ndescription: ' + yamlScalar(meta.description || '') +
      '\nversion: ' + yamlScalar(meta.version || 'v1.0') + '\n---\n\n' + String(body == null ? '' : body);
  }

  function markdownBytes(fm, body) { return utf8Len(composeMarkdown(fm, body)); }

  function defaultBody() {
    return [
      '# 用途',
      '',
      '说明这个 Skill 解决什么问题、什么时候使用。',
      '',
      '## 步骤',
      '',
      '1. ',
      ''
    ].join('\n');
  }

  function detailUrl(id, mode) {
    var qs = [];
    if (id) qs.push('id=' + encodeURIComponent(id));
    if (mode) qs.push('mode=' + encodeURIComponent(mode));
    return 'skill-detail.html' + (qs.length ? '?' + qs.join('&') : '');
  }

  export const SK = {
    CAT_COLORS: CAT_COLORS,
    DESC_MIN: DESC_MIN,
    DESC_MAX: DESC_MAX,
    BODY_LIMIT: BODY_LIMIT,
    fmtDateTime: fmtDateTime,
    relTime: relTime,
    sortCats: sortCats,
    catLabel: catLabel,
    catColor: catColor,
    descLen: descLen,
    utf8Len: utf8Len,
    fmtSize: fmtSize,
    composeMarkdown: composeMarkdown,
    markdownBytes: markdownBytes,
    defaultBody: defaultBody,
    detailUrl: detailUrl
  };
