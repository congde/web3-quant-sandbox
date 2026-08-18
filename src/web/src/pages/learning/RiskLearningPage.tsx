import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SafetyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Input, InputNumber, Slider } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import { Abs, Fn, Fraction, Symbol as Sym } from "./FormulaNotation";
import "./risk-learning.css";

const LESSONS = [
  { title: "风险地图与防线", short: "先知道哪里会出错" },
  { title: "仓位与风险预算", short: "先算最坏会亏多少" },
  { title: "止损与盈亏比", short: "把退出条件写清楚" },
  { title: "组合集中度", short: "避免一次判断毁掉组合" },
  { title: "回撤门禁与熔断", short: "何时预警、拒单和暂停" },
] as const;

const QUIZZES = [
  { question: "行情数据突然出现零成交量但价格大幅变化，首先应该做什么？", options: ["立即追涨", "暂停并检查数据质量", "提高仓位"], answer: 1, reason: "异常数据会污染信号和订单，第一道防线应当是停止使用并核验数据源。" },
  { question: "账户 10 万元，单笔最多风险 1%，止损距离 5%，最大名义仓位是多少？", options: ["1 万元", "2 万元", "5 万元"], answer: 1, reason: "风险预算 1000 元 ÷ 5% 止损距离 = 2 万元最大名义仓位。" },
  { question: "潜在亏损 5%，潜在盈利 15%，盈亏比是多少？", options: ["1:1", "2:1", "3:1"], answer: 2, reason: "15 ÷ 5 = 3，即每承担 1 单位风险，对应 3 单位潜在收益。" },
  { question: "四个资产权重分别为 25%，组合是否已经充分分散？", options: ["一定是", "不一定，还要看相关性和风险暴露", "一定不是"], answer: 1, reason: "表面权重均衡不代表底层风险均衡，高相关资产仍可能同时下跌。" },
  { question: "组合亏损 50% 后，需要上涨多少才能回到原点？", options: ["50%", "75%", "100%"], answer: 2, reason: "净值从 50 回到 100 需要翻倍，也就是上涨 100%。" },
] as const;

function finite(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
  model: { name: "模型风险", symptom: "样本外失效、参数敏感、回测与实盘偏离", control: "稳健性检查、降级规则、限制策略风险预算", owner: "研究 + 风控" },
  operation: { name: "执行风险", symptom: "网络延迟、RPC 故障、重复订单、状态不同步", control: "幂等检查、超时取消、紧急熔断、人工复核", owner: "执行 + 运维" },
} as const;

function RiskMapLab() {
  const [active, setActive] = useState<keyof typeof RISK_CASES>("market");
  const item = RISK_CASES[active];
  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>风控不是一个止损按钮，而是多层防线</h3>
      <p>风险可能来自市场、流动性、数据、模型和执行系统。好的风控先识别异常，再限制暴露，最后才是熔断。</p>
      <div className="risk-defense-flow"><span>数据门禁</span><b>→</b><span>信号约束</span><b>→</b><span>仓位限制</span><b>→</b><span>执行拦截</span><b>→</b><span>熔断</span></div>
      <div className="risk-boundary">原则：风险规则应当在订单成交前执行，并留下规则编号、原因和时间。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>风险地图</strong><span>选择一种风险查看对应防线</span></div></header>
      <div className="risk-case-tabs">{Object.entries(RISK_CASES).map(([key, value]) => <button type="button" className={active === key ? "active" : ""} key={key} onClick={() => setActive(key as keyof typeof RISK_CASES)}>{value.name}</button>)}</div>
      <div className="risk-case-detail">
        <div><span>可观察现象</span><p>{item.symptom}</p></div>
        <div><span>控制措施</span><p>{item.control}</p></div>
        <div><span>责任边界</span><p>{item.owner}</p></div>
      </div>
    </section>
  </div>;
}

