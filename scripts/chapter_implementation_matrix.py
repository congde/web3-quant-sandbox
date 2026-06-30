"""Machine-checkable mapping from publishable chapters to runnable code.

The course text in docs/v2 is only acceptable when its knowledge claims can be
traced to local code, tests, routes, or commands. This module is intentionally
plain data plus validation so later chapters cannot drift away from the product.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class ChapterImplementation:
    chapter: int
    title: str
    capabilities: tuple[str, ...]
    code_paths: tuple[str, ...]
    test_paths: tuple[str, ...]
    commands: tuple[str, ...]
    routes: tuple[str, ...] = ()


MATRIX: tuple[ChapterImplementation, ...] = (
    ChapterImplementation(
        0,
        "AI 能写策略，但不能替人承担交易风险",
        ("course_boundary", "workspace_map", "acceptance_commands"),
        ("scripts/course.py", "verify.py", "README.md"),
        ("tests/test_final_acceptance_contract.py", "tests/test_project.py"),
        ("py scripts/course.py verify", "py scripts/course.py check"),
        ("/backtests",),
    ),
    ChapterImplementation(
        1,
        "AI 量化研究的证据边界与责任分工",
        ("evidence_boundary", "llm_signal", "risk_review"),
        ("src/dashboard/signal_analysis.py", "src/dashboard/llm_signal.py", "src/risk/manager.py"),
        ("tests/test_llm_signal.py", "tests/test_risk_manager.py", "tests/test_project.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        2,
        "从交易想法到可验证的研究假设",
        ("hypothesis_card", "fixed_sample_backtest", "report_summary"),
        ("src/backtest/runner.py", "src/research/report.py", "data/prices.csv"),
        ("tests/test_project.py", "tests/test_backtest_lab.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        3,
        "搭建可复现的量化研究工作区",
        ("repo_boundaries", "task_runner", "vendor_baseline"),
        ("scripts/course.py", "verify.py", "vendor/FUSION.md"),
        ("tests/test_final_acceptance_contract.py", "tests/test_project.py"),
        ("py scripts/course.py verify", "py scripts/course.py check"),
    ),
    ChapterImplementation(
        4,
        "读懂价格收益信号与仓位",
        ("price_loading", "return_metrics", "position_state"),
        ("src/backtest/runner.py", "src/backtest/metrics.py", "src/strategy_engine/backtest/portfolio.py"),
        ("tests/test_project.py", "tests/test_backtest_lab.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        5,
        "建立第一条安全边界研究不等于投资建议",
        ("simulation_boundary", "risk_manager", "live_trading_disclaimer"),
        ("src/risk/execution_boundary.py", "src/risk/manager.py", "src/web/src/pages/trading/LiveTradingPage.tsx"),
        ("tests/test_execution_boundary.py", "tests/test_risk_manager.py"),
        ("py scripts/course.py verify",),
        ("/live-trading", "/risk"),
    ),
    ChapterImplementation(
        6,
        "认识行情资金链上与情绪数据",
        ("source_catalog", "source_cards", "dashboard_api"),
        ("src/dashboard/catalog.py", "src/dashboard/source_card.py", "src/dashboard/api.py"),
        ("tests/test_dashboard.py", "tests/test_dashboard_source_card.py"),
        ("py scripts/course.py verify",),
        ("/data-sources",),
    ),
    ChapterImplementation(
        7,
        "用 Codex 构建市场数据采集与快照流程",
        ("snapshot_refresh", "offline_fixtures", "fallback_mode"),
        ("src/dashboard/snapshot.py", "src/dashboard/refresh.py", "scripts/build_dashboard_fixtures.py"),
        ("tests/test_dashboard_persist.py", "tests/test_dashboard_offline.py"),
        ("py scripts/course.py snapshot", "py scripts/course.py sync-fixtures"),
    ),
    ChapterImplementation(
        8,
        "清洗标准化并验证时间序列数据",
        ("normalization", "time_series_validation", "gap_gate"),
        ("src/dashboard/normalize.py", "src/dashboard/market.py", "src/dashboard/catalog.py"),
        ("tests/test_dashboard_normalize.py", "tests/test_dashboard_offline.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        9,
        "用技术指标描述市场状态",
        ("technical_indicators", "kline_analysis", "ta_core"),
        ("src/ta/core.py", "src/dashboard/indicators.py", "src/dashboard/kline_analysis.py"),
        ("tests/test_kline_analysis.py", "tests/test_project.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        10,
        "生成可追溯的市场研究报告",
        ("traceable_report", "source_evidence", "report_cli"),
        ("src/research/report.py", "report_cli.py", "research-report.md"),
        ("tests/test_project.py", "tests/test_dashboard_source_card.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        11,
        "LLM 在交易研究中能做什么不能做什么",
        ("rule_signal", "llm_boundary", "fallback_answer"),
        ("src/dashboard/signal_analysis.py", "src/dashboard/llm_signal.py"),
        ("tests/test_signal_analysis.py", "tests/test_llm_signal.py"),
        ("py scripts/course.py verify",),
        ("/radar",),
    ),
    ChapterImplementation(
        12,
        "把市场数据转换成 LLM 可理解的上下文",
        ("context_budget", "dataset_views", "prompt_payload"),
        ("src/dashboard/dataset_views.py", "src/dashboard/llm_signal.py", "src/dashboard/text.py"),
        ("tests/test_llm_signal.py", "tests/test_dashboard.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        13,
        "让 LLM 输出结构化交易信号",
        ("structured_signal", "task_polling", "schema_validation"),
        ("src/dashboard/llm_signal.py", "src/dashboard/signal_tasks.py", "src/web/src/api.ts"),
        ("tests/test_llm_signal.py", "tests/test_signal_tasks.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        14,
        "识别幻觉提示泄漏与未来信息污染",
        ("hallucination_guard", "lookahead_check", "pollution_audit"),
        ("src/strategy_engine/dsl/lookahead.py", "src/backtest/pollution.py", "src/dashboard/llm_signal.py"),
        ("tests/test_project.py", "tests/test_llm_signal.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        15,
        "用样本和评分规程验证 LLM 信号",
        ("signal_eval", "sample_tasks", "scoring_rubric"),
        ("src/dashboard/signal_eval.py", "src/dashboard/signal_tasks.py", "eval-rubric.md"),
        ("tests/test_signal_eval.py", "tests/test_eval_version_contract.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        16,
        "把研究信号写成明确的策略规则",
        ("strategy_contract", "technical_signal", "rule_registry"),
        ("src/backtest/rolling/strategies/technical_signal.py", "src/backtest/rolling/registry.py"),
        ("tests/test_qbot_strategies.py", "tests/test_backtest_lab.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        17,
        "用 Codex 实现第一条量化策略",
        ("ma_crossover", "dsl_validation", "strategy_engine"),
        ("src/strategy_engine/strategies/ma_crossover.py", "src/strategy_engine/dsl/validator.py"),
        ("tests/test_project.py", "tests/test_qbot_strategies.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        18,
        "构建事件驱动回测引擎",
        ("event_engine", "portfolio_accounting", "runtime_risk_gate"),
        ("src/strategy_engine/backtest/engine.py", "src/strategy_engine/backtest/portfolio.py", "src/risk/config.py"),
        ("tests/test_project.py", "tests/test_risk_manager.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        19,
        "正确评估收益回撤与风险调整表现",
        ("performance_metrics", "metric_explain", "risk_adjusted_return"),
        ("src/backtest/metrics.py", "src/backtest/metrics_explain.py", "src/backtest/runner.py"),
        ("tests/test_project.py", "tests/test_backtest_audit.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        20,
        "防止过拟合前视偏差与数据窥探",
        ("pbo", "trial_audit", "lookahead_guard"),
        ("src/backtest/audit/pbo.py", "src/backtest/trials.py", "src/strategy_engine/dsl/lookahead.py"),
        ("tests/test_backtest_audit.py", "tests/test_project.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        21,
        "从单次回测走向滚动回测与多策略比较",
        ("rolling_windows", "strategy_compare", "walk_forward"),
        ("src/backtest/rolling/service.py", "src/backtest/rolling/optimization/walk_forward.py"),
        ("tests/test_backtest_lab.py", "tests/test_integration_path_contract.py"),
        ("py scripts/course.py verify",),
        ("/backtests",),
    ),
    ChapterImplementation(
        22,
        "建立仓位止损与组合风险控制",
        ("position_sizing", "stop_loss", "portfolio_risk"),
        ("src/risk/manager.py", "src/risk/config.py", "src/backtest/rolling/risk/position.py"),
        ("tests/test_risk_manager.py", "tests/test_backtest_lab.py"),
        ("py scripts/course.py verify",),
        ("/risk",),
    ),
    ChapterImplementation(
        23,
        "设计交易研究应用的信息架构",
        ("app_routes", "navigation", "page_shell"),
        ("src/web/src/App.tsx", "src/web/src/layouts/MainLayout.tsx", "src/web/src/pages/trading/TradingPageShell.tsx"),
        ("tests/test_app_server.py", "tests/test_final_acceptance_contract.py"),
        ("py scripts/course.py verify",),
        ("/trading", "/radar", "/backtests", "/risk"),
    ),
    ChapterImplementation(
        24,
        "构建行情总览机会雷达与数据源面板",
        ("market_dashboard", "opportunity_scan", "source_panel"),
        ("src/dashboard/opportunity.py", "src/web/src/pages/trading/DashboardPage.tsx", "src/web/src/pages/trading/DataSourcesPage.tsx"),
        ("tests/test_dashboard.py", "tests/test_dashboard_offline.py"),
        ("py scripts/course.py verify",),
        ("/trading", "/radar", "/data-sources"),
    ),
    ChapterImplementation(
        25,
        "构建 K 线分析与 LLM 信号页面",
        ("kline_page", "llm_signal_page", "chart_components"),
        ("src/dashboard/kline_analysis.py", "src/web/src/pages/trading/RadarPage.tsx", "src/web/src/components/charts/KlineAnalysisChart.tsx"),
        ("tests/test_kline_analysis.py", "tests/test_llm_signal.py"),
        ("py scripts/course.py verify",),
        ("/radar",),
    ),
    ChapterImplementation(
        26,
        "构建策略回测与风险中心",
        ("backtest_page", "risk_center", "audit_views"),
        ("src/web/src/pages/trading/BacktestsPage.tsx", "src/web/src/pages/trading/RiskPage.tsx", "src/backtest/rolling/service.py"),
        ("tests/test_backtest_audit.py", "tests/test_risk_manager.py"),
        ("py scripts/course.py verify",),
        ("/backtests", "/risk"),
    ),
    ChapterImplementation(
        27,
        "用浏览器验证完整研究路径",
        ("browser_acceptance", "app_server", "route_smoke"),
        ("app.py", "src/web/src/App.tsx", "tests/test_app_server.py"),
        ("tests/test_app_server.py", "tests/test_final_acceptance_contract.py"),
        ("py scripts/course.py verify",),
        ("/trading", "/radar", "/backtests", "/live-trading"),
    ),
    ChapterImplementation(
        28,
        "把稳定研究流程写成 Codex-Skill",
        ("skill_contract", "research_report_check", "reuse_boundary"),
        ("skills/research-report-check/SKILL.md", "skills/research-report-check"),
        ("tests/test_skill_contracts.py", "tests/test_final_acceptance_contract.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        29,
        "自动生成市场快照与研究草稿",
        ("automation_entry", "snapshot_save", "offline_sync"),
        ("dashboard_snapshot.py", "src/dashboard/snapshot.py", "src/dashboard/persist.py"),
        ("tests/test_snapshot_automation_contract.py", "tests/test_dashboard_persist.py"),
        ("py scripts/course.py snapshot", "py scripts/course.py sync-fixtures"),
    ),
    ChapterImplementation(
        30,
        "为高风险动作设置审批门与停止线",
        ("approval_gate", "execution_stopline", "risk_policy"),
        ("src/risk/execution_boundary.py", "src/risk/config.py", "src/risk/simulation.py"),
        ("tests/test_approval_gate_contract.py", "tests/test_execution_boundary.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        31,
        "用 Eval 比较提示词模型与策略版本",
        ("eval_runner", "version_compare", "candidate_scoring"),
        ("src/dashboard/signal_eval.py", "eval-rubric.md"),
        ("tests/test_signal_eval.py", "tests/test_eval_version_contract.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        32,
        "监控失败降级恢复与审计记录",
        ("failure_monitoring", "degrade_recover", "audit_log"),
        ("src/dashboard/signal_tasks.py", "src/dashboard/persist.py", "src/risk/simulation.py"),
        ("tests/test_failure_recovery_contract.py", "tests/test_dashboard_persist.py"),
        ("py scripts/course.py verify",),
    ),
    ChapterImplementation(
        33,
        "设计端到端模拟交易系统",
        ("simulation_system", "trace", "fill_pending"),
        ("src/backtest/research_path.py", "src/backtest/trace.py", "src/risk/execution_boundary.py"),
        ("tests/test_simulation_system_contract.py", "tests/test_integration_path_contract.py"),
        ("py scripts/course.py verify",),
        ("/live-trading",),
    ),
    ChapterImplementation(
        34,
        "贯通信号策略回测风控与 Web 应用",
        ("integrated_path", "api_contract", "web_to_backend"),
        ("src/backtest/research_path.py", "src/backtest/bridge.py", "src/web/src/api.ts"),
        ("tests/test_integration_path_contract.py", "tests/test_app_server.py"),
        ("py scripts/course.py verify",),
        ("/radar", "/backtests", "/risk"),
    ),
    ChapterImplementation(
        35,
        "完成系统验收复盘与下一轮迭代",
        ("final_acceptance", "course_check", "review_loop"),
        ("verify.py", "scripts/course.py", "scripts/verify_courseware.py"),
        ("tests/test_final_acceptance_contract.py", "tests/test_project.py"),
        ("py scripts/course.py verify", "py scripts/course.py check"),
    ),
)


def iter_referenced_paths() -> Iterable[str]:
    for item in MATRIX:
        yield from item.code_paths
        yield from item.test_paths
        for command in item.commands:
            parts = command.split()
            for part in parts:
                if "/" in part or part.endswith(".py"):
                    yield part


def publishable_chapters() -> set[int]:
    chapters: set[int] = set()
    for path in (ROOT / "docs" / "v2").glob("*.md"):
        if match := re.match(r"^(00|0[1-9]|[12][0-9]|3[0-5])-", path.name):
            chapters.add(int(match.group(1)))
    return chapters


def validate_matrix() -> list[str]:
    errors: list[str] = []
    chapters = [item.chapter for item in MATRIX]
    if chapters != list(range(36)):
        errors.append(f"chapter matrix must cover 00-35 in order, found {chapters}")

    docs = publishable_chapters()
    missing_docs = sorted(set(chapters) - docs)
    if missing_docs:
        errors.append(f"matrix references missing docs/v2 chapters: {missing_docs}")

    for item in MATRIX:
        if not item.capabilities:
            errors.append(f"chapter {item.chapter:02d} has no capabilities")
        if not item.code_paths:
            errors.append(f"chapter {item.chapter:02d} has no code paths")
        if not item.test_paths:
            errors.append(f"chapter {item.chapter:02d} has no tests")
        if not item.commands:
            errors.append(f"chapter {item.chapter:02d} has no verification command")
        for path_text in item.code_paths + item.test_paths:
            path = ROOT / path_text
            if not path.exists():
                errors.append(f"chapter {item.chapter:02d} references missing {path_text}")
        for route in item.routes:
            if not route.startswith("/"):
                errors.append(f"chapter {item.chapter:02d} route must start with /: {route}")

    return errors


def main() -> int:
    errors = validate_matrix()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("docs/v2 chapter implementation matrix is complete and traceable")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
