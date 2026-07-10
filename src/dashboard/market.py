from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote

from dashboard.http_client import http_get
from dashboard.kline_curve import candles_to_curve

FEAR_GREED_API = os.environ.get(
    "FEAR_GREED_API",
    "https://api.alternative.me/fng/",
)
KUCOIN_API_BASE = os.environ.get("KUCOIN_PUBLIC_API_BASE", "https://api.kucoin.com").rstrip("/")
BINANCE_API_BASE = os.environ.get("BINANCE_PUBLIC_API_BASE", "https://api.binance.com").rstrip("/")
MARKET_PROVIDER = os.environ.get("DASHBOARD_MARKET_PROVIDER", "kucoin").strip().lower()


def refresh_bases() -> None:
    global FEAR_GREED_API, KUCOIN_API_BASE, BINANCE_API_BASE, MARKET_PROVIDER
    FEAR_GREED_API = os.environ.get("FEAR_GREED_API", "https://api.alternative.me/fng/")
    KUCOIN_API_BASE = os.environ.get("KUCOIN_PUBLIC_API_BASE", "https://api.kucoin.com").rstrip("/")
    BINANCE_API_BASE = os.environ.get("BINANCE_PUBLIC_API_BASE", "https://api.binance.com").rstrip("/")
    MARKET_PROVIDER = os.environ.get("DASHBOARD_MARKET_PROVIDER", "kucoin").strip().lower()


def market_provider() -> str:
    refresh_bases()
    return "binance" if MARKET_PROVIDER == "binance" else "kucoin"


def _binance_headers() -> dict[str, str]:
    api_key = os.environ.get("BINANCE_API_KEY", "").strip()
    return {"X-MBX-APIKEY": api_key} if api_key else {}


def _to_binance_symbol(symbol: str, quote_asset: str = "USDT") -> str:
    pair = (symbol or "").strip().upper()
    if not pair:
        return f"BTC{quote_asset.upper()}"
    if "-" in pair:
        base, quote_part = pair.split("-", 1)
        return f"{base}{quote_part}"
    return pair


def _from_binance_symbol(symbol: str, quote_asset: str = "USDT") -> str:
    upper = str(symbol or "").upper()
    quote_upper = quote_asset.upper()
    if upper.endswith(quote_upper) and len(upper) > len(quote_upper):
        return f"{upper[:-len(quote_upper)]}-{quote_upper}"
    return upper


def _to_binance_interval(kline_type: str) -> str:
    mapping = {
        "1min": "1m",
        "5min": "5m",
        "15min": "15m",
        "30min": "30m",
        "1hour": "1h",
        "4hour": "4h",
        "1day": "1d",
        "1week": "1w",
    }
    return mapping.get(kline_type, kline_type)


def normalize_candle(row: list[Any]) -> dict[str, Any] | None:
    if not row or len(row) < 6:
        return None
    try:
        ts_sec = int(float(row[0]))
        return {
            "tsSec": ts_sec,
            "date": _ts_to_date(ts_sec),
            "open": float(row[1]),
            "close": float(row[2]),
            "high": float(row[3]),
            "low": float(row[4]),
            "volume": float(row[5]),
        }
    except IndexError:
        return None
    except (ValueError, TypeError):
        return None


def _ts_to_date(ts_sec: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ts_sec, tz=timezone.utc).strftime("%Y-%m-%d")


def fetch_fear_greed_index() -> dict[str, Any]:
    refresh_bases()
    try:
        data = http_get(f"{FEAR_GREED_API}?limit=2&format=json", timeout=8)
        items = (data or {}).get("data") or []
        if not items:
            return {}
        today = items[0]
        yesterday = items[1] if len(items) > 1 else {}
        value = int(today.get("value", 50))
        yesterday_val = int(yesterday.get("value", 0)) if yesterday else None
        return {
            "value": value,
            "label": today.get("value_classification", ""),
            "yesterday": yesterday_val,
            "change": value - yesterday_val if yesterday_val is not None else None,
            "timestamp": today.get("timestamp"),
        }
    except RuntimeError:
        return {}


def fetch_onchain(symbol: str = "BTC", *, limit: int = 1) -> dict[str, Any]:
    refresh_bases()
    _ = limit
    fear = fetch_fear_greed_index()
    return {
        "ok": True,
        "source": "live",
        "symbol": (symbol or "BTC").strip().upper(),
        "marketSentiment": {"fearGreed": fear},
        "valuescanChain": {},
    }


