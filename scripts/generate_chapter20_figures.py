"""Generate Chapter 20 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.pollution import run_lookahead_effect_demo  # noqa: E402


BLUE = "#2563EB"
TEAL = "#0F9B8E"
RED = "#DC2626"
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


def save_lookahead_effect_curve() -> None:
    payload = run_lookahead_effect_demo()
    curve = payload["curve"]
    summary = payload["summary"]
    days = [point["day"] for point in curve]
    clean = [point["clean"] for point in curve]
    polluted = [point["polluted"] for point in curve]

    fig, ax = plt.subplots(figsize=(10.5, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(days, clean, color=TEAL, linewidth=2.3, label="干净规则：上一日收益决定仓位")
    ax.plot(days, polluted, color=RED, linewidth=2.5, label="污染规则：偷看当日收益方向")
    ax.fill_between(days, clean, polluted, where=[p >= c for p, c in zip(polluted, clean, strict=True)], color=RED, alpha=0.08)
    ax.set_xlabel("样本日")
    ax.set_ylabel("权益")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper left", frameon=False)
    ax.text(
        0.01,
        -0.2,
        (
            f"同一组收益：干净规则最终权益 {summary['clean_final_equity']}；"
            f"污染规则最终权益 {summary['polluted_final_equity']}。污染曲线只说明前视会夸大效果。"
        ),
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-20-lookahead-effect-curve.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-20-lookahead-effect-curve.png")


def save_false_positive_curve() -> None:
    trial_counts = list(range(1, 81))
    alpha = 0.05
    false_positive = [1 - (1 - alpha) ** count for count in trial_counts]
    checkpoints = [1, 5, 10, 20, 50, 80]

    fig, ax = plt.subplots(figsize=(10.5, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(trial_counts, [value * 100 for value in false_positive], color=RED, linewidth=2.5)
    ax.scatter(checkpoints, [(1 - (1 - alpha) ** n) * 100 for n in checkpoints], color=BLUE, s=70, zorder=2)
    for n in checkpoints:
        value = (1 - (1 - alpha) ** n) * 100
        ax.text(n, value + 2.2, f"{value:.0f}%", ha="center", fontsize=9.5, color=INK)
    ax.set_xlabel("尝试次数 n")
    ax.set_ylabel("至少一次假阳性概率（%）")
    ax.set_ylim(0, 102)
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(
        0.01,
        -0.18,
        "假设每次尝试的假阳性概率为 5%；至少一次命中概率 = 1 - (1 - 0.05)^n。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-20-false-positive-curve.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-20-false-positive-curve.png")


def save_pbo_winner_decay_curve() -> None:
    params = list(range(1, 16))
    in_sample = [0.25, 0.38, 0.52, 0.68, 0.86, 1.03, 1.22, 1.41, 1.63, 1.94, 1.72, 1.5, 1.31, 1.12, 0.95]
    out_sample = [0.31, 0.44, 0.58, 0.7, 0.82, 0.9, 0.96, 0.99, 0.94, 0.42, 0.71, 0.83, 0.76, 0.66, 0.55]
    winner_index = max(range(len(params)), key=lambda index: in_sample[index])
    robust_index = max(range(len(params)), key=lambda index: out_sample[index])

    fig, ax = plt.subplots(figsize=(10.5, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(params, in_sample, color=BLUE, linewidth=2.4, marker="o", label="样本内 Sharpe")
    ax.plot(params, out_sample, color=TEAL, linewidth=2.4, marker="o", label="样本外 Sharpe")
    ax.scatter(params[winner_index], in_sample[winner_index], color=RED, s=95, zorder=3, label="样本内冠军")
    ax.scatter(params[winner_index], out_sample[winner_index], color=RED, s=95, marker="x", zorder=3, label="冠军的样本外表现")
    ax.scatter(params[robust_index], out_sample[robust_index], color=TEAL, s=95, zorder=3, edgecolor=INK, label="样本外更优参数")
    ax.vlines(
        params[winner_index],
        out_sample[winner_index],
        in_sample[winner_index],
        colors=RED,
        linestyles="dashed",
        linewidth=1.6,
        alpha=0.75,
    )
    ax.set_xlabel("候选参数编号")
    ax.set_ylabel("Sharpe")
    ax.set_xticks(params)
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper left", frameon=False, ncols=2)
    ax.text(
        0.01,
        -0.2,
        (
            "读图：编号 10 是样本内冠军，但样本外 Sharpe 明显回落；"
            "这正是 PBO/CSCV 要识别的“选择过程制造冠军”。"
        ),
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-20-pbo-winner-decay.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-20-pbo-winner-decay.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    setup_matplotlib()
    save_lookahead_effect_curve()
    save_false_positive_curve()
    save_pbo_winner_decay_curve()


if __name__ == "__main__":
    main()
