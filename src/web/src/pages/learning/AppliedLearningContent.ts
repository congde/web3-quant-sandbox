export type AppliedQuiz = {
  question: string;
  options: string[];
  answer: number;
  reason: string;
};

export type AppliedLesson = {
  title: string;
  short: string;
  objective: string;
  overview: string;
  framework: Array<{ title: string; detail: string }>;
  caseStudy: {
    question: string;
    evidence: Array<{ label: string; value: string; interpretation: string }>;
    conclusion: string;
    limits: string;
  };
  checklist: string[];
  pitfalls: string[];
  quizzes: AppliedQuiz[];
  sources: Array<{ label: string; provider: string; url: string }>;
};

export type AppliedCourse = {
  key: "diagnosis" | "assets";
  eyebrow: string;
  title: string;
  description: string;
  outcome: string;
  nextPath: string;
  nextLabel: string;
  lessons: AppliedLesson[];
};

const DIAGNOSIS_LESSONS: AppliedLesson[] = [
  {
    title: "从观点到可证伪问题",
    short: "先定义问题，再收集证据",
    objective: "把“这个标的会涨”改写成带对象、时间、指标、比较基准和失效条件的研究问题。",
    overview: "诊断不是给标的贴“好”或“坏”的标签，而是检查一个具体主张得到多少支持、有哪些反证，以及结论能维持多久。无法被数据推翻的说法，也无法被数据真正支持。",
    framework: [
      { title: "限定对象", detail: "标的、市场、交易对和数据来源必须明确。" },
      { title: "限定时间", detail: "说明观察窗口、预测期限与信息截止时点。" },
      { title: "定义证据", detail: "提前写下支持指标、基准和最小差异。" },
      { title: "写出反证", detail: "列出哪些结果出现时必须降低信心或否定主张。" },
    ],
    caseStudy: {
      question: "“BTC 最近很强，应该买入”是否是一条可检验结论？",
      evidence: [
        { label: "对象", value: "BTC-USDT", interpretation: "对象明确，但仍缺少市场和数据源口径。" },
        { label: "最近", value: "未定义", interpretation: "可能是 1 小时、7 天或 3 个月，无法复核。" },
        { label: "很强", value: "未量化", interpretation: "需要相对基准收益、趋势或成交量标准。" },
        { label: "买入", value: "无期限与退出", interpretation: "没有持有期、止损和失效条件。" },
      ],
      conclusion: "原句只是观点。可改写为：截至当前已收盘日线，BTC 20 日收益是否显著高于等权市场基准，并在未来 5 日保持正超额收益？",
      limits: "即使历史样本支持，也只能说明特定窗口下出现过统计关系，不能保证下一次上涨。",
    },
    checklist: ["对象与数据源唯一", "时间窗口和截止时点明确", "指标与基准可复算", "提前写出失效条件"],
    pitfalls: ["看到结果后再修改问题", "把无法证伪的叙事当研究假设", "用未来信息定义当前信号"],
    quizzes: [
      { question: "哪一个问题最接近可证伪研究问题？", options: ["ETH 有长期价值吗？", "截至昨日收盘，ETH 20 日收益是否高于同市场基准？", "牛市什么时候开始？"], answer: 1, reason: "它明确对象、信息截止时点、窗口、指标和比较基准，可以被数据支持或否定。" },
      { question: "研究开始前最需要提前写下什么？", options: ["最漂亮的图表样式", "预期一定会成立的理由", "证据标准与失效条件"], answer: 2, reason: "预先定义证据和反证能减少看到结果后修改口径的偏差。" },
    ],
    sources: [{ label: "统计工程中的问题定义与验证", provider: "NIST/SEMATECH", url: "https://www.itl.nist.gov/div898/handbook/" }],
  },
  {
    title: "价格、成交量与市场状态",
    short: "先辨认环境，再解释信号",
    objective: "使用收益、趋势、波动和成交量构造相互独立的证据，而不是堆叠同源技术指标。",
    overview: "价格是交易结果，成交量描述参与程度，波动反映不确定性。它们提供不同视角，但移动平均、MACD、RSI 等仍然来自同一价格序列，不能因为指标数量多就误以为证据独立。",
    framework: [
      { title: "方向", detail: "比较不同窗口收益和结构高低点，确认趋势而非单根波动。" },
      { title: "参与", detail: "观察成交量相对历史是否异常，区分少量成交与广泛参与。" },
      { title: "风险", detail: "用真实波幅和波动率判断信号是否处于异常环境。" },
      { title: "基准", detail: "将标的表现与市场、行业或简单持有基准比较。" },
    ],
    caseStudy: {
      question: "价格突破 20 日高点，但成交量低于 20 日均量，应怎样诊断？",
      evidence: [
        { label: "价格", value: "新高", interpretation: "方向证据偏强。" },
        { label: "成交量", value: "0.62× 均量", interpretation: "参与证据不足。" },
        { label: "ATR", value: "升至 90% 分位", interpretation: "波动环境异常，突破失败成本可能更高。" },
        { label: "基准", value: "同步上涨", interpretation: "可能是市场整体驱动，不是标的独立强势。" },
      ],
      conclusion: "证据混合：可以记录为“价格突破已发生，但量能和独立超额证据不足”，而不是直接判定有效突破。",
      limits: "低成交量不必然导致失败；仍需用历史同类事件的条件收益验证。",
    },
    checklist: ["只使用已收盘数据", "指标口径和频率一致", "至少包含一个比较基准", "区分同源指标与独立证据"],
    pitfalls: ["把三个价格指标算作三份独立证据", "忽视流动性和异常波动", "用绝对收益代替超额收益"],
    quizzes: [
      { question: "MA、MACD 和 RSI 同时转强，能否视为三份独立证据？", options: ["可以", "不可以，它们主要来自同一价格序列", "只在日线可以"], answer: 1, reason: "指标变换不同，但共同依赖历史价格，证据相关性很高。" },
      { question: "判断标的是否独立强势，最需要增加什么？", options: ["更多颜色的均线", "相对市场或行业的基准收益", "更短的 K 线周期"], answer: 1, reason: "基准比较可以区分标的自身表现和市场共同上涨。" },
    ],
    sources: [{ label: "技术分析的证据与限制", provider: "CFA Institute Research Foundation", url: "https://rpc.cfainstitute.org/en/research/foundation/2007/technical-analysis" }],
  },
  {
    title: "资金、链上与基本证据",
    short: "理解口径，不迷信大数字",
    objective: "区分余额、流量、活跃度、估值和协议风险，并检查地址标签、重复计算与跨链口径。",
    overview: "链上数据公开不等于自动可靠。一个地址可能属于交易所、托管人或合约；同一资产可能跨链映射；TVL、活跃地址和交易笔数也会受到价格、机器人和协议结构影响。",
    framework: [
      { title: "先看定义", detail: "确认指标是余额、净流量、独立地址还是交易次数。" },
      { title: "再看身份", detail: "检查地址标签、交易所归集、桥和合约地址。" },
      { title: "去除价格", detail: "美元计价增长可能只是币价上涨，需同时看原生数量。" },
      { title: "交叉验证", detail: "用多源数据、区块高度和时间戳核对。" },
    ],
    caseStudy: {
      question: "某协议 TVL 一周上涨 30%，是否说明新增资金流入 30%？",
      evidence: [
        { label: "美元 TVL", value: "+30%", interpretation: "包含资产价格变化。" },
        { label: "原生代币数量", value: "+4%", interpretation: "实际数量增长远小于美元口径。" },
        { label: "代币价格", value: "+25%", interpretation: "TVL 大部分增长可由价格解释。" },
        { label: "独立存款人", value: "+2%", interpretation: "新增参与证据有限。" },
      ],
      conclusion: "不能把美元 TVL 增长全部解释为新增资金；更准确的结论是“价格贡献为主，原生数量和参与者小幅增长”。",
      limits: "原生数量仍可能受循环存借、激励和跨链重复计算影响。",
    },
    checklist: ["写清美元或原生单位", "记录链、区块高度和时间", "检查地址与合约标签", "把存量和流量分开"],
    pitfalls: ["把地址数等同于用户数", "把 TVL 变化全部解释为资金流", "忽略桥接资产和循环抵押"],
    quizzes: [
      { question: "美元 TVL 上涨时，首先应拆分什么？", options: ["页面颜色", "资产价格变化与原生数量变化", "社交媒体关注数"], answer: 1, reason: "美元 TVL 同时受数量和价格影响，不拆分就无法判断真实流入。" },
      { question: "链上地址数能否直接等同于用户数？", options: ["能", "不能，一个用户可控制多个地址，地址也可能属于合约", "只有比特币能"], answer: 1, reason: "地址与经济主体不是一一对应关系。" },
    ],
    sources: [{ label: "以太坊 JSON-RPC 与区块数据定义", provider: "Ethereum.org", url: "https://ethereum.org/developers/docs/apis/json-rpc/" }],
  },
  {
    title: "消息、事件与时间证据",
    short: "分清发生、发布和被市场知道",
    objective: "建立事件时间线，区分事件发生、消息发布、首次可交易与价格反应时点。",
    overview: "新闻研究最常见的错误是时间穿越。文章发布时间不一定是市场首次知道信息的时间；更新稿可能覆盖原始时间；社交媒体和链上事件也可能早于正式公告。",
    framework: [
      { title: "原始来源", detail: "优先协议公告、监管文件和链上交易，不只引用转述。" },
      { title: "四个时间", detail: "记录发生、首次发布、抓取和策略可用时间。" },
      { title: "事件窗口", detail: "设定事件前后窗口，并剔除同期重大市场事件。" },
      { title: "意外程度", detail: "市场反应取决于实际信息相对预期的变化。" },
    ],
    caseStudy: {
      question: "公告显示 10:00 发布，但价格从 09:42 开始异动，回测应从何时允许使用消息？",
      evidence: [
        { label: "异动开始", value: "09:42", interpretation: "可能存在泄露、其他事件或共同市场冲击。" },
        { label: "官方发布", value: "10:00", interpretation: "这是可验证的公开信息时间。" },
        { label: "数据抓取", value: "10:03", interpretation: "策略最早在此后才能使用当前数据管线中的消息。" },
        { label: "订单时点", value: "10:04", interpretation: "还需加入处理和执行延迟。" },
      ],
      conclusion: "教学回测应以数据真实可获得时间 10:03 之后产生信号，并从下一可成交时点模拟订单。",
      limits: "09:42 异动的原因需要独立调查，不能仅凭时间先后认定内幕信息。",
    },
    checklist: ["保存原始链接和版本", "记录四类时间戳", "加入信息处理延迟", "检查同期市场事件"],
    pitfalls: ["用文章更新时间替代首次发布时间", "把价格先动自动解释为消息泄露", "忽略时区和夏令时"],
    quizzes: [
      { question: "策略何时可以使用一条新闻？", options: ["事件实际发生时", "数据管线真实获得并处理完成后", "文章最终更新时间"], answer: 1, reason: "回测只能使用当时真实可获得的信息，并需计入抓取和处理延迟。" },
      { question: "价格先于公告上涨能证明内幕交易吗？", options: ["能", "不能，还可能有共同事件、预期变化或其他信息源", "只要上涨超过 5% 就能"], answer: 1, reason: "时间先后只是调查线索，不能单独证明因果。" },
    ],
    sources: [{ label: "事件研究、Beta 漂移与异常收益", provider: "Federal Reserve FEDS", url: "https://www.federalreserve.gov/econres/feds/level-shifts-in-beta-spurious-abnormal-returns-and-the-tarp-announcement.htm" }],
  },
  {
    title: "冲突证据与诊断结论",
    short: "给出分级判断，而非确定答案",
    objective: "用证据矩阵记录支持、反对和未知项，形成带置信度、有效期和复核条件的结论。",
    overview: "真实研究很少出现所有指标一致。高标准诊断不通过多数投票消除冲突，而是区分证据质量、独立性、时效性和因果距离，并保留未知。",
    framework: [
      { title: "质量", detail: "原始数据、稳定定义和可复算过程权重更高。" },
      { title: "独立性", detail: "同源指标需要降权，避免重复计票。" },
      { title: "时效性", detail: "不同证据有不同衰减速度和复核频率。" },
      { title: "结论分级", detail: "使用支持、部分支持、证据不足、反对，而非必涨必跌。" },
    ],
    caseStudy: {
      question: "价格趋势强、链上活跃下降、新闻情绪高、流动性变差，应如何形成结论？",
      evidence: [
        { label: "价格", value: "支持", interpretation: "趋势证据存在，但可能滞后。" },
        { label: "链上", value: "反对", interpretation: "基本活动没有同步确认。" },
        { label: "消息", value: "弱支持", interpretation: "情绪高但来源可能重复。" },
        { label: "流动性", value: "风险升高", interpretation: "即使方向正确，执行成本也可能恶化。" },
      ],
      conclusion: "结论应为“短期价格证据偏强，但基本活动与流动性未确认，整体仅部分支持；降低置信度并缩短复核周期”。",
      limits: "证据权重必须事先定义，不能为了得到想要的结论临时调整。",
    },
    checklist: ["支持、反证和未知分别列出", "相关证据去重", "写明置信度与有效期", "设置下一次复核触发条件"],
    pitfalls: ["用指标多数投票代替证据质量", "隐藏与观点冲突的数据", "不给结论设置有效期"],
    quizzes: [
      { question: "多个同源价格指标一致时，应该怎样处理？", options: ["每个指标各算一票", "识别相关性并降低重复证据权重", "删除所有价格证据"], answer: 1, reason: "同源指标不是独立重复实验，直接计票会夸大信心。" },
      { question: "高标准诊断结论必须包含什么？", options: ["确定涨跌方向", "置信度、有效期和复核条件", "至少十个指标"], answer: 1, reason: "诊断是时点性的证据判断，需要说明不确定性和何时重新评估。" },
    ],
    sources: [{ label: "测量不确定性表达指南", provider: "NIST", url: "https://www.nist.gov/pml/nist-technical-note-1297" }],
  },
];

