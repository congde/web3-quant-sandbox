import {
  ArrowRightOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ExperimentOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Button, InputNumber, Slider } from "antd";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import "./backtest-learning.css";

const LESSONS = [
  { title: "回测是什么", short: "历史模拟，不是未来预测" },
  { title: "标准流程与时序", short: "数据怎样变成证据" },
  { title: "成交与交易成本", short: "把理想收益拉回现实" },
  { title: "基准与评价指标", short: "收益必须放进上下文" },
  { title: "偏差与稳健性", short: "识别作弊和过拟合" },
] as const;

const QUIZZES = [
  { question: "一次历史回测收益很高，最合理的结论是什么？", options: ["未来一定盈利", "规则在该样本和假设下表现较好", "可以立即实盘满仓"], answer: 1, reason: "回测只描述历史样本和既定假设下的模拟结果，不能保证未来收益。" },
  { question: "策略使用当天收盘价产生信号，最保守的成交时点通常是？", options: ["当天收盘前", "下一根 K 线可成交时点", "任意最低价"], answer: 1, reason: "收盘后才能完整知道当天收盘价，因此通常不能假设提前在当天理想价格成交。" },
  { question: "为什么高换手策略对手续费和滑点更敏感？", options: ["交易次数增加会重复支付成本", "K 线数量更少", "胜率一定更低"], answer: 0, reason: "每次买卖都会产生费用和价格冲击，换手越高，成本侵蚀越强。" },
  { question: "策略收益 10%，同期买入持有收益 18%，首先应该注意什么？", options: ["策略绝对收益为正就足够", "策略可能没有跑赢简单基准", "基准没有意义"], answer: 1, reason: "基准回答“不使用复杂策略会怎样”，是判断策略是否增加价值的必要参照。" },
  { question: "不断尝试参数直到历史结果最好，最容易产生什么问题？", options: ["数据变多", "过拟合", "手续费下降"], answer: 1, reason: "参数可能记住了历史噪声，在新样本中无法复现。" },
] as const;

