"""Small source-card helpers for dashboard teaching data."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


DOMAIN_BY_DATASET = {
    "market_tickers": "行情",
    "market_candles": "行情",
    "token_fund": "资金",
    "sector_fund": "资金",
    "onchain": "链上",
    "ai_picks": "情绪",
    "opportunity_scan": "情绪",
    "dex_trending": "热点",
    "web3_news": "消息面",
}


@dataclass(frozen=True, slots=True)
class SourceCard:
    dataset: str
    domain: str
    origin: str
    updated_at: str
    path: str
    complete: bool
    reason: str
    can_answer: str
    cannot_answer: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ExternalSourceCard:
    dataset: str
    source_name: str
    url_or_endpoint: str
    fetched_at: str
    payload_time: str
    required_fields: list[str]
    missing_fields: list[str]
    rate_limit_or_error: str
    active_layer: str
    stale_threshold: str
    allowed_draft_use: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_market_row(row: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not row.get("source"):
        errors.append("missing source")
    if not row.get("observed_at"):
        errors.append("missing observed_at")
    if float(row.get("close") or 0) <= 0:
        errors.append("invalid close")
    return errors


def source_card_from_manifest(dataset: str, manifest: dict[str, Any]) -> SourceCard:
    entry = (manifest.get("datasets") or {}).get(dataset) or {}
    origin = str(entry.get("origin") or "unknown")
    complete = bool(entry.get("complete"))
    reason = str(entry.get("reason") or "")
    domain = DOMAIN_BY_DATASET.get(dataset, "其他")
    return SourceCard(
        dataset=dataset,
        domain=domain,
        origin=origin,
        updated_at=str(entry.get("updated_at") or ""),
        path=str(entry.get("path") or ""),
        complete=complete,
        reason=reason,
        can_answer=f"{domain}数据在该来源和保存时间下的样本事实",
        cannot_answer="不能单独证明因果关系、未来收益或实盘执行指令",
    )


def external_source_card(
    dataset: str,
    source: dict[str, Any],
    *,
    fetched_at: str,
    items: list[dict[str, Any]] | None = None,
    required_fields: tuple[str, ...] = ("title", "url", "published_at"),
    stale_threshold: str = "24h",
    allowed_draft_use: str = "只能作为草稿证据和人工复核入口，不能单独生成研究结论或交易动作",
) -> ExternalSourceCard:
    rows = items or []
    missing: set[str] = set()
    if not rows:
        missing.add("items")
    for field in required_fields:
        if any(row.get(field) in (None, "") for row in rows):
            missing.add(field)
    payload_times = [str(row.get("published_at") or "") for row in rows if row.get("published_at")]
    ok = bool(source.get("ok"))
    error = "" if ok else str(source.get("error") or source.get("message") or "source unavailable")
    return ExternalSourceCard(
        dataset=dataset,
        source_name=str(source.get("name") or source.get("id") or "unknown"),
        url_or_endpoint=str(source.get("url") or source.get("endpoint") or ""),
        fetched_at=fetched_at,
        payload_time=max(payload_times) if payload_times else "",
        required_fields=list(required_fields),
        missing_fields=sorted(missing),
        rate_limit_or_error=error,
        active_layer="live" if ok else "error",
        stale_threshold=stale_threshold,
        allowed_draft_use=allowed_draft_use,
    )
