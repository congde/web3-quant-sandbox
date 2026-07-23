from __future__ import annotations

import importlib.util
import socket
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_app_module():
    spec = importlib.util.spec_from_file_location("sandbox_app", ROOT / "app.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def app_module():
    return _load_app_module()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture
def server(app_module):
    port = _free_port()
    httpd = app_module.SandboxHTTPServer(("127.0.0.1", port), app_module.Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)


def test_spa_route_serves_index_html(server: str) -> None:
    with urllib.request.urlopen(f"{server}/trading") as response:
        body = response.read().decode("utf-8")
    assert response.status == 200
    assert 'id="root"' in body
    assert "<!doctype html>" in body.lower()


def test_dashboard_alias_serves_index_html(server: str) -> None:
    with urllib.request.urlopen(f"{server}/dashboard") as response:
        body = response.read().decode("utf-8")
    assert response.status == 200
    assert 'id="root"' in body


def test_kline_analysis_api(server: str) -> None:
    import json

    with urllib.request.urlopen(f"{server}/api/market/kline-analysis?symbol=BTC-USDT&type=1day&limit=60") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("candles")


def test_signal_analysis_api(server: str) -> None:
    import json

    with urllib.request.urlopen(f"{server}/api/dashboard/signal-analysis?symbol=BTC") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("logicFlow")


def test_llm_signal_submit_returns_task(server: str) -> None:
    import json

    with urllib.request.urlopen(
        f"{server}/api/dashboard/llm-signal-analysis?symbol=BTC&model=deepseek/deepseek-v4-pro"
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("taskId") or payload.get("signal")


def test_backtest_api_exposes_simulation_result(server: str) -> None:
    import json

    with urllib.request.urlopen(
        f"{server}/api/dashboard/backtest?strategy=ma_crossover&limit=120&costPreset=realistic"
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("engine") == "web3-trading/rolling-window"
    assert payload.get("cost_preset") == "realistic"
    assert payload.get("strategy")
    assert "total_return_pct" in payload
    assert "max_drawdown_pct" in payload
    assert "total_trades" in payload
    assert "trades" in payload


def test_investment_gate_api_exposes_research_promotion(server: str) -> None:
    import json

    with urllib.request.urlopen(
        f"{server}/api/dashboard/backtest/investment-gate"
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload["decision"] == "PROMOTE_RESEARCH"
    assert payload["passed"] is True
    assert payload["live_trading_authorized"] is False
    assert payload["forward_validation"]["status"] == "WAITING_FOR_DATA"
    assert payload["forward_validation"]["decision"] == "HOLD"
    assert all(gate["passed"] for gate in payload["gates"])


def test_dsl_strategy_backtest_executes_validated_code(server: str) -> None:
    import json

    code = """from ai_trading.api import market_buy, market_sell

def on_tick(ctx, candle):
    position = ctx.position()
    if len(ctx.history) == 2 and position.qty == 0:
        return market_buy(ctx.symbol, 0.1)
    if len(ctx.history) == 8 and position.qty > 0:
        return market_sell(ctx.symbol, position.qty)
    return None
"""
    request = urllib.request.Request(
        f"{server}/api/strategy/backtest",
        data=json.dumps({"code": code, "limit": 60}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload["ok"] is True
    assert payload["engine"] == "strategy_engine/dsl"
    assert payload["metrics"]["total_trades"] == 2
    assert len(payload["equity_curve"]) == 60


def test_backtest_robustness_api_exposes_audit_fields(server: str) -> None:
    import json

    with urllib.request.urlopen(
        f"{server}/api/dashboard/backtest/robustness?strategy=ma_crossover&symbol=WEB3-DEMO%2FUSDT&limit=120"
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("symbol") == "WEB3-DEMO/USDT"
    assert "pbo" in payload
    assert "parameter_sensitivity" in payload
    assert "verdict" in payload


def test_backtest_cpcv_api_exposes_audit_fields(server: str) -> None:
    import json

    with urllib.request.urlopen(
        f"{server}/api/dashboard/backtest/cpcv?strategy=ma_crossover&symbol=WEB3-DEMO%2FUSDT&limit=120"
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("symbol") == "WEB3-DEMO/USDT"
    assert "sharpe_p50" in payload["cpcv"]
    assert "profitable_paths_pct" in payload["cpcv"]
    assert "verdict" in payload["cpcv"]


def test_missing_asset_still_404(server: str) -> None:
    with pytest.raises(urllib.error.HTTPError) as exc:
        urllib.request.urlopen(f"{server}/assets/missing.js")
    assert exc.value.code == 404


def test_research_draft_gate_api(server: str) -> None:
    import json

    with urllib.request.urlopen(f"{server}/api/dashboard/research-draft-gate?maxAgeHours=24") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload.get("ok") is True
    assert payload.get("draft_status") == "draft_only"
    assert payload.get("human_review_required") is True
    assert payload.get("datasets")

def test_research_draft_api(server: str) -> None:
    import json

    with urllib.request.urlopen(f"{server}/api/dashboard/research-draft?symbol=BTC&type=1hour") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload["ok"] is True
    assert payload["draft_status"] == "draft_only"
    assert payload["human_review_required"] is True
    assert payload["sections"]
    assert "place live orders" in payload["prohibited_actions"]


@pytest.mark.parametrize(
    ("path", "collection"),
    [
        ("/api/dashboard/web3/themes", "themes"),
        ("/api/dashboard/web3/macro", "cards"),
        ("/api/dashboard/web3/knowledge-graph", "nodes"),
    ],
)
def test_web3_intelligence_api_is_strictly_scoped(server: str, path: str, collection: str) -> None:
    import json

    with urllib.request.urlopen(f"{server}{path}") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert response.status == 200
    assert payload["ok"] is True
    assert payload["scope"] == "web3-only"
    assert payload[collection]
