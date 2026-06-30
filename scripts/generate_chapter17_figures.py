"""Generate Chapter 17 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
from textwrap import fill

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.runner import load_prices, prices_to_candles  # noqa: E402
from backtest.trace import run_ma_crossover_trace  # noqa: E402
from paths import DATA_DIR  # noqa: E402
from strategy_engine.backtest import BacktestEngine  # noqa: E402
from strategy_engine.strategies.ma_crossover import make_ma_crossover_strategy  # noqa: E402


BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
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


def save_ma_crossover_trades() -> None:
    prices = load_prices(DATA_DIR / "prices.csv")
    candles = prices_to_candles(prices[:80])
    engine = BacktestEngine(strategy_fn=make_ma_crossover_strategy(3, 7))
    result = engine.run(candles, symbol="WEB3-DEMO/USDT", timeframe="1day")
    dates = [c.ts for c in candles]
    closes = [float(c.close) for c in candles]
    equity_dates = [item[0] for item in result.equity_curve]
    equity = [float(item[1]) for item in result.equity_curve]

    fig, axes = plt.subplots(2, 1, figsize=(11, 7), dpi=160, sharex=True)
    fig.patch.set_facecolor(PAPER)
    for ax in axes:
        ax.set_facecolor("#FFFFFF")
        ax.grid(color=GRID, linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)

    axes[0].plot(dates, closes, color=BLUE, linewidth=1.8, label="收盘价")
    for trade in result.trades:
        marker = "^" if trade.side == "buy" else "v"
        color = TEAL if trade.side == "buy" else RED
        axes[0].scatter(trade.ts, float(trade.price), marker=marker, color=color, s=58)
    axes[0].set_ylabel("价格")
    axes[0].legend(frameon=False, loc="upper left")

    axes[1].plot(equity_dates, equity, color=ORANGE, linewidth=1.8)
    axes[1].set_ylabel("权益")
    axes[1].text(
        0.01,
        -0.26,
        f"short=3, long=7；trades={len(result.trades)}；固定离线样本 data/prices.csv，图只用于实现复核。",
        transform=axes[1].transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-17-ma-crossover-trades.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-17-ma-crossover-trades.png")


def save_contract_to_code_flow() -> None:
    steps = [
        ("策略契约", "short=3, long=7\n只做多；金叉买入\n死叉/弱势退出"),
        ("实现文件", "ma_crossover.py\n策略工厂函数\n返回 on_tick 合约"),
        ("执行引擎", "BacktestEngine.run\n逐根 K 线推进\n提交 OrderIntent"),
        ("可审计输出", "trace: 14 笔成交\nrisk_rejections: 176\n首笔 BUY 2025-01-10"),
        ("验证命令", "2 条窄口测试\ntrace + event engine\n避免只看收益"),
    ]

    fig, ax = plt.subplots(figsize=(12, 4.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")

    xs = [0.03, 0.235, 0.44, 0.645, 0.85]
    width = 0.145
    colors = [BLUE, TEAL, ORANGE, "#7C3AED", "#334155"]
    for index, ((title, body), x, color) in enumerate(zip(steps, xs, colors, strict=True)):
        ax.add_patch(
            Rectangle(
                (x, 0.28),
                width,
                0.48,
                transform=ax.transAxes,
                facecolor="#FFFFFF",
                edgecolor=color,
                linewidth=2,
            )
        )
        ax.text(x + 0.012, 0.67, f"{index + 1}. {title}", transform=ax.transAxes, fontsize=13, color=color, weight="bold")
        ax.text(x + 0.012, 0.55, body, transform=ax.transAxes, fontsize=9.4, color=INK, va="top")
        if index < len(xs) - 1:
            ax.add_patch(
                FancyArrowPatch(
                    (x + width + 0.01, 0.52),
                    (xs[index + 1] - 0.012, 0.52),
                    transform=ax.transAxes,
                    arrowstyle="-|>",
                    mutation_scale=16,
                    linewidth=1.8,
                    color=MUTED,
                )
            )

    ax.text(
        0.03,
        0.13,
        "读图方式：先确认规则是否固定，再追踪规则落到哪个函数、由哪个引擎执行、用哪条 trace 和测试验收。",
        transform=ax.transAxes,
        fontsize=11,
        color=MUTED,
    )
    fig.savefig(OUT / "chapter-17-contract-to-code-flow.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-17-contract-to-code-flow.png")


def save_trace_waterfall() -> None:
    trace = run_ma_crossover_trace()
    trail = trace["trail"]
    steps = [row["step"] for row in trail]
    equity = [row["equity_after"] for row in trail]
    colors = [TEAL if row["action"] == "BUY" else RED for row in trail]

    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.plot(steps, equity, color=BLUE, linewidth=1.6, zorder=1)
    ax.scatter(steps, equity, c=colors, s=74, zorder=2)

    for row in trail:
        label = f"{row['action']}\n{row['date']}"
        ax.text(row["step"], row["equity_after"] + 95, label, fontsize=8.5, ha="center", color=INK)

    metrics = trace["metrics"]
    ax.set_xlabel("成交序号")
    ax.set_ylabel("成交后权益")
    ax.text(
        0.01,
        -0.2,
        (
            f"run_ma_crossover_trace(): trades={len(trail)}, final_equity={metrics['final_equity']}, "
            f"strategy_return={metrics['strategy_return_pct']}%, max_drawdown={metrics['maximum_drawdown_pct']}%。"
        ),
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-17-event-trace-waterfall.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-17-event-trace-waterfall.png")


def save_branch_review_matrix() -> None:
    rows = [
        ("窗口不足", "_sma(...) is None", "return None", "短样本不产生交易"),
        ("已有持仓", "should_hold and qty > 0", "return None", "避免重复买入"),
        ("现金/价格异常", "cash <= 0 or close <= 0", "return None", "拒绝无效买入"),
        ("反向退出", "not should_hold and qty > 0", "sell market", "持仓可退出"),
        ("风控拒单", "RiskManager.check()", "risk_rejections", "拒单留下审计记录"),
    ]

    fig, ax = plt.subplots(figsize=(12, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")

    headers = ["分支", "代码条件", "动作", "验收含义"]
    col_x = [0.04, 0.22, 0.51, 0.69]
    col_w = [0.15, 0.25, 0.14, 0.27]
    y0 = 0.86
    row_h = 0.13

    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.08, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.012, y0 + 0.026, header, transform=ax.transAxes, fontsize=11.5, color="#FFFFFF", weight="bold")

    for i, row in enumerate(rows):
        y = y0 - (i + 1) * row_h
        fill_color = "#FFFFFF" if i % 2 == 0 else "#F8FAFC"
        for x, w, value in zip(col_x, col_w, row, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=fill_color, edgecolor=GRID))
            ax.text(x + 0.012, y + row_h / 2, fill(str(value), 24), transform=ax.transAxes, fontsize=10.5, color=INK, va="center")

    ax.text(
        0.04,
        0.08,
        "干货检查：第一条策略不是只看能不能跑，还要把不交易、拒单、退出等分支写成可复核的验收点。",
        transform=ax.transAxes,
        fontsize=11,
        color=MUTED,
    )
    fig.savefig(OUT / "chapter-17-branch-review-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-17-branch-review-matrix.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    configure_plot()
    save_contract_to_code_flow()
    save_ma_crossover_trades()
    save_trace_waterfall()
    save_branch_review_matrix()


if __name__ == "__main__":
    main()
