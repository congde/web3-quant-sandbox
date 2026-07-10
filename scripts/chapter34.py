"""Run the fixed, publication-safe Chapter 34 integration audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.research_path import run_research_path  # noqa: E402
from backtest.rolling.service import (  # noqa: E402
    TEACHING_SYMBOL,
    run_cpcv_service,
    run_robustness_audit,
)


def build_chapter34_payload() -> dict:
    research = run_research_path(include_audit=True)
    robustness = run_robustness_audit(
        strategy_name="ma_crossover",
        symbol=TEACHING_SYMBOL,
        limit=120,
    )
    cpcv = run_cpcv_service(
        strategy_name="ma_crossover",
        symbol=TEACHING_SYMBOL,
        limit=120,
    )
    return {
        "input_contract": research["input_contract"],
        "path": research["path"],
        "report_summary": research["report_summary"],
        "rolling_summary": research["rolling_summary"],
        "realistic_cost_summary": research["realistic_cost_summary"],
        "risk_findings": research["risk_findings"],
        "audit_summary": research["audit_summary"],
        "robustness": {
            "symbol": robustness["symbol"],
            "cost_preset": robustness["cost_preset"],
            "pbo": robustness["pbo"],
            "parameter_sensitivity": robustness["parameter_sensitivity"],
            "verdict": robustness["verdict"],
        },
        "cpcv": {
            "symbol": cpcv["symbol"],
            "cost_preset": cpcv["cost_preset"],
            "audit": cpcv["cpcv"],
        },
    }


def select_section(payload: dict, section: str) -> dict:
    if section == "path":
        return {
            "input_contract": payload["input_contract"],
            "path": payload["path"],
            "audit_summary": payload["audit_summary"],
            "risk_findings": payload["risk_findings"],
        }
    if section == "reconciliation":
        return {
            "input_contract": payload["input_contract"],
            "report": payload["report_summary"],
            "rolling": payload["rolling_summary"],
            "realistic_cost": payload["realistic_cost_summary"],
            "audit": payload["audit_summary"],
            "risk_findings": payload["risk_findings"],
        }
    if section == "audit":
        return {
            "input_contract": payload["input_contract"],
            "audit_summary": payload["audit_summary"],
            "robustness": payload["robustness"],
            "cpcv": payload["cpcv"],
        }
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--section",
        choices=("all", "path", "reconciliation", "audit"),
        default="all",
    )
    args = parser.parse_args()
    payload = select_section(build_chapter34_payload(), args.section)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
