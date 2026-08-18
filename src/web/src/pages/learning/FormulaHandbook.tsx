import {
  BookOutlined,
  BulbOutlined,
  CalculatorOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ExperimentOutlined,
  LinkOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";

import { ADVANCED_GROUPS } from "./FormulaHandbookAdvanced";
import {
  FALLBACK_GUIDE,
  LEARNING_GUIDES,
  LEARNING_SOURCES,
} from "./FormulaLearningGuides";
import { KLINE_GUIDES, KLINE_SOURCES, KLINE_SYSTEM } from "./KlineLearningContent";
import "./formula-handbook.css";

export type FormulaDomain = "math" | "backtest" | "risk" | "kline";

export type FormulaItem = {
  name: string;
  equation: string;
  purpose: string;
  variables: string[];
  example: string;
  boundary: string;
};

export type FormulaGroup = {
  title: string;
  description: string;
  formulas: FormulaItem[];
};

export type FormulaSystem = {
  title: string;
  description: string;
  groups: FormulaGroup[];
};

const SYSTEMS: Record<FormulaDomain, FormulaSystem> = {
  kline: KLINE_SYSTEM,
  math: {
    title: "量化数学公式体系",
    description: "从数学基础和概率统计，延伸到回归、时间序列、技术指标、组合优化、执行与 Web3；每个公式都说明符号、代入方法与失效边界。",
    groups: [
      {
        title: "收益与复利",
        description: "回答赚了多少、增长多快，以及多期收益怎样连接。",
        formulas: [
          { name: "简单收益率", equation: "R = (P₁ − P₀) / P₀", purpose: "衡量一次持有期内价格相对期初的变化。", variables: ["P₀：期初价格", "P₁：期末价格", "R：持有期收益率"], example: "100 元涨到 108 元：R = (108−100)/100 = 8%。", boundary: "不同期间的简单收益率不能直接相加，必须按复利连接。" },
          { name: "对数收益率", equation: "r = ln(P₁ / P₀)", purpose: "把价格比例转换为可跨时间相加的收益。", variables: ["ln：自然对数", "P₀、P₁：前后价格", "r：对数收益率"], example: "100 元涨到 108 元：r = ln(1.08) ≈ 7.70%。", boundary: "价格必须大于 0；对数收益与简单收益只在小幅变化时近似相等。" },
          { name: "复合增长率", equation: "g = (Vₙ / V₀)^(1/n) − 1", purpose: "把 n 期总增长换算为每期相同的复合增速。", variables: ["V₀：期初价值", "Vₙ：第 n 期价值", "n：期数", "g：每期复合增长率"], example: "两年从 100 境长到 121：g = 10%。", boundary: "它抹平了中间波动，不能说明增长路径是否平稳。" },
        ],
      },
      {
        title: "均值与波动",
        description: "描述数据的中心、离散程度，以及不同时间尺度间的换算。",
        formulas: [
          { name: "算术平均", equation: "μ = (Σᵢ Rᵢ) / n", purpose: "估计一组收益的平均水平。", variables: ["Rᵢ：第 i 个观测", "n：观测数量", "μ：样本均值"], example: "2%、−1%、3% 的均值为 (2−1+3)/3 = 1.33%。", boundary: "均值容易被极端值影响，也不能描述收益出现的顺序。" },
          { name: "样本方差与标准差", equation: "s² = Σᵢ(Rᵢ − μ)² / (n − 1)，s = √s²", purpose: "衡量观测值围绕均值的离散程度。", variables: ["μ：样本均值", "s²：样本方差", "s：样本标准差"], example: "偏离均值越远，平方项越大，对波动估计的贡献越高。", boundary: "标准差把上涨和下跌同等看作波动，不能单独刻画尾部损失。" },
          { name: "波动率年化", equation: "σ年 = σ期 × √m", purpose: "把单期波动换算到一年尺度。", variables: ["σ期：单期标准差", "m：一年内期数", "σ年：年化波动率"], example: "日波动 1%，按 252 个交易日估算：年化约 15.87%。", boundary: "平方根法依赖收益近似独立同分布；波动聚集时可能失真。" },
        ],
      },
      {
        title: "概率与期望",
        description: "用概率加权不同情景，并明确条件发生后概率怎样更新。",
        formulas: [
          { name: "期望收益", equation: "E[R] = Σᵢ pᵢRᵢ", purpose: "计算大量重复情景下的概率加权平均结果。", variables: ["pᵢ：情景概率", "Rᵢ：情景收益", "Σpᵢ = 1"], example: "30% 概率赚 10%，70% 概率亏 2%：期望为 1.6%。", boundary: "正期望不代表下一次盈利，概率估计错误会直接改变结论。" },
          { name: "随机变量方差", equation: "Var(R) = Σᵢ pᵢ(Rᵢ − E[R])²", purpose: "衡量不同结果围绕期望的分散程度。", variables: ["E[R]：期望收益", "pᵢ：情景概率", "Var(R)：方差"], example: "同样期望下，极端盈亏情景会产生更大的方差。", boundary: "方差不能区分有利与不利波动，需结合下行风险。" },
          { name: "条件概率", equation: "P(A | B) = P(A ∩ B) / P(B)", purpose: "计算已知 B 发生后，A 发生的概率。", variables: ["A、B：两个事件", "A∩B：共同发生", "P(B) > 0"], example: "已知放量的交易日中上涨占 60%，则 P(上涨|放量)=60%。", boundary: "条件相关不等于因果；样本筛选会显著影响条件概率。" },
        ],
      },
      {
        title: "相关与组合",
        description: "从共同变化、线性相关到组合收益和组合风险。",
        formulas: [
          { name: "相关系数", equation: "ρAB = Cov(A,B) / (σAσB)", purpose: "把协方差标准化到 −1 至 1，描述线性同步程度。", variables: ["Cov(A,B)：协方差", "σA、σB：各自波动率", "ρAB：相关系数"], example: "ρ 接近 1 表示常同向，接近 −1 表示常反向。", boundary: "相关性会随窗口变化，也不能证明 A 导致 B。" },
          { name: "组合期望收益", equation: "E[Rp] = Σᵢ wᵢE[Rᵢ]", purpose: "按资产权重汇总组合的期望收益。", variables: ["wᵢ：资产权重", "E[Rᵢ]：资产期望收益", "Σwᵢ = 1"], example: "60% 配置收益 10%、40% 配置收益 5%：组合期望为 8%。", boundary: "权重和期望都会变化，历史均值不等于未来期望。" },
          { name: "组合波动率", equation: "σp = √(ΣᵢΣⱼ wᵢwⱼCovᵢⱼ)", purpose: "把资产自身波动和资产间共同变化同时计入。", variables: ["wᵢ、wⱼ：资产权重", "Covᵢⱼ：协方差", "σp：组合波动率"], example: "两项资产相关性下降时，组合波动通常低于波动的简单加权。", boundary: "危机期相关性可能突然上升，历史分散效果不保证持续。" },
        ],
      },
      {
        title: "绩效与风险",
        description: "把收益与承担的风险、回撤路径放在同一评价体系中。",
        formulas: [
          { name: "Sharpe 比率", equation: "Sharpe = (Rp − Rf) / σp", purpose: "衡量每承担一单位波动获得的超额收益。", variables: ["Rp：组合年化收益", "Rf：无风险收益", "σp：组合年化波动"], example: "收益 14%、无风险 2%、波动 12%：Sharpe = 1。", boundary: "对非对称和厚尾收益解释有限，频率与年化口径必须一致。" },
          { name: "最大回撤", equation: "MDD = maxₜ[(Peakₜ − Vₜ) / Peakₜ]", purpose: "寻找净值从历史峰值到后续谷底的最大跌幅。", variables: ["Vₜ：时点净值", "Peakₜ：截至 t 的历史峰值", "MDD：最大回撤"], example: "净值从 120 跌到 90：该段回撤为 25%。", boundary: "结果强烈依赖样本窗口，且不体现回撤持续时间。" },
          { name: "Calmar 比率", equation: "Calmar = 年化收益 / |MDD|", purpose: "用最大回撤衡量年化收益的代价。", variables: ["年化收益：CAGR 口径", "MDD：最大回撤绝对值"], example: "年化收益 20%、最大回撤 10%：Calmar = 2。", boundary: "短样本中最大回撤可能尚未充分暴露，不能跨口径直接比较。" },
        ],
      },
    ],
  },
  backtest: {
    title: "回测公式体系",
    description: "从数据样本、净值生成、仓位成交、交易成本和基准比较，到绩效、交易质量与过拟合修正，建立一套能复算的评价口径。",
    groups: [
      {
        title: "收益与净值",
        description: "先统一单期收益、累计收益和年化收益的计算口径。",
        formulas: [
          { name: "单期策略收益", equation: "rₜ = wₜ₋₁ × (Pₜ/Pₜ₋₁ − 1)", purpose: "用上一期已持有仓位计算本期价格变化带来的收益。", variables: ["wₜ₋₁：期初仓位", "Pₜ：本期价格", "rₜ：本期策略收益"], example: "上一期仓位 50%，标的上涨 4%，策略毛收益为 2%。", boundary: "使用 wₜ 而不是 wₜ₋₁ 容易引入前视偏差。" },
          { name: "净值递推", equation: "Vₜ = Vₜ₋₁ × (1 + rₜ)", purpose: "按时间顺序把每期收益复合为策略净值。", variables: ["Vₜ₋₁：上期净值", "rₜ：本期净收益", "Vₜ：本期净值"], example: "净值 1.00，本期收益 3%：新净值为 1.03。", boundary: "rₜ 必须已扣除本期实际发生的成本和资金费用。" },
          { name: "年化复合收益", equation: "CAGR = (V末/V初)^(m/n) − 1", purpose: "把 n 个观测期的总增长换算成年化复合收益。", variables: ["m：每年期数", "n：样本期数", "V初、V末：起止净值"], example: "两年净值从 1 增至 1.44：CAGR = 20%。", boundary: "短样本年化会放大偶然结果，必须同时展示实际样本长度。" },
        ],
      },
      {
        title: "换手与成本",
        description: "把理想信号变成包含手续费、滑点和调仓量的可成交结果。",
        formulas: [
          { name: "单期换手率", equation: "Turnoverₜ = ½ × Σᵢ|wᵢ,ₜ − wᵢ,ₜ₋₁|", purpose: "衡量组合从旧权重调整到新权重的交易量。", variables: ["wᵢ,ₜ：调仓后权重", "wᵢ,ₜ₋₁：调仓前权重", "½：避免买卖双重计数"], example: "两资产从 50/50 调到 70/30：换手率为 20%。", boundary: "现金是否作为资产、权重是在成交前还是成交后计算，必须统一。" },
          { name: "交易成本", equation: "Costₜ = Turnoverₜ × (Fee + Slippage)", purpose: "按调仓规模估算手续费和滑点损耗。", variables: ["Fee：单边费率", "Slippage：单边滑点", "Turnoverₜ：换手率"], example: "换手 100%，费率与滑点合计 0.2%：成本约 0.2%。", boundary: "大额订单成本通常非线性，固定滑点会低估市场冲击。" },
          { name: "净收益", equation: "r净,ₜ = r毛,ₜ − Costₜ − Fundingₜ", purpose: "从信号毛收益中扣除所有可归属交易成本。", variables: ["r毛,ₜ：成本前收益", "Costₜ：交易成本", "Fundingₜ：资金费或借贷费"], example: "毛收益 1%，成本 0.15%、资金费 0.05%：净收益 0.8%。", boundary: "忽略未成交、延迟、税费或资金费会系统性高估策略。" },
        ],
      },
      {
        title: "基准与超额",
        description: "判断复杂策略是否比简单持有或市场基准创造了额外价值。",
        formulas: [
          { name: "超额收益", equation: "aₜ = r策略,ₜ − r基准,ₜ", purpose: "逐期比较策略与基准的收益差。", variables: ["r策略,ₜ：策略收益", "r基准,ₜ：同期基准收益", "aₜ：主动收益"], example: "策略 2%、基准 1.5%：当期超额收益 0.5%。", boundary: "基准必须与标的、币种、风险暴露和时间窗口相匹配。" },
          { name: "跟踪误差", equation: "TE = Std(aₜ) × √m", purpose: "衡量超额收益相对自身均值的年化波动。", variables: ["aₜ：逐期超额收益", "Std：样本标准差", "m：年化期数"], example: "日超额标准差 0.5%：年化跟踪误差约 7.94%。", boundary: "它表示偏离基准的稳定性，不区分正偏离还是负偏离。" },
          { name: "信息比率", equation: "IR = 年化超额收益 / 跟踪误差", purpose: "衡量每单位主动风险获得的超额收益。", variables: ["年化超额收益：策略减基准", "TE：跟踪误差", "IR：信息比率"], example: "年化超额 8%、跟踪误差 10%：IR = 0.8。", boundary: "持续性取决于样本外表现，不能只用调参样本计算。" },
        ],
      },
      {
        title: "绩效与回撤",
        description: "收益、波动和最坏路径必须同时报告。",
        formulas: [
          { name: "年化波动率", equation: "σ年 = Std(rₜ) × √m", purpose: "把单期收益标准差换算为年化波动。", variables: ["rₜ：单期净收益", "m：每年期数", "σ年：年化波动率"], example: "日波动 1.2%，按 252 日年化约 19.05%。", boundary: "不同数据频率和交易日假设下的结果不能直接比较。" },
          { name: "Sharpe 比率", equation: "Sharpe = (R年 − Rf) / σ年", purpose: "衡量每单位总波动对应的年化超额收益。", variables: ["R年：策略年化收益", "Rf：无风险收益", "σ年：年化波动"], example: "年化 15%、无风险 3%、波动 12%：Sharpe = 1。", boundary: "厚尾、高偏度或平滑估值资产可能让 Sharpe 过度乐观。" },
          { name: "最大回撤", equation: "MDD = maxₜ[(Peakₜ − Vₜ) / Peakₜ]", purpose: "度量回测期间最深的峰谷损失。", variables: ["Peakₜ：截至 t 的峰值", "Vₜ：当前净值", "MDD：最大回撤"], example: "净值从 1.25 降到 1.00：回撤为 20%。", boundary: "应同时报告回撤开始、谷底、恢复时间，单一比例不完整。" },
          { name: "Calmar 比率", equation: "Calmar = CAGR / |MDD|", purpose: "比较年化复合收益和最大回撤。", variables: ["CAGR：年化复合收益", "MDD：最大回撤", "Calmar：回撤调整收益"], example: "CAGR 18%、MDD 12%：Calmar = 1.5。", boundary: "最大回撤是单个极值，对回测窗口极为敏感。" },
        ],
      },
      {
        title: "交易质量",
        description: "把总收益拆成胜率、赔率与盈亏来源，避免只看最终净值。",
        formulas: [
          { name: "胜率", equation: "WinRate = N盈利 / N总交易", purpose: "统计盈利交易占全部已完成交易的比例。", variables: ["N盈利：盈利笔数", "N总交易：完成交易笔数"], example: "100 笔交易中 43 笔盈利：胜率为 43%。", boundary: "高胜率不等于盈利，必须结合平均盈利和平均亏损。" },
          { name: "单笔期望", equation: "E = p×AvgWin − (1−p)×AvgLoss", purpose: "估计每笔交易长期平均贡献。", variables: ["p：胜率", "AvgWin：平均盈利", "AvgLoss：平均亏损绝对值"], example: "胜率 40%，平均赚 3R、平均亏 1R：期望为 0.6R。", boundary: "历史交易并非独立同分布，少量样本的期望很不稳定。" },
          { name: "盈利因子", equation: "PF = Σ盈利金额 / |Σ亏损金额|", purpose: "比较累计盈利与累计亏损的规模。", variables: ["Σ盈利金额：毛盈利", "Σ亏损金额：毛亏损", "PF：Profit Factor"], example: "累计赚 150、累计亏 100：PF = 1.5。", boundary: "若交易数少或只有一笔极端盈利，PF 可能严重失真。" },
        ],
      },
    ],
  },
  risk: {
    title: "风控公式体系",
    description: "从暴露和仓位出发，计算单笔损失、组合集中度、下行与尾部风险、流动性、衍生品和链上风险，再把结果转成门禁规则。",
    groups: [
      {
        title: "暴露与杠杆",
        description: "先知道持有多少、占账户多少，以及总风险被放大了几倍。",
        formulas: [
          { name: "名义头寸", equation: "Notional = |Quantity × Price|", purpose: "计算仓位按当前价格对应的名义金额。", variables: ["Quantity：持仓数量", "Price：标记价格", "Notional：名义头寸"], example: "持有 2 BTC、价格 60,000：名义头寸为 120,000。", boundary: "名义金额不是最坏损失，还要结合方向、止损、杠杆和跳空。" },
          { name: "资产权重", equation: "wᵢ = Notionalᵢ / Equity", purpose: "衡量单项仓位相对账户权益的大小。", variables: ["Notionalᵢ：资产 i 名义头寸", "Equity：账户权益", "wᵢ：仓位权重"], example: "权益 100,000、头寸 25,000：权重为 25%。", boundary: "衍生品权重可超过 100%，不能把它误解为已投入现金比例。" },
          { name: "总杠杆", equation: "Leverage = Σᵢ|Notionalᵢ| / Equity", purpose: "衡量所有多空头寸对账户权益的总放大倍数。", variables: ["Σ|Notionalᵢ|：总绝对暴露", "Equity：账户权益"], example: "多头 80,000、空头 40,000、权益 100,000：总杠杆 1.2 倍。", boundary: "净暴露可能很低但总杠杆很高，不能只看多空相抵后的净值。" },
        ],
      },
      {
        title: "仓位与止损",
        description: "先限定账户可承受损失，再由止损距离反推数量。",
        formulas: [
          { name: "单笔风险预算", equation: "RiskBudget = Equity × RiskPct", purpose: "把账户权益的一定比例分配给一笔交易的最大计划损失。", variables: ["Equity：账户权益", "RiskPct：单笔风险比例", "RiskBudget：风险金额"], example: "权益 100,000，单笔风险 1%：预算为 1,000。", boundary: "风险比例是上限，不是每笔必须用满；连续亏损会改变下一笔预算。" },
          { name: "止损距离", equation: "StopDistance = |Entry − Stop|", purpose: "计算每单位资产从入场到止损的价格风险。", variables: ["Entry：计划入场价", "Stop：失效/止损价"], example: "100 入场、95 止损：每单位风险为 5。", boundary: "跳空、流动性不足和滑点会让真实成交越过止损价。" },
          { name: "风险定仓", equation: "Quantity = RiskBudget / StopDistance", purpose: "反推理论上不超过风险预算的最大数量。", variables: ["RiskBudget：风险预算", "StopDistance：每单位风险", "Quantity：理论数量"], example: "预算 1,000、每单位风险 5：理论数量为 200。", boundary: "结果还必须受最大仓位、杠杆、流动性和最小下单量约束。" },
        ],
      },
      {
        title: "盈亏结构",
        description: "把目标、止损、胜率和长期期望连接起来。",
        formulas: [
          { name: "盈亏比", equation: "RR = |Target − Entry| / |Entry − Stop|", purpose: "比较潜在收益与计划损失。", variables: ["Target：目标价", "Entry：入场价", "Stop：止损价"], example: "100 入场、95 止损、115 目标：盈亏比为 3:1。", boundary: "目标价不代表一定成交，盈亏比必须和实际胜率一起评估。" },
          { name: "盈亏平衡胜率", equation: "pBE = 1 / (1 + RR)", purpose: "估算在固定盈亏比下不亏损所需的最低胜率。", variables: ["RR：盈利/亏损倍数", "pBE：盈亏平衡胜率"], example: "盈亏比 2:1 时，忽略成本的平衡胜率为 33.33%。", boundary: "手续费、滑点和盈亏分布变化都会提高真实平衡胜率。" },
          { name: "交易期望", equation: "E = p×Reward − (1−p)×Risk − Cost", purpose: "把胜率、赔率与交易成本合并为长期平均结果。", variables: ["p：胜率", "Reward：平均盈利", "Risk：平均亏损", "Cost：平均成本"], example: "胜率 40%、赚 2R、亏 1R、成本 0.05R：期望为 0.15R。", boundary: "输入必须来自足够且独立的样本，并定期检查是否发生结构变化。" },
        ],
      },
      {
        title: "组合集中度",
        description: "资产数量不等于有效分散，权重和相关性必须共同计算。",
        formulas: [
          { name: "HHI 集中度", equation: "HHI = Σᵢ wᵢ²", purpose: "通过权重平方放大大仓位对集中风险的影响。", variables: ["wᵢ：归一化资产权重", "Σwᵢ = 1", "HHI：集中度"], example: "四项等权资产：HHI = 4×0.25² = 0.25。", boundary: "HHI 只看权重，不看资产之间是否暴露于同一风险因子。" },
          { name: "有效资产数", equation: "Neff = 1 / HHI", purpose: "把集中度换算成等权组合对应的有效资产数量。", variables: ["HHI：组合集中度", "Neff：有效资产数"], example: "HHI = 0.25 时，有效资产数为 4。", boundary: "相关性很高时，即使 Neff 较大，真正分散效果仍可能很弱。" },
          { name: "组合风险", equation: "σp = √(ΣᵢΣⱼ wᵢwⱼCovᵢⱼ)", purpose: "综合计算权重、单项波动和资产间协方差。", variables: ["wᵢ、wⱼ：权重", "Covᵢⱼ：协方差", "σp：组合波动"], example: "降低高相关资产权重，通常比单纯增加资产数量更有效。", boundary: "协方差是历史估计，压力期相关结构可能快速恶化。" },
        ],
      },
      {
        title: "回撤与尾部",
        description: "用回撤观察已发生的损失路径，用 VaR/CVaR 估计分布尾部。",
        formulas: [
          { name: "当前回撤", equation: "DDₜ = (Peakₜ − Equityₜ) / Peakₜ", purpose: "衡量当前权益相对历史峰值的跌幅。", variables: ["Peakₜ：历史峰值权益", "Equityₜ：当前权益", "DDₜ：当前回撤"], example: "峰值 100,000、当前 88,000：回撤为 12%。", boundary: "回撤是路径指标，不能用单期收益分布完全替代。" },
          { name: "回本所需涨幅", equation: "Recovery = 1 / (1 − DD) − 1", purpose: "计算发生回撤后恢复到原峰值所需的上涨比例。", variables: ["DD：回撤比例", "Recovery：回本涨幅"], example: "亏损 20% 后，需要上涨 25% 才能回本。", boundary: "回撤越深，恢复要求非线性上升，因此门禁应在失控前触发。" },
          { name: "历史 VaR", equation: "VaRα = −Quantile₁₋α(R)", purpose: "估计给定置信水平下，正常分布尾部的损失阈值。", variables: ["α：置信水平", "R：历史收益样本", "Quantile：分位数"], example: "95% VaR 为 3%，表示样本中约 5% 时段损失超过 3%。", boundary: "VaR 不说明超过阈值后会亏多少，也不保证未来尾部与历史相同。" },
          { name: "条件 VaR / ES", equation: "CVaRα = E[Loss | Loss ≥ VaRα]", purpose: "计算超过 VaR 阈值后的平均尾部损失。", variables: ["Loss：损失变量", "VaRα：尾部阈值", "CVaR：尾部平均损失"], example: "95% VaR 为 3%、最差 5% 平均亏 5%：CVaR 为 5%。", boundary: "极端样本很少，CVaR 估计误差可能很大，需要压力测试补充。" },
        ],
      },
    ],
  },
};

function orderGroups(domain: FormulaDomain, core: FormulaGroup[], advanced: FormulaGroup[]) {
  const ordered = domain === "math"
    ? [advanced[0], advanced[8], core[0], core[1], core[2], advanced[1], advanced[2], core[3], advanced[3], advanced[4], advanced[9], advanced[5], advanced[10], advanced[6], core[4], advanced[11], advanced[7]]
    : domain === "backtest"
      ? [advanced[0], core[0], advanced[1], core[1], core[2], core[3], core[4], advanced[2]]
      : domain === "risk"
        ? [core[0], core[1], core[2], core[3], advanced[0], core[4], advanced[1], advanced[2]]
        : core;
  return ordered.filter((group): group is FormulaGroup => group !== undefined);
}

export function FormulaHandbook({ domain }: { domain: FormulaDomain }) {
  const system = SYSTEMS[domain];
  const [groupIndex, setGroupIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [completedGroups, setCompletedGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(`formula-progress:${domain}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const groups = useMemo(() => orderGroups(domain, system.groups, ADVANCED_GROUPS[domain]), [domain, system.groups]);
  const group = groups[groupIndex] ?? groups[0];
  const formulaCount = useMemo(() => groups.reduce((total, item) => total + item.formulas.length, 0), [groups]);
  const guide = KLINE_GUIDES[group.title] ?? LEARNING_GUIDES[group.title] ?? FALLBACK_GUIDE;
  const sources = guide.sourceIds.map((id) => KLINE_SOURCES[id] ?? LEARNING_SOURCES[id]).filter((source) => source !== undefined);
  const completedCount = groups.filter((item) => completedGroups.includes(item.title)).length;
  const progress = groups.length ? completedCount / groups.length * 100 : 0;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const formulaEntries = useMemo(() => {
    const allEntries = groups.flatMap((item) => item.formulas.map((formula, index) => ({ formula, index, groupTitle: item.title })));
    if (!normalizedQuery) {
      return group.formulas.map((formula, index) => ({ formula, index, groupTitle: group.title }));
    }
    return allEntries.filter(({ formula, groupTitle }) => [
      groupTitle,
      formula.name,
      formula.equation,
      formula.purpose,
      formula.example,
      formula.boundary,
      ...formula.variables,
    ].join(" ").toLocaleLowerCase().includes(normalizedQuery));
  }, [group, groups, normalizedQuery]);

  useEffect(() => {
    window.localStorage.setItem(`formula-progress:${domain}`, JSON.stringify(completedGroups));
  }, [completedGroups, domain]);

  function selectGroup(index: number) {
    setGroupIndex(index);
    setQuery("");
  }

  function toggleCompleted() {
    setCompletedGroups((current) => current.includes(group.title)
      ? current.filter((title) => title !== group.title)
      : [...current, group.title]);
  }

  return (
    <section className="formula-handbook" data-domain={domain}>
      <header className="formula-handbook-header">
        <div className="formula-handbook-icon"><BookOutlined /></div>
        <div>
          <span>FORMULA HANDBOOK · 系统公式课</span>
          <h2>{system.title}</h2>
          <p>{system.description}</p>
        </div>
        <strong>{groups.length} 类 · {formulaCount} 个公式</strong>
      </header>

      <div className="formula-command-bar">
        <label className="formula-search-box">
          <SearchOutlined />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公式、符号、用途或风险边界" aria-label="搜索公式" />
          {query ? <button type="button" onClick={() => setQuery("")}>清除</button> : <kbd>{formulaCount} 条</kbd>}
        </label>
        <div className="formula-learning-progress">
          <div><span>学习进度</span><strong>{completedCount} / {groups.length} 章</strong></div>
          <i><b style={{ width: `${progress}%` }} /></i>
          <small>进度保存在当前浏览器</small>
        </div>
      </div>

      <div className="formula-study-flow" aria-label="公式学习方法">
        <span><b>01</b>读章节导学</span><i>→</i><span><b>02</b>理解公式与符号</span><i>→</i><span><b>03</b>完成复算任务</span><i>→</i><span><b>04</b>核对边界与来源</span>
      </div>

      <nav className="formula-group-tabs" aria-label="公式分类">
        {groups.map((item, index) => (
          <button type="button" className={`${index === groupIndex && !query ? "active " : ""}${completedGroups.includes(item.title) ? "completed" : ""}`} key={item.title} onClick={() => selectGroup(index)}>
            <b>{String(index + 1).padStart(2, "0")}</b><span>{item.title}</span><small>{completedGroups.includes(item.title) ? <CheckCircleFilled /> : `${item.formulas.length} 个`}</small>
          </button>
        ))}
      </nav>

      {normalizedQuery ? (
        <div className="formula-search-summary"><SearchOutlined /><div><strong>搜索结果</strong><span>“{query.trim()}”匹配 {formulaEntries.length} 个公式；搜索范围包含公式、符号、用途、例题与风险边界。</span></div></div>
      ) : (
        <>
          <section className="formula-chapter-guide">
            <header>
              <div><CalculatorOutlined /><span><b>{group.title}</b><small>{group.description}</small></span></div>
              <div className="formula-guide-meta"><em>{guide.stage}</em><em>{guide.difficulty}</em><em><ClockCircleOutlined /> {guide.minutes} 分钟</em></div>
              <button type="button" className={completedGroups.includes(group.title) ? "completed" : ""} onClick={toggleCompleted}>
                <CheckCircleFilled />{completedGroups.includes(group.title) ? "已完成本章" : "标记本章完成"}
              </button>
            </header>
            <div className="formula-guide-grid">
              <article className="formula-guide-overview"><BulbOutlined /><div><b>为什么学习</b><p>{guide.overview}</p></div></article>
              <article><b>本章目标</b><ul>{guide.objectives.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article><b>先修知识</b><div className="formula-prerequisite-list">{guide.prerequisites.map((item) => <span key={item}>{item}</span>)}</div></article>
              <article className="formula-guide-exercise"><ExperimentOutlined /><div><b>复算任务</b><p>{guide.exercise}</p></div></article>
              <article className="formula-guide-pitfalls"><WarningOutlined /><div><b>常见误区</b><ul>{guide.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul></div></article>
            </div>
            <div className="formula-source-list">
              <div><BookOutlined /><span><b>权威延伸阅读</b><small>课程内容按公开教材、论文和官方技术文档组织；链接在新窗口打开。</small></span></div>
              {sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><span>{source.provider}</span><strong>{source.title}</strong><small>{source.note}</small><LinkOutlined /></a>)}
            </div>
          </section>
          <div className="formula-group-intro"><CalculatorOutlined /><div><strong>{group.title} · 核心公式</strong><span>建议先读章节导学，再逐项检查公式的变量口径、例题和失效条件。</span></div></div>
        </>
      )}

      <div className="formula-card-grid">
        {formulaEntries.map(({ formula, index, groupTitle }) => (
          <article className="formula-knowledge-card" key={formula.name}>
            <div className="formula-card-title"><span>F{String(index + 1).padStart(2, "0")}</span><h3>{formula.name}</h3>{normalizedQuery ? <em>{groupTitle}</em> : null}</div>
            <div className="formula-card-equation" aria-label={`${formula.name}公式`}>{formula.equation}</div>
            <p className="formula-card-purpose">{formula.purpose}</p>
            <div className="formula-variable-list"><b>符号说明</b>{formula.variables.map((variable) => <span key={variable}>{variable}</span>)}</div>
            <div className="formula-example"><CalculatorOutlined /><div><b>代入示例</b><span>{formula.example}</span></div></div>
            <div className="formula-warning"><WarningOutlined /><div><b>使用边界</b><span>{formula.boundary}</span></div></div>
          </article>
        ))}
      </div>
      {normalizedQuery && formulaEntries.length === 0 ? <div className="formula-empty-search"><SearchOutlined /><strong>没有找到匹配公式</strong><span>可以尝试“波动”“回撤”“协方差”“滑点”“VaR”或具体符号。</span></div> : null}
    </section>
  );
}
