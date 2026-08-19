import {
  ArrowRightOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ExperimentOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Button, InputNumber, Segmented, Slider } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import { FormulaHandbook } from "./FormulaHandbook";
import { LearningCourseNav } from "./LearningCourseNav";
import "./backtest-learning.css";
import "./learning-layout.css";

type LessonLevel = "基础" | "核心" | "进阶" | "落地";

const LESSONS: ReadonlyArray<{ title: string; short: string; phase: string; level: LessonLevel }> = [
  { title: "回测问题与证据", short: "先定义它能证明什么", phase: "研究设计", level: "基础" },
  { title: "构建可验证样本", short: "样本、预热、切分与覆盖", phase: "研究设计", level: "核心" },
  { title: "时序与滚动实验", short: "只用当时已知的信息", phase: "研究设计", level: "核心" },
  { title: "成交与交易成本", short: "把理想收益拉回现实", phase: "模拟执行", level: "核心" },
  { title: "基准与效果指标", short: "收益必须放进上下文", phase: "效果评价", level: "核心" },
  { title: "样本外验证", short: "Hold-out、Walk-forward、嵌套验证", phase: "效果评价", level: "进阶" },
  { title: "参数稳健与多重检验", short: "识别尖峰参数和虚假发现", phase: "稳健性", level: "进阶" },
  { title: "Bootstrap 与蒙特卡洛", short: "重排路径并检查尾部", phase: "压力测试", level: "进阶" },
  { title: "决策门槛与研究报告", short: "把结果变成可审计结论", phase: "研究交付", level: "落地" },
];

const QUIZZES = [
  { question: "一次历史回测收益很高，最合理的结论是什么？", options: ["未来一定盈利", "规则在该样本和假设下表现较好", "可以立即实盘满仓"], answer: 1, reason: "回测只描述历史样本和既定假设下的模拟结果，不能保证未来收益。" },
  { question: "用今天仍存在的币种名单回测五年前的横截面策略，主要遗漏了什么？", options: ["幸存者偏差", "手续费", "年化因子"], answer: 0, reason: "历史样本必须使用当时可获得的资产集合，并保留退市、下架和失败标的。" },
  { question: "策略使用当天收盘价产生信号，最保守的成交时点通常是？", options: ["当天收盘前", "下一根 K 线可成交时点", "当天最低价"], answer: 1, reason: "收盘后才能完整知道当天收盘价，因此不能假设提前在当天理想价格成交。" },
  { question: "为什么高换手策略对手续费和滑点更敏感？", options: ["交易次数增加会重复支付成本", "K 线数量更少", "胜率一定更低"], answer: 0, reason: "每次买卖都会产生费用和价格冲击，换手越高，成本侵蚀越强。" },
  { question: "策略收益 10%，同期买入持有收益 18%，首先应该注意什么？", options: ["绝对收益为正就足够", "策略可能没有跑赢简单基准", "基准没有意义"], answer: 1, reason: "基准回答“不使用复杂策略会怎样”，是判断策略是否增加价值的必要参照。" },
  { question: "参数使用了验证集挑选后，最终测试集应该怎样使用？", options: ["继续反复调参", "只做预先约定的一次最终评价", "并入训练集后再汇报"], answer: 1, reason: "测试集一旦参与选择就不再是样本外，最终评价应预先约定并尽量只使用一次。" },
  { question: "只有某一个精确参数产生高 Sharpe，相邻参数全部失效，说明什么？", options: ["参数非常精确", "结果可能是噪声尖峰", "可以提高杠杆"], answer: 1, reason: "可信规则通常在合理参数邻域形成平台，而不是只在单点出现漂亮结果。" },
  { question: "交易序列蒙特卡洛最重要的用途是什么？", options: ["证明未来收益", "观察路径重排后的收益与回撤分布", "制造更高的历史收益"], answer: 1, reason: "蒙特卡洛用于描述路径不确定性和尾部范围，不能创造未来保证。" },
  { question: "策略通过历史测试后，最稳妥的下一步是什么？", options: ["直接连接真实账户", "按门槛完成仿真、观察和小额验证", "删除失败实验"], answer: 1, reason: "研究结论应经过成本压力、样本外、尾部和可复现门槛，再进入受限的仿真与观察阶段。" },
] as const;

function finite(value: number | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, lower: number, upper: number) {
  return Math.min(upper, Math.max(lower, value));
}

function Concept({ title, children }: { title: string; children: ReactNode }) {
  return <div className="backtest-concept"><strong>{title}</strong><span>{children}</span></div>;
}

