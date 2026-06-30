"""Generate practical Matplotlib figures for chapters 22 through 25."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
FONT = "SimHei"


def style() -> None:
    plt.rcParams["font.sans-serif"] = [FONT, "Microsoft YaHei", "Arial Unicode MS"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"
    plt.rcParams["axes.facecolor"] = "#F8FAFC"
    plt.rcParams["axes.edgecolor"] = "#CBD5E1"
    plt.rcParams["grid.color"] = "#E2E8F0"
    plt.rcParams["legend.frameon"] = False


def save_risk_order_gate() -> None:
    days = np.arange(1, 31)
    base_equity = 1 + np.cumsum(
        [0.002, 0.003, -0.004, 0.004, -0.011, -0.014, 0.005, -0.009, 0.006, 0.003,
         -0.018, -0.010, 0.004, 0.006, -0.012, 0.004, 0.003, -0.006, 0.005, 0.004,
         -0.020, -0.009, 0.006, 0.004, 0.003, -0.006, 0.004, 0.003, -0.002, 0.004]
    )
    gated_equity = 1 + np.cumsum(
        [0.002, 0.003, -0.004, 0.004, -0.006, -0.004, 0.003, -0.004, 0.006, 0.003,
         -0.007, -0.003, 0.004, 0.006, -0.005, 0.004, 0.003, -0.004, 0.005, 0.004,
         -0.006, -0.002, 0.006, 0.004, 0.003, -0.004, 0.004, 0.003, -0.002, 0.004]
    )
    risk_used = np.array(
        [0.42, 0.51, 0.56, 0.63, 0.86, 0.91, 0.76, 0.88, 0.58, 0.54,
         0.96, 0.89, 0.68, 0.62, 0.84, 0.66, 0.60, 0.71, 0.58, 0.55,
         0.98, 0.93, 0.70, 0.64, 0.60, 0.73, 0.65, 0.61, 0.58, 0.55]
    )
    rejected = risk_used > 0.85

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    ax1.plot(days, base_equity, color="#94A3B8", linewidth=2.2, label="无风控权益")
    ax1.plot(days, gated_equity, color="#2563EB", linewidth=2.6, label="风控后权益")
    ax1.scatter(days[rejected], gated_equity[rejected], color="#DC2626", s=58, label="订单被拒绝", zorder=3)
    ax1.set_ylabel("累计权益")
    ax1.grid(True, linestyle="--", linewidth=0.8)
    ax1.legend(loc="lower left", ncol=3)

    ax2.bar(days, risk_used, color=np.where(rejected, "#DC2626", "#0F9B8E"), alpha=0.82)
    ax2.axhline(0.85, color="#DC2626", linestyle="--", linewidth=1.8, label="风险上限")
    ax2.set_ylabel("风险占用")
    ax2.set_xlabel("样本日")
    ax2.set_ylim(0, 1.05)
    ax2.grid(True, axis="y", linestyle="--", linewidth=0.8)
    ax2.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-22-risk-order-gate.png", dpi=180)
    plt.close(fig)


def save_research_ia_path() -> None:
    pages = ["行情总览", "机会雷达", "K线信号", "回测中心", "风险中心"]
    source_fields = np.array([5, 4, 6, 7, 5])
    status_fields = np.array([3, 3, 4, 5, 4])
    failure_fields = np.array([1, 2, 2, 3, 4])
    y = np.arange(len(pages))

    fig, ax = plt.subplots(figsize=(10.5, 6.2))
    ax.barh(y, source_fields, color="#2563EB", label="来源字段")
    ax.barh(y, status_fields, left=source_fields, color="#0F9B8E", label="状态字段")
    ax.barh(y, failure_fields, left=source_fields + status_fields, color="#F59E0B", label="失败/降级字段")
    ax.set_yticks(y, pages)
    ax.invert_yaxis()
    ax.set_xlabel("页面可追溯字段数量")
    ax.grid(True, axis="x", linestyle="--", linewidth=0.8)
    ax.legend(loc="lower right")
    for i, total in enumerate(source_fields + status_fields + failure_fields):
        ax.text(total + 0.2, i, f"{total}", va="center", color="#334155")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-23-research-ia-path.png", dpi=180)
    plt.close(fig)


def save_market_candidate_path() -> None:
    names = ["BTC", "ETH", "SOL", "BNB", "LINK", "AAVE", "UNI", "MATIC", "ARB", "OP"]
    score = np.array([82, 76, 69, 64, 58, 55, 51, 49, 45, 42])
    risk = np.array([31, 38, 54, 42, 63, 70, 61, 78, 83, 76])
    freshness = np.array([5, 8, 15, 12, 25, 28, 34, 55, 70, 62])
    colors = np.where((score >= 60) & (risk <= 55) & (freshness <= 20), "#0F9B8E", "#F59E0B")

    fig, ax = plt.subplots(figsize=(10, 6.4))
    ax.scatter(score, risk, s=(80 - freshness) * 8, c=colors, alpha=0.84, edgecolor="white", linewidth=1.6)
    ax.axvline(60, color="#2563EB", linestyle="--", linewidth=1.6)
    ax.axhline(55, color="#DC2626", linestyle="--", linewidth=1.6)
    for x, y, name in zip(score, risk, names):
        ax.text(x + 0.8, y + 0.8, name, fontsize=10, color="#334155")
    ax.set_xlabel("机会评分")
    ax.set_ylabel("风险评分")
    ax.set_xlim(35, 88)
    ax.set_ylim(25, 88)
    ax.grid(True, linestyle="--", linewidth=0.8)
    ax.text(62, 32, "可进入后续研究", color="#0F766E", fontsize=11)
    ax.text(38, 82, "降级或等待新快照", color="#B45309", fontsize=11)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-24-market-candidate-path.png", dpi=180)
    plt.close(fig)


def save_kline_llm_binding() -> None:
    days = np.arange(1, 25)
    close = np.array([100, 102, 101, 103, 106, 105, 107, 110, 108, 109, 112, 115,
                      114, 116, 119, 117, 118, 121, 124, 123, 126, 128, 127, 130])
    ma5 = np.convolve(close, np.ones(5) / 5, mode="valid")
    confidence = np.array([0.30, 0.35, 0.32, 0.40, 0.48, 0.46, 0.52, 0.68, 0.55, 0.57, 0.72, 0.78,
                           0.65, 0.70, 0.81, 0.62, 0.60, 0.76, 0.84, 0.69, 0.86, 0.88, 0.74, 0.90])
    valid = (confidence >= 0.75) & (close > np.r_[np.repeat(np.nan, 4), ma5])

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    ax1.plot(days, close, color="#2563EB", linewidth=2.4, label="收盘价")
    ax1.plot(days[4:], ma5, color="#F59E0B", linewidth=2.2, label="5日均线")
    ax1.scatter(days[valid], close[valid], color="#0F9B8E", marker="^", s=70, label="规则与解释匹配")
    ax1.set_ylabel("价格")
    ax1.grid(True, linestyle="--", linewidth=0.8)
    ax1.legend(loc="upper left", ncol=3)

    ax2.bar(days, confidence, color=np.where(valid, "#0F9B8E", "#94A3B8"), alpha=0.85)
    ax2.axhline(0.75, color="#DC2626", linestyle="--", linewidth=1.6, label="发布阈值")
    ax2.set_ylabel("LLM置信度")
    ax2.set_xlabel("样本日")
    ax2.set_ylim(0, 1.0)
    ax2.grid(True, axis="y", linestyle="--", linewidth=0.8)
    ax2.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-25-kline-llm-binding.png", dpi=180)
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    style()
    save_risk_order_gate()
    save_research_ia_path()
    save_market_candidate_path()
    save_kline_llm_binding()
    for name in (
        "chapter-22-risk-order-gate.png",
        "chapter-23-research-ia-path.png",
        "chapter-24-market-candidate-path.png",
        "chapter-25-kline-llm-binding.png",
    ):
        print(OUT / name)


if __name__ == "__main__":
    main()
