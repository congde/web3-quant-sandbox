from __future__ import annotations

from pathlib import Path
import re

import pytest

from scripts import course


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


def test_public_repository_does_not_bundle_upstream_checkouts() -> None:
    assert not (ROOT / "vendor").exists()


def test_course_check_runs_the_full_acceptance_stack() -> None:
    text = (ROOT / "scripts" / "course.py").read_text(encoding="utf-8")
    assert '"verify"' in text
    assert '"asset-audit"' in text
    assert '"courseware-check"' in text
    assert "vendor-drift" not in text


def test_public_verify_excludes_private_courseware_tests() -> None:
    text = (ROOT / "verify.py").read_text(encoding="utf-8")
    assert '"not courseware"' in text


def test_public_check_skips_private_courseware_when_absent(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    calls = []
    monkeypatch.setattr(course, "COURSEWARE_DIR", tmp_path / "missing")
    for task in ("verify", "implementation-matrix", "asset-audit", "courseware-check"):
        monkeypatch.setitem(
            course.TASKS,
            task,
            lambda task=task: calls.append(task),
        )

    course.check()

    assert calls == ["verify"]
    assert "Skipping private courseware checks" in capsys.readouterr().out


@pytest.mark.courseware
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
