from __future__ import annotations

from dashboard import market


def test_binance_ticker_normalization(monkeypatch) -> None:
    monkeypatch.setenv("DASHBOARD_MARKET_PROVIDER", "binance")
    raw = {
        "symbol": "BTCUSDT",
        "lastPrice": "65000.5",
        "bidPrice": "64999.1",
        "askPrice": "65001.2",
        "priceChangePercent": "2.5",
        "priceChange": "1585.2",
        "highPrice": "66000",
        "lowPrice": "63000",
        "volume": "123.4",
        "quoteVolume": "8000000",
        "weightedAvgPrice": "64800",
    }

    row = market._normalize_binance_ticker_row(raw)

    assert market.market_provider() == "binance"
    assert row["symbol"] == "BTC-USDT"
    assert row["last"] == 65000.5
    assert row["changeRate"] == 0.025
    assert row["volValue"] == 8000000.0


def test_binance_interval_and_symbol_helpers() -> None:
    assert market._to_binance_symbol("ETH-USDT") == "ETHUSDT"
    assert market._from_binance_symbol("ETHUSDT") == "ETH-USDT"
    assert market._to_binance_interval("1day") == "1d"
