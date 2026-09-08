#!/usr/bin/env python3
"""Test YAML -> domain -> D1 practice-observation projection mechanics."""
from __future__ import annotations

import importlib.util
import sqlite3
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
INDEXER_PATH = Path(__file__).with_name("index-evidence.py")
spec = importlib.util.spec_from_file_location("index_evidence", INDEXER_PATH)
index_evidence = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(index_evidence)


def evidence_record(practice_observations=None):
    record = {
        "source": {
            "title": "Source",
            "date": "2026-01-01",
            "producer": "Spotify",
            "producer_type": "company",
            "type": "article",
            "provenance": "first_party",
            "url": "https://example.com",
        },
        "presentation": {"headline": "Headline", "summary": "Summary"},
        "observed": ["Observed"],
        "scale": {"label": "Scale", "summary": "Summary"},
        "mapping": {"stages": ["coding_agent"], "conditions": ["context"]},
        "interpretation": "Interpretation",
        "model_implication": {"verdict": "supports", "explanation": "Explanation"},
        "what_this_does_not_establish": ["Limitation"],
        "open_question": "Question",
        "assessment": {"assisted_by_ai": False},
    }
    if practice_observations is not None:
        record["practice_observations"] = practice_observations
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
    observations = [
        {
            "id": "lineage",
            "use_case": "Find affected repositories",
            "problem": "The agent must discover downstream consumers",
            "reported_practice": "Use dependency lineage",
            "selection_conditions": ["context"],
        },
        {
            "id": "repair-loop",
            "use_case": "Repair failed autonomous changes",
            "problem": "Verifier failures otherwise return work to a human",
            "reported_practice": "Feed failures back to the coding agent",
            "selection_conditions": ["verification", "learning"],
        },
    ]

    with tempfile.TemporaryDirectory() as tmp:
        directory = Path(tmp)
        path = write_record(directory, "spotify", evidence_record(observations))

        db = connection()
        index_evidence.project_record(db, path, "main")
        assert db.execute("SELECT COUNT(*) FROM practice_observations").fetchone()[0] == 2
        assert db.execute("SELECT COUNT(*) FROM practice_observation_conditions").fetchone()[0] == 3

        # Existing evidence with no practice_observations remains valid.
        no_observations = write_record(directory, "legacy", evidence_record())
        index_evidence.project_record(db, no_observations, "main")
        assert db.execute(
            "SELECT COUNT(*) FROM practice_observations WHERE evidence_id = 'legacy'"
        ).fetchone()[0] == 0

        # Projection identity isolates otherwise identical observations.
        index_evidence.project_record(db, path, "0123456789ab")
        assert db.execute(
            "SELECT COUNT(*) FROM practice_observations WHERE evidence_id = 'spotify'"
        ).fetchone()[0] == 4

        db.close()

        # Deterministic rebuild makes repeated ingestion idempotent.
        original_dir = index_evidence.EVIDENCE_DIR
        index_evidence.EVIDENCE_DIR = directory
        try:
            database = directory / "projection.db"
            index_evidence.rebuild(database, "main")
            first = sqlite3.connect(database)
            first_counts = (
                first.execute("SELECT COUNT(*) FROM practice_observations").fetchone()[0],
                first.execute("SELECT COUNT(*) FROM practice_observation_conditions").fetchone()[0],
            )
            first.close()

            index_evidence.rebuild(database, "main")
            second = sqlite3.connect(database)
            second_counts = (
                second.execute("SELECT COUNT(*) FROM practice_observations").fetchone()[0],
                second.execute("SELECT COUNT(*) FROM practice_observation_conditions").fetchone()[0],
            )
            second.close()
            assert first_counts == second_counts == (2, 3)
        finally:
            index_evidence.EVIDENCE_DIR = original_dir

    print("Practice observation ingestion passed")


if __name__ == "__main__":
    main()
