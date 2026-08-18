import type { FormulaSystem } from "./FormulaHandbook";
import type { LearningGuide, LearningSource } from "./FormulaLearningGuides";

const guide = (
  stage: string,
  difficulty: LearningGuide["difficulty"],
  minutes: number,
  overview: string,
  objectives: string[],
  prerequisites: string[],
  exercise: string,
  pitfalls: string[],
  sourceIds: string[],
): LearningGuide => ({ stage, difficulty, minutes, overview, objectives, prerequisites, exercise, pitfalls, sourceIds });

export const KLINE_SOURCES: Record<string, LearningSource> = {
  binanceKlines: {
    id: "binanceKlines",
    provider: "Binance Spot API",
    title: "Kline / Candlestick data",
    note: "官方说明 K 线由开盘时间唯一标识，并定义周期、时区、OHLCV、成交额和成交笔数等字段。",
    url: "https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klinecandlestick-data",
  },
  tradingViewChart: {
    id: "tradingViewChart",
    provider: "TradingView Pine Script",
    title: "Chart information — prices and volume",
    note: "解释历史与实时 K 线的 OHLCV 行为、成交量单位、未收盘柱变化及历史引用规则。",
    url: "https://www.tradingview.com/pine-script-docs/concepts/chart-information/",
  },
  tradingViewTimeframes: {
    id: "tradingViewTimeframes",
    provider: "TradingView Pine Script",
    title: "Other data and timeframes",
    note: "说明跨周期请求、未确认高周期数据与重绘风险，是多周期策略的重要边界。",
    url: "https://www.tradingview.com/pine-script-docs/faq/other-data-and-timeframes/",
  },
  taLibFunctions: {
    id: "taLibFunctions",
    provider: "TA-Lib",
    title: "Technical Analysis Functions",
    note: "按趋势、动量、波动、成交量和形态识别分类，公开公式、输入输出及实现。",
    url: "https://ta-lib.org/functions/",
  },
  cmeCandlesticks: {
    id: "cmeCandlesticks",
    provider: "CME Group Education",
    title: "Chart Types: Candlestick, Line and Bar",
    note: "系统介绍蜡烛图实体、影线、周期、跳空及时间柱与成交笔数柱的差别。",
    url: "https://www.cmegroup.com/education/courses/technical-analysis/chart-types-candlestick-line-bar",
  },
  cmeOscillators: {
    id: "cmeOscillators",
    provider: "CME Group Education",
    title: "Oscillators: MACD, RSI and Stochastics",
    note: "解释常用震荡指标、交叉和背离，同时强调指标滞后及强趋势中的钝化。",
    url: "https://www.cmegroup.com/education/courses/technical-analysis/oscillators-macd-rsi-stochastics",
  },
  nberTechnicalPatterns: {
    id: "nberTechnicalPatterns",
    provider: "NBER / Journal of Finance",
    title: "Foundations of Technical Analysis",
    note: "Lo、Mamaysky 与 Wang 将主观图形转为算法，并比较形态条件下与无条件收益分布。",
    url: "https://www.nber.org/papers/w7613",
  },
};