function Result({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "positive" | "negative" | "warning" | "neutral" }) {
  return <div className={`backtest-result ${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function DefinitionLab() {
  const [active, setActive] = useState<"question" | "data" | "rule" | "simulation" | "limit">("question");
  const items = {
    question: { title: "问题", question: "假设能否被证伪？", detail: "先写清研究对象、预测或解释目标、持有期、比较基准和拒绝条件，禁止看到结果后再改问题。" },
    data: { title: "数据", question: "用了哪段历史？", detail: "记录资产集合、周期、起止时间、来源、版本，以及每个时点当时真正可见的信息。" },
    rule: { title: "规则", question: "什么时候买卖？", detail: "信号、仓位和退出条件必须没有歧义，同样输入应产生同样决策。" },
    simulation: { title: "模拟", question: "订单怎样成交？", detail: "按时间顺序推进，明确市价/限价、延迟、部分成交、成本、仓位和风控。" },
    limit: { title: "边界", question: "它不能证明什么？", detail: "不能证明未来收益，也不能证明真实市场一定能按模拟价格和容量成交。" },
  } as const;
  const current = items[active];

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>回测是带时间边界的条件实验</h3>
      <p><b>研究假设 + 冻结样本 + 可执行规则 + 成交模拟 + 评价标准</b>共同构成回测。</p>
      <p>它不是寻找最好看净值的工具，而是主动寻找规则在哪些条件下失效。</p>
      <div className="backtest-proof-grid"><Concept title="可以说明">规则在指定样本、成本和成交假设下的历史表现</Concept><Concept title="不能说明">未来一定盈利、真实成交价或某个信号永久有效</Concept></div>
    </section>
    <section className="backtest-simulator">
      <header><BookOutlined /><div><strong>研究设计的五个问题</strong><span>逐项点击，先定义证据再运行回测</span></div></header>
      <div className="backtest-definition-tabs">{Object.entries(items).map(([key, item]) => <button type="button" key={key} className={active === key ? "active" : ""} onClick={() => setActive(key as keyof typeof items)}><b>{item.title}</b><span>{item.question}</span></button>)}</div>
      <div className="backtest-definition-detail"><strong>{current.question}</strong><p>{current.detail}</p></div>
    </section>
  </div>;
}

function SampleConstructionLab() {
  const [totalBars, setTotalBars] = useState(1800);
  const [warmupBars, setWarmupBars] = useState(120);
  const [trainPct, setTrainPct] = useState(60);
  const [validPct, setValidPct] = useState(20);
  const [holdingBars, setHoldingBars] = useState(20);
  const available = Math.max(0, totalBars - warmupBars);
  const trainBars = Math.floor(available * trainPct / 100);
  const validBars = Math.floor(available * validPct / 100);
  const testBars = Math.max(0, available - trainBars - validBars);
  const testCycles = holdingBars > 0 ? testBars / holdingBars : 0;
  const coverageTone = testCycles >= 10 ? "positive" : testCycles >= 5 ? "warning" : "negative";

  function changeTrain(value: number) {
    setTrainPct(Math.min(value, 90 - validPct));
  }

  function changeValidation(value: number) {
    setValidPct(Math.min(value, 90 - trainPct));
  }

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>样本不是一段价格，而是一份时间可追溯的数据合同</h3>
      <p>先确定研究总体和当时可见的资产集合，再处理时区、频率、缺失、重复、复权或代币迁移。指标预热区不能计入有效评价样本。</p>
      <div className="backtest-sample-checklist">
        <Concept title="总体与资产池">使用 point-in-time 成分，保留退市与下架标的</Concept>
        <Concept title="时间对齐">统一时区、K 线闭合时点和跨市场日历</Concept>
        <Concept title="特征预热">最长窗口之前只用于初始化，不参与绩效</Concept>
        <Concept title="时间切分">训练、验证、测试顺序排列，禁止随机打乱</Concept>
      </div>
      <div className="backtest-boundary">样本长度要按策略持有期和市场状态衡量。1,000 根高度重叠的 K 线，不等于 1,000 个独立证据。</div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>样本切分工作台</strong><span>调整预热、时间切分和典型持有期</span></div></header>
      <div className="backtest-input-grid backtest-sample-inputs">
        <label><span>原始 K 线数量</span><InputNumber min={300} max={10000} step={100} value={totalBars} onChange={(value) => setTotalBars(finite(value, 1800))} /></label>
        <label><span>指标预热长度</span><InputNumber min={0} max={Math.max(0, totalBars - 100)} step={10} value={warmupBars} onChange={(value) => setWarmupBars(finite(value, 120))} /></label>
        <label><span>训练占有效样本 <b>{trainPct}%</b></span><Slider min={40} max={75} value={trainPct} onChange={changeTrain} /></label>
        <label><span>验证占有效样本 <b>{validPct}%</b></span><Slider min={10} max={30} value={validPct} onChange={changeValidation} /></label>
        <label><span>典型持有期</span><InputNumber min={1} max={200} value={holdingBars} addonAfter="根" onChange={(value) => setHoldingBars(finite(value, 20))} /></label>
      </div>
      <div className="backtest-sample-timeline" aria-label="样本时间切分">
        <i className="warmup" style={{ flex: Math.max(1, warmupBars) }}><b>预热</b><span>{warmupBars}</span></i>
        <i className="train" style={{ flex: Math.max(1, trainBars) }}><b>训练</b><span>{trainBars}</span></i>
        <i className="validation" style={{ flex: Math.max(1, validBars) }}><b>验证</b><span>{validBars}</span></i>
        <i className="test" style={{ flex: Math.max(1, testBars) }}><b>测试</b><span>{testBars}</span></i>
      </div>
      <div className="backtest-results"><Result label="有效观测" value={available.toLocaleString()} note="扣除指标预热" /><Result label="测试样本" value={testBars.toLocaleString()} /><Result label="测试覆盖周期" value={`${testCycles.toFixed(1)} 次`} tone={coverageTone} /><Result label="初步判断" value={testCycles >= 10 ? "覆盖尚可" : "测试段偏短"} tone={coverageTone} /></div>
    </section>
  </div>;
}

const PROCESS_STEPS = [
  { title: "冻结假设", detail: "预先写明信号、目标、基准、参数范围和拒绝条件。", output: "研究协议" },
  { title: "拟合训练窗", detail: "只在训练窗口拟合参数或模型，不读取验证和测试阶段。", output: "候选规则" },
  { title: "验证选择", detail: "在后续验证窗比较有限候选，并保存全部尝试记录。", output: "冻结方案" },
  { title: "向前测试", detail: "参数冻结后，在下一段未见数据上逐根推进并记录成交。", output: "样本外轨迹" },
  { title: "滚动复核", detail: "训练和测试窗口继续向前滚动，汇总不同市场阶段的结果。", output: "跨阶段证据" },
] as const;

function ProcessLab() {
  const [step, setStep] = useState(0);
  const [windowMode, setWindowMode] = useState<"expanding" | "rolling">("expanding");
  const current = PROCESS_STEPS[step];
  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>第 N 根只能读取第 N 根及以前的信息</h3>
      <p>信号计算、参数拟合、资产池、资金费和链上状态都必须遵守同一时间边界；任何全样本标准化都可能把未来信息带回历史。</p>
      <div className="backtest-time-rule"><ClockCircleOutlined /><span><b>可交易时点</b>信号何时完整已知，订单就只能在该时点之后按可实现价格成交。</span></div>
      <div className="backtest-code-pair"><code className="safe">feature.shift(1)  ✓ 使用已知特征</code><code className="unsafe">return.shift(-5)  ✕ 读取未来收益</code></div>
      <div className="backtest-window-choice"><button type="button" className={windowMode === "expanding" ? "active" : ""} onClick={() => setWindowMode("expanding")}><b>扩展窗口</b><span>保留全部历史，训练集逐步增长</span></button><button type="button" className={windowMode === "rolling" ? "active" : ""} onClick={() => setWindowMode("rolling")}><b>滚动窗口</b><span>固定长度，更快适应结构变化</span></button></div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>时间隔离的滚动研究流程</strong><span>点击步骤查看每一步的产物</span></div></header>
      <div className="backtest-process-line">{PROCESS_STEPS.map((item, index) => <button type="button" key={item.title} className={step === index ? "active" : ""} onClick={() => setStep(index)}><i>{index + 1}</i><span>{item.title}</span></button>)}</div>
      <div className="backtest-step-detail"><span>步骤 {step + 1} · {windowMode === "expanding" ? "扩展窗口" : "滚动窗口"}</span><h4>{current.title}</h4><p>{current.detail}</p><b>产物：{current.output}</b></div>
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
      <h3>信号收益不等于可实现收益</h3>
      <p>手续费是明确收费；滑点来自参考价与成交价偏差；大额订单还受到点差、深度、参与率、延迟和市场冲击约束。</p>
      <div className="backtest-equation">净收益 ≈ 毛收益 − 换手倍数 ×（手续费率 + 滑点率）</div>
      <div className="backtest-boundary">应分别测试基准、悲观和极端成本，并验证订单规模是否超过当时市场可承载容量。</div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>交易成本侵蚀计算器</strong><span>1 bp = 0.01%</span></div></header>
      <div className="backtest-input-grid">
        <label><span>成本前收益</span><InputNumber value={grossReturn} addonAfter="%" onChange={(value) => setGrossReturn(finite(value, 20))} /></label>
        <label><span>累计换手倍数</span><InputNumber min={0} value={turnover} onChange={(value) => setTurnover(finite(value, 10))} /></label>
        <label><span>单边手续费</span><InputNumber min={0} value={feeBps} addonAfter="bp" onChange={(value) => setFeeBps(finite(value, 10))} /></label>
        <label><span>单边滑点</span><InputNumber min={0} value={slippageBps} addonAfter="bp" onChange={(value) => setSlippageBps(finite(value, 5))} /></label>
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
      <h3>效果不是一个收益数字，而是一组相互约束的证据</h3>
      <p>至少同时报告绝对收益、匹配基准、波动、回撤、恢复时间、交易数量、换手和收益集中度。</p>
      <div className="backtest-metric-list"><Concept title="增量价值">策略相对现金、买入持有或风险匹配基准的超额</Concept><Concept title="路径代价">最大回撤、回撤持续时间和恢复时间</Concept><Concept title="风险效率">Sharpe、Sortino、Calmar 与信息比率</Concept><Concept title="交易质量">胜率、赔率、盈利因子和极端交易依赖</Concept></div>
      <div className="backtest-boundary">指标必须同时给出样本长度和不确定性。交易次数过少时，Sharpe 与胜率都会非常不稳定。</div>
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
      <div className="backtest-results"><Result label="相对基准" value={`${excess >= 0 ? "+" : ""}${excess.toFixed(2)}%`} tone={excess >= 0 ? "positive" : "warning"} /><Result label="Sharpe" value={sharpe.toFixed(2)} note="简化年化口径" /><Result label="Calmar" value={calmar.toFixed(2)} /><Result label="初步结论" value={excess >= 0 && sharpe >= 1 ? "进入样本外验证" : "增量证据不足"} tone={excess >= 0 && sharpe >= 1 ? "positive" : "warning"} /></div>
    </section>
  </div>;
}

const VALIDATION_METHODS = {
  holdout: { title: "固定留出", detail: "按时间切成训练、验证、测试。简单透明，但结论可能依赖单一切点。", use: "规则简单、样本充足、只做少量参数选择" },
  walk: { title: "Walk-forward", detail: "训练窗和样本外窗依次向前滚动，汇总不同市场阶段的真实样本外轨迹。", use: "时间序列策略、参数需要定期更新" },
  nested: { title: "嵌套验证", detail: "外层只估计泛化效果，内层负责选择参数，避免同一验证结果既调参又评分。", use: "候选模型多、超参数搜索复杂" },
} as const;

function ValidationLab() {
  const [method, setMethod] = useState<keyof typeof VALIDATION_METHODS>("walk");
  const [inSampleSharpe, setInSampleSharpe] = useState(1.8);
  const [outSampleSharpe, setOutSampleSharpe] = useState(0.9);
  const [folds, setFolds] = useState(6);
  const [profitableFolds, setProfitableFolds] = useState(4);
  const [attempts, setAttempts] = useState(40);
  const decay = inSampleSharpe > 0 ? (1 - outSampleSharpe / inSampleSharpe) * 100 : 100;
  const passRate = profitableFolds / folds * 100;
  const adjustedAlpha = 5 / Math.max(1, attempts);
  const passed = outSampleSharpe >= 0.6 && decay <= 50 && passRate >= 60;
  const current = VALIDATION_METHODS[method];

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>验证的目标是估计泛化，不是再次寻找最优</h3>
      <p>训练集拟合，验证集选择，测试集只负责最终评价。使用测试结果继续修改规则，就等于把测试集重新变成训练数据。</p>
      <div className="backtest-validation-methods">{Object.entries(VALIDATION_METHODS).map(([key, item]) => <button type="button" key={key} className={method === key ? "active" : ""} onClick={() => setMethod(key as keyof typeof VALIDATION_METHODS)}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>
      <div className="backtest-time-rule"><SafetyOutlined /><span><b>适用场景</b>{current.use}</span></div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>样本外证据仪表板</strong><span>检查衰减、跨窗口一致性和试验次数</span></div><StatusPill tone={passed ? "profit" : "ai"}>{passed ? "通过初筛" : "继续验证"}</StatusPill></header>
      <div className="backtest-slider-grid">
        <label><span>样本内 Sharpe <b>{inSampleSharpe.toFixed(1)}</b></span><Slider min={0.1} max={3} step={0.1} value={inSampleSharpe} onChange={setInSampleSharpe} /></label>
        <label><span>样本外 Sharpe <b>{outSampleSharpe.toFixed(1)}</b></span><Slider min={-1} max={2.5} step={0.1} value={outSampleSharpe} onChange={setOutSampleSharpe} /></label>
        <label><span>滚动窗口数量 <b>{folds}</b></span><Slider min={3} max={10} value={folds} onChange={(value) => { setFolds(value); setProfitableFolds((currentValue) => Math.min(currentValue, value)); }} /></label>
        <label><span>正收益窗口 <b>{profitableFolds}</b></span><Slider min={0} max={folds} value={profitableFolds} onChange={setProfitableFolds} /></label>
        <label><span>累计尝试方案 <b>{attempts}</b></span><Slider min={1} max={200} value={attempts} onChange={setAttempts} /></label>
      </div>
      <div className="backtest-folds" aria-label={`${folds} 个滚动验证窗口`}>{Array.from({ length: folds }, (_, index) => <div key={index}><span>F{index + 1}</span><i style={{ width: `${48 + index * 4}%` }}>训练</i><b className={index < profitableFolds ? "pass" : "fail"}>OOS</b></div>)}</div>
      <div className="backtest-results"><Result label="样本外衰减" value={`${decay.toFixed(1)}%`} tone={decay <= 50 ? "positive" : "warning"} /><Result label="正收益窗口率" value={`${passRate.toFixed(0)}%`} tone={passRate >= 60 ? "positive" : "warning"} /><Result label="Bonferroni 阈值" value={`${adjustedAlpha.toFixed(3)}%`} note={`${attempts} 次尝试`} /><Result label="验证结论" value={passed ? "进入压力测试" : "泛化证据不足"} tone={passed ? "positive" : "warning"} /></div>
    </section>
  </div>;
}

const BIAS_ITEMS = [
  { key: "lookahead", title: "前视与标签泄漏", example: "全样本标准化，或使用未来收盘价决定当前仓位", fix: "所有特征、资产池和拟合器都按时间点重新构造" },
  { key: "survivorship", title: "幸存者偏差", example: "只回测今天仍存在的优质标的", fix: "使用 point-in-time 资产集合，保留下架和失败样本" },
  { key: "overlap", title: "重叠样本", example: "把高度重叠的未来收益当成独立观测", fix: "按持有期估算有效样本量，并使用分块方法" },
  { key: "overfit", title: "参数过拟合", example: "尝试上千组参数，只报告最好结果", fix: "预先限制搜索空间；检查参数邻域和样本外衰减" },
  { key: "multiple", title: "多重检验", example: "测试 200 个策略，仍用单次 5% 显著水平", fix: "保存试验总数，使用修正阈值、PBO 或 Deflated Sharpe" },
  { key: "cost", title: "成本与容量遗漏", example: "假设零滑点、无限深度和全部成交", fix: "加入分级成本、参与率、延迟与容量压力测试" },
] as const;

function RobustnessLab() {
  const [checked, setChecked] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [surface, setSurface] = useState<"plateau" | "spike">("plateau");
  const score = checked.length / BIAS_ITEMS.length * 100;
  const item = BIAS_ITEMS[active];
  const parameterScores = surface === "plateau" ? [0.86, 0.94, 1.02, 0.96, 0.88] : [0.12, 0.31, 1.84, 0.28, -0.05];
  function toggle(key: string) { setChecked((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]); }

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>稳健结果通常是平台，不是单点尖峰</h3>
      <p>相邻参数、不同起止日期、不同资产和不同成本假设下仍保留方向一致的优势，才值得继续研究。</p>
      <div className="backtest-surface-switch"><button type="button" className={surface === "plateau" ? "active" : ""} onClick={() => setSurface("plateau")}>稳健平台</button><button type="button" className={surface === "spike" ? "active" : ""} onClick={() => setSurface("spike")}>过拟合尖峰</button></div>
      <div className="backtest-parameter-strip">{parameterScores.map((value, index) => <div key={index} className={value >= 0.75 ? "good" : value < 0 ? "bad" : ""}><span>参数 {18 + index}</span><strong>{value.toFixed(2)}</strong></div>)}</div>
      <div className="backtest-boundary">参数平台也不能代替样本外验证；它只说明结果没有完全依赖某个精确参数。</div>
    </section>
    <section className="backtest-simulator">
      <header><SafetyOutlined /><div><strong>回测可信度审计</strong><span>查看偏差、修复方法并完成检查</span></div><StatusPill tone={score === 100 ? "profit" : "ai"}>{score.toFixed(0)}%</StatusPill></header>
      <div className="backtest-bias-layout"><div className="backtest-bias-list">{BIAS_ITEMS.map((entry, index) => <button type="button" key={entry.key} className={active === index ? "active" : ""} onClick={() => setActive(index)}><span onClick={(event) => { event.stopPropagation(); toggle(entry.key); }}>{checked.includes(entry.key) ? <CheckCircleFilled /> : <i />}</span><b>{entry.title}</b></button>)}</div><div className="backtest-bias-detail"><span>常见错误</span><p>{item.example}</p><span>修复方法</span><p>{item.fix}</p></div></div>
    </section>
  </div>;
}

type MonteCarloMethod = "iid" | "block" | "stress";

const MONTE_CARLO_METHODS: Record<MonteCarloMethod, { title: string; description: string; boundary: string }> = {
  iid: { title: "逐笔 Bootstrap", description: "从历史交易逐笔有放回抽样，估计随机交易顺序带来的结果范围。", boundary: "会破坏连亏、波动聚集和市场状态持续性。" },
  block: { title: "分块 Bootstrap", description: "随机抽取连续交易块，尽量保留短期连胜、连亏和状态聚集。", boundary: "块长度是关键假设，样本过短时可用块仍然有限。" },
  stress: { title: "参数压力模拟", description: "在重采样基础上降低盈利、放大亏损，观察优势恶化后的尾部。", boundary: "压力幅度必须由历史极端、容量和业务约束支持。" },
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let current = value;
    current = Math.imul(current ^ current >>> 15, current | 1);
    current ^= current + Math.imul(current ^ current >>> 7, current | 61);
    return ((current ^ current >>> 14) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], probability: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function simulateMonteCarlo({ method, winRate, averageWin, averageLoss, riskPct, trades, paths, seed }: { method: MonteCarloMethod; winRate: number; averageWin: number; averageLoss: number; riskPct: number; trades: number; paths: number; seed: number }) {
  const historyRandom = seededRandom(seed + 11);
  const historyLength = clamp(Math.max(120, trades), 120, 300);
  const history: number[] = [];
  let regimeShift = 0;
  for (let index = 0; index < historyLength; index += 1) {
    if (index % 8 === 0) regimeShift = (historyRandom() - 0.5) * 0.24;
    const won = historyRandom() < clamp(winRate / 100 + regimeShift, 0.05, 0.95);
    const jitter = 0.75 + historyRandom() * 0.5;
    history.push(won ? averageWin * jitter : -averageLoss * jitter);
  }

  const random = seededRandom(seed);
  const finalReturns: number[] = [];
  const drawdowns: number[] = [];
  let losingPaths = 0;
  let ruinPaths = 0;
  const blockLength = 6;

  for (let path = 0; path < paths; path += 1) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    let hitRuin = false;
    let blockStart = 0;
    for (let trade = 0; trade < trades; trade += 1) {
      let resultR: number;
      if (method === "block") {
        if (trade % blockLength === 0) blockStart = Math.floor(random() * history.length);
        resultR = history[(blockStart + trade % blockLength) % history.length];
      } else {
        resultR = history[Math.floor(random() * history.length)];
      }
      if (method === "stress") resultR = resultR >= 0 ? resultR * 0.82 : resultR * 1.22;
      equity *= Math.max(0.01, 1 + resultR * riskPct / 100);
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, 1 - equity / peak);
      if (equity <= 0.7) hitRuin = true;
    }
    const finalReturn = (equity - 1) * 100;
    finalReturns.push(finalReturn);
    drawdowns.push(maxDrawdown * 100);
    if (finalReturn < 0) losingPaths += 1;
    if (hitRuin) ruinPaths += 1;
  }

  finalReturns.sort((left, right) => left - right);
  drawdowns.sort((left, right) => left - right);
  return {
    returnP05: percentile(finalReturns, 0.05),
    returnP50: percentile(finalReturns, 0.5),
    returnP95: percentile(finalReturns, 0.95),
    drawdownP50: percentile(drawdowns, 0.5),
    drawdownP95: percentile(drawdowns, 0.95),
    lossProbability: losingPaths / paths * 100,
    ruinProbability: ruinPaths / paths * 100,
  };
}

function MonteCarloLab() {
  const [method, setMethod] = useState<MonteCarloMethod>("block");
  const [winRate, setWinRate] = useState(44);
  const [averageWin, setAverageWin] = useState(1.6);
  const [averageLoss, setAverageLoss] = useState(1);
  const [riskPct, setRiskPct] = useState(1);
  const [trades, setTrades] = useState(180);
  const [paths, setPaths] = useState(800);
  const [seedOffset, setSeedOffset] = useState(0);
  const results = useMemo(() => simulateMonteCarlo({ method, winRate, averageWin, averageLoss, riskPct, trades, paths, seed: 20260819 + seedOffset }), [method, winRate, averageWin, averageLoss, riskPct, trades, paths, seedOffset]);
  const current = MONTE_CARLO_METHODS[method];

  return <div className="backtest-lab-content backtest-monte-carlo-lab">
    <section className="backtest-monte-intro">
      <header>
        <span>先读导论 · WHEN & WHY</span>
        <h3>什么时候使用蒙特卡洛？</h3>
        <p><b>在规则已经冻结、历史回测完成、样本外与成本检查通过之后，进入资金配置或仿真之前。</b>它不再回答“这条历史曲线赚了多少”，而是回答交易顺序改变、连亏聚集或参数恶化时，收益和回撤可能落在什么范围。</p>
      </header>
      <div className="backtest-monte-flow" aria-label="蒙特卡洛在回测研究中的位置">
        <span>历史回测</span><b>→</b><span>样本外验证</span><b>→</b><span>稳健性审计</span><b>→</b><span className="active">蒙特卡洛</span><b>→</b><span>资金与回撤门槛</span><b>→</b><span>隔离仿真</span>
      </div>
      <div className="backtest-monte-when">
        <article className="use">
          <strong><CheckCircleFilled /> 适合使用</strong>
          <ul>
            <li>比较相同平均收益下，交易顺序造成的最大回撤差异</li>
            <li>估计 P05 终值、P95 回撤、连续亏损和风险线触及比例</li>
            <li>检查仓位大小、单笔风险和资金门槛是否承受得住坏路径</li>
            <li>对胜率、赔率、成本或市场状态恶化做压力情景</li>
          </ul>
        </article>
        <article className="avoid">
          <strong><CloseCircleFilled /> 不应该使用</strong>
          <ul>
            <li>数据泄漏、成本遗漏或样本外失败时，用模拟掩盖基础缺陷</li>
            <li>把模拟频率解释为未来世界的精确概率或收益保证</li>
            <li>不断修改分布、种子和参数，直到结果足够漂亮</li>
            <li>历史样本太短、市场状态单一，却声称覆盖未知黑天鹅</li>
          </ul>
        </article>
      </div>
      <div className="backtest-monte-definition">
        <div><strong>Bootstrap 是“怎样抽样”</strong><span>从经验交易或连续数据块中有放回重采样。</span></div>
        <ArrowRightOutlined />
        <div><strong>Monte Carlo 是“重复多少次”</strong><span>反复生成大量路径，再读取结果分布和门槛触及频率。</span></div>
      </div>
      <div className="backtest-monte-method-guide">
        <div><b>交易近似独立</b><span>逐笔 Bootstrap</span><small>快速观察顺序风险</small></div>
        <div><b>存在连胜连亏或波动聚集</b><span>分块 Bootstrap</span><small>保留短期依赖结构</small></div>
        <div><b>担心优势、成本或尾部恶化</b><span>参数压力模拟</span><small>主动构造悲观情景</small></div>
      </div>
      <footer><SafetyOutlined /><span><b>开始前至少准备：</b>冻结的策略规则、成本后逐笔收益或周期收益、足够覆盖不同状态的样本、明确的风险线，以及预先写好的通过/拒绝门槛。</span></footer>
    </section>
    <section className="backtest-explain">
      <h3>怎样选择模拟方法？</h3>
      <p>先判断收益序列是否存在自相关、连亏聚集和市场状态，再选择抽样单位。单条净值曲线只是许多可能路径中的一条。</p>
      <div className="backtest-monte-methods">{Object.entries(MONTE_CARLO_METHODS).map(([key, item]) => <button type="button" key={key} className={method === key ? "active" : ""} onClick={() => setMethod(key as MonteCarloMethod)}><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
      <div className="backtest-time-rule"><SafetyOutlined /><span><b>方法边界</b>{current.boundary} 重采样也无法创造历史中从未出现的黑天鹅。</span></div>
    </section>
    <section className="backtest-simulator">
      <header><ExperimentOutlined /><div><strong>{current.title}实验</strong><span>{paths} 条路径 · 固定种子可复算</span></div><Button size="small" icon={<ReloadOutlined />} onClick={() => setSeedOffset((value) => value + 1)}>重新抽样</Button></header>
      <div className="backtest-monte-inputs">
        <label><span>历史胜率 <b>{winRate}%</b></span><Slider min={20} max={75} value={winRate} onChange={setWinRate} /></label>
        <label><span>平均盈利 <b>{averageWin.toFixed(1)}R</b></span><Slider min={0.5} max={4} step={0.1} value={averageWin} onChange={setAverageWin} /></label>
        <label><span>平均亏损 <b>{averageLoss.toFixed(1)}R</b></span><Slider min={0.5} max={3} step={0.1} value={averageLoss} onChange={setAverageLoss} /></label>
        <label><span>单笔风险 <b>{riskPct.toFixed(2)}%</b></span><Slider min={0.25} max={3} step={0.25} value={riskPct} onChange={setRiskPct} /></label>
        <label><span>每条路径交易数 <b>{trades}</b></span><Slider min={50} max={500} step={10} value={trades} onChange={setTrades} /></label>
        <label><span>模拟路径数 <b>{paths}</b></span><Slider min={200} max={1500} step={100} value={paths} onChange={setPaths} /></label>
      </div>
      <div className="backtest-monte-range"><div><span>悲观 P05</span><strong>{results.returnP05.toFixed(1)}%</strong></div><i /><div><span>中位数 P50</span><strong>{results.returnP50.toFixed(1)}%</strong></div><i /><div><span>乐观 P95</span><strong>{results.returnP95.toFixed(1)}%</strong></div></div>
      <div className="backtest-results backtest-monte-results"><Result label="P95 最大回撤" value={`${results.drawdownP95.toFixed(1)}%`} tone={results.drawdownP95 <= 25 ? "positive" : "warning"} /><Result label="中位最大回撤" value={`${results.drawdownP50.toFixed(1)}%`} /><Result label="最终亏损概率" value={`${results.lossProbability.toFixed(1)}%`} tone={results.lossProbability <= 20 ? "positive" : "warning"} /><Result label="触及 -30% 风险线" value={`${results.ruinProbability.toFixed(1)}%`} tone={results.ruinProbability <= 5 ? "positive" : "negative"} /></div>
    </section>
  </div>;
}

const DECISION_GATES = [
  { key: "data", title: "数据可追溯", evidence: "样本版本、时间戳、资产池和排除记录已冻结" },
  { key: "leakage", title: "时序无泄漏", evidence: "特征、标签、标准化和成交时点均通过审计" },
  { key: "oos", title: "样本外有效", evidence: "多窗口方向一致，衰减和失败窗口可解释" },
  { key: "cost", title: "成本后仍成立", evidence: "基准、悲观和容量压力下仍保留增量价值" },
  { key: "tail", title: "尾部可承受", evidence: "Bootstrap/蒙特卡洛回撤与风险线满足预算" },
  { key: "reproducible", title: "结果可复算", evidence: "代码、配置、种子、数据哈希和全部试验已保存" },
] as const;

function DecisionGateLab() {
  const [checked, setChecked] = useState<string[]>([]);
  function toggle(key: string) { setChecked((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]); }
  const passed = checked.length;
  const decision = passed === DECISION_GATES.length ? "进入仿真与受限观察" : passed >= 4 ? "补齐证据后复审" : "拒绝上线";
  const tone = passed === DECISION_GATES.length ? "positive" : passed >= 4 ? "warning" : "negative";

  return <div className="backtest-lab-content">
    <section className="backtest-explain">
      <h3>回测报告的结论应该是一项可审计决策</h3>
      <p>报告必须保留研究问题、数据版本、完整试验清单、样本内外结果、成本压力、失败阶段、蒙特卡洛分布和不可越过的上线门槛。</p>
      <div className="backtest-report-outline"><span>01 研究假设</span><span>02 样本合同</span><span>03 执行模型</span><span>04 样本外证据</span><span>05 稳健与尾部</span><span>06 结论与边界</span></div>
      <div className="backtest-time-rule"><SafetyOutlined /><span><b>最后边界</b>通过研究门槛也不等于未来盈利，只代表可以进入隔离仿真、纸面交易或严格限额的观察阶段。</span></div>
    </section>
    <section className="backtest-simulator">
      <header><FileDoneOutlined /><div><strong>上线前证据门禁</strong><span>逐项确认已有可复核证据</span></div><StatusPill tone={passed === DECISION_GATES.length ? "profit" : "ai"}>{passed} / {DECISION_GATES.length}</StatusPill></header>
      <div className="backtest-decision-gates">{DECISION_GATES.map((gate) => <button type="button" key={gate.key} className={checked.includes(gate.key) ? "checked" : ""} onClick={() => toggle(gate.key)}><i>{checked.includes(gate.key) ? <CheckCircleFilled /> : null}</i><span><strong>{gate.title}</strong><small>{gate.evidence}</small></span></button>)}</div>
      <div className={`backtest-decision ${tone}`}><span>当前研究决策</span><strong>{decision}</strong><small>{passed === DECISION_GATES.length ? "下一阶段仍需设置资金、仓位、回撤和熔断上限。" : `还有 ${DECISION_GATES.length - passed} 项证据未完成。`}</small></div>
    </section>
  </div>;
}

const LABS = [DefinitionLab, SampleConstructionLab, ProcessLab, CostLab, MetricsLab, ValidationLab, RobustnessLab, MonteCarloLab, DecisionGateLab];

function CourseMap({ lesson, onChange }: { lesson: number; onChange: (index: number) => void }) {
  return <QuantGlowCard className="backtest-course-map" title={<SectionHeader title="从样本到结论的完整路径" description="9 个互动实验按研究顺序推进；需要查公式时切换到独立手册" />} badge={<StatusPill tone="neutral">方法主线</StatusPill>}>
    <nav aria-label="回测课程目录">{LESSONS.map((item, index) => <button type="button" key={item.title} className={lesson === index ? "active" : ""} aria-current={lesson === index ? "step" : undefined} onClick={() => onChange(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><small>{item.phase} · {item.level}</small><strong>{item.title}</strong><em>{item.short}</em></span><ArrowRightOutlined /></button>)}</nav>
  </QuantGlowCard>;
}

function InlineQuiz({ quiz, answer, onAnswer }: { quiz: (typeof QUIZZES)[number]; answer: number | null; onAnswer: (index: number) => void }) {
  return <section className="backtest-inline-quiz" aria-label="本课理解检查">
    <header><div><strong>本课理解检查</strong><span>用一道题确认你没有越过证据边界</span></div><StatusPill tone="ai">1 题</StatusPill></header>
    <strong className="backtest-quiz-question">{quiz.question}</strong>
    <div className="backtest-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => onAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>
    {answer !== null ? <div className={`backtest-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "回答正确" : "这个结论越过了证据边界"}</strong><span>{quiz.reason}</span></div> : null}
  </section>;
}

