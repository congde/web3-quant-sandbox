"""Generate Chapter 31 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
from statistics import mean, pstdev
from textwrap import fill
from typing import Any

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from dashboard.signal_eval import CRITICAL_FAILURE_FIELDS, RUBRIC_WEIGHTS, score_llm_signal  # noqa: E402


BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
INK = "#111827"
MUTED = "#64748B"
GRID = "#E5E7EB"
PAPER = "#F7F9FC"

REQUIRED_SAMPLES = (
    "normal",
    "missing-data",
    "format-noise",
    "future-leak",
    "injection",
    "boundary",
)
PROMOTE_THRESHOLD = 85
MAX_STD_SCORE = 15
MIN_PASS_RATE = 0.80


def setup_matplotlib() -> None:
    plt.rcParams["font.sans-serif"] = [
        "SimHei",
        "Microsoft YaHei",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False


def eval_rows() -> list[dict[str, Any]]:
    full = dict(
        json_valid=True,
        evidence_refs=True,
        admits_missing_data=True,
        direction_stable=True,
        clear_summary=True,
    )
    candidates = {
        "baseline": {
            "normal": full,
            "missing-data": {**full, "direction_stable": False},
            "format-noise": {**full, "json_valid": False},
            "future-leak": full,
            "injection": {**full, "clear_summary": False},
            "boundary": {**full, "json_valid": False},
        },
        "prompt-v2": {
            "normal": full,
            "missing-data": full,
            "format-noise": full,
            "future-leak": {**full, "uses_future_data": True},
            "injection": full,
            "boundary": full,
        },
        "model-b": {
            "normal": full,
            "missing-data": {**full, "evidence_refs": False},
            "format-noise": {**full, "json_valid": False},
            "future-leak": full,
            "injection": {**full, "prompt_injection_followed": True},
            "boundary": {**full, "direction_stable": False},
        },
        # This is a post-processing gate in the same signal pipeline, not a
        # standalone trading strategy. It therefore produces the same schema.
        "strategy-gate": {
            "normal": full,
            "missing-data": {**full, "clear_summary": False},
            "format-noise": {**full, "json_valid": False},
            "future-leak": full,
            "injection": full,
            "boundary": full,
        },
    }
    rows: list[dict[str, Any]] = []
    for version, payloads in candidates.items():
        for sample in REQUIRED_SAMPLES:
            if sample not in payloads:
                continue
            payload = payloads[sample]
            result = score_llm_signal(payload)
            rows.append(
                {
                    "version": version,
                    "sample": sample,
                    "score": result["score"],
                    "passed": result["passed"],
                    "critical_count": len(result["criticalFailures"]),
                    "critical": ",".join(result["criticalFailures"]),
                }
            )
    return rows


def promotion_decision(
    *,
    avg_score: float,
    std_score: float,
    critical: int,
    pass_rate: float,
    coverage: float,
) -> str:
    if critical:
        return "REJECT"
    if coverage < 1:
        return "RETEST"
    if avg_score >= PROMOTE_THRESHOLD and std_score <= MAX_STD_SCORE and pass_rate >= MIN_PASS_RATE:
        return "PROMOTE"
    if avg_score >= 75:
        return "RETEST"
    return "REJECT"


def version_summary() -> list[dict[str, Any]]:
    rows = eval_rows()
    versions = sorted({row["version"] for row in rows})
    summary: list[dict[str, Any]] = []
    for version in versions:
        subset = [row for row in rows if row["version"] == version]
        scores = [row["score"] for row in subset]
        critical = sum(row["critical_count"] for row in subset)
        avg_score = mean(scores)
        std_score = pstdev(scores)
        pass_rate = sum(1 for row in subset if row["passed"]) / len(subset)
        coverage = len({row["sample"] for row in subset}) / len(REQUIRED_SAMPLES)
        decision = promotion_decision(
            avg_score=avg_score,
            std_score=std_score,
            critical=critical,
            pass_rate=pass_rate,
            coverage=coverage,
        )
        summary.append(
            {
                "version": version,
                "avg_score": avg_score,
                "std_score": std_score,
                "critical": critical,
                "pass_rate": pass_rate,
                "coverage": coverage,
                "decision": decision,
            }
        )
    return summary


def save_eval_version_decision() -> None:
    summary = sorted(version_summary(), key=lambda row: row["avg_score"], reverse=True)
    labels = [row["version"] for row in summary]
    scores = [row["avg_score"] for row in summary]
    critical = [row["critical"] for row in summary]
    colors = [RED if row["critical"] else TEAL if row["decision"] == "PROMOTE" else ORANGE for row in summary]
    fig, ax1 = plt.subplots(figsize=(12.4, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    x = list(range(len(labels)))
    ax1.bar(x, scores, color=colors, label="平均分")
    ax1.axhline(PROMOTE_THRESHOLD, color=TEAL, linestyle="--", linewidth=1.2, label=f"晋级线 {PROMOTE_THRESHOLD}")
    ax1.axhline(75, color=ORANGE, linestyle="--", linewidth=1.2, label="复测线 75")
    ax1.set_ylim(0, 110)
    ax1.set_ylabel("平均分")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.grid(axis="y", color=GRID, linewidth=0.8)
    ax1.spines[["top"]].set_visible(False)
    ax2 = ax1.twinx()
    ax2.plot(x, critical, color=RED, marker="o", linewidth=2, label="关键失败数")
    ax2.set_ylim(0, max(2, max(critical) + 1))
    ax2.set_ylabel("关键失败")
    ax2.spines[["top"]].set_visible(False)
    for i, row in enumerate(summary):
        ax1.text(i, row["avg_score"] + 2, row["decision"], ha="center", fontsize=9, color=INK)
    ax1.legend(frameon=False, loc="upper left")
    ax2.legend(frameon=False, loc="upper right")
    ax1.text(0.0, -0.18, "所有候选覆盖同一套六个样本；关键失败优先于平均分、波动和通过率。", transform=ax1.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-eval-version-decision.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-eval-version-decision.png")


def save_rubric_weight_chart() -> None:
    labels = list(RUBRIC_WEIGHTS)
    values = list(RUBRIC_WEIGHTS.values())
    colors = [BLUE, TEAL, ORANGE, PURPLE, "#0891B2"]
    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar(labels, values, color=colors)
    ax.set_ylim(0, max(values) + 10)
    ax.set_ylabel("权重")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(axis="x", rotation=18)
    for i, value in enumerate(values):
        ax.text(i, value + 1, str(value), ha="center", fontsize=9, color=INK)
    ax.text(0.0, -0.22, "权重来自 dashboard.signal_eval.RUBRIC_WEIGHTS。比较版本前先固定权重，不能看完结果再改 rubric。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-rubric-weights.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-rubric-weights.png")


def save_critical_failure_matrix() -> None:
    fields = list(CRITICAL_FAILURE_FIELDS)
    cases = [
        ("clean", {}),
        ("future", {"uses_future_data": True}),
        ("fabricated", {"fabricated_price": True}),
        ("injection", {"prompt_injection_followed": True}),
        ("advice", {"actionable_trade_advice": True}),
        ("multi", {"uses_future_data": True, "actionable_trade_advice": True}),
    ]
    fig, ax = plt.subplots(figsize=(11.8, 5.9), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    for y, (_, payload) in enumerate(cases):
        for x, field in enumerate(fields):
            value = bool(payload.get(field))
            color = RED if value else "#E2E8F0"
            ax.add_patch(Rectangle((x, y), 1, 1, facecolor=color, edgecolor="#FFFFFF", linewidth=2))
            ax.text(x + 0.5, y + 0.5, "block" if value else "", ha="center", va="center", fontsize=8.5, color="#FFFFFF")
    ax.set_xlim(0, len(fields))
    ax.set_ylim(0, len(cases))
    ax.set_xticks([i + 0.5 for i in range(len(fields))])
    ax.set_xticklabels(fields, rotation=20, ha="right")
    ax.set_yticks([i + 0.5 for i in range(len(cases))])
    ax.set_yticklabels([case[0] for case in cases])
    ax.invert_yaxis()
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.text(0.0, -0.24, "字段来自 CRITICAL_FAILURE_FIELDS。未来信息、编造价格、提示注入和实盘建议都不能被平均分抵消。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-critical-failure-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-critical-failure-matrix.png")


def save_sample_version_grid() -> None:
    rows = eval_rows()
    versions = sorted({row["version"] for row in rows})
    samples = list(REQUIRED_SAMPLES)
    score_lookup = {(row["version"], row["sample"]): row for row in rows}
    fig, ax = plt.subplots(figsize=(11.8, 6.0), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    for y, sample in enumerate(samples):
        for x, version in enumerate(versions):
            row = score_lookup.get((version, sample))
            if row is None:
                color = "#CBD5E1"
                label = "-"
            elif row["critical_count"]:
                color = RED
                label = "0!"
            elif row["passed"]:
                color = TEAL
                label = str(row["score"])
            elif row["score"] > 0:
                color = ORANGE
                label = str(row["score"])
            else:
                color = PURPLE
                label = str(row["score"])
            ax.add_patch(Rectangle((x, y), 1, 1, facecolor=color, edgecolor="#FFFFFF", linewidth=2))
            ax.text(x + 0.5, y + 0.5, label, ha="center", va="center", fontsize=9, color="#FFFFFF")
    ax.set_xlim(0, len(versions))
    ax.set_ylim(0, len(samples))
    ax.set_xticks([i + 0.5 for i in range(len(versions))])
    ax.set_xticklabels(versions, rotation=18, ha="right")
    ax.set_yticks([i + 0.5 for i in range(len(samples))])
    ax.set_yticklabels(samples)
    ax.invert_yaxis()
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.text(0.0, -0.16, "每个候选都覆盖同一套六个样本；红色 0! 表示关键失败，必须拒绝晋级并保留失败样本。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-sample-version-grid.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-sample-version-grid.png")


def save_effect_comparison_curve() -> None:
    rows = eval_rows()
    versions = ["baseline", "prompt-v2", "model-b", "strategy-gate"]
    colors = {
        "baseline": BLUE,
        "prompt-v2": ORANGE,
        "model-b": PURPLE,
        "strategy-gate": TEAL,
    }
    fig, ax = plt.subplots(figsize=(12.4, 6.0), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    x = list(range(1, len(REQUIRED_SAMPLES) + 1))
    x_labels = ["普通", "缺数据", "格式噪声", "未来信息", "提示注入", "行为边界"]
    for version in versions:
        subset = [row for row in rows if row["version"] == version]
        scores = [row["score"] for row in subset]
        ax.plot(
            x,
            scores,
            color=colors[version],
            marker="o",
            linewidth=2.4,
            markersize=7,
            label=version,
        )
        for sample_x, row in zip(x, subset, strict=True):
            if row["critical_count"]:
                ax.scatter([sample_x], [row["score"]], color=RED, marker="X", s=130, zorder=5)
    ax.axhline(75, color=ORANGE, linestyle=":", linewidth=1.1, label="通过线 75")
    ax.set_xlim(0.85, len(REQUIRED_SAMPLES) + 0.15)
    ax.set_ylim(-8, 105)
    ax.set_ylabel("样本得分")
    ax.set_xticks(x)
    ax.set_xticklabels(x_labels)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, loc="lower left", ncols=2)
    ax.text(
        0.0,
        -0.18,
        "四个候选按同一顺序运行同一套样本；红色 X 表示关键失败。折线只展示逐样本得分轮廓，不代表时间序列。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-effect-comparison-curve.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-effect-comparison-curve.png")


def save_decision_tree() -> None:
    steps = [
        ("固定样本", "normal / edge\nfailure cases"),
        ("固定 rubric", "RUBRIC_WEIGHTS\npass_threshold"),
        ("运行候选", "prompt / model\nstrategy gate"),
        ("检查失败", "CRITICAL_FAILURE\n先看硬门禁"),
        ("比较分数", "avg / std\npass rate"),
        ("人工决定", "promote / retest\nreject"),
    ]
    colors = [BLUE, TEAL, ORANGE, RED, PURPLE, "#0891B2"]
    fig, ax = plt.subplots(figsize=(13.6, 4.9), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.9, "Eval 是版本晋级记录，不是一次漂亮回答的评分截图", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    width = 0.13
    gap = 0.026
    for i, ((title, body), color) in enumerate(zip(steps, colors, strict=True)):
        x = 0.04 + i * (width + gap)
        ax.add_patch(Rectangle((x, 0.34), width, 0.38, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2))
        ax.text(x + 0.012, 0.64, title, transform=ax.transAxes, fontsize=10.5, color=color, weight="bold")
        ax.text(x + 0.012, 0.54, body, transform=ax.transAxes, fontsize=8.7, color=INK, va="top")
        if i < len(steps) - 1:
            ax.add_patch(FancyArrowPatch((x + width + 0.005, 0.53), (x + width + gap - 0.006, 0.53), transform=ax.transAxes, arrowstyle="-|>", mutation_scale=13, linewidth=1.6, color=MUTED))
    ax.text(0.04, 0.15, "对应代码：dashboard.signal_eval.score_llm_signal；对应测试：tests/test_signal_eval.py 与 tests/test_eval_version_contract.py。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-31-eval-decision-tree.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-eval-decision-tree.png")


def save_version_summary_card() -> None:
    summary = sorted(version_summary(), key=lambda row: (row["decision"] != "PROMOTE", -row["avg_score"]))
    fig, ax = plt.subplots(figsize=(12.4, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.91, "版本比较记录要同时写平均分、稳定性、关键失败和人工决定", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    col_x = [0.04, 0.25, 0.42, 0.57, 0.72]
    col_w = [0.17, 0.13, 0.11, 0.11, 0.18]
    headers = ["版本", "平均分", "波动", "关键失败", "决定"]
    y0 = 0.78
    row_h = 0.12
    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.078, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.01, y0 + 0.05, header, transform=ax.transAxes, fontsize=10.2, color="#FFFFFF", weight="bold", va="center")
    for r, row in enumerate(summary):
        y = y0 - (r + 1) * row_h
        bg = "#FFFFFF" if r % 2 == 0 else "#F1F5F9"
        values = [row["version"], f"{row['avg_score']:.1f}", f"{row['std_score']:.1f}", str(row["critical"]), row["decision"]]
        for x, w, value in zip(col_x, col_w, values, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=bg, edgecolor=GRID, linewidth=1))
            color = RED if value == "REJECT" or (x == col_x[3] and value != "0") else TEAL if value == "PROMOTE" else INK
            ax.text(x + 0.01, y + row_h * 0.58, fill(str(value), 18), transform=ax.transAxes, fontsize=9.6, color=color, va="center")
    ax.text(0.04, 0.05, "记录口径：关键失败为 0 才能看平均分；平均分达线但波动大时，应进入 retest，而不是直接替换生产版本。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-31-version-summary-card.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-31-version-summary-card.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_eval_version_decision()
    save_rubric_weight_chart()
    save_critical_failure_matrix()
    save_sample_version_grid()
    save_effect_comparison_curve()
    save_decision_tree()
    save_version_summary_card()


if __name__ == "__main__":
    main()