function PositionLab() {
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(95);
  const riskBudget = capital * riskPct / 100;
  const stopPct = entry > 0 ? Math.abs(entry - stop) / entry * 100 : 0;
  const qty = Math.abs(entry - stop) > 0 ? riskBudget / Math.abs(entry - stop) : 0;
  const notional = qty * entry;
  const capitalUse = capital > 0 ? notional / capital * 100 : 0;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>先确定能承受的损失，再反推仓位</h3>
      <p>仓位大小不应由“有多看好”决定，而应由账户权益、单笔风险预算和止损距离共同决定。</p>
      <RiskFormula meaning="这笔交易允许损失的最大金额"><Fn>风险预算</Fn> = <Fn>账户权益</Fn> × <Fn>单笔风险率</Fn></RiskFormula>
      <RiskFormula meaning="价格触发止损时，理论损失不超过预算"><Fn>数量</Fn> = <Fraction top={<Fn>风险预算</Fn>} bottom={<Abs><Fn>入场价</Fn> − <Fn>止损价</Fn></Abs>} /></RiskFormula>
      <div className="risk-boundary">未计入跳空和滑点。真实损失可能超过理论预算，因此还需要仓位上限。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>仓位计算器</strong><span>以做多场景为例</span></div></header>
      <div className="risk-input-grid">
        <label><span>账户权益</span><InputNumber min={1} value={capital} onChange={(v) => setCapital(finite(v, 100000))} /></label>
        <label><span>单笔风险</span><InputNumber min={0.1} max={10} step={0.1} addonAfter="%" value={riskPct} onChange={(v) => setRiskPct(finite(v, 1))} /></label>
        <label><span>入场价</span><InputNumber min={0.01} value={entry} onChange={(v) => setEntry(finite(v, 100))} /></label>
        <label><span>止损价</span><InputNumber min={0.01} value={stop} onChange={(v) => setStop(finite(v, 95))} /></label>
      </div>
      <div className="risk-results">
        <RiskResult label="风险预算" value={`¥${riskBudget.toFixed(0)}`} tone="warn" note="最坏损失目标" />
        <RiskResult label="止损距离" value={`${stopPct.toFixed(2)}%`} note={`每单位风险 ¥${Math.abs(entry - stop).toFixed(2)}`} />
        <RiskResult label="最大数量" value={qty.toFixed(2)} tone="safe" note="未计滑点" />
        <RiskResult label="名义仓位" value={`¥${notional.toFixed(0)}`} tone={capitalUse > 100 ? "block" : "neutral"} note={`占权益 ${capitalUse.toFixed(1)}%`} />
      </div>
    </section>
  </div>;
}

function RewardRiskLab() {
  const [entry, setEntry] = useState(100);
  const [stop, setStop] = useState(95);
  const [target, setTarget] = useState(115);
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const ratio = risk > 0 ? reward / risk : 0;
  const breakeven = ratio > 0 ? 1 / (1 + ratio) * 100 : 100;

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>止损定义错误边界，目标价定义潜在回报</h3>
      <p>盈亏比不预测胜率，它帮助判断一个交易计划需要多高的胜率才能覆盖亏损。</p>
      <RiskFormula meaning="潜在收益相对潜在损失的倍数"><Sym>R</Sym>/<Sym>R</Sym> = <Fraction top={<Abs><Fn>目标价</Fn> − <Fn>入场价</Fn></Abs>} bottom={<Abs><Fn>入场价</Fn> − <Fn>止损价</Fn></Abs>} /></RiskFormula>
      <RiskFormula meaning="忽略费用时不亏损所需的最低胜率"><Fn>盈亏平衡胜率</Fn> = <Fraction top={1} bottom={<>1 + <Sym>R</Sym>/<Sym>R</Sym></>} /></RiskFormula>
      <div className="risk-boundary">低胜率策略也可能盈利，高胜率策略也可能亏损；关键是胜率与盈亏比共同作用。</div>
    </section>
    <section className="risk-simulator">
      <header><WarningOutlined /><div><strong>交易计划检查器</strong><span>修改入场、止损和目标</span></div></header>
      <div className="risk-input-grid three">
        <label><span>入场价</span><InputNumber min={0.01} value={entry} onChange={(v) => setEntry(finite(v, 100))} /></label>
        <label><span>止损价</span><InputNumber min={0.01} value={stop} onChange={(v) => setStop(finite(v, 95))} /></label>
        <label><span>目标价</span><InputNumber min={0.01} value={target} onChange={(v) => setTarget(finite(v, 115))} /></label>
      </div>
      <div className="risk-price-track"><i className="stop" style={{ left: `${Math.max(2, Math.min(98, stop / Math.max(entry, target, stop) * 90))}%` }} /><i className="entry" style={{ left: `${Math.max(2, Math.min(98, entry / Math.max(entry, target, stop) * 90))}%` }} /><i className="target" style={{ left: `${Math.max(2, Math.min(98, target / Math.max(entry, target, stop) * 90))}%` }} /></div>
      <div className="risk-results">
        <RiskResult label="每单位风险" value={risk.toFixed(2)} tone="block" />
        <RiskResult label="每单位潜在收益" value={reward.toFixed(2)} tone="safe" />
        <RiskResult label="盈亏比" value={`${ratio.toFixed(2)} : 1`} tone={ratio >= 2 ? "safe" : "warn"} />
        <RiskResult label="盈亏平衡胜率" value={`${breakeven.toFixed(1)}%`} note="未计费用" />
      </div>
    </section>
  </div>;
}

