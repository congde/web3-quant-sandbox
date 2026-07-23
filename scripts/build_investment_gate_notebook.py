"""Generate and execute the investment-gate validation notebook."""

from __future__ import annotations

import json
from pathlib import Path

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[1]
CERTIFICATE = ROOT / "data" / "investment_gate" / "acceptance_certificate.json"
TARGET = ROOT / "docs" / "samples" / "investment-gate-validation.ipynb"


def main() -> int:
    certificate = json.loads(CERTIFICATE.read_text(encoding="utf-8"))
    portfolio = certificate["evaluation"]["portfolio"]
    notebook = nbformat.v4.new_notebook(
        metadata={
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3"},
        }
    )
    notebook.cells = [
        nbformat.v4.new_markdown_cell(
            f"""## tl;dr

The fixed `regime_trend` portfolio received **{certificate["decision"]}** for
research use. On the locked {certificate["evaluation"]["holdout"]["bars"]}-bar
holdout it returned **{portfolio["total_return_pct"]:.2f}%**, with Sharpe
**{portfolio["sharpe_ratio"]:.2f}** and maximum drawdown
**{portfolio["max_drawdown_pct"]:.2f}%**. Forward status is
**{certificate["forward_validation"]["status"]}**; this is not live-trading
approval.
"""
        ),
        nbformat.v4.new_markdown_cell(
            """## Context & Methods

This notebook independently reloads the fixed certificate, reruns the gate from
the checked-in Binance daily snapshots, and checks that the headline metrics and
all hard gates reconcile.

### Key Assumptions

- Five USDT markets use inverse-volatility budgets estimated from the prior
  60 completed daily returns, rebalanced every seven bars.
- Portfolio volatility is targeted at 20% annualized with a 100% gross cap;
  allocation changes incur 0.05% turnover cost.
- The last 365 completed UTC daily bars are the locked holdout.
- Commission, fixed/dynamic slippage, adverse funding scenarios, and parameter
  neighbours are included.
- Promotion means research acceptance only; live execution remains prohibited.
- The v1.1 contract is fingerprinted and needs 90 new completed daily bars after
  its frozen cutoff before it can request human review.
"""
        ),
        nbformat.v4.new_code_cell(
            """from pathlib import Path
import json
import sys

ROOT = Path.cwd()
sys.path.insert(0, str(ROOT / "src"))
from backtest.investment_gate import (
    CERTIFICATE_PATH,
    evaluate_investment_gate,
    validate_gate_data,
)
saved = json.loads(CERTIFICATE_PATH.read_text(encoding="utf-8"))
"""
        ),
        nbformat.v4.new_markdown_cell("## Data"),
        nbformat.v4.new_code_cell(
            """quality = validate_gate_data()
print("data quality:", "PASS" if quality["passed"] else "FAIL")
for row in quality["datasets"]:
    print(
        row["symbol"],
        row["rows"],
        row["first_date"],
        row["last_date"],
        row["sha256"][:12],
    )
"""
        ),
        nbformat.v4.new_markdown_cell("## Results"),
        nbformat.v4.new_code_cell(
            """fresh = evaluate_investment_gate()
headline_fields = (
    "total_return_pct",
    "sharpe_ratio",
    "sortino_ratio",
    "max_drawdown_pct",
    "annualized_volatility_pct",
    "average_gross_exposure",
    "max_gross_exposure",
    "allocation_turnover",
    "median_asset_return_pct",
    "profitable_assets",
)
saved_headline = saved["evaluation"]["portfolio"]
fresh_headline = fresh["evaluation"]["portfolio"]
for field in headline_fields:
    assert saved_headline[field] == fresh_headline[field], field
print("decision:", fresh["decision"])
print({field: fresh_headline[field] for field in headline_fields})
"""
        ),
        nbformat.v4.new_code_cell(
            """failed = [gate for gate in fresh["gates"] if not gate["passed"]]
for gate in fresh["gates"]:
    print(
        "PASS" if gate["passed"] else "FAIL",
        gate["gate"],
        "value=", gate["value"],
        "threshold=", gate["threshold"],
    )
assert not failed, failed
assert fresh["live_trading_authorized"] is False
"""
        ),
        nbformat.v4.new_markdown_cell(
            """## Takeaways

- The strategy passes every declared research gate on the checked-in snapshot.
- The fully lagged risk budget cuts concentration and keeps realized volatility
  below its target; the notebook also reconciles development stability, funding
  stress, and parameter-neighbour gates.
- The evidence is still one 365-day holdout from one venue. Paper trading,
  capacity modelling, liquidation logic, and an independent future sample are
  required before any live-capital decision.
- Forward validation can only request human review; it cannot authorize live
  trading automatically.
"""
        ),
    ]
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    NotebookClient(
        notebook,
        timeout=180,
        kernel_name="python3",
        resources={"metadata": {"path": str(ROOT)}},
    ).execute()
    nbformat.write(notebook, TARGET)
    print(TARGET)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
