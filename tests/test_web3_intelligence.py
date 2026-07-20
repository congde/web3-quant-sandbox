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


def test_web3_macro_contains_only_crypto_asset_cards() -> None:
    result = build_macro_observation(
        load_offline("web3_news"),
        load_offline("market_tickers"),
        load_offline("market_candles"),
        load_offline("onchain"),
    )

    assert {row["symbol"] for row in result["cards"]} == {"BTC-USDT", "ETH-USDT", "SOL-USDT"}
    assert all(row["category"] in {"核心资产", "公链生态"} for row in result["cards"])


def test_web3_graph_is_protocol_only_and_has_valid_edges() -> None:
    result = build_knowledge_graph(load_offline("web3_news"))
    ids = {row["id"] for row in result["nodes"]}

    assert result["scope"] == "web3-only"
    assert "ethereum" in ids and "aave" in ids and "stablecoins" in ids
    assert all(edge["from"] in ids and edge["to"] in ids for edge in result["edges"])
    assert not any("semiconductor" in row["label"].lower() for row in result["nodes"])
