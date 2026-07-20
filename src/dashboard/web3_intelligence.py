from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import re
from typing import Any

from dashboard.news import is_web3_news_item


THEME_RULES: tuple[dict[str, Any], ...] = (
    {
        "slug": "bitcoin-institutional",
        "name": "比特币机构化与 ETF 资金",
        "category": "比特币",
        "terms": ("bitcoin", "btc", "bitcoin etf", "spot etf", "institutional"),
        "assets": ("BTC",),
        "catalysts": ("ETF 净流量", "机构持仓变化", "链上长期持有者行为"),
    },
    {
        "slug": "ethereum-staking-roadmap",
        "name": "以太坊升级、质押与再质押",
        "category": "以太坊生态",
        "terms": ("ethereum", "ether", "eth", "staking", "restaking", "eigenlayer"),
        "assets": ("ETH", "LDO", "EIGEN"),
        "catalysts": ("协议升级", "质押净流入", "再质押风险参数"),
    },
    {
        "slug": "layer2-scaling",
        "name": "Layer2 扩容与链上执行迁移",
        "category": "扩容基础设施",
        "terms": ("layer 2", "l2", "rollup", "arbitrum", "optimism", "base", "zk"),
        "assets": ("ETH", "ARB", "OP"),
        "catalysts": ("Blob 费用", "L2 活跃地址", "排序器收入"),
    },
    {
        "slug": "defi-liquidity-credit",
        "name": "DeFi 流动性、借贷与 DEX 竞争",
        "category": "DeFi",
        "terms": ("defi", "dex", "liquidity", "lending", "aave", "uniswap", "maker"),
        "assets": ("AAVE", "UNI", "MKR", "ETH"),
        "catalysts": ("TVL 与净存款", "清算风险", "协议费收入"),
    },
    {
        "slug": "stablecoin-payments-rwa",
        "name": "稳定币支付、监管与 RWA",
        "category": "稳定币与 RWA",
        "terms": ("stablecoin", "usdt", "usdc", "tether", "circle", "rwa", "tokenized"),
        "assets": ("USDT", "USDC", "MKR"),
        "catalysts": ("稳定币总供应", "支付渠道扩张", "监管框架"),
    },
    {
        "slug": "solana-app-ecosystem",
        "name": "Solana 应用生态与链上活跃度",
        "category": "Solana 生态",
        "terms": ("solana", " sol ", "depin", "jupiter", "phantom"),
        "assets": ("SOL", "JUP"),
        "catalysts": ("活跃地址", "DEX 成交量", "客户端升级"),
    },
    {
        "slug": "protocol-security",
        "name": "协议安全、跨链桥与智能合约风险",
        "category": "安全与风控",
        "terms": ("hack", "exploit", "breach", "vulnerability", "bridge", "smart contract"),
        "assets": ("BTC", "ETH", "SOL"),
        "catalysts": ("漏洞披露", "资金追回", "审计与权限变更"),
    },
    {
        "slug": "crypto-regulation",
        "name": "加密监管、市场结构与合规入口",
        "category": "监管与合规",
        "terms": ("crypto regulation", "sec", "cftc", "compliance", "regulator", "lawsuit"),
        "assets": ("BTC", "ETH", "USDC"),
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
    raw = str(value or "")
    return raw[:10] if len(raw) >= 10 else datetime.now(timezone.utc).date().isoformat()


def build_theme_research(news_payload: dict[str, Any]) -> dict[str, Any]:
    items = [row for row in news_payload.get("items") or [] if isinstance(row, dict) and is_web3_item(row)]
    themes: list[dict[str, Any]] = []
    for rule in THEME_RULES:
        matches = [row for row in items if any(_matches_term(_text(row), term) for term in rule["terms"])]
        if not matches:
            continue
        matches.sort(key=lambda row: str(row.get("published_at") or ""), reverse=True)
        evidence = [
            {
                "title": row.get("title", ""),
                "url": row.get("url", ""),
                "source": row.get("source", ""),
                "published_at": row.get("published_at"),
            }
            for row in matches[:5]
        ]
        sentiments = [float(row.get("sentiment") or 0) for row in matches]
        risk_count = sum(bool(row.get("risk_event")) for row in matches)
        mentioned_assets = Counter(asset for row in matches for asset in (row.get("assets") or []))
        mapped_assets = list(dict.fromkeys([*mentioned_assets.keys(), *rule["assets"]]))[:8]
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
                "evidence": evidence,
                "article_count": len(matches),
                "sentiment": round(sum(sentiments) / len(sentiments), 2),
                "risk_count": risk_count,
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
    }


def _normalized_curve(candles: list[dict[str, Any]], last: float, multiplier: float) -> list[float]:
    closes = [float(row.get("close") or 0) for row in candles[-30:] if float(row.get("close") or 0) > 0]
    if not closes:
        return [last]
    base = closes[-1]
    return [round(last * (1 + ((value / base) - 1) * multiplier), 6) for value in closes]


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
    cards: list[dict[str, Any]] = []
    for symbol, name, category, multiplier in (
        ("BTC-USDT", "比特币", "核心资产", 1.0),
        ("ETH-USDT", "以太坊", "核心资产", 1.15),
        ("SOL-USDT", "Solana", "公链生态", 1.45),
    ):
        row = tickers.get(symbol)
        if not row:
            continue
        last = float(row.get("last") or 0)
        values = _normalized_curve(candles, last, multiplier)
        quarter = ((values[-1] / values[0]) - 1) * 100 if len(values) > 1 and values[0] else 0.0
        cards.append(
            {
                "id": symbol.split("-")[0].lower(),
                "name": name,
                "symbol": symbol,
                "category": category,
                "value": last,
                "change_24h": round(float(row.get("changeRate") or 0) * 100, 2),
                "change_period": round(quarter, 2),
                "values": values,
                "series_origin": "market candles" if symbol == "BTC-USDT" else "BTC normalized proxy",
            }
        )
    metrics = news_payload.get("metrics") or {}
    fear_greed = (((onchain_payload.get("marketSentiment") or {}).get("fearGreed") or {}))
    risk_count = int(metrics.get("risk_event_count") or 0)
    sentiment = float(metrics.get("sentiment_score") or 0)
    regime = "risk-off" if risk_count >= 3 or sentiment < -0.5 else "risk-on" if sentiment > 0.5 else "neutral"
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
        "labels": [f"crypto_regime:{regime}", f"fear_greed:{fear_greed.get('label', 'unknown')}", *top_topics[:2]],
        "thesis": f"加密市场新闻情绪 {sentiment:+.2f}，风险事件 {risk_count} 条；恐惧贪婪指数为 {fear_greed.get('value', '—')}（{fear_greed.get('label', '暂无')}）。仅展示与链上资产、协议和加密流动性直接相关的观察。",
        "categories": ["总览", "核心资产", "公链生态"],
        "cards": cards,
        "events": events,
        "data_note": "BTC 使用离线日线；ETH/SOL 在离线模式下使用 BTC 归一化路径并锚定各自最新价格，不作为独立历史行情。",
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
