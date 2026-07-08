from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from risk import (
    DEFAULT_RULE_CONFIGS,
    MYSQL_RISK_ENGINE_DDL,
    POSTGRES_RISK_ENGINE_DDL,
    RISK_ENGINE_TABLES,
    build_asset_snapshot,
    classify_rule_value,
    compute_drawdown,
    compute_health_factor,
    steth_borrow_cap_multiplier,
)


def test_risk_engine_ddl_contains_four_core_tables() -> None:
    for table in RISK_ENGINE_TABLES:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in POSTGRES_RISK_ENGINE_DDL
        assert f"CREATE TABLE IF NOT EXISTS {table}" in MYSQL_RISK_ENGINE_DDL


def test_risk_engine_ddl_keeps_hot_path_indexes() -> None:
    assert "idx_risk_asset_snapshot_account_ts" in POSTGRES_RISK_ENGINE_DDL
    assert "idx_risk_onchain_health_factor" in POSTGRES_RISK_ENGINE_DDL
    assert "idx_risk_events_log_rule_ts" in MYSQL_RISK_ENGINE_DDL


def test_asset_snapshot_updates_high_watermark_and_drawdown() -> None:
    snapshot = build_asset_snapshot(
        timestamp=datetime(2026, 7, 8, 10, 24, 2, tzinfo=timezone.utc),
        account_id="desk-btc-eth",
        btc_balance=Decimal("12.50000000"),
        eth_balance=Decimal("240.00000000"),
        total_equity_usd=Decimal("960000.0000"),
        previous_peak_equity_usd=Decimal("1000000.0000"),
    )

    assert snapshot.peak_equity_usd == Decimal("1000000.0000")
    assert snapshot.current_drawdown == Decimal("0.0400")


def test_asset_snapshot_refreshes_peak_when_equity_breaks_high() -> None:
    snapshot = build_asset_snapshot(
        timestamp=datetime(2026, 7, 8, 10, 25, tzinfo=timezone.utc),
        account_id="desk-btc-eth",
        btc_balance=Decimal("12.60000000"),
        eth_balance=Decimal("242.00000000"),
        total_equity_usd=Decimal("1025000.0000"),
        previous_peak_equity_usd=Decimal("1000000.0000"),
    )

    assert snapshot.peak_equity_usd == Decimal("1025000.0000")
    assert snapshot.current_drawdown == Decimal("0.0000")


def test_compute_drawdown_never_goes_negative() -> None:
    assert compute_drawdown(Decimal("110"), Decimal("100")) == Decimal("0.0000")


def test_health_factor_formula_for_eth_collateral() -> None:
    health_factor = compute_health_factor(
        collateral_amount=Decimal("100"),
        oracle_price_usd=Decimal("3200"),
        liquidation_threshold=Decimal("0.825"),
        debt_amount=Decimal("220000"),
    )

    assert health_factor == Decimal("1.2000")
    assert (
        classify_rule_value(
            value=health_factor,
            warning_threshold=Decimal("1.2000"),
            liquid_threshold=Decimal("1.0500"),
            lower_is_worse=True,
        )
        == "WARNING"
    )


def test_health_factor_kill_switch_is_lower_is_worse() -> None:
    assert (
        classify_rule_value(
            value=Decimal("1.0400"),
            warning_threshold=Decimal("1.2000"),
            liquid_threshold=Decimal("1.0500"),
            lower_is_worse=True,
        )
        == "KILL_SWITCH"
    )


def test_drawdown_kill_switch_is_higher_is_worse() -> None:
    assert (
        classify_rule_value(
            value=Decimal("0.0420"),
            warning_threshold=Decimal("0.0300"),
            liquid_threshold=Decimal("0.0400"),
        )
        == "KILL_SWITCH"
    )


def test_steth_depeg_reduces_borrow_cap_below_099() -> None:
    assert steth_borrow_cap_multiplier(Decimal("0.995")) == Decimal("1.0000")
    assert steth_borrow_cap_multiplier(Decimal("0.970")) == Decimal("0.7500")
    assert steth_borrow_cap_multiplier(Decimal("0.940")) == Decimal("0.5000")


def test_default_rule_configs_cover_global_btc_eth() -> None:
    scopes = {rule.asset_scope for rule in DEFAULT_RULE_CONFIGS}
    names = {rule.rule_name for rule in DEFAULT_RULE_CONFIGS}

    assert scopes == {"GLOBAL", "BTC", "ETH"}
    assert "GLOBAL_MAX_DRAWDOWN" in names
    assert "AAVE_HEALTH_FACTOR" in names
    assert "STETH_ETH_DEPEG" in names
