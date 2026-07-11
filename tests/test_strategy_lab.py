from __future__ import annotations

from pathlib import Path

import pytest

from strategy_lab.repository import StrategyLabRepository
from strategy_lab.llm.proposer import propose_strategy
from strategy_lab.llm.advisor import diagnose_experiment, explain_strategy, repair_strategy


def test_strategy_repository_creates_immutable_versions(tmp_path: Path) -> None:
    repository = StrategyLabRepository(tmp_path / "strategy_lab.db")
    strategy = repository.create_strategy({"name": "BTC 趋势", "description": "研究策略"})
    first = repository.create_version(
        strategy["id"],
        {
            "spec": {"signal": {"model": "ma", "fast": 5, "slow": 20}},
            "dsl_code": "def on_tick(ctx, candle):\n    return None\n",
            "change_reason": "initial",
        },
    )
    second = repository.create_version(
        strategy["id"],
        {
            "spec": {"signal": {"model": "ma", "fast": 7, "slow": 30}},
            "dsl_code": "def on_tick(ctx, candle):\n    return None\n",
            "parent_version_id": first["id"],
        },
    )

    assert first["version"] == 1
    assert second["version"] == 2
    assert second["parent_version_id"] == first["id"]
    assert repository.get_strategy(strategy["id"])["versions"][0]["version"] == 2
    assert repository.list_strategies()[0]["version_count"] == 2


def test_strategy_repository_rejects_incomplete_assets(tmp_path: Path) -> None:
    repository = StrategyLabRepository(tmp_path / "strategy_lab.db")
    with pytest.raises(ValueError, match="策略名称"):
        repository.create_strategy({"name": ""})

    strategy = repository.create_strategy({"name": "RSI"})
    with pytest.raises(ValueError, match="StrategySpec"):
        repository.create_version(strategy["id"], {"dsl_code": "pass"})


def test_strategy_proposal_has_governed_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    proposal = propose_strategy(objective="设计震荡市场 RSI 均值回归策略", symbol="BTC-USDT", risk_profile="conservative")
    assert proposal["source"] == "deterministic_fallback"
    assert proposal["spec"]["signal"]["model"] == "rsi"
    assert proposal["spec"]["risk"]["stop_loss_pct"] == 2.0
    assert proposal["failure_conditions"]


def test_experiment_progress_cancel_and_governance(tmp_path: Path) -> None:
    repository = StrategyLabRepository(tmp_path / "strategy_lab.db")
    strategy = repository.create_strategy({"name": "治理测试"})
    version = repository.create_version(strategy["id"], {"spec": {"signal": {"model": "ma"}}, "dsl_code": "def on_tick(ctx, candle):\n    return None\n"})
    experiment = repository.create_experiment(version["id"], {"experiment_type": "full_audit"})
    running = repository.update_experiment(experiment["id"], status="running", progress=30, phase="wfo", message="WFO running")
    assert running["progress"] == 30
    assert running["events"][-1]["phase"] == "wfo"
    assert repository.request_cancel(experiment["id"])["cancel_requested"] is True

    validated = repository.promote_version(version["id"], to_status="validated", reason="DSL gates passed")
    assert validated["status"] == "validated"
    assert repository.list_audit(version["id"])[0]["to_status"] == "validated"
    with pytest.raises(ValueError, match="非法状态流转"):
        repository.promote_version(version["id"], to_status="approved", reason="skip gates")


def test_llm_advisor_fallback_and_trace(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    explanation = explain_strategy({"signal": {"model": "ma"}})
    diagnosis = diagnose_experiment({"gates": [{"gate": "pbo", "passed": False}]})
    repaired = repair_strategy("def on_tick(ctx, candle):\n    return None\n")
    assert explanation["source"] == "deterministic_fallback"
    assert diagnosis["failed_gates"] == ["pbo"]
    assert repaired["ok"] is True

    repository = StrategyLabRepository(tmp_path / "strategy_lab.db")
    trace = repository.record_llm_trace(task="diagnose", input_payload={"id": "e1"}, output_payload=diagnosis, prompt="diagnose")
    assert trace["prompt_hash"]
    assert repository.list_llm_traces()[0]["output"]["failed_gates"] == ["pbo"]


def test_paper_run_requires_approved_version(tmp_path: Path) -> None:
    repository = StrategyLabRepository(tmp_path / "strategy_lab.db")
    strategy = repository.create_strategy({"name": "模拟策略"})
    version = repository.create_version(strategy["id"], {"spec": {"signal": {"model": "ma"}}, "dsl_code": "def on_tick(ctx, candle):\n    return None\n"})
    with pytest.raises(ValueError, match="approved"):
        repository.start_paper_run(version["id"])
    for state in ("validated", "backtested", "robustness_passed", "approved"):
        repository.promote_version(version["id"], to_status=state, reason="gate passed")
    run = repository.start_paper_run(version["id"], "paper validation")
    assert run["status"] == "running"
    assert repository.get_version(version["id"])["status"] == "paper_running"
    assert repository.stop_paper_run(run["id"])["status"] == "stopped"
