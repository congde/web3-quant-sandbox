import type { MLAlgorithm, MLLesson } from "./MachineLearningCurriculum";

export type MLPracticeProfile = {
  dataContract: string;
  outputContract: string;
  baseline: string;
  parameters: string[];
  evaluation: string[];
  stressTests: string[];
  derivation: string[];
  pseudocode: string[];
  acceptance: string;
};

type FamilyProfile = Omit<MLPracticeProfile, "parameters" | "pseudocode"> & { pseudocode: (name: string) => string[] };

const FAMILY: Record<MLLesson["labKind"], FamilyProfile> = {
  contract: {
    dataContract: "带决策时点、特征可用时点和未来标签窗口的时间索引样本；标签、成本与持有期必须在看结果前冻结。",
    outputContract: "训练目标、折外预测或横截面分数，以及能映射到真实决策损失的样本外评价。",
    baseline: "不交易、历史均值/多数类、简单线性分数，以及不调参的固定规则。",
    evaluation: ["purged walk-forward 的折外损失", "成本后效用或排序增量", "跨时间折方差与最差折"],
    stressTests: ["标签窗口和持有期扰动", "手续费与滑点加倍", "最终留出集只使用一次"],
    derivation: ["先定义行动及错误代价，而不是先选模型。", "把每条历史决策的代价写成损失 L。", "对可用样本求平均，得到经验风险。", "用时间样本外风险判断训练目标是否能泛化。"],
    pseudocode: (name) => ["dataset = freeze_asof(features, label, horizon, costs)", "for train, valid in purged_walk_forward(dataset):", `    model = fit("${name}", train)`, "    pred  = model.predict(valid.features_asof)", "    save(evaluate(pred, valid.label, costs=True))", "accept_only_if(all_folds_beat_frozen_baseline)"],
    acceptance: "只有在多数时间折优于冻结基准、最差折可接受且成本压力后仍保留增量，才能进入下一研究阶段。",
  },
  bayes: {
    dataContract: "事件、证据和发生时点；明确先验来自哪段历史，并保证每项证据在决策时已经可见。",
    outputContract: "后验概率、可信区间、模型证据或由模拟得到的统计量分布，而不是孤立点估计。",
    baseline: "基础发生率、共轭解析后验或不使用新增证据的先验预测。",
    evaluation: ["log loss / Brier score", "可靠性曲线与校准误差", "后验预测检查或区间覆盖率"],
    stressTests: ["更换合理先验", "按市场状态重做校准", "移除高度相关证据"],
    derivation: ["用先验表达观察数据前的不确定性。", "写出当前数据在参数给定时的似然。", "用 Bayes 规则得到后验或其抽样近似。", "将后验预测而非参数点估计带入决策。"],
    pseudocode: (name) => ["prior = fit_prior(history_before_cutoff)", "for train, valid in walk_forward(events):", `    posterior = infer("${name}", prior, train)`, "    prob, interval = posterior_predict(valid.features_asof)", "    save(calibration_and_decision_value(prob, interval))", "    prior = update_without_using_future(valid)"],
    acceptance: "概率必须在未参与调参的时间段保持校准，并且相对基础发生率在决策损失上有稳定增量。",
  },
  linear: {
    dataContract: "按决策时点冻结的表格特征与连续/二元标签；缺失处理、缩放器和类别权重只能在训练段拟合。",
    outputContract: "连续预测、事件概率或线性分数，同时报告系数、校准和折间漂移。",
    baseline: "截距模型、单因子模型和带相同数据处理的简单 Ridge/Logistic。",
    evaluation: ["回归 MAE/IC 或分类 log loss/AUC", "成本后分组收益与换手", "系数符号和选择频率稳定性"],
    stressTests: ["滚动缩放与全样本缩放对照", "删除一组高度相关特征", "正则强度与阈值邻域扰动"],
    derivation: ["用线性预测子把特征贡献相加。", "依据标签分布选择损失或连接函数。", "最小化损失并在需要时加入收缩。", "把预测分数经过校准和成本阈值转换为行动。"],
    pseudocode: (name) => ["for train, valid in purged_walk_forward(dataset):", "    scaler = fit_scaler(train.X)", "    params = tune_on_inner_time_splits(train)", `    model  = fit("${name}", scaler(train.X), train.y, params)`, "    pred   = model.predict(scaler(valid.X_asof))", "    save(metrics_and_costed_portfolio(pred, valid.y))"],
    acceptance: "必须击败截距和简单正则线性基准；系数、概率校准与成本后增量需在多折同时成立。",
  },
  generative: {
    dataContract: "冻结时点的观测向量、可能的类别标签以及对缺失值的显式处理；状态数量不得根据最终结果命名。",
    outputContract: "类别后验、潜状态概率、生成密度或条件专家权重，并保留不确定性。",
    baseline: "单一分布、单状态模型、K-means 或不使用潜变量的判别模型。",
    evaluation: ["留出对数似然/预测密度", "状态占比与持续期稳定性", "状态输入带来的下游增量"],
    stressTests: ["多次随机初始化", "状态数加减一", "删除极端样本并检查标签交换"],
    derivation: ["假设观测由类别或潜状态生成。", "将联合分布分解为先验与条件分布。", "对不可见状态求和或计算后验责任度。", "用软概率而非事后硬命名进入决策。"],
    pseudocode: (name) => ["X = freeze_and_scale(observations_asof)", "for train, valid in walk_forward(X):", "    candidates = []", `    for seed in fixed_seeds: candidates += fit("${name}", train, seed)`, "    model = choose_by_train_likelihood_and_stability(candidates)", "    state_prob = model.filter(valid)", "    save(density_and_downstream_increment(state_prob))"],
    acceptance: "潜状态需跨初始化和时间窗口可复现，并且软状态概率必须为外部决策指标带来样本外增量。",
  },
  sparse: {
    dataContract: "高维候选特征、完整生成时点、特征族标签与训练段内拟合的缩放/缺失处理。",
    outputContract: "低维成分、因子载荷或稀疏系数，并报告跨折选择频率和表示漂移。",
    baseline: "原始特征简单平均、单因子模型、Ridge，以及不降维的同类预测器。",
    evaluation: ["样本外预测/排序增量", "选择频率与主轴夹角稳定性", "压缩率、换手和维护成本"],
    stressTests: ["特征分组删除", "正则强度邻域", "滚动窗口与训练长度变化"],
    derivation: ["先量化特征冗余与有效样本量。", "选择压缩方差、解释共同因子或稀疏预测目标。", "只在训练段估计变换或惩罚参数。", "用折外预测和跨窗稳定性验收表示。"],
    pseudocode: (name) => ["features = register_feature_families(X_asof)", "for train, valid in purged_walk_forward(features):", "    transform = fit_preprocess(train)", `    model = tune_and_fit("${name}", transform(train.X), train.y)`, "    representation = model.transform_or_predict(transform(valid.X))", "    save(increment_and_selection_stability(representation))"],
    acceptance: "降维或稀疏化必须在相同时间折击败简单 Ridge/不变换基准，并保持成分或选择结果稳定。",
  },
  kernel: {
    dataContract: "经过训练段缩放的中小样本特征、明确定义的距离/核，以及与决策时点一致的标签。",
    outputContract: "局部预测、核分数、密度或带区间的后验预测，并记录与训练样本的距离。",
    baseline: "线性 Ridge/Logistic、历史均值和简单最近邻。",
    evaluation: ["折外误差或预测对数密度", "概率/区间校准", "陌生区域拒绝率与成本后增量"],
    stressTests: ["带宽或长度尺度成倍扰动", "更换距离度量", "降低样本密度与扩大时间间隔"],
    derivation: ["先定义两个市场样本何时算相似。", "用距离、核或协方差函数表达相似性。", "由邻域加权或核展开得到预测。", "用陌生度和预测不确定性限制外推。"],
    pseudocode: (name) => ["for train, valid in purged_walk_forward(dataset):", "    metric = fit_distance_and_scaler(train.X)", "    params = tune_length_scale_on_inner_time(train)", `    model = fit("${name}", metric(train.X), train.y, params)`, "    pred, uncertainty = predict_with_distance_guard(model, valid.X)", "    save(metrics_calibration_and_rejection(pred, uncertainty))"],
    acceptance: "模型需在多个长度尺度附近保持增量；远离训练支持集时必须扩大区间或拒绝预测。",
  },
  ensemble: {
    dataContract: "冻结时点的表格/高维特征、标签和模型版本；所有早停与组合权重只能使用训练内部折。",
    outputContract: "树/网络分数、概率或集成预测，并报告特征/模型贡献、校准与复杂度。",
    baseline: "浅树、正则线性模型和单一最佳基础模型。",
    evaluation: ["时间折外预测指标", "成本后净值与容量", "校准、特征消融和误差相关性"],
    stressTests: ["深度/轮数邻域", "特征族遮蔽", "高波动和低流动性分段"],
    derivation: ["先建立透明线性和浅树基准。", "让弱模型学习阈值、交互或残差。", "用袋装、提升或折外堆叠降低误差。", "通过消融与时间外压力验证复杂度价值。"],
    pseudocode: (name) => ["for train, valid in purged_walk_forward(dataset):", "    baseline = fit_frozen_linear_baseline(train)", "    params = tune_complexity_on_inner_time(train)", `    model = fit("${name}", train, params, early_stop=True)`, "    pred = calibrate_on_training_only(model, valid.X_asof)", "    save(compare_with_baseline_after_costs(pred, valid.y))"],
    acceptance: "复杂模型必须稳定超过透明基准，且消融后能解释增量来源；收益不能只来自单一状态或极少样本。",
  },
  regime: {
    dataContract: "严格按时间排列的观测序列、采样频率、状态/观测噪声假设；明确实时过滤还是事后平滑。",
    outputContract: "转移概率、过滤状态概率、连续状态估计与协方差，禁止把事后平滑结果冒充实时信号。",
    baseline: "静态均值、独立 GMM、移动平均或单状态模型。",
    evaluation: ["一步预测对数似然", "状态概率/区间校准", "切换时滞与下游风控增量"],
    stressTests: ["噪声协方差成倍变化", "状态数/粒子数变化", "冲击期与平稳期分段"],
    derivation: ["定义不可见状态如何随时间演化。", "定义状态如何产生当前观测。", "执行预测，再用新观测进行更新。", "只用过滤分布评估实时决策价值。"],
    pseudocode: (name) => ["model_spec = freeze_state_and_observation_equations()", "for t in chronological_stream:", `    prior_state = predict_state("${name}", posterior_state)`, "    posterior_state = update_with_observation(prior_state, y[t])", "    decision = policy(posterior_state.available_at_t)", "    save_one_step_forecast_and_latency(decision)"],
    acceptance: "实时过滤概率必须在未见时间段改善一步预测或风控，并报告切换滞后、状态不确定性与参数漂移。",
  },
  monte: {
    dataContract: "目标分布或路径生成机制、随机种子、模拟次数和与历史依赖一致的抽样单位；所有假设需要可追溯。",
    outputContract: "后验样本、路径指标分布、分位数、Monte Carlo 标准误和有效样本量。",
    baseline: "解析结果（若存在）、独立直接抽样或不扰动的原始路径。",
    evaluation: ["Monte Carlo 标准误 / ESS", "多链 R-hat 与自相关", "尾部分位数跨种子稳定性"],
    stressTests: ["模拟次数翻倍", "不同随机种子与初值", "替换路径生成/提议分布"],
    derivation: ["把目标量写成某分布下的期望或分位数。", "设计能覆盖目标支持集的抽样机制。", "生成样本并按需要加权或形成马尔可夫链。", "报告数值误差、收敛和模型假设敏感性。"],
    pseudocode: (name) => ["target = freeze_target_distribution_and_path_rules()", "samples = []", "for seed in registered_seeds:", `    draws = sample("${name}", target, n=N, seed=seed)`, "    diagnostics = convergence_ess_and_mcse(draws)", "    samples += keep_only_after_registered_warmup(draws)", "report(distribution_metrics(samples), diagnostics)"],
    acceptance: "只有多种子/多链诊断通过、模拟次数翻倍结论稳定且关键尾部对合理假设不过度敏感，才可用于决策。",
  },
  discovery: {
    dataContract: "冻结时间窗口的相似矩阵、文本或高维表示；记录距离、图构造、预处理和候选发现次数。",
    outputContract: "簇、图边、主题、表示或候选登记记录；无监督结构必须连接独立外部评价。",
    baseline: "随机结构、简单相关/K-means、原始特征和不使用发现结果的组合。",
    evaluation: ["跨窗口/初始化一致性", "独立外部标签或组合增量", "发现率、重复率和退出率"],
    stressTests: ["距离/图阈值扰动", "窗口与样本宇宙变化", "随机基准和负面对照"],
    derivation: ["冻结发现空间和相似/生成假设。", "在不看最终收益的情况下发现结构。", "把结构转为预先定义的候选特征或约束。", "用独立时间段和外部决策指标验证增量。"],
    pseudocode: (name) => ["discovery, validation = chronological_split(raw_data)", "representation = fit_preprocess(discovery_only)", `structure = fit("${name}", representation, registered_params)`, "candidate = translate_without_using_validation_returns(structure)", "evidence = test_external_increment(candidate, validation)", "registry.save(candidate, evidence, failures=True)"],
    acceptance: "结构必须跨窗口和初始化复现，并在完全独立的数据上改善预先登记的外部指标，才可登记为候选。",
  },
};

