import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExperimentOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Segmented, Select, Slider, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchKlineAnalysis } from "../../api";
import { KlineAnalysisChart } from "../../components/charts/KlineAnalysisChart";
import type { KlineAnalysisPayload, KlineCandle } from "../../types";
import {
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "../trading/TradingPageShell";
import { FormulaHandbook } from "./FormulaHandbook";
import { KLINE_SYSTEM } from "./KlineLearningContent";
import {
  buildKlineStudy,
  getDefaultKlineStudyParameters,
  getKlineStudyControls,
  type KlineStudyParameters,
} from "./KlineStudyEngine";
import { LearningCourseNav } from "./LearningCourseNav";
import "./kline-learning.css";
import "./learning-layout.css";

const LESSONS = [
  {
    title: "认识一根 K 线",
    short: "OHLC 与实体影线",
    description: "看懂开盘、最高、最低、收盘，以及实体和上下影线。",
  },
  {
    title: "周期与成交量",
    short: "15 分钟到日线",
    description: "理解同一批成交如何聚合成不同周期的 K 线。",
  },
  {
    title: "实体、影线与强度",
    short: "用比例代替肉眼",
    description: "用实体占比、影线占比和收盘位置量化一根 K 线。",
  },
  {
    title: "趋势与市场结构",
    short: "高低点、均线与滞后",
    description: "从 HH/HL、LH/LL 和均线理解趋势结构与指标滞后。",
  },
  {
    title: "支撑阻力与突破",
    short: "区域、确认与假突破",
    description: "把主观画线转换为滚动高低点和波动标准化规则。",
  },
  {
    title: "成交量与价格确认",
    short: "量比、VWAP 与 OBV",
    description: "区分成交数量、成交额和合约张数，用量价关系描述参与程度。",
  },
  {
    title: "动量与震荡指标",
    short: "RSI、随机指标与 MACD",
    description: "理解动量指标如何由历史价格派生，以及趋势环境中的钝化边界。",
  },
  {
    title: "波动率与通道",
    short: "ATR、标准差与布林带",
    description: "用真实波幅和滚动波动描述风险尺度，而不是直接预测涨跌方向。",
  },
  {
    title: "形态算法化与检验",
    short: "条件定义而非口诀",
    description: "把十字星、锤子和吞没形态写成明确条件，并统计条件收益。",
  },
  {
    title: "数据质量与样本外验证",
    short: "从观察规则到可复现证据",
    description: "检查缺失、重复、未收盘柱和信号时序，再完成成本后样本外验证。",
  },
] as const;

const TIMEFRAMES = [
  { value: "15min", label: "15 分钟" },
  { value: "1hour", label: "1 小时" },
  { value: "4hour", label: "4 小时" },
  { value: "1day", label: "1 日" },
];

const GROUP_TO_LESSON: Record<string, number> = {
  "OHLCV 与价格变换": 0,
  "周期聚合与时间边界": 1,
  "实体影线与柱内强度": 2,
  "趋势与市场结构": 3,
  "支撑阻力与突破": 4,
  "成交量与价格确认": 5,
  "动量与震荡指标": 6,
  "波动率与通道": 7,
  "形态算法化与统计验证": 8,
  "数据质量与可回测规则": 9,
};

const LESSON_VISUALS = [
  { group: "OHLCV 与价格变换", formula: "实体长度" },
  { group: "周期聚合与时间边界", formula: "聚合开盘" },
  { group: "实体影线与柱内强度", formula: "实体占比" },
  { group: "趋势与市场结构", formula: "单期收盘收益" },
  { group: "支撑阻力与突破", formula: "滚动阻力" },
  { group: "成交量与价格确认", formula: "成交量均线" },
  { group: "动量与震荡指标", formula: "RSI" },
  { group: "波动率与通道", formula: "真实波幅 TR" },
  { group: "形态算法化与统计验证", formula: "十字星规则" },
  { group: "数据质量与可回测规则", formula: "OHLC 合法性" },
] as const;

const QUIZZES = [
  { question: "一根长阳线能否单独证明下一根继续上涨？", options: ["能", "不能，它只描述当前柱的 OHLC 事实", "只有日线能"], answer: 1, reason: "K 线压缩了已发生的成交，下一期方向仍需独立统计验证。" },
  { question: "4 小时 K 线尚未收盘时使用其最高、最低和收盘值，主要风险是什么？", options: ["重绘和未来信息", "手续费上升", "成交量一定变小"], answer: 0, reason: "未收盘柱仍在变化，历史回看时固定的值在实时并不可得。" },
  { question: "长下影线最准确的事实描述是什么？", options: ["必然反转", "价格曾下探并从低点收回一部分", "主力一定吸筹"], answer: 1, reason: "影线描述柱内价格区间，不能自动推出参与者身份或未来方向。" },
  { question: "均线为什么天然滞后？", options: ["因为只使用历史价格", "因为颜色太少", "因为成交量太大"], answer: 0, reason: "均线是历史价格的平滑变换，只能在价格发生后更新。" },
  { question: "计算过去 20 根阻力时为什么通常不包含当前柱？", options: ["避免当前价格与包含自身的阈值比较", "让图更漂亮", "减少成交量"], answer: 0, reason: "包含当前柱会造成定义自我引用，并可能引入不可执行时序。" },
  { question: "不同交易所的成交量可以不做处理直接相加吗？", options: ["可以", "不可以，要统一基础币、计价额或合约张数口径", "只在牛市可以"], answer: 1, reason: "成交量单位和合约乘数可能不同，直接相加没有一致经济含义。" },
  { question: "RSI 超过 70 是否等于立刻做空？", options: ["等于", "不等于，它描述窗口内相对上涨强度", "只在小时线等于"], answer: 1, reason: "强趋势中 RSI 可能长期处于高位，阈值本身不是完整交易规则。" },
  { question: "ATR 上升最直接说明什么？", options: ["上涨概率增加", "近期真实波幅扩大", "成交量一定增加"], answer: 1, reason: "ATR 衡量波动尺度，不提供固定方向预测。" },
  { question: "形态算法化后还必须补充什么？", options: ["更多形态名字", "样本数、基准、成本和样本外结果", "只看命中率"], answer: 1, reason: "数值定义只是开始，是否具有增量信息必须用完整验证链判断。" },
  { question: "t 收盘才能确认的信号，最早应在何时模拟成交？", options: ["t 收盘前", "t+1 或之后的明确可成交时点", "任意历史最低价"], answer: 1, reason: "信号确认后才能提交订单，成交模型还要包含延迟、费用和滑点。" },
] as const;

const KLINE_FORMULAS = KLINE_SYSTEM.groups.flatMap((group) => group.formulas.map((formula, index) => ({
  formula,
  formulaIndex: index,
  groupTitle: group.title,
})));

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? value.toFixed(2) : value.toFixed(4);
}

