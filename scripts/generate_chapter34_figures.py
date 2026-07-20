"""Generate Chapter 34 publication figures."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
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


def save_research_path_contracts() -> None:
    steps = [
        ("固定输入", "symbol / window\nstrategy / cost"),
        ("研究与回测", "signal / trades\nequity / metrics"),
        ("审计与风控", "DSR / PBO / CPCV\nrisk_findings"),
        ("API 响应", "payload / status\nresearch_run_id"),
        ("页面消费", "visible fields\nstop action"),
    ]
    colors = [BLUE, TEAL, PURPLE, ORANGE, RED]
    fig, ax = plt.subplots(figsize=(13.6, 4.9), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.9, "字段交接必须保留输入身份、生产者、消费者和失败出口", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    width = 0.16
    gap = 0.035
    for i, ((title, body), color) in enumerate(zip(steps, colors, strict=True)):
        x = 0.04 + i * (width + gap)
        ax.add_patch(Rectangle((x, 0.34), width, 0.38, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2))
        ax.text(x + 0.012, 0.64, title, transform=ax.transAxes, fontsize=11, color=color, weight="bold")
        ax.text(x + 0.012, 0.54, body, transform=ax.transAxes, fontsize=8.7, color=INK, va="top")
        if i < len(steps) - 1:
            ax.add_patch(FancyArrowPatch((x + width + 0.005, 0.53), (x + width + gap - 0.006, 0.53), transform=ax.transAxes, arrowstyle="-|>", mutation_scale=13, linewidth=1.6, color=MUTED))
    ax.text(0.04, 0.17, "四类断链：无生产者  ·  无消费者  ·  口径不一致  ·  停止线未改变动作", transform=ax.transAxes, fontsize=11, color=RED, weight="bold")
    ax.text(0.04, 0.10, "定位顺序：页面字段 → API 响应 → 生产函数 → 输入合同 → 交付动作", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.savefig(OUT / "chapter-34-research-path-contracts.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-34-research-path-contracts.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_research_path_contracts()


if __name__ == "__main__":
    main()
