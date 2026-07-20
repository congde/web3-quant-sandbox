import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input, Select, Switch } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchKlineAnalysis, fetchMarketTickers, fetchResearchDraft, fetchResearchDraftGate, fetchWeb3News, pollLlmSignalAnalysis, submitLlmSignalAnalysis } from "../../api";
import { KlineAnalysisChart } from "../../components/charts/KlineAnalysisChart";
import { useReport } from "../../contexts/ReportContext";
import type { KlineAnalysisPayload, ResearchDraftGatePayload, ResearchDraftPayload, SignalAnalysisPayload, Web3NewsPayload } from "../../types";
import { QuantGlowCard, SectionHeader, SignalRow, StatusPill, TradingPageShell } from "../trading/TradingPageShell";
import KnowledgeGraphView from "./KnowledgeGraphView";
import MacroObservationView from "./MacroObservationView";
import { ResearchWorkspaceNav, type ResearchWorkspaceView } from "./ResearchWorkspaceNav";
import ThemeResearchView from "./ThemeResearchView";
import "./research.css";
import "./research-workspace.css";

const KLINE_TYPES = [
  { value: "15min", label: "15 分钟" },
  { value: "1hour", label: "1 小时" },
  { value: "4hour", label: "4 小时" },
  { value: "1day", label: "日线" },
];

const TF_LABELS: Record<string, string> = {
  "15min": "15min",
  "1hour": "1h",
  "4hour": "4h",
  "1day": "1day",
};