function CandleAnatomy({ candle }: { candle: KlineCandle }) {
  const rising = candle.close >= candle.open;
  const color = rising ? "#1f9d72" : "#d3543a";
  const spread = Math.max(candle.high - candle.low, 0.000001);
  const y = (value: number) => 34 + ((candle.high - value) / spread) * 264;
  const openY = y(candle.open);
  const closeY = y(candle.close);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(8, Math.abs(closeY - openY));

  return (
    <div className="kline-anatomy">
      <svg viewBox="0 0 360 340" role="img" aria-label="单根 K 线结构图">
        <line x1="180" y1={y(candle.high)} x2="180" y2={y(candle.low)} stroke={color} strokeWidth="3" />
        <rect x="142" y={bodyTop} width="76" height={bodyHeight} rx="3" fill={color} opacity="0.92" />

        <line x1="185" y1={y(candle.high)} x2="286" y2={y(candle.high)} className="kline-guide" />
        <text x="294" y={y(candle.high) + 5}>最高 H {formatPrice(candle.high)}</text>
        <line x1="185" y1={y(candle.low)} x2="286" y2={y(candle.low)} className="kline-guide" />
        <text x="294" y={y(candle.low) + 5}>最低 L {formatPrice(candle.low)}</text>

        <line x1="74" y1={openY} x2="137" y2={openY} className="kline-guide" />
        <text x="4" y={openY + 5}>开盘 O {formatPrice(candle.open)}</text>
        <line x1="223" y1={closeY} x2="286" y2={closeY} className="kline-guide" />
        <text x="294" y={closeY + 5}>收盘 C {formatPrice(candle.close)}</text>
      </svg>
      <div className="kline-anatomy-caption">
        <StatusPill tone={rising ? "profit" : "loss"}>{rising ? "阳线：收盘 ≥ 开盘" : "阴线：收盘 < 开盘"}</StatusPill>
        <span>上影线反映最高价到实体的区间，下影线反映实体到最低价的区间。</span>
      </div>
    </div>
  );
}

