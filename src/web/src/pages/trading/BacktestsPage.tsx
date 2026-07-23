import { PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, InputNumber, Segmented, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchBacktestCompare,
  fetchBacktestCpcv,
  fetchBacktestPortfolio,
  fetchBacktestRobustness,
  fetchBacktestStrategies,
  fetchInvestmentGate,
  fetchBacktestWalkForward,
  fetchBacktestWindows,
  runMinedFactorBacktest,
  runRollingBacktest,
  type InvestmentGatePayload,
} from "../../api";
import BacktestComboChart from "../../components/charts/BacktestComboChart";
import TradingChart from "../../components/charts/TradingChart";
import { mergeTradeTimesIntoCurve } from "../../components/charts/series";
import { tsToChartDay } from "../../components/charts/chartTime";
import { loadFactorHandoff, type FactorHandoff } from "../../factorHandoff";
import { MonoNumber } from "../../quant-atelier";
import type {
  BacktestComparePayload,
  BacktestCpcvPayload,
  BacktestPortfolioPayload,
  BacktestRobustnessPayload,
  BacktestWalkForwardPayload,
  BacktestWindowsPayload,
  CurvePoint,
  RollingBacktestPayload,
  RollingTrade,
  Trade,
} from "../../types";
import {
  MetricTile,
  QuantGlowCard,
  SectionHeader,
  StatusPill,
  TradingPageShell,
} from "./TradingPageShell";

const SYMBOL_OPTIONS = [
  { label: "WEB3-DEMO/USDT · 教学样本（固定至 2026-02-20）", value: "WEB3-DEMO/USDT" },
  { label: "BTC-USDT · 离线快照 / 可拉最新", value: "BTC-USDT" },
];

const LIMIT_OPTIONS = [
  { label: "60 根", value: 60 },
  { label: "120 根", value: 120 },
  { label: "300 根", value: 300 },
];

const COST_PRESET_OPTIONS = [
  { label: "教学（零滑点）", value: "teaching" },
  { label: "现实（5bps+动态滑点）", value: "realistic" },
  { label: "永续（+资金费率）", value: "perp" },
];

const STRATEGY_FAMILY_OPTIONS = [
  { label: "规则策略", value: "rules" },
  { label: "ML 时序", value: "ml" },
  { label: "因子策略", value: "factor" },
];

const STRATEGY_FAMILY: Record<string, "rules" | "ml" | "factor"> = {
  ml_temporal: "ml",
  ml_temporal_knn: "ml",
  ml_temporal_tree: "ml",
  ml_temporal_boosting: "ml",
  ml_temporal_ensemble: "ml",
  ml_temporal_naive_bayes: "ml",
  ml_temporal_perceptron: "ml",
  ml_temporal_ridge: "ml",
  ml_temporal_prior_blend: "ml",
  mined_factor: "factor",
  mined_factor_lr: "factor",
  mined_factor_rf: "factor",
  mined_factor_gbm: "factor",
  mined_factor_nn: "factor",
  mined_factor_ensemble: "factor",
  mined_factor_bayes: "factor",
  mined_factor_knn_factor: "factor",
  mined_factor_gp: "factor",
  mined_factor_llm: "factor",
};

const FALLBACK_STRATEGY_OPTIONS = [
  { label: "技术信号策略", value: "technical_signal" },
  { label: "均线交叉策略（Qbot 双均线）", value: "ma_crossover" },
  { label: "布林带均值回归（Qbot）", value: "boll_mean_reversion" },
  { label: "RSI均值回归策略", value: "rsi_mean_reversion" },
  { label: "MACD策略", value: "macd" },
  { label: "MACD 金叉死叉（Qbot）", value: "macd_crossover" },
  { label: "ADX+MACD 趋势（Qbot）", value: "adx_macd_trend" },
  { label: "布林带收缩策略", value: "bollinger_squeeze" },
  { label: "买入持有基准", value: "buy_and_hold" },
  { label: "ML 时序 Logistic 分类", value: "ml_temporal" },
  { label: "ML 时序 KNN 分类", value: "ml_temporal_knn" },
  { label: "ML 时序树集成", value: "ml_temporal_tree" },
  { label: "ML 时序梯度提升", value: "ml_temporal_boosting" },
  { label: "ML 时序投票集成", value: "ml_temporal_ensemble" },
  { label: "ML 时序朴素贝叶斯", value: "ml_temporal_naive_bayes" },
  { label: "ML 时序感知机", value: "ml_temporal_perceptron" },
  { label: "ML 时序 Ridge 线性", value: "ml_temporal_ridge" },
  { label: "ML 时序动量先验混合", value: "ml_temporal_prior_blend" },
  { label: "因子策略（先挖掘）", value: "mined_factor" },
  { label: "因子策略 - 线性回归", value: "mined_factor_lr" },
  { label: "因子策略 - 随机森林", value: "mined_factor_rf" },
  { label: "因子策略 - 梯度提升", value: "mined_factor_gbm" },
  { label: "因子策略 - 神经网络", value: "mined_factor_nn" },
  { label: "因子策略 - 集成模型", value: "mined_factor_ensemble" },
  { label: "因子策略 - 贝叶斯模型", value: "mined_factor_bayes" },
  { label: "因子策略 - KNN 模型", value: "mined_factor_knn_factor" },
  { label: "因子策略 - 遗传规划", value: "mined_factor_gp" },
  { label: "因子策略 - LLM 智能因子", value: "mined_factor_llm" },
  { label: "资金费率套利策略", value: "funding_rate" },
];

function mergeStrategyOptions(items: { label: string; value: string }[]) {
  const merged = new Map(FALLBACK_STRATEGY_OPTIONS.map((item) => [item.value, item]));
  for (const item of items) {
    merged.set(item.value, item);
  }
  return Array.from(merged.values());
}

function tsToDate(ts: number): string {
  return tsToChartDay(ts);
}

function chartCandlesToCurve(payload: RollingBacktestPayload | null): CurvePoint[] {
  if (payload?.chart_candles?.length) {
    return payload.chart_candles.map((candle) => ({
      date: candle.date ?? tsToChartDay(candle.ts),
      ts: candle.ts,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      equity: 100,
    }));
  }
  return equityToCurve(payload);
}

