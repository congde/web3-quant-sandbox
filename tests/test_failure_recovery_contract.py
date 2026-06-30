from __future__ import annotations

from dashboard.persist import annotate_cached, is_persistable_source
from dashboard.signal_eval import score_llm_signal
from risk import evaluate_backtest_risk


def test_cached_live_error_is_visible_and_not_repersisted() -> None:
    cached = annotate_cached(
        {
            "ok": True,
            "source": "snapshot",
            "snapshot": {"saved_at": "2026-06-13T00:00:00+00:00"},
        }
    )
    assert cached["live_error"] is True
    assert cached["cached_at"] == "2026-06-13T00:00:00+00:00"
    assert cached["source"] == "snapshot"
    assert is_persistable_source(cached) is False


def test_critical_eval_failure_blocks_delivery_record() -> None:
    row = {
        "json_valid": True,
        "evidence_refs": True,
        "admits_missing_data": True,
        "direction_stable": True,
        "clear_summary": True,
        "actionable_trade_advice": True,
    }
    result = score_llm_signal(row)
    assert result["passed"] is False
    assert result["score"] == 0
    assert result["criticalFailures"] == ["actionable_trade_advice"]


def test_runtime_risk_rejections_are_aggregated_for_audit() -> None:
    findings = evaluate_backtest_risk(
        {
            "metrics": {
                "maximum_drawdown_pct": -5.0,
                "strategy_return_pct": 1.0,
                "buy_hold_return_pct": 2.0,
                "trade_count": 1,
            },
            "curve": list(range(20)),
            "risk_rejections": [
                {"rule_id": "EMERGENCY_HALT", "reason": "manual halt"},
                {"rule_id": "EMERGENCY_HALT", "reason": "manual halt"},
            ],
        }
    )
    assert findings[0]["rule_id"] == "EMERGENCY_HALT"
    assert findings[0]["severity"] == "critical"
    assert findings[0]["phase"] == "pre_trade"
    assert findings[0]["count"] == 2
