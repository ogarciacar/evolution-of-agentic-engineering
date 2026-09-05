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


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
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

    if failures:
        print(f"Evidence validation failed with {failures} error(s)", file=sys.stderr)
        return 1
    print(f"Validated {len(files)} evidence records against {SCHEMA.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
