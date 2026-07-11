from __future__ import annotations

import json
from typing import Any

from dashboard.llm_signal import _call_llm, llm_configured, resolve_model

ALLOWED_MODELS = {"ma", "momentum", "rsi", "breakout", "bollinger"}


def _fallback(objective: str, symbol: str, risk_profile: str) -> dict[str, Any]:
    lower = objective.lower()
    if "震荡" in objective or "回归" in objective or "rsi" in lower:
        model, params = "rsi", {"period": 14, "oversold": 30, "overbought": 70}
    elif "突破" in objective:
        model, params = "breakout", {"lookback": 20}
    else:
        model, params = "ma", {"fast_period": 7, "slow_period": 30}
    risk = {"conservative": (2.0, 4.0), "balanced": (3.0, 6.0), "aggressive": (5.0, 10.0)}
    stop, target = risk.get(risk_profile, risk["balanced"])
    return {
        "name": f"{symbol} {model.upper()} 候选",
        "hypothesis": objective or "使用价格行为构建可验证的交易假设",
        "applicable_regime": "趋势" if model in {"ma", "breakout"} else "震荡",
        "failure_conditions": ["市场状态切换", "交易成本显著上升", "样本外参数失效"],
        "spec": {
            "universe": [symbol], "timeframe": "1hour",
            "signal": {"model": model, "params": params},
            "position": {"sizing": "fixed_qty", "value": 0.1, "max_position": 0.1},
            "risk": {"stop_loss_pct": stop, "take_profit_pct": target, "max_drawdown_pct": 15},
            "execution": {"order_type": "market", "cost_preset": "realistic"},
        },
        "parameter_space": _parameter_space(model),
        "source": "deterministic_fallback",
    }


def _parameter_space(model: str) -> dict[str, list[float | int]]:
    return {
        "ma": {"fast_period": [5, 7, 10], "slow_period": [20, 30, 60]},
        "momentum": {"lookback": [5, 10, 20]},
        "rsi": {"period": [7, 14, 21], "oversold": [25, 30, 35], "overbought": [65, 70, 75]},
        "breakout": {"lookback": [10, 20, 40]},
        "bollinger": {"period": [10, 20, 30], "deviation": [1.5, 2.0, 2.5]},
    }.get(model, {})


def _prompt(objective: str, symbol: str, risk_profile: str) -> str:
    return (
        "你是量化策略研发助手。只输出一个 JSON 对象，不输出代码或 markdown。"
        "signal.model 只能为 ma|momentum|rsi|breakout|bollinger。"
        "必须包含 name,hypothesis,applicable_regime,failure_conditions,spec,parameter_space。"
        "spec 必须包含 universe,timeframe,signal,position,risk,execution。"
        "策略只是研究候选，不得声称保证收益或可以直接上线。\n"
        f"研究目标: {objective}\n交易标的: {symbol}\n风险偏好: {risk_profile}"
    )


def propose_strategy(*, objective: str, symbol: str = "BTC-USDT", risk_profile: str = "balanced", model: str | None = None) -> dict[str, Any]:
    fallback = _fallback(objective, symbol, risk_profile)
    if not llm_configured():
        return fallback
    resolved = resolve_model(model)
    try:
        candidate = _call_llm(_prompt(objective, symbol, risk_profile), resolved)
        spec = candidate.get("spec") or {}
        signal = spec.get("signal") or {}
        signal_model = str(signal.get("model") or "")
        if signal_model not in ALLOWED_MODELS:
            raise ValueError("LLM returned unsupported signal model")
        for field in ("name", "hypothesis", "applicable_regime", "failure_conditions", "parameter_space"):
            if field not in candidate:
                raise ValueError(f"LLM response missing {field}")
        candidate["source"] = "llm"
        candidate["model"] = resolved
        candidate["review_required"] = True
        return candidate
    except Exception as error:
        fallback["llm_error"] = str(error)
        fallback["model"] = resolved
        return fallback
