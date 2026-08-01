from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import math
import re
import statistics
from typing import Any
from urllib.parse import urlparse

from dashboard.news import is_web3_news_item


THEME_RULES: tuple[dict[str, Any], ...] = (
    {
        "slug": "bitcoin-institutional",
        "name": "比特币机构化与 ETF 资金",
        "category": "比特币",
        "terms": ("bitcoin", "btc", "bitcoin etf", "spot etf", "institutional"),
        "assets": ("BTC",),
        "asset_roles": {"BTC": "核心价格敞口"},
        "catalysts": ("ETF 净流量", "机构持仓变化", "链上长期持有者行为"),
    },
    {
        "slug": "ethereum-staking-roadmap",
        "name": "以太坊升级、质押与再质押",
        "category": "以太坊生态",
        "terms": ("ethereum", "ether", "eth", "staking", "restaking", "eigenlayer"),
        "assets": ("ETH", "LDO", "EIGEN"),
        "asset_roles": {"ETH": "结算与质押底层", "LDO": "流动性质押", "EIGEN": "再质押基础设施"},
        "catalysts": ("协议升级", "质押净流入", "再质押风险参数"),
    },
    {
        "slug": "layer2-scaling",
        "name": "Layer2 扩容与链上执行迁移",
        "category": "扩容基础设施",
        "terms": ("layer 2", "l2", "rollup", "arbitrum", "optimism", "base", "zk"),
        "assets": ("ETH", "ARB", "OP"),
        "asset_roles": {"ETH": "结算层", "ARB": "Arbitrum 治理", "OP": "OP Stack 治理"},
        "catalysts": ("Blob 费用", "L2 活跃地址", "排序器收入"),
    },
    {
        "slug": "defi-liquidity-credit",
        "name": "DeFi 流动性、借贷与 DEX 竞争",
        "category": "DeFi",
        "terms": ("defi", "dex", "liquidity", "lending", "aave", "uniswap", "maker"),
        "assets": ("AAVE", "UNI", "MKR", "ETH"),
        "asset_roles": {"AAVE": "借贷协议", "UNI": "DEX 协议", "MKR": "稳定币信用", "ETH": "抵押与结算资产"},
        "catalysts": ("TVL 与净存款", "清算风险", "协议费收入"),
    },
    {
        "slug": "stablecoin-payments-rwa",
        "name": "稳定币支付、监管与 RWA",
        "category": "稳定币与 RWA",
        "terms": ("stablecoin", "usdt", "usdc", "tether", "circle", "rwa", "tokenized"),
        "assets": ("USDT", "USDC", "MKR"),
        "asset_roles": {"USDT": "稳定币供给", "USDC": "合规支付入口", "MKR": "链上信用与 RWA"},
        "catalysts": ("稳定币总供应", "支付渠道扩张", "监管框架"),
    },
    {
        "slug": "solana-app-ecosystem",
        "name": "Solana 应用生态与链上活跃度",
        "category": "Solana 生态",
        "terms": ("solana", " sol ", "depin", "jupiter", "phantom"),
        "assets": ("SOL", "JUP"),
        "asset_roles": {"SOL": "公链核心敞口", "JUP": "聚合交易入口"},
        "catalysts": ("活跃地址", "DEX 成交量", "客户端升级"),
    },
    {
        "slug": "protocol-security",
        "name": "协议安全、跨链桥与智能合约风险",
        "category": "安全与风控",
        "terms": ("hack", "exploit", "breach", "vulnerability", "bridge", "smart contract"),
        "assets": ("BTC", "ETH", "SOL"),
        "asset_roles": {"BTC": "市场风险代理", "ETH": "智能合约风险敞口", "SOL": "公链运行风险敞口"},
        "catalysts": ("漏洞披露", "资金追回", "审计与权限变更"),
    },
    {
        "slug": "crypto-regulation",
        "name": "加密监管、市场结构与合规入口",
        "category": "监管与合规",
        "terms": ("crypto regulation", "sec", "cftc", "compliance", "regulator", "lawsuit"),
        "assets": ("BTC", "ETH", "USDC"),
        "asset_roles": {"BTC": "机构与市场结构", "ETH": "协议与证券属性", "USDC": "合规稳定币入口"},
        "catalysts": ("立法进度", "执法行动", "交易与托管牌照"),
    },
)


