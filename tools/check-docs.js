#!/usr/bin/env node
/**
 * 五态文档一致性检查（零依赖）
 * 用法: node tools/check-docs.js [docsRoot]
 * 校验 frontmatter、状态值域、模块卡必备字段、组件/场景字段、works 工序、
 * REQ/SCN/CMP 引用、场景索引、旧路径残留。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'docs');
const PROJECT = path.resolve(ROOT, '..');
const DOMAIN = {
  requirements: new Set(['draft', 'accepted', 'delivered', 'superseded', 'dropped']),
  plan: new Set(['draft', 'current']),
  design: new Set(['draft', 'review', 'current', 'planned', 'active', 'retired', 'designed', 'verified', 'deprecated']),
  works: new Set(['active', 'closed']),
  history: new Set(['frozen']),
};
const CARD_FIELDS = [
  '状态：', '单元 / 层：', '业务价值：', '负责 / 不负责：', '数据所有权：',
  '公开契约：', '依赖：', '变化轴：', '验证入口：', '预算：', '单独运行：',
  '删除测试：', '已知偏差：',
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.md') ? [p] : []);
  });
}
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
function section(text, heading) {
  const m = text.match(new RegExp(`\\n${heading}\\n([\\s\\S]*?)(?=\\n## |$)`));
  return m ? m[1] : '';
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p);
const all = walk(ROOT).sort();
const components = new Set();
const scenarios = new Set();
const reqs = new Set();
const componentRefs = [];
const scenarioRefs = [];
const reqCards = [];

for (const p of all) {
  const r = rel(p);
  if (r === 'README.md') continue;
  const parts = r.split(path.sep);
  const text = fs.readFileSync(p, 'utf8');
  const f = frontmatter(text);
  if (!f) { err(`${r}: 缺 frontmatter`); continue; }
  const layer = f.layer;
  if (!layer || !DOMAIN[layer]) { err(`${r}: 非法 layer=${layer}`); continue; }
  if (layer !== parts[0]) err(`${r}: layer=${layer} 与目录 ${parts[0]} 不一致`);
  if (!DOMAIN[layer].has(f.status)) err(`${r}: status=${f.status} 不在 ${layer} 值域`);
  for (const k of ['layer', 'module', 'status', 'updated']) if (!f[k]) err(`${r}: 缺 ${k}`);
  if (f.updated && !/^\d{4}-\d{2}-\d{2}$/.test(f.updated)) err(`${r}: updated 不是 YYYY-MM-DD`);

  if (parts[0] === 'design' && parts[1] === 'components' && parts.length >= 4) {
    const slug = parts[2];
    components.add(slug);
    if (f.module !== slug) err(`${r}: module 应为 ${slug}`);
    if (f.component !== `CMP-${slug}`) err(`${r}: component 应为 CMP-${slug}`);
    if (!['planned', 'active', 'retired'].includes(f.status)) err(`${r}: 组件 status 越界`);
    if (!/^REQ-\d{4}$/.test(f.requirement || '')) err(`${r}: requirement 字段非法: ${f.requirement}`);
    if (!/^SCN-\d{4}$/.test(f.scenario || '')) err(`${r}: scenario 字段非法: ${f.scenario}`);
    componentRefs.push({ r, req: f.requirement, scn: f.scenario });
    const card = section(text, '## 0 模块卡');
    if (!card) err(`${r}: 缺 ## 0 模块卡`);
    else for (const field of CARD_FIELDS) if (!card.includes(`- ${field}`)) err(`${r}: 模块卡缺「${field}」`);
  }

  if (parts[0] === 'design' && parts[1] === 'scenarios' && parts.length >= 5) {
    if (!f.flow) err(`${r}: 场景缺 flow`);
    if (!/^SCN-\d{4}$/.test(f.scenario || '')) err(`${r}: scenario 字段非法: ${f.scenario}`);
    else scenarios.add(f.scenario);
    scenarioRefs.push({ r, module: f.module, id: f.scenario, status: f.status, text });
    if (!['draft', 'designed', 'verified', 'deprecated'].includes(f.status)) err(`${r}: 场景 status 越界`);
    if (!text.includes('执行层：')) err(`${r}: 场景缺「执行层：」`);
    const rows = (text.match(/\| SCN-\d{4}-T\d+ \|/g) || []).length;
    if (rows < 4) err(`${r}: 场景测试表少于 3 正 1 反（找到 ${rows} 行）`);
    if (f.status === 'verified') {
      const pos = (text.match(/\| SCN-\d{4}-T\d+ \| 正 \|/g) || []).length;
      const neg = (text.match(/\| SCN-\d{4}-T\d+ \| 反 \|/g) || []).length;
      if (pos < 3 || neg < 1) err(`${r}: verified 场景须至少 3 正 1 反（正 ${pos} / 反 ${neg}）`);
      if (text.includes('| 待补 |')) err(`${r}: verified 场景仍含「待补」脚本`);
      if (!text.includes('最近一次执行：')) err(`${r}: verified 场景缺「最近一次执行：」证据行`);
    }
  }

  if (parts[0] === 'requirements' && /^REQ-\d{4}-/.test(path.basename(r))) {
    reqs.add(`REQ-${path.basename(r).split('-')[1]}`);
    reqCards.push({ r, text, status: f.status });
  }
}

/* 组件 ↔ 需求/场景、场景 ↔ 组件、需求 → 场景 必须可解析 */
for (const c of componentRefs) {
  if (!reqs.has(c.req)) err(`${c.r}: requirement=${c.req} 不存在`);
  if (!scenarios.has(c.scn)) err(`${c.r}: scenario=${c.scn} 不存在`);
}
for (const s of scenarioRefs) {
  if (!components.has(s.module)) err(`${s.r}: module=${s.module} 无对应组件`);
}
for (const q of reqCards) {
  if (!/SCN-\d{4}/.test(q.text)) err(`${q.r}: 需求卡未引场景`);
  if (q.status === 'delivered') {
    const ids = new Set(q.text.match(/SCN-\d{4}/g) || []);
    if (!ids.size) err(`${q.r}: delivered 需求未引场景`);
    for (const id of ids) {
      const scn = scenarioRefs.find((s) => s.id === id);
      if (!scn) err(`${q.r}: delivered 需求引用的 ${id} 不存在`);
      else if (scn.status !== 'verified') err(`${q.r}: delivered 需求引用的 ${id} 仍为 ${scn.status}`);
    }
  }
}

