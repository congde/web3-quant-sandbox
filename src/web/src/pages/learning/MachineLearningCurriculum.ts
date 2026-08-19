export type MLAlgorithmStatus = "engine" | "lab" | "theory";

export type MLAlgorithm = {
  name: string;
  purpose: string;
  status: MLAlgorithmStatus;
  route?: string;
};

export type MLQuiz = {
  question: string;
  options: string[];
  answer: number;
  reason: string;
};

export type MLLesson = {
  id: string;
  number: string;
  title: string;
  short: string;
  book: string;
  objective: string;
  question: string;
  concepts: Array<{ title: string; detail: string }>;
  algorithms: MLAlgorithm[];
  workflow: string[];
  caseStudy: {
    title: string;
    input: string;
    decision: string;
    boundary: string;
  };
  checklist: string[];
  pitfalls: string[];
  quizzes: MLQuiz[];
  labKind: "contract" | "bayes" | "linear" | "generative" | "sparse" | "kernel" | "ensemble" | "regime" | "monte" | "discovery";
};

export const ML_STATUS_META: Record<MLAlgorithmStatus, { label: string; description: string }> = {
  engine: { label: "项目可运行", description: "仓库已有对应实现，可进入回测或因子工作台验证" },
  lab: { label: "交互实验", description: "课程提供概念实验，帮助理解参数、假设与失效边界" },
  theory: { label: "进阶理论", description: "保留为研究路线，不伪装成当前产品能力" },
};

