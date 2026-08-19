import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
  FileDoneOutlined,
  SafetyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Input, InputNumber, Segmented, Slider } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import { FormulaHandbook } from "./FormulaHandbook";
import { Abs, Fn, Fraction, Symbol as Sym } from "./FormulaNotation";
import { LearningCourseNav } from "./LearningCourseNav";
import "./learning-layout.css";
import "./risk-learning.css";

type LessonLevel = "基础" | "核心" | "进阶" | "落地";

const LESSONS: ReadonlyArray<{ title: string; short: string; phase: string; level: LessonLevel }> = [
  { title: "风险治理与防线", short: "先定义风险、责任人与处置层级", phase: "治理基础", level: "基础" },
  { title: "风险数据与阈值校准", short: "阈值来自样本和容忍度，不是拍脑袋", phase: "规则设计", level: "核心" },
  { title: "暴露、杠杆与风险预算", short: "先限定损失，再反推仓位", phase: "事前控制", level: "核心" },
  { title: "止损、跳空与盈亏结构", short: "计划止损不等于真实成交损失", phase: "交易风险", level: "核心" },
  { title: "组合集中与相关压力", short: "资产数量不等于有效分散", phase: "组合风险", level: "核心" },
  { title: "流动性、容量与执行门禁", short: "订单能否以合理成本成交", phase: "执行风险", level: "进阶" },
  { title: "VaR、ES 与情景压力", short: "分布尾部必须与具体情景互证", phase: "尾部风险", level: "进阶" },
  { title: "风险蒙特卡洛与破产概率", short: "用坏路径校准仓位和回撤红线", phase: "路径风险", level: "进阶" },
  { title: "衍生品与链上清算", short: "保证金、预言机和健康因子", phase: "Web3 风险", level: "进阶" },
  { title: "门禁、熔断与恢复治理", short: "明确何时预警、拒单、暂停和恢复", phase: "运行治理", level: "落地" },
];

const QUIZZES = [
  { question: "行情数据突然出现零成交量但价格大幅变化，第一道防线是什么？", options: ["立即追涨", "暂停使用并核验数据源", "提高仓位"], answer: 1, reason: "异常数据会污染信号和订单，必须先隔离数据，再决定是否降级或熔断。" },
  { question: "一个阈值只在平静期样本上回放有效，最合理的结论是什么？", options: ["阈值已经可靠", "还需要压力期、误报率和漏报率验证", "直接设为硬阻断"], answer: 1, reason: "风控阈值必须覆盖多种状态，并权衡误报、漏报和响应成本。" },
  { question: "账户 10 万元，单笔最多风险 1%，止损距离 5%，理论最大名义仓位是多少？", options: ["1 万元", "2 万元", "5 万元"], answer: 1, reason: "风险预算 1,000 元 ÷ 5% 止损距离 = 2 万元；之后还要施加杠杆和容量上限。" },
  { question: "止损距离 5%，但跳空和滑点额外造成 2% 损失，实际风险应按什么估计？", options: ["仍按 5%", "至少按 7% 压力损失", "忽略跳空"], answer: 1, reason: "计划止损不是成交保证，压力定仓必须纳入跳空和滑点。" },
  { question: "四个资产各占 25%，组合是否已经充分分散？", options: ["一定是", "不一定，还要看相关性和共同暴露", "一定不是"], answer: 1, reason: "表面权重均衡不代表风险均衡，高相关资产仍可能同时下跌。" },
  { question: "订单参与率超过门槛且预估冲击快速上升，系统应该怎样处理？", options: ["强制一次成交", "缩量、拆单或拒单", "忽略容量"], answer: 1, reason: "容量和流动性是成交前门禁，超过预算时应降低规模或阻断订单。" },
  { question: "95% VaR 为 3%，它能说明最差 5% 平均亏多少吗？", options: ["能", "不能，需要 ES/CVaR", "等于最大回撤"], answer: 1, reason: "VaR 只给出尾部阈值，ES 才描述越过阈值后的平均损失。" },
  { question: "风险蒙特卡洛最适合在什么时候使用？", options: ["基础数据还未核验时", "规则和成本冻结后，用于校准仓位与回撤门槛", "用于证明未来盈利"], answer: 1, reason: "风险蒙特卡洛应建立在可信回测和冻结规则之上，用坏路径检查风险预算。" },
  { question: "DeFi 健康因子接近 1，同时预言机资产可能下跌，最优先检查什么？", options: ["页面颜色", "冲击后的抵押价值与清算缓冲", "历史最高价"], answer: 1, reason: "接近清算线时必须按预言机冲击重算健康因子，并预留拥堵和滑点缓冲。" },
  { question: "熔断原因消失后，系统是否应该立刻恢复全部仓位？", options: ["是", "否，应完成数据复核、状态同步和分级恢复", "只看价格上涨"], answer: 1, reason: "恢复同样需要门禁，通常按只读、仿真、限额到正常逐级放开。" },
] as const;

function finite(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, lower: number, upper: number) {
  return Math.min(upper, Math.max(lower, value));
}

function RiskFormula({ children, meaning }: { children: ReactNode; meaning: string }) {
  return <div className="risk-formula"><div className="formula-notation">{children}</div><span className="formula-meaning">{meaning}</span></div>;
}

