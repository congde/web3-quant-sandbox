from __future__ import annotations

from pathlib import Path

import pytest

from dashboard.knowledge_graph import KnowledgeGraphRepository
from dashboard.graph_ingestion import run_ingestion


SEED_NODES = (
    {
        "id": "ethereum",
        "label": "Ethereum",
        "stage": "结算",
        "domain": "公链",
        "risk": "normal",
        "entities": ["ETH", "EVM"],
    },
    {
        "id": "aave",
        "label": "Aave",
        "stage": "应用",
        "domain": "DeFi",
        "risk": "medium",
        "entities": ["AAVE"],
    },
)
SEED_EDGES = (("ethereum", "aave", "部署"),)


def repository(path: Path) -> KnowledgeGraphRepository:
    result = KnowledgeGraphRepository(path / "graph.db")
    result.ensure_seeded(SEED_NODES, SEED_EDGES)
    return result


def test_graph_persists_nodes_edges_evidence_and_audit(tmp_path: Path) -> None:
    graph = repository(tmp_path)
    created = graph.create_node(
        {
            "id": "chainlink",
            "label": "Chainlink",
            "stage": "数据",
            "domain": "预言机",
            "risk": "normal",
            "entities": ["LINK", "CCIP"],
            "description": "去中心化预言机网络",
            "website": "https://chain.link",
        }
    )
    edge = graph.create_edge(
        {
            "source_id": "chainlink",
            "target_id": "aave",
            "relation": "价格数据",
            "confidence": 0.9,
        }
    )
    evidence = graph.create_evidence(
        {
            "node_id": "chainlink",
            "title": "Chainlink documentation",
            "url": "https://docs.chain.link",
            "source": "official-docs",
            "confidence": 0.95,
        }
    )

    reopened = KnowledgeGraphRepository(tmp_path / "graph.db")
    payload = reopened.graph()
    node = next(row for row in payload["nodes"] if row["id"] == "chainlink")
    relation = next(row for row in payload["edges"] if row["id"] == edge["id"])

    assert created["version"] == 1
    assert node["entities"] == ["CCIP", "LINK"]
    assert node["evidence"][0]["id"] == evidence["id"]
    assert relation["from"] == "chainlink"
    assert relation["to"] == "aave"
    assert payload["storage"] == "sqlite"
    assert payload["stats"]["audit_events"] >= 4


def test_graph_uses_optimistic_locking_and_soft_delete(tmp_path: Path) -> None:
    graph = repository(tmp_path)
    updated = graph.update_node(
        "aave",
        {"description": "借贷协议", "expected_version": 1},
    )
    assert updated["version"] == 2

    with pytest.raises(RuntimeError, match="版本冲突"):
        graph.update_node(
            "aave",
            {"description": "stale update", "expected_version": 1},
        )

    graph.archive_node("aave")
    payload = graph.graph()
    assert "aave" not in {row["id"] for row in payload["nodes"]}
    assert payload["edges"] == []


def test_graph_server_side_filters_are_applied(tmp_path: Path) -> None:
    graph = repository(tmp_path)
    assert [row["id"] for row in graph.graph(domain="DeFi")["nodes"]] == ["aave"]
    assert [row["id"] for row in graph.graph(query="EVM")["nodes"]] == ["ethereum"]
    assert [row["id"] for row in graph.graph(risk="medium")["nodes"]] == ["aave"]


def test_ingestion_creates_review_candidates_and_approval_updates_graph(
    tmp_path: Path,
) -> None:
    graph = repository(tmp_path)
    result = run_ingestion(
        graph,
        {
            "source": "test-feed",
            "items": [
                {
                    "title": "Ethereum and Aave announce partnership",
                    "summary": "The protocols will collaborate on liquidity.",
                    "url": "https://example.com/ethereum-aave",
                    "source": "Example",
                    "published_at": "2026-07-23T00:00:00+00:00",
                    "assets": ["ETH"],
                }
            ],
        },
        use_llm=False,
    )

    pending = graph.candidates(status="pending")
    relation = next(item for item in pending if item["candidate_type"] == "edge")
    reviewed = graph.review_candidate(
        relation["id"], decision="approve", reviewer="reviewer@example"
    )
    payload = graph.graph()

    assert result["candidates_created"] >= 1
    assert reviewed["status"] == "approved"
    assert any(
        edge["relation"] == "合作"
        and {edge["from"], edge["to"]} == {"ethereum", "aave"}
        for edge in payload["edges"]
    )
    assert payload["stats"]["evidence"] >= 1
    assert graph.ingestion_status()["candidate_counts"]["approved"] == 1


def test_schedule_and_candidate_rejection_are_persistent(tmp_path: Path) -> None:
    graph = repository(tmp_path)
    schedule = graph.set_schedule(enabled=True, interval_minutes=60)
    inserted = graph.enqueue_candidate(
        {
            "candidate_type": "node",
            "proposed_node": {
                "id": "new-asset",
                "label": "NEW",
                "node_type": "asset",
                "stage": "应用",
                "domain": "数字资产",
                "risk": "medium",
                "entities": ["NEW"],
                "description": "candidate",
                "website": "",
            },
            "confidence": 0.7,
            "extractor": "rules",
            "evidence": {
                "title": "New asset announced",
                "url": "https://example.com/new",
                "source": "Example",
                "confidence": 0.7,
            },
        }
    )
    candidate = graph.candidates()[0]
    graph.review_candidate(candidate["id"], decision="reject", note="insufficient")

    reopened = KnowledgeGraphRepository(tmp_path / "graph.db")
    assert inserted is True
    assert schedule == {"enabled": True, "interval_minutes": 60}
    assert reopened.ingestion_status()["schedule"]["enabled"] is True
    assert reopened.candidates(status="rejected")[0]["review_note"] == "insufficient"


def test_multiple_candidate_evidence_can_approve_into_one_relation(
    tmp_path: Path,
) -> None:
    graph = repository(tmp_path)
    for suffix in ("one", "two"):
        graph.enqueue_candidate(
            {
                "candidate_type": "edge",
                "source_node_id": "ethereum",
                "target_node_id": "aave",
                "relation": "合作",
                "confidence": 0.8,
                "extractor": "rules",
                "evidence": {
                    "title": f"Evidence {suffix}",
                    "url": f"https://example.com/{suffix}",
                    "source": "Example",
                    "confidence": 0.8,
                },
            }
        )
    for candidate in graph.candidates():
        graph.review_candidate(candidate["id"], decision="approve")

    payload = graph.graph()
    approved_edges = [
        edge for edge in payload["edges"] if edge["relation"] == "合作"
    ]
    assert len(approved_edges) == 1
    assert approved_edges[0]["evidence_count"] == 2
