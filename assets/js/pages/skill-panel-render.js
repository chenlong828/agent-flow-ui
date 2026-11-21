/**
 * Skill 面板 · 纯渲染块（无状态、无请求）
 * 只把 DTO / 表单值拼成 HTML 字符串，事件绑定与状态留在 `skill-panel.js`。
 * 与 `skill-common.js` 的区别：这里只产出面板容器结构，不做数据格式化。
 */

import { DF } from '../ui.js';
import { SK } from './skill-common.js';

/** 查看态：元数据条 + 正文容器 + 附件容器。 */
export function viewHtml(skill, opts) {
  var o = opts || {};
  var s = skill || {};
  var tags = s.tags || [];
  return '<div class="skd-card">' +
      '<div class="skd-kv"><span class="skd-k">描述</span><span>' + DF.esc(s.description || '') + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">英文名</span><span class="mono">' + DF.esc(s.slug || '—') + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">类别</span><span>' +
        DF.tag(s.categoryLabel || o.catLabel, o.catColor) + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">标签</span><span>' +
        (tags.length ? tags.map(function (t) { return '<span class="chip">' + DF.esc(t) + '</span>'; }).join('')
          : '<span class="sub">暂无</span>') + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">版本</span><span class="mono">' + DF.esc(s.version || '—') + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">更新时间</span><span>' + DF.esc(SK.fmtDateTime(s.updatedAt)) + '</span></div>' +
      '<div class="skd-kv"><span class="skd-k">被引用</span><span>' + DF.esc(String(s.usedByCount == null ? 0 : s.usedByCount)) + ' 位专家</span></div>' +
    '</div>' +
    '<div class="section-title">正文<span class="line"></span></div>' +
    '<div class="skd-card"><div id="sk-body" class="skd-docroot sk-md-body"></div><div id="sk-body-msg"></div></div>' +
    '<div class="section-title">附件<span class="line"></span></div>' +
    '<div class="skd-card" id="sk-files"></div>';
}

/** 附件行；`editable` 为真时出现改名/删除。 */
export function filesHtml(files, editable) {
  var list = files || [];
  if (!list.length) return '<div class="sub" style="padding:2px 0">暂无附件</div>';
  return list.map(function (f) {
    var canEdit = editable && !f.readOnly;
    return '<div class="sk-file" data-path="' + DF.esc(f.path) + '" style="display:flex;align-items:center;gap:8px;padding:4px 0">' +
      '<span class="mono" style="flex:1">' + DF.esc(f.path) + '</span>' +
      '<span class="sub">' + DF.esc(SK.fmtSize(f.size)) + '</span>' +
      (f.readOnly ? '<span class="sub">只读</span>' : '') +
      (canEdit
        ? '<a href="javascript:;" class="sk-rename" data-path="' + DF.esc(f.path) + '">改名</a>' +
          '<a href="javascript:;" class="sk-del" data-path="' + DF.esc(f.path) + '">删除</a>'
        : '') +
      '</div>';
  }).join('');
}

/** 编辑/新建态：元数据表单 + 正文编辑器 + 附件上传区。 */
export function editHtml(form, opts) {
  var d = form || {};
  var o = opts || {};
  var tags = d.tags || [];
  var descLen = String(d.description == null ? '' : d.description).trim().length;
  return '<div class="skd-card">' +
      DF.field('名称', '<input class="inp" id="sk-name" maxlength="80" value="' + DF.esc(d.name) + '" placeholder="如：CRES 技能">', { required: true }) +
      DF.field('英文名', '<input class="inp mono" id="sk-slug" maxlength="64" value="' + DF.esc(d.slug || '') + '" placeholder="如 cres-skill" autocomplete="off" spellcheck="false">',
        { hint: '系统标识（kebab-case），写入 SKILL.md 的 name；留空自动生成，编辑时留空保持原值' }) +
      DF.field('类别', '<select class="inp" id="sk-cat">' + (o.catSelectHtml || '') + '</select>' +
        (o.catsErr ? '<div class="hint">分类加载失败：' + DF.esc(o.catsErr) + ' <a href="javascript:;" id="sk-cat-retry">重试</a></div>' : ''),
        { required: true }) +
      DF.field('描述', '<textarea class="inp" id="sk-desc" rows="3" maxlength="' + o.descMax + '" placeholder="适用：…；触发：…；不适用：…">' + DF.esc(d.description) + '</textarea>' +
        '<div class="hint"><span id="sk-descn">' + descLen + '</span>/' + o.descMax + ' 字 · 列表检索与路由的唯一依据</div>',
        { required: true }) +
      '<div class="section-title">标签<span class="line"></span></div>' +
      '<div class="chips" id="sk-tags">' +
        (tags.length ? tags.map(function (t, i) {
          return '<span class="chip">' + DF.esc(t) + '<span class="skd-x" data-dtag="' + i + '" title="删除">×</span></span>';
        }).join('') : '<span class="sub">暂无标签</span>') +
      '</div>' +
      '<input class="inp skd-chipin" id="sk-tag-in" placeholder="输入标签后回车添加">' +
    '</div>' +
    '<div class="section-title">正文<span class="line"></span>' +
      '<span class="sub" id="sk-bytes" style="margin-left:auto">' + o.total + ' / ' + o.bodyLimit + ' 字节</span></div>' +
    '<div class="skd-card"><div id="sk-editor" class="skd-docroot sk-md-body"></div><div id="sk-body-err"></div>' +
      '<div class="hint" id="sk-bytes-hint"></div></div>' +
    '<div class="section-title">附件<span class="line"></span></div>' +
    '<div class="skd-card skd-attach" id="sk-attach">' +
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
        '<select class="inp inp-sm" id="sk-dir" style="width:auto">' +
          '<option value="scripts"' + (o.uploadDir === 'scripts' ? ' selected' : '') + '>scripts/</option>' +
          '<option value="references"' + (o.uploadDir === 'references' ? ' selected' : '') + '>references/</option>' +
        '</select>' +
        '<input type="file" id="sk-upload" multiple style="display:none">' +
        '<button class="btn btn-sm" id="sk-add-file">上传附件</button>' +
        '<span class="sub">只允许 scripts/、references/；同名覆盖</span>' +
      '</div>' +
      '<div id="sk-files"></div>' +
    '</div>';
}
