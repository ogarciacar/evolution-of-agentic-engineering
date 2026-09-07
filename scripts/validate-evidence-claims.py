#!/usr/bin/env python3
"""Validate evidence-to-model-claim relationships from evidence records or the legacy ledger."""
from pathlib import Path
import sys

import yaml

from evidence_claims import load_legacy_mappings, relationships_for

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = ROOT / "evidence"
CLAIMS_PATH = ROOT / "model" / "claims.yaml"
MAPPINGS_PATH = ROOT / "model" / "evidence-claims.yaml"
RELATIONSHIPS = {"SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE"}


def main() -> int:
    claims_document = yaml.safe_load(CLAIMS_PATH.read_text(encoding="utf-8"))
    model_version = claims_document.get("version")
    claim_ids = {item["id"] for item in claims_document["claims"]}
    evidence_paths = sorted(EVIDENCE_DIR.glob("*.yaml"))
    evidence_ids = {path.stem for path in evidence_paths}
    document = yaml.safe_load(MAPPINGS_PATH.read_text(encoding="utf-8"))
    failures = 0

    if document.get("version") != model_version or not isinstance(document.get("mappings"), dict):
        print(
            f"model/evidence-claims.yaml: expected version {model_version} and mappings object",
            file=sys.stderr,
        )
        return 1

    legacy_mappings = load_legacy_mappings()
    unknown_evidence = sorted(set(legacy_mappings) - evidence_ids)
    for evidence_id in unknown_evidence:
        failures += 1
        print(f"model/evidence-claims.yaml: unknown evidence id {evidence_id}", file=sys.stderr)

    for path in evidence_paths:
        evidence_id = path.stem
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        embedded = record.get("claims")
        legacy = legacy_mappings.get(evidence_id)

        if embedded is None and legacy is None:
            failures += 1
            print(
                f"{path.relative_to(ROOT)}: missing claims; add claims to the evidence record or a legacy mapping",
                file=sys.stderr,
            )
            continue
        if embedded is not None and legacy is not None and embedded != legacy:
            failures += 1
            print(
                f"{path.relative_to(ROOT)}: embedded claims disagree with model/evidence-claims.yaml",
                file=sys.stderr,
            )

        relationships = relationships_for(path, legacy_mappings)
        if not isinstance(relationships, list) or not relationships:
            failures += 1
            print(f"{path.relative_to(ROOT)}: expected non-empty claims list", file=sys.stderr)
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
    print(f"Validated claim mappings for {len(evidence_ids)} evidence records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
