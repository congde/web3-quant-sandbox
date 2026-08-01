from __future__ import annotations

import pytest

from backtest.rolling.metrics import compute_monte_carlo_95
from backtest.rolling.service import execute_backtest


def test_backtest_exposes_professional_diagnostics() -> None:
    payload = execute_backtest(
        strategy_name="ma_crossover",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        stop_loss_pct=3.0,
        take_profit_pct=5.0,
    )

    assert payload["ok"] is True
    for key in (
        "benchmark_return_pct",
        "alpha_pct",
        "expectancy_pct",
        "exposure_pct",
        "payoff_ratio",
        "omega_ratio",
        "tail_ratio",
        "recovery_factor",
        "max_consecutive_wins",
        "max_consecutive_losses",
    ):
        assert key in payload
    assert 0 <= payload["exposure_pct"] <= 100


def test_monte_carlo_bootstrap_estimates_terminal_return_downside() -> None:
    pnls = [12.0, 8.0, 4.0, -3.0, -18.0]
    observed_terminal_return = 100.0
    for pnl in pnls:
        observed_terminal_return *= 1.0 + pnl / 100.0
    observed_terminal_return -= 100.0

    estimate = compute_monte_carlo_95(pnls, n_simulations=2000, seed=7)

    assert estimate is not None
    assert estimate < round(observed_terminal_return, 2)
    assert estimate == compute_monte_carlo_95(pnls, n_simulations=2000, seed=7)


def test_monte_carlo_bootstrap_rejects_invalid_configuration() -> None:
    assert compute_monte_carlo_95([1.0, 2.0, 3.0, 4.0]) is None
    with pytest.raises(ValueError, match="n_simulations"):
        compute_monte_carlo_95([1.0] * 5, n_simulations=0)
    with pytest.raises(ValueError, match="finite"):
        compute_monte_carlo_95([1.0, 2.0, 3.0, 4.0, float("nan")])