function LessonText({ lesson }: { lesson: number }) {
  if (lesson === 0) {
    return (
      <div className="kline-lesson-copy">
        <h3>先读事实，再做解释</h3>
        <p>每根 K 线只压缩五类事实：时间、开盘价、最高价、最低价、收盘价和成交量。颜色只表示开盘与收盘的相对关系，并不自动代表下一根会涨或跌。</p>
        <div className="kline-formula"><code>实体 = |收盘价 − 开盘价|</code><code>振幅 = (最高价 − 最低价) ÷ 开盘价</code></div>
      </div>
    );
  }
  if (lesson === 1) {
    return (
      <div className="kline-lesson-copy">
        <h3>周期改变的是观察尺度</h3>
        <p>一根 1 小时 K 线由这一小时内的成交聚合而成；四根连续的 1 小时 K 线可聚合为一根 4 小时 K 线。周期越短，细节越多、噪声通常也越大。</p>
        <div className="kline-process"><span>逐笔成交</span><b>→</b><span>15 分钟 K</span><b>→</b><span>1 小时 K</span><b>→</b><span>日 K</span></div>
        <p className="kline-note">成交量要与价格一起看；不同交易所的数据口径、时区和未收盘 K 线都可能导致结果不同。</p>
      </div>
    );
  }
  if (lesson === 2) {
    return (
      <div className="kline-lesson-copy">
        <h3>实体和影线必须放到总振幅中比较</h3>
        <p>同样是 2 元实体，在振幅 3 元和振幅 20 元的 K 线上意义完全不同。用比例表达，才能跨价格、跨周期比较。</p>
        <div className="kline-formula"><code>实体占比 = |C − O| ÷ (H − L)</code><code>收盘位置 = [(C−L)−(H−C)] ÷ (H−L)</code></div>
        <p className="kline-note">长下影只表示价格曾经更低、最终收回一部分；它可能来自买盘承接，也可能只是高波动，不能脱离趋势位置直接解释为反转。</p>
      </div>
    );
  }
  if (lesson === 3) {
    return (
      <div className="kline-lesson-copy">
        <h3>先定义结构，再使用均线</h3>
        <div className="kline-concept-grid">
          <div><strong>HH + HL</strong><span>更高高点与更高低点，是上升结构的候选定义。</span></div>
          <div><strong>LH + LL</strong><span>更低高点与更低低点，是下降结构的候选定义。</span></div>
          <div><strong>SMA / EMA</strong><span>平滑历史价格；EMA 更重视近期数据，但仍然滞后。</span></div>
          <div><strong>结构破坏</strong><span>必须明确比较窗口、收盘确认还是盘中触碰。</span></div>
        </div>
        <p className="kline-note">趋势线和摆动高低点若在看完整段行情后才画出，会产生事后选择；研究时必须写出实时可执行规则。</p>
      </div>
    );
  }
  if (lesson === 4) {
    return (
      <div className="kline-lesson-copy">
        <h3>支撑阻力是候选区域，不是固定承诺</h3>
        <p>可以用过去 n 根最高价和最低价构造候选区域，并使用收盘价和 ATR 确认突破，避免把一次盘中触碰当作有效突破。</p>
        <div className="kline-formula"><code>阻力ₜ = max(Hₜ₋ₙ … Hₜ₋₁)</code><code>突破幅度 = (Cₜ − 阻力ₜ) ÷ ATRₜ</code></div>
        <p className="kline-note">计算过去最高价时不能包含当前柱，否则规则会自我比较；窗口和确认阈值也应在验证前冻结。</p>
      </div>
    );
  }
  if (lesson === 5) {
    return (
      <div className="kline-lesson-copy">
        <h3>成交量先统一单位，再讨论确认关系</h3>
        <div className="kline-concept-grid">
          <div><strong>量比</strong><span>当前成交量相对历史均量，描述活跃程度。</span></div>
          <div><strong>VWAP</strong><span>成交价格按成交量加权，不能代表所有订单都能成交。</span></div>
          <div><strong>OBV</strong><span>按收盘涨跌方向累积成交量，是规则化摘要。</span></div>
          <div><strong>量价确认</strong><span>必须与无条件基准比较，不能只挑成功突破。</span></div>
        </div>
        <p className="kline-note">现货基础币数量、计价币成交额、合约张数和不同交易所成交量口径不同；使用指标前必须先统一数据。</p>
      </div>
    );
  }
  if (lesson === 6) {
    return (
      <div className="kline-lesson-copy">
        <h3>动量指标描述历史变化速度，不承诺反转</h3>
        <div className="kline-concept-grid">
          <div><strong>RSI</strong><span>比较窗口内平均上涨和平均下跌，阈值会随状态失效。</span></div>
          <div><strong>Stochastic</strong><span>描述收盘价在近期高低区间中的相对位置。</span></div>
          <div><strong>MACD</strong><span>快慢 EMA 的差，兼具趋势和平滑滞后。</span></div>
          <div><strong>参数敏感性</strong><span>窗口邻域应表现连续，不能只挑一个最优点。</span></div>
        </div>
        <p className="kline-note">“超买、超卖”只是指标区间名称。是否具有反转或延续信息，必须按市场状态和持有期做样本外统计。</p>
      </div>
    );
  }
  if (lesson === 7) {
    return (
      <div className="kline-lesson-copy">
        <h3>波动指标回答变化多大，不回答方向</h3>
        <div className="kline-formula"><code>TR = max(H−L, |H−C₋₁|, |L−C₋₁|)</code><code>布林带 = SMA ± kσ</code></div>
        <div className="kline-process"><span>当前波动尺度</span><b>→</b><span>止损与仓位</span><b>→</b><span>通道宽度</span><b>→</b><span>压力成本</span></div>
        <p className="kline-note">ATR 是价格单位，跨资产比较时通常需要除以价格；布林带的 ±2σ 也不能直接解释为正态分布下固定覆盖率。</p>
      </div>
    );
  }
  if (lesson === 8) {
    return (
      <div className="kline-lesson-copy">
        <h3>形态名称必须变成数值条件</h3>
        <div className="kline-rule-example">
          <span className="bad">主观描述</span><p>“这根像锤子线，应该要反弹。”</p>
          <ArrowRightOutlined />
          <span className="good">算法定义</span><p>“下影线 ≥ 2×实体，上影线 ≤ 0.5×实体，且过去 10 根收益为负。”</p>
        </div>
        <p className="kline-note">定义完成后还要报告形态样本数、下一期条件收益、无条件基准、交易成本与样本外结果；测试很多形态时必须防止数据挖掘。</p>
      </div>
    );
  }
  return (
    <div className="kline-lesson-copy">
      <h3>可回测规则必须只使用当时已知的数据</h3>
      <div className="kline-rule-example">
        <span className="bad">未来信息</span><p>“本根收盘确认突破，并按本根收盘价成交。”</p>
        <ArrowRightOutlined />
        <span className="good">正确时序</span><p>“t 收盘确认信号，在 t+1 开盘或之后按明确成交模型执行。”</p>
      </div>
      <p className="kline-note">还要检查时间排序、重复、缺失、OHLC 合法性、时区、未收盘柱和跨周期重绘，并声明手续费、滑点与成交假设。</p>
    </div>
  );
}

