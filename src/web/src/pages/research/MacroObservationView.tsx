import { CalendarOutlined, ClockCircleOutlined, InfoCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Progress, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchWeb3Macro } from "../../api";
import type { Web3MacroCard, Web3MacroPayload } from "../../types";
import { Sparkline } from "../trading/TradingPageShell";

function formatValue(value: number) {
  return value >= 1000
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function signed(value?: number | null, digits = 1) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function regimeTone(regime: string) {
  return regime === "risk-on" ? "positive" : regime === "risk-off" ? "negative" : "neutral";
}

function RangeSnapshot({ item }: { item: Web3MacroCard }) {
  const position = item.range_position_pct ?? 50;
  return (
    <div className="macro-range-snapshot" aria-label={`${item.name} 24小时价格区间`}>
      <div className="macro-range-track"><i style={{ left: `${position}%` }} /></div>
      <div className="macro-range-values">
        <span>低 {formatValue(item.range_low ?? item.value)}</span>
        <strong>区间位置 {item.range_position_pct?.toFixed(0) ?? "—"}%</strong>
        <span>高 {formatValue(item.range_high ?? item.value)}</span>
      </div>
    </div>
  );
}

export default function MacroObservationView() {
  const [payload, setPayload] = useState<Web3MacroPayload | null>(null);
  const [activeCategory, setActiveCategory] = useState("总览");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = (refresh = false) => {
    setLoading(true); setError("");
    void fetchWeb3Macro({ refresh }).then(setPayload).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  };
  useEffect(() => load(), []);
  const visibleCards = useMemo(() => (payload?.cards ?? []).filter((item) => activeCategory === "总览" || item.category === activeCategory), [activeCategory, payload]);
  const metrics = payload?.metrics;
  const score = payload?.regime_score ?? (payload?.regime === "risk-on" ? 70 : payload?.regime === "risk-off" ? 30 : 50);
  const tone = regimeTone(payload?.regime ?? "neutral");

  return (
    <section className="research-paper macro-observation-view">
      <aside className="macro-sidebar">
        <div className="macro-sidebar-title"><span>WEB3 MACRO LENS</span><strong>宏观观察</strong></div>
        <nav aria-label="Web3 宏观分类">{(payload?.categories ?? ["总览", "核心资产", "公链生态"]).map((label) => <button key={label} type="button" className={activeCategory === label ? "active" : ""} onClick={() => setActiveCategory(label)}><span>{label}</span><b>{(payload?.cards ?? []).filter((item) => label === "总览" || item.category === label).length}</b></button>)}</nav>
        <p className="knowledge-help">只保留会直接影响加密资产、链上流动性和协议风险的宏观信号。</p>
      </aside>

      <div className="macro-main">
        <header className="macro-header"><div><h1>{activeCategory}</h1><p>Web3 专用市场状态 · 从结论追溯到驱动、阈值和数据来源</p></div><Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>刷新采集</Button></header>
        {error ? <Alert type="error" showIcon message="Web3 宏观数据加载失败" description={error} /> : null}
        {loading && !payload ? <div className="research-loading"><Spin tip="正在聚合行情、链上与新闻…" /></div> : null}
        {payload ? <>
          <section className={`macro-regime-hero ${tone}`}>
            <div className="macro-regime-score"><span>综合状态分</span><strong>{score}</strong><small>/ 100</small></div>
            <div className="macro-regime-copy">
              <div><b className={`macro-state-pill ${tone}`}>{payload.regime_label ?? payload.regime}</b><span>置信度 {payload.confidence_label ?? "中等"} · {payload.confidence_score ?? "—"}</span></div>
              <h2>{payload.regime_label ?? payload.regime}状态：风险预算以确认信号为准</h2>
              <p>{payload.thesis}</p>
            </div>
            <Progress type="circle" percent={score} size={92} strokeColor={tone === "positive" ? "#1f9d74" : tone === "negative" ? "#d6604d" : "#c38b2d"} format={() => payload.regime_label ?? payload.regime} />
          </section>

          <div className="macro-regime-row">{payload.labels.map((label) => <span key={label}>{label}</span>)}<span><ClockCircleOutlined /> {payload.updated_at?.slice(0, 16).replace("T", " ") || "离线快照"}</span></div>

          <section className="macro-kpi-strip" aria-label="宏观关键指标">
            <article><span>BTC 30日</span><strong className={(metrics?.btc_return_30d ?? 0) >= 0 ? "up" : "down"}>{signed(metrics?.btc_return_30d)}</strong><small>真实日线趋势</small></article>
            <article><span>市场宽度</span><strong>{metrics?.breadth_pct?.toFixed(1) ?? "—"}%</strong><small>高流动性样本上涨占比</small></article>
            <article><span>恐惧贪婪</span><strong>{metrics?.fear_greed ?? "—"}</strong><small>日变动 {signed(metrics?.fear_greed_change, 0)}</small></article>
            <article><span>30日实现波动</span><strong>{metrics?.btc_volatility_30d?.toFixed(1) ?? "—"}%</strong><small>BTC 年化估算</small></article>
          </section>

          {(payload.drivers?.length ?? 0) > 0 ? <section className="macro-analysis-section">
            <div className="macro-section-heading"><div><span>状态拆解</span><h3>四个驱动因子</h3></div><small>分数越高，越支持风险承担</small></div>
            <div className="macro-driver-grid">{payload.drivers?.map((driver) => <article key={driver.id} className={driver.direction}>
              <header><span>{driver.label}</span><b>{driver.value}</b></header>
              <Progress percent={driver.score} showInfo={false} strokeColor={driver.direction === "positive" ? "#1f9d74" : driver.direction === "negative" ? "#d6604d" : "#c38b2d"} />
              <footer><span>评分 {driver.score}</span><span>权重 {driver.weight}%</span></footer>
              <p>{driver.detail}</p>
            </article>)}</div>
          </section> : null}

          {(payload.conditions?.length ?? 0) > 0 ? <section className="macro-analysis-section macro-conditions-section">
            <div className="macro-section-heading"><div><span>状态机</span><h3>升级与降级条件</h3></div><small>条件命中时才调整状态判断</small></div>
            <div className="macro-condition-grid">{payload.conditions?.map((condition) => <article key={condition.id} className={condition.status ? "met" : "watch"}><b>{condition.status ? "已命中" : "观察中"}</b><strong>{condition.label}</strong><p>{condition.rule}</p></article>)}</div>
          </section> : null}

          {(payload.events?.length ?? 0) > 0 ? <section className="macro-analysis-section">
            <div className="macro-section-heading"><div><span>事件雷达</span><h3>近期风险证据</h3></div><small>来自当前新闻快照</small></div>
            <div className="macro-event-list">{payload.events.slice(0, 3).map((event, index) => <a key={`${event.date}-${event.title}-${index}`} className="macro-event" href={event.url || undefined} target="_blank" rel="noreferrer"><CalendarOutlined /><span>{event.date}</span><b>{event.risk ? "RISK" : "WEB3"}</b><strong>{event.title}</strong></a>)}</div>
          </section> : null}

          <div className="macro-section-label"><span>资产监测</span> 真实历史与横截面快照分开呈现</div>
          <div className="macro-chart-grid">{visibleCards.map((item) => <article key={item.id} className="macro-chart-card" title={item.series_origin}>
            <header><strong>{item.name}<small>{item.symbol}</small></strong><div><b>{formatValue(item.value)}</b><span className={item.change_24h >= 0 ? "up" : "down"}>{signed(item.change_24h, 2)}</span><small>{item.period_label ?? "观察区间"} {item.change_period === null ? "" : signed(item.change_period)}</small></div></header>
            {item.has_history ?? item.values.length > 1 ? <><Sparkline values={item.values} tone={(item.change_period ?? 0) >= 0 ? "profit" : "loss"} /><div className="macro-card-metrics"><span>7D <b>{signed(item.return_7d)}</b></span><span>30D波动 <b>{item.volatility_30d?.toFixed(1) ?? "—"}%</b></span><span>最大回撤 <b>{signed(item.max_drawdown_30d)}</b></span></div></> : <RangeSnapshot item={item} />}
            <footer><span>{item.has_history ? "30D" : "LOW"}</span><span>{item.series_origin}</span><span>{item.has_history ? "NOW" : "HIGH"}</span></footer>
          </article>)}</div>

          <section className="macro-data-quality"><InfoCircleOutlined /><div><strong>数据覆盖</strong><p>{payload.data_quality?.coverage ?? payload.data_note}</p><strong>已知限制</strong><p>{payload.data_quality?.limitations ?? "当前为研究快照，不能替代完整宏观数据终端。"}</p><small>{payload.methodology}</small></div></section>
        </> : null}
      </div>
    </section>
  );
}
