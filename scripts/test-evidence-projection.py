#!/usr/bin/env python3
"""Check that every canonical evidence record can be represented by the D1 projection."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
MIGRATION = ROOT / "migrations" / "0001_evidence_projection.sql"


def main() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(MIGRATION.read_text(encoding="utf-8"))

    paths = sorted(EVIDENCE_DIR.glob("*.yaml"))
    for path in paths:
        with path.open(encoding="utf-8") as handle:
            record = yaml.safe_load(handle)

        source = record["source"]
        presentation = record["presentation"]
        scale = record["scale"]
        mapping = record["mapping"]
        transition = mapping.get("transition") or {}
        implication = record["model_implication"]

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
                path.stem, path.relative_to(ROOT).as_posix(), source["title"], str(source["date"]),
                source["producer"], source["producer_type"], source["type"], source["provenance"],
                source["url"], presentation["headline"], presentation.get("summary"),
                json.dumps(record["observed"], ensure_ascii=False), scale["label"], scale["summary"],
                transition.get("from"), transition.get("to"), transition.get("adjacent_stage"),
                record["interpretation"], implication["verdict"], implication["explanation"],
                json.dumps(record["what_this_does_not_establish"], ensure_ascii=False),
                record["open_question"], int(record["assessment"]["assisted_by_ai"]),
            ),
        )
        connection.executemany(
            "INSERT INTO evidence_stages (evidence_id, stage) VALUES (?, ?)",
            [(path.stem, stage) for stage in mapping["stages"]],
        )
        connection.executemany(
            "INSERT INTO evidence_conditions (evidence_id, condition) VALUES (?, ?)",
            [(path.stem, condition) for condition in mapping["conditions"]],
        )

    projected = connection.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
    assert projected == len(paths), f"Projected {projected} of {len(paths)} evidence records"
    print(f"Projected all {projected} canonical evidence records")


if __name__ == "__main__":
    main()
