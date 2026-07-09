"""Generate Chapter 29 publication figures."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import subprocess
import sys
from typing import Any

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dashboard.catalog import SNAPSHOT_NAMES, offline_status  # noqa: E402
from dashboard.snapshot import list_snapshots, load_fixture, load_snapshot  # noqa: E402


BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
INK = "#111827"
MUTED = "#64748B"
GRID = "#E5E7EB"
PAPER = "#F7F9FC"


def setup_matplotlib() -> None:
    plt.rcParams["font.sans-serif"] = [
        "SimHei",
        "Microsoft YaHei",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def snapshot_rows() -> list[dict[str, Any]]:
    status = offline_status()
    snapshots = {row["name"]: row for row in list_snapshots()}
    now = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []
    for name in SNAPSHOT_NAMES:
        item = status["datasets"][name]
        snap = snapshots.get(name, {})
        saved_at = _parse_dt(snap.get("saved_at"))
        age_min = (now - saved_at).total_seconds() / 60 if saved_at else None
        rows.append(
            {
                "name": name,
                "active_layer": item["active_layer"],
                "snapshot_complete": bool(item["snapshot"]["complete"]),
                "fixture_complete": bool(item["fixture"]["complete"]),
                "snapshot_reason": item["snapshot"].get("reason") or "",
                "fixture_reason": item["fixture"].get("reason") or "",
                "saved_at": snap.get("saved_at"),
                "origin": snap.get("origin"),
                "history_count": int(snap.get("history_count") or 0),
                "age_min": age_min,
            }
        )
    return rows


def save_snapshot_draft_path() -> None:
    drawio = OUT / "chapter-29-snapshot-draft-path.drawio"
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "export_drawio_png.py"),
            str(drawio),
            "-o",
            str(OUT / "chapter-29-snapshot-draft-path.png"),
            "--width",
            "1600",
        ],
        check=True,
    )
    print(OUT / "chapter-29-snapshot-draft-path.png")


def save_snapshot_age_history_chart() -> None:
    rows = snapshot_rows()
    rows = sorted(rows, key=lambda row: row["age_min"] if row["age_min"] is not None else 10**9, reverse=True)
    labels = [row["name"] for row in rows]
    ages = [float(row["age_min"] or 0) / 60 for row in rows]
    histories = [row["history_count"] for row in rows]
    colors = [RED if age > 24 else ORANGE if age > 6 else TEAL for age in ages]
    fig, ax1 = plt.subplots(figsize=(12.8, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    x = list(range(len(labels)))
    ax1.bar(x, ages, color=colors, label="快照年龄（小时）")
    ax1.axhline(24, color=RED, linestyle="--", linewidth=1.3, label="24h 停止线")
    ax1.set_ylabel("小时")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, rotation=24, ha="right")
    ax1.grid(axis="y", color=GRID, linewidth=0.8)
    ax1.spines[["top"]].set_visible(False)
    ax2 = ax1.twinx()
    ax2.plot(x, histories, color=BLUE, marker="o", linewidth=2, label="history_count")
    ax2.set_ylabel("历史条数")
    ax2.spines[["top"]].set_visible(False)
    ax1.legend(frameon=False, loc="upper left")
    ax2.legend(frameon=False, loc="upper right")
    ax1.text(0.0, -0.26, "红色表示超过 24 小时草稿停止线；蓝线显示历史快照是否持续留存，而不是覆盖最新文件。", transform=ax1.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-29-snapshot-age-history.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-29-snapshot-age-history.png")


def save_automation_level_ladder() -> None:
    actions = [
        ("拉取公开数据", 1, TEAL),
        ("保存快照", 1, TEAL),
        ("完整性检查", 1, TEAL),
        ("生成研究草稿", 2, ORANGE),
        ("形成结论", 3, PURPLE),
        ("修改风控阈值", 4, RED),
        ("执行交易", 5, RED),
    ]
    labels = [item[0] for item in actions]
    levels = [item[1] for item in actions]
    colors = [item[2] for item in actions]
    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar(labels, levels, color=colors)
    ax.set_yticks([1, 2, 3, 4, 5])
    ax.set_yticklabels(["自动", "草稿", "审批", "高危审批", "停止"])
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(axis="x", rotation=18)
    ax.text(0.0, -0.21, "29 讲只允许自动化到草稿层；结论、风控阈值和交易动作留给后续审批门。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-29-automation-level-ladder.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-29-automation-level-ladder.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_snapshot_draft_path()
    save_snapshot_age_history_chart()
    save_automation_level_ladder()


if __name__ == "__main__":
    main()
