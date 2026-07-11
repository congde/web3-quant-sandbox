from __future__ import annotations

import json
import hashlib
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class StrategyLabRepository:
    """SQLite-backed strategy and immutable version repository."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS strategies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'draft',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS strategy_versions (
                    id TEXT PRIMARY KEY,
                    strategy_id TEXT NOT NULL REFERENCES strategies(id),
                    version INTEGER NOT NULL,
                    parent_version_id TEXT,
                    spec_json TEXT NOT NULL,
                    dsl_code TEXT NOT NULL,
                    change_reason TEXT NOT NULL DEFAULT '',
                    created_by TEXT NOT NULL DEFAULT 'human',
                    llm_model TEXT,
                    status TEXT NOT NULL DEFAULT 'draft',
                    created_at TEXT NOT NULL,
                    UNIQUE(strategy_id, version)
                );
                CREATE TABLE IF NOT EXISTS llm_traces (
                    id TEXT PRIMARY KEY,
                    strategy_version_id TEXT REFERENCES strategy_versions(id),
                    task TEXT NOT NULL,
                    model TEXT,
                    prompt_hash TEXT,
                    input_json TEXT NOT NULL,
                    output_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS strategy_experiments (
                    id TEXT PRIMARY KEY,
                    strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
                    status TEXT NOT NULL DEFAULT 'queued',
                    experiment_type TEXT NOT NULL DEFAULT 'full_audit',
                    request_json TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    progress INTEGER NOT NULL DEFAULT 0,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT
                );
                CREATE TABLE IF NOT EXISTS job_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    experiment_id TEXT NOT NULL REFERENCES strategy_experiments(id),
                    level TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    message TEXT NOT NULL,
                    progress INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS promotion_decisions (
                    id TEXT PRIMARY KEY,
                    strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
                    from_status TEXT NOT NULL,
                    to_status TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS paper_runs (
                    id TEXT PRIMARY KEY,
                    strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
                    status TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    stopped_at TEXT,
                    notes TEXT NOT NULL DEFAULT ''
                );
                """
            )

    def create_strategy(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValueError("策略名称不能为空")
        now = datetime.now(timezone.utc).isoformat()
        strategy_id = str(uuid.uuid4())
        with self._connect() as db:
            db.execute(
                "INSERT INTO strategies(id,name,description,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                (strategy_id, name, str(payload.get("description") or ""), "draft", now, now),
            )
        return self.get_strategy(strategy_id)

    def list_strategies(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                """SELECT s.*, COUNT(v.id) AS version_count, MAX(v.version) AS latest_version
                FROM strategies s LEFT JOIN strategy_versions v ON v.strategy_id=s.id
                GROUP BY s.id ORDER BY s.updated_at DESC"""
            ).fetchall()
        return [dict(row) for row in rows]

    def get_strategy(self, strategy_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM strategies WHERE id=?", (strategy_id,)).fetchone()
        if row is None:
            raise KeyError("策略不存在")
        result = dict(row)
        result["versions"] = self.list_versions(strategy_id)
        return result

    def create_version(self, strategy_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        spec = payload.get("spec")
        dsl_code = str(payload.get("dsl_code") or payload.get("dslCode") or "")
        if not isinstance(spec, dict):
            raise ValueError("缺少结构化 StrategySpec")
        if not dsl_code.strip():
            raise ValueError("缺少 DSL 代码")
        now = datetime.now(timezone.utc).isoformat()
        version_id = str(uuid.uuid4())
        with self._connect() as db:
            exists = db.execute("SELECT id FROM strategies WHERE id=?", (strategy_id,)).fetchone()
            if exists is None:
                raise KeyError("策略不存在")
            version = int(db.execute("SELECT COALESCE(MAX(version),0)+1 FROM strategy_versions WHERE strategy_id=?", (strategy_id,)).fetchone()[0])
            db.execute(
                """INSERT INTO strategy_versions
                (id,strategy_id,version,parent_version_id,spec_json,dsl_code,change_reason,created_by,llm_model,status,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (version_id, strategy_id, version, payload.get("parent_version_id"), json.dumps(spec, ensure_ascii=False), dsl_code, str(payload.get("change_reason") or ""), str(payload.get("created_by") or "human"), payload.get("llm_model"), str(payload.get("status") or "draft"), now),
            )
            db.execute("UPDATE strategies SET updated_at=? WHERE id=?", (now, strategy_id))
        return self.get_version(version_id)

    def list_versions(self, strategy_id: str) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM strategy_versions WHERE strategy_id=? ORDER BY version DESC", (strategy_id,)).fetchall()
        return [self._version_dict(row) for row in rows]

    def get_version(self, version_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM strategy_versions WHERE id=?", (version_id,)).fetchone()
        if row is None:
            raise KeyError("策略版本不存在")
        return self._version_dict(row)

    def create_experiment(self, version_id: str, request: dict[str, Any]) -> dict[str, Any]:
        self.get_version(version_id)
        experiment_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as db:
            db.execute("INSERT INTO strategy_experiments(id,strategy_version_id,status,experiment_type,request_json,progress,created_at) VALUES(?,?,?,?,?,?,?)", (experiment_id, version_id, "queued", str(request.get("experiment_type") or "full_audit"), json.dumps(request, ensure_ascii=False), 0, now))
        self.add_event(experiment_id, "info", "queued", "实验已进入任务队列", 0)
        return self.get_experiment(experiment_id)

    def update_experiment(self, experiment_id: str, *, status: str, progress: int, result: dict[str, Any] | None = None, error: str | None = None, phase: str = "running", message: str = "") -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as db:
            current = db.execute("SELECT status FROM strategy_experiments WHERE id=?", (experiment_id,)).fetchone()
            if current is None:
                raise KeyError("实验不存在")
            started = now if status == "running" and current[0] == "queued" else None
            completed = now if status in {"completed", "failed", "cancelled"} else None
            db.execute("UPDATE strategy_experiments SET status=?,progress=?,result_json=COALESCE(?,result_json),error=COALESCE(?,error),started_at=COALESCE(started_at,?),completed_at=COALESCE(completed_at,?) WHERE id=?", (status, max(0, min(100, progress)), json.dumps(result, ensure_ascii=False) if result is not None else None, error, started, completed, experiment_id))
        if message:
            self.add_event(experiment_id, "error" if status == "failed" else "info", phase, message, progress)
        return self.get_experiment(experiment_id)

    def request_cancel(self, experiment_id: str) -> dict[str, Any]:
        with self._connect() as db:
            if db.execute("UPDATE strategy_experiments SET cancel_requested=1 WHERE id=?", (experiment_id,)).rowcount == 0:
                raise KeyError("实验不存在")
        self.add_event(experiment_id, "warning", "cancel", "已请求取消实验", 0)
        return self.get_experiment(experiment_id)

    def cancel_requested(self, experiment_id: str) -> bool:
        with self._connect() as db:
            row = db.execute("SELECT cancel_requested FROM strategy_experiments WHERE id=?", (experiment_id,)).fetchone()
        return bool(row and row[0])

    def get_experiment(self, experiment_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM strategy_experiments WHERE id=?", (experiment_id,)).fetchone()
            events = db.execute("SELECT level,phase,message,progress,created_at FROM job_events WHERE experiment_id=? ORDER BY id", (experiment_id,)).fetchall()
        if row is None:
            raise KeyError("实验不存在")
        result = dict(row)
        result["request"] = json.loads(result.pop("request_json"))
        result["result"] = json.loads(result.pop("result_json")) if result.get("result_json") else None
        result["events"] = [dict(item) for item in events]
        result["cancel_requested"] = bool(result["cancel_requested"])
        return result

    def list_experiments(self, version_id: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT id FROM strategy_experiments WHERE strategy_version_id=? ORDER BY created_at DESC", (version_id,)).fetchall() if version_id else db.execute("SELECT id FROM strategy_experiments ORDER BY created_at DESC LIMIT 100").fetchall()
        return [self.get_experiment(row[0]) for row in rows]

    def add_event(self, experiment_id: str, level: str, phase: str, message: str, progress: int) -> None:
        with self._connect() as db:
            db.execute("INSERT INTO job_events(experiment_id,level,phase,message,progress,created_at) VALUES(?,?,?,?,?,?)", (experiment_id, level, phase, message, progress, datetime.now(timezone.utc).isoformat()))

    def promote_version(self, version_id: str, *, to_status: str, reason: str, actor: str = "human") -> dict[str, Any]:
        allowed = {"draft": {"validated", "rejected"}, "validated": {"backtested", "rejected"}, "backtested": {"robustness_passed", "rejected"}, "robustness_passed": {"approved", "rejected"}, "approved": {"paper_running", "retired"}, "paper_running": {"approved", "retired"}, "rejected": {"draft"}, "retired": set()}
        current = self.get_version(version_id)
        if to_status not in allowed.get(current["status"], set()):
            raise ValueError(f"非法状态流转: {current['status']} -> {to_status}")
        now, decision_id = datetime.now(timezone.utc).isoformat(), str(uuid.uuid4())
        with self._connect() as db:
            db.execute("UPDATE strategy_versions SET status=? WHERE id=?", (to_status, version_id))
            db.execute("INSERT INTO promotion_decisions(id,strategy_version_id,from_status,to_status,decision,reason,actor,created_at) VALUES(?,?,?,?,?,?,?,?)", (decision_id, version_id, current["status"], to_status, "approve" if to_status != "rejected" else "reject", reason, actor, now))
        return self.get_version(version_id)

    def list_audit(self, version_id: str) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM promotion_decisions WHERE strategy_version_id=? ORDER BY created_at DESC", (version_id,)).fetchall()
        return [dict(row) for row in rows]

    def record_llm_trace(self, *, task: str, input_payload: dict[str, Any], output_payload: dict[str, Any], version_id: str | None = None, model: str | None = None, prompt: str = "") -> dict[str, Any]:
        trace_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest() if prompt else None
        with self._connect() as db:
            db.execute("INSERT INTO llm_traces(id,strategy_version_id,task,model,prompt_hash,input_json,output_json,created_at) VALUES(?,?,?,?,?,?,?,?)", (trace_id, version_id, task, model, prompt_hash, json.dumps(input_payload, ensure_ascii=False), json.dumps(output_payload, ensure_ascii=False), now))
        return {"id": trace_id, "task": task, "model": model, "prompt_hash": prompt_hash, "created_at": now}

    def list_llm_traces(self, version_id: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM llm_traces WHERE strategy_version_id=? ORDER BY created_at DESC", (version_id,)).fetchall() if version_id else db.execute("SELECT * FROM llm_traces ORDER BY created_at DESC LIMIT 100").fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["input"] = json.loads(item.pop("input_json"))
            item["output"] = json.loads(item.pop("output_json"))
            result.append(item)
        return result

    def start_paper_run(self, version_id: str, notes: str = "") -> dict[str, Any]:
        version = self.get_version(version_id)
        if version["status"] != "approved":
            raise ValueError("只有 approved 版本可以进入模拟运行")
        run_id, now = str(uuid.uuid4()), datetime.now(timezone.utc).isoformat()
        with self._connect() as db:
            db.execute("INSERT INTO paper_runs(id,strategy_version_id,status,started_at,notes) VALUES(?,?,?,?,?)", (run_id, version_id, "running", now, notes))
            db.execute("UPDATE strategy_versions SET status='paper_running' WHERE id=?", (version_id,))
            db.execute("INSERT INTO promotion_decisions(id,strategy_version_id,from_status,to_status,decision,reason,actor,created_at) VALUES(?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), version_id, "approved", "paper_running", "paper_start", notes or "启动模拟运行", "human", now))
        return self.get_paper_run(run_id)

    def stop_paper_run(self, run_id: str, notes: str = "") -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as db:
            row = db.execute("SELECT strategy_version_id,status FROM paper_runs WHERE id=?", (run_id,)).fetchone()
            if row is None: raise KeyError("模拟运行不存在")
            if row["status"] != "running": raise ValueError("模拟运行已经停止")
            db.execute("UPDATE paper_runs SET status='stopped',stopped_at=?,notes=? WHERE id=?", (now, notes, run_id))
            db.execute("UPDATE strategy_versions SET status='approved' WHERE id=?", (row["strategy_version_id"],))
        return self.get_paper_run(run_id)

    def get_paper_run(self, run_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute("SELECT * FROM paper_runs WHERE id=?", (run_id,)).fetchone()
        if row is None: raise KeyError("模拟运行不存在")
        return dict(row)

    def list_paper_runs(self, version_id: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM paper_runs WHERE strategy_version_id=? ORDER BY started_at DESC", (version_id,)).fetchall() if version_id else db.execute("SELECT * FROM paper_runs ORDER BY started_at DESC LIMIT 100").fetchall()
        return [dict(row) for row in rows]

    def delete_version(self, version_id: str) -> None:
        version = self.get_version(version_id)
        if version["status"] != "draft":
            raise ValueError("只有 draft 版本可以删除")
        with self._connect() as db:
            experiments = int(db.execute("SELECT COUNT(*) FROM strategy_experiments WHERE strategy_version_id=?", (version_id,)).fetchone()[0])
            if experiments:
                raise ValueError("该版本已关联实验，不能删除")
            db.execute("DELETE FROM llm_traces WHERE strategy_version_id=?", (version_id,))
            db.execute("DELETE FROM promotion_decisions WHERE strategy_version_id=?", (version_id,))
            db.execute("DELETE FROM paper_runs WHERE strategy_version_id=?", (version_id,))
            db.execute("DELETE FROM strategy_versions WHERE id=?", (version_id,))
            db.execute("UPDATE strategies SET updated_at=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), version["strategy_id"]))

    def delete_strategy(self, strategy_id: str) -> None:
        strategy = self.get_strategy(strategy_id)
        if any(version["status"] != "draft" for version in strategy["versions"]):
            raise ValueError("策略包含非草稿版本，不能删除")
        with self._connect() as db:
            linked = int(db.execute("SELECT COUNT(*) FROM strategy_experiments e JOIN strategy_versions v ON v.id=e.strategy_version_id WHERE v.strategy_id=?", (strategy_id,)).fetchone()[0])
            if linked:
                raise ValueError("策略包含实验记录，不能删除")
            version_ids = [row[0] for row in db.execute("SELECT id FROM strategy_versions WHERE strategy_id=?", (strategy_id,)).fetchall()]
            for version_id in version_ids:
                db.execute("DELETE FROM llm_traces WHERE strategy_version_id=?", (version_id,))
                db.execute("DELETE FROM promotion_decisions WHERE strategy_version_id=?", (version_id,))
                db.execute("DELETE FROM paper_runs WHERE strategy_version_id=?", (version_id,))
            db.execute("DELETE FROM strategy_versions WHERE strategy_id=?", (strategy_id,))
            db.execute("DELETE FROM strategies WHERE id=?", (strategy_id,))

    @staticmethod
    def _version_dict(row: sqlite3.Row) -> dict[str, Any]:
        result = dict(row)
        result["spec"] = json.loads(result.pop("spec_json"))
        return result
