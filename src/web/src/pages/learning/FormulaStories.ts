import type { FormulaItem } from "./FormulaHandbook";
import { getFormulaCatalogGenealogy } from "./FormulaHistoryCatalog";

export type FormulaSource = {
  label: string;
  url: string;
};

type FormulaStoryCore = {
  era: string;
  origin: string;
  question: string;
  derivation: string[];
  intuition: string;
  evolution: string;
  sourceLabel?: string;
  sourceUrl?: string;
};

type FormulaGenealogy = {
  attribution: string;
  historicalContext: string;
  intellectualRoots: string[];
  transmission: string;
  sources?: FormulaSource[];
};

export type FormulaStory = FormulaStoryCore & FormulaGenealogy;

const STORIES: Record<string, FormulaStoryCore & Partial<FormulaGenealogy>> = {
  "百分比变化": {
    era: "古代比例思想 → 14—17 世纪商业算术",
    attribution: "没有单一发明者。它由古代比例与“三率法”长期演化而来；中世纪和文艺复兴时期的意大利商人、算术教材编写者将“每一百份（per cento）”固定成常用商业语言。",
    historicalContext: "跨地区贸易扩大后，人们需要用统一尺度比较不同本金、货价和数量上的税、利息、佣金、折扣与盈亏。直接比较绝对差值会被基数大小误导，于是把变化量除以原值，再换算为每百份的变化。",
    intellectualRoots: [
      "比例与比率：把两个同类数量放到同一尺度比较。",
      "三率法（Rule of Three）：已知三个量，按比例求第四个量。",
      "十进制与按百记数：让税率、利率和商业账目易于口算与传播。",
      "商业算术：围绕利息、折扣、利润和损失形成标准题型。",
    ],
    origin: "“百分比变化”不是一篇论文中突然出现的公式。古代数学已经会处理比例和三率问题；商业社会把它改造成可复用的“相对原值变化”语言。意大利语 per cento 意为“每一百”，其缩写又逐渐演变为今天的 % 符号。",
    question: "同样增加 20，为什么从 80 到 100 与从 1,000 到 1,020 的意义完全不同？怎样排除基数大小，让两次变化可以比较？",
    derivation: [
      "先确定比较基准 X旧；它回答“相对于谁发生变化”。",
      "计算绝对变化 ΔX = X新 − X旧，保留上升或下降的方向。",
      "用基准标准化：ΔX / |X旧|，得到不受原单位尺度支配的相对变化。",
      "乘以 100%，把“每一份”改写为“每一百份”；例如 80 增至 100，即 20/80 = 25%。",
    ],
    intuition: "分子回答变了多少，分母回答这点变化相对于原来的规模有多大。公式真正关键的不是乘 100，而是先选对基准。",
    evolution: "百分比后来成为收益率、增长率、通胀率和误差率的共同语言。现代量化还会区分百分比变化与百分点变化，并在基准为 0、接近 0 或正负号跨越时改用绝对差、对数比率或其他尺度。",
    transmission: "商业算术先把它用于利息、税与利润；统计学和经济学再把它推广到指数、增长率和相对误差；金融市场最终把它固定为持有期收益与风险变动的基础表达。",
    sources: [
      { label: "UC Berkeley：百分比概念与三率法的历史研究", url: "https://escholarship.org/content/qt63c4h4g8/qt63c4h4g8.pdf" },
      { label: "1911 Britannica：商业算术中的百分比", url: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Arithmetic" },
      { label: "Treccani：百分比的定义与商业用途", url: "https://www.treccani.it/enciclopedia/percentuale_%28Enciclopedia-della-Matematica%29/" },
    ],
  },
  "矩阵组合方差": {
    era: "1952 · 现代投资组合理论",
    attribution: "Harry Markowitz 在 1952 年《Portfolio Selection》中把资产收益的方差、协方差与组合权重组织为现代投资组合选择框架；矩阵写法是这一框架的线性代数表达。",
    historicalContext: "当时的投资讨论重视挑选单个证券，却缺少计算资产共同涨跌如何改变整体风险的方法。Markowitz 要把“分散投资”从经验格言变成可求解的问题。",
    intellectualRoots: ["期望收益与方差统计", "协方差和线性组合", "效用权衡与约束优化"],
    transmission: "该表达进入有效前沿、指数投资、风险模型和机构资产配置，并成为几乎所有多资产风险引擎的基础。",
    origin: "Markowitz 将投资组合选择从“挑好资产”转成同时研究期望收益、方差与资产间协方差。矩阵形式 wᵀΣw 是多资产组合方差的紧凑表达。",
    question: "单项资产各自会波动，彼此还会共同涨跌；怎样把权重、单项方差和全部交叉协方差合成一个组合风险？",
    derivation: [
      "先写组合收益：Rp = ΣᵢwᵢRᵢ = wᵀR。",
      "对组合收益取方差：Var(Rp)=Var(wᵀR)。",
      "常数权重可以移到方差运算之外，得到 ΣᵢΣⱼwᵢwⱼCov(Rᵢ,Rⱼ)。",
      "把所有 Cov(Rᵢ,Rⱼ) 排成协方差矩阵 Σ，即得到 σp² = wᵀΣw。",
    ],
    intuition: "对角线是每项资产自己的波动，非对角线是资产之间共同变化。分散是否有效，关键不只是资产数量，而是权重和协方差结构。",
    evolution: "现代实践会对样本协方差做收缩、因子化或稳健估计，因为直接使用短样本协方差容易让优化器放大估计误差。",
    sourceLabel: "Markowitz, Portfolio Selection (1952)",
    sourceUrl: "https://www.jstor.org/stable/2975974",
  },
  "全局最小方差权重": {
    era: "1950s · 均值—方差优化",
    attribution: "它不是独立于 Markowitz 体系的另一项发明，而是 Markowitz 均值—方差可行集中方差最低的特殊解；用拉格朗日乘子可得到闭式权重。",
    historicalContext: "预期收益极难估计时，研究者希望先回答一个更窄的问题：在只使用协方差信息、且资金全部投入的条件下，最低波动组合是什么？",
    intellectualRoots: ["Markowitz 有效集", "二次型与逆矩阵", "Lagrange 约束优化"],
    transmission: "它后来成为低波动投资、组合基准和稳健资产配置的起点，实践中常附加卖空、杠杆与换手约束。",
    origin: "全局最小方差组合是 Markowitz 有效集最左端的组合：不设目标收益，只在权重和为 1 的前提下寻找方差最低的权重。",
    question: "如果不预测未来收益，只相信协方差矩阵，怎样找到所有满仓组合中理论波动最低的一组权重？",
    derivation: [
      "写目标和约束：min wᵀΣw，subject to 1ᵀw=1。",
      "构造拉格朗日函数：L = ½wᵀΣw − λ(1ᵀw−1)。",
      "对 w 求一阶条件：Σw−λ1=0，因此 w=λΣ⁻¹1。",
      "代回 1ᵀw=1，得到 λ=1/(1ᵀΣ⁻¹1)，最终 wGMV=Σ⁻¹1/(1ᵀΣ⁻¹1)。",
    ],
    intuition: "逆协方差矩阵会降低高波动、与其他资产高度同向的暴露；分母只负责把结果归一化到权重和为 1。",
    evolution: "无约束解可能产生巨大多空权重。真实组合通常增加禁止卖空、单项上限、换手和稳健协方差约束。",
    sourceLabel: "Markowitz, Efficient Diversification of Investments (1959)",
    sourceUrl: "https://cowles.yale.edu/research/cfm-16-portfolio-selection-efficient-diversification-investments",
  },
  "风险贡献": {
    era: "风险预算 · Euler 分解",
    attribution: "数学基础来自 Leonhard Euler 的齐次函数定理；现代投资中的风险贡献与风险预算由多位研究者发展，Bruder 与 Thierry Roncalli 等人对框架作了系统化阐述。",
    historicalContext: "机构组合发现资本权重并不等于风险权重，需要把总波动或尾部风险逐项分摊，才能设置可执行的风险预算。",
    intellectualRoots: ["Euler 齐次函数定理", "Markowitz 协方差组合风险", "边际分析与预算分解"],
    transmission: "它从波动率分解扩展到 VaR、Expected Shortfall 与风险平价，并进入组合归因、限额和再平衡系统。",
    origin: "组合波动率对权重是一阶齐次函数，因此可用 Euler 定理把总波动精确拆成各资产的边际贡献之和。它成为风险预算和风险平价的基础。",
    question: "权重相同不代表风险相同；怎样回答组合总波动到底由哪项资产贡献？",
    derivation: [
      "组合波动率为 σp=√(wᵀΣw)。",
      "对第 i 项权重求偏导，得到边际风险 MRCᵢ=(Σw)ᵢ/σp。",
      "边际风险乘该项权重：RCᵢ=wᵢ(Σw)ᵢ/σp。",
      "由 Euler 定理可得 ΣᵢRCᵢ=σp，因此风险贡献能完整加总。",
    ],
    intuition: "一项资产的风险贡献同时取决于持仓大小、自身波动以及它和组合其余部分的共同变化。低权重资产也可能因高波动、高相关而主导风险。",
    evolution: "这一思路后来扩展到 VaR、Expected Shortfall 等齐次风险度量，但不同风险度量的贡献不能混在同一张风险预算表中。",
    sourceLabel: "Bruder & Roncalli, Risk Budgeting Approach",
    sourceUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2009778",
  },
  "Kelly 比例": {
    era: "1956 · Bell Labs 信息论",
    attribution: "Bell Labs 研究员 John L. Kelly Jr. 在 1956 年论文《A New Interpretation of Information Rate》中提出这一长期增长准则。",
    historicalContext: "Kelly 研究的是：当通信信号带来对赛马结果的额外信息时，这些信息的传输率与重复下注可达到的财富增长率有什么关系。",
    intellectualRoots: ["Shannon 信息论与对数", "重复赌博和复合财富", "期望对数效用与破产约束"],
    transmission: "该准则由赌博问题传播到投资组合和仓位管理；由于参数误差与深度回撤，实务通常采用分数 Kelly。",
    origin: "J. L. Kelly Jr. 研究通信信号提供的信息如何转化为重复下注中的财富增长，提出最大化长期财富对数增长率的下注比例。",
    question: "在胜率和赔率已知、机会会重复出现时，每次投入多少才能最大化长期复合增长，而不是只最大化下一次期望收益？",
    derivation: [
      "设投入财富比例 f，赢时财富乘以 1+bf，输时乘以 1−f。",
      "写期望对数增长：G(f)=p ln(1+bf)+(1−p)ln(1−f)。",
      "对 f 求导并令 G′(f)=0。",
      "整理得到 f*=p−(1−p)/b；若优势为负，最优长期比例不应为正。",
    ],
    intuition: "下注过少浪费优势，下注过多会让亏损后的复利恢复极其困难。Kelly 优化的是长期增长率，不是回撤舒适度。",
    evolution: "实际交易常用半 Kelly 或更低比例，因为胜率、赔率会漂移，估计误差、相关持仓和尾部跳跃都让满 Kelly 过于激进。",
    sourceLabel: "Kelly, A New Interpretation of Information Rate (1956)",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1956.tb03809.x",
  },
  "简单收益率": {
    era: "价格比较的基础语言",
    origin: "收益率把不同价格尺度的绝对盈亏转为相对期初价值的比例，是持有期绩效与组合核算的基本单位。",
    question: "价格从一个时点变化到另一个时点，相对期初究竟改变了多少？",
    derivation: ["先计算价格差 P₁−P₀。", "用期初价格 P₀ 标准化。", "得到 R=(P₁−P₀)/P₀=P₁/P₀−1。"],
    intuition: "分母是你最初投入的价格，因此同样上涨 10 元，对 100 元和 1,000 元资产的意义不同。",
    evolution: "跨期连接要使用连乘；为了让跨期收益可相加，统计建模常改用对数收益。",
  },
  "对数收益率": {
    era: "连续复利与时间可加性",
    origin: "对数将价格比率的乘法连接转成加法，因而适合连续复利、时间序列和随机过程建模。",
    question: "怎样让多期收益可以直接相加，同时保持与最终价格比一致？",
    derivation: ["写价格增长倍数 P₁/P₀。", "取自然对数 r=ln(P₁/P₀)。", "多期相加后中间价格相消：Σrₜ=ln(P终/P初)。"],
    intuition: "对数把财富的乘法世界映射到加法世界；小幅收益下与简单收益近似，大幅涨跌时差异明显。",
    evolution: "它方便建模但不是账户真实百分比盈亏，向业务用户展示时通常仍转换回简单收益。",
  },
  "样本方差与标准差": {
    era: "统计离散度",
    attribution: "离散度思想经历长期发展；Ronald A. Fisher 在 1918 年论文中引入并推广“variance”这一术语。样本分母 n−1 则与 Bessel 修正和无偏估计传统相连。",
    historicalContext: "遗传、测量和实验数据需要区分平均水平与围绕平均值的离散程度，并从有限样本估计总体差异。",
    intellectualRoots: ["误差平方与最小二乘", "Gauss 误差理论", "Bessel 修正、自由度与 Fisher 统计学"],
    transmission: "方差成为统计推断和投资风险的标准尺度，随后又衍生波动率、协方差矩阵和条件异方差模型。",
    origin: "方差用平方偏差衡量观测围绕均值的离散程度；样本分母使用 n−1，是为估计总体方差时修正均值已由样本估计带来的自由度损失。",
    question: "一组收益即使平均值相同，波动程度可能完全不同，怎样用一个统一尺度描述？",
    derivation: ["计算样本均值。", "求每个观测与均值的偏差并平方。", "平方和除以 n−1 得样本方差。", "开平方恢复原始单位，得到标准差。"],
    intuition: "平方让正负偏差不会抵消，同时放大极端偏离。",
    evolution: "金融收益常有厚尾和波动聚集，因此标准差需与下行风险、回撤和尾部分位数一起使用。",
  },
  "相关系数": {
    era: "标准化共同变化",
    attribution: "Karl Pearson 在 19 世纪末系统发展乘积矩相关系数，并明确继承 Francis Galton 的相关与回归思想；更早的 Bravais 已在误差研究中使用相关形式。",
    historicalContext: "遗传和测量研究需要比较两组变量共同变化的强弱，但原始协方差会随计量单位改变，无法直接横向比较。",
    intellectualRoots: ["Bravais 的误差相关", "Galton 的遗传、回归与相关", "协方差的标准化"],
    transmission: "相关系数从生物统计进入计量经济学和组合投资，成为分散化、因子暴露和风险聚类的基础输入。",
    origin: "相关系数把带单位的协方差除以两组数据的标准差，得到 −1 到 1 之间可比较的线性共同变化尺度。",
    question: "两个资产共同变化的程度如何跨不同波动尺度比较？",
    derivation: ["计算两资产协方差。", "分别计算各自标准差。", "用 σAσB 标准化协方差，得到 ρAB。"],
    intuition: "相关描述两组偏离均值时是否常同向，不描述谁导致谁。",
    evolution: "现代组合研究会观察滚动相关、尾部相关和因子暴露，因为单一历史相关在危机期可能失效。",
  },
  "Sharpe 比率": {
    era: "风险调整绩效",
    attribution: "William F. Sharpe 在 1966 年研究共同基金绩效时提出“reward-to-variability ratio”；后来这一指标被称为 Sharpe ratio。",
    historicalContext: "共同基金的收益和波动各不相同，只按收益排名会奖励承担更多风险的基金，因此需要把超额回报放到风险尺度上比较。",
    intellectualRoots: ["Markowitz 均值—方差框架", "Tobin 的无风险资产与分离思想", "Sharpe 的资本资产定价研究"],
    transmission: "它成为基金、策略和组合绩效报告的通用指标，并催生 Sortino、Information ratio 等针对不同基准或下行风险的变体。",
    origin: "Sharpe 比率把组合相对无风险资产的平均超额收益与其总波动比较，用于评价承担一单位波动获得多少补偿。",
    question: "两个收益不同、波动也不同的策略，怎样在统一风险尺度上比较？",
    derivation: ["统一收益、无风险收益和波动的频率。", "计算超额收益 Rp−Rf。", "除以同频率波动 σp；需要时再按一致规则年化。"],
    intuition: "分子是风险补偿，分母是为获得它经历的总波动。",
    evolution: "厚尾、负偏和非流动资产会让 Sharpe 过度乐观，因此还需观察 Sortino、回撤和尾部风险。",
  },
  "平均真实波幅 ATR": {
    era: "Wilder 波动体系",
    attribution: "J. Welles Wilder Jr. 在 1978 年《New Concepts in Technical Trading Systems》中提出 True Range 与 Average True Range。",
    historicalContext: "商品期货经常出现隔夜或跨日跳空，只计算当日最高价减最低价会漏掉上一收盘到本周期价格区间之间的真实移动。",
    intellectualRoots: ["价格区间与极差", "跳空对波动测量的修正", "Wilder 递推平滑"],
    transmission: "ATR 从商品交易系统进入图表软件，后来广泛用于波动标准化、仓位缩放、通道和止损距离。",
    origin: "ATR 在普通最高—最低振幅之外加入相对前收盘的跳空距离，再用 Wilder 平滑形成动态绝对波动尺度。",
    question: "仅看本柱高低差会遗漏跨周期跳空，怎样更完整地衡量价格活动范围？",
    derivation: ["计算 H−L。", "计算 |H−C₋₁| 与 |L−C₋₁|。", "三者取最大得到 TR。", "对 TR 做 Wilder 平滑得到 ATR。"],
    intuition: "ATR 只回答动了多远，不回答向哪个方向动。",
    evolution: "跨资产比较通常使用 NATR=ATR/Close；用作止损时仍需考虑跳空和流动性。",
  },
};

const FAMILY_LINEAGES = {
  proportion: {
    attribution: "这类公式没有单一发明者。它由古代比例、欧几里得式几何关系、三率法与后来的代数记号共同塑造。",
    historicalContext: "测量、土地分配、贸易换算和利息核算都要求把不同尺度的数量放到统一口径比较。",
    intellectualRoots: ["比例与相似关系", "三率法和商业算术", "十进制、百分数与符号代数"],
    transmission: "比例工具先进入商业账簿与工程测量，随后成为统计标准化、金融收益率和风险尺度的底层语言。",
    sources: [{ label: "MacTutor：数学史主题索引", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/" }],
  },
  probability: {
    attribution: "现代概率论通常追溯到 17 世纪 Pascal 与 Fermat 对机会游戏的通信；Bernoulli、Bayes 与 Laplace 又把频率、条件概率和逆概率系统化。",
    historicalContext: "机会游戏、公平分赌金、人口与寿命表，以及在不完全信息下更新判断，推动人们把“不确定”写成可计算的数量。",
    intellectualRoots: ["组合计数与机会游戏", "频率稳定性与大数思想", "条件概率、逆概率和证据更新"],
    transmission: "概率从赌博问题进入保险、天文误差和统计推断，最终成为收益分布、贝叶斯模型和风险情景的共同基础。",
    sources: [
      { label: "MacTutor：Pascal 与 Fermat 的概率通信", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Pascal_Fermat/" },
      { label: "MacTutor：Laplace 与概率体系", url: "https://mathshistory.st-andrews.ac.uk/Extras/Laplace_Probabilities/" },
    ],
  },
  statistics: {
    attribution: "统计公式多由 19—20 世纪的 Gauss、Galton、Pearson、Student 与 Fisher 等人分阶段系统化，而非出自一位作者。",
    historicalContext: "天文和测量误差、遗传数据、小样本实验与农业试验需要回答：观察到的差异究竟是规律还是抽样噪声？",
    intellectualRoots: ["误差理论与最小二乘", "正态分布和抽样分布", "相关、回归、似然与实验设计"],
    transmission: "这些方法从自然科学实验进入计量经济学，再成为因子检验、置信区间和样本外评价的标准工具。",
    sources: [{ label: "NIST/SEMATECH：统计方法与历史参考", url: "https://www.itl.nist.gov/div898/handbook/" }],
  },
  calculus: {
    attribution: "微积分由 Newton 与 Leibniz 在 17 世纪分别建立；线性代数则由行列式、线性方程组和 Cayley 等人的矩阵思想逐步形成。",
    historicalContext: "瞬时速度、曲线切线、面积、天体运动和多元方程组都无法只靠静态算术有效处理。",
    intellectualRoots: ["古希腊穷竭法", "解析几何与无穷小思想", "线性方程、行列式与向量空间"],
    transmission: "导数成为优化与敏感度的语言，矩阵成为回归、协方差、因子模型和机器学习的计算骨架。",
    sources: [{ label: "MacTutor：微积分史", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/The_rise_of_calculus/" }],
  },
  return: {
    attribution: "收益率和复利没有单一发明者；它们由古代利息计算、中世纪商业算术和对数工具逐步标准化。",
    historicalContext: "借贷、合伙贸易和跨期投资需要区分绝对赚了多少与相对于本金赚了多少，并把多期增长正确连接。",
    intellectualRoots: ["比例与百分数", "单利、复利和年金", "Napier 对数与连续增长"],
    transmission: "商业核算中的本金增长被现代金融改写为持有期收益、对数收益、净值曲线与年化增长率。",
    sources: [{ label: "1911 Britannica：利息、投资与商业百分比", url: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Arithmetic" }],
  },
  portfolio: {
    attribution: "Harry Markowitz 在 1952 年把期望收益、方差和协方差组织成可优化的投资组合选择问题；Tobin 与 Sharpe 等人继续扩展。",
    historicalContext: "投资者早已知道“不要把鸡蛋放在一个篮子里”，但缺少一种同时计算每项资产风险和共同涨跌的严格方法。",
    intellectualRoots: ["期望效用与风险—收益权衡", "方差、协方差和矩阵代数", "拉格朗日约束优化"],
    transmission: "均值—方差框架后来发展出有效前沿、CAPM、风险预算、稳健优化与机构资产配置。",
    sources: [
      { label: "Markowitz：Portfolio Selection (1952)", url: "https://www.jstor.org/stable/2975974" },
      { label: "诺贝尔奖：1990 年经济学奖科学背景", url: "https://www.nobelprize.org/prizes/economic-sciences/1990/press-release/" },
    ],
  },
  timeseries: {
    attribution: "时间序列方法由 Yule、Slutsky、Wiener、Kolmogorov、Box、Jenkins 与 Engle 等人在 20 世纪不同阶段建立。",
    historicalContext: "经济和市场数据按时间相互依赖，普通独立样本方法无法解释趋势、周期、自相关和波动聚集。",
    intellectualRoots: ["随机过程与平稳性", "自相关、滤波和预测", "状态空间、条件异方差与频域分析"],
    transmission: "它们从信号处理和宏观预测进入量化交易，用于收益预测、波动估计、滤波和风险情景生成。",
    sources: [{ label: "Engle 诺贝尔演讲：时间变化波动率", url: "https://www.nobelprize.org/uploads/2018/06/engle-lecture.pdf" }],
  },
  technical: {
    attribution: "技术指标不是同一理论的产物：移动平均源于平滑思想，RSI 与 ATR 由 J. Welles Wilder 系统推广，MACD 通常归于 Gerald Appel。",
    historicalContext: "在计算资源有限的年代，交易者需要用少量递推计算压缩趋势、动量和波动信息，而不是逐条阅读全部价格。",
    intellectualRoots: ["移动平均与信号平滑", "相对强弱和动量比较", "真实波幅、通道与经验交易规则"],
    transmission: "纸笔指标进入图表软件后变成标准函数；现代研究进一步要求明确定义、避免未来函数，并做样本外统计验证。",
    sources: [{ label: "TA-Lib：技术指标定义索引", url: "https://ta-lib.org/functions/" }],
  },
  backtest: {
    attribution: "回测没有单一发明者。它继承科学实验、历史情景分析、计量经济学和计算机事件模拟的方法。",
    historicalContext: "策略规则越来越复杂后，仅凭若干图表示例无法判断效果是否稳定；研究者需要在冻结的历史数据上可重复地重放决策。",
    intellectualRoots: ["可证伪假设与对照基准", "按时间顺序的离散事件模拟", "抽样误差、交叉验证与稳健性检验"],
    transmission: "计算机把人工历史复盘变成逐事件仿真；现代规范又加入交易成本、幸存者偏差、前视偏差和样本外检验。",
    sources: [{ label: "Bailey 等：The Probability of Backtest Overfitting", url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253" }],
  },
  risk: {
    attribution: "现代市场风险公式由保险精算、Markowitz 组合理论、银行 VaR 实务和 1990 年代一致风险度量研究共同形成。",
    historicalContext: "机构不仅要知道平均能赚多少，还要回答极端情况下会亏多少、损失由谁贡献，以及何时必须减仓或停止交易。",
    intellectualRoots: ["保险精算与破产概率", "分位数、尾部期望和极值思想", "组合协方差、情景分析与风险预算"],
    transmission: "风险度量从报表指标进入限额、保证金、压力测试、组合预算和交易前拒单系统。",
    sources: [{ label: "Basel Committee：市场风险最低资本要求", url: "https://www.bis.org/bcbs/publ/d457.htm" }],
  },
  derivatives: {
    attribution: "Black 与 Scholes 在 1973 年给出期权定价模型，Merton 同期完善连续时间复制与定价论证；Greeks 是其敏感度分析语言。",
    historicalContext: "期权交易扩张后，市场需要把到期收益、时间、波动和无风险利率统一成可复制、可对冲的价格框架。",
    intellectualRoots: ["Brownian motion 与随机微积分", "无套利和复制组合", "热方程、偏微分方程与动态对冲"],
    transmission: "模型从期权报价进入做市、波动率曲面、情景风险和动态对冲，同时也暴露出跳跃、肥尾和交易摩擦的局限。",
    sources: [{ label: "诺贝尔奖：Merton 与 Scholes 的衍生品定价贡献", url: "https://www.nobelprize.org/prizes/economic-sciences/1997/press-release/" }],
  },
  execution: {
    attribution: "执行与 Web3 公式来自市场微观结构、库存与冲击成本研究，以及区块链自动做市协议设计，并非单一学派。",
    historicalContext: "理论信号必须穿过价差、深度、手续费、延迟和链上排序；成交过程本身会改变最终收益。",
    intellectualRoots: ["订单簿、价差与价格冲击", "恒定函数做市和套利", "博弈论、拍卖与区块链共识"],
    transmission: "传统执行模型扩展到 AMM、预言机、Gas、MEV 与跨池路由，形成链上策略不可省略的成本层。",
    sources: [{ label: "Uniswap v2 Core Whitepaper", url: "https://app.uniswap.org/whitepaper.pdf" }],
  },
  kline: {
    attribution: "K 线并无可核实的单一现代公式发明者。它与日本米市的价格记录传统有关，后来被现代图表软件和技术分析体系标准化为 OHLCV 数据。",
    historicalContext: "交易者需要在一个固定周期内同时保留开盘、最高、最低与收盘，而不是只记录一个终值。",
    intellectualRoots: ["市场账簿与价格序列", "时间分桶和区间摘要", "趋势、支撑阻力与量价观察"],
    transmission: "视觉蜡烛图后来转为标准 OHLCV 数据结构；量化研究再把实体、影线和形态改写为可计算、可回测条件。",
    sources: [{ label: "Nasdaq：Kline / Candlestick 数据定义", url: "https://data.nasdaq.com/databases/RTAT/documentation" }],
  },
} satisfies Record<string, FormulaGenealogy>;

type FamilyKey = keyof typeof FAMILY_LINEAGES;

const GROUP_FAMILY: Record<string, FamilyKey> = {
  "数学工具与缩放": "proportion", "微积分与线性代数": "calculus",
  "收益与复利": "return", "收益与净值": "return",
  "均值与波动": "statistics", "概率与期望": "probability", "概率分布与贝叶斯": "probability",
  "统计推断": "statistics", "相关与组合": "portfolio", "回归与因子": "statistics",
  "时间序列": "timeseries", "随机过程": "timeseries", "技术指标": "technical",
  "机器学习与预测": "statistics", "组合优化": "portfolio", "绩效与风险": "risk",
  "期权定价与 Greeks": "derivatives", "执行与 Web3": "execution",
  "数据与样本": "backtest", "仓位与成交模拟": "backtest", "稳健性与过拟合": "backtest",
  "换手与成本": "backtest", "基准与超额": "backtest", "绩效与回撤": "risk", "交易质量": "backtest",
  "暴露与杠杆": "risk", "仓位与止损": "risk", "盈亏结构": "risk", "组合集中度": "risk",
  "回撤与尾部": "risk", "下行与分布风险": "risk", "流动性与执行风险": "execution", "衍生品与链上风险": "derivatives",
  "OHLCV 与价格变换": "kline", "周期聚合与时间边界": "kline", "实体影线与柱内强度": "kline",
  "趋势与市场结构": "technical", "支撑阻力与突破": "technical", "成交量与价格确认": "technical",
  "动量与震荡指标": "technical", "波动率与通道": "technical", "形态算法化与统计验证": "backtest",
  "数据质量与可回测规则": "backtest",
};

const DEFAULT_GENEALOGY: FormulaGenealogy = {
  attribution: "这条公式来自长期积累的数学定义和实践约定，没有证据支持把它归给单一发明者。",
  historicalContext: "人们需要把经验判断变成输入明确、过程可复算、结论可检查的数量关系。",
  intellectualRoots: ["测量与比例", "符号代数", "统计验证与可重复计算"],
  transmission: "它后来被纳入现代数据分析流程，并通过统一口径、计算机实现和样本外检验用于量化研究。",
  sources: [{ label: "MacTutor：数学史资料库", url: "https://mathshistory.st-andrews.ac.uk/" }],
};

export function getFormulaStory(formula: FormulaItem, groupTitle: string): FormulaStory {
  const story = STORIES[formula.name];
  const genealogy = getFormulaCatalogGenealogy(formula.name, formula.purpose)
    ?? FAMILY_LINEAGES[GROUP_FAMILY[groupTitle]]
    ?? DEFAULT_GENEALOGY;
  if (story) {
    const legacySource = story.sourceUrl
      ? [{ label: story.sourceLabel ?? "原始资料", url: story.sourceUrl }]
      : [];
    return {
      ...genealogy,
      ...story,
      intellectualRoots: story.intellectualRoots ?? genealogy.intellectualRoots,
      sources: [...(story.sources ?? genealogy.sources ?? []), ...legacySource],
    };
  }

  return {
    era: `${groupTitle} · 公式谱系`,
    ...genealogy,
    origin: `“${formula.name}”属于“${groupTitle}”知识链。它不是孤立符号，而是上述历史问题、数学工具与行业实践交汇后的标准表达。`,
    question: formula.purpose,
    derivation: [
      `先统一输入口径：${formula.variables.join("；")}。`,
      `再按定义建立关系：${formula.equation}。`,
      `使用小样本逐项代入，并检查单位、时间窗口和分母。`,
      `最后把计算结果还原成业务问题，而不是把数值本身当作确定结论。`,
    ],
    intuition: formula.example,
    evolution: `现代量化系统通常会把该公式放入数据检查、滚动估计、基准比较和样本外验证流程。它的核心边界是：${formula.boundary}`,
  };
}
