#!/usr/bin/env node
/**
 * 架构边界门禁（零依赖）
 * 用法: node tools/check-architecture.js
 *
 * 做 6 项可机械判定的检查（覆盖 architecture.md 禁止边 1/3/4/5，并部分覆盖 6）：
 *  1. bff/** 只 require Node 内置或 bff 内相对文件；不引入 DF/MOCK/pages/assets。
 *  2. server.js 只做静态服务 + 把 /api/v1/* 与 /healthz 交给 bff.handle；不按 method 写业务路由。
 *  3. 四个 live 资产页（harnesses/tools/skills/experts）不得引用 MOCK。
 *  4. 页面 HTML 只能加载自己的页面 JS 或登记过的共享模块。
 *  5. 页面/公共 JS 不得硬编码 B1 地址（127.0.0.1:3100 / localhost:3100）。
 *  6. 受限共享模块只能被声明的页面加载：WSC→workspaces/workspace-detail；SK/SKILL_MD→skills/skill-detail。
 *
 * 不在这里判定的边：
 *  - 禁止边 2：DF/MOCK 承载业务规则（保留人工评审）；
 *  - 禁止边 6 的任意横向耦合（仅共享模块路径可机械判定）；
 *  - 禁止边 7：vendor / 外链 / package 依赖（由 check-deps 覆盖）。
 */
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const err = (m) => errors.push(m);
const rel = (p) => path.relative(ROOT, p);

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, filter) : (filter(p) ? [p] : []);
  });
}
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}
function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/* 1. BFF 边界 */
const bffDir = path.join(ROOT, 'bff');
for (const p of walk(bffDir, (f) => f.endsWith('.js'))) {
  const r = rel(p);
  const code = stripComments(read(p));
  for (const m of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1];
    if (spec.startsWith('.')) {
      const resolved = path.resolve(path.dirname(p), spec);
      if (!resolved.startsWith(bffDir + path.sep)) err(`${r}: BFF 不得 require bff/ 之外的相对文件（${spec}）`);
    } else if (!builtinModules.includes(spec.replace(/^node:/, ''))) {
      err(`${r}: BFF 只允许 Node 内置模块（${spec}）`);
    }
  }
  if (/\b(?:DF|MOCK)\b/.test(code)) err(`${r}: BFF 不得引用 DF/MOCK`);
  if (/(?:pages|assets)\//.test(code)) err(`${r}: BFF 不得引用 pages/assets`);
}

/* 2. server.js 组合根 */
const serverPath = path.join(ROOT, 'server.js');
if (!fs.existsSync(serverPath)) err('缺 server.js');
else {
  const code = stripComments(read(serverPath));
  if (!/require\(\s*['"]\.\/bff['"]\s*\)/.test(code)) err('server.js: 必须通过 require("./bff") 组合 BFF');
  if (!/bff\.handle\(\s*req\s*,\s*res\s*\)/.test(code)) err('server.js: 必须把 /api/v1/* 与 /healthz 交给 bff.handle(req, res)');
  if (/\breq\.method\b/.test(code)) err('server.js: 不得按请求方法承载业务路由（应交给 BFF）');
}

/* 3. live 页面不得引用 MOCK */
const livePages = ['harnesses', 'tools', 'skills', 'experts'];
for (const slug of livePages) {
  const p = path.join(ROOT, 'assets', 'js', 'pages', `${slug}.js`);
  if (!fs.existsSync(p)) { err(`缺 live 页面脚本 assets/js/pages/${slug}.js`); continue; }
  const code = stripComments(read(p));
  if (/\bMOCK\b/.test(code)) err(`${rel(p)}: live 页面不得引用 MOCK`);
}

/* 4. 页面 HTML 只能加载自己的页面 JS + 登记共享模块 */
const shared = new Set([
  'skill-common.js',
  'skill-detail-markdown.js',
  'workspace-common.js',
]);
const pageDir = path.join(ROOT, 'pages');
for (const p of walk(pageDir, (f) => f.endsWith('.html'))) {
  const base = path.basename(p, '.html');
  const html = read(p);
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1];
    const hit = src.match(/assets\/js\/pages\/([^/?#]+\.js)/);
    if (!hit) continue;
    const name = hit[1];
    if (name !== `${base}.js` && !shared.has(name)) {
      err(`${rel(p)}: 不得加载其他页面的脚本 ${name}`);
    }
  }
}

/* 5. 不得硬编码 B1 地址 */
const apiLiteral = /(?:127\.0\.0\.1|localhost):3100/;
for (const p of walk(path.join(ROOT, 'assets', 'js'), (f) => f.endsWith('.js'))) {
  if (apiLiteral.test(stripComments(read(p)))) err(`${rel(p)}: 不得硬编码 B1 地址（应经 BFF 同源路径）`);
}

/* 6. 受限共享模块只能被声明页面使用 */
const restricted = [
  { symbol: 'WSC', owners: ['workspaces', 'workspace-detail'] },
  { symbol: 'SK', owners: ['skills', 'skill-detail'] },
  { symbol: 'SKILL_MD', owners: ['skills', 'skill-detail'] },
];
for (const p of walk(path.join(ROOT, 'assets', 'js', 'pages'), (f) => f.endsWith('.js'))) {
  const base = path.basename(p, '.js');
  const code = stripComments(read(p));
  for (const { symbol, owners } of restricted) {
    const re = new RegExp(`\\b${symbol}\\s*\\.`);
    if (re.test(code) && !owners.includes(base)) {
      err(`${rel(p)}: 使用了受限共享模块 ${symbol}（仅 ${owners.join(' / ')} 可用）`);
    }
  }
}

if (errors.length) {
  console.log(`FAIL (${errors.length}):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('PASS: 架构边界检查通过（6 项；DF/MOCK 业务规则与任意横向耦合仍人工评审，vendor 由 check-deps 覆盖）');
