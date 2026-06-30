from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def test_final_acceptance_commands_and_rubric_exist() -> None:
    required = [
        ROOT / "verify.py",
        ROOT / "scripts" / "course.py",
        ROOT / "scripts" / "verify_courseware.py",
        ROOT / "scripts" / "audit_assets.py",
        ROOT / "eval-rubric.md",
        ROOT / "playbook.md",
    ]
    missing = [path.relative_to(ROOT).as_posix() for path in required if not path.is_file()]
    assert missing == []


def test_course_check_runs_the_full_acceptance_stack() -> None:
    text = (ROOT / "scripts" / "course.py").read_text(encoding="utf-8")
    assert '"verify"' in text
    assert '"vendor-drift"' in text
    assert '"asset-audit"' in text
    assert '"courseware-check"' in text


def test_publishable_chapters_are_complete_through_chapter_35() -> None:
    chapter_numbers = []
    for path in (ROOT / "docs" / "v2").glob("*.md"):
        match = re.match(r"^(?:00|0[1-9]|[12][0-9]|3[0-5])-", path.name)
        if match:
            chapter_numbers.append(int(path.name.split("-", 1)[0]))
    assert sorted(chapter_numbers) == list(range(36))


def test_eval_rubric_requires_handoff_and_safety_boundary() -> None:
    text = (ROOT / "eval-rubric.md").read_text(encoding="utf-8")
    assert "Safety boundary" in text
    assert "Handoff" in text
    assert "Do not expand automation unless all five dimensions score 2" in text
