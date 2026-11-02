// 导入 24 条 Skill 到 B1（经 HTTP API，不直连数据库）。
// 用法：node tools/import-skills.mjs
// 说明：13 条已有 Skill 原地重写（保留 ID 与专家引用），11 条新建；随后把 8 个演示专家重绑到新技能。
const BASE = process.env.API_BASE || 'http://127.0.0.1:3100';

async function call(method, path, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const err = new Error(method + ' ' + path + ' -> ' + res.status + ' ' + text.slice(0, 400));
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function listAll(path) {
  const out = [];
  let offset = 0;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await call('GET', path + sep + 'limit=200&offset=' + offset);
    out.push(...page.items);
    if (out.length >= page.total || page.items.length === 0) break;
    offset += page.items.length;
  }
  return out;
}

/* ---------------- 24 条 Skill 定义 ---------------- */
const SKILLS = [
  {
    key: 'req-route', name: '需求分流与动作分类', cat: 'retrieval', tags: ['需求分类', '动作判定', '路由'],
    desc: '适用：收到原始需求、缺陷单或一句话诉求，需要判断它属于哪类改动、走哪条工作流时。触发：需求分类、动作判定、加按钮、加逻辑、改现有、修缺陷。不适用：需求已拆到任务级、只需执行；或只需查代码现状。',
    overview: '你负责把诉求归到 7 类主动作并给出路由结论；不产出设计、不写代码。',
    steps: ['归一诉求类型：新增、修改、缺陷、迁移。', '匹配一级动作（加按钮/加逻辑/改现有/加模块/加菜单/修缺陷/UI 原型）与二级标签。', '判大小需求：改动 ≤3 个文件且单层为小；跨层未知量不得定小。', '多标签时拆主动作与关联动作，主动作只能有一个。', '输出路由卡：主专家、关联动作、待确认项与阻塞级别。'],
    example: '「查询页加一个导出按钮，调导出接口」→ 主动作=加按钮.接口调用；关联=加逻辑.过滤；主专家=需求分析；待确认=导出字段范围。',
    script: '无脚本；分类结果为纯文本路由卡。',
    verify: ['主动作唯一且在词表内。', '大小需求有文件级证据。', '每个待确认项有归属与阻塞级别。'],
    pitfalls: ['按关键词硬套，「加」不一定是加按钮。', '多标签各写一半，没有主动作。', '把 UI 原型当主动作。'],
    refs: ['references/01_动作词表.md（7 类主动作与二级标签）', 'references/02_判定树.md（大小需求/多标签/反例）']
  },
  {
    key: 'svo', name: 'SVO 拆分', cat: 'review', tags: ['SVO', '事实锚', '现象拆解'],
    desc: '适用：把口语化现象或需求拆成可回指的事实锚，供入口定位、根因判断与用例断言共用。触发：SVO、拆现象、拆需求、锚点齐备性。不适用：已有结构化场景或用例；纯代码定位。',
    overview: '你把一段人话拆成 S/V/O/O_effect 与属性；不判根因、不定方案、不找代码入口。',
    steps: ['抽 S 主体：系统、模块、单据、账户。', '抽 V 行为或现象：显示、校验、提交、回滚、超时。', '抽 O 实体或字段：优先用原文词，并标注来源。', '定 O_effect 影响态：错误值、缺失、延迟、重复、拒绝。', '补 attributes 并做齐备性检查，缺项标 pending_input。'],
    example: '「柜台反映委托金额显示 0」→ S=委托单、V=显示、O=委托金额、O_effect=恒为 0、attributes=柜台/偶发。',
    script: '无脚本；输出 JSON {S,V,O,O_effect,attributes,pending_input}。',
    verify: ['四元组齐全，且每项能回指原文。', 'O_effect 是可观测状态，不是结论。', '缺项进入 pending_input，写明缺什么、找谁。'],
    pitfalls: ['现象与判断混写，把「显示 0」写成「计算错误」。', 'O_effect 直接写成根因。', '缺锚点仍往下走。'],
    refs: ['references/01_拆解规则.md（四元组/属性/齐备性）', 'references/02_场景示例.md（排查/需求/审核）']
  },
  {
    key: 'biz-tree', name: '业务功能树检索', cat: 'retrieval', tags: ['功能树', '业务域', '价值流'],
    desc: '适用：只知道业务名或功能名，需要沿业务域→价值流→场景→功能号→代码入口逐级定位时。触发：业务功能树、业务域、价值流、这个功能在哪。不适用：已知精确文件路径或功能号。',
    overview: '你沿业务域逐级落到代码入口，替代没有路径时的大范围检索；不替代源码阅读。',
    steps: ['定业务域（产品线/业务大类）。', '定价值流（业务从哪到哪）。', '定场景（具体业务动作）。', '取功能号与菜单。', '落组件或服务入口。'],
    example: '「债券偏离度」→ 业务域=固收、价值流=估值、场景=偏离度监控、功能号=xxx、入口=Service+页面。',
    script: 'business_tree_query --domain <业务域> --keyword <词>',
    verify: ['每一级都有索引命中。', '入口路径可打开。', '跳级必须写明理由。'],
    pitfalls: ['跳过功能树直接全文检索。', '用业务词硬猜代码。', '把菜单名当功能号。'],
    refs: ['references/01_定位样例.md（三个业务域正例与两个反例）']
  },
  {
    key: 'code-inspect', name: '代码现状检查', cat: 'retrieval', tags: ['代码定位', '现状检查', '源码阅读'],
    desc: '适用：动手改之前先看当前实现——功能号、页面路由或文件对应哪段代码、数据怎么流。触发：代码现状、这个功能怎么实现的、是否已实现。不适用：需要修改代码或评估影响面。',
    overview: '你定位并阅读当前实现，输出入口、数据流、风险与缺口；不产出修改方案。',
    steps: ['归一输入：功能号、页面路由或文件路径。', '定位：菜单→路由→组件，或功能号→Controller→Service。', '读关键片段：入口、分支、SQL、外部调用。', '输出摘要：入口、数据流、现状风险、缺口。'],
    example: '「订单列表加一列」→ 定位到 Vue 列表组件与查询接口，指出字段已存在但未展示。',
    script: 'inspect --mode code --target <功能号|路由|文件>',
    verify: ['每个结论有文件:行号。', '摘要与代码一致，可复核。', '未检出时写明检索范围。'],
    pitfalls: ['读全仓不收敛。', '把推断当事实。', '把未检出当成不存在。'],
    refs: ['references/01_定位命令与路径.md（菜单/路由/功能号三条路径）']
  },
  {
    key: 'impact', name: '变更影响面分析', cat: 'review', tags: ['影响面', '调用链', '回归范围'],
    desc: '适用：改动前圈定影响面——谁调用、哪些表字段、哪些契约和配置会受影响、回归要覆盖什么。触发：影响面、调用链、回归范围、谁会受影响。不适用：只做单文件静态检查。',
    overview: '你从改动点反向追调用链、表字段、契约与配置，给回归清单和断链缺口；不写修改方案。',
    steps: ['圈定改动点（函数/接口/字段）。', '正向调用链（谁调我）与反向调用链（我调谁）。', '表与字段影响。', '契约、配置、菜单、定时任务。', '回归清单与断链标注。'],
    example: '修改委托回报字段 → 3 个下游消费者、1 张表、1 个导出、1 个定时任务。',
    script: 'trace_call_chain --symbol <符号> --depth 3',
    verify: ['每一跳都有锚点。', '断链显式标「未验证」。', '表/契约/配置/任务四类不遗漏。'],
    pitfalls: ['只看一层调用。', '断链用推断补。', '漏定时任务与导出。'],
    refs: ['references/01_调用链取证.md（正反向与锚点）', 'references/02_影响面清单.md（四类核对表）']
  },
  {
    key: 'kg-locate', name: '知识图谱入口定位', cat: 'retrieval', tags: ['知识图谱', 'V 卡', '入口全集'],
    desc: '适用：按功能号、服务名或业务词在知识图谱上定位 V 卡与入口全集。触发：功能号定位、入口定位、知识图谱、这个服务在哪。不适用：图谱未覆盖的新域；需要读源码细节。',
    overview: '你在知识图谱上定位 V 卡与入口路径，输出候选全集；不读源码细节。',
    steps: ['功能号或 LS_ 服务名直定。', '业务词/流程名圈流程目录。', '三索引交叉：流程、业务、V 卡。', '输出入口全集与候选排序。'],
    example: '「现券买卖」→ 业务别名命中流程目录 → V 卡 3 张 → 入口全集。',
    script: 'kg_query --type function --id <功能号>；或 --type word --keyword <业务词>',
    verify: ['V 卡真实存在。', '路径可回指。', '候选不唯一时列全并排序。'],
    pitfalls: ['从流程正文收 V 卡。', '业务词硬猜。', '只取第一个候选。'],
    refs: ['references/01_按卡直定.md（功能号/服务名）', 'references/02_按词收卡.md（业务词/流程/排序）']
  },
  {
    key: 'pseudo-code', name: 'UFT/ARES 伪代码修改', cat: 'coding', tags: ['伪代码', 'UFT', 'ARES', '事务', '结果集'],
    desc: '适用：按 UFT/UFR 或 ARES 伪代码规则修改服务、XML 壳与表结构，并做 L0–L3 判定。触发：伪代码、事务、遍历、结果集、UFTDB、ARES。不适用：Vue/Java 等 Web 前后端代码。',
    overview: '你按栈与规则改伪代码并自证；两栈规则不同，先判栈再动笔。',
    steps: ['判栈：UFT/UFR 或 ARES。', '读对应规则与禁止项。', '备份并列出影响文件清单。', '按层编码：服务、函数、宏、事务、遍历、结果集。', '跑脚本审核，输出 L0–L3 判定。', '按人工核对清单收口。'],
    example: '「结果集增加字段」→ 改 SQL、结构体、赋值、错误处理，逐层记录判定。',
    script: 'ufr_code_audit --stack uft --path <文件>；agent_lint --rules pseudocode',
    verify: ['规则 JSON 通过。', 'L0–L3 每层有结论。', '备份清单完整。'],
    pitfalls: ['省事务/遍历。', '跳过备份。', '宏表内嵌导致双源。', '只改伪代码不改 XML 壳。'],
    refs: ['references/01_UFT规则.md', 'references/02_ARES规则.md', 'references/03_四层判定.md']
  },
  {
    key: 'sql', name: 'SQL 编写与审核', cat: 'coding', tags: ['SQL', '表结构', '方言', 'EXPLAIN'],
    desc: '适用：定位表结构后按实际字段编写或审核 SQL，含 35 条规范、方言差异、EXPLAIN 与 Script 仓脚本。触发：写 SQL、落库脚本、表结构、方言。不适用：ORM 自动生成、无需执行的纯查询。',
    overview: '你按实际表结构写/审 SQL，并用规范、方言与 EXPLAIN 收口。',
    steps: ['定位表结构（.table/stdfield）。', '按实际列拆 SQL。', '选方言（MySQL/Oracle/OB/Gauss）。', '跑 35 条规范检查。', 'EXPLAIN 验证。', '按 Script 仓规范补脚本头。'],
    example: '「新增按客户查持仓」→ 表结构 → 列清单 → SQL → EXPLAIN → 脚本头。',
    script: 'sql_auditor --file <路径> --dialect mysql',
    verify: ['0 条规范违规。', 'EXPLAIN 达标。', '列名与表定义一致。'],
    pitfalls: ['拍脑袋列名。', '裸 CURRENT_TIMESTAMP。', '方言混用。', '漏索引。'],
    refs: ['references/01_35条规则.md', 'references/02_方言与示例.md']
  },
  {
    key: 'test-design', name: '测试设计与用例生成', cat: 'testing', tags: ['测试设计', '用例', '断言锚'],
    desc: '适用：从场景集合生成可机判用例，为每条断言找到功能号、错误号、字段或页面元素锚点。触发：测试设计、用例、断言、覆盖、缺口。不适用：探索性测试；无场景来源的盲测。',
    overview: '你把场景拆成可机判用例与断言锚，并显式列出缺口。',
    steps: ['读场景集合与需求点。', '拆测试点：正常、边界、异常。', '找断言锚：功能号、错误号、字段、UI 元素。', '套用例模板。', '覆盖核对与缺口清单。'],
    example: '「资金可用不足」→ 3 条用例，断言锚=错误号+账户字段。',
    script: '无脚本；用例 JSON 契约。',
    verify: ['每个场景至少 1 条用例。', '每条断言可机判。', '缺口列全并分级。'],
    pitfalls: ['无锚点硬写断言。', '缺口不列。', '只测正向。'],
    refs: ['references/01_用例模板.md', 'references/02_断言锚清单.md']
  },
  {
    key: 'data-fabrication', name: '测试数据构造', cat: 'testing', tags: ['造数', '账户池', '对账', '还原'],
    desc: '适用：测试前置状态不满足时，盘点并造出满足校验的数据，做完对账再还原。触发：造数、测试数据、账户池、资金可用不足、基础数据。不适用：生产数据直接回灌。',
    overview: '你把不存在/不满足的数据造成存在且满足校验，并保证可还原；直改库禁用。',
    steps: ['盘点环境已有数据（账户池/持仓/主档）。', '选造数路径：业务功能号优先，改库+重载次之。', '段位与号段查重。', '造数。', '对账。', '还原并检查残留。'],
    example: '「可用资金不足」→ 盘点 → 管理功能号调额 → 对账 → 还原。',
    script: 'data_factory --scene fund --account <账号>',
    verify: ['目标状态满足校验。', '对账三件套齐全。', '无残留数据。'],
    pitfalls: ['探针不先行。', '段位不查重。', '直改生产。', '造完不对账。'],
    refs: ['references/01_盘点与账户池.md', 'references/02_造数路径.md', 'references/03_对账还原.md']
  },
  {
    key: 'log-parse', name: '日志证据解析', cat: 'review', tags: ['日志', 'redo', '报文', '证据'],
    desc: '适用：把大日志、redo、报文、性能 CSV 或死锁信息解析成结构化证据。触发：日志、redo、死锁、报文、性能数据。不适用：根因判读；没有原始文件的口头描述。',
    overview: '你把原始日志/报文变成结构化事实；只产证据，不判根因。',
    steps: ['识别证据类型：大日志、redo、报文、性能、死锁。', '选解析器。', '执行解析。', '按统一契约输出 events/key_findings/metrics/pending_input。', '标注缺失字段。'],
    example: '「委托超时」→ 大日志检索 → 关键事件 → 时间线 → 待补字段。',
    script: 'log_parser --type biglog --file <路径>',
    verify: ['每条 finding 有 raw_ref。', '解析失败显式降级。', '不写根因结论。'],
    pitfalls: ['解析当判读。', '缺失字段靠猜。', '不留原文锚。'],
    refs: ['references/01_解析器总览.md', 'references/02_大日志与redo.md', 'references/03_报文与性能.md']
  },
  {
    key: 'code-review', name: '多 persona 代码评审', cat: 'review', tags: ['代码评审', 'persona', '置信门控'],
    desc: '适用：对一次 diff 做多视角代码评审，按技术栈选 persona，置信门控后只报有证据的问题。触发：代码评审、review、提测前检查、合并前评审。不适用：单视角快速自检；存量仓库抽样巡检。',
    overview: '你按 diff 选视角并行评审，置信门控后只报有证据的问题；不替代阶段准出。',
    steps: ['读 diff 判技术栈。', '选 persona：Vue、Java、DB、伪代码。', '各 persona 并行评审。', '按置信锚过滤。', '跨员晋级复核。', '独立复核。', 'autofix 分级。'],
    example: '「改 Service 查询」→ Java persona 3 条 + DB persona 1 条 → 1 条晋级。',
    script: '无脚本；findings JSON 契约。',
    verify: ['每条 finding 有文件:行号与置信度。', '复核结论一致。', '无证据不报。'],
    pitfalls: ['多个 persona 共享上下文。', '无证据断言。', '置信度拍脑袋。'],
    refs: ['references/01_persona目录.md', 'references/02_findings契约.md']
  },
  {
    key: '5why', name: '缺陷 5Why 分析评审', cat: 'review', tags: ['5Why', '根因', '改进措施'],
    desc: '适用：审查现场缺陷的 5Why 链与改进措施，判断根因是否成立、措施是否可落地。触发：5Why、根因评审、缺陷分析、改进措施。不适用：尚未定性的现象；纯代码缺陷定位。',
    overview: '你审 5Why 链与改进措施，输出评审意见；不替提交人重写根因。',
    steps: ['核对现象与影响。', '逐层核证据，找断链。', '按根因判据判断是否到底。', '核措施与 owner。', '输出结论与修改建议。'],
    example: '「重复缺陷」→ 链条断在第 3 层 → 根因改写 → 措施补验收口径。',
    script: '无脚本。',
    verify: ['每层有证据。', '根因不是「人为/疏忽」。', '措施可执行可验证。'],
    pitfalls: ['根因停在人为。', '措施无 owner。', '把过程当根因。'],
    refs: ['references/01_5Why判据.md', 'references/02_措施清单.md']
  },
  {
    key: 'gate', name: '阶段准出门控', cat: 'review', tags: ['准出', '门控', 'review-issues'],
    desc: '适用：阶段产物准出评审——按准出清单做规则层与推理层判定，输出通过或带意见回退。触发：准出、门控、阶段评审、能不能进下一阶段。不适用：过程辅导；代码 diff 评审。',
    overview: '你只做判定：通过，或带结构化意见回退；不参与执行、不辅导。',
    steps: ['加载该阶段准出清单。', '规则层：确定性规则命中即失败。', '推理层：判断下游是否可用。', '核对证据位置。', '输出 review-issues 与结论。'],
    example: '「设计准出」→ 缺 C 章 → 判回退 + 3 条意见。',
    script: '无脚本。',
    verify: ['每条意见可定位（文件:行号或节段落）。', '无跳过项。', '结论只有通过与回退。'],
    pitfalls: ['「基本通过」。', '越阶段。', '意见不可执行。'],
    refs: ['references/01_准出清单.md', 'references/02_review-issues格式.md']
  },
  {
    key: 'smoke', name: '冒烟验证', cat: 'testing', tags: ['冒烟', '关键路径', '部署后'],
    desc: '适用：部署后按关键路径跑最小用例集，留证据并给通过/阻塞结论。触发：冒烟、部署后验证、回归。不适用：全量回归；未部署的本地改动。',
    overview: '你在部署后跑关键路径最小集，留证据并给结论；不替代回归。',
    steps: ['选关键路径。', '确认环境与版本。', '执行。', '留证：响应/截图/日志。', '给结论与阻塞项。'],
    example: '「登录→下单→查询」三条路径 → 1 条失败 → 阻塞并附日志。',
    script: 'smoke_runner --suite core',
    verify: ['关键路径全覆盖。', '失败有定位信息。', '证据可回看。'],
    pitfalls: ['带病冒烟。', '失败只报现象。'],
    refs: ['references/01_关键路径样例.md']
  },
  {
    key: 'browser', name: '浏览器页面验证', cat: 'testing', tags: ['浏览器', '截图', '页面验证'],
    desc: '适用：打开页面截图或交互取证，确认功能是否已实现、修复是否生效；浏览器不可用时降级代码验证。触发：打开页面、截图、页面验证、现状确认。不适用：无环境或需要压测的场景。',
    overview: '你打开页面取证并给三选一结论；不可用时降级并标注。',
    steps: ['准备 URL 与账号。', '打开与登录。', '截图或交互。', '按断言核对。', '不可用则降级为代码级验证。'],
    example: '「页面加列」→ 登录 → 列表截图 → 断言列存在 → 记录分辨率。',
    script: 'browser_inspect --url <URL> --screenshot <路径>',
    verify: ['有截图或 DOM 证据。', '结论三选一：已实现/未实现/环境不可判。', '降级有标注。'],
    pitfalls: ['白屏当证据。', '环境问题当缺陷。', '无降级说明。'],
    refs: ['references/01_取证与降级.md']
  },
  {
    key: 'retro', name: '复盘与经验沉淀', cat: 'review', tags: ['复盘', '沉淀', '案例'],
    desc: '适用：把一次排查、缺陷或项目转成结构化复盘与可检索沉淀，含资产行使清单与改进项。触发：复盘、沉淀、compound、案例、经验。不适用：问题尚未闭环；只写周报式总结。',
    overview: '你把闭环后的问题转成可检索学习与改进项；不写表扬稿。',
    steps: ['还原时间线与事实。', '列资产行使清单（skill/script/process）。', '按判据评分。', '产出改进项与 owner。', '沉淀为带 frontmatter 的条目。'],
    example: '「一次误报排查」→ 资产清单 → 2 条改进 → 1 条学习。',
    script: 'python scripts/validate-frontmatter.py <文件>',
    verify: ['条目可检索。', '改进项有 owner。', '结论能回指证据。'],
    pitfalls: ['复盘变批斗。', '无证据的经验。', '只写总结不写改进。'],
    refs: ['references/01_复盘判据.md', 'references/02_沉淀模板.md']
  },
  {
    key: 'contract', name: '契约断言', cat: 'review', tags: ['契约', '断言', '接口'],
    desc: '适用：为接口契约生成断言并守护字段、错误码、权限点差异。触发：契约、断言、接口、字段校验。不适用：没有契约文件的脚本或一次性查询。',
    overview: '你把契约变成可执行断言，并在变更时定位差异。',
    steps: ['取接口契约与字段表。', '生成断言：字段、错误码、权限点。', '执行。', '定位差异。', '纳入守护。'],
    example: '「查询接口新增字段」→ 断言字段/错误码/权限点。',
    script: 'contract_assert --spec <契约文件>',
    verify: ['断言全过，或差异有解释。', '错误码与权限点覆盖。'],
    pitfalls: ['契约变更不同步。', '只测字段不测错误码。'],
    refs: ['references/01_断言模板.md']
  },
  {
    key: 'cres', name: 'CRES 编码规范', cat: 'coding', tags: ['CRES', '规范', '基类'],
    desc: '适用：按 CRES 框架的基类、数据层与扩展点编写代码或技术方案。触发：CRES、基类、数据层、扩展点。不适用：非 CRES 工程。',
    overview: '你按 CRES 框架边界写代码/方案，不绕过基类、不硬编码环境。',
    steps: ['识别是否 CRES 工程。', '查框架基类与扩展点。', '按规范生成。', '自检与规范检查。'],
    example: '「CRES 页面新增字段」→ 基类扩展点 → 生成 → 自检。',
    script: 'linter --rules cres --path <路径>',
    verify: ['规范检查通过。', '未绕过基类。'],
    pitfalls: ['绕过基类直接操作数据层。', '硬编码环境配置。'],
    refs: ['references/01_框架边界.md']
  },
  {
    key: 'ldp', name: 'LDP 低代码开发', cat: 'coding', tags: ['LDP', '低代码', 'DSL'],
    desc: '适用：LDP 低代码页面、服务与 DSL 开发，按页面/服务/DSL/数据/集成五岗位职责落地。触发：LDP、低代码、DSL、五岗位。不适用：原生手写工程。',
    overview: '你按 LDP 五岗位职责落地页面、服务与 DSL，不越岗。',
    steps: ['判岗位：页面、服务、DSL、数据、集成。', '页面实现。', '服务实现。', 'DSL 配置。', '自检与编译。'],
    example: '「LDP 查询页」→ 页面 + 服务 + DSL。',
    script: 'ldp_gen --module <模块>',
    verify: ['生成器标记完整。', '编译通过。'],
    pitfalls: ['手改生成器产物中的标记段。', '跨岗位越界。'],
    refs: ['references/01_五岗位职责.md']
  },
  {
    key: 'meta', name: '元数据查询', cat: 'retrieval', tags: ['元数据', '字段', '实体'],
    desc: '适用：补全实体、字段、服务上下文，并以版本号约束元数据时效。触发：元数据、字段、实体、服务。不适用：需要业务语义解释的场景。',
    overview: '你查实体/字段/服务上下文并记录版本；不做过期数据推断。',
    steps: ['查实体。', '查字段与类型。', '记录版本与时间。', '输出上下文。'],
    example: '「订单表字段」→ 类型/含义/版本。',
    script: 'metadata_query --entity <实体>',
    verify: ['结果带版本号。', '过期数据有标注。'],
    pitfalls: ['使用过期元数据。'],
    refs: ['references/01_版本纪律.md']
  },
  {
    key: 'dsl', name: 'DSL 检索', cat: 'retrieval', tags: ['DSL', '扩展点', '节点'],
    desc: '适用：在低代码 DSL 资产中检索扩展点、节点与配置，确认存在后再改。触发：DSL、扩展点、节点、配置。不适用：原生代码仓库检索。',
    overview: '你先检索确认 DSL 节点存在，再改配置。',
    steps: ['关键词。', '限定工程。', '检索。', '确认节点存在。'],
    example: '「检索导出扩展点」→ 节点与配置。',
    script: 'dsl_search --keyword <词> --project <工程>',
    verify: ['节点真实存在。'],
    pitfalls: ['假设节点存在。'],
    refs: ['references/01_扩展点清单.md']
  },
  {
    key: 'lint', name: 'Linter 代码体检', cat: 'review', tags: ['Linter', '静态检查', '规范'],
    desc: '适用：对指定路径跑 Linter 规则集，分类告警并保留豁免证据。触发：lint、静态检查、编码规范。不适用：需要语义判断的架构问题。',
    overview: '你跑静态检查、分类告警，并为每条豁免留证据。',
    steps: ['选路径。', '选规则集。', '执行。', '分类告警。', '保留豁免证据。'],
    example: '「改 Service」→ lint → 2 条告警 → 1 真 1 误报（附证据）。',
    script: 'lint --path <路径> --rules default',
    verify: ['0 告警，或豁免有证据。'],
    pitfalls: ['误报无证据。', '忽略告警。'],
    refs: ['references/01_规则集.md']
  },
  {
    key: 'replay', name: '回放数据清洗', cat: 'testing', tags: ['回放', '清洗', '脱敏'],
    desc: '适用：流量回放前清洗、脱敏、对账与还原。触发：回放、清洗、脱敏、对账。不适用：已脱敏的离线样本。',
    overview: '你在回放前清洗与脱敏，并保证对账与还原。',
    steps: ['取样本。', '清洗。', '脱敏。', '对账。', '还原。'],
    example: '「生产样本」→ 清洗 → 脱敏 → 对账 → 回放。',
    script: 'replay_clean --input <文件>',
    verify: ['对账一致。', '脱敏无残留。'],
    pitfalls: ['生产数据直灌。', '脱敏不彻底。'],
    refs: ['references/01_清洗与对账.md']
  }
];

