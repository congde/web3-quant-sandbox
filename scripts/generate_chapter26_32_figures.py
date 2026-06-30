"""Generate practical Matplotlib figures for chapters 26 through 32."""

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


def save_backtest_risk_center() -> None:
    days = np.arange(1, 31)
    equity = 1 + np.cumsum([0.004, 0.003, -0.002, 0.005, 0.004, -0.006, 0.006, 0.007, -0.003, 0.004,
                            0.005, -0.012, 0.006, 0.005, 0.004, -0.004, 0.003, 0.004, -0.009, 0.006,
                            0.004, 0.005, -0.003, 0.004, 0.006, -0.011, 0.004, 0.005, 0.003, 0.004])
    peak = np.maximum.accumulate(equity)
    drawdown = equity / peak - 1
    rejects = np.array([6, 12, 19, 26])

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    ax1.plot(days, equity, color="#2563EB", linewidth=2.6, label="回测权益")
    ax1.scatter(rejects, equity[rejects - 1], color="#DC2626", s=70, label="风险拒绝")
    ax1.set_ylabel("累计权益")
    ax1.grid(True, linestyle="--", linewidth=0.8)
    ax1.legend(loc="upper left")

    ax2.fill_between(days, drawdown, 0, color="#DC2626", alpha=0.22)
    ax2.plot(days, drawdown, color="#B91C1C", linewidth=1.8, label="回撤")
    ax2.set_ylabel("回撤")
    ax2.set_xlabel("样本日")
    ax2.grid(True, linestyle="--", linewidth=0.8)
    ax2.legend(loc="lower left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-26-backtest-risk-center.png", dpi=180)
    plt.close(fig)


def save_browser_research_path() -> None:
    steps = ["行情入口", "候选筛选", "K线信号", "回测运行", "风险复核", "导出证据"]
    seconds = np.array([1.2, 2.4, 3.1, 4.8, 2.0, 1.6])
    failed_once = np.array([False, False, True, False, True, False])
    colors = np.where(failed_once, "#F59E0B", "#0F9B8E")

    fig, ax = plt.subplots(figsize=(10.5, 5.8))
    y = np.arange(len(steps))
    ax.barh(y, seconds, color=colors, alpha=0.88)
    ax.set_yticks(y, steps)
    ax.invert_yaxis()
    ax.set_xlabel("浏览器验证耗时（秒）")
    ax.grid(True, axis="x", linestyle="--", linewidth=0.8)
    for i, (value, failed) in enumerate(zip(seconds, failed_once)):
        label = "曾失败后修复" if failed else "一次通过"
        ax.text(value + 0.12, i, label, va="center", color="#334155")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-browser-research-path.png", dpi=180)
    plt.close(fig)


def save_skill_evidence_contract() -> None:
    checks = ["输入文件", "命令可跑", "样本固定", "失败样本", "输出边界", "人工复核"]
    first_run = np.array([1, 1, 0, 0, 1, 0])
    revised = np.array([1, 1, 1, 1, 1, 1])
    x = np.arange(len(checks))
    width = 0.36

    fig, ax = plt.subplots(figsize=(10.5, 5.8))
    ax.bar(x - width / 2, first_run, width, color="#94A3B8", label="初稿")
    ax.bar(x + width / 2, revised, width, color="#2563EB", label="修订后")
    ax.set_xticks(x, checks, rotation=20, ha="right")
    ax.set_ylim(0, 1.25)
    ax.set_ylabel("是否满足")
    ax.grid(True, axis="y", linestyle="--", linewidth=0.8)
    ax.legend(loc="upper left")
    for i, ok in enumerate(first_run):
        if ok == 0:
            ax.text(i - width / 2, 0.08, "缺", ha="center", color="#DC2626")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-28-skill-evidence-contract.png", dpi=180)
    plt.close(fig)


def save_snapshot_draft_path() -> None:
    sources = ["行情", "资金", "链上", "情绪", "新闻"]
    rows = np.array([240, 96, 72, 38, 14])
    stale_minutes = np.array([4, 12, 18, 46, 95])
    x = np.arange(len(sources))

    fig, ax1 = plt.subplots(figsize=(10.5, 5.8))
    ax1.bar(x, rows, color="#2563EB", alpha=0.82, label="快照行数")
    ax1.set_ylabel("快照行数")
    ax1.set_xticks(x, sources)
    ax1.grid(True, axis="y", linestyle="--", linewidth=0.8)

    ax2 = ax1.twinx()
    ax2.plot(x, stale_minutes, color="#F59E0B", marker="o", linewidth=2.4, label="滞后分钟")
    ax2.axhline(60, color="#DC2626", linestyle="--", linewidth=1.6, label="草稿停止线")
    ax2.set_ylabel("滞后分钟")
    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-29-snapshot-draft-path.png", dpi=180)
    plt.close(fig)


