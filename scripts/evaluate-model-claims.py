#!/usr/bin/env python3
"""Derive deterministic model-claim evaluations from canonical mappings."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
CLAIMS = ROOT / "model" / "claims.yaml"
MAPPINGS = ROOT / "model" / "evidence-claims.yaml"
POLICY = ROOT / "model" / "evaluation-policy.yaml"
EVIDENCE_DIR = ROOT / "evidence"
RELATIONSHIPS = ("SUPPORTS", "REFINES", "CONTRADICTS", "INCONCLUSIVE")


def status(counts: Counter[str]) -> str:
    total = sum(counts.values())
    if total == 0:
        return "UNOBSERVED"
    if counts["CONTRADICTS"]:
        return "CHALLENGED"
    if counts["INCONCLUSIVE"]:
        return "CONTESTED"
    if counts["SUPPORTS"] + counts["REFINES"]:
        return "EMERGING"
    return "CONTESTED"


def evaluate() -> dict:
    claims_document = yaml.safe_load(CLAIMS.read_text(encoding="utf-8"))
    mappings_document = yaml.safe_load(MAPPINGS.read_text(encoding="utf-8"))
    policy = yaml.safe_load(POLICY.read_text(encoding="utf-8"))
    model_version = claims_document["version"]
    if mappings_document.get("version") != model_version:
        raise ValueError("evidence claim mappings do not match the active model version")
    if policy.get("model_version") != model_version:
        raise ValueError("evaluation policy does not match the active model version")

    claims = claims_document["claims"]
    mappings = mappings_document["mappings"]
    evidence_meta = {}
    for path in sorted(EVIDENCE_DIR.glob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        evidence_meta[path.stem] = {
            "producer": record["source"]["producer"],
            "provenance": record["source"]["provenance"],
            "source_type": record["source"]["type"],
            "date": str(record["source"]["date"]),
        }

    by_claim: dict[str, list[dict]] = {claim["id"]: [] for claim in claims}
    for evidence_id in sorted(mappings):
        for mapping in mappings[evidence_id]:
            by_claim[mapping["id"]].append({
                "evidence_id": evidence_id,
                "relationship": mapping["relationship"],
                **evidence_meta[evidence_id],
            })

    evaluations = []
    for claim in claims:
        evidence = by_claim[claim["id"]]
        counts = Counter(item["relationship"] for item in evidence)
        producers = sorted({item["producer"] for item in evidence})
        provenance = Counter(item["provenance"] for item in evidence)
        evaluations.append({
            "id": claim["id"],
            "stage": claim["stage"],
            "title": claim["title"],
            "status": status(counts),
            "evidence_count": len(evidence),
            "relationship_counts": {key: counts[key] for key in RELATIONSHIPS},
            "producer_count": len(producers),
            "producers": producers,
            "provenance_counts": dict(sorted(provenance.items())),
            "evidence": evidence,
        })

    return {"version": 2, "model_version": model_version, "claims": evaluations}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = evaluate()
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text, encoding="utf-8")
        print(f"Evaluated {len(result['claims'])} model claims -> {output}")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
