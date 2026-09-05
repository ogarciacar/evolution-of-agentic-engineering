#!/usr/bin/env python3
"""Validate canonical YAML evidence records against the evidence schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
SCHEMA = ROOT / "schema" / "evidence.schema.json"
CLAIMS = ROOT / "model" / "claims.yaml"


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    claim_ids = {claim["id"] for claim in yaml.safe_load(CLAIMS.read_text(encoding="utf-8"))["claims"]}
    failures = 0
    files = sorted(EVIDENCE_DIR.glob("*.yaml"))
    if not files:
        print("No evidence YAML records found", file=sys.stderr)
        return 1

    for path in files:
        try:
            record = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            failures += 1
            print(f"{path.relative_to(ROOT)}: invalid YAML: {exc}", file=sys.stderr)
            continue
        errors = sorted(validator.iter_errors(record), key=lambda error: list(error.absolute_path))
        for error in errors:
            failures += 1
            location = ".".join(str(part) for part in error.absolute_path) or "<root>"
            print(f"{path.relative_to(ROOT)}:{location}: {error.message}", file=sys.stderr)

        relationships = record.get("claims", []) if isinstance(record, dict) else []
        referenced = [relationship.get("id") for relationship in relationships if isinstance(relationship, dict)]
        duplicates = sorted({claim_id for claim_id in referenced if referenced.count(claim_id) > 1})
        for claim_id in duplicates:
            failures += 1
            print(f"{path.relative_to(ROOT)}:claims: duplicate claim id {claim_id}", file=sys.stderr)
        for claim_id in sorted(set(referenced) - claim_ids):
            failures += 1
            print(f"{path.relative_to(ROOT)}:claims: unknown claim id {claim_id}", file=sys.stderr)

    if failures:
        print(f"Evidence validation failed with {failures} error(s)", file=sys.stderr)
        return 1
    print(f"Validated {len(files)} evidence records against {SCHEMA.relative_to(ROOT)} and model claims")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
