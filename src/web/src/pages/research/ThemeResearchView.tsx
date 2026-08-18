import { ArrowRightOutlined, ClockCircleOutlined, DatabaseOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchWeb3Themes } from "../../api";
import type { Web3Theme, Web3ThemesPayload } from "../../types";

function compactDate(value?: string | null) {
  if (!value) return "时间未知";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(parsed);
}

function signalTone(value: string) {
  if (value === "升温" || value === "偏多") return "positive";
  if (value === "降温" || value === "偏空" || value === "证据过期") return "negative";
  return "neutral";
}

function sourceCount(theme: Web3Theme) {
  return theme.source_count ?? new Set(theme.evidence.map((item) => item.publisher || item.source).filter(Boolean)).size;
}

function evidenceScore(theme: Web3Theme) {
  return theme.evidence_score ?? Math.min(100, Math.round(theme.article_count / 8 * 55 + sourceCount(theme) / 4 * 25 + theme.evidence.length / 5 * 20));
}

function evidenceGrade(theme: Web3Theme) {
  const score = evidenceScore(theme);
  return theme.evidence_grade ?? (score >= 75 ? "较强" : score >= 50 ? "中等" : "偏弱");
}

function sentimentLabel(theme: Web3Theme) {
  return theme.sentiment_label ?? (theme.sentiment > 0.3 ? "偏多" : theme.sentiment < -0.3 ? "偏空" : "中性");
}

function sentimentCounts(theme: Web3Theme) {
  return theme.sentiment_counts ?? { positive: 0, neutral: theme.article_count, negative: 0 };
}

function momentum(theme: Web3Theme) {
  return theme.momentum ?? "待评估";
}

