from __future__ import annotations

from dashboard.catalog import SNAPSHOT_NAMES, offline_status
from dashboard.refresh import refresh_all
from dashboard.snapshot import list_snapshots


def test_snapshot_automation_reports_required_datasets() -> None:
    status = offline_status()
    assert status["ok"] is True
    assert status["total_count"] >= len(SNAPSHOT_NAMES)
    assert set(SNAPSHOT_NAMES).issubset(status["datasets"])

    for name in SNAPSHOT_NAMES:
        item = status["datasets"][name]
        assert item["active_layer"] in {"snapshot", "fixture", "none"}
        assert "complete" in item["snapshot"]
        assert "complete" in item["fixture"]


def test_snapshot_automation_keeps_metadata_and_history_counts() -> None:
    rows = [row for row in list_snapshots() if row["name"] in SNAPSHOT_NAMES]
    assert rows

    for row in rows:
        assert row["path"]
        assert "saved_at" in row
        assert "origin" in row
        assert "history_count" in row


def test_snapshot_refresh_dry_run_covers_registered_web3_news(monkeypatch) -> None:
    import dashboard.refresh as refresh

    def fake_fetch(name: str) -> dict[str, object]:
        if name == "web3_news":
            return {
                "ok": True,
                "source": "live",
                "updated_at": "2026-07-09T00:00:00+00:00",
                "sources": [],
                "source_cards": [
                    {
                        "dataset": "web3_news",
                        "source_name": "fixture",
                        "url_or_endpoint": "https://example.com/rss",
                        "fetched_at": "2026-07-09T00:00:00+00:00",
                        "payload_time": "2026-07-09T00:00:00+00:00",
                        "required_fields": ["title", "url", "published_at"],
                        "missing_fields": [],
                        "rate_limit_or_error": "",
                        "active_layer": "live",
                        "stale_threshold": "24h",
                        "allowed_draft_use": "只能作为草稿证据",
                    }
                ],
                "items": [
                    {
                        "source": "fixture",
                        "source_id": "fixture",
                        "title": "Bitcoin ETF inflow",
                        "url": "https://example.com/news",
                        "published_at": "2026-07-09T00:00:00+00:00",
                    }
                ],
            }
        return {"ok": True, "source": "live", "chance": [{"symbol": "BTC"}]}

    monkeypatch.setattr(refresh.dashboard_api, "ai_picks", lambda: fake_fetch("ai_picks"))
    monkeypatch.setattr(refresh.dashboard_api, "sector_fund", lambda days=1: {"ok": True, "source": "live", "sectors": [{"name": "DeFi"}]})
    monkeypatch.setattr(refresh.dashboard_api, "token_fund", lambda symbol="BTC": {"ok": True, "source": "live", "fund": {"symbol": symbol}})
    monkeypatch.setattr(refresh.dashboard_api, "onchain", lambda symbol="BTC": {"ok": True, "source": "live", "marketSentiment": {"fearGreed": {"value": 50}}})
    monkeypatch.setattr(refresh.dashboard_api, "web3_news", lambda limit=50, refresh=True: fake_fetch("web3_news"))
    monkeypatch.setattr(refresh, "fetch_full_dex_trending", lambda chain="solana": {"ok": True, "source": "live", "tokens": [{"symbol": "SOL"}]})
    monkeypatch.setattr(refresh, "fetch_full_market_tickers", lambda: {"ok": True, "source": "live", "tickers": [{"symbol": "BTC-USDT"}]})
    monkeypatch.setattr(refresh, "fetch_full_kucoin_markets", lambda: {"ok": True, "source": "live", "markets": [{"symbol": "BTC-USDT"}]})
    monkeypatch.setattr(refresh, "fetch_full_exchange_markets", lambda: {"ok": True, "source": "live", "markets": [{"symbol": "BTC-USDT"}]})
    monkeypatch.setattr(
        refresh,
        "fetch_full_opportunity_scan",
        lambda: {
            "ok": True,
            "source": "live",
            "opportunities": [
                {
                    "symbol": "BTC",
                    "signal": "watch",
                    "label": "watch",
                    "score": 1,
                    "confidence": 0.5,
                    "change24h": 0,
                    "volume24h": 1,
                    "rank": 1,
                }
            ],
        },
    )
    monkeypatch.setattr(refresh, "fetch_full_market_candles", lambda: {"ok": True, "source": "live", "curve": [1, 2, 3, 4, 5]})
    monkeypatch.setattr(refresh.valuescan, "configured", lambda: False)

    result = refresh_all(save=False, data_mode="auto")

    saved_names = {row["name"] for row in result["saved"]}
    assert "web3_news" in saved_names
    assert set(SNAPSHOT_NAMES).issubset(saved_names)


