"""Generate Chapter 33 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.research_path import run_research_path  # noqa: E402
from backtest.trace import run_teaching_scenario  # noqa: E402


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


def save_research_path_steps() -> None:
    payload = path_payload()
    steps = payload["path"]
    labels = [f"{item['step']}. {item['name']}" for item in steps]
    values = [item["step"] for item in steps]
    colors = [TEAL if item["step"] <= 6 else ORANGE for item in steps]
    fig, ax = plt.subplots(figsize=(12.4, 6.2), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.barh(labels, values, color=colors)
    ax.invert_yaxis()
    ax.set_xlabel("路径步骤")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(0.0, -0.12, "前 6 步是核心模拟闭环；后 4 步是走向交付前必须补齐的样本外和审计检查。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-33-research-path-steps.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-33-research-path-steps.png")


def save_metrics_bridge_card() -> None:
    payload = path_payload()
    rows = [
        ("event report", payload["report_summary"]["strategy_return_pct"], payload["report_summary"]["maximum_drawdown_pct"], payload["report_summary"]["trade_count"]),
        ("rolling", payload["rolling_summary"]["total_return_pct"], payload["rolling_summary"]["max_drawdown_pct"], payload["rolling_summary"]["total_trades"]),
        ("realistic cost", payload["realistic_cost_summary"]["total_return_pct"], None, None),
    ]
    labels = [row[0] for row in rows]
    returns = [float(row[1] or 0) for row in rows]
    drawdowns = [abs(float(row[2] or 0)) for row in rows]
    fig, ax = plt.subplots(figsize=(11.8, 5.8), dpi=160)
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
    for i, row in enumerate(rows):
        trades = "-" if row[3] is None else str(row[3])
        ax.text(i, max(returns[i], drawdowns[i]) + 1, f"trades={trades}", ha="center", fontsize=9, color=INK)
    ax.legend(frameon=False)
    ax.text(0.0, -0.18, "同一策略在事件引擎、滚动引擎、真实成本预设中口径不同，不能只摘一个最漂亮数字。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-33-metrics-bridge-card.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-33-metrics-bridge-card.png")


def save_fill_pending_risk_timeline() -> None:
    payload = run_teaching_scenario()
    bars = payload["bars"]
    labels = [row["date"] for row in bars]
    close = [row["close"] for row in bars]
    label_offset = max((max(close) - min(close)) * 0.08, 0.03)
    fig, ax = plt.subplots(figsize=(12.2, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.plot(labels, close, color=BLUE, marker="o", linewidth=2)
    for i, row in enumerate(bars):
        if "fill" in row:
            ax.scatter([labels[i]], [close[i]], s=150, color=TEAL, zorder=3)
            ax.text(i, close[i] + label_offset, "fill", ha="center", fontsize=9, color=TEAL, weight="bold")
        if i == 3:
            ax.scatter([labels[i]], [close[i]], s=130, marker="s", color=ORANGE, zorder=3)
            ax.text(i, close[i] - label_offset * 1.4, "pending limit", ha="center", va="top", fontsize=8.5, color=ORANGE, weight="bold")
        if "risk_block" in row:
            ax.scatter([labels[i]], [close[i]], s=150, color=RED, zorder=3)
            ax.text(i, close[i] + label_offset, row["risk_block"]["rule_id"], ha="center", fontsize=8.5, color=RED, weight="bold")
    ax.set_ylim(min(close) - label_offset * 2.0, max(close) + label_offset * 2.5)
    ax.set_ylabel("close")
    ax.tick_params(axis="x", rotation=24)
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.text(0.0, -0.24, "run_teaching_scenario() 构造 market fill、pending limit、MAX_POSITION_PCT risk block 三类事件。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-33-order-state-timeline.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-33-order-state-timeline.png")


def save_contract_completeness_matrix() -> None:
    fields = ["source", "version", "state", "risk", "cost", "audit"]
    modules = [
        ("data", [1, 1, 1, 0, 0, 1]),
        ("signal", [1, 1, 1, 0, 0, 1]),
        ("strategy", [1, 1, 1, 1, 0, 1]),
        ("backtest", [1, 1, 1, 1, 1, 1]),
        ("risk", [1, 1, 1, 1, 0, 1]),
        ("web", [1, 1, 1, 1, 0, 1]),
    ]
    fig, ax = plt.subplots(figsize=(11.8, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    for y, (_, values) in enumerate(modules):
        for x, value in enumerate(values):
            color = TEAL if value else ORANGE
            ax.add_patch(Rectangle((x, y), 1, 1, facecolor=color, edgecolor="#FFFFFF", linewidth=2))
            ax.text(x + 0.5, y + 0.5, "ok" if value else "n/a", ha="center", va="center", fontsize=8.5, color="#FFFFFF")
    ax.set_xlim(0, len(fields))
    ax.set_ylim(0, len(modules))
    ax.set_xticks([i + 0.5 for i in range(len(fields))])
    ax.set_xticklabels(fields)
    ax.set_yticks([i + 0.5 for i in range(len(modules))])
    ax.set_yticklabels([item[0] for item in modules])
    ax.invert_yaxis()
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.text(0.0, -0.17, "每个模块至少要说清来源、版本、状态和审计；只有回测层必须完整说明成本口径。", transform=ax.transAxes, fontsize=10, color=MUTED)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-33-contract-completeness-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-33-contract-completeness-matrix.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_research_path_steps()
    save_metrics_bridge_card()
    save_fill_pending_risk_timeline()
    save_contract_completeness_matrix()


if __name__ == "__main__":
    main()
