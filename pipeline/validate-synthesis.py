#!/usr/bin/env python3
"""Validate canonical research synthesis against claims and evidence."""
from pathlib import Path
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
SYNTHESIS = ROOT / "model" / "synthesis.yaml"
CLAIMS = ROOT / "model" / "claims.yaml"
EVIDENCE = ROOT / "evidence"


def fail(message: str) -> None:
    print(f"synthesis: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    doc = yaml.safe_load(SYNTHESIS.read_text(encoding="utf-8"))
    claims_doc = yaml.safe_load(CLAIMS.read_text(encoding="utf-8"))
    if doc.get("version") != 1:
        fail("version must be 1")
    if doc.get("model_version") != claims_doc.get("version"):
        fail("model_version must match active claims version")
    claim_ids = {claim["id"] for claim in claims_doc["claims"]}
    evidence_ids = {path.stem for path in EVIDENCE.glob("*.yaml")}
    findings = doc.get("findings") or []
    seen = set()
    for finding in findings:
        fid = finding.get("id")
        if not fid or fid in seen:
            fail(f"finding id is missing or duplicated: {fid}")
        seen.add(fid)
        for field in ("title", "statement", "uncertainty"):
            if not str(finding.get(field, "")).strip():
                fail(f"{fid} requires {field}")
        refs = finding.get("evidence") or []
        if not refs:
            fail(f"{fid} must cite evidence")
        unknown_evidence = sorted(set(refs) - evidence_ids)
        if unknown_evidence:
            fail(f"{fid} references unknown evidence: {unknown_evidence}")
        unknown_claims = sorted(set(finding.get("claims") or []) - claim_ids)
        if unknown_claims:
            fail(f"{fid} references unknown claims: {unknown_claims}")
    print(f"Validated {len(findings)} traceable research findings")


if __name__ == "__main__":
    main()
