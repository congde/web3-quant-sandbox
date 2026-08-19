"""Orchestrate GP / ML factor mining on teaching candle data."""

from __future__ import annotations

from typing import Any, Literal

from backtest.rolling.service import load_candles
from factor_mining.evaluate import (
    chronological_three_way_split,
    evaluate_factor,
    slice_series,
)
from factor_mining.expressions import eval_series
from factor_mining.features import MiningTarget, RiskKind, build_feature_matrix
from factor_mining.gp import GPConfig, run_gp_search
from factor_mining.llm import run_llm_factor_search
from factor_mining.ml import run_ml_search
from backtest.trials import get_ledger
from factor_mining.risk_apply import preview_position_scales
from factor_mining.serialize import expr_to_dict
from factor_mining.templates import run_template_search


MiningMode = Literal["gp", "ml", "template", "llm", "both", "all"]

_LABEL_META: dict[tuple[MiningTarget, RiskKind], dict[str, str]] = {
    ("return", "abs_ret"): {
        "metric_name": "IC",
        "label_description": "forward return",
        "application": "directional_signal",
    },
    ("risk", "abs_ret"): {
        "metric_name": "RIC",
        "label_description": "forward absolute return (vol proxy)",
        "application": "position_scale",
    },
    ("risk", "realized_vol"): {
        "metric_name": "RIC",
        "label_description": "forward realized volatility",
        "application": "position_scale",
    },
}


