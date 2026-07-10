"""Generate Chapter 34 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.research_path import run_research_path  # noqa: E402


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


def path_payload() -> dict[str, Any]:
    return run_research_path(include_audit=True)


def save_research_path_contracts() -> None:
    steps = [
        ("信号", "signal\nscore / evidence"),
        ("策略", "strategy\nparams / rules"),
        ("回测", "trades\nequity / metrics"),
        ("审计", "DSR / PBO\nCPCV / trials"),
        ("风控", "risk_findings\nrule_id"),
        ("Web", "API payload\nvisible state"),
    ]
    colors = [BLUE, TEAL, ORANGE, PURPLE, RED, "#0891B2"]
    fig, ax = plt.subplots(figsize=(13.6, 4.9), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.9, "贯通不是只看页面 200，而是每段合同字段能反查", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    width = 0.13
    gap = 0.026
    for i, ((title, body), color) in enumerate(zip(steps, colors, strict=True)):
        x = 0.04 + i * (width + gap)
        ax.add_patch(Rectangle((x, 0.34), width, 0.38, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2))
        ax.text(x + 0.012, 0.64, title, transform=ax.transAxes, fontsize=11, color=color, weight="bold")
        ax.text(x + 0.012, 0.54, body, transform=ax.transAxes, fontsize=8.7, color=INK, va="top")
        if i < len(steps) - 1:
            ax.add_patch(FancyArrowPatch((x + width + 0.005, 0.53), (x + width + gap - 0.006, 0.53), transform=ax.transAxes, arrowstyle="-|>", mutation_scale=13, linewidth=1.6, color=MUTED))
    ax.text(0.04, 0.15, "对应代码：backtest.research_path、backtest.rolling.service、risk.simulation、app.py API routes、src/web/src/api.ts。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-34-research-path-contracts.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-34-research-path-contracts.png")


def save_path_layer_status() -> None:
    payload = path_payload()
    steps = payload["path"]
    labels = [item["name"] for item in steps]
    categories = ["core" if item["step"] <= 6 else "audit" for item in steps]
    values = [1 if category == "core" else 0.75 for category in categories]
    colors = [TEAL if category == "core" else ORANGE for category in categories]
    fig, ax = plt.subplots(figsize=(12.6, 6.2), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.barh(labels, values, color=colors)
    ax.invert_yaxis()
    ax.set_xlim(0, 1.15)
    ax.set_xlabel("合同覆盖")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(0.0, -0.12, "run_research_path(include_audit=True) 当前返回 10 个步骤；后 4 个步骤用于防止只看样本内结果。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-34-path-layer-status.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-34-path-layer-status.png")


def save_metric_consistency_chart() -> None:
    payload = path_payload()
    rows = [
        ("report", payload["report_summary"]["strategy_return_pct"], abs(payload["report_summary"]["maximum_drawdown_pct"])),
        ("rolling", payload["rolling_summary"]["total_return_pct"], abs(payload["rolling_summary"]["max_drawdown_pct"])),
        ("realistic", payload["realistic_cost_summary"]["total_return_pct"], 0),
    ]
    labels = [row[0] for row in rows]
    returns = [float(row[1] or 0) for row in rows]
    drawdowns = [float(row[2] or 0) for row in rows]
    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    x = list(range(len(rows)))
    ax.bar([i - 0.18 for i in x], returns, width=0.36, color=TEAL, label="return %")
    ax.bar([i + 0.18 for i in x], drawdowns, width=0.36, color=ORANGE, label="abs drawdown %")
    ax.axhline(0, color=GRID, linewidth=1)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False)
    ax.text(0.0, -0.17, "页面展示的指标必须能反查到同一次 API payload；不同口径不能混写成单一结论。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-34-metric-consistency-chart.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-34-metric-consistency-chart.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_research_path_contracts()
    save_path_layer_status()
    save_metric_consistency_chart()


if __name__ == "__main__":
    main()
