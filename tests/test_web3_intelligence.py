from dashboard.fixtures import load_offline
from dashboard.web3_intelligence import (
    build_knowledge_graph,
    build_macro_observation,
    build_theme_research,
)


def test_web3_theme_research_excludes_unrelated_items() -> None:
    payload = {
        "source": "test",
        "items": [
            {"title": "Bitcoin ETF inflows rise", "summary": "Crypto demand", "assets": ["BTC"], "published_at": "2026-07-20", "url": "https://example.com/btc"},
            {"title": "Advanced packaging capacity expands", "summary": "Semiconductor orders", "published_at": "2026-07-20", "url": "https://example.com/chips"},
        ],
    }
    result = build_theme_research(payload)

    assert result["scope"] == "web3-only"
    assert result["article_count"] == 1
    assert result["themes"][0]["slug"] == "bitcoin-institutional"
    assert all("packaging" not in theme["summary"].lower() for theme in result["themes"])


def test_web3_theme_research_exposes_auditable_research_signals() -> None:
    payload = {
        "source": "test",
        "items": [
            {
                "source": "Feed A",
                "title": "Bitcoin ETF inflows rise",
                "summary": "Institutional crypto demand",
                "assets": ["BTC"],
                "published_at": "2026-07-20T10:00:00+00:00",
                "url": "https://alpha.example.com/btc",
                "sentiment": 2,
                "risk_event": False,
            },
            {
                "source": "Feed B",
                "title": "Bitcoin ETF outflow risk returns",
                "summary": "Bitcoin institutional positioning weakens",
                "assets": ["BTC"],
                "published_at": "2026-07-15T10:00:00+00:00",
                "url": "https://beta.example.org/btc",
                "sentiment": -1,
                "risk_event": True,
            },
        ],
    }

    result = build_theme_research(payload)
    theme = result["themes"][0]

    assert theme["source_count"] == 2
    assert theme["sentiment_counts"] == {"positive": 1, "neutral": 0, "negative": 1}
    assert theme["risk_count"] == 1
    assert 0 <= theme["evidence_score"] <= 100
    assert theme["asset_map"][0] == {"symbol": "BTC", "role": "核心价格敞口"}
    assert theme["evidence"][0]["publisher"] == "alpha.example.com"
    assert result["stats"]["publisher_count"] == 2
    assert "投资评级" in result["methodology"]


def test_web3_theme_research_deduplicates_syndicated_headlines() -> None:
    payload = {
        "items": [
            {"title": "Bitcoin ETF inflows rise", "summary": "Crypto", "published_at": "20260720T100000Z", "url": "https://a.example/story"},
            {"title": "Bitcoin ETF inflows rise", "summary": "Crypto", "published_at": "20260720T090000Z", "url": "https://b.example/story"},
        ]
    }

    result = build_theme_research(payload)

    assert result["themes"][0]["article_count"] == 1
    assert result["stats"]["article_count"] == 1
    assert result["themes"][0]["date"] == "2026-07-20"


def test_web3_macro_contains_only_crypto_asset_cards() -> None:
    result = build_macro_observation(
        load_offline("web3_news"),
        load_offline("market_tickers"),
        load_offline("market_candles"),
        load_offline("onchain"),
    )

    assert {row["symbol"] for row in result["cards"]} == {"BTC-USDT", "ETH-USDT", "SOL-USDT"}
    assert all(row["category"] in {"核心资产", "公链生态"} for row in result["cards"])


def test_web3_macro_exposes_auditable_regime_without_proxy_history() -> None:
    result = build_macro_observation(
        load_offline("web3_news"),
        load_offline("market_tickers"),
        load_offline("market_candles"),
        load_offline("onchain"),
    )
    cards = {row["symbol"]: row for row in result["cards"]}

    assert cards["BTC-USDT"]["has_history"] is True
    assert len(cards["BTC-USDT"]["values"]) > 1
    assert cards["ETH-USDT"]["has_history"] is False
    assert cards["ETH-USDT"]["values"] == []
    assert cards["SOL-USDT"]["values"] == []
    assert 0 <= result["regime_score"] <= 100
    assert sum(driver["weight"] for driver in result["drivers"]) == 100
    assert 0 <= result["metrics"]["breadth_pct"] <= 100
    assert {condition["id"] for condition in result["conditions"]} == {"risk-on", "risk-off"}
    assert "BTC 代理曲线" in result["data_note"]


def test_web3_graph_is_protocol_only_and_has_valid_edges() -> None:
    result = build_knowledge_graph(load_offline("web3_news"))
    ids = {row["id"] for row in result["nodes"]}

    assert result["scope"] == "web3-only"
    assert "ethereum" in ids and "aave" in ids and "stablecoins" in ids
    assert all(edge["from"] in ids and edge["to"] in ids for edge in result["edges"])
    assert not any("semiconductor" in row["label"].lower() for row in result["nodes"])