export const ML_LESSONS: MLLesson[] = [
  {
    id: "research-contract",
    number: "01",
    title: "先定义问题，再选择算法",
    short: "任务、标签、损失与验证契约",
    book: "Murphy Ch.1、Ch.6",
    objective: "把“预测涨跌”改写为可计算、可验证、带时间边界的学习任务。",
    question: "这是分类、回归、排序、状态识别，还是不确定性估计？错误的代价是否对称？",
    concepts: [
      { title: "监督与无监督", detail: "有未来标签时做分类、回归或排序；没有标签时只能发现结构，不能直接声称可交易。" },
      { title: "经验风险", detail: "训练目标必须对应真实决策代价；准确率、收益、回撤和换手不是同一目标。" },
      { title: "时间验证", detail: "训练、验证和最终留出按时间排序，并依据标签预测期设置 purge。" },
    ],
    algorithms: [
      { name: "经验风险最小化 ERM", purpose: "从损失函数定义训练目标", status: "lab" },
      { name: "正则化风险最小化", purpose: "在拟合与复杂度之间建立约束", status: "lab" },
      { name: "时间序列交叉验证", purpose: "模拟真实的先训练、后预测", status: "engine", route: "/backtest-learning" },
      { name: "学习排序", purpose: "直接优化候选资产的相对次序", status: "theory" },
    ],
    workflow: ["冻结可用时点和预测期", "定义标签与决策损失", "建立朴素基准", "最后才选择模型族"],
    caseStudy: {
      title: "预测下一根上涨，还是预测未来三根净收益？",
      input: "同一组 OHLCV 特征；手续费与滑点合计 16 bps；平均持有 3 bars。",
      decision: "若目标是可交易性，应预测成本后的未来收益或把成本写入决策阈值，而不是只优化方向准确率。",
      boundary: "改变标签就改变了研究问题；不能在看到结果后悄悄换标签。",
    },
    checklist: ["特征在决策时刻已经可得", "标签窗口与持有期一致", "训练/验证/留出互不混用", "损失函数对应真实错误代价"],
    pitfalls: ["随机打乱时间序列", "先跑很多算法再挑最好看的", "把准确率直接解释为收益"],
    quizzes: [
      { question: "预测期为 5 bars 时，训练与验证边界至少应如何处理？", options: ["随机打乱", "purge 相邻标签窗口", "复制验证样本"], answer: 1, reason: "边界附近的训练标签会引用验证期价格，必须清除重叠窗口。" },
      { question: "模型选择之前最先需要冻结什么？", options: ["神经网络层数", "任务、标签和损失", "收益曲线颜色"], answer: 1, reason: "算法必须服务于已经定义好的决策问题。" },
    ],
    labKind: "contract",
  },
  {
    id: "probability-bayes",
    number: "02",
    title: "概率、贝叶斯与决策",
    short: "从先验到校准概率",
    book: "Murphy Ch.2–Ch.6",
    objective: "理解模型输出是条件概率估计，并能把先验、证据和错误成本转成决策阈值。",
    question: "在基础上涨概率很低、假阳性代价很高时，多强的信号才值得行动？",
    concepts: [
      { title: "先验 × 似然", detail: "后验来自基础发生率与新证据的共同作用，不能只看模型分数。" },
      { title: "概率校准", detail: "声称 70% 的样本，长期应约有 70% 发生；排序正确不等于概率可信。" },
      { title: "决策成本", detail: "假阳性、假阴性和不交易的机会成本决定最终阈值。" },
    ],
    algorithms: [
      { name: "Beta-Binomial", purpose: "更新事件发生率并表达小样本不确定性", status: "lab" },
      { name: "朴素贝叶斯", purpose: "用条件独立近似组合多项证据", status: "engine", route: "/backtests" },
      { name: "Bayes factor", purpose: "比较两个模型对证据的解释力", status: "theory" },
      { name: "Bootstrap", purpose: "估计统计量的采样不确定性", status: "engine", route: "/backtest-learning" },
      { name: "基础 Monte Carlo", purpose: "用重复抽样近似期望与尾部概率", status: "engine", route: "/math-learning" },
    ],
    workflow: ["写出基础发生率", "定义证据似然", "计算后验概率", "按错误成本设阈值"],
    caseStudy: {
      title: "稀有突破信号的后验概率",
      input: "真实突破基础率 20%；指标在真突破时触发率 80%，在失败时误触发率 30%。",
      decision: "触发后的后验约为 40%，远低于直觉中的 80%；是否交易还要看盈亏比和成本。",
      boundary: "条件独立和稳定先验在市场状态变化时可能失效。",
    },
    checklist: ["报告先验来源", "检查概率校准", "区分可信区间与置信区间", "记录错误成本矩阵"],
    pitfalls: ["忽略基础发生率", "把模型置信度当真实概率", "用 p-value 证明策略有效"],
    quizzes: [
      { question: "模型给出 0.8，最先应该追问什么？", options: ["颜色是否够亮", "概率是否经过样本外校准", "能否改成 0.9"], answer: 1, reason: "未校准分数没有可靠的频率解释。" },
      { question: "假阳性代价升高时，通常应怎样调整入场阈值？", options: ["降低", "提高", "保持不变"], answer: 1, reason: "更高阈值减少错误入场。" },
    ],
    labKind: "bayes",
  },
  {
    id: "linear-classification",
    number: "03",
    title: "线性、Logistic 与在线学习",
    short: "先用可解释基准建立底线",
    book: "Murphy Ch.7–Ch.9",
    objective: "掌握回归、分类和排序的共同线性结构，理解正则化、概率阈值与在线更新。",
    question: "一个复杂模型是否真的优于 Ridge 或 Logistic 这类透明基准？",
    concepts: [
      { title: "线性回归", detail: "预测连续收益时，系数表达局部边际关系，但不自动满足因果解释。" },
      { title: "Logistic", detail: "把线性分数映射为 0–1 概率，适合方向与事件分类。" },
      { title: "正则化", detail: "Ridge 缩小不稳定系数，减轻共线特征与小样本的方差。" },
    ],
    algorithms: [
      { name: "Linear regression", purpose: "预测连续收益或风险标签", status: "engine", route: "/factor-mining" },
      { name: "Ridge regression", purpose: "稳定高相关特征下的线性估计", status: "engine", route: "/backtests" },
      { name: "Logistic regression", purpose: "输出未来上涨概率", status: "engine", route: "/backtests" },
      { name: "Perceptron", purpose: "演示在线线性分类与错分更新", status: "engine", route: "/backtests" },
      { name: "Probit / GLM", purpose: "为不同标签分布选择连接函数", status: "theory" },
    ],
    workflow: ["标准化仅拟合训练段", "先跑无正则基准", "比较 Ridge/Logistic", "审计系数漂移与概率校准"],
    caseStudy: {
      title: "11 个滞后安全特征的方向分类",
      input: "动量、RSI、ATR、量比和区间位置；每个时点仅使用已完成 K 线。",
      decision: "滚动窗口内重新拟合 Logistic，用冻结的训练缩放参数预测当前 bar，并把概率转成带成本阈值的信号。",
      boundary: "系数稳定不代表关系恒定；窗口、阈值和正则强度都必须样本外复核。",
    },
    checklist: ["缩放器不看未来", "保留截距与基准模型", "检查类别不平衡", "概率阈值包含交易成本"],
    pitfalls: ["全样本标准化", "根据留出集反复调 λ", "把大系数当因果关系"],
    quizzes: [
      { question: "Ridge 的主要作用是什么？", options: ["制造更多特征", "缩小不稳定系数", "保证未来盈利"], answer: 1, reason: "L2 正则通过收缩系数降低方差。" },
      { question: "为什么必须保留简单线性基准？", options: ["它一定最好", "判断复杂度是否带来真实增量", "它不需要数据"], answer: 1, reason: "复杂模型必须证明其样本外增益超过透明基准。" },
    ],
    labKind: "linear",
  },
  {
    id: "generative-latent",
    number: "04",
    title: "生成模型、混合模型与 EM",
    short: "从类别分布到市场状态",
    book: "Murphy Ch.3、Ch.4、Ch.10、Ch.11",
    objective: "理解生成式分类、潜变量、混合分布和 EM 的用途及不可识别性。",
    question: "收益是否来自单一分布，还是由多个不可见市场状态混合而成？",
    concepts: [
      { title: "生成式分类", detail: "分别建模每个类别的数据分布，再通过 Bayes 规则得到类别概率。" },
      { title: "潜变量", detail: "状态或簇不可直接观察，只能从收益、波动和成交等观测反推。" },
      { title: "EM", detail: "在估计隐状态与更新参数之间迭代，但只保证局部改进，不保证全局最优。" },
    ],
    algorithms: [
      { name: "LDA / QDA", purpose: "用类别高斯分布完成判别", status: "lab" },
      { name: "Gaussian mixture", purpose: "识别多峰收益或波动状态", status: "lab" },
      { name: "EM algorithm", purpose: "在隐状态与参数间交替估计", status: "lab" },
      { name: "Mixture of experts", purpose: "让不同状态调用不同预测器", status: "theory" },
      { name: "Bayesian network", purpose: "表达条件依赖与信息传播", status: "theory" },
    ],
    workflow: ["检查分布是否多峰", "设定状态数与初始化", "运行多次 EM", "用时间稳定性解释状态"],
    caseStudy: {
      title: "把收益分成平静期与冲击期",
      input: "日收益、20 日波动和成交量冲击；假设两个高斯状态。",
      decision: "用 GMM 给出每个时点的状态概率，再把它作为仓位或模型切换输入，而不是直接等同于牛熊标签。",
      boundary: "状态编号没有天然语义，且不同初始化可能交换或合并状态。",
    },
    checklist: ["比较不同初始化", "检查状态样本数", "报告软概率而非硬标签", "验证状态的时间持久性"],
    pitfalls: ["把簇编号命名为牛熊后停止验证", "忽略局部最优", "用同一数据选择状态数并报告效果"],
    quizzes: [
      { question: "EM 算法能保证什么？", options: ["全局最优", "每轮不降低目标的局部改进", "状态有经济含义"], answer: 1, reason: "EM 对初始化敏感，只保证局部目标改进。" },
      { question: "GMM 输出更适合作为什么？", options: ["确定的牛熊真相", "状态概率与风险输入", "交易盈利保证"], answer: 1, reason: "潜状态是模型解释，应以概率和不确定性使用。" },
    ],
    labKind: "generative",
  },
  {
    id: "dimension-sparsity",
    number: "05",
    title: "降维、因子与稀疏选择",
    short: "减少噪声、冗余和自由度",
    book: "Murphy Ch.12–Ch.13",
    objective: "掌握 PCA、因子分析、Lasso 和 Elastic Net 的不同问题意识。",
    question: "当特征多、样本少且高度相关时，应该压缩维度还是选择变量？",
    concepts: [
      { title: "PCA", detail: "寻找解释输入方差最大的正交方向，不保证最能预测未来收益。" },
      { title: "因子分析", detail: "把共同变化归因于少量潜因子，并显式保留特有噪声。" },
      { title: "稀疏正则", detail: "Lasso 通过 L1 约束产生零系数；Elastic Net 更适合相关特征组。" },
    ],
    algorithms: [
      { name: "PCA / SVD", purpose: "压缩相关特征与构造风险主轴", status: "lab" },
      { name: "Factor analysis", purpose: "分离共同因子与特有噪声", status: "lab" },
      { name: "Lasso", purpose: "用稀疏系数进行特征选择", status: "lab" },
      { name: "Elastic Net", purpose: "稳定选择相关特征组", status: "lab" },
      { name: "ARD / Sparse Bayes", purpose: "用后验相关性自动收缩变量", status: "theory" },
    ],
    workflow: ["先做相关性和缺失审计", "只在训练段拟合变换", "比较压缩与稀疏路线", "检查选择稳定性"],
    caseStudy: {
      title: "70 个技术特征如何进入因子研究",
      input: "动量、反转、趋势、量价和波动特征高度相关；有效训练样本不足 300。",
      decision: "先按经济机制分组，再比较 PCA 压缩与 Elastic Net；只有跨时间窗口稳定的特征或成分进入候选登记簿。",
      boundary: "PCA 的高解释方差不等于高预测力，Lasso 的入选也不等于因果。",
    },
    checklist: ["变换只拟合训练集", "记录解释方差与预测增量", "检查特征选择频率", "保留经济机制分组"],
    pitfalls: ["全样本 PCA", "只按累计解释方差选维度", "把一次 Lasso 入选当稳定发现"],
    quizzes: [
      { question: "PCA 优先解释的是什么？", options: ["未来收益", "输入数据方差", "交易成本"], answer: 1, reason: "PCA 是无监督降维，不直接使用未来标签。" },
      { question: "高度相关的一组特征更适合先比较什么？", options: ["Elastic Net", "无限加深树", "删除验证集"], answer: 0, reason: "Elastic Net 同时包含 L1 与 L2，更能稳定处理相关变量组。" },
    ],
    labKind: "sparse",
  },
  {
    id: "kernel-uncertainty",
    number: "06",
    title: "核方法与高斯过程",
    short: "用相似性表达非线性与不确定性",
    book: "Murphy Ch.14–Ch.15",
    objective: "理解核函数、SVM、核回归和高斯过程如何通过相似性建模。",
    question: "如果相近市场状态应有相近预测，应该如何定义“相近”？",
    concepts: [
      { title: "核函数", detail: "核把两条样本映射为相似度，长度尺度决定模型关注局部还是全局。" },
      { title: "间隔", detail: "SVM 关注决策边界和支持向量，不天然输出校准概率。" },
      { title: "预测分布", detail: "高斯过程同时给出均值与不确定性，但计算成本随样本数快速上升。" },
    ],
    algorithms: [
      { name: "KNN", purpose: "用局部相似样本投票", status: "engine", route: "/backtests" },
      { name: "Kernel ridge", purpose: "在线性正则框架中加入非线性", status: "lab" },
      { name: "SVM / SVR", purpose: "最大间隔分类与回归", status: "theory" },
      { name: "Gaussian process", purpose: "给出预测均值和后验不确定性", status: "lab" },
      { name: "KDE / local regression", purpose: "用局部邻域估计密度或响应", status: "lab" },
    ],
    workflow: ["定义可解释距离", "训练段选择长度尺度", "检查局部样本密度", "把不确定性转成拒绝或缩量"],
    caseStudy: {
      title: "寻找历史相似行情",
      input: "当前动量、波动、量比和区间位置构成状态向量。",
      decision: "KNN 用最近邻方向投票；GP 或核回归可平滑邻域并报告远离训练样本时的不确定性。",
      boundary: "高维距离会退化；相似历史不等于相同机制。",
    },
    checklist: ["所有维度统一尺度", "距离不含未来标签", "报告邻域密度", "对分布外样本设置拒绝机制"],
    pitfalls: ["忽略维度灾难", "把 SVM 分数当概率", "用验证集直接调核宽度"],
    quizzes: [
      { question: "RBF 核长度尺度过小时通常会怎样？", options: ["模型更平滑", "只记住非常局部的样本", "变成线性模型"], answer: 1, reason: "过小尺度使相似性迅速衰减，容易产生高方差。" },
      { question: "高斯过程相对普通回归的重要优势是什么？", options: ["保证盈利", "提供预测不确定性", "不需要核函数"], answer: 1, reason: "GP 的核心价值是预测分布而不只是点预测。" },
    ],
    labKind: "kernel",
  },
  {
    id: "trees-ensemble",
    number: "07",
    title: "树、Boosting、神经网络与集成",
    short: "非线性、交互与复杂度控制",
    book: "Murphy Ch.16、Ch.28",
    objective: "比较树模型、Boosting、神经网络和集成的表达能力、方差与解释边界。",
    question: "非线性模型发现的交互是否稳定，还是只记住了历史噪声？",
    concepts: [
      { title: "树与森林", detail: "树自动形成阈值和交互；森林通过样本与特征随机化降低方差。" },
      { title: "Boosting", detail: "逐轮修正残差，学习率、轮数和树深共同控制复杂度。" },
      { title: "集成", detail: "只有错误不完全相关时，组合多个模型才可能降低总体误差。" },
    ],
    algorithms: [
      { name: "CART / tree ensemble", purpose: "学习阈值与非线性交互", status: "engine", route: "/backtests" },
      { name: "Random forest", purpose: "用随机化降低单树方差", status: "engine", route: "/backtests" },
      { name: "Gradient boosting", purpose: "逐步拟合残差与复杂非线性", status: "engine", route: "/backtests" },
      { name: "Voting / stacking", purpose: "组合不同模型的预测误差", status: "engine", route: "/backtests" },
      { name: "Neural network", purpose: "学习高维非线性表示", status: "theory" },
    ],
    workflow: ["先胜过线性基准", "限制深度与轮数", "按时间窗口验证", "解释错误相关性与漂移"],
    caseStudy: {
      title: "树模型为何训练很好、未来很差",
      input: "样本 240 条、特征 70 个、树深 8、Boosting 100 轮。",
      decision: "降低深度和学习率、限制候选特征，并用滚动窗口检查交互是否跨市场状态保持。",
      boundary: "重要性排序可能偏向高基数或相关变量，不能替代增量检验。",
    },
    checklist: ["保留线性基准", "记录训练/验证差距", "检查模型错误相关性", "做状态和成本压力测试"],
    pitfalls: ["只看训练准确率", "把特征重要性当因果", "堆叠高度相似模型"],
    quizzes: [
      { question: "Boosting 复杂度主要由哪些因素共同决定？", options: ["颜色与名称", "学习率、轮数和弱学习器深度", "只由样本数"], answer: 1, reason: "三者共同决定拟合速度和容量。" },
      { question: "集成最有价值的前提是什么？", options: ["模型名称不同", "错误不完全相关", "所有模型都过拟合"], answer: 1, reason: "分散预测错误才可能降低组合方差。" },
    ],
    labKind: "ensemble",
  },
  {
    id: "temporal-state",
    number: "08",
    title: "Markov、HMM 与状态空间模型",
    short: "把市场看成动态系统",
    book: "Murphy Ch.17–Ch.18、Ch.23.5",
    objective: "理解状态转移、过滤、平滑和粒子滤波在市场状态估计中的角色。",
    question: "当前波动状态会持续多久？新观测应让我们多大程度改变判断？",
    concepts: [
      { title: "Markov 状态", detail: "下一状态由当前状态和转移矩阵决定，持续性来自对角转移概率。" },
      { title: "过滤与平滑", detail: "过滤只用截至当前的信息；平滑会使用未来观测，只能用于事后解释。" },
      { title: "状态空间", detail: "Kalman 把不可见状态和含噪观测分开，适合动态估计而非静态回归。" },
    ],
    algorithms: [
      { name: "Markov chain", purpose: "描述离散状态持续与切换", status: "lab" },
      { name: "Hidden Markov model", purpose: "从观测反推不可见市场状态", status: "lab" },
      { name: "Kalman filter", purpose: "在线估计线性高斯动态状态", status: "lab" },
      { name: "EKF / UKF", purpose: "处理近似非线性的动态系统", status: "theory" },
      { name: "Particle filter", purpose: "用粒子近似非线性、非高斯后验", status: "theory" },
    ],
    workflow: ["定义状态与观测", "估计转移概率", "只用过滤概率交易", "用平滑结果事后诊断"],
    caseStudy: {
      title: "高波动状态的在线识别",
      input: "昨日状态概率、状态转移矩阵和今日实现波动观测。",
      decision: "先按转移矩阵得到预测概率，再用今日观测更新；仓位依据过滤概率缩放。",
      boundary: "用平滑状态回测会偷看未来；状态数和分布假设需要单独验证。",
    },
    checklist: ["区分过滤与平滑", "报告状态持续期", "检查转移矩阵漂移", "设置状态不确定时的保守动作"],
    pitfalls: ["用未来平滑状态交易", "把状态名称当客观事实", "忽略转移概率随制度变化"],
    quizzes: [
      { question: "实时交易可以使用哪一种状态概率？", options: ["使用未来数据的平滑概率", "截至当前的过滤概率", "完整样本聚类标签"], answer: 1, reason: "过滤只使用当前及过去信息。" },
      { question: "HMM 对角转移概率高说明什么？", options: ["状态更持久", "状态每日必换", "观测无噪声"], answer: 0, reason: "留在原状态的概率较高意味着更长持续期。" },
    ],
    labKind: "regime",
  },
  {
    id: "inference-simulation",
    number: "09",
    title: "变分、Monte Carlo 与 MCMC",
    short: "近似复杂后验与路径风险",
    book: "Murphy Ch.21–Ch.24",
    objective: "区分独立抽样、重要性抽样、MCMC 和变分近似，理解有效样本量与收敛诊断。",
    question: "当后验或风险分布无法解析计算时，近似结果到底有多可靠？",
    concepts: [
      { title: "Monte Carlo", detail: "独立样本下误差按 1/√N 下降；增加十倍精度通常需要百倍样本。" },
      { title: "MCMC", detail: "样本相关会降低有效样本量，链长不等于独立信息量。" },
      { title: "变分推断", detail: "把后验近似变成优化问题，通常更快但可能低估尾部不确定性。" },
    ],
    algorithms: [
      { name: "Importance sampling", purpose: "用提议分布重加权难抽样目标", status: "lab" },
      { name: "Gibbs sampling", purpose: "按条件分布逐变量抽样", status: "lab" },
      { name: "Metropolis-Hastings", purpose: "接受/拒绝提议以逼近目标分布", status: "lab" },
      { name: "Hamiltonian Monte Carlo", purpose: "利用梯度提高高维探索效率", status: "theory" },
      { name: "Variational inference", purpose: "以优化方式逼近复杂后验", status: "theory" },
      { name: "路径 Monte Carlo", purpose: "重排交易、扰动收益并估计尾部风险", status: "engine", route: "/backtest-learning" },
    ],
    workflow: ["明确目标分布", "选择抽样或优化近似", "检查 ESS/收敛/权重退化", "报告尾部分位而非单均值"],
    caseStudy: {
      title: "一万条模拟路径真的有一万份信息吗？",
      input: "MCMC 链长 10,000，滞后 1 自相关 0.8；目标统计量标准差 20%。",
      decision: "有效样本量远小于链长；必须报告 ESS、链间诊断与 Monte Carlo 标准误。",
      boundary: "路径模拟只继承设定的分布和依赖结构，不能生成模型未包含的危机机制。",
    },
    checklist: ["固定随机种子供复现", "报告有效样本量", "检查多链收敛", "对尾部与依赖结构做敏感性分析"],
    pitfalls: ["把链长度当 ESS", "只看模拟均值", "用 iid 重排破坏波动聚集"],
    quizzes: [
      { question: "MCMC 样本高度相关时会怎样？", options: ["ESS 下降", "信息量超过链长", "自动收敛"], answer: 0, reason: "相关样本携带重复信息，有效样本量降低。" },
      { question: "Monte Carlo 标准误通常如何随独立样本数变化？", options: ["与 N 同速增加", "约按 1/√N 下降", "完全不变"], answer: 1, reason: "这是基础 Monte Carlo 收敛速度。" },
    ],
    labKind: "monte",
  },
  {
    id: "discovery-governance",
    number: "10",
    title: "聚类、结构发现与模型治理",
    short: "发现结构，但不把结构误当交易证据",
    book: "Murphy Ch.25–Ch.28 + 量化验证闭环",
    objective: "掌握聚类、图结构、主题与深度表示的研究位置，并建立模型入库、监控和退出规则。",
    question: "无监督算法发现的簇、图或表示，如何证明对后续决策有增量价值？",
    concepts: [
      { title: "聚类稳定性", detail: "簇需要跨样本、跨初始化和跨时间稳定，而不只是图形分离好看。" },
      { title: "结构与因果", detail: "图结构学习发现依赖关系；没有干预和额外假设时不能直接解释为因果。" },
      { title: "模型治理", detail: "每个模型都要有版本、数据契约、基准、失效阈值和退出责任。" },
    ],
    algorithms: [
      { name: "Spectral / hierarchical clustering", purpose: "发现资产或市场状态的相似结构", status: "lab" },
      { name: "Graphical lasso", purpose: "估计稀疏条件依赖网络", status: "theory" },
      { name: "Topic / latent variable models", purpose: "从文本与离散数据发现主题", status: "theory" },
      { name: "Causal DAG learning", purpose: "在强假设下探索方向结构", status: "theory" },
      { name: "Deep representation learning", purpose: "从高维数据学习非线性表示", status: "theory" },
      { name: "候选登记与研究闸门", purpose: "把发现、验证、入库和退出连接起来", status: "engine", route: "/factor-mining" },
    ],
    workflow: ["发现结构", "用外部标签验证增量", "与简单基准比较", "登记版本、漂移和退出规则"],
    caseStudy: {
      title: "资产聚类能否改善组合？",
      input: "基于相关矩阵得到 5 个资产簇；样本内轮廓系数较高。",
      decision: "下一步不是直接等权每簇，而是检验簇稳定性、成本、风险暴露和样本外分散增量。",
      boundary: "漂亮的二维可视化不是组合改进证据，聚类结构也会随市场制度漂移。",
    },
    checklist: ["跨初始化与窗口复核", "比较随机或简单基准", "登记输入与模型版本", "定义漂移、降级与退出门槛"],
    pitfalls: ["把相关图解释为因果图", "用同一数据发现并证明结构", "上线后不监控输入和校准漂移"],
    quizzes: [
      { question: "聚类结果进入组合前最需要补什么证据？", options: ["更漂亮的配色", "样本外稳定性与增量分散效果", "更多簇名称"], answer: 1, reason: "无监督结构必须通过外部决策指标验证。" },
      { question: "图结构中的边是否自动代表因果？", options: ["是", "否，需要额外假设与识别", "只在牛市代表"], answer: 1, reason: "统计依赖不能自动升级为因果关系。" },
    ],
    labKind: "discovery",
  },
];

export const ML_ALGORITHM_COUNT = ML_LESSONS.reduce((total, lesson) => total + lesson.algorithms.length, 0);
