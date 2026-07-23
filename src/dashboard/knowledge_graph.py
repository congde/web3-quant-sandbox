"""Persistent Web3 research knowledge graph.

The repository stores editable nodes, typed relationships, source evidence and
an immutable audit trail in SQLite.  Reads never depend on hard-coded UI data;
the static catalog is used only once to bootstrap an empty database.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from paths import DATA_DIR

RISK_LEVELS = {"normal", "medium", "high", "critical"}
NODE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,63}$")
GRAPH_DB_PATH = DATA_DIR / "knowledge_graph.db"
_REPOSITORY: "KnowledgeGraphRepository | None" = None
_REPOSITORY_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


class KnowledgeGraphRepository:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS graph_nodes (
                    id TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    node_type TEXT NOT NULL DEFAULT 'protocol',
                    stage TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    risk TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    website TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'active',
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS graph_entities (
                    id TEXT PRIMARY KEY,
                    node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    UNIQUE(node_id, name)
                );
                CREATE TABLE IF NOT EXISTS graph_edges (
                    id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL REFERENCES graph_nodes(id),
                    target_id TEXT NOT NULL REFERENCES graph_nodes(id),
                    relation TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0.7,
                    status TEXT NOT NULL DEFAULT 'active',
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(source_id, target_id, relation)
                );
                CREATE TABLE IF NOT EXISTS graph_evidence (
                    id TEXT PRIMARY KEY,
                    node_id TEXT REFERENCES graph_nodes(id),
                    edge_id TEXT REFERENCES graph_edges(id),
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    source TEXT NOT NULL,
                    published_at TEXT,
                    captured_at TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0.7,
                    content_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    CHECK(node_id IS NOT NULL OR edge_id IS NOT NULL)
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_evidence_identity
                ON graph_evidence(content_hash, COALESCE(node_id, ''), COALESCE(edge_id, ''));
                CREATE TABLE IF NOT EXISTS graph_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    before_json TEXT,
                    after_json TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS graph_ingestion_runs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    source TEXT NOT NULL,
                    extractor TEXT NOT NULL,
                    items_seen INTEGER NOT NULL DEFAULT 0,
                    candidates_created INTEGER NOT NULL DEFAULT 0,
                    error TEXT,
                    started_at TEXT NOT NULL,
                    completed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS graph_candidates (
                    id TEXT PRIMARY KEY,
                    candidate_type TEXT NOT NULL,
                    source_node_id TEXT,
                    target_node_id TEXT,
                    relation TEXT,
                    proposed_node_json TEXT,
                    evidence_json TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    extractor TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    payload_hash TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    reviewed_at TEXT,
                    reviewed_by TEXT,
                    review_note TEXT
                );
                CREATE TABLE IF NOT EXISTS graph_settings (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_nodes_domain ON graph_nodes(domain);
                CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
                CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);
                CREATE INDEX IF NOT EXISTS idx_graph_evidence_node ON graph_evidence(node_id);
                CREATE INDEX IF NOT EXISTS idx_graph_audit_entity ON graph_audit(entity_type, entity_id);
                CREATE INDEX IF NOT EXISTS idx_graph_candidates_status
                ON graph_candidates(status, created_at);
                CREATE INDEX IF NOT EXISTS idx_graph_ingestion_started
                ON graph_ingestion_runs(started_at);
                """
            )

    def ensure_seeded(
        self,
        nodes: Iterable[dict[str, Any]],
        edges: Iterable[tuple[str, str, str]],
    ) -> None:
        seed_nodes = tuple(nodes)
        seed_edges = tuple(edges)
        with self._connect() as connection:
            count = int(
                connection.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0]
            )
            if count:
                return
            timestamp = _now()
            for node in seed_nodes:
                connection.execute(
                    """
                    INSERT INTO graph_nodes
                    (id, label, node_type, stage, domain, risk, description,
                     website, status, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
                    """,
                    (
                        node["id"],
                        node["label"],
                        node.get("node_type", "protocol"),
                        node["stage"],
                        node["domain"],
                        node["risk"],
                        node.get("description", ""),
                        node.get("website", ""),
                        timestamp,
                        timestamp,
                    ),
                )
                for entity in node.get("entities") or []:
                    connection.execute(
                        "INSERT INTO graph_entities (id, node_id, name) VALUES (?, ?, ?)",
                        (uuid.uuid4().hex, node["id"], str(entity)),
                    )
            for source, target, relation in seed_edges:
                edge_id = f"{source}--{target}--{hashlib.sha1(relation.encode('utf-8')).hexdigest()[:8]}"
                connection.execute(
                    """
                    INSERT INTO graph_edges
                    (id, source_id, target_id, relation, confidence, status,
                     version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 0.8, 'active', 1, ?, ?)
                    """,
                    (edge_id, source, target, relation, timestamp, timestamp),
                )
            self._audit(
                connection,
                "bootstrap",
                "graph",
                "default",
                None,
                {"nodes": len(seed_nodes), "edges": len(seed_edges)},
                "system",
            )

    def sync_news(self, items: Iterable[dict[str, Any]]) -> int:
        active_nodes = self.graph(include_evidence=False)["nodes"]
        inserted = 0
        with self._connect() as connection:
            for item in items:
                title = str(item.get("title") or "").strip()
                url = str(item.get("url") or "").strip()
                if not title or not url:
                    continue
                haystack = f"{title} {item.get('summary') or ''}".lower()
                for node in active_nodes:
                    aliases = [node["label"], *node["entities"]]
                    if not any(
                        re.search(
                            rf"(?<![a-z0-9]){re.escape(alias.lower())}(?![a-z0-9])",
                            haystack,
                        )
                        for alias in aliases
                    ):
                        continue
                    evidence_id = hashlib.sha256(
                        f"{node['id']}|{url}".encode("utf-8")
                    ).hexdigest()[:32]
                    content_hash = hashlib.sha256(
                        f"{title}|{url}".encode("utf-8")
                    ).hexdigest()
                    cursor = connection.execute(
                        """
                        INSERT OR IGNORE INTO graph_evidence
                        (id, node_id, edge_id, title, url, source, published_at,
                         captured_at, confidence, content_hash, status)
                        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'active')
                        """,
                        (
                            evidence_id,
                            node["id"],
                            title,
                            url,
                            str(item.get("source") or "news"),
                            item.get("published_at"),
                            _now(),
                            0.75,
                            content_hash,
                        ),
                    )
                    inserted += cursor.rowcount
        return inserted

    def create_ingestion_run(
        self, *, source: str, extractor: str, items_seen: int
    ) -> str:
        run_id = uuid.uuid4().hex
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO graph_ingestion_runs
                (id, status, source, extractor, items_seen, candidates_created,
                 started_at)
                VALUES (?, 'running', ?, ?, ?, 0, ?)
                """,
                (run_id, source, extractor, items_seen, _now()),
            )
        return run_id

    def finish_ingestion_run(
        self, run_id: str, *, candidates_created: int = 0, error: str | None = None
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE graph_ingestion_runs
                SET status = ?, candidates_created = ?, error = ?,
                    completed_at = ?
                WHERE id = ?
                """,
                (
                    "failed" if error else "completed",
                    candidates_created,
                    error,
                    _now(),
                    run_id,
                ),
            )

    def enqueue_candidate(self, payload: dict[str, Any]) -> bool:
        candidate_type = str(payload.get("candidate_type") or "").strip()
        if candidate_type not in {"node", "edge"}:
            raise ValueError("candidate_type 必须是 node 或 edge")
        evidence = payload.get("evidence")
        if not isinstance(evidence, dict) or not evidence.get("url"):
            raise ValueError("候选项必须包含可追溯证据")
        normalized = {
            "candidate_type": candidate_type,
            "source_node_id": payload.get("source_node_id"),
            "target_node_id": payload.get("target_node_id"),
            "relation": payload.get("relation"),
            "proposed_node": payload.get("proposed_node"),
            "evidence_url": evidence.get("url"),
        }
        payload_hash = hashlib.sha256(_json(normalized).encode("utf-8")).hexdigest()
        confidence = max(0.0, min(1.0, float(payload.get("confidence", 0.6))))
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO graph_candidates
                (id, candidate_type, source_node_id, target_node_id, relation,
                 proposed_node_json, evidence_json, confidence, extractor,
                 status, payload_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """,
                (
                    uuid.uuid4().hex,
                    candidate_type,
                    payload.get("source_node_id"),
                    payload.get("target_node_id"),
                    payload.get("relation"),
                    _json(payload.get("proposed_node"))
                    if payload.get("proposed_node")
                    else None,
                    _json(evidence),
                    confidence,
                    str(payload.get("extractor") or "rules"),
                    payload_hash,
                    _now(),
                ),
            )
        return cursor.rowcount > 0

    def candidates(
        self, *, status: str = "pending", limit: int = 100
    ) -> list[dict[str, Any]]:
        if status not in {"pending", "approved", "rejected", "all"}:
            raise ValueError("候选状态无效")
        safe_limit = max(1, min(500, int(limit)))
        clause = "" if status == "all" else "WHERE status = ?"
        params: list[Any] = [] if status == "all" else [status]
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT * FROM graph_candidates
                {clause}
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [*params, safe_limit],
            ).fetchall()
        return [self._candidate_row(dict(row)) for row in rows]

    def review_candidate(
        self,
        candidate_id: str,
        *,
        decision: str,
        reviewer: str = "local-user",
        note: str = "",
    ) -> dict[str, Any]:
        if decision not in {"approve", "reject"}:
            raise ValueError("decision 必须是 approve 或 reject")
        with self._connect() as connection:
            raw = connection.execute(
                "SELECT * FROM graph_candidates WHERE id = ?", (candidate_id,)
            ).fetchone()
        if raw is None:
            raise KeyError(candidate_id)
        candidate = self._candidate_row(dict(raw))
        if candidate["status"] != "pending":
            raise RuntimeError("候选项已完成审核")

        applied: dict[str, Any] | None = None
        if decision == "approve":
            if candidate["candidate_type"] == "node":
                proposed = candidate["proposed_node"]
                with self._connect() as connection:
                    applied = self._get_node(connection, proposed["id"])
                if applied is None:
                    applied = self.create_node(proposed, actor=reviewer)
                evidence_payload = {
                    **candidate["evidence"],
                    "node_id": applied["id"],
                }
            else:
                with self._connect() as connection:
                    applied = _row(
                        connection.execute(
                            """
                            SELECT * FROM graph_edges
                            WHERE source_id = ? AND target_id = ?
                              AND relation = ? AND status = 'active'
                            """,
                            (
                                candidate["source_node_id"],
                                candidate["target_node_id"],
                                candidate["relation"],
                            ),
                        ).fetchone()
                    )
                if applied is None:
                    applied = self.create_edge(
                        {
                            "source_id": candidate["source_node_id"],
                            "target_id": candidate["target_node_id"],
                            "relation": candidate["relation"],
                            "confidence": candidate["confidence"],
                        },
                        actor=reviewer,
                    )
                evidence_payload = {
                    **candidate["evidence"],
                    "edge_id": applied["id"],
                }
            try:
                self.create_evidence(evidence_payload, actor=reviewer)
            except sqlite3.IntegrityError:
                pass

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE graph_candidates
                SET status = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?
                WHERE id = ? AND status = 'pending'
                """,
                (
                    "approved" if decision == "approve" else "rejected",
                    _now(),
                    reviewer,
                    note.strip(),
                    candidate_id,
                ),
            )
            self._audit(
                connection,
                decision,
                "candidate",
                candidate_id,
                candidate,
                applied,
                reviewer,
            )
        candidate["status"] = "approved" if decision == "approve" else "rejected"
        candidate["applied"] = applied
        return candidate

    def ingestion_status(self) -> dict[str, Any]:
        with self._connect() as connection:
            latest = _row(
                connection.execute(
                    """
                    SELECT * FROM graph_ingestion_runs
                    ORDER BY started_at DESC LIMIT 1
                    """
                ).fetchone()
            )
            counts = {
                row["status"]: int(row["count"])
                for row in connection.execute(
                    """
                    SELECT status, COUNT(*) AS count
                    FROM graph_candidates GROUP BY status
                    """
                )
            }
            setting = connection.execute(
                "SELECT value_json FROM graph_settings WHERE key = 'schedule'"
            ).fetchone()
        schedule = (
            json.loads(setting["value_json"])
            if setting
            else {"enabled": False, "interval_minutes": 240}
        )
        return {
            "latest_run": latest,
            "candidate_counts": {
                "pending": counts.get("pending", 0),
                "approved": counts.get("approved", 0),
                "rejected": counts.get("rejected", 0),
            },
            "schedule": schedule,
        }

    def set_schedule(self, *, enabled: bool, interval_minutes: int) -> dict[str, Any]:
        interval = max(15, min(10080, int(interval_minutes)))
        value = {"enabled": bool(enabled), "interval_minutes": interval}
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO graph_settings (key, value_json, updated_at)
                VALUES ('schedule', ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """,
                (_json(value), _now()),
            )
        return value

    @staticmethod
    def _candidate_row(row: dict[str, Any]) -> dict[str, Any]:
        proposed = row.pop("proposed_node_json", None)
        evidence = row.pop("evidence_json", None)
        row["proposed_node"] = json.loads(proposed) if proposed else None
        row["evidence"] = json.loads(evidence) if evidence else {}
        return row

    def graph(
        self,
        *,
        query: str = "",
        domain: str = "",
        risk: str = "",
        include_evidence: bool = True,
    ) -> dict[str, Any]:
        clauses = ["status = 'active'"]
        params: list[Any] = []
        if domain:
            clauses.append("domain = ?")
            params.append(domain)
        if risk:
            clauses.append("risk = ?")
            params.append(risk)
        where = " AND ".join(clauses)
        with self._connect() as connection:
            node_rows = [
                dict(row)
                for row in connection.execute(
                    f"SELECT * FROM graph_nodes WHERE {where} ORDER BY stage, label",
                    params,
                )
            ]
            entities = connection.execute(
                "SELECT node_id, name FROM graph_entities ORDER BY name"
            ).fetchall()
            entities_by_node: dict[str, list[str]] = {}
            for row in entities:
                entities_by_node.setdefault(row["node_id"], []).append(row["name"])
            evidence_by_node: dict[str, list[dict[str, Any]]] = {}
            if include_evidence:
                for row in connection.execute(
                    """
                    SELECT * FROM graph_evidence
                    WHERE status = 'active' AND node_id IS NOT NULL
                    ORDER BY COALESCE(published_at, captured_at) DESC
                    """
                ):
                    evidence_by_node.setdefault(row["node_id"], []).append(dict(row))
            nodes = []
            needle = query.strip().lower()
            for node in node_rows:
                node["entities"] = entities_by_node.get(node["id"], [])
                node["evidence"] = evidence_by_node.get(node["id"], [])[:20]
                node["mentions"] = len(evidence_by_node.get(node["id"], []))
                searchable = " ".join(
                    [
                        node["label"],
                        node["description"],
                        node["domain"],
                        *node["entities"],
                    ]
                ).lower()
                if needle and needle not in searchable:
                    continue
                nodes.append(node)
            visible_ids = {node["id"] for node in nodes}
            edges = []
            for row in connection.execute(
                """
                SELECT e.*,
                       COUNT(ev.id) AS evidence_count
                FROM graph_edges e
                LEFT JOIN graph_evidence ev
                  ON ev.edge_id = e.id AND ev.status = 'active'
                WHERE e.status = 'active'
                GROUP BY e.id
                ORDER BY e.relation, e.id
                """
            ):
                edge = dict(row)
                if (
                    edge["source_id"] in visible_ids
                    and edge["target_id"] in visible_ids
                ):
                    edge["from"] = edge["source_id"]
                    edge["to"] = edge["target_id"]
                    edges.append(edge)
            audit_count = int(
                connection.execute("SELECT COUNT(*) FROM graph_audit").fetchone()[0]
            )
            evidence_count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM graph_evidence WHERE status = 'active'"
                ).fetchone()[0]
            )
        domains: dict[str, int] = {}
        for node in nodes:
            domains[node["domain"]] = domains.get(node["domain"], 0) + 1
        stages = list(dict.fromkeys(node["stage"] for node in nodes))
        return {
            "ok": True,
            "scope": "web3-only",
            "storage": "sqlite",
            "database": self.path.name,
            "updated_at": max(
                (node["updated_at"] for node in nodes), default=None
            ),
            "stages": stages,
            "domains": [
                {"name": name, "count": count}
                for name, count in sorted(domains.items())
            ],
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "nodes": len(nodes),
                "edges": len(edges),
                "risks": sum(
                    node["risk"] in {"high", "critical"} for node in nodes
                ),
                "entities": len(
                    {entity for node in nodes for entity in node["entities"]}
                ),
                "evidence": evidence_count,
                "audit_events": audit_count,
            },
        }

    def create_node(self, payload: dict[str, Any], actor: str = "local-user") -> dict[str, Any]:
        node = self._validate_node(payload, partial=False)
        timestamp = _now()
        with self._connect() as connection:
            if connection.execute(
                "SELECT 1 FROM graph_nodes WHERE id = ?", (node["id"],)
            ).fetchone():
                raise ValueError(f"节点已存在: {node['id']}")
            connection.execute(
                """
                INSERT INTO graph_nodes
                (id, label, node_type, stage, domain, risk, description, website,
                 status, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
                """,
                (
                    node["id"],
                    node["label"],
                    node["node_type"],
                    node["stage"],
                    node["domain"],
                    node["risk"],
                    node["description"],
                    node["website"],
                    timestamp,
                    timestamp,
                ),
            )
            self._replace_entities(connection, node["id"], node["entities"])
            created = self._get_node(connection, node["id"])
            self._audit(connection, "create", "node", node["id"], None, created, actor)
        return created

    def update_node(
        self, node_id: str, payload: dict[str, Any], actor: str = "local-user"
    ) -> dict[str, Any]:
        updates = self._validate_node(payload, partial=True)
        with self._connect() as connection:
            before = self._get_node(connection, node_id)
            if before is None:
                raise KeyError(node_id)
            expected_version = payload.get("expected_version")
            if expected_version is not None and int(expected_version) != before["version"]:
                raise RuntimeError(
                    f"版本冲突：当前版本为 {before['version']}，请刷新后重试"
                )
            columns = [
                key
                for key in (
                    "label",
                    "node_type",
                    "stage",
                    "domain",
                    "risk",
                    "description",
                    "website",
                )
                if key in updates
            ]
            if columns:
                assignments = ", ".join(f"{key} = ?" for key in columns)
                connection.execute(
                    f"""
                    UPDATE graph_nodes
                    SET {assignments}, version = version + 1, updated_at = ?
                    WHERE id = ?
                    """,
                    [*(updates[key] for key in columns), _now(), node_id],
                )
            if "entities" in updates:
                self._replace_entities(connection, node_id, updates["entities"])
                if not columns:
                    connection.execute(
                        """
                        UPDATE graph_nodes
                        SET version = version + 1, updated_at = ?
                        WHERE id = ?
                        """,
                        (_now(), node_id),
                    )
            after = self._get_node(connection, node_id)
            self._audit(connection, "update", "node", node_id, before, after, actor)
        return after

    def archive_node(self, node_id: str, actor: str = "local-user") -> None:
        with self._connect() as connection:
            before = self._get_node(connection, node_id)
            if before is None:
                raise KeyError(node_id)
            connection.execute(
                """
                UPDATE graph_nodes SET status = 'archived', version = version + 1,
                    updated_at = ? WHERE id = ?
                """,
                (_now(), node_id),
            )
            connection.execute(
                """
                UPDATE graph_edges SET status = 'archived', version = version + 1,
                    updated_at = ?
                WHERE source_id = ? OR target_id = ?
                """,
                (_now(), node_id, node_id),
            )
            self._audit(connection, "archive", "node", node_id, before, None, actor)

    def create_edge(self, payload: dict[str, Any], actor: str = "local-user") -> dict[str, Any]:
        source = str(payload.get("source_id") or payload.get("from") or "").strip()
        target = str(payload.get("target_id") or payload.get("to") or "").strip()
        relation = str(payload.get("relation") or "").strip()
        if not source or not target or source == target or not relation:
            raise ValueError("关系必须包含不同的起点、终点和关系类型")
        confidence = float(payload.get("confidence", 0.8))
        if not 0 <= confidence <= 1:
            raise ValueError("confidence 必须位于 0 到 1")
        edge_id = str(payload.get("id") or uuid.uuid4().hex)
        timestamp = _now()
        with self._connect() as connection:
            for node_id in (source, target):
                if not connection.execute(
                    "SELECT 1 FROM graph_nodes WHERE id = ? AND status = 'active'",
                    (node_id,),
                ).fetchone():
                    raise ValueError(f"节点不存在或已归档: {node_id}")
            connection.execute(
                """
                INSERT INTO graph_edges
                (id, source_id, target_id, relation, confidence, status, version,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)
                """,
                (edge_id, source, target, relation, confidence, timestamp, timestamp),
            )
            created = _row(
                connection.execute(
                    "SELECT * FROM graph_edges WHERE id = ?", (edge_id,)
                ).fetchone()
            )
            self._audit(connection, "create", "edge", edge_id, None, created, actor)
        return created or {}

    def archive_edge(self, edge_id: str, actor: str = "local-user") -> None:
        with self._connect() as connection:
            before = _row(
                connection.execute(
                    "SELECT * FROM graph_edges WHERE id = ?", (edge_id,)
                ).fetchone()
            )
            if before is None:
                raise KeyError(edge_id)
            connection.execute(
                """
                UPDATE graph_edges SET status = 'archived', version = version + 1,
                    updated_at = ? WHERE id = ?
                """,
                (_now(), edge_id),
            )
            self._audit(connection, "archive", "edge", edge_id, before, None, actor)

    def create_evidence(
        self, payload: dict[str, Any], actor: str = "local-user"
    ) -> dict[str, Any]:
        node_id = str(payload.get("node_id") or "").strip() or None
        edge_id = str(payload.get("edge_id") or "").strip() or None
        title = str(payload.get("title") or "").strip()
        url = str(payload.get("url") or "").strip()
        source = str(payload.get("source") or "").strip()
        if not (node_id or edge_id) or not title or not url or not source:
            raise ValueError("证据必须关联节点或关系，并包含标题、URL和来源")
        confidence = float(payload.get("confidence", 0.7))
        if not 0 <= confidence <= 1:
            raise ValueError("confidence 必须位于 0 到 1")
        content_hash = hashlib.sha256(f"{title}|{url}".encode("utf-8")).hexdigest()
        evidence_id = str(payload.get("id") or uuid.uuid4().hex)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO graph_evidence
                (id, node_id, edge_id, title, url, source, published_at,
                 captured_at, confidence, content_hash, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
                """,
                (
                    evidence_id,
                    node_id,
                    edge_id,
                    title,
                    url,
                    source,
                    payload.get("published_at"),
                    _now(),
                    confidence,
                    content_hash,
                ),
            )
            created = _row(
                connection.execute(
                    "SELECT * FROM graph_evidence WHERE id = ?", (evidence_id,)
                ).fetchone()
            )
            self._audit(
                connection,
                "create",
                "evidence",
                evidence_id,
                None,
                created,
                actor,
            )
        return created or {}

    def archive_evidence(self, evidence_id: str, actor: str = "local-user") -> None:
        with self._connect() as connection:
            before = _row(
                connection.execute(
                    "SELECT * FROM graph_evidence WHERE id = ?", (evidence_id,)
                ).fetchone()
            )
            if before is None:
                raise KeyError(evidence_id)
            connection.execute(
                "UPDATE graph_evidence SET status = 'archived' WHERE id = ?",
                (evidence_id,),
            )
            self._audit(
                connection,
                "archive",
                "evidence",
                evidence_id,
                before,
                None,
                actor,
            )

    def audit(self, limit: int = 100) -> list[dict[str, Any]]:
        safe_limit = max(1, min(500, int(limit)))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM graph_audit ORDER BY id DESC LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            before_json = item.pop("before_json", None)
            after_json = item.pop("after_json", None)
            item["before"] = json.loads(before_json) if before_json else None
            item["after"] = json.loads(after_json) if after_json else None
            result.append(item)
        return result

    def _validate_node(
        self, payload: dict[str, Any], *, partial: bool
    ) -> dict[str, Any]:
        result: dict[str, Any] = {}
        required = ("id", "label", "stage", "domain", "risk")
        if not partial:
            missing = [key for key in required if not str(payload.get(key) or "").strip()]
            if missing:
                raise ValueError(f"缺少字段: {', '.join(missing)}")
        if "id" in payload:
            node_id = str(payload["id"]).strip().lower()
            if not NODE_ID_PATTERN.fullmatch(node_id):
                raise ValueError("节点ID仅允许2-64位小写字母、数字、下划线或连字符")
            result["id"] = node_id
        for key in ("label", "stage", "domain", "description", "website"):
            if key in payload:
                result[key] = str(payload.get(key) or "").strip()
        if "node_type" in payload or not partial:
            result["node_type"] = str(payload.get("node_type") or "protocol").strip()
        if "risk" in payload:
            risk = str(payload["risk"]).strip().lower()
            if risk not in RISK_LEVELS:
                raise ValueError(f"risk 必须是: {', '.join(sorted(RISK_LEVELS))}")
            result["risk"] = risk
        if "entities" in payload or not partial:
            entities = payload.get("entities") or []
            if not isinstance(entities, list):
                raise ValueError("entities 必须是数组")
            result["entities"] = list(
                dict.fromkeys(str(entity).strip() for entity in entities if str(entity).strip())
            )[:50]
        if not partial:
            result.setdefault("description", "")
            result.setdefault("website", "")
        return result

    def _replace_entities(
        self, connection: sqlite3.Connection, node_id: str, entities: list[str]
    ) -> None:
        connection.execute("DELETE FROM graph_entities WHERE node_id = ?", (node_id,))
        connection.executemany(
            "INSERT INTO graph_entities (id, node_id, name) VALUES (?, ?, ?)",
            [(uuid.uuid4().hex, node_id, entity) for entity in entities],
        )

    def _get_node(
        self, connection: sqlite3.Connection, node_id: str
    ) -> dict[str, Any] | None:
        node = _row(
            connection.execute(
                "SELECT * FROM graph_nodes WHERE id = ?", (node_id,)
            ).fetchone()
        )
        if node is None:
            return None
        node["entities"] = [
            row["name"]
            for row in connection.execute(
                "SELECT name FROM graph_entities WHERE node_id = ? ORDER BY name",
                (node_id,),
            )
        ]
        return node

    def _audit(
        self,
        connection: sqlite3.Connection,
        action: str,
        entity_type: str,
        entity_id: str,
        before: Any,
        after: Any,
        actor: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO graph_audit
            (action, entity_type, entity_id, actor, before_json, after_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                action,
                entity_type,
                entity_id,
                actor,
                _json(before) if before is not None else None,
                _json(after) if after is not None else None,
                _now(),
            ),
        )


def get_knowledge_graph_repository() -> KnowledgeGraphRepository:
    global _REPOSITORY
    if _REPOSITORY is None:
        with _REPOSITORY_LOCK:
            if _REPOSITORY is None:
                _REPOSITORY = KnowledgeGraphRepository(GRAPH_DB_PATH)
    return _REPOSITORY
