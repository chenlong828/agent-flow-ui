#!/usr/bin/env node
/**
 * 生成 design/scenarios/_index.md（零依赖）
 * 用法:
 *   node tools/gen-scenario-index.js [docsRoot]           # 重新生成
 *   node tools/gen-scenario-index.js --check [docsRoot]   # 只校验，不写盘
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const docArg = args.find((a) => !a.startsWith('--'));
const DOCS = path.resolve(docArg || path.join(__dirname, '..', 'docs'));
const INDEX = path.join(DOCS, 'design', 'scenarios', '_index.md');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
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

function buildIndex() {
  const root = path.join(DOCS, 'design', 'scenarios');
  const rows = walk(root)
    .filter((p) => path.basename(p) === 'scenario.md')
    .map((p) => {
      const text = fs.readFileSync(p, 'utf8');
      const f = frontmatter(text);
      const rel = path.relative(DOCS, p).split(path.sep).join('/');
      const parts = rel.split('/'); // design / scenarios / <domain> / <flow> / <scenario> / scenario.md
      const domain = parts[2] || '—';
      const flow = parts[3] || '—';
      const title = (text.match(/^#\s+(.+)$/m) || [null, f.scenario || rel])[1].trim();
      return {
        id: f.scenario || 'SCN-????',
        title,
        flow: `${domain} / ${flow}`,
        status: f.status || 'draft',
        path: rel,
        updated: f.updated || '1970-01-01',
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const updated = rows.reduce((max, r) => (r.updated > max ? r.updated : max), '1970-01-01');
  const table = rows.length
    ? [
        '| 场景 | 标题 | 领域 / 价值流 | 状态 | 路径 |',
        '|---|---|---|---|---|',
        ...rows.map((r) => `| ${r.id} | ${r.title} | ${r.flow} | ${r.status} | \`${r.path}\` |`),
      ].join('\n')
    : '（暂无场景）';

  return `---
layer: design
module: global
status: current
generated: true
updated: ${updated}
---

# 场景索引

> 生成物，请勿手改。运行 \`npm run docs:index\` 重新生成；\`npm run docs:index:check\` 校验无 diff。

${table}
`;
}

const next = buildIndex();

if (checkOnly) {
  if (!fs.existsSync(INDEX)) {
    console.error(`FAIL: 缺 ${path.relative(process.cwd(), INDEX)}；运行 npm run docs:index`);
    process.exit(1);
  }
  const current = fs.readFileSync(INDEX, 'utf8');
  if (current !== next) {
    console.error(`FAIL: ${path.relative(process.cwd(), INDEX)} 与生成结果不一致；运行 npm run docs:index`);
    process.exit(1);
  }
  console.log('PASS: 场景索引与生成结果一致');
} else {
  fs.mkdirSync(path.dirname(INDEX), { recursive: true });
  fs.writeFileSync(INDEX, next);
  console.log(`WROTE: ${path.relative(process.cwd(), INDEX)}`);
}