function equityToCurve(payload: RollingBacktestPayload | null): CurvePoint[] {
  if (!payload?.equity_curve?.length) {
    return [];
  }
  const curve = payload.equity_curve.map((point) => ({
    date: tsToDate(point.ts),
    ts: point.ts,
    close: point.close,
    equity: point.equity,
  }));
  return mergeTradeTimesIntoCurve(curve, payload.trades ?? []);
}

function rollingTradesToChartTrades(trades: RollingTrade[]): Trade[] {
  return trades.flatMap((trade) => {
    const entryAction = trade.direction === "LONG" ? "BUY" : "SELL";
    const exitAction = trade.direction === "LONG" ? "SELL" : "BUY";
    return [
      { date: tsToDate(trade.entryTs), action: entryAction, price: trade.entryPrice },
      { date: tsToDate(trade.exitTs), action: exitAction, price: trade.exitPrice },
    ];
  });
}

type BacktestSectionKey = "overview" | "chart" | "compare" | "validation" | "trades";

const BACKTEST_SECTIONS: {
  key: BacktestSectionKey;
  index: string;
  label: string;
  group: string;
  description: string;
}[] = [
  { key: "overview", index: "01", label: "读结论", group: "本次实验", description: "收益、回撤、是否继续" },
  { key: "chart", index: "02", label: "看过程", group: "本次实验", description: "K 线、权益曲线、买卖点" },
  { key: "trades", index: "03", label: "查交易", group: "本次实验", description: "每笔入场、出场、盈亏原因" },
  { key: "compare", index: "04", label: "做对照", group: "横向比较", description: "同一数据下比较策略" },
  { key: "validation", index: "05", label: "验稳健", group: "复核工具", description: "窗口、WFO、PBO、组合" },
];

interface TradeRow {
  key: string;
  direction: string;
  entry: string;
  exit: string;
  pnl: number;
  reason: string;
  bars: number;
}

function initialBacktestSection(): BacktestSectionKey {
  if (typeof window === "undefined") {
    return "overview";
  }
  const hash = window.location.hash.replace("#", "");
  const fromHash: Record<string, BacktestSectionKey> = {
    "backtest-results": "overview",
    "backtest-chart": "chart",
    "backtest-comparison": "compare",
    "backtest-validation": "validation",
    "backtest-trades": "trades",
  };
  return fromHash[hash] ?? "overview";
}

function toTradeRows(trades: RollingTrade[]): TradeRow[] {
  return trades.map((trade, index) => ({
    key: String(index),
    direction: trade.direction,
    entry: `${tsToDate(trade.entryTs)} @ ${trade.entryPrice.toFixed(4)}`,
    exit: `${tsToDate(trade.exitTs)} @ ${trade.exitPrice.toFixed(4)}`,
    pnl: trade.pnlPct,
    reason: trade.exitReason,
    bars: trade.barsHeld,
  }));
}

