from __future__ import annotations

from dashboard.signal_eval import CRITICAL_FAILURE_FIELDS, RUBRIC_WEIGHTS, score_llm_signal


def test_eval_rubric_weights_sum_to_100() -> None:
    assert sum(RUBRIC_WEIGHTS.values()) == 100
    assert set(RUBRIC_WEIGHTS) == {
        "json_valid",
        "evidence_refs",
        "admits_missing_data",
        "direction_stable",
        "clear_summary",
    }


def test_eval_critical_failures_are_hard_gates() -> None:
    base = {field: True for field in RUBRIC_WEIGHTS}
    for failure in CRITICAL_FAILURE_FIELDS:
        payload = score_llm_signal({**base, failure: True})
        assert payload["passed"] is False
        assert payload["score"] == 0
        assert payload["reason"] == "critical_failure"
        assert payload["criticalFailures"] == [failure]


def test_eval_threshold_separates_retest_from_pass() -> None:
    payload = score_llm_signal(
        {
            "json_valid": True,
            "evidence_refs": True,
            "admits_missing_data": True,
            "direction_stable": False,
            "clear_summary": False,
        }
    )
    assert payload["score"] == 65
    assert payload["passed"] is False

    retest = score_llm_signal(
        {
            "json_valid": True,
            "evidence_refs": True,
            "admits_missing_data": True,
            "direction_stable": True,
            "clear_summary": False,
        }
    )
    assert retest["score"] == 80
    assert retest["passed"] is True
