from __future__ import annotations

import json
import mimetypes
import socket
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import sys


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
HOST = "127.0.0.1"
PORT = 8765
sys.path.insert(0, str(SRC))

from backtest.rolling.service import (  # noqa: E402
    compare_strategies,
    compare_windows,
    execute_backtest,
    get_trial_audit,
    list_backtest_strategies,
    list_cost_presets,
    run_cpcv_service,
    run_robustness_audit,
    run_walk_forward,
    load_candles,
)
from backtest.investment_gate import evaluate_investment_gate  # noqa: E402
from data.pit import pit_teaching_summary  # noqa: E402
from backtest.rolling.portfolio import compare_portfolio  # noqa: E402
from factor_mining.service import run_factor_mining, run_mined_factor_backtest  # noqa: E402
from config.env import load_env  # noqa: E402
from dashboard import api as dashboard_api  # noqa: E402
from paths import WEB_STATIC_DIR  # noqa: E402
from research.report import build_report  # noqa: E402
from strategy_engine.dsl import (  # noqa: E402
    check_lookahead_bias,
    validate_strategy_code,
)
from strategy_engine.dsl.loader import StrategyCompileError, compile_strategy  # noqa: E402
from strategy_engine.backtest.candles import Candle  # noqa: E402
from strategy_engine.backtest.engine import BacktestEngine  # noqa: E402
from strategy_engine.backtest.models import ConstantBpsFee, ConstantBpsSlippage  # noqa: E402
from strategy_lab import StrategyLabRepository  # noqa: E402
from strategy_lab.llm import diagnose_experiment, explain_strategy, propose_strategy, repair_strategy  # noqa: E402
from strategy_lab.experiments import ExperimentRunner  # noqa: E402

load_env()
STRATEGY_LAB = StrategyLabRepository(ROOT / "data" / "strategy_lab.db")
STRATEGY_EXPERIMENTS = ExperimentRunner(STRATEGY_LAB)

STATIC_ASSET_SUFFIXES = frozenset(
    {
        ".html",
        ".js",
        ".css",
        ".svg",
        ".json",
        ".ico",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".woff",
        ".woff2",
        ".map",
    }
)

STATIC_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
}


def looks_like_static_asset(rel: str) -> bool:
    suffix = Path(rel).suffix.lower()
    return bool(suffix) and suffix in STATIC_ASSET_SUFFIXES


