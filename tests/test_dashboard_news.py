import dashboard.news as news
from dashboard.news import build_web3_news_signal, fetch_web3_news, parse_rss_feed


def test_parse_rss_feed_extracts_items() -> None:
    xml = """<?xml version="1.0"?>
<rss><channel><item><title>Bitcoin ETF approval boosts ETH sentiment</title>
<link>https://example.com/a</link><description>DeFi growth</description>
<pubDate>Thu, 02 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>"""

    items = parse_rss_feed(xml, source_id="test", source_name="Test")

    assert items[0]["source"] == "Test"
    assert items[0]["title"].startswith("Bitcoin ETF")
    assert items[0]["published_at"] == "2026-07-02T00:00:00+00:00"


def test_build_web3_news_signal_tags_assets_topics_and_risk() -> None:
    payload = build_web3_news_signal(
        [
            {
                "source": "Test",
                "title": "Ethereum DeFi exploit triggers SEC review",
                "summary": "hack and stolen funds",
                "url": "https://example.com/risk",
            },
            {
                "source": "Test",
                "title": "Bitcoin ETF inflow sets record",
                "summary": "approval and adoption",
                "url": "https://example.com/good",
            },
        ],
        watch_symbols=["BTC", "ETH"],
    )

    assert payload["metrics"]["article_count"] == 2
    assert payload["metrics"]["risk_event_count"] == 1
    assert payload["factor_signals"]["asset_mention_count_24h"]["BTC"] == 1
    assert payload["items"][0]["assets"]


def test_fetch_web3_news_adds_source_cards(monkeypatch) -> None:
    rss_items = [
        {
            "source": "Test RSS",
            "source_id": "test-rss",
            "title": "Bitcoin ETF inflow sets record",
            "summary": "approval and adoption",
            "url": "https://example.com/good",
            "published_at": "2026-07-09T00:00:00+00:00",
        }
    ]
    gdelt_items = [
        {
            "source": "GDELT",
            "source_id": "gdelt",
            "title": "Ethereum bridge exploit triggers review",
            "summary": "hack and stolen funds",
            "url": "https://example.com/risk",
            "published_at": "2026-07-09T00:05:00+00:00",
        }
    ]
    monkeypatch.setattr(
        news,
        "fetch_rss_news",
        lambda: (
            rss_items,
            [{"id": "test-rss", "name": "Test RSS", "url": "https://example.com/rss", "ok": True, "count": 1}],
        ),
    )
    monkeypatch.setattr(
        news,
        "fetch_gdelt_news",
        lambda *, query, limit: (
            gdelt_items,
            {"id": "gdelt", "name": "GDELT", "url": "https://api.gdeltproject.org/api/v2/doc/doc", "ok": True, "count": 1},
        ),
    )

    payload = fetch_web3_news(watch_symbols=["BTC", "ETH"], limit=10)

    assert payload["source"] == "live"
    assert len(payload["source_cards"]) == 2
    assert payload["source_cards"][0]["dataset"] == "web3_news"
    assert payload["source_cards"][0]["missing_fields"] == []
    assert "不能单独生成研究结论" in payload["source_cards"][0]["allowed_draft_use"]
