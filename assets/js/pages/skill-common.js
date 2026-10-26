/**
 * Skill 两页共用的纯渲染 helpers。
 * 不发请求、不持状态、不做业务写操作；只把 DTO 渲染成页面可用的字符串/值。
 */
(function () {
  'use strict';

  var SECTIONS = [
    ['overview', '流程总述'],
    ['steps', '详细步骤与约束'],
    ['examples', '参考案例模板'],
    ['scripts', '外部脚本使用指南'],
    ['verification', '完成验证方案']
  ];
  var CAT_COLORS = ['blue', 'teal', 'purple', 'orange', 'green', 'red'];
  var REF_COLORS = { skill: 'blue', template: 'teal', spec: 'purple', doc: 'gray', url: 'orange' };
  var DESC_MIN = 1;
  var DESC_MAX = 400;

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

  function detailUrl(id, mode) {
    var qs = [];
    if (id) qs.push('id=' + encodeURIComponent(id));
    if (mode) qs.push('mode=' + encodeURIComponent(mode));
    return 'skill-detail.html' + (qs.length ? '?' + qs.join('&') : '');
  }

  window.SK = {
    SECTIONS: SECTIONS,
    CAT_COLORS: CAT_COLORS,
    REF_COLORS: REF_COLORS,
    DESC_MIN: DESC_MIN,
    DESC_MAX: DESC_MAX,
    fmtDateTime: fmtDateTime,
    relTime: relTime,
    sortCats: sortCats,
    catLabel: catLabel,
    catColor: catColor,
    descLen: descLen,
    detailUrl: detailUrl
  };
})();
