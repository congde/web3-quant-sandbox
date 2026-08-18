import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  ExperimentOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Select, Slider, Spin } from "antd";
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
    title: "量价与技术指标",
    short: "成交量、动量、波动",
    description: "理解量比、VWAP、RSI、MACD、ATR 与布林带的输入和边界。",
  },
  {
    title: "形态算法化",
    short: "条件定义而非口诀",
    description: "把十字星、锤子和吞没形态写成明确的布尔条件。",
  },
  {
    title: "数据质量与验证",
    short: "从观察到证据",
    description: "检查缺失、重复、未收盘柱和信号时序，并完成样本外验证。",
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
  "动量与震荡指标": 5,
  "波动率与通道": 5,
  "形态算法化与统计验证": 6,
  "数据质量与可回测规则": 7,
};

const LESSON_VISUALS = [
  { group: "OHLCV 与价格变换", formula: "实体长度" },
  { group: "周期聚合与时间边界", formula: "聚合开盘" },
  { group: "实体影线与柱内强度", formula: "实体占比" },
  { group: "趋势与市场结构", formula: "单期收盘收益" },
  { group: "支撑阻力与突破", formula: "滚动阻力" },
  { group: "成交量与价格确认", formula: "成交量均线" },
  { group: "形态算法化与统计验证", formula: "十字星规则" },
  { group: "数据质量与可回测规则", formula: "OHLC 合法性" },
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
        <h3>指标是 K 线和成交量的派生量</h3>
        <div className="kline-concept-grid">
          <div><strong>量比 / VWAP / OBV</strong><span>观察活跃程度、成交均价和累积量价方向。</span></div>
          <div><strong>RSI / Stochastic</strong><span>描述相对涨跌与区间位置，强趋势中可能长期钝化。</span></div>
          <div><strong>MACD</strong><span>快慢 EMA 的差，描述趋势动量但具有滞后。</span></div>
          <div><strong>ATR / 布林带</strong><span>描述波动和相对位置，不负责预测方向。</span></div>
        </div>
        <p className="kline-note">现货基础币数量、计价币成交额、合约张数和不同交易所成交量口径不同；使用指标前必须先统一数据。</p>
      </div>
    );
  }
  if (lesson === 6) {
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

export default function KlineLearningPage() {
  const navigate = useNavigate();
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
          <span>学习进度</span>
          <strong>{lesson + 1} / {LESSONS.length}</strong>
          <div><i style={{ width: `${((lesson + 1) / LESSONS.length) * 100}%` }} /></div>
          <small>当前：{LESSONS[lesson].title}</small>
        </QuantGlowCard>
      }
    >
      <LearningCourseNav />
      <section className="learning-full-width">
        <div className="kline-learning-main">
          <FormulaHandbook
            domain="kline"
            activeGroupTitle={activeGroup}
            visualFormulaName={activeFormula}
            onFormulaChange={(selection) => {
              setActiveFormula(selection.formula.name);
              setActiveGroup(selection.groupTitle);
              setLesson(GROUP_TO_LESSON[selection.groupTitle] ?? 0);
            }}
          />
          <QuantGlowCard
            title={<SectionHeader title={LESSONS[lesson].title} description={LESSONS[lesson].description} />}
            badge={<StatusPill tone="ai">第 {lesson + 1} 课</StatusPill>}
          >
            <LessonText lesson={lesson} />
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
            <Button disabled={lesson === 0} onClick={() => {
              const next = Math.max(0, lesson - 1);
              setLesson(next);
              setActiveGroup(LESSON_VISUALS[next].group);
              setActiveFormula(LESSON_VISUALS[next].formula);
            }}>上一课</Button>
            {lesson < LESSONS.length - 1 ? (
              <Button type="primary" onClick={() => {
                const next = Math.min(LESSONS.length - 1, lesson + 1);
                setLesson(next);
                setActiveGroup(LESSON_VISUALS[next].group);
                setActiveFormula(LESSON_VISUALS[next].formula);
              }}>下一课 <ArrowRightOutlined /></Button>
            ) : (
              <Button type="primary" onClick={() => navigate("/backtest-learning")}>继续学习回测方法 <ArrowRightOutlined /></Button>
            )}
          </div>
        </div>
      </section>
    </TradingPageShell>
  );
}
