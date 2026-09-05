#!/usr/bin/env python3
from pathlib import Path
import json
import sys

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
GAPS_PATH = ROOT / "model" / "research-gaps.yaml"
CLAIMS_PATH = ROOT / "model" / "claims.yaml"
SCHEMA_PATH = ROOT / "schema" / "research-gaps.schema.json"


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


gaps = yaml.safe_load(GAPS_PATH.read_text())
claims = yaml.safe_load(CLAIMS_PATH.read_text())
schema = json.loads(SCHEMA_PATH.read_text())

errors = sorted(Draft202012Validator(schema).iter_errors(gaps), key=lambda e: list(e.path))
if errors:
    for error in errors:
        location = ".".join(str(part) for part in error.path) or "<root>"
        print(f"ERROR: {location}: {error.message}", file=sys.stderr)
    raise SystemExit(1)

if gaps["model_version"] != claims["version"]:
    fail("research gap model_version must match active claims version")

claim_by_id = {claim["id"]: claim for claim in claims["claims"]}
seen = set()
for gap in gaps["research_gaps"]:
    claim_id = gap["claim_id"]
    if claim_id in seen:
        fail(f"duplicate research gap for {claim_id}")
    seen.add(claim_id)
    claim = claim_by_id.get(claim_id)
    if claim is None:
        fail(f"research gap references unknown active claim {claim_id}")
    if gap["stage"] != claim["stage"]:
        fail(f"research gap stage for {claim_id} must match active claim stage {claim['stage']}")

missing = set(claim_by_id) - seen
extra = seen - set(claim_by_id)
if missing:
    fail(f"missing research gaps for active claims: {', '.join(sorted(missing))}")
if extra:
    fail(f"research gaps reference inactive claims: {', '.join(sorted(extra))}")

print(f"Validated {len(seen)} research gaps against the active model")
