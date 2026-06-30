from __future__ import annotations

from dashboard.catalog import SNAPSHOT_NAMES, offline_status
from dashboard.snapshot import list_snapshots


def test_snapshot_automation_reports_required_datasets() -> None:
    status = offline_status()
    assert status["ok"] is True
    assert status["total_count"] >= len(SNAPSHOT_NAMES)
    assert set(SNAPSHOT_NAMES).issubset(status["datasets"])

    for name in SNAPSHOT_NAMES:
        item = status["datasets"][name]
        assert item["active_layer"] in {"snapshot", "fixture", "none"}
        assert "complete" in item["snapshot"]
        assert "complete" in item["fixture"]


def test_snapshot_automation_keeps_metadata_and_history_counts() -> None:
    rows = [row for row in list_snapshots() if row["name"] in SNAPSHOT_NAMES]
    assert rows

    for row in rows:
        assert row["path"]
        assert "saved_at" in row
        assert "origin" in row
        assert "history_count" in row
