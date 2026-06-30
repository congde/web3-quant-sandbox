from __future__ import annotations

from dashboard.signal_eval import score_llm_signal


def test_score_llm_signal_passes_complete_sample() -> None:
    payload = score_llm_signal(
        {
            "json_valid": True,
            "evidence_refs": True,
            "admits_missing_data": True,
            "direction_stable": True,
            "clear_summary": True,
        }
    )
    assert payload == {
        "passed": True,
        "score": 100,
        "reason": "scored",
        "criticalFailures": [],
    }


def test_score_llm_signal_blocks_critical_failure() -> None:
    payload = score_llm_signal(
        {
            "json_valid": True,
            "evidence_refs": True,
            "admits_missing_data": True,
            "direction_stable": True,
            "clear_summary": True,
            "uses_future_data": True,
        }
    )
    assert payload["passed"] is False
    assert payload["score"] == 0
    assert payload["reason"] == "critical_failure"
    assert payload["criticalFailures"] == ["uses_future_data"]