const PARAMETERS: Record<string, string[]> = {
  "经验风险最小化 ERM": ["损失函数 L", "标签预测期 horizon", "样本/类别权重"],
  "正则化风险最小化": ["正则强度 λ", "复杂度函数 Ω", "内部验证折数"],
  "时间序列交叉验证": ["训练窗口", "验证窗口", "purge / embargo 长度"],
  "学习排序": ["成对/列表损失", "排序间隔", "每期候选数与头尾比例"],
  "Beta-Binomial": ["先验 α、β", "成功事件定义", "更新窗口/遗忘因子"],
  "朴素贝叶斯": ["类别先验", "条件分布族", "平滑强度"],
  "Bayes factor": ["模型先验概率", "参数先验尺度", "候选与基准模型"],
  "Bootstrap": ["重采样次数 B", "block 长度", "置信区间构造方法"],
  "基础 Monte Carlo": ["模拟次数 N", "输入分布", "方差缩减方法"],
  "Linear regression": ["特征集合", "损失/稳健误差", "截距与缩放方式"],
  "Ridge regression": ["L2 强度 λ", "特征缩放", "训练窗口"],
  "Logistic regression": ["正则强度", "类别权重", "概率阈值/校准器"],
  "Perceptron": ["学习率 η", "迭代轮数", "权重平均方式"],
  "Probit / GLM": ["响应分布族", "连接函数 g", "正则与离散参数"],
  "LDA / QDA": ["共享/分组协方差", "协方差收缩", "类别先验"],
  "Gaussian mixture": ["成分数 K", "协方差结构", "初始化与最小成分权重"],
  "EM algorithm": ["初始化", "收敛容差", "最大迭代与多启动次数"],
  "Mixture of experts": ["专家数量", "门控温度/正则", "专家模型复杂度"],
  "Bayesian network": ["图结构先验", "条件概率族", "结构搜索/评分方法"],
  "PCA / SVD": ["保留成分数", "中心化/缩放", "滚动训练窗口"],
  "Factor analysis": ["因子数", "特有噪声结构", "旋转方式"],
  "Lasso": ["L1 强度 λ", "特征缩放", "最大非零变量数"],
  "Elastic Net": ["总体正则强度", "L1/L2 混合比例", "特征缩放"],
  "ARD / Sparse Bayes": ["权重精度先验", "噪声精度先验", "收敛与剪枝阈值"],
  "KNN": ["邻居数 k", "距离度量", "距离加权方式"],
  "Kernel ridge": ["核函数", "长度尺度/核参数", "L2 强度 λ"],
  "SVM / SVR": ["惩罚 C", "核与核参数", "间隔/ε 不敏感带"],
  "Gaussian process": ["均值函数", "核与长度尺度", "观测噪声"],
  "KDE / local regression": ["核函数", "带宽 h", "局部多项式阶数"],
  "CART / tree ensemble": ["最大深度", "最小叶样本", "剪枝/特征数"],
  "Random forest": ["树数量 B", "每次候选特征数", "叶节点最小样本"],
  "Gradient boosting": ["学习率 η", "树深度", "迭代轮数/早停"],
  "Voting / stacking": ["基础模型集合", "组合权重/二层模型", "折外预测方案"],
  "Neural network": ["网络深度与宽度", "学习率/批量", "正则、dropout 与早停"],
  "Markov chain": ["状态定义/数量", "转移矩阵平滑", "估计窗口"],
  "Hidden Markov model": ["状态数", "发射分布", "转移先验与初始化"],
  "Kalman filter": ["状态转移 F", "过程噪声 Q", "观测噪声 R"],
  "EKF / UKF": ["非线性 f、h", "Jacobian / sigma-point 参数", "Q 与 R"],
  "Particle filter": ["粒子数", "提议分布", "ESS 重采样阈值"],
  "Importance sampling": ["提议分布 q", "样本数", "权重截断/稳定化"],
  "Gibbs sampling": ["更新分块", "warm-up", "链数与保留间隔"],
  "Metropolis-Hastings": ["提议分布", "提议步长", "warm-up 与链数"],
  "Hamiltonian Monte Carlo": ["步长", "leapfrog 步数/轨迹长度", "质量矩阵"],
  "Variational inference": ["近似分布族 q", "优化器/学习率", "ELBO 样本数"],
  "路径 Monte Carlo": ["路径数", "重排/分块规则", "持有期与风险线"],
  "Spectral / hierarchical clustering": ["相似度/距离", "簇数", "图邻居数或 linkage"],
  "Graphical lasso": ["稀疏强度 λ", "协方差估计窗口", "边稳定性阈值"],
  "Topic / latent variable models": ["主题数", "Dirichlet 先验", "词表与迭代次数"],
  "Causal DAG learning": ["背景知识约束", "独立性检验/评分", "显著性与搜索限制"],
  "Deep representation learning": ["表示维度", "预训练目标", "学习率、正则与早停"],
  "候选登记与研究闸门": ["预登记验收阈值", "允许试验次数", "漂移/退出门槛"],
};

export function getAlgorithmPractice(algorithm: MLAlgorithm, lesson: MLLesson): MLPracticeProfile {
  const family = FAMILY[lesson.labKind];
  return {
    ...family,
    parameters: PARAMETERS[algorithm.name] ?? ["模型复杂度", "训练窗口", "决策阈值"],
    pseudocode: family.pseudocode(algorithm.name),
  };
}

export const ML_PRACTICE_PARAMETER_COUNT = Object.keys(PARAMETERS).length;
