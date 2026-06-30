"""Generate practical Matplotlib figures for chapters 33 through 35."""

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


def save_sim_trading_boundary() -> None:
    modules = ["数据", "信号", "策略", "回测", "风控", "Web"]
    checks = ["来源", "字段", "成本", "失败", "审计"]
    matrix = np.array(
        [
            [1.0, 1.0, 0.3, 0.8, 0.8],
            [0.8, 1.0, 0.5, 0.7, 0.9],
            [0.7, 0.9, 1.0, 0.6, 0.8],
            [0.8, 0.9, 1.0, 0.7, 0.9],
            [0.9, 0.8, 0.8, 1.0, 1.0],
            [0.8, 0.8, 0.6, 0.7, 0.9],
        ]
    )

    fig, ax = plt.subplots(figsize=(10, 6.4))
    im = ax.imshow(matrix, cmap="YlGnBu", vmin=0, vmax=1)
    ax.set_xticks(np.arange(len(checks)), checks)
    ax.set_yticks(np.arange(len(modules)), modules)
    for i in range(len(modules)):
        for j in range(len(checks)):
            ax.text(j, i, f"{matrix[i, j]:.1f}", ha="center", va="center", color="#0F172A")
    cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("验收覆盖度")
    ax.set_xlabel("验收项")
    ax.set_ylabel("系统层")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-33-sim-trading-boundary.png", dpi=180)
    plt.close(fig)


def save_research_path_contracts() -> None:
    contracts = ["signal", "strategy", "backtest", "risk", "api", "web"]
    provided = np.array([6, 8, 9, 5, 7, 6])
    missing = np.array([1, 0, 1, 2, 1, 2])
    risky = np.array([0, 1, 1, 2, 1, 1])
    x = np.arange(len(contracts))

    fig, ax = plt.subplots(figsize=(10.5, 5.9))
    ax.bar(x, provided, color="#0F9B8E", label="已验证字段")
    ax.bar(x, missing, bottom=provided, color="#F59E0B", label="缺失字段")
    ax.bar(x, risky, bottom=provided + missing, color="#DC2626", label="需停止字段")
    ax.set_xticks(x, contracts)
    ax.set_ylabel("字段数量")
    ax.grid(True, axis="y", linestyle="--", linewidth=0.8)
    ax.legend(loc="upper left", ncol=3)
    for i, value in enumerate(missing + risky):
        if value > 0:
            ax.text(i, provided[i] + value + 0.2, f"待查 {value}", ha="center", color="#334155")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-34-research-path-contracts.png", dpi=180)
    plt.close(fig)


def save_acceptance_retro_loop() -> None:
    rounds = np.arange(1, 7)
    verify_pass = np.array([62, 71, 78, 84, 91, 95])
    blocked = np.array([11, 8, 6, 4, 2, 1])
    manual_findings = np.array([7, 6, 5, 3, 2, 2])

    fig, ax1 = plt.subplots(figsize=(10.5, 5.9))
    ax1.plot(rounds, verify_pass, color="#2563EB", marker="o", linewidth=2.6, label="自动检查通过率")
    ax1.set_xlabel("迭代轮次")
    ax1.set_ylabel("通过率（%）")
    ax1.set_ylim(55, 100)
    ax1.grid(True, linestyle="--", linewidth=0.8)

    ax2 = ax1.twinx()
    ax2.bar(rounds - 0.17, blocked, width=0.34, color="#DC2626", alpha=0.72, label="阻断项")
    ax2.bar(rounds + 0.17, manual_findings, width=0.34, color="#F59E0B", alpha=0.72, label="人工发现")
    ax2.set_ylabel("问题数量")
    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc="center right")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-35-acceptance-retro-loop.png", dpi=180)
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    style()
    save_sim_trading_boundary()
    save_research_path_contracts()
    save_acceptance_retro_loop()
    for name in (
        "chapter-33-sim-trading-boundary.png",
        "chapter-34-research-path-contracts.png",
        "chapter-35-acceptance-retro-loop.png",
    ):
        print(OUT / name)


if __name__ == "__main__":
    main()