export default function ThemeResearchView() {
  const [payload, setPayload] = useState<Web3ThemesPayload | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (refresh = false) => {
    setLoading(true);
    setError("");
    void fetchWeb3Themes(100, { refresh })
      .then((data) => {
        setPayload(data);
        setSelectedSlug((current) => current || data.themes[0]?.slug || "");
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const themes = payload?.themes ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return themes.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      return !needle || `${item.title} ${item.summary} ${item.assets.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [category, query, themes]);
  const selected: Web3Theme | undefined = filtered.find((item) => item.slug === selectedSlug) ?? filtered[0];
  const stats = payload?.stats ?? {
    theme_count: themes.length,
    article_count: payload?.article_count ?? 0,
    publisher_count: new Set(themes.flatMap((theme) => theme.evidence.map((item) => item.publisher || item.source)).filter(Boolean)).size,
    risk_count: themes.reduce((sum, theme) => sum + theme.risk_count, 0),
  };

  return (
    <section className="research-paper research-theme-view">
      <header className="research-paper-header">
        <div>
          <span>WEB3 RESEARCH · {themes.length} THEMES</span>
          <h1>主题研究</h1>
          <p>只研究加密资产、链上协议与 Web3 基础设施 · 从采集证据追到催化剂和映射资产</p>
        </div>
        <div className="research-paper-tools">
          <Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索协议、主题或代币" />
          <Select value={category} onChange={setCategory} options={[{ value: "all", label: "全部 Web3 领域" }, ...(payload?.categories ?? []).map((item) => ({ value: item, label: item }))]} />
          <Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>刷新采集</Button>
        </div>
      </header>

      {error ? <Alert type="error" showIcon message="主题研究加载失败" description={error} /> : null}
      {loading && !payload ? <div className="research-loading"><Spin tip="正在整理 Web3 主题…" /></div> : null}

      {payload ? <>
        <div className="theme-research-overview" aria-label="主题研究概览">
          <div><span>活跃主题</span><strong>{stats.theme_count}</strong><small>当前分类覆盖</small></div>
          <div><span>有效证据</span><strong>{stats.article_count}</strong><small>Web3 过滤后</small></div>
          <div><span>发布来源</span><strong>{stats.publisher_count}</strong><small>按域名去重</small></div>
          <div className={stats.risk_count ? "risk" : ""}><span>风险事件</span><strong>{stats.risk_count}</strong><small>需优先复核</small></div>
        </div>

        <div className="theme-research-layout">
        <div className="theme-research-list" aria-live="polite">
          {filtered.map((item) => (
            <button key={item.slug} type="button" className={selected?.slug === item.slug ? "theme-research-row active" : "theme-research-row"} onClick={() => setSelectedSlug(item.slug)}>
              <span className="theme-research-date">{item.date}</span>
              <span className="theme-research-copy">
                <strong>{item.title}</strong>
                <small>{item.article_count} 条证据 · {sourceCount(item)} 个来源 · 更新于 {compactDate(item.latest_at ?? item.date)}</small>
                <span className="theme-row-signals">
                  <b className={`signal-${signalTone(momentum(item))}`}>{momentum(item)}</b>
                  <b className={`signal-${signalTone(sentimentLabel(item))}`}>{sentimentLabel(item)}</b>
                  {item.risk_count ? <b className="signal-negative">{item.risk_count} 风险</b> : null}
                </span>
              </span>
              <span className="theme-score"><b>{evidenceScore(item)}</b><small>证据分</small></span>
              <ArrowRightOutlined />
            </button>
          ))}
          {!filtered.length ? <div className="research-empty-state">没有匹配的 Web3 主题，请调整搜索条件。</div> : null}
        </div>

        {selected ? <aside className="theme-research-detail">
          <header className="theme-detail-header">
            <div>
              <span className="research-detail-kicker">{selected.category} · {selected.status}</span>
              <h2>{selected.title}</h2>
            </div>
            <div className="theme-conviction"><strong>{evidenceScore(selected)}</strong><span>证据强度</span><b>{evidenceGrade(selected)}</b></div>
          </header>

          <div className="theme-signal-grid">
            <div><ClockCircleOutlined /><span>主题动量</span><strong className={`signal-${signalTone(momentum(selected))}`}>{momentum(selected)}</strong><small>近 7 日 {selected.recent_count ?? "—"} 条 / 前期 {selected.previous_count ?? "—"} 条</small></div>
            <div><DatabaseOutlined /><span>来源覆盖</span><strong>{sourceCount(selected)}</strong><small>{selected.article_count} 条主题证据</small></div>
            <div><WarningOutlined /><span>情绪分歧</span><strong className={`signal-${signalTone(sentimentLabel(selected))}`}>{sentimentLabel(selected)}</strong><small>多 {sentimentCounts(selected).positive} · 中 {sentimentCounts(selected).neutral} · 空 {sentimentCounts(selected).negative}</small></div>
          </div>

          <div className="theme-research-thesis"><span>研究结论</span><strong>{selected.research_note ?? `共捕获 ${selected.article_count} 条主题证据，覆盖 ${sourceCount(selected)} 个来源；当前情绪判断为${sentimentLabel(selected)}。`}</strong><p>{selected.summary}</p></div>
          <div className="theme-detail-section"><strong>验证清单 <small>持续跟踪，未代表已兑现</small></strong><div className="research-chip-row">{selected.catalysts.map((item) => <span key={item}>{item}</span>)}</div></div>
          <div className="theme-detail-section"><strong>资产映射 <small>区分主题中的作用</small></strong><div className="theme-asset-map">{(selected.asset_map ?? selected.assets.map((symbol) => ({ symbol, role: "主题关联资产" }))).map((item) => <span key={item.symbol}><b>{item.symbol}</b><small>{item.role}</small></span>)}</div></div>
          <div className="theme-detail-section theme-evidence-list">
            <strong>证据账本 <small>可回溯到原始来源</small></strong>
            {selected.evidence.map((item) => <a key={`${item.url}-${item.title}`} href={item.url || undefined} target="_blank" rel="noreferrer">
              <span className="theme-evidence-meta"><b>{item.publisher || item.source || "来源"}</b><time>{compactDate(item.published_at)}</time>{item.risk_event ? <em>风险</em> : null}</span>
              <strong>{item.title}</strong>
              <small>{(item.assets ?? []).join(" · ") || "主题关联"} · 情绪 {item.sentiment && item.sentiment > 0 ? "+" : ""}{item.sentiment ?? 0}</small>
            </a>)}
          </div>
          <div className="theme-research-callout"><span>方法与边界</span><b>{payload.methodology ?? "证据强度用于研究排序，不代表投资评级；后台仅接受命中 Web3 词表、资产或协议分类的内容。"}</b></div>
        </aside> : null}
      </div>
      </> : null}
    </section>
  );
}