const ASSET_LESSONS: AppliedLesson[] = [
  {
    title: "目标、期限与约束",
    short: "先定义任务，再讨论收益",
    objective: "把收益目标放进期限、流动性需求、最大可承受损失和禁止事项中。",
    overview: "资产管理不是寻找最高收益资产，而是在约束下配置有限资本。目标模糊会让风险承受能力、风险意愿和实际风险暴露相互冲突。",
    framework: [
      { title: "目标", detail: "明确用途、目标金额和最低可接受结果。" },
      { title: "期限", detail: "区分短期支出、中期目标和长期资本。" },
      { title: "流动性", detail: "预留不可承受波动的现金需求。" },
      { title: "风险边界", detail: "定义最大回撤、杠杆和单项集中度。" },
    ],
    caseStudy: {
      question: "两年后必须支付的学费，是否适合全部配置到高波动加密资产？",
      evidence: [
        { label: "期限", value: "2 年", interpretation: "恢复严重回撤的时间有限。" },
        { label: "刚性支出", value: "必须支付", interpretation: "不能依靠延期等待市场恢复。" },
        { label: "波动", value: "高", interpretation: "终点资金缺口风险明显。" },
        { label: "流动性", value: "届时需要", interpretation: "必须匹配现金流时间。" },
      ],
      conclusion: "刚性短期目标应优先匹配期限和资本保全，高波动资产只能使用不会影响目标实现的剩余风险预算。",
      limits: "具体资产配置比例取决于个人财务情况，本课程只讲方法，不提供个性化投资建议。",
    },
    checklist: ["目标金额与日期明确", "刚性和弹性目标分开", "预留流动性缓冲", "风险边界可量化"],
    pitfalls: ["先选资产再补目标", "把风险意愿当风险能力", "忽略未来现金支出"],
    quizzes: [
      { question: "资产配置开始前最重要的输入是什么？", options: ["近期涨幅榜", "目标、期限、流动性和风险约束", "朋友的持仓"], answer: 1, reason: "组合必须服务于具体目标，并受到期限和风险能力约束。" },
      { question: "风险承受意愿高是否等于风险能力高？", options: ["等于", "不等于，收入、负债和期限可能限制实际能力", "只在牛市等于"], answer: 1, reason: "主观意愿不能改变刚性支出、负债和恢复时间。" },
    ],
    sources: [{ label: "Asset Allocation and Diversification", provider: "SEC Investor.gov", url: "https://www.investor.gov/introduction-investing/getting-started/asset-allocation" }],
  },
  {
    title: "资本配置与风险预算",
    short: "权重不等于风险贡献",
    objective: "区分资本权重、名义暴露和风险贡献，并为单项与组合设置预算。",
    overview: "等权组合不一定等风险。高波动、高相关或带杠杆的资产即使资本占比不高，也可能主导组合损失。资产管理需要从“投了多少钱”进一步计算“贡献了多少风险”。",
    framework: [
      { title: "资本权重", detail: "资产市值占组合净资产的比例。" },
      { title: "名义暴露", detail: "衍生品和杠杆头寸可能超过投入资本。" },
      { title: "风险贡献", detail: "同时取决于权重、波动和资产间协方差。" },
      { title: "预算门禁", detail: "为单项、主题和组合总风险设上限。" },
    ],
    caseStudy: {
      question: "BTC 与两个高相关山寨币各占三分之一，是否代表风险均分？",
      evidence: [
        { label: "资本权重", value: "各 33%", interpretation: "表面等权。" },
        { label: "波动率", value: "山寨币约为 BTC 的 1.8×", interpretation: "相同权重带来更高单项波动。" },
        { label: "相关性", value: "0.82", interpretation: "分散效果有限。" },
        { label: "流动性", value: "山寨币较低", interpretation: "压力期退出成本更高。" },
      ],
      conclusion: "资本等权不代表风险等权；组合风险可能主要由两个高波动、低流动性的山寨币贡献。",
      limits: "风险贡献依赖历史估计，压力期相关性和流动性可能进一步恶化。",
    },
    checklist: ["同时报告资本和风险权重", "把衍生品换算为名义暴露", "检查共同因子", "预算包含压力情景"],
    pitfalls: ["把等权当充分分散", "忽略杠杆后的总暴露", "只用平稳期波动估计风险"],
    quizzes: [
      { question: "哪项最能决定资产的组合风险贡献？", options: ["只看资本权重", "权重、波动和与组合的协方差", "代币单价"], answer: 1, reason: "风险贡献是权重和边际组合风险的共同结果。" },
      { question: "衍生品投入保证金很少，是否表示风险暴露很小？", options: ["是", "不是，还要看名义头寸、杠杆和清算条件", "只有期权不是"], answer: 1, reason: "保证金不是最大损失或名义暴露的完整度量。" },
    ],
    sources: [{ label: "Portfolio Selection (1952)", provider: "Harry Markowitz / Journal of Finance", url: "https://www.jstor.org/stable/2975974" }],
  },
  {
    title: "分散、相关与集中度",
    short: "资产数量不等于有效分散",
    objective: "从资产、主题、链、协议、稳定币和托管渠道多个层级识别共同风险。",
    overview: "分散的核心是避免同一风险来源一次性伤害整个组合。持有很多代币，如果都依赖同一公链、稳定币、交易所或市场因子，实际仍可能高度集中。",
    framework: [
      { title: "权重集中", detail: "使用最大单项权重、HHI 和有效资产数。" },
      { title: "相关集中", detail: "观察滚动相关和压力期共同下跌。" },
      { title: "因子集中", detail: "识别市场 beta、流动性、规模和动量暴露。" },
      { title: "基础设施集中", detail: "检查链、桥、预言机、托管和稳定币依赖。" },
    ],
    caseStudy: {
      question: "持有 12 个 DeFi 代币是否一定比持有 4 类资产更分散？",
      evidence: [
        { label: "数量", value: "12 个", interpretation: "名义资产数较多。" },
        { label: "同链比例", value: "85%", interpretation: "高度依赖单一网络。" },
        { label: "市场相关", value: "平均 0.76", interpretation: "共同涨跌明显。" },
        { label: "抵押资产", value: "集中于同一稳定币", interpretation: "存在共同脱锚风险。" },
      ],
      conclusion: "资产数量很多但有效风险来源很少，应按链、协议类别、抵押物和市场因子重新聚合暴露。",
      limits: "历史低相关不保证危机期分散，必须加入共同失效情景。",
    },
    checklist: ["计算 HHI 和有效资产数", "按主题与基础设施穿透", "检查滚动和压力相关", "列出共同失效点"],
    pitfalls: ["只统计代币数量", "用全样本相关掩盖危机相关", "忽略稳定币和托管集中"],
    quizzes: [
      { question: "有效分散最关注什么？", options: ["资产名称数量", "独立风险来源和共同失效点", "每个资产价格是否不同"], answer: 1, reason: "多个资产若依赖同一风险因子，仍可能同时遭受损失。" },
      { question: "历史相关性低能否保证危机期分散？", options: ["能", "不能，压力期相关结构可能突变", "只要样本超过一年就能"], answer: 1, reason: "危机期流动性和风险偏好冲击常使相关性上升。" },
    ],
    sources: [{ label: "Herfindahl-Hirschman Index", provider: "U.S. Department of Justice", url: "https://www.justice.gov/atr/herfindahl-hirschman-index" }],
  },
  {
    title: "再平衡、成本与治理",
    short: "把目标权重变成可执行规则",
    objective: "比较定期、阈值和风险再平衡，并把费用、滑点、流动性与治理责任写入规则。",
    overview: "再平衡不是机械地卖涨买跌，而是让组合重新回到目标风险。过于频繁会被成本侵蚀，过于迟缓会让漂移后的集中风险失控。规则还必须明确谁能调整目标、依据什么数据以及如何留痕。",
    framework: [
      { title: "触发方式", detail: "定期检查、权重阈值或风险阈值各有取舍。" },
      { title: "交易优先级", detail: "先使用现金流，再处理偏离最大和流动性较好的资产。" },
      { title: "成本预算", detail: "估计手续费、价差、冲击和链上 Gas。" },
      { title: "治理记录", detail: "保存目标、偏离、订单、例外和批准人。" },
    ],
    caseStudy: {
      question: "目标权重 40%，当前升至 44%，是否应立即再平衡？",
      evidence: [
        { label: "偏离", value: "+4 个百分点", interpretation: "需要与预设阈值比较。" },
        { label: "阈值", value: "±5 个百分点", interpretation: "尚未触发权重门禁。" },
        { label: "风险贡献", value: "已超预算", interpretation: "可能触发风险阈值。" },
        { label: "交易成本", value: "当前较高", interpretation: "需要比较立即处理与等待成本。" },
      ],
      conclusion: "不能只看权重阈值；如果风险贡献已超预算，应按风险规则处理，并记录高成本环境下的执行方案。",
      limits: "阈值需用历史漂移、成本和风险容忍度校准，不能照搬固定数字。",
    },
    checklist: ["触发规则预先定义", "风险与权重阈值同时检查", "交易成本进入决策", "例外操作必须留痕"],
    pitfalls: ["每次小偏离都交易", "只看权重不看风险贡献", "临时修改目标掩盖漂移"],
    quizzes: [
      { question: "再平衡的核心目的是什么？", options: ["预测下一次涨跌", "让组合回到目标风险和约束", "提高交易次数"], answer: 1, reason: "再平衡服务于既定配置和风险预算，而不是短期择时。" },
      { question: "哪项不应被再平衡规则忽略？", options: ["手续费、价差与价格冲击", "资产名称长度", "页面排序"], answer: 0, reason: "交易成本可能超过降低偏离带来的收益。" },
    ],
    sources: [{ label: "Portfolio Performance Evaluation", provider: "CFA Institute", url: "https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/portfolio-performance-evaluation" }],
  },
  {
    title: "回撤、绩效与组合复核",
    short: "评价结果，也评价过程",
    objective: "联合观察收益、回撤、风险调整绩效、基准、成本和目标达成概率，并建立复核门禁。",
    overview: "组合评价不能只看终点收益。高收益可能来自集中、杠杆或流动性风险；低收益也可能是遵守资本保护约束的合理结果。评价必须回到目标，并区分市场贡献、配置贡献和执行成本。",
    framework: [
      { title: "目标达成", detail: "先判断资金目标和风险约束是否满足。" },
      { title: "基准比较", detail: "使用与风险和可投资范围一致的基准。" },
      { title: "路径风险", detail: "观察回撤深度、持续时间和恢复过程。" },
      { title: "归因复核", detail: "拆分市场、配置、选择、费用和执行贡献。" },
    ],
    caseStudy: {
      question: "组合年收益 18%、最大回撤 42%，基准收益 15%、回撤 20%，是否表现优秀？",
      evidence: [
        { label: "绝对收益", value: "+18%", interpretation: "高于零但不能单独评价。" },
        { label: "超额收益", value: "+3%", interpretation: "相对基准改善有限。" },
        { label: "最大回撤", value: "42%", interpretation: "约为基准两倍。" },
        { label: "恢复要求", value: "+72.4%", interpretation: "从 42% 回撤恢复需要大幅上涨。" },
      ],
      conclusion: "收益略高但路径风险显著恶化，不能直接评价为优秀；需检查是否违反最大回撤和杠杆约束。",
      limits: "单年度样本不足以判断长期稳定性，还需多周期和压力情景复核。",
    },
    checklist: ["收益与目标一致比较", "基准风险口径匹配", "报告回撤深度和时长", "记录费用与归因"],
    pitfalls: ["只报告最佳收益区间", "用低风险基准衬托高风险组合", "忽略回撤恢复难度"],
    quizzes: [
      { question: "高于基准的收益是否一定代表更好的管理？", options: ["一定", "不一定，还要比较风险、回撤、成本和约束", "只要超过 1% 就一定"], answer: 1, reason: "超额收益可能来自承担更多未预算风险。" },
      { question: "组合亏损 40% 后，回到原净值需要上涨约多少？", options: ["40%", "约 66.7%", "约 20%"], answer: 1, reason: "从 60 回到 100 需要上涨 40/60，约为 66.7%。" },
    ],
    sources: [{ label: "Global Investment Performance Standards", provider: "CFA Institute", url: "https://www.gipsstandards.org/" }],
  },
];

