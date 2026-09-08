#!/usr/bin/env python3
"""Validate canonical YAML evidence records against the evidence schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"
SCHEMA = ROOT / "schema" / "evidence.schema.json"


def duplicate_practice_observation_ids(record: object) -> list[str]:
    if not isinstance(record, dict):
        return []
    observations = record.get("practice_observations")
    if not isinstance(observations, list):
        return []

    seen: set[str] = set()
    duplicates: list[str] = []
    for observation in observations:
        if not isinstance(observation, dict):
            continue
        observation_id = observation.get("id")
        if not isinstance(observation_id, str):
            continue
        if observation_id in seen and observation_id not in duplicates:
            duplicates.append(observation_id)
        seen.add(observation_id)
    return duplicates


def practice_assessment_consistency_error(record: object) -> str | None:
    if not isinstance(record, dict):
        return None
    observations = record.get("practice_observations")
    if not isinstance(observations, list) or not observations:
        return None
    assessment = record.get("practice_assessment")
    status = assessment.get("status") if isinstance(assessment, dict) else "pending"
    if status != "assessed":
        return "practice observations require practice_assessment.status to be 'assessed'"
    return None


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

        for observation_id in duplicate_practice_observation_ids(record):
            failures += 1
            print(
                f"{path.relative_to(ROOT)}:practice_observations: duplicate observation id {observation_id!r}",
                file=sys.stderr,
            )

        consistency_error = practice_assessment_consistency_error(record)
        if consistency_error:
            failures += 1
            print(f"{path.relative_to(ROOT)}:practice_assessment: {consistency_error}", file=sys.stderr)

    if failures:
        print(f"Evidence validation failed with {failures} error(s)", file=sys.stderr)
        return 1
    print(f"Validated {len(files)} evidence records against {SCHEMA.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
