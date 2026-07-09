import {
  ApiOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  DashboardOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Alert, Button, Input, InputNumber, Segmented, Select, Slider, Table, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchAiPicks, fetchKlineAnalysis, fetchSignalAnalysis, fetchTickerStats } from "../../api";
import { KlineAnalysisChart } from "../../components/charts/KlineAnalysisChart";
import TradingChart from "../../components/charts/TradingChart";
import { useReport } from "../../contexts/ReportContext";
import type { DashboardPickItem, KlineAnalysisPayload, SignalAnalysisPayload } from "../../types";
import {
  MetricTile,
  QuantGlowCard,
  SectionHeader,
  SignalRow,
  StatusPill,
  TradingPageShell,
} from "./TradingPageShell";
import "./live-trading.css";

const CONFIRM_TOKEN = "CONFIRM";
const MAX_USD_DEFAULT = 2;

type PickRow = DashboardPickItem & { group: "机会" | "资金" | "风险" };
type EvidencePanel = "market" | "signal" | "risk" | "ledger" | "system";
type ExecutionVenue = "cefi" | "defi";
type OrderType = "market" | "limit";

function baseFromPair(pair: string) {
  return pair.split(/[-/]/)[0]?.toUpperCase() || "BTC";
}

function normalizePair(pair: string) {
  const base = baseFromPair(pair);
  return pair.includes("-") ? pair : `${base}-USDT`;
}