def _text(item: dict[str, Any]) -> str:
    return f"{item.get('title', '')} {item.get('summary', '')}".lower()


def _matches_term(text: str, term: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(term.strip().lower())}(?![a-z0-9])", text) is not None


def is_web3_item(item: dict[str, Any]) -> bool:
    return is_web3_news_item(item)


def _date(value: Any) -> str:
    parsed = _published_datetime(value)
    return parsed.date().isoformat() if parsed else datetime.now(timezone.utc).date().isoformat()


def _published_datetime(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    for pattern in ("%Y%m%dT%H%M%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(raw, pattern)
            return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc).astimezone(timezone.utc)
    except ValueError:
        return None


def _publisher(item: dict[str, Any]) -> str:
    host = urlparse(str(item.get("url") or "")).hostname or ""
    return host.removeprefix("www.") or str(item.get("source") or "未知来源")


def _dedupe_stories(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse syndicated copies so repeated headlines do not inflate evidence."""
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        key = re.sub(r"[^a-z0-9]+", " ", str(item.get("title") or "").lower()).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _momentum_label(recent: int, previous: int, freshness_days: int) -> str:
    if freshness_days > 30:
        return "证据过期"
    if recent > previous:
        return "升温"
    if recent < previous:
        return "降温"
    return "平稳"


def build_theme_research(news_payload: dict[str, Any]) -> dict[str, Any]:
    items = [row for row in news_payload.get("items") or [] if isinstance(row, dict) and is_web3_item(row)]
    item_dates = [parsed for row in items if (parsed := _published_datetime(row.get("published_at")))]
    reference_time = max(item_dates, default=datetime.now(timezone.utc))
    themes: list[dict[str, Any]] = []
    for rule in THEME_RULES:
        matches = [row for row in items if any(_matches_term(_text(row), term) for term in rule["terms"])]
        if not matches:
            continue
        matches.sort(key=lambda row: str(row.get("published_at") or ""), reverse=True)
        matches = _dedupe_stories(matches)
        evidence = [
            {
                "title": row.get("title", ""),
                "url": row.get("url", ""),
                "source": row.get("source", ""),
                "publisher": _publisher(row),
                "published_at": row.get("published_at"),
                "sentiment": float(row.get("sentiment") or 0),
                "risk_event": bool(row.get("risk_event")),
                "assets": list(row.get("assets") or []),
            }
            for row in matches[:5]
        ]
        sentiments = [float(row.get("sentiment") or 0) for row in matches]
        risk_count = sum(bool(row.get("risk_event")) for row in matches)
        positive_count = sum(value > 0 for value in sentiments)
        negative_count = sum(value < 0 for value in sentiments)
        neutral_count = len(sentiments) - positive_count - negative_count
        publishers = {_publisher(row) for row in matches}
        matched_dates = [parsed for row in matches if (parsed := _published_datetime(row.get("published_at")))]
        latest_at = max(matched_dates, default=reference_time)
        freshness_days = max(0, (reference_time.date() - latest_at.date()).days)
        recent_count = sum((reference_time - parsed).days <= 7 for parsed in matched_dates)
        previous_count = sum(7 < (reference_time - parsed).days <= 14 for parsed in matched_dates)
        mentioned_assets = Counter(asset for row in matches for asset in (row.get("assets") or []))
        mapped_assets = list(dict.fromkeys([*mentioned_assets.keys(), *rule["assets"]]))[:8]
        evidence_score = round(
            min(len(matches), 8) / 8 * 35
            + min(len(publishers), 4) / 4 * 25
            + max(0, 1 - freshness_days / 30) * 20
            + min(len(mapped_assets), 4) / 4 * 10
            + min(len(evidence), 5) / 5 * 10
        )
        sentiment_score = round(sum(sentiments) / len(sentiments), 2)
        sentiment_label = "偏多" if sentiment_score > 0.3 else "偏空" if sentiment_score < -0.3 else "中性"
        lead = matches[0]
        themes.append(
            {
                "slug": rule["slug"],
                "title": rule["name"],
                "date": _date(lead.get("published_at")),
                "category": rule["category"],
                "summary": str(lead.get("summary") or lead.get("title") or "")[:260],
                "status": "风险跟踪" if risk_count else "持续更新",
                "catalysts": list(rule["catalysts"]),
                "assets": mapped_assets,
                "asset_map": [
                    {"symbol": asset, "role": rule["asset_roles"].get(asset, "新闻关联资产")}
                    for asset in mapped_assets
                ],
                "evidence": evidence,
                "article_count": len(matches),
                "source_count": len(publishers),
                "sentiment": sentiment_score,
                "sentiment_label": sentiment_label,
                "sentiment_counts": {"positive": positive_count, "neutral": neutral_count, "negative": negative_count},
                "risk_count": risk_count,
                "evidence_score": evidence_score,
                "evidence_grade": "较强" if evidence_score >= 75 else "中等" if evidence_score >= 50 else "偏弱",
                "freshness_days": freshness_days,
                "latest_at": latest_at.isoformat(),
                "recent_count": recent_count,
                "previous_count": previous_count,
                "momentum": _momentum_label(recent_count, previous_count, freshness_days),
                "research_note": (
                    f"共捕获 {len(matches)} 条主题证据，覆盖 {len(publishers)} 个发布来源；"
                    f"近 7 日新增 {recent_count} 条，情绪判断为{sentiment_label}，"
                    f"其中 {risk_count} 条被标记为风险事件。"
                ),
            }
        )
    themes.sort(key=lambda row: (row["date"], row["article_count"]), reverse=True)
    return {
        "ok": True,
        "scope": "web3-only",
        "source": news_payload.get("source", "offline"),
        "updated_at": news_payload.get("updated_at"),
        "themes": themes,
        "categories": sorted({row["category"] for row in themes}),
        "article_count": len(items),
        "stats": {
            "theme_count": len(themes),
            "article_count": len(_dedupe_stories(items)),
            "publisher_count": len({_publisher(row) for row in items}),
            "risk_count": sum(bool(row.get("risk_event")) for row in items),
        },
        "methodology": "证据强度由主题覆盖、发布来源分散度、相对最新样本的时效性、资产映射和可审计证据数量加权得到；仅用于研究排序，不代表投资评级。",
    }


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _period_return(closes: list[float], periods: int) -> float | None:
    if len(closes) <= periods or closes[-1 - periods] <= 0:
        return None
    return round((closes[-1] / closes[-1 - periods] - 1) * 100, 2)


def _realized_volatility(closes: list[float], periods: int = 30) -> float | None:
    sample = closes[-(periods + 1):]
    if len(sample) < 3:
        return None
    returns = [sample[index] / sample[index - 1] - 1 for index in range(1, len(sample)) if sample[index - 1] > 0]
    if len(returns) < 2:
        return None
    return round(statistics.stdev(returns) * math.sqrt(365) * 100, 2)


def _maximum_drawdown(closes: list[float], periods: int = 30) -> float | None:
    sample = closes[-periods:]
    if len(sample) < 2:
        return None
    peak = sample[0]
    worst = 0.0
    for value in sample:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return round(worst * 100, 2)


def _range_position(row: dict[str, Any]) -> float | None:
    low = float(row.get("low") or 0)
    high = float(row.get("high") or 0)
    last = float(row.get("last") or 0)
    if high <= low or last <= 0:
        return None
    return round(_clamp((last - low) / (high - low) * 100), 1)


def build_macro_observation(
    news_payload: dict[str, Any],
    ticker_payload: dict[str, Any],
    candle_payload: dict[str, Any],
    onchain_payload: dict[str, Any],
) -> dict[str, Any]:
    tickers = {
        str(row.get("symbol") or "").upper(): row
        for row in ticker_payload.get("tickers") or []
        if isinstance(row, dict)
    }
    candles = [row for row in candle_payload.get("candles") or [] if isinstance(row, dict)]
    closes = [float(row.get("close") or 0) for row in candles if float(row.get("close") or 0) > 0]
    btc_return_7d = _period_return(closes, 7)
    btc_return_30d = _period_return(closes, 30)
    btc_volatility_30d = _realized_volatility(closes)
    btc_drawdown_30d = _maximum_drawdown(closes)
    cards: list[dict[str, Any]] = []
    for symbol, name, category in (
        ("BTC-USDT", "比特币", "核心资产"),
        ("ETH-USDT", "以太坊", "核心资产"),
        ("SOL-USDT", "Solana", "公链生态"),
    ):
        row = tickers.get(symbol)
        if not row:
            continue
        last = float(row.get("last") or 0)
        has_history = symbol == "BTC-USDT" and bool(closes)
        cards.append(
            {
                "id": symbol.split("-")[0].lower(),
                "name": name,
                "symbol": symbol,
                "category": category,
                "value": last,
                "change_24h": round(float(row.get("changeRate") or 0) * 100, 2),
                "change_period": btc_return_30d if has_history else None,
                "values": [round(value, 6) for value in closes[-30:]] if has_history else [],
                "has_history": has_history,
                "period_label": "30日真实行情" if has_history else "24小时横截面",
                "series_origin": "market candles" if has_history else "ticker snapshot",
                "range_low": round(float(row.get("low") or 0), 6),
                "range_high": round(float(row.get("high") or 0), 6),
                "range_position_pct": _range_position(row),
                "return_7d": btc_return_7d if has_history else None,
                "volatility_30d": btc_volatility_30d if has_history else None,
                "max_drawdown_30d": btc_drawdown_30d if has_history else None,
            }
        )
    metrics = news_payload.get("metrics") or {}
    fear_greed = (((onchain_payload.get("marketSentiment") or {}).get("fearGreed") or {}))
    risk_count = int(metrics.get("risk_event_count") or 0)
    sentiment = float(metrics.get("sentiment_score") or 0)
    liquid_rows = sorted(
        [row for row in tickers.values() if float(row.get("last") or 0) > 0 and float(row.get("volValue") or 0) > 0],
        key=lambda row: float(row.get("volValue") or 0),
        reverse=True,
    )[:50]
    cross_section_returns = [float(row.get("changeRate") or 0) * 100 for row in liquid_rows]
    breadth_pct = round(sum(value > 0 for value in cross_section_returns) / len(cross_section_returns) * 100, 1) if cross_section_returns else 0.0
    median_change_pct = round(statistics.median(cross_section_returns), 2) if cross_section_returns else 0.0
    turnover_24h_usd = sum(float(row.get("volValue") or 0) for row in liquid_rows)
    fear_value = float(fear_greed.get("value") or 50)
    price_score = _clamp(50 + float(btc_return_30d or 0) * 3)
    breadth_score = breadth_pct
    appetite_score = _clamp(fear_value)
    news_score = _clamp(50 + sentiment * 20 - risk_count * 2.5)
    regime_score = round(price_score * 0.35 + breadth_score * 0.25 + appetite_score * 0.25 + news_score * 0.15)
    regime = "risk-off" if regime_score < 40 else "risk-on" if regime_score > 60 else "neutral"
    regime_label = "防御" if regime == "risk-off" else "进攻" if regime == "risk-on" else "中性"
    confidence_score = 78 if closes and liquid_rows and fear_greed and metrics else 58
    confidence_label = "较高" if confidence_score >= 75 else "中等"
    drivers = [
        {
            "id": "btc-trend", "label": "BTC 价格趋势", "score": round(price_score), "weight": 35,
            "direction": "positive" if price_score > 55 else "negative" if price_score < 45 else "neutral",
            "value": f"{float(btc_return_30d or 0):+.2f}%", "detail": "30日真实收盘价收益",
        },
        {
            "id": "market-breadth", "label": "市场宽度", "score": round(breadth_score), "weight": 25,
            "direction": "positive" if breadth_score > 55 else "negative" if breadth_score < 45 else "neutral",
            "value": f"{breadth_pct:.1f}%", "detail": "高流动性样本中24小时上涨占比",
        },
        {
            "id": "risk-appetite", "label": "风险偏好", "score": round(appetite_score), "weight": 25,
            "direction": "positive" if appetite_score > 55 else "negative" if appetite_score < 45 else "neutral",
            "value": f"{fear_value:.0f}", "detail": f"恐惧贪婪指数 · 日变动 {float(fear_greed.get('change') or 0):+.0f}",
        },
        {
            "id": "news-risk", "label": "事件风险", "score": round(news_score), "weight": 15,
            "direction": "positive" if news_score > 55 else "negative" if news_score < 45 else "neutral",
            "value": f"{risk_count} 条", "detail": f"新闻情绪 {sentiment:+.2f}",
        },
    ]
    top_topics = [str(row[0]) for row in metrics.get("top_topics") or [] if isinstance(row, (list, tuple)) and row]
    events = []
    for row in news_payload.get("items") or []:
        if isinstance(row, dict) and is_web3_item(row) and (row.get("risk_event") or row.get("sentiment")):
            events.append({
                "date": _date(row.get("published_at")), "title": row.get("title", ""),
                "source": row.get("source", ""), "url": row.get("url", ""),
                "risk": bool(row.get("risk_event")),
            })
        if len(events) >= 4:
            break
    return {
        "ok": True,
        "scope": "web3-only",
        "source": news_payload.get("source", "offline"),
        "updated_at": news_payload.get("updated_at"),
        "regime": regime,
        "regime_label": regime_label,
        "regime_score": regime_score,
        "confidence_score": confidence_score,
        "confidence_label": confidence_label,
        "labels": [f"市场状态：{regime_label}", f"风险偏好：{fear_greed.get('label', 'unknown')}", *top_topics[:2]],
        "thesis": (
            f"综合状态分 {regime_score}/100，当前处于{regime_label}区间。"
            f"BTC 30日收益 {float(btc_return_30d or 0):+.2f}%，高流动性样本上涨宽度 {breadth_pct:.1f}%，"
            f"恐惧贪婪指数 {fear_value:.0f}；新闻侧记录 {risk_count} 条风险事件。"
        ),
        "drivers": drivers,
        "metrics": {
            "fear_greed": round(fear_value),
            "fear_greed_change": round(float(fear_greed.get("change") or 0), 1),
            "breadth_pct": breadth_pct,
            "median_change_pct": median_change_pct,
            "btc_return_7d": btc_return_7d,
            "btc_return_30d": btc_return_30d,
            "btc_volatility_30d": btc_volatility_30d,
            "btc_drawdown_30d": btc_drawdown_30d,
            "turnover_24h_usd": round(turnover_24h_usd, 2),
            "risk_event_count": risk_count,
        },
        "conditions": [
            {
                "id": "risk-on", "label": "升级为进攻", "status": regime_score > 60,
                "rule": "状态分 > 60，且上涨宽度与风险偏好同步改善",
            },
            {
                "id": "risk-off", "label": "降级为防御", "status": regime_score < 40,
                "rule": "状态分 < 40，或价格趋势与市场宽度同时恶化",
            },
        ],
        "categories": ["总览", "核心资产", "公链生态"],
        "cards": cards,
        "events": events,
        "data_quality": {
            "coverage": "BTC 使用真实日线；市场宽度来自成交额前50个有效交易对；风险偏好来自恐惧贪婪快照。",
            "limitations": "ETH/SOL 当前只有24小时行情快照，不绘制伪历史曲线；尚未接入利率、美元流动性、稳定币供给和永续资金费率历史。",
        },
        "data_note": "BTC 展示真实日线；ETH/SOL 仅展示24小时区间位置，避免把 BTC 代理曲线误读为独立历史行情。",
        "methodology": "状态分按 BTC 30日趋势35%、高流动性市场宽度25%、恐惧贪婪25%、新闻事件风险15%加权；仅用于研究状态划分，不构成择时或交易建议。",
    }


GRAPH_NODES: tuple[dict[str, Any], ...] = (
    {"id": "btc", "label": "Bitcoin", "stage": "结算与共识", "domain": "比特币生态", "risk": "normal", "entities": ["BTC", "Lightning"]},
    {"id": "ethereum", "label": "Ethereum", "stage": "结算与共识", "domain": "以太坊生态", "risk": "normal", "entities": ["ETH", "EVM"]},
    {"id": "solana", "label": "Solana", "stage": "结算与共识", "domain": "Solana 生态", "risk": "medium", "entities": ["SOL", "Firedancer"]},
    {"id": "celestia", "label": "Celestia DA", "stage": "数据与互操作", "domain": "模块化基础设施", "risk": "medium", "entities": ["TIA", "Data Availability"]},
    {"id": "chainlink", "label": "Chainlink Oracle", "stage": "数据与互操作", "domain": "预言机与互操作", "risk": "normal", "entities": ["LINK", "CCIP"]},
    {"id": "bridges", "label": "跨链桥", "stage": "数据与互操作", "domain": "预言机与互操作", "risk": "critical", "entities": ["LayerZero", "Wormhole"]},
    {"id": "arbitrum", "label": "Arbitrum", "stage": "执行与扩容", "domain": "Layer2", "risk": "medium", "entities": ["ARB", "Orbit"]},
    {"id": "optimism", "label": "OP Stack", "stage": "执行与扩容", "domain": "Layer2", "risk": "medium", "entities": ["OP", "Superchain"]},
    {"id": "base", "label": "Base", "stage": "执行与扩容", "domain": "Layer2", "risk": "normal", "entities": ["Base", "Coinbase"]},
    {"id": "eigenlayer", "label": "EigenLayer", "stage": "安全与服务", "domain": "质押与再质押", "risk": "high", "entities": ["EIGEN", "AVS"]},
    {"id": "lido", "label": "Lido", "stage": "安全与服务", "domain": "质押与再质押", "risk": "medium", "entities": ["LDO", "stETH"]},
    {"id": "aave", "label": "Aave", "stage": "协议与应用", "domain": "DeFi", "risk": "medium", "entities": ["AAVE", "Lending"]},
    {"id": "uniswap", "label": "Uniswap", "stage": "协议与应用", "domain": "DeFi", "risk": "normal", "entities": ["UNI", "DEX"]},
    {"id": "maker", "label": "Sky / Maker", "stage": "协议与应用", "domain": "稳定币与 RWA", "risk": "medium", "entities": ["MKR", "DAI", "USDS"]},
    {"id": "stablecoins", "label": "稳定币网络", "stage": "协议与应用", "domain": "稳定币与 RWA", "risk": "medium", "entities": ["USDT", "USDC"]},
)

GRAPH_EDGES: tuple[tuple[str, str, str], ...] = (
    ("ethereum", "arbitrum", "结算"), ("ethereum", "optimism", "结算"), ("optimism", "base", "技术栈"),
    ("celestia", "arbitrum", "数据可用性"), ("chainlink", "aave", "价格数据"), ("chainlink", "bridges", "跨链消息"),
    ("bridges", "arbitrum", "资产跨链"), ("bridges", "solana", "资产跨链"), ("ethereum", "eigenlayer", "再质押"),
    ("ethereum", "lido", "质押"), ("lido", "aave", "抵押品"), ("arbitrum", "uniswap", "部署"),
    ("base", "uniswap", "部署"), ("ethereum", "maker", "抵押结算"), ("maker", "stablecoins", "稳定币"),
    ("btc", "bridges", "封装资产"), ("stablecoins", "aave", "流动性"), ("stablecoins", "uniswap", "交易对"),
)


def build_knowledge_graph(news_payload: dict[str, Any]) -> dict[str, Any]:
    news_items = [row for row in news_payload.get("items") or [] if isinstance(row, dict) and is_web3_item(row)]
    nodes = []
    for template in GRAPH_NODES:
        aliases = [template["label"], *template["entities"]]
        evidence = [
            {"title": row.get("title", ""), "url": row.get("url", ""), "source": row.get("source", "")}
            for row in news_items
            if any(re.search(rf"\b{re.escape(alias.lower())}\b", _text(row)) for alias in aliases)
        ][:4]
        nodes.append({**template, "evidence": evidence, "mentions": len(evidence)})
    domains = Counter(row["domain"] for row in nodes)
    return {
        "ok": True,
        "scope": "web3-only",
        "source": news_payload.get("source", "offline"),
        "updated_at": news_payload.get("updated_at"),
        "stages": ["结算与共识", "数据与互操作", "执行与扩容", "安全与服务", "协议与应用"],
        "domains": [{"name": name, "count": count} for name, count in domains.items()],
        "nodes": nodes,
        "edges": [{"from": source, "to": target, "relation": relation} for source, target, relation in GRAPH_EDGES],
        "stats": {
            "nodes": len(nodes), "edges": len(GRAPH_EDGES),
            "risks": sum(row["risk"] in {"high", "critical"} for row in nodes),
            "entities": len({entity for row in nodes for entity in row["entities"]}),
        },
    }
