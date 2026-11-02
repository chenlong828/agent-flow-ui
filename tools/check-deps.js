#!/usr/bin/env node
/**
 * 运行时依赖准入门禁（零依赖）
 * 用法: node tools/check-deps.js
 * 校验：design/dependencies.md 清单 JSON、页面外链/vendor 引用、vendor 文件存在与
 * SHA-256/体积、页面 JS 裸模块、BFF/server 的 import、package.json 运行时依赖。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(HERE, '..');
const REGISTRY = path.join(ROOT, 'docs', 'design', 'dependencies.md');
const WARN_LIMITS = { dep: 500, page: 120, total: 300 }; // KiB gzip，仅观测阈值
const LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => path.relative(ROOT, p);

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, filter) : (filter(p) ? [p] : []);
  });
}
const gzipKb = (buf) => Math.round((zlib.gzipSync(buf).length / 1024) * 10) / 10;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isExternal = (u) => /^(https?:)?\/\//i.test(u);

/* 1. 读清单 */
if (!fs.existsSync(REGISTRY)) err('缺 docs/design/dependencies.md（依赖准入清单）');
const md = fs.existsSync(REGISTRY) ? fs.readFileSync(REGISTRY, 'utf8') : '';
const block = md.match(/```json\n([\s\S]*?)```/);
let deps = [];
if (!block) err('dependencies.md: 缺 ```json 清单块');
else {
  try {
    const reg = JSON.parse(block[1]);
    deps = Array.isArray(reg.deps) ? reg.deps : [];
  } catch (e) {
    err(`dependencies.md: JSON 清单无法解析（${e.message}）`);
  }
}

/* 2. 校验条目字段与判据 */
const ids = new Set();
for (const d of deps) {
  if (!d || !/^DEP-\d{4}$/.test(d.id || '')) { err(`非法依赖条目: ${JSON.stringify(d)}`); continue; }
  if (ids.has(d.id)) err(`${d.id}: id 重复`);
  ids.add(d.id);
  for (const k of ['name', 'version', 'license', 'path', 'sha256']) if (!d[k]) err(`${d.id}: 缺 ${k}`);
  if (d.license && !LICENSES.has(d.license)) err(`${d.id}: 许可证 ${d.license} 不在白名单`);
  if (d.version && !/^\d+\.\d+\.\d+$/.test(d.version)) err(`${d.id}: 版本须精确到 patch（${d.version}）`);
  if (d.path && !d.path.startsWith('assets/vendor/')) err(`${d.id}: 依赖必须自托管到 assets/vendor/（${d.path}）`);
  if (typeof d.gzipKb !== 'number') err(`${d.id}: 缺 gzipKb 实测值`);
}

/* 3. 文件存在、哈希、体积 */
const registered = new Set();
let totalKb = 0;
for (const d of deps) {
  if (!d.path) continue;
  const r = path.normalize(d.path);
  registered.add(r);
  const abs = path.join(ROOT, d.path);
  if (!fs.existsSync(abs)) { err(`${d.id}: 文件不存在 ${d.path}`); continue; }
  const buf = fs.readFileSync(abs);
  if (d.sha256 && d.sha256.toLowerCase() !== sha256(buf)) {
    err(`${d.id}: SHA-256 不符（登记 ${d.sha256}，实际 ${sha256(buf)}）`);
  }
  const kb = gzipKb(buf);
  totalKb = Math.round((totalKb + kb) * 10) / 10;
  if (kb > WARN_LIMITS.dep) warn(`${d.id}: 单依赖 ${kb} KiB gzip 超过观测阈值 ${WARN_LIMITS.dep} KiB（不阻断）`);
  if (typeof d.gzipKb === 'number' && kb > d.gzipKb) err(`${d.id}: 实测 ${kb} KiB 超过登记值 ${d.gzipKb} KiB`);
}
if (totalKb > WARN_LIMITS.total) warn(`全站新增 ${totalKb} KiB gzip 超过观测阈值 ${WARN_LIMITS.total} KiB（不阻断）`);