function parseWeights(text: string) {
  return text.split(/[，,\s]+/).map(Number).filter((value) => Number.isFinite(value) && value >= 0);
}

function ConcentrationLab() {
  const [text, setText] = useState("40, 30, 20, 10");
  const raw = useMemo(() => parseWeights(text), [text]);
  const sum = raw.reduce((total, value) => total + value, 0);
  const weights = sum > 0 ? raw.map((value) => value / sum) : [];
  const hhi = weights.reduce((total, value) => total + value ** 2, 0);
  const effectiveN = hhi > 0 ? 1 / hhi : 0;
  const maxWeight = weights.length ? Math.max(...weights) * 100 : 0;
  const status = maxWeight > 50 || effectiveN < 2 ? "block" : maxWeight > 35 || effectiveN < 3 ? "warn" : "safe";

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>资产数量不等于有效分散数量</h3>
      <p>HHI 将每项权重平方后相加，权重越集中，HHI 越高；其倒数可以近似理解为有效资产数量。</p>
      <RiskFormula meaning="权重平方会放大大仓位的影响"><Fn>HHI</Fn> = <Fn>Σ</Fn> <Sym sub="i" sup="2">w</Sym></RiskFormula>
      <RiskFormula meaning="组合相当于多少个等权资产"><Fn>有效资产数</Fn> = <Fraction top={1} bottom={<Fn>HHI</Fn>} /></RiskFormula>
      <div className="risk-boundary">这只是权重集中度，还没有考虑资产相关性、杠杆和共同风险因子。</div>
    </section>
    <section className="risk-simulator">
      <header><SafetyOutlined /><div><strong>组合集中度检查</strong><span>输入各资产权重，系统会自动归一化</span></div></header>
      <label className="risk-series-input"><span>资产权重（%）</span><Input value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="risk-weight-bars">{weights.map((weight, index) => <div key={index}><span>资产 {index + 1}</span><i style={{ width: `${weight * 100}%` }} /><b>{(weight * 100).toFixed(1)}%</b></div>)}</div>
      <div className="risk-results">
        <RiskResult label="HHI 集中度" value={hhi.toFixed(3)} tone={status} />
        <RiskResult label="有效资产数" value={effectiveN.toFixed(2)} tone={status} note={`名义资产 ${weights.length} 个`} />
        <RiskResult label="最大单项权重" value={`${maxWeight.toFixed(1)}%`} tone={status} />
      </div>
    </section>
  </div>;
}

function CircuitLab() {
  const [peak, setPeak] = useState(100000);
  const [equity, setEquity] = useState(88000);
  const [warning, setWarning] = useState(10);
  const [block, setBlock] = useState(15);
  const [spread, setSpread] = useState(1.2);
  const drawdown = peak > 0 ? Math.max(0, (peak - equity) / peak * 100) : 0;
  const recovery = drawdown < 100 ? (1 / (1 - drawdown / 100) - 1) * 100 : Infinity;
  const drawdownStatus = drawdown >= block ? "block" : drawdown >= warning ? "warn" : "safe";
  const spreadStatus = spread > 2 ? "block" : spread > 1.5 ? "warn" : "safe";
  const finalStatus = drawdownStatus === "block" || spreadStatus === "block" ? "BLOCK" : drawdownStatus === "warn" || spreadStatus === "warn" ? "WARN" : "ALLOW";

  return <div className="risk-lab-content">
    <section className="risk-explain">
      <h3>门禁要在损失失控之前减速或停止</h3>
      <p>项目默认最大回撤阈值为 15%，最大 K 线价差阈值为 2%。任一硬门槛触发，都应拒绝新增风险。</p>
      <RiskFormula meaning="当前权益相对历史峰值的跌幅"><Fn>回撤</Fn> = <Fraction top={<><Fn>峰值权益</Fn> − <Fn>当前权益</Fn></>} bottom={<Fn>峰值权益</Fn>} /></RiskFormula>
      <RiskFormula meaning="亏损越深，恢复所需涨幅增长越快"><Fn>恢复涨幅</Fn> = <Fraction top={1} bottom={<>1 − <Fn>回撤</Fn></>} /> − 1</RiskFormula>
      <div className="risk-rule-list"><span><b>EMERGENCY_HALT</b> 紧急熔断</span><span><b>MAX_POSITION_PCT</b> 最大仓位</span><span><b>MAX_DAILY_LOSS_PCT</b> 最大回撤</span><span><b>MAX_SLIPPAGE_PCT</b> 最大滑点</span><span><b>ABNORMAL_ORDERBOOK</b> 异常行情</span></div>
    </section>
    <section className="risk-simulator">
      <header><WarningOutlined /><div><strong>回撤门禁模拟器</strong><span>规则按最严重结果执行</span></div><StatusPill tone={finalStatus === "ALLOW" ? "profit" : finalStatus === "WARN" ? "ai" : "loss"}>{finalStatus}</StatusPill></header>
      <div className="risk-input-grid">
        <label><span>峰值权益</span><InputNumber min={1} value={peak} onChange={(v) => setPeak(finite(v, 100000))} /></label>
        <label><span>当前权益</span><InputNumber min={0} value={equity} onChange={(v) => setEquity(finite(v, 88000))} /></label>
        <label><span>预警阈值</span><InputNumber min={0.1} max={99} addonAfter="%" value={warning} onChange={(v) => setWarning(finite(v, 10))} /></label>
        <label><span>阻断阈值</span><InputNumber min={0.1} max={99} addonAfter="%" value={block} onChange={(v) => setBlock(finite(v, 15))} /></label>
      </div>
      <label className="risk-spread-slider"><span>K 线内价差 <b>{spread.toFixed(1)}%</b>（项目红线 2%）</span><Slider min={0} max={5} step={0.1} value={spread} onChange={setSpread} /></label>
      <div className="risk-results">
        <RiskResult label="当前回撤" value={`${drawdown.toFixed(2)}%`} tone={drawdownStatus} />
        <RiskResult label="回本所需涨幅" value={Number.isFinite(recovery) ? `${recovery.toFixed(2)}%` : "无法计算"} tone="warn" />
        <RiskResult label="价差检查" value={`${spread.toFixed(1)}%`} tone={spreadStatus} />
        <RiskResult label="最终门禁" value={finalStatus} tone={finalStatus === "ALLOW" ? "safe" : finalStatus === "WARN" ? "warn" : "block"} />
      </div>
    </section>
  </div>;
}

