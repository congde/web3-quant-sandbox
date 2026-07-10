"""生成第 35 讲的出版图稿。"""

from __future__ import annotations

from pathlib import Path
from textwrap import fill

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


def save_acceptance_retro_loop() -> None:
    steps = [
        ("固定入口\n复跑", "同一输入与命令"),
        ("逐项\n定状态", "验证／部分／停止"),
        ("失败证据\n归档", "原因与恢复动作"),
        ("风险待办\n排序", "先证据后功能"),
        ("同组命令\n复验", "结果可由他人复查"),
    ]
    colors = [BLUE, TEAL, ORANGE, RED, PURPLE]
    fig, ax = plt.subplots(figsize=(12.8, 5.2), dpi=180)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(
        0.04,
        0.9,
        "最终验收不是句号，而是证据、停止线与下一轮行动组成的闭环",
        transform=ax.transAxes,
        fontsize=15,
        color=INK,
        weight="bold",
    )
    width = 0.14
    for index, ((title, body), color) in enumerate(zip(steps, colors, strict=True)):
        x = 0.06 + index * 0.18
        ax.add_patch(
            Rectangle(
                (x, 0.38),
                width,
                0.28,
                transform=ax.transAxes,
                facecolor="#FFFFFF",
                edgecolor=color,
                linewidth=2,
            )
        )
        ax.text(
            x + width / 2,
            0.56,
            title,
            transform=ax.transAxes,
            ha="center",
            va="center",
            fontsize=13,
            color=color,
            weight="bold",
        )
        ax.text(
            x + width / 2,
            0.43,
            body,
            transform=ax.transAxes,
            ha="center",
            va="center",
            fontsize=9.3,
            color=INK,
        )
        if index < len(steps) - 1:
            ax.add_patch(
                FancyArrowPatch(
                    (x + width + 0.012, 0.52),
                    (x + 0.18 - 0.014, 0.52),
                    transform=ax.transAxes,
                    arrowstyle="-|>",
                    mutation_scale=13,
                    linewidth=1.6,
                    color=MUTED,
                )
            )
    ax.add_patch(
        FancyArrowPatch(
            (0.78, 0.32),
            (0.13, 0.32),
            transform=ax.transAxes,
            connectionstyle="arc3,rad=-0.35",
            arrowstyle="-|>",
            mutation_scale=14,
            linewidth=1.6,
            color=MUTED,
        )
    )
    ax.text(
        0.29,
        0.17,
        "任一硬门禁失败，都回到修复和复跑；未验证不能写成已通过。",
        transform=ax.transAxes,
        fontsize=10.5,
        color=MUTED,
    )
    fig.savefig(OUT / "chapter-35-acceptance-retro-loop.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-35-acceptance-retro-loop.png")


def save_risk_backlog_priority() -> None:
    items = [
        ("真实账户隔离", 0.96, 0.28, RED),
        ("浏览器会话留证", 0.88, 0.62, PURPLE),
        ("统一运行标识", 0.84, 0.55, ORANGE),
        ("样本外窗口", 0.80, 0.48, ORANGE),
        ("页面风险字段", 0.72, 0.38, BLUE),
        ("失败注入样本", 0.76, 0.42, TEAL),
        ("前端包体积提示", 0.34, 0.36, MUTED),
    ]
    fig, ax = plt.subplots(figsize=(10.8, 6.5), dpi=180)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.axhspan(0, 0.45, color="#ECFDF5", alpha=0.7)
    ax.axhspan(0.45, 1, color="#FEF2F2", alpha=0.55)
    ax.axvspan(0, 0.55, color="#FFFFFF", alpha=0.65)
    ax.axvspan(0.55, 1, color="#F8FAFC", alpha=0.7)
    for label, impact, effort, color in items:
        ax.scatter(effort, impact, s=150, color=color, edgecolor="#FFFFFF", linewidth=1.5)
        ax.text(effort + 0.018, impact + 0.012, fill(label, 9), fontsize=9.5, color=INK)
    ax.set_xlim(0.15, 0.95)
    ax.set_ylim(0.25, 1.02)
    ax.set_xlabel("修复成本")
    ax.set_ylabel("对结论可信度的影响")
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(0.16, 0.98, "优先补证据与边界", fontsize=10, color=RED, weight="bold")
    ax.text(0.16, 0.29, "可排期清理", fontsize=10, color=TEAL, weight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-35-risk-backlog-priority.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-35-risk-backlog-priority.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_acceptance_retro_loop()
    save_risk_backlog_priority()


if __name__ == "__main__":
    main()
