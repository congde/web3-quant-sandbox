import { CalendarOutlined, ClockCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchWeb3Macro } from "../../api";
import type { Web3MacroPayload } from "../../types";
import { Sparkline } from "../trading/TradingPageShell";

function formatValue(value: number) {
  return value >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
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
  const leadEvent = payload?.events[0];

  return (
    <section className="research-paper macro-observation-view">
      <aside className="macro-sidebar">
        <div className="macro-sidebar-title"><span>WEB3 MACRO LENS</span><strong>宏观观察</strong></div>
        <nav aria-label="Web3 宏观分类">{(payload?.categories ?? ["总览", "核心资产", "公链生态"]).map((label) => <button key={label} type="button" className={activeCategory === label ? "active" : ""} onClick={() => setActiveCategory(label)}><span>{label}</span><b>{(payload?.cards ?? []).filter((item) => label === "总览" || item.category === label).length}</b></button>)}</nav>
        <p className="knowledge-help">只保留会直接影响加密资产、链上流动性和协议风险的宏观信号。</p>
      </aside>

      <div className="macro-main">
        <header className="macro-header"><div><h1>{activeCategory}</h1><p>Web3 专用市场状态 · 不展示股票、原油、贵金属或无加密关联的宏观数据</p></div><Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>刷新采集</Button></header>
        {error ? <Alert type="error" showIcon message="Web3 宏观数据加载失败" description={error} /> : null}
        {loading && !payload ? <div className="research-loading"><Spin tip="正在聚合行情、链上与新闻…" /></div> : null}
        {payload ? <>
          {leadEvent ? <a className="macro-event" href={leadEvent.url || undefined} target="_blank" rel="noreferrer"><CalendarOutlined /><span>{leadEvent.date}</span><b>{leadEvent.risk ? "RISK" : "WEB3"}</b><strong>{leadEvent.title}</strong></a> : null}
          <div className="macro-regime-row">{payload.labels.map((label) => <span key={label}>{label}</span>)}<span><ClockCircleOutlined /> {payload.updated_at?.slice(0, 16).replace("T", " ") || "离线快照"}</span></div>
          <p className="macro-thesis">{payload.thesis}</p>
          <div className="macro-section-label"><span>加密主线</span> 最近 30 个观测点 · 曲线来源见卡片提示</div>
          <div className="macro-chart-grid">{visibleCards.map((item) => <article key={item.id} className="macro-chart-card" title={item.series_origin}><header><strong>{item.name}<small>{item.symbol}</small></strong><div><b>{formatValue(item.value)}</b><span className={item.change_24h >= 0 ? "up" : "down"}>{item.change_24h >= 0 ? "+" : ""}{item.change_24h.toFixed(2)}%</span><small>区间 {item.change_period >= 0 ? "+" : ""}{item.change_period.toFixed(1)}%</small></div></header><Sparkline values={item.values} tone={item.change_period >= 0 ? "profit" : "loss"} /><footer><span>30D</span><span>{item.series_origin}</span><span>NOW</span></footer></article>)}</div>
          <p className="macro-data-note">{payload.data_note}</p>
        </> : null}
      </div>
    </section>
  );
}
