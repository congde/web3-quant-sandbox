"""Knowledge-graph ingestion and candidate extraction pipeline."""

from __future__ import annotations

import json
import re
from itertools import combinations
from typing import Any, Iterable

from dashboard.knowledge_graph import KnowledgeGraphRepository
from dashboard.llm_signal import _call_llm, llm_configured, resolve_model


RELATION_RULES: tuple[tuple[tuple[str, ...], str, float], ...] = (
    (("partner", "partnership", "collaborat", "alliance"), "合作", 0.82),
    (("integrat", "support", "adopt", "connect"), "集成", 0.78),
    (("deploy", "launch", "mainnet", "testnet"), "部署", 0.76),
    (("invest", "funding", "acquire", "acquisition"), "投资或并购", 0.8),
    (("hack", "exploit", "attack", "breach"), "安全事件关联", 0.86),
    (("governance", "proposal", "vote"), "治理关联", 0.74),
)


def _contains_alias(text: str, alias: str) -> bool:
    return (
        re.search(
            rf"(?<![a-z0-9]){re.escape(alias.strip().lower())}(?![a-z0-9])",
            text,
        )
        is not None
    )


def _relation(text: str) -> tuple[str, float]:
    for terms, relation, confidence in RELATION_RULES:
        if any(term in text for term in terms):
            return relation, confidence
    return "共同出现", 0.58


def _evidence(item: dict[str, Any], confidence: float) -> dict[str, Any]:
    return {
        "title": str(item.get("title") or "").strip(),
        "url": str(item.get("url") or "").strip(),
        "source": str(item.get("source") or "external-source").strip(),
        "published_at": item.get("published_at"),
        "confidence": confidence,
    }


def extract_rule_candidates(
    repository: KnowledgeGraphRepository,
    items: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    graph = repository.graph(include_evidence=False)
    nodes = graph["nodes"]
    aliases: dict[str, list[str]] = {
        node["id"]: [node["label"], *node["entities"]] for node in nodes
    }
    known_aliases = {
        alias.strip().lower()
        for values in aliases.values()
        for alias in values
        if alias.strip()
    }
    existing_edges = {
        (edge["source_id"], edge["target_id"], edge["relation"])
        for edge in graph["edges"]
    } | {
        (edge["target_id"], edge["source_id"], edge["relation"])
        for edge in graph["edges"]
    }
    candidates: list[dict[str, Any]] = []
    for item in items:
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or "").strip()
        if not title or not url:
            continue
        text = f"{title} {item.get('summary') or ''}".lower()
        matched = sorted(
            node_id
            for node_id, values in aliases.items()
            if any(_contains_alias(text, alias) for alias in values if alias.strip())
        )
        relation, confidence = _relation(text)
        for source, target in combinations(matched, 2):
            if (source, target, relation) in existing_edges:
                continue
            candidates.append(
                {
                    "candidate_type": "edge",
                    "source_node_id": source,
                    "target_node_id": target,
                    "relation": relation,
                    "confidence": confidence,
                    "extractor": "rules",
                    "evidence": _evidence(item, confidence),
                }
            )

        for asset in item.get("assets") or []:
            symbol = str(asset or "").strip().upper()
            if not symbol or symbol.lower() in known_aliases:
                continue
            risk = "high" if item.get("risk_event") else "medium"
            candidates.append(
                {
                    "candidate_type": "node",
                    "confidence": 0.66,
                    "extractor": "rules",
                    "proposed_node": {
                        "id": re.sub(r"[^a-z0-9_-]", "-", symbol.lower()).strip("-"),
                        "label": symbol,
                        "node_type": "asset",
                        "stage": "协议与应用",
                        "domain": "数字资产",
                        "risk": risk,
                        "entities": [symbol],
                        "description": f"从外部证据候选发现：{title[:180]}",
                        "website": "",
                    },
                    "evidence": _evidence(item, 0.66),
                }
            )
    return candidates


