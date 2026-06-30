from __future__ import annotations

from backtest.research_path import run_research_path
from backtest.rolling.service import run_cpcv_service, run_robustness_audit


def test_research_path_integrates_audit_and_cost_layers() -> None:
    payload = run_research_path(include_audit=True)
    assert payload["ok"] is True
    names = [item["name"] for item in payload["path"]]
    assert "research_report" in names
    assert "rolling_backtest" in names
    assert "realistic_cost_backtest" in names
    assert "risk_review" in names
    assert "walk_forward_audit" in names
    assert "robustness_audit" in names
    assert payload["unified_metrics"]
    assert payload["audit_summary"]["num_trials"] >= 1


def test_research_path_exposes_stopline_audit_metrics() -> None:
    robustness = run_robustness_audit(strategy_name="ma_crossover", limit=120)
    cpcv = run_cpcv_service(strategy_name="ma_crossover", limit=120)
    assert robustness["ok"] is True
    assert "pbo" in robustness
    assert "parameter_sensitivity" in robustness
    assert cpcv["ok"] is True
    assert "sharpe_p50" in cpcv["cpcv"]