/* 已有 Skill 名称 → 目标 key（原地重写，保留 ID 与引用） */
const RENAME = {
  '回放数据清洗': 'replay',
  '冒烟验证': 'smoke',
  '业务造数工具': 'data-fabrication',
  'SVO 拆分': 'svo',
  '契约断言': 'contract',
  'Linter 代码体检': 'lint',
  'AB 交叉审视': 'code-review',
  'DSL 检索': 'dsl',
  '业务功能树检索': 'biz-tree',
  '元数据查询': 'meta',
  '调用链分析': 'impact',
  'LDP 技能': 'ldp',
  'CRES 技能': 'cres'
};

const CAT_CODE = { coding: 'coding', retrieval: 'retrieval', review: 'review', testing: 'testing' };

function renderBody(s) {
  const lines = [];
  lines.push('## 适用场景', '', s.overview, '');
  lines.push('## 执行步骤', '');
  s.steps.forEach((x, i) => lines.push((i + 1) + '. ' + x));
  lines.push('', '## 示例', '', s.example, '');
  lines.push('## 脚本', '', s.script, '');
  lines.push('## 完成验证', '');
  s.verify.forEach(x => lines.push('- [ ] ' + x));
  lines.push('', '## 常见踩坑', '');
  s.pitfalls.forEach(x => lines.push('- ' + x));
  lines.push('', '## 参考资料', '');
  s.refs.forEach(x => lines.push('- ' + x));
  return lines.join('\n') + '\n';
}

