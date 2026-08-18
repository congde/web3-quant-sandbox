import type { FormulaDomain, FormulaGroup } from "./FormulaHandbook";

export const ADVANCED_GROUPS: Record<FormulaDomain, FormulaGroup[]> = {
  kline: [],
  math: [
    {
      title: "数学工具与缩放",
      description: "补齐量化建模常用的百分比、加权、标准化和边际变化工具。",
      formulas: [
        { name: "百分比变化", equation: "Δ% = (X新 − X旧) / |X旧| × 100%", purpose: "把绝对变化转换为相对原值的变化幅度。", variables: ["X旧：基准值", "X新：新值", "Δ%：百分比变化"], example: "成交量从 80 增至 100：变化率为 25%。", boundary: "基准值为 0 时无定义；负基准需要明确业务含义。" },
        { name: "加权平均", equation: "x̄w = Σᵢwᵢxᵢ / Σᵢwᵢ", purpose: "按重要性、规模或时间衰减计算平均值。", variables: ["xᵢ：观测值", "wᵢ：非负权重", "x̄w：加权均值"], example: "价格 100/110，成交量权重 1/3：加权均价为 107.5。", boundary: "权重来源必须可解释，负权重时不再是普通平均。" },
        { name: "Z-score 标准化", equation: "z = (x − μ) / σ", purpose: "用标准差单位表达观测值偏离均值的程度。", variables: ["x：当前值", "μ：均值", "σ：标准差", "z：标准分数"], example: "均值 100、标准差 5、当前 110：z = 2。", boundary: "分布偏斜或厚尾时，z=2 不等于固定异常概率。" },
        { name: "弹性", equation: "Elasticity = (ΔY/Y) / (ΔX/X)", purpose: "衡量 X 相对变化 1% 时 Y 相对变化多少。", variables: ["ΔX/X：解释变量相对变化", "ΔY/Y：结果变量相对变化"], example: "资金费率涨 10%，持仓量涨 5%：局部弹性约 0.5。", boundary: "只描述指定区间的敏感度，不能直接推断因果。" },
      ],
    },
    {
      title: "概率分布与贝叶斯",
      description: "从离散事件到连续分布，并学习新证据出现后如何更新判断。",
      formulas: [
        { name: "贝叶斯公式", equation: "P(A|B) = P(B|A)P(A) / P(B)", purpose: "把先验概率和新证据结合为后验概率。", variables: ["P(A)：先验", "P(B|A)：似然", "P(A|B)：后验"], example: "信号历史命中率与当前特征似然共同更新上涨概率。", boundary: "先验和似然若估计偏差，后验仍会误导。" },
        { name: "伯努利分布", equation: "P(X=x) = pˣ(1−p)^(1−x)，x∈{0,1}", purpose: "描述一次只有成功或失败的随机试验。", variables: ["p：成功概率", "x：0 或 1", "E[X]=p"], example: "一笔交易盈利记 1、亏损记 0，可用伯努利变量表示。", boundary: "交易结果通常并非独立且成功概率会随市场变化。" },
        { name: "二项分布", equation: "P(X=k) = C(n,k)pᵏ(1−p)^(n−k)", purpose: "计算 n 次独立试验中恰好成功 k 次的概率。", variables: ["n：试验次数", "k：成功次数", "p：单次成功概率"], example: "胜率 50% 的策略，10 笔中恰好 5 笔盈利的概率约 24.6%。", boundary: "要求试验独立且 p 固定，真实交易常不满足。" },
        { name: "正态分布密度", equation: "f(x)=exp[−(x−μ)²/(2σ²)] / (σ√(2π))", purpose: "描述由均值和标准差决定的对称钟形分布。", variables: ["μ：位置参数", "σ：尺度参数", "f(x)：概率密度"], example: "正态假设下约 95% 观测位于 μ±1.96σ。", boundary: "金融收益常有偏度和厚尾，极端风险会被低估。" },
      ],
    },
    {
      title: "统计推断",
      description: "区分样本统计量与总体结论，量化估计误差和显著性。",
      formulas: [
        { name: "均值标准误", equation: "SE(x̄) = s / √n", purpose: "估计样本均值因抽样变化产生的不确定程度。", variables: ["s：样本标准差", "n：样本数", "SE：标准误"], example: "标准差 10%、样本 100 个：均值标准误约 1%。", boundary: "序列自相关会降低有效样本数，使普通标准误偏小。" },
        { name: "均值置信区间", equation: "CI = x̄ ± t* × SE(x̄)", purpose: "给出总体均值的区间估计。", variables: ["x̄：样本均值", "t*：临界值", "SE：标准误"], example: "均值 2%、SE 0.5%、95% 临界值约 1.96：区间约 [1.02%,2.98%]。", boundary: "置信区间不表示总体均值有 95% 概率落入已算出的固定区间。" },
        { name: "t 统计量", equation: "t = (x̄ − μ₀) / SE(x̄)", purpose: "检验样本均值与假设值 μ₀ 的差异相对噪声有多大。", variables: ["μ₀：原假设均值", "x̄：样本均值", "SE：标准误"], example: "超额收益均值 1%、SE 0.4%：检验零均值时 t=2.5。", boundary: "多次试验挑最好结果会放大假阳性，需要多重检验修正。" },
        { name: "有效样本量", equation: "Neff ≈ n × (1−ρ₁)/(1+ρ₁)", purpose: "粗略修正一阶自相关导致的信息重复。", variables: ["n：名义样本数", "ρ₁：一阶自相关", "Neff：有效样本量"], example: "n=100、ρ₁=0.5：有效样本量约 33。", boundary: "这是 AR(1) 近似；复杂自相关应使用 HAC 或区块自助法。" },
      ],
    },
    {
      title: "回归与因子",
      description: "把收益拆成市场暴露、因子贡献和无法解释的残差。",
      formulas: [
        { name: "一元 OLS 斜率", equation: "β = Cov(X,Y) / Var(X)", purpose: "估计 X 每变化一单位时 Y 的平均线性变化。", variables: ["X：解释变量", "Y：被解释变量", "β：回归斜率"], example: "资产与市场协方差 0.018、市场方差 0.015：β=1.2。", boundary: "遗漏变量、内生性和非线性都会破坏因果解释。" },
        { name: "回归截距", equation: "α = ȳ − βx̄", purpose: "计算在线性模型中无法由 X 平均水平解释的部分。", variables: ["ȳ、x̄：样本均值", "β：斜率", "α：截距"], example: "因子模型中 α 常被解释为控制暴露后的平均超额收益。", boundary: "显著 α 可能来自遗漏因子、数据挖掘或成本遗漏。" },
        { name: "决定系数", equation: "R² = 1 − Σeᵢ² / Σ(yᵢ−ȳ)²", purpose: "衡量模型解释了 Y 样本波动的比例。", variables: ["eᵢ：残差", "yᵢ：实际值", "R²：拟合优度"], example: "R²=0.6 表示样本内约 60% 波动被模型解释。", boundary: "高 R² 不代表有预测能力，更不代表因果正确。" },
        { name: "多因子收益", equation: "Rₜ = α + ΣⱼβⱼFⱼ,ₜ + εₜ", purpose: "把资产收益分解为多个因子暴露和特异收益。", variables: ["Fⱼ：第 j 个因子收益", "βⱼ：因子暴露", "εₜ：残差"], example: "市场、动量、规模和链上流动性可作为候选因子。", boundary: "因子定义、可交易性和样本外稳定性必须单独验证。" },
      ],
    },
    {
      title: "时间序列",
      description: "处理金融数据的顺序依赖、趋势、均值回归和动态波动。",
      formulas: [
        { name: "滞后差分", equation: "ΔXₜ = Xₜ − Xₜ₋₁", purpose: "把水平序列转换为一期变化量。", variables: ["Xₜ：当前值", "Xₜ₋₁：滞后一期值", "ΔXₜ：差分"], example: "价格差分是绝对变化，对数价格差分是对数收益。", boundary: "过度差分会丢失长期关系，差分前应检查序列性质。" },
        { name: "自相关", equation: "ρₖ = Cov(Xₜ,Xₜ₋ₖ) / Var(Xₜ)", purpose: "衡量序列与自身 k 期滞后值的线性相关。", variables: ["k：滞后阶数", "ρₖ：k 阶自相关"], example: "收益 ρ₁<0 可能表现短期反转，>0 可能表现短期延续。", boundary: "显著自相关可能来自微观结构、非同步成交或多重检验。" },
        { name: "AR(1) 模型", equation: "Xₜ = c + φXₜ₋₁ + εₜ", purpose: "用上一期值描述当前值的线性动态。", variables: ["c：常数", "φ：持续性参数", "εₜ：创新项"], example: "|φ|<1 时冲击逐步衰减，序列倾向回归长期均值。", boundary: "参数会随市场状态变化，残差也可能存在异方差。" },
        { name: "EWMA 均值", equation: "Mₜ = λXₜ + (1−λ)Mₜ₋₁", purpose: "给予近期观测更高权重的递推平均。", variables: ["λ：更新速度", "Xₜ：当前观测", "Mₜ：平滑值"], example: "λ 越大，均值对最新价格变化越敏感。", boundary: "λ 是模型选择，不能根据回测最佳结果无限调参。" },
        { name: "EWMA 方差", equation: "σₜ² = λrₜ₋₁² + (1−λ)σₜ₋₁²", purpose: "让近期大波动更快影响当前风险估计。", variables: ["rₜ₋₁：上一期收益", "λ：新信息权重", "σₜ²：条件方差"], example: "市场剧烈波动后，EWMA 风险会快速升高并逐步衰减。", boundary: "单一衰减率不能完整描述非对称波动和跳跃。" },
      ],
    },
    {
      title: "技术指标",
      description: "把常见指标还原为明确计算，区分价格事实与二次变换。",
      formulas: [
        { name: "简单移动平均", equation: "SMAₙ(t) = Σᵢ₌₀ⁿ⁻¹ Pₜ₋ᵢ / n", purpose: "计算最近 n 期价格的等权平均。", variables: ["Pₜ₋ᵢ：历史价格", "n：窗口长度"], example: "5 日 SMA 是最近 5 个收盘价的平均值。", boundary: "它天然滞后，窗口是研究假设而不是市场真理。" },
        { name: "指数移动平均", equation: "EMAₜ = αPₜ + (1−α)EMAₜ₋₁，α=2/(n+1)", purpose: "让近期价格拥有更高权重。", variables: ["α：平滑系数", "n：名义周期", "Pₜ：当前价格"], example: "n=9 时 α=0.2，当前价格权重为 20%。", boundary: "初始化方法会影响早期值，不同平台口径可能不同。" },
        { name: "RSI", equation: "RSI = 100 − 100/(1 + AvgGain/AvgLoss)", purpose: "比较窗口内平均上涨和平均下跌强度。", variables: ["AvgGain：平均上涨", "AvgLoss：平均下跌绝对值"], example: "平均上涨为平均下跌两倍时，RSI 约 66.7。", boundary: "超买不等于立刻下跌，强趋势中 RSI 可长期处于高位。" },
        { name: "真实波幅 ATR", equation: "TRₜ=max(H−L,|H−C₋₁|,|L−C₋₁|)，ATR=MA(TR)", purpose: "同时考虑日内振幅与跨期跳空。", variables: ["H/L：最高/最低", "C₋₁：前收盘", "TR：真实波幅"], example: "ATR 可用于按当前波动调整止损距离和仓位。", boundary: "ATR 是价格单位，跨资产比较时通常要除以价格。" },
        { name: "布林带", equation: "Upper/Lower = SMAₙ ± kσₙ", purpose: "用滚动均值和标准差构造动态价格区间。", variables: ["SMAₙ：滚动均值", "σₙ：滚动标准差", "k：带宽倍数"], example: "常见设置 n=20、k=2，但必须在样本外检验。", boundary: "价格越过带宽不是独立买卖信号，正态覆盖率假设通常不成立。" },
      ],
    },
    {
      title: "组合优化",
      description: "从矩阵风险、最小方差到风险贡献和增长最优仓位。",
      formulas: [
        { name: "矩阵组合方差", equation: "σp² = wᵀΣw", purpose: "用协方差矩阵计算多资产组合总方差。", variables: ["w：权重向量", "Σ：协方差矩阵", "wᵀ：转置"], example: "该式同时包含单资产方差和所有成对协方差。", boundary: "协方差估计误差会被优化器放大，通常需要收缩或约束。" },
        { name: "全局最小方差权重", equation: "wGMV = Σ⁻¹1 / (1ᵀΣ⁻¹1)", purpose: "在权重和为 1 时寻找理论方差最小组合。", variables: ["Σ⁻¹：协方差逆矩阵", "1：全 1 向量"], example: "低波动、低相关资产通常获得更高权重。", boundary: "允许卖空时可能出现极端权重；矩阵病态时结果不稳定。" },
        { name: "风险贡献", equation: "RCᵢ = wᵢ(Σw)ᵢ / σp", purpose: "计算资产 i 对组合波动率的边际贡献。", variables: ["(Σw)ᵢ：边际协方差", "wᵢ：权重", "σp：组合波动"], example: "等权组合通常不是等风险组合，高波动资产贡献更大。", boundary: "基于波动的风险贡献不覆盖流动性和跳跃风险。" },
        { name: "Kelly 比例", equation: "f* = p − (1−p)/b", purpose: "在简化二项收益下最大化长期对数财富增长。", variables: ["p：胜率", "b：净赔率", "f*：理论资金比例"], example: "胜率 55%、赔率 1:1：Kelly 比例为 10%。", boundary: "参数误差会导致过度下注，实践中常使用半 Kelly 或更低。" },
      ],
    },
    {
      title: "执行与 Web3",
      description: "覆盖成交价格、点差、永续资金费、基差和 AMM 定价。",
      formulas: [
        { name: "中间价与相对点差", equation: "Mid=(Ask+Bid)/2，Spread%=(Ask−Bid)/Mid", purpose: "用买卖一档报价衡量即时交易摩擦。", variables: ["Ask：最优卖价", "Bid：最优买价", "Mid：中间价"], example: "卖 101、买 99：中间价 100，相对点差 2%。", boundary: "一档点差不反映订单深度，大额成交还会产生冲击。" },
        { name: "VWAP", equation: "VWAP = ΣᵢPᵢQᵢ / ΣᵢQᵢ", purpose: "按成交量加权计算一段时间的平均成交价格。", variables: ["Pᵢ：成交价", "Qᵢ：成交量"], example: "可用于评估订单成交价相对市场成交重心的偏离。", boundary: "VWAP 是事后基准，不保证当时所有成交量都可被策略获得。" },
        { name: "永续资金费损益", equation: "FundingPnL = −Direction × Notional × FundingRate", purpose: "计算永续合约资金费对多空持仓的现金影响。", variables: ["Direction：多头 +1/空头 −1", "Notional：名义金额", "FundingRate：资金费率"], example: "多头 100,000、费率 +0.01%：支付 10。", boundary: "交易所结算频率、标记价格和费率上限必须按实际规则处理。" },
        { name: "期货基差年化", equation: "BasisAnn = (F−S)/S × 365/T", purpose: "把期货相对现货溢折价换算为简单年化基差。", variables: ["F：期货价格", "S：现货价格", "T：到期天数"], example: "90 天期货溢价 3%：简单年化基差约 12.17%。", boundary: "忽略复利、资金、借币、保证金和交割成本。" },
        { name: "恒定乘积 AMM", equation: "x × y = k，PriceX = y/x", purpose: "描述基础恒定乘积池的储备与边际价格关系。", variables: ["x、y：两种代币储备", "k：不变量"], example: "买入 X 会减少 x、增加 y，从而抬高 X 的池内边际价格。", boundary: "真实协议还包含手续费、集中流动性、离散 tick 和路由。" },
      ],
    },
    {
      title: "微积分与线性代数",
      description: "理解连续变化、梯度、矩阵运算和主成分，是优化与多因子模型的数学底座。",
      formulas: [
        { name: "导数", equation: "f′(x) = lim(h→0)[f(x+h)−f(x)]/h", purpose: "度量函数在某一点的瞬时变化率。", variables: ["f(x)：目标函数", "h：微小变化", "f′(x)：局部斜率"], example: "价格变化 1 单位时组合价值的局部变化可用一阶导数近似。", boundary: "跳跃、不连续或不可微的交易规则不能直接使用普通导数。" },
        { name: "二阶泰勒近似", equation: "f(x+Δx) ≈ f(x)+f′(x)Δx+½f″(x)Δx²", purpose: "用一阶和二阶敏感度近似小幅变化后的函数值。", variables: ["f′：一阶敏感度", "f″：曲率", "Δx：变量变化"], example: "期权价值可用 Delta 与 Gamma 近似小幅标的价格变化。", boundary: "变化过大或高阶效应显著时近似误差快速上升。" },
        { name: "梯度", equation: "∇f = (∂f/∂x₁,…,∂f/∂xₙ)ᵀ", purpose: "汇总多变量目标对各输入的局部敏感度。", variables: ["∂f/∂xᵢ：偏导数", "∇f：最陡上升方向"], example: "组合优化用梯度调整多项资产权重以降低目标函数。", boundary: "梯度法可能停在局部最优，并依赖尺度和学习率。" },
        { name: "矩阵乘法", equation: "Cᵢⱼ = ΣₖAᵢₖBₖⱼ", purpose: "统一表达多资产、多因子和协方差运算。", variables: ["A、B：维度匹配矩阵", "C：乘积矩阵"], example: "因子暴露矩阵乘因子收益向量得到资产解释收益。", boundary: "必须检查维度、排序和单位，矩阵可乘不代表经济含义正确。" },
        { name: "特征值分解", equation: "Σvᵢ = λᵢvᵢ", purpose: "寻找协方差矩阵的主风险方向及其方差大小。", variables: ["Σ：协方差矩阵", "vᵢ：特征向量", "λᵢ：特征值"], example: "最大特征值对应组合中最主要的共同风险方向。", boundary: "主成分符号和排序会随样本窗口变化，解释需保持谨慎。" },
      ],
    },
    {
      title: "随机过程",
      description: "描述价格随时间连续演化、均值回归、随机波动和跳跃。",
      formulas: [
        { name: "布朗运动增量", equation: "Wₜ₊Δ−Wₜ ~ N(0,Δt)", purpose: "构造连续时间模型中的标准随机扰动。", variables: ["Wₜ：布朗运动", "Δt：时间间隔"], example: "时间间隔扩大四倍，随机增量标准差扩大两倍。", boundary: "真实价格存在跳跃、厚尾和交易时段效应。" },
        { name: "几何布朗运动", equation: "dSₜ = μSₜdt + σSₜdWₜ", purpose: "用漂移和比例波动描述正价格过程。", variables: ["μ：漂移", "σ：波动率", "Wₜ：布朗运动"], example: "经典 Black–Scholes 模型以该过程描述标的价格。", boundary: "固定波动和连续路径假设在加密市场尤其容易失效。" },
        { name: "Itô 引理", equation: "df = (fₜ+μSfS+½σ²S²fSS)dt + σSfS dW", purpose: "求随机变量函数随随机过程变化的微分。", variables: ["fS、fSS：一/二阶偏导", "S：随机价格过程"], example: "期权定价中用它把标的过程转换为衍生品价值过程。", boundary: "需要足够光滑且过程满足相应随机微分假设。" },
        { name: "OU 均值回归", equation: "dXₜ = κ(θ−Xₜ)dt + σdWₜ", purpose: "描述偏离长期均值后以速度 κ 回归的过程。", variables: ["θ：长期均值", "κ：回归速度", "σ：噪声"], example: "价差模型常用 OU 过程估计均值回归速度。", boundary: "长期均值和速度可能随制度变化，不应永久固定。" },
        { name: "半衰期", equation: "HalfLife = ln(2)/κ", purpose: "把均值回归速度换算为偏离衰减一半所需时间。", variables: ["κ：连续时间回归速度", "HalfLife：半衰期"], example: "κ=0.1 时半衰期约 6.93 个时间单位。", boundary: "只有在均值回归模型合理且 κ>0 时才有解释意义。" },
      ],
    },
    {
      title: "机器学习与预测",
      description: "覆盖回归、分类、损失函数、正则化和量化因子常用评价。",
      formulas: [
        { name: "均方误差", equation: "MSE = Σᵢ(yᵢ−ŷᵢ)² / n", purpose: "用平方损失评价连续目标预测误差。", variables: ["yᵢ：真实值", "ŷᵢ：预测值", "n：样本数"], example: "大误差因平方项受到更重惩罚。", boundary: "厚尾目标下极端值会主导 MSE，可结合 MAE 或稳健损失。" },
        { name: "逻辑函数", equation: "p = 1 / (1 + exp(−z))", purpose: "把任意实数评分映射到 0 至 1 的分类概率。", variables: ["z：线性或非线性评分", "p：预测概率"], example: "z=0 时 p=0.5；z 增大时概率趋近 1。", boundary: "输出只有经过校准后才能解释为真实发生概率。" },
        { name: "交叉熵", equation: "LogLoss = −Σ[y ln p +(1−y)ln(1−p)]/n", purpose: "评价二分类概率预测，严惩自信但错误的结果。", variables: ["y：0/1 标签", "p：预测概率"], example: "真实为 1 却预测 p=0.01 会产生很大损失。", boundary: "标签泄漏和类别不平衡会让低损失产生虚假安全感。" },
        { name: "L2 正则化", equation: "Lossreg = Loss + λΣⱼβⱼ²", purpose: "惩罚过大的模型参数以降低过拟合。", variables: ["λ：正则强度", "βⱼ：参数", "Loss：原损失"], example: "λ 增大通常让参数更小、模型更平滑。", boundary: "λ 必须在时间隔离的验证集选择，不能偷看测试集。" },
        { name: "信息系数 IC", equation: "IC = Corr(FactorScoreₜ, FutureReturnₜ)", purpose: "衡量因子排序与未来收益排序或线性收益的关联。", variables: ["FactorScore：当期因子值", "FutureReturn：未来收益"], example: "Rank IC 使用 Spearman 相关，降低极端值影响。", boundary: "未来收益窗口必须严格后移，并报告 IC 分布、换手和成本。" },
      ],
    },
    {
      title: "期权定价与 Greeks",
      description: "从到期损益、无套利关系到 Black–Scholes 和主要风险敏感度。",
      formulas: [
        { name: "看涨/看跌到期损益", equation: "Call=max(Sₜ−K,0)，Put=max(K−Sₜ,0)", purpose: "定义欧式期权到期时的内在价值。", variables: ["Sₜ：到期标的价", "K：执行价"], example: "执行价 100、到期价 120：看涨价值 20。", boundary: "持有人净利润还必须扣除期权权利金和交易成本。" },
        { name: "看涨看跌平价", equation: "C − P = S₀ − Ke^(−rT)", purpose: "连接同执行价同到期日欧式看涨、看跌和现货。", variables: ["C/P：期权价格", "S₀：现货", "r：利率", "T：到期时间"], example: "偏离平价可能提示报价、借贷或执行假设需要检查。", boundary: "分红、提前行权、资金和做空限制会改变关系。" },
        { name: "Black–Scholes 看涨", equation: "C = S₀N(d₁) − Ke^(−rT)N(d₂)", purpose: "在经典假设下计算欧式看涨期权理论价值。", variables: ["N：标准正态分布函数", "d₁,d₂：标准化项", "σ：隐含波动"], example: "市场常反解使理论价等于市价的 σ，得到隐含波动率。", boundary: "固定波动、无跳跃、连续对冲和无摩擦假设并不现实。" },
        { name: "d₁ 与 d₂", equation: "d₁=[ln(S/K)+(r+σ²/2)T]/(σ√T)，d₂=d₁−σ√T", purpose: "把价内程度、期限、利率和波动合成为定价输入。", variables: ["S/K：价内程度", "σ：年化波动", "T：年化期限"], example: "其单位和年化口径必须与利率、波动率保持一致。", boundary: "σ 并非常数，波动微笑说明模型假设不完整。" },
        { name: "Delta", equation: "Δcall = N(d₁)", purpose: "衡量标的价格小幅变化时期权价值的一阶变化。", variables: ["Δ：价格敏感度", "d₁：BS 标准化项"], example: "Delta 0.6 表示标的涨 1，期权近似涨 0.6。", boundary: "Delta 会随价格和时间变化，跳跃行情中静态对冲会失效。" },
        { name: "Gamma", equation: "Γ = φ(d₁)/(Sσ√T)", purpose: "衡量 Delta 对标的价格变化的敏感度。", variables: ["φ：标准正态密度", "S：标的价格", "Γ：曲率"], example: "临近到期的平值期权 Gamma 往往较高。", boundary: "高 Gamma 意味着需要更频繁再平衡并承担更高执行成本。" },
        { name: "Vega", equation: "Vega = Sφ(d₁)√T", purpose: "衡量隐含波动率变化对期权价值的影响。", variables: ["σ：隐含波动率", "T：期限", "Vega：波动敏感度"], example: "Vega 为 20 时，波动率上升 1 个百分点价值约增 0.2，需确认报价单位。", boundary: "实际波动曲面各执行价期限并非平行移动。" },
      ],
    },
  ],
  backtest: [
    {
      title: "数据与样本",
      description: "量化样本长度、缺失值、复权和有效观测，避免数据口径不一致。",
      formulas: [
        { name: "数据完整率", equation: "Completeness = N有效 / N应有", purpose: "衡量时间窗口内实际可用观测占理论观测的比例。", variables: ["N有效：非缺失观测", "N应有：预期观测"], example: "应有 1,000 根 K 线、有效 990 根：完整率 99%。", boundary: "高完整率不代表价格正确、无重复或时间戳对齐。" },
        { name: "前复权价格", equation: "Padj,t = Praw,t × Aₜ", purpose: "用调整因子消除分红拆股造成的机械价格跳变。", variables: ["Praw：原始价格", "Aₜ：复权因子", "Padj：调整价格"], example: "传统证券回测需统一信号价格和收益价格的复权口径。", boundary: "加密资产通常无拆股分红，但代币迁移和 redenomination 仍需处理。" },
        { name: "训练/验证/测试占比", equation: "ntrain + nvalid + ntest = n，且时间不交叉", purpose: "按时间切分样本，隔离调参与最终评价。", variables: ["ntrain：训练样本", "nvalid：验证样本", "ntest：测试样本"], example: "可按 60%/20%/20% 顺序切分，不随机打乱未来。", boundary: "一次切分可能偶然，仍需滚动验证和状态分层。" },
        { name: "覆盖周期数", equation: "Cycles = 样本长度 / 策略典型持有期", purpose: "粗略判断样本包含多少个独立交易周期。", variables: ["样本长度：同一时间单位", "典型持有期：平均或中位数"], example: "3 年样本、平均持有 10 天：约覆盖 109 个持有周期。", boundary: "交易周期会重叠且并非独立，该值只是样本充足度提示。" },
      ],
    },
    {
      title: "仓位与成交模拟",
      description: "把信号转换为目标仓位、订单数量和真实可执行成交。",
      formulas: [
        { name: "目标数量", equation: "Qtarget = wtarget × Equity / Price", purpose: "把目标权重转换为目标持仓数量。", variables: ["wtarget：目标权重", "Equity：权益", "Price：估值价格"], example: "权益 100,000、目标权重 20%、价格 100：目标 200 单位。", boundary: "需按合约乘数、最小下单量和杠杆规则修正。" },
        { name: "订单数量", equation: "Qorder = Qtarget − Qcurrent", purpose: "计算从当前持仓调整到目标持仓所需的净订单。", variables: ["Qtarget：目标数量", "Qcurrent：当前数量"], example: "当前 120、目标 200：买入订单为 80。", boundary: "部分成交后必须用实际持仓重新计算，不能假设一次完成。" },
        { name: "成交率", equation: "FillRate = Qfilled / Qsubmitted", purpose: "衡量提交订单中实际成交的比例。", variables: ["Qfilled：成交数量", "Qsubmitted：提交数量"], example: "提交 100、成交 70：成交率 70%。", boundary: "成交率与价格改善/恶化要一起看，不能单独评价执行。" },
        { name: "实现滑点", equation: "Slippage = Direction × (Pfill − Pref) / Pref", purpose: "计算成交价相对决策参考价的不利偏离。", variables: ["Direction：买 +1/卖 −1", "Pfill：成交均价", "Pref：参考价"], example: "参考 100 买入、成交 100.2：滑点 0.2%。", boundary: "参考价必须固定为决策时可见价格，避免事后挑选。" },
      ],
    },
    {
      title: "稳健性与过拟合",
      description: "量化参数稳定、样本外衰减和多重尝试带来的虚假发现。",
      formulas: [
        { name: "样本外衰减", equation: "Decay = 1 − MetricOOS / MetricIS", purpose: "衡量指标从样本内到样本外下降的比例。", variables: ["MetricIS：样本内指标", "MetricOOS：样本外指标"], example: "样本内 Sharpe 2、样本外 1：衰减 50%。", boundary: "当样本内指标接近 0 或符号变化时，应直接展示两者而非只看比率。" },
        { name: "参数敏感度", equation: "Sensitivity ≈ ΔMetric / ΔParameter", purpose: "观察绩效对参数小幅变化是否过度敏感。", variables: ["ΔMetric：指标变化", "ΔParameter：参数变化"], example: "均线周期改 1 天 Sharpe 就从 1.5 跌至 0.2，说明结果脆弱。", boundary: "需在多维邻域检查，单方向差分可能遗漏交互作用。" },
        { name: "Bonferroni 阈值", equation: "αadjusted = α / M", purpose: "对 M 次同时检验控制整体假阳性概率。", variables: ["α：目标显著水平", "M：检验数量"], example: "测试 100 个策略、总体 α=5%：单次阈值为 0.05%。", boundary: "方法保守且检验往往相关，但比忽略数据挖掘更可靠。" },
        { name: "概率夏普比率", equation: "PSR = Φ[(SR−SR*)√(n−1) / √(1−γ₃SR+(γ₄−1)SR²/4)]", purpose: "结合样本数、偏度和峰度评估 Sharpe 超过基准的概率。", variables: ["SR：观测 Sharpe", "SR*：基准 Sharpe", "γ₃/γ₄：偏度/峰度"], example: "相同 Sharpe 下，样本更长、尾部分布更温和会得到更高 PSR。", boundary: "依赖平稳性和矩估计；多重试验还需 Deflated Sharpe 等修正。" },
      ],
    },
  ],
  risk: [
    {
      title: "下行与分布风险",
      description: "在总波动之外，专门衡量目标以下波动、尾部概率和损失不对称。",
      formulas: [
        { name: "下行偏差", equation: "DD = √[Σᵢ min(Rᵢ−T,0)² / n]", purpose: "只统计低于目标收益 T 的不利波动。", variables: ["Rᵢ：观测收益", "T：目标/最低可接受收益", "DD：下行偏差"], example: "上涨波动不会增加下行偏差，低于目标的收益才会。", boundary: "目标 T 的选择会显著影响结果，必须明确口径。" },
        { name: "Sortino 比率", equation: "Sortino = (Rp − T) / DownsideDeviation", purpose: "用下行波动评价超过目标收益的效率。", variables: ["Rp：组合收益", "T：目标收益", "DownsideDeviation：下行偏差"], example: "收益 12%、目标 2%、下行偏差 10%：Sortino=1。", boundary: "下行样本少时估计不稳定，不能取代最大回撤和压力测试。" },
        { name: "偏度", equation: "Skew = E[(R−μ)³] / σ³", purpose: "衡量收益分布左右尾部的不对称程度。", variables: ["μ：均值", "σ：标准差", "Skew：偏度"], example: "负偏度常表示小赚频繁但偶尔出现大亏。", boundary: "三阶矩对极端值敏感，短样本估计误差很大。" },
        { name: "超额峰度", equation: "ExKurt = E[(R−μ)⁴] / σ⁴ − 3", purpose: "衡量相对正态分布的厚尾程度。", variables: ["四阶中心矩：尾部权重", "ExKurt：超额峰度"], example: "超额峰度为正通常意味着极端收益比正态假设更常见。", boundary: "峰度不能说明尾部方向，必须结合偏度和分位数。" },
      ],
    },
    {
      title: "流动性与执行风险",
      description: "把点差、深度、参与率和市场冲击纳入下单门禁。",
      formulas: [
        { name: "订单簿不平衡", equation: "OBI = (BidDepth−AskDepth)/(BidDepth+AskDepth)", purpose: "衡量买卖盘可见深度的相对不平衡。", variables: ["BidDepth：买盘深度", "AskDepth：卖盘深度", "OBI∈[−1,1]"], example: "买盘 600、卖盘 400：OBI=0.2。", boundary: "挂单可撤销且可能虚假，不能把 OBI 直接当成交方向。" },
        { name: "成交参与率", equation: "POV = OrderVolume / MarketVolume", purpose: "衡量策略订单占同期市场成交量的比例。", variables: ["OrderVolume：策略成交量", "MarketVolume：市场总成交量"], example: "成交 1,000、市场同期 100,000：参与率 1%。", boundary: "市场成交量是事后值，实时执行应使用滚动预测并设硬上限。" },
        { name: "Amihud 非流动性", equation: "ILLIQ = mean(|Rₜ| / Volumeₜ)", purpose: "估计单位成交额伴随的价格变化幅度。", variables: ["|Rₜ|：绝对收益", "Volumeₜ：成交额", "ILLIQ：冲击代理"], example: "同样涨跌幅下，成交额越小，非流动性指标越高。", boundary: "不同币种、价格单位和市场之间需标准化后比较。" },
        { name: "平方根冲击", equation: "Impact ≈ Yσ√(Q/V)", purpose: "粗略估计订单规模相对市场成交量造成的价格冲击。", variables: ["Y：经验系数", "σ：波动率", "Q/V：参与规模"], example: "订单占市场量比例提高四倍，模型冲击约提高两倍。", boundary: "极端行情、薄订单簿和链上 MEV 环境下可能严重低估。" },
      ],
    },
    {
      title: "衍生品与链上风险",
      description: "覆盖保证金、清算距离、基差、无常损失与健康因子。",
      formulas: [
        { name: "保证金率", equation: "MarginRatio = Equity / MaintenanceMargin", purpose: "比较账户权益与维持保证金要求。", variables: ["Equity：保证金账户权益", "MaintenanceMargin：维持保证金"], example: "权益 12,000、维持保证金 10,000：保证金率 1.2。", boundary: "交易所口径可能使用风险阶梯、未实现盈亏和不同标记价格。" },
        { name: "清算缓冲", equation: "LiquidationBuffer = |Mark−LiqPrice| / Mark", purpose: "衡量当前标记价格距离预估清算价的相对空间。", variables: ["Mark：标记价格", "LiqPrice：预估清算价"], example: "标记 100、清算价 90：缓冲约 10%。", boundary: "手续费、资金费、追加仓位和风险阶梯会动态改变清算价。" },
        { name: "基差风险", equation: "Basis = (Futures − Spot) / Spot", purpose: "衡量期货与现货价格的相对偏离。", variables: ["Futures：期货价格", "Spot：现货价格"], example: "期货 103、现货 100：基差 3%。", boundary: "套利仍承担资金、借贷、交易所、交割和脱钩风险。" },
        { name: "恒定乘积无常损失", equation: "IL(r) = 2√r/(1+r) − 1", purpose: "估计 50/50 恒定乘积池相对单纯持币的价值差。", variables: ["r：两资产相对价格变化倍数", "IL：无常损失"], example: "相对价格翻倍 r=2：IL 约 −5.72%。", boundary: "未计手续费、激励、集中流动性范围和再平衡。" },
        { name: "借贷健康因子", equation: "HF = Σ(CollateralValue×LiqThreshold) / DebtValue", purpose: "衡量抵押品折算价值覆盖债务的程度。", variables: ["CollateralValue：抵押价值", "LiqThreshold：清算阈值", "DebtValue：债务"], example: "折算抵押 120、债务 100：HF=1.2；接近 1 时风险升高。", boundary: "预言机延迟、资产相关下跌和链上拥堵会造成跳跃式清算。" },
      ],
    },
  ],
};
