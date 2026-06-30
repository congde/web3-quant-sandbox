"""Generate Chapter 21 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
from textwrap import fill

import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.rolling.service import (  # noqa: E402
    compare_windows,
    execute_backtest,
    run_cpcv_service,
    run_robustness_audit,
    run_walk_forward,
)
from backtest.trials import reset_ledger_for_tests  # noqa: E402


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


def save_compare_windows() -> None:
    payload = compare_windows(strategy_name="ma_crossover", num_windows=3, limit=120)
    rows = payload["windows"]
    labels = [f"W{row['window']}" for row in rows]
    returns = [float(row["total_return_pct"]) for row in rows]
    drawdowns = [float(row["max_drawdown_pct"]) for row in rows]
    trades = [int(row["total_trades"]) for row in rows]

    x_pos = list(range(len(labels)))
    width = 0.34
    fig, ax1 = plt.subplots(figsize=(10.5, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    ax1.bar([x - width / 2 for x in x_pos], returns, width=width, color=BLUE, label="总收益 %")
    ax1.bar([x + width / 2 for x in x_pos], drawdowns, width=width, color=RED, label="最大回撤 %")
    ax1.axhline(0, color="#94A3B8", linewidth=1)
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels(labels)
    ax1.set_ylabel("百分比")
    ax1.grid(axis="y", color=GRID, linewidth=0.8)
    ax1.spines[["top", "right"]].set_visible(False)

    ax2 = ax1.twinx()
    ax2.plot(x_pos, trades, color=TEAL, marker="o", linewidth=2, label="交易次数")
    ax2.set_ylabel("交易次数")
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", frameon=False)
    ax1.text(
        0.01,
        -0.18,
        f"strategy={payload['strategy_key']}，positive_windows={payload['positive_windows']}，stable={payload['stable']}。",
        transform=ax1.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-21-compare-windows.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-compare-windows.png")


def save_walk_forward() -> None:
    reset_ledger_for_tests()
    payload = run_walk_forward(strategy_name="ma_crossover", num_windows=2, limit=120)
    labels = ["样本内 Sharpe", "样本外 Sharpe", "DSR"]
    values = [
        float(payload["in_sample_sharpe"]),
        float(payload["out_of_sample_sharpe"]),
        float(payload["dsr"]),
    ]
    colors = [BLUE, ORANGE, RED]

    fig, ax = plt.subplots(figsize=(9.6, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    bars = ax.bar(labels, values, color=colors, width=0.55)
    ax.axhline(0, color="#94A3B8", linewidth=1)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    for bar, value in zip(bars, values, strict=True):
        va = "bottom" if value >= 0 else "top"
        ax.text(bar.get_x() + bar.get_width() / 2, value, f"{value:.2f}", ha="center", va=va, fontsize=11)
    ax.text(
        0.01,
        -0.18,
        f"best_params={payload['best_params']}，num_trials={payload['num_trials']}，overfit_warning={payload['overfit_warning']}。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-21-walkforward-sharpe.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-walkforward-sharpe.png")


def save_cpcv_distribution() -> None:
    payload = run_cpcv_service(strategy_name="ma_crossover", limit=120)
    cpcv = payload["cpcv"]
    path_sharpes = [float(row["sharpe"]) for row in cpcv["paths"]]

    fig, ax = plt.subplots(figsize=(10, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.hist(path_sharpes, bins=min(8, max(4, len(path_sharpes))), color="#60A5FA", edgecolor="#1E40AF", alpha=0.9)
    for value, color, label in (
        (float(cpcv["sharpe_p5"]), ORANGE, "p5"),
        (float(cpcv["sharpe_p50"]), RED, "p50"),
        (float(cpcv["sharpe_p95"]), TEAL, "p95"),
    ):
        ax.axvline(value, color=color, linestyle="--", linewidth=2, label=f"Sharpe {label}={value:.2f}")
    ax.set_xlabel("样本外 Sharpe")
    ax.set_ylabel("路径数量")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper right", frameon=False)
    ax.text(
        0.01,
        -0.18,
        f"num_paths={cpcv['num_paths']}，profitable_paths={cpcv['profitable_paths_pct']}%，verdict={cpcv['verdict']}。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-21-cpcv-sharpe-dist.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-cpcv-sharpe-dist.png")


def save_parameter_sensitivity() -> None:
    payload = run_robustness_audit(strategy_name="ma_crossover", limit=120)
    rows = payload["parameter_sensitivity"]["perturbations"]
    labels = [f"{row['param']}\n{row['direction']}" for row in rows]
    drift = [float(row["return_drift_pct"]) for row in rows]
    colors = [TEAL if row["stable"] else RED for row in rows]

    fig, ax = plt.subplots(figsize=(11.5, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar(labels, drift, color=colors, width=0.6)
    ax.axhline(30, color=ORANGE, linestyle="--", linewidth=1.5, label="30% 漂移参考线")
    ax.set_ylabel("收益漂移（%）")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper right", frameon=False)
    ax.text(
        0.01,
        -0.24,
        f"stability_score={payload['parameter_sensitivity']['stability_score']}，PBO={payload['pbo']['pbo']}，verdict={payload['verdict']}。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-21-parameter-sensitivity.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-parameter-sensitivity.png")


def save_cost_preset_comparison() -> None:
    rows = [
        execute_backtest(strategy_name="ma_crossover", limit=120, cost_preset=preset)
        for preset in ["teaching", "realistic", "perp"]
    ]
    labels = [row["cost_preset"] for row in rows]
    returns = [float(row["total_return_pct"]) for row in rows]
    sharpes = [float(row["sharpe_ratio"]) for row in rows]

    x_pos = list(range(len(labels)))
    width = 0.34
    fig, ax1 = plt.subplots(figsize=(9.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    ax1.bar([x - width / 2 for x in x_pos], returns, width=width, color=BLUE, label="总收益 %")
    ax1.set_ylabel("总收益（%）")
    ax1.axhline(0, color="#94A3B8", linewidth=1)
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels(labels)
    ax1.grid(axis="y", color=GRID, linewidth=0.8)
    ax1.spines[["top", "right"]].set_visible(False)

    ax2 = ax1.twinx()
    ax2.plot([x + width / 2 for x in x_pos], sharpes, color=RED, marker="o", linewidth=2.2, label="Sharpe")
    ax2.set_ylabel("Sharpe")
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper right", frameon=False)
    ax1.text(
        0.01,
        -0.18,
        "成本从 teaching 到 perp：收益 1.55% -> 0.43%，Sharpe 2.10 -> 1.28。",
        transform=ax1.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-21-cost-preset-comparison.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-cost-preset-comparison.png")


def save_audit_decision_card() -> None:
    windows = compare_windows(strategy_name="ma_crossover", num_windows=3, limit=120)
    reset_ledger_for_tests()
    walk = run_walk_forward(strategy_name="ma_crossover", num_windows=2, limit=120)
    robust = run_robustness_audit(strategy_name="ma_crossover", limit=120)
    cpcv = run_cpcv_service(strategy_name="ma_crossover", limit=120)["cpcv"]
    rows = [
        ("连续窗口", f"{windows['positive_windows']}/{windows['num_windows']} 正收益，stable={windows['stable']}", "降级：阶段依赖明显"),
        ("Walk-forward", f"OOS return={walk['out_of_sample_return_pct']}%，DSR={walk['dsr']}", "保留观察：DSR 不显著"),
        ("CPCV", f"{cpcv['num_paths']} 路径，盈利路径 {cpcv['profitable_paths_pct']}%，{cpcv['verdict']}", "不通过稳定性证明"),
        ("参数敏感性", f"stability_score={robust['parameter_sensitivity']['stability_score']}", "参数附近不稳"),
        ("PBO", f"PBO={robust['pbo']['pbo']}，verdict={robust['pbo']['verdict']}", "过拟合风险暂不高"),
    ]

    fig, ax = plt.subplots(figsize=(12, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.91, "滚动审计决策卡：不要把单次收益写成稳定性", fontsize=16, color=INK, weight="bold", transform=ax.transAxes)
    col_x = [0.04, 0.22, 0.57]
    col_w = [0.15, 0.31, 0.35]
    headers = ["检查", "真实结果", "处理决定"]
    y0 = 0.78
    row_h = 0.12
    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.075, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.012, y0 + 0.025, header, fontsize=11.2, color="#FFFFFF", weight="bold", transform=ax.transAxes)
    for i, row in enumerate(rows):
        y = y0 - (i + 1) * row_h
        fill_color = "#FFFFFF" if i % 2 == 0 else "#F8FAFC"
        for x, w, value in zip(col_x, col_w, row, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=fill_color, edgecolor=GRID))
            ax.text(x + 0.012, y + row_h / 2, fill(str(value), 36), fontsize=10.2, color=INK, transform=ax.transAxes, va="center")
    ax.text(
        0.04,
        0.07,
        "本样本结论：ma_crossover 可作为教学样本和研究线索，但不能写成稳定策略。",
        fontsize=10.5,
        color=MUTED,
        transform=ax.transAxes,
    )
    fig.savefig(OUT / "chapter-21-audit-decision-card.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-21-audit-decision-card.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    setup_matplotlib()
    save_compare_windows()
    save_walk_forward()
    save_cpcv_distribution()
    save_parameter_sensitivity()
    save_cost_preset_comparison()
    save_audit_decision_card()


if __name__ == "__main__":
    main()
