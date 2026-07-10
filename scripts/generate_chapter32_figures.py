"""Generate Chapter 32 publication figures."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys
from textwrap import fill
from typing import Any

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Polygon, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dashboard.catalog import SNAPSHOT_NAMES, offline_status  # noqa: E402
from dashboard.persist import annotate_cached  # noqa: E402
from dashboard.signal_eval import score_llm_signal  # noqa: E402
from dashboard.snapshot import list_snapshots  # noqa: E402
from risk import evaluate_backtest_risk  # noqa: E402


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


def snapshot_health_rows() -> list[dict[str, Any]]:
    status = offline_status()
    snapshots = {row["name"]: row for row in list_snapshots()}
    now = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []
    for name in SNAPSHOT_NAMES:
        item = status["datasets"][name]
        snap = snapshots.get(name, {})
        saved_at = _parse_dt(snap.get("saved_at"))
        age_hours = (now - saved_at).total_seconds() / 3600 if saved_at else None
        rows.append(
            {
                "name": name,
                "complete": bool(item["snapshot"]["complete"] or item["fixture"]["complete"]),
                "active_layer": item["active_layer"],
                "origin": snap.get("origin") or "",
                "history_count": int(snap.get("history_count") or 0),
                "age_hours": age_hours,
            }
        )
    return rows


def save_failure_audit_loop() -> None:
    fig, ax = plt.subplots(figsize=(13.6, 6.2), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.92, "失败恢复不是单向成功流程：先分流，再复测，最后过关闭门禁", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")

    def box(x: float, y: float, w: float, h: float, title: str, body: str, color: str) -> None:
        ax.add_patch(Rectangle((x, y), w, h, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2))
        ax.text(x + 0.012, y + h - 0.045, title, transform=ax.transAxes, fontsize=10.5, color=color, weight="bold", va="top")
        ax.text(x + 0.012, y + h - 0.105, body, transform=ax.transAxes, fontsize=8.6, color=INK, va="top", linespacing=1.35)

    def arrow(
        start: tuple[float, float],
        end: tuple[float, float],
        *,
        connectionstyle: str = "arc3",
        color: str = MUTED,
    ) -> None:
        ax.add_patch(
            FancyArrowPatch(
                start,
                end,
                transform=ax.transAxes,
                arrowstyle="-|>",
                mutation_scale=13,
                linewidth=1.6,
                color=color,
                connectionstyle=connectionstyle,
            )
        )

    box(0.04, 0.58, 0.15, 0.20, "发现并建事件", "保留失败时间、输入\n状态和原始错误", RED)
    box(0.24, 0.58, 0.15, 0.20, "分类与定级", "data / LLM / Eval\nrisk / page", ORANGE)
    decision = Polygon(
        [(0.49, 0.80), (0.57, 0.68), (0.49, 0.56), (0.41, 0.68)],
        closed=True,
        transform=ax.transAxes,
        facecolor="#FFFFFF",
        edgecolor=BLUE,
        linewidth=2,
    )
    ax.add_patch(decision)
    ax.text(0.49, 0.68, "允许\n降级？", transform=ax.transAxes, ha="center", va="center", fontsize=10, color=BLUE, weight="bold")
    box(0.63, 0.69, 0.15, 0.18, "降级观察", "显示来源和时间\n不能冒充 live", TEAL)
    box(0.63, 0.43, 0.15, 0.18, "阻断交付", "critical / blocked\n进入人工复核", RED)
    box(0.83, 0.56, 0.14, 0.22, "针对性复测", "绑定失败样本、\n命令和实际结果", PURPLE)
    box(0.63, 0.12, 0.15, 0.20, "关闭门禁", "人工决定完整？\n剩余风险已记录？", "#0891B2")
    box(0.40, 0.12, 0.14, 0.20, "关闭并回归", "写 closed_at\n保留回归样本", TEAL)
    box(0.40, 0.38, 0.14, 0.16, "修复并补证", "复测失败 / 字段不全\n修复后重新分类", RED)

    arrow((0.19, 0.68), (0.24, 0.68))
    arrow((0.39, 0.68), (0.41, 0.68))
    arrow((0.57, 0.72), (0.63, 0.77))
    arrow((0.57, 0.64), (0.63, 0.52))
    ax.text(0.585, 0.76, "是", transform=ax.transAxes, fontsize=8.5, color=TEAL)
    ax.text(0.585, 0.56, "否", transform=ax.transAxes, fontsize=8.5, color=RED)
    arrow((0.78, 0.78), (0.83, 0.70))
    arrow((0.78, 0.52), (0.83, 0.63))
    arrow((0.86, 0.56), (0.76, 0.32), connectionstyle="arc3,rad=-0.18")
    ax.text(0.80, 0.43, "通过", transform=ax.transAxes, fontsize=8.5, color=TEAL)
    ax.plot([0.94, 0.94, 0.58], [0.56, 0.36, 0.36], transform=ax.transAxes, color=RED, linewidth=1.6)
    arrow((0.58, 0.36), (0.54, 0.45), connectionstyle="arc3,rad=0.08", color=RED)
    ax.text(0.83, 0.335, "失败", transform=ax.transAxes, fontsize=8.5, color=RED)
    arrow((0.63, 0.22), (0.54, 0.22))
    ax.text(0.55, 0.245, "字段完整", transform=ax.transAxes, fontsize=8.5, color=TEAL)
    arrow((0.63, 0.18), (0.53, 0.38), connectionstyle="arc3,rad=-0.18")
    arrow((0.40, 0.47), (0.31, 0.58), connectionstyle="arc3,rad=-0.08")
    ax.text(0.55, 0.33, "不完整", transform=ax.transAxes, fontsize=8.5, color=RED)
    ax.text(0.04, 0.04, "cached 仍属于降级状态；recovered 只有通过关闭门禁后才能进入 closed。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-32-failure-audit-loop.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-32-failure-audit-loop.png")


def save_snapshot_recovery_health() -> None:
    rows = sorted(snapshot_health_rows(), key=lambda row: row["history_count"], reverse=True)
    labels = [row["name"] for row in rows]
    history = [row["history_count"] for row in rows]
    age = [float(row["age_hours"] or 0) for row in rows]
    colors = [TEAL if row["complete"] else RED for row in rows]
    fig, ax1 = plt.subplots(figsize=(12.8, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    x = list(range(len(rows)))
    ax1.bar(x, history, color=colors, label="history_count")
    ax1.set_ylabel("历史快照数")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, rotation=24, ha="right")
    ax1.grid(axis="y", color=GRID, linewidth=0.8)
    ax1.spines[["top"]].set_visible(False)
    ax2 = ax1.twinx()
    ax2.plot(x, age, color=ORANGE, marker="o", linewidth=2, label="快照年龄（小时）")
    ax2.axhline(24, color=RED, linestyle="--", linewidth=1.2, label="24h 标记线")
    ax2.set_ylabel("小时")
    ax2.spines[["top"]].set_visible(False)
    ax1.legend(frameon=False, loc="upper left")
    ax2.legend(frameon=False, loc="upper right")
    ax1.text(0.0, -0.25, "数据来自 offline_status() 与 list_snapshots()。历史数量证明失败前后有留痕，年龄用于判断是否需要降级或标记 stale。", transform=ax1.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-32-snapshot-recovery-health.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-32-snapshot-recovery-health.png")


def save_degradation_path_matrix() -> None:
    rows = [
        ("live data timeout", "annotate_cached", "snapshot", "continue with cached"),
        ("snapshot incomplete", "load_offline", "fixture", "draft only"),
        ("LLM missing key", "run_llm_signal", "rule baseline", "research_record"),
        ("critical eval", "score_llm_signal", "reject", "stop delivery"),
        ("risk rejection", "evaluate_backtest_risk", "finding", "human review"),
        ("real order request", "execution boundary", "blocked", "stop"),
    ]
    fig, ax = plt.subplots(figsize=(12.4, 6.0), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.91, "降级路径必须诚实标记来源，不能把替代材料写成主路径成功", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    headers = ["失败", "处理函数", "降级/阻断", "审计动作"]
    col_x = [0.04, 0.31, 0.53, 0.70]
    col_w = [0.23, 0.18, 0.13, 0.22]
    y0 = 0.80
    row_h = 0.105
    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.078, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.01, y0 + 0.05, header, transform=ax.transAxes, fontsize=10.2, color="#FFFFFF", weight="bold", va="center")
    for r, row in enumerate(rows):
        y = y0 - (r + 1) * row_h
        bg = "#FFFFFF" if r % 2 == 0 else "#F1F5F9"
        for x, w, value in zip(col_x, col_w, row, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=bg, edgecolor=GRID, linewidth=1))
            color = RED if value in {"reject", "blocked", "stop"} else INK
            ax.text(x + 0.01, y + row_h * 0.58, fill(value, 24), transform=ax.transAxes, fontsize=9.4, color=color, va="center")
    ax.text(0.04, 0.04, "审计口径：降级后可以继续研究，但必须显示 source、cached_at、criticalFailures、risk rule 或 blocked reason。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-32-degradation-path-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-32-degradation-path-matrix.png")


def incident_rows() -> list[dict[str, Any]]:
    cached = annotate_cached({"ok": True, "source": "snapshot", "snapshot": {"saved_at": "2026-06-13T00:00:00+00:00"}})
    eval_failure = score_llm_signal({field: True for field in ["json_valid", "evidence_refs", "admits_missing_data", "direction_stable", "clear_summary"]} | {"fabricated_price": True})
    risk_findings = evaluate_backtest_risk(
        {
            "metrics": {
                "maximum_drawdown_pct": -18.5,
                "strategy_return_pct": 4.0,
                "buy_hold_return_pct": 8.0,
                "trade_count": 8,
            },
            "curve": list(range(20)),
            "risk_rejections": [
                {"rule_id": "EMERGENCY_HALT", "reason": "manual incident halt"},
                {"rule_id": "EMERGENCY_HALT", "reason": "manual incident halt"},
            ],
        }
    )
    return [
        {"case": "data cache", "severity": "warning", "status": "fallback", "evidence": "live_error" if cached.get("live_error") else ""},
        {"case": "eval fail", "severity": "critical", "status": "reject", "evidence": ",".join(eval_failure["criticalFailures"])},
        {"case": "risk halt", "severity": "critical", "status": "blocked", "evidence": risk_findings[0]["rule_id"]},
        {"case": "post risk", "severity": "warning", "status": "review", "evidence": ",".join(sorted({row["rule_id"] for row in risk_findings}))},
        {"case": "task done", "severity": "info", "status": "done", "evidence": "result saved"},
    ]


def save_incident_severity_card() -> None:
    rows = incident_rows()
    severity_score = {"info": 1, "warning": 2, "critical": 3}
    colors = {"info": TEAL, "warning": ORANGE, "critical": RED}
    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    labels = [row["case"] for row in rows]
    scores = [severity_score[row["severity"]] for row in rows]
    ax.bar(labels, scores, color=[colors[row["severity"]] for row in rows])
    ax.set_yticks([1, 2, 3])
    ax.set_yticklabels(["info", "warning", "critical"])
    ax.set_ylim(0, 3.6)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    for i, row in enumerate(rows):
        ax.text(i, scores[i] + 0.08, row["status"], ha="center", fontsize=9, color=INK)
    ax.text(0.0, -0.18, "示例由 annotate_cached()、score_llm_signal()、evaluate_backtest_risk() 产生。critical 不能自动关闭。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-32-incident-severity-card.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-32-incident-severity-card.png")


def save_recovery_sla_timeline() -> None:
    minutes = [0, 3, 8, 15, 24, 37, 45]
    states = ["失败", "已分类", "已降级", "复测", "已恢复", "审计", "已关闭"]
    score = [3, 3, 2, 2, 1, 1, 0]
    colors = [RED, RED, ORANGE, ORANGE, TEAL, BLUE, MUTED]
    fig, ax = plt.subplots(figsize=(12.2, 5.5), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(minutes, score, color=BLUE, linewidth=2.2, marker="o")
    for x, y, state, color in zip(minutes, score, states, colors, strict=True):
        ax.scatter([x], [y], s=130, color=color, zorder=3)
        ax.text(x, y + 0.17, state, ha="center", fontsize=9, color=INK)
    ax.set_yticks([0, 1, 2, 3])
    ax.set_yticklabels(["已关闭", "已恢复", "降级中", "失败"])
    ax.set_xlabel("分钟")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(0.0, -0.18, "恢复不是覆盖失败文件；状态从 failed 到 closed 的每一步都要保留时间、原因、命令和人工决定。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-32-recovery-sla-timeline.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-32-recovery-sla-timeline.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_failure_audit_loop()
    save_snapshot_recovery_health()
    save_incident_severity_card()
    save_recovery_sla_timeline()


if __name__ == "__main__":
    main()
