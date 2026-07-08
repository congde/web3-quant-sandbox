import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input, Segmented, Select } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchMarketTickers,
  fetchOnchain,
  fetchOpportunityScan,
  fetchSectorFund,
} from "../../api";
import type { OpportunityItem, OpportunityScanPayload } from "../../types";
import { StatusPill, TradingPageShell } from "./TradingPageShell";
import "./radar.css";

interface TickerRow {
  symbol?: string;
  changeRate?: number;
  last?: number;
  volValue?: number;
  high?: number;
  low?: number;
}

type RadarSortKey = "score" | "confidence" | "volume" | "change";
type RadarPathKey = "hot" | "cold" | "blocked";

function formatVolume(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatSource(source?: string, engine?: string) {
  if (source === "web3-trading-upstream") return "上游适配器";
  if (source === "snapshot") return "离线样本";
  if (engine === "sandbox-rule-based") return "规则引擎 · 直连";
  if (source === "live") return "直连 API";
  return source || "沙箱";
}

function signalClass(signal?: string) {
  const value = String(signal || "").toUpperCase();
  if (value === "BUY") return "buy";
  if (value === "WEAK_BUY") return "weak-buy";
  if (value === "SELL") return "sell";
  if (value === "WEAK_SELL") return "weak-sell";
  return "neutral";
}

function baseSymbol(symbol: string) {
  return symbol.includes("-") ? symbol.split("-")[0] : symbol;
}

function findTickerRow(tickers: TickerRow[], base: string) {
  return tickers.find((item) => baseSymbol(String(item.symbol || "")) === base);
}

function formatPrice(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatChange(rate?: number) {
  if (rate == null || Number.isNaN(rate)) return "-";
  const pct = rate * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatRisk(value?: string) {
  if (value === "low") return "低风险";
  if (value === "medium") return "中风险";
  if (value === "high") return "高风险";
  return "待确认";
}

function riskTone(value?: string) {
  if (value === "low") return "profit";
  if (value === "medium") return "ai";
  if (value === "high") return "loss";
  return "neutral";
}

function formatBias(value?: string) {
  if (value === "bullish") return "多头";
  if (value === "bearish") return "空头";
  return "中性";
}

function actionHint(item: OpportunityItem) {
  const risk = String(item.riskLevel || "");
  if (risk === "high") return "阻断";
  const signal = String(item.signal || "").toUpperCase();
  if (signal.includes("BUY")) return "研究";
  if (signal.includes("SELL")) return "避险";
  return "观察";
}

function classifyRadarPath(item: OpportunityItem): RadarPathKey {
  const score = Math.abs(Number(item.score || 0));
  const confidence = Number(item.confidence || 0);
  const volume = Number(item.volume24h || 0);
  const risk = String(item.riskLevel || "");

  if (risk === "high") return "blocked";
  if (score >= 28 && confidence >= 58 && volume >= 1_000_000) return "hot";
  return "cold";
}

function radarPathLabel(path: RadarPathKey) {
  if (path === "hot") return "热路径观察";
  if (path === "blocked") return "风控阻断";
  return "冷路径研究";
}

function radarPathNote(path: RadarPathKey) {
  if (path === "hot") return "适合秒级复算，但沙箱只标注不执行";
  if (path === "blocked") return "先做流动性、安全与确认数复核";
  return "进入市场情报、回测和中低频策略评估";
}

function stateCheckLabel(path: RadarPathKey) {
  if (path === "hot") return "需 eth_call / getReserves 复算";
  if (path === "blocked") return "需 Honeypot / 滑点 / 深度复核";
  return "可用快照做研究起点";
}

function confirmationLabel(path: RadarPathKey) {
  if (path === "hot") return "零确认仅观察";
  if (path === "blocked") return "等待 1-2 区块";
  return "按研究周期确认";
}

function netEdgeLabel(path: RadarPathKey) {
  if (path === "hot") return "未扣 Gas / Tip / 滑点";
  if (path === "blocked") return "净收益不可用";
  return "需回测扣成本";
}

function leadingSector(sectors: Awaited<ReturnType<typeof fetchSectorFund>>["sectors"]) {
  const getInflow = (sector: NonNullable<typeof sectors>[number], range: string) =>
    Number((sector.categoriesTradeDataList || []).find((entry) => entry.timeRange === range)?.tradeInflow || 0);
  const top = [...(sectors || [])].sort((a, b) => getInflow(b, "h1") - getInflow(a, "h1"))[0];
  return top?.tagsSimplified || top?.tag || "-";
}

function RadarCard({
  item,
  featured,
  onResearch,
}: {
  item: OpportunityItem;
  featured?: boolean;
  onResearch: (pair: string) => void;
}) {
  const change = Number(item.change24h || 0);
  const score = Number(item.score || 0);
  const conf = Number(item.confidence || 0);
  const pair = item.pair || `${item.symbol}-USDT`;
  const reasons = (item.keyReasons || []).slice(0, 2).join(" · ");
  const risk = String(item.riskLevel || "");
  const path = classifyRadarPath(item);

  return (
    <article className={`radar-card ${signalClass(item.signal)} radar-path-${path}${featured ? " featured" : ""}`}>
      <div className="radar-card-rank-col">
        <div className="radar-card-rank">#{item.rank ?? "-"}</div>
        <div className="radar-score-ring" style={{ ["--ring-pct" as string]: Math.min(100, Math.abs(score)) }}>
          <span className="radar-score-num">
            {score >= 0 ? "+" : ""}
            {score.toFixed(0)}
          </span>
        </div>
      </div>
      <div className="radar-card-main">
        <div className="radar-card-head">
          <span className="radar-card-symbol">{item.symbol}</span>
          <span className="radar-card-pair">{pair}</span>
          <span className="radar-signal-pill">{item.label || item.signal || "中性"}</span>
          <span className={`radar-path-pill ${path}`}>{radarPathLabel(path)}</span>
        </div>
        <div className="radar-card-metrics">
          <div>
            <span className="radar-metric-label">24h</span>
            <span className={`radar-metric-value${change >= 0 ? " up" : " down"}`}>{formatChange(change)}</span>
          </div>
          <div>
            <span className="radar-metric-label">置信度</span>
            <span className="radar-metric-value">{conf.toFixed(0)}%</span>
          </div>
          <div>
            <span className="radar-metric-label">成交额</span>
            <span className="radar-metric-value">${formatVolume(Number(item.volume24h || 0))}</span>
          </div>
          <div>
            <span className="radar-metric-label">风险</span>
            <span className="radar-metric-value">{formatRisk(risk)}</span>
          </div>
          <div>
            <span className="radar-metric-label">方向</span>
            <span className="radar-metric-value">{formatBias(item.bias)}</span>
          </div>
        </div>
        {reasons ? <div className="radar-card-reason">{reasons}</div> : null}
        <div className="radar-guardrail-row">
          <span>净边界：{netEdgeLabel(path)}</span>
          <span>状态：{stateCheckLabel(path)}</span>
          <span>确认：{confirmationLabel(path)}</span>
        </div>
        <div className="radar-factor-row">
          <span>动量 {formatChange(item.change24h)}</span>
          <span>流动性 ${formatVolume(Number(item.volume24h || 0))}</span>
          <span>{radarPathNote(path)}</span>
        </div>
      </div>
      <div className="radar-card-actions">
        <StatusPill tone={riskTone(risk)}>{actionHint(item)}</StatusPill>
        <Button size="small" type="primary" className="btn-gradient" onClick={() => onResearch(pair)}>
          市场情报
        </Button>
      </div>
    </article>
  );
}

export default function RadarPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<OpportunityScanPayload | null>(null);
  const [tickers, setTickers] = useState<TickerRow[]>([]);
  const [fearGreed, setFearGreed] = useState("-");
  const [sectorLead, setSectorLead] = useState("-");
  const [searchText, setSearchText] = useState("");
  const [signalFilter, setSignalFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortKey, setSortKey] = useState<RadarSortKey>("score");
  const scanningRef = useRef(false);

  const applyContext = useCallback(
    (
      marketResult: Awaited<ReturnType<typeof fetchMarketTickers>> | null,
      onchainResult: PromiseSettledResult<Awaited<ReturnType<typeof fetchOnchain>>>,
      sectorResult: PromiseSettledResult<Awaited<ReturnType<typeof fetchSectorFund>>>,
    ) => {
      const nextTickers = ((marketResult?.tickers as TickerRow[]) || []);
      setTickers(nextTickers);

      if (onchainResult.status === "fulfilled") {
        const fg = onchainResult.value.marketSentiment?.fearGreed;
        if (fg?.value != null) {
          setFearGreed(`${fg.value}${fg.label ? ` · ${fg.label}` : ""}`);
        }
      }
      if (sectorResult.status === "fulfilled") {
        setSectorLead(leadingSector(sectorResult.value.sectors));
      }
    },
    [],
  );

  const loadContext = useCallback(async (options?: { refresh?: boolean }) => {
    const refresh = options?.refresh ?? false;
    const marketResult = await fetchMarketTickers(300, { refresh }).catch(() => null);
    const [onchainResult, sectorResult] = await Promise.allSettled([
      fetchOnchain("BTC", { refresh }),
      fetchSectorFund(1, { refresh }),
    ]);
    applyContext(marketResult, onchainResult, sectorResult);
  }, [applyContext]);

  const loadScan = useCallback(async (options?: { refresh?: boolean }) => {
    const refresh = options?.refresh ?? false;
    if (scanningRef.current) return;
    scanningRef.current = true;
    if (refresh) {
      setRefreshing(true);
    } else if (!scanResult) {
      setScanning(true);
    }
    setScanError(null);
    try {
      const payload = await fetchOpportunityScan({ topK: 30, maxSymbols: 300, refresh });
      if (!payload.ok) {
        throw new Error(payload.message || "机会扫描失败");
      }
      setScanResult(payload);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "机会扫描失败");
    } finally {
      scanningRef.current = false;
      setScanning(false);
      setRefreshing(false);
    }
  }, [scanResult]);

  useEffect(() => {
    void loadContext();
    void loadScan();
    const timer = window.setTimeout(() => {
      void loadContext({ refresh: true });
      void loadScan({ refresh: true });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [loadContext, loadScan]);

  const opportunities = scanResult?.opportunities || [];
  const btcRow = findTickerRow(tickers, "BTC");
  const ethRow = findTickerRow(tickers, "ETH");
  const btcChange = btcRow?.changeRate;
  const ethChange = ethRow?.changeRate;

  const scanTimeLabel = useMemo(() => {
    if (!scanResult?.scanTime) return "-";
    return new Date(scanResult.scanTime).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [scanResult?.scanTime]);

  const overview = useMemo(() => {
    if (scanning && !scanResult) return "正在加载离线样本并构建候选队列...";
    if (refreshing) return "后台刷新行情、链上情绪与机会扫描结果...";
    if (scanError) return "扫描失败，请稍后重试或检查数据源。";
    const base = scanResult?.marketOverview || "";
    const duration = scanResult?.scanDurationMs ? ` · ${(scanResult.scanDurationMs / 1000).toFixed(1)}s` : "";
    if (base) return `${base}${duration}`;
    if (opportunities.length) {
      return `已扫描 ${scanResult?.totalScanned || opportunities.length} 个标的${duration}`;
    }
    return "暂无扫描结果";
  }, [refreshing, scanError, opportunities.length, scanResult, scanning]);

  const visibleOpportunities = useMemo(() => {
    const query = searchText.trim().toUpperCase();
    const rows = opportunities.filter((item) => {
      if (query && !`${item.symbol} ${item.pair ?? ""} ${item.label ?? ""}`.toUpperCase().includes(query)) return false;
      if (signalFilter !== "all" && String(item.bias || "neutral") !== signalFilter) return false;
      if (riskFilter !== "all" && String(item.riskLevel || "unknown") !== riskFilter) return false;
      return true;
    });
    const sorters: Record<RadarSortKey, (item: OpportunityItem) => number> = {
      score: (item) => Math.abs(Number(item.score || 0)),
      confidence: (item) => Number(item.confidence || 0),
      volume: (item) => Number(item.volume24h || 0),
      change: (item) => Math.abs(Number(item.change24h || 0)),
    };
    return rows.slice().sort((a, b) => sorters[sortKey](b) - sorters[sortKey](a));
  }, [opportunities, riskFilter, searchText, signalFilter, sortKey]);

  const radarStats = useMemo(() => {
    const bullish = opportunities.filter((item) => item.bias === "bullish").length;
    const bearish = opportunities.filter((item) => item.bias === "bearish").length;
    const highRisk = opportunities.filter((item) => item.riskLevel === "high").length;
    const avgConfidence = opportunities.length
      ? opportunities.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / opportunities.length
      : 0;
    const topVolume = opportunities.reduce((sum, item) => sum + Number(item.volume24h || 0), 0);
    return { bullish, bearish, highRisk, avgConfidence, topVolume };
  }, [opportunities]);

  const pathStats = useMemo(() => {
    return opportunities.reduce(
      (acc, item) => {
        acc[classifyRadarPath(item)] += 1;
        return acc;
      },
      { hot: 0, cold: 0, blocked: 0 } as Record<RadarPathKey, number>,
    );
  }, [opportunities]);

  const playbook = useMemo(() => {
    const top = visibleOpportunities[0];
    if (!top) return "等待扫描结果后生成机会摘要。";
    const direction = formatBias(top.bias);
    const path = classifyRadarPath(top);
    return `${top.symbol} 当前排名靠前，方向 ${direction}，置信度 ${Number(top.confidence || 0).toFixed(0)}%，路径为${radarPathLabel(path)}。先用市场情报核验 K 线、消息面与资金面；若进入热路径，必须先完成链上状态复算、Gas/滑点扣减和私有通道评估。`;
  }, [visibleOpportunities]);

  const flowLanes = [
    {
      key: "hot" as const,
      title: "热路径观察",
      count: pathStats.hot,
      meta: "CEX-DEX、跨池套利、MEV 类信号",
      detail: "不走 Kafka/Flink；真实执行前需内存状态复算与执行器直连。",
    },
    {
      key: "cold" as const,
      title: "冷路径研究",
      count: pathStats.cold,
      meta: "Smart Money、资金费率、异动跟踪",
      detail: "适合进入市场情报、回测、多因子排序和人工研判。",
    },
    {
      key: "blocked" as const,
      title: "风控阻断",
      count: pathStats.blocked,
      meta: "高波动、低确认或高风险候选",
      detail: "滑点、Gas、蜜罐、流动性深度与区块确认数拥有否决权。",
    },
  ];

  const guardCards = [
    { title: "状态模拟", value: "必检", detail: "热路径不能只信 newHeads，发送前需 eth_call / Multicall 复算池子状态。" },
    { title: "Gas 与滑点", value: "扣成本", detail: "机会收益必须扣 Base Fee、Priority Fee、Jito Tip、Swap 税和价格冲击。" },
    { title: "私有通道", value: "防夹", detail: "EVM 使用 Flashbots / Builder Bundle；Solana 评估 Jito Block Engine 与 CU。" },
    { title: "Reorg 防御", value: "确认数", detail: "跟随型资金等待 1-2 个区块，高频小额才允许零确认冒险。" },
  ];

  return (
    <TradingPageShell
      eyebrow="Opportunity Radar"
      title="机会雷达"
      description="候选扫描、冷热路径标注与 Web3 风控停止线。当前为教学沙箱，只输出研究信号，不连接真实执行器。"
      actions={
        <>
          <Button
            type="primary"
            className="btn-gradient"
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={() => void loadScan({ refresh: true })}
          >
            扫描机会
          </Button>
          <Button onClick={() => navigate("/data-sources")}>数据源</Button>
        </>
      }
    >
      <div className="radar-page">
        <section className="radar-pulse-strip">
          <div className="radar-pulse-group">
            <div className="radar-pulse-ticker">
              <span className="radar-pulse-icon">B</span>
              <div>
                <span className="radar-pulse-label">BTC</span>
                <span className="radar-pulse-price">{formatPrice(btcRow?.last)}</span>
                <span className={`radar-pulse-value${btcChange != null && btcChange >= 0 ? " up" : btcChange != null ? " down" : ""}`}>
                  {formatChange(btcChange)}
                </span>
              </div>
            </div>
            <div className="radar-pulse-ticker">
              <span className="radar-pulse-icon eth">E</span>
              <div>
                <span className="radar-pulse-label">ETH</span>
                <span className="radar-pulse-price">{formatPrice(ethRow?.last)}</span>
                <span className={`radar-pulse-value${ethChange != null && ethChange >= 0 ? " up" : ethChange != null ? " down" : ""}`}>
                  {formatChange(ethChange)}
                </span>
              </div>
            </div>
          </div>
          <div className="radar-pulse-divider" />
          <div className="radar-pulse-group">
            <div className="radar-pulse-ticker">
              <div>
                <span className="radar-pulse-label">恐贪指数</span>
                <span className="radar-pulse-value">{fearGreed}</span>
              </div>
            </div>
            <div className="radar-pulse-ticker">
              <div>
                <span className="radar-pulse-label">领涨板块</span>
                <span className="radar-pulse-value">{sectorLead}</span>
              </div>
            </div>
          </div>
          <div className="radar-pulse-divider" />
          <div className="radar-pulse-group radar-pulse-highlight-group">
            <div className={`radar-pulse-highlight${opportunities.length ? " active" : ""}`}>
              <span className="radar-pulse-highlight-num">{opportunities.length || "-"}</span>
              <span className="radar-pulse-highlight-label">候选信号</span>
            </div>
            <div className="radar-pulse-highlight">
              <span className="radar-pulse-meta-value">{scanTimeLabel}</span>
              <span className="radar-pulse-highlight-label">扫描更新</span>
            </div>
          </div>
        </section>

        <section className="radar-hero-card">
          <div className="radar-hero-head">
            <div>
              <div className="trading-eyebrow">RADAR CONTROL</div>
              <h2 className="radar-hero-title">机会队列与执行边界</h2>
              <p className="radar-hero-overview">{overview}</p>
            </div>
            <div className="radar-source-stack">
              <span className="radar-engine-badge">{formatSource(scanResult?.source, scanResult?.engine)}</span>
              {scanResult?.source ? (
                <StatusPill tone={scanResult.source === "snapshot" ? "ai" : "profit"}>
                  {scanResult.source === "snapshot" ? "离线快照" : "实时模式"}
                </StatusPill>
              ) : null}
            </div>
          </div>

          <div className="radar-flow-lanes">
            {flowLanes.map((lane) => (
              <div className={`radar-flow-lane ${lane.key}`} key={lane.key}>
                <div>
                  <span>{lane.title}</span>
                  <strong>{lane.count}</strong>
                </div>
                <p>{lane.meta}</p>
                <small>{lane.detail}</small>
              </div>
            ))}
          </div>

          <div className="radar-terminal-grid">
            <div className="radar-terminal-panel radar-terminal-primary">
              <span>机会池</span>
              <strong>{visibleOpportunities.length}</strong>
              <p>全量 {scanResult?.totalScanned ?? "-"} · 候选 {opportunities.length}</p>
            </div>
            <div className="radar-terminal-panel">
              <span>多头 / 空头</span>
              <strong>{radarStats.bullish}/{radarStats.bearish}</strong>
              <p>按扫描方向分层</p>
            </div>
            <div className="radar-terminal-panel">
              <span>平均置信度</span>
              <strong>{radarStats.avgConfidence ? `${radarStats.avgConfidence.toFixed(0)}%` : "-"}</strong>
              <p>过滤器命中质量</p>
            </div>
            <div className="radar-terminal-panel">
              <span>高风险</span>
              <strong>{radarStats.highRisk}</strong>
              <p>需要二次确认的标的</p>
            </div>
            <div className="radar-terminal-panel">
              <span>队列成交额</span>
              <strong>${formatVolume(radarStats.topVolume)}</strong>
              <p>Top 队列合计流动性</p>
            </div>
          </div>

          <div className="radar-guard-grid">
            {guardCards.map((guard) => (
              <div className="radar-guard-card" key={guard.title}>
                <span>{guard.title}</span>
                <strong>{guard.value}</strong>
                <p>{guard.detail}</p>
              </div>
            ))}
          </div>

          <div className="radar-command-bar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索币种 / 交易对 / 标签"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Segmented
              value={signalFilter}
              onChange={(value) => setSignalFilter(String(value))}
              options={[
                { label: "全部", value: "all" },
                { label: "多头", value: "bullish" },
                { label: "空头", value: "bearish" },
                { label: "中性", value: "neutral" },
              ]}
            />
            <Select
              value={riskFilter}
              onChange={setRiskFilter}
              options={[
                { label: "全部风险", value: "all" },
                { label: "低风险", value: "low" },
                { label: "中风险", value: "medium" },
                { label: "高风险", value: "high" },
              ]}
            />
            <Select
              value={sortKey}
              onChange={setSortKey}
              options={[
                { label: "按机会强度", value: "score" },
                { label: "按置信度", value: "confidence" },
                { label: "按成交额", value: "volume" },
                { label: "按波动", value: "change" },
              ]}
            />
          </div>

          <div className="radar-playbook">
            <div>
              <span>Analyst Playbook</span>
              <p>{playbook}</p>
            </div>
            <Button onClick={() => navigate("/backtests")}>进入实验配置</Button>
          </div>

          {scanning && !opportunities.length ? (
            <div className="radar-state-box">
              <div className="radar-spinner" />
              <span>正在扫描高流动性标的...</span>
            </div>
          ) : scanError ? (
            <div className="radar-state-box error">
              <span>扫描失败：{scanError}</span>
              <Button onClick={() => void loadScan({ refresh: true })}>重试</Button>
            </div>
          ) : opportunities.length ? (
            <div className="radar-list">
              {visibleOpportunities.map((item, index) => (
                <RadarCard
                  key={`${item.symbol}-${item.rank ?? index}`}
                  item={item}
                  featured={index === 0}
                  onResearch={() => navigate(`/research?symbol=${encodeURIComponent(item.symbol)}`)}
                />
              ))}
            </div>
          ) : (
            <div className="radar-state-box">
              <span>暂无符合条件的机会，可调整筛选或稍后重试。</span>
            </div>
          )}
        </section>
      </div>
    </TradingPageShell>
  );
}
