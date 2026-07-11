from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from backtest.rolling.service import execute_backtest, run_cpcv_service, run_robustness_audit, run_walk_forward
from strategy_lab.repository import StrategyLabRepository

MODEL_MAP = {"ma": "ma_crossover", "momentum": "technical_signal", "rsi": "rsi_mean_reversion", "breakout": "bollinger_squeeze", "bollinger": "boll_mean_reversion"}


class ExperimentRunner:
    def __init__(self, repository: StrategyLabRepository, max_workers: int = 2) -> None:
        self.repository = repository
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="strategy-lab")

    def submit(self, version_id: str, request: dict[str, Any]) -> dict[str, Any]:
        experiment = self.repository.create_experiment(version_id, request)
        self.executor.submit(self._run, experiment["id"], version_id, request)
        return experiment

    def _run(self, experiment_id: str, version_id: str, request: dict[str, Any]) -> None:
        try:
            version = self.repository.get_version(version_id)
            spec = version["spec"]
            signal = spec.get("signal") or spec
            model = str(signal.get("model") or "ma")
            strategy = MODEL_MAP.get(model, model)
            symbol = ((spec.get("universe") or [None])[0] if isinstance(spec, dict) else None) or request.get("symbol")
            limit = int(request.get("limit") or 120)
            self.repository.update_experiment(experiment_id, status="running", progress=5, phase="baseline", message="开始基准回测")
            baseline = execute_backtest(strategy_name=strategy, symbol=symbol, limit=limit, record_trial=False)
            if self._cancel(experiment_id): return
            self.repository.update_experiment(experiment_id, status="running", progress=30, phase="walk_forward", message="开始 Walk-forward 样本外验证")
            walk_forward = run_walk_forward(strategy_name=strategy, symbol=symbol, limit=limit, num_windows=int(request.get("windows") or 3))
            if self._cancel(experiment_id): return
            self.repository.update_experiment(experiment_id, status="running", progress=55, phase="robustness", message="开始参数扰动与 PBO 审计")
            robustness = run_robustness_audit(strategy_name=strategy, symbol=symbol, limit=limit)
            if self._cancel(experiment_id): return
            self.repository.update_experiment(experiment_id, status="running", progress=78, phase="cpcv", message="开始 CPCV 路径审计")
            cpcv = run_cpcv_service(strategy_name=strategy, symbol=symbol, limit=limit)
            gates = self._gates(baseline, walk_forward, robustness, cpcv)
            result = {"baseline": baseline, "walk_forward": walk_forward, "robustness": robustness, "cpcv": cpcv, "gates": gates, "promotion_ready": all(item["passed"] for item in gates)}
            self.repository.update_experiment(experiment_id, status="completed", progress=100, result=result, phase="complete", message="实验与稳健性审计完成")
        except Exception as error:
            self.repository.update_experiment(experiment_id, status="failed", progress=100, error=str(error), phase="failed", message=f"实验失败: {error}")

    def _cancel(self, experiment_id: str) -> bool:
        if not self.repository.cancel_requested(experiment_id):
            return False
        self.repository.update_experiment(experiment_id, status="cancelled", progress=100, phase="cancelled", message="实验已取消")
        return True

    @staticmethod
    def _gates(baseline: dict[str, Any], walk: dict[str, Any], robustness: dict[str, Any], cpcv: dict[str, Any]) -> list[dict[str, Any]]:
        checks = [
            ("minimum_trades", float(baseline.get("total_trades", 0)), 5, ">="),
            ("max_drawdown", float(baseline.get("max_drawdown_pct", 100)), 20, "<="),
            ("oos_return", float(walk.get("out_of_sample_return_pct", -100)), 0, ">"),
            ("pbo", float((robustness.get("pbo") or {}).get("pbo", 1)), 0.5, "<"),
            ("cpcv_profitable_paths", float((cpcv.get("cpcv") or {}).get("profitable_paths_pct", 0)), 55, ">="),
        ]
        return [{"gate": name, "value": value, "threshold": threshold, "operator": operator, "passed": value >= threshold if operator == ">=" else value <= threshold if operator == "<=" else value > threshold if operator == ">" else value < threshold} for name, value, threshold, operator in checks]
