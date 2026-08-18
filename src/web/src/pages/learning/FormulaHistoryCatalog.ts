export type FormulaHistorySource = {
  label: string;
  url: string;
};

export type FormulaHistoryGenealogy = {
  attribution: string;
  historicalContext: string;
  intellectualRoots: string[];
  transmission: string;
  sources: FormulaHistorySource[];
};

type HistoryProfile = FormulaHistoryGenealogy & {
  names: string[];
};

const PERCENT_HISTORY: FormulaHistorySource = {
  label: "UC Berkeley：百分比、三率法与商业算术史",
  url: "https://escholarship.org/content/qt63c4h4g8/qt63c4h4g8.pdf",
};

const PROFILES: HistoryProfile[] = [
  {
    names: ["百分比变化", "弹性"],
    attribution: "没有单一发明者。相对变化来自古代比例与三率法；“每百份”在中世纪商业算术中定型。弹性的现代经济学用法由 Alfred Marshall 在 19 世纪末系统推广。",
    historicalContext: "贸易、税、利息与价格分析需要排除绝对规模影响，比较一个量相对于基准或另一个量究竟变化了多少。",
    intellectualRoots: ["比例与三率法", "per cento 商业记数", "边际变化与经济比较静态"],
    transmission: "相对变化进入收益率和增长率；弹性进入需求、风险敏感度和因子暴露分析。",
    sources: [PERCENT_HISTORY, { label: "Marshall, Principles of Economics", url: "https://oll.libertyfund.org/titles/marshall-principles-of-economics-8th-ed" }],
  },
  {
    names: ["算术平均", "加权平均"],
    attribution: "没有单一发明者。算术平均可追溯到古代测量与天文计算；加权平均是在观测重要性或出现次数不同时对平均概念的自然扩展。",
    historicalContext: "重复测量会产生不同结果，人们需要用一个中心值汇总信息；当样本可信度、概率或资本权重不同，又不能把每项等量看待。",
    intellectualRoots: ["等分与比例", "天文观测误差", "概率权重与线性组合"],
    transmission: "平均数进入期望收益、指数编制、组合收益和估值汇总；权重口径成为量化模型必须审计的输入。",
    sources: [{ label: "MacTutor：统计学历史", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Statistics/" }],
  },
  {
    names: ["导数", "梯度", "二阶泰勒近似"],
    attribution: "Newton 与 Leibniz 在 17 世纪分别建立微积分；Brook Taylor 在 1715 年系统发表以导数展开函数的方法，梯度则随多元微积分与向量分析形成。",
    historicalContext: "天体运动、瞬时速度、曲线切线和最优化要求描述“极小变化如何影响结果”，以及如何用局部信息近似复杂函数。",
    intellectualRoots: ["无穷小与极限", "解析几何", "局部线性化和高阶曲率"],
    transmission: "导数和梯度成为参数优化、风险敏感度和机器学习训练的语言；Taylor 展开进入期权 Greeks 与非线性风险近似。",
    sources: [{ label: "MacTutor：微积分的兴起", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/The_rise_of_calculus/" }],
  },
  {
    names: ["矩阵乘法", "特征值分解"],
    attribution: "矩阵理论由 Cayley、Sylvester 等人在 19 世纪系统建立；特征值思想则从 Euler、Lagrange 的线性系统与主轴问题逐步发展。",
    historicalContext: "联立方程、线性变换、振动系统和二次型需要一种能同时处理许多变量及其相互作用的统一记号。",
    intellectualRoots: ["线性方程组", "行列式与线性变换", "二次型、主轴与谱分解"],
    transmission: "矩阵进入协方差、回归和因子模型；特征值分解进入 PCA、风险因子压缩和相关矩阵诊断。",
    sources: [{ label: "MacTutor：矩阵与行列式史", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Matrices_and_determinants/" }],
  },
  {
    names: ["简单收益率", "单期收盘收益", "单期策略收益", "净收益", "超额收益"],
    attribution: "没有单一发明者。收益率由古代利息、合伙贸易和商业百分比计算长期演化而来；现代金融把它标准化为相对期初资本的持有期回报。",
    historicalContext: "不同本金上的绝对盈亏无法直接比较，基金和证券也需要把价格变化、现金流、成本和基准放到同一相对尺度。",
    intellectualRoots: ["本金、利息与商业百分比", "价格比率", "基准和机会成本"],
    transmission: "持有期收益成为净值、回测、绩效归因和风险模型的基础数据；净收益进一步扣除费用与滑点。",
    sources: [{ label: "1911 Britannica：商业算术、利息与投资", url: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Arithmetic" }],
  },
  {
    names: ["对数收益率", "复合增长率", "年化复合收益", "净值递推"],
    attribution: "复利没有单一发明者；John Napier 在 1614 年发表对数后，乘法增长可以转成加法。连续复利和现代随机金融进一步固定了对数收益的地位。",
    historicalContext: "借贷与投资需要正确连接多期增长；直接相加百分比会产生错误，而财富路径本质上按乘法累积。",
    intellectualRoots: ["复利与年金", "Napier 对数", "几何增长和乘法过程"],
    transmission: "复利进入 CAGR 和净值递推；对数收益进入时间序列、随机过程和连续时间资产定价。",
    sources: [{ label: "MacTutor：对数的发明", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Logarithms/" }],
  },
  {
    names: ["样本方差与标准差", "随机变量方差", "波动率年化", "年化波动率"],
    attribution: "离散度由误差理论逐步形成；Ronald Fisher 在 1918 年引入并推广 variance 一词。样本 n−1 修正与 Bessel 的有限样本误差研究相连。",
    historicalContext: "测量、遗传和金融数据即使均值相同也可能稳定性完全不同，需要量化围绕中心的离散程度，并从样本推断总体。",
    intellectualRoots: ["最小二乘与平方误差", "Bessel 修正和自由度", "平方根时间尺度"],
    transmission: "方差成为统计推断、组合协方差和波动率的核心；金融实践再加入年化和条件波动模型。",
    sources: [{ label: "NIST：方差与标准差", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm" }],
  },
  {
    names: ["均值标准误", "均值置信区间", "t 统计量"],
    attribution: "William Sealy Gosset 以 Student 笔名在 1908 年发表小样本 t 分布；Fisher 后来把自由度、估计和检验体系进一步系统化。",
    historicalContext: "Guinness 啤酒厂等小样本质量控制场景无法依赖大样本正态近似，需要把均值估计的不确定性显式计入。",
    intellectualRoots: ["抽样分布", "标准误", "小样本自由度与假设检验"],
    transmission: "t 统计与置信区间进入回归和因子研究，用于判断平均收益或系数是否可能只是抽样噪声。",
    sources: [{ label: "NIST：Student t 分布", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda3664.htm" }],
  },
  {
    names: ["正态分布密度", "偏度", "超额峰度", "Z-score 标准化"],
    attribution: "正态误差曲线由 de Moivre、Laplace 与 Gauss 等人逐步建立；Karl Pearson 系统发展矩、偏度和峰度，标准分数则来自统计标准化传统。",
    historicalContext: "天文与测量需要描述误差形状；后来人们还要区分对称性、尾部厚度，并把不同单位的观测放在同一尺度。",
    intellectualRoots: ["中心极限定理与误差曲线", "矩方法", "均值—标准差标准化"],
    transmission: "这些量进入异常检测、风险分布诊断和因子标准化；厚尾市场也揭示了正态假设的边界。",
    sources: [{ label: "NIST：概率分布与描述统计", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda36.htm" }],
  },
  {
    names: ["伯努利分布", "二项分布", "条件概率", "期望收益", "单笔期望"],
    attribution: "现代概率通常追溯到 Pascal 与 Fermat 的 1654 年通信；Jacob Bernoulli 系统研究重复试验，Huygens 与 Laplace 等人发展期望与概率计算。",
    historicalContext: "机会游戏、公平分赌金、保险和重复成败试验要求计算事件发生概率以及长期平均结果。",
    intellectualRoots: ["组合计数", "机会游戏与公平价格", "重复试验和大数定律"],
    transmission: "概率与期望进入保险精算、资产定价、交易胜率和策略期望，但不保证下一次结果。",
    sources: [{ label: "MacTutor：Pascal 与 Fermat 的概率通信", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Pascal_Fermat/" }],
  },
  {
    names: ["贝叶斯公式"],
    attribution: "Thomas Bayes 的逆概率结果在其去世后由 Richard Price 于 1763 年发表；Pierre-Simon Laplace 独立发展并大幅系统化了贝叶斯推断。",
    historicalContext: "已知某种原因会产生哪些结果后，人们还需要反过来回答：观察到结果时，各种原因有多可信？",
    intellectualRoots: ["条件概率", "逆概率", "先验信念与证据更新"],
    transmission: "贝叶斯更新进入信号融合、参数估计、状态判断和机器学习，用于随新数据修正策略判断。",
    sources: [{ label: "MacTutor：Bayes 生平与逆概率", url: "https://mathshistory.st-andrews.ac.uk/Biographies/Bayes/" }, { label: "MacTutor：Laplace 的概率论", url: "https://mathshistory.st-andrews.ac.uk/Extras/Laplace_Probabilities/" }],
  },
  {
    names: ["Bonferroni 阈值"],
    attribution: "该校正以意大利数学家 Carlo Emilio Bonferroni 命名，来源于他在 1930 年代发表的不等式；后来被用于多重假设检验的家族错误率控制。",
    historicalContext: "同时检验大量策略或因子时，即使每项都用 5% 阈值，也会因为试验次数过多产生许多偶然显著结果。",
    intellectualRoots: ["Boole 联合界", "多重比较", "家族错误率控制"],
    transmission: "它进入因子挖掘、参数搜索和回测审计，提醒研究者为重复试验支付更严格的显著性门槛。",
    sources: [{ label: "NIST：多重比较方法", url: "https://www.itl.nist.gov/div898/handbook/prc/section4/prc473.htm" }],
  },
  {
    names: ["有效样本量", "概率夏普比率", "样本外衰减", "训练/验证/测试占比", "参数敏感度"],
    attribution: "这组公式由抽样理论、时间序列相关修正、机器学习验证和现代回测过拟合研究共同形成，没有单一提出者；概率 Sharpe 比率由 Bailey 与 López de Prado 等人系统化。",
    historicalContext: "金融样本相关、策略反复调参且候选众多，名义数据量和样本内表现会严重夸大真实证据强度。",
    intellectualRoots: ["相关样本的有效信息量", "样本外验证", "多重试验与选择偏差"],
    transmission: "这些方法进入走样本外、滚动验证、参数稳定性和策略晋级门禁。",
    sources: [{ label: "Bailey & López de Prado：The Sharpe Ratio Efficient Frontier", url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1821643" }, { label: "scikit-learn：交叉验证", url: "https://scikit-learn.org/stable/modules/cross_validation.html" }],
  },
  {
    names: ["一元 OLS 斜率", "回归截距", "决定系数", "多因子收益"],
    attribution: "Legendre 于 1805 年发表最小二乘法，Gauss 随后给出独立发展和概率解释；Galton、Pearson 与 20 世纪计量经济学把回归推广到相关和多因子问题。",
    historicalContext: "天文观测和测量包含误差，需要从互相冲突的数据中寻找最合适的线性关系，并衡量模型解释了多少变化。",
    intellectualRoots: ["最小平方误差", "线性方程与正态误差", "相关、回归和方差分解"],
    transmission: "OLS 进入 CAPM、因子模型、归因和对冲比率估计；截距、斜率与 R² 成为模型审计的基本输出。",
    sources: [{ label: "MacTutor：最小二乘法史", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Least_squares/" }],
  },
  {
    names: ["相关系数"],
    attribution: "Karl Pearson 在 19 世纪末系统发展乘积矩相关系数，并继承 Francis Galton 的相关和回归思想；更早的 Auguste Bravais 已在误差研究中使用相关形式。",
    historicalContext: "遗传和测量研究需要比较两组变量共同变化的强弱，但原始协方差会随计量单位变化，不能直接横向比较。",
    intellectualRoots: ["Bravais 的误差相关", "Galton 的遗传与回归", "协方差的标准化"],
    transmission: "相关系数从生物统计进入计量经济学和组合投资，成为分散化、因子暴露和风险聚类的基础输入。",
    sources: [{ label: "MacTutor：Karl Pearson", url: "https://mathshistory.st-andrews.ac.uk/Biographies/Pearson/" }],
  },
  {
    names: ["信息系数 IC", "跟踪误差", "信息比率"],
    attribution: "这些指标来自现代主动投资管理而非一位发明者；Treynor、Black、Grinold 与 Kahn 等人的组合和主动管理研究对其定义与使用作了系统化。",
    historicalContext: "主动策略需要分别回答预测排序是否有效、组合偏离基准多少，以及每承担一单位主动风险获得多少超额收益。",
    intellectualRoots: ["相关与预测排序", "基准相对收益", "均值—方差和主动风险预算"],
    transmission: "IC、跟踪误差和信息比率进入因子研究、基金评价和基准约束组合优化。",
    sources: [{ label: "CFA Institute：Active Portfolio Management 概览", url: "https://rpc.cfainstitute.org/en/research/foundation/2011/active-portfolio-management" }],
  },
  {
    names: ["均方误差", "逻辑函数", "交叉熵", "L2 正则化"],
    attribution: "平方误差继承最小二乘传统；logistic 曲线由 Verhulst 在 19 世纪提出；交叉熵来自 Shannon 信息论；L2 正则化与 Tikhonov 稳定化及 ridge regression 相连。",
    historicalContext: "预测模型需要定义错误大小、把分数转成概率，并限制参数对噪声的过度适配。",
    intellectualRoots: ["最小二乘", "概率似然与信息熵", "病态逆问题和参数收缩"],
    transmission: "这些损失与正则项成为机器学习训练核心，并进入收益方向、违约和风险分类模型。",
    sources: [{ label: "scikit-learn：线性模型与正则化", url: "https://scikit-learn.org/stable/modules/linear_model.html" }],
  },
  {
    names: ["自相关", "AR(1) 模型", "滞后差分", "信号滞后", "条件远期收益"],
    attribution: "G. Udny Yule 在 1920 年代系统发展自回归思想；Slutsky、Wold、Box 与 Jenkins 等人继续建立现代时间序列分析。",
    historicalContext: "按时间排列的数据并不独立，当前值常与过去值相关；趋势、周期和滞后会让普通横截面统计失效。",
    intellectualRoots: ["滞后关系与差分", "平稳随机过程", "滤波、预测与事件时间对齐"],
    transmission: "自相关和 AR 模型进入信号衰减、收益预测、风险聚集检查和事件研究。",
    sources: [{ label: "NIST：时间序列分析", url: "https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc4.htm" }],
  },
  {
    names: ["OU 均值回归", "半衰期"],
    attribution: "Leonard Ornstein 与 George Uhlenbeck 在 1930 年用随机微分方程描述带回复力的速度过程；金融研究后来把该过程用于利率、价差和均值回归。",
    historicalContext: "Brownian motion 会无限漂移，无法描述被长期均衡水平拉回的物理量或价差，需要加入与偏离程度成比例的回复项。",
    intellectualRoots: ["Brownian motion", "线性回复力", "指数衰减"],
    transmission: "OU 过程进入配对交易、利率模型和价差建模；半衰期把抽象回复速度转成可解释的持有周期。",
    sources: [{ label: "Encyclopedia of Mathematics：Ornstein–Uhlenbeck process", url: "https://encyclopediaofmath.org/wiki/Ornstein-Uhlenbeck_process" }],
  },
  {
    names: ["EWMA 均值", "EWMA 方差"],
    attribution: "指数平滑由 Robert G. Brown、Charles Holt 等人在 20 世纪中期发展；J.P. Morgan 的 RiskMetrics 在 1990 年代推广 EWMA 波动率。",
    historicalContext: "固定窗口会突然丢弃旧数据且无法快速响应变化，需要让近期观测权重更大、旧观测按指数平滑衰减。",
    intellectualRoots: ["递推滤波", "指数衰减权重", "时变波动率"],
    transmission: "EWMA 进入实时信号、波动预测、VaR 和保证金系统，成为低成本在线估计方法。",
    sources: [{ label: "MSCI：RiskMetrics Technical Document", url: "https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a" }],
  },
  {
    names: ["布朗运动增量", "几何布朗运动", "Itô 引理"],
    attribution: "Brownian motion 经 Bachelier、Einstein 与 Wiener 数学化；Paul Samuelson 将几何 Brownian motion 引入金融价格；Kiyosi Itô 在 1940 年代建立随机微积分。",
    historicalContext: "随机扰动连续累积且路径不可微，普通微积分无法处理；资产价格还必须保持非负并体现比例变化。",
    intellectualRoots: ["扩散与随机游走", "Wiener 过程", "二次变差和随机积分"],
    transmission: "这些工具进入连续时间资产定价、Black–Scholes、利率模型和 Monte Carlo 风险模拟。",
    sources: [{ label: "诺贝尔奖：金融数学与 Black–Scholes 背景", url: "https://www.nobelprize.org/prizes/economic-sciences/1997/press-release/" }],
  },
  {
    names: ["简单移动平均", "简单移动平均 SMA", "指数移动平均", "指数移动平均 EMA", "成交量均线"],
    attribution: "移动平均来自 19—20 世纪时间序列平滑传统，没有单一金融发明者；指数平滑由 Brown、Holt 等人在预测与库存控制中系统发展。",
    historicalContext: "原始序列噪声太大，研究者需要压低短期扰动以观察较慢趋势，同时又在平滑与响应速度之间权衡。",
    intellectualRoots: ["滑动窗口平均", "低通滤波", "指数递推平滑"],
    transmission: "移动平均从经济预测进入图表和趋势策略，随后被严格写成无未来数据的滚动特征。",
    sources: [{ label: "NIST：移动平均与指数平滑", url: "https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc431.htm" }],
  },
  {
    names: ["MACD"],
    attribution: "MACD 通常归于交易研究者 Gerald Appel，他在 20 世纪后半叶用不同速度的指数移动平均之差刻画趋势动量。",
    historicalContext: "单条移动平均只能给出平滑价格，交易者希望同时观察短期趋势相对长期趋势的扩张、收缩与交叉。",
    intellectualRoots: ["指数移动平均", "快慢滤波器之差", "信号线与动量交叉"],
    transmission: "MACD 进入图表软件和系统交易；量化实现需要固定初始化、频率与信号执行时点。",
    sources: [{ label: "TA-Lib：MACD 定义", url: "https://ta-lib.github.io/ta-doc/indicator/MACD.htm" }],
  },
  {
    names: ["RSI", "相对强弱 RSI", "平均真实波幅 ATR", "真实波幅 ATR", "真实波幅 TR", "归一化 ATR"],
    attribution: "J. Welles Wilder Jr. 在 1978 年《New Concepts in Technical Trading Systems》中系统提出 RSI、True Range 与 ATR。",
    historicalContext: "交易者需要用递推方式衡量上涨与下跌动量，并修正普通日内高低差遗漏隔夜跳空的问题。",
    intellectualRoots: ["上涨/下跌幅度比较", "价格区间和跳空", "Wilder 递推平滑"],
    transmission: "这些指标进入图表软件、动量过滤、波动定仓与止损系统；NATR 又解决跨价格尺度比较。",
    sources: [{ label: "TA-Lib：Wilder 指标文档", url: "https://ta-lib.github.io/ta-doc/" }],
  },
  {
    names: ["布林带", "通道宽度"],
    attribution: "John Bollinger 在 1980 年代发展并在 1990 年代推广 Bollinger Bands，以移动平均和滚动标准差形成自适应价格通道。",
    historicalContext: "固定百分比通道无法适应波动环境变化，需要让通道宽度随近期价格离散程度自动扩张或收缩。",
    intellectualRoots: ["移动平均", "滚动标准差", "动态包络线"],
    transmission: "布林带进入波动突破、均值回归和 squeeze 研究，但现代量化必须验证参数和成交规则。",
    sources: [{ label: "Bollinger Bands 官方规则", url: "https://www.bollingerbands.com/bollinger-band-rules" }],
  },
  {
    names: ["变化率 ROC", "随机指标 %K"],
    attribution: "ROC 是相对变化的动量化应用，没有单一发明者；Stochastic Oscillator 通常归于 George Lane 及其合作者在 1950 年代的交易研究。",
    historicalContext: "交易者希望区分价格所处位置与变化速度：一个比较当前与过去，另一个比较收盘价在近期高低区间中的位置。",
    intellectualRoots: ["百分比变化", "区间归一化", "动量和超买超卖观察"],
    transmission: "两者成为标准动量特征，进入排序、过滤和形态验证，而不是单独作为确定买卖结论。",
    sources: [{ label: "TA-Lib：Momentum Indicators", url: "https://ta-lib.github.io/ta-lib-python/func_groups/momentum_indicators.html" }],
  },
  {
    names: ["能量潮 OBV", "量比", "收盘位置 CLV"],
    attribution: "OBV 由 Joseph Granville 在 1960 年代推广；量比和 CLV 则是成交量标准化与收盘位置思想的行业化表达，没有统一单一作者。",
    historicalContext: "仅看价格无法判断走势是否得到交易活动确认，因此需要把成交量方向、相对活跃度和收盘在区间的位置合并观察。",
    intellectualRoots: ["量价确认", "累计成交量", "区间位置归一化"],
    transmission: "这些量进入资金流、突破确认和横截面活跃度特征，并需防范交易所成交量口径差异。",
    sources: [{ label: "TA-Lib：Volume Indicators", url: "https://ta-lib.github.io/ta-lib-python/func_groups/volume_indicators.html" }],
  },
  {
    names: ["成交量加权均价 VWAP", "VWAP"],
    attribution: "VWAP 没有可确认的单一发明者，它随电子市场和机构执行基准在 20 世纪后半叶逐步标准化。",
    historicalContext: "大型订单不能只用收盘价评价，需要用市场实际成交量对价格加权，回答执行价格相对市场平均成交位置如何。",
    intellectualRoots: ["加权平均", "逐笔成交数据", "机构执行基准"],
    transmission: "VWAP 从交易后评价进入 VWAP 算法、日内基准和成交质量分析。",
    sources: [{ label: "SEC：Algorithmic Trading in U.S. Capital Markets", url: "https://www.sec.gov/files/Algo_Trading_Report_2020.pdf" }],
  },
  {
    names: ["OHLC 合法性", "典型价格", "聚合开盘", "聚合收盘", "聚合高低", "聚合成交量", "覆盖周期数", "缺失率", "数据完整率", "前复权价格"],
    attribution: "这些公式来自交易所行情记录、数据库聚合和证券公司行为调整的工程标准，没有单一数学发明者。",
    historicalContext: "逐笔交易必须压缩成固定时间柱，同时保持开高低收逻辑、成交量守恒、缺失可见，并让拆股分红前后的价格可比较。",
    intellectualRoots: ["账簿与时间分桶", "区间极值和首尾状态", "数据质量与公司行为调整"],
    transmission: "OHLCV 和复权口径成为图表、指标和回测的共同数据契约；错误聚合会直接制造虚假信号。",
    sources: [{ label: "Nasdaq Data Link：市场数据文档", url: "https://docs.data.nasdaq.com/" }],
  },
  {
    names: ["实体长度", "振幅", "上下影线", "实体占比", "上影线占比", "下影线占比"],
    attribution: "蜡烛图来自日本市场价格记录传统，现代 OHLC 形态公式则由图表软件和量化研究者把视觉描述逐步标准化，没有单一提出者。",
    historicalContext: "交易者希望在一根时间柱中区分方向、实体、区间和收盘位置，后来又需要把这些视觉概念变成可比较的比例。",
    intellectualRoots: ["OHLC 区间摘要", "实体与影线视觉语法", "尺度归一化"],
    transmission: "视觉 K 线被改写为实体长度、影线比例和柱内强度，成为可搜索、可回测的数值特征。",
    sources: [{ label: "CME Group：Candlestick Charts", url: "https://www.cmegroup.com/education/courses/technical-analysis/chart-types-candlestick-line-and-bar.html" }],
  },
  {
    names: ["锤子线规则", "十字星规则", "吞没规则", "形态命中率与期望"],
    attribution: "锤子、十字星和吞没是传统蜡烛图命名，不存在统一原始论文；现代量化版本由研究者把文字定义转成阈值规则和条件统计。",
    historicalContext: "肉眼识别形态主观且容易只记住成功案例，需要明确实体、影线和前后柱条件，再统计形态后的结果分布。",
    intellectualRoots: ["日本蜡烛图形态", "布尔规则与阈值", "条件概率和事件研究"],
    transmission: "形态从图解经验进入扫描器和回测；命中率、期望和样本量取代“看到形态就反转”的确定性叙事。",
    sources: [{ label: "CFA Institute：Technical Analysis 研究综述", url: "https://rpc.cfainstitute.org/en/research/foundation/2007/technical-analysis" }],
  },
  {
    names: ["结构高低点", "滚动支撑", "滚动阻力", "突破距离"],
    attribution: "趋势、支撑和阻力来自 Dow Theory 与后续技术分析传统；滚动极值和突破距离是将其算法化的现代实现，没有单一公式作者。",
    historicalContext: "视觉趋势线和支撑位因观察者而异，系统研究需要用局部极值、窗口高低和归一化距离定义结构。",
    intellectualRoots: ["Dow Theory 的趋势层级", "局部极值", "滚动窗口和波动标准化"],
    transmission: "这些概念进入趋势跟踪、Donchian 类突破和市场结构特征，并通过样本外测试校正窗口。",
    sources: [{ label: "CFA Institute：Technical Analysis", url: "https://rpc.cfainstitute.org/en/research/foundation/2007/technical-analysis" }],
  },
  {
    names: ["资产权重", "组合期望收益", "矩阵组合方差", "组合波动率", "组合风险", "全局最小方差权重"],
    attribution: "Harry Markowitz 在 1952 年把权重、期望收益、方差和协方差组织成现代投资组合选择；矩阵和最小方差解是该框架的直接发展。",
    historicalContext: "经验上的分散投资缺少严格风险计算，尤其无法说明资产共同涨跌如何改变整体风险以及怎样选择权重。",
    intellectualRoots: ["期望与方差", "协方差矩阵", "约束二次优化"],
    transmission: "该体系进入有效前沿、指数、资产配置、风险模型和稳健组合优化。",
    sources: [{ label: "Markowitz：Portfolio Selection (1952)", url: "https://www.jstor.org/stable/2975974" }],
  },
  {
    names: ["风险贡献"],
    attribution: "数学基础来自 Euler 齐次函数定理；现代风险贡献和风险预算由多位研究者发展，Bruder 与 Thierry Roncalli 等人作了系统化阐述。",
    historicalContext: "资本权重不等于风险权重，机构需要把组合总风险逐项分摊，才能设置风险预算和再平衡规则。",
    intellectualRoots: ["Euler 齐次函数", "Markowitz 协方差风险", "边际分析"],
    transmission: "风险贡献从波动分解扩展到 VaR、Expected Shortfall、风险平价和组合归因。",
    sources: [{ label: "Bruder & Roncalli：Managing Risk Exposures", url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2009778" }],
  },
  {
    names: ["HHI 集中度", "有效资产数"],
    attribution: "HHI 以经济学家 Orris Herfindahl 与 Albert Hirschman 命名，20 世纪中期用于产业集中度；其倒数后来被解释为等权口径下的有效数量。",
    historicalContext: "仅数公司或资产个数无法识别少数大权重主导的集中结构，需要用权重平方放大大份额。",
    intellectualRoots: ["市场份额", "平方权重", "多样性和有效数量"],
    transmission: "HHI 从反垄断分析进入组合集中度、流动性来源和链上持仓分布监控。",
    sources: [{ label: "U.S. DOJ：Herfindahl-Hirschman Index", url: "https://www.justice.gov/atr/herfindahl-hirschman-index" }],
  },
  {
    names: ["Sharpe 比率"],
    attribution: "William F. Sharpe 在 1966 年共同基金绩效研究中提出 reward-to-variability ratio，后来被称为 Sharpe ratio。",
    historicalContext: "只按收益给基金排名会奖励额外冒险，需要比较每承担一单位总波动获得多少超额收益。",
    intellectualRoots: ["Markowitz 均值—方差", "Tobin 无风险资产", "资本资产定价研究"],
    transmission: "Sharpe 比率成为基金与策略评价标准，并衍生概率 Sharpe、Sortino 和信息比率。",
    sources: [{ label: "William Sharpe：诺贝尔奖自传", url: "https://www.nobelprize.org/prizes/economic-sciences/1990/sharpe/biographical/" }],
  },
  {
    names: ["Sortino 比率", "下行偏差"],
    attribution: "Frank Sortino 及其合作者在 1980—1990 年代系统推广只惩罚目标以下波动的绩效框架，下行偏差继承半方差和 downside risk 思想。",
    historicalContext: "标准差把有利的上涨和有害的下跌同等视为风险，不符合许多投资者只担心低于目标收益的偏好。",
    intellectualRoots: ["Markowitz 半方差", "最低可接受收益", "下偏矩"],
    transmission: "Sortino 与下行偏差进入基金评价、目标收益组合和风险预算，补充而非替代尾部损失分析。",
    sources: [{ label: "CFA Institute：Downside Risk Measures", url: "https://rpc.cfainstitute.org/en/research/financial-analysts-journal/1991/managing-downside-risk" }],
  },
  {
    names: ["Calmar 比率", "当前回撤", "最大回撤", "回本所需涨幅"],
    attribution: "回撤来自交易账户和基金净值的高水位记录传统，没有单一发明者；Terry W. Young 在 1991 年提出并命名 Calmar ratio。",
    historicalContext: "终点收益无法描述投资者途中经历的损失深度和恢复难度，管理期货行业还需要用回撤评价收益质量。",
    intellectualRoots: ["高水位与路径依赖", "峰谷损失", "复利恢复的不对称性"],
    transmission: "回撤和 Calmar 进入策略报告、风险门禁、熔断和资本分配。",
    sources: [{ label: "CFA Institute：Performance and Risk", url: "https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2025/portfolio-performance-evaluation" }],
  },
  {
    names: ["胜率", "盈亏比", "盈亏平衡胜率", "盈利因子", "交易期望"],
    attribution: "这些指标来自赌博数学、保险期望和交易账簿统计的长期融合，没有单一发明者；盈亏平衡关系是期望值方程的直接代数结果。",
    historicalContext: "高胜率策略仍可能因单次大亏而失败，低胜率策略也可能靠高盈亏比盈利，因此必须联合观察概率与收益分布。",
    intellectualRoots: ["Bernoulli 试验", "期望值", "赔率、损益比和长期频率"],
    transmission: "这些量进入交易日志、回测评价和仓位规划，并通过成本和置信区间修正。",
    sources: [{ label: "MacTutor：概率与期望的历史", url: "https://mathshistory.st-andrews.ac.uk/HistTopics/Probability/" }],
  },
  {
    names: ["历史 VaR"],
    attribution: "VaR 没有单一发明者；它由银行风险限额和分位数损失方法发展而来，J.P. Morgan 在 1994 年公开 RiskMetrics 后得到广泛标准化。",
    historicalContext: "大型金融机构需要用一个共同货币尺度汇总不同交易台在给定期限和置信水平下的潜在损失。",
    intellectualRoots: ["损失分位数", "组合波动", "银行限额与监管资本"],
    transmission: "VaR 进入市场风险资本和日常限额，同时因不描述阈值外损失而被压力测试与 ES 补充。",
    sources: [{ label: "Basel Committee：Market Risk Framework", url: "https://www.bis.org/bcbs/publ/d457.htm" }],
  },
  {
    names: ["条件 VaR / ES"],
    attribution: "Expected Shortfall 源自保险和尾部条件期望思想；Rockafellar 与 Uryasev 在 2000 年前后给出便于组合优化的 CVaR 表述。",
    historicalContext: "VaR 只给出损失阈值，不回答越过阈值后平均会亏多少，也可能不满足分散化所需的一致风险性质。",
    intellectualRoots: ["条件期望", "尾部损失", "一致风险度量和凸优化"],
    transmission: "ES/CVaR 进入组合优化、压力测试和 Basel 市场风险资本框架。",
    sources: [{ label: "Rockafellar & Uryasev：Optimization of Conditional Value-at-Risk", url: "https://sites.math.washington.edu/~rtr/papers/rtr179-CVaR1.pdf" }],
  },
  {
    names: ["Kelly 比例"],
    attribution: "John L. Kelly Jr. 在 1956 年 Bell Labs 论文《A New Interpretation of Information Rate》中提出最大化长期财富对数增长的下注比例。",
    historicalContext: "Kelly 研究通信信号带来的信息如何转化为重复赛马下注中的长期财富增长率。",
    intellectualRoots: ["Shannon 信息论", "重复赌博与复利", "期望对数增长"],
    transmission: "Kelly 准则进入仓位和组合管理；因估计误差与回撤，实务常用分数 Kelly。",
    sources: [{ label: "Kelly：A New Interpretation of Information Rate (1956)", url: "https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1956.tb03809.x" }],
  },
  {
    names: ["名义头寸", "总杠杆", "单笔风险预算", "止损距离", "风险定仓", "保证金率", "清算缓冲"],
    attribution: "这些公式来自经纪账簿、保证金交易、期货清算和现代风险限额实践，没有单一作者。风险定仓把交易账簿规则与概率风险预算结合。",
    historicalContext: "杠杆会让小幅价格变动放大为资本损失，机构必须在下单前计算暴露、止损损失、保证金余量和清算距离。",
    intellectualRoots: ["复式记账和名义本金", "保证金与逐日盯市", "风险预算和损失限额"],
    transmission: "这些量进入交易前检查、仓位上限、保证金预警和自动减仓系统。",
    sources: [{ label: "CME Group：Futures Margin", url: "https://www.cmegroup.com/education/courses/introduction-to-futures/margin-know-what-is-needed.html" }],
  },
  {
    names: ["单期换手率", "交易成本", "实现滑点", "成交率", "订单数量", "目标数量", "成交参与率"],
    attribution: "这些公式由机构交易、市场微观结构和算法执行实践逐步标准化，没有统一发明者。",
    historicalContext: "纸面信号不能保证按理论价格成交，大订单还会受到价差、深度、延迟、费用和市场成交量约束。",
    intellectualRoots: ["订单簿与买卖价差", "库存和执行基准", "换手、费用与部分成交"],
    transmission: "它们进入回测成本层、VWAP/POV 执行、交易后分析和容量控制。",
    sources: [{ label: "SEC：Algorithmic Trading Report", url: "https://www.sec.gov/files/Algo_Trading_Report_2020.pdf" }],
  },
  {
    names: ["中间价与相对点差", "订单簿不平衡", "平方根冲击", "Amihud 非流动性"],
    attribution: "中间价和点差来自报价市场惯例；订单簿不平衡与价格冲击由市场微观结构研究发展；Yakov Amihud 在 2002 年提出著名的收益—成交额非流动性指标。",
    historicalContext: "成交价会受到流动性和订单方向影响，研究者需要从报价、深度、交易规模和价格变化中估计隐性成本与容量。",
    intellectualRoots: ["bid–ask spread", "订单流与价格冲击", "成交额标准化的流动性度量"],
    transmission: "这些指标进入智能路由、容量估计、冲击成本模型和流动性风险门禁。",
    sources: [{ label: "Amihud：Illiquidity and Stock Returns (2002)", url: "https://doi.org/10.1016/S0304-405X(01)00024-6" }],
  },
  {
    names: ["看涨/看跌到期损益", "看涨看跌平价"],
    attribution: "期权到期损益来自合约定义；看涨—看跌平价的现代无套利形式通常与 Hans Stoll 1969 年的研究相连，思想根源更早。",
    historicalContext: "具有相同执行价和到期日的看涨、看跌、现货和债券可以组成相同终值，因此价格必须满足一致关系，否则出现无风险套利。",
    intellectualRoots: ["分段线性合约收益", "复制组合", "一价定律与无套利"],
    transmission: "到期损益与平价进入期权报价检查、合成头寸和套利监控。",
    sources: [{ label: "Cboe Options Institute：Options Basics", url: "https://www.cboe.com/optionsinstitute/options_basics/" }],
  },
  {
    names: ["Black–Scholes 看涨", "d₁ 与 d₂", "Delta", "Gamma", "Vega"],
    attribution: "Fischer Black 与 Myron Scholes 于 1973 年发表期权定价模型，Robert Merton 同期完善连续时间复制论证；Greeks 是模型价格对输入的敏感度。",
    historicalContext: "期权市场需要把现货、执行价、时间、利率和波动统一成无套利价格，并给出动态对冲所需的风险敏感度。",
    intellectualRoots: ["几何 Brownian motion 与 Itô 引理", "复制组合和无套利", "热方程与偏微分方程"],
    transmission: "该体系进入期权报价、做市、波动率曲面和 Greeks 对冲，也推动对跳跃、肥尾和随机波动的扩展。",
    sources: [{ label: "诺贝尔奖：衍生品定价方法", url: "https://www.nobelprize.org/prizes/economic-sciences/1997/press-release/" }],
  },
  {
    names: ["恒定乘积 AMM", "恒定乘积无常损失"],
    attribution: "恒定函数做市由自动做市研究和链上协议共同发展；Uniswap v1/v2 将 x·y=k 普及。无常损失是流动性提供者相对持币组合的机会成本描述，没有单一命名发明者。",
    historicalContext: "区块链无法依赖持续在线的传统做市商，需要用储备函数自动报价；流动性提供者又必须衡量价格变化后的相对损益。",
    intellectualRoots: ["库存型做市", "不变量与套利定价", "几何平均和机会成本"],
    transmission: "恒定乘积进入 DEX、路由和链上套利；无常损失进入 LP 收益、费用补偿和集中流动性风险分析。",
    sources: [{ label: "Uniswap v2 Core Whitepaper", url: "https://app.uniswap.org/whitepaper.pdf" }],
  },
  {
    names: ["永续资金费损益", "期货基差年化", "基差风险"],
    attribution: "期货基差来自传统远期与持有成本理论；无到期永续合约由 Robert Shiller 在 1990 年代提出 perpetual futures 构想，BitMEX 等加密平台后来以资金费机制普及。",
    historicalContext: "期货价格需要与现货和到期时间联系；永续合约没有到期交割，必须用周期性资金费把合约价格拉回指数附近。",
    intellectualRoots: ["远期无套利与持有成本", "现货—期货基差", "周期现金流和指数锚定"],
    transmission: "基差和资金费进入套保、现金套利、收益归因和拥挤风险监控。",
    sources: [{ label: "BitMEX：Perpetual Contracts Guide", url: "https://www.bitmex.com/app/perpetualContractsGuide" }],
  },
  {
    names: ["借贷健康因子"],
    attribution: "健康因子不是传统数学定理，而是链上超额抵押借贷协议的风险状态指标；Aave 等协议将抵押价值、清算阈值和债务汇总成可执行定义。",
    historicalContext: "无许可借贷不能依赖人工授信，协议必须根据预言机价格实时判断抵押物是否足以覆盖债务以及何时允许清算。",
    intellectualRoots: ["抵押率与保证金", "加权清算阈值", "预言机和自动清算"],
    transmission: "健康因子进入链上账户监控、自动补仓、清算机器人和 DeFi 风险仪表盘。",
    sources: [{ label: "Aave：Health Factor", url: "https://aave.com/help/borrowing/liquidations" }],
  },
];

const HISTORY_BY_NAME = new Map<string, HistoryProfile>();
for (const profile of PROFILES) {
  for (const name of profile.names) {
    if (HISTORY_BY_NAME.has(name)) {
      throw new Error(`公式历史档案重复归属：${name}`);
    }
    HISTORY_BY_NAME.set(name, profile);
  }
}

export const FORMULA_HISTORY_NAMES = new Set(HISTORY_BY_NAME.keys());

export function getFormulaCatalogGenealogy(name: string, purpose: string): FormulaHistoryGenealogy | undefined {
  const profile = HISTORY_BY_NAME.get(name);
  if (!profile) return undefined;
  return {
    attribution: profile.attribution,
    historicalContext: `${profile.historicalContext} “${name}”具体解决的是：${purpose}`,
    intellectualRoots: profile.intellectualRoots,
    transmission: profile.transmission,
    sources: profile.sources,
  };
}
