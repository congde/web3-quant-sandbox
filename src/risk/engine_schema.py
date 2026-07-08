"""Production-style risk engine schema and BTC/ETH risk calculations.

The course runtime still uses the lightweight ``RiskManager`` for backtests.
This module captures the backend data contract that a high-frequency Web3
risk service would persist after aggregating CEX account state and on-chain
health signals.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal


RiskTriggerLevel = Literal["SAFE", "WARNING", "KILL_SWITCH"]


POSTGRES_RISK_ENGINE_DDL = """
CREATE TABLE IF NOT EXISTS risk_asset_snapshot (
    id BIGSERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    btc_balance NUMERIC(24, 8) NOT NULL,
    eth_balance NUMERIC(24, 8) NOT NULL,
    total_equity_usd NUMERIC(24, 4) NOT NULL,
    peak_equity_usd NUMERIC(24, 4) NOT NULL,
    current_drawdown NUMERIC(6, 4) NOT NULL,
    CONSTRAINT risk_asset_snapshot_drawdown_range CHECK (
        current_drawdown >= 0 AND current_drawdown <= 1
    )
);
CREATE INDEX IF NOT EXISTS idx_risk_asset_snapshot_ts
    ON risk_asset_snapshot ("timestamp");
CREATE INDEX IF NOT EXISTS idx_risk_asset_snapshot_account_ts
    ON risk_asset_snapshot (account_id, "timestamp" DESC);