def run_factor_mining(
    *,
    mode: MiningMode = "both",
    target: MiningTarget = "return",
    risk_kind: RiskKind = "abs_ret",
    symbol: str | None = None,
    limit: int = 120,
    horizon: int = 1,
    refresh: bool = False,
    gp_generations: int = 12,
    gp_population: int = 24,
    seed: int = 42,
    llm_model: str | None = None,
    cost_bps: float = 8.0,
    validation_folds: int = 4,
) -> dict[str, Any]:
    pair, kline_type, candles, data_meta = load_candles(
        symbol=symbol,
        limit=max(60, min(1500, limit)),
        refresh=refresh,
    )
    if len(candles) < 30:
        raise ValueError(f"K线数据不足: 需要至少 30 根, 当前 {len(candles)}")

    rk = risk_kind if target == "risk" else "abs_ret"
    features, labels, feature_names = build_feature_matrix(
        candles,
        horizon=max(1, min(10, horizon)),
        target=target,
        risk_kind=rk,
    )
    meta = _LABEL_META[(target, rk if target == "risk" else "abs_ret")]
    n = len(labels)
    train_slice, validation_slice, test_slice = chronological_three_way_split(n)

    train_features = {name: slice_series(series, train_slice) for name, series in features.items()}
    validation_features = {name: slice_series(series, validation_slice) for name, series in features.items()}
    test_features = {name: slice_series(series, test_slice) for name, series in features.items()}
    train_labels = slice_series(labels, train_slice)
    validation_labels = slice_series(labels, validation_slice)
    test_labels = slice_series(labels, test_slice)
    purge_bars = max(1, min(10, horizon))
    for boundary_labels in (train_labels, validation_labels):
        for index in range(max(0, len(boundary_labels) - purge_bars), len(boundary_labels)):
            boundary_labels[index] = None

    baseline = _baseline_screen(train_features, train_labels, feature_names)

    engine = "factor-mining/teaching-sandbox"
    if target == "risk":
        engine = "factor-mining/risk-teaching-sandbox"

    payload: dict[str, Any] = {
        "ok": True,
        "engine": engine,
        "mining_target": target,
        "mode": mode,
        "symbol": pair,
        "kline_type": kline_type,
        "horizon_bars": horizon,
        "sample_bars": n,
        "train_bars": len(train_labels),
        "validation_bars": len(validation_labels),
        "test_bars": len(test_labels),
        "feature_count": len(feature_names),
        "features": feature_names,
        "baseline_univariate": baseline[:6],
        "metric_name": meta["metric_name"],
        "label_description": meta["label_description"],
        "application": meta["application"],
        "research_design": {
            "discovery": "前 60%：只用于拟合和生成候选",
            "selection": "中间 20%：只用于候选排序与选优",
            "final_holdout": "最后 20%：冠军确定后仅报告一次",
            "split_policy": "chronological_60_20_20",
            "cost_bps": round(max(0.0, cost_bps), 2),
            "validation_folds": max(3, min(6, validation_folds)),
            "normalization": "训练段拟合参数，冻结后应用到验证与留出段",
            "point_in_time": True,
            "purge_bars": purge_bars,
        },
        "feature_taxonomy": _feature_taxonomy(feature_names),
        **data_meta,
    }
    if target == "risk":
        payload["risk_kind"] = rk

    gp_result: dict[str, Any] | None = None
    ml_result: dict[str, Any] | None = None
    template_result: dict[str, Any] | None = None
    llm_result: dict[str, Any] | None = None
    candidate_signals: dict[str, list[float | None]] = {}

    if mode in ("gp", "both", "all"):
        raw_gp = run_gp_search(
            train_features,
            train_labels,
            feature_names,
            config=GPConfig(
                population_size=max(8, min(40, gp_population)),
                generations=max(4, min(30, gp_generations)),
                seed=seed,
            ),
        )
        gp_expr = raw_gp.pop("expr")
        gp_result = _public_gp(raw_gp)
        gp_result["train"] = raw_gp.pop("metrics")
        gp_result["validation"] = _evaluate_gp_expr(
            gp_expr, validation_features, validation_labels, cost_bps=cost_bps
        )
        gp_result["test"] = _evaluate_gp_expr(gp_expr, test_features, test_labels, cost_bps=cost_bps)
        gp_result["overfit_gap"] = _overfit_gap(gp_result["train"], gp_result["test"])
        gp_result["factor_spec"] = _build_factor_spec(
            target=target,
            source="gp",
            label=gp_result["expression"],
            horizon=horizon,
            expr=expr_to_dict(gp_expr),
        )
        if target == "return":
            gp_result["backtest_spec"] = gp_result["factor_spec"]
        else:
            gp_result["risk_spec"] = gp_result["factor_spec"]
        candidate_signals["gp"] = eval_series(gp_expr, features)
        payload["gp"] = gp_result

    if mode in ("ml", "both", "all"):
        raw_ml = run_ml_search(train_features, train_labels, feature_names)
        ml_result = dict(raw_ml)
        ml_result["train"] = ml_result.pop("metrics")
        ml_result["validation"] = _evaluate_ml_on_split(
            ml_result, validation_features, validation_labels, cost_bps=cost_bps
        )
        ml_result["test"] = _evaluate_ml_on_split(
            ml_result, test_features, test_labels, cost_bps=cost_bps
        )
        ml_result["overfit_gap"] = _overfit_gap(ml_result["train"], ml_result["test"])
        ml_result["factor_spec"] = _build_factor_spec(
            target=target,
            source="ml",
            label=ml_result.get("formula") or "ml_factor",
            horizon=horizon,
            weights=ml_result.get("weights") or {},
            normalization=ml_result.get("normalization") or {},
        )
        if target == "return":
            ml_result["backtest_spec"] = ml_result["factor_spec"]
        else:
            ml_result["risk_spec"] = ml_result["factor_spec"]
        candidate_signals["ml"] = _linear_signal(ml_result, features)
        payload["ml"] = ml_result

    if mode in ("template", "all"):
        raw_template = run_template_search(
            train_features, train_labels, validation_features, validation_labels
        )
        template_result = dict(raw_template)
        template_expr = template_result.pop("expr", None)
        template_result["train"] = template_result.pop("metrics")
        template_result["test"] = _evaluate_gp_expr(
            template_expr, test_features, test_labels, cost_bps=cost_bps
        )
        template_result["overfit_gap"] = _overfit_gap(template_result["train"], template_result["test"])
        template_result["factor_spec"] = _build_factor_spec(
            target=target,
            source="template",
            label=template_result.get("expression") or "template_factor",
            horizon=horizon,
            expr=expr_to_dict(template_expr) if template_expr is not None else None,
        )
        if target == "return":
            template_result["backtest_spec"] = template_result["factor_spec"]
        else:
            template_result["risk_spec"] = template_result["factor_spec"]
        if template_expr is not None:
            candidate_signals["template"] = eval_series(template_expr, features)
        payload["template"] = template_result

    if mode in ("llm", "all"):
        raw_llm = run_llm_factor_search(
            train_features,
            train_labels,
            validation_features,
            validation_labels,
            feature_names,
            target=target,
            horizon=horizon,
            symbol=pair,
            model=llm_model,
        )
        llm_result = dict(raw_llm)
        llm_result["train"] = llm_result.pop("metrics")
        llm_result["test"] = _evaluate_ml_on_split(
            llm_result, test_features, test_labels, cost_bps=cost_bps
        )
        llm_result["overfit_gap"] = _overfit_gap(llm_result["train"], llm_result["test"])
        llm_result["factor_spec"] = _build_factor_spec(
            target=target,
            source="llm",
            label=llm_result.get("formula") or "llm_factor",
            horizon=horizon,
            weights=llm_result.get("weights") or {},
            normalization=llm_result.get("normalization") or {},
        )
        if target == "return":
            llm_result["backtest_spec"] = llm_result["factor_spec"]
        else:
            llm_result["risk_spec"] = llm_result["factor_spec"]
        candidate_signals["llm"] = _linear_signal(llm_result, features)
        payload["llm"] = llm_result

    payload["leader"] = _pick_leader(gp_result, ml_result, template_result, llm_result)
    trial_count = _experiment_trial_count(
        feature_count=len(feature_names),
        gp_generations=gp_generations if mode in ("gp", "both", "all") else 0,
        gp_population=gp_population if mode in ("gp", "both", "all") else 0,
        template_count=13 if mode in ("template", "all") else 0,
        llm_count=5 if mode in ("llm", "all") else 0,
    )
    payload["experiment_audit"] = _experiment_audit(
        trial_count=trial_count,
        branches=(gp_result, ml_result, template_result, llm_result),
    )
    payload["candidate_registry"] = _candidate_registry(
        (gp_result, ml_result, template_result, llm_result), trial_count=trial_count
    )
    if payload["leader"]:
        source_map = {
            "gp": gp_result,
            "ml": ml_result,
            "template": template_result,
            "llm": llm_result,
        }
        source = source_map.get(payload["leader"]["method"])
        if source:
            spec = source.get("factor_spec")
            if target == "return":
                payload["leader"]["backtest_spec"] = spec
            else:
                payload["leader"]["risk_spec"] = spec
            test_metrics = source.get("test") or {}
            payload["leader"]["validation"] = {
                "quintile_spread": test_metrics.get("quintile_spread", 0.0),
                "turnover_rate": test_metrics.get("turnover_rate", 0.0),
                "ic_decay": round(
                    abs((source.get("train") or {}).get("ic_mean", 0.0))
                    - abs(test_metrics.get("ic_mean", 0.0)),
                    6,
                ),
            }
            leader_method = payload["leader"]["method"]
            leader_signal = candidate_signals.get(leader_method, [])
            payload["stability_report"] = _stability_report(
                leader_signal,
                labels,
                features.get("ret_vol_20") or features.get("atr_z20") or [],
                folds=max(3, min(6, validation_folds)),
                cost_bps=cost_bps,
            )
            payload["research_gate"] = _research_gate(
                source,
                payload["stability_report"],
                trial_count=trial_count,
            )
    payload["warnings"] = _warnings(mode, target, gp_result, ml_result, template_result, llm_result)
    payload["what_it_proves"] = _what_it_proves(target, meta["metric_name"])
    if target == "risk" and payload["leader"] and payload["leader"].get("risk_spec"):
        payload["risk_application"] = preview_position_scales(
            risk_spec=payload["leader"]["risk_spec"],
            candles=candles,
            horizon=horizon,
        )

    ledger = get_ledger()
    for label, result in (
        ("gp", gp_result),
        ("ml", ml_result),
        ("template", template_result),
        ("llm", llm_result),
    ):
        if not result:
            continue
        train_ic = float((result.get("train") or {}).get("ic_mean", 0.0))
        test_ic = float((result.get("test") or {}).get("ic_mean", 0.0))
        ledger.record(
            source=f"factor_mining_{label}",
            strategy_key="mined_factor",
            sharpe_ratio=test_ic,
            total_return_pct=train_ic * 100,
            params={"mode": mode, "target": target, "horizon": horizon, "stage": "final_holdout"},
            total_trades=int((result.get("train") or {}).get("sample_count", 0)),
        )
    payload["trial_summary"] = ledger.summary(strategy_key="mined_factor")
    return payload


