#!/usr/bin/env python3
"""Verify deterministic and complete evidence projection rebuilds."""
from __future__ import annotations

import hashlib
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEXER = ROOT / "scripts" / "index-evidence.py"


def rebuild(path: Path) -> None:
    subprocess.run([sys.executable, str(INDEXER), "--database", str(path)], cwd=ROOT, check=True)


def logical_snapshot(path: Path) -> bytes:
    connection = sqlite3.connect(path)
    try:
        parts: list[str] = []
        for table, order_by in (
            ("evidence", "evidence_id"),
            ("evidence_stages", "evidence_id, stage"),
            ("evidence_conditions", "evidence_id, condition"),
        ):
            rows = connection.execute(f"SELECT * FROM {table} ORDER BY {order_by}").fetchall()
            parts.append(repr((table, rows)))
        return "\n".join(parts).encode("utf-8")
    finally:
        connection.close()


def assert_counts(path: Path) -> None:
    expected = len(list((ROOT / "evidence").glob("*.yaml")))
    connection = sqlite3.connect(path)
    try:
        actual = connection.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
        assert actual == expected, f"Expected {expected} evidence rows, found {actual}"
    finally:
        connection.close()


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        first = root / "first.db"
        second = root / "second.db"

        rebuild(first)
        rebuild(second)
        assert_counts(first)
        assert_counts(second)

        snapshot_a = logical_snapshot(first)
        snapshot_b = logical_snapshot(second)
        assert snapshot_a == snapshot_b, "Independent rebuilds produced different logical projections"

        before = hashlib.sha256(snapshot_a).hexdigest()
        rebuild(first)
        after_snapshot = logical_snapshot(first)
        after = hashlib.sha256(after_snapshot).hexdigest()
        assert snapshot_a == after_snapshot, "Rebuilding an existing target changed logical projection state"

        print(f"Deterministic evidence indexer passed: sha256={before}")
        assert before == after


if __name__ == "__main__":
    main()
