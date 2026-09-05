#!/usr/bin/env python3
"""Deterministically rebuild the SQLite/D1 evidence projection from canonical YAML."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
MIGRATIONS_DIR = ROOT / "migrations"


def apply_migrations(connection: sqlite3.Connection) -> None:
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        connection.executescript(migration.read_text(encoding="utf-8"))


def project_record(connection: sqlite3.Connection, path: Path) -> None:
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
          evidence_id, github_path, source_title, source_date, producer,
          producer_type, source_type, provenance, source_url, headline,
          summary, observed_json, scale_label, scale_summary,
          transition_from, transition_to, adjacent_stage, interpretation,
          verdict, verdict_explanation, limitations_json, open_question,
          assisted_by_ai
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            evidence_id, path.relative_to(ROOT).as_posix(), source["title"], str(source["date"]),
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
        "INSERT INTO evidence_stages (evidence_id, stage) VALUES (?, ?)",
        [(evidence_id, stage) for stage in sorted(mapping["stages"])],
    )
    connection.executemany(
        "INSERT INTO evidence_conditions (evidence_id, condition) VALUES (?, ?)",
        [(evidence_id, condition) for condition in sorted(mapping["conditions"])],
    )
    connection.executemany(
        "INSERT INTO evidence_claims (evidence_id, claim_id, relationship) VALUES (?, ?, ?)",
        [(evidence_id, item["id"], item["relationship"]) for item in sorted(record["claims"], key=lambda item: item["id"])],
    )


def rebuild(database: Path) -> int:
    database.parent.mkdir(parents=True, exist_ok=True)
    temporary = database.with_name(database.name + ".tmp")
    temporary.unlink(missing_ok=True)

    connection = sqlite3.connect(temporary)
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        apply_migrations(connection)
        with connection:
            for path in sorted(EVIDENCE_DIR.glob("*.yaml")):
                project_record(connection, path)
        count = connection.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
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
    args = parser.parse_args()
    count = rebuild(args.database.resolve())
    print(f"Rebuilt evidence projection: {count} records -> {args.database}")


if __name__ == "__main__":
    main()
