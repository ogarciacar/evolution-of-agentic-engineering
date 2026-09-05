#!/usr/bin/env python3
"""Validate explicit evidence-to-model-claim relationships."""
from pathlib import Path
import sys

import yaml

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
CLAIMS_PATH = ROOT / "model" / "claims.yaml"
MAPPINGS_PATH = ROOT / "model" / "evidence-claims.yaml"
RELATIONSHIPS = {"SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"}


def main() -> int:
    claim_ids = {item["id"] for item in yaml.safe_load(CLAIMS_PATH.read_text(encoding="utf-8"))["claims"]}
    evidence_ids = {path.stem for path in EVIDENCE_DIR.glob("*.yaml")}
    document = yaml.safe_load(MAPPINGS_PATH.read_text(encoding="utf-8"))
    failures = 0

    if document.get("version") != 1 or not isinstance(document.get("mappings"), dict):
        print("model/evidence-claims.yaml: expected version 1 and mappings object", file=sys.stderr)
        return 1

    mappings = document["mappings"]
    missing = sorted(evidence_ids - set(mappings))
    unknown_evidence = sorted(set(mappings) - evidence_ids)
    for evidence_id in missing:
        failures += 1
        print(f"model/evidence-claims.yaml: missing mapping for {evidence_id}", file=sys.stderr)
    for evidence_id in unknown_evidence:
        failures += 1
        print(f"model/evidence-claims.yaml: unknown evidence id {evidence_id}", file=sys.stderr)

    for evidence_id, relationships in mappings.items():
        if not isinstance(relationships, list) or not relationships:
            failures += 1
            print(f"model/evidence-claims.yaml:{evidence_id}: expected non-empty relationship list", file=sys.stderr)
            continue
        ids = [item.get("id") for item in relationships if isinstance(item, dict)]
        if len(ids) != len(relationships):
            failures += 1
            print(f"model/evidence-claims.yaml:{evidence_id}: invalid relationship object", file=sys.stderr)
            continue
        if len(ids) != len(set(ids)):
            failures += 1
            print(f"model/evidence-claims.yaml:{evidence_id}: duplicate claim id", file=sys.stderr)
        for item in relationships:
            if set(item) != {"id", "relationship"}:
                failures += 1
                print(f"model/evidence-claims.yaml:{evidence_id}: relationship must contain only id and relationship", file=sys.stderr)
            if item.get("id") not in claim_ids:
                failures += 1
                print(f"model/evidence-claims.yaml:{evidence_id}: unknown claim {item.get('id')}", file=sys.stderr)
            if item.get("relationship") not in RELATIONSHIPS:
                failures += 1
                print(f"model/evidence-claims.yaml:{evidence_id}: invalid relationship {item.get('relationship')}", file=sys.stderr)

    if failures:
        print(f"Evidence claim mapping validation failed with {failures} error(s)", file=sys.stderr)
        return 1
    print(f"Validated claim mappings for {len(evidence_ids)} evidence records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
