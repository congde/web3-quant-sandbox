"""Run the fixed, publication-safe Chapter 33 teaching scenario."""

from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.research_path import run_research_path  # noqa: E402
from backtest.trace import run_teaching_scenario  # noqa: E402
from risk import ExecutionBoundaryRequest, classify_execution_request  # noqa: E402


def build_chapter33_payload() -> dict:
    research = run_research_path(include_audit=True)
    scenario = run_teaching_scenario()
    boundary = classify_execution_request(
        ExecutionBoundaryRequest(
            symbol="WEB3-DEMO/USDT",
            signal="BUY",
            requested_action="real_order",
            capability="simulation_only",
            human_confirmed=True,
        )
    )
    return {
        "input_contract": research["input_contract"],
        "path_steps": research["path"],
        "report_summary": research["report_summary"],
        "rolling_summary": research["rolling_summary"],
        "realistic_cost_summary": research["realistic_cost_summary"],
        "risk_findings": research["risk_findings"],
        "audit_summary": research["audit_summary"],
        "teaching_scenario": {
            "scenario": scenario["scenario"],
            "trades": scenario["trades"],
            "pending_at_end": scenario["pending_at_end"],
            "risk_rejections": scenario["risk_rejections"],
            "final_equity": scenario["final_equity"],
        },
        "execution_boundary": {
            "allowed": boundary.allowed,
            "outcome": boundary.outcome,
            "reason": boundary.reason,
        },
    }


def main() -> None:
    print(json.dumps(build_chapter33_payload(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
