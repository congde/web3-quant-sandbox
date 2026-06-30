"""Generate Chapter 11 publication figures."""

from __future__ import annotations

import json
from pathlib import Path

from matplotlib import pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets"

INK = "#111827"
MUTED = "#64748B"
BLUE = "#2563EB"
TEAL = "#0F9B8E"
ORANGE = "#F59E0B"
RED = "#DC2626"
PURPLE = "#7C3AED"


def _sma(values: list[float], window: int) -> list[float | None]:
    result: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window:
            result.append(None)
            continue
        sample = values[index + 1 - window : index + 1]
        result.append(sum(sample) / len(sample))
    return result


def _rolling_rule_scores(closes: list[float]) -> list[float]:
    sma5 = _sma(closes, 5)
    sma12 = _sma(closes, 12)
    scores: list[float] = []
    for index, close in enumerate(closes):
        short = sma5[index]
        long = sma12[index]
        if short is None or long is None:
            scores.append(0.0)
            continue
        trend = 18 if close > short > long else -18 if close < short < long else 0
        distance = max(-12, min(12, (close - long) / long * 100 * 3)) if long else 0
        scores.append(round(trend + distance, 1))
    return scores


def save_llm_execution_curve() -> None:
    data_path = ROOT / "data" / "dashboard" / "market_candles.json"
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    candles = list(payload.get("candles") or [])[-42:]
    dates = [str(item.get("date") or "")[5:] for item in candles]
    closes = [float(item.get("close") or 0) for item in candles]
    rule_scores = _rolling_rule_scores(closes)

    llm_scores: list[float] = []
    gated_scores: list[float] = []
    for index, score in enumerate(rule_scores):
        candidate = score + (4 if index % 6 in {1, 2, 3} else -3)
        llm_scores.append(candidate)
        gated_scores.append(score if abs(candidate - score) > 8 else candidate)

    plt.rcParams.update(
        {
            "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans", "Arial", "sans-serif"],
            "axes.unicode_minus": False,
            "figure.facecolor": "#FCFCFD",
        }
    )
    fig, (ax_price, ax_score) = plt.subplots(
        2,
        1,
        figsize=(12.8, 7.8),
        dpi=160,
        sharex=True,
        gridspec_kw={"height_ratios": [1.25, 1.0]},
    )
    fig.patch.set_facecolor("#FCFCFD")
    ax_price.set_facecolor("#FFFFFF")
    ax_score.set_facecolor("#FFFFFF")

    x = list(range(len(dates)))
    ax_price.plot(x, closes, color=INK, linewidth=2.0, label="close")
    ax_price.set_ylabel("BTC close")
    ax_price.grid(axis="y", color="#E5E7EB", linewidth=0.8)
    ax_price.spines[["top", "right"]].set_visible(False)
    ax_price.legend(loc="upper left", frameon=False)

    ax_score.axhspan(8, 40, color="#ECFDF5", alpha=0.75)
    ax_score.axhspan(-40, -8, color="#FEF2F2", alpha=0.72)
    ax_score.axhline(0, color="#94A3B8", linewidth=1)
    ax_score.axhline(8, color=TEAL, linewidth=1, linestyle="--")
    ax_score.axhline(-8, color=RED, linewidth=1, linestyle="--")
    ax_score.plot(x, rule_scores, color=BLUE, linewidth=2.1, label="rule baseline")
    ax_score.plot(x, llm_scores, color=ORANGE, linewidth=1.9, linestyle="--", label="llm rewrite")
    ax_score.plot(x, gated_scores, color=PURPLE, linewidth=2.1, label="after gate")
    ax_score.set_ylabel("signal score")
    ax_score.set_xlabel("visible candle window")
    ax_score.grid(axis="y", color="#E5E7EB", linewidth=0.8)
    ax_score.spines[["top", "right"]].set_visible(False)
    tick_step = max(1, len(dates) // 7)
    ticks = list(range(0, len(dates), tick_step))
    ax_score.set_xticks(ticks)
    ax_score.set_xticklabels([dates[i] for i in ticks], rotation=0)
    ax_score.legend(loc="upper left", ncol=3, frameon=False)
    ax_score.text(
        0.01,
        -0.28,
        "Source: data/dashboard/market_candles.json. The dashed line is a bounded rewrite candidate; the gate keeps the rule baseline when the rewrite drifts too far.",
        transform=ax_score.transAxes,
        fontsize=9.5,
        color=MUTED,
    )
    fig.suptitle("Chapter 11 execution curve: baseline, LLM rewrite, gate result", x=0.125, ha="left", color=INK, fontsize=15)
    fig.tight_layout()
    output = OUT / "chapter-11-llm-execution-curve.png"
    fig.savefig(output, bbox_inches="tight")
    plt.close(fig)
    print(output)


def save_llm_gate_outcomes() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans", "Arial", "sans-serif"],
            "axes.unicode_minus": False,
            "figure.facecolor": "#FCFCFD",
        }
    )
    fig, ax = plt.subplots(figsize=(13.2, 6.7), dpi=160)
    ax.set_xlim(0, 14.2)
    ax.set_ylim(0, 6.7)
    ax.axis("off")
    ax.set_title("模型输出门禁流程", loc="left", color=INK, fontsize=16, pad=12)

    def box(
        xy: tuple[float, float],
        text: str,
        color: str,
        width: float = 1.85,
        height: float = 0.74,
        face: str = "#FFFFFF",
        text_color: str = INK,
    ) -> None:
        x, y = xy
        patch = plt.Rectangle((x, y), width, height, facecolor=face, edgecolor=color, linewidth=2)
        ax.add_patch(patch)
        ax.text(x + width / 2, y + height / 2, text, ha="center", va="center", color=text_color, fontsize=10.5)

    def decision(xy: tuple[float, float], text: str, color: str) -> None:
        x, y = xy
        w, h = 1.75, 0.9
        points = [(x + w / 2, y + h), (x + w, y + h / 2), (x + w / 2, y), (x, y + h / 2)]
        patch = plt.Polygon(points, closed=True, facecolor="#FFFFFF", edgecolor=color, linewidth=2)
        ax.add_patch(patch)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=10.2)

    def arrow(start: tuple[float, float], end: tuple[float, float], label: str | None = None, color: str = MUTED) -> None:
        ax.annotate(
            "",
            xy=end,
            xytext=start,
            arrowprops={"arrowstyle": "->", "color": color, "lw": 1.9, "shrinkA": 3, "shrinkB": 3},
        )
        if label:
            ax.text((start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + 0.16, label, color=color, fontsize=9.2, ha="center")

    box((0.25, 3.0), "模型输出\n或调用状态", BLUE, width=1.55, height=0.9, face="#EFF6FF")
    decision((2.2, 3.0), "调用\n成功?", ORANGE)
    decision((4.35, 3.0), "JSON 与\nschema 合法?", BLUE)
    decision((6.65, 3.0), "signal 在\n白名单?", BLUE)
    decision((8.75, 3.0), "证据路径\n可回查?", TEAL)
    decision((10.7, 3.0), "含执行\n建议?", RED)

    box((2.3, 4.85), "回退\n规则基线", ORANGE, face="#FFF7ED", text_color=ORANGE)
    box((4.55, 4.85), "回退或复测\n不覆盖基线", ORANGE, width=1.95, face="#FFF7ED", text_color=ORANGE)
    box((6.65, 4.85), "回退\n记录非法枚举", ORANGE, width=2.0, face="#FFF7ED", text_color=ORANGE)
    box((9.95, 4.85), "降级\n删除无源摘要", ORANGE, width=1.95, face="#FFF7ED", text_color=ORANGE)
    box((10.6, 1.35), "阻断\n失败样本入账", RED, width=1.95, face="#FEF2F2", text_color=RED)
    box((12.85, 3.0), "通过\n研究记录", TEAL, width=1.1, face="#ECFDF5", text_color=TEAL)

    arrow((1.8, 3.45), (2.2, 3.45))
    arrow((3.95, 3.45), (4.35, 3.45), "是")
    arrow((6.1, 3.45), (6.65, 3.45), "是")
    arrow((8.4, 3.45), (8.75, 3.45), "是")
    arrow((10.5, 3.45), (10.7, 3.45), "是")
    arrow((12.45, 3.45), (12.85, 3.45), "否", TEAL)

    arrow((3.08, 3.9), (3.08, 4.85), "否", ORANGE)
    arrow((5.22, 3.9), (5.22, 4.85), "否", ORANGE)
    arrow((7.52, 3.9), (7.52, 4.85), "否", ORANGE)
    arrow((9.62, 3.9), (10.25, 4.85), "否", ORANGE)
    arrow((11.58, 3.0), (11.58, 2.25), "是", RED)

    ax.text(
        0.3,
        0.72,
        "读图顺序：先确认模型是否参与，再检查结构、枚举、证据和执行边界。任何失败都不能覆盖规则基线。",
        fontsize=10,
        color=MUTED,
    )
    fig.text(
        0.125,
        0.025,
        "出口含义：通过进入研究记录；降级只保留可追溯字段；回退保留规则基线；阻断进入失败样本。",
        fontsize=9.5,
        color=MUTED,
    )
    output = OUT / "chapter-11-llm-gate-outcomes.png"
    fig.savefig(output, bbox_inches="tight")
    plt.close(fig)
    print(output)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save_llm_gate_outcomes()
    save_llm_execution_curve()


if __name__ == "__main__":
    main()