export const DIAGNOSIS_COURSE: AppliedCourse = {
  key: "diagnosis",
  eyebrow: "DIAGNOSIS · CLAIM → EVIDENCE → COUNTEREVIDENCE",
  title: "诊断分析学堂",
  description: "学习把市场观点拆成可证伪问题，核验价格、量能、链上和事件证据，在冲突信息中形成带置信度和有效期的诊断结论。",
  outcome: "完成后能够输出一份包含主张、证据、反证、未知项、置信度、有效期和复核条件的诊断记录。",
  nextPath: "/backtest-learning",
  nextLabel: "继续回测学堂",
  lessons: DIAGNOSIS_LESSONS,
};

export const ASSET_COURSE: AppliedCourse = {
  key: "assets",
  eyebrow: "PORTFOLIO · OBJECTIVE → ALLOCATION → GOVERNANCE",
  title: "资产管理学堂",
  description: "从目标、期限和流动性约束出发，学习资本配置、风险预算、分散、再平衡、回撤与组合绩效复核。",
  outcome: "完成后能够从组合整体而不是单个标的评估风险，并写出目标权重、风险预算、再平衡和复核规则。",
  nextPath: "/risk-learning",
  nextLabel: "继续风控学堂",
  lessons: ASSET_LESSONS,
};