export default function BacktestsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [strategies, setStrategies] = useState<{ label: string; value: string }[]>([]);
  const [strategyFamily, setStrategyFamily] = useState<"rules" | "ml" | "factor">("rules");
  const [strategy, setStrategy] = useState("ma_crossover");
  const [symbol, setSymbol] = useState("BTC-USDT");
  const [refreshLive, setRefreshLive] = useState(false);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(5);
  const [trailingStop, setTrailingStop] = useState(0);
  const [maxHoldBars, setMaxHoldBars] = useState(0);
  const [barLimit, setBarLimit] = useState(120);
  const [result, setResult] = useState<RollingBacktestPayload | null>(null);
  const [investmentGate, setInvestmentGate] = useState<InvestmentGatePayload | null>(null);
  const [compare, setCompare] = useState<BacktestComparePayload | null>(null);
  const [windows, setWindows] = useState<BacktestWindowsPayload | null>(null);
  const [walkForward, setWalkForward] = useState<BacktestWalkForwardPayload | null>(null);
  const [robustness, setRobustness] = useState<BacktestRobustnessPayload | null>(null);
  const [cpcv, setCpcv] = useState<BacktestCpcvPayload | null>(null);
  const [portfolio, setPortfolio] = useState<BacktestPortfolioPayload | null>(null);
  const [costPreset, setCostPreset] = useState<"teaching" | "realistic" | "perp">("teaching");
  const [wfoLoading, setWfoLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [wfoWindows, setWfoWindows] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [factorHandoff, setFactorHandoff] = useState<FactorHandoff | null>(() => loadFactorHandoff());
  const [runFeedback, setRunFeedback] = useState<{
    type: "success" | "info" | "warning" | "error";
    message: string;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<BacktestSectionKey>(() => initialBacktestSection());

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.replace("#", "") === "factor-research") {
      navigate("/factor-mining", { replace: true });
    }
  }, [navigate]);

  const applyFactorHandoff = useCallback((handoff: FactorHandoff) => {
    setFactorHandoff(handoff);
    setStrategyFamily("factor");
    setStrategy("mined_factor");
    setSymbol(handoff.symbol);
    setBarLimit(handoff.limit);
    setStopLoss(handoff.stopLoss);
    setTakeProfit(handoff.takeProfit);
    setTrailingStop(handoff.trailingStop);
    setMaxHoldBars(handoff.maxHoldBars);
  }, []);

  useEffect(() => {
    fetchInvestmentGate()
      .then(setInvestmentGate)
      .catch(() => setInvestmentGate(null));
  }, []);

  useEffect(() => {
    fetchBacktestStrategies()
      .then((items) => {
        setStrategies(
          mergeStrategyOptions(items.map((item) => ({ label: item.displayName, value: item.name }))),
        );
      })
      .catch(() => {
        setStrategies(FALLBACK_STRATEGY_OPTIONS);
      });
  }, []);

  useEffect(() => {
    if (strategyFamily === "ml") {
      setStrategy("ml_temporal");
      return;
    }
    if (strategyFamily === "factor") {
      setStrategy("mined_factor");
      return;
    }
    if (STRATEGY_FAMILY[strategy] && STRATEGY_FAMILY[strategy] !== "rules") {
      setStrategy("ma_crossover");
    }
  }, [strategyFamily]);

  const visibleStrategies = useMemo(
    () =>
      strategies.filter((item) => {
        const family = STRATEGY_FAMILY[item.value] ?? "rules";
        return family === strategyFamily;
      }),
    [strategies, strategyFamily],
  );

  const runMinedFactorExperiment = useCallback(
    async (handoff: FactorHandoff) => {
      setLoading(true);
      setLoadError(null);
      setRunFeedback({ type: "info", message: "挖掘因子回测运行中：正在送入滚动回测引擎。" });
      setActiveSection("overview");
      try {
        const payload = await runMinedFactorBacktest({
          backtestSpec: handoff.backtestSpec,
          symbol: handoff.symbol,
          limit: handoff.limit,
          stopLoss: handoff.stopLoss,
          takeProfit: handoff.takeProfit,
          trailingStop: handoff.trailingStop,
          maxHoldBars: handoff.maxHoldBars,
          refresh: refreshLive && handoff.symbol !== "WEB3-DEMO/USDT",
        });
        const [comparePayload, windowPayload] = await Promise.all([
          fetchBacktestCompare({
            symbol: handoff.symbol,
            stopLoss: handoff.stopLoss,
            takeProfit: handoff.takeProfit,
            trailingStop: handoff.trailingStop,
            maxHoldBars: handoff.maxHoldBars,
            limit: handoff.limit,
            costPreset,
          }),
          fetchBacktestWindows({
            strategy: "mined_factor",
            symbol: handoff.symbol,
            stopLoss: handoff.stopLoss,
            takeProfit: handoff.takeProfit,
            windows: 3,
            limit: handoff.limit,
            costPreset,
          }),
        ]);
        setResult(payload);
        setCompare(comparePayload);
        setWindows(windowPayload);
        setStrategy("mined_factor");
        setRunFeedback({
          type: "success",
          message: `挖掘因子回测完成：收益 ${payload.total_return_pct.toFixed(2)}% · 交易 ${payload.total_trades} 笔`,
        });
        message.success(`挖掘因子回测：${payload.total_return_pct.toFixed(2)}%`);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "挖掘因子回测失败";
        setLoadError(detail);
        setRunFeedback({ type: "error", message: detail });
        message.error(detail);
      } finally {
        setLoading(false);
      }
    },
    [costPreset, refreshLive],
  );

  const runBacktest = useCallback(async () => {
    if ((STRATEGY_FAMILY[strategy] ?? strategyFamily) === "factor") {
      const handoff = factorHandoff ?? loadFactorHandoff();
      if (!handoff) {
        const detail = "尚未交接领先因子。请先在「因子挖掘」运行挖掘并点击「送入策略回测」。";
        setLoadError(detail);
        setRunFeedback({ type: "warning", message: detail });
        message.warning(detail);
        return;
      }
      applyFactorHandoff(handoff);
      await runMinedFactorExperiment(handoff);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setRunFeedback({ type: "info", message: "实验运行中：正在生成回测、策略比较和窗口稳定性结果。" });
    setActiveSection("overview");
    try {
      const payload = await runRollingBacktest({
        strategy,
        symbol,
        stopLoss,
        takeProfit,
        trailingStop,
        maxHoldBars,
        limit: barLimit,
        costPreset,
        refresh: refreshLive && symbol !== "WEB3-DEMO/USDT",
      });
      const [comparePayload, windowPayload] = await Promise.all([
        fetchBacktestCompare({
          symbol,
          stopLoss,
          takeProfit,
          trailingStop,
          maxHoldBars,
          limit: barLimit,
          costPreset,
        }),
        fetchBacktestWindows({
          strategy,
          symbol,
          stopLoss,
          takeProfit,
          windows: 3,
          limit: barLimit,
          costPreset,
        }),
      ]);
      setResult(payload);
      setCompare(comparePayload);
      setWindows(windowPayload);
      setRunFeedback({
        type: "success",
        message: `回测完成：${payload.strategy} · 收益 ${payload.total_return_pct.toFixed(2)}% · 交易 ${payload.total_trades} 笔`,
      });
      message.success(
        `回测完成：${payload.strategy} · 收益 ${payload.total_return_pct.toFixed(2)}%`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : "回测失败";
      setLoadError(detail);
      setRunFeedback({ type: "error", message: detail });
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }, [
    applyFactorHandoff,
    barLimit,
    costPreset,
    factorHandoff,
    maxHoldBars,
    refreshLive,
    runMinedFactorExperiment,
    stopLoss,
    strategy,
    strategyFamily,
    symbol,
    takeProfit,
    trailingStop,
  ]);

  const runWalkForward = useCallback(async () => {
    setWfoLoading(true);
    try {
      const payload = await fetchBacktestWalkForward({
        strategy,
        symbol,
        stopLoss,
        takeProfit,
        limit: barLimit,
        windows: wfoWindows,
        costPreset,
      });
      setWalkForward(payload);
      message.success(
        `Walk-forward 完成 · OOS Sharpe ${payload.out_of_sample_sharpe.toFixed(2)} · DSR ${(payload.dsr ?? 0).toFixed(2)}${payload.overfit_warning ? " · 过拟合警告" : ""}`,
      );
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Walk-forward 失败");
    } finally {
      setWfoLoading(false);
    }
  }, [barLimit, costPreset, stopLoss, strategy, symbol, takeProfit, wfoWindows]);

  const runAuditSuite = useCallback(async () => {
    setAuditLoading(true);
    try {
      const [robustnessPayload, cpcvPayload] = await Promise.all([
        fetchBacktestRobustness({
          strategy,
          symbol,
          stopLoss,
          takeProfit,
          limit: barLimit,
          costPreset,
        }),
        fetchBacktestCpcv({
          strategy,
          symbol,
          stopLoss,
          takeProfit,
          limit: barLimit,
          costPreset,
        }),
      ]);
      setRobustness(robustnessPayload);
      setCpcv(cpcvPayload);
      message.success(
        `审计完成 · 稳定性 ${(robustnessPayload.parameter_sensitivity.stability_score * 100).toFixed(0)}% · PBO ${(robustnessPayload.pbo.pbo * 100).toFixed(0)}%`,
      );
    } catch (err) {
      message.error(err instanceof Error ? err.message : "稳健性审计失败");
    } finally {
      setAuditLoading(false);
    }
  }, [barLimit, costPreset, stopLoss, strategy, symbol, takeProfit]);

  const runPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const payload = await fetchBacktestPortfolio({
        strategy,
        stopLoss,
        takeProfit,
        limit: barLimit,
      });
      setPortfolio(payload);
      message.success(
        `组合回测完成 · 等权均收益 ${payload.equal_weight_leg_avg_return_pct.toFixed(2)}%`,
      );
    } catch (err) {
      message.error(err instanceof Error ? err.message : "组合回测失败");
    } finally {
      setPortfolioLoading(false);
    }
  }, [barLimit, stopLoss, strategy, takeProfit]);

  useEffect(() => {
    const fromFactor = searchParams.get("from") === "factor-mining";
    const handoff = loadFactorHandoff();
    if (fromFactor && handoff) {
      applyFactorHandoff(handoff);
      void runMinedFactorExperiment(handoff);
      return;
    }
    void runBacktest();
    // Initial load only; parameter changes rerun via the action button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceCurve = useMemo(() => chartCandlesToCurve(result), [result]);
  const asideCurve = useMemo(() => equityToCurve(result), [result]);
  const rollingTrades = useMemo(() => result?.trades ?? [], [result]);
  const chartTrades = useMemo(() => rollingTradesToChartTrades(rollingTrades), [rollingTrades]);
  const tradeRows = useMemo(() => toTradeRows(result?.trades ?? []), [result]);

  const tradeColumns: ColumnsType<TradeRow> = [
    { title: "方向", dataIndex: "direction", width: 72 },
    { title: "入场", dataIndex: "entry" },
    { title: "出场", dataIndex: "exit" },
    {
      title: "PnL",
      dataIndex: "pnl",
      width: 90,
      render: (value: number) => (
        <MonoNumber value={value} kind="pct" tone={value >= 0 ? "profit" : "loss"} showSign />
      ),
    },
    { title: "原因", dataIndex: "reason", width: 100 },
    { title: "持仓K", dataIndex: "bars", width: 72 },
  ];

  const windowLabel = result
    ? `${result.symbol} · ${result.kline_type} · ${result.total_candles} 根日K`
    : "—";

  const chartRangeLabel = useMemo(() => {
    if (!result) {
      return windowLabel;
    }
    const from = result.data_from ?? result.chart_candles?.[0]?.date;
    const through = result.data_through ?? result.chart_candles?.at(-1)?.date;
    const source = result.data_source ?? "—";
    const saved = result.data_saved_at?.slice(0, 10) ?? "";
    const warmup = result.warmup_bars ?? 0;
    const sourceLabel =
      source === "live"
        ? "实时拉取"
        : source === "teaching_sample"
          ? "教学 CSV"
          : source === "snapshot"
            ? "离线快照"
            : source;
    return `${from ?? "—"} → ${through ?? "—"} · ${sourceLabel}${saved ? ` · ${saved}` : ""} · 前 ${warmup} 根预热`;
  }, [result, windowLabel]);

  const selectedStrategyLabel = useMemo(
    () => strategies.find((item) => item.value === strategy)?.label ?? result?.strategy ?? strategy,
    [result?.strategy, strategies, strategy],
  );
  const dataModeLabel = refreshLive && symbol !== "WEB3-DEMO/USDT" ? "实时刷新" : "离线快照";
  const runStateLabel = loading ? "运行中" : result ? "已完成" : "待运行";
  const refreshDisabled = loading || symbol === "WEB3-DEMO/USDT";
  const resultVerdict = useMemo(() => {
    if (!result) {
      return {
        tone: "neutral" as const,
        label: "等待实验",
        detail: "先运行回测，生成权益曲线、交易明细和风险诊断。",
      };
    }
    if ((result.max_drawdown_pct ?? 0) > 18 || (result.sharpe_ratio ?? 0) < 0) {
      return {
        tone: "loss" as const,
        label: "风险偏高",
        detail: "优先查看回撤、止损假设和窗口稳定性，再考虑样本外验证。",
      };
    }
    if ((result.alpha_pct ?? 0) > 0 && (result.sharpe_ratio ?? 0) >= 0.5) {
      return {
        tone: "profit" as const,
        label: "通过初筛",
        detail: "可以继续跑 Walk-forward、稳健性审计和组合验证。",
      };
    }
    return {
      tone: "neutral" as const,
      label: "需要复核",
      detail: "收益或风险优势不明显，建议比较策略、成本假设和因子解释。",
    };
  }, [result]);

  return (
    <TradingPageShell
      eyebrow="Research Workbench"
      title="策略回测实验台"
      description="按研究顺序组织：先配置并运行一次实验，再看证据、做对照，最后用稳健性工具决定是否继续研究。"
      actions={
        <div className="backtest-hero-actions">
          <StatusPill tone={loading ? "neutral" : loadError ? "loss" : "profit"}>{runStateLabel}</StatusPill>
          <Button className="btn-gradient" type="primary" size="large" loading={loading} onClick={() => void runBacktest()}>
            <ReloadOutlined /> 运行实验
          </Button>
        </div>
      }
      aside={
        <QuantGlowCard
          title={<SectionHeader title="当前回测" description={windowLabel} />}
          badge={<StatusPill tone="profit">{loading ? "running" : "done"}</StatusPill>}
        >
          <TradingChart
            curve={asideCurve}
            rollingTrades={rollingTrades}
            trades={chartTrades}
            variant="compact"
          />
          <div className="trading-kv">
            <div>
              <span>收益</span>
              <strong>{(result?.total_return_pct ?? 0).toFixed(1)}%</strong>
            </div>
            <div>
              <span>最大回撤</span>
              <strong>{-(result?.max_drawdown_pct ?? 0).toFixed(1)}%</strong>
            </div>
          </div>
        </QuantGlowCard>
      }
    >
      {investmentGate ? (
        <QuantGlowCard
          className="investment-gate-card"
          title={
            <SectionHeader
              title={`投资准入策略 · ${investmentGate.strategy.name} v${investmentGate.strategy.version}`}
              description={`${investmentGate.evaluation.holdout.first_date} 至 ${investmentGate.evaluation.holdout.last_date} · ${investmentGate.strategy.allocation}`}
            />
          }
          badge={
            <StatusPill tone={investmentGate.passed ? "profit" : "loss"}>
              {investmentGate.passed ? "研究准入通过" : "准入拒绝"}
            </StatusPill>
          }
        >
          <Alert
            type={investmentGate.passed ? "success" : "error"}
            showIcon
            message={
              investmentGate.passed
                ? "已通过全部历史研究门槛；不代表实盘授权"
                : "至少一项投资研究门槛未通过"
            }
            description={`准入决定 ${investmentGate.decision} · 实盘授权：${investmentGate.live_trading_authorized ? "是" : "否"}`}
          />
          <Alert
            className="investment-forward-alert"
            type={
              investmentGate.forward_validation.status === "FORWARD_PASSED"
                ? "success"
                : investmentGate.forward_validation.status.startsWith("BLOCKED") ||
                    investmentGate.forward_validation.status === "FORWARD_FAILED"
                  ? "error"
                  : "info"
            }
            showIcon
            message={`前向纸面验证 · ${investmentGate.forward_validation.status}`}
            description={`冻结日 ${investmentGate.forward_validation.plan.cutoff_date} · 新样本 ${investmentGate.forward_validation.windows[0]?.bars ?? 0}/${investmentGate.forward_validation.plan.minimum_bars} 根 · 当前决定 ${investmentGate.forward_validation.decision}`}
          />
          <div className="trading-metric-grid">
            <MetricTile
              label="样本外收益"
              value={`${investmentGate.evaluation.portfolio.total_return_pct.toFixed(2)}%`}
              subtle={`基准 ${investmentGate.evaluation.benchmark.total_return_pct.toFixed(2)}%`}
              tone="profit"
            />
            <MetricTile
              label="样本外 Sharpe"
              value={investmentGate.evaluation.portfolio.sharpe_ratio.toFixed(2)}
              subtle="门槛 ≥ 0.60"
              tone="neutral"
            />
            <MetricTile
              label="最大回撤"
              value={`${investmentGate.evaluation.portfolio.max_drawdown_pct.toFixed(2)}%`}
              subtle="门槛 ≤ 15%"
              tone="loss"
            />
            <MetricTile
              label="盈利覆盖"
              value={`${investmentGate.evaluation.portfolio.profitable_assets}/${investmentGate.evaluation.portfolio.asset_count}`}
              subtle={`波动 ${investmentGate.evaluation.portfolio.annualized_volatility_pct.toFixed(2)}% · 平均敞口 ${(investmentGate.evaluation.portfolio.average_gross_exposure * 100).toFixed(1)}%`}
              tone="profit"
            />
          </div>
          <div className="investment-gate-checks">
            {investmentGate.gates.map((gate) => (
              <span key={gate.gate} className={gate.passed ? "pass" : "fail"}>
                {gate.passed ? "PASS" : "FAIL"} · {gate.gate}
              </span>
            ))}
          </div>
        </QuantGlowCard>
      ) : null}
      <section className="backtest-command-center">
        <QuantGlowCard
          className="backtest-config-panel"
          title={
            <SectionHeader
              title="1. 配置这次实验"
              description="规则/ML 策略在此直接运行；因子策略消费「因子挖掘」交接的领先因子，再做对照与稳健性审计。"
            />
          }
        >
          <div className="backtest-form-grid">
            <label className="backtest-field backtest-field-wide">
              <span>模型族</span>
              <Segmented
                block
                value={strategyFamily}
                onChange={(value) => {
                  const next = value as "rules" | "ml" | "factor";
                  setStrategyFamily(next);
                  if (next === "factor") {
                    const handoff = factorHandoff ?? loadFactorHandoff();
                    if (handoff) {
                      applyFactorHandoff(handoff);
                    }
                  }
                }}
                options={STRATEGY_FAMILY_OPTIONS}
                disabled={loading}
              />
            </label>
            {strategyFamily === "factor" ? (
              <div className="backtest-field backtest-field-wide">
                {factorHandoff ? (
                  <Alert
                    type="success"
                    showIcon
                    message={`已交接：${factorHandoff.label ?? "领先因子"}`}
                    description={
                      <>
                        {(factorHandoff.method ?? "factor").toUpperCase()}
                        {factorHandoff.testIc != null ? ` · 测试 IC ${factorHandoff.testIc.toFixed(3)}` : ""}
                        {" · "}
                        {factorHandoff.symbol} · {factorHandoff.limit} 根。可直接运行实验；重新挖掘请回{" "}
                        <Link to="/factor-mining">因子挖掘</Link>。
                      </>
                    }
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message="需要先从因子挖掘交接"
                    description={
                      <>
                        请先在 <Link to="/factor-mining">因子挖掘</Link> 生成领先因子并点击「送入策略回测」。本页不负责挖因子。
                      </>
                    }
                  />
                )}
              </div>
            ) : null}
            <label className="backtest-field">
              <span>策略模型</span>
              <Select
                value={strategy}
                onChange={(value) => {
                  setStrategy(value);
                  setStrategyFamily(STRATEGY_FAMILY[value] ?? "rules");
                }}
                options={visibleStrategies.length ? visibleStrategies : strategies}
                disabled={loading}
              />
            </label>
            <label className="backtest-field">
              <span>标的资产</span>
              <Select value={symbol} onChange={setSymbol} options={SYMBOL_OPTIONS} disabled={loading} />
            </label>
            <label className="backtest-field">
              <span>K 线数量</span>
              <Select value={barLimit} onChange={setBarLimit} options={LIMIT_OPTIONS} disabled={loading} />
            </label>
            <label className="backtest-field">
              <span>成本假设</span>
              <Select
                value={costPreset}
                onChange={(value) => setCostPreset(value as "teaching" | "realistic" | "perp")}
                options={COST_PRESET_OPTIONS}
                disabled={loading}
              />
            </label>
            <label className="backtest-field">
              <span>止损 %</span>
              <InputNumber min={0.5} max={20} step={0.5} value={stopLoss} onChange={(v) => setStopLoss(Number(v ?? 3))} />
            </label>
            <label className="backtest-field">
              <span>止盈 %</span>
              <InputNumber min={0.5} max={50} step={0.5} value={takeProfit} onChange={(v) => setTakeProfit(Number(v ?? 5))} />
            </label>
            <label className="backtest-field">
              <span>移动止损 %</span>
              <InputNumber min={0} max={20} step={0.5} value={trailingStop} onChange={(v) => setTrailingStop(Number(v ?? 0))} />
            </label>
            <label className="backtest-field">
              <span>最长持仓</span>
              <InputNumber min={0} max={500} step={1} value={maxHoldBars} onChange={(v) => setMaxHoldBars(Number(v ?? 0))} />
            </label>
            <label className="backtest-field">
              <span>WFO 窗口</span>
              <InputNumber min={2} max={5} value={wfoWindows} onChange={(v) => setWfoWindows(Number(v ?? 3))} />
            </label>
          </div>
          <div className="backtest-config-footer">
            <Checkbox
              checked={refreshLive}
              onChange={(event) => setRefreshLive(event.target.checked)}
              disabled={refreshDisabled}
            >
              拉取最新 K 线
            </Checkbox>
            <span>
              {strategyFamily === "factor"
                ? factorHandoff
                  ? "将使用已交接的领先因子回测"
                  : "尚未交接领先因子"
                : symbol === "WEB3-DEMO/USDT"
                  ? "教学样本固定，不支持实时刷新"
                  : "可使用快照或刷新最新行情"}
            </span>
            {strategyFamily === "factor" && !factorHandoff ? (
              <Button className="btn-gradient" type="primary" onClick={() => navigate("/factor-mining")}>
                前往因子挖掘
              </Button>
            ) : (
              <Button className="btn-gradient" type="primary" loading={loading} onClick={() => void runBacktest()}>
                <PlayCircleOutlined /> 运行实验
              </Button>
            )}
          </div>
          {runFeedback ? (
            <Alert
              type={runFeedback.type}
              showIcon
              message={runFeedback.message}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </QuantGlowCard>

        <QuantGlowCard
          className="backtest-summary-panel"
          title={<SectionHeader title="2. 本次实验状态" description={chartRangeLabel} />}
        >
          <div className="backtest-summary-stack">
            <div className="backtest-run-card">
              <span>{dataModeLabel}</span>
              <strong>{selectedStrategyLabel}</strong>
              <em>{symbol} · {barLimit} 根 · {costPreset}</em>
            </div>
            <div className="backtest-summary-metrics">
              <MetricTile label="总收益" value={result?.total_return_pct ?? 0} kind="pct" tone={(result?.total_return_pct ?? 0) >= 0 ? "profit" : "loss"} showSign />
              <MetricTile label="最大回撤" value={-(result?.max_drawdown_pct ?? 0)} kind="pct" tone="loss" showSign />
              <MetricTile label="Sharpe" value={result?.sharpe_ratio ?? 0} tone="neutral" precision={2} />
              <MetricTile label="Alpha" value={result?.alpha_pct ?? 0} kind="pct" tone={(result?.alpha_pct ?? 0) >= 0 ? "profit" : "loss"} showSign />
            </div>
            {loadError ? (
              <Alert type="warning" showIcon message={loadError} />
            ) : (
              <div className="backtest-disclaimer">
                历史模拟，不连接真实账户。风控拒绝与事件驱动轨迹见 <Link to="/risk">风控中心</Link>。
              </div>
            )}
          </div>
        </QuantGlowCard>
      </section>
      <nav className="backtest-section-nav backtest-section-banner" aria-label="回测步骤">
        {BACKTEST_SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeSection === item.key ? "is-active" : undefined}
            onClick={() => setActiveSection(item.key)}
          >
            <span>{item.index}</span>
            <b>{item.group}</b>
            <strong>{item.label}</strong>
            <em>{item.description}</em>
          </button>
        ))}
      </nav>

      <section className="trading-grid backtest-step-page">
        {activeSection === "overview" ? (<>
        <QuantGlowCard
          className="trading-span-12 result-overview-card"
          title={
            <SectionHeader
              title="01 · 结果总览"
              description="这是普通运行实验后的主结论；曲线和交易明细只是同一结果的展开。"
            />
          }
        >
          <div className="backtest-verdict-row">
            <div>
              <span>研究判读</span>
              <strong>{resultVerdict.label}</strong>
              <p>{resultVerdict.detail}</p>
            </div>
            <StatusPill tone={resultVerdict.tone}>{resultVerdict.label}</StatusPill>
          </div>
          <div className="trading-metric-grid">
            <MetricTile label="策略" value={result?.strategy ?? "—"} subtle={result?.engine ?? "web3-trading"} />
            <MetricTile label="Sharpe" value={result?.sharpe_ratio ?? 0} tone="neutral" precision={2} />
            <MetricTile label="胜率" value={result?.win_rate ?? 0} kind="plain" tone="neutral" subtle="%" />
            <MetricTile
              label="总收益"
              value={result?.total_return_pct ?? 0}
              kind="pct"
              tone="profit"
              showSign
            />
            <MetricTile
              label="最大回撤"
              value={-(result?.max_drawdown_pct ?? 0)}
              kind="pct"
              tone="loss"
              showSign
            />
            <MetricTile label="交易数" value={result?.total_trades ?? 0} kind="qty" tone="neutral" />
            <MetricTile label="Calmar" value={result?.calmar_ratio ?? 0} tone="neutral" precision={2} />
            <MetricTile label="盈亏比" value={result?.profit_factor ?? 0} tone="neutral" precision={2} />
            <MetricTile label="超额收益" value={result?.alpha_pct ?? 0} kind="pct" tone={(result?.alpha_pct ?? 0) >= 0 ? "profit" : "loss"} showSign />
            <MetricTile label="暴露度" value={result?.exposure_pct ?? 0} kind="pct" tone="neutral" />
            <MetricTile label="期望/笔" value={result?.expectancy_pct ?? 0} kind="pct" tone={(result?.expectancy_pct ?? 0) >= 0 ? "profit" : "loss"} showSign />
            <MetricTile label="尾部比" value={result?.tail_ratio ?? 0} tone="neutral" precision={2} />
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-12"
          title={
            <SectionHeader
              title="交易质量诊断"
              description="Trade analyzer / portfolio stats：胜负分布、连续亏损、基准超额与尾部风险"
            />
          }
        >
          <div className="trading-metric-grid">
            <MetricTile label="基准收益" value={result?.benchmark_return_pct ?? 0} kind="pct" tone="neutral" showSign />
            <MetricTile label="Alpha" value={result?.alpha_pct ?? 0} kind="pct" tone={(result?.alpha_pct ?? 0) >= 0 ? "profit" : "loss"} showSign />
            <MetricTile label="平均盈利" value={result?.avg_win_pct ?? 0} kind="pct" tone="profit" showSign />
            <MetricTile label="平均亏损" value={result?.avg_loss_pct ?? 0} kind="pct" tone="loss" showSign />
            <MetricTile label="Payoff" value={result?.payoff_ratio ?? 0} tone="neutral" precision={2} />
            <MetricTile label="Omega" value={result?.omega_ratio ?? 0} tone="neutral" precision={2} />
            <MetricTile label="恢复因子" value={result?.recovery_factor ?? 0} tone="neutral" precision={2} />
            <MetricTile label="MC 5%收益" value={result?.monte_carlo_95 ?? 0} kind="pct" tone={(result?.monte_carlo_95 ?? 0) >= 0 ? "profit" : "loss"} showSign />
            <MetricTile label="连胜" value={result?.max_consecutive_wins ?? 0} kind="qty" tone="profit" />
            <MetricTile label="连亏" value={result?.max_consecutive_losses ?? 0} kind="qty" tone="loss" />
          </div>
        </QuantGlowCard>

        </>) : null}
        {activeSection === "chart" ? (<>
        <QuantGlowCard
          id="backtest-chart"
          className="trading-span-12"
          title={
            <SectionHeader
              title="02 · 过程证据"
              description={chartRangeLabel}
            />
          }
        >
          {loadError && <Alert type="warning" message={loadError} showIcon style={{ marginBottom: 14 }} />}
          <div className="trading-kv" style={{ marginBottom: 10, fontSize: 12, color: "var(--qa-text-2)" }}>
            <span>日 K · 左轴权益 / 右轴价格</span>
            <span style={{ marginLeft: 16 }}>▲ 买 / ● 平仓 · 滚轮缩放 · 拖动平移</span>
          </div>
          <BacktestComboChart
            curve={priceCurve}
            equityCurve={result?.equity_curve ?? []}
            trades={rollingTrades}
            height={420}
          />
        </QuantGlowCard>

        </>) : null}
        {activeSection === "compare" ? (<>
        <QuantGlowCard
          id="backtest-comparison"
          className="trading-span-12"
          title={
            <SectionHeader
              title="04 · 策略对照"
              description={`统一样本 · 领先 ${compare?.leader ?? "—"} · 落后 ${compare?.laggard ?? "—"}`}
            />
          }
        >
          <Table
            className="trading-ant-table"
            loading={loading}
            pagination={false}
            size="small"
            rowKey="strategy_key"
            dataSource={compare?.strategies ?? []}
            columns={[
              { title: "策略", dataIndex: "strategy" },
              {
                title: "收益",
                dataIndex: "total_return_pct",
                render: (value: number) => (
                  <MonoNumber value={value} kind="pct" tone={value >= 0 ? "profit" : "loss"} showSign />
                ),
              },
              {
                title: "回撤",
                dataIndex: "max_drawdown_pct",
                render: (value: number) => (
                  <MonoNumber value={-value} kind="pct" tone="loss" showSign />
                ),
              },
              { title: "Sharpe", dataIndex: "sharpe_ratio", render: (v: number) => v.toFixed(2) },
              { title: "交易数", dataIndex: "total_trades", width: 80 },
            ]}
          />
        </QuantGlowCard>

        </>) : null}
        {activeSection === "validation" ? (<>
        <QuantGlowCard
          id="backtest-windows"
          className="trading-span-12"
          title={
            <SectionHeader
              title="05 · 窗口稳定性"
              description={`${windows?.strategy ?? "—"} · ${windows?.positive_windows ?? 0}/${windows?.num_windows ?? 0} 窗口为正 · ${windows?.stable ? "相对稳定" : "不稳定"}`}
            />
          }
        >
          <Table
            className="trading-ant-table"
            loading={loading}
            pagination={false}
            size="small"
            rowKey="window"
            dataSource={windows?.windows ?? []}
            columns={[
              { title: "窗口", dataIndex: "window", width: 72 },
              { title: "K 数", dataIndex: "bars", width: 72, render: (v: number | undefined, row) => v ?? row.candles ?? "—" },
              {
                title: "收益",
                dataIndex: "total_return_pct",
                render: (value: number) => (
                  <MonoNumber value={value} kind="pct" tone={value >= 0 ? "profit" : "loss"} showSign />
                ),
              },
              {
                title: "回撤",
                dataIndex: "max_drawdown_pct",
                render: (value: number) => (
                  <MonoNumber value={-value} kind="pct" tone="loss" showSign />
                ),
              },
              { title: "交易数", dataIndex: "total_trades", width: 80 },
            ]}
          />
        </QuantGlowCard>

        <QuantGlowCard
          id="backtest-validation"
          className="trading-span-12"
          title={
            <SectionHeader
              title="05B · 样本外验证"
              description={
                walkForward
                  ? `样本内 Sharpe ${walkForward.in_sample_sharpe.toFixed(2)} · 样本外 ${walkForward.out_of_sample_sharpe.toFixed(2)} · DSR ${(walkForward.dsr ?? 0).toFixed(2)} · 试验 ${walkForward.num_trials ?? 0} 次`
                  : "训练窗网格搜参 → 样本外验证 · 点击右侧按钮运行"
              }
              action={
                <Button
                  className="card-run-button"
                  type="primary"
                  loading={wfoLoading}
                  onClick={() => void runWalkForward()}
                >
                  启动 Walk-forward
                </Button>
              }
            />
          }
          badge={
            walkForward?.overfit_warning ? (
              <StatusPill tone="loss">过拟合风险</StatusPill>
            ) : walkForward ? (
              <StatusPill tone="profit">OOS OK</StatusPill>
            ) : undefined
          }
        >
          {walkForward ? (
            <>
              <div className="trading-kv" style={{ marginBottom: 10, fontSize: 12 }}>
                <div>
                  <span style={{ color: "var(--qa-text-2)" }}>最优参数 </span>
                  <code>{JSON.stringify(walkForward.best_params)}</code>
                </div>
              </div>
              <Table
                className="trading-ant-table"
                loading={wfoLoading}
                pagination={false}
                size="small"
                rowKey="window"
                dataSource={walkForward.windows ?? []}
                columns={[
                  { title: "窗", dataIndex: "window", width: 56 },
                  { title: "训练", dataIndex: "trainSize", width: 72 },
                  { title: "OOS", dataIndex: "testSize", width: 72 },
                  { title: "IS Sharpe", dataIndex: "inSampleSharpe", render: (v: number) => v.toFixed(2) },
                  { title: "OOS Sharpe", dataIndex: "outOfSampleSharpe", render: (v: number) => v.toFixed(2) },
                  {
                    title: "OOS 收益",
                    dataIndex: "outOfSampleReturn",
                    render: (value: number) => (
                      <MonoNumber value={value} kind="pct" tone={value >= 0 ? "profit" : "loss"} showSign />
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <Alert type="info" showIcon message="尚未运行 Walk-forward" description="与窗口稳定性不同：此处会在训练段搜索 param_grid 最优 Sharpe，再在样本外段检验。" />
          )}
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-12"
          title={
            <SectionHeader
              title="05C · 稳健性审计（PBO + 参数敏感性 + CPCV）"
              description={
                robustness
                  ? `稳定性 ${(robustness.parameter_sensitivity.stability_score * 100).toFixed(0)}% · PBO ${(robustness.pbo.pbo * 100).toFixed(0)}% · CPCV 盈利路径 ${(cpcv?.cpcv.profitable_paths_pct ?? 0).toFixed(0)}%`
                  : "点击右侧按钮运行参数扰动、过拟合概率与组合 OOS 路径"
              }
              action={
                <Button
                  className="card-run-button"
                  loading={auditLoading}
                  onClick={() => void runAuditSuite()}
                >
                  启动审计
                </Button>
              }
            />
          }
          badge={
            robustness?.verdict === "pass" ? (
              <StatusPill tone="profit">PASS</StatusPill>
            ) : robustness ? (
              <StatusPill tone="loss">WARN</StatusPill>
            ) : undefined
          }
        >
          {robustness ? (
            <div className="trading-kv" style={{ fontSize: 12 }}>
              <div>
                <span>参数稳定性</span>
                <strong>{(robustness.parameter_sensitivity.stability_score * 100).toFixed(1)}%</strong>
              </div>
              <div>
                <span>PBO</span>
                <strong>{(robustness.pbo.pbo * 100).toFixed(1)}%</strong>
              </div>
              <div>
                <span>CPCV 中位 Sharpe</span>
                <strong>{(cpcv?.cpcv.sharpe_p50 ?? 0).toFixed(2)}</strong>
              </div>
              <div>
                <span>成本预设</span>
                <strong>{robustness.cost_preset ?? costPreset}</strong>
              </div>
            </div>
          ) : (
            <Alert type="info" showIcon message="尚未运行稳健性审计" description="包含 ±20% 参数扰动、块级 PBO 与教学版 CPCV 分布。" />
          )}
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-12"
          title={
            <SectionHeader
              title="05D · 等权组合（教学三 leg）"
              description={
                portfolio
                  ? `均收益 ${portfolio.equal_weight_leg_avg_return_pct.toFixed(2)}% · 日收益加总 ${portfolio.equal_weight_daily_return_sum_pct.toFixed(2)}%`
                  : "基于 data/prices.csv 派生三 leg · 点击右侧按钮运行"
              }
              action={
                <Button
                  className="card-run-button"
                  loading={portfolioLoading}
                  onClick={() => void runPortfolio()}
                >
                  启动组合回测
                </Button>
              }
            />
          }
        >
          {portfolio ? (
            <>
              <Table
                className="trading-ant-table"
                loading={portfolioLoading}
                pagination={false}
                size="small"
                rowKey="symbol"
                dataSource={portfolio.legs ?? []}
                columns={[
                  { title: "Leg", dataIndex: "symbol" },
                  {
                    title: "权重",
                    dataIndex: "weight",
                    width: 72,
                    render: (v: number) => `${(v * 100).toFixed(0)}%`,
                  },
                  {
                    title: "收益",
                    dataIndex: "total_return_pct",
                    render: (value: number) => (
                      <MonoNumber value={value} kind="pct" tone={value >= 0 ? "profit" : "loss"} showSign />
                    ),
                  },
                  {
                    title: "回撤",
                    dataIndex: "max_drawdown_pct",
                    render: (value: number) => (
                      <MonoNumber value={-value} kind="pct" tone="loss" showSign />
                    ),
                  },
                  { title: "Sharpe", dataIndex: "sharpe_ratio", render: (v: number) => v.toFixed(2) },
                  { title: "交易", dataIndex: "total_trades", width: 72 },
                ]}
              />
              <Table
                className="trading-ant-table"
                style={{ marginTop: 12 }}
                pagination={false}
                size="small"
                rowKey={(row) => `${row.a}-${row.b}`}
                dataSource={portfolio.pair_correlations ?? []}
                columns={[
                  { title: "A", dataIndex: "a" },
                  { title: "B", dataIndex: "b" },
                  { title: "相关性", dataIndex: "correlation", render: (v: number) => v.toFixed(3) },
                ]}
              />
              {portfolio.diversification_hint ? (
                <Alert type="info" showIcon style={{ marginTop: 10 }} message={portfolio.diversification_hint} />
              ) : null}
            </>
          ) : (
            <Alert type="info" showIcon message="尚未运行组合回测" description="组合层与上方单标的回测独立；使用固定教学 CSV 三 leg，不依赖标的下拉框。" />
          )}
        </QuantGlowCard>

        </>) : null}
        {activeSection === "trades" ? (<>
        <QuantGlowCard
          id="backtest-trades"
          className="trading-span-12 trade-detail-card"
          title={<SectionHeader title="03 · 交易明细" description={`${tradeRows.length} 笔 · SL ${stopLoss}% / TP ${takeProfit}%`} />}
        >
          <Table
            className="trading-ant-table"
            columns={tradeColumns}
            dataSource={tradeRows}
            loading={loading}
            pagination={false}
            rowKey="key"
            scroll={{ x: 760 }}
            size="small"
          />
        </QuantGlowCard>

        </>) : null}
      </section>
    </TradingPageShell>
  );
}