async function saveSkill(s, existing) {
  let draft;
  if (existing) {
    draft = await call('POST', '/api/v1/skill-drafts', { skillId: existing.id });
  } else {
    draft = await call('POST', '/api/v1/skill-drafts', {});
  }
  const payload = {
    name: s.name,
    categoryCode: CAT_CODE[s.cat],
    description: s.desc,
    tags: s.tags,
    body: renderBody(s)
  };
  const headers = existing ? { 'If-Match': '"' + draft.baseRevision + '"' } : {};
  const saved = await call('POST', '/api/v1/skill-drafts/' + draft.id + '/save', payload, headers);
  return saved;
}

async function main() {
  const skills = await listAll('/api/v1/skills?sort=name:asc');
  const byName = new Map(skills.map(s => [s.name, s]));
  const results = [];

  // 1) 原地重写 13 条
  for (const [oldName, key] of Object.entries(RENAME)) {
    const target = SKILLS.find(x => x.key === key);
    const existing = byName.get(target.name) || byName.get(oldName);
    if (!existing) throw new Error('找不到已有 Skill: ' + oldName + ' / ' + target.name);
    if (!target) throw new Error('找不到目标定义: ' + key);
    const saved = await saveSkill(target, existing);
    results.push({ key, id: saved.id, name: target.name, updated: true });
    console.log('✓ 重写 ' + oldName + ' -> ' + target.name);
  }

  // 2) 新建 11 条
  for (const s of SKILLS) {
    if (results.some(r => r.key === s.key)) continue;
    const already = byName.get(s.name);
    if (already) { results.push({ key: s.key, id: already.id, name: s.name, updated: true }); console.log('= 跳过已存在 ' + s.name); continue; }
    const saved = await saveSkill(s, null);
    results.push({ key: s.key, id: saved.id, name: s.name, updated: false });
    console.log('✓ 新建 ' + s.name);
  }

  // 3) 重绑 8 个演示专家
  const expertSkills = {
    '需求分析专家': ['req-route', 'svo', 'biz-tree', 'meta'],
    '方案设计专家': ['code-inspect', 'impact', 'kg-locate', 'contract'],
    '开发实现专家': ['pseudo-code', 'sql', 'cres', 'ldp'],
    '测试验证专家': ['test-design', 'data-fabrication', 'replay', 'browser'],
    '代码审视专家': ['code-review', 'lint', 'impact'],
    '评审专家': ['gate', '5why', 'contract'],
    '集成验证专家': ['smoke', 'contract', 'log-parse'],
    '知识库运营专家': ['retro', 'kg-locate', 'biz-tree']
  };
  const experts = await listAll('/api/v1/experts');
  const byId = new Map(results.map(r => [r.key, r.id]));
  for (const [expertName, keys] of Object.entries(expertSkills)) {
    const ex = experts.find(e => e.name === expertName);
    if (!ex) { console.warn('! 跳过不存在的专家: ' + expertName); continue; }
    const items = keys.map(k => ({ skillId: byId.get(k) }));
    if (items.some(i => !i.skillId)) throw new Error('技能 ID 缺失: ' + keys.join(','));
    await call('PUT', '/api/v1/experts/' + ex.id + '/skills', { items }, { 'If-Match': '"' + ex.revision + '"' });
    console.log('✓ 重绑 ' + expertName + ' → ' + keys.join(', '));
  }

  const counts = {};
  for (const r of results) counts[r.updated ? 'updated' : 'created'] = (counts[r.updated ? 'updated' : 'created'] || 0) + 1;
  console.log('\n完成：重写 ' + (counts.updated || 0) + '，新建 ' + (counts.created || 0) + '，合计 ' + results.length);
}

main().catch(err => {
  console.error('FAIL:', err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2).slice(0, 1200));
  process.exit(1);
});
