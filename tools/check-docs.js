#!/usr/bin/env node
/**
 * 五态文档一致性检查（零依赖）
 * 用法: node tools/check-docs.js [docsRoot]
 * 校验 frontmatter、状态值域、组件/场景字段、REQ/SCN 引用与旧路径残留。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'docs');
const DOMAIN = {
  requirements: new Set(['draft', 'accepted', 'delivered', 'superseded', 'dropped']),
  plan: new Set(['draft', 'current']),
  design: new Set(['draft', 'review', 'current', 'planned', 'active', 'retired', 'designed', 'verified', 'deprecated']),
  works: new Set(['active', 'closed']),
  history: new Set(['frozen']),
};

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

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p);
const all = walk(ROOT).sort();
const components = new Set();
const scenarios = new Set();
const reqs = new Set();

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
  if (parts[0] === 'design' && parts[1] === 'components' && parts.length >= 4) {
    const slug = parts[2];
    components.add(slug);
    if (f.module !== slug) err(`${r}: module 应为 ${slug}`);
    if (f.component !== `CMP-${slug}`) err(`${r}: component 应为 CMP-${slug}`);
    if (!['planned', 'active', 'retired'].includes(f.status)) err(`${r}: 组件 status 越界`);
  }
  if (parts[0] === 'design' && parts[1] === 'scenarios' && parts.length >= 5) {
    if (!f.flow) err(`${r}: 场景缺 flow`);
    if (!/^SCN-\d{4}$/.test(f.scenario || '')) err(`${r}: scenario 字段非法: ${f.scenario}`);
    else scenarios.add(f.scenario);
    if (!['draft', 'designed', 'verified', 'deprecated'].includes(f.status)) err(`${r}: 场景 status 越界`);
  }
  if (parts[0] === 'requirements' && /^REQ-\d{4}-/.test(path.basename(r))) {
    reqs.add(`REQ-${path.basename(r).split('-')[1]}`);
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
  if (refShell.test(text)) err(`${r}: 仍引用 design/ui-shell.md`);
  refShell.lastIndex = 0;
}

const joined = all.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
for (const id of new Set(joined.match(/REQ-\d{4}/g) || [])) if (!reqs.has(id)) err(`引用了不存在的需求卡 ${id}`);
for (const id of new Set(joined.match(/SCN-\d{4}/g) || [])) if (!scenarios.has(id)) err(`引用了不存在的场景卡 ${id}`);
const oq = path.join(ROOT, 'plan', 'open-questions.md');
if (fs.existsSync(oq) && fs.readFileSync(oq, 'utf8').includes('OQ-7')) err('plan/open-questions.md 仍含 OQ-7');

console.log(`docs root: ${ROOT}`);
console.log(`components: ${components.size} | requirements: ${reqs.size} | scenarios: ${scenarios.size}`);
if (warnings.length) { console.log('\nWARN:'); warnings.forEach((w) => console.log(' -', w)); }
if (errors.length) {
  console.log(`\nFAIL (${errors.length}):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('\nPASS: 五态一致性检查通过');