const perPage = {};
for (const d of deps) for (const pg of d.pages || []) perPage[pg] = Math.round(((perPage[pg] || 0) + (d.gzipKb || 0)) * 10) / 10;
for (const [pg, kb] of Object.entries(perPage)) {
  if (kb > WARN_LIMITS.page) warn(`页面 ${pg}: 首屏脚本增量 ${kb} KiB gzip 超过观测阈值 ${WARN_LIMITS.page} KiB（不阻断）`);
}

/* 4. vendor 目录不得有未登记文件 */
for (const p of walk(path.join(ROOT, 'assets', 'vendor'), () => true)) {
  const r = path.normalize(rel(p));
  if (!registered.has(r)) err(`assets/vendor 存在未登记文件 ${r}`);
}

/* 5. 页面 HTML：禁外链，vendor 引用必须已登记 */
for (const p of walk(path.join(ROOT, 'pages'), (f) => f.endsWith('.html'))) {
  const r = rel(p);
  const t = fs.readFileSync(p, 'utf8');
  for (const m of t.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const u = m[1].trim();
    if (isExternal(u)) err(`${r}: 运行时外链禁止（${u}）`);
    else if (u.startsWith('assets/vendor/') && !registered.has(path.normalize(u))) {
      err(`${r}: 引用了未登记的 vendor 文件 ${u}`);
    }
  }
  for (const m of t.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)"']+)["']?\s*\)/gi)) {
    err(`${r}: CSS 运行时外链禁止（${m[1]}）`);
  }
}

/* 6. 页面 JS：裸模块名 / 浏览器侧 require 禁止 */
for (const p of walk(path.join(ROOT, 'assets', 'js'), (f) => f.endsWith('.js'))) {
  const r = rel(p);
  const t = fs.readFileSync(p, 'utf8');
  for (const m of t.matchAll(/(?:^|\s)(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!/^(\.\.?\/|\/)/.test(spec) && !spec.startsWith('assets/vendor/')) {
      err(`${r}: 裸模块名禁止（${spec}），须走 vendor 准入`);
    }
  }
  for (const m of t.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1];
    if (!/^(\.\.?\/|\/)/.test(spec)) err(`${r}: 浏览器侧 require 禁止（${spec}）`);
  }
}

/* 7. server.js 与 bff/*：只允许 Node 内置模块（ESM import） */
for (const p of [path.join(ROOT, 'server.js'), ...walk(path.join(ROOT, 'bff'), (f) => f.endsWith('.js'))]) {
  if (!fs.existsSync(p)) continue;
  const r = rel(p);
  const t = fs.readFileSync(p, 'utf8');
  for (const m of t.matchAll(/\bimport\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g)) {
    const spec = m[1];
    if (/^(\.\.?\/|\/)/.test(spec)) continue;
    const name = spec.startsWith('node:') ? spec.slice(5) : spec;
    if (!builtinModules.includes(name)) err(`${r}: 只允许 Node 内置模块（${spec}）`);
  }
}

/* 8. package.json 不得有运行时/构建期依赖（构建链另案 P1） */
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (const k of ['dependencies', 'devDependencies']) {
  const list = Object.keys(pkg[k] || {});
  if (list.length) err(`package.json: ${k} 必须为空（构建链另案 P1），发现 ${list.join(', ')}`);
}

console.log(`registry: ${path.relative(ROOT, REGISTRY)}`);
console.log(`registered deps: ${deps.length} | total new gzip: ${totalKb} KiB`);
if (warnings.length) {
  console.log('\nWARN（体积为观测项，不阻断）:');
  warnings.forEach((w) => console.log(' -', w));
}
if (errors.length) {
  console.log(`\nFAIL (${errors.length}):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('\nPASS: 依赖准入检查通过');
