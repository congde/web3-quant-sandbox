"""Generate Chapter 18 publication figures."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys
from textwrap import fill

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.runner import load_prices, run_backtest  # noqa: E402
from backtest.trace import run_ma_crossover_trace, run_teaching_scenario  # noqa: E402
from paths import DATA_DIR  # noqa: E402


BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
INK = "#111827"
MUTED = "#64748B"
GRID = "#E5E7EB"
PAPER = "#F7F9FC"


def configure_plot() -> None:
    plt.rcParams["font.sans-serif"] = [
        "SimHei",
        "Microsoft YaHei",
        "Arial Unicode MS",
        "DejaVu Sans",
    ]
    plt.rcParams["axes.unicode_minus"] = False


def save_event_loop_flow() -> None:
    nodes = [
        ("1. settle", "先结算上一根 K 线\n留下的 pending"),
        ("2. history", "追加当前 candle\n策略只能读到此刻"),
        ("3. strategy", "on_tick(...)\n返回 OrderIntent"),
        ("4. risk/fill", "RiskManager 检查\n市价/限价/止损撮合"),
        ("5. record", "记录 trades\nrisk_rejections\nequity_curve"),
    ]
    colors = [BLUE, TEAL, ORANGE, RED, PURPLE]

    fig, ax = plt.subplots(figsize=(12, 4.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")

    xs = [0.04, 0.24, 0.44, 0.64, 0.84]
    width = 0.13
    for index, ((title, body), x, color) in enumerate(zip(nodes, xs, colors, strict=True)):
        ax.add_patch(
            Rectangle(
                (x, 0.34),
                width,
                0.42,
                transform=ax.transAxes,
                facecolor="#FFFFFF",
                edgecolor=color,
                linewidth=2,
            )
        )
        ax.text(x + 0.012, 0.67, title, transform=ax.transAxes, fontsize=12.5, color=color, weight="bold")
        ax.text(x + 0.012, 0.56, body, transform=ax.transAxes, fontsize=9.5, color=INK, va="top")
        if index < len(xs) - 1:
            ax.add_patch(
                FancyArrowPatch(
                    (x + width + 0.012, 0.55),
                    (xs[index + 1] - 0.014, 0.55),
                    transform=ax.transAxes,
                    arrowstyle="-|>",
                    mutation_scale=15,
                    linewidth=1.8,
                    color=MUTED,
                )
            )

    ax.text(
        0.04,
        0.16,
        "对应代码：src/strategy_engine/backtest/engine.py::BacktestEngine.run；顺序本身就是防未来函数的第一道门。",
        transform=ax.transAxes,
        fontsize=11,
        color=MUTED,
    )
    fig.savefig(OUT / "chapter-18-event-loop-flow.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-18-event-loop-flow.png")


def save_event_backtest_combo() -> None:
    trace = run_ma_crossover_trace()
    trail = trace["trail"]
    steps = [item["step"] for item in trail]
    equity = [float(item["equity_after"] or 0) for item in trail]
    prices = [float(item["price"]) for item in trail]
    colors = [TEAL if item["action"] == "BUY" else RED for item in trail]

    fig, axes = plt.subplots(2, 1, figsize=(10.8, 7), dpi=160, sharex=True)
    fig.patch.set_facecolor(PAPER)
    for ax in axes:
        ax.set_facecolor("#FFFFFF")
        ax.grid(color=GRID, linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)

    axes[0].plot(steps, prices, color=BLUE, linewidth=1.8)
    axes[0].scatter(steps, prices, c=colors, s=60)
    axes[0].set_ylabel("成交价")

    axes[1].plot(steps, equity, marker="o", color=ORANGE, linewidth=1.8)
    axes[1].set_xlabel("成交序号")
    axes[1].set_ylabel("成交后权益")
    axes[1].text(
        0.01,
        -0.26,
        f"trades={len(trail)}，risk_rejections={len(trace['risk_rejections'])}；数据来自 run_ma_crossover_trace()。",
        transform=axes[1].transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-18-event-backtest-combo.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-18-event-backtest-combo.png")


def save_teaching_scenario() -> None:
    payload = run_teaching_scenario()
    bars = payload["bars"]
    bar_ids = [row["bar"] for row in bars]
    closes = [row["close"] for row in bars]
    event_colors = {"fill": TEAL, "pending": ORANGE, "risk": RED}

    trade = payload["trades"][0]
    pending = payload["pending_at_end"][0]
    rejection = payload["risk_rejections"][0]
    paths = [
        (
            "第 3 根 K 线\n市价买入",
            f"收盘价 {trade['price']:.2f}\n立即成交",
            "trades\n+1 笔成交",
            TEAL,
        ),
        (
            "第 4 根 K 线\n低价限价买入",
            f"限价 {pending['price']:.2f}\n本 bar 不可成交",
            "pending_at_end\n保留 GTC 限价单",
            ORANGE,
        ),
        (
            "第 5 根 K 线\n超大市价买入",
            f"{rejection['rule_id']}\n下单前拦截",
            "risk_rejections\n记录 rule_id 与 reason",
            RED,
        ),
    ]

    fig, (price_ax, flow_ax) = plt.subplots(
        2,
        1,
        figsize=(12, 7.2),
        dpi=160,
        gridspec_kw={"height_ratios": [1.05, 2.3], "hspace": 0.18},
    )
    fig.patch.set_facecolor(PAPER)
    price_ax.set_facecolor("#FFFFFF")
    price_ax.plot(bar_ids, closes, color=BLUE, linewidth=1.8, marker="o", markersize=4.5)
    for row in bars:
        marker_color = "#CBD5E1"
        label = None
        if "fill" in row:
            marker_color = event_colors["fill"]
            label = "成交"
        elif row["bar"] == 4:
            marker_color = event_colors["pending"]
            label = "挂单"
        elif "risk_block" in row:
            marker_color = event_colors["risk"]
            label = "拒单"
        price_ax.scatter(row["bar"], row["close"], s=86, color=marker_color, zorder=3)
        if label:
            y_offset = -0.065 if label == "拒单" else 0.035
            price_ax.text(row["bar"], row["close"] + y_offset, label, ha="center", fontsize=10, color=marker_color)
    price_ax.set_xlim(0.6, 8.4)
    price_ax.set_ylabel("收盘价")
    price_ax.set_xticks(bar_ids)
    price_ax.set_xlabel("K 线序号")
    price_ax.grid(axis="y", color=GRID, linewidth=0.8)
    price_ax.spines[["top", "right"]].set_visible(False)
    price_ax.text(
        0.01,
        1.08,
        "8 根 K 线中，只有第 3、4、5 根产生订单路径；其余 K 线用于证明状态会继续推进。",
        transform=price_ax.transAxes,
        fontsize=10.5,
        color=MUTED,
    )

    flow_ax.set_facecolor("#FFFFFF")
    flow_ax.axis("off")
    columns = [
        ("策略意图", 0.04, 0.25),
        ("引擎判断", 0.37, 0.25),
        ("审计证据", 0.70, 0.25),
    ]
    for title, x, _width in columns:
        flow_ax.text(x, 0.92, title, transform=flow_ax.transAxes, fontsize=12, color=INK, weight="bold")

    y_positions = [0.68, 0.43, 0.18]
    for (intent, decision, evidence, color), y in zip(paths, y_positions, strict=True):
        for _title, x, width in columns:
            flow_ax.add_patch(
                Rectangle(
                    (x, y),
                    width,
                    0.16,
                    transform=flow_ax.transAxes,
                    facecolor="#FFFFFF",
                    edgecolor=color,
                    linewidth=1.8,
                )
            )
        flow_ax.text(0.06, y + 0.115, intent, transform=flow_ax.transAxes, fontsize=10.8, color=INK, va="top")
        flow_ax.text(0.39, y + 0.115, decision, transform=flow_ax.transAxes, fontsize=10.8, color=INK, va="top")
        flow_ax.text(0.72, y + 0.115, evidence, transform=flow_ax.transAxes, fontsize=10.8, color=INK, va="top")
        flow_ax.add_patch(
            FancyArrowPatch(
                (0.30, y + 0.08),
                (0.36, y + 0.08),
                transform=flow_ax.transAxes,
                arrowstyle="-|>",
                mutation_scale=13,
                linewidth=1.5,
                color=MUTED,
            )
        )
        flow_ax.add_patch(
            FancyArrowPatch(
                (0.63, y + 0.08),
                (0.69, y + 0.08),
                transform=flow_ax.transAxes,
                arrowstyle="-|>",
                mutation_scale=13,
                linewidth=1.5,
                color=MUTED,
            )
        )

    reason = "post-fill notional 18289.14 > max 10000；计算：(1 + 2000) × 9.14"
    flow_ax.text(
        0.01,
        -0.03,
        f"期末权益={payload['final_equity']:.2f}；拒单原因：{reason}",
        transform=flow_ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-18-teaching-scenario.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-18-teaching-scenario.png")


def save_teaching_timeline() -> None:
    payload = run_teaching_scenario()
    bars = payload["bars"]
    y = [1] * len(bars)
    colors = []
    labels = []
    for row in bars:
        if "fill" in row:
            colors.append(TEAL)
            labels.append("market fill")
        elif "risk_block" in row:
            colors.append(RED)
            labels.append(row["risk_block"]["rule_id"])
        elif row["bar"] == 4:
            colors.append(ORANGE)
            labels.append("limit pending")
        else:
            colors.append("#CBD5E1")
            labels.append("no event")

    fig, ax = plt.subplots(figsize=(11, 4.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.scatter([row["bar"] for row in bars], y, s=260, c=colors, zorder=2)
    ax.plot([row["bar"] for row in bars], y, color=GRID, linewidth=3, zorder=1)
    ax.set_yticks([])
    ax.set_xlabel("K 线序号")
    ax.set_xlim(0.4, len(bars) + 0.6)
    ax.set_ylim(0.68, 1.22)
    ax.spines[["top", "right", "left"]].set_visible(False)

    for row, label in zip(bars, labels, strict=True):
        ax.text(row["bar"], 1.08, f"bar {row['bar']}\n{row['date']}", ha="center", fontsize=9, color=INK)
        ax.text(row["bar"], 0.88, fill(label, 16), ha="center", fontsize=9.2, color=INK)
        ax.text(row["bar"], 0.78, f"C={row['close']}", ha="center", fontsize=8.8, color=MUTED)

    ax.text(
        0.01,
        -0.18,
        f"pending_at_end={len(payload['pending_at_end'])}，final_equity={payload['final_equity']}；每个事件都来自 run_teaching_scenario()。",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.subplots_adjust(left=0.05, right=0.98, top=0.82, bottom=0.24)
    fig.savefig(OUT / "chapter-18-teaching-timeline.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-18-teaching-timeline.png")


def save_risk_rejection_breakdown() -> None:
    report = run_backtest(load_prices(DATA_DIR / "prices.csv"))
    curve = report["curve"]
    rejections = report["risk_rejections"]
    dates = [datetime.fromisoformat(row["date"]) for row in curve]
    equity = [row["equity"] for row in curve]
    rejection_dates = {datetime.fromisoformat(row["date"]) for row in rejections}
    rejection_counts = [1 if date in rejection_dates else 0 for date in dates]
    threshold = 10_000 * 0.85
    first_rejection = min(rejection_dates)

    fig, axes = plt.subplots(
        2,
        1,
        figsize=(11.2, 6.4),
        dpi=160,
        sharex=True,
        gridspec_kw={"height_ratios": [3.0, 1.15], "hspace": 0.08},
    )
    fig.patch.set_facecolor(PAPER)
    equity_ax, reject_ax = axes
    for ax in axes:
        ax.set_facecolor("#FFFFFF")
        ax.spines[["top", "right"]].set_visible(False)
        ax.grid(axis="y", color=GRID, linewidth=0.8)

    equity_ax.plot(dates, equity, color=BLUE, linewidth=1.8, label="每日权益")
    equity_ax.axhline(threshold, color=RED, linestyle="--", linewidth=1.4, label="15% 回撤风控线")
    equity_ax.axvline(first_rejection, color=RED, linestyle=":", linewidth=1.5)
    equity_ax.fill_between(dates, threshold, equity, where=[value < threshold for value in equity], color=RED, alpha=0.08)
    equity_ax.set_ylabel("权益")
    equity_ax.legend(loc="upper right", frameon=False)
    equity_ax.text(
        first_rejection,
        threshold - 160,
        "首次拒单\n2025-03-31",
        ha="left",
        va="top",
        fontsize=10,
        color=RED,
    )

    reject_ax.bar(dates, rejection_counts, width=2.0, color=RED, alpha=0.9)
    reject_ax.set_ylim(0, 1.35)
    reject_ax.set_yticks([0, 1])
    reject_ax.set_yticklabels(["无", "拒单"])
    reject_ax.set_ylabel("买单")
    reject_ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    reject_ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    reject_ax.tick_params(axis="x", rotation=0)
    reject_ax.text(
        0.01,
        -0.52,
        f"成交只有 {len(report['trades'])} 笔；权益跌破 15% 回撤线后，后续买入意图被 MAX_DAILY_LOSS_PCT 连续拒绝 {len(rejections)} 次。",
        transform=reject_ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.subplots_adjust(left=0.08, right=0.98, top=0.96, bottom=0.22)
    fig.savefig(OUT / "chapter-18-risk-rejection-breakdown.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-18-risk-rejection-breakdown.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    configure_plot()
    save_event_loop_flow()
    save_event_backtest_combo()
    save_teaching_scenario()
    save_teaching_timeline()
    save_risk_rejection_breakdown()


if __name__ == "__main__":
    main()