def run_risk_factor_mining(
    *,
    mode: MiningMode = "both",
    risk_kind: RiskKind = "abs_ret",
    **kwargs: Any,
) -> dict[str, Any]:
    """Convenience wrapper for risk-target GP / ML mining."""
    return run_factor_mining(mode=mode, target="risk", risk_kind=risk_kind, **kwargs)


def _build_factor_spec(
    *,
    target: MiningTarget,
    source: str,
    label: str,
    horizon: int,
    expr: dict[str, Any] | None = None,
    weights: dict[str, float] | None = None,
    normalization: dict[str, dict[str, float]] | None = None,
) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "factor_source": source,
        "label": label,
        "horizon": horizon,
        "mining_target": target,
    }
    if target == "risk":
        spec["application"] = "position_scale"
    if source in ("ml", "llm"):
        spec["weights"] = dict(weights or {})
        spec["normalization"] = dict(normalization or {})
    elif expr is not None:
        spec["expr"] = expr
    return spec


def _public_gp(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        key: raw[key]
        for key in ("method", "expression", "fitness", "complexity", "history")
        if key in raw
    }


def _baseline_screen(
    features: dict[str, list[float | None]],
    labels: list[float | None],
    feature_names: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name in feature_names:
        metrics = evaluate_factor(features[name], labels, min_samples=20)
        if metrics is None:
            continue
        rows.append(
            {
                "feature": name,
                "ic_mean": metrics.ic_mean,
                "ir": metrics.ir,
                "hit_rate": metrics.hit_rate,
                "sample_count": metrics.sample_count,
            }
        )
    rows.sort(key=lambda item: abs(item["ic_mean"]), reverse=True)
    return rows


def _metrics_payload(metrics: Any) -> dict[str, Any]:
    if metrics is None:
        return {
            "ic_mean": 0.0,
            "ic_std": 0.0,
            "ir": 0.0,
            "hit_rate": 0.0,
            "sample_count": 0,
            "quintile_spread": 0.0,
            "turnover_rate": 0.0,
            "top_quintile_return": 0.0,
            "bottom_quintile_return": 0.0,
            "t_stat": 0.0,
            "p_value": 1.0,
        "rank_autocorr": 0.0,
        "quantile_returns": [0.0, 0.0, 0.0, 0.0, 0.0],
            "ic_confidence_low": 0.0,
            "ic_confidence_high": 0.0,
            "quantile_monotonicity": 0.0,
            "cost_adjusted_spread": 0.0,
        }
    return {
        "ic_mean": metrics.ic_mean,
        "ic_std": metrics.ic_std,
        "ir": metrics.ir,
        "hit_rate": metrics.hit_rate,
        "sample_count": metrics.sample_count,
        "quintile_spread": metrics.quintile_spread,
        "turnover_rate": metrics.turnover_rate,
        "top_quintile_return": metrics.top_quintile_return,
        "bottom_quintile_return": metrics.bottom_quintile_return,
        "t_stat": metrics.t_stat,
        "p_value": metrics.p_value,
        "rank_autocorr": metrics.rank_autocorr,
        "quantile_returns": list(metrics.quantile_returns),
        "ic_confidence_low": metrics.ic_confidence_low,
        "ic_confidence_high": metrics.ic_confidence_high,
        "quantile_monotonicity": metrics.quantile_monotonicity,
        "cost_adjusted_spread": metrics.cost_adjusted_spread,
    }


def _evaluate_gp_expr(
    expr: Any,
    features: dict[str, list[float | None]],
    labels: list[float | None],
    *,
    cost_bps: float = 8.0,
) -> dict[str, Any]:
    if expr is None:
        return _metrics_payload(None)
    signal = eval_series(expr, features)
    return _metrics_payload(evaluate_factor(signal, labels, min_samples=10, cost_bps=cost_bps))


def _evaluate_ml_on_split(
    ml_result: dict[str, Any],
    features: dict[str, list[float | None]],
    labels: list[float | None],
    *,
    cost_bps: float = 8.0,
) -> dict[str, Any]:
    from factor_mining.ml import _apply_normalizer, _combine_linear, _normalize_features

    normalization = ml_result.get("normalization") or {}
    normalized = (
        _apply_normalizer(features, normalization)
        if normalization
        else _normalize_features(features)
    )
    weights = ml_result.get("weights") or {}
    signal = _combine_linear(normalized, weights)
    return _metrics_payload(evaluate_factor(signal, labels, min_samples=10, cost_bps=cost_bps))


def _overfit_gap(train: dict[str, Any], test: dict[str, Any]) -> float:
    return round(abs(train.get("ic_mean", 0.0)) - abs(test.get("ic_mean", 0.0)), 6)


def _linear_signal(
    result: dict[str, Any],
    features: dict[str, list[float | None]],
) -> list[float | None]:
    from factor_mining.ml import _apply_normalizer, _combine_linear, _normalize_features

    normalization = result.get("normalization") or {}
    normalized = (
        _apply_normalizer(features, normalization)
        if normalization
        else _normalize_features(features)
    )
    return _combine_linear(normalized, result.get("weights") or {})


def _feature_taxonomy(feature_names: list[str]) -> list[dict[str, Any]]:
    groups = [
        ("momentum", "动量", ("ret_", "momentum", "macd"), "价格延续与加速度"),
        ("reversal", "反转", ("reversal", "shadow", "rsi"), "短期过度反应与拒绝形态"),
        ("trend", "趋势", ("trend", "adx", "di_", "sma", "ema", "efficiency"), "趋势方向与质量"),
        ("liquidity", "量价 / 流动性", ("volume", "dollar", "turnover"), "成交确认与流动性压力"),
        ("volatility", "波动率", ("vol", "atr", "range", "bb_"), "风险状态与波动聚集"),
        ("structure", "价格结构", ("high", "low", "gap", "support", "resistance"), "区间位置、跳空与支撑阻力"),
    ]
    assigned: set[str] = set()
    payload: list[dict[str, Any]] = []
    for key, label, needles, thesis in groups:
        members = [
            name for name in feature_names
            if name not in assigned and any(needle in name.lower() for needle in needles)
        ]
        assigned.update(members)
        payload.append({"key": key, "label": label, "thesis": thesis, "features": members})
    residual = [name for name in feature_names if name not in assigned]
    if residual:
        payload.append({"key": "other", "label": "基础与交互", "thesis": "基础 OHLCV 变换及复合项", "features": residual})
    return payload


def _experiment_trial_count(
    *,
    feature_count: int,
    gp_generations: int,
    gp_population: int,
    template_count: int,
    llm_count: int,
) -> int:
    gp_trials = max(0, min(30, gp_generations)) * max(0, min(40, gp_population))
    return max(1, feature_count + gp_trials + template_count + llm_count)


def _experiment_audit(
    *,
    trial_count: int,
    branches: tuple[dict[str, Any] | None, ...],
) -> dict[str, Any]:
    p_values = [
        float((branch.get("validation") or {}).get("p_value", 1.0))
        for branch in branches
        if branch
    ]
    best_raw = min(p_values, default=1.0)
    return {
        "estimated_trials": trial_count,
        "correction": "Bonferroni family-wise error control",
        "raw_best_validation_p": round(best_raw, 6),
        "adjusted_best_validation_p": round(min(1.0, best_raw * trial_count), 6),
        "alpha": 0.10,
        "note": "试验数包含单变量筛选、GP 代际种群、模板与 LLM 候选；这是保守的研究审计，不等同于发现保证。",
    }


def _candidate_registry(
    branches: tuple[dict[str, Any] | None, ...],
    *,
    trial_count: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for branch in branches:
        if not branch:
            continue
        method = str(branch.get("method") or "unknown")
        validation = branch.get("validation") or {}
        test = branch.get("test") or {}
        adjusted_p = min(1.0, float(validation.get("p_value", 1.0)) * trial_count)
        sign_consistent = float(validation.get("ic_mean", 0.0)) * float(test.get("ic_mean", 0.0)) > 0
        checks = [
            abs(float(validation.get("ic_mean", 0.0))) >= 0.10,
            sign_consistent,
            float(test.get("cost_adjusted_spread", 0.0)) > 0,
            adjusted_p <= 0.10,
        ]
        passed = sum(checks)
        rows.append(
            {
                "method": method,
                "label": branch.get("expression") or branch.get("formula") or method,
                "train_ic": float((branch.get("train") or {}).get("ic_mean", 0.0)),
                "validation_ic": float(validation.get("ic_mean", 0.0)),
                "holdout_ic": float(test.get("ic_mean", 0.0)),
                "adjusted_p": round(adjusted_p, 6),
                "net_spread": float(test.get("cost_adjusted_spread", 0.0)),
                "status": "research_ready" if passed == 4 else ("watch" if passed >= 2 else "reject"),
                "passed_checks": passed,
            }
        )
    return sorted(rows, key=lambda row: abs(row["validation_ic"]), reverse=True)


def _stability_report(
    signal: list[float | None],
    labels: list[float | None],
    volatility: list[float | None],
    *,
    folds: int,
    cost_bps: float,
) -> dict[str, Any]:
    n = min(len(signal), len(labels))
    overall = evaluate_factor(signal, labels, min_samples=10, cost_bps=cost_bps)
    orientation = -1.0 if overall and overall.ic_mean < 0 else 1.0
    rows: list[dict[str, Any]] = []
    for index in range(folds):
        start = int(n * index / folds)
        end = int(n * (index + 1) / folds)
        metrics = evaluate_factor(
            signal[start:end], labels[start:end], min_samples=8, cost_bps=cost_bps
        )
        if metrics is None:
            continue
        rows.append(
            {
                "fold": index + 1,
                "range": f"{start + 1}–{end}",
                "ic": metrics.ic_mean,
                "oriented_ic": round(metrics.ic_mean * orientation, 6),
                "net_spread": metrics.cost_adjusted_spread,
                "samples": metrics.sample_count,
            }
        )
    positive_rate = (
        sum(1 for row in rows if row["oriented_ic"] > 0) / len(rows)
        if rows else 0.0
    )

    valid_vol = [float(value) for value in volatility if value is not None]
    median_vol = sorted(valid_vol)[len(valid_vol) // 2] if valid_vol else 0.0
    regimes: list[dict[str, Any]] = []
    for key, label, high in (("low_vol", "低波动", False), ("high_vol", "高波动", True)):
        regime_signal: list[float | None] = []
        regime_labels: list[float | None] = []
        for sig, target, vol in zip(signal, labels, volatility):
            matched = vol is not None and ((float(vol) >= median_vol) if high else (float(vol) < median_vol))
            regime_signal.append(sig if matched else None)
            regime_labels.append(target if matched else None)
        metrics = evaluate_factor(regime_signal, regime_labels, min_samples=8, cost_bps=cost_bps)
        regimes.append(
            {
                "key": key,
                "label": label,
                "ic": metrics.ic_mean if metrics else 0.0,
                "net_spread": metrics.cost_adjusted_spread if metrics else 0.0,
                "samples": metrics.sample_count if metrics else 0,
            }
        )
    return {
        "folds": rows,
        "positive_fold_rate": round(positive_rate, 6),
        "worst_oriented_ic": min((row["oriented_ic"] for row in rows), default=0.0),
        "regimes": regimes,
        "note": "固定冠军因子在非重叠时间片和高/低波动状态中的稳定性诊断；不是重新拟合式 walk-forward。",
    }


def _research_gate(
    branch: dict[str, Any],
    stability: dict[str, Any],
    *,
    trial_count: int,
) -> dict[str, Any]:
    validation = branch.get("validation") or {}
    test = branch.get("test") or {}
    adjusted_p = min(1.0, float(validation.get("p_value", 1.0)) * trial_count)
    low = float(test.get("ic_confidence_low", 0.0))
    high = float(test.get("ic_confidence_high", 0.0))
    checks = [
        ("验证 / 留出方向一致", float(validation.get("ic_mean", 0.0)) * float(test.get("ic_mean", 0.0)) > 0,
         float(test.get("ic_mean", 0.0))),
        ("留出 |IC| ≥ 0.10", abs(float(test.get("ic_mean", 0.0))) >= 0.10,
         abs(float(test.get("ic_mean", 0.0)))),
        ("区块 Bootstrap 区间不跨 0", low > 0 or high < 0, min(abs(low), abs(high))),
        ("分位单调性 |ρ| ≥ 0.50", abs(float(test.get("quantile_monotonicity", 0.0))) >= 0.50,
         abs(float(test.get("quantile_monotonicity", 0.0)))),
        ("成本后 spread > 0", float(test.get("cost_adjusted_spread", 0.0)) > 0,
         float(test.get("cost_adjusted_spread", 0.0))),
        ("Bonferroni 调整 p ≤ 0.10", adjusted_p <= 0.10, adjusted_p),
        ("稳定时间片占比 ≥ 60%", float(stability.get("positive_fold_rate", 0.0)) >= 0.60,
         float(stability.get("positive_fold_rate", 0.0))),
    ]
    rows = [
        {"label": label, "passed": passed, "value": round(value, 6)}
        for label, passed, value in checks
    ]
    passed_count = sum(1 for row in rows if row["passed"])
    verdict = "research_ready" if passed_count >= 6 else ("watch" if passed_count >= 4 else "reject")
    return {
        "verdict": verdict,
        "passed": passed_count,
        "total": len(rows),
        "checks": rows,
        "production_ready": False,
        "next_step": "进入多标的横截面复核与真正 walk-forward；不得从本页直接上线。",
    }


def _pick_leader(
    gp_result: dict[str, Any] | None,
    ml_result: dict[str, Any] | None,
    template_result: dict[str, Any] | None = None,
    llm_result: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = []
    for method, result, label_key in (
        ("gp", gp_result, "expression"),
        ("ml", ml_result, "formula"),
        ("template", template_result, "expression"),
        ("llm", llm_result, "formula"),
    ):
        if not result:
            continue
        candidates.append(
            {
                "method": method,
                "label": result.get(label_key),
                "train_ic": result.get("train", {}).get("ic_mean", 0.0),
                "validation_ic": result.get("validation", {}).get("ic_mean", 0.0),
                "test_ic": result.get("test", {}).get("ic_mean", 0.0),
            }
        )
    if not candidates:
        return None
    return max(candidates, key=lambda item: abs(item["validation_ic"]))


def _what_it_proves(target: MiningTarget, metric_name: str) -> list[str]:
    if target == "risk":
        return [
            "GP / ML 搜索能预测未来波动代理（绝对收益或实现波动），RIC 为 Spearman 秩相关。",
            "风险因子用于仓位缩放或加宽止损，不直接给出多空方向。",
            "发现 / 选优 / 最终留出按时间切分；RIC 高不代表样本外一定有效。",
        ]
    return [
        "GP 在算子空间里搜索符号表达式，ML 在特征子集上做贪婪线性组合。",
        f"{metric_name} / IR 用 Spearman 秩相关衡量因子对未来收益的排序能力。",
        "候选在训练段拟合、验证段选优，最终留出段不参与冠军选择。",
    ]


def _warnings(
    mode: MiningMode,
    target: MiningTarget,
    gp_result: dict[str, Any] | None,
    ml_result: dict[str, Any] | None,
    template_result: dict[str, Any] | None = None,
    llm_result: dict[str, Any] | None = None,
) -> list[str]:
    metric = "RIC" if target == "risk" else "IC"
    warnings = [
        "教学沙箱：单标的时序相关，不是截面多股票因子检验。",
        f"高训练 {metric} + 低最终留出 {metric} 通常意味着过拟合，不应直接上线。",
        "最终留出集只用于报告；若据此继续调参，它就会退化为新的验证集。",
    ]
    if target == "risk":
        warnings.append("风险因子挖掘不替代第 22 讲运行时风控否决；仅演示仓位缩放思路。")
        warnings.append("Barra 式截面风险模型未实现；本沙箱为单标的时序波动预测。")
    for label, result in (
        ("GP", gp_result),
        ("ML", ml_result),
        ("Template", template_result),
        ("LLM", llm_result),
    ):
        if result is None:
            continue
        gap = result.get("overfit_gap", 0.0)
        if gap > 0.15:
            warnings.append(f"{label} 训练/测试 {metric} 差距 {gap:.3f}，疑似过拟合。")
    if mode in ("both", "all"):
        scored = [
            (label, abs(result.get("test", {}).get("ic_mean", 0.0)))
            for label, result in (
                ("GP", gp_result),
                ("ML", ml_result),
                ("Template", template_result),
                ("LLM", llm_result),
            )
            if result is not None
        ]
        winner = max(scored, key=lambda item: item[1])[0] if scored else "NA"
        warnings.append(f"验证集选择了 {winner}；最终留出结果仅用于一次性审计，仍需滚动窗口复核。")
    return warnings


def run_mined_factor_backtest(
    *,
    backtest_spec: dict[str, Any],
    symbol: str | None = None,
    limit: int = 120,
    stop_loss_pct: float = 3.0,
    take_profit_pct: float = 5.0,
    trailing_stop_pct: float = 0.0,
    max_hold_bars: int = 0,
    refresh: bool = False,
    entry_threshold: float = 0.5,
    cost_preset: str | None = "teaching",
) -> dict[str, Any]:
    """Run rolling backtest using a mined GP / ML factor spec."""
    from backtest.rolling.service import execute_backtest

    if str(backtest_spec.get("mining_target") or "return") == "risk":
        raise ValueError("风险因子请使用 risk_spec 做仓位缩放预览，不支持 mined_factor 方向回测")

    source = str(backtest_spec.get("factor_source") or "gp")
    strategy_params: dict[str, Any] = {
        "factor_source": source,
        "label": backtest_spec.get("label") or "挖掘因子",
        "horizon": int(backtest_spec.get("horizon") or 1),
        "entry_threshold": entry_threshold,
    }
    if source in ("ml", "llm"):
        strategy_params["weights"] = dict(backtest_spec.get("weights") or {})
        strategy_params["normalization"] = dict(backtest_spec.get("normalization") or {})
    else:
        strategy_params["expr"] = backtest_spec.get("expr")

    payload = execute_backtest(
        strategy_name="mined_factor",
        symbol=symbol,
        limit=limit,
        stop_loss_pct=stop_loss_pct,
        take_profit_pct=take_profit_pct,
        trailing_stop_pct=trailing_stop_pct,
        max_hold_bars=max_hold_bars,
        refresh=refresh,
        cost_preset=cost_preset,
        strategy_params=strategy_params,
    )
    payload["factor_source"] = source
    payload["factor_label"] = strategy_params["label"]
    payload["backtest_spec"] = backtest_spec
    assumptions = list(payload.get("assumptions") or [])
    assumptions.append("信号来自 GP/ML/模板/LLM 挖掘因子，阈值触发 LONG/SHORT。")
    payload["assumptions"] = assumptions
    return payload
