"""Generate Chapter 27 publication figures."""

from __future__ import annotations

from pathlib import Path
import sys
import time
from textwrap import fill
from typing import Any, Callable

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "v2" / "assets" / "generated"
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest.rolling.service import (  # noqa: E402
    compare_windows,
    execute_backtest,
    run_cpcv_service,
    run_robustness_audit,
    run_walk_forward,
)
from dashboard import api as dashboard_api  # noqa: E402
from factor_mining.service import run_factor_mining, run_mined_factor_backtest  # noqa: E402
from research.report import build_report  # noqa: E402


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


def _timed(name: str, fn: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    start = time.perf_counter()
    payload = fn()
    return {"name": name, "ms": round((time.perf_counter() - start) * 1000, 1), "payload": payload}


def _audit_payloads() -> dict[str, Any]:
    kwargs = {
        "strategy_name": "ma_crossover",
        "symbol": "WEB3-DEMO/USDT",
        "limit": 120,
        "cost_preset": "teaching",
    }
    return {
        "backtest": execute_backtest(**kwargs),
        "windows": compare_windows(**kwargs),
        "wfo": run_walk_forward(**kwargs),
        "robustness": run_robustness_audit(**kwargs),
        "cpcv": run_cpcv_service(**kwargs),
        "risk": build_report(short=3, long=7),
    }


def save_browser_research_path() -> None:
    steps = [
        ("/data-sources", "来源 / 快照\n失败原因"),
        ("/trading", "行情总览\nK 线状态"),
        ("/radar", "候选排序\n风险等级"),
        ("/research", "K 线证据\n规则/LLM"),
        ("/backtests", "成本 / WFO\nPBO / CPCV"),
        ("/risk", "规则栈\n拒单原因"),
    ]
    colors = [BLUE, TEAL, "#0891B2", ORANGE, PURPLE, RED]
    fig, ax = plt.subplots(figsize=(13.4, 4.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.9, "浏览器验收要证明路径可走、状态可见、失败可退", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    width = 0.128
    gap = 0.028
    for i, ((route, body), color) in enumerate(zip(steps, colors, strict=True)):
        x = 0.04 + i * (width + gap)
        ax.add_patch(Rectangle((x, 0.34), width, 0.38, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2))
        ax.text(x + 0.012, 0.64, route, transform=ax.transAxes, fontsize=10.5, color=color, weight="bold")
        ax.text(x + 0.012, 0.54, body, transform=ax.transAxes, fontsize=9.2, color=INK, va="top")
        if i < len(steps) - 1:
            ax.add_patch(FancyArrowPatch((x + width + 0.005, 0.53), (x + width + gap - 0.006, 0.53), transform=ax.transAxes, arrowstyle="-|>", mutation_scale=13, linewidth=1.6, color=MUTED))
    fig.savefig(OUT / "chapter-27-browser-research-path.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-browser-research-path.png")


def save_route_api_contract() -> None:
    rows = [
        ("/data-sources", "DataSourcesPage", "/api/dashboard/sources/status", "source / saved_at / error"),
        ("/trading", "DashboardPage", "/api/market/candles", "symbol / candles / source"),
        ("/radar", "RadarPage", "/api/dashboard/opportunity-scan", "rank / riskLevel / reasons"),
        ("/research", "ResearchPage", "/api/market/kline-analysis", "trend / support / resistance"),
        ("/backtests", "BacktestsPage", "/api/dashboard/backtest/*", "cost / DSR / PBO / CPCV"),
        ("/risk", "RiskPage", "/api/report", "risk_rules / rejections"),
    ]
    fig, ax = plt.subplots(figsize=(13, 6.2), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.93, "每个浏览器页面都要能追到 API 字段", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    headers = ["浏览器路由", "React 页面", "API 契约", "验收字段"]
    col_x = [0.04, 0.23, 0.43, 0.71]
    col_w = [0.17, 0.18, 0.26, 0.25]
    y0 = 0.82
    row_h = 0.105
    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.075, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.01, y0 + 0.048, header, transform=ax.transAxes, fontsize=10.2, color="#FFFFFF", weight="bold", va="center")
    for r, row in enumerate(rows):
        y = y0 - (r + 1) * row_h
        bg = "#FFFFFF" if r % 2 == 0 else "#F1F5F9"
        for x, w, value in zip(col_x, col_w, row, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=bg, edgecolor=GRID, linewidth=1))
            ax.text(x + 0.01, y + row_h * 0.58, fill(value, 26), transform=ax.transAxes, fontsize=9.4, color=INK, va="center")
    fig.savefig(OUT / "chapter-27-route-api-contract.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-route-api-contract.png")


def save_e2e_latency_status() -> None:
    calls = [
        _timed("sources", lambda: dashboard_api.sources_status()),
        _timed("candles", lambda: dashboard_api.market_candles(symbol="BTC-USDT", limit=80)),
        _timed("opportunity", lambda: dashboard_api.opportunity_scan(top_k=8)),
        _timed("kline", lambda: dashboard_api.kline_analysis(symbol="BTC-USDT", kline_type="1day", limit=80)),
        _timed("backtest", lambda: execute_backtest(strategy_name="ma_crossover", symbol="WEB3-DEMO/USDT", limit=120, cost_preset="teaching")),
        _timed("wfo", lambda: run_walk_forward(strategy_name="ma_crossover", symbol="WEB3-DEMO/USDT", limit=120, cost_preset="teaching")),
        _timed("risk", lambda: build_report(short=3, long=7)),
    ]
    labels = [row["name"] for row in calls]
    values = [row["ms"] for row in calls]
    colors = [TEAL if (row["payload"].get("ok", True) is True) else RED for row in calls]
    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar(labels, values, color=colors)
    ax.set_ylabel("毫秒")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    for i, value in enumerate(values):
        ax.text(i, value + max(values) * 0.02, f"{value:.0f}", ha="center", fontsize=9, color=INK)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-e2e-latency-status.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-e2e-latency-status.png")


def save_backtest_audit_summary() -> None:
    data = _audit_payloads()
    bt = data["backtest"]
    windows = data["windows"]
    wfo = data["wfo"]
    robustness = data["robustness"]
    cpcv = data["cpcv"]["cpcv"]
    metrics = [
        ("回测收益", float(bt["total_return_pct"]), "%", RED),
        ("最大回撤", float(bt["max_drawdown_pct"]), "%", ORANGE),
        ("正窗口", float(windows["positive_windows"]) / max(1, float(windows["num_windows"])) * 100, "%", RED),
        ("OOS 收益", float(wfo["out_of_sample_return_pct"]), "%", TEAL),
        ("稳定性", float(robustness["parameter_sensitivity"]["stability_score"]) * 100, "%", ORANGE),
        ("PBO", float(robustness["pbo"]["pbo"]) * 100, "%", RED),
        ("CPCV 盈利路径", float(cpcv["profitable_paths_pct"]), "%", RED),
    ]
    labels = [m[0] for m in metrics]
    vals = [m[1] for m in metrics]
    colors = [m[3] for m in metrics]
    fig, ax = plt.subplots(figsize=(12.4, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    ax.bar(labels, vals, color=colors)
    ax.axhline(0, color="#94A3B8", linewidth=1)
    ax.set_ylabel("百分比")
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(axis="x", rotation=18)
    for i, value in enumerate(vals):
        offset = 2 if value >= 0 else -5
        ax.text(i, value + offset, f"{value:.1f}%", ha="center", fontsize=9, color=INK)
    ax.text(
        0.0,
        -0.24,
        f"WEB3-DEMO/USDT ma_crossover: trades={bt['total_trades']}, DSR={wfo['dsr']}, trials={wfo['num_trials']}, robust={robustness['verdict']}, CPCV={cpcv['verdict']}.",
        transform=ax.transAxes,
        fontsize=10,
        color=MUTED,
    )
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-backtest-audit-summary.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-backtest-audit-summary.png")


def save_backtest_engine_flow() -> None:
    steps = [
        ("数据快照", "固定样本\n时间字段\n可见信息", BLUE),
        ("信号生成", "策略规则\n因子分数\n滞后生效", TEAL),
        ("订单意图", "目标仓位\n止损止盈\n风控预检", ORANGE),
        ("成交模拟", "手续费\n滑点\n资金费率", PURPLE),
        ("组合账户", "现金/持仓\n权益曲线\n拒单记录", RED),
        ("审计结论", "窗口/WFO\nPBO/CPCV\n继续或停止", "#334155"),
    ]
    fig, ax = plt.subplots(figsize=(13.2, 5.4), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.91, "回测不是收益公式，而是从数据到账户路径的事件链", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    width = 0.132
    gap = 0.026
    y = 0.34
    for i, (title, body, color) in enumerate(steps):
        x = 0.04 + i * (width + gap)
        ax.add_patch(Rectangle((x, y), width, 0.38, transform=ax.transAxes, facecolor="#FFFFFF", edgecolor=color, linewidth=2.2))
        ax.text(x + 0.012, y + 0.29, title, transform=ax.transAxes, fontsize=11.4, color=color, weight="bold")
        ax.text(x + 0.012, y + 0.20, body, transform=ax.transAxes, fontsize=9.4, color=INK, va="top")
        if i < len(steps) - 1:
            ax.add_patch(FancyArrowPatch((x + width + 0.005, y + 0.19), (x + width + gap - 0.006, y + 0.19), transform=ax.transAxes, arrowstyle="-|>", mutation_scale=13, linewidth=1.7, color=MUTED))
    fig.savefig(OUT / "chapter-27-backtest-engine-flow.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-backtest-engine-flow.png")


def save_cost_stress_compare() -> None:
    rows = []
    for preset in ["teaching", "realistic", "perp"]:
        payload = execute_backtest(
            strategy_name="ma_crossover",
            symbol="WEB3-DEMO/USDT",
            limit=120,
            cost_preset=preset,
        )
        rows.append(payload)
    colors = [BLUE, ORANGE, RED]
    fig, ax = plt.subplots(figsize=(12.0, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    for payload, color in zip(rows, colors, strict=True):
        equity = _equity_points(payload)
        label = f"{payload['cost_preset']} ({float(payload['total_return_pct']):.1f}%)"
        ax.plot(range(len(equity)), equity, color=color, linewidth=2.1, label=label)
        if equity:
            ax.scatter(len(equity) - 1, equity[-1], color=color, s=46, zorder=3)
    ax.axhline(100, color="#94A3B8", linewidth=1, linestyle="--")
    ax.set_ylabel("权益（初始=100）")
    ax.set_xlabel("样本内 K 线序号")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, loc="lower right")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-cost-stress-compare.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-cost-stress-compare.png")


def save_window_wfo_cpcv_map() -> None:
    kwargs = {
        "strategy_name": "ma_crossover",
        "symbol": "WEB3-DEMO/USDT",
        "limit": 120,
        "cost_preset": "teaching",
    }
    windows = compare_windows(**kwargs)
    wfo = run_walk_forward(**kwargs)
    cpcv = run_cpcv_service(**kwargs)["cpcv"]
    labels = [f"W{row['window']}" for row in windows["windows"]]
    returns = [float(row["total_return_pct"]) for row in windows["windows"]]
    cpcv_returns = [float(row["return_pct"]) for row in cpcv["paths"]]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.2, 5.6), dpi=160, gridspec_kw={"width_ratios": [1.15, 0.85]})
    fig.patch.set_facecolor(PAPER)
    for ax in (ax1, ax2):
        ax.set_facecolor("#FFFFFF")
        ax.grid(axis="y", color=GRID, linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)
    ax1.bar(labels, returns, color=[TEAL if v > 0 else RED if v < 0 else "#94A3B8" for v in returns], label="窗口收益")
    ax1.axhline(0, color="#94A3B8", linewidth=1)
    ax1.scatter([len(labels) - 0.35], [float(wfo["out_of_sample_return_pct"])], color=ORANGE, s=90, zorder=3, label="WFO OOS")
    ax1.set_ylabel("收益 %")
    ax1.set_title("窗口与 Walk-Forward")
    ax1.legend(frameon=False, loc="upper left")
    ax2.scatter(range(len(cpcv_returns)), cpcv_returns, color=[TEAL if v >= 0 else RED for v in cpcv_returns], s=70)
    ax2.axhline(0, color="#94A3B8", linewidth=1)
    ax2.axhline(float(cpcv["return_p50"]), color=ORANGE, linestyle="--", linewidth=1.6, label="CPCV p50")
    ax2.set_xticks(range(len(cpcv_returns)))
    ax2.set_xticklabels([f"P{i + 1}" for i in range(len(cpcv_returns))])
    ax2.set_title("CPCV 路径收益")
    ax2.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-window-wfo-cpcv-map.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-window-wfo-cpcv-map.png")


def save_trade_path_diagnostics() -> None:
    payload = execute_backtest(
        strategy_name="ma_crossover",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset="teaching",
    )
    curve = payload.get("equity_curve") or []
    x = list(range(len(curve)))
    equity = [float(row.get("equity") or 0.0) for row in curve]
    drawdown = [float(row.get("drawdown") or 0.0) for row in curve]
    idx_to_pos = {int(row.get("idx", pos)): pos for pos, row in enumerate(curve)}
    fig, ax1 = plt.subplots(figsize=(12.4, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax1.set_facecolor("#FFFFFF")
    ax1.plot(x, equity, color=BLUE, linewidth=2.2, label="权益")
    for trade in payload.get("trades") or []:
        entry_pos = idx_to_pos.get(int(trade.get("entryIdx", -1)))
        exit_pos = idx_to_pos.get(int(trade.get("exitIdx", -1)))
        if entry_pos is not None and 0 <= entry_pos < len(equity):
            ax1.scatter(entry_pos, equity[entry_pos], marker="^", color=TEAL, s=70, zorder=3, label="入场" if "入场" not in ax1.get_legend_handles_labels()[1] else None)
        if exit_pos is not None and 0 <= exit_pos < len(equity):
            ax1.scatter(exit_pos, equity[exit_pos], marker="v", color=RED, s=70, zorder=3, label="出场" if "出场" not in ax1.get_legend_handles_labels()[1] else None)
    ax2 = ax1.twinx()
    ax2.fill_between(x, drawdown, 0, color=RED, alpha=0.15, label="回撤")
    ax1.axhline(100, color="#94A3B8", linewidth=1, linestyle="--")
    ax1.set_ylabel("权益（初始=100）")
    ax2.set_ylabel("回撤 %")
    ax1.set_xlabel("样本内 K 线序号")
    ax1.grid(color=GRID, linewidth=0.8)
    ax1.spines[["top"]].set_visible(False)
    ax2.spines[["top"]].set_visible(False)
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1 + h2, l1 + l2, frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-trade-path-diagnostics.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-trade-path-diagnostics.png")


def _method_payloads_for_cost(cost_preset: str) -> list[tuple[str, dict[str, Any]]]:
    rule = execute_backtest(
        strategy_name="ma_crossover",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset=cost_preset,
    )
    baseline = execute_backtest(
        strategy_name="buy_and_hold",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset=cost_preset,
    )
    mined = run_factor_mining(
        mode="ml",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        horizon=1,
    )
    ml = run_mined_factor_backtest(
        backtest_spec=mined["leader"]["backtest_spec"],
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset=cost_preset,
    )
    llm = run_factor_mining(
        mode="llm",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        horizon=1,
    )
    llm_bt = run_mined_factor_backtest(
        backtest_spec=llm["leader"]["backtest_spec"],
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset=cost_preset,
    )
    return [
        ("规则", rule),
        ("ML因子", ml),
        ("LLM候选", llm_bt),
        ("买入持有", baseline),
    ]


def save_model_environment_matrix() -> None:
    envs = ["teaching", "realistic", "perp"]
    method_order = ["规则", "ML因子", "LLM候选", "买入持有"]
    rows: list[dict[str, Any]] = []
    for env in envs:
        for method, payload in _method_payloads_for_cost(env):
            rows.append(
                {
                    "env": env,
                    "method": method,
                    "return": float(payload.get("total_return_pct") or 0.0),
                    "drawdown": float(payload.get("max_drawdown_pct") or 0.0),
                }
            )
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14.2, 6.0), dpi=160, sharex=False)
    fig.patch.set_facecolor(PAPER)
    colors = {"规则": BLUE, "ML因子": TEAL, "LLM候选": RED, "买入持有": MUTED}
    x_base = list(range(len(envs)))
    width = 0.18
    offsets = [-1.5 * width, -0.5 * width, 0.5 * width, 1.5 * width]
    for ax, metric, title in ((ax1, "return", "最终收益 %"), (ax2, "drawdown", "最大回撤 %")):
        ax.set_facecolor("#FFFFFF")
        for method, offset in zip(method_order, offsets, strict=True):
            vals = [
                next(row[metric] for row in rows if row["env"] == env and row["method"] == method)
                for env in envs
            ]
            ax.bar([x + offset for x in x_base], vals, width=width, color=colors[method], label=method)
        ax.axhline(0, color="#94A3B8", linewidth=1)
        ax.set_xticks(x_base)
        ax.set_xticklabels(envs)
        ax.set_title(title)
        ax.grid(axis="y", color=GRID, linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)
    ax1.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-model-environment-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-model-environment-matrix.png")


def save_parameter_sensitivity_curve() -> None:
    rows = []
    for stop_loss in [2.0, 3.0, 4.0, 5.0]:
        for take_profit in [4.0, 5.0, 6.0, 8.0]:
            payload = execute_backtest(
                strategy_name="ma_crossover",
                symbol="WEB3-DEMO/USDT",
                limit=120,
                stop_loss_pct=stop_loss,
                take_profit_pct=take_profit,
                cost_preset="teaching",
            )
            rows.append(
                {
                    "sl": stop_loss,
                    "tp": take_profit,
                    "return": float(payload.get("total_return_pct") or 0.0),
                    "drawdown": float(payload.get("max_drawdown_pct") or 0.0),
                }
            )
    fig, ax = plt.subplots(figsize=(11.8, 5.8), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")

    grouped: dict[tuple[float, ...], list[float]] = {}
    grouped_tp: dict[tuple[float, ...], list[float]] = {}
    for stop_loss in sorted({row["sl"] for row in rows}):
        series = [row for row in rows if row["sl"] == stop_loss]
        series.sort(key=lambda row: row["tp"])
        returns = tuple(round(row["return"], 6) for row in series)
        grouped.setdefault(returns, []).append(stop_loss)
        grouped_tp[returns] = [row["tp"] for row in series]

    styles = [
        (BLUE, "o", "-"),
        (ORANGE, "s", "-"),
        (RED, "D", "--"),
        (PURPLE, "^", ":"),
    ]
    for idx, (returns, stop_losses) in enumerate(grouped.items()):
        color, marker, linestyle = styles[idx % len(styles)]
        if len(stop_losses) == 1:
            label = f"止损 {stop_losses[0]:.0f}%"
        else:
            joined = " / ".join(f"{value:.0f}%" for value in stop_losses)
            label = f"止损 {joined}"
        ax.plot(
            grouped_tp[returns],
            list(returns),
            marker=marker,
            linewidth=2.2,
            linestyle=linestyle,
            color=color,
            label=label,
        )
    ax.axhline(0, color="#94A3B8", linewidth=1)
    ax.set_xlabel("止盈参数 %")
    ax.set_ylabel("最终收益 %")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, loc="lower left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-parameter-sensitivity-curve.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-parameter-sensitivity-curve.png")


def _equity_points(payload: dict[str, Any]) -> list[float]:
    return [float(row.get("equity") or 0.0) for row in payload.get("equity_curve") or []]


def save_practice_compare_equity_curve() -> None:
    rule = execute_backtest(
        strategy_name="ma_crossover",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset="teaching",
    )
    baseline = execute_backtest(
        strategy_name="buy_and_hold",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset="teaching",
    )
    mined = run_factor_mining(
        mode="ml",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        horizon=1,
    )
    ml = run_mined_factor_backtest(
        backtest_spec=mined["leader"]["backtest_spec"],
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset="teaching",
    )
    llm = run_factor_mining(
        mode="llm",
        symbol="WEB3-DEMO/USDT",
        limit=120,
        horizon=1,
    )
    llm_bt = run_mined_factor_backtest(
        backtest_spec=llm["leader"]["backtest_spec"],
        symbol="WEB3-DEMO/USDT",
        limit=120,
        cost_preset="teaching",
    )
    series = [
        ("规则 ma_crossover", rule, BLUE),
        ("ML mined_factor", ml, TEAL),
        ("LLM fallback factor", llm_bt, RED),
        ("买入持有基准", baseline, MUTED),
    ]
    fig, ax = plt.subplots(figsize=(12.4, 6.0), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    for label, payload, color in series:
        equity = _equity_points(payload)
        ax.plot(range(len(equity)), equity, linewidth=2.2, color=color, label=label)
        if equity:
            ax.scatter(len(equity) - 1, equity[-1], s=48, color=color, zorder=3)
            ax.text(
                len(equity) - 1,
                equity[-1],
                f" {float(payload['total_return_pct']):.1f}%",
                fontsize=9,
                color=color,
                va="center",
            )
    ax.axhline(100, color="#94A3B8", linewidth=1, linestyle="--")
    ax.set_ylabel("权益（初始=100）")
    ax.set_xlabel("样本内 K 线序号")
    ax.grid(color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-practice-compare-equity-curve.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-practice-compare-equity-curve.png")


def save_failure_exit_matrix() -> None:
    data = _audit_payloads()
    risk = data["risk"]
    rows = [
        ("SPA 路由", "缺失前端路径", "返回 index.html 或 404 明确", "tests/test_app_server.py"),
        ("数据源", "上游不可用", "显示 snapshot / fixture 来源", "sources_status"),
        ("回测", "窗口不稳定", f"{data['windows']['positive_windows']}/{data['windows']['num_windows']} 正窗口", "compare_windows"),
        ("WFO", "过拟合警告", f"DSR={data['wfo']['dsr']} warning={data['wfo']['overfit_warning']}", "run_walk_forward"),
        ("稳健性", "参数/PBO 异常", f"verdict={data['robustness']['verdict']} PBO={data['robustness']['pbo']['pbo']}", "run_robustness_audit"),
        ("风险中心", "运行期拒单", f"{len(risk['backtest']['risk_rejections'])} 次拒单", "build_report"),
    ]
    fig, ax = plt.subplots(figsize=(13, 6.4), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.axis("off")
    ax.text(0.04, 0.93, "异常出口也是端到端验收的一部分", transform=ax.transAxes, fontsize=15, color=INK, weight="bold")
    headers = ["环节", "失败注入", "页面应显示", "证据来源"]
    col_x = [0.04, 0.20, 0.42, 0.72]
    col_w = [0.14, 0.20, 0.28, 0.22]
    y0 = 0.82
    row_h = 0.108
    for x, w, header in zip(col_x, col_w, headers, strict=True):
        ax.add_patch(Rectangle((x, y0), w, 0.075, transform=ax.transAxes, facecolor="#334155", edgecolor="#334155"))
        ax.text(x + 0.01, y0 + 0.048, header, transform=ax.transAxes, fontsize=10, color="#FFFFFF", weight="bold", va="center")
    for r, row in enumerate(rows):
        y = y0 - (r + 1) * row_h
        bg = "#FFFFFF" if r % 2 == 0 else "#F1F5F9"
        for x, w, value in zip(col_x, col_w, row, strict=True):
            ax.add_patch(Rectangle((x, y), w, row_h, transform=ax.transAxes, facecolor=bg, edgecolor=GRID, linewidth=1))
            ax.text(x + 0.01, y + row_h * 0.58, fill(str(value), 30), transform=ax.transAxes, fontsize=9.2, color=INK, va="center")
    fig.savefig(OUT / "chapter-27-failure-exit-matrix.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-failure-exit-matrix.png")


def save_evidence_package_checklist() -> None:
    items = [
        ("路径记录", 6, "路由顺序和操作动作"),
        ("截图", 6, "关键页面状态"),
        ("API 对账", 6, "字段能回到接口"),
        ("异常出口", 5, "失败原因可见"),
        ("复测命令", 3, "pytest / verify / build"),
        ("人工结论", 3, "继续 / 修改 / 停止"),
    ]
    labels = [row[0] for row in items]
    values = [row[1] for row in items]
    fig, ax = plt.subplots(figsize=(11.6, 5.6), dpi=160)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#FFFFFF")
    bars = ax.barh(labels, values, color=[BLUE, TEAL, "#0891B2", ORANGE, PURPLE, RED])
    ax.set_xlabel("证据件数 / 检查点")
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    for bar, (_, value, note) in zip(bars, items, strict=True):
        ax.text(value + 0.1, bar.get_y() + bar.get_height() / 2, note, va="center", fontsize=9.3, color=INK)
    fig.tight_layout()
    fig.savefig(OUT / "chapter-27-evidence-package-checklist.png", bbox_inches="tight")
    plt.close(fig)
    print(OUT / "chapter-27-evidence-package-checklist.png")


def main() -> None:
    setup_matplotlib()
    OUT.mkdir(parents=True, exist_ok=True)
    save_browser_research_path()
    save_route_api_contract()
    save_e2e_latency_status()
    save_backtest_audit_summary()
    save_backtest_engine_flow()
    save_cost_stress_compare()
    save_window_wfo_cpcv_map()
    save_trade_path_diagnostics()
    save_model_environment_matrix()
    save_parameter_sensitivity_curve()
    save_practice_compare_equity_curve()
    save_failure_exit_matrix()
    save_evidence_package_checklist()


if __name__ == "__main__":
    main()
