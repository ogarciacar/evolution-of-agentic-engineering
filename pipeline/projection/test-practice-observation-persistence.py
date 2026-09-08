#!/usr/bin/env python3
"""Verify D1 constraints for evidence-scoped practice observations."""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "migrations"


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        db.executescript(migration.read_text(encoding="utf-8"))
    return db


def insert_evidence(db: sqlite3.Connection, projection_id: str, evidence_id: str) -> None:
    db.execute(
        """INSERT INTO evidence (
          projection_id, evidence_id, github_path, source_title, source_date, producer,
          producer_type, source_type, provenance, source_url, headline, observed_json,
          scale_label, scale_summary, interpretation, verdict, verdict_explanation,
          limitations_json, open_question, assisted_by_ai
        ) VALUES (?, ?, ?, 'Source', '2026-01-01', 'Producer', 'company', 'article',
                  'first_party', 'https://example.com', 'Headline', '[]', 'Scale', 'Summary',
                  'Interpretation', 'supports', 'Explanation', '[]', 'Question', 0)""",
        (projection_id, evidence_id, f"evidence/{evidence_id}.yaml"),
    )


def insert_observation(db: sqlite3.Connection, projection_id: str, evidence_id: str, observation_id: str) -> None:
    db.execute(
        """INSERT INTO practice_observations
           (projection_id, evidence_id, observation_id, use_case, problem, reported_practice)
           VALUES (?, ?, ?, 'Use case', 'Problem', 'Practice')""",
        (projection_id, evidence_id, observation_id),
    )


def expect_integrity_error(action) -> None:
    try:
        action()
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Expected sqlite3.IntegrityError")


def main() -> None:
    db = connection()
    insert_evidence(db, "main", "evidence-a")
    insert_evidence(db, "main", "evidence-b")
    insert_evidence(db, "0123456789ab", "evidence-a")

    insert_observation(db, "main", "evidence-a", "obs-1")
    insert_observation(db, "main", "evidence-a", "obs-2")
    db.execute(
        "INSERT INTO practice_observation_conditions VALUES ('main', 'evidence-a', 'obs-1', 'context')"
    )
    db.execute(
        "INSERT INTO practice_observation_conditions VALUES ('main', 'evidence-a', 'obs-1', 'learning')"
    )

    # Observation IDs are local to one evidence item in one projection.
    insert_observation(db, "main", "evidence-b", "obs-1")
    insert_observation(db, "0123456789ab", "evidence-a", "obs-1")

    expect_integrity_error(lambda: insert_observation(db, "main", "evidence-a", "obs-1"))
    expect_integrity_error(
        lambda: db.execute(
            "INSERT INTO practice_observation_conditions VALUES ('main', 'evidence-a', 'obs-1', 'context')"
        )
    )
    expect_integrity_error(
        lambda: db.execute(
            "INSERT INTO practice_observation_conditions VALUES ('main', 'evidence-a', 'obs-1', 'unknown')"
        )
    )
    expect_integrity_error(lambda: insert_observation(db, "main", "missing-evidence", "obs-1"))

    # Cascades preserve projection/evidence ownership.
    db.execute("DELETE FROM evidence WHERE projection_id = 'main' AND evidence_id = 'evidence-a'")
    assert db.execute(
        "SELECT COUNT(*) FROM practice_observations WHERE projection_id = 'main' AND evidence_id = 'evidence-a'"
    ).fetchone()[0] == 0
    assert db.execute(
        "SELECT COUNT(*) FROM practice_observation_conditions WHERE projection_id = 'main' AND evidence_id = 'evidence-a'"
    ).fetchone()[0] == 0

    print("Practice observation persistence constraints passed")


if __name__ == "__main__":
    main()
