/**
 * AgentFlow 原型 · 工作区配置公共模块（WSC）
 * 列表页（workspaces.js）与详情页（workspace-detail.js）共用的取数、跨页联动与只读目录树。
 * 依赖: assets/js/mock-data.js (MOCK)、assets/js/ui.js (DF)
 */

import { DF } from '../ui.js';
import { MOCK } from '../mock-data.js';

  const pad = n => String(n).padStart(2, '0');

  /* ========== 跨页联动：sessionStorage 中由新建向导产生的工作区 ========== */
  const WS_KEY = 'df-new-workspace';

  function readNewWs() {
    try {
      const o = JSON.parse(DF.ssGet(WS_KEY) || 'null');
      return (o && o.id && String(o.id).indexOf('ws-new') === 0) ? o : null;
    } catch (e) { return null; }
  }
  function saveNewWs(o) { DF.ssSet(WS_KEY, JSON.stringify(o)); }
  function dropNewWs(id) {
    const nw = readNewWs();
    if (nw && nw.id === id) DF.ssRemove(WS_KEY);
  }
  /* ws-new* 记录的变更回写 sessionStorage，保证列表页联动可见 */
  function syncNewWs(ws) {
    if (String(ws.id).indexOf('ws-new') === 0) saveNewWs(ws);
  }

  /* ========== 取数 ========== */
  function allWorkspaces() {
    const list = (MOCK.workspaces || []).slice();
    const nw = readNewWs();
    if (nw && !list.some(w => w.id === nw.id)) list.push(nw);
    return list;
  }
  function keyById(id) { return id ? MOCK.byId(MOCK.keys || [], id) : null; }

  /* MOCK.workspaces 无 createdAt 字段：按 id 确定性推导一个创建日期（新建工作区记录真实时间） */
  function createdText(w) {
    if (w.createdAt) return w.createdAt;
    let h = 0; const s = String(w.id || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const d = new Date((MOCK.now || Date.now()) - (40 + h % 200) * 86400000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ========== 目录结构（初始化模板，只读树） ========== */
  function treeHtml() {
    const d = new Date();
    const ex = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-INS-2041';
    return '<div class="tree">' +
      '<div class="leaf"><b>Agents.md</b><span class="note">总纲描述文件</span></div>' +
      '<details open><summary><b>knowledge/</b><span class="note">知识库索引</span></summary></details>' +
      '<details open><summary><b>experts/</b><span class="note">专家库目录</span></summary><div class="leaf">experts.md</div></details>' +
      '<details open><summary><b>skills/</b><span class="note">Skill 库目录</span></summary></details>' +
      '<details open><summary><b>tasks/</b><span class="note">并行任务目录</span></summary>' +
        '<div class="leaf mono">' + DF.esc(ex) + '/ <span class="note">按任务划分的并行工作目录 · {date}-{instance}</span></div>' +
      '</details></div>';
  }

  export const WSC = { pad, readNewWs, saveNewWs, dropNewWs, syncNewWs, allWorkspaces, keyById, createdText, treeHtml };
