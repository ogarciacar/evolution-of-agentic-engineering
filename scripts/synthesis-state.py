#!/usr/bin/env python3
"""Build deterministic dependency fingerprints for canonical synthesis findings."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import yaml

from evidence_claims import all_relationships

ROOT = Path(__file__).resolve().parents[1]
SYNTHESIS = ROOT / "model" / "synthesis.yaml"
EVALUATOR = ROOT / "scripts" / "evaluate-model-claims.py"


def load_evaluation() -> dict:
    spec = importlib.util.spec_from_file_location("evaluate_model_claims", EVALUATOR)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module.evaluate()


def fingerprint(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_state() -> dict:
    synthesis = yaml.safe_load(SYNTHESIS.read_text(encoding="utf-8"))
    mappings = all_relationships()
    evaluation = load_evaluation()
    evaluated = {claim["id"]: claim for claim in evaluation["claims"]}

    findings = []
    for finding in synthesis["findings"]:
        claim_ids = sorted(finding["claims"])
        relevant_mappings = {}
        for evidence_id, relationships in sorted(mappings.items()):
            selected = sorted(
                (item for item in relationships if item["id"] in claim_ids),
                key=lambda item: (item["id"], item["relationship"]),
            )
            if selected:
                relevant_mappings[evidence_id] = selected
        dependency = {
            "claims": {
                claim_id: {
                    "status": evaluated[claim_id]["status"],
                    "evidence_count": evaluated[claim_id]["evidence_count"],
                    "relationship_counts": evaluated[claim_id]["relationship_counts"],
                }
                for claim_id in claim_ids
            },
            "mappings": relevant_mappings,
        }
        findings.append({"id": finding["id"], "fingerprint": fingerprint(dependency)})

    return {"version": 1, "model_version": synthesis["model_version"], "findings": findings}


if __name__ == "__main__":
    print(json.dumps(build_state(), ensure_ascii=False, indent=2) + "\n", end="")