/* works：每个工序必须有 brief；closed 必须有 result；brief 必须引 REQ 或注明旁路 */
const worksRoot = path.join(ROOT, 'works');
if (fs.existsSync(worksRoot)) {
  for (const ent of fs.readdirSync(worksRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(worksRoot, ent.name);
    const brief = path.join(dir, 'brief.md');
    const result = path.join(dir, 'result.md');
    if (!fs.existsSync(brief)) { err(`works/${ent.name}: 缺 brief.md`); continue; }
    const briefText = fs.readFileSync(brief, 'utf8');
    const bf = frontmatter(briefText);
    if (!bf) err(`works/${ent.name}/brief.md: 缺 frontmatter`);
    if (briefText.includes('status: closed') && !fs.existsSync(result)) {
      err(`works/${ent.name}: closed 工序缺 result.md`);
    }
    if (!/REQ-\d{4}/.test(briefText) && !briefText.includes('旁路')) {
      err(`works/${ent.name}/brief.md: 需引 REQ-xxxx 或注明「旁路」`);
    }
    if (fs.existsSync(result)) {
      const rf = frontmatter(fs.readFileSync(result, 'utf8'));
      if (!rf) err(`works/${ent.name}/result.md: 缺 frontmatter`);
    }
  }
}

const refOld = /design\/([a-z0-9-]+)\/spec\.md/g;
const refShell = /design\/ui-shell\.md/g;
for (const p of all) {
  const r = rel(p);
  if (r.split(path.sep)[0] === 'history') continue;
  const text = fs.readFileSync(p, 'utf8');
  for (const m of text.matchAll(refOld)) {
    if (!components.has(m[1])) err(`${r}: 旧式组件路径 design/${m[1]}/spec.md`);
  }
  refShell.lastIndex = 0;
  if (refShell.test(text)) err(`${r}: 仍引用 design/ui-shell.md`);
}

/* CMP 引用必须能解析到组件（history 冻结，不参与） */
for (const p of all) {
  const r = rel(p);
  if (r.split(path.sep)[0] === 'history') continue;
  const text = fs.readFileSync(p, 'utf8');
  for (const m of text.matchAll(/CMP-[a-z0-9-]+/g)) {
    const slug = m[0].slice(4);
    if (!components.has(slug)) err(`${r}: 引用了不存在的组件 ${m[0]}`);
  }
}

const joined = all.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
for (const id of new Set(joined.match(/REQ-\d{4}/g) || [])) if (!reqs.has(id)) err(`引用了不存在的需求卡 ${id}`);
for (const id of new Set(joined.match(/SCN-\d{4}/g) || [])) if (!scenarios.has(id)) err(`引用了不存在的场景卡 ${id}`);

/* 场景索引：存在、generated、覆盖全部 SCN */
const index = path.join(ROOT, 'design', 'scenarios', '_index.md');
if (scenarios.size) {
  if (!fs.existsSync(index)) err('缺 design/scenarios/_index.md（运行 npm run docs:index）');
  else {
    const it = fs.readFileSync(index, 'utf8');
    if (!/generated:\s*true/.test(it)) err('design/scenarios/_index.md 缺 generated: true');
    for (const id of scenarios) if (!it.includes(id)) err(`design/scenarios/_index.md 未收录 ${id}`);
  }
}

/* 项目入口不得再引用已删除的 docs/0x 旧路径 */
const legacyRef = /docs\/\d{2}[-.]/;
const projectFiles = ['README.md'].concat(
  fs.existsSync(path.join(PROJECT, 'assets', 'js', 'pages'))
    ? fs.readdirSync(path.join(PROJECT, 'assets', 'js', 'pages'))
        .filter((n) => n.endsWith('.js'))
        .map((n) => `assets/js/pages/${n}`)
    : []
);
for (const f of projectFiles) {
  const p = path.join(PROJECT, f);
  if (fs.existsSync(p) && legacyRef.test(fs.readFileSync(p, 'utf8'))) {
    err(`${f}: 仍引用旧 docs/0x 路径`);
  }
}

console.log(`docs root: ${ROOT}`);
console.log(`components: ${components.size} | requirements: ${reqs.size} | scenarios: ${scenarios.size}`);
if (warnings.length) { console.log('\nWARN:'); warnings.forEach((w) => console.log(' -', w)); }
if (errors.length) {
  console.log(`\nFAIL (${errors.length}):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('\nPASS: 五态一致性检查通过');
