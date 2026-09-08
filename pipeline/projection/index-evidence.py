#!/usr/bin/env python3
"""Deterministically rebuild the SQLite/D1 evidence projection from canonical YAML."""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

import yaml

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
from evidence_claims import relationships_for
from practice_observations import PracticeObservation, SelectionCondition

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"
MIGRATIONS_DIR = ROOT / "migrations"
PROJECTION_PATTERN = re.compile(r"^(?:main|[0-9a-f]{12})$")


def apply_migrations(connection: sqlite3.Connection) -> None:
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        connection.executescript(migration.read_text(encoding="utf-8"))


def practice_observations_for(record: dict, projection_id: str, evidence_id: str) -> list[PracticeObservation]:
    observations = []
    for item in record.get("practice_observations") or []:
        observations.append(
            PracticeObservation(
                id=item["id"],
                projection_id=projection_id,
                evidence_id=evidence_id,
                use_case=item["use_case"],
                problem=item["problem"],
                reported_practice=item["reported_practice"],
                selection_conditions=tuple(SelectionCondition(value) for value in item["selection_conditions"]),
            )
        )
    return observations


def project_record(connection: sqlite3.Connection, path: Path, projection_id: str) -> None:
    record = yaml.safe_load(path.read_text(encoding="utf-8"))
    source = record["source"]
    presentation = record["presentation"]
    scale = record["scale"]
    mapping = record["mapping"]
    transition = mapping.get("transition") or {}
    implication = record["model_implication"]
    evidence_id = path.stem

    connection.execute(
        """
        INSERT INTO evidence (
          projection_id, evidence_id, github_path, source_title, source_date, producer,
          producer_type, source_type, provenance, source_url, headline, summary,
          observed_json, scale_label, scale_summary, transition_from, transition_to,
          adjacent_stage, interpretation, verdict, verdict_explanation, limitations_json,
          open_question, assisted_by_ai
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            projection_id, evidence_id, path.relative_to(ROOT).as_posix(), source["title"], str(source["date"]),
            source["producer"], source["producer_type"], source["type"], source["provenance"],
            source["url"], presentation["headline"], presentation.get("summary"),
            json.dumps(record["observed"], ensure_ascii=False, separators=(",", ":")),
            scale["label"], scale["summary"], transition.get("from"), transition.get("to"),
            transition.get("adjacent_stage"), record["interpretation"], implication["verdict"],
            implication["explanation"],
            json.dumps(record["what_this_does_not_establish"], ensure_ascii=False, separators=(",", ":")),
            record["open_question"], int(record["assessment"]["assisted_by_ai"]),
        ),
    )
    connection.executemany(
        "INSERT INTO evidence_stages (projection_id, evidence_id, stage) VALUES (?, ?, ?)",
        [(projection_id, evidence_id, stage) for stage in sorted(mapping["stages"])],
    )
    connection.executemany(
        "INSERT INTO evidence_conditions (projection_id, evidence_id, condition) VALUES (?, ?, ?)",
        [(projection_id, evidence_id, condition) for condition in sorted(mapping["conditions"])],
    )
    connection.executemany(
        "INSERT INTO evidence_claims (projection_id, evidence_id, claim_id, relationship) VALUES (?, ?, ?, ?)",
        [
            (projection_id, evidence_id, item["id"], item["relationship"])
            for item in sorted(relationships_for(path), key=lambda item: item["id"])
        ],
    )

    observations = practice_observations_for(record, projection_id, evidence_id)
    connection.executemany(
        """INSERT INTO practice_observations
           (projection_id, evidence_id, observation_id, use_case, problem, reported_practice)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (
                observation.projection_id,
                observation.evidence_id,
                observation.id,
                observation.use_case,
                observation.problem,
                observation.reported_practice,
            )
            for observation in observations
        ],
    )
    connection.executemany(
        """INSERT INTO practice_observation_conditions
           (projection_id, evidence_id, observation_id, condition)
           VALUES (?, ?, ?, ?)""",
        [
            (observation.projection_id, observation.evidence_id, observation.id, condition.value)
            for observation in observations
            for condition in observation.selection_conditions
        ],
    )


def rebuild(database: Path, projection_id: str = "main") -> int:
    if not PROJECTION_PATTERN.fullmatch(projection_id):
        raise ValueError("projection_id must be 'main' or a 12-character lowercase hexadecimal commit SHA")
    database.parent.mkdir(parents=True, exist_ok=True)
    temporary = database.with_name(database.name + ".tmp")
    temporary.unlink(missing_ok=True)

    connection = sqlite3.connect(temporary)
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        apply_migrations(connection)
        with connection:
            for path in sorted(EVIDENCE_DIR.glob("*.yaml")):
                project_record(connection, path, projection_id)
        count = connection.execute("SELECT COUNT(*) FROM evidence WHERE projection_id = ?", (projection_id,)).fetchone()[0]
        connection.execute("PRAGMA optimize")
    except Exception:
        connection.close()
        temporary.unlink(missing_ok=True)
        raise
    else:
        connection.close()

    temporary.replace(database)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=ROOT / ".artifacts" / "evidence.db")
    parser.add_argument("--projection", default="main")
    args = parser.parse_args()
    count = rebuild(args.database.resolve(), args.projection)
    print(f"Rebuilt evidence projection {args.projection}: {count} records -> {args.database}")


if __name__ == "__main__":
    main()