def save_approval_stop_gate() -> None:
    actions = ["读文件", "写快照", "改策略", "删记录", "实盘下单"]
    allowed = np.array([18, 12, 4, 0, 0])
    review = np.array([0, 3, 7, 2, 1])
    stopped = np.array([0, 0, 2, 6, 5])
    y = np.arange(len(actions))

    fig, ax = plt.subplots(figsize=(10.5, 5.9))
    ax.barh(y, allowed, color="#0F9B8E", label="允许")
    ax.barh(y, review, left=allowed, color="#F59E0B", label="需审批")
    ax.barh(y, stopped, left=allowed + review, color="#DC2626", label="停止")
    ax.set_yticks(y, actions)
    ax.invert_yaxis()
    ax.set_xlabel("动作次数")
    ax.grid(True, axis="x", linestyle="--", linewidth=0.8)
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-30-approval-stop-gate.png", dpi=180)
    plt.close(fig)


def save_eval_version_decision() -> None:
    versions = ["prompt-a", "prompt-b", "model-a", "model-b", "strategy-a", "strategy-b"]
    score = np.array([71, 78, 76, 83, 74, 80])
    critical_failures = np.array([2, 0, 1, 3, 0, 1])
    colors = np.where(critical_failures == 0, "#0F9B8E", "#F59E0B")

    fig, ax = plt.subplots(figsize=(10.5, 5.8))
    x = np.arange(len(versions))
    ax.bar(x, score, color=colors, alpha=0.88)
    ax.set_xticks(x, versions, rotation=20, ha="right")
    ax.set_ylabel("平均得分")
    ax.set_ylim(60, 88)
    ax.grid(True, axis="y", linestyle="--", linewidth=0.8)
    for i, failures in enumerate(critical_failures):
        ax.text(i, score[i] + 0.8, f"关键失败 {failures}", ha="center", color="#334155")
    ax.axhline(80, color="#2563EB", linestyle="--", linewidth=1.5)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-31-eval-version-decision.png", dpi=180)
    plt.close(fig)


def save_failure_audit_loop() -> None:
    minutes = np.array([0, 3, 7, 12, 19, 28, 41, 55])
    states = ["失败", "降级", "快照兜底", "重试", "对账", "恢复", "补审计", "关闭"]
    level = np.array([4, 3, 3, 2, 2, 1, 1, 0])
    colors = ["#DC2626", "#F59E0B", "#F59E0B", "#2563EB", "#2563EB", "#0F9B8E", "#0F9B8E", "#64748B"]

    fig, ax = plt.subplots(figsize=(11, 5.8))
    ax.step(minutes, level, where="post", color="#334155", linewidth=2.2)
    ax.scatter(minutes, level, c=colors, s=90, zorder=3, edgecolor="white", linewidth=1.4)
    for x, y, label in zip(minutes, level, states):
        ax.text(x + 1, y + 0.08, label, color="#334155")
    ax.set_xlabel("事件发生后分钟")
    ax.set_ylabel("风险等级")
    ax.set_yticks([0, 1, 2, 3, 4], ["关闭", "观察", "处理中", "降级", "阻断"])
    ax.grid(True, linestyle="--", linewidth=0.8)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-32-failure-audit-loop.png", dpi=180)
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    style()
    tasks = [
        save_backtest_risk_center,
        save_browser_research_path,
        save_skill_evidence_contract,
        save_snapshot_draft_path,
        save_approval_stop_gate,
        save_eval_version_decision,
        save_failure_audit_loop,
    ]
    for task in tasks:
        task()
    for name in (
        "chapter-26-backtest-risk-center.png",
        "chapter-27-browser-research-path.png",
        "chapter-28-skill-evidence-contract.png",
        "chapter-29-snapshot-draft-path.png",
        "chapter-30-approval-stop-gate.png",
        "chapter-31-eval-version-decision.png",
        "chapter-32-failure-audit-loop.png",
    ):
        print(OUT / name)


if __name__ == "__main__":
    main()