function KlineCourseMap({ lesson, onChange }: { lesson: number; onChange: (index: number) => void }) {
  return <QuantGlowCard className="kline-course-map" title={<SectionHeader title="从市场事实到可验证规则" description="10 课方法主线与 10 类公式手册分开学习，避免同一内容重复展示" />} badge={<StatusPill tone="profit">K 线主线</StatusPill>}>
    <nav aria-label="K 线课程目录">{LESSONS.map((item, index) => <button type="button" key={item.title} className={lesson === index ? "active" : ""} aria-current={lesson === index ? "step" : undefined} onClick={() => onChange(index)}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.title}</strong><em>{item.short}</em></span><ArrowRightOutlined /></button>)}</nav>
  </QuantGlowCard>;
}

function KlineQuiz({ lesson }: { lesson: number }) {
  const [answer, setAnswer] = useState<number | null>(null);
  const quiz = QUIZZES[lesson];
  return <section className="kline-inline-quiz"><header><div><strong>本课理解检查</strong><span>确认价格事实、派生指标和未来判断没有混在一起</span></div><StatusPill tone="ai">1 题</StatusPill></header><strong className="kline-quiz-question">{quiz.question}</strong><div className="kline-quiz-options">{quiz.options.map((option, index) => <button type="button" key={option} className={answer === index ? (index === quiz.answer ? "correct" : "wrong") : ""} onClick={() => setAnswer(index)}><i>{String.fromCharCode(65 + index)}</i><span>{option}</span>{answer === index ? (index === quiz.answer ? <CheckCircleFilled /> : <CloseCircleFilled />) : null}</button>)}</div>{answer !== null ? <div className={`kline-quiz-feedback ${answer === quiz.answer ? "correct" : "wrong"}`}><strong>{answer === quiz.answer ? "判断正确" : "再检查一次数据边界"}</strong><span>{quiz.reason}</span></div> : null}</section>;
}

