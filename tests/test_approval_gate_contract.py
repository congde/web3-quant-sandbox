from __future__ import annotations

from decimal import Decimal

import pytest

from risk import (
    DEFAULT_RULE_IDS,
    ExecutionBoundaryRequest,
    RiskThresholdPatchError,
    classify_execution_request,
    default_risk_manager,
)


def test_default_risk_gate_order_keeps_emergency_halt_first() -> None:
    manager = default_risk_manager(initial_capital=Decimal("10000"))
    assert tuple(rule.rule_id for rule in manager.rules) == DEFAULT_RULE_IDS
    assert DEFAULT_RULE_IDS[0] == "EMERGENCY_HALT"


def test_real_order_is_stopline_even_with_human_confirmation() -> None:
    result = classify_execution_request(
        ExecutionBoundaryRequest(
            symbol="BTC/USDT",
            signal="BUY",
            requested_action="real_order",
            capability="simulation_only",
            human_confirmed=True,
        )
    )
    assert result.allowed is False
    assert result.outcome == "blocked"


def test_dry_run_requires_simulation_capability_and_confirmation() -> None:
    unconfirmed = classify_execution_request(
        ExecutionBoundaryRequest(
            symbol="BTC/USDT",
            signal="BUY",
            requested_action="dry_run_order",
            capability="simulation_only",
            human_confirmed=False,
        )
    )
    confirmed = classify_execution_request(
        ExecutionBoundaryRequest(
            symbol="BTC/USDT",
            signal="BUY",
            requested_action="dry_run_order",
            capability="simulation_only",
            human_confirmed=True,
        )
    )
    assert unconfirmed.outcome == "research_record"
    assert confirmed.outcome == "dry_run"


def test_threshold_patch_rejects_non_positive_approval_value() -> None:
    manager = default_risk_manager(initial_capital=Decimal("10000"))
    with pytest.raises(RiskThresholdPatchError, match="positive"):
        manager.patch_threshold("MAX_DAILY_LOSS_PCT", "max_drawdown_pct", Decimal("0"))
