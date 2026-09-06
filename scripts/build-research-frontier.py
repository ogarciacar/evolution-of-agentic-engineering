#!/usr/bin/env python3
"""Build a deterministic research frontier from canonical model state."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
RESEARCH_GAPS = ROOT / "model" / "research-gaps.yaml"
EVALUATOR = ROOT / "scripts" / "evaluate-model-claims.py"
DEFAULT_OUTPUT = ROOT / "research-frontier.json"


def load_evaluation() -> dict:
    spec = importlib.util.spec_from_file_location("model_evaluator", EVALUATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load model evaluator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.evaluate()


def build_frontier() -> dict:
    evaluation = load_evaluation()
    gaps_document = yaml.safe_load(RESEARCH_GAPS.read_text(encoding="utf-8"))
    if gaps_document.get("model_version") != evaluation["model_version"]:
        raise ValueError("research gaps do not match the active model version")

    gaps = {gap["claim_id"]: gap for gap in gaps_document["research_gaps"]}
    frontier = []
    for claim in evaluation["claims"]:
        gap = gaps.get(claim["id"])
        if gap is None:
            raise ValueError(f"missing research gap for active claim {claim['id']}")
        if gap["stage"] != claim["stage"]:
            raise ValueError(f"research gap stage does not match active claim {claim['id']}")
        frontier.append({
            "claim_id": claim["id"],
            "stage": claim["stage"],
            "claim": claim["title"],
            "evaluation_state": claim["status"],
            "mapped_evidence_count": claim["evidence_count"],
            "research_question": gap["question"],
            "evidence_needed": gap["evidence_needed"],
        })

    return {"version": 1, "model_version": evaluation["model_version"], "frontier": frontier}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = build_frontier()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built research frontier for {len(result['frontier'])} active claims -> {output}")


if __name__ == "__main__":
    main()