_NUMERIC_TICKER_KEYS = (
    "last",
    "buy",
    "sell",
    "changeRate",
    "changePrice",
    "high",
    "low",
    "vol",
    "volValue",
    "averagePrice",
    "takerFeeRate",
    "makerFeeRate",
    "takerCoefficient",
    "makerCoefficient",
)


def _normalize_ticker_row(item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    for key in _NUMERIC_TICKER_KEYS:
        if key in row and row[key] not in (None, ""):
            try:
                row[key] = float(row[key])
            except (TypeError, ValueError):
                pass
    return row


def _normalize_binance_ticker_row(item: dict[str, Any], *, quote: str = "USDT") -> dict[str, Any]:
    symbol = _from_binance_symbol(str(item.get("symbol", "")), quote)

    def _num(key: str, default: float = 0.0) -> float:
        try:
            return float(item.get(key, default))
        except (TypeError, ValueError):
            return default

    return {
        "symbol": symbol,
        "last": _num("lastPrice"),
        "buy": _num("bidPrice"),
        "sell": _num("askPrice"),
        "changeRate": _num("priceChangePercent") / 100,
        "changePrice": _num("priceChange"),
        "high": _num("highPrice"),
        "low": _num("lowPrice"),
        "vol": _num("volume"),
        "volValue": _num("quoteVolume"),
        "averagePrice": _num("weightedAvgPrice"),
        "providerSymbol": str(item.get("symbol", "")),
    }


def fetch_kucoin_markets() -> dict[str, Any]:
    refresh_bases()
    data = http_get(f"{KUCOIN_API_BASE}/api/v1/markets", timeout=15)
    if data.get("code") not in (None, "200000"):
        raise RuntimeError(data.get("msg", "KuCoin markets error"))
    markets = data.get("data") or []
    if not isinstance(markets, list):
        markets = []
    return {
        "ok": True,
        "source": "live",
        "provider": "kucoin",
        "full": True,
        "count": len(markets),
        "markets": markets,
    }


def fetch_binance_exchange_info() -> dict[str, Any]:
    refresh_bases()
    data = http_get(f"{BINANCE_API_BASE}/api/v3/exchangeInfo", headers=_binance_headers(), timeout=15)
    symbols = data.get("symbols") or []
    if not isinstance(symbols, list):
        symbols = []
    markets = [
        {
            "symbol": _from_binance_symbol(str(item.get("symbol", "")), str(item.get("quoteAsset") or "USDT")),
            "baseCurrency": item.get("baseAsset"),
            "quoteCurrency": item.get("quoteAsset"),
            "enableTrading": item.get("status") == "TRADING",
            "providerSymbol": item.get("symbol"),
        }
        for item in symbols
        if isinstance(item, dict)
    ]
    return {
        "ok": True,
        "source": "live",
        "provider": "binance",
        "full": True,
        "count": len(markets),
        "markets": markets,
    }


def fetch_exchange_markets() -> dict[str, Any]:
    return fetch_binance_exchange_info() if market_provider() == "binance" else fetch_kucoin_markets()


def fetch_ticker_stats(symbol: str = "BTC-USDT") -> dict[str, Any]:
    refresh_bases()
    pair = symbol.strip().upper()
    if "-" not in pair:
        pair = f"{pair}-USDT"
    if market_provider() == "binance":
        provider_symbol = _to_binance_symbol(pair)
        data = http_get(
            f"{BINANCE_API_BASE}/api/v3/ticker/24hr?symbol={quote(provider_symbol)}",
            headers=_binance_headers(),
            timeout=10,
        )
        if not isinstance(data, dict) or not data.get("symbol"):
            raise RuntimeError("Binance stats payload invalid")
        row = _normalize_binance_ticker_row(data)
        return {"ok": True, "source": "live", "provider": "binance", "symbol": pair, "ticker": row}

    data = http_get(f"{KUCOIN_API_BASE}/api/v1/market/stats?symbol={quote(pair)}", timeout=10)
    if data.get("code") not in (None, "200000"):
        raise RuntimeError(data.get("msg", "KuCoin stats error"))
    raw = data.get("data") or {}
    if not isinstance(raw, dict):
        raise RuntimeError("KuCoin stats payload invalid")
    row = _normalize_ticker_row({**raw, "symbol": pair})
    return {"ok": True, "source": "live", "provider": "kucoin", "symbol": pair, "ticker": row}


def fetch_market_tickers(*, quote: str = "USDT", limit: int | None = None) -> dict[str, Any]:
    refresh_bases()
    quote_upper = quote.upper()
    if market_provider() == "binance":
        data = http_get(f"{BINANCE_API_BASE}/api/v3/ticker/24hr", headers=_binance_headers(), timeout=15)
        raw = data if isinstance(data, list) else []
        tickers = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", ""))
            if not symbol.endswith(quote_upper):
                continue
            tickers.append(_normalize_binance_ticker_row(item, quote=quote_upper))
            if limit is not None and len(tickers) >= limit:
                break
        body: dict[str, Any] = {
            "ok": True,
            "source": "live",
            "provider": "binance",
            "quote": quote_upper,
            "count": len(tickers),
            "tickers": tickers,
        }
        if limit is None:
            body["full"] = True
        return body

    data = http_get(f"{KUCOIN_API_BASE}/api/v1/market/allTickers", timeout=15)
    if data.get("code") not in (None, "200000"):
        raise RuntimeError(data.get("msg", "KuCoin API error"))
    raw = ((data.get("data") or {}).get("ticker") or [])
    tickers = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol", ""))
        if not symbol.endswith(f"-{quote_upper}"):
            continue
        tickers.append(_normalize_ticker_row(item))
        if limit is not None and len(tickers) >= limit:
            break
    body = {
        "ok": True,
        "source": "live",
        "provider": "kucoin",
        "quote": quote_upper,
        "count": len(tickers),
        "tickers": tickers,
    }
    if limit is None:
        body["full"] = True
    return body


def fetch_candles(
    symbol: str = "BTC-USDT",
    *,
    kline_type: str = "1day",
    limit: int | None = 120,
) -> dict[str, Any]:
    refresh_bases()
    pair = symbol.strip().upper()
    if "-" not in pair:
        pair = f"{pair}-USDT"

    if market_provider() == "binance":
        params = (
            f"symbol={quote(_to_binance_symbol(pair))}"
            f"&interval={quote(_to_binance_interval(kline_type))}"
        )
        if limit is not None and limit > 0:
            params = f"{params}&limit={min(limit, 1000)}"
        data = http_get(f"{BINANCE_API_BASE}/api/v3/klines?{params}", headers=_binance_headers(), timeout=15)
        raw = data if isinstance(data, list) else []
        candles = []
        for row in raw:
            if not isinstance(row, list) or len(row) < 6:
                continue
            try:
                ts_sec = int(float(row[0]) / 1000)
                candles.append(
                    {
                        "tsSec": ts_sec,
                        "date": _ts_to_date(ts_sec),
                        "open": float(row[1]),
                        "high": float(row[2]),
                        "low": float(row[3]),
                        "close": float(row[4]),
                        "volume": float(row[5]),
                    }
                )
            except (TypeError, ValueError):
                continue
        candles.sort(key=lambda item: item["tsSec"])
        if limit is not None and limit > 0:
            candles = candles[-limit:]
        body: dict[str, Any] = {
            "ok": True,
            "source": "live",
            "provider": "binance",
            "symbol": pair,
            "type": kline_type,
            "candles": candles,
        }
        if limit is None:
            body["full"] = True
        return body

    url = (
        f"{KUCOIN_API_BASE}/api/v1/market/candles?"
        f"symbol={quote(pair)}&type={quote(kline_type)}"
    )
    data = http_get(url, timeout=15)
    if data.get("code") not in (None, "200000"):
        raise RuntimeError(data.get("msg", "KuCoin candles error"))
    raw = data.get("data") or []
    candles = [item for row in raw if (item := normalize_candle(row))]
    candles.sort(key=lambda item: item["tsSec"])
    if limit is not None and limit > 0:
        candles = candles[-limit:]
    body = {
        "ok": True,
        "source": "live",
        "provider": "kucoin",
        "symbol": pair,
        "type": kline_type,
        "candles": candles,
    }
    if limit is None:
        body["full"] = True
    return body