export default function BacktestLearningPage() {
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
    eyebrow="BACKTEST RESEARCH · 样本 → 验证 → 压力测试"
    title="回测学堂"
    description="从可追溯样本、时序模拟和成本模型开始，完成样本外验证、参数稳健性、多重检验、Bootstrap 与蒙特卡洛压力测试，最后形成可审计的研究决策。"
    actions={<><Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button><Button icon={<ExperimentOutlined />} onClick={() => navigate("/kline-learning")}>复习 K 线课程</Button></>}
    aside={<QuantGlowCard className="backtest-progress-card"><span>{viewMode === "course" ? "研究方法进度" : "公式参考手册"}</span><strong>{viewMode === "course" ? `${lesson + 1} / ${LESSONS.length}` : "10 类 · 36 式"}</strong>{viewMode === "course" ? <div><i style={{ width: `${(lesson + 1) / LESSONS.length * 100}%` }} /></div> : null}<small>{viewMode === "course" ? `当前阶段：${LESSONS[lesson].phase}` : "定义 · 复算 · 边界 · 来源"}</small><small>{viewMode === "course" ? LESSONS[lesson].title : "独立查阅，不与方法课程重复展示"}</small></QuantGlowCard>}
  >
    <LearningCourseNav />
    <section className="learning-full-width">
      <main className="backtest-learning-main">
        <section className="backtest-view-switch" aria-label="回测学堂内容视图">
          <div><strong>{viewMode === "course" ? "方法课程" : "公式手册"}</strong><span>{viewMode === "course" ? "按研究步骤完成互动实验和理解检查" : "按主题查阅公式、复算任务与证据来源"}</span></div>
          <Segmented value={viewMode} onChange={(value) => setViewMode(value as "course" | "handbook")} options={[{ label: "方法课程", value: "course" }, { label: "公式手册", value: "handbook" }]} />
        </section>
        {viewMode === "course" ? <>
          <CourseMap lesson={lesson} onChange={move} />
          <QuantGlowCard title={<SectionHeader title={LESSONS[lesson].title} description={LESSONS[lesson].short} />} badge={<StatusPill tone={LESSONS[lesson].level === "基础" ? "neutral" : LESSONS[lesson].level === "核心" ? "profit" : "ai"}>{LESSONS[lesson].level}课程</StatusPill>}><ActiveLab /><InlineQuiz quiz={quiz} answer={answer} onAnswer={setAnswer} /></QuantGlowCard>
          <div className="backtest-lesson-actions"><Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>{lesson < LESSONS.length - 1 ? <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button> : <Button type="primary" onClick={() => navigate("/risk-learning")}>继续风控课程 <ArrowRightOutlined /></Button>}</div>
        </> : <FormulaHandbook domain="backtest" />}
      </main>
    </section>
  </TradingPageShell>;
}
