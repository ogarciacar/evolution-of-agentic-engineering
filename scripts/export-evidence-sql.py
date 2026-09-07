#!/usr/bin/env python3
"""Export canonical evidence as deterministic SQL for a projection-scoped remote D1 rebuild."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import yaml

from evidence_claims import relationships_for

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
PROJECTION_PATTERN = re.compile(r"^(?:main|[0-9a-f]{12})$")


def sql(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    return "'" + str(value).replace("'", "''") + "'"


def export(projection_id: str = "main") -> str:
    if not PROJECTION_PATTERN.fullmatch(projection_id):
        raise ValueError("projection_id must be 'main' or a 12-character lowercase hexadecimal commit SHA")

    projection = sql(projection_id)
    lines = [
        "PRAGMA defer_foreign_keys = true;",
        f"DELETE FROM evidence_claims WHERE projection_id = {projection};",
        f"DELETE FROM evidence_conditions WHERE projection_id = {projection};",
        f"DELETE FROM evidence_stages WHERE projection_id = {projection};",
        f"DELETE FROM evidence WHERE projection_id = {projection};",
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
            projection_id, evidence_id, path.relative_to(ROOT).as_posix(), source["title"], str(source["date"]),
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
            "INSERT INTO evidence (projection_id, evidence_id, github_path, source_title, source_date, producer, producer_type, "
            "source_type, provenance, source_url, headline, summary, observed_json, scale_label, scale_summary, "
            "transition_from, transition_to, adjacent_stage, interpretation, verdict, verdict_explanation, "
            "limitations_json, open_question, assisted_by_ai) VALUES (" + ", ".join(sql(v) for v in values) + ");"
        )
        for stage in sorted(mapping["stages"]):
            lines.append(
                "INSERT INTO evidence_stages (projection_id, evidence_id, stage) VALUES "
                f"({projection}, {sql(evidence_id)}, {sql(stage)});"
            )
        for condition in sorted(mapping["conditions"]):
            lines.append(
                "INSERT INTO evidence_conditions (projection_id, evidence_id, condition) VALUES "
                f"({projection}, {sql(evidence_id)}, {sql(condition)});"
            )
        for item in sorted(relationships_for(path), key=lambda item: item["id"]):
            lines.append(
                "INSERT INTO evidence_claims (projection_id, evidence_id, claim_id, relationship) VALUES "
                f"({projection}, {sql(evidence_id)}, {sql(item['id'])}, {sql(item['relationship'])});"
            )

    lines.append("PRAGMA defer_foreign_keys = false;")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / ".artifacts" / "evidence-sync.sql")
    parser.add_argument("--projection", default="main")
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(export(args.projection), encoding="utf-8")
    print(f"Exported D1 synchronization SQL for projection {args.projection} -> {output}")


if __name__ == "__main__":
    main()
