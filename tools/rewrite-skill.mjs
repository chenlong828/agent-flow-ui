// 单条 Skill 重写落库：建草稿 → 删旧附件 → 上传新附件 → 保存正文。
// 用法：
//   node tools/rewrite-skill.mjs --skill "SVO 拆分" --body <正文文件> \
//     [--delete references/旧.md]... [--add references/新.md=<本地路径>]...
const BASE = process.env.API_BASE || 'http://127.0.0.1:3100';

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === '--' + name) out.push(process.argv[i + 1]); });
  return out;
}

async function call(method, path, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + text.slice(0, 300));
  return json;
}

async function main() {
  const name = arg('skill');
  const bodyPath = arg('body');
  if (!name || !bodyPath) throw new Error('需要 --skill 与 --body');
  const fs = await import('node:fs/promises');
  const body = await fs.readFile(bodyPath, 'utf8');
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > 16384) throw new Error('正文超过 16384 字节: ' + bytes);

  const list = await call('GET', '/api/v1/skills?limit=200');
  const skill = list.items.find(s => s.name === name);
  if (!skill) throw new Error('找不到 Skill: ' + name);
  const detail = await call('GET', '/api/v1/skills/' + skill.id);
  const draft = await call('POST', '/api/v1/skill-drafts', { skillId: skill.id });

  for (const p of args('delete')) {
    const res = await fetch(BASE + '/api/v1/skill-drafts/' + draft.id + '/files?path=' + encodeURIComponent(p), { method: 'DELETE' });
    if (!res.ok) throw new Error('删除附件失败 ' + p + ' -> ' + res.status);
    console.log('  - ' + p);
  }

  for (const spec of args('add')) {
    const eq = spec.indexOf('=');
    const refPath = spec.slice(0, eq);
    const local = spec.slice(eq + 1);
    const content = await fs.readFile(local);
    const fd = new FormData();
    fd.append('path', refPath);
    fd.append('file', new Blob([content], { type: 'text/markdown' }), refPath.split('/').pop());
    const res = await fetch(BASE + '/api/v1/skill-drafts/' + draft.id + '/files', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('上传附件失败 ' + refPath + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
    console.log('  + ' + refPath);
  }

  const saved = await call('POST', '/api/v1/skill-drafts/' + draft.id + '/save', {
    name: detail.name,
    categoryCode: detail.categoryCode,
    description: detail.description,
    tags: detail.tags || [],
    body
  }, { 'If-Match': '"' + draft.baseRevision + '"' });

  const after = await call('GET', '/api/v1/skills/' + skill.id);
  console.log('✓ ' + name + ' → ' + saved.version + '，正文 ' + bytes + ' B，附件 ' + after.files.length + ' 个');
}

main().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
