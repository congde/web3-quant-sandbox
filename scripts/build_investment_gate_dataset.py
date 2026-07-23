"""Build the fixed multi-asset dataset used by the investment strategy gate.

The output is deliberately checked into ``data/investment_gate`` so that the
acceptance decision is reproducible and does not depend on a live API during
normal verification.  Re-running this script refreshes the snapshot from the
public Binance spot-market kline endpoint.
"""

from __future__ import annotations

import csv
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "data" / "investment_gate"
BASE_URL = "https://api.binance.com/api/v3/klines"
SYMBOLS = ("BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT")
INTERVAL = "1d"
LIMIT = 1000


def fetch_klines(symbol: str) -> list[list[object]]:
    # Pin the request to the last fully closed UTC day. The live daily candle
    # is incomplete and must never enter an acceptance result.
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_of_today_ms = now_ms - now_ms % 86_400_000
    query = urllib.parse.urlencode(
        {
            "symbol": symbol,
            "interval": INTERVAL,
            "limit": LIMIT,
            "endTime": start_of_today_ms - 1,
        }
    )
    request = urllib.request.Request(
        f"{BASE_URL}?{query}",
        headers={"User-Agent": "web3-quant-sandbox/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, list) or not payload:
        raise RuntimeError(f"Binance returned no candles for {symbol}")
    return payload


def write_symbol(symbol: str, rows: list[list[object]]) -> dict[str, object]:
    target = OUTPUT_DIR / f"{symbol}.csv"
    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "open_time_ms",
                "date",
                "open",
                "high",
                "low",
                "close",
                "volume",
                "quote_volume",
                "trades",
            ]
        )
        for row in rows:
            opened = datetime.fromtimestamp(int(row[0]) / 1000, tz=timezone.utc)
            writer.writerow(
                [
                    int(row[0]),
                    opened.strftime("%Y-%m-%d"),
                    row[1],
                    row[2],
                    row[3],
                    row[4],
                    row[5],
                    row[7],
                    row[8],
                ]
            )
    return {
        "symbol": symbol,
        "rows": len(rows),
        "first_open_time_ms": int(rows[0][0]),
        "last_open_time_ms": int(rows[-1][0]),
        "file": target.relative_to(ROOT).as_posix(),
    }


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    datasets = []
    for index, symbol in enumerate(SYMBOLS):
        if index:
            time.sleep(0.2)
        datasets.append(write_symbol(symbol, fetch_klines(symbol)))

    manifest = {
        "source": BASE_URL,
        "source_name": "Binance spot klines",
        "interval": INTERVAL,
        "timezone": "UTC",
        "requested_limit": LIMIT,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "datasets": datasets,
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
