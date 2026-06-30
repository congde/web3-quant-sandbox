from __future__ import annotations

from backtest.research_path import run_research_path
from backtest.trace import run_teaching_scenario
from risk import ExecutionBoundaryRequest, classify_execution_request


def test_end_to_end_research_path_exposes_required_sections() -> None:
    payload = run_research_path(include_audit=True)
    assert payload["ok"] is True
    assert len(payload["path"]) >= 10
    assert payload["report_summary"]["trade_count"] > 0
    assert payload["rolling_summary"]["total_trades"] >= 0
    assert "realistic_cost_summary" in payload
    assert "audit_summary" in payload
    assert payload["risk_findings"]
    assert any("no live orders" in item for item in payload["assumptions"])


def test_teaching_scenario_keeps_fill_pending_and_risk_block_visible() -> None:
    payload = run_teaching_scenario()
    assert payload["ok"] is True
    assert payload["trades"]
    assert payload["pending_at_end"]
    assert payload["risk_rejections"]
    assert payload["risk_rejections"][0]["rule_id"] == "MAX_POSITION_PCT"


def test_simulation_boundary_never_promotes_real_order() -> None:
    result = classify_execution_request(
        ExecutionBoundaryRequest(
            symbol="WEB3-DEMO/USDT",
            signal="BUY",
            requested_action="real_order",
            capability="simulation_only",
            human_confirmed=True,
        )
    )
    assert result.allowed is False
    assert result.outcome == "blocked"
