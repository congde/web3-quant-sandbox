from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import backtest.investment_gate as investment_gate
from backtest.investment_gate import (
    HOLDOUT_BARS,
    STRATEGY_SPEC,
    _lagged_risk_budget_weights,
    _run_universe,
    evaluate_forward_validation,
    evaluate_investment_gate,
    load_gate_candles,
    validate_gate_data,
)
from backtest.rolling.registry import get_strategy


@lru_cache(maxsize=1)
def _result() -> dict:
    return evaluate_investment_gate()


def test_investment_gate_data_is_complete_and_aligned() -> None:
    quality = validate_gate_data()
    assert quality["passed"] is True
    assert quality["issues"] == []
    assert len(quality["datasets"]) == len(STRATEGY_SPEC["universe"])
    assert {row["rows"] for row in quality["datasets"]} == {1000}
    assert {row["unexpected_interval_gaps"] for row in quality["datasets"]} == {0}
    assert len({(row["first_date"], row["last_date"]) for row in quality["datasets"]}) == 1


def test_regime_trend_uses_no_future_candles() -> None:
    candles = load_gate_candles("BTCUSDT")
    strategy = get_strategy("regime_trend")
    params = strategy.default_params()
    index = 700
    full_signal = strategy.generate_signal(candles, index, params)
    truncated_signal = strategy.generate_signal(candles[: index + 1], index, params)
    assert full_signal == truncated_signal


def test_investment_gate_promotes_research_but_not_live_trading() -> None:
    result = _result()
    assert result["decision"] == "PROMOTE_RESEARCH"
    assert result["passed"] is True
    assert result["live_trading_authorized"] is False
    assert result["forward_validation"]["status"] == "WAITING_FOR_DATA"
    assert result["forward_validation"]["decision"] == "HOLD"
    assert result["forward_validation"]["live_trading_authorized"] is False
    assert result["evaluation"]["holdout"]["bars"] == HOLDOUT_BARS
    assert all(gate["passed"] for gate in result["gates"])


def test_forward_plan_is_frozen_and_waits_for_unseen_bars() -> None:
    result = evaluate_forward_validation()
    frozen_gate = next(
        gate for gate in result["gates"] if gate["gate"] == "strategy_frozen"
    )
    minimum_gate = next(
        gate
        for gate in result["gates"]
        if gate["gate"] == "minimum_forward_bars"
    )
    assert frozen_gate["passed"] is True
    assert minimum_gate["passed"] is False
    assert minimum_gate["value"] == 0
    assert {row["bars"] for row in result["windows"]} == {0}


def test_forward_gate_evaluates_new_bars_without_authorizing_live(
    monkeypatch,
) -> None:
    original_loader = investment_gate.load_gate_candles

    def load_with_flat_future(symbol: str) -> list[dict]:
        candles = deepcopy(original_loader(symbol))
        last = candles[-1]
        start = datetime.fromtimestamp(last["tsSec"], tz=timezone.utc)
        for offset in range(1, 91):
            future = deepcopy(last)
            point = start + timedelta(days=offset)
            future["tsSec"] = int(point.timestamp())
            future["date"] = point.strftime("%Y-%m-%d")
            candles.append(future)
        return candles

    monkeypatch.setattr(
        investment_gate, "load_gate_candles", load_with_flat_future
    )
    result = investment_gate.evaluate_forward_validation()
    assert result["status"] == "FORWARD_FAILED"
    assert result["decision"] == "HOLD"
    assert result["live_trading_authorized"] is False
    assert {row["bars"] for row in result["windows"]} == {90}


def test_investment_gate_metrics_reconcile_with_hard_thresholds() -> None:
    result = _result()
    portfolio = result["evaluation"]["portfolio"]
    benchmark = result["evaluation"]["benchmark"]
    assert portfolio["total_return_pct"] >= 5
    assert portfolio["sharpe_ratio"] >= 0.6
    assert portfolio["max_drawdown_pct"] <= 15
    assert portfolio["annualized_volatility_pct"] <= 20
    assert portfolio["max_gross_exposure"] <= 1
    assert portfolio["profitable_assets"] >= 3
    assert portfolio["total_return_pct"] - benchmark["total_return_pct"] >= 10
    assert benchmark["name"] == "同风险预算买入持有"
    assert benchmark["average_gross_exposure"] == portfolio["average_gross_exposure"]


def test_risk_budget_uses_only_returns_known_before_the_bar() -> None:
    runs = _run_universe(STRATEGY_SPEC["params"])
    original = _lagged_risk_budget_weights(runs, portfolio_index=0)
    shocked = deepcopy(runs)
    current_day_return_index = int(shocked[0]["_start_from"]) - 1
    shocked[0]["_market_returns"][current_day_return_index] = 10.0
    after_current_day_shock = _lagged_risk_budget_weights(
        shocked, portfolio_index=0
    )
    assert after_current_day_shock == original
