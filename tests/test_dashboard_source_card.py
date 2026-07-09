from __future__ import annotations

from dashboard.source_card import external_source_card, source_card_from_manifest, validate_market_row


def test_validate_market_row_requires_source_time_and_positive_close() -> None:
    assert validate_market_row({"source": "fixture", "observed_at": "2026-06-20T00:00:00Z", "close": 100}) == []
    assert validate_market_row({"close": 0}) == [
        "missing source",
        "missing observed_at",
        "invalid close",
    ]


def test_source_card_from_manifest_keeps_limits_visible() -> None:
    manifest = {
        "datasets": {
            "market_tickers": {
                "origin": "snapshot",
                "updated_at": "2026-06-20T02:54:22+00:00",
                "path": "data/dashboard/snapshots/market_tickers.json",
                "complete": True,
                "reason": "",
            }
        }
    }

    card = source_card_from_manifest("market_tickers", manifest)

    assert card.domain == "行情"
    assert card.origin == "snapshot"
    assert card.complete is True
    assert "样本事实" in card.can_answer
    assert "实盘执行指令" in card.cannot_answer


def test_external_source_card_exposes_freshness_missing_fields_and_boundaries() -> None:
    card = external_source_card(
        "web3_news",
        {"id": "gdelt", "name": "GDELT", "url": "https://api.gdeltproject.org/api/v2/doc/doc", "ok": True},
        fetched_at="2026-07-09T00:00:00+00:00",
        items=[
            {
                "source": "GDELT",
                "source_id": "gdelt",
                "title": "Bridge exploit raises security concerns",
                "url": "https://example.com/risk",
                "published_at": "2026-07-08T23:30:00+00:00",
            }
        ],
        required_fields=("source", "source_id", "title", "url", "published_at"),
    )

    assert card.dataset == "web3_news"
    assert card.payload_time == "2026-07-08T23:30:00+00:00"
    assert card.missing_fields == []
    assert card.active_layer == "live"
    assert "不能单独生成研究结论" in card.allowed_draft_use


def test_external_source_card_marks_source_errors_and_missing_items() -> None:
    card = external_source_card(
        "web3_news",
        {"id": "gdelt", "name": "GDELT", "url": "https://api.gdeltproject.org/api/v2/doc/doc", "ok": False, "error": "HTTP 429"},
        fetched_at="2026-07-09T00:00:00+00:00",
        items=[],
    )

    assert card.active_layer == "error"
    assert card.rate_limit_or_error == "HTTP 429"
    assert "items" in card.missing_fields