def test_research_draft_gate_keeps_draft_only_boundary() -> None:
    from dashboard.api import research_draft_gate

    gate = research_draft_gate(max_age_hours=24)

    assert gate["ok"] is True
    assert gate["draft_status"] == "draft_only"
    assert gate["human_review_required"] is True
    assert gate["decision"] in {"ready_for_human_review", "downgrade_to_observation", "stop_research"}
    assert "place live orders" in gate["prohibited_actions"]
    assert gate["total"] >= len(SNAPSHOT_NAMES)
    assert {row["name"] for row in gate["datasets"]}.issuperset(SNAPSHOT_NAMES)

def test_ai_picks_refresh_derives_from_opportunity_scan_when_valuescan_empty(monkeypatch) -> None:
    import dashboard.refresh as refresh

    monkeypatch.setattr(refresh.valuescan, "configured", lambda: True)
    monkeypatch.setattr(
        refresh.valuescan,
        "get_ai_picks",
        lambda: {"ok": True, "source": "live", "chance": [], "risk": [], "funds": []},
    )
    monkeypatch.setattr(
        refresh,
        "fetch_full_opportunity_scan",
        lambda: {
            "ok": True,
            "source": "live",
            "opportunities": [
                {
                    "symbol": "BTC",
                    "signal": "watch",
                    "label": "观察",
                    "score": 72,
                    "confidence": 0.68,
                    "change24h": 1.2,
                    "volume24h": 1000000,
                    "rank": 1,
                }
            ],
        },
    )

    payload = refresh._fetch_ai_picks_full()

    assert payload["source"] == "derived:opportunity_scan"
    assert payload["chance"][0]["symbol"] == "BTC"
    assert payload["chance"][0]["source"] == "opportunity_scan"

def test_research_draft_generates_draft_only_material(monkeypatch) -> None:
    from dashboard import api

    monkeypatch.setattr(api, "kline_analysis", lambda *args, **kwargs: {"ok": True, "trend": "震荡", "metrics": {"latestClose": 100, "rsi": 51, "volatilityPct": 2.1}})
    monkeypatch.setattr(api, "market_tickers", lambda *args, **kwargs: {"ok": True, "tickers": [{"symbol": "BTC-USDT", "last": 100, "changeRate": 0.01}]})
    monkeypatch.setattr(api, "web3_news", lambda *args, **kwargs: {"ok": True, "metrics": {"article_count": 3, "risk_event_count": 1, "source_breadth": 2, "top_topics": [("ETF", 2)]}})
    monkeypatch.setattr(api, "opportunity_scan", lambda *args, **kwargs: {"ok": True, "opportunities": [{"symbol": "BTC"}]})
    monkeypatch.setattr(api, "ai_picks", lambda *args, **kwargs: {"ok": True, "chance": [{"symbol": "ETH"}]})
    monkeypatch.setattr(api, "dex_trending", lambda *args, **kwargs: {"ok": True, "tokens": [{"symbol": "SOL"}]})
    monkeypatch.setattr(api, "onchain", lambda *args, **kwargs: {"ok": True, "marketSentiment": {"fearGreed": {"value": 50, "label": "Neutral"}}})

    draft = api.research_draft("BTC")

    assert draft["draft_status"] == "draft_only"
    assert draft["human_review_required"] is True
    assert any(section["id"] == "market_state" for section in draft["sections"])
    assert "place live orders" in draft["prohibited_actions"]

