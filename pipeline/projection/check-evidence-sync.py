#!/usr/bin/env python3
"""Verify D1 synchronization is deterministic and projection-isolated."""
from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEXER = ROOT / "pipeline" / "projection" / "index-evidence.py"
EXPORTER = ROOT / "pipeline" / "projection" / "export-evidence-sql.py"
MIGRATIONS = ROOT / "migrations"
TABLES = (
    "evidence",
    "evidence_stages",
    "evidence_conditions",
    "evidence_claims",
    "practice_assessments",
    "practice_observations",
    "practice_observation_conditions",
)
SECOND_PROJECTION = "deadbeefcafe"


def snapshot(path: Path, projection_id: str) -> tuple:
    connection = sqlite3.connect(path)
    try:
        result = []
        for table in TABLES:
            columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
            order = ", ".join(columns)
            rows = connection.execute(
                f"SELECT * FROM {table} WHERE projection_id = ? ORDER BY {order}",
                (projection_id,),
            ).fetchall()
            result.append((table, rows))
        return tuple(result)
    finally:
        connection.close()


def run_export(output: Path, projection_id: str) -> None:
    subprocess.run(
        [sys.executable, str(EXPORTER), "--output", str(output), "--projection", projection_id],
        cwd=ROOT,
        check=True,
    )


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        canonical_db = root / "canonical.db"
        remote_shape_db = root / "remote.db"
        main_sync = root / "main.sql"
        second_sync = root / "second.sql"

        subprocess.run([sys.executable, str(INDEXER), "--database", str(canonical_db), "--projection", "main"], cwd=ROOT, check=True)
        run_export(main_sync, "main")
        run_export(second_sync, SECOND_PROJECTION)

        connection = sqlite3.connect(remote_shape_db)
        connection.execute("PRAGMA foreign_keys = ON")
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            connection.executescript(migration.read_text(encoding="utf-8"))
        connection.executescript(main_sync.read_text(encoding="utf-8"))
        connection.close()

        assert snapshot(canonical_db, "main") == snapshot(remote_shape_db, "main"), "main D1 sync differs from deterministic projection"

        connection = sqlite3.connect(remote_shape_db)
        observation_count = connection.execute(
            "SELECT COUNT(*) FROM practice_observations WHERE projection_id = 'main'"
        ).fetchone()[0]
        assessment_count = connection.execute(
            "SELECT COUNT(*) FROM practice_assessments WHERE projection_id = 'main'"
        ).fetchone()[0]
        connection.close()
        assert observation_count > 0, "D1 sync omitted practice observations"
        assert assessment_count > 0, "D1 sync omitted practice assessments"

        connection = sqlite3.connect(remote_shape_db)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(second_sync.read_text(encoding="utf-8"))
        connection.close()

        main_before = snapshot(remote_shape_db, "main")
        second_before = snapshot(remote_shape_db, SECOND_PROJECTION)
        assert main_before, "main projection missing after second projection sync"
        assert second_before, "second projection missing after sync"

        connection = sqlite3.connect(remote_shape_db)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(second_sync.read_text(encoding="utf-8"))
        connection.close()

        assert main_before == snapshot(remote_shape_db, "main"), "resynchronizing one projection changed main"
        assert second_before == snapshot(remote_shape_db, SECOND_PROJECTION), "repeated projection synchronization changed logical state"

        print("D1 synchronization is deterministic, complete, and projection-isolated")


if __name__ == "__main__":
    main()
