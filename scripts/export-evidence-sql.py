#!/usr/bin/env python3
"""Export canonical evidence as deterministic SQL for a remote D1 rebuild."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"


def sql(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    return "'" + str(value).replace("'", "''") + "'"


def export() -> str:
    lines = [
        "PRAGMA defer_foreign_keys = true;",
        "BEGIN TRANSACTION;",
        "DELETE FROM evidence_conditions;",
        "DELETE FROM evidence_stages;",
        "DELETE FROM evidence;",
    ]

    for path in sorted(EVIDENCE_DIR.glob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        source = record["source"]
        presentation = record["presentation"]
        scale = record["scale"]
        mapping = record["mapping"]
        transition = mapping.get("transition") or {}
        implication = record["model_implication"]
        evidence_id = path.stem
        values = [
            evidence_id, path.relative_to(ROOT).as_posix(), source["title"], str(source["date"]),
            source["producer"], source["producer_type"], source["type"], source["provenance"],
            source["url"], presentation["headline"], presentation.get("summary"),
            json.dumps(record["observed"], ensure_ascii=False, separators=(",", ":")),
            scale["label"], scale["summary"], transition.get("from"), transition.get("to"),
            transition.get("adjacent_stage"), record["interpretation"], implication["verdict"],
            implication["explanation"],
            json.dumps(record["what_this_does_not_establish"], ensure_ascii=False, separators=(",", ":")),
            record["open_question"], bool(record["assessment"]["assisted_by_ai"]),
        ]
        lines.append(
            "INSERT INTO evidence (evidence_id, github_path, source_title, source_date, producer, producer_type, "
            "source_type, provenance, source_url, headline, summary, observed_json, scale_label, scale_summary, "
            "transition_from, transition_to, adjacent_stage, interpretation, verdict, verdict_explanation, "
            "limitations_json, open_question, assisted_by_ai) VALUES (" + ", ".join(sql(v) for v in values) + ");"
        )
        for stage in sorted(mapping["stages"]):
            lines.append(f"INSERT INTO evidence_stages (evidence_id, stage) VALUES ({sql(evidence_id)}, {sql(stage)});")
        for condition in sorted(mapping["conditions"]):
            lines.append(f"INSERT INTO evidence_conditions (evidence_id, condition) VALUES ({sql(evidence_id)}, {sql(condition)});")

    lines.extend(["COMMIT;", "PRAGMA defer_foreign_keys = false;"])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / ".artifacts" / "evidence-sync.sql")
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(export(), encoding="utf-8")
    print(f"Exported D1 synchronization SQL -> {output}")


if __name__ == "__main__":
    main()