const LABS = [<RiskMapLab />, <PositionLab />, <RewardRiskLab />, <ConcentrationLab />, <CircuitLab />];

export default function RiskLearningPage() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const quiz = QUIZZES[lesson];

  function move(next: number) {
    setLesson(Math.max(0, Math.min(LESSONS.length - 1, next)));
    setAnswer(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <TradingPageShell
    eyebrow="RISK FIRST · MEASURE → LIMIT → BLOCK"
    title="风控学堂"
    description="在下单前计算最坏损失，在异常扩大前限制风险，在系统不可控时停止交易。课程使用项目真实风控规则，仅用于公益教学和模拟。"
    actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button icon={<SafetyOutlined />} onClick={() => navigate("/risk")}>进入风控中心</Button></>}
    aside={<QuantGlowCard className="risk-progress-card"><span>课程进度</span><strong>{lesson + 1} / {LESSONS.length}</strong><div><i style={{ width: `${(lesson + 1) / LESSONS.length * 100}%` }} /></div><small>当前：{LESSONS[lesson].title}</small></QuantGlowCard>}
  >
    <section className="risk-learning-layout">
      <aside className="risk-lesson-nav">
        <div className="risk-nav-heading"><SafetyOutlined /><span>风险防线</span></div>
        {LESSONS.map((item, index) => <button type="button" key={item.title} className={index === lesson ? "active" : ""} onClick={() => move(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.title}</strong><small>{item.short}</small></span>{index < lesson ? <CheckCircleFilled /> : null}</button>)}
        <div className="risk-source-note"><SafetyOutlined /><p>阈值与 <code>src/risk/config.py</code> 默认规则保持一致。</p></div>
      </aside>
      <main className="risk-learning-main">
        <QuantGlowCard title={<SectionHeader title={LESSONS[lesson].title} description="理解风险、计算暴露、观察门禁结果" />} badge={<StatusPill tone="loss">互动演练</StatusPill>}>{LABS[lesson]}</QuantGlowCard>
        <QuantGlowCard className="risk-quiz-card" title={<SectionHeader title="风险判断题" description="风控首先是一套清晰的判断规则" />} badge={<StatusPill tone="ai">1 题</StatusPill>}>
          <strong className="risk-quiz-question">{quiz.question}</strong>
          <div className="risk-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => setAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>
          {answer !== null ? <div className={`risk-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "判断正确" : "这会放大风险"}</strong><span>{quiz.reason}</span></div> : null}
        </QuantGlowCard>
        <div className="risk-lesson-actions"><Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>{lesson < LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => navigate("/risk")}>进入风控中心 <ArrowRightOutlined /></Button>}</div>
      </main>
    </section>
  </TradingPageShell>;
}
