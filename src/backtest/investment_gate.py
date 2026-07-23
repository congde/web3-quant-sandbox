"""Deterministic investment-research acceptance gate.

This module promotes one *research* strategy only when a fixed specification
passes a multi-asset, locked-holdout evaluation with realistic execution costs,
funding-rate stress, parameter sensitivity, and explicit data-quality checks.
It does not authorize live trading.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from statistics import median, stdev
from typing import Any

from backtest.rolling.engine import run_backtest
from backtest.rolling.metrics import compute_metrics, compute_sharpe, compute_sortino
from backtest.rolling.models import BacktestConfig
from backtest.rolling.registry import get_strategy
from paths import DATA_DIR

GATE_DIR = DATA_DIR / "investment_gate"
MANIFEST_PATH = GATE_DIR / "manifest.json"
CERTIFICATE_PATH = GATE_DIR / "acceptance_certificate.json"
FORWARD_PLAN_PATH = GATE_DIR / "forward_plan.json"
SYMBOLS = ("BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT")
HOLDOUT_BARS = 365

STRATEGY_SPEC: dict[str, Any] = {
    "strategy_key": "regime_trend",
    "name": "跨周期趋势组合",
    "version": "1.1.0",
    "universe": list(SYMBOLS),
    "allocation": "60日滞后逆波动配置、周度再平衡、组合年化波动目标20%",
    "instrument": "USDT永续合约研究模拟",
    "frequency": "1d",
    "params": {
        "trend_period": 120,
        "exit_period": 100,
        "momentum_period": 63,
        "entry_threshold": 25,
    },
    "risk": {
        "stop_loss_pct": 10.0,
        "take_profit_pct": 40.0,
        "gross_exposure_limit": 1.0,
        "allocation_model": "lagged_inverse_volatility",
        "volatility_lookback_bars": 60,
        "portfolio_volatility_target_pct": 20.0,
        "rebalance_every_bars": 7,
        "single_asset_weight_floor": 0.1,
        "single_asset_weight_cap": 0.3,
        "allocation_turnover_cost_pct": 0.05,
    },
    "costs": {
        "commission_pct_per_side": 0.1,
        "base_slippage_pct_per_side": 0.05,
        "dynamic_slippage": True,
        "funding_stress_pct_per_8h": [-0.01, 0.0, 0.01],
    },
}

SENSITIVITY_PARAMS = (
    {"trend_period": 100, "exit_period": 80, "momentum_period": 63},
    {"trend_period": 120, "exit_period": 80, "momentum_period": 63},
    {"trend_period": 140, "exit_period": 100, "momentum_period": 63},
    {"trend_period": 120, "exit_period": 100, "momentum_period": 84},
)


def load_gate_candles(symbol: str) -> list[dict[str, Any]]:
    normalized = symbol.replace("-", "").replace("/", "").upper()
    if normalized not in SYMBOLS:
        raise ValueError(f"unsupported investment-gate symbol: {symbol}")
    path = GATE_DIR / f"{normalized}.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        rows = [
            {
                "tsSec": int(row["open_time_ms"]) // 1000,
                "date": row["date"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
                "turnover": float(row["quote_volume"]),
            }
            for row in csv.DictReader(handle)
        ]
    return rows


def validate_gate_data() -> dict[str, Any]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    generated_at = datetime.fromisoformat(str(manifest["generated_at"]))
    issues: list[dict[str, str]] = []
    datasets: list[dict[str, Any]] = []
    shared_dates: tuple[str, str] | None = None

    for symbol in SYMBOLS:
        path = GATE_DIR / f"{symbol}.csv"
        candles = load_gate_candles(symbol)
        timestamps = [int(row["tsSec"]) for row in candles]
        invalid_ohlc = sum(
            1
            for row in candles
            if row["low"] > min(row["open"], row["close"])
            or row["high"] < max(row["open"], row["close"])
            or row["low"] <= 0
            or row["volume"] < 0
        )
        duplicate_timestamps = len(timestamps) - len(set(timestamps))
        non_monotonic = sum(
            current <= previous
            for previous, current in zip(timestamps, timestamps[1:])
        )
        unexpected_interval_gaps = sum(
            current - previous != 86_400
            for previous, current in zip(timestamps, timestamps[1:])
        )
        future_rows = sum(
            datetime.fromtimestamp(ts, tz=timezone.utc) > generated_at
            for ts in timestamps
        )
        date_range = (candles[0]["date"], candles[-1]["date"])
        shared_dates = shared_dates or date_range

        checks = {
            "rows": len(candles),
            "duplicate_timestamps": duplicate_timestamps,
            "non_monotonic_timestamps": non_monotonic,
            "unexpected_interval_gaps": unexpected_interval_gaps,
            "invalid_ohlc_rows": invalid_ohlc,
            "future_rows": future_rows,
            "date_range_aligned": date_range == shared_dates,
        }
        if len(candles) < 900:
            issues.append({"symbol": symbol, "issue": "fewer than 900 daily bars"})
        for key in (
            "duplicate_timestamps",
            "non_monotonic_timestamps",
            "unexpected_interval_gaps",
            "invalid_ohlc_rows",
            "future_rows",
        ):
            if checks[key]:
                issues.append({"symbol": symbol, "issue": key})
        if not checks["date_range_aligned"]:
            issues.append({"symbol": symbol, "issue": "date ranges differ"})

        datasets.append(
            {
                "symbol": symbol,
                "first_date": date_range[0],
                "last_date": date_range[1],
                "sha256": _sha256(path),
                **checks,
            }
        )

    return {
        "passed": not issues,
        "source": manifest["source_name"],
        "source_url": manifest["source"],
        "generated_at": manifest["generated_at"],
        "timezone": manifest["timezone"],
        "issues": issues,
        "datasets": datasets,
    }


def evaluate_investment_gate() -> dict[str, Any]:
    data_quality = validate_gate_data()
    base_runs = _run_universe(STRATEGY_SPEC["params"], funding_rate_pct=0.0)
    portfolio = _portfolio_metrics(base_runs)
    development = _portfolio_metrics(
        _run_universe(
            STRATEGY_SPEC["params"],
            funding_rate_pct=0.0,
            start_from=120,
            end_at=635,
        )
    )
    funding_stress = []
    for funding in STRATEGY_SPEC["costs"]["funding_stress_pct_per_8h"]:
        runs = _run_universe(
            STRATEGY_SPEC["params"], funding_rate_pct=float(funding)
        )
        funding_stress.append(
            {"funding_rate_pct": funding, **_portfolio_metrics(runs)}
        )

    sensitivity = []
    for override in SENSITIVITY_PARAMS:
        params = {**STRATEGY_SPEC["params"], **override}
        sensitivity.append({"params": override, **_portfolio_metrics(_run_universe(params))})

    benchmark = _buy_and_hold_portfolio()
    total_trades = sum(int(row["metrics"]["total_trades"]) for row in base_runs)
    positive_assets = sum(
        float(row["metrics"]["total_return_pct"]) > 0 for row in base_runs
    )
    worst_funding = min(funding_stress, key=lambda row: row["total_return_pct"])
    gates = [
        _gate("data_quality", data_quality["passed"], "all structural checks pass"),
        _gate("portfolio_return", portfolio["total_return_pct"] >= 5.0, ">= 5%", portfolio["total_return_pct"]),
        _gate("portfolio_sharpe", portfolio["sharpe_ratio"] >= 0.60, ">= 0.60", portfolio["sharpe_ratio"]),
        _gate("portfolio_drawdown", portfolio["max_drawdown_pct"] <= 15.0, "<= 15%", portfolio["max_drawdown_pct"]),
        _gate(
            "realized_volatility",
            portfolio["annualized_volatility_pct"]
            <= STRATEGY_SPEC["risk"]["portfolio_volatility_target_pct"],
            "<= 20% annualized",
            portfolio["annualized_volatility_pct"],
        ),
        _gate(
            "development_stability",
            development["total_return_pct"] > 0.0
            and development["sharpe_ratio"] >= 0.30
            and development["max_drawdown_pct"] <= 30.0,
            "return > 0, Sharpe >= 0.30, drawdown <= 30%",
            {
                "return_pct": development["total_return_pct"],
                "sharpe_ratio": development["sharpe_ratio"],
                "max_drawdown_pct": development["max_drawdown_pct"],
            },
        ),
        _gate("positive_asset_breadth", positive_assets >= 3, ">= 3 of 5", positive_assets),
        _gate("minimum_trades", total_trades >= 30, ">= 30", total_trades),
        _gate(
            "benchmark_excess",
            portfolio["total_return_pct"] - benchmark["total_return_pct"] >= 10.0,
            ">= 10 percentage points",
            round(portfolio["total_return_pct"] - benchmark["total_return_pct"], 2),
        ),
        _gate(
            "funding_stress",
            worst_funding["total_return_pct"] >= 5.0
            and worst_funding["max_drawdown_pct"] <= 25.0,
            "worst scenario return >= 5% and drawdown <= 25%",
            {
                "funding_rate_pct": worst_funding["funding_rate_pct"],
                "return_pct": worst_funding["total_return_pct"],
                "max_drawdown_pct": worst_funding["max_drawdown_pct"],
            },
        ),
        _gate(
            "allocation_gross_limit",
            portfolio["max_gross_exposure"] <= 1.0,
            "<= 1.0",
            portfolio["max_gross_exposure"],
        ),
        _gate(
            "parameter_sensitivity",
            all(row["total_return_pct"] > 0 for row in sensitivity),
            "all predeclared neighbours profitable",
            min(row["total_return_pct"] for row in sensitivity),
        ),
    ]
    passed = all(row["passed"] for row in gates)
    first_date = base_runs[0]["holdout"]["first_date"]
    last_date = base_runs[0]["holdout"]["last_date"]
    public_runs = [_without_private_fields(row) for row in base_runs]
    return {
        "ok": True,
        "decision": "PROMOTE_RESEARCH" if passed else "REJECT",
        "passed": passed,
        "live_trading_authorized": False,
        "strategy": STRATEGY_SPEC,
        "strategy_fingerprint": strategy_fingerprint(),
        "evaluation": {
            "design": (
                "fixed parameters; 635-bar development dataset "
                "(515 scored after warmup) / 365-bar locked holdout"
            ),
            "holdout": {"first_date": first_date, "last_date": last_date, "bars": HOLDOUT_BARS},
            "development": _without_curve(development),
            "portfolio": portfolio,
            "benchmark": benchmark,
            "assets": public_runs,
            "funding_stress": [_without_curve(row) for row in funding_stress],
            "parameter_sensitivity": [_without_curve(row) for row in sensitivity],
        },
        "data_quality": data_quality,
        "forward_validation": evaluate_forward_validation(),
        "gates": gates,
        "limitations": [
            "准入仅代表固定历史样本上的研究晋级，不保证未来收益。",
            "v1.1 风险预算优化已观察本历史准入段，后续必须用新的前向纸面交易区间重新确认。",
            "价格来自现货日线；多空执行按永续合约成本与资金费率压力情景模拟。",
            "未建模容量、盘口冲击、强平、交易所故障、税费和跨场所基差。",
            "任何实盘前仍需纸面交易、实时数据核验和人工风险审批。",
        ],
    }


def strategy_fingerprint() -> str:
    """Return a stable digest of the frozen, executable strategy contract."""
    payload = json.dumps(
        STRATEGY_SPEC,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def evaluate_forward_validation() -> dict[str, Any]:
    """Evaluate only bars completed after the frozen research cutoff."""
    plan = json.loads(FORWARD_PLAN_PATH.read_text(encoding="utf-8"))
    fingerprint = strategy_fingerprint()
    frozen = fingerprint == plan["strategy_fingerprint"]
    cutoff = str(plan["cutoff_date"])
    minimum_bars = int(plan["minimum_bars"])
    windows = []
    start_indices = []
    for symbol in SYMBOLS:
        candles = load_gate_candles(symbol)
        new_indices = [
            index for index, row in enumerate(candles) if row["date"] > cutoff
        ]
        start_index = new_indices[0] if new_indices else len(candles)
        start_indices.append(start_index)
        windows.append(
            {
                "symbol": symbol,
                "bars": len(candles) - start_index,
                "first_date": (
                    candles[start_index]["date"]
                    if start_index < len(candles)
                    else None
                ),
                "last_date": (
                    candles[-1]["date"] if start_index < len(candles) else None
                ),
            }
        )

    bar_counts = {row["bars"] for row in windows}
    aligned = len(bar_counts) == 1 and len(set(start_indices)) == 1
    bars = min(bar_counts, default=0)
    base_gates = [
        _gate(
            "strategy_frozen",
            frozen,
            f"fingerprint == {plan['strategy_fingerprint']}",
            fingerprint,
        ),
        _gate("forward_window_aligned", aligned, "same dates and bar count"),
        _gate("minimum_forward_bars", bars >= minimum_bars, f">= {minimum_bars}", bars),
    ]
    if not frozen:
        return {
            "status": "BLOCKED_SPEC_DRIFT",
            "decision": "HOLD",
            "live_trading_authorized": False,
            "plan": plan,
            "windows": windows,
            "metrics": None,
            "gates": base_gates,
        }
    if bars == 0:
        return {
            "status": "WAITING_FOR_DATA",
            "decision": "HOLD",
            "live_trading_authorized": False,
            "plan": plan,
            "windows": windows,
            "metrics": None,
            "gates": base_gates,
        }
    if not aligned:
        return {
            "status": "BLOCKED_DATA_ALIGNMENT",
            "decision": "HOLD",
            "live_trading_authorized": False,
            "plan": plan,
            "windows": windows,
            "metrics": None,
            "gates": base_gates,
        }

    runs = _run_universe(
        STRATEGY_SPEC["params"],
        funding_rate_pct=0.0,
        start_from=start_indices[0],
    )
    metrics = _portfolio_metrics(runs)
    performance_gates = [
        _gate("forward_return", metrics["total_return_pct"] > 0.0, "> 0%", metrics["total_return_pct"]),
        _gate("forward_sharpe", metrics["sharpe_ratio"] >= 0.30, ">= 0.30", metrics["sharpe_ratio"]),
        _gate("forward_drawdown", metrics["max_drawdown_pct"] <= 15.0, "<= 15%", metrics["max_drawdown_pct"]),
        _gate(
            "forward_volatility",
            metrics["annualized_volatility_pct"] <= 20.0,
            "<= 20% annualized",
            metrics["annualized_volatility_pct"],
        ),
    ]
    gates = [*base_gates, *performance_gates]
    eligible = bars >= minimum_bars
    passed = eligible and all(gate["passed"] for gate in gates)
    return {
        "status": (
            "FORWARD_PASSED"
            if passed
            else "FORWARD_FAILED"
            if eligible
            else "COLLECTING"
        ),
        "decision": "REQUEST_HUMAN_REVIEW" if passed else "HOLD",
        "live_trading_authorized": False,
        "plan": plan,
        "windows": windows,
        "metrics": _without_curve(metrics),
        "gates": gates,
    }


def write_acceptance_certificate() -> dict[str, Any]:
    payload = evaluate_investment_gate()
    payload["evaluated_at"] = datetime.now(timezone.utc).isoformat()
    CERTIFICATE_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    return payload


def _run_universe(
    params: dict[str, Any],
    funding_rate_pct: float = 0.0,
    start_from: int | None = None,
    end_at: int | None = None,
) -> list[dict[str, Any]]:
    strategy = get_strategy(STRATEGY_SPEC["strategy_key"])
    runs = []
    for symbol in SYMBOLS:
        candles = load_gate_candles(symbol)
        if end_at is not None:
            candles = candles[:end_at]
        evaluation_start = (
            len(candles) - HOLDOUT_BARS if start_from is None else start_from
        )
        config = BacktestConfig(
            min_context=20,
            stop_loss_pct=float(STRATEGY_SPEC["risk"]["stop_loss_pct"]),
            take_profit_pct=float(STRATEGY_SPEC["risk"]["take_profit_pct"]),
            commission_pct=float(STRATEGY_SPEC["costs"]["commission_pct_per_side"]),
            slippage_pct=float(STRATEGY_SPEC["costs"]["base_slippage_pct_per_side"]),
            dynamic_slippage=bool(STRATEGY_SPEC["costs"]["dynamic_slippage"]),
            dynamic_slippage_factor=0.5,
            funding_rate_pct=funding_rate_pct,
            start_from=evaluation_start,
            kline_type="1day",
        )
        trades, equity_curve, _signals = run_backtest(
            candles, strategy, dict(params), config
        )
        metrics = compute_metrics(
            trades=trades,
            equity_curve=equity_curve,
            candles=candles[evaluation_start:],
            symbol=symbol,
            kline_type="1day",
            strategy_name=STRATEGY_SPEC["name"],
        )
        runs.append(
            {
                "symbol": symbol,
                "holdout": {
                    "first_date": candles[evaluation_start]["date"],
                    "last_date": candles[-1]["date"],
                    "bars": len(candles) - evaluation_start,
                },
                "metrics": {
                    "total_return_pct": metrics.total_return_pct,
                    "sharpe_ratio": metrics.sharpe_ratio,
                    "sortino_ratio": metrics.sortino_ratio,
                    "max_drawdown_pct": metrics.max_drawdown_pct,
                    "total_trades": metrics.total_trades,
                    "win_rate": metrics.win_rate,
                    "profit_factor": metrics.profit_factor,
                },
                "_equity_curve": equity_curve,
                "_market_returns": [
                    float(candles[index]["close"])
                    / float(candles[index - 1]["close"])
                    - 1.0
                    for index in range(1, len(candles))
                ],
                "_start_from": evaluation_start,
            }
        )
    return runs


def _portfolio_metrics(runs: list[dict[str, Any]]) -> dict[str, Any]:
    curves = [row["_equity_curve"] for row in runs]
    length = min(len(curve) for curve in curves)
    equity = 100.0
    peak = equity
    max_drawdown = 0.0
    period_returns: list[float] = []
    curve_points = []
    risk = STRATEGY_SPEC["risk"]
    rebalance_every = int(risk["rebalance_every_bars"])
    turnover_cost = float(risk["allocation_turnover_cost_pct"]) / 100.0
    effective_weights = [0.0] * len(curves)
    total_turnover = 0.0
    gross_exposures: list[float] = []
    weight_sums = [0.0] * len(curves)
    for index in range(length):
        sleeve_returns = []
        for curve in curves:
            previous = 100.0 if index == 0 else float(curve[index - 1]["equity"])
            current = float(curve[index]["equity"])
            sleeve_returns.append(current / previous - 1.0 if previous > 0 else 0.0)
        rebalance_cost = 0.0
        if index % rebalance_every == 0:
            new_weights = _lagged_risk_budget_weights(runs, index)
            if index > 0:
                turnover = sum(
                    abs(current - previous)
                    for current, previous in zip(new_weights, effective_weights)
                )
                total_turnover += turnover
                rebalance_cost = turnover * turnover_cost
            effective_weights = new_weights
        portfolio_return = (
            sum(
                weight * sleeve_return
                for weight, sleeve_return in zip(
                    effective_weights, sleeve_returns
                )
            )
            - rebalance_cost
        )
        equity *= 1.0 + portfolio_return
        peak = max(peak, equity)
        drawdown = (peak - equity) / peak * 100.0 if peak else 0.0
        max_drawdown = max(max_drawdown, drawdown)
        period_returns.append(portfolio_return * 100.0)
        gross_exposure = sum(effective_weights)
        gross_exposures.append(gross_exposure)
        for asset_index, weight in enumerate(effective_weights):
            weight_sums[asset_index] += weight
        curve_points.append(
            {
                "date": datetime.fromtimestamp(
                    int(curves[0][index]["ts"]), tz=timezone.utc
                ).strftime("%Y-%m-%d"),
                "equity": round(equity, 4),
                "drawdown_pct": round(drawdown, 2),
            }
        )
    clean_assets = [_without_private_fields(row) for row in runs]
    return {
        "total_return_pct": round(equity - 100.0, 2),
        "sharpe_ratio": round(compute_sharpe(period_returns, "1day"), 2),
        "sortino_ratio": round(compute_sortino(period_returns, "1day"), 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "annualized_volatility_pct": round(
            stdev(period_returns) * math.sqrt(365)
            if len(period_returns) > 1
            else 0.0,
            2,
        ),
        "average_gross_exposure": round(
            sum(gross_exposures) / len(gross_exposures), 3
        ),
        "max_gross_exposure": round(max(gross_exposures, default=0.0), 3),
        "allocation_turnover": round(total_turnover, 3),
        "average_asset_weights": {
            row["symbol"]: round(weight_sums[index] / length, 3)
            for index, row in enumerate(runs)
        },
        "median_asset_return_pct": round(
            median(row["metrics"]["total_return_pct"] for row in clean_assets), 2
        ),
        "profitable_assets": sum(
            row["metrics"]["total_return_pct"] > 0 for row in clean_assets
        ),
        "asset_count": len(clean_assets),
        "equity_curve": curve_points,
    }


def _lagged_risk_budget_weights(
    runs: list[dict[str, Any]], portfolio_index: int
) -> list[float]:
    """Return investable weights using only information known before this bar."""
    risk = STRATEGY_SPEC["risk"]
    lookback = int(risk["volatility_lookback_bars"])
    start_from = int(runs[0]["_start_from"])
    absolute_index = start_from + portfolio_index
    history_end = absolute_index - 1
    history_start = history_end - lookback
    histories = [
        row["_market_returns"][history_start:history_end] for row in runs
    ]
    if any(len(history) != lookback for history in histories):
        raise ValueError("insufficient lagged history for risk allocation")

    inverse_volatility = [
        1.0 / max(stdev(history), 1e-9) for history in histories
    ]
    budget_weights = _bounded_weights(
        inverse_volatility,
        floor=float(risk["single_asset_weight_floor"]),
        cap=float(risk["single_asset_weight_cap"]),
    )
    portfolio_history = [
        sum(
            budget_weights[asset_index] * histories[asset_index][bar_index]
            for asset_index in range(len(histories))
        )
        for bar_index in range(lookback)
    ]
    forecast_volatility = stdev(portfolio_history) * math.sqrt(365)
    target = float(risk["portfolio_volatility_target_pct"]) / 100.0
    scale = min(
        float(risk["gross_exposure_limit"]),
        target / max(forecast_volatility, 1e-9),
    )
    return [weight * scale for weight in budget_weights]


def _bounded_weights(
    scores: list[float], floor: float, cap: float
) -> list[float]:
    """Normalize positive scores subject to deterministic floor/cap bounds."""
    if not scores or floor * len(scores) > 1.0 or cap * len(scores) < 1.0:
        raise ValueError("infeasible allocation bounds")
    weights = [0.0] * len(scores)
    free = set(range(len(scores)))
    remaining = 1.0
    for _ in range(len(scores) + 1):
        denominator = sum(scores[index] for index in free)
        changed = False
        for index in list(free):
            candidate = (
                remaining * scores[index] / denominator
                if denominator > 0
                else remaining / len(free)
            )
            if candidate < floor:
                weights[index] = floor
                remaining -= floor
                free.remove(index)
                changed = True
            elif candidate > cap:
                weights[index] = cap
                remaining -= cap
                free.remove(index)
                changed = True
        if not changed:
            break
    if free:
        denominator = sum(scores[index] for index in free)
        for index in free:
            weights[index] = (
                remaining * scores[index] / denominator
                if denominator > 0
                else remaining / len(free)
            )
    return weights


def _buy_and_hold_portfolio() -> dict[str, Any]:
    runs = []
    for symbol in SYMBOLS:
        candles = load_gate_candles(symbol)
        start_from = len(candles) - HOLDOUT_BARS
        holdout = candles[start_from:]
        entry = float(holdout[0]["close"]) * 1.0015
        curve = [
            {
                "ts": row["tsSec"],
                "equity": max(
                    0.0, float(row["close"]) * 0.9985 / entry * 100.0
                ),
            }
            for row in holdout
        ]
        runs.append(
            {
                "symbol": symbol,
                "metrics": {"total_return_pct": curve[-1]["equity"] - 100.0},
                "_equity_curve": curve,
                "_market_returns": [
                    float(candles[index]["close"])
                    / float(candles[index - 1]["close"])
                    - 1.0
                    for index in range(1, len(candles))
                ],
                "_start_from": start_from,
            }
        )
    metrics = _without_curve(_portfolio_metrics(runs))
    return {"name": "同风险预算买入持有", **metrics}


def _gate(
    name: str, passed: bool, threshold: str, value: Any | None = None
) -> dict[str, Any]:
    return {
        "gate": name,
        "passed": bool(passed),
        "threshold": threshold,
        "value": value if value is not None else bool(passed),
    }


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _without_curve(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key != "equity_curve"}


def _without_private_fields(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if not key.startswith("_")}
