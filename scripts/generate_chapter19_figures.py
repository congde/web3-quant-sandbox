"""Generate Chapter 19 publication figures."""

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

from backtest.audit.dsr import deflated_sharpe_ratio  # noqa: E402
from backtest.metrics_explain import explain_metrics  # noqa: E402
from backtest.trace import run_ma_crossover_trace  # noqa: E402


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


def save_equity_drawdown() -> None:
    trace = run_ma_crossover_trace()
    trail = trace["trail"]
    steps = [item["step"] for item in trail]
    equity = [float(item["equity_after"] or 0.0) for item in trail]

    peak = []
    drawdown = []
    current_peak = equity[0]
    for value in equity:
        current_peak = max(current_peak, value)
        peak.append(current_peak)
        drawdown.append(value / current_peak - 1.0)

    fig, axes = plt.subplots(2, 1, figsize=(11, 7), dpi=160, sharex=True)
    fig.patch.set_facecolor(PAPER)
    for ax in axes:
        ax.set_facecolor("#FFFFFF")
        ax.grid(color=GRID, linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)

    axes[0].plot(steps, equity, color=BLUE, marker="o", linewidth=2, label="权益")
    axes[0].plot(steps, peak, color=TEAL, linestyle="--", linewidth=1.8, label="历史峰值")
    axes[0].set_ylabel("权益")
    axes[0].legend(loc="upper left", frameon=False)

    drawdown_pct = [value * 100 for value in drawdown]
    axes[1].fill_between(steps, drawdown_pct, 0, color=RED, alpha=0.25)
    axes[1].plot(steps, drawdown_pct, color=RED, linewidth=1.8)
    axes[1].set_xlabel("成交序号")
    axes[1].set_ylabel("回撤（%）")
    axes[1].text(
        0.01,
        -0.28,
        "数据来自 backtest.trace.run_ma_crossover_trace()；用于教学复核，不代表投资建议。",
        transform=axes[1].transAxes,
        fontsize=10,
        color=MUTED,
    )

    fig.tight_layout()
    fig.savefig(OUT / "chapter-19-equity-drawdown.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-19-equity-drawdown.png")


