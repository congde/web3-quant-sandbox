from __future__ import annotations

from dashboard.signal_eval import CRITICAL_FAILURE_FIELDS, RUBRIC_WEIGHTS, score_llm_signal
from scripts.generate_chapter31_figures import REQUIRED_SAMPLES, eval_rows, promotion_decision, version_summary


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


def test_chapter31_candidates_cover_the_same_sample_set() -> None:
    rows = eval_rows()
    versions = {row["version"] for row in rows}
    for version in versions:
        samples = {row["sample"] for row in rows if row["version"] == version}
        assert samples == set(REQUIRED_SAMPLES)


def test_chapter31_summary_applies_coverage_and_critical_gates() -> None:
    summary = {row["version"]: row for row in version_summary()}
    assert summary["baseline"]["coverage"] == 1
    assert summary["strategy-gate"]["coverage"] == 1
    assert summary["baseline"]["decision"] == "PROMOTE"
    assert summary["strategy-gate"]["decision"] == "PROMOTE"
    assert summary["prompt-v2"]["critical"] == 1
    assert summary["model-b"]["critical"] == 1
    assert summary["prompt-v2"]["decision"] == "REJECT"
    assert summary["model-b"]["decision"] == "REJECT"


def test_chapter31_incomplete_coverage_cannot_promote() -> None:
    decision = promotion_decision(
        avg_score=95,
        std_score=2,
        critical=0,
        pass_rate=1,
        coverage=0.5,
    )
    assert decision == "RETEST"