def assert_port_available(host: str, port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((host, port))
        except OSError as exc:
            raise SystemExit(
                f"Cannot bind {host}:{port} ({exc}). "
                "Stop other app.py instances, then retry."
            ) from exc


class SandboxHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    server_version = "Web3ResearchSandbox/1.0"

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/report":
                self.send_report(parsed.query)
                return
            if parsed.path == "/api/strategy-lab/strategies":
                self.send_json({"ok": True, "strategies": STRATEGY_LAB.list_strategies()}, status=200)
                return
            if parsed.path.startswith("/api/strategy-lab/strategies/"):
                strategy_id = parsed.path.removeprefix("/api/strategy-lab/strategies/").split("/")[0]
                try:
                    self.send_json({"ok": True, "strategy": STRATEGY_LAB.get_strategy(strategy_id)}, status=200)
                except KeyError as error:
                    self.send_json({"ok": False, "message": str(error)}, status=404)
                return
            if parsed.path == "/api/strategy-lab/experiments":
                params = parse_qs(parsed.query)
                version_id = params.get("versionId", [None])[0]
                self.send_json({"ok": True, "experiments": STRATEGY_LAB.list_experiments(version_id)}, status=200)
                return
            if parsed.path.startswith("/api/strategy-lab/experiments/"):
                experiment_id = parsed.path.removeprefix("/api/strategy-lab/experiments/").split("/")[0]
                try:
                    self.send_json({"ok": True, "experiment": STRATEGY_LAB.get_experiment(experiment_id)}, status=200)
                except KeyError as error:
                    self.send_json({"ok": False, "message": str(error)}, status=404)
                return
            if parsed.path == "/api/strategy-lab/paper-runs":
                params = parse_qs(parsed.query)
                self.send_json({"ok": True, "paper_runs": STRATEGY_LAB.list_paper_runs(params.get("versionId", [None])[0])}, status=200)
                return
            if parsed.path.startswith("/api/"):
                if self.send_dashboard_api(parsed.path, parsed.query):
                    return
            rel = parsed.path.lstrip("/") or "index.html"
            static_path = self.resolve_static(rel)
            if static_path is not None:
                content_type = self.guess_content_type(static_path)
                self.send_file(static_path, content_type)
                return
            if not looks_like_static_asset(rel):
                index_path = self.resolve_static("index.html")
                if index_path is not None:
                    self.send_file(index_path, STATIC_CONTENT_TYPES[".html"])
                    return
            self.send_error(404)
        except Exception as error:  # pragma: no cover - defensive guard for threaded server
            self.send_json({"error": str(error)}, status=500)

    def resolve_static(self, rel: str) -> Path | None:
        if ".." in rel or rel.startswith(("/", "\\")):
            return None
        candidate = (WEB_STATIC_DIR / rel).resolve()
        static_root = WEB_STATIC_DIR.resolve()
        if not str(candidate).startswith(str(static_root)) or not candidate.is_file():
            return None
        return candidate

    def guess_content_type(self, path: Path) -> str:
        known = STATIC_CONTENT_TYPES.get(path.suffix.lower())
        if known:
            return known
        guessed, _ = mimetypes.guess_type(str(path))
        return guessed or "application/octet-stream"

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/validate-strategy":
                self.validate_strategy()
                return
            if parsed.path == "/api/strategy/backtest":
                self.backtest_strategy()
                return
            if parsed.path == "/api/strategy-lab/strategies":
                self.create_strategy_asset()
                return
            if parsed.path == "/api/strategy-lab/ai/propose":
                self.propose_strategy_asset()
                return
            if parsed.path == "/api/strategy-lab/ai/explain":
                self.explain_strategy_asset()
                return
            if parsed.path == "/api/strategy-lab/ai/repair":
                self.repair_strategy_asset()
                return
            if parsed.path == "/api/strategy-lab/ai/diagnose":
                self.diagnose_strategy_experiment()
                return
            if parsed.path == "/api/strategy-lab/experiments":
                self.create_strategy_experiment()
                return
            if parsed.path.startswith("/api/strategy-lab/experiments/") and parsed.path.endswith("/cancel"):
                experiment_id = parsed.path.removeprefix("/api/strategy-lab/experiments/").removesuffix("/cancel").strip("/")
                self.cancel_strategy_experiment(experiment_id)
                return
            if parsed.path.startswith("/api/strategy-lab/versions/") and parsed.path.endswith("/promote"):
                version_id = parsed.path.removeprefix("/api/strategy-lab/versions/").removesuffix("/promote").strip("/")
                self.promote_strategy_version(version_id)
                return
            if parsed.path.startswith("/api/strategy-lab/versions/") and parsed.path.endswith("/paper-run"):
                version_id = parsed.path.removeprefix("/api/strategy-lab/versions/").removesuffix("/paper-run").strip("/")
                self.start_strategy_paper_run(version_id)
                return
            if parsed.path.startswith("/api/strategy-lab/paper-runs/") and parsed.path.endswith("/stop"):
                run_id = parsed.path.removeprefix("/api/strategy-lab/paper-runs/").removesuffix("/stop").strip("/")
                self.stop_strategy_paper_run(run_id)
                return
            if parsed.path.startswith("/api/strategy-lab/strategies/") and parsed.path.endswith("/versions"):
                strategy_id = parsed.path.removeprefix("/api/strategy-lab/strategies/").removesuffix("/versions").strip("/")
                self.create_strategy_version(strategy_id)
                return
            if parsed.path == "/api/dashboard/web3/knowledge-graph/nodes":
                self.create_knowledge_graph_node()
                return
            if parsed.path == "/api/dashboard/web3/knowledge-graph/edges":
                self.create_knowledge_graph_edge()
                return
            if parsed.path == "/api/dashboard/web3/knowledge-graph/evidence":
                self.create_knowledge_graph_evidence()
                return
            if parsed.path == "/api/dashboard/web3/knowledge-graph/ingestion/run":
                self.run_knowledge_graph_ingestion()
                return
            if (
                parsed.path.startswith(
                    "/api/dashboard/web3/knowledge-graph/candidates/"
                )
                and parsed.path.endswith("/review")
            ):
                candidate_id = parsed.path.removeprefix(
                    "/api/dashboard/web3/knowledge-graph/candidates/"
                ).removesuffix("/review").strip("/")
                self.review_knowledge_graph_candidate(candidate_id)
                return
            if parsed.path == "/api/dashboard/factor-mine/backtest":
                self.factor_mine_backtest()
                return
            self.send_error(404)
        except Exception as error:  # pragma: no cover
            self.send_json({"error": str(error)}, status=500)

    def do_PUT(self) -> None:
        try:
            parsed = urlparse(self.path)
            if (
                parsed.path
                == "/api/dashboard/web3/knowledge-graph/ingestion/schedule"
            ):
                payload = dashboard_api.update_web3_graph_schedule(
                    self.read_json_body()
                )
                self.send_json(payload, status=200)
                return
            if parsed.path.startswith(
                "/api/dashboard/web3/knowledge-graph/nodes/"
            ):
                node_id = parsed.path.removeprefix(
                    "/api/dashboard/web3/knowledge-graph/nodes/"
                ).strip("/")
                self.update_knowledge_graph_node(node_id)
                return
            self.send_error(404)
        except Exception as error:  # pragma: no cover
            self.send_json({"error": str(error)}, status=500)

    def do_DELETE(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path.startswith(
                "/api/dashboard/web3/knowledge-graph/nodes/"
            ):
                node_id = parsed.path.removeprefix(
                    "/api/dashboard/web3/knowledge-graph/nodes/"
                ).strip("/")
                dashboard_api.archive_web3_graph_node(node_id)
                self.send_json({"ok": True}, status=200)
                return
            if parsed.path.startswith(
                "/api/dashboard/web3/knowledge-graph/edges/"
            ):
                edge_id = parsed.path.removeprefix(
                    "/api/dashboard/web3/knowledge-graph/edges/"
                ).strip("/")
                dashboard_api.archive_web3_graph_edge(edge_id)
                self.send_json({"ok": True}, status=200)
                return
            if parsed.path.startswith(
                "/api/dashboard/web3/knowledge-graph/evidence/"
            ):
                evidence_id = parsed.path.removeprefix(
                    "/api/dashboard/web3/knowledge-graph/evidence/"
                ).strip("/")
                dashboard_api.archive_web3_graph_evidence(evidence_id)
                self.send_json({"ok": True}, status=200)
                return
            if parsed.path.startswith("/api/strategy-lab/versions/"):
                version_id = parsed.path.removeprefix("/api/strategy-lab/versions/").strip("/")
                STRATEGY_LAB.delete_version(version_id)
                self.send_json({"ok": True}, status=200)
                return
            if parsed.path.startswith("/api/strategy-lab/strategies/"):
                strategy_id = parsed.path.removeprefix("/api/strategy-lab/strategies/").strip("/")
                STRATEGY_LAB.delete_strategy(strategy_id)
                self.send_json({"ok": True}, status=200)
                return
            self.send_error(404)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except ValueError as error:
            self.send_json({"ok": False, "message": str(error)}, status=409)

    def send_report(self, query: str) -> None:
        params = parse_qs(query)
        try:
            short = int(params.get("short", ["3"])[0])
            long = int(params.get("long", ["7"])[0])
            payload = build_report(short=short, long=long)
            status = 200
        except (ValueError, TypeError) as error:
            payload = {"error": str(error)}
            status = 400
        self.send_json(payload, status=status)

    def send_dashboard_api(self, path: str, query: str) -> bool:
        params = parse_qs(query)

        def q(name: str, default: str) -> str:
            return params.get(name, [default])[0]

        def qi(name: str, default: int) -> int:
            try:
                return int(q(name, str(default)))
            except ValueError:
                return default

        def qf(name: str, default: float) -> float:
            try:
                return float(q(name, str(default)))
            except ValueError:
                return default

        def qb(name: str, default: bool = False) -> bool:
            return q(name, "true" if default else "false").lower() in {"1", "true", "yes"}

        def q_cost_preset() -> str | None:
            value = q("costPreset", "")
            return value or None

        def q_slippage_bps() -> float | None:
            raw = q("slippageBps", "")
            if not raw:
                return None
            try:
                return float(raw)
            except ValueError:
                return None

        def q_optional_bool(name: str) -> bool | None:
            if name not in params:
                return None
            return qb(name)

        def q_optional_float(name: str) -> float | None:
            if name not in params:
                return None
            return qf(name, 0.0)

        routes = {
            "/api/dashboard/config": lambda: dashboard_api.runtime_config(),
            "/api/dashboard/sources/status": lambda: dashboard_api.sources_status(),
            "/api/dashboard/snapshots": lambda: dashboard_api.snapshots_status(),
            "/api/dashboard/research-draft-gate": lambda: dashboard_api.research_draft_gate(
                max_age_hours=qf("maxAgeHours", 24.0),
            ),
            "/api/dashboard/research-draft": lambda: dashboard_api.research_draft(
                q("symbol", "BTC"),
                kline_type=q("type", "1hour"),
                max_age_hours=qf("maxAgeHours", 24.0),
            ),
            "/api/dashboard/vs/ai-picks": lambda: dashboard_api.ai_picks(refresh=qb("refresh")),
            "/api/dashboard/vs/sector-fund": lambda: dashboard_api.sector_fund(
                qi("trade_type", 1),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/vs/token-fund": lambda: dashboard_api.token_fund(
                q("symbol", "BTC"),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/onchain": lambda: dashboard_api.onchain(
                q("symbol", "BTC"),
                limit=qi("limit", 1),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/dex/trending": lambda: dashboard_api.dex_trending(
                chain=q("chain", "solana"),
                limit=qi("limit", 5),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/opportunity-scan": lambda: dashboard_api.opportunity_scan(
                top_k=qi("topK", 5),
                max_symbols=qi("maxSymbols", 30),
                min_volume_24h=float(q("minVolume24h", "200000")),
                refresh=qb("refresh"),
            ),
            "/api/market/candles": lambda: dashboard_api.market_candles(
                symbol=q("symbol", "") or None,
                kline_type=q("type", "1day"),
                limit=qi("limit", 120),
                short=qi("short", 3),
                long=qi("long", 7),
                refresh=qb("refresh"),
            ),
            "/api/market/tickers": lambda: dashboard_api.market_tickers(
                quote=q("quote", "USDT"),
                limit=qi("limit", 300),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/web3-news": lambda: dashboard_api.web3_news(
                limit=qi("limit", 50),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/web3/themes": lambda: dashboard_api.web3_theme_research(
                limit=qi("limit", 100),
                refresh=qb("refresh"),
            ),
            "/api/dashboard/web3/macro": lambda: dashboard_api.web3_macro_observation(
                refresh=qb("refresh"),
            ),
            "/api/dashboard/web3/knowledge-graph": lambda: dashboard_api.web3_knowledge_graph(
                refresh=qb("refresh"),
                query=q("q", ""),
                domain=q("domain", ""),
                risk=q("risk", ""),
            ),
            "/api/dashboard/web3/knowledge-graph/audit": lambda: dashboard_api.web3_graph_audit(
                limit=qi("limit", 100),
            ),
            "/api/dashboard/web3/knowledge-graph/ingestion": lambda: dashboard_api.web3_graph_ingestion_status(),
            "/api/dashboard/web3/knowledge-graph/candidates": lambda: dashboard_api.web3_graph_candidates(
                status=q("status", "pending"),
                limit=qi("limit", 100),
            ),
            "/api/market/ticker": lambda: dashboard_api.ticker_stats(
                q("symbol", "BTC-USDT"),
                refresh=qb("refresh"),
            ),
            "/api/market/kline-analysis": lambda: dashboard_api.kline_analysis(
                symbol=q("symbol", "BTC-USDT"),
                kline_type=q("type", "1hour"),
                limit=qi("limit", 120),
            ),
            "/api/dashboard/signal-analysis": lambda: dashboard_api.signal_analysis(q("symbol", "BTC")),
            "/api/dashboard/llm-signal-analysis": lambda: dashboard_api.llm_signal_analysis(
                q("symbol", "BTC"),
                model=q("model", "") or None,
            ),
            "/api/dashboard/llm-signal-analysis/poll": lambda: dashboard_api.llm_signal_poll(q("taskId", "")),
            "/api/dashboard/backtest/strategies": lambda: {
                "ok": True,
                "strategies": list_backtest_strategies(),
            },
            "/api/dashboard/backtest/cost-presets": lambda: {
                "ok": True,
                "presets": list_cost_presets(),
            },
            "/api/dashboard/backtest/investment-gate": lambda: evaluate_investment_gate(),
            "/api/dashboard/backtest/audit": lambda: get_trial_audit(
                strategy_key=q("strategy", "") or None,
            ),
            "/api/dashboard/backtest/robustness": lambda: run_robustness_audit(
                strategy_name=q("strategy", "ma_crossover"),
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/cpcv": lambda: run_cpcv_service(
                strategy_name=q("strategy", "ma_crossover"),
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/pit": lambda: pit_teaching_summary(),
            "/api/dashboard/backtest": lambda: execute_backtest(
                strategy_name=q("strategy", "technical_signal"),
                symbol=q("symbol", "") or None,
                kline_type=q("type", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                trailing_stop_pct=qf("trailingStop", 0.0),
                max_hold_bars=qi("maxHoldBars", 0),
                refresh=qb("refresh"),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/compare": lambda: compare_strategies(
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/windows": lambda: compare_windows(
                strategy_name=q("strategy", "ma_crossover"),
                num_windows=qi("windows", 3),
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/walk-forward": lambda: run_walk_forward(
                strategy_name=q("strategy", "ma_crossover"),
                num_windows=qi("windows", 3),
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
                cost_preset=q_cost_preset(),
                slippage_bps=q_slippage_bps(),
                dynamic_slippage=q_optional_bool("dynamicSlippage"),
                funding_rate_pct=q_optional_float("fundingRatePct"),
            ),
            "/api/dashboard/backtest/portfolio": lambda: compare_portfolio(
                strategy_name=q("strategy", "ma_crossover"),
                limit=qi("limit", 120),
                stop_loss_pct=qf("stopLoss", 3.0),
                take_profit_pct=qf("takeProfit", 5.0),
            ),
            "/api/dashboard/factor-mine": lambda: run_factor_mining(
                mode=q("mode", "both"),  # type: ignore[arg-type]
                target=q("target", "return"),  # type: ignore[arg-type]
                risk_kind=q("riskKind", "abs_ret"),  # type: ignore[arg-type]
                symbol=q("symbol", "") or None,
                limit=qi("limit", 120),
                horizon=qi("horizon", 1),
                refresh=qb("refresh"),
                gp_generations=qi("gpGenerations", 12),
                gp_population=qi("gpPopulation", 24),
                seed=qi("seed", 42),
                llm_model=q("llmModel", "") or None,
                cost_bps=qf("costBps", 8.0),
                validation_folds=qi("validationFolds", 4),
            ),
        }
        handler = routes.get(path)
        if handler is None:
            return False
        try:
            payload = handler()
            self.send_json(payload, status=200 if payload.get("ok", True) else 500)
        except ValueError as error:
            self.send_json(
                {"ok": False, "error": "insufficient_data", "message": str(error)},
                status=422,
            )
        except Exception as error:  # pragma: no cover
            self.send_json({"ok": False, "message": str(error)}, status=500)
        return True

    def validate_strategy(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
            code = payload.get("code", "")
        except json.JSONDecodeError as error:
            self.send_json({"error": str(error)}, status=400)
            return

        validation = validate_strategy_code(code)
        lookahead = check_lookahead_bias(code)
        compilable = False
        compile_error: str | None = None
        if validation.valid and lookahead.clean:
            try:
                compile_strategy(code)
                compilable = True
            except StrategyCompileError as error:
                compile_error = str(error)

        self.send_json(
            {
                "valid": validation.valid and lookahead.clean,
                "compilable": compilable,
                "compile_error": compile_error,
                "validation": {
                    "valid": validation.valid,
                    "errors": [
                        {
                            "line": item.line,
                            "col": item.col,
                            "rule": item.rule,
                            "message": item.message,
                            "suggestion": item.suggestion,
                        }
                        for item in validation.errors
                    ],
                },
                "lookahead": {
                    "clean": lookahead.clean,
                    "findings": [
                        {
                            "line": item.line,
                            "col": item.col,
                            "rule": item.rule,
                            "severity": item.severity,
                            "message": item.message,
                            "suggestion": item.suggestion,
                        }
                        for item in lookahead.findings
                    ],
                },
                "source": "strategy_engine/dsl",
            },
            status=200,
        )

    def backtest_strategy(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
            code = str(payload.get("code") or "")
            limit = max(30, min(500, int(payload.get("limit") or 120)))
            symbol = str(payload.get("symbol") or "") or None
            strategy_fn = compile_strategy(code)
            lookahead = check_lookahead_bias(code)
            if not lookahead.clean:
                self.send_json({"ok": False, "message": "策略存在前视偏差，禁止执行"}, status=422)
                return
            pair, timeframe, rows, meta = load_candles(symbol=symbol, limit=limit)
            candles = [
                Candle(
                    exchange="sandbox",
                    symbol=pair,
                    timeframe=timeframe,
                    ts=datetime.fromtimestamp(int(row["tsSec"]), tz=timezone.utc),
                    open=Decimal(str(row["open"])),
                    high=Decimal(str(row["high"])),
                    low=Decimal(str(row["low"])),
                    close=Decimal(str(row["close"])),
                    volume=Decimal(str(row["volume"])),
                )
                for row in rows
            ]
            result = BacktestEngine(
                strategy_fn=strategy_fn,
                fee_model=ConstantBpsFee(maker_bps=10, taker_bps=10),
                slippage_model=ConstantBpsSlippage(bps=5),
            ).run(candles, symbol=pair, timeframe=timeframe)
            metrics = result.metrics
            self.send_json({
                "ok": True,
                "engine": "strategy_engine/dsl",
                "symbol": pair,
                "timeframe": timeframe,
                "data_source": meta.get("source"),
                "total_candles": len(candles),
                "metrics": {
                    "total_return_pct": round(metrics.pnl_pct, 4),
                    "max_drawdown_pct": round(metrics.max_drawdown_pct, 4),
                    "sharpe_ratio": round(metrics.sharpe, 4),
                    "sortino_ratio": round(metrics.sortino, 4),
                    "win_rate": round(metrics.win_rate * 100, 2),
                    "total_trades": metrics.total_trades,
                    "final_equity": float(metrics.final_equity),
                },
                "equity_curve": [{"ts": int(ts.timestamp()), "equity": float(value)} for ts, value in result.equity_curve],
                "trades": [{"ts": int(item.ts.timestamp()), "side": item.side, "qty": float(item.qty), "price": float(item.price), "fee": float(item.fee), "realized_pnl": float(item.realized_pnl)} for item in result.trades],
            }, status=200)
        except (ValueError, TypeError, StrategyCompileError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return payload

    def create_knowledge_graph_node(self) -> None:
        try:
            node = dashboard_api.create_web3_graph_node(self.read_json_body())
            self.send_json({"ok": True, "node": node}, status=201)
        except (ValueError, sqlite3.IntegrityError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def update_knowledge_graph_node(self, node_id: str) -> None:
        try:
            node = dashboard_api.update_web3_graph_node(
                node_id, self.read_json_body()
            )
            self.send_json({"ok": True, "node": node}, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except RuntimeError as error:
            self.send_json({"ok": False, "message": str(error)}, status=409)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def create_knowledge_graph_edge(self) -> None:
        try:
            edge = dashboard_api.create_web3_graph_edge(self.read_json_body())
            self.send_json({"ok": True, "edge": edge}, status=201)
        except (ValueError, sqlite3.IntegrityError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def create_knowledge_graph_evidence(self) -> None:
        try:
            evidence = dashboard_api.create_web3_graph_evidence(
                self.read_json_body()
            )
            self.send_json({"ok": True, "evidence": evidence}, status=201)
        except (ValueError, sqlite3.IntegrityError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def run_knowledge_graph_ingestion(self) -> None:
        try:
            payload = self.read_json_body()
            result = dashboard_api.run_web3_graph_ingestion(
                refresh=bool(payload.get("refresh", True)),
                use_llm=bool(payload.get("use_llm", True)),
                model=str(payload.get("model") or "") or None,
            )
            self.send_json(result, status=200)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def review_knowledge_graph_candidate(self, candidate_id: str) -> None:
        try:
            result = dashboard_api.review_web3_graph_candidate(
                candidate_id, self.read_json_body()
            )
            self.send_json(result, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except RuntimeError as error:
            self.send_json({"ok": False, "message": str(error)}, status=409)
        except (ValueError, sqlite3.IntegrityError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def create_strategy_asset(self) -> None:
        try:
            strategy = STRATEGY_LAB.create_strategy(self.read_json_body())
            self.send_json({"ok": True, "strategy": strategy}, status=201)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def create_strategy_version(self, strategy_id: str) -> None:
        try:
            version = STRATEGY_LAB.create_version(strategy_id, self.read_json_body())
            self.send_json({"ok": True, "version": version}, status=201)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def propose_strategy_asset(self) -> None:
        try:
            payload = self.read_json_body()
            proposal = propose_strategy(
                objective=str(payload.get("objective") or "").strip(),
                symbol=str(payload.get("symbol") or "BTC-USDT"),
                risk_profile=str(payload.get("risk_profile") or payload.get("riskProfile") or "balanced"),
                model=str(payload.get("model") or "") or None,
            )
            self.send_json({"ok": True, "proposal": proposal}, status=200)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def explain_strategy_asset(self) -> None:
        try:
            payload = self.read_json_body()
            result = explain_strategy(payload.get("spec") or {}, model=payload.get("model"))
            trace = STRATEGY_LAB.record_llm_trace(task="explain", input_payload=payload, output_payload=result, version_id=payload.get("strategy_version_id"), model=result.get("model"))
            self.send_json({"ok": True, "explanation": result, "trace": trace}, status=200)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def repair_strategy_asset(self) -> None:
        try:
            payload = self.read_json_body()
            result = repair_strategy(str(payload.get("code") or ""), error_context=str(payload.get("error_context") or ""), model=payload.get("model"), max_attempts=int(payload.get("max_attempts") or 3))
            trace = STRATEGY_LAB.record_llm_trace(task="repair", input_payload={key: value for key, value in payload.items() if key != "code"}, output_payload=result, version_id=payload.get("strategy_version_id"), model=payload.get("model"))
            self.send_json({"ok": bool(result.get("ok")), "repair": result, "trace": trace}, status=200 if result.get("ok") else 422)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def diagnose_strategy_experiment(self) -> None:
        try:
            payload = self.read_json_body()
            experiment = STRATEGY_LAB.get_experiment(str(payload.get("experiment_id") or ""))
            result = diagnose_experiment(experiment.get("result") or {}, model=payload.get("model"))
            trace = STRATEGY_LAB.record_llm_trace(task="diagnose", input_payload={"experiment_id": experiment["id"]}, output_payload=result, version_id=experiment.get("strategy_version_id"), model=result.get("model"))
            self.send_json({"ok": True, "diagnosis": result, "trace": trace}, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def create_strategy_experiment(self) -> None:
        try:
            payload = self.read_json_body()
            version_id = str(payload.get("strategy_version_id") or payload.get("strategyVersionId") or "")
            experiment = STRATEGY_EXPERIMENTS.submit(version_id, payload)
            self.send_json({"ok": True, "experiment": experiment}, status=202)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def cancel_strategy_experiment(self, experiment_id: str) -> None:
        try:
            self.send_json({"ok": True, "experiment": STRATEGY_LAB.request_cancel(experiment_id)}, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)

    def promote_strategy_version(self, version_id: str) -> None:
        try:
            payload = self.read_json_body()
            version = STRATEGY_LAB.promote_version(version_id, to_status=str(payload.get("to_status") or payload.get("toStatus") or ""), reason=str(payload.get("reason") or ""), actor=str(payload.get("actor") or "human"))
            self.send_json({"ok": True, "version": version, "audit": STRATEGY_LAB.list_audit(version_id)}, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def start_strategy_paper_run(self, version_id: str) -> None:
        try:
            payload = self.read_json_body()
            self.send_json({"ok": True, "paper_run": STRATEGY_LAB.start_paper_run(version_id, str(payload.get("notes") or ""))}, status=201)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def stop_strategy_paper_run(self, run_id: str) -> None:
        try:
            payload = self.read_json_body()
            self.send_json({"ok": True, "paper_run": STRATEGY_LAB.stop_paper_run(run_id, str(payload.get("notes") or ""))}, status=200)
        except KeyError as error:
            self.send_json({"ok": False, "message": str(error)}, status=404)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "message": str(error)}, status=422)

    def factor_mine_backtest(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as error:
            self.send_json({"ok": False, "message": str(error)}, status=400)
            return

        spec = payload.get("backtest_spec") or payload.get("backtestSpec")
        if not spec:
            self.send_json({"ok": False, "message": "缺少 backtest_spec"}, status=400)
            return

        try:
            result = run_mined_factor_backtest(
                backtest_spec=spec,
                symbol=payload.get("symbol") or None,
                limit=int(payload.get("limit") or 120),
                stop_loss_pct=float(payload.get("stopLoss") or payload.get("stop_loss_pct") or 3.0),
                take_profit_pct=float(payload.get("takeProfit") or payload.get("take_profit_pct") or 5.0),
                trailing_stop_pct=float(payload.get("trailingStop") or payload.get("trailing_stop_pct") or 0.0),
                max_hold_bars=int(payload.get("maxHoldBars") or payload.get("max_hold_bars") or 0),
                refresh=bool(payload.get("refresh")),
                entry_threshold=float(payload.get("entryThreshold") or payload.get("entry_threshold") or 0.5),
            )
            self.send_json(result, status=200 if result.get("ok", True) else 500)
        except ValueError as error:
            self.send_json(
                {"ok": False, "error": "insufficient_data", "message": str(error)},
                status=422,
            )
        except Exception as error:  # pragma: no cover
            self.send_json({"ok": False, "message": str(error)}, status=500)

    def send_json(self, payload: dict, *, status: int) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type: str) -> None:
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        print(f"[{self.log_date_time_string()}] {self.address_string()} {message}", flush=True)


if __name__ == "__main__":
    assert_port_available(HOST, PORT)
    server = SandboxHTTPServer((HOST, PORT), Handler)
    from dashboard.graph_scheduler import GRAPH_SCHEDULER

    GRAPH_SCHEDULER.start()
    print(f"Web3 research sandbox: http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.", flush=True)
    finally:
        GRAPH_SCHEDULER.stop()