function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 2 : 4 })}`;
}

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompact(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function signalTone(signal?: string) {
  if (signal === "BUY") {
    return "profit" as const;
  }
  if (signal === "SELL") {
    return "loss" as const;
  }
  return "ai" as const;
}

function riskTone(severity?: string) {
  return severity === "critical" || severity === "high" ? "loss" : "neutral";
}

export default function LiveTradingPage() {
  const navigate = useNavigate();
  const { report, loading: reportLoading } = useReport();
  const [symbol, setSymbol] = useState("BTC-USDT");
  const [klineType, setKlineType] = useState("1hour");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [venue, setVenue] = useState<ExecutionVenue>("defi");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [usdAmount, setUsdAmount] = useState(1);
  const [maxUsd, setMaxUsd] = useState(MAX_USD_DEFAULT);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [latencyMs, setLatencyMs] = useState(220);
  const [virtualCash, setVirtualCash] = useState(100000);
  const [confirmText, setConfirmText] = useState("");
  const [orderResult, setOrderResult] = useState<string>("");
  const [signal, setSignal] = useState<SignalAnalysisPayload | null>(null);
  const [kline, setKline] = useState<KlineAnalysisPayload | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [pickSummary, setPickSummary] = useState("等待刷新");
  const [pickRows, setPickRows] = useState<PickRow[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<EvidencePanel>("market");
  const [forkChain, setForkChain] = useState("Ethereum Mainnet");
  const [gasGwei, setGasGwei] = useState(35);
  const [replayTab, setReplayTab] = useState("orders");
  const [zenMode, setZenMode] = useState(false);

  const riskRules = report?.fusion.risk_rules ?? report?.backtest.risk_rules ?? [];
  const riskChecks = report?.risk_checks ?? [];
  const rejections = report?.backtest.risk_rejections ?? [];
  const warnings = report?.warnings ?? [];
  const assumptions = report?.backtest.assumptions ?? [];
  const metrics = report?.backtest.metrics;
  const fusion = report?.fusion;
  const strategyReturn = metrics?.strategy_return_pct ?? 0;
  const virtualEquity = virtualCash * (1 + strategyReturn / 100);
  const poolLiquidity = 200000;
  const cefiFee = usdAmount * 0.0005;
  const gasFee = venue === "defi" ? Math.max(0.72, usdAmount * (gasGwei / 35000)) : 0;
  const slippageImpact =
    venue === "defi" ? Math.min(85, (usdAmount / poolLiquidity) * 100 * 1.7) : Math.min(5, (usdAmount / 1000000) * 100);
  const mevPenalty = venue === "defi" && latencyMs > 400 ? usdAmount * 0.0009 : 0;
  const benchmarkReturn = metrics?.buy_hold_return_pct ?? 0;
  const alphaReturn = strategyReturn - benchmarkReturn;
  const maxDrawdown = metrics?.maximum_drawdown_pct ?? 0;
  const sharpeRatio = metrics?.sharpe_ratio ?? 0;
  const estimatedCost = cefiFee + gasFee + mevPenalty + (usdAmount * slippageImpact) / 100;
  const estimatedReceive = Math.max(0, usdAmount - estimatedCost);
  const costWarnings = [
    slippageImpact > slippageTolerance ? `滑点 ${slippageImpact.toFixed(2)}% 超过容忍度 ${slippageTolerance}%` : null,
    usdAmount > poolLiquidity * 0.02 ? "订单额超过目标池 2%，建议拆单或改用限价模拟" : null,
    latencyMs > 600 ? "模拟延迟较高，链上打包和 MEV 风险被放大" : null,
  ].filter(Boolean);
  const sideMatchesSignal = signal?.signal && side === signal.signal.toLowerCase();
  const hasHardBlock =
    rejections.length > 0 ||
    riskChecks.some((check) => ["critical", "high"].includes(check.severity)) ||
    slippageImpact > slippageTolerance;
  const canSubmit =
    confirmText.trim().toUpperCase() === CONFIRM_TOKEN && usdAmount > 0 && usdAmount <= maxUsd && !hasHardBlock;
  const executionState = hasHardBlock ? "需要复核" : canSubmit ? "门禁就绪" : "等待确认";
  const klineFrames = Object.entries(signal?.kline ?? {});
  const klineMetrics = kline?.metrics;
  const chartPrice = lastPrice ?? signal?.market?.price ?? klineMetrics?.latestClose ?? null;
  const replayRows = (report?.backtest.trades ?? []).slice(-6).map((trade, index) => ({
    key: `${trade.date}-${trade.action}-${trade.price}-${index}`,
    time: trade.date,
    type: trade.action,
    price: trade.price,
    slippage: index % 4 === 0 ? slippageImpact : Math.max(0.01, slippageImpact / 2),
    status: index % 4 === 0 && slippageImpact > slippageTolerance ? "深度不足阻断" : "sim filled",
  }));

  const decisionSummary = useMemo(() => {
    if (!signal) {
      return "当前没有可用信号，页面只允许查看样例流程。";
    }
    const confidence = signal.confidence != null ? `，置信度 ${signal.confidence}%` : "";
    return `${signal.signalLabel || signal.signal || "HOLD"}${confidence}。${signal.summary ?? "需要结合风险规则人工复核。"}`;
  }, [signal]);

  const loadContext = useCallback(async () => {
    setSignalLoading(true);
    try {
      const base = baseFromPair(symbol);
      const pair = normalizePair(symbol);
      const [analysis, picks, ticker, klinePayload] = await Promise.all([
        fetchSignalAnalysis(base),
        fetchAiPicks(),
        fetchTickerStats(pair),
        fetchKlineAnalysis(pair, klineType, 160),
      ]);
      setSignal(analysis.ok ? analysis : null);
      setKline(klinePayload.ok ? klinePayload : null);
      setLastPrice(ticker.ticker?.last ?? analysis.market?.price ?? klinePayload.metrics?.latestClose ?? null);
      const chance = picks.chance?.length ?? 0;
      const funds = picks.funds?.length ?? 0;
      const risk = picks.risk?.length ?? 0;
      setPickSummary(`机会 ${chance} 条 / 资金 ${funds} 条 / 风险 ${risk} 条`);
      setPickRows([
        ...(picks.chance ?? []).slice(0, 3).map((item) => ({ ...item, group: "机会" as const })),
        ...(picks.funds ?? []).slice(0, 2).map((item) => ({ ...item, group: "资金" as const })),
        ...(picks.risk ?? []).slice(0, 3).map((item) => ({ ...item, group: "风险" as const })),
      ]);
    } catch (error) {
      setSignal(null);
      setKline(null);
      setPickRows([]);
      setOrderResult(error instanceof Error ? error.message : "加载信号失败");
    } finally {
      setSignalLoading(false);
    }
  }, [symbol, klineType]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  function submitDryRun() {
    if (hasHardBlock) {
      setOrderResult("当前存在风控阻断或高风险检查，dry-run 也需要先进入人工复核。");
      return;
    }
    if (confirmText.trim().toUpperCase() !== CONFIRM_TOKEN) {
      setOrderResult(`请输入确认词 ${CONFIRM_TOKEN} 后才会记录模拟研究动作。`);
      return;
    }
    if (usdAmount <= 0) {
      setOrderResult("金额必须大于 0。");
      return;
    }
    if (usdAmount > maxUsd) {
      setOrderResult(`超过硬上限 ${maxUsd} USDT，已拒绝。该上限模拟 MAX_POSITION_PCT 风控规则。`);
      return;
    }

    const plan = signal?.tradePlan;
    const gate = sideMatchesSignal ? "信号方向一致" : "信号未对齐，仅允许 dry-run 记录";

    setOrderResult(
      [
        `[DRY-RUN] ${side.toUpperCase()} ${symbol} ~= ${usdAmount} USDT`,
        chartPrice ? `参考价 ${chartPrice}` : "无实时报价",
        `门禁: ${gate}`,
        plan?.stopLoss ? `计划止损 ${plan.stopLoss}` : "无 tradePlan 止损",
        `${venue.toUpperCase()} / ${orderType}`,
        `估算成本 ${formatUsd(estimatedCost)} / 到账 ${formatUsd(estimatedReceive)}`,
        `风险检查 ${riskChecks.length} 条 / 拒绝 ${rejections.length} 条`,
        "未连接交易所，订单未送出",
      ].join(" / "),
    );
  }


  const sandboxModules = [
    { icon: <WalletOutlined />, title: "本地账本", meta: `样本资金 ${formatUsd(virtualCash)}` },
    { icon: <ApiOutlined />, title: "模拟撮合", meta: `${venue.toUpperCase()} ${orderType}` },
    { icon: <ThunderboltOutlined />, title: "成本仿真", meta: `Gas ${formatUsd(gasFee)} / 滑点 ${slippageImpact.toFixed(2)}%` },
    { icon: <SafetyOutlined />, title: "风控门禁", meta: hasHardBlock ? "阻断" : "可审查" },
    { icon: <DashboardOutlined />, title: "绩效账本", meta: `权益 ${formatUsd(virtualEquity)}` },
  ];

  const marketPanel = (
    <div className="live-panel-grid">
      <div><span>最新价</span><strong>{formatUsd(chartPrice)}</strong></div>
      <div><span>24h 涨跌</span><strong>{formatPct(signal?.market?.changeRate24h)}</strong></div>
      <div><span>24h 高点</span><strong>{formatUsd(signal?.market?.high24h)}</strong></div>
      <div><span>24h 低点</span><strong>{formatUsd(signal?.market?.low24h)}</strong></div>
      <div><span>成交额</span><strong>{formatCompact(signal?.market?.volValue24h)}</strong></div>
      <div><span>Fear & Greed</span><strong>{signal?.onchainMetrics?.fearGreed ?? "-"}</strong></div>
      {klineFrames.map(([frame, item]) => (
        <div key={frame}><span>{frame}</span><strong>{item.trend ?? item.trendKey ?? "-"}</strong><em>score {item.score ?? "-"} / RSI {item.rsi ?? "-"}</em></div>
      ))}
    </div>
  );

  const signalPanel = (
    <div className="live-evidence-list">
      <div><span>AI</span><p>{decisionSummary}</p></div>
      {(signal?.reasons ?? []).slice(0, 5).map((reason, index) => (
        <div key={`${reason}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{reason}</p></div>
      ))}
      {(signal?.logicFlow ?? []).slice(0, 5).map((step) => (
        <div key={`logic-${step.step}`}><span>{step.step}</span><p>{step.title}: {step.summary ?? step.detail ?? step.note ?? step.status ?? "已记录"}</p></div>
      ))}
      {!signal?.reasons?.length && !signal?.logicFlow?.length && <div className="live-trading-empty">暂无推理证据</div>}
    </div>
  );

  const riskPanel = (
    <div className="trading-list">
      {riskChecks.slice(0, 6).map((check) => (
        <SignalRow
          key={`${check.rule_id}-${check.message}`}
          title={check.rule_id}
          meta={`${check.phase ?? "risk"} / ${check.message}`}
          badge={<StatusPill tone={riskTone(check.severity)}>{check.severity}</StatusPill>}
        />
      ))}
      {rejections.slice(0, 4).map((rejection) => (
        <SignalRow
          key={`${rejection.date}-${rejection.rule_id}-${rejection.reason}`}
          title={`${rejection.rule_id} 拒绝`}
          meta={`${rejection.date} / ${rejection.symbol} / ${rejection.side} / ${rejection.reason}`}
          badge={<StatusPill tone="loss">blocked</StatusPill>}
        />
      ))}
      {warnings.slice(0, 3).map((warning) => (
        <SignalRow key={warning} title="数据警告" meta={warning} badge={<StatusPill tone="neutral">warn</StatusPill>} />
      ))}
      {!riskChecks.length && !rejections.length && !warnings.length && <div className="live-trading-empty">暂无风控检查数据</div>}
    </div>
  );

  const ledgerPanel = (
    <div className="live-ledger-panel-inline">
      <TradingChart curve={report?.backtest.curve ?? []} trades={report?.backtest.trades ?? []} variant="compact" height={230} showEquity />
      <div className="live-metric-stack">
        <MetricTile label="策略收益" value={metrics?.strategy_return_pct ?? 0} kind="pct" tone="profit" showSign />
        <MetricTile label="最大回撤" value={metrics?.maximum_drawdown_pct ?? 0} kind="pct" tone="loss" />
        <MetricTile label="最终权益" value={metrics?.final_equity ?? 0} kind="usd" />
        <MetricTile label="成交笔数" value={metrics?.trade_count ?? 0} />
      </div>
      <Table
        className="trading-ant-table live-compact-table"
        pagination={false}
        rowKey={(row) => `${row.date}-${row.action}-${row.price}`}
        dataSource={(report?.backtest.trades ?? []).slice(-5)}
        loading={reportLoading}
        locale={{ emptyText: "暂无成交" }}
        columns={[
          { title: "日期", dataIndex: "date" },
          { title: "动作", dataIndex: "action" },
          { title: "价格", dataIndex: "price" },
        ]}
      />
    </div>
  );

  const systemPanel = (
    <div>
      <div className="live-system-panel">
        <div><span>产品形态</span><strong>{fusion?.product_shape ?? "research sandbox"}</strong></div>
        <div><span>DSL + 风控</span><strong>{fusion?.dsl_and_risk ?? "enabled"}</strong></div>
        <div><span>规则数量</span><strong>{riskRules.length}</strong></div>
      </div>
      <div className="live-chip-list">
        {(fusion?.adapted_modules ?? []).map((module) => <span key={module}>{module}</span>)}
        {assumptions.slice(0, 5).map((assumption) => <span key={assumption}>{assumption}</span>)}
        {!fusion?.adapted_modules?.length && !assumptions.length && <span>暂无系统假设</span>}
      </div>
    </div>
  );

  const panelBody = {
    market: marketPanel,
    signal: signalPanel,
    risk: riskPanel,
    ledger: ledgerPanel,
    system: systemPanel,
  }[activePanel];

  return (
    <TradingPageShell
      eyebrow="Research Dry-Run Console"
      title="模拟交易工作台"
      description="以 K 线主画布、信号情报、订单票据和证据面板组织单用户本地模拟交易；这里只记录 dry-run，不连接真实账户。"
      actions={
        <>
          <Button icon={<ReloadOutlined />} onClick={() => void loadContext()} loading={signalLoading}>
            刷新
          </Button>
          <Button icon={<SafetyOutlined />} onClick={() => navigate("/risk")}>
            风控
          </Button>
          <Button icon={zenMode ? <EyeOutlined /> : <EyeInvisibleOutlined />} onClick={() => setZenMode((value) => !value)}>
            Zen
          </Button>
        </>
      }
      aside={
        <div className="live-command-card">
          <div><span>状态</span><strong>{executionState}</strong></div>
          <div><span>价格</span><strong>{formatUsd(chartPrice)}</strong></div>
          <div><span>周期</span><strong>{klineType}</strong></div>
        </div>
      }
    >
      <Alert
        className="live-trading-warning"
        type="warning"
        showIcon
        message="模拟交易保护"
        description="教学沙箱不接交易所写接口。CONFIRM 只用于演练单用户本地研究流程；任何真实账户、钱包授权、登录权限管理或订单提交都不属于本仓库能力范围。"
      />

      <section className="live-sandbox-strip" aria-label="模拟交易模块">
        {sandboxModules.map((item) => (
          <div key={item.title}>
            <span className="live-module-icon">{item.icon}</span>
            <strong>{item.title}</strong>
            <em>{item.meta}</em>
          </div>
        ))}
      </section>

      <section className={`live-trading-terminal${zenMode ? " is-zen" : ""}`}>
        <aside className="live-intel-rail">
          <div className="live-rail-header">
            <span>{symbol}</span>
            <StatusPill tone={signalTone(signal?.signal)}>{signal?.signalLabel || signal?.signal || "WAIT"}</StatusPill>
          </div>
          <strong className="live-price">{formatUsd(chartPrice)}</strong>
          <p>{decisionSummary}</p>
          <div className="live-sandbox-control">
            <label className="live-trading-field">
              <span>当前策略</span>
              <Select
                value="Uniswap_V3_Grid_v1.py"
                options={[
                  { value: "Uniswap_V3_Grid_v1.py", label: "Uniswap_V3_Grid_v1.py" },
                  { value: "Momentum_Breakout.py", label: "Momentum_Breakout.py" },
                ]}
              />
            </label>
            <label className="live-trading-field">
              <span>Fork 目标链</span>
              <Select
                value={forkChain}
                onChange={setForkChain}
                options={[
                  { value: "Ethereum Mainnet", label: "Ethereum Mainnet" },
                  { value: "Arbitrum", label: "Arbitrum" },
                  { value: "BNB Chain", label: "BNB Chain" },
                ]}
              />
            </label>
            <label className="live-trading-field live-slider-field">
              <span>网络延迟 {latencyMs}ms</span>
              <Slider min={0} max={1200} step={50} value={latencyMs} onChange={setLatencyMs} />
            </label>
            <label className="live-trading-field live-slider-field">
              <span>Gas Price {gasGwei} Gwei</span>
              <Slider min={5} max={160} step={5} value={gasGwei} onChange={setGasGwei} />
            </label>
            <div className="live-sandbox-actions">
              <Button type="primary" className="btn-gradient" icon={<PlayCircleOutlined />} onClick={submitDryRun}>
                启动模拟
              </Button>
              <Button danger icon={<ReloadOutlined />} onClick={() => setVirtualCash(100000)}>
                重置沙箱
              </Button>
            </div>
          </div>
          <div className="live-rail-stats">
            <div><span>置信度</span><strong>{signal?.confidence != null ? `${signal.confidence}%` : "-"}</strong></div>
            <div><span>风险</span><strong>{hasHardBlock ? "阻断" : "可审查"}</strong></div>
            <div><span>机会雷达</span><strong>{pickSummary}</strong></div>
          </div>
          <div className="live-wallet-card">
            <div>
              <span>本地模拟账本</span>
              <strong>{formatUsd(virtualEquity)}</strong>
              <em>初始 {formatUsd(virtualCash)} / Gas 本单 {formatUsd(gasFee)}</em>
            </div>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => setVirtualCash(100000)}>
              回填样本资金
            </Button>
          </div>
          <div className="live-pick-list">
            {pickRows.slice(0, 5).map((item, index) => (
              <button key={`${item.group}-${item.symbol ?? item.title ?? index}`} type="button">
                <span>{item.group}</span>
                <strong>{item.title ?? item.symbol ?? "未命名条目"}</strong>
                <em>{item.summary ?? item.vsTokenId ?? "ValueScan"}</em>
              </button>
            ))}
          </div>
        </aside>

        <main className="live-chart-stage">
          <div className="live-chart-toolbar">
            <div>
              <span>{symbol} / {forkChain}</span>
              <strong>{formatUsd(chartPrice)} <em className={signal?.market?.changeRate24h && signal.market.changeRate24h >= 0 ? "live-up" : "live-down"}>{formatPct(signal?.market?.changeRate24h)}</em></strong>
            </div>
            <div className="live-sync-status"><i /> Live Syncing</div>
            <Select
              size="small"
              value={klineType}
              onChange={setKlineType}
              options={[
                { value: "15min", label: "15m" },
                { value: "1hour", label: "1h" },
                { value: "4hour", label: "4h" },
                { value: "1day", label: "1D" },
              ]}
              style={{ width: 92 }}
            />
          </div>
          <KlineAnalysisChart candles={kline?.candles ?? []} tradePlan={signal?.tradePlan ?? null} height={500} className="live-main-chart" />
          <div className="live-execution-markers">
            <span className="buy">B (Sim) {formatUsd(signal?.tradePlan?.entryLow ?? chartPrice)}</span>
            <span className="sell">S (Sim) {formatUsd(signal?.tradePlan?.target1 ?? chartPrice)}</span>
          </div>
          <div className="live-kline-metrics">
            <div><span>RSI</span><strong>{klineMetrics?.rsi ?? "-"}</strong></div>
            <div><span>支撑</span><strong>{formatUsd(klineMetrics?.support20)}</strong></div>
            <div><span>阻力</span><strong>{formatUsd(klineMetrics?.resistance20)}</strong></div>
            <div><span>波动率</span><strong>{formatPct(klineMetrics?.volatilityPct)}</strong></div>
            <div><span>区间位置</span><strong>{formatPct(klineMetrics?.rangePositionPct)}</strong></div>
            <div><span>行情</span><strong>{klineMetrics?.regime ?? kline?.trend ?? "-"}</strong></div>
          </div>
          <Tabs
            className="live-replay-tabs"
            activeKey={replayTab}
            onChange={setReplayTab}
            items={[
              {
                key: "orders",
                label: `虚拟当前挂单 (${costWarnings.length ? 1 : 0})`,
                children: <Table className="trading-ant-table live-replay-table" pagination={false} rowKey="key" dataSource={replayRows} columns={[
                  { title: "时间/区块", dataIndex: "time" },
                  { title: "类型", dataIndex: "type" },
                  { title: "模拟成交价", dataIndex: "price", render: (value) => formatUsd(Number(value)) },
                  { title: "模拟执行滑点", dataIndex: "slippage", render: (value) => `${Number(value).toFixed(2)}%` },
                  { title: "状态", dataIndex: "status" },
                ]} rowClassName={(row) => row.status.includes("阻断") ? "live-ghost-order" : ""} />,
              },
              { key: "fills", label: `模拟历史成交 (${report?.backtest.trades?.length ?? 0})`, children: ledgerPanel },
              { key: "gas", label: "链上 Gas 账单", children: <div className="live-gas-bill">Gas {formatUsd(gasFee)} / MEV {formatUsd(mevPenalty)} / Latency {latencyMs}ms / Base {gasGwei} Gwei</div> },
            ]}
          />
        </main>

        <aside className="live-order-ticket">
          <div className="live-ledger-card">
            <div>
              <span>本地模拟净值</span>
              <strong>{formatUsd(virtualEquity)}</strong>
              <em>含模拟 Gas 扣除 -{formatUsd(gasFee)}</em>
            </div>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => setVirtualCash(100000)}>
              回填样本资金
            </Button>
          </div>
          <div className="live-kpi-matrix">
            <div><span>收益率</span><strong className="live-up">{formatPct(strategyReturn)}</strong></div>
            <div><span>MDD</span><strong className={Math.abs(maxDrawdown) <= 5 ? "live-up" : "live-down"}>{formatPct(maxDrawdown)}</strong></div>
            <div><span>Sharpe</span><strong>{sharpeRatio.toFixed(2)}</strong></div>
            <div><span>Alpha</span><strong className={alphaReturn >= 0 ? "live-up" : "live-down"}>{formatPct(alphaReturn)}</strong></div>
          </div>
          <div className="live-benchmark-card">
            <span>Alpha Benchmark</span>
            <svg viewBox="0 0 220 74" role="img" aria-label="策略与买入持有基准线">
              <polyline className="bench-hold" points="0,56 44,52 88,46 132,38 176,31 220,26" />
              <polyline className="bench-strategy" points="0,58 44,48 88,52 132,34 176,22 220,16" />
            </svg>
            <em>紫线策略 / 灰线 Buy & Hold</em>
          </div>
          <div className="live-ticket-header">
            <span>Dry-run Ticket</span>
            <StatusPill tone={canSubmit ? "profit" : hasHardBlock ? "loss" : "neutral"}>{executionState}</StatusPill>
          </div>
          <div className="live-order-form">
            <label className="live-trading-field live-trading-field--wide">
              <span>交易对</span>
              <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            </label>
            <label className="live-trading-field">
              <span>方向</span>
              <Select value={side} onChange={setSide} options={[{ value: "buy", label: "buy" }, { value: "sell", label: "sell" }]} />
            </label>
            <label className="live-trading-field">
              <span>场景</span>
              <Select
                value={venue}
                onChange={setVenue}
                options={[
                  { value: "defi", label: "DeFi / AMM" },
                  { value: "cefi", label: "CeFi / Orderbook" },
                ]}
              />
            </label>
            <label className="live-trading-field">
              <span>订单类型</span>
              <Select
                value={orderType}
                onChange={setOrderType}
                options={[
                  { value: "market", label: "market" },
                  { value: "limit", label: "limit" },
                ]}
              />
            </label>
            <label className="live-trading-field">
              <span>金额 USDT</span>
              <InputNumber min={0.1} step={0.1} value={usdAmount} onChange={(value) => setUsdAmount(Number(value) || 0)} />
            </label>
            <label className="live-trading-field">
              <span>硬上限</span>
              <InputNumber min={0.1} step={0.1} value={maxUsd} onChange={(value) => setMaxUsd(Number(value) || MAX_USD_DEFAULT)} />
            </label>
            <label className="live-trading-field">
              <span>确认词</span>
              <Input placeholder={CONFIRM_TOKEN} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
            </label>
            <label className="live-trading-field">
              <span>滑点容忍 %</span>
              <InputNumber min={0.05} step={0.05} value={slippageTolerance} onChange={(value) => setSlippageTolerance(Number(value) || 0.05)} />
            </label>
            <label className="live-trading-field">
              <span>延迟 ms</span>
              <InputNumber min={0} step={50} value={latencyMs} onChange={(value) => setLatencyMs(Number(value) || 0)} />
            </label>
          </div>
          <div className="live-cost-simulator">
            <div><span>手续费</span><strong>{formatUsd(cefiFee)}</strong></div>
            <div><span>Gas</span><strong>{formatUsd(gasFee)}</strong></div>
            <div><span>滑点</span><strong>{slippageImpact.toFixed(2)}%</strong></div>
            <div><span>MEV</span><strong>{formatUsd(mevPenalty)}</strong></div>
            <div className="live-cost-wide"><span>估算到账</span><strong>{formatUsd(estimatedReceive)}</strong></div>
          </div>
          {costWarnings.length > 0 && (
            <div className="live-cost-warning">
              {costWarnings.map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          )}
          <div className="live-order-summary">
            <div><span>计划方向</span><strong>{signal?.tradePlan?.direction ?? signal?.signal ?? "-"}</strong></div>
            <div><span>入场</span><strong>{signal?.tradePlan?.entryLow ?? "-"} / {signal?.tradePlan?.entryHigh ?? "-"}</strong></div>
            <div><span>止损</span><strong>{signal?.tradePlan?.stopLoss ?? "-"}</strong></div>
            <div><span>目标</span><strong>{signal?.tradePlan?.target1 ?? "-"}</strong></div>
          </div>
          <Button block type="primary" className="btn-gradient live-submit" icon={<SwapOutlined />} onClick={submitDryRun}>
            记录 dry-run
          </Button>
          {orderResult && <div className="live-trading-output">{orderResult}</div>}
        </aside>
      </section>

      <QuantGlowCard className="live-evidence-dock">
        <div className="live-dock-header">
          <SectionHeader title="证据面板" description="把市场、信号、风险、账本和系统假设收在一个可切换区域，减少首屏噪音。" />
          <Segmented
            value={activePanel}
            onChange={(value) => setActivePanel(value as EvidencePanel)}
            options={[
              { label: "市场", value: "market" },
              { label: "信号", value: "signal" },
              { label: "风险", value: "risk" },
              { label: "账本", value: "ledger" },
              { label: "系统", value: "system" },
            ]}
          />
        </div>
        {panelBody}
      </QuantGlowCard>
    </TradingPageShell>
  );
}








