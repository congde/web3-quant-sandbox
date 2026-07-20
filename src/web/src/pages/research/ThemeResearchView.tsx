import { ArrowRightOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { fetchWeb3Themes } from "../../api";
import type { Web3Theme, Web3ThemesPayload } from "../../types";

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
  const selected: Web3Theme | undefined = themes.find((item) => item.slug === selectedSlug) ?? filtered[0];

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

      {payload ? <div className="theme-research-layout">
        <div className="theme-research-list" aria-live="polite">
          {filtered.map((item) => (
            <button key={item.slug} type="button" className={selected?.slug === item.slug ? "theme-research-row active" : "theme-research-row"} onClick={() => setSelectedSlug(item.slug)}>
              <span className="theme-research-date">{item.date}</span>
              <span className="theme-research-copy"><strong>{item.title}</strong><small>{item.article_count} 条证据 · sentiment {item.sentiment >= 0 ? "+" : ""}{item.sentiment}</small></span>
              <span className="theme-research-category">{item.category}</span>
              <ArrowRightOutlined />
            </button>
          ))}
          {!filtered.length ? <div className="research-empty-state">没有匹配的 Web3 主题，请调整搜索条件。</div> : null}
        </div>

        {selected ? <aside className="theme-research-detail">
          <span className="research-detail-kicker">{selected.category} · {selected.status}</span>
          <h2>{selected.title}</h2>
          <p>{selected.summary}</p>
          <div className="theme-detail-section"><strong>关键催化</strong><div className="research-chip-row">{selected.catalysts.map((item) => <span key={item}>{item}</span>)}</div></div>
          <div className="theme-detail-section"><strong>映射资产</strong><div className="research-chip-row assets">{selected.assets.map((item) => <span key={item}>{item}</span>)}</div></div>
          <div className="theme-detail-section theme-evidence-list"><strong>采集证据</strong>{selected.evidence.map((item) => <a key={`${item.url}-${item.title}`} href={item.url || undefined} target="_blank" rel="noreferrer"><span>{item.source || "来源"}</span>{item.title}</a>)}</div>
          <div className="theme-research-callout"><span>数据边界</span><b>后台仅接受命中 Web3 词表、资产或协议分类的内容；传统股票产业、商品和泛宏观新闻不会进入本页。</b></div>
        </aside> : null}
      </div> : null}
    </section>
  );
}
