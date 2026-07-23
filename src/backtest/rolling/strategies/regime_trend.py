"""Slow trend strategy intended for the investment acceptance gate.

The rule is deliberately simple and fixed before the holdout evaluation:

* enter long when price is above its 200-day average and 252-day momentum is
  positive;
* enter short when price is below its 200-day average and momentum is negative;
* use the 100-day average as the faster regime-exit rule.

The price observations come from spot bars, while the acceptance simulation
uses the perpetual-futures cost preset for symmetric long/short execution.  The
strategy uses only information available at the current bar and has no fitted
model state.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from backtest.rolling.indicators import IndicatorSeries
from backtest.rolling.models import Signal
from backtest.rolling.strategies.base import Strategy


class RegimeTrendStrategy(Strategy):
    name = "regime_trend"
    display_name = "跨周期趋势过滤（投资准入候选）"

    def generate_signal(
        self,
        candles: List[Dict],
        idx: int,
        params: Dict[str, Any],
        indicators: Optional[IndicatorSeries] = None,
    ) -> Signal:
        trend_period = int(params.get("trend_period", 200))
        exit_period = int(params.get("exit_period", 100))
        momentum_period = int(params.get("momentum_period", 252))
        required = max(trend_period, exit_period, momentum_period)
        if idx < required:
            return Signal(action="WAIT", score=-1.0)

        close = float(candles[idx]["close"])
        trend_ma = _mean_close(candles, idx, trend_period)
        exit_ma = _mean_close(candles, idx, exit_period)
        momentum_base = float(candles[idx - momentum_period]["close"])
        momentum = close / momentum_base - 1.0 if momentum_base > 0 else 0.0

        if close > trend_ma and momentum > 0:
            strength = min(100.0, 25.0 + momentum * 100.0)
            return Signal(action="LONG", score=max(30.0, strength))
        if close < trend_ma and momentum < 0:
            strength = min(100.0, 25.0 + abs(momentum) * 100.0)
            return Signal(action="SHORT", score=-max(30.0, strength))

        # In the transition zone, the faster average determines which existing
        # direction is allowed to remain open without creating a new entry.
        return Signal(action="WAIT", score=1.0 if close >= exit_ma else -1.0)

    def default_params(self) -> Dict[str, Any]:
        return {
            "trend_period": 200,
            "exit_period": 100,
            "momentum_period": 252,
            "entry_threshold": 25,
        }

    def param_grid(self) -> Dict[str, List[Any]]:
        # Fixed economics-first rule; no search is used by the acceptance gate.
        return {}

    def is_incremental(self) -> bool:
        return False


def _mean_close(candles: List[Dict], idx: int, period: int) -> float:
    start = idx - period + 1
    values = (float(candles[i]["close"]) for i in range(start, idx + 1))
    return sum(values) / period
