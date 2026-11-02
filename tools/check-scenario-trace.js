#!/usr/bin/env node
/**
 * 场景追溯门禁（零依赖）
 * 用法: node tools/check-scenario-trace.js
 *
 * 规则：
 *  - 场景卡表格里的 SCN-xxxx-Tn 是文档用例全集；
 *  - tools/verify-m1-scenarios.js 里的 SCN-xxxx-Tn 是 Playwright runner 执行集；
 *  - runner 只能执行已写进场景卡表格的 ID；
 *  - 未进 runner 的 ID 必须属于外部执行层（SCN-0001 引擎 / SCN-0012 BFF+真实 B1 /
 *    场景 frontmatter 标 execution: playwright|engine|bff|real 的页面级场景），
 *    且外部执行层场景的 ID 不得混入 MOCK 页面 runner；
 *  - 同一 ID 不得出现在两张场景卡。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(HERE, '..');
const DOCS = path.join(ROOT, 'docs');
const RUNNER = path.join(ROOT, 'tools', 'verify-m1-scenarios.js');
const errors = [];
const err = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.md') ? [p] : []);
  });
}
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const scenarioRoot = path.join(DOCS, 'design', 'scenarios');
const docIds = new Map();
const scenarioFiles = walk(scenarioRoot).filter((p) => path.basename(p) === 'scenario.md');
for (const p of scenarioFiles) {
  const text = fs.readFileSync(p, 'utf8');
  const f = frontmatter(text);
  const sid = f.scenario;
  if (!/^SCN-\d{4}$/.test(sid || '')) { err(`${rel(p)}: frontmatter 缺合法 scenario`); continue; }
  const ids = [...text.matchAll(/^\|\s*(SCN-\d{4}-T\d+)\s*\|/gm)].map((m) => m[1]);
  if (!ids.length) { err(`${rel(p)}: ${sid} 没有 SCN-xxxx-Tn 表格行`); continue; }
  for (const id of ids) {
    if (!id.startsWith(sid + '-')) err(`${rel(p)}: ${id} 与场景 ${sid} 不匹配`);
    if (docIds.has(id)) err(`${id}: 同时出现在 ${docIds.get(id).file} 与 ${rel(p)}`);
    else docIds.set(id, { file: rel(p), sid, execution: f.execution || '' });
  }
}

if (!fs.existsSync(RUNNER)) err('缺 tools/verify-m1-scenarios.js');
const runnerText = fs.existsSync(RUNNER) ? fs.readFileSync(RUNNER, 'utf8') : '';
const runnerIds = new Set(runnerText.match(/SCN-\d{4}-T\d+/g) || []);
const EXTERNAL_EXEC = new Set(['playwright', 'engine', 'bff', 'real']);
const isExternal = (entry) => entry.sid === 'SCN-0001' || entry.sid === 'SCN-0012' || EXTERNAL_EXEC.has(entry.execution);

for (const id of runnerIds) {
  if (!docIds.has(id)) err(`runner: ${id} 未写进任何场景卡表格`);
  const entry = docIds.get(id);
  if (entry && isExternal(entry)) {
    err(`runner: ${id} 属外部执行层（${entry.sid}${entry.execution ? ' / ' + entry.execution : ''}），不得放进 MOCK 页面 runner`);
  }
}

const external = [...docIds.keys()].filter((id) => !runnerIds.has(id));
for (const id of external) {
  const entry = docIds.get(id);
  if (!isExternal(entry)) {
    err(`${entry.file}: ${id} 未进 runner，且未声明外部执行层（frontmatter execution: playwright）`);
  }
}

const summary = `scenarios: ${scenarioFiles.length} | documented: ${docIds.size} | runner: ${runnerIds.size} | external: ${external.length}`;
if (errors.length) {
  console.log(summary);
  console.log(`FAIL (${errors.length}):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log(summary);
console.log('PASS: 场景追溯一致（runner 只跑文档用例；SCN-0001/SCN-0012 与 execution 声明的外部层不混入）');