export const KLINE_GUIDES: Record<string, LearningGuide> = {
  "OHLCV 与价格变换": guide("读图基础", "入门", 35, "一根 K 线是指定窗口内成交数据的压缩，不是对未来方向的判断。先掌握字段、单位和价格变换，后续指标才有统一输入。", ["能解释 O/H/L/C/V 的生成规则", "能区分实体、影线、振幅和典型价格"], ["百分比", "最高值与最低值"], "任选 5 根真实 K 线，手算实体、上下影线、振幅与典型价格，并核对 high≥max(open,close)、low≤min(open,close)。", ["把阳线直接解释为比上一根收盘更高", "忽略不同市场成交量单位不同"], ["tradingViewChart", "cmeCandlesticks"]),
  "周期聚合与时间边界": guide("数据构造", "进阶", 50, "周期决定每根柱包含哪些成交；时区、交易日边界和未收盘柱会改变 OHLCV，因此相同市场也可能出现不同日线。", ["从低周期正确聚合高周期 K 线", "识别未确认柱和跨周期重绘"], ["时间戳", "OHLCV"], "用连续四根 15 分钟 K 线聚合一根 1 小时 K 线，分别核对 open、high、low、close、volume，再模拟缺失一根后的差异。", ["把四根收盘价平均当作高周期收盘", "在高周期尚未收盘时使用最终 high/low"], ["binanceKlines", "tradingViewTimeframes"]),
  "实体影线与柱内强度": guide("价格行为", "入门", 40, "实体与影线描述价格在窗口内从哪里开始、到哪里结束和曾经到过哪里；只有放入前后文才能讨论压力、拒绝或犹豫。", ["量化实体和影线占比", "区分本柱涨跌与相邻柱变化"], ["OHLCV", "比率"], "筛选实体占振幅低于 10% 的柱，再按收盘位置分为靠近最高、居中、靠近最低三组，观察下一期收益分布。", ["只看颜色不看实体相对振幅", "脱离趋势位置给单根形态命名后直接交易"], ["cmeCandlesticks", "nberTechnicalPatterns"]),
  "趋势与市场结构": guide("价格行为", "进阶", 50, "趋势应先写成可观察结构，例如更高高点和更高低点，均线只是在窗口内平滑价格的派生量。", ["识别 HH/HL 与 LH/LL 结构", "计算 SMA、EMA 并理解滞后"], ["滚动窗口", "收益率"], "在同一段行情上比较 10、20、60 周期 SMA 与 EMA，记录交叉发生时间以及相对真实高低点的滞后。", ["价格高于均线就断言必然上涨", "看到完整历史后回画趋势线并忽略实时可得性"], ["taLibFunctions", "nberTechnicalPatterns"]),
  "支撑阻力与突破": guide("价格行为", "进阶", 50, "支撑阻力更适合表达为价格区域和条件规则，而不是永远有效的精确点位；突破还需处理确认、波动尺度和假突破。", ["用滚动高低点定义候选区域", "把突破距离按 ATR 或价格标准化"], ["趋势结构", "滚动极值"], "定义“收盘超过过去 20 根最高价 0.5 ATR”为突破，比较只触碰最高价、收盘突破和放量突破三种条件的样本数与后续收益。", ["使用包含当前柱的最高价造成自我比较", "把测试过很多窗口后的最优参数当成天然规律"], ["nberTechnicalPatterns", "taLibFunctions"]),
  "成交量与价格确认": guide("量价关系", "进阶", 55, "成交量描述指定场所和口径下的成交活跃度。量价指标可补充参与程度，但跨交易所、现货与衍生品不能直接混用。", ["计算量比、VWAP 与 OBV", "识别成交量单位和场所差异"], ["OHLCV", "加权平均"], "把同一时期的基础资产成交量、计价资产成交额和成交笔数并列，计算量比与 OBV，解释三者为何可能给出不同结论。", ["把单一交易所成交量当作全市场成交量", "把累计型 OBV 的绝对数值跨样本比较"], ["binanceKlines", "taLibFunctions"]),
  "动量与震荡指标": guide("技术指标", "进阶", 60, "ROC、RSI、随机指标和 MACD 都来自历史价格变换；它们描述动量或相对位置，不会产生独立于价格的新信息。", ["复算 ROC、RSI、Stochastic 与 MACD", "解释超买超卖、交叉与背离的限制"], ["移动平均", "涨跌序列"], "选择一段强趋势和一段震荡行情，比较 RSI<30、随机指标<20 与 MACD 交叉后的表现，记录信号延迟和连续钝化。", ["把 RSI>70 自动当作做空信号", "忽略不同软件初始化和平滑方式造成的差异"], ["taLibFunctions", "cmeOscillators"]),
  "波动率与通道": guide("技术指标", "进阶", 55, "波动指标回答价格变化范围有多大，而不是方向。ATR 纳入跳空，NATR 便于跨价格比较，布林带用滚动均值和标准差描述相对位置。", ["计算 TR、ATR、NATR 和布林带", "区分波动扩张与方向判断"], ["标准差", "移动平均"], "比较价格相同涨幅但波动不同的两段样本，计算 NATR、布林带宽度和突破次数，检查固定百分比阈值为何不稳健。", ["看到带宽扩大就断言上涨", "跨资产直接比较未归一化 ATR"], ["taLibFunctions"]),
  "形态算法化与统计验证": guide("证据验证", "高级", 75, "十字星、锤子、吞没和头肩等名称只是规则候选。可信研究必须固定数值定义，并比较条件收益、基准、成本和样本外结果。", ["把图形语言写成布尔条件", "计算条件收益与无条件收益差异"], ["条件概率", "回测基础"], "给锤子线写出实体、下影线、上影线和趋势位置四项阈值；冻结参数后统计下一期收益，并与随机日期和买入持有比较。", ["看完未来走势后主观挑选形态", "测试几十种形态却只汇报最好的一个"], ["nberTechnicalPatterns", "taLibFunctions"]),
  "数据质量与可回测规则": guide("研究落地", "高级", 70, "K 线策略最常见的问题不是公式写错，而是缺失柱、重复柱、时区错位、未收盘数据、复权差异和信号成交时序。", ["完成 OHLCV 数据质量检查", "把观察写成不读取未来的信号与成交规则"], ["时间序列", "回测时序"], "为一份 K 线样本检查排序、重复、缺失、OHLC 约束和未收盘柱；让信号在 t 收盘确认，并分别用 t+1 开盘与 t+1 VWAP 模拟成交。", ["用当前柱收盘确认信号又按同一收盘价成交", "在合成 K 线或未确认高周期柱上直接回测"], ["binanceKlines", "tradingViewTimeframes", "tradingViewChart"]),
};