function RiskResult({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "safe" | "warn" | "block" | "neutral" }) {
  return <div className={`risk-result risk-result-${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

const RISK_CASES = {
  market: { name: "市场风险", symptom: "价格跳空、波动放大、相关性突然上升", control: "缩减仓位、提高保证金缓冲、触发回撤门禁", owner: "策略 + 风控" },
  liquidity: { name: "流动性风险", symptom: "买卖价差扩大、深度不足、冲击成本升高", control: "限制订单规模、拆单、超过滑点阈值拒单", owner: "执行 + 风控" },
  data: { name: "数据风险", symptom: "零成交量、价格不动、时间戳断层、跨源冲突", control: "隔离异常数据、切换备用源、停止产生新信号", owner: "数据 + 风控" },
  model: { name: "模型风险", symptom: "样本外失效、参数敏感、回测与观察偏离", control: "稳健性检查、降级规则、限制策略风险预算", owner: "研究 + 风控" },
  operation: { name: "执行风险", symptom: "网络延迟、RPC 故障、重复订单、状态不同步", control: "幂等检查、超时取消、紧急熔断、人工复核", owner: "执行 + 运维" },
} as const;

function RiskMapLab() {
  const [active, setActive] = useState<keyof typeof RISK_CASES>("market");
  const item = RISK_CASES[active];
  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>风控是约束决策过程，不是亏损后的止损按钮</h3>
      <p>每项风险都要有可观察信号、责任人、预警阈值、硬阻断条件和恢复步骤。好的风控先防脏数据，再限制暴露，最后才是熔断。</p>
      <div className="risk-defense-flow"><span>数据门禁</span><b>→</b><span>信号约束</span><b>→</b><span>仓位限制</span><b>→</b><span>执行拦截</span><b>→</b><span>熔断恢复</span></div>
      <div className="risk-boundary">所有风控动作都应留下规则编号、输入快照、触发原因、时间和责任边界。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>风险地图</strong><span>选择一种风险查看可观察现象和防线</span></div></header>
      <div className="risk-case-tabs">{Object.entries(RISK_CASES).map(([key, value]) => <button type="button" className={active === key ? "active" : ""} key={key} onClick={() => setActive(key as keyof typeof RISK_CASES)}>{value.name}</button>)}</div>
      <div className="risk-case-detail"><div><span>可观察现象</span><p>{item.symptom}</p></div><div><span>控制措施</span><p>{item.control}</p></div><div><span>责任边界</span><p>{item.owner}</p></div></div>
    </section>
  </div>;
}

function ThresholdCalibrationLab() {
  const [observations, setObservations] = useState(720);
  const [regimes, setRegimes] = useState(3);
  const [alerts, setAlerts] = useState(24);
  const [falseAlerts, setFalseAlerts] = useState(5);
  const alertRate = observations > 0 ? alerts / observations * 100 : 0;
  const precision = alerts > 0 ? (alerts - Math.min(alerts, falseAlerts)) / alerts * 100 : 0;
  const observationsPerRegime = regimes > 0 ? observations / regimes : 0;
  const passed = observations >= 500 && regimes >= 3 && precision >= 70;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>阈值来自损失容忍度、经验分布和处置成本</h3>
      <p>先定义要防止的伤害，再用历史与压力样本估计指标分布，分别校准预警和阻断阈值。最后在影子模式回放误报、漏报和响应延迟。</p>
      <div className="risk-calibration-steps"><span>01 定义损害</span><span>02 冻结样本</span><span>03 估计分布</span><span>04 回放事故</span><span>05 影子运行</span></div>
      <div className="risk-method-grid"><div><b>预警阈值</b><span>允许继续观察或缩量，重点控制误报成本。</span></div><div><b>阻断阈值</b><span>拒绝新增风险，重点避免漏掉不可逆损失。</span></div></div>
      <div className="risk-boundary">只在平静期有效的阈值不是可靠门禁。至少覆盖正常、波动和事故/压力状态。</div>
    </section>
    <section className="risk-simulator">
      <header><ExperimentOutlined /><div><strong>阈值验证台</strong><span>检查样本覆盖、告警密度和有效告警率</span></div><StatusPill tone={passed ? "profit" : "ai"}>{passed ? "可进入影子运行" : "证据不足"}</StatusPill></header>
      <div className="risk-input-grid">
        <label><span>历史观测数</span><InputNumber min={50} max={10000} value={observations} onChange={(value) => setObservations(finite(value, 720))} /></label>
        <label><span>覆盖市场状态</span><InputNumber min={1} max={8} value={regimes} addonAfter="类" onChange={(value) => setRegimes(finite(value, 3))} /></label>
        <label><span>触发告警数</span><InputNumber min={0} max={observations} value={alerts} onChange={(value) => setAlerts(finite(value, 24))} /></label>
        <label><span>其中误报数</span><InputNumber min={0} max={alerts} value={falseAlerts} onChange={(value) => setFalseAlerts(finite(value, 5))} /></label>
      </div>
      <div className="risk-results"><RiskResult label="告警率" value={`${alertRate.toFixed(2)}%`} note="过高会造成告警疲劳" /><RiskResult label="有效告警率" value={`${precision.toFixed(1)}%`} tone={precision >= 70 ? "safe" : "warn"} /><RiskResult label="每状态观测" value={observationsPerRegime.toFixed(0)} tone={observationsPerRegime >= 150 ? "safe" : "warn"} /><RiskResult label="校准结论" value={passed ? "进入影子模式" : "继续补样本"} tone={passed ? "safe" : "block"} /></div>
    </section>
  </div>;
}

function PositionLab() {
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(95);
  const [maxLeverage, setMaxLeverage] = useState(1.5);
  const riskBudget = capital * riskPct / 100;
  const stopPct = entry > 0 ? Math.abs(entry - stop) / entry * 100 : 0;
  const riskSizedQty = Math.abs(entry - stop) > 0 ? riskBudget / Math.abs(entry - stop) : 0;
  const leverageCapQty = entry > 0 ? capital * maxLeverage / entry : 0;
  const qty = Math.min(riskSizedQty, leverageCapQty);
  const notional = qty * entry;
  const capitalUse = capital > 0 ? notional / capital * 100 : 0;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>先限定账户损失，再由多道上限取最小值</h3>
      <p>风险定仓只是第一步；最终数量还必须同时受最大仓位、总杠杆、市场容量、保证金和最小下单单位约束。</p>
      <RiskFormula meaning="这笔交易允许损失的最大金额"><Fn>风险预算</Fn> = <Fn>账户权益</Fn> × <Fn>单笔风险率</Fn></RiskFormula>
      <RiskFormula meaning="最终仓位取所有约束的最小值"><Fn>数量</Fn> = min(<Fraction top={<Fn>风险预算</Fn>} bottom={<Abs><Fn>入场价</Fn> − <Fn>止损价</Fn></Abs>} />, <Fn>杠杆上限数量</Fn>, <Fn>容量上限数量</Fn>)</RiskFormula>
      <div className="risk-boundary">风险比例是硬上限，不是每笔必须用满；连续亏损后权益下降，下一笔预算也必须同步下降。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>多约束仓位计算器</strong><span>以做多场景为例</span></div></header>
      <div className="risk-input-grid">
        <label><span>账户权益</span><InputNumber min={1} value={capital} onChange={(value) => setCapital(finite(value, 100000))} /></label>
        <label><span>单笔风险</span><InputNumber min={0.1} max={10} step={0.1} addonAfter="%" value={riskPct} onChange={(value) => setRiskPct(finite(value, 1))} /></label>
        <label><span>入场价</span><InputNumber min={0.01} value={entry} onChange={(value) => setEntry(finite(value, 100))} /></label>
        <label><span>止损价</span><InputNumber min={0.01} value={stop} onChange={(value) => setStop(finite(value, 95))} /></label>
        <label><span>最大总杠杆</span><InputNumber min={0.1} max={10} step={0.1} addonAfter="x" value={maxLeverage} onChange={(value) => setMaxLeverage(finite(value, 1.5))} /></label>
      </div>
      <div className="risk-results"><RiskResult label="风险预算" value={`¥${riskBudget.toFixed(0)}`} tone="warn" /><RiskResult label="止损距离" value={`${stopPct.toFixed(2)}%`} /><RiskResult label="最终最大数量" value={qty.toFixed(2)} tone="safe" note={qty < riskSizedQty ? "受杠杆上限约束" : "受风险预算约束"} /><RiskResult label="名义仓位" value={`¥${notional.toFixed(0)}`} tone={capitalUse > 100 ? "warn" : "neutral"} note={`占权益 ${capitalUse.toFixed(1)}%`} /></div>
    </section>
  </div>;
}

function RewardRiskLab() {
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(95);
  const [target, setTarget] = useState(115);
  const [gapPct, setGapPct] = useState(1.5);
  const plannedRisk = Math.abs(entry - stop);
  const stressedRisk = plannedRisk + entry * gapPct / 100;
  const reward = Math.abs(target - entry);
  const plannedRatio = plannedRisk > 0 ? reward / plannedRisk : 0;
  const stressedRatio = stressedRisk > 0 ? reward / stressedRisk : 0;
  const breakeven = stressedRatio > 0 ? 1 / (1 + stressedRatio) * 100 : 100;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>止损价是规则失效点，不是成交价格保证</h3>
      <p>跳空、流动性不足、链上拥堵和交易所故障都可能让真实退出越过止损。因此定仓应同时计算计划风险与压力风险。</p>
      <RiskFormula meaning="压力风险加入跳空和滑点缓冲"><Fn>压力损失</Fn> = <Abs><Fn>入场价</Fn> − <Fn>止损价</Fn></Abs> + <Fn>跳空/滑点</Fn></RiskFormula>
      <RiskFormula meaning="用压力风险计算更保守的盈亏平衡胜率"><Fn>盈亏平衡胜率</Fn> = <Fraction top={1} bottom={<>1 + <Fn>压力盈亏比</Fn></>} /></RiskFormula>
      <div className="risk-boundary">止损必须对应假设失效，而不是任意距离；压力缓冲应来自历史跳空、滑点和事故回放。</div>
    </section>
    <section className="risk-simulator">
      <header><WarningOutlined /><div><strong>止损压力检查器</strong><span>比较计划损失与真实可执行损失</span></div></header>
      <div className="risk-input-grid">
        <label><span>入场价</span><InputNumber min={0.01} value={entry} onChange={(value) => setEntry(finite(value, 100))} /></label>
        <label><span>止损价</span><InputNumber min={0.01} value={stop} onChange={(value) => setStop(finite(value, 95))} /></label>
        <label><span>目标价</span><InputNumber min={0.01} value={target} onChange={(value) => setTarget(finite(value, 115))} /></label>
        <label><span>跳空与滑点压力</span><InputNumber min={0} max={20} step={0.1} addonAfter="%" value={gapPct} onChange={(value) => setGapPct(finite(value, 1.5))} /></label>
      </div>
      <div className="risk-results"><RiskResult label="计划风险" value={plannedRisk.toFixed(2)} tone="warn" /><RiskResult label="压力风险" value={stressedRisk.toFixed(2)} tone="block" /><RiskResult label="计划盈亏比" value={`${plannedRatio.toFixed(2)} : 1`} /><RiskResult label="压力盈亏比" value={`${stressedRatio.toFixed(2)} : 1`} tone={stressedRatio >= 2 ? "safe" : "warn"} /><RiskResult label="压力平衡胜率" value={`${breakeven.toFixed(1)}%`} note="未计策略漂移" /></div>
    </section>
  </div>;
}

function parseWeights(text: string) {
  return text.split(/[，,\s]+/).map(Number).filter((value) => Number.isFinite(value) && value >= 0);
}

function ConcentrationLab() {
  const [text, setText] = useState("40, 30, 20, 10");
  const [correlation, setCorrelation] = useState(0.25);
  const raw = useMemo(() => parseWeights(text), [text]);
  const sum = raw.reduce((total, value) => total + value, 0);
  const weights = sum > 0 ? raw.map((value) => value / sum) : [];
  const hhi = weights.reduce((total, value) => total + value ** 2, 0);
  const effectiveN = hhi > 0 ? 1 / hhi : 0;
  const correlatedHhi = hhi + correlation * (1 - hhi);
  const correlationAdjustedN = correlatedHhi > 0 ? 1 / correlatedHhi : 0;
  const maxWeight = weights.length ? Math.max(...weights) * 100 : 0;
  const status = maxWeight > 50 || correlationAdjustedN < 1.5 ? "block" : maxWeight > 35 || correlationAdjustedN < 2.5 ? "warn" : "safe";

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>分散要同时看权重、相关性和共同风险因子</h3>
      <p>HHI 只描述表面权重。压力期相关性上升时，名义上的多个资产可能退化成同一笔方向交易。</p>
      <RiskFormula meaning="权重平方放大大仓位的集中影响"><Fn>HHI</Fn> = <Fn>Σ</Fn> <Sym sub="i" sup="2">w</Sym></RiskFormula>
      <RiskFormula meaning="等波动、等相关的简化相关调整"><Sym sub="corr">HHI</Sym> = <Fn>HHI</Fn> + <Sym>ρ</Sym>(1 − <Fn>HHI</Fn>)</RiskFormula>
      <div className="risk-boundary">真实组合还要使用协方差矩阵、因子暴露和压力相关矩阵；这里用于展示相关性如何吞噬表面分散。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>组合集中与相关压力</strong><span>输入权重并提高压力相关性</span></div></header>
      <label className="risk-series-input"><span>资产权重（%）</span><Input value={text} onChange={(event) => setText(event.target.value)} /></label>
      <label className="risk-spread-slider"><span>压力平均相关 <b>{correlation.toFixed(2)}</b></span><Slider min={0} max={0.95} step={0.05} value={correlation} onChange={setCorrelation} /></label>
      <div className="risk-weight-bars">{weights.map((weight, index) => <div key={index}><span>资产 {index + 1}</span><i style={{ width: `${weight * 100}%` }} /><b>{(weight * 100).toFixed(1)}%</b></div>)}</div>
      <div className="risk-results"><RiskResult label="权重 HHI" value={hhi.toFixed(3)} /><RiskResult label="名义有效资产" value={effectiveN.toFixed(2)} /><RiskResult label="相关调整有效资产" value={correlationAdjustedN.toFixed(2)} tone={status} /><RiskResult label="最大单项权重" value={`${maxWeight.toFixed(1)}%`} tone={status} /></div>
    </section>
  </div>;
}

function LiquidityLab() {
  const [orderSize, setOrderSize] = useState(250000);
  const [marketVolume, setMarketVolume] = useState(10000000);
  const [spreadBps, setSpreadBps] = useState(12);
  const [volatility, setVolatility] = useState(3);
  const [maxParticipation, setMaxParticipation] = useState(2);
  const participation = marketVolume > 0 ? orderSize / marketVolume * 100 : 100;
  const impact = marketVolume > 0 ? 0.5 * volatility * Math.sqrt(orderSize / marketVolume) : 100;
  const estimatedCost = spreadBps / 100 + impact;
  const status = participation > maxParticipation * 1.5 || estimatedCost > 1 ? "block" : participation > maxParticipation || estimatedCost > 0.5 ? "warn" : "safe";
  const action = status === "block" ? "拒单 / 缩量" : status === "warn" ? "拆单 / 降速" : "允许提交";

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>流动性门禁必须在提交订单前计算</h3>
      <p>用决策时可见的点差、深度、成交量预测和波动估计订单容量。参与率越高，市场冲击通常呈非线性上升。</p>
      <RiskFormula meaning="订单相对同期市场容量"><Fn>参与率</Fn> = <Fraction top={<Fn>订单金额</Fn>} bottom={<Fn>市场成交额</Fn>} /></RiskFormula>
      <RiskFormula meaning="平方根冲击的简化教学近似"><Fn>冲击</Fn> ≈ 0.5 × <Sym>σ</Sym> × √(<Fn>订单</Fn>/<Fn>市场量</Fn>)</RiskFormula>
      <div className="risk-boundary">市场成交量是预测输入，不应偷看事后整根 K 线；薄订单簿、极端行情和链上 MEV 需要更严格门槛。</div>
    </section>
    <section className="risk-simulator">
      <header><ExperimentOutlined /><div><strong>容量与冲击门禁</strong><span>估算参与率、冲击和处置动作</span></div><StatusPill tone={status === "safe" ? "profit" : status === "warn" ? "ai" : "loss"}>{action}</StatusPill></header>
      <div className="risk-input-grid">
        <label><span>订单金额</span><InputNumber min={1} value={orderSize} onChange={(value) => setOrderSize(finite(value, 250000))} /></label>
        <label><span>同期市场成交额预测</span><InputNumber min={1} value={marketVolume} onChange={(value) => setMarketVolume(finite(value, 10000000))} /></label>
        <label><span>买卖价差</span><InputNumber min={0} value={spreadBps} addonAfter="bp" onChange={(value) => setSpreadBps(finite(value, 12))} /></label>
        <label><span>同期波动</span><InputNumber min={0.1} max={30} step={0.1} value={volatility} addonAfter="%" onChange={(value) => setVolatility(finite(value, 3))} /></label>
        <label><span>最大参与率</span><InputNumber min={0.1} max={20} step={0.1} value={maxParticipation} addonAfter="%" onChange={(value) => setMaxParticipation(finite(value, 2))} /></label>
      </div>
      <div className="risk-results"><RiskResult label="预计参与率" value={`${participation.toFixed(2)}%`} tone={participation <= maxParticipation ? "safe" : "block"} /><RiskResult label="平方根冲击" value={`${impact.toFixed(2)}%`} tone={impact <= 0.5 ? "safe" : "warn"} /><RiskResult label="点差 + 冲击" value={`${estimatedCost.toFixed(2)}%`} tone={status} /><RiskResult label="门禁动作" value={action} tone={status} /></div>
    </section>
  </div>;
}

function TailStressLab() {
  const [equity, setEquity] = useState(100000);
  const [exposurePct, setExposurePct] = useState(120);
  const [varPct, setVarPct] = useState(3);
  const [esPct, setEsPct] = useState(5);
  const [scenarioPct, setScenarioPct] = useState(9);
  const [lossLimit, setLossLimit] = useState(8);
  const exposure = equity * exposurePct / 100;
  const varLoss = exposure * varPct / 100;
  const esLoss = exposure * esPct / 100;
  const scenarioLoss = exposure * scenarioPct / 100;
  const worstAccountLossPct = equity > 0 ? Math.max(esLoss, scenarioLoss) / equity * 100 : 100;
  const status = worstAccountLossPct > lossLimit ? "block" : worstAccountLossPct > lossLimit * 0.75 ? "warn" : "safe";

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>VaR 给阈值，ES 看越界后平均多坏，情景压力检查历史之外</h3>
      <p>三者回答不同问题，必须同时展示。历史尾部很少，不能只靠一个分位数决定仓位或资本缓冲。</p>
      <div className="risk-method-grid three"><div><b>VaR</b><span>正常条件下的尾部损失阈值</span></div><div><b>ES / CVaR</b><span>越过 VaR 后的平均尾部损失</span></div><div><b>情景压力</b><span>价格、相关、流动性和系统故障的联合冲击</span></div></div>
      <div className="risk-stress-scenarios"><span>市场跳空</span><span>相关性趋近 1</span><span>流动性减半</span><span>资金费反转</span><span>预言机延迟</span></div>
      <div className="risk-boundary">压力情景应来自历史事故、机制分析和反向压力测试，而不是只选择容易通过的冲击。</div>
    </section>
    <section className="risk-simulator">
      <header><WarningOutlined /><div><strong>尾部与情景压力台</strong><span>把头寸损失换算成账户损失</span></div><StatusPill tone={status === "safe" ? "profit" : status === "warn" ? "ai" : "loss"}>{status === "safe" ? "预算内" : status === "warn" ? "接近红线" : "超过红线"}</StatusPill></header>
      <div className="risk-input-grid">
        <label><span>账户权益</span><InputNumber min={1} value={equity} onChange={(value) => setEquity(finite(value, 100000))} /></label>
        <label><span>总暴露</span><InputNumber min={0} max={500} value={exposurePct} addonAfter="%" onChange={(value) => setExposurePct(finite(value, 120))} /></label>
        <label><span>95% VaR</span><InputNumber min={0} max={50} step={0.1} value={varPct} addonAfter="%" onChange={(value) => setVarPct(finite(value, 3))} /></label>
        <label><span>95% ES</span><InputNumber min={0} max={80} step={0.1} value={esPct} addonAfter="%" onChange={(value) => setEsPct(finite(value, 5))} /></label>
        <label><span>联合压力损失</span><InputNumber min={0} max={100} step={0.5} value={scenarioPct} addonAfter="%" onChange={(value) => setScenarioPct(finite(value, 9))} /></label>
        <label><span>账户损失红线</span><InputNumber min={0.5} max={50} step={0.5} value={lossLimit} addonAfter="%" onChange={(value) => setLossLimit(finite(value, 8))} /></label>
      </div>
      <div className="risk-results"><RiskResult label="VaR 金额" value={`¥${varLoss.toFixed(0)}`} /><RiskResult label="ES 金额" value={`¥${esLoss.toFixed(0)}`} tone="warn" /><RiskResult label="情景损失" value={`¥${scenarioLoss.toFixed(0)}`} tone={status} /><RiskResult label="最坏账户损失" value={`${worstAccountLossPct.toFixed(2)}%`} tone={status} /></div>
    </section>
  </div>;
}

function riskRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let current = value;
    current = Math.imul(current ^ current >>> 15, current | 1);
    current ^= current + Math.imul(current ^ current >>> 7, current | 61);
    return ((current ^ current >>> 14) >>> 0) / 4294967296;
  };
}

function riskPercentile(sorted: number[], probability: number) {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function simulateRiskPaths({ winRate, winR, lossR, riskPct, trades, paths, drawdownLimit, stressed }: { winRate: number; winR: number; lossR: number; riskPct: number; trades: number; paths: number; drawdownLimit: number; stressed: boolean }) {
  const random = riskRandom(stressed ? 20260917 : 20260819);
  const drawdowns: number[] = [];
  const endings: number[] = [];
  const losingStreaks: number[] = [];
  let breaches = 0;
  for (let path = 0; path < paths; path += 1) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    let currentLosses = 0;
    let maxLosses = 0;
    let regime = 0;
    for (let trade = 0; trade < trades; trade += 1) {
      if (trade % 7 === 0) regime = (random() - 0.5) * (stressed ? 0.24 : 0.14);
      const effectiveWinRate = clamp(winRate / 100 + regime - (stressed ? 0.07 : 0), 0.05, 0.95);
      const won = random() < effectiveWinRate;
      const resultR = won ? winR * (stressed ? 0.85 : 1) : -lossR * (stressed ? 1.2 : 1);
      equity *= Math.max(0.01, 1 + resultR * riskPct / 100);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, 1 - equity / peak);
      currentLosses = won ? 0 : currentLosses + 1;
      maxLosses = Math.max(maxLosses, currentLosses);
    }
    const drawdownPct = maxDrawdown * 100;
    drawdowns.push(drawdownPct);
    endings.push((equity - 1) * 100);
    losingStreaks.push(maxLosses);
    if (drawdownPct >= drawdownLimit) breaches += 1;
  }
  drawdowns.sort((left, right) => left - right);
  endings.sort((left, right) => left - right);
  losingStreaks.sort((left, right) => left - right);
  return { endingP05: riskPercentile(endings, 0.05), drawdownP50: riskPercentile(drawdowns, 0.5), drawdownP95: riskPercentile(drawdowns, 0.95), lossStreakP95: riskPercentile(losingStreaks, 0.95), breachProbability: breaches / paths * 100 };
}

function RiskMonteCarloLab() {
  const [scenario, setScenario] = useState<"base" | "stress">("stress");
  const [winRate, setWinRate] = useState(44);
  const [winR, setWinR] = useState(1.6);
  const [lossR, setLossR] = useState(1);
  const [riskPct, setRiskPct] = useState(1);
  const [trades, setTrades] = useState(180);
  const [paths, setPaths] = useState(800);
  const [drawdownLimit, setDrawdownLimit] = useState(20);
  const results = useMemo(() => simulateRiskPaths({ winRate, winR, lossR, riskPct, trades, paths, drawdownLimit, stressed: scenario === "stress" }), [winRate, winR, lossR, riskPct, trades, paths, drawdownLimit, scenario]);
  const passed = results.drawdownP95 <= drawdownLimit && results.breachProbability <= 5;

  return <div className="risk-lab-content risk-monte-lab">
    <section className="risk-monte-intro">
      <span>WHEN & WHY · 风险路径验证</span>
      <h3>什么时候用风险蒙特卡洛？</h3>
      <p><b>在策略规则、成本和交易分布已经冻结之后，在决定单笔风险率、资金规模和回撤熔断线之前。</b>它用大量可能路径回答：连亏可能多长、P95 回撤多深、当前风险率触发红线的比例多高。</p>
      <div className="risk-monte-flow"><span>可信回测</span><b>→</b><span>逐笔收益样本</span><b>→</b><span className="active">路径模拟</span><b>→</b><span>风险率校准</span><b>→</b><span>回撤门禁</span><b>→</b><span>隔离仿真</span></div>
      <div className="risk-monte-when"><div><strong><CheckCircleFilled /> 用于</strong><span>仓位、资本缓冲、连亏容忍度和熔断线校准</span></div><div><strong><CloseCircleFilled /> 不用于</strong><span>证明未来盈利、修饰失败回测或制造精确概率幻觉</span></div></div>
      <footer><SafetyOutlined /><span>模拟无法创造样本中未出现的黑天鹅，因此还必须与历史事故、机制情景和反向压力测试并用。</span></footer>
    </section>
    <section className="risk-explain">
      <h3>风险率会非线性放大回撤和破产概率</h3>
      <p>同一交易优势在 0.5% 与 3% 单笔风险下，终值均值可能都为正，但坏路径、连亏和恢复难度完全不同。</p>
      <div className="risk-scenario-switch"><button type="button" className={scenario === "base" ? "active" : ""} onClick={() => setScenario("base")}><b>基准重采样</b><span>保留当前胜率和赔率</span></button><button type="button" className={scenario === "stress" ? "active" : ""} onClick={() => setScenario("stress")}><b>参数压力</b><span>胜率降低、盈利缩水、亏损放大</span></button></div>
      <div className="risk-boundary">先写通过门槛再运行模拟，禁止看到结果后反复改种子、分布或红线。</div>
    </section>
    <section className="risk-simulator">
      <header><ExperimentOutlined /><div><strong>风险路径模拟器</strong><span>{paths} 条路径 · {scenario === "stress" ? "压力情景" : "基准情景"}</span></div><StatusPill tone={passed ? "profit" : "loss"}>{passed ? "风险率可复核" : "风险率过高"}</StatusPill></header>
      <div className="risk-slider-grid">
        <label><span>历史胜率 <b>{winRate}%</b></span><Slider min={20} max={75} value={winRate} onChange={setWinRate} /></label>
        <label><span>平均盈利 <b>{winR.toFixed(1)}R</b></span><Slider min={0.5} max={4} step={0.1} value={winR} onChange={setWinR} /></label>
        <label><span>平均亏损 <b>{lossR.toFixed(1)}R</b></span><Slider min={0.5} max={3} step={0.1} value={lossR} onChange={setLossR} /></label>
        <label><span>单笔风险 <b>{riskPct.toFixed(2)}%</b></span><Slider min={0.25} max={3} step={0.25} value={riskPct} onChange={setRiskPct} /></label>
        <label><span>每路径交易数 <b>{trades}</b></span><Slider min={50} max={500} step={10} value={trades} onChange={setTrades} /></label>
        <label><span>模拟路径数 <b>{paths}</b></span><Slider min={200} max={1500} step={100} value={paths} onChange={setPaths} /></label>
        <label><span>回撤红线 <b>{drawdownLimit}%</b></span><Slider min={5} max={50} value={drawdownLimit} onChange={setDrawdownLimit} /></label>
      </div>
      <div className="risk-results"><RiskResult label="悲观终值 P05" value={`${results.endingP05.toFixed(1)}%`} tone={results.endingP05 >= 0 ? "safe" : "warn"} /><RiskResult label="中位最大回撤" value={`${results.drawdownP50.toFixed(1)}%`} /><RiskResult label="P95 最大回撤" value={`${results.drawdownP95.toFixed(1)}%`} tone={passed ? "safe" : "block"} /><RiskResult label="P95 最长连亏" value={`${results.lossStreakP95.toFixed(0)} 笔`} tone="warn" /><RiskResult label="触及红线比例" value={`${results.breachProbability.toFixed(1)}%`} tone={passed ? "safe" : "block"} /></div>
    </section>
  </div>;
}

function DerivativeChainLab() {
  const [mode, setMode] = useState<"perp" | "defi">("perp");
  const [equity, setEquity] = useState(12000);
  const [maintenance, setMaintenance] = useState(8000);
  const [mark, setMark] = useState(100);
  const [liquidation, setLiquidation] = useState(88);
  const [collateral, setCollateral] = useState(15000);
  const [debt, setDebt] = useState(9000);
  const [threshold, setThreshold] = useState(80);
  const [oracleShock, setOracleShock] = useState(20);
  const marginRatio = maintenance > 0 ? equity / maintenance : 0;
  const liquidationBuffer = mark > 0 ? Math.abs(mark - liquidation) / mark * 100 : 0;
  const healthFactor = debt > 0 ? collateral * threshold / 100 / debt : 0;
  const stressedHealth = debt > 0 ? collateral * (1 - oracleShock / 100) * threshold / 100 / debt : 0;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>Web3 风险会由保证金、预言机和链上执行共同触发</h3>
      <p>永续合约关注标记价格、风险阶梯和清算缓冲；DeFi 借贷关注预言机抵押价值、清算阈值、Gas 与拥堵。</p>
      <div className="risk-scenario-switch"><button type="button" className={mode === "perp" ? "active" : ""} onClick={() => setMode("perp")}><b>永续保证金</b><span>标记价、维持保证金与清算缓冲</span></button><button type="button" className={mode === "defi" ? "active" : ""} onClick={() => setMode("defi")}><b>DeFi 借贷</b><span>预言机、健康因子与链上清算</span></button></div>
      <div className="risk-boundary">清算价和健康因子都不是静态值；费用、资金费、债务利息、预言机跳变和追加仓位都会改变结果。</div>
    </section>
    <section className="risk-simulator">
      <header><WarningOutlined /><div><strong>{mode === "perp" ? "保证金缓冲检查" : "借贷健康因子压力"}</strong><span>先算正常值，再施加价格/预言机冲击</span></div></header>
      {mode === "perp" ? <>
        <div className="risk-input-grid"><label><span>账户权益</span><InputNumber min={0} value={equity} onChange={(value) => setEquity(finite(value, 12000))} /></label><label><span>维持保证金</span><InputNumber min={1} value={maintenance} onChange={(value) => setMaintenance(finite(value, 8000))} /></label><label><span>标记价格</span><InputNumber min={0.01} value={mark} onChange={(value) => setMark(finite(value, 100))} /></label><label><span>预估清算价</span><InputNumber min={0.01} value={liquidation} onChange={(value) => setLiquidation(finite(value, 88))} /></label></div>
        <div className="risk-results"><RiskResult label="保证金率" value={marginRatio.toFixed(2)} tone={marginRatio >= 1.5 ? "safe" : marginRatio >= 1.2 ? "warn" : "block"} /><RiskResult label="清算缓冲" value={`${liquidationBuffer.toFixed(1)}%`} tone={liquidationBuffer >= 15 ? "safe" : liquidationBuffer >= 8 ? "warn" : "block"} /></div>
      </> : <>
        <div className="risk-input-grid"><label><span>抵押品价值</span><InputNumber min={0} value={collateral} onChange={(value) => setCollateral(finite(value, 15000))} /></label><label><span>债务价值</span><InputNumber min={1} value={debt} onChange={(value) => setDebt(finite(value, 9000))} /></label><label><span>清算阈值</span><InputNumber min={1} max={100} value={threshold} addonAfter="%" onChange={(value) => setThreshold(finite(value, 80))} /></label><label><span>预言机价格冲击</span><InputNumber min={0} max={90} value={oracleShock} addonAfter="%" onChange={(value) => setOracleShock(finite(value, 20))} /></label></div>
        <div className="risk-results"><RiskResult label="当前健康因子" value={healthFactor.toFixed(2)} tone={healthFactor >= 1.5 ? "safe" : healthFactor >= 1.1 ? "warn" : "block"} /><RiskResult label="冲击后健康因子" value={stressedHealth.toFixed(2)} tone={stressedHealth >= 1.3 ? "safe" : stressedHealth >= 1 ? "warn" : "block"} /><RiskResult label="清算判断" value={stressedHealth < 1 ? "可能触发清算" : "仍有缓冲"} tone={stressedHealth < 1 ? "block" : "safe"} /></div>
      </>}
    </section>
  </div>;
}

function CircuitLab() {
  const [peak, setPeak] = useState(100000);
  const [equity, setEquity] = useState(88000);
  const [warning, setWarning] = useState(10);
  const [block, setBlock] = useState(15);
  const [spread, setSpread] = useState(1.2);
  const [recoveryChecks, setRecoveryChecks] = useState<string[]>([]);
  const drawdown = peak > 0 ? Math.max(0, (peak - equity) / peak * 100) : 0;
  const recovery = drawdown < 100 ? (1 / (1 - drawdown / 100) - 1) * 100 : Infinity;
  const drawdownStatus = drawdown >= block ? "block" : drawdown >= warning ? "warn" : "safe";
  const spreadStatus = spread > 2 ? "block" : spread > 1.5 ? "warn" : "safe";
  const finalStatus = drawdownStatus === "block" || spreadStatus === "block" ? "BLOCK" : drawdownStatus === "warn" || spreadStatus === "warn" ? "WARN" : "ALLOW";
  const recoveryItems = ["数据源恢复并交叉核验", "账户与订单状态完成对账", "触发原因已有根因记录", "限额仿真通过且责任人批准"];
  function toggle(item: string) { setRecoveryChecks((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]); }

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>门禁要在损失失控前减速，恢复也必须分级</h3>
      <p>预警用于降速和缩量，阻断用于拒绝新增风险，熔断用于取消订单并冻结策略。恢复不能只看行情恢复，还要完成数据、账户和根因复核。</p>
      <RiskFormula meaning="当前权益相对历史峰值的跌幅"><Fn>回撤</Fn> = <Fraction top={<><Fn>峰值权益</Fn> − <Fn>当前权益</Fn></>} bottom={<Fn>峰值权益</Fn>} /></RiskFormula>
      <div className="risk-action-ladder"><span><b>ALLOW</b> 正常限额</span><span><b>WARN</b> 缩量降速</span><span><b>BLOCK</b> 拒绝新单</span><span><b>HALT</b> 取消并冻结</span><span><b>RECOVER</b> 分级恢复</span></div>
      <div className="risk-boundary">硬门槛按最严重结果合并执行；人工覆盖必须有权限、原因、时限和审计记录。</div>
    </section>
    <section className="risk-simulator">
      <header><FileDoneOutlined /><div><strong>门禁与恢复控制台</strong><span>先判断动作，再完成恢复证据</span></div><StatusPill tone={finalStatus === "ALLOW" ? "profit" : finalStatus === "WARN" ? "ai" : "loss"}>{finalStatus}</StatusPill></header>
      <div className="risk-input-grid"><label><span>峰值权益</span><InputNumber min={1} value={peak} onChange={(value) => setPeak(finite(value, 100000))} /></label><label><span>当前权益</span><InputNumber min={0} value={equity} onChange={(value) => setEquity(finite(value, 88000))} /></label><label><span>预警阈值</span><InputNumber min={0.1} max={99} addonAfter="%" value={warning} onChange={(value) => setWarning(finite(value, 10))} /></label><label><span>阻断阈值</span><InputNumber min={0.1} max={99} addonAfter="%" value={block} onChange={(value) => setBlock(finite(value, 15))} /></label></div>
      <label className="risk-spread-slider"><span>K 线内价差 <b>{spread.toFixed(1)}%</b>（项目红线 2%）</span><Slider min={0} max={5} step={0.1} value={spread} onChange={setSpread} /></label>
      <div className="risk-results"><RiskResult label="当前回撤" value={`${drawdown.toFixed(2)}%`} tone={drawdownStatus} /><RiskResult label="回本所需涨幅" value={Number.isFinite(recovery) ? `${recovery.toFixed(2)}%` : "无法计算"} tone="warn" /><RiskResult label="价差检查" value={`${spread.toFixed(1)}%`} tone={spreadStatus} /><RiskResult label="最终门禁" value={finalStatus} tone={finalStatus === "ALLOW" ? "safe" : finalStatus === "WARN" ? "warn" : "block"} /></div>
      <div className="risk-recovery-checks"><header><strong>恢复前检查</strong><span>{recoveryChecks.length} / {recoveryItems.length}</span></header>{recoveryItems.map((item) => <button type="button" key={item} className={recoveryChecks.includes(item) ? "checked" : ""} onClick={() => toggle(item)}><i>{recoveryChecks.includes(item) ? <CheckCircleFilled /> : null}</i><span>{item}</span></button>)}</div>
    </section>
  </div>;
}

const LABS = [RiskMapLab, ThresholdCalibrationLab, PositionLab, RewardRiskLab, ConcentrationLab, LiquidityLab, TailStressLab, RiskMonteCarloLab, DerivativeChainLab, CircuitLab];

function RiskCourseMap({ lesson, onChange }: { lesson: number; onChange: (index: number) => void }) {
  return <QuantGlowCard className="risk-course-map" title={<SectionHeader title="从识别风险到恢复治理" description="10 个互动实验按事前、事中、事后顺序推进；公式手册独立查阅" />} badge={<StatusPill tone="loss">风控主线</StatusPill>}>
    <nav aria-label="风控课程目录">{LESSONS.map((item, index) => <button type="button" key={item.title} className={lesson === index ? "active" : ""} aria-current={lesson === index ? "step" : undefined} onClick={() => onChange(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><small>{item.phase} · {item.level}</small><strong>{item.title}</strong><em>{item.short}</em></span><ArrowRightOutlined /></button>)}</nav>
  </QuantGlowCard>;
}

function InlineRiskQuiz({ quiz, answer, onAnswer }: { quiz: (typeof QUIZZES)[number]; answer: number | null; onAnswer: (index: number) => void }) {
  return <section className="risk-inline-quiz" aria-label="本课风险判断">
    <header><div><strong>本课风险判断</strong><span>用一道题确认门禁边界</span></div><StatusPill tone="ai">1 题</StatusPill></header>
    <strong className="risk-quiz-question">{quiz.question}</strong>
    <div className="risk-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => onAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>
    {answer !== null ? <div className={`risk-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "判断正确" : "这会放大风险"}</strong><span>{quiz.reason}</span></div> : null}
  </section>;
}

