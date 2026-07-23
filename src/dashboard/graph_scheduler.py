"""Small in-process scheduler for knowledge-graph ingestion."""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone

from dashboard.knowledge_graph import get_knowledge_graph_repository


class KnowledgeGraphScheduler:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._run_lock = threading.Lock()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(
            target=self._loop,
            name="knowledge-graph-scheduler",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.wait(30):
            try:
                self.run_if_due()
            except Exception as error:  # pragma: no cover - defensive scheduler guard
                print(f"[knowledge-graph-scheduler] {error}", flush=True)

    def run_if_due(self) -> bool:
        repository = get_knowledge_graph_repository()
        status = repository.ingestion_status()
        schedule = status["schedule"]
        if not schedule.get("enabled") or not self._run_lock.acquire(blocking=False):
            return False
        try:
            latest = status.get("latest_run")
            if latest and latest.get("started_at"):
                last_started = datetime.fromisoformat(latest["started_at"])
                due_at = last_started + timedelta(
                    minutes=int(schedule["interval_minutes"])
                )
                if datetime.now(timezone.utc) < due_at:
                    return False
            from dashboard.api import run_web3_graph_ingestion

            run_web3_graph_ingestion(refresh=True, use_llm=True)
            return True
        finally:
            self._run_lock.release()


GRAPH_SCHEDULER = KnowledgeGraphScheduler()