def extract_llm_candidates(
    repository: KnowledgeGraphRepository,
    items: list[dict[str, Any]],
    *,
    model: str | None = None,
) -> list[dict[str, Any]]:
    graph = repository.graph(include_evidence=False)
    existing = [
        {
            "id": node["id"],
            "label": node["label"],
            "aliases": node["entities"],
        }
        for node in graph["nodes"]
    ]
    compact_items = [
        {
            "title": item.get("title"),
            "summary": item.get("summary"),
            "url": item.get("url"),
            "source": item.get("source"),
            "published_at": item.get("published_at"),
        }
        for item in items[:20]
        if item.get("title") and item.get("url")
    ]
    prompt = (
        "你是知识图谱信息抽取器。只返回 JSON 对象，不要 markdown。"
        "仅根据提供的新闻证据提取候选，禁止补充外部事实。"
        "输出格式：{\"candidates\":[{"
        "\"candidate_type\":\"node|edge\","
        "\"source_node_id\":\"existing-id\","
        "\"target_node_id\":\"existing-id\","
        "\"relation\":\"简短中文关系\","
        "\"proposed_node\":{\"id\":\"lowercase-id\",\"label\":\"名称\","
        "\"node_type\":\"protocol|asset|infrastructure|organization\","
        "\"stage\":\"阶段\",\"domain\":\"领域\",\"risk\":\"normal|medium|high|critical\","
        "\"entities\":[\"别名\"],\"description\":\"描述\",\"website\":\"\"},"
        "\"confidence\":0.0,"
        "\"evidence_url\":\"必须来自输入新闻\"}]}。"
        "edge 只能引用 existing_nodes 中的 ID；node 必须包含 proposed_node。"
        f"\nexisting_nodes={json.dumps(existing, ensure_ascii=False)}"
        f"\nnews={json.dumps(compact_items, ensure_ascii=False)}"
    )
    payload = _call_llm(prompt, resolve_model(model))
    by_url = {str(item["url"]): item for item in compact_items}
    result: list[dict[str, Any]] = []
    for candidate in payload.get("candidates") or []:
        if not isinstance(candidate, dict):
            continue
        url = str(candidate.get("evidence_url") or "")
        source_item = by_url.get(url)
        if source_item is None:
            continue
        candidate_type = str(candidate.get("candidate_type") or "")
        normalized = {
            **candidate,
            "candidate_type": candidate_type,
            "extractor": f"llm:{resolve_model(model)}",
            "evidence": _evidence(
                source_item,
                max(0.0, min(1.0, float(candidate.get("confidence", 0.65)))),
            ),
        }
        if candidate_type == "node" and isinstance(
            candidate.get("proposed_node"), dict
        ):
            result.append(normalized)
        elif candidate_type == "edge":
            result.append(normalized)
    return result


def run_ingestion(
    repository: KnowledgeGraphRepository,
    news_payload: dict[str, Any],
    *,
    use_llm: bool = True,
    model: str | None = None,
) -> dict[str, Any]:
    items = [
        item
        for item in news_payload.get("items") or []
        if isinstance(item, dict) and item.get("title") and item.get("url")
    ]
    extractor = "rules"
    llm_error: str | None = None
    candidates = extract_rule_candidates(repository, items)
    if use_llm and llm_configured():
        try:
            candidates.extend(
                extract_llm_candidates(repository, items, model=model)
            )
            extractor = f"rules+llm:{resolve_model(model)}"
        except Exception as error:
            llm_error = str(error)
            extractor = "rules+llm-fallback"
    elif use_llm:
        extractor = "rules+llm-not-configured"

    run_id = repository.create_ingestion_run(
        source=str(news_payload.get("source") or "unknown"),
        extractor=extractor,
        items_seen=len(items),
    )
    created = 0
    try:
        for candidate in candidates:
            created += int(repository.enqueue_candidate(candidate))
        repository.finish_ingestion_run(run_id, candidates_created=created)
    except Exception as error:
        repository.finish_ingestion_run(
            run_id, candidates_created=created, error=str(error)
        )
        raise
    return {
        "ok": True,
        "run_id": run_id,
        "source": news_payload.get("source"),
        "extractor": extractor,
        "llm_configured": llm_configured(),
        "llm_error": llm_error,
        "items_seen": len(items),
        "candidates_extracted": len(candidates),
        "candidates_created": created,
        **repository.ingestion_status(),
    }