export default function RiskLearningPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"course" | "handbook">("course");
  const [lesson, setLesson] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const quiz = QUIZZES[lesson];
  const ActiveLab = LABS[lesson];

  function move(next: number) {
    setViewMode("course");
    setLesson(Math.max(0, Math.min(LESSONS.length - 1, next)));
    setAnswer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <TradingPageShell
    eyebrow="RISK GOVERNANCE · 识别 → 度量 → 压力 → 门禁 → 恢复"
    title="风控学堂"
    description="从风险数据和阈值校准开始，系统完成暴露与仓位、流动性容量、VaR/ES、情景压力、风险蒙特卡洛、Web3 清算和熔断恢复治理。"
    actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button icon={<SafetyOutlined />} onClick={() => navigate("/backtest-learning")}>复习回测方法</Button></>}
    aside={<QuantGlowCard className="risk-progress-card"><span>{viewMode === "course" ? "风险方法进度" : "公式参考手册"}</span><strong>{viewMode === "course" ? `${lesson + 1} / ${LESSONS.length}` : "10 类 · 37 式"}</strong>{viewMode === "course" ? <div><i style={{ width: `${(lesson + 1) / LESSONS.length * 100}%` }} /></div> : null}<small>{viewMode === "course" ? `当前阶段：${LESSONS[lesson].phase}` : "定义 · 复算 · 边界 · 来源"}</small><small>{viewMode === "course" ? LESSONS[lesson].title : "独立查阅，不与方法课程重复展示"}</small></QuantGlowCard>}
  >
    <LearningCourseNav />
    <section className="learning-full-width">
      <main className="risk-learning-main">
        <section className="risk-view-switch" aria-label="风控学堂内容视图"><div><strong>{viewMode === "course" ? "方法课程" : "公式手册"}</strong><span>{viewMode === "course" ? "按治理流程完成互动实验和风险判断" : "按主题查阅公式、复算任务与证据来源"}</span></div><Segmented value={viewMode} onChange={(value) => setViewMode(value as "course" | "handbook")} options={[{ label: "方法课程", value: "course" }, { label: "公式手册", value: "handbook" }]} /></section>
        {viewMode === "course" ? <>
          <RiskCourseMap lesson={lesson} onChange={move} />
          <QuantGlowCard title={<SectionHeader title={LESSONS[lesson].title} description={LESSONS[lesson].short} />} badge={<StatusPill tone={LESSONS[lesson].level === "基础" ? "neutral" : LESSONS[lesson].level === "核心" ? "profit" : "loss"}>{LESSONS[lesson].level}课程</StatusPill>}><ActiveLab /><InlineRiskQuiz quiz={quiz} answer={answer} onAnswer={setAnswer} /></QuantGlowCard>
          <div className="risk-lesson-actions"><Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>{lesson < LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => navigate("/academy")}>完成课程并返回学堂 <ArrowRightOutlined /></Button>}</div>
        </> : <FormulaHandbook domain="risk" />}
      </main>
    </section>
  </TradingPageShell>;
}