export default function KlineLearningPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"course" | "handbook">("course");
  const [lesson, setLesson] = useState(0);
  const [timeframe, setTimeframe] = useState("1day");
  const [payload, setPayload] = useState<KlineAnalysisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFormula, setActiveFormula] = useState("实体长度");
  const [activeGroup, setActiveGroup] = useState("OHLCV 与价格变换");
  const [studyParameters, setStudyParameters] = useState<Record<string, KlineStudyParameters>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchKlineAnalysis("BTC-USDT", timeframe, 120)
      .then((result) => {
        if (!alive) return;
        setPayload(result);
        setSelectedIndex(Math.max(0, (result.candles?.length ?? 1) - 1));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [timeframe]);

  const candles = payload?.candles ?? [];
  const selected = candles[selectedIndex];
  const readings = useMemo(() => {
    if (!selected) return null;
    const change = selected.open ? ((selected.close - selected.open) / selected.open) * 100 : 0;
    const amplitude = selected.open ? ((selected.high - selected.low) / selected.open) * 100 : 0;
    return { change, amplitude };
  }, [selected]);
  const activeParameters = useMemo(() => ({
    ...getDefaultKlineStudyParameters(activeFormula),
    ...(studyParameters[activeFormula] ?? {}),
  }), [activeFormula, studyParameters]);
  const studyControls = useMemo(() => getKlineStudyControls(activeFormula), [activeFormula]);
  const study = useMemo(() => buildKlineStudy(candles, activeFormula, selectedIndex, activeParameters), [candles, activeFormula, selectedIndex, activeParameters]);
  const activeFormulaIndex = Math.max(0, KLINE_FORMULAS.findIndex((entry) => entry.formula.name === activeFormula));

  function selectFormulaAt(index: number) {
    const entry = KLINE_FORMULAS[Math.max(0, Math.min(KLINE_FORMULAS.length - 1, index))];
    if (!entry) return;
    setActiveFormula(entry.formula.name);
    setActiveGroup(entry.groupTitle);
    setLesson(GROUP_TO_LESSON[entry.groupTitle] ?? 0);
  }

  function move(index: number) {
    const next = Math.max(0, Math.min(LESSONS.length - 1, index));
    setViewMode("course");
    setLesson(next);
    setActiveGroup(LESSON_VISUALS[next].group);
    setActiveFormula(LESSON_VISUALS[next].formula);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <TradingPageShell
      eyebrow="LEARN · OBSERVE · VERIFY"
      title="K线学堂"
      description="系统学习 10 章、40 个 K 线与技术分析公式，并用真实离线行情把读图直觉转换为可计算、可验证的规则。教学内容不构成交易建议。"
      actions={
        <>
          <Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button>
          <Button icon={<ExperimentOutlined />} onClick={() => navigate("/backtest-learning")}>继续回测学堂</Button>
        </>
      }
      aside={
        <QuantGlowCard className="kline-progress-card">
          <span>{viewMode === "course" ? "K 线方法进度" : "公式参考手册"}</span>
          <strong>{viewMode === "course" ? `${lesson + 1} / ${LESSONS.length}` : "10 类 · 40 式"}</strong>
          {viewMode === "course" ? <div><i style={{ width: `${((lesson + 1) / LESSONS.length) * 100}%` }} /></div> : null}
          <small>{viewMode === "course" ? `当前：${LESSONS[lesson].title}` : "导学 · 公式 · 复算 · 来源"}</small>
        </QuantGlowCard>
      }
    >
      <LearningCourseNav />
      <section className="learning-full-width">
        <div className="kline-learning-main">
          <section className="kline-view-switch" aria-label="K 线学堂内容视图"><div><strong>{viewMode === "course" ? "方法课程" : "公式手册"}</strong><span>{viewMode === "course" ? "用真实离线行情完成读图、规则化和验证" : "按 10 类主题查阅 40 个公式与证据来源"}</span></div><Segmented value={viewMode} onChange={(value) => setViewMode(value as "course" | "handbook")} options={[{ label: "方法课程", value: "course" }, { label: "公式手册", value: "handbook" }]} /></section>
          {viewMode === "course" ? <>
            <KlineCourseMap lesson={lesson} onChange={move} />
            <QuantGlowCard
              title={<SectionHeader title={LESSONS[lesson].title} description={LESSONS[lesson].description} />}
              badge={<StatusPill tone="ai">第 {lesson + 1} 课</StatusPill>}
            >
              <LessonText lesson={lesson} />
              <KlineQuiz key={lesson} lesson={lesson} />
            </QuantGlowCard>

            <div className="kline-lab-grid">
            <QuantGlowCard
              className="kline-anatomy-card"
              title={<SectionHeader title="单根 K 线解剖" description="拖动样本序号，观察真实 OHLCV" />}
            >
              {loading ? <div className="kline-loading"><Spin /><span>加载教学样本…</span></div> : selected ? (
                <>
                  <CandleAnatomy candle={selected} />
                  <div className="kline-sample-slider">
                    <span>第 {selectedIndex + 1} 根</span>
                    <Slider min={0} max={Math.max(0, candles.length - 1)} value={selectedIndex} onChange={setSelectedIndex} tooltip={{ formatter: (value) => `第 ${(value ?? 0) + 1} 根` }} />
                    <span>{selected.date ?? "样本末端"}</span>
                  </div>
                  <div className="kline-reading-grid">
                    <div><span>涨跌</span><strong className={(readings?.change ?? 0) >= 0 ? "up" : "down"}>{readings?.change.toFixed(2)}%</strong></div>
                    <div><span>振幅</span><strong>{readings?.amplitude.toFixed(2)}%</strong></div>
                    <div><span>成交量</span><strong>{selected.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
                  </div>
                </>
              ) : <div className="kline-loading">暂无可用教学样本</div>}
            </QuantGlowCard>

            <QuantGlowCard
              className="kline-context-card"
              title={<SectionHeader title={study.visualTitle} description={`${payload?.symbol ?? "BTC-USDT"} · ${TIMEFRAMES.find((item) => item.value === timeframe)?.label} · ${study.formulaName}`} />}
              badge={<Select value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} style={{ width: 116 }} />}
            >
              <div className="kline-study-toolbar">
                <div className="kline-formula-stepper" aria-label="公式切换">
                  <Button size="small" icon={<ArrowLeftOutlined />} disabled={activeFormulaIndex === 0} onClick={() => selectFormulaAt(activeFormulaIndex - 1)}>上一公式</Button>
                  <span><b>{activeFormulaIndex + 1}</b> / {KLINE_FORMULAS.length}</span>
                  <Button size="small" disabled={activeFormulaIndex === KLINE_FORMULAS.length - 1} onClick={() => selectFormulaAt(activeFormulaIndex + 1)}>下一公式<ArrowRightOutlined /></Button>
                </div>
                <div className="kline-parameter-controls">
                  {studyControls.length ? studyControls.map((control) => (
                    <label key={control.key}>
                      <span>{control.label}<b>{activeParameters[control.key]}{control.suffix}</b></span>
                      <Slider
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={activeParameters[control.key]}
                        onChange={(value) => setStudyParameters((current) => ({ ...current, [activeFormula]: { ...(current[activeFormula] ?? {}), [control.key]: value } }))}
                        tooltip={{ formatter: (value) => `${value}${control.suffix}` }}
                      />
                    </label>
                  )) : <span className="kline-fixed-formula">本公式没有自由参数；拖动左侧样本序号观察逐根计算。</span>}
                  {studyControls.length ? <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => setStudyParameters((current) => { const next = { ...current }; delete next[activeFormula]; return next; })}>恢复默认</Button> : null}
                </div>
              </div>
              <KlineAnalysisChart candles={candles} showMa20={false} showMa60={false} showVolume={study.showVolume} study={study} height={390} />
              <div className="kline-study-result" aria-live="polite">
                <div><span>当前公式</span><strong>{study.formulaName}</strong></div>
                <div><span>{study.currentLabel}</span><strong>{study.currentValue}</strong></div>
                <p>{study.explanation}</p>
              </div>
              <div className="kline-chart-legend">
                {study.series.map((series) => <span key={series.label}><i style={{ background: series.color }} />{series.label}</span>)}
                {study.showVolume ? <span><i className="volume" />成交量</span> : null}
                {study.markers.length ? <span><i className="marker" />条件命中 / 当前样本</span> : null}
              </div>
            </QuantGlowCard>
            </div>

            <div className="kline-lesson-actions">
            <Button disabled={lesson === 0} onClick={() => move(lesson - 1)}>上一课</Button>
            {lesson < LESSONS.length - 1 ? (
              <Button type="primary" onClick={() => move(lesson + 1)}>下一课 <ArrowRightOutlined /></Button>
            ) : (
              <Button type="primary" onClick={() => navigate("/backtest-learning")}>继续学习回测方法 <ArrowRightOutlined /></Button>
            )}
            </div>
          </> : <FormulaHandbook
            domain="kline"
            activeGroupTitle={activeGroup}
            visualFormulaName={activeFormula}
            onFormulaChange={(selection) => {
              setActiveFormula(selection.formula.name);
              setActiveGroup(selection.groupTitle);
              setLesson(GROUP_TO_LESSON[selection.groupTitle] ?? 0);
            }}
          />}
        </div>
      </section>
    </TradingPageShell>
  );
}
