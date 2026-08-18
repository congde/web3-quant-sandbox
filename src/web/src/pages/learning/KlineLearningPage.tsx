import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
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
import "./kline-learning.css";

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
    title: "组合与技术指标",
    short: "趋势、动量、波动",
    description: "把多根 K 线转换为均线、RSI 和波动指标。",
  },
  {
    title: "规则与回测",
    short: "从观察到证据",
    description: "把模糊形态写成可复现规则，并避免未来函数。",
  },
] as const;

const TIMEFRAMES = [
  { value: "15min", label: "15 分钟" },
  { value: "1hour", label: "1 小时" },
  { value: "4hour", label: "4 小时" },
  { value: "1day", label: "1 日" },
];

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
        <h3>指标是 K 线的派生量</h3>
        <div className="kline-concept-grid">
          <div><strong>MA20 / MA60</strong><span>描述一段窗口内的平均价格，用于观察方向。</span></div>
          <div><strong>RSI</strong><span>描述近期涨跌动量，不是单独的买卖按钮。</span></div>
          <div><strong>ATR</strong><span>描述真实波动范围，常用于风险尺度。</span></div>
          <div><strong>成交量</strong><span>帮助判断价格变化是否伴随活跃成交。</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className="kline-lesson-copy">
      <h3>能回测的规则必须没有歧义</h3>
      <div className="kline-rule-example">
        <span className="bad">模糊观察</span><p>“看起来要突破了，可以买入。”</p>
        <ArrowRightOutlined />
        <span className="good">可验证规则</span><p>“本根收盘价高于过去 20 根最高价，且成交量高于 20 根均量的 1.3 倍。”</p>
      </div>
      <p className="kline-note">策略在第 N 根 K 线作决定时，只能读取第 N 根及之前的数据；还要声明手续费、滑点和成交假设。</p>
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

  return (
    <TradingPageShell
      eyebrow="LEARN · OBSERVE · VERIFY"
      title="K线学堂"
      description="用真实离线行情认识 K 线，把读图直觉逐步转换为可计算、可回测的规则。教学内容不构成交易建议。"
      actions={
        <>
          <Button icon={<BookOutlined />} onClick={() => navigate("/academy")}>返回学堂</Button>
          <Button icon={<ExperimentOutlined />} onClick={() => navigate("/backtests")}>进入策略回测</Button>
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
      <section className="kline-learning-layout">
        <aside className="kline-lesson-nav">
          <div className="kline-lesson-nav-title"><BookOutlined /><span>学习路径</span></div>
          {LESSONS.map((item, index) => (
            <button key={item.title} type="button" className={lesson === index ? "active" : ""} onClick={() => setLesson(index)}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span><strong>{item.title}</strong><small>{item.short}</small></span>
              {lesson > index ? <CheckCircleOutlined /> : null}
            </button>
          ))}
        </aside>

        <div className="kline-learning-main">
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
              title={<SectionHeader title="放回行情上下文" description={`${payload?.symbol ?? "BTC-USDT"} · ${TIMEFRAMES.find((item) => item.value === timeframe)?.label}`} />}
              badge={<Select value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} style={{ width: 116 }} />}
            >
              <KlineAnalysisChart candles={candles} showMa20 showMa60={false} showVolume height={390} />
              <div className="kline-chart-legend"><span><i className="ma" />MA20：最近 20 根收盘价均值</span><span><i className="volume" />底部柱：成交量</span></div>
            </QuantGlowCard>
          </div>

          <div className="kline-lesson-actions">
            <Button disabled={lesson === 0} onClick={() => setLesson((value) => Math.max(0, value - 1))}>上一课</Button>
            {lesson < LESSONS.length - 1 ? (
              <Button type="primary" onClick={() => setLesson((value) => Math.min(LESSONS.length - 1, value + 1))}>下一课 <ArrowRightOutlined /></Button>
            ) : (
              <Button type="primary" onClick={() => navigate("/backtests")}>带着规则去回测 <ArrowRightOutlined /></Button>
            )}
          </div>
        </div>
      </section>
    </TradingPageShell>
  );
}
