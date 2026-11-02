#!/usr/bin/env node
/**
 * 演示数据灌注（仅演示/测试）：把 assets/js/mock-data.js 的夹具经 B1/B3 HTTP API 写入后端。
 *
 * 约束：
 * - 只调用后端 HTTP API，不直连数据库、不写后端文件系统；
 * - 幂等：按名称跳过已存在记录，可重复执行；
 * - 运行期只读字段（Harness.health、Tool.status、Skill.version）由后端决定，脚本不伪造。
 *
 * 用法：
 *   node tools/demo-seed.mjs            # 默认 http://127.0.0.1:3100
 *   API_BASE=http://127.0.0.1:3100 node tools/demo-seed.mjs
 */

import { MOCK } from '../assets/js/mock-data.js';

const BASE = (process.env.API_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const JSON_HEADERS = { 'content-type': 'application/json' };

const KIND = { 容器: 'container', 服务器: 'server', 台式机: 'desktop', 笔记本: 'laptop' };
const ACCESS = { 容器注册: 'container_registry', '常驻 Agent': 'agent', SSH: 'ssh' };
const TOOL_KIND = { MCP: 'mcp', CLI: 'cli', 脚本: 'script' };
const CATEGORY = { 编码: 'coding', 检索: 'retrieval', 审视: 'review', 测试: 'testing' };

async function call(method, path, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({}, JSON_HEADERS, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (err) { data = text; }
  if (!res.ok) {
    const reason = data && data.error ? data.error.code + ': ' + data.error.message : text;
    const details = data && data.error && data.error.details ? ' ' + JSON.stringify(data.error.details) : '';
    throw new Error(method + ' ' + path + ' → HTTP ' + res.status + ' ' + reason + details);
  }
  return data;
}

async function listAll(path) {
  const sep = path.indexOf('?') >= 0 ? '&' : '?';
  const page = await call('GET', path + sep + 'limit=200');
  return page.items || [];
}

function byName(items, name) {
  return items.find(function (item) { return item.name === name; }) || null;
}

function report(title, lines) {
  console.log('\n== ' + title);
  lines.forEach(function (line) { console.log('   ' + line); });
}

/* ============ Harness ============ */
/* 夹具只有容器/服务器/笔记本三类；补一台台式机，对齐 PPT P5「笔记本/台式机/服务器/容器」四类。 */
const EXTRA_HARNESSES = [
  {
    id: 'h-desk02',
    name: 'desk-02',
    type: '台式机',
    address: '10.0.6.15:7801',
    accessMode: 'SSH',
    tags: ['UI验证', '调试'],
    max: 8,
    queuePolicy: 'fifo',
    desc: 'UI 走查与可视化验证用台式机'
  }
];

async function seedHarnesses() {
  const existing = await listAll('/api/v1/harnesses');
  const out = [];
  for (const h of MOCK.harnesses.concat(EXTRA_HARNESSES)) {
    const found = byName(existing, h.name);
    if (found) { out.push(found); continue; }
    const dto = await call('POST', '/api/v1/harnesses', {
      name: h.name,
      kind: KIND[h.type],
      address: h.address,
      accessMode: ACCESS[h.accessMode],
      description: h.desc,
      concurrencyMax: h.max,
      queuePolicy: h.queuePolicy,
      tags: h.tags,
      enabled: true
    });
    out.push(dto);
  }
  report('Harness', out.map(function (h) { return h.name + ' (' + h.kind + ')'; }));
  return out;
}

/* ============ 工具 ============ */
async function seedTools(harnesses) {
  const existing = await listAll('/api/v1/tools');
  const harnessById = new Map();
  harnesses.forEach(function (h) { harnessById.set(h.name, h.id); });
  const mockHarnessName = new Map(MOCK.harnesses.map(function (h) { return [h.id, h.name]; }));
  const out = [];
  for (const t of MOCK.tools) {
    const found = byName(existing, t.name);
    if (found) { out.push(found); continue; }
    const harnessName = mockHarnessName.get(t.harness);
    const harnessId = harnessById.get(harnessName);
    if (!harnessId) throw new Error('工具 ' + t.name + ' 的 Harness 未建立: ' + t.harness);
    const dto = await call('POST', '/api/v1/tools', {
      name: t.name,
      kind: TOOL_KIND[t.type],
      invocation: t.invocation,
      description: t.desc,
      harnessId: harnessId,
      timeoutMs: t.timeoutMs,
      params: t.params.map(function (p) { return { key: p.k, type: p.type, description: p.desc }; })
    });
    out.push(dto);
  }
  report('工具', out.map(function (t) { return t.name + ' (' + t.kind + ')'; }));
  return out;
}

/* ============ Skill ============ */
function skillBody(skill) {
  const sections = skill.sections || {};
  const blocks = [
    '## 适用场景\n\n' + (sections.overview || ''),
    '## 执行步骤\n\n' + (sections.steps || ''),
    '## 示例\n\n' + (sections.examples || ''),
    '## 脚本\n\n' + (sections.scripts || ''),
    '## 完成验证\n\n' + (sections.verification || '')
  ];
  if (Array.isArray(skill.pitfalls) && skill.pitfalls.length) {
    blocks.push('## 常见踩坑\n\n' + skill.pitfalls.map(function (p) { return '- ' + p; }).join('\n'));
  }
  blocks.push('## 参考资料\n\n' + (skill.refs || []).map(function (r) { return '- ' + r.label; }).join('\n'));
  return blocks.join('\n\n');
}

const EXTRA_SKILLS = [
  {
    id: 'sk-smoke2',
    name: '冒烟验证',
    category: '测试',
    tags: ['冒烟', '健康质检'],
    description: '适用：版本准出与制品级冒烟验证；触发：冒烟、健康质检点、RC 鉴定；不适用：需要业务语义判断的回归场景。',
    sections: {
      overview: '① 适用场景与前置条件 ② 执行步骤总览 ③ 输入输出约定 ④ 与其他 Skill 的配合',
      steps: '1. 载入制品级/集成运行冒烟清单\n2. 按健康质检点逐项执行\n3. 失败项记录可复现证据\n4. 全绿后方可交集成验证专家',
      examples: 'workspace:/skills/sk-smoke2/examples/rc-01.md（含 RC 冒烟清单与判定标准）',
      scripts: 'workspace:/skills/sk-smoke2/scripts/usage.md — smoke_runner 参数说明',
      verification: '健康质检点全绿 + 冒烟报告归档'
    },
    pitfalls: ['禁止用部分通过代替全绿'],
    refs: [{ label: 'CICD 基础服务接入指南', type: '规范' }]
  }
];

async function seedSkills() {
  const existing = await listAll('/api/v1/skills');
  const source = MOCK.skills.map(function (s) { return Object.assign({}, s, { __mock: s }); }).concat(EXTRA_SKILLS.map(function (s) {
    return Object.assign({ __extra: true }, s);
  }));
  const out = [];
  for (const skill of source) {
    const found = byName(existing, skill.name);
    if (found) { out.push(found); continue; }
    const draft = await call('POST', '/api/v1/skill-drafts', {});
    try {
      const saved = await call('POST', '/api/v1/skill-drafts/' + draft.id + '/save', {
        name: skill.name,
        categoryCode: CATEGORY[skill.category],
        description: skill.description,
        tags: skill.tags || [],
        body: skillBody({ sections: skill.sections, pitfalls: skill.pitfalls, refs: skill.refs })
      });
      out.push(saved);
    } catch (err) {
      await call('DELETE', '/api/v1/skill-drafts/' + draft.id).catch(function () {});
      throw err;
    }
  }
  const fresh = await listAll('/api/v1/skills');
  const byNameMap = new Map(fresh.map(function (s) { return [s.name, s]; }));
  // 夹具里 enabled=false 的 Skill 在 API 创建后统一关停
  for (const skill of MOCK.skills) {
    const target = byNameMap.get(skill.name);
    if (target && skill.enabled === false && target.enabled) {
      const patched = await call('PATCH', '/api/v1/skills/' + target.id + '/enabled', { enabled: false }, { 'If-Match': '"' + target.revision + '"' });
      byNameMap.set(skill.name, patched);
    }
  }
  const final = Array.from(byNameMap.values());
  report('Skill', final.map(function (s) { return s.name + ' [' + s.categoryCode + ']' + (s.enabled ? '' : ' ·停用'); }));
  return final;
}

/* ============ 专家 ============ */
const SKILL_ALIASES = { 'sk-smoke2': '冒烟验证' };

async function seedExperts(skills, tools) {
  const existing = await listAll('/api/v1/experts');
  const skillByName = new Map(skills.map(function (s) { return [s.name, s]; }));
  const mockSkillName = new Map(MOCK.skills.map(function (s) { return [s.id, s.name]; }));
  mockSkillName.set('sk-smoke2', '冒烟验证');
  const toolByName = new Map(tools.map(function (t) { return [t.name, t]; }));
  const mockToolName = new Map(MOCK.tools.map(function (t) { return [t.id, t.name]; }));
  const out = [];
  for (const expert of MOCK.experts) {
    const found = byName(existing, expert.name);
    if (found) { out.push(found); continue; }
    const skillIds = expert.skills.map(function (id) {
      const name = SKILL_ALIASES[id] || mockSkillName.get(id);
      const skill = skillByName.get(name);
      if (!skill) throw new Error('专家 ' + expert.name + ' 引用的 Skill 不存在: ' + id);
      return skill.id;
    });
    const toolIds = expert.tools.map(function (id) {
      const tool = toolByName.get(mockToolName.get(id));
      if (!tool) throw new Error('专家 ' + expert.name + ' 引用的工具不存在: ' + id);
      return tool.id;
    });
    const dto = await call('POST', '/api/v1/experts', {
      name: expert.name,
      color: expert.color,
      role: expert.role,
      enabled: expert.enabled,
      persona: expert.persona,
      duty: expert.duty,
      skillOrder: expert.skillOrder,
      verifyOrder: expert.verifyOrder,
      notes: expert.notes,
      refs: (expert.refs || []).map(function (r) { return { label: r.label, refType: r.type, path: null }; }),
      skillIds: skillIds,
      toolIds: toolIds
    });
    out.push(dto);
  }
  report('专家', out.map(function (e) { return e.name + ' (skill ' + e.skillCount + ' / tool ' + e.toolCount + ')'; }));
  return out;
}

/* ============ 工作流 ============ */
function stageLayout(wf, stageId) {
  const box = wf.graph.stageBoxes && wf.graph.stageBoxes[stageId];
  if (box) return { x: box.x, y: box.y, width: box.w, height: box.h };
  return undefined;
}

function firstExpert(nodes, type) {
  const node = nodes.find(function (n) { return n.type === type && n.expertId; });
  return node ? node.expertId : null;
}

function toGraph(wf, expertByMockId) {
  const nodes = wf.graph.nodes;
  const stageMembers = {};
  nodes.forEach(function (n) {
    if (n.stageId) {
      stageMembers[n.stageId] = stageMembers[n.stageId] || [];
      stageMembers[n.stageId].push(n);
    }
  });
  const stages = (wf.graph.stages || []).map(function (stage) {
    const box = stageLayout(wf, stage.id);
    const members = stageMembers[stage.id] || [];
    const layout = box || (members.length ? {
      x: Math.min.apply(null, members.map(function (n) { return n.x; })) - 36,
      y: Math.min.apply(null, members.map(function (n) { return n.y; })) - 58,
      width: Math.max(360, Math.max.apply(null, members.map(function (n) { return n.x; })) - Math.min.apply(null, members.map(function (n) { return n.x; })) + 240),
      height: 200
    } : undefined);
    const out = { id: stage.id, name: stage.name };
    if (stage.note) out.description = stage.note;
    if (layout) out.layout = layout;
    return out;
  });

  const startExpert = expertByMockId[firstExpert(nodes, 'agent')] || expertByMockId.e1;
  const reviewExpert = (function () {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      if (nodes[i].type === 'review' && nodes[i].expertId) return expertByMockId[nodes[i].expertId];
    }
    return expertByMockId.e6;
  })();

  const b3Nodes = nodes.map(function (n) {
    let expertId = n.expertId ? expertByMockId[n.expertId] : null;
    if (!expertId && (n.type === 'fanout' || n.type === 'fanin')) {
      const subExpert = n.config && n.config.subExpert ? expertByMockId[n.config.subExpert] : null;
      expertId = subExpert || startExpert;
    }
    if (!expertId && n.type === 'start') expertId = startExpert;
    if (!expertId && n.type === 'end') expertId = reviewExpert;
    return {
      id: n.id,
      type: n.type,
      name: n.name,
      stageId: n.stageId || null,
      expertId: expertId,
      layout: { x: n.x, y: n.y }
    };
  });
  const edges = wf.graph.edges.map(function (e, index) {
    return { id: 'e' + (index + 1), from: e.from, to: e.to, kind: e.kind === 'rollback' ? 'rollback' : 'seq' };
  });
  return { stages: stages, nodes: b3Nodes, edges: edges, viewport: { x: 0, y: 0, zoom: 0.8 } };
}

async function seedWorkflows(experts) {
  const existing = await listAll('/api/v1/workflows');
  const expertByMockId = {};
  MOCK.experts.forEach(function (expert) {
    const match = byName(experts, expert.name);
    if (match) expertByMockId[expert.id] = match.id;
  });
  const out = [];
  for (const wf of MOCK.workflows) {
    const found = byName(existing, wf.name);
    if (found) {
      if (process.env.REFRESH === '1') {
        const graph = toGraph(wf, expertByMockId);
        await call('PUT', '/api/v1/workflows/' + found.id + '/definition', { graph: graph }, { 'If-Match': '"' + found.revision + '"' });
        out.push({ name: wf.name, id: found.id, nodes: graph.nodes.length, stages: graph.stages.length, refreshed: true });
      } else {
        out.push(found);
      }
      continue;
    }
    const graph = toGraph(wf, expertByMockId);
    const created = await call('POST', '/api/v1/workflows', {
      name: wf.name,
      type: wf.type,
      description: wf.desc,
      graph: graph
    });
    out.push({ name: wf.name, id: created.id, nodes: graph.nodes.length, stages: graph.stages.length, warnings: created.warnings });
  }
  report('工作流', out.map(function (w) { return w.name + ' · ' + (w.nodes || '?') + ' 节点 / ' + (w.stages || 0) + ' 阶段'; }));
  return out;
}

/* ============ 主流程 ============ */
async function main() {
  console.log('演示数据灌注 → ' + BASE);
  const health = await call('GET', '/healthz').catch(function (err) {
    throw new Error('后端未就绪（' + BASE + '/healthz）：' + err.message);
  });
  if (!health || health.status !== 'ok') throw new Error('后端健康检查异常: ' + JSON.stringify(health));

  const harnesses = await seedHarnesses();
  const tools = await seedTools(harnesses);
  const skills = await seedSkills();
  const experts = await seedExperts(skills, tools);
  await seedWorkflows(experts);

  const counts = {};
  for (const [key, path] of [['harness', '/api/v1/harnesses'], ['tool', '/api/v1/tools'], ['skill', '/api/v1/skills'], ['expert', '/api/v1/experts'], ['workflow', '/api/v1/workflows']]) {
    const page = await call('GET', path + '?limit=1');
    counts[key] = page.total;
  }
  report('后端计数', Object.keys(counts).map(function (k) { return k + '=' + counts[k]; }));
  console.log('\n完成。');
}

main().catch(function (err) {
  console.error('\n灌注失败：' + err.message);
  process.exitCode = 1;
});