const LLM_MODELS = [
  { value: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { value: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { value: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner" },
];

function baseSymbol(raw: string) {
  const value = raw.trim().toUpperCase().replace(/\//g, "-");
  return value.includes("-") ? value.split("-")[0] : value.replace(/-.*/, "");
}

function formatPrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatPct(value?: number | null, scale = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = value * scale;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function signalTone(signal?: string) {
  const value = String(signal || "").toUpperCase();
  if (value.includes("BUY")) return "profit" as const;
  if (value.includes("SELL")) return "loss" as const;
  return "neutral" as const;
}

function trendTone(trendKey?: string) {
  if (!trendKey) return "neutral";
  if (trendKey.includes("bull")) return "bullish";
  if (trendKey.includes("bear")) return "bearish";
  return "neutral";
}

function draftDecisionLabel(decision?: string) {
  if (decision === "ready_for_human_review") return "可进入人工复核";
  if (decision === "downgrade_to_observation") return "降级为观察";
  if (decision === "stop_research") return "停止相关研究";
  return "等待门禁";
}

function draftDecisionTone(decision?: string) {
  if (decision === "ready_for_human_review") return "profit" as const;
  if (decision === "stop_research") return "loss" as const;
  return "neutral" as const;
}

function formatAgeHours(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(1)}h`;
}


function layerLabel(layer?: string | null) {
  if (layer === "snapshot") return "快照";
  if (layer === "fixture") return "教学样本";
  if (layer === "none") return "无可用层";
  return layer || "未知来源";
}

function datasetStateLabel(item: {
  complete?: boolean;
  stale?: boolean;
  active_layer?: string;
  snapshot_complete?: boolean;
  fixture_complete?: boolean;
}) {
  if (!item.snapshot_complete && item.fixture_complete) return "最新不完整";
  if (!item.complete) return "缺失";
  if (item.stale) return "已过期";
  if (item.active_layer !== "snapshot") return "回退";
  return "可用";
}

function datasetSourceNote(item: {
  active_layer?: string | null;
  active_source?: string | null;
  fixture_complete?: boolean;
  origin?: string | null;
  snapshot_complete?: boolean;
  snapshot_reason?: string | null;
}) {
  if (!item.snapshot_complete && item.fixture_complete) {
    return `最新快照未通过 · ${item.snapshot_reason || "字段不足"}`;
  }
  return item.origin ?? item.active_source ?? "来源未知";
}

function listOrNone(items?: string[]) {
  return items?.length ? items.join("、") : "无";
}

function prohibitedActionLabel(action: string) {
  if (action === "publish as final conclusion") return "发布为正式结论";
  if (action === "modify risk thresholds") return "修改风控阈值";
  if (action === "place live orders") return "触发真实下单";
  return action;
}


function datasetLabel(name: string) {
  const labels: Record<string, string> = {
    ai_picks: "AI 候选",
    sector_fund: "板块资金",
    token_fund: "币种资金",
    onchain: "链上状态",
    dex_trending: "DEX 热点",
    market_tickers: "行情报价",
    web3_news: "消息面",
    opportunity_scan: "机会扫描",
    market_candles: "K 线样本",
  };
  return labels[name] ?? name;
}

function affectedDraftSections(names: string[]) {
  const sections = new Set<string>();
  names.forEach((name) => {
    if (["market_tickers", "market_candles"].includes(name)) sections.add("市场状态");
    if (["sector_fund", "token_fund"].includes(name)) sections.add("资金面");
    if (name === "onchain") sections.add("链上状态");
    if (["dex_trending", "ai_picks", "opportunity_scan"].includes(name)) sections.add("热点与机会");
    if (name === "web3_news") sections.add("消息面");
  });
  return sections.size ? Array.from(sections) : ["可进入正文复核"];
}

function draftReviewAction(gate?: ResearchDraftGatePayload | null) {
  if (!gate) return "读取门禁状态";
  if (gate.missing?.length) return `补齐 ${gate.missing.map(datasetLabel).join("、")} 后再生成正文`;
  if (gate.stale?.length) return `先刷新 ${gate.stale.map(datasetLabel).join("、")}，相关段落只保留观察`;
  if (gate.fallback?.length) return `最新快照不完整，先补齐 ${gate.fallback.map(datasetLabel).join("、")}；暂用教学样本进入观察`;
  return "进入人工复核，不自动发布结论";
}

function draftSummaryText(gate?: ResearchDraftGatePayload | null) {
  if (!gate) return "正在读取快照证据、来源层和历史记录。";
  if (gate.missing?.length) return "存在缺失材料，相关正文段落必须停止生成，不能让模型补写。";
  if (gate.stale?.length) return "存在过期材料，行情和资金判断只能降级为观察清单，不能写成今日结论。";
  if (gate.fallback?.length) return "有最新抓取结果，但字段没有通过完整性检查；草稿只能标注为观察，不能伪装成实时结论。";
  return "材料完整且未过期；仍需人工复核后才能形成正式研究结论。";
}
export default function ResearchPage() {
  const { report, loading } = useReport();
  const research = report?.research;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspace = searchParams.get("view");
  const workspaceView: ResearchWorkspaceView = ["themes", "macro", "graph"].includes(String(requestedWorkspace))
    ? requestedWorkspace as ResearchWorkspaceView
    : "overview";

  const [symbolInput, setSymbolInput] = useState(searchParams.get("symbol") || "BTC");
  const [symbol, setSymbol] = useState(baseSymbol(searchParams.get("symbol") || "BTC"));
  const [klineType, setKlineType] = useState(searchParams.get("type") || "1hour");
  const [showMa20, setShowMa20] = useState(true);
  const [showMa60, setShowMa60] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showPriceLines, setShowPriceLines] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [llmModel, setLlmModel] = useState(searchParams.get("model") || "deepseek/deepseek-v4-pro");

  const [kline, setKline] = useState<KlineAnalysisPayload | null>(null);
  const [signal, setSignal] = useState<SignalAnalysisPayload | null>(null);
  const [web3News, setWeb3News] = useState<Web3NewsPayload | null>(null);
  const [draftGate, setDraftGate] = useState<ResearchDraftGatePayload | null>(null);
  const [researchDraft, setResearchDraft] = useState<ResearchDraftPayload | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [newsSourceFilter, setNewsSourceFilter] = useState("all");
  const [newsTopicFilter, setNewsTopicFilter] = useState("all");
  const [newsRiskOnly, setNewsRiskOnly] = useState(false);
  const [newsSearch, setNewsSearch] = useState("");
  const [tickerMeta, setTickerMeta] = useState<{
    price?: number;
    changeRate?: number;
    high?: number;
    low?: number;
    volValue?: number;
  } | null>(null);
  const [klineBusy, setKlineBusy] = useState(false);
  const [signalBusy, setSignalBusy] = useState(false);
  const [signalStatus, setSignalStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signalError, setSignalError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const pair = `${symbol}-USDT`;

  const stopSignalPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadKline = useCallback(async (refreshNews = false) => {
    setKlineBusy(true);
    setError(null);
    try {
      const [klinePayload, tickersPayload, newsPayload, draftGatePayload] = await Promise.all([
        fetchKlineAnalysis(pair, klineType),
        fetchMarketTickers(300),
        fetchWeb3News(80, { refresh: refreshNews }),
        fetchResearchDraftGate(24),
      ]);
      setKline(klinePayload);
      setWeb3News(newsPayload);
      setDraftGate(draftGatePayload);
      const row = (tickersPayload.tickers || []).find(
        (item) => String((item as { symbol?: string }).symbol || "").toUpperCase() === pair,
      ) as { last?: number; changeRate?: number; high?: number; low?: number; volValue?: number } | undefined;
      setTickerMeta(
        row
          ? {
              price: Number(row.last),
              changeRate: Number(row.changeRate),
              high: Number(row.high),
              low: Number(row.low),
              volValue: Number(row.volValue),
            }
          : {
              price: klinePayload.metrics?.latestClose,
              changeRate: (klinePayload.metrics?.candleChangeRatePct ?? 0) / 100,
            },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 K 线失败");
    } finally {
      setKlineBusy(false);
    }
  }, [pair, klineType]);

  const generateResearchDraft = useCallback(async () => {
    setDraftBusy(true);
    setDraftError(null);
    try {
      const payload = await fetchResearchDraft(symbol, klineType, 24);
      setResearchDraft(payload);
      if (payload.gate) {
        setDraftGate(payload.gate);
      }
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "生成研究草稿失败");
    } finally {
      setDraftBusy(false);
    }
  }, [symbol, klineType]);
  const loadLlmSignal = useCallback(async () => {
    stopSignalPoll();
    setSignalBusy(true);
    setSignalError(null);
    setSignalStatus(`正在提交 ${symbol} LLM 信号分析任务...`);
    try {
      const submit = await submitLlmSignalAnalysis(symbol, llmModel);
      if (submit.taskId) {
        let polls = 0;
        const runPoll = async () => {
          polls += 1;
          if (polls > 200) {
            stopSignalPoll();
            setSignalBusy(false);
            setSignalStatus(null);
            setSignalError("LLM 分析超时，请重试");
            return;
          }
          if (polls % 2 === 0) {
            setSignalStatus(`LLM 信号分析进行中（约 ${polls * 3}s）…`);
          }
          const result = await pollLlmSignalAnalysis(submit.taskId!);
          if (result.status === "done" && result.data) {
            stopSignalPoll();
            setSignal(result.data);
            setSignalBusy(false);
            setSignalStatus(null);
            return;
          }
          if (result.status === "failed") {
            stopSignalPoll();
            setSignalBusy(false);
            setSignalStatus(null);
            setSignalError(result.message || "LLM 分析失败");
          }
        };
        await runPoll();
        pollTimerRef.current = window.setInterval(() => {
          void runPoll();
        }, 3000);
        return;
      }
      if (submit.signal || submit.signalLabel) {
        setSignal(submit);
        setSignalStatus(null);
        setSignalBusy(false);
        return;
      }
      throw new Error(submit.message || "未收到 LLM 信号结果");
    } catch (err) {
      setSignalBusy(false);
      setSignalStatus(null);
      setSignalError(err instanceof Error ? err.message : "LLM 信号分析失败");
    }
  }, [llmModel, stopSignalPoll, symbol]);

  const applySymbol = useCallback(() => {
    const next = baseSymbol(symbolInput || "BTC");
    setSymbol(next);
    const params = new URLSearchParams(searchParams);
    params.set("symbol", next);
    params.set("type", klineType);
    params.set("model", llmModel);
    setSearchParams(params, { replace: true });
  }, [symbolInput, klineType, llmModel, searchParams, setSearchParams]);

  useEffect(() => {
    if (workspaceView !== "overview") return;
    void loadKline();
  }, [loadKline, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "overview") {
      stopSignalPoll();
      return undefined;
    }
    void loadLlmSignal();
    return () => stopSignalPoll();
  }, [loadLlmSignal, stopSignalPoll, workspaceView]);

  useEffect(() => {
    if (!autoRefresh || workspaceView !== "overview") return undefined;
    const timer = window.setInterval(() => {
      void loadLlmSignal();
    }, 120_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadLlmSignal, workspaceView]);

  const metrics = kline?.metrics;
  const verdict = kline?.verdict;
  const price = tickerMeta?.price ?? metrics?.latestClose;

  const trendBadges = useMemo(() => {
    const bundle = signal?.kline || {};
    return Object.entries(bundle).map(([tf, row]) => ({
      tf,
      label: TF_LABELS[tf] || tf,
      trend: row.trend,
      tone: trendTone(row.trendKey),
    }));
  }, [signal?.kline]);

  const topNewsAssets = useMemo(() => (web3News?.metrics?.top_assets || []).slice(0, 6), [web3News?.metrics?.top_assets]);
  const topNewsTopics = useMemo(() => (web3News?.metrics?.top_topics || []).slice(0, 6), [web3News?.metrics?.top_topics]);
  const newsSentimentTone = (web3News?.metrics?.sentiment_score ?? 0) >= 0 ? "research-positive" : "research-negative";
  const sourceOptions = useMemo(
    () => [
      { label: "全部来源", value: "all" },
      ...(web3News?.sources ?? [])
        .filter((source) => source.ok && source.id)
        .map((source) => ({ label: source.name ?? source.id ?? "source", value: source.id ?? "source" })),
    ],
    [web3News?.sources],
  );
  const topicOptions = useMemo(() => {
    const topicSet = new Set<string>();
    (web3News?.metrics?.top_topics ?? []).forEach(([topic]) => topicSet.add(topic));
    (web3News?.items ?? []).forEach((item) => (item.topics ?? []).forEach((topic) => topicSet.add(topic)));
    return [
      { label: "全部主题", value: "all" },
      ...Array.from(topicSet)
        .sort()
        .map((topic) => ({ label: topic, value: topic })),
    ];
  }, [web3News?.items, web3News?.metrics?.top_topics]);
  const filteredNewsItems = useMemo(() => {
    const query = newsSearch.trim().toLowerCase();
    return (web3News?.items ?? []).filter((item) => {
      if (newsSourceFilter !== "all" && item.source_id !== newsSourceFilter) return false;
      if (newsTopicFilter !== "all" && !(item.topics ?? []).includes(newsTopicFilter)) return false;
      if (newsRiskOnly && !item.risk_event) return false;
      if (!query) return true;
      const haystack = `${item.title} ${item.summary ?? ""} ${item.source ?? ""} ${(item.assets ?? []).join(" ")} ${(item.topics ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [newsRiskOnly, newsSearch, newsSourceFilter, newsTopicFilter, web3News?.items]);
  const sourceHealth = useMemo(() => {
    const sources = web3News?.sources ?? [];
    const okSources = sources.filter((source) => source.ok);
    return {
      ok: okSources.length,
      total: sources.length,
      failed: sources.filter((source) => !source.ok),
      top: okSources
        .slice()
        .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
        .slice(0, 3),
    };
  }, [web3News?.sources]);

  const draftDatasets = useMemo(() => draftGate?.datasets ?? [], [draftGate?.datasets]);
  const draftIssueCount = (draftGate?.stale?.length ?? 0) + (draftGate?.missing?.length ?? 0) + (draftGate?.fallback?.length ?? 0);
  const draftCleanCount = draftDatasets.filter((item) => item.complete && !item.stale && item.active_layer === "snapshot").length;
  const affectedSections = affectedDraftSections([
    ...(draftGate?.stale ?? []),
    ...(draftGate?.missing ?? []),
    ...(draftGate?.fallback ?? []),
  ]);

  const selectWorkspace = (nextView: ResearchWorkspaceView) => {
    const params = new URLSearchParams(searchParams);
    if (nextView === "overview") params.delete("view");
    else params.set("view", nextView);
    setSearchParams(params, { replace: true });
  };

  if (workspaceView !== "overview") {
    return (
      <div className="research-workspace-shell">
        <ResearchWorkspaceNav value={workspaceView} onChange={selectWorkspace} />
        {workspaceView === "themes" ? <ThemeResearchView /> : null}
        {workspaceView === "macro" ? <MacroObservationView /> : null}
        {workspaceView === "graph" ? <KnowledgeGraphView /> : null}
      </div>
    );
  }

  return (
    <div className="research-workspace-shell">
      <ResearchWorkspaceNav value={workspaceView} onChange={selectWorkspace} />
      <TradingPageShell
      eyebrow="Research / Analysis"
      title="市场情报"
      description="币种 K 线分析 + 规则信号引擎（教学沙箱）。离线模式下使用快照数据，不代表真实交易建议。"
      actions={
        <div className="research-signal-actions">
          <Input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            onPressEnter={applySymbol}
            prefix={<SearchOutlined />}
            style={{ width: 120 }}
            placeholder="BTC"
          />
          <Button type="primary" onClick={applySymbol}>
            应用
          </Button>
          <Button
            icon={<ReloadOutlined />}
            loading={klineBusy || signalBusy}
            onClick={() => {
              void loadKline(true);
              void loadLlmSignal();
            }}
          >
            刷新
          </Button>
        </div>
      }
      aside={
        <QuantGlowCard className="research-hero-summary">
          <div className="research-hero-summary-top">
            <span>{pair}</span>
            <StatusPill tone={signalTone(signal?.signal)}>{signalBusy ? "分析中" : signal?.signalLabel ?? "待分析"}</StatusPill>
          </div>
          <strong>{formatPrice(signal?.market?.price ?? price)}</strong>
          <div className="research-hero-summary-grid">
            <div>
              <span>24h 涨跌</span>
              <b className={(tickerMeta?.changeRate ?? 0) >= 0 ? "research-positive" : "research-negative"}>
                {formatPct(tickerMeta?.changeRate)}
              </b>
            </div>
            <div>
              <span>置信度</span>
              <b>{signal?.confidence?.toFixed(1) ?? "—"}%</b>
            </div>
            <div>
              <span>行情</span>
              <b>{metrics?.regime ?? "—"}</b>
            </div>
            <div>
              <span>数据源</span>
              <b>{kline?.source ?? "—"}</b>
            </div>
          </div>
        </QuantGlowCard>
      }
    >
      {error && (
        <QuantGlowCard className="trading-span-12" title={<SectionHeader title="加载错误" />}>
          <p>{error}</p>
        </QuantGlowCard>
      )}

      <section className="trading-grid research-draft-gate-section">
        <QuantGlowCard
          className="trading-span-4 research-draft-gate-card"
          title={<SectionHeader title="研究草稿门禁" description="草稿生成前检查" />}
          badge={<StatusPill tone={draftDecisionTone(draftGate?.decision)}>{draftDecisionLabel(draftGate?.decision)}</StatusPill>}
        >
          <div className="research-draft-gate-hero">
            <span>门禁结论</span>
            <strong>{draftDecisionLabel(draftGate?.decision)}</strong>
            <p>{draftSummaryText(draftGate)}</p>
          </div>
          <div className="research-draft-review">
            <div>
              <span>受影响段落</span>
              <strong>{affectedSections.join("、")}</strong>
            </div>
            <div>
              <span>下一步</span>
              <strong>{draftReviewAction(draftGate)}</strong>
            </div>
          </div>
          <div className="research-draft-gate-metrics">
            <div>
              <span>可用/总数</span>
              <strong>{draftGate ? `${draftGate.complete ?? 0}/${draftGate.total ?? 0}` : "-"}</strong>
            </div>
            <div>
              <span>无问题快照</span>
              <strong>{draftGate ? `${draftCleanCount}/${draftDatasets.length}` : "-"}</strong>
            </div>
            <div>
              <span>需处理项</span>
              <strong className={draftIssueCount ? "research-negative" : "research-positive"}>{draftGate ? draftIssueCount : "-"}</strong>
            </div>
            <div>
              <span>时效线</span>
              <strong>{draftGate?.stale_threshold_hours ?? 24}h</strong>
            </div>
          </div>
          <div className="research-draft-blockers">
            <span>过期数据：{listOrNone((draftGate?.stale ?? []).map(datasetLabel))}</span>
            <span>缺失数据：{listOrNone((draftGate?.missing ?? []).map(datasetLabel))}</span>
            <span>回退来源：{listOrNone((draftGate?.fallback ?? []).map(datasetLabel))}</span>
          </div>
          <Button className="research-draft-generate" type="primary" loading={draftBusy} onClick={generateResearchDraft}>
            生成研究草稿
          </Button>
          {draftError ? <p className="research-draft-error">{draftError}</p> : null}
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-8 research-draft-datasets-card"
          title={<SectionHeader title="快照证据合同" description="来源 / 新鲜度 / 历史追溯" />}
          badge={<StatusPill tone="neutral">需要人工复核</StatusPill>}
        >
          <div className="research-draft-dataset-grid">
            {draftDatasets.map((item) => (
              <div key={item.name} className={`research-draft-dataset-row${item.stale ? " stale" : ""}${!item.complete ? " missing" : ""}`}>
                <div>
                  <strong>{datasetLabel(item.name)}</strong>
                  <span>{datasetSourceNote(item)}</span>
                </div>
                <span>{layerLabel(item.active_layer)}</span>
                <span>{formatAgeHours(item.age_hours)}</span>
                <span>{item.history_count ?? 0}</span>
                <StatusPill tone={!item.complete ? "loss" : item.stale || item.active_layer !== "snapshot" ? "neutral" : "profit"}>
                  {datasetStateLabel(item)}
                </StatusPill>
              </div>
            ))}
            {!draftDatasets.length ? <div className="research-news-empty">正在读取快照门禁...</div> : null}
          </div>
          <div className="research-draft-prohibited">
            {(draftGate?.prohibited_actions ?? ["publish as final conclusion", "modify risk thresholds", "place live orders"]).map((action) => (
              <span key={action}>{prohibitedActionLabel(action)}</span>
            ))}
          </div>
        </QuantGlowCard>
      </section>
      {researchDraft ? (
        <section className="trading-grid research-generated-draft-section">
          <QuantGlowCard
            className="trading-span-12 research-generated-draft-card"
            title={<SectionHeader title={researchDraft.title ?? "市场快照研究草稿"} description={`${researchDraft.pair ?? pair} · draft_only · ${researchDraft.generated_at ?? "待生成"}`} />}
            badge={<StatusPill tone="neutral">只读草稿</StatusPill>}
          >
            <div className="research-generated-draft-banner">
              <strong>人工复核前不得发布为正式结论</strong>
              <span>这份草稿只汇总证据、状态和复核事项，不生成仓位、风控修改或下单动作。</span>
            </div>
            <div className="research-generated-draft-grid">
              {(researchDraft.sections ?? []).map((section) => (
                <div key={section.id} className="research-generated-draft-section-card">
                  <h3>{section.title}</h3>
                  <ul>
                    {(section.items ?? []).map((item, index) => (
                      <li key={`${section.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="research-generated-review">
              {(researchDraft.review_checklist ?? []).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </QuantGlowCard>
        </section>
      ) : null}
      <section className="trading-grid research-primary-grid">
        <QuantGlowCard
          className="trading-span-12 research-kline-card"
          title={<SectionHeader title="币种 K 线" description={`${pair} · ${kline?.trend ?? "加载中"}`} />}
          badge={<StatusPill tone="neutral">{kline?.source ?? "—"}</StatusPill>}
        >
          <div className="research-analysis-toolbar">
            <Select
              value={klineType}
              style={{ width: 120 }}
              options={KLINE_TYPES}
              onChange={(value) => {
                setKlineType(value);
                const params = new URLSearchParams(searchParams);
                params.set("type", value);
                setSearchParams(params, { replace: true });
              }}
            />
            <label>
              <input type="checkbox" checked={showMa20} onChange={(e) => setShowMa20(e.target.checked)} />
              MA20
            </label>
            <label>
              <input type="checkbox" checked={showMa60} onChange={(e) => setShowMa60(e.target.checked)} />
              MA60
            </label>
            <label>
              <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />
              成交量
            </label>
            <label>
              <input type="checkbox" checked={showPriceLines} onChange={(e) => setShowPriceLines(e.target.checked)} />
              显示价位线
            </label>
          </div>

          <div className="research-stat-row">
            <div className="research-stat-card">
              <div className="label">当前币种</div>
              <div className="value">{symbol}</div>
            </div>
            <div className="research-stat-card">
              <div className="label">最新价格</div>
              <div className="value">{formatPrice(price)}</div>
            </div>
            <div className="research-stat-card">
              <div className="label">24h 涨跌</div>
              <div className="value" style={{ color: (tickerMeta?.changeRate ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                {formatPct(tickerMeta?.changeRate)}
              </div>
            </div>
            <div className="research-stat-card">
              <div className="label">24h 高低</div>
              <div className="value">
                {formatPrice(tickerMeta?.high)} / {formatPrice(tickerMeta?.low)}
              </div>
            </div>
            <div className="research-stat-card">
              <div className="label">24h 成交额</div>
              <div className="value">{formatPrice(tickerMeta?.volValue)}</div>
            </div>
            <div className="research-stat-card">
              <div className="label">交易对</div>
              <div className="value">{pair}</div>
            </div>
          </div>

          <KlineAnalysisChart
            candles={kline?.candles ?? []}
            tradePlan={showPriceLines ? signal?.tradePlan : null}
            showMa20={showMa20}
            showMa60={showMa60}
            showVolume={showVolume}
            showPriceLines={showPriceLines}
            height={360}
          />

          <dl className="research-kline-metrics">
            <div>
              <dt>RSI</dt>
              <dd>{metrics?.rsi ?? "—"}</dd>
            </div>
            <div>
              <dt>支撑(20)</dt>
              <dd>{formatPrice(metrics?.support20)}</dd>
            </div>
            <div>
              <dt>阻力(20)</dt>
              <dd>{formatPrice(metrics?.resistance20)}</dd>
            </div>
            <div>
              <dt>波动率</dt>
              <dd>{metrics?.volatilityPct != null ? `${metrics.volatilityPct.toFixed(2)}%` : "—"}</dd>
            </div>
            <div>
              <dt>区间位置</dt>
              <dd>{metrics?.rangePositionPct != null ? `${metrics.rangePositionPct.toFixed(1)}%` : "—"}</dd>
            </div>
            <div>
              <dt>行情状态</dt>
              <dd>{metrics?.regime ?? "—"}</dd>
            </div>
          </dl>

          {verdict && (
            <div className="research-verdict">
              <strong>
                {verdict.actionLabel} · 得分 {verdict.score} · 置信度 {verdict.confidence}%
              </strong>
              <ul>
                {(verdict.reasons || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-12 research-signal-card"
          title={<SectionHeader title="LLM 信号分析" description="与 web3-trading /analysis 对齐 · DeepSeek V4 Pro 异步分析" />}
          badge={
            <StatusPill tone={signalTone(signal?.signal)}>
              {signalBusy ? "分析中" : signal?.signalLabel ?? "未就绪"}
            </StatusPill>
          }
        >
          {signalStatus && (
            <div className="research-verdict" style={{ marginBottom: 12 }}>
              {signalStatus}
            </div>
          )}
          {signalError && (
            <div className="research-verdict" style={{ marginBottom: 12, color: "#b91c1c" }}>
              {signalError}
            </div>
          )}
          <div className="research-signal-hero">
            <div>
              <div className="research-signal-price">
                {formatPrice(signal?.market?.price ?? price)}
                <span style={{ fontSize: 14, marginLeft: 8, color: (signal?.market?.changeRate24h ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                  {signal?.market?.changeRate24h != null
                    ? `${signal.market.changeRate24h >= 0 ? "+" : ""}${signal.market.changeRate24h.toFixed(2)}%`
                    : ""}
                </span>
              </div>
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                置信度 {signal?.confidence?.toFixed(1) ?? "—"}% · 综合得分 {signal?.score != null ? `${signal.score >= 0 ? "+" : ""}${signal.score}` : "—"}
              </div>
            </div>
            <div className="research-signal-actions">
              <Select
                value={llmModel}
                style={{ width: 180 }}
                options={LLM_MODELS}
                onChange={(value) => {
                  setLlmModel(value);
                  const params = new URLSearchParams(searchParams);
                  params.set("model", value);
                  setSearchParams(params, { replace: true });
                }}
              />
              <Button type="primary" loading={signalBusy} onClick={() => void loadLlmSignal()}>
                生成信号
              </Button>
              <span>定时刷新</span>
              <Switch checked={autoRefresh} onChange={setAutoRefresh} />
            </div>
          </div>

          <div className="research-trend-badges">
            {trendBadges.map((item) => (
              <span key={item.tf} className={`research-trend-badge ${item.tone}`}>
                {item.label} · {item.trend}
              </span>
            ))}
          </div>

          {signal?.summary && (
            <div className="research-verdict">
              <strong>核心结论</strong>
              <p style={{ margin: "8px 0 0" }}>{signal.summary}</p>
            </div>
          )}

          <div className="research-logic-flow">
            {(signal?.logicFlow || []).map((step) => (
              <div key={step.step} className="research-logic-step">
                <h4>
                  {step.step}. {step.title}
                </h4>
                {step.status && <p>{step.status}</p>}
                {step.detail && <p>{step.detail}</p>}
                {step.note && <p>{step.note}</p>}
                {step.summary && <p>{step.summary}</p>}
                {step.dimensions && (
                  <div className="research-dimension-list">
                    {step.dimensions.map((dim) => (
                      <div key={dim.name} className="research-dimension-row">
                        <span>
                          {dim.name} · {dim.bias}
                        </span>
                        <span>{dim.score}</span>
                      </div>
                    ))}
                  </div>
                )}
                {step.badges && (
                  <div className="research-trend-badges" style={{ marginTop: 8 }}>
                    {step.badges.map((badge) => (
                      <span key={badge} className="research-trend-badge neutral">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
                {(step.rr1 != null || step.rr2 != null) && (
                  <p style={{ marginTop: 8 }}>
                    RR1 {step.rr1 ?? "—"} · RR2 {step.rr2 ?? "—"}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="research-signal-footer">
            <span>市场状态 · {signal?.analysis?.marketState ?? "—"}</span>
            <span>执行准备度 · {signal?.analysis?.executionReadiness ?? "—"}</span>
            <span>模型 · {signal?.engineMeta?.displayModel ?? signal?.engineMeta?.model ?? "DeepSeek V4 Pro"}</span>
            <span>恐贪指数 · {signal?.onchainMetrics?.fearGreed ?? "—"}</span>
          </div>
        </QuantGlowCard>
      </section>

      <section className="trading-grid research-news-workbench">
        <QuantGlowCard
          className="trading-span-12 research-news-cockpit"
          title={
            <SectionHeader
              title="Web3 消息面情报"
              description={`No-key RSS/GDELT · ${web3News?.source ?? "loading"} · ${web3News?.updated_at ?? "—"}`}
            />
          }
          badge={<StatusPill tone={(web3News?.metrics?.risk_event_count ?? 0) > 0 ? "loss" : "neutral"}>News</StatusPill>}
        >
          <div className="research-news-dashboard">
            <div className="research-news-brief">
              <span>Market Intelligence</span>
              <strong>{filteredNewsItems.length}</strong>
              <p>
                当前筛选命中 / 全量 {web3News?.metrics?.article_count ?? "—"} 条 · 来源{" "}
                {sourceHealth.ok}/{sourceHealth.total || "—"}
              </p>
              <div className="research-news-focus">
                <span>
                  热门资产：
                  {topNewsAssets.length ? topNewsAssets.map(([asset, count]) => `${asset} ${count}`).join(" / ") : "—"}
                </span>
                <span>
                  热门主题：
                  {topNewsTopics.length ? topNewsTopics.map(([topic, count]) => `${topic} ${count}`).join(" / ") : "—"}
                </span>
              </div>
            </div>
            <div className="research-news-controls">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索新闻、资产、主题"
                value={newsSearch}
                onChange={(event) => setNewsSearch(event.target.value)}
              />
              <Select value={newsSourceFilter} options={sourceOptions} onChange={setNewsSourceFilter} />
              <Select value={newsTopicFilter} options={topicOptions} onChange={setNewsTopicFilter} />
              <label className="research-news-switch">
                <Switch size="small" checked={newsRiskOnly} onChange={setNewsRiskOnly} />
                只看风险事件
              </label>
            </div>
          </div>

          <div className="research-news-metrics">
            <div>
              <span>新闻热度</span>
              <strong>{web3News?.metrics?.article_count ?? "—"}</strong>
            </div>
            <div>
              <span>情绪均值</span>
              <strong className={newsSentimentTone}>{web3News?.metrics?.sentiment_score?.toFixed(2) ?? "—"}</strong>
            </div>
            <div>
              <span>风险事件</span>
              <strong className="research-negative">{web3News?.metrics?.risk_event_count ?? "—"}</strong>
            </div>
            <div>
              <span>正面占比</span>
              <strong>
                {web3News?.metrics?.positive_ratio != null ? `${(web3News.metrics.positive_ratio * 100).toFixed(1)}%` : "—"}
              </strong>
            </div>
            <div>
              <span>来源广度</span>
              <strong>{web3News?.metrics?.source_breadth ?? "—"}</strong>
            </div>
          </div>

          <div className="research-news-insight-strip">
            <div className="research-source-summary">
              <span className={sourceHealth.failed.length ? "warn" : "ok"}>
                来源 {sourceHealth.ok}/{sourceHealth.total || "—"}
              </span>
              <p>
                {sourceHealth.top.length
                  ? sourceHealth.top.map((source) => `${source.name ?? source.id} ${source.count ?? 0}`).join(" / ")
                  : "等待来源更新"}
              </p>
            </div>
            <div className="research-news-chip-row" aria-label="Top assets">
              {topNewsAssets.map(([asset, count]) => (
                <button key={asset} type="button" onClick={() => setNewsSearch(asset)}>
                  {asset}
                  <b>{count}</b>
                </button>
              ))}
            </div>
            <div className="research-news-chip-row" aria-label="Top topics">
              {topNewsTopics.map(([topic, count]) => (
                <button
                  key={topic}
                  type="button"
                  className={newsTopicFilter === topic ? "active" : ""}
                  onClick={() => setNewsTopicFilter(newsTopicFilter === topic ? "all" : topic)}
                >
                  {topic}
                  <b>{count}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="research-news-layout">
            <div className="research-news-feed">
              {filteredNewsItems.slice(0, 12).map((item, index) => (
                <a
                  key={`${item.source_id}-${item.url || item.title}`}
                  className={`research-news-item${item.risk_event ? " risk" : ""}`}
                  href={item.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!item.url}
                  onClick={(event) => {
                    if (!item.url) {
                      event.preventDefault();
                    }
                  }}
                >
                  <div className="research-news-rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="research-news-body">
                    <div className="research-news-meta">
                      <span>{item.source ?? "source"}</span>
                      <span>{(item.assets ?? []).join(", ") || "market"}</span>
                      <span>{(item.topics ?? []).join(", ") || "general"}</span>
                      <span>{item.published_at ?? "—"}</span>
                    </div>
                    <strong>{item.title}</strong>
                    {item.summary ? <p>{item.summary}</p> : null}
                  </div>
                  <StatusPill tone={item.risk_event ? "loss" : (item.sentiment ?? 0) > 0 ? "profit" : "neutral"}>
                    {item.risk_event ? "Risk" : (item.sentiment ?? 0) > 0 ? "Bullish" : "Neutral"}
                  </StatusPill>
                </a>
              ))}
              {!filteredNewsItems.length ? (
                <div className="research-news-empty">当前筛选没有命中新闻，放宽来源、主题或搜索条件。</div>
              ) : null}
            </div>
          </div>
        </QuantGlowCard>
      </section>

      <section className="trading-grid research-intel-section">
        <QuantGlowCard
          className="trading-span-7"
          title={
            <SectionHeader
              title={research?.company ?? "研究摘要"}
              description="Facts · Interpretation · Unknowns"
            />
          }
          badge={<StatusPill tone="neutral">{loading ? "Loading" : "Fixed sample"}</StatusPill>}
        >
          <div className="trading-list">
            {(research?.facts ?? []).map((item) => (
              <SignalRow
                key={item.source_id}
                title={item.claim}
                meta={`来源 ${item.source_id}`}
                badge={<StatusPill tone="neutral">{item.source_id}</StatusPill>}
              />
            ))}
            <SignalRow title="解释" meta={research?.interpretation ?? "加载中..."} />
            {(research?.unknowns ?? []).map((item) => (
              <SignalRow key={item} title="仍然未知" meta={item} />
            ))}
          </div>
        </QuantGlowCard>

        <QuantGlowCard
          className="trading-span-5"
          title={<SectionHeader title="来源卡" description="可追溯证据链" />}
        >
          <div className="trading-list">
            {(research?.sources ?? []).map((source) => (
              <SignalRow
                key={source.id}
                title={`${source.id} · ${source.title}`}
                meta={`${source.date} · ${source.evidence}`}
              />
            ))}
          </div>
        </QuantGlowCard>
      </section>
      </TradingPageShell>
    </div>
  );
}
