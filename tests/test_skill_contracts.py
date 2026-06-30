from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "research-report-check" / "SKILL.md"


def test_research_report_check_skill_has_publishable_contract() -> None:
    text = SKILL.read_text(encoding="utf-8")
    assert "name: research-report-check" in text
    assert "description:" in text
    assert "## Required inputs" in text
    assert "## Workflow" in text
    assert "## Decision rules" in text
    assert "## Output" in text
    assert "claim_ledger:" in text
    assert "decision: pass | revise | reject" in text


def test_research_report_check_skill_preserves_safety_boundaries() -> None:
    text = SKILL.read_text(encoding="utf-8").lower()
    for phrase in [
        "real-account access",
        "wallet authorization",
        "order execution",
        "personalized investment advice",
        "future-return promises",
        "do not treat llm confidence as a probability of profit",
        "do not treat historical performance as evidence of future returns",
    ]:
        assert phrase in text
