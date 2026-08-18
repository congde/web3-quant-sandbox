import {
  ArrowRightOutlined,
  BookOutlined,
  CalculatorOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
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
import { Fn, Fraction, Power, Root, Symbol as Sym } from "./FormulaNotation";
import "./math-learning.css";

const LESSONS = [
  { title: "收益率与复利", short: "钱是怎样增长的" },
  { title: "均值与波动", short: "平均表现可靠吗" },
  { title: "概率与期望", short: "不确定性如何计算" },
  { title: "相关与组合", short: "分散为什么有效" },
  { title: "夏普与回撤", short: "收益是否值得冒险" },
] as const;

const QUIZZES = [
  { question: "先涨 10%，再跌 10%，最终结果是什么？", options: ["正好回到原点", "亏损 1%", "盈利 1%"], answer: 1, reason: "1.10 × 0.90 = 0.99，所以最终亏损 1%。" },
  { question: "两组平均收益相同，哪一组风险通常更高？", options: ["标准差更大的", "样本更多的", "最新收益更高的"], answer: 0, reason: "标准差描述数据围绕均值的离散程度，越大通常表示越不稳定。" },
  { question: "一个结果概率 30%、收益 10%，它对期望收益的贡献是多少？", options: ["3%", "10%", "30%"], answer: 0, reason: "概率加权贡献 = 30% × 10% = 3%。" },
  { question: "两项资产波动相同，什么情况下分散效果通常最明显？", options: ["相关系数接近 1", "相关系数接近 0 或为负", "两项资产价格相同"], answer: 1, reason: "相关性越低，两项资产越不容易同涨同跌，组合波动通常越低。" },
  { question: "最大回撤主要回答哪个问题？", options: ["平均每天赚多少", "从历史高点最深跌了多少", "交易次数是多少"], answer: 1, reason: "最大回撤衡量净值从历史峰值到后续谷底的最大跌幅。" },
] as const;

function pct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function finite(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function Formula({ children, meaning }: { children: ReactNode; meaning: string }) {
  return <div className="math-formula"><div className="formula-notation">{children}</div><span className="formula-meaning">{meaning}</span></div>;
}

function ResultCell({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "up" | "down" }) {
  return <div className="math-result-cell"><span>{label}</span><strong className={tone}>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function ReturnLab() {
  const [start, setStart] = useState(100);
  const [end, setEnd] = useState(121);
  const [periods, setPeriods] = useState(2);
  const simple = start > 0 ? (end / start - 1) * 100 : 0;
  const logReturn = start > 0 && end > 0 ? Math.log(end / start) * 100 : 0;
  const compound = start > 0 && end > 0 && periods > 0 ? (Math.pow(end / start, 1 / periods) - 1) * 100 : 0;

  return <div className="math-lab-content">
    <section className="math-explain">
      <h3>先分清“赚了多少”和“每期增长多少”</h3>
      <p>简单收益率适合回答一次投资的盈亏；对数收益率具有时间可加性；复合增长率把多期结果换算成每期相同的增长速度。</p>
      <Formula meaning="期末价格相对期初价格的变化比例"><Sym>R</Sym> = <Fraction top={<><Sym sub="1">P</Sym> − <Sym sub="0">P</Sym></>} bottom={<Sym sub="0">P</Sym>} /></Formula>
      <Formula meaning="可跨时间相加，常用于统计建模"><Sym>r</Sym> = <Fn>ln</Fn> (<Fraction top={<Sym sub="1">P</Sym>} bottom={<Sym sub="0">P</Sym>} />)</Formula>
      <Formula meaning="n 期复合增长率，也叫 CAGR"><Sym>g</Sym> = <Power exponent="1/n">(<Fraction top={<Sym sub="1">P</Sym>} bottom={<Sym sub="0">P</Sym>} />)</Power> − 1</Formula>
      <div className="math-boundary">注意：收益率不能简单相加。连续两期必须使用 <code>(1 + R1)(1 + R2) − 1</code>。</div>
    </section>
    <section className="math-calculator">
      <header><CalculatorOutlined /><div><strong>收益计算器</strong><span>修改输入，结果实时更新</span></div></header>
      <div className="math-input-grid">
        <label><span>期初价格 P0</span><InputNumber min={0.01} value={start} onChange={(v) => setStart(finite(v, 100))} /></label>
        <label><span>期末价格 P1</span><InputNumber min={0.01} value={end} onChange={(v) => setEnd(finite(v, 121))} /></label>
        <label><span>持有期数 n</span><InputNumber min={1} max={100} value={periods} onChange={(v) => setPeriods(finite(v, 2))} /></label>
      </div>
      <div className="math-results">
        <ResultCell label="总简单收益" value={pct(simple)} tone={simple >= 0 ? "up" : "down"} note={`${formatMoney(start)} → ${formatMoney(end)}`} />
        <ResultCell label="总对数收益" value={pct(logReturn)} note="适合时间序列建模" />
        <ResultCell label="每期复合增长" value={pct(compound)} note={`连续 ${periods} 期`} />
      </div>
      <div className="math-trace"><b>代入：</b>({end} ÷ {start})^(1/{periods}) − 1 = <strong>{compound.toFixed(4)}%</strong></div>
    </section>
  </div>;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parseSeries(text: string) {
  return text.split(/[，,\s]+/).map(Number).filter(Number.isFinite);
}

function StatisticsLab() {
  const [text, setText] = useState("2, -1, 3, 0, 1");
  const values = useMemo(() => parseSeries(text), [text]);
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0;
  const std = Math.sqrt(variance);
  const annualVol = std * Math.sqrt(252);

  return <div className="math-lab-content">
    <section className="math-explain">
      <h3>均值描述中心，标准差描述不稳定程度</h3>
      <p>只看平均收益会隐藏过程。相同的均值可以来自非常平稳的序列，也可以来自剧烈涨跌的序列。</p>
      <Formula meaning="n 个观测值的算术平均"><Sym>μ</Sym> = <Fraction top={<><Fn>Σ</Fn> <Sym sub="i">R</Sym></>} bottom={<Sym>n</Sym>} /></Formula>
      <Formula meaning="样本方差使用 n−1，衡量离散程度"><Sym sup="2">s</Sym> = <Fraction top={<><Fn>Σ</Fn> <Power exponent="2">(<Sym sub="i">R</Sym> − <Sym>μ</Sym>)</Power></>} bottom={<><Sym>n</Sym> − 1</>} /></Formula>
      <Formula meaning="将日波动率换算为年化波动率"><Sym sub="annual">σ</Sym> = <Sym sub="daily">σ</Sym> × <Root>252</Root></Formula>
    </section>
    <section className="math-calculator">
      <header><ExperimentOutlined /><div><strong>统计量实验室</strong><span>输入逗号分隔的日收益率（%）</span></div></header>
      <label className="math-series-input"><span>收益序列</span><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="例如 2, -1, 3, 0, 1" /></label>
      <div className="math-data-chips">{values.map((value, index) => <i key={`${index}-${value}`} className={value >= 0 ? "positive" : "negative"}>{pct(value)}</i>)}</div>
      <div className="math-results">
        <ResultCell label="样本均值" value={pct(mean)} note={`${values.length} 个观测`} />
        <ResultCell label="样本方差" value={variance.toFixed(4)} note="单位为 %²" />
        <ResultCell label="样本标准差" value={`${std.toFixed(2)}%`} note="单期波动" />
        <ResultCell label="年化波动率" value={`${annualVol.toFixed(2)}%`} note="假设 252 个交易日" />
      </div>
      <div className="math-deviation-row">{values.map((value, index) => <span key={index} style={{ height: `${Math.max(8, Math.min(72, Math.abs(value - mean) * 18))}px` }} title={`与均值相差 ${(value - mean).toFixed(2)}%`} />)}</div>
    </section>
  </div>;
}

function ProbabilityLab() {
  const [pUp, setPUp] = useState(30);
  const [rUp, setRUp] = useState(12);
  const [pFlat, setPFlat] = useState(50);
  const [rFlat, setRFlat] = useState(2);
  const [pDown, setPDown] = useState(20);
  const [rDown, setRDown] = useState(-10);
  const probabilitySum = pUp + pFlat + pDown;
  const expected = (pUp * rUp + pFlat * rFlat + pDown * rDown) / 100;
  const variance = (pUp * (rUp - expected) ** 2 + pFlat * (rFlat - expected) ** 2 + pDown * (rDown - expected) ** 2) / 100;

  return <div className="math-lab-content">
    <section className="math-explain">
      <h3>期望不是预测，而是重复很多次的平均结果</h3>
      <p>每种结果的收益要乘以发生概率。正期望不代表下一次一定赚钱，还必须同时观察分布和亏损情景。</p>
      <Formula meaning="离散情景下的概率加权平均"><Fn>E</Fn>[<Sym>R</Sym>] = <Fn>Σ</Fn> <Sym sub="i">p</Sym> × <Sym sub="i">R</Sym></Formula>
      <Formula meaning="概率加权后的不确定性"><Fn>Var</Fn>(<Sym>R</Sym>) = <Fn>Σ</Fn> <Sym sub="i">p</Sym> <Power exponent="2">(<Sym sub="i">R</Sym> − <Fn>E</Fn>[<Sym>R</Sym>])</Power></Formula>
      <div className="math-boundary">所有情景概率之和必须等于 100%。当前合计：<strong className={probabilitySum === 100 ? "valid" : "invalid"}>{probabilitySum}%</strong></div>
    </section>
    <section className="math-calculator">
      <header><ExperimentOutlined /><div><strong>情景期望计算器</strong><span>设定三种可能结果</span></div></header>
      <div className="math-scenario-table">
        <div className="heading"><span>情景</span><span>概率 p</span><span>收益 R</span><span>期望贡献</span></div>
        <div><strong>上涨</strong><InputNumber min={0} max={100} value={pUp} addonAfter="%" onChange={(v) => setPUp(finite(v, 0))} /><InputNumber value={rUp} addonAfter="%" onChange={(v) => setRUp(finite(v, 0))} /><b>{(pUp * rUp / 100).toFixed(2)}%</b></div>
        <div><strong>平稳</strong><InputNumber min={0} max={100} value={pFlat} addonAfter="%" onChange={(v) => setPFlat(finite(v, 0))} /><InputNumber value={rFlat} addonAfter="%" onChange={(v) => setRFlat(finite(v, 0))} /><b>{(pFlat * rFlat / 100).toFixed(2)}%</b></div>
        <div><strong>下跌</strong><InputNumber min={0} max={100} value={pDown} addonAfter="%" onChange={(v) => setPDown(finite(v, 0))} /><InputNumber value={rDown} addonAfter="%" onChange={(v) => setRDown(finite(v, 0))} /><b>{(pDown * rDown / 100).toFixed(2)}%</b></div>
      </div>
      <div className="math-results">
        <ResultCell label="期望收益" value={probabilitySum === 100 ? pct(expected) : "概率未配平"} tone={probabilitySum === 100 ? (expected >= 0 ? "up" : "down") : undefined} />
        <ResultCell label="情景标准差" value={probabilitySum === 100 ? `${Math.sqrt(variance).toFixed(2)}%` : "—"} note="不确定性尺度" />
      </div>
    </section>
  </div>;
}

function PortfolioLab() {
  const [volA, setVolA] = useState(20);
  const [volB, setVolB] = useState(20);
  const [weightA, setWeightA] = useState(50);
  const [rho, setRho] = useState(0);
  const wA = weightA / 100;
  const wB = 1 - wA;
  const portfolioVol = Math.sqrt((wA * volA) ** 2 + (wB * volB) ** 2 + 2 * wA * wB * volA * volB * rho);
  const naiveVol = wA * volA + wB * volB;
  const reduction = naiveVol > 0 ? (1 - portfolioVol / naiveVol) * 100 : 0;

  return <div className="math-lab-content">
    <section className="math-explain">
      <h3>组合风险取决于资产怎样一起变化</h3>
      <p>相关系数 ρ 的范围是 −1 到 1。ρ 越低，两项资产同步涨跌的程度越弱，分散带来的风险下降通常越明显。</p>
      <Formula meaning="两资产组合波动率"><Sym sub="p">σ</Sym> = <Root><Sym sub="A" sup="2">w</Sym><Sym sub="A" sup="2">σ</Sym> + <Sym sub="B" sup="2">w</Sym><Sym sub="B" sup="2">σ</Sym> + 2<Sym sub="A">w</Sym><Sym sub="B">w</Sym><Sym sub="A">σ</Sym><Sym sub="B">σ</Sym><Sym sub="AB">ρ</Sym></Root></Formula>
      <Formula meaning="只描述共同变化，不证明因果"><Sym sub="AB">ρ</Sym> = <Fraction top={<><Fn>Cov</Fn>(<Sym sub="A">R</Sym>, <Sym sub="B">R</Sym>)</>} bottom={<><Sym sub="A">σ</Sym><Sym sub="B">σ</Sym></>} /></Formula>
      <div className="math-boundary">相关性会随时间变化。历史低相关不保证危机时期仍然低相关。</div>
    </section>
    <section className="math-calculator">
      <header><ExperimentOutlined /><div><strong>组合波动模拟器</strong><span>拖动相关系数观察分散效果</span></div></header>
      <div className="math-slider-grid">
        <label><span>资产 A 波动率 <b>{volA}%</b></span><Slider min={1} max={60} value={volA} onChange={setVolA} /></label>
        <label><span>资产 B 波动率 <b>{volB}%</b></span><Slider min={1} max={60} value={volB} onChange={setVolB} /></label>
        <label><span>资产 A 权重 <b>{weightA}%</b></span><Slider min={0} max={100} value={weightA} onChange={setWeightA} /></label>
        <label><span>相关系数 ρ <b>{rho.toFixed(2)}</b></span><Slider min={-1} max={1} step={0.05} value={rho} onChange={setRho} /></label>
      </div>
      <div className="math-results">
        <ResultCell label="组合波动率" value={`${portfolioVol.toFixed(2)}%`} note="考虑相关性" />
        <ResultCell label="简单加权波动" value={`${naiveVol.toFixed(2)}%`} note="忽略分散效应" />
        <ResultCell label="波动降低" value={`${Math.max(0, reduction).toFixed(1)}%`} tone="up" note="相对简单加权" />
      </div>
      <div className="math-risk-bars"><div><span>组合</span><i style={{ width: `${Math.min(100, portfolioVol / 60 * 100)}%` }} /></div><div><span>简单加权</span><i className="naive" style={{ width: `${Math.min(100, naiveVol / 60 * 100)}%` }} /></div></div>
    </section>
  </div>;
}

function maxDrawdown(values: number[]) {
  let peak = values[0] ?? 0;
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) worst = Math.min(worst, value / peak - 1);
  }
  return worst * 100;
}

function RiskLab() {
  const [annualReturn, setAnnualReturn] = useState(15);
  const [riskFree, setRiskFree] = useState(2);
  const [volatility, setVolatility] = useState(12);
  const [navText, setNavText] = useState("100, 108, 105, 112, 96, 102, 118");
  const nav = useMemo(() => parseSeries(navText).filter((value) => value > 0), [navText]);
  const sharpe = volatility > 0 ? (annualReturn - riskFree) / volatility : 0;
  const drawdown = maxDrawdown(nav);

  return <div className="math-lab-content">
    <section className="math-explain">
      <h3>收益必须和承担的风险一起看</h3>
      <p>夏普比率衡量每承担一单位波动获得多少超额收益；最大回撤衡量净值从历史峰值到后续谷底的最深跌幅。</p>
      <Formula meaning="单位风险对应的超额收益"><Fn>Sharpe</Fn> = <Fraction top={<><Sym sub="p">R</Sym> − <Sym sub="f">R</Sym></>} bottom={<Sym sub="p">σ</Sym>} /></Formula>
      <Formula meaning="对每个时点计算相对历史峰值的跌幅，再取最小值"><Fn>MDD</Fn> = <Fn>min</Fn> (<Fraction top={<Sym sub="t">V</Sym>} bottom={<><Fn>max</Fn>(<Sym sub="0…t">V</Sym>)</>} /> − 1)</Formula>
      <div className="math-boundary">夏普相同的策略，尾部风险和最大回撤仍可能完全不同，不能只看单一指标。</div>
    </section>
    <section className="math-calculator">
      <header><ExperimentOutlined /><div><strong>风险调整收益计算器</strong><span>同时观察平均表现与最坏过程</span></div></header>
      <div className="math-input-grid">
        <label><span>年化收益 Rp</span><InputNumber value={annualReturn} addonAfter="%" onChange={(v) => setAnnualReturn(finite(v, 0))} /></label>
        <label><span>无风险收益 Rf</span><InputNumber value={riskFree} addonAfter="%" onChange={(v) => setRiskFree(finite(v, 0))} /></label>
        <label><span>年化波动 σp</span><InputNumber min={0.01} value={volatility} addonAfter="%" onChange={(v) => setVolatility(finite(v, 1))} /></label>
      </div>
      <label className="math-series-input"><span>净值序列</span><Input value={navText} onChange={(event) => setNavText(event.target.value)} /></label>
      <div className="math-results">
        <ResultCell label="夏普比率" value={sharpe.toFixed(2)} note={sharpe >= 1 ? "风险调整后收益较好" : "需要结合更多证据"} />
        <ResultCell label="最大回撤" value={`${drawdown.toFixed(2)}%`} tone="down" note="历史峰值至谷底" />
      </div>
      <svg className="math-nav-chart" viewBox="0 0 520 115" role="img" aria-label="净值序列示意图">
        <polyline points={nav.map((value, index) => {
          const min = Math.min(...nav); const max = Math.max(...nav); const span = max - min || 1;
          return `${20 + index / Math.max(1, nav.length - 1) * 480},${95 - (value - min) / span * 75}`;
        }).join(" ")} fill="none" stroke="#1f9d72" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </section>
  </div>;
}

const LABS = [<ReturnLab />, <StatisticsLab />, <ProbabilityLab />, <PortfolioLab />, <RiskLab />];

export default function MathLearningPage() {
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
    eyebrow="MATH LAB · FORMULA → INPUT → RESULT"
    title="基础数学学堂"
    description="不背孤立公式：修改数字、观察结果、理解公式能回答什么，以及它不能证明什么。所有计算仅用于公益教学。"
    actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button onClick={() => navigate("/backtests")}>查看回测指标</Button></>}
    aside={<QuantGlowCard className="math-progress-card"><span>课程进度</span><strong>{lesson + 1} / {LESSONS.length}</strong><div><i style={{ width: `${(lesson + 1) / LESSONS.length * 100}%` }} /></div><small>当前：{LESSONS[lesson].title}</small></QuantGlowCard>}
  >
    <section className="math-learning-layout">
      <aside className="math-lesson-nav">
        <div className="math-nav-heading"><CalculatorOutlined /><span>公式学习路径</span></div>
        {LESSONS.map((item, index) => <button type="button" key={item.title} className={index === lesson ? "active" : ""} onClick={() => move(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.title}</strong><small>{item.short}</small></span>{index < lesson ? <CheckCircleFilled /> : null}</button>)}
        <div className="math-source-note"><BookOutlined /><p>公式口径与仓库《量化基础数学公式》教材一致。</p></div>
      </aside>

      <main className="math-learning-main">
        <QuantGlowCard title={<SectionHeader title={LESSONS[lesson].title} description="公式含义、实时计算与使用边界" />} badge={<StatusPill tone="profit">互动实验</StatusPill>}>
          {LABS[lesson]}
        </QuantGlowCard>

        <QuantGlowCard className="math-quiz-card" title={<SectionHeader title="理解检查" description="选出答案后查看解释" />} badge={<StatusPill tone="ai">1 题</StatusPill>}>
          <strong className="math-quiz-question">{quiz.question}</strong>
          <div className="math-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => setAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>
          {answer !== null ? <div className={`math-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "回答正确" : "再想一步"}</strong><span>{quiz.reason}</span></div> : null}
        </QuantGlowCard>

        <div className="math-lesson-actions">
          <Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>
          {lesson < LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => navigate("/backtests")}>把公式带入回测 <ArrowRightOutlined /></Button>}
        </div>
      </main>
    </section>
  </TradingPageShell>;
}
