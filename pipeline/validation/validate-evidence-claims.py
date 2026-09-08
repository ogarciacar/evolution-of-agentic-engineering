#!/usr/bin/env python3
"""Validate evidence-to-model-claim relationships embedded in evidence records."""
from pathlib import Path
import sys

import yaml

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))
from evidence_claims import relationships_for

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_DIR = ROOT / "evidence"
CLAIMS_PATH = ROOT / "model" / "claims.yaml"
RELATIONSHIPS = {"SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"}


def main() -> int:
    claims_document = yaml.safe_load(CLAIMS_PATH.read_text(encoding="utf-8"))
    claim_ids = {item["id"] for item in claims_document["claims"]}
    evidence_paths = sorted(EVIDENCE_DIR.glob("*.yaml"))
    failures = 0

    for path in evidence_paths:
        try:
            relationships = relationships_for(path)
        except ValueError as exc:
            failures += 1
            print(exc, file=sys.stderr)
            continue

        ids = [item.get("id") for item in relationships if isinstance(item, dict)]
        if len(ids) != len(relationships):
            failures += 1
            print(f"{path.relative_to(ROOT)}: invalid claim relationship object", file=sys.stderr)
            continue
        if len(ids) != len(set(ids)):
            failures += 1
            print(f"{path.relative_to(ROOT)}: duplicate claim id", file=sys.stderr)

        for item in relationships:
            if set(item) != {"id", "relationship"}:
                failures += 1
                print(f"{path.relative_to(ROOT)}: claim relationship must contain only id and relationship", file=sys.stderr)
            if item.get("id") not in claim_ids:
                failures += 1
                print(f"{path.relative_to(ROOT)}: unknown claim {item.get('id')}", file=sys.stderr)
            if item.get("relationship") not in RELATIONSHIPS:
                failures += 1
                print(f"{path.relative_to(ROOT)}: invalid relationship {item.get('relationship')}", file=sys.stderr)

    if failures:
        print(f"Evidence claim mapping validation failed with {failures} error(s)", file=sys.stderr)
        return 1
    print(f"Validated claim mappings for {len(evidence_paths)} evidence records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
