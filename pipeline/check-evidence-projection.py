#!/usr/bin/env python3
"""Verify the D1 evidence projection schema using Python's SQLite runtime."""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0001_evidence_projection.sql"

EXPECTED_TABLES = {"evidence", "evidence_stages", "evidence_conditions"}
EXPECTED_INDEXES = {
    "idx_evidence_source_date",
    "idx_evidence_producer",
    "idx_evidence_verdict",
    "idx_evidence_stages_stage",
    "idx_evidence_conditions_condition",
}


def names(connection: sqlite3.Connection, kind: str) -> set[str]:
    return {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'", (kind,)
        )
    }


def insert_sample(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        INSERT INTO evidence (
          evidence_id, github_path, source_title, source_date, producer,
          producer_type, source_type, provenance, source_url, headline,
          summary, observed_json, scale_label, scale_summary,
          transition_from, transition_to, adjacent_stage, interpretation,
          verdict, verdict_explanation, limitations_json, open_question,
          assisted_by_ai
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "2026-09-03-example", "evidence/2026-09-03-example.yaml", "Example source",
            "2026-09-03", "Example", "organization", "repository", "primary",
            "https://example.com/source", "Example headline", None,
            '["Observed fact"]', "Evidence boundary", "Example boundary",
            "Selection", "Cooperation", None, "Example interpretation", "REFINES",
            "Example implication", '["Does not establish scale"]', "What next?", 1,
        ),
    )
    connection.execute("INSERT INTO evidence_stages VALUES (?, ?)", ("2026-09-03-example", "Selection"))
    connection.execute("INSERT INTO evidence_stages VALUES (?, ?)", ("2026-09-03-example", "Cooperation"))
    connection.execute("INSERT INTO evidence_conditions VALUES (?, ?)", ("2026-09-03-example", "Coordination"))


def main() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(MIGRATION.read_text(encoding="utf-8"))

    assert EXPECTED_TABLES <= names(connection, "table")
    assert EXPECTED_INDEXES <= names(connection, "index")

    insert_sample(connection)

    result = connection.execute(
        """
        SELECT e.evidence_id
        FROM evidence e
        JOIN evidence_stages s ON s.evidence_id = e.evidence_id
        JOIN evidence_conditions c ON c.evidence_id = e.evidence_id
        WHERE s.stage = 'Cooperation'
          AND c.condition = 'Coordination'
          AND e.verdict = 'REFINES'
        """
    ).fetchall()
    assert result == [("2026-09-03-example",)]

    try:
        connection.execute(
            "INSERT INTO evidence_conditions VALUES (?, ?)",
            ("missing-evidence", "Context"),
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Foreign-key constraint is not enforced")

    try:
        connection.execute("UPDATE evidence SET observed_json = 'not-json'")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("JSON validity constraint is not enforced")

    connection.execute("DELETE FROM evidence WHERE evidence_id = '2026-09-03-example'")
    assert connection.execute("SELECT COUNT(*) FROM evidence_stages").fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM evidence_conditions").fetchone()[0] == 0

    print("Evidence projection contract is SQLite/D1-compatible")


if __name__ == "__main__":
    main()