export const KLINE_SYSTEM: FormulaSystem = {
  title: "K 线与价格行为知识体系",
  description: "从 OHLCV 数据构造开始，系统学习柱内强度、趋势结构、量价、动量、波动和形态算法化；每项都给出计算方法、例子与不可越过的证据边界。",
  groups: [
    {
      title: "OHLCV 与价格变换",
      description: "先把一根 K 线拆成可计算字段，再理解常见价格代表值。",
      formulas: [
        { name: "实体长度", equation: "Body = |C − O|", purpose: "衡量开盘到收盘的绝对移动。", variables: ["O：开盘价", "C：收盘价", "Body：实体长度"], example: "O=100、C=104，实体长度为 4。", boundary: "实体长只说明本周期开收差大，不表示下一周期延续。" },
        { name: "上下影线", equation: "Upper = H−max(O,C)，Lower = min(O,C)−L", purpose: "衡量实体之外曾触及的上下价格范围。", variables: ["H/L：最高/最低", "Upper/Lower：上下影线"], example: "O=100、C=104、H=106、L=97：上影 2、下影 3。", boundary: "OHLC 不提供柱内成交路径，相同影线可能由不同逐笔顺序形成。" },
        { name: "振幅", equation: "Range% = (H − L) / O × 100%", purpose: "把本周期最高最低范围换算为相对开盘价的幅度。", variables: ["H/L/O：高、低、开", "Range%：相对振幅"], example: "H=105、L=95、O=100：振幅为 10%。", boundary: "开盘价接近零时失真；跨资产比较更常使用 NATR。" },
        { name: "典型价格", equation: "TP = (H + L + C) / 3", purpose: "用高、低、收盘构造一根柱的代表价格。", variables: ["H/L/C：高、低、收", "TP：Typical Price"], example: "H=106、L=97、C=104：TP≈102.33。", boundary: "它不是实际成交均价，不能代替逐笔计算的 VWAP。" },
      ],
    },
    {
      title: "周期聚合与时间边界",
      description: "低周期成交如何生成高周期 K 线，以及时区和确认状态如何改变结果。",
      formulas: [
        { name: "聚合开盘", equation: "Oᴴ = first(Oᴸ)", purpose: "取窗口内第一根低周期柱的开盘作为高周期开盘。", variables: ["ᴴ：高周期", "ᴸ：低周期", "first：窗口首值"], example: "四根 15 分钟柱聚合 1 小时，取第一根 open。", boundary: "必须先按时间排序并明确窗口左闭右开规则。" },
        { name: "聚合高低", equation: "Hᴴ=max(Hᴸ)，Lᴴ=min(Lᴸ)", purpose: "取窗口内所有低周期最高与最低。", variables: ["Hᴸ/Lᴸ：低周期高低", "Hᴴ/Lᴴ：高周期高低"], example: "四根最高价最大为 105、最低价最小为 96。", boundary: "缺失低周期柱会让高低与成交量都不完整。" },
        { name: "聚合收盘", equation: "Cᴴ = last(Cᴸ)", purpose: "取窗口内最后一根低周期柱的收盘。", variables: ["last：窗口末值", "Cᴴ：高周期收盘"], example: "整点前最后一根 15 分钟柱 close 为小时 close。", boundary: "未收盘高周期柱的 close 只是最新价，会继续变化。" },
        { name: "聚合成交量", equation: "Vᴴ = Σ Vᴸ", purpose: "累加窗口内低周期成交量。", variables: ["Vᴸ：低周期成交量", "Vᴴ：高周期成交量"], example: "四根成交量 10、12、8、15，小时量为 45。", boundary: "基础币数量、计价币成交额和合约张数不能混加。" },
      ],
    },
    {
      title: "实体影线与柱内强度",
      description: "用比例而不是肉眼判断实体、影线与收盘位置。",
      formulas: [
        { name: "实体占比", equation: "BodyRatio = |C−O| / (H−L)", purpose: "衡量实体占整根振幅的比例。", variables: ["BodyRatio∈[0,1]", "H>L"], example: "实体 6、振幅 10：实体占比 60%。", boundary: "振幅为零时无定义；阈值需按品种和周期验证。" },
        { name: "收盘位置 CLV", equation: "CLV = [(C−L)−(H−C)] / (H−L)", purpose: "描述收盘靠近本柱最高还是最低。", variables: ["CLV∈[−1,1]", "1：靠近最高", "−1：靠近最低"], example: "H=110、L=90、C=105：CLV=0.5。", boundary: "只使用本柱范围，不能推断下一柱方向。" },
        { name: "上影线占比", equation: "UpperRatio = [H−max(O,C)] / (H−L)", purpose: "标准化上影线长度，便于跨价格比较。", variables: ["UpperRatio：上影占比", "H>L"], example: "上影 3、总振幅 12：占比 25%。", boundary: "长上影既可能是拒绝，也可能只是高波动噪声。" },
        { name: "下影线占比", equation: "LowerRatio = [min(O,C)−L] / (H−L)", purpose: "标准化下影线长度。", variables: ["LowerRatio：下影占比", "H>L"], example: "下影 6、总振幅 12：占比 50%。", boundary: "必须结合前序趋势、位置和成交量，不能单柱定性。" },
      ],
    },
    {
      title: "趋势与市场结构",
      description: "把趋势写成收益、滚动高低点和均线等可复现条件。",
      formulas: [
        { name: "单期收盘收益", equation: "Rₜ = Cₜ / Cₜ₋₁ − 1", purpose: "衡量相邻收盘价的相对变化。", variables: ["Cₜ：当前收盘", "Cₜ₋₁：前收盘"], example: "100 到 103：收益 3%。", boundary: "忽略柱内路径；用于交易还需考虑成交时点和成本。" },
        { name: "简单移动平均 SMA", equation: "SMAₙ,ₜ = Σᵢ₌₀ⁿ⁻¹ Cₜ₋ᵢ / n", purpose: "平滑最近 n 根收盘价以观察中枢。", variables: ["n：窗口", "C：收盘价"], example: "5 个收盘均值构成 SMA5。", boundary: "窗口越长越滞后，交叉本身不保证收益。" },
        { name: "指数移动平均 EMA", equation: "EMAₜ = αCₜ + (1−α)EMAₜ₋₁，α=2/(n+1)", purpose: "给予近期价格更高权重。", variables: ["α：平滑系数", "n：名义周期"], example: "n=9 时 α=0.2。", boundary: "初始化方法会影响开头数值，短样本需留预热期。" },
        { name: "结构高低点", equation: "HHₜ=Hₜ>max(Hₜ₋ₖ…Hₜ₋₁)，LLₜ=Lₜ<min(Lₜ₋ₖ…Lₜ₋₁)", purpose: "把创新高和创新低写成滚动规则。", variables: ["k：回看窗口", "HH/LL：布尔条件"], example: "当前 high 超过前 20 根 high，记为 20 期新高。", boundary: "当前柱不能包含在比较窗口中，否则会产生自我比较。" },
      ],
    },
    {
      title: "支撑阻力与突破",
      description: "用区域、滚动极值和标准化距离表达关键价格位置。",
      formulas: [
        { name: "滚动阻力", equation: "Resistanceₜ = max(Hₜ₋ₙ … Hₜ₋₁)", purpose: "用过去 n 根最高价定义候选阻力。", variables: ["n：回看窗口", "不含当前柱"], example: "过去 20 根最高为 105，则候选阻力 105。", boundary: "历史最高并非不可穿越的物理边界。" },
        { name: "滚动支撑", equation: "Supportₜ = min(Lₜ₋ₙ … Lₜ₋₁)", purpose: "用过去 n 根最低价定义候选支撑。", variables: ["n：回看窗口", "L：最低价"], example: "过去 20 根最低为 92，则候选支撑 92。", boundary: "窗口选择会改变位置，不能事后挑最贴合的窗口。" },
        { name: "突破距离", equation: "BreakoutATR = (Cₜ − Resistanceₜ) / ATRₜ", purpose: "按当前波动尺度衡量收盘突破幅度。", variables: ["ATR：真实波幅均值", "BreakoutATR：标准化距离"], example: "阻力 100、收盘 102、ATR 4：突破 0.5 ATR。", boundary: "ATR 与阻力必须只用信号时点已知数据。" },
        { name: "通道宽度", equation: "Width = (Resistance − Support) / Mid", purpose: "衡量滚动高低通道的相对宽度。", variables: ["Mid=(Resistance+Support)/2", "Width：相对宽度"], example: "阻力 110、支撑 90、中点 100：宽度 20%。", boundary: "窄通道不保证即将突破，宽度阈值需统计验证。" },
      ],
    },
    {
      title: "成交量与价格确认",
      description: "区分活跃度、成交均价和累积量价方向。",
      formulas: [
        { name: "成交量均线", equation: "VMAₙ = Σᵢ₌₀ⁿ⁻¹ Vₜ₋ᵢ / n", purpose: "构造近期成交量基准。", variables: ["V：成交量", "n：窗口"], example: "过去 20 根成交量平均为 1,000。", boundary: "不同交易所或合约口径不可直接拼接。" },
        { name: "量比", equation: "VolumeRatio = Vₜ / VMAₙ,ₜ₋₁", purpose: "衡量当前成交量相对历史基准的倍数。", variables: ["Vₜ：当前量", "VMA：历史量均值"], example: "当前 1,500、历史均量 1,000：量比 1.5。", boundary: "未收盘柱成交量尚未累积完整，直接比较会系统性偏低。" },
        { name: "成交量加权均价 VWAP", equation: "VWAP = Σ PᵢQᵢ / Σ Qᵢ", purpose: "按每笔或更细粒度成交量加权价格。", variables: ["Pᵢ：成交价", "Qᵢ：成交量"], example: "100×2 与 102×3：VWAP=101.2。", boundary: "只用 OHLC 的近似 VWAP 不等于真实逐笔 VWAP。" },
        { name: "能量潮 OBV", equation: "OBVₜ=OBVₜ₋₁+sign(Cₜ−Cₜ₋₁)Vₜ", purpose: "按收盘方向累加或扣减成交量。", variables: ["sign：方向符号", "Vₜ：成交量"], example: "上涨柱加量，下跌柱减量，平盘不变。", boundary: "OBV 依赖起点且只使用涨跌符号，忽略涨跌幅大小。" },
      ],
    },
    {
      title: "动量与震荡指标",
      description: "从价格变化率、相对涨跌和区间位置观察动量。",
      formulas: [
        { name: "变化率 ROC", equation: "ROCₙ = (Cₜ/Cₜ₋ₙ − 1) × 100", purpose: "衡量 n 周期价格动量。", variables: ["n：回看期", "C：收盘价"], example: "10 根前 100、当前 108：ROC10=8%。", boundary: "起点敏感，极端基期会造成突变。" },
        { name: "相对强弱 RSI", equation: "RSI = 100 − 100/(1 + AvgGainₙ/AvgLossₙ)", purpose: "比较窗口内平滑平均上涨与下跌幅度。", variables: ["AvgGain/AvgLoss：Wilder 平滑", "常用 n=14"], example: "平均上涨 2、平均下跌 1：RS=2，RSI≈66.67。", boundary: "强趋势中可长期高于 70 或低于 30，不等于立即反转。" },
        { name: "随机指标 %K", equation: "%K = 100(C−Lₙ)/(Hₙ−Lₙ)", purpose: "衡量收盘在近期最高最低区间中的位置。", variables: ["Hₙ/Lₙ：n 期高低", "%K∈[0,100]"], example: "区间 90–110、收盘 106：%K=80。", boundary: "区间为零时无定义，趋势中同样会钝化。" },
        { name: "MACD", equation: "MACD=EMA₁₂−EMA₂₆，Signal=EMA₉(MACD)", purpose: "比较快慢指数均线以描述趋势动量。", variables: ["EMA12/26：快慢线", "Signal：信号线"], example: "快线高于慢线时 MACD 为正。", boundary: "参数是惯例而非定律；交叉是滞后结果。" },
      ],
    },
    {
      title: "波动率与通道",
      description: "衡量价格范围、跳空和相对波动，而不是预测方向。",
      formulas: [
        { name: "真实波幅 TR", equation: "TR=max(H−L, |H−C₋₁|, |L−C₋₁|)", purpose: "把本柱振幅和相对前收的跳空纳入波动。", variables: ["C₋₁：前收盘", "H/L：本柱高低"], example: "H−L=5、相对前收最大距离 8，则 TR=8。", boundary: "首根没有前收，计算库的首值处理可能不同。" },
        { name: "平均真实波幅 ATR", equation: "ATRₜ=[(n−1)ATRₜ₋₁+TRₜ]/n", purpose: "用 Wilder 平滑得到动态绝对波动尺度。", variables: ["n：周期", "TR：真实波幅"], example: "常用 ATR14 作为止损或突破尺度。", boundary: "ATR 是价格单位，跨资产不能直接比较。" },
        { name: "归一化 ATR", equation: "NATR = ATR / C × 100", purpose: "把 ATR 换算为价格百分比。", variables: ["ATR：绝对波动", "C：收盘价"], example: "ATR=2、收盘=100：NATR=2%。", boundary: "价格接近零时失真，也不表示波动方向。" },
        { name: "布林带", equation: "Middle=SMAₙ，Upper/Lower=Middle±kσₙ", purpose: "用滚动均值和标准差构造相对价格通道。", variables: ["σₙ：滚动标准差", "k：带宽倍数"], example: "均线 100、σ=3、k=2：上下轨 106/94。", boundary: "价格触轨不是自动反转或突破信号；收益并非常态分布。" },
      ],
    },
    {
      title: "形态算法化与统计验证",
      description: "把形态名称转成确定条件，再验证条件收益是否稳定。",
      formulas: [
        { name: "十字星规则", equation: "Doji = BodyRatio ≤ θbody", purpose: "用实体占比阈值定义开收接近的柱。", variables: ["θbody：预先冻结阈值", "BodyRatio：实体占比"], example: "设 θ=0.1，实体不超过振幅 10% 记为十字星。", boundary: "阈值没有跨市场统一标准，必须固定后样本外检验。" },
        { name: "锤子线规则", equation: "Hammer = Lower≥2Body ∧ Upper≤0.5Body ∧ BodyRatio≤θ", purpose: "把长下影、小实体的描述写成布尔条件。", variables: ["Lower/Upper/Body：长度", "θ：实体上限"], example: "下影为实体 2 倍以上且上影较短。", boundary: "还需定义前序下跌和出现位置；单根形态不保证反转。" },
        { name: "吞没规则", equation: "BullEngulf = Cₜ>Oₜ ∧ Cₜ₋₁<Oₜ₋₁ ∧ Oₜ≤Cₜ₋₁ ∧ Cₜ≥Oₜ₋₁", purpose: "严格定义当前阳线实体覆盖前一阴线实体。", variables: ["t：当前柱", "t−1：前一柱"], example: "当前开盘不高于前收，当前收盘不低于前开。", boundary: "跳空、相等边界和最小实体需事先规定。" },
        { name: "条件远期收益", equation: "E[Rₜ→ₜ₊ₕ | Pattern=1] − E[Rₜ→ₜ₊ₕ]", purpose: "比较形态出现后的收益与全样本基准。", variables: ["h：持有期", "Pattern：形态条件"], example: "比较锤子样本下一日收益均值与全部日期下一日收益。", boundary: "需报告样本量、区间、成本、多重检验和样本外结果。" },
      ],
    },
    {
      title: "数据质量与可回测规则",
      description: "让 K 线输入可审计，让信号时序不读取未来。",
      formulas: [
        { name: "OHLC 合法性", equation: "H≥max(O,C) ∧ L≤min(O,C) ∧ H≥L ∧ V≥0", purpose: "检查每根 K 线是否满足基本字段约束。", variables: ["O/H/L/C/V：行情字段"], example: "若 high 小于 close，则该行数据无效。", boundary: "通过约束不代表数据完整、无重复或价格来源正确。" },
        { name: "缺失率", equation: "MissingRate = Nmissing / Nexpected", purpose: "衡量预期时间网格中缺少的 K 线比例。", variables: ["Nexpected：应有柱数", "Nmissing：缺失柱数"], example: "应有 1,440 根分钟柱，缺 14 根：约 0.97%。", boundary: "无成交时是否生成零量柱取决于数据源规则。" },
        { name: "信号滞后", equation: "Positionₜ = Signalₜ₋₁", purpose: "让本期持仓仅使用上一期收盘后已知信号。", variables: ["Signalₜ₋₁：已确认信号", "Positionₜ：本期仓位"], example: "t 收盘确认突破，最早在 t+1 模拟成交。", boundary: "具体成交仍取决于订单类型、延迟和市场流动性。" },
        { name: "形态命中率与期望", equation: "HitRate=N(Rₕ>0)/Npattern，Expectancy=mean(Rₕ−Cost)", purpose: "同时报告方向命中和扣成本后的平均结果。", variables: ["Rₕ：h 期远期收益", "Cost：交易成本"], example: "命中率 55% 但平均亏损更大时，期望仍可能为负。", boundary: "重叠持有期会造成样本相关，普通标准误可能偏小。" },
      ],
    },
  ],
};
