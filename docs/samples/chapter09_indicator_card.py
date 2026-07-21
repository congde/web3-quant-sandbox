import json
import sys
from pathlib import Path

from dashboard.kline_analysis import analyze_candles, kline_verdict


path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/dashboard/market_candles.json")
payload = json.loads(path.read_text(encoding="utf-8"))
candles = sorted(payload["candles"], key=lambda row: int(row["tsSec"]))

analysis = analyze_candles(candles)
verdict = kline_verdict(analysis)

card = {
    "input": {
        "symbol": payload["symbol"],
        "type": payload["type"],
        "source": payload["source"],
        "count": len(candles),
        "start": candles[0]["date"],
        "end": candles[-1]["date"],
    },
    "readings": {
        "close": analysis["close"],
        "sma20": round(analysis["sma20"], 2),
        "sma60": analysis["sma60"],
        "rsi14": analysis["rsi"],
        "bbPctB": analysis["bbPctB"],
        "bbWidth": analysis["bbWidth"],
        "atr14": analysis["atr"],
        "atrPct": analysis["atrPct"],
    },
    "label": verdict["actionLabel"],
    "reasons": verdict["reasons"],
    "allowed": "描述固定样本中的趋势、动量、位置和波动状态",
    "forbidden": "生成买入、卖出、仓位或止损建议",
}

print(json.dumps(card, ensure_ascii=False, indent=2))