def save_metrics_comparison() -> None:
    payload = explain_metrics(limit=120)
    rows = payload["strategies"]
    labels = [row["strategy_key"] for row in rows]
    returns = [float(row["total_return_pct"]) for row in rows]
    drawdowns = [float(row["max_drawdown_pct"]) for row in rows]
    calmars = [float(row["calmar_ratio"]) for row in rows]

    x_pos = list(range(len(labels)))
    width = 0.25
    fig, ax = plt.subplots(figsize=(12, 6.4), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar([x - width for x in x_pos], returns, width=width, color=BLUE, label="总收益 %")
    ax.bar(x_pos, drawdowns, width=width, color=RED, label="最大回撤 %")
    ax.bar([x + width for x in x_pos], calmars, width=width, color=TEAL, label="Calmar")
    ax.axhline(0, color="#94A3B8", linewidth=1)
    ax.set_xticks(x_pos)
    ax.set_xticklabels(labels, rotation=18, ha="right")
    ax.set_ylabel("指标值")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper left", frameon=False)
    ax.text(
        0.01,
        -0.28,
        f"engine={payload['engine']}，样本 K 线={payload['total_candles']}；数据来自 explain_metrics(limit=120)。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )

    fig.tight_layout()
    fig.savefig(OUT / "chapter-19-metrics-comparison.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-19-metrics-comparison.png")


def save_return_vs_drawdown_rank() -> None:
    payload = explain_metrics(limit=120)
    rows = payload["strategies"]
    x = [row["return_rank"] for row in rows]
    y = [row["drawdown_rank"] for row in rows]
    sizes = [max(80, row["total_trades"] * 35) for row in rows]
    colors = [BLUE if row["strategy_key"] == payload["highest_return"] else TEAL if row["strategy_key"] == payload["lowest_drawdown"] else ORANGE for row in rows]

    fig, ax = plt.subplots(figsize=(8.6, 7), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.scatter(x, y, s=sizes, c=colors, alpha=0.9)
    for row in rows:
        ax.text(row["return_rank"] + 0.06, row["drawdown_rank"] + 0.05, row["strategy_key"], fontsize=9.3, color=INK)
    ax.set_xlim(0.5, len(rows) + 0.7)
    ax.set_ylim(len(rows) + 0.7, 0.5)
    ax.set_xticks(range(1, len(rows) + 1))
    ax.set_yticks(range(1, len(rows) + 1))
    ax.set_xlabel("收益排名（1 最好）")
    ax.set_ylabel("回撤排名（1 最低）")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(
        0.02,
        -0.16,
        f"收益最高：{payload['highest_return']}；回撤最低：{payload['lowest_drawdown']}；气泡大小表示交易次数。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-19-rank-tradeoff.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-19-rank-tradeoff.png")


def save_dsr_vs_trials() -> None:
    observed_sr = 1.2
    sample_length = 120
    trial_counts = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]
    dsrs = [
        float(deflated_sharpe_ratio(observed_sr, sample_length, count)["dsr"])
        for count in trial_counts
    ]
    psrs = [
        float(deflated_sharpe_ratio(observed_sr, sample_length, count)["psr"])
        for count in trial_counts
    ]
    emax = [
        float(deflated_sharpe_ratio(observed_sr, sample_length, count)["expected_max_sharpe"])
        for count in trial_counts
    ]

    fig, ax = plt.subplots(figsize=(11, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(trial_counts, psrs, color=BLUE, linestyle="--", marker="s", linewidth=2, label="PSR")
    ax.plot(trial_counts, dsrs, color=RED, marker="o", linewidth=2.3, label="DSR")
    ax.plot(trial_counts, [min(1, v / 3) for v in emax], color=ORANGE, linestyle=":", linewidth=2, label="expected max Sharpe / 3")
    ax.axhline(0.95, color=TEAL, linewidth=1.4, linestyle="-.", label="0.95 参考线")
    ax.set_xscale("log")
    ax.set_ylim(0, 1.04)
    ax.set_xlabel("试验次数 num_trials（对数刻度）")
    ax.set_ylabel("概率或归一化门槛")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="lower left", frameon=False)
    ax.text(
        0.01,
        -0.24,
        "固定 observed_sr=1.2、sample_length=120；计算来自 backtest.audit.dsr.deflated_sharpe_ratio()。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )

    fig.tight_layout()
    fig.savefig(OUT / "chapter-19-dsr-vs-trials.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-19-dsr-vs-trials.png")


def save_performance_card() -> None:
    payload = explain_metrics(limit=120)
    rows = payload["strategies"]
    highest = next(row for row in rows if row["strategy_key"] == payload["highest_return"])
    lowest = next(row for row in rows if row["strategy_key"] == payload["lowest_drawdown"])
    card_rows = [
        ("样本口径", f"{payload['symbol']} / {payload['kline_type']} / {payload['total_candles']} 根 K 线"),
        ("收益最高", f"{highest['strategy_key']}：{highest['total_return_pct']}%，回撤 {highest['max_drawdown_pct']}%"),
        ("回撤最低", f"{lowest['strategy_key']}：回撤 {lowest['max_drawdown_pct']}%，交易 {lowest['total_trades']} 笔"),
        ("风险调整", f"最高收益策略 Sharpe={highest['sharpe_ratio']}，Calmar={highest['calmar_ratio']}"),
        ("审计提醒", "交易次数少、试验次数多时，必须看 trades、PSR/DSR 与样本外。"),
    ]

    fig, ax = plt.subplots(figsize=(11.5, 5.7), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.9, "绩效解释卡：不要把收益第一直接写成策略第一", fontsize=16, color=INK, weight="bold", transform=ax.transAxes)
    y = 0.75
    for label, value in card_rows:
        ax.add_patch(Rectangle((0.04, y - 0.055), 0.18, 0.095, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.add_patch(Rectangle((0.22, y - 0.055), 0.72, 0.095, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=GRID))
        ax.text(0.06, y - 0.005, label, fontsize=11.5, color="#FFFFFF", weight="bold", transform=ax.transAxes, va="center")
        ax.text(0.24, y - 0.005, fill(value, 58), fontsize=11.2, color=INK, transform=ax.transAxes, va="center")
        y -= 0.125
    ax.text(
        0.04,
        0.08,
        "结论模板：先写观察，再写代价，最后写下一步研究动作；不要把单一指标当作交易许可。",
        fontsize=10.5,
        color=MUTED,
        transform=ax.transAxes,
    )
    fig.savefig(OUT / "chapter-19-performance-card.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-19-performance-card.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    setup_matplotlib()
    save_equity_drawdown()
    save_metrics_comparison()
    save_return_vs_drawdown_rank()
    save_dsr_vs_trials()
    save_performance_card()


if __name__ == "__main__":
    main()
