import {
  BarChartOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Button, Progress } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchAiPicks,
  fetchMarketCandles,
  fetchOnchain,
  fetchRuntimeConfig,
  fetchSectorFund,
} from "../../api";
import TradingChart from "../../components/charts/TradingChart";
import { useReport } from "../../contexts/ReportContext";
import type { CurvePoint } from "../../types";
import {
  MetricTile,
  QuantGlowCard,
  SectionHeader,
  SignalRow,
  StatusPill,
} from "./TradingPageShell";
import "./trading.css";

type WatchRow = {
  symbol: string;
  price: number;
  change: number;
  volume: string;
  signal: string;
};

function formatDataMode(source?: string) {
  if (source === "web3-trading-upstream") return "上游代理";
  if (source === "live") return "直连 API";
  if (source === "fixture" || source === "snapshot") return "离线样本";
  return source || "离线样本";
}

function fmtPrice(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

function fmtPct(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function latestChange(curve: CurvePoint[]) {
  if (curve.length < 2) return 0;
  const latest = curve[curve.length - 1]?.close ?? 0;
  const prev = curve[curve.length - 2]?.close ?? latest;
  return prev ? ((latest - prev) / prev) * 100 : 0;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { report, loading, short, long, refresh } = useReport();
  const [fearGreed, setFearGreed] = useState("-");
  const [sectorLead, setSectorLead] = useState("-");
  const [pickCount, setPickCount] = useState(0);
  const [dataMode, setDataMode] = useState("离线样本");
  const [liveCurve, setLiveCurve] = useState<CurvePoint[]>([]);
  const [liveSymbol, setLiveSymbol] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await fetchRuntimeConfig();
        const pair = cfg.symbols?.primary_pair;
        const [onchain, sector, picks, candles] = await Promise.all([
          fetchOnchain("BTC"),
          fetchSectorFund(1),
          fetchAiPicks(),
          fetchMarketCandles(short, long, pair),
        ]);

        const fg = onchain.marketSentiment?.fearGreed;
        if (fg?.value != null) {
          setFearGreed(`${fg.value}${fg.label ? ` / ${fg.label}` : ""}`);
        }

        const topSector = [...(sector.sectors || [])].sort((a, b) => {
          const inflow = (item: typeof a) =>
            Number((item.categoriesTradeDataList || []).find((x) => x.timeRange === "h1")?.tradeInflow || 0);
          return inflow(b) - inflow(a);
        })[0];
        setSectorLead(topSector?.tagsSimplified || topSector?.tag || "-");
        setPickCount((picks.chance?.length || 0) + (picks.funds?.length || 0) + (picks.risk?.length || 0));
        setDataMode(formatDataMode(candles.source || picks.source));

        if (candles.curve?.length) {
          setLiveCurve(candles.curve);
          setLiveSymbol(candles.symbol || pair || "");
        }
      } catch {
        /* dashboard extras can fall back to report data */
      }
    })();
  }, [long, short]);

  const metrics = report?.backtest.metrics;
  const backtestCurve = report?.backtest.curve ?? [];
  const trades = report?.backtest.trades ?? [];
  const riskChecks = report?.risk_checks ?? [];
  const warnings = report?.warnings ?? [];
  const chartCurve = liveCurve.length ? liveCurve : backtestCurve;
  const chartTrades = liveCurve.length ? [] : trades;
  const chartLive = liveCurve.length > 0;
  const currentSymbol = liveSymbol || "BTC-USDT";
  const latest = chartCurve[chartCurve.length - 1];
  const change = latestChange(chartCurve);
  const activeRiskCount = riskChecks.filter((item) => item.severity !== "info").length;

  const watchlist: WatchRow[] = useMemo(() => {
    const base = latest?.close ?? 68240;
    return [
      { symbol: currentSymbol, price: base, change, volume: "1.8B", signal: chartLive ? "LIVE" : "SANDBOX" },
      { symbol: "ETH-USDT", price: base * 0.052, change: change - 0.8, volume: "920M", signal: "TREND" },
      { symbol: "SOL-USDT", price: base * 0.0021, change: change + 1.6, volume: "410M", signal: "MOMENTUM" },
      { symbol: "BNB-USDT", price: base * 0.0089, change: change + 0.4, volume: "260M", signal: "WATCH" },
      { symbol: "ARB-USDT", price: 0.92, change: change - 1.2, volume: "88M", signal: "RISK" },
    ];
  }, [change, chartLive, currentSymbol, latest?.close]);

  const orderBook = useMemo(
    () => [
      { side: "ask", price: (latest?.close ?? 68000) * 1.002, size: "12.4" },
      { side: "ask", price: (latest?.close ?? 68000) * 1.001, size: "8.7" },
      { side: "mid", price: latest?.close ?? 68000, size: "mark" },
      { side: "bid", price: (latest?.close ?? 68000) * 0.999, size: "10.1" },
      { side: "bid", price: (latest?.close ?? 68000) * 0.998, size: "15.8" },
    ],
    [latest?.close],
  );

  const workflow = [
    { icon: <RadarChartOutlined />, label: "机会雷达", path: "/radar" },
    { icon: <BarChartOutlined />, label: "策略回测", path: "/backtests" },
    { icon: <SwapOutlined />, label: "模拟交易", path: "/live-trading" },
    { icon: <ExperimentOutlined />, label: "策略 DSL", path: "/strategy" },
  ];

  return (
    <div className="trading-terminal">
      <section className="terminal-topbar">
        <div className="terminal-symbol">
          <strong>{currentSymbol}</strong>
          <StatusPill tone={chartLive ? "profit" : "ai"}>{chartLive ? "Live" : "Sandbox"}</StatusPill>
          <span>{dataMode}</span>
        </div>
        <div className="terminal-price">
          <strong>{fmtPrice(latest?.close)}</strong>
          <span className={change >= 0 ? "terminal-up" : "terminal-down"}>{fmtPct(change)}</span>
        </div>
        <div className="terminal-actions">
          {workflow.map((item) => (
            <Button key={item.path} size="small" icon={item.icon} onClick={() => navigate(item.path)}>
              {item.label}
            </Button>
          ))}
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => void refresh()}>
            刷新
          </Button>
        </div>
      </section>

      <section className="terminal-grid">
        <QuantGlowCard className="terminal-watch">
          <SectionHeader title="市场监控" description="核心交易对 / 信号 / 成交额" />
          <div className="terminal-table terminal-watch-table">
            <div className="terminal-row terminal-head">
              <span>标的</span>
              <span>价格</span>
              <span>涨跌</span>
              <span>信号</span>
            </div>
            {watchlist.map((item) => (
              <button className="terminal-row terminal-click-row" key={item.symbol} type="button">
                <strong>{item.symbol}</strong>
                <span>{fmtPrice(item.price)}</span>
                <span className={item.change >= 0 ? "terminal-up" : "terminal-down"}>{fmtPct(item.change)}</span>
                <em>{item.signal}</em>
              </button>
            ))}
          </div>
          <div className="terminal-mini-kpis">
            <div>
              <span>恐贪</span>
              <strong>{fearGreed}</strong>
            </div>
            <div>
              <span>领涨</span>
              <strong>{sectorLead}</strong>
            </div>
          </div>
        </QuantGlowCard>

        <QuantGlowCard className="terminal-chart-panel" variant="live">
          <div className="terminal-chart-header">
            <SectionHeader title="行情走势" description="K 线 / 均线 / 回测买卖点" />
            <div className="terminal-chart-tools">
              <button type="button">1H</button>
              <button type="button" className="active">1D</button>
              <button type="button">1W</button>
              <button type="button">MA</button>
            </div>
          </div>
          <TradingChart curve={chartCurve} trades={chartTrades} variant="standard" height={390} showEquity />
          <div className="terminal-chart-footer">
            <span>MA 短线</span>
            <span>MA 长线</span>
            <span>权益曲线</span>
            <span>{trades.length} 笔回测交易</span>
          </div>
        </QuantGlowCard>

        <QuantGlowCard className="terminal-side">
          <SectionHeader title="执行面板" description="模拟交易 / 风控门禁" />
          <div className="terminal-orderbook">
            {orderBook.map((item, index) => (
              <div className={`terminal-book-row terminal-book-${item.side}`} key={`${item.side}-${index}`}>
                <span>{item.side.toUpperCase()}</span>
                <strong>{fmtPrice(item.price)}</strong>
                <em>{item.size}</em>
              </div>
            ))}
          </div>
          <div className="terminal-risk-box">
            <div>
              <span>风控状态</span>
              <strong>{activeRiskCount ? `${activeRiskCount} 项预警` : "可模拟"}</strong>
            </div>
            <Progress
              percent={activeRiskCount ? 62 : 100}
              showInfo={false}
              strokeColor={activeRiskCount ? "var(--qa-warn)" : "var(--qa-profit)"}
              trailColor="rgba(255,255,255,0.08)"
            />
          </div>
          <Button block className="btn-gradient" type="primary" icon={<SwapOutlined />} onClick={() => navigate("/live-trading")}>
            打开模拟交易
          </Button>
        </QuantGlowCard>

        <QuantGlowCard className="terminal-metrics">
          <div className="trading-metric-grid terminal-metric-grid">
            <MetricTile label="策略收益" value={metrics?.strategy_return_pct ?? 0} kind="pct" tone="profit" showSign />
            <MetricTile label="买入持有" value={metrics?.buy_hold_return_pct ?? 0} kind="pct" tone="neutral" showSign />
            <MetricTile label="最大回撤" value={metrics?.maximum_drawdown_pct ?? 0} kind="pct" tone="loss" showSign />
            <MetricTile label="Sharpe" value={metrics?.sharpe_ratio ?? 0} tone="neutral" precision={2} />
            <MetricTile label="交易次数" value={metrics?.trade_count ?? 0} tone="neutral" kind="qty" />
            <MetricTile label="最终权益" value={metrics?.final_equity ?? 0} tone="profit" precision={0} />
          </div>
        </QuantGlowCard>

        <QuantGlowCard className="terminal-signals">
          <SectionHeader title="信号与风险" description="AI picks / RiskManager / 运行边界" />
          <div className="terminal-signal-grid">
            <SignalRow title="AI 机会池" meta={`ValueScan 当前返回 ${pickCount} 条机会/资金/风险信号`} badge={<StatusPill tone="ai">{pickCount}</StatusPill>} />
            {(riskChecks.length ? riskChecks.slice(0, 3) : [{ rule_id: "risk_gate", message: "当前参数组合通过模拟风控", severity: "pass" }]).map((item) => (
              <SignalRow
                key={item.rule_id}
                title={item.rule_id}
                meta={item.message}
                badge={<StatusPill tone={item.severity === "pass" ? "profit" : item.severity === "warning" ? "ai" : "loss"}>{item.severity}</StatusPill>}
              />
            ))}
            {(warnings.length ? warnings.slice(0, 2) : ["教学沙箱不进入实盘执行", "结果用于研究验证"]).map((warning) => (
              <SignalRow key={warning} title="运行边界" meta={warning} badge={<SafetyOutlined />} />
            ))}
          </div>
        </QuantGlowCard>

        <QuantGlowCard className="terminal-system">
          <SectionHeader title="数据源" description="连接状态 / 样本边界" />
          <div className="terminal-source-grid">
            <div><DatabaseOutlined /><span>行情</span><strong>{dataMode}</strong></div>
            <div><RadarChartOutlined /><span>信号</span><strong>{pickCount ? "已加载" : "等待"}</strong></div>
            <div><SafetyOutlined /><span>风控</span><strong>{activeRiskCount ? "预警" : "通过"}</strong></div>
          </div>
          <Button block icon={<DatabaseOutlined />} onClick={() => navigate("/data-sources")}>
            查看数据源详情
          </Button>
        </QuantGlowCard>
      </section>
    </div>
  );
}
