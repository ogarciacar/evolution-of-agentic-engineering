#!/usr/bin/env python3
"""Check deterministic claim-evaluation semantics and the canonical evaluation."""
from __future__ import annotations

import importlib.util
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "evaluate-model-claims.py"
spec = importlib.util.spec_from_file_location("evaluate_model_claims", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)

assert module.status(Counter()) == "UNOBSERVED"
assert module.status(Counter(SUPPORTS=1)) == "EMERGING"
assert module.status(Counter(REFINES=2)) == "EMERGING"
assert module.status(Counter(SUPPORTS=1, INCONCLUSIVE=1)) == "CONTESTED"
assert module.status(Counter(INCONCLUSIVE=1)) == "CONTESTED"
assert module.status(Counter(SUPPORTS=10, CONTRADICTS=1)) == "CHALLENGED"

first = module.evaluate()
second = module.evaluate()
assert first == second
assert [claim["id"] for claim in first["claims"]] == ["C01", "C03", "C04", "C05"]

for claim in first["claims"]:
    assert sum(claim["relationship_counts"].values()) == claim["evidence_count"]
    assert claim["producer_count"] == len(claim["producers"])

print("Model claim evaluation is deterministic and aligned with the active claim contract")
