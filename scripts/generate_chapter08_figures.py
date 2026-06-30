"""Generate Chapter 08 publication figures."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from matplotlib import pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets"
DATA = ROOT / "data" / "dashboard" / "market_candles.json"

BG = "#F7F9FC"
INK = "#111827"
MUTED = "#64748B"
BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"
PANEL = "#FFFFFF"
GRID = "#D8DEE9"


def add_box(
    ax: plt.Axes,
    xy: tuple[float, float],
    size: tuple[float, float],
    title: str,
    body: str,
    color: str,
    *,
    fill: str = "#FFFFFF",
) -> None:
    x, y = xy
    w, h = size
    box = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.018,rounding_size=0.025",
        linewidth=2.4,
        edgecolor=color,
        facecolor=fill,
    )
    ax.add_patch(box)
    ax.text(x + 0.03, y + h - 0.11, title, color=color, fontsize=15, fontweight="semibold", va="top")
    ax.text(x + 0.03, y + h - 0.23, body, color=INK, fontsize=11.5, va="top", linespacing=1.35)


def add_arrow(
    ax: plt.Axes,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    color: str = MUTED,
    dashed: bool = False,
) -> None:
    arrow = FancyArrowPatch(
        start,
        end,
        arrowstyle="-|>",
        mutation_scale=18,
        linewidth=2.4,
        color=color,
        linestyle=(0, (6, 5)) if dashed else "solid",
        shrinkA=4,
        shrinkB=4,
    )
    ax.add_patch(arrow)


def save_code_path_diagram() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans", "Arial", "sans-serif"],
            "axes.unicode_minus": False,
        }
    )
    fig, ax = plt.subplots(figsize=(14, 7.6), dpi=160)
    fig.patch.set_facecolor("#F3F6FA")
    ax.set_facecolor("#F3F6FA")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.045, 0.92, "第 8 章：时间序列标准化代码路径", fontsize=21, fontweight="semibold", color=INK)
    ax.text(
        0.045,
        0.86,
        "文件名不是孤立清单：原始输入先被标准化，再进入完整性判断，最后把来源、时间和用途边界展示出来。",
        fontsize=11.5,
        color=MUTED,
    )
    ax.text(0.68, 0.86, "实线：数据处理路径   虚线：测试验证路径", fontsize=10.5, color=MUTED)

    add_box(ax, (0.045, 0.53), (0.18, 0.22), "原始数据", "fixture / snapshot / live\n外部 K 线数组\n资金与情绪字段", BLUE)
    add_box(ax, (0.31, 0.62), (0.19, 0.2), "normalize.py", "展示字段补全\n基础类型转换\n不补造市场事实", TEAL)
    add_box(ax, (0.31, 0.35), (0.19, 0.2), "market.py", "K 线数组标准化\n生成 tsSec / close / volume\n坏行返回 None", TEAL)
    add_box(ax, (0.59, 0.49), (0.19, 0.21), "catalog.py", "完整性检查\ncomplete / reason\n决定是否继续使用", ORANGE)
    add_box(ax, (0.82, 0.49), (0.16, 0.21), "source_card.py", "来源、时间、用途边界\n整理为页面状态\n可展示但不越权", PURPLE)

    add_box(
        ax,
        (0.31, 0.1),
        (0.25, 0.12),
        "tests/test_dashboard_normalize.py",
        "验证展示形状与标准化输出",
        BLUE,
        fill="#EFF6FF",
    )
    add_box(
        ax,
        (0.64, 0.1),
        (0.29, 0.12),
        "tests/test_dashboard_source_card.py",
        "验证来源字段、观察时间和市场行校验",
        PURPLE,
        fill="#F5F3FF",
    )
    add_box(
        ax,
        (0.045, 0.1),
        (0.18, 0.18),
        "停止线",
        "标准化只整理输入形状；\n是否进入指标或回测，\n仍要看完整性和来源。",
        RED,
        fill="#FEF2F2",
    )

    add_arrow(ax, (0.225, 0.65), (0.31, 0.72))
    add_arrow(ax, (0.225, 0.6), (0.31, 0.45))
    add_arrow(ax, (0.5, 0.72), (0.59, 0.62))
    add_arrow(ax, (0.5, 0.45), (0.59, 0.56))
    add_arrow(ax, (0.78, 0.595), (0.82, 0.595))
    add_arrow(ax, (0.4, 0.62), (0.42, 0.22), color=BLUE, dashed=True)
    add_arrow(ax, (0.4, 0.35), (0.44, 0.22), color=BLUE, dashed=True)
    add_arrow(ax, (0.9, 0.49), (0.79, 0.22), color=PURPLE, dashed=True)

    output = OUT / "chapter-08-code-path.png"
    fig.savefig(output, bbox_inches="tight")
    fig.savefig(output.with_suffix(".svg"), bbox_inches="tight")
    plt.close(fig)
    print(output)


def moving_average(values: list[float], window: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window:
            out.append(None)
            continue
        sample = values[index + 1 - window : index + 1]
        out.append(sum(sample) / window)
    return out


def save_kline_quality_curve() -> None:
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    candles = sorted(payload.get("candles") or [], key=lambda row: row.get("tsSec") or 0)
    dates = [datetime.fromisoformat(str(row["date"])) for row in candles if row.get("date") and row.get("close") is not None]
    closes = [float(row["close"]) for row in candles if row.get("date") and row.get("close") is not None]
    ma3 = moving_average(closes, 3)
    ma7 = moving_average(closes, 7)

    plt.rcParams.update(
        {
            "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans", "Arial", "sans-serif"],
            "axes.unicode_minus": False,
            "figure.facecolor": "#FCFCFD",
            "axes.facecolor": "#FFFFFF",
            "axes.edgecolor": "#D7DBE7",
            "axes.grid": True,
            "grid.color": "#E6E8F0",
        }
    )
    fig, ax = plt.subplots(figsize=(13, 7), dpi=160)
    ax.plot(dates, closes, color=BLUE, linewidth=1.8, label="标准化收盘价 close")
    ax.plot(dates, ma3, color=TEAL, linewidth=1.6, label="3 日均线")
    ax.plot(dates, ma7, color=ORANGE, linewidth=1.6, label="7 日均线")
    ax.scatter(dates, closes, color=BLUE, s=18, alpha=0.65)
    ax.set_ylabel("价格")
    ax.set_xlabel("日期")
    ax.legend(frameon=False, ncol=3, loc="upper left")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    output = OUT / "chapter-08-kline-quality-curve.png"
    fig.savefig(output, bbox_inches="tight")
    fig.savefig(output.with_suffix(".svg"), bbox_inches="tight")
    plt.close(fig)
    print(output)


def save_gap_gate_example() -> None:
    dates = [
        datetime(2026, 6, 1, 10),
        datetime(2026, 6, 1, 11),
        datetime(2026, 6, 1, 12),
        datetime(2026, 6, 1, 13),
        datetime(2026, 6, 1, 14),
        datetime(2026, 6, 1, 15),
    ]
    closes: list[float | None] = [64200.5, 64310.0, None, 64180.0, 64120.0, 64090.0]
    display_values = [value if value is not None else closes[index - 1] for index, value in enumerate(closes)]
    valid_dates = [date for date, close in zip(dates, closes) if close is not None]
    valid_closes = [close for close in closes if close is not None]

    fig, ax = plt.subplots(figsize=(11.5, 5.8), dpi=160)
    ax.plot(valid_dates, valid_closes, color=BLUE, linewidth=1.9, marker="o", label="有效 close")
    ax.plot(dates, display_values, color=ORANGE, linewidth=1.4, linestyle="--", label="展示占位，不进回测")
    missing_date = dates[2]
    ax.scatter([missing_date], [display_values[2]], color=RED, s=90, zorder=4, label="缺失 close")
    ax.axvspan(dates[4], dates[5], color="#FEF3C7", alpha=0.7, label="未收盘样本")
    ax.text(missing_date, display_values[2] - 28, "拒绝指标窗口", ha="center", va="top", color=RED, fontsize=11)
    ax.text(dates[4], display_values[4] + 28, "只展示", ha="left", va="bottom", color=ORANGE, fontsize=11)
    ax.set_ylabel("价格")
    ax.set_xlabel("时间")
    ax.legend(frameon=False, loc="upper right")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.autofmt_xdate(rotation=0)
    output = OUT / "chapter-08-gap-gate-example.png"
    fig.savefig(output, bbox_inches="tight")
    fig.savefig(output.with_suffix(".svg"), bbox_inches="tight")
    plt.close(fig)
    print(output)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save_code_path_diagram()
    save_kline_quality_curve()
    save_gap_gate_example()


if __name__ == "__main__":
    main()
