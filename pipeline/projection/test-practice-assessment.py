#!/usr/bin/env python3
"""Verify practice-assessment state and completeness denominator semantics."""
from __future__ import annotations

import importlib.util
import sqlite3
import tempfile
from pathlib import Path

import yaml

INDEXER_PATH = Path(__file__).with_name("index-evidence.py")
spec = importlib.util.spec_from_file_location("index_evidence", INDEXER_PATH)
index_evidence = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(index_evidence)


def evidence_record(status=None, observations=None):
    record = {
        "source": {"title":"Source","date":"2026-01-01","producer":"Producer","producer_type":"organization","type":"engineering-blog","provenance":"primary","url":"https://example.com"},
        "presentation": {"headline":"Headline","summary":"Summary"},
        "observed": ["Observed"],
        "scale": {"label":"Scale signal","summary":"Summary"},
        "mapping": {"stages":["Selection"],"conditions":["Context"]},
        "interpretation": "Interpretation",
        "model_implication": {"verdict":"SUPPORTS","explanation":"Explanation"},
        "what_this_does_not_establish": ["Limitation"],
        "open_question": "Question",
        "assessment": {"assisted_by_ai": False},
    }
    if status is not None:
        record["practice_assessment"] = {"status": status}
    if observations is not None:
        record["practice_observations"] = observations
    return record


def write_record(directory: Path, evidence_id: str, record: dict) -> Path:
    path = directory / f"{evidence_id}.yaml"
    path.write_text(yaml.safe_dump(record, sort_keys=False), encoding="utf-8")
    return path


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    index_evidence.apply_migrations(db)
    return db


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        directory = Path(tmp)
        pending = write_record(directory, "pending", evidence_record())
        assessed = write_record(directory, "assessed", evidence_record("assessed"))

        db = connection()
        index_evidence.project_record(db, pending, "main")
        index_evidence.project_record(db, assessed, "main")

        assert db.execute("SELECT status FROM practice_assessments WHERE evidence_id='pending'").fetchone()[0] == "pending"
        assert db.execute("SELECT status FROM practice_assessments WHERE evidence_id='assessed'").fetchone()[0] == "assessed"
        assert db.execute("SELECT COUNT(*) FROM practice_assessments").fetchone()[0] == 2
        assert db.execute("SELECT COUNT(*) FROM practice_observations WHERE evidence_id='assessed'").fetchone()[0] == 0

        # Same evidence in another projection receives an independent assessment row.
        index_evidence.project_record(db, assessed, "0123456789ab")
        assert db.execute("SELECT COUNT(*) FROM practice_assessments WHERE evidence_id='assessed'").fetchone()[0] == 2

        # Assessment belongs to evidence and cascades with it.
        db.execute("DELETE FROM evidence WHERE projection_id='main' AND evidence_id='assessed'")
        assert db.execute("SELECT COUNT(*) FROM practice_assessments WHERE projection_id='main' AND evidence_id='assessed'").fetchone()[0] == 0
        db.close()

    print("Practice assessment projection passed")


if __name__ == "__main__":
    main()
