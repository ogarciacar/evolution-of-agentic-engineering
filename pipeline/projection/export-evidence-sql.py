#!/usr/bin/env python3
"""Export canonical evidence as deterministic SQL for a projection-scoped remote D1 rebuild."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
from evidence_claims import relationships_for

ROOT = Path(__file__).resolve().parents[2]
PROJECTION_PATTERN = re.compile(r"^(?:main|[0-9a-f]{12})$")


def sql(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    return "'" + str(value).replace("'", "''") + "'"


def export(projection_id: str = "main", source_root: Path = ROOT) -> str:
    if not PROJECTION_PATTERN.fullmatch(projection_id):
        raise ValueError("projection_id must be 'main' or a 12-character lowercase hexadecimal commit SHA")

    source_root = source_root.resolve()
    evidence_dir = source_root / "evidence"
    projection = sql(projection_id)
    lines = [
        "PRAGMA defer_foreign_keys = true;",
        f"DELETE FROM practice_observation_conditions WHERE projection_id = {projection};",
        f"DELETE FROM practice_observations WHERE projection_id = {projection};",
        f"DELETE FROM practice_assessments WHERE projection_id = {projection};",
        f"DELETE FROM evidence_claims WHERE projection_id = {projection};",
        f"DELETE FROM evidence_conditions WHERE projection_id = {projection};",
        f"DELETE FROM evidence_stages WHERE projection_id = {projection};",
        f"DELETE FROM evidence WHERE projection_id = {projection};",
    ]

    for path in sorted(evidence_dir.glob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        source = record["source"]
        presentation = record["presentation"]
        scale = record["scale"]
        mapping = record["mapping"]
        transition = mapping.get("transition") or {}
        implication = record["model_implication"]
        evidence_id = path.stem
        values = [
            projection_id, evidence_id, f"evidence/{path.name}", source["title"], str(source["date"]),
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

        assessment = record.get("practice_assessment") or {"status": "pending"}
        lines.append(
            "INSERT INTO practice_assessments (projection_id, evidence_id, status) VALUES "
            f"({projection}, {sql(evidence_id)}, {sql(assessment['status'])});"
        )
        for observation in sorted(record.get("practice_observations") or [], key=lambda item: item["id"]):
            lines.append(
                "INSERT INTO practice_observations "
                "(projection_id, evidence_id, observation_id, use_case, problem, reported_practice) VALUES "
                f"({projection}, {sql(evidence_id)}, {sql(observation['id'])}, {sql(observation['use_case'])}, "
                f"{sql(observation['problem'])}, {sql(observation['reported_practice'])});"
            )
            for condition in sorted(observation["selection_conditions"]):
                lines.append(
                    "INSERT INTO practice_observation_conditions "
                    "(projection_id, evidence_id, observation_id, condition) VALUES "
                    f"({projection}, {sql(evidence_id)}, {sql(observation['id'])}, {sql(condition)});"
                )

    lines.append("PRAGMA defer_foreign_keys = false;")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / ".artifacts" / "evidence-sync.sql")
    parser.add_argument("--projection", default="main")
    parser.add_argument("--source-root", type=Path, default=ROOT, help="Repository-shaped source root containing evidence/")
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(export(args.projection, args.source_root), encoding="utf-8")
    print(f"Exported D1 synchronization SQL for projection {args.projection} from {args.source_root.resolve()} -> {output}")


if __name__ == "__main__":
    main()
