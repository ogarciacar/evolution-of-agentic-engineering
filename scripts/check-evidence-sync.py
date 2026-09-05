#!/usr/bin/env python3
"""Verify the D1 synchronization SQL reproduces the S3 logical projection."""
from __future__ import annotations

import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEXER = ROOT / "scripts" / "index-evidence.py"
EXPORTER = ROOT / "scripts" / "export-evidence-sql.py"
MIGRATIONS = ROOT / "migrations"
TABLES = ("evidence", "evidence_stages", "evidence_conditions")


def snapshot(path: Path) -> tuple:
    connection = sqlite3.connect(path)
    try:
        result = []
        for table in TABLES:
            columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]
            order = ", ".join(columns)
            result.append((table, connection.execute(f"SELECT * FROM {table} ORDER BY {order}").fetchall()))
        return tuple(result)
    finally:
        connection.close()


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        canonical_db = root / "canonical.db"
        remote_shape_db = root / "remote.db"
        sync_sql = root / "sync.sql"

        subprocess.run([sys.executable, str(INDEXER), "--database", str(canonical_db)], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(EXPORTER), "--output", str(sync_sql)], cwd=ROOT, check=True)

        connection = sqlite3.connect(remote_shape_db)
        connection.execute("PRAGMA foreign_keys = ON")
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            connection.executescript(migration.read_text(encoding="utf-8"))
        connection.executescript(sync_sql.read_text(encoding="utf-8"))
        connection.close()

        assert snapshot(canonical_db) == snapshot(remote_shape_db), "D1 sync export differs from S3 projection"

        # Running the same synchronization again must converge to the same state.
        before = snapshot(remote_shape_db)
        connection = sqlite3.connect(remote_shape_db)
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(sync_sql.read_text(encoding="utf-8"))
        connection.close()
        assert before == snapshot(remote_shape_db), "Repeated synchronization changed logical state"

        print("D1 synchronization export matches the deterministic S3 projection")


if __name__ == "__main__":
    main()