CREATE TABLE IF NOT EXISTS risk_control_rules (
    rule_id INTEGER PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    asset_scope VARCHAR(32) NOT NULL CHECK (asset_scope IN ('GLOBAL', 'BTC', 'ETH')),
    warning_threshold NUMERIC(12, 4) NOT NULL,
    liquid_threshold NUMERIC(12, 4) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_control_rules_enabled_scope
    ON risk_control_rules (is_enabled, asset_scope);

CREATE TABLE IF NOT EXISTS risk_onchain_health (
    id BIGSERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    chain_id INTEGER NOT NULL,
    protocol_name VARCHAR(32) NOT NULL,
    collateral_asset VARCHAR(16) NOT NULL,
    collateral_amount NUMERIC(24, 8) NOT NULL,
    debt_asset VARCHAR(16) NOT NULL,
    debt_amount NUMERIC(24, 8) NOT NULL,
    health_factor NUMERIC(8, 4) NOT NULL,
    oracle_price_usd NUMERIC(16, 4) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_onchain_health_protocol
    ON risk_onchain_health (protocol_name);
CREATE INDEX IF NOT EXISTS idx_risk_onchain_health_factor
    ON risk_onchain_health (health_factor);
CREATE INDEX IF NOT EXISTS idx_risk_onchain_health_account_ts
    ON risk_onchain_health (account_id, "timestamp" DESC);

CREATE TABLE IF NOT EXISTS risk_events_log (
    event_id VARCHAR(64) PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    rule_id INTEGER NOT NULL REFERENCES risk_control_rules(rule_id),
    trigger_level VARCHAR(16) NOT NULL CHECK (
        trigger_level IN ('WARNING', 'KILL_SWITCH')
    ),
    trigger_value NUMERIC(16, 4) NOT NULL,
    action_taken VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (
        status IN ('SUCCESS', 'FAILED', 'PARTIAL_SUCCESS')
    )
);
CREATE INDEX IF NOT EXISTS idx_risk_events_log_ts
    ON risk_events_log ("timestamp");
CREATE INDEX IF NOT EXISTS idx_risk_events_log_rule_ts
    ON risk_events_log (rule_id, "timestamp" DESC);
""".strip()


MYSQL_RISK_ENGINE_DDL = """
CREATE TABLE IF NOT EXISTS risk_asset_snapshot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    `timestamp` TIMESTAMP(3) NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    btc_balance DECIMAL(24, 8) NOT NULL,
    eth_balance DECIMAL(24, 8) NOT NULL,
    total_equity_usd DECIMAL(24, 4) NOT NULL,
    peak_equity_usd DECIMAL(24, 4) NOT NULL,
    current_drawdown DECIMAL(6, 4) NOT NULL,
    CONSTRAINT risk_asset_snapshot_drawdown_range CHECK (
        current_drawdown >= 0 AND current_drawdown <= 1
    ),
    INDEX idx_risk_asset_snapshot_ts (`timestamp`),
    INDEX idx_risk_asset_snapshot_account_ts (account_id, `timestamp`)
);

CREATE TABLE IF NOT EXISTS risk_control_rules (
    rule_id INT PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    asset_scope VARCHAR(32) NOT NULL,
    warning_threshold DECIMAL(12, 4) NOT NULL,
    liquid_threshold DECIMAL(12, 4) NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_risk_control_rules_enabled_scope (is_enabled, asset_scope)
);

CREATE TABLE IF NOT EXISTS risk_onchain_health (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    `timestamp` TIMESTAMP(3) NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    chain_id INT NOT NULL,
    protocol_name VARCHAR(32) NOT NULL,
    collateral_asset VARCHAR(16) NOT NULL,
    collateral_amount DECIMAL(24, 8) NOT NULL,
    debt_asset VARCHAR(16) NOT NULL,
    debt_amount DECIMAL(24, 8) NOT NULL,
    health_factor DECIMAL(8, 4) NOT NULL,
    oracle_price_usd DECIMAL(16, 4) NOT NULL,
    INDEX idx_risk_onchain_health_protocol (protocol_name),
    INDEX idx_risk_onchain_health_factor (health_factor),
    INDEX idx_risk_onchain_health_account_ts (account_id, `timestamp`)
);

CREATE TABLE IF NOT EXISTS risk_events_log (
    event_id VARCHAR(64) PRIMARY KEY,
    `timestamp` TIMESTAMP(3) NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    rule_id INT NOT NULL,
    trigger_level VARCHAR(16) NOT NULL,
    trigger_value DECIMAL(16, 4) NOT NULL,
    action_taken VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    INDEX idx_risk_events_log_ts (`timestamp`),
    INDEX idx_risk_events_log_rule_ts (rule_id, `timestamp`),
    CONSTRAINT fk_risk_events_rule FOREIGN KEY (rule_id)
        REFERENCES risk_control_rules(rule_id)
);
""".strip()


@dataclass(frozen=True, slots=True)
class RiskAssetSnapshot:
    timestamp: datetime
    account_id: str
    btc_balance: Decimal
    eth_balance: Decimal
    total_equity_usd: Decimal
    peak_equity_usd: Decimal
    current_drawdown: Decimal


@dataclass(frozen=True, slots=True)
class RiskRuleConfig:
    rule_id: int
    rule_name: str
    asset_scope: Literal["GLOBAL", "BTC", "ETH"]
    warning_threshold: Decimal
    liquid_threshold: Decimal
    is_enabled: bool = True


@dataclass(frozen=True, slots=True)
class OnchainHealthPosition:
    timestamp: datetime
    account_id: str
    chain_id: int
    protocol_name: str
    collateral_asset: str
    collateral_amount: Decimal
    debt_asset: str
    debt_amount: Decimal
    health_factor: Decimal
    oracle_price_usd: Decimal


def compute_drawdown(total_equity_usd: Decimal, peak_equity_usd: Decimal) -> Decimal:
    """Return current drawdown as a ratio, e.g. 0.0150 for 1.50%."""
    if peak_equity_usd <= 0:
        return Decimal("0")
    drawdown = (peak_equity_usd - total_equity_usd) / peak_equity_usd
    return max(Decimal("0"), drawdown).quantize(Decimal("0.0001"))


def build_asset_snapshot(
    *,
    timestamp: datetime,
    account_id: str,
    btc_balance: Decimal,
    eth_balance: Decimal,
    total_equity_usd: Decimal,
    previous_peak_equity_usd: Decimal,
) -> RiskAssetSnapshot:
    peak = max(previous_peak_equity_usd, total_equity_usd)
    return RiskAssetSnapshot(
        timestamp=timestamp,
        account_id=account_id,
        btc_balance=btc_balance,
        eth_balance=eth_balance,
        total_equity_usd=total_equity_usd,
        peak_equity_usd=peak,
        current_drawdown=compute_drawdown(total_equity_usd, peak),
    )


def compute_health_factor(
    *,
    collateral_amount: Decimal,
    oracle_price_usd: Decimal,
    liquidation_threshold: Decimal,
    debt_amount: Decimal,
    debt_price_usd: Decimal = Decimal("1"),
) -> Decimal:
    """Compute DeFi lending health factor.

    Formula: sum(collateral value * liquidation threshold) / debt value.
    """
    debt_value = debt_amount * debt_price_usd
    if debt_value <= 0:
        return Decimal("9999.0000")
    collateral_value = collateral_amount * oracle_price_usd * liquidation_threshold
    return (collateral_value / debt_value).quantize(Decimal("0.0001"))


def classify_rule_value(
    *,
    value: Decimal,
    warning_threshold: Decimal,
    liquid_threshold: Decimal,
    lower_is_worse: bool = False,
) -> RiskTriggerLevel:
    """Classify a metric against warning and kill-switch thresholds."""
    if lower_is_worse:
        if value <= liquid_threshold:
            return "KILL_SWITCH"
        if value <= warning_threshold:
            return "WARNING"
        return "SAFE"
    if value >= liquid_threshold:
        return "KILL_SWITCH"
    if value >= warning_threshold:
        return "WARNING"
    return "SAFE"


def steth_borrow_cap_multiplier(steth_eth_ratio: Decimal) -> Decimal:
    """Reduce borrow capacity when stETH/ETH trades below 0.99.

    The multiplier stays at 1.0 above 0.99, scales linearly down to 0.5
    between 0.99 and 0.95, and floors at 0.5 below 0.95.
    """
    if steth_eth_ratio >= Decimal("0.99"):
        return Decimal("1.0000")
    if steth_eth_ratio <= Decimal("0.95"):
        return Decimal("0.5000")
    slope = (steth_eth_ratio - Decimal("0.95")) / Decimal("0.04")
    return (Decimal("0.5") + slope * Decimal("0.5")).quantize(Decimal("0.0001"))


DEFAULT_RULE_CONFIGS = (
    RiskRuleConfig(
        rule_id=1001,
        rule_name="GLOBAL_MAX_DRAWDOWN",
        asset_scope="GLOBAL",
        warning_threshold=Decimal("0.0300"),
        liquid_threshold=Decimal("0.0400"),
    ),
    RiskRuleConfig(
        rule_id=2001,
        rule_name="AAVE_HEALTH_FACTOR",
        asset_scope="ETH",
        warning_threshold=Decimal("1.2000"),
        liquid_threshold=Decimal("1.0500"),
    ),
    RiskRuleConfig(
        rule_id=2002,
        rule_name="STETH_ETH_DEPEG",
        asset_scope="ETH",
        warning_threshold=Decimal("0.9900"),
        liquid_threshold=Decimal("0.9700"),
    ),
    RiskRuleConfig(
        rule_id=3001,
        rule_name="BTC_BASE_PRICE_SHOCK",
        asset_scope="BTC",
        warning_threshold=Decimal("0.0500"),
        liquid_threshold=Decimal("0.0800"),
    ),
)


RISK_ENGINE_TABLES = (
    "risk_asset_snapshot",
    "risk_control_rules",
    "risk_onchain_health",
    "risk_events_log",
)