function finite(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function Concept({ title, children }: { title: string; children: ReactNode }) {
  return <div className="backtest-concept"><strong>{title}</strong><span>{children}</span></div>;
}

function Result({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "positive" | "negative" | "warning" | "neutral" }) {
  return <div className={`backtest-result ${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function DefinitionLab() {
  const [active, setActive] = useState<"data" | "rule" | "simulation" | "metric" | "limit">("data");
  const items = {
    data: { title: "数据", question: "用了哪段历史？", detail: "必须记录标的、周期、起止时间、数据来源和是否包含未收盘 K 线。" },
    rule: { title: "规则", question: "什么时候买卖？", detail: "条件必须没有歧义，同样输入应产生同样决策。" },
    simulation: { title: "模拟", question: "订单怎样成交？", detail: "按时间顺序推进，说明市价/限价、成交时点、仓位和风控。" },
    metric: { title: "指标", question: "结果表现如何？", detail: "同时看收益、回撤、Sharpe、交易次数和基准，不能只挑最好看的数字。" },
    limit: { title: "限制", question: "它不能证明什么？", detail: "不能证明未来收益，也不能证明真实市场一定能按模拟价格成交。" },
  } as const;
  const current = items[active];

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>回测是历史条件实验</h3>
      <p><b>回测 = 用历史 K 线，按固定规则，模拟“如果当时这样交易会发生什么”。</b></p>
      <p>它是研究流程中的证据环节，不是预测机器，也不是实盘收益证明。</p>
      <div className="backtest-proof-grid"><Concept title="可以说明">规则在指定样本、成本和成交假设下的历史表现</Concept><Concept title="不能说明">未来一定盈利、真实成交价或某个信号永远有效</Concept></div>
    </section>
    <section className="backtest-simulator">
      <header><BookOutlined /><div><strong>回测的五个组成部分</strong><span>逐项点击查看必须回答的问题</span></div></header>
      <div className="backtest-definition-tabs">{Object.entries(items).map(([key, item]) => <button type="button" key={key} className={active === key ? "active" : ""} onClick={() => setActive(key as keyof typeof items)}><b>{item.title}</b><span>{item.question}</span></button>)}</div>
      <div className="backtest-definition-detail"><strong>{current.question}</strong><p>{current.detail}</p></div>
    </section>
  </div>;
}

const PROCESS_STEPS = [
  { title: "提出假设", detail: "例如：短期均线上穿长期均线后，未来若干期收益是否优于基准？", output: "可证伪的问题" },
  { title: "冻结数据", detail: "确定标的、周期、样本窗口和版本，不能看到结果后偷偷换数据。", output: "可追溯样本" },
  { title: "写清规则", detail: "定义信号、仓位、止损止盈、手续费和成交时点。", output: "无歧义策略" },
  { title: "逐根推进", detail: "第 N 根只能读取第 N 根及以前的信息，再产生订单和风控检查。", output: "事件与成交轨迹" },
  { title: "评价与复核", detail: "比较基准、收益、回撤和稳定性，并记录反例和限制。", output: "研究结论" },
] as const;

function ProcessLab() {
  const [step, setStep] = useState(0);
  const current = PROCESS_STEPS[step];
  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>标准方法是先冻结问题，再运行实验</h3>
      <p>如果看到结果后不断改变样本、参数和规则，回测就会从“验证假设”变成“寻找漂亮曲线”。</p>
      <div className="backtest-time-rule"><ClockCircleOutlined /><span><b>时间边界</b>第 N 根 K 线作决定时，只能读取第 N 根及之前的数据。</span></div>
      <div className="backtest-code-pair"><code className="safe">history[-1]  ✓ 已知数据</code><code className="unsafe">shift(-5)  ✕ 未来数据</code></div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>五步回测方法</strong><span>点击步骤查看输入与产物</span></div></header>
      <div className="backtest-process-line">{PROCESS_STEPS.map((item, index) => <button type="button" key={item.title} className={step === index ? "active" : ""} onClick={() => setStep(index)}><i>{index + 1}</i><span>{item.title}</span></button>)}</div>
      <div className="backtest-step-detail"><span>步骤 {step + 1}</span><h4>{current.title}</h4><p>{current.detail}</p><b>产物：{current.output}</b></div>
    </section>
  </div>;
}

function CostLab() {
  const [grossReturn, setGrossReturn] = useState(20);
  const [turnover, setTurnover] = useState(10);
  const [feeBps, setFeeBps] = useState(10);
  const [slippageBps, setSlippageBps] = useState(5);
  const feeCost = turnover * feeBps / 100;
  const slippageCost = turnover * slippageBps / 100;
  const netReturn = grossReturn - feeCost - slippageCost;

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>回测价格不等于可成交价格</h3>
      <p>手续费是明确收费；滑点来自信号价与实际成交价的偏差；流动性不足还会产生冲击成本。</p>
      <div className="backtest-equation">净收益 ≈ 毛收益 − 换手倍数 ×（手续费率 + 滑点率）</div>
      <div className="backtest-boundary">这里的换手倍数是“累计单边成交额 ÷ 初始权益”。实际引擎还要逐笔按成交金额扣费。</div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>交易成本侵蚀计算器</strong><span>1 bp = 0.01%</span></div></header>
      <div className="backtest-input-grid">
        <label><span>成本前收益</span><InputNumber value={grossReturn} addonAfter="%" onChange={(v) => setGrossReturn(finite(v, 20))} /></label>
        <label><span>累计换手倍数</span><InputNumber min={0} value={turnover} onChange={(v) => setTurnover(finite(v, 10))} /></label>
        <label><span>单边手续费</span><InputNumber min={0} value={feeBps} addonAfter="bp" onChange={(v) => setFeeBps(finite(v, 10))} /></label>
        <label><span>单边滑点</span><InputNumber min={0} value={slippageBps} addonAfter="bp" onChange={(v) => setSlippageBps(finite(v, 5))} /></label>
      </div>
      <div className="backtest-results"><Result label="成本前收益" value={`${grossReturn.toFixed(2)}%`} /><Result label="手续费侵蚀" value={`-${feeCost.toFixed(2)}%`} tone="negative" /><Result label="滑点侵蚀" value={`-${slippageCost.toFixed(2)}%`} tone="negative" /><Result label="成本后收益" value={`${netReturn.toFixed(2)}%`} tone={netReturn >= 0 ? "positive" : "negative"} /></div>
      <div className="backtest-cost-bar"><i className="gross" style={{ width: `${Math.min(100, Math.abs(grossReturn) * 3)}%` }} /><i className="net" style={{ width: `${Math.min(100, Math.max(0, netReturn) * 3)}%` }} /></div>
    </section>
  </div>;
}

function MetricsLab() {
  const [strategyReturn, setStrategyReturn] = useState(12);
  const [benchmarkReturn, setBenchmarkReturn] = useState(15);
  const [drawdown, setDrawdown] = useState(8);
  const [volatility, setVolatility] = useState(10);
  const [riskFree, setRiskFree] = useState(2);
  const sharpe = volatility > 0 ? (strategyReturn - riskFree) / volatility : 0;
  const calmar = drawdown > 0 ? strategyReturn / drawdown : 0;
  const excess = strategyReturn - benchmarkReturn;

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>没有基准，无法知道复杂策略是否增加价值</h3>
      <p>收益回答“赚了多少”，回撤回答“过程中最深亏多少”，Sharpe 回答“每单位波动获得多少超额收益”。</p>
      <div className="backtest-metric-list"><Concept title="总收益">期末权益相对期初权益</Concept><Concept title="最大回撤">历史峰值到后续谷底的最深跌幅</Concept><Concept title="Sharpe">超额收益 ÷ 波动率</Concept><Concept title="Calmar">年化收益 ÷ 最大回撤</Concept></div>
      <div className="backtest-boundary">交易次数过少时，Sharpe、胜率等统计量可能非常不稳定。</div>
    </section>
    <section className="backtest-simulator">
      <header><BarChartOutlined /><div><strong>指标与基准解释器</strong><span>拖动参数观察结论变化</span></div></header>
      <div className="backtest-slider-grid">
        <label><span>策略收益 <b>{strategyReturn}%</b></span><Slider min={-30} max={50} value={strategyReturn} onChange={setStrategyReturn} /></label>
        <label><span>买入持有 <b>{benchmarkReturn}%</b></span><Slider min={-30} max={50} value={benchmarkReturn} onChange={setBenchmarkReturn} /></label>
        <label><span>最大回撤 <b>{drawdown}%</b></span><Slider min={1} max={50} value={drawdown} onChange={setDrawdown} /></label>
        <label><span>年化波动 <b>{volatility}%</b></span><Slider min={1} max={60} value={volatility} onChange={setVolatility} /></label>
        <label><span>无风险收益 <b>{riskFree}%</b></span><Slider min={0} max={10} value={riskFree} onChange={setRiskFree} /></label>
      </div>
      <div className="backtest-results"><Result label="相对基准" value={`${excess >= 0 ? "+" : ""}${excess.toFixed(2)}%`} tone={excess >= 0 ? "positive" : "warning"} /><Result label="Sharpe" value={sharpe.toFixed(2)} note="简化年化口径" /><Result label="Calmar" value={calmar.toFixed(2)} /><Result label="初步结论" value={excess >= 0 && sharpe >= 1 ? "值得继续复核" : "证据仍不足"} tone={excess >= 0 && sharpe >= 1 ? "positive" : "warning"} /></div>
    </section>
  </div>;
}

const BIAS_ITEMS = [
  { key: "lookahead", title: "前视偏差", example: "使用未来收盘价决定当前仓位", fix: "严格按时间推进；扫描 shift(-N) 等未来引用" },
  { key: "survivorship", title: "幸存者偏差", example: "只回测今天仍存在的优质标的", fix: "保留退市、下架和失败标的的历史状态" },
  { key: "overfit", title: "参数过拟合", example: "尝试上千组参数，只报告最好结果", fix: "预先定义搜索空间；留出样本外；做多窗口检查" },
  { key: "cost", title: "成本遗漏", example: "假设零手续费、零滑点、无限流动性", fix: "加入费用、滑点、成交量和延迟假设" },
] as const;

function RobustnessLab() {
  const [checked, setChecked] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const score = checked.length / BIAS_ITEMS.length * 100;
  const item = BIAS_ITEMS[active];
  function toggle(key: string) { setChecked((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]); }

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>漂亮曲线最需要被质疑</h3>
      <p>回测失真通常不是计算器算错，而是研究过程读取了未来、遗漏了失败样本、反复试参或忽略成本。</p>
      <div className="backtest-split"><span>训练样本</span><b>调规则</b><span>验证样本</span><b>选方案</b><span>测试样本</span><b>只评一次</b></div>
      <div className="backtest-time-rule"><SafetyOutlined /><span><b>Walk-forward</b>让训练窗口和测试窗口向前滚动，检查策略是否只在某一段历史有效。</span></div>
    </section>
    <section className="backtest-simulator">
      <header><SafetyOutlined /><div><strong>回测可信度清单</strong><span>点击偏差查看修复方法并完成检查</span></div><StatusPill tone={score === 100 ? "profit" : "ai"}>{score.toFixed(0)}%</StatusPill></header>
      <div className="backtest-bias-layout"><div className="backtest-bias-list">{BIAS_ITEMS.map((entry, index) => <button type="button" key={entry.key} className={active === index ? "active" : ""} onClick={() => setActive(index)}><span onClick={(event) => { event.stopPropagation(); toggle(entry.key); }}>{checked.includes(entry.key) ? <CheckCircleFilled /> : <i />}</span><b>{entry.title}</b></button>)}</div><div className="backtest-bias-detail"><span>常见错误</span><p>{item.example}</p><span>修复方法</span><p>{item.fix}</p></div></div>
    </section>
  </div>;
}

const LABS = [<DefinitionLab />, <ProcessLab />, <CostLab />, <MetricsLab />, <RobustnessLab />];

export default function BacktestLearningPage() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const quiz = QUIZZES[lesson];
  function move(next: number) { setLesson(Math.max(0, Math.min(LESSONS.length - 1, next))); setAnswer(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <TradingPageShell eyebrow="BACKTEST BASICS · ASK → SIMULATE → VERIFY" title="回测学堂" description="学习回测的基本概念和标准方法：固定样本、明确规则、按时间推进、加入成本、比较基准，并主动检查偏差。" actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button icon={<ExperimentOutlined />} onClick={() => navigate("/backtests")}>进入回测实验</Button></>} aside={<QuantGlowCard className="backtest-progress-card"><span>课程进度</span><strong>{lesson + 1} / {LESSONS.length}</strong><div><i style={{ width: `${(lesson + 1) / LESSONS.length * 100}%` }} /></div><small>当前：{LESSONS[lesson].title}</small></QuantGlowCard>}>
    <section className="backtest-learning-layout">
      <aside className="backtest-lesson-nav"><div className="backtest-nav-heading"><BarChartOutlined /><span>回测学习路径</span></div>{LESSONS.map((item, index) => <button type="button" key={item.title} className={index === lesson ? "active" : ""} onClick={() => move(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.title}</strong><small>{item.short}</small></span>{index < lesson ? <CheckCircleFilled /> : null}</button>)}<div className="backtest-source-note"><BookOutlined /><p>口径与仓库回测教学导读及实际引擎一致。</p></div></aside>
      <main className="backtest-learning-main"><QuantGlowCard title={<SectionHeader title={LESSONS[lesson].title} description="概念、方法、交互示例和适用边界" />} badge={<StatusPill tone="profit">基础课程</StatusPill>}>{LABS[lesson]}</QuantGlowCard><QuantGlowCard title={<SectionHeader title="理解检查" description="判断你是否掌握本课的核心边界" />} badge={<StatusPill tone="ai">1 题</StatusPill>}><strong className="backtest-quiz-question">{quiz.question}</strong><div className="backtest-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => setAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>{answer !== null ? <div className={`backtest-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "回答正确" : "这个结论越过了证据边界"}</strong><span>{quiz.reason}</span></div> : null}</QuantGlowCard><div className="backtest-lesson-actions"><Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>{lesson < LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => navigate("/backtests")}>开始回测实验 <ArrowRightOutlined /></Button>}</div></main>
    </section>
  </TradingPageShell>;
}
