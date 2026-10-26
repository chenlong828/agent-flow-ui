/**
 * AgentFlow 原型 · 全量模拟数据（window.MOCK）
 * 时间基准: 页面加载时刻 - minutesAgo。所有页面只读消费。
 */
(function () {
  'use strict';
  const NOW = Date.now();
  const m = min => new Date(NOW - min * 60000); // minutes ago → Date
  const mts = min => m(min).getTime();

  /* ============ 便签式小工具（确定性伪随机） ============ */
  let _seed = 42;
  function rnd() { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function ri(min, max) { return Math.floor(min + rnd() * (max - min + 1)); }

  /* ============ 专家 ============ */
  const experts = [
    { id: 'e1', name: '需求分析专家', color: '#2563eb', role: '厘清客户真实需求，结合业务功能树展开为成体系的需求描述', persona: ['严谨', '刨根问底'], skills: ['sk-cres', 'sk-btree', 'sk-meta'], tools: ['t-meta', 't-btree'], duty: '从 Issue/人工输入出发完成意图识别、范围识别与交叉探索，产出结构化需求 Spec', skillOrder: '先业务功能树检索圈定范围 → 元数据查询补全上下游 → CRES 规范约束文档产出', verifyOrder: '需求完整性自检 → 与功能树逐节点对照 → 格式规范校验', notes: '对"一句话需求"保持警惕，必须追问到可实施粒度', refs: [{ label: '金融证券交易业务规则汇编', type: '行业规则' }, { label: 'workspace:/knowledge/requirements-spec-template.md', type: '运行期注入' }], enabled: true },
    { id: 'e2', name: '方案设计专家', color: '#7c3aed', role: '在遗留方案基础上给出全面、深入、无遗漏的变更方案', persona: ['全局观', '谨慎'], skills: ['sk-cres', 'sk-callchain', 'sk-dsl'], tools: ['t-trace', 't-dsl', 't-meta'], duty: '输出技术方案 Spec、任务拆分与测试分析，标记可顺带处理的技术债', skillOrder: '调用链分析摸清现状 → DSL 检索确认扩展点 → 按 CRES 规范产出设计', verifyOrder: '方案完整性对照检查单 → 变更影响面交叉验证', notes: '优先复用公共技术平台能力，避免重复造轮子', refs: [{ label: '架构设计红线的 Brief', type: '经验' }], enabled: true },
    { id: 'e3', name: '开发实现专家', color: '#16a34a', role: '按独立任务完成代码与自动化测试用例编写', persona: ['规范控', '高效'], skills: ['sk-cres', 'sk-ldp', 'sk-lint'], tools: ['t-lint', 't-dsl', 't-trace'], duty: '遵循架构/编码/低代码 DSL 规范完成 CRES、LDP 框架代码与用例', skillOrder: '任务计划 → LDP 脚手架生成 → CRES 编码规范实现 → Linter 自检', verifyOrder: '基础逻辑自测通过 → 编码规范零告警', notes: '禁止绕过收敛约束直接提交', refs: [{ label: '编码规范约束手册', type: '规范' }], enabled: true },
    { id: 'e4', name: '测试验证专家', color: '#ea580c', role: '设计并执行场景化用例，组织测试环境与验证金标准', persona: ['挑剔', '数据敏感'], skills: ['sk-svo', 'sk-factory', 'sk-replay'], tools: ['t-factory', 't-smoke', 't-replay'], duty: '基于场景用例调度 CICD 完成版本构建、部署与穿测', skillOrder: 'SVO 拆分定位验证目标 → 业务造数 → 冒烟/回归执行', verifyOrder: '黄金标准数据比对 → 覆盖率核查', notes: '业务正确性以 DevOps 验证代码与预期结果为准', refs: [{ label: 'SVO 事实锚说明', type: '规范' }], enabled: true },
    { id: 'e5', name: '代码审视专家', color: '#0d9488', role: '按调用链/模块/文件级别批量审视代码与产物并修复缺陷', persona: ['细致', '多疑'], skills: ['sk-ab', 'sk-lint', 'sk-callchain', 'sk-dsl'], tools: ['t-lint', 't-trace', 't-smell', 't-meta', 't-dsl'], duty: '执行魔法数清理、内存释放审视、入口参数校验等批量任务', skillOrder: 'DSL 检索圈定目标 → 调用链定位 → AB 交叉审视输出', verifyOrder: '审视结论双通道一致 → 修复后 Linter 复检', notes: '审视结论必须给出证据位置（文件+行号）', refs: [{ label: '历史踩坑记录索引', type: '经验' }], enabled: true },
    { id: 'e6', name: '评审专家', color: '#dc2626', role: '以独立、否决的视角对阶段产物进行评审准出', persona: ['独立', '否决视角', '不留情面'], skills: ['sk-ab', 'sk-cres'], tools: ['t-lint', 't-meta'], duty: '输出通过/回退指令，回退时携带结构化评审意见', skillOrder: '对照阶段准出清单逐项核验 → 输出结论', verifyOrder: '证据链完整性检查', notes: '评审与被评审角色必须在上下文上隔离，禁止读取执行过程的内心独白', refs: [{ label: '约 50 项准出标准（需求/方案/代码/测试）', type: '规范' }], enabled: true },
    { id: 'e7', name: '集成验证专家', color: '#4f46e5', role: '基于 CICD 与 Agent Runtime 完成多组件和场景化验证', persona: ['流程控'], skills: ['sk-svo', 'sk-contract', 'sk-smoke2'], tools: ['t-smoke', 't-contract', 't-replay'], duty: '场景串接化测试验证、版本编制与内部部署调度', skillOrder: '环境组织 → 契约断言 → E2E 穿测', verifyOrder: '健康质检点全绿 → 回归通过', notes: '关注版本 RP 合并前的资产一致性校验', refs: [{ label: 'CICD 基础服务接入指南', type: '规范' }], enabled: true },
    { id: 'e8', name: '知识库运营专家', color: '#0ea5e9', role: '维护分层知识索引与技能沉淀，防止技能老化与冲突', persona: ['归纳癖'], skills: ['sk-btree', 'sk-meta'], tools: ['t-meta', 't-btree'], duty: '人工校准问题回写知识库、专家技能库，维护索引迭代', skillOrder: '变更收集 → 索引更新 → 冲突检测', verifyOrder: '索引一致性校验', notes: '知识库膨胀是最大风险，坚持渐进式披露', refs: [{ label: '知识库运营手册', type: '经验' }], enabled: true }
  ];

  /* ============ Skill ============ */
  const sk = (id, name, category, tags, description, pitfalls, version, enabled, updatedM, usedBy, refs) => ({
    id, name, category, tags, description,
    sections: {
      overview: '① 适用场景与前置条件 ② 执行步骤总览 ③ 输入输出约定 ④ 与其他 Skill 的配合',
      steps: '1. 载入角色上下文与收敛约束\n2. 按 ' + name + ' 标准流程逐步执行，禁止跳步\n3. 每步产物写入 workspace 对应目录\n4. 完成后执行完成验证方案自检',
      examples: 'workspace:/skills/' + id + '/examples/case-01.md（含输入样例与期望产物模板）',
      scripts: 'workspace:/skills/' + id + '/scripts/usage.md — 脚本参数与调用方式说明',
      verification: '产物格式校验脚本 + 关键检查单逐项打勾，不通过禁止标记完成'
    },
    pitfalls,
    refs: refs !== undefined ? refs : [
      { label: '关联 Skill: AB交叉审视', type: 'skill' },
      { label: 'workspace:/skills/' + id + '/templates/', type: '模板' },
      { label: '外部规范: 平台接入指南 v2.3', type: '外部规范' }
    ],
    version, enabled, updatedM, usedBy
  });
  const skills = [
    sk('sk-cres', 'CRES 技能', '编码', ['CRES', '规范'], '适用：需要按 CRES 专属框架编写代码或产出技术方案时；触发：CRES、代码生成；不适用：非 CRES 工程。', ['严格禁止绕过基类直接操作数据层', '禁止在 Skill 中硬编码环境配置'], 'v1.4', true, 30, 4),
    sk('sk-ldp', 'LDP 技能', '编码', ['LDP', '低代码'], '适用：低代码页面与后台服务开发；触发：LDP、低代码、DSL；不适用：纯手写原生工程。', ['禁止手改生成器产物中的标记段'], 'v2.0', true, 1440, 3),
    sk('sk-callchain', '调用链分析', '检索', ['调用链', 'Trace'], '适用：定位符号引用链与变更影响面；触发：调用链、影响面、trace；不适用：只做单文件静态检查。', ['禁止只看单点调用就下结论，必须追完整链'], 'v2.1', true, 120, 5),
    sk('sk-meta', '元数据查询', '检索', ['元数据', 'Metadata'], '适用：补全实体、字段与服务上下文；触发：元数据、字段；不适用：需要业务语义解释的场景。', ['查询结果必须记录版本号，禁止使用过期元数据'], 'v1.2', true, 2880, 6),
    sk('sk-btree', '业务功能树检索', '检索', ['功能树', '业务域'], '适用：沿业务域→价值流→场景定位代码入口；触发：功能树、业务域、场景；不适用：已知精确文件路径。', ['禁止跳过功能树直接全文搜索'], 'v1.6', true, 90, 4),
    sk('sk-dsl', 'DSL 检索', '检索', ['DSL'], '适用：在低代码 DSL 资产中检索扩展点与配置；触发：DSL、扩展点；不适用：原生代码仓库检索。', ['禁止假设 DSL 节点存在，必须检索确认'], 'v1.0', true, 4320, 3, []),
    sk('sk-ab', 'AB 交叉审视', '审视', ['AB', '交叉'], '适用：两个独立上下文交叉审视同一产物；触发：交叉审视、AB；不适用：单视角快速自检。', ['禁止两个视角共享上下文，必须隔离'], 'v1.3', true, 60, 6),
    sk('sk-lint', 'Linter 代码体检', '审视', ['Linter', '静态检查'], '适用：静态检查编码规范；触发：lint、静态检查；不适用：需要语义判断的架构问题。', ['禁止人工解释 Linter 告警为误报而不留证据'], 'v3.1', true, 15, 4),
    sk('sk-contract', '契约断言', '审视', ['契约', '接口'], '适用：为接口契约生成断言并守护；触发：契约、断言、接口；不适用：无契约文件的脚本。', ['契约变更必须同步功能树，禁止静默改契约'], 'v1.1', true, 720, 2),
    sk('sk-svo', 'SVO 拆分', '测试', ['SVO'], '适用：把验证目标拆到 SVO 事实锚；触发：SVO、验证目标；不适用：探索性测试。', ['禁止没有事实锚就编写用例'], 'v2.2', true, 200, 3),
    sk('sk-factory', '业务造数工具', '测试', ['造数'], '适用：按场景生成业务测试数据；触发：造数、数据；不适用：生产数据直接回灌。', ['生产数据禁止直接回灌，必须清洗'], 'v1.5', true, 600, 2),
    sk('sk-replay', '回放数据清洗', '测试', ['回放', '流量'], '适用：流量回放前的数据清洗与脱敏；触发：回放、清洗；不适用：已脱敏的离线样本。', [], 'v0.9', false, 7200, 1)
  ];

  /* ============ Harness ============ */
  const harnesses = [
    { id: 'h-build01', name: 'build-01', type: '容器', address: '10.0.4.11:7801', accessMode: '容器注册', tags: ['CICD', '构建', '测试'], health: '在线', heartbeatM: 0.08, running: 8, max: 20, queuePolicy: 'fifo', regAt: '2025-08-02', desc: 'CI 构建容器池节点', lastTasks: [{ label: '构建 #3102', inst: 'INS-2025', node: '集成验证', startedM: 38 }, { label: '审视 T-0012', inst: 'INS-2036', node: '审视任务展开', startedM: 12 }] },
    { id: 'h-build02', name: 'build-02', type: '容器', address: '10.0.4.12:7801', accessMode: '容器注册', tags: ['CICD', '测试', '部署'], health: '在线', heartbeatM: 0.1, running: 4, max: 20, queuePolicy: 'fifo', regAt: '2025-08-02', desc: 'CI 构建容器池节点', lastTasks: [{ label: '冒烟 #987', inst: 'INS-2025', node: '集成验证', startedM: 51 }] },
    { id: 'h-agent07', name: 'agent-07', type: '服务器', address: '10.0.5.23:7801', accessMode: '常驻 Agent', tags: ['审视', '检索', '批处理'], health: '高负载', heartbeatM: 0.2, running: 18, max: 20, queuePolicy: 'priority', regAt: '2025-06-15', desc: '批量审视专用服务器（LLM 波谷跑批）', lastTasks: [{ label: '审视 T-0007', inst: 'INS-2036', node: '审视任务展开', startedM: 8 }, { label: '审视 T-0031', inst: 'INS-2036', node: '审视任务展开', startedM: 8 }] },
    { id: 'h-etl03', name: 'etl-03', type: '服务器', address: '10.0.5.31:7801', accessMode: '常驻 Agent', tags: ['造数', '回放', '数据'], health: '在线', heartbeatM: 0.12, running: 6, max: 30, queuePolicy: 'fifo', regAt: '2025-07-01', desc: '造数与回放数据节点', lastTasks: [{ label: '造数 scene=订单', inst: 'INS-2025', node: '集成验证', startedM: 66 }] },
    { id: 'h-devlap', name: 'dev-lap', type: '笔记本', address: '192.168.1.8:7801', accessMode: 'SSH', tags: ['调试'], health: '离线', heartbeatM: 128, running: 0, max: 5, queuePolicy: 'fifo', regAt: '2025-09-20', desc: '个人调试用接入（下班离线）', lastTasks: [] }
  ];

  /* ============ 工具（MCP/CLI/脚本） ============ */
  const tools = [
    { id: 't-trace', name: 'trace_call_chain', type: 'CLI', invocation: 'trace --symbol {symbol} --depth {depth}', params: [{ k: 'symbol', type: 'string', desc: '目标符号（类/方法）' }, { k: 'depth', type: 'int', desc: '追踪深度，默认 3' }], harness: 'h-build01', timeoutMs: 30000, status: '可用', desc: '调用链分析，圈定变更影响面', refCount: 5, lastDebugM: 120, runs: [{ ok: true, ms: 820 }, { ok: true, ms: 910 }, { ok: true, ms: 790 }] },
    { id: 't-meta', name: 'metadata_query', type: 'MCP', invocation: 'mcp://meta/query?entity={entity}', params: [{ k: 'entity', type: 'string', desc: '实体名或 ID' }], harness: 'h-build02', timeoutMs: 10000, status: '可用', desc: '实体/字段/服务元数据查询', refCount: 6, lastDebugM: 180, runs: [{ ok: true, ms: 120 }, { ok: true, ms: 130 }] },
    { id: 't-dsl', name: 'dsl_search', type: 'CLI', invocation: 'dsl search --kw {keyword} --proj {project}', params: [{ k: 'keyword', type: 'string', desc: '检索关键字' }, { k: 'project', type: 'string', desc: '工程名' }], harness: 'h-agent07', timeoutMs: 15000, status: '可用', desc: '低代码 DSL 资产检索', refCount: 3, lastDebugM: 240, runs: [{ ok: true, ms: 340 }] },
    { id: 't-lint', name: 'linter', type: 'CLI', invocation: 'lint --path {path} --rules {rules}', params: [{ k: 'path', type: 'string', desc: '目标路径' }, { k: 'rules', type: 'string', desc: '规则集，缺省 default' }], harness: 'h-agent07', timeoutMs: 60000, status: '可用', desc: '编码规范静态检查', refCount: 4, lastDebugM: 15, runs: [{ ok: true, ms: 2100 }, { ok: true, ms: 1980 }, { ok: false, ms: 30 }, { ok: true, ms: 2050 }] },
    { id: 't-smell', name: 'code_smell_scan', type: 'CLI', invocation: 'scan --path {path} --suite {suite}', params: [{ k: 'path', type: 'string', desc: '目标路径' }, { k: 'suite', type: 'string', desc: '审视套件: magic|mem|lock|param' }], harness: 'h-agent07', timeoutMs: 120000, status: '可用', desc: '魔法数清理/内存释放/锁与事务/入口参数 批量审视', refCount: 2, lastDebugM: 60, runs: [{ ok: true, ms: 8800 }] },
    { id: 't-contract', name: 'contract_assert', type: 'CLI', invocation: 'contract assert --spec {spec} --env {env}', params: [{ k: 'spec', type: 'string', desc: '契约文件' }, { k: 'env', type: 'string', desc: '环境' }], harness: 'h-build02', timeoutMs: 45000, status: '可用', desc: '接口契约断言守护', refCount: 2, lastDebugM: 400, runs: [{ ok: true, ms: 1500 }] },
    { id: 't-factory', name: 'data_factory', type: '脚本', invocation: 'python tools/make_data.py --scene {scene} --rows {rows}', params: [{ k: 'scene', type: 'string', desc: '业务场景编码' }, { k: 'rows', type: 'int', desc: '生成行数' }], harness: 'h-etl03', timeoutMs: 180000, status: '未验证', desc: 'SVO 场景业务造数', refCount: 2, lastDebugM: null, runs: [] },
    { id: 't-replay', name: 'replay_clean', type: '脚本', invocation: 'python tools/replay_clean.py --src {src}', params: [{ k: 'src', type: 'string', desc: '回放数据源目录' }], harness: 'h-etl03', timeoutMs: 300000, status: '不可用', desc: '回放数据清洗与脱敏（依赖库缺失待修复）', refCount: 1, lastDebugM: 2880, runs: [{ ok: false, ms: 4200 }, { ok: false, ms: 3900 }] },
    { id: 't-btree', name: 'business_tree_query', type: 'MCP', invocation: 'mcp://btree/query?node={node}', params: [{ k: 'node', type: 'string', desc: '功能树节点 ID' }], harness: 'h-build02', timeoutMs: 10000, status: '可用', desc: '业务功能树（业务域/价值流/场景）查询，需求唯一事实来源', refCount: 4, lastDebugM: 90, runs: [{ ok: true, ms: 88 }] },
    { id: 't-smoke', name: 'smoke_runner', type: 'CLI', invocation: 'smoke run --pipeline {pipeline} --stage {stage}', params: [{ k: 'pipeline', type: 'string', desc: '流水线 ID' }, { k: 'stage', type: 'string', desc: '制品级/集成运行' }], harness: 'h-build01', timeoutMs: 600000, status: '可用', desc: '制品级冒烟与集成运行冒烟', refCount: 3, lastDebugM: 360, runs: [{ ok: true, ms: 154000 }, { ok: true, ms: 149000 }] }
  ];

  /* ============ 分层知识索引（编辑器「知识索引注入」数据源） ============ */
  const knowledgeTree = [
    { domain: '金融证券交易', streams: [
      { name: '交易执行', scenes: [
        { name: '订单提交', entries: ['UFX/OrderService.java', 'UFX/OrderDAO.java', 'api/order-submit.spec'] },
        { name: '行情推送', entries: ['I2GW/QuotePush.java', 'Front/quote-subscriber.ts'] }] },
      { name: '清算交收', scenes: [
        { name: '日终清算', entries: ['PB2/ClearingJob.java', 'UFT/settle-batch.spec'] }] }] },
    { domain: '研发效能', streams: [
      { name: '代码审视', scenes: [
        { name: '批量审视', entries: ['scan/batch-entry.md', 'scan/suites.yaml'] }] }] }
  ];

  /* ============ 工作流图构建辅助 ============ */
  const N = (id, type, name, stageId, extra) => Object.assign({ id, type, name, stageId: stageId || null }, extra || {});
  const E = (from, to, kind) => ({ id: from + '>' + to + (kind && kind !== 'seq' ? ':' + kind : ''), from, to, kind: kind || 'seq' });

  function graphRnD() {
    const stages = [
      { id: 's1', name: '阶段 01 · 业务需求分析', note: '准出：需求完整性符合规范、人工审视达标' },
      { id: 's2', name: '阶段 02 · 技术方案设计', note: '准出：方案完整可落地，核心专家交叉审视' },
      { id: 's3', name: '阶段 03 · 开发测试实现', note: '准出：测试用例与冒烟测试通过' },
      { id: 's4', name: '阶段 04 · 集成验证发布', note: '准出：场景/回归通过，RC 通过鉴定小组验证' }
    ];
    const nodes = [
      N('n1', 'start', '开始', null, { x: 24, y: 140 }),
      N('n2', 'agent', '需求获取', 's1', { x: 150, y: 120, expertId: 'e1', config: { input: 'workspace:/inbox/issues/', output: 'requirements/draft.md', ctx: { knowledge: ['金融证券交易/交易执行/订单提交'], constraint: '需求描述必须可实施到功能点级', maxCtx: 32000, tools: ['t-btree', 't-meta'] } } }),
      N('n3', 'agent', '意图识别', 's1', { x: 352, y: 120, expertId: 'e1', config: { input: 'requirements/draft.md', output: 'requirements/intent.md', ctx: { knowledge: [], constraint: '先分类（缺陷/需求/重构）再展开', maxCtx: 32000, tools: ['t-btree'] } } }),
      N('n4', 'review', '需求评审', 's1', { x: 554, y: 120, expertId: 'e6', config: { points: '需求完整性、可实施粒度、格式规范', rollbackTo: 'n2', passNote: '通过 → 进入方案设计', failNote: '不通过 → 携带意见回退需求获取' } }),
      N('n5', 'agent', '方案设计', 's2', { x: 150, y: 350, expertId: 'e2', config: { input: 'requirements/intent.md', output: 'design/spec.md', ctx: { knowledge: ['金融证券交易/交易执行/订单提交'], constraint: '全面、深入、无遗漏；标记可处理的技术债', maxCtx: 48000, tools: ['t-trace', 't-dsl'] } } }),
      N('n6', 'review', '方案评审', 's2', { x: 352, y: 350, expertId: 'e6', config: { points: '核心专家交叉审视：完整性/可落地性/技术债', rollbackTo: 'n5', passNote: '通过 → 提交人工确认', failNote: '不通过 → 回退方案设计' } }),
      N('n7', 'confirm', '方案确认（人工）', 's2', { x: 554, y: 350, expertId: null, config: { desc: '人工审批技术方案后继续；驳回自动回退方案设计', planPath: 'design/spec.md', timeout: 'none' } }),
      N('n8', 'fanout', '开发任务展开', 's2', { x: 756, y: 350, expertId: null, config: { sourceNode: 'n6', sourcePath: 'design/task-list.json', shard: '按清单项', maxConc: 50, subExpert: 'e3', subSkills: ['sk-cres', 'sk-ldp'], worktree: true } }),
      N('n9', 'fanin', '开发结果聚合', 's3', { x: 150, y: 580, expertId: null, config: { strategy: 'threshold', threshold: 95, outPath: 'dev/summary.md' } }),
      N('n10', 'agent', '测试验证', 's3', { x: 352, y: 580, expertId: 'e4', config: { input: 'dev/summary.md', output: 'test/report.md', ctx: { knowledge: [], constraint: '以黄金标准数据比对为准', maxCtx: 48000, tools: ['t-factory', 't-smoke'] } } }),
      N('n11', 'review', '测试准出评审', 's3', { x: 554, y: 580, expertId: 'e6', config: { points: '用例通过率、冒烟结果、覆盖率', rollbackTo: 'n10', passNote: '通过 → 进入集成验证', failNote: '不通过 → 回退测试验证' } }),
      N('n12', 'agent', '集成验证', 's4', { x: 150, y: 810, expertId: 'e7', config: { input: 'test/report.md', output: 'release/rc-report.md', ctx: { knowledge: [], constraint: '健康质检点全绿方可准出', maxCtx: 48000, tools: ['t-smoke', 't-contract'] } } }),
      N('n13', 'review', '发布评审', 's4', { x: 352, y: 810, expertId: 'e6', config: { points: '场景/回归用例通过、RC 版本鉴定', rollbackTo: 'n12', passNote: '通过 → 流程产出', failNote: '不通过 → 回退集成验证' } }),
      N('n14', 'end', '结束', null, { x: 554, y: 940 })
    ];
    const edges = [
      E('n1', 'n2'), E('n2', 'n3'), E('n3', 'n4'), E('n4', 'n5'), E('n4', 'n2', 'rollback'),
      E('n5', 'n6'), E('n6', 'n5', 'rollback'), E('n6', 'n7'), E('n7', 'n8'), E('n7', 'n5', 'rollback'),
      E('n8', 'n9', 'par'), E('n9', 'n10'), E('n10', 'n11'), E('n11', 'n10', 'rollback'),
      E('n11', 'n12'), E('n12', 'n13'), E('n13', 'n12', 'rollback'), E('n13', 'n14')
    ];
    const stageBoxes = { s1: { x: 110, y: 78, w: 660, h: 168 }, s2: { x: 110, y: 308, w: 860, h: 168 }, s3: { x: 110, y: 538, w: 660, h: 168 }, s4: { x: 110, y: 768, w: 660, h: 168 } };
    return { nodes, edges, stages, stageBoxes, w: 1000, h: 1050 };
  }

  function graphReq() {
    const nodes = [
      N('r1', 'start', '开始', null, { x: 24, y: 60 }),
      N('r2', 'agent', '需求获取', null, { x: 150, y: 40, expertId: 'e1', config: { input: 'workspace:/inbox/issues/', output: 'requirements/draft.md', ctx: { knowledge: ['金融证券交易/交易执行/订单提交'], constraint: '需求成体系、可实施', maxCtx: 32000, tools: ['t-btree'] } } }),
      N('r3', 'agent', '意图识别', null, { x: 352, y: 40, expertId: 'e1', config: { input: 'requirements/draft.md', output: 'requirements/intent.md', ctx: { knowledge: [], constraint: '判定是否处理范围内', maxCtx: 32000, tools: ['t-btree'] } } }),
      N('r4', 'agent', '范围识别', null, { x: 554, y: 40, expertId: 'e1', config: { input: 'requirements/intent.md', output: 'requirements/scope.md', ctx: { knowledge: ['金融证券交易/清算交收/日终清算'], constraint: '上下游模块影响面必须完整', maxCtx: 32000, tools: ['t-btree', 't-meta'] } } }),
      N('r5', 'fanout', '交叉探索补全', null, { x: 756, y: 40, expertId: null, config: { sourceNode: 'r4', sourcePath: 'requirements/scope-clues.json', shard: '按线索项', maxConc: 20, subExpert: 'e1', subSkills: ['sk-btree', 'sk-meta', 'sk-callchain'], worktree: false } }),
      N('r6', 'fanin', '探索结果聚合', null, { x: 150, y: 200, expertId: null, config: { strategy: 'all', outPath: 'requirements/explore.md' } }),
      N('r7', 'review', '需求分析结果审核', null, { x: 352, y: 200, expertId: 'e6', config: { points: '描述清晰、方案分析合理、文档格式规范', rollbackTo: 'r4', passNote: '通过 → 人工校准', failNote: '不通过 → 回退范围识别' } }),
      N('r8', 'confirm', '人工校准', null, { x: 554, y: 200, expertId: null, config: { desc: '人工核实需求分析文档，问题回写知识库与技能库', planPath: 'requirements/draft.md', timeout: 'none' } }),
      N('r9', 'agent', '需求文档输出', null, { x: 756, y: 200, expertId: 'e1', config: { input: 'requirements/explore.md', output: 'requirements/spec-final.md', ctx: { knowledge: [], constraint: '按模板产出', maxCtx: 32000, tools: [] } } }),
      N('r10', 'end', '结束', null, { x: 958, y: 200 })
    ];
    const edges = [E('r1', 'r2'), E('r2', 'r3'), E('r3', 'r4'), E('r4', 'r5', 'par'), E('r5', 'r6'), E('r6', 'r7'), E('r7', 'r4', 'rollback'), E('r7', 'r8'), E('r8', 'r4', 'rollback'), E('r8', 'r9'), E('r9', 'r10')];
    return { nodes, edges, stages: [], stageBoxes: {}, w: 1180, h: 320 };
  }

  function graphBatch() {
    const nodes = [
      N('b1', 'start', '开始', null, { x: 24, y: 80 }),
      N('b2', 'agent', '范围圈定', null, { x: 150, y: 60, expertId: 'e5', config: { input: 'workspace:/scan/targets/', output: 'scan/module-list.json', ctx: { knowledge: ['研发效能/代码审视/批量审视'], constraint: '按调用链/模块/文件拆分到可独立审视粒度', maxCtx: 48000, tools: ['t-trace', 't-dsl'] } } }),
      N('b3', 'fanout', '审视任务展开', null, { x: 352, y: 60, expertId: null, config: { sourceNode: 'b2', sourcePath: 'scan/module-list.json', shard: '按清单项', maxConc: 200, subExpert: 'e5', subSkills: ['sk-ab', 'sk-lint'], worktree: true } }),
      N('b4', 'fanin', '结果聚合', null, { x: 554, y: 60, expertId: null, config: { strategy: 'threshold', threshold: 95, outPath: 'scan/scan-summary.json' } }),
      N('b5', 'agent', '汇总报告', null, { x: 756, y: 60, expertId: 'e5', config: { input: 'scan/scan-summary.json', output: 'scan/report.md', ctx: { knowledge: [], constraint: '缺陷必须附证据位置', maxCtx: 64000, tools: ['t-lint'] } } }),
      N('b6', 'end', '结束', null, { x: 958, y: 80 })
    ];
    const edges = [E('b1', 'b2'), E('b2', 'b3', 'par'), E('b3', 'b4'), E('b4', 'b5'), E('b5', 'b6')];
    return { nodes, edges, stages: [], stageBoxes: {}, w: 1180, h: 220 };
  }

  function graphNightly() {
    const nodes = [
      N('d1', 'start', '开始', null, { x: 24, y: 70 }),
      N('d2', 'agent', '构建结果检查', null, { x: 150, y: 50, expertId: 'e4', config: { input: 'cicd/nightly-status.json', output: 'nightly/check.md', ctx: { knowledge: [], constraint: '以 CI 门禁原始数据为准', maxCtx: 32000, tools: ['t-smoke'] } } }),
      N('d3', 'fanout', '复验任务展开', null, { x: 352, y: 50, expertId: null, config: { sourceNode: 'd2', sourcePath: 'nightly/unit-list.json', shard: '按清单项', maxConc: 100, subExpert: 'e4', subSkills: ['sk-svo', 'sk-factory'], worktree: false } }),
      N('d4', 'fanin', '复验聚合', null, { x: 554, y: 50, expertId: null, config: { strategy: 'all', outPath: 'nightly/reverify.json' } }),
      N('d5', 'agent', '复验报告', null, { x: 756, y: 50, expertId: 'e4', config: { input: 'nightly/reverify.json', output: 'nightly/report.md', ctx: { knowledge: [], constraint: '失败项必须可复现', maxCtx: 48000, tools: [] } } }),
      N('d6', 'review', '复验评审', null, { x: 756, y: 190, expertId: 'e6', config: { points: '失败项归因、阻塞项清单', rollbackTo: 'd2', passNote: '通过 → 结束', failNote: '不通过 → 回退构建结果检查' } }),
      N('d7', 'end', '结束', null, { x: 958, y: 70 })
    ];
    const edges = [E('d1', 'd2'), E('d2', 'd3', 'par'), E('d3', 'd4'), E('d4', 'd5'), E('d5', 'd6'), E('d6', 'd2', 'rollback'), E('d6', 'd7')];
    return { nodes, edges, stages: [], stageBoxes: {}, w: 1180, h: 320 };
  }

  function graphSmall(ids, names) {
    const nodes = [N('g1', 'start', '开始', null, { x: 24, y: 60 })];
    ids.forEach((eid, i) => nodes.push(N('g' + (i + 2), i === ids.length - 1 ? 'review' : 'agent', names[i], null, {
      x: 150 + i * 202, y: 40, expertId: eid, config: i === ids.length - 1
        ? { points: names[i] + '要点', rollbackTo: 'g' + (i), passNote: '通过 → 结束', failNote: '不通过 → 回退重做' }
        : { input: 'workspace:/inbox/', output: 'workspace:/out/', ctx: { knowledge: [], constraint: '按规范执行', maxCtx: 32000, tools: [] } }
    })));
    nodes.push(N('g' + (ids.length + 2), 'end', '结束', null, { x: 150 + ids.length * 202, y: 60 }));
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) edges.push(E(nodes[i].id, nodes[i + 1].id));
    const lastReview = nodes[nodes.length - 2];
    edges.push(E(lastReview.id, nodes[nodes.length - 3].id, 'rollback'));
    return { nodes, edges, stages: [], stageBoxes: {}, w: 200 + ids.length * 202 + 220, h: 180 };
  }

  /* ============ 工作流 ============ */
  const workflows = [
    { id: 'w1', name: '研发四阶段主流程', type: '研发主流程', ver: 'v1.2', published: true, desc: '需求→方案→开发测试→集成验证的全流程骨架，每阶段尾评审准出，含人工方案确认与开发任务并行展开', nodeCount: 14, stageCount: 4, lastRun: { status: '运行中', instId: 'INS-2041', timeM: 46 }, updater: '陈明', updatedM: 240, graph: graphRnD() },
    { id: 'w2', name: '需求分析子流程', type: '专项子流程', ver: 'v0.3', published: true, desc: '需求获取→意图识别→范围识别→交叉探索补全（fan-out）→结果审核→人工校准闭环', nodeCount: 10, stageCount: 0, lastRun: { status: '等待人工确认', instId: 'INS-2038', timeM: 72 }, updater: '李响', updatedM: 480, graph: graphReq() },
    { id: 'w3', name: '批量代码审视', type: '批量审视任务', ver: 'v2.0', published: true, desc: '按调用链/模块/文件拆分审视任务并大规模并行（数千子任务），失败阈值聚合后产出汇总报告', nodeCount: 6, stageCount: 0, lastRun: { status: '运行中', instId: 'INS-2036', timeM: 210 }, updater: '王芳', updatedM: 120, graph: graphBatch() },
    { id: 'w4', name: '每日构建复验', type: '批量审视任务', ver: 'v1.1', published: true, desc: '夜间构建结果批量复验与失败项归因，复验评审不通过回退重查', nodeCount: 7, stageCount: 0, lastRun: { status: '成功', instId: 'INS-2025', timeM: 600 }, updater: '王芳', updatedM: 800, graph: graphNightly() },
    { id: 'w5', name: '遗留代码逻辑抽取', type: '专项子流程', ver: 'v0.5', published: false, desc: '对遗留模块做逻辑抽取与技术债整理（草稿）', nodeCount: 5, stageCount: 0, lastRun: { status: '失败', instId: 'INS-2022', timeM: 1500 }, updater: '李响', updatedM: 1500, graph: graphSmall(['e5', 'e3'], ['目标圈定', '逻辑抽取', '抽取评审']) },
    { id: 'w6', name: '知识库索引更新', type: '专项子流程', ver: 'v0.8', published: true, desc: '收集校准反馈，更新知识库索引与技能沉淀，防技能老化', nodeCount: 5, stageCount: 0, lastRun: { status: '成功', instId: 'INS-2024', timeM: 2200 }, updater: '陈明', updatedM: 2200, graph: graphSmall(['e8'], ['变更收集', '索引更新', '更新评审']) }
  ];

  /* ============ 工作区 ============ */
  const workspaces = [
    { id: 'ws1', name: 'trading-core', desc: '交易核心研发主工作区', createdAt: '2025-05-12', creator: '陈明', repo: 'git@igit:fin/trading-core.git', branch: 'master', worktreeTemplate: 'task/{instanceId}/{seq}', autoClean: true, retainDays: 7, credId: 'k1', credStatus: '有效', status: '已初始化', size: 1288490188, usedBy: ['INS-2041', 'INS-2031', 'INS-2029'], lastActivityM: 12, archives: [{ inst: 'INS-1988', size: 214748364, at: '2025-09-28' }, { inst: 'INS-1901', size: 187904819, at: '2025-09-12' }] },
    { id: 'ws2', name: 'ldp-front', desc: 'LDP 前端工作区', createdAt: '2025-07-03', creator: '李响', repo: 'git@igit:ldp/front.git', branch: 'develop', worktreeTemplate: 'task/{instanceId}/{seq}', autoClean: true, retainDays: 3, credId: 'k3', credStatus: '失效', status: '校验失败', size: 901943142, usedBy: ['INS-2019'], lastActivityM: 2880, archives: [] },
    { id: 'ws3', name: 'oplus-mono', desc: 'OPlus 单仓多包工作区', createdAt: '2025-04-22', creator: '王芳', repo: 'git@igit:oplus/mono.git', branch: 'main', worktreeTemplate: 'wt/{instanceId}/{seq}', autoClean: false, retainDays: 14, credId: 'k1', credStatus: '有效', status: '已初始化', size: 3650722697, usedBy: ['INS-2036', 'INS-2025'], lastActivityM: 30, archives: [{ inst: 'INS-1877', size: 536870912, at: '2025-09-05' }] },
    { id: 'ws4', name: 'pb2-service', desc: 'PB2 服务工作区（新建）', createdAt: '2025-10-10', creator: '陈明', repo: 'git@igit:pb2/service.git', branch: 'master', worktreeTemplate: 'task/{instanceId}/{seq}', autoClean: true, retainDays: 7, credId: null, credStatus: '未校验', status: '未初始化', size: 0, usedBy: [], lastActivityM: null, archives: [] }
  ];

  /* ============ 个人 Key ============ */
  const keys = [
    { id: 'k1', name: 'deploy-key', type: 'git ssh-key', mask: 'SHA256:ab:12:8f:…:3f2a', provider: '—', model: '—', bindings: { workspaces: ['ws1', 'ws3'], harnesses: [], experts: [] }, status: '有效', lastCheckedM: 120, note: '只读部署密钥' },
    { id: 'k2', name: 'deepseek-key', type: 'LLM API Key', mask: 'sk-****a1b2', provider: 'DeepSeek', model: 'deepseek-v3', bindings: { workspaces: [], harnesses: [], experts: ['e1', 'e2', 'e3'] }, status: '有效', lastCheckedM: 1440, note: '主力编码模型' },
    { id: 'k3', name: 'ci-key', type: 'git ssh-key', mask: 'SHA256:9c:44:d1:…:77b0', provider: '—', model: '—', bindings: { workspaces: ['ws2'], harnesses: [], experts: [] }, status: '失效', lastCheckedM: 4320, note: 'ldp-front 仓库凭证，已过期' },
    { id: 'k4', name: 'gateway-key', type: 'LLM API Key', mask: 'gw-****8f3e', provider: '内部网关', model: 'llm-gw-default', bindings: { workspaces: [], harnesses: ['h-agent07'], experts: [] }, status: '未校验', lastCheckedM: null, note: '批量审视波谷调度专用' }
  ];

  /* ============ fan-out 子任务样本生成 ============ */
  function makeSubtasks(seed, total, okN, failN, runN, retryN) {
    _seed = seed;
    const out = [];
    const targets = ['order/OrderService.java', 'order/OrderDAO.java', 'quote/QuotePush.java', 'clearing/ClearingJob.java', 'settle/SettleBatch.java', 'risk/LimitCheck.java', 'api/OrderResource.java', 'dao/SettleDAO.java', 'common/MoneyUtil.java', 'mq/OrderConsumer.java'];
    const suites = ['magic', 'mem', 'lock', 'param'];
    for (let i = 0; i < okN + failN + runN + retryN; i++) {
      const st = i < okN ? '成功' : i < okN + failN ? '失败' : i < okN + failN + runN ? '运行中' : '重试中';
      const f = [];
      const fn = ri(1, 3);
      for (let j = 0; j < fn; j++) f.push({ file: 'trade/UFX/src/main/java/com/fin/' + pick(targets), add: ri(2, 60), del: ri(0, 40) });
      const seq = String(i + 1).padStart(4, '0');
      out.push({
        id: 'T-' + seq, status: st, input: '审视 trade/UFX/' + pick(targets) + ' · 套件 ' + pick(suites),
        harness: pick(['h-build01', 'h-agent07', 'h-build02']), durS: st === '运行中' ? null : ri(40, 900),
        worktree: 'task/INS-2036/' + seq,
        patchFiles: st === '成功' || st === '失败' ? f : [],
        logs: [
          { t: '09:1' + ri(0, 9) + ':' + ri(10, 59), lv: 'info', msg: 'worktree 就绪: ' + 'task/INS-2036/' + seq },
          { t: '09:2' + ri(0, 9) + ':' + ri(10, 59), lv: 'info', msg: '加载审视套件与收敛约束' },
          st === '失败'
            ? { t: '09:3' + ri(0, 9) + ':' + ri(10, 59), lv: 'err', msg: '审视执行超时（>900s），已记录待重试' }
            : { t: '09:3' + ri(0, 9) + ':' + ri(10, 59), lv: 'ok', msg: '审视完成，发现魔法数 ' + ri(0, 6) + ' 处、内存隐患 ' + ri(0, 3) + ' 处' }
        ]
      });
    }
    return { total, byStatus: { 成功: okN, 失败: failN, 运行中: runN, 重试中: retryN }, sample: out };
  }

  /* ============ 节点运行日志生成 ============ */
  function mkLogs(base, lines) {
    return lines.map((l, i) => ({ t: base + i, lv: l[0], msg: l[1] }));
  }

  /* ============ 运行实例 ============ */
  const wf1 = workflows[0].graph.nodes;
  const instances = [
    {
      id: 'INS-2041', wfId: 'w1', ver: 'v1.2', status: '运行中', workspaceId: 'ws1',
      startedM: 46, durationS: 2760, remark: '订单提交链路需求', progress: { done: 5, total: 14, active: 'n5' },
      nodes: {
        n1: { status: 'ok', startedM: 46, durS: 2 },
        n2: { status: 'ok', startedM: 44, durS: 620, io: { in: [{ path: 'workspace:/inbox/issues/ISS-8821.md', note: '订单提交偶发超时工单' }], out: [{ path: 'requirements/draft.md', note: '需求草稿', files: [{ f: 'requirements/draft.md', add: 86, del: 0 }] }] }, logs: mkLogs('09:30:1', [['info', '读取 Issue 输入: ISS-8821'], ['info', '业务功能树定位: 金融证券交易/交易执行/订单提交'], ['info', '生成需求草稿 requirements/draft.md']]) },
        n3: { status: 'ok', startedM: 33, durS: 300, io: { in: [{ path: 'requirements/draft.md', note: '' }], out: [{ path: 'requirements/intent.md', note: '类型:缺陷修复·范围内', files: [{ f: 'requirements/intent.md', add: 34, del: 2 }] }] }, logs: mkLogs('09:41:0', [['info', '意图分类: 缺陷修复（范围内）'], ['info', '影响后续范围与探索模式已标注']]) },
        n4: { status: 'ok', startedM: 28, durS: 180, review: { round: 1, verdict: '通过', opinion: '需求描述清晰可实施，格式符合规范，通过。', target: null }, logs: mkLogs('09:46:2', [['info', '按 50 项准出清单核验'], ['ok', '结论: 通过']]) },
        n5: { status: 'running', startedM: 25, durS: null, retries: 0, io: { in: [{ path: 'requirements/intent.md', note: '' }], out: [] }, logs: mkLogs('09:49:5', [['info', '调用链分析: OrderService#submit → OrderDAO → I2GW'], ['info', '遗留实现探索中（深度 3）'], ['info', '已识别扩展点 2 处，继续收敛方案范围']]) }
      }
    },
    {
      id: 'INS-2038', wfId: 'w2', ver: 'v0.3', status: '等待人工确认', workspaceId: 'ws1',
      startedM: 72, durationS: 4320, remark: '清算规则需求', progress: { done: 7, total: 10, active: 'r8' },
      nodes: {
        r1: { status: 'ok', startedM: 72, durS: 2 },
        r2: { status: 'ok', startedM: 70, durS: 540, logs: mkLogs('08:12:0', [['info', '读取需求输入（清算规则调整）'], ['ok', '草稿产出']]) },
        r3: { status: 'ok', startedM: 61, durS: 240, logs: mkLogs('08:21:4', [['info', '意图分类: 需求变更·范围内']]) },
        r4: { status: 'ok', startedM: 57, durS: 480, logs: mkLogs('08:25:3', [['info', '范围识别: PB2/ClearingJob + UFT/settle-batch']]) },
        r5: { status: 'ok', startedM: 49, durS: 900, fanout: { total: 12, byStatus: { 成功: 12, 失败: 0, 运行中: 0, 重试中: 0 }, sample: makeSubtasks(7, 12, 12, 0, 0, 0).sample }, logs: mkLogs('08:33:2', [['info', '按 4 条线索并行探索']]) },
        r6: { status: 'ok', startedM: 35, durS: 60, logs: mkLogs('08:47:1', [['ok', '探索结果聚合完成，一致性校验通过']]) },
        r7: { status: 'ok', startedM: 34, durS: 200, review: { round: 1, verdict: '通过', opinion: '范围覆盖完整，方案分析合理，格式规范。', target: null }, logs: mkLogs('08:48:4', [['ok', '审核通过']]) },
        r8: { status: 'wait', startedM: 30, durS: null, confirm: { planPath: 'requirements/draft.md', planTitle: '清算规则需求 · 分析结论与处理方案确认', plan: '## 分析结论\n1. 日终清算顺序需支持「先券后款」可配置，影响 PB2/ClearingJob 与 UFT 批处理脚本。\n2. 上下游影响: 清算结果文件消费方 2 处（report-server、settle-notify）需同步适配。\n3. 契约变更: settle-result.spec 增加 settleMode 字段（向后兼容）。\n\n## 处理方案\n- 阶段1: 配置化清算顺序（预计 3 个任务）\n- 阶段2: 消费方适配与契约断言补充（2 个任务）\n- 阶段3: 场景穿测 + 回归（黄金标准比对）\n\n## 风险\n- 历史数据默认按「先款后券」，需数据迁移脚本。', timeout: '不超时' }, logs: mkLogs('08:52:0', [['info', '方案已写入 workspace，等待人工校准']]) },
        r9: { status: 'pending' }, r10: { status: 'pending' }
      }
    },
    {
      id: 'INS-2036', wfId: 'w3', ver: 'v2.0', status: '运行中', workspaceId: 'ws3',
      startedM: 210, durationS: 12600, remark: '交易模块魔法数/内存批量审视', progress: { done: 3, total: 6, active: 'b4' },
      nodes: {
        b1: { status: 'ok', startedM: 210, durS: 2 },
        b2: { status: 'ok', startedM: 208, durS: 700, io: { out: [{ path: 'scan/module-list.json', note: '拆分出 2048 个审视目标', files: [{ f: 'scan/module-list.json', add: 2048, del: 0 }] }] }, logs: mkLogs('06:12:0', [['info', '调用链扫描 trade/UFX 模块'], ['ok', '拆分 2048 个审视任务']]) },
        b3: { status: 'ok', startedM: 196, durS: 0, fanout: makeSubtasks(2036, 2048, 1980, 23, 31, 14), logs: mkLogs('06:24:1', [['info', '并发上限 200，分批调度 2048 子任务'], ['warn', '23 个子任务失败（超时/依赖缺失），14 个进入重试']]) },
        b4: { status: 'running', startedM: 24, durS: null, logs: mkLogs('09:58:0', [['info', '等待剩余 45 个子任务收敛（失败率 1.1% < 阈值 5%）']]) },
        b5: { status: 'pending' }, b6: { status: 'pending' }
      }
    },
    {
      id: 'INS-2031', wfId: 'w1', ver: 'v1.2', status: '回退重跑中', workspaceId: 'ws1',
      startedM: 25, durationS: 1500, remark: '（演示）需求评审回退', progress: { done: 1, total: 14, active: 'n2' },
      nodes: {
        n1: { status: 'ok', startedM: 25, durS: 2 },
        n2: { status: 'running', startedM: 8, durS: null, retries: 1, io: { in: [{ path: 'workspace:/inbox/issues/ISS-8790.md', note: '' }, { path: 'workspace:/reviews/INS-2031/n4-opinion.md', note: '上一轮评审意见（回退注入）' }], out: [] }, logs: mkLogs('09:14:2', [['warn', '检测到回退注入意见: 需求缺少异常分支场景描述'], ['info', '补充探索异常分支（超时/幂等/部分成交）'], ['info', '重新生成需求草稿…']]) },
        n3: { status: 'pending' },
        n4: { status: 'rollback', startedM: 12, durS: 240, review: { round: 1, verdict: '不通过', opinion: '需求缺少异常分支场景描述（超时、幂等、部分成交），不满足完整性规范第 12 项；请回退补充后重审。', target: 'n2' }, logs: mkLogs('09:10:0', [['info', '按 50 项准出清单核验'], ['err', '第 12 项不通过 → 触发回退至 需求获取']]) }
      }
    },
    {
      id: 'INS-2029', wfId: 'w1', ver: 'v1.2', status: '已暂停', workspaceId: 'ws1',
      startedM: 300, durationS: 5400, remark: '方案设计阶段暂停（等待资源）', progress: { done: 5, total: 14, active: 'n6' },
      nodes: {
        n1: { status: 'ok', startedM: 300, durS: 2 }, n2: { status: 'ok', startedM: 298, durS: 600 },
        n3: { status: 'ok', startedM: 288, durS: 300 }, n4: { status: 'ok', startedM: 283, durS: 180, review: { round: 1, verdict: '通过', opinion: '通过。', target: null } },
        n5: { status: 'ok', startedM: 279, durS: 1500 },
        n6: { status: 'paused', startedM: 254, durS: null, logs: mkLogs('09:00:3', [['warn', '实例被人工暂停']]) }
      }
    },
    {
      id: 'INS-2025', wfId: 'w4', ver: 'v1.1', status: '成功', workspaceId: 'ws3',
      startedM: 600, durationS: 3900, remark: '每日构建复验（夜间）', progress: { done: 7, total: 7, active: null },
      nodes: {
        d1: { status: 'ok', startedM: 600, durS: 2 }, d2: { status: 'ok', startedM: 598, durS: 500 },
        d3: { status: 'ok', startedM: 590, durS: 0, fanout: { total: 320, byStatus: { 成功: 320, 失败: 0, 运行中: 0, 重试中: 0 }, sample: makeSubtasks(99, 320, 24, 0, 0, 0).sample } },
        d4: { status: 'ok', startedM: 520, durS: 200 }, d5: { status: 'ok', startedM: 516, durS: 400 },
        d6: { status: 'ok', startedM: 509, durS: 240, review: { round: 1, verdict: '通过', opinion: '失败项均为环境抖动已复验通过，无阻塞项。', target: null } },
        d7: { status: 'ok', startedM: 505, durS: 1 }
      }
    },
    {
      id: 'INS-2022', wfId: 'w5', ver: 'v0.5', status: '失败', workspaceId: 'ws1',
      startedM: 1500, durationS: 2100, remark: 'fan-in 失败阈值触发', progress: { done: 3, total: 5, active: null },
      nodes: {
        g1: { status: 'ok', startedM: 1500, durS: 2 }, g2: { status: 'ok', startedM: 1498, durS: 600 },
        g3: { status: 'fail', startedM: 1488, durS: 600, io: { out: [] }, logs: mkLogs('07:26:0', [['info', '逻辑抽取执行中'], ['err', '抽取脚本异常退出（exit 2），重试 2 次仍失败']]), retries: 2 },
        g4: { status: 'pending' }, g5: { status: 'pending' }
      }
    },
    {
      id: 'INS-2019', wfId: 'w2', ver: 'v0.3', status: '已终止', workspaceId: 'ws2',
      startedM: 2880, durationS: 900, remark: '工作区凭证失效导致终止', progress: { done: 1, total: 10, active: null },
      nodes: {
        r1: { status: 'ok', startedM: 2880, durS: 2 },
        r2: { status: 'fail', startedM: 2878, durS: 300, logs: mkLogs('昨天 08:40:0', [['err', '工作区 ldp-front 凭证校验失败（ci-key 已失效）'], ['warn', '实例被人工终止']]) },
        r3: { status: 'skip' }, r4: { status: 'skip' }, r5: { status: 'skip' }, r6: { status: 'skip' }, r7: { status: 'skip' }, r8: { status: 'skip' }, r9: { status: 'skip' }, r10: { status: 'skip' }
      }
    }
  ];

  /* ============ 效能看板 ============ */
  const analytics = {
    weeks: ['W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', '本周'],
    throughput: [8, 9, 9, 11, 10, 12, 11, 12],
    defectRate: [1.6, 1.5, 1.4, 1.2, 1.1, 0.9, 0.85, 0.8],
    successRate: 92, avgDurationS: 6480, pendingConfirm: 1,
    subtaskTotal: 52310, subtaskFailRate: 2.1,
    stagePass: [{ stage: '需求分析', rate: 86 }, { stage: '方案设计', rate: 78 }, { stage: '开发测试', rate: 64 }, { stage: '集成验证', rate: 93 }],
    reviewRecords: [
      { timeM: 12, inst: 'INS-2041', stage: '需求分析', node: '需求评审', verdict: '通过', opinion: '需求描述清晰可实施，通过。' },
      { timeM: 28, inst: 'INS-2036', stage: '批量审视', node: '结果聚合', verdict: '通过', opinion: '失败率 1.1% 低于阈值，聚合通过。' },
      { timeM: 42, inst: 'INS-2031', stage: '需求分析', node: '需求评审', verdict: '回退', opinion: '缺少异常分支场景，回退需求获取补充。' },
      { timeM: 65, inst: 'INS-2038', stage: '需求分析', node: '结果审核', verdict: '通过', opinion: '范围覆盖完整，格式规范。' },
      { timeM: 400, inst: 'INS-2025', stage: '集成验证', node: '复验评审', verdict: '通过', opinion: '无阻塞项，通过。' },
      { timeM: 780, inst: 'INS-2027', stage: '方案设计', node: '方案评审', verdict: '回退', opinion: '变更影响面遗漏 report-server，回退补充。' },
      { timeM: 1200, inst: 'INS-2022', stage: '开发测试', node: '抽取评审', verdict: '不通过', opinion: '上游抽取失败率超阈值，终止。' },
      { timeM: 1600, inst: 'INS-2020', stage: '开发测试', node: '测试准出评审', verdict: '通过', opinion: '用例通过率 98%，冒烟全绿。' },
      { timeM: 2100, inst: 'INS-2016', stage: '方案设计', node: '方案确认（人工）', verdict: '驳回', opinion: '阶段2任务拆分粒度过粗，人工驳回重拆。' },
      { timeM: 2600, inst: 'INS-2012', stage: '集成验证', node: '发布评审', verdict: '通过', opinion: 'RC 版本通过鉴定。' }
    ],
    skillAudit: [
      { skill: 'CRES 技能', issue: '被跳过', count: 3, lastM: 300, advice: '步骤 2 常被跳过，建议在收敛约束中改为硬性门禁' },
      { skill: 'LDP 技能', issue: '自我冲突', count: 2, lastM: 900, advice: '禁令与默认操作冲突，建议合并去重' },
      { skill: 'AB 交叉审视', issue: '老化', count: 4, lastM: 120, advice: '规则版本落后于最新准出标准，建议更新' },
      { skill: '调用链分析', issue: '被跳过', count: 1, lastM: 720, advice: '偶发跳过深度参数，建议默认值固化' },
      { skill: '业务造数工具', issue: '自我冲突', count: 1, lastM: 2000, advice: '两处造数口径不一致，建议统一到 SVO 事实锚' },
      { skill: '契约断言', issue: '老化', count: 2, lastM: 1500, advice: '契约模板未覆盖新增 settleMode 字段' }
    ]
  };

  window.MOCK = { now: NOW, m, mts, experts, skills, harnesses, tools, knowledgeTree, workflows, workspaces, keys, instances, analytics,
    byId: (arr, id) => arr.find(x => x.id === id) || null };
})();
