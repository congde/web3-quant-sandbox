from __future__ import annotations

import os
from typing import Any, Callable

from config.env import load_env
from dashboard import api as dashboard_api
from dashboard.catalog import completeness_detail, offline_status
from dashboard.full_datasets import (
    fetch_full_dex_trending,
    fetch_full_kucoin_markets,
    fetch_full_market_candles,
    fetch_full_market_tickers,
    fetch_full_opportunity_scan,
    fetch_full_valuescan_global,
    fetch_full_valuescan_token,
)
from dashboard.normalize import normalize_ai_picks
from dashboard.snapshot import list_snapshots, load_offline, save_snapshot
from dashboard.upstream import upstream_available
from dashboard import valuescan


Fetcher = Callable[[], dict[str, Any]]

def _ai_picks_from_opportunity_scan(payload: dict[str, Any]) -> dict[str, Any]:
    opportunities = payload.get("opportunities") or []
    chance: list[dict[str, Any]] = []
    for item in opportunities[:8]:
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol") or "").strip().upper()
        if not symbol:
            continue
        score = item.get("score")
        confidence = item.get("confidence")
        change24h = item.get("change24h")
        chance.append(
            {
                "symbol": symbol,
                "name": item.get("name") or symbol,
                "title": item.get("label") or item.get("signal") or "市场机会",
                "summary": f"机会扫描派生 · 24h {change24h if change24h is not None else '-'}% · 置信度 {confidence if confidence is not None else '-'}",
                "score": score,
                "confidence": confidence,
                "percentChange24h": change24h,
                "volume24h": item.get("volume24h"),
                "rank": item.get("rank"),
                "signal": item.get("signal"),
                "source": "opportunity_scan",
            }
        )
    return {
        "ok": True,
        "source": "derived:opportunity_scan",
        "chance": chance,
        "risk": [],
        "funds": [],
        "derived_from": "opportunity_scan",
    }



def _fetch_ai_picks_full() -> dict[str, Any]:
    if valuescan.configured():
        payload = normalize_ai_picks(valuescan.get_ai_picks())
        if completeness_detail("ai_picks", payload)["complete"]:
            return payload
        return normalize_ai_picks(_ai_picks_from_opportunity_scan(fetch_full_opportunity_scan()))
    return dashboard_api.ai_picks()
def _resolve(name: str, fetcher: Fetcher) -> tuple[dict[str, Any], str]:
    payload = fetcher()
    origin = str(payload.get("source") or "live")
    if payload.get("ok") is False:
        raise RuntimeError(str(payload.get("message") or f"{name} fetch failed"))
    return payload, origin


def refresh_all(*, save: bool = True, data_mode: str = "auto") -> dict[str, Any]:
    """Fetch dashboard payloads (upstream → live) and optionally persist snapshots."""
    load_env()
    previous_mode = os.environ.get("DASHBOARD_DATA_MODE")
    os.environ["DASHBOARD_DATA_MODE"] = data_mode

    def _fetcher(name: str, live_fetcher: Fetcher) -> Fetcher:
        if data_mode == "offline":
            return lambda: load_offline(name)
        return live_fetcher

    jobs: list[tuple[str, Fetcher]] = [
        ("ai_picks", _fetcher("ai_picks", _fetch_ai_picks_full)),
        ("sector_fund", _fetcher("sector_fund", lambda: dashboard_api.sector_fund(1))),
        ("token_fund", _fetcher("token_fund", lambda: dashboard_api.token_fund("BTC"))),
        ("onchain", _fetcher("onchain", lambda: dashboard_api.onchain("BTC"))),
        ("dex_trending", _fetcher("dex_trending", lambda: fetch_full_dex_trending(chain="solana"))),
        ("market_tickers", _fetcher("market_tickers", lambda: fetch_full_market_tickers())),
        ("kucoin_markets", _fetcher("kucoin_markets", fetch_full_kucoin_markets)),
        ("web3_news", _fetcher("web3_news", lambda: dashboard_api.web3_news(limit=50, refresh=True))),
        ("opportunity_scan", _fetcher("opportunity_scan", fetch_full_opportunity_scan)),
        ("market_candles", _fetcher("market_candles", lambda: fetch_full_market_candles())),
    ]
    if valuescan.configured() and data_mode != "offline":
        jobs.extend(
            [
                ("valuescan_global", fetch_full_valuescan_global),
                ("valuescan_token_full", lambda: fetch_full_valuescan_token("BTC")),
            ]
        )

    saved: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    try:
        for name, fetcher in jobs:
            try:
                payload, origin = _resolve(name, fetcher)
                detail = completeness_detail(name, payload)
                if save:
                    path = save_snapshot(name, payload, origin=origin)
                    saved.append(
                        {
                            "name": name,
                            "path": str(path),
                            "origin": origin,
                            "complete": detail["complete"],
                            "reason": detail.get("reason") or "",
                        }
                    )
                else:
                    saved.append(
                        {
                            "name": name,
                            "origin": origin,
                            "complete": detail["complete"],
                            "reason": detail.get("reason") or "",
                        }
                    )
            except Exception as exc:
                errors.append({"name": name, "error": str(exc)})
    finally:
        if previous_mode is None:
            os.environ.pop("DASHBOARD_DATA_MODE", None)
        else:
            os.environ["DASHBOARD_DATA_MODE"] = previous_mode

    status = offline_status()
    return {
        "ok": len(errors) == 0,
        "data_mode": data_mode,
        "upstream_available": upstream_available(),
        "saved": saved,
        "errors": errors,
        "snapshots": list_snapshots(),
        "offline": status,
    }
